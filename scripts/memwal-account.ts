/**
 * Create a Walrus Memory account and its delegate key — without the playground.
 *
 *   npm run memwal:account -- --owner suiprivkey1...
 *   npm run memwal:account -- --owner suiprivkey1... --reuse-account 0x...
 *
 * Why this exists: the hosted playground creates the account with a *sponsored* transaction, and
 * when that sponsor's authorization is stale or misconfigured you get "Invalid sponsor
 * authorization" with no way forward. Nothing about the account actually needs a sponsor — it is
 * two ordinary Sui transactions that cost a fraction of a cent. This script does them with your own
 * funded wallet instead.
 *
 * What it costs: two transactions, roughly 0.005 SUI total, on Mainnet.
 * What it produces: MEMWAL_ACCOUNT_ID, MEMWAL_KEY (delegate private key), MEMWAL_AGENT_ID.
 */
import 'dotenv/config';
import { generateDelegateKey, createAccount, addDelegateKey } from '@mysten-incubation/memwal/account';

// Public deployment IDs, from https://docs.wal.app/walrus-memory/contract/overview
const MAINNET = {
  packageId: '0xe7c16fbea0560e7057e2bf7422feaa4fb313749fc69c9e9092fac7a33b81d7f5',
  registryId: '0x8bf82c9e09e36b8d1c38298f68b7cb68e7b8762887e7592add9986d5e9cf199f',
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const ownerKey = arg('owner') ?? process.env.MEMWAL_OWNER_SECRET ?? process.env.KOLO_PAYER_SECRET;
const reuseAccount = arg('reuse-account');
const dry = process.argv.includes('--dry');
const label = arg('label') ?? 'Kolo · server';

if (dry) {
  // Key generation is pure cryptography — no chain, no sponsor, nothing to authorize.
  const d = await generateDelegateKey();
  const pub = typeof d.publicKey === 'string' ? d.publicKey : Buffer.from(d.publicKey).toString('hex');
  console.log('Dry run: a delegate keypair, generated locally and registered nowhere.\n');
  console.log(`delegate address  ${d.suiAddress}`);
  console.log(`MEMWAL_KEY=${d.privateKey}`);
  console.log(`MEMWAL_AGENT_ID=${pub}`);
  console.log('\nNo account exists yet, so this key cannot reach any memories. Run without --dry,');
  console.log('with a funded --owner wallet, to create the account and register it.');
  process.exit(0);
}

if (!ownerKey) {
  console.error(
    'Need a funded Mainnet wallet to pay for the two account transactions.\n\n' +
      '  npm run keys:sui -- --secrets        # pick one address\n' +
      '  # send ~0.1 SUI to it on the Sui network\n' +
      '  npm run memwal:account -- --owner suiprivkey1...\n',
  );
  process.exit(2);
}

console.log('Walrus Memory · Mainnet account setup');
console.log(`  package   ${MAINNET.packageId}`);
console.log(`  registry  ${MAINNET.registryId}`);
console.log(`  label     ${label}\n`);

// 1. A delegate key is just an Ed25519 keypair. No chain, no sponsor.
const delegate = await generateDelegateKey();
const publicKeyHex =
  typeof delegate.publicKey === 'string'
    ? delegate.publicKey
    : Buffer.from(delegate.publicKey).toString('hex');

console.log(`delegate address  ${delegate.suiAddress}`);
console.log(`delegate pubkey   ${publicKeyHex}\n`);

// 2. The account object. One per Sui address, ever — so a retry after a half-finished run needs
//    --reuse-account rather than a second create.
let accountId = reuseAccount ?? '';
if (accountId) {
  console.log(`reusing account ${accountId}; not creating a new one`);
} else {
  console.log('creating the account (transaction 1 of 2)…');
  try {
    const account = await createAccount({
      ...MAINNET,
      suiPrivateKey: ownerKey,
      suiNetwork: 'mainnet',
    });
    accountId = account.accountId;
    console.log(`  account   ${accountId}`);
    console.log(`  owner     ${account.owner}`);
    console.log(`  digest    ${account.digest}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\naccount creation failed: ${message}`);
    if (/already exist|EAccountAlreadyExists|\bcode 3\b/i.test(message)) {
      console.error(
        '\nThis wallet already owns a Walrus Memory account, so only the delegate key is missing.\n' +
          'Look the account up (it is on chain, you do not need to find the tab again):\n' +
          '  npm run memwal:find -- --key <the same key>\n' +
          'then re-run with --reuse-account 0x<that account id>.',
      );
    }
    process.exit(1);
  }
}

// 3. Authorize the delegate key against that account.
console.log('\nadding the delegate key (transaction 2 of 2)…');
try {
  const added = await addDelegateKey({
    ...MAINNET,
    accountId,
    publicKey: delegate.publicKey as Uint8Array,
    label,
    suiPrivateKey: ownerKey,
    suiNetwork: 'mainnet',
  });
  console.log(`  digest    ${added.digest}`);
  console.log(`  delegate  ${added.suiAddress}`);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\ndelegate key registration failed: ${message}`);
  if (/already|code 0/i.test(message)) console.error('(that key is already registered — fine, move on)');
  else process.exit(1);
}

console.log('\n─── put these in .env ──────────────────────────────────────────────────────\n');
console.log(`MEMWAL_ACCOUNT_ID=${accountId}`);
console.log(`MEMWAL_KEY=${delegate.privateKey}`);
console.log(`MEMWAL_AGENT_ID=${publicKeyHex}`);
console.log('MEMWAL_SERVER_URL=https://relayer.memory.walrus.xyz');
console.log('MEMWAL_NAMESPACE=kolo');
console.log('\nMEMWAL_AGENT_ID is the delegate PUBLIC key — that is what the submission form wants.');
console.log('MEMWAL_KEY is the private half. Never commit it.\n');
console.log('Verify with:  npm run spike');
