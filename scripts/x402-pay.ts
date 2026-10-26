/**
 * Pay the collector fee — the payer side of x402, on Sui.
 *
 *   npm run x402:pay -- http://localhost:3000/api/collector
 *
 * Needs a funded payer key. On testnet that is free:
 *
 *   1. sui client new-address ed25519        (or any Sui wallet)
 *   2. sui client faucet                     (testnet SUI, no real money)
 *   3. export KOLO_PAYER_SECRET=<bech32 or base64 secret key>
 *      export KOLO_X402_NETWORK=sui:testnet
 *
 * The payer builds and signs its OWN transaction. This script never sends a key anywhere;
 * the signed bytes are handed to the facilitator, which can only relay them.
 */
import 'dotenv/config';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { credentials } from '@grpc/grpc-js';
import { decodeHeader, encodeHeader, type Challenge, type PaymentPayload } from '../src/lib/x402';
import { isPlaceholderAddress } from '../src/seed/circle';

const target = process.argv[2];
if (!target) {
  console.error('usage: npm run x402:pay -- <url>');
  console.error('   eg: npm run x402:pay -- http://localhost:3000/api/collector');
  process.exit(2);
}

const secret = process.env.KOLO_PAYER_SECRET;
if (!secret) {
  console.error('KOLO_PAYER_SECRET is not set. Generate one with: npm run keys:sui -- --secrets');
  process.exit(2);
}

const network = process.env.KOLO_X402_NETWORK === 'sui:testnet' ? 'testnet' : 'mainnet';
const fullnode =
  process.env.KOLO_SUI_FULLNODE ||
  (network === 'testnet' ? 'fullnode.testnet.sui.io' : 'fullnode.mainnet.sui.io');

const transport = new GrpcTransport({ host: fullnode, channelCredentials: credentials.createSsl() });
const client = new SuiGrpcClient({ network: network as 'testnet' | 'mainnet', transport });

const keypair = Ed25519Keypair.fromSecretKey(secret);
const payer = keypair.toSuiAddress();
console.log(`payer    ${payer}`);
console.log(`network  ${network} (${fullnode})`);

// ── 1. ask, unpaid ───────────────────────────────────────────────────────────
const first = await fetch(target, { headers: { accept: 'application/json' } });
console.log(`\nGET ${target} → ${first.status}${first.status === 402 ? ' Payment Required' : ''}`);

if (first.status !== 402) {
  const body = await first.text();
  console.log(body.slice(0, 400));
  console.log('\nNothing to pay: the endpoint answered without asking for payment.');
  process.exit(first.ok ? 0 : 1);
}

const challenge =
  decodeHeader<Challenge>(first.headers.get('PAYMENT-REQUIRED')) ??
  ((await first.json()) as Challenge);
const req = challenge.accepts[0];
if (!req) throw new Error('challenge has no acceptable payment requirements');

console.log(`  scheme   ${req.scheme}`);
console.log(`  network  ${req.network}`);
console.log(`  asset    ${req.asset}`);
console.log(`  amount   ${req.maxAmountRequired} atomic`);
console.log(`  payTo    ${req.payTo}`);

// A last line of defence: this spends real money, so refuse a payee nobody controls even if
// the server asked for it.
if (isPlaceholderAddress(req.payTo)) {
  console.error(`\nrefusing to pay: ${req.payTo} is a demo placeholder, not a real address.`);
  process.exit(1);
}

// ── 2. gas is ours to pay ────────────────────────────────────────────────────
// The hosted facilitator has no sponsor: /gas-station is 503 unless ENOKI_KEY is configured,
// and /verify rejects any transaction whose gas owner is not the sender. A sponsored payment
// cannot settle here, so the payer pays its own gas.
const gasBalance = await client.getBalance({ owner: payer, coinType: '0x2::sui::SUI' });
const sui = BigInt(gasBalance.balance.balance);
console.log(`gas      ${sui} atomic SUI (${Number(sui) / 1e9} SUI)`);
if (sui < 5_000_000n) {
  console.error(
    `\nThe payer holds ${Number(sui) / 1e9} SUI; a transfer needs roughly 0.005.\n` +
      'Send ~0.1 SUI to this address on the Sui network, then run this again.\n' +
      'Do not use a gas station: the hosted facilitator does not sponsor, and /verify\n' +
      'rejects any transaction whose gas owner is not the sender.',
  );
  process.exit(1);
}

// ── 3. build and sign our own transaction ────────────────────────────────────
// The facilitator is asset-agnostic, so whatever `asset` the challenge names is what we send.
const tx = new Transaction();
tx.setSender(payer);

if (req.asset.endsWith('::sui::SUI')) {
  const [coin] = tx.splitCoins(tx.gas, [BigInt(req.maxAmountRequired)]);
  tx.transferObjects([coin], req.payTo);
} else {
  // A non-SUI coin: pick the payer's largest coin of that type and split it.
  const { objects } = await client.listCoins({ owner: payer, coinType: req.asset, limit: 50 });
  const biggest = objects.sort((a, b) => (BigInt(b.balance) > BigInt(a.balance) ? 1 : -1))[0];
  if (!biggest) throw new Error(`payer holds no ${req.asset}`);
  const [coin] = tx.splitCoins(tx.object(biggest.objectId), [BigInt(req.maxAmountRequired)]);
  tx.transferObjects([coin], req.payTo);
}

const bytes = await tx.build({ client });

// The one property /verify insists on: gas owner === sender.
const built = tx.getData();
const gasOwner = built.gasData.owner ?? payer;
if (gasOwner !== payer) {
  console.error(
    `\nrefusing to sign: gas owner is ${gasOwner} but the sender is ${payer}.\n` +
      'That is a sponsored transaction, and the facilitator rejects it as an invalid\n' +
      'sponsor authorization. Kolo always pays its own gas.',
  );
  process.exit(1);
}
console.log(`gas owner ${gasOwner}  (same as sender, self-funded)`);

const { signature } = await keypair.signTransaction(bytes);

const payload: PaymentPayload = {
  x402Version: 2,
  resource: { url: req.resource, description: req.description, mimeType: req.mimeType },
  accepted: req,
  payload: {
    signature,
    transaction: Buffer.from(bytes).toString('base64'),
  },
};

// ── 4. retry, paid ───────────────────────────────────────────────────────────
console.log('\nretrying with PAYMENT-SIGNATURE (the facilitator will verify, then settle)…');
const paid = await fetch(target, {
  headers: { accept: 'application/json', 'PAYMENT-SIGNATURE': encodeHeader(payload) },
});

const body = await paid.text();
console.log(`\nGET → ${paid.status}`);
if (/sponsor/i.test(body)) {
  console.log(
    '\nThat is a sponsored-transaction error. The hosted facilitator does not sponsor:\n' +
      '/gas-station is 503 without an ENOKI_KEY, and /verify rejects a transaction whose\n' +
      'gas owner is not the sender. Fund the payer with ~0.1 SUI and send it again.',
  );
}
const receipt = paid.headers.get('PAYMENT-RESPONSE');
if (receipt) console.log(`PAYMENT-RESPONSE ${Buffer.from(receipt, 'base64').toString('utf8').slice(0, 400)}`);
console.log(body.slice(0, 600));

process.exit(paid.ok ? 0 : 1);
