/**
 * Preflight: everything that must be true before the first real Mainnet payment.
 *
 *   npm run preflight
 *
 * Read-only. It never writes a memory and never settles a payment. It exists because the whole
 * stack is now Mainnet-only, so "find out at runtime" means finding out with real funds on the
 * line. Run this first, fix what it reports, then pay.
 */
import 'dotenv/config';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { credentials } from '@grpc/grpc-js';
import { COIN_TYPE_SUI } from '../src/lib/config';
import {
  buildChallenge,
  canSettle,
  FACILITATOR_URL,
  feeAmount,
  feeAsset,
  formatUsdc,
  network,
} from '../src/lib/x402';
import { addressOf, isPlaceholderAddress } from '../src/seed/circle';

type Check = { name: string; ok: boolean; detail: string; fatal: boolean };
const checks: Check[] = [];
const add = (name: string, ok: boolean, detail: string, fatal = true) =>
  checks.push({ name, ok, detail, fatal });

const env = (k: string) => (process.env[k] ?? '').trim();

// ── 1. no testnet anywhere ───────────────────────────────────────────────────
add(
  'x402 network is Mainnet',
  network() === 'sui:mainnet',
  network() === 'sui:mainnet' ? 'sui:mainnet' : `${network()} — this run is full Mainnet only`,
);

add(
  'Walrus relayer is the hosted one',
  !/staging|testnet|dev\./i.test(env('MEMWAL_SERVER_URL') || 'https://relayer.memory.walrus.xyz'),
  env('MEMWAL_SERVER_URL') || 'https://relayer.memory.walrus.xyz (default)',
);

// ── 2. memory is real, not a fixture ─────────────────────────────────────────
const memKey = env('MEMWAL_KEY');
const memAccount = env('MEMWAL_ACCOUNT_ID');
add(
  'Walrus Memory keys present',
  Boolean(memKey && memAccount),
  memKey && memAccount
    ? `account ${memAccount.slice(0, 8)}…`
    : 'MEMWAL_KEY / MEMWAL_ACCOUNT_ID missing — the app is in fixture mode, nothing is on Mainnet',
);

// ── 3. Tatum is the read path ────────────────────────────────────────────────
add(
  'Tatum API key present',
  Boolean(env('TATUM_API_KEY')),
  env('TATUM_API_KEY') ? 'set' : 'TATUM_API_KEY missing — keyless Tatum allows ~1 call then 429',
);

// ── 4. every member has a real address (no placeholders) ─────────────────────
for (const member of ['Ada', 'Emeka', 'Tunde', 'Ngozi', 'Bola']) {
  let addr = '';
  try {
    addr = addressOf(member, { requireReal: true });
  } catch {
    addr = '';
  }
  // A placeholder resolves cleanly but is not a real address, so check it explicitly.
  add(
    `address for ${member}`,
    Boolean(addr) && !isPlaceholderAddress(addr),
    addr || `KOLO_ADDR_${member.toUpperCase()} not set (a placeholder would be used, and that is not payable)`,
  );
}

// ── 5. the facilitator will settle the exact challenge we will issue ────────
let payTo = '';
try {
  payTo = addressOf(env('KOLO_X402_PAYEE_MEMBER') || 'Emeka', { requireReal: true });
} catch {
  /* already reported above */
}

const asset = feeAsset();
const amount = feeAmount(asset);
const challenge = buildChallenge({
  payTo: payTo || `0x${'0'.repeat(64)}`,
  resource: `${(env('KOLO_PUBLIC_URL') || 'http://localhost:3000').replace(/\/$/, '')}/api/collector`,
  description: 'collector fee, charged once a round reconciles',
  reconcileDigest: 'preflight',
});
const verdict = await canSettle(challenge.accepts[0]!).catch((e: unknown) => ({
  ok: false,
  reason: e instanceof Error ? e.message : String(e),
}));
add(
  'facilitator accepts our challenge',
  Boolean(verdict.ok),
  verdict.ok ? `settles ${amount} atomic of ${asset}` + (verdict.reason ? ` — note: ${verdict.reason}` : '') : String(verdict.reason),
);
console.log(`facilitator ${FACILITATOR_URL}\n`);

// ── 6. the payer can actually afford it, gas included ───────────────────────
const secret = env('KOLO_PAYER_SECRET');
if (!secret) {
  add('payer key present', false, 'KOLO_PAYER_SECRET missing — this is the only thing standing between us and a settled fee');
} else {
  try {
    const keypair = Ed25519Keypair.fromSecretKey(secret);
    const payer = keypair.toSuiAddress();
    add('payer key present', true, payer);

    const transport = new GrpcTransport({
      host: 'fullnode.mainnet.sui.io',
      channelCredentials: credentials.createSsl(),
    });
    const client = new SuiGrpcClient({ network: 'mainnet', transport });

    const feeIsSui = asset === COIN_TYPE_SUI;
    const { balance } = await client.getBalance({ owner: payer, coinType: feeIsSui ? COIN_TYPE_SUI : asset });
    const have = BigInt(balance.balance);
    const need = BigInt(amount);
    // ~0.005 SUI of gas headroom is generous; a transfer costs a fraction of a cent.
    const gas = feeIsSui ? 5_000_000n : 5_000_000n;
    add(
      `payer holds enough ${feeIsSui ? 'SUI' : 'fee coin'}`,
      have >= need + (feeIsSui ? 0n : gas) && (!feeIsSui || have >= need + gas),
      `has ${have} atomic, needs ${need} for the fee` + (feeIsSui ? ` + ${gas} for gas` : ` + ~${gas} SUI for gas`),
    );
    if (!feeIsSui) {
      const sui = await client.getBalance({ owner: payer, coinType: COIN_TYPE_SUI });
      add('payer has SUI for gas', BigInt(sui.balance.balance) >= gas, `${sui.balance.balance} atomic SUI`);
    }
  } catch (e) {
    add('payer key parses', false, e instanceof Error ? e.message : String(e));
  }
}

// ── report ──────────────────────────────────────────────────────────────────
const pad = Math.max(...checks.map((c) => c.name.length));
for (const c of checks) {
  const mark = c.ok ? 'ok  ' : c.fatal ? 'FAIL' : 'warn';
  console.log(`${mark}  ${c.name.padEnd(pad)}  ${c.detail}`);
}

const failed = checks.filter((c) => !c.ok && c.fatal);
console.log();
if (failed.length === 0) {
  console.log('READY — every gate passes. The next command spends real money, so read it first:');
  console.log(`  npm run x402:pay -- ${(env('KOLO_PUBLIC_URL') || 'http://localhost:3000').replace(/\/$/, '')}/api/collector`);
  console.log(`Cost: ${formatUsdc(amount)} of ${asset} plus a fraction of a cent of gas.`);
  process.exit(0);
}
console.log(`${failed.length} gate(s) failed. Nothing has been spent.`);
process.exit(1);
