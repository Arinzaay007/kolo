/**
 * Find the Walrus Memory account ID that belongs to a Sui address.
 *
 *   npm run memwal:find -- --address 0x...
 *   npm run memwal:find -- --key suiprivkey1...        # derives the address for you
 *   npm run memwal:find                                 # uses MEMWAL_OWNER_SECRET / KOLO_PAYER_SECRET
 *
 * Why this exists: MEMWAL_ACCOUNT_ID is an on-chain object, and the playground shows it once. If
 * you closed the tab, or the account was created by a sponsored transaction that later errored,
 * the ID is still on chain — the AccountRegistry keeps a table of owner address -> account object.
 * This reads that table directly instead of asking anyone to remember anything.
 */
import 'dotenv/config';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { credentials } from '@grpc/grpc-js';

const PACKAGE_ID = '0xe7c16fbea0560e7057e2bf7422feaa4fb313749fc69c9e9092fac7a33b81d7f5';
const REGISTRY_ID = '0x8bf82c9e09e36b8d1c38298f68b7cb68e7b8762887e7592add9986d5e9cf199f';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const key = arg('key') ?? arg('owner') ?? process.env.MEMWAL_OWNER_SECRET ?? process.env.KOLO_PAYER_SECRET;
let address = arg('address') ?? process.env.MEMWAL_OWNER_ADDRESS;

if (!address && key) {
  address = Ed25519Keypair.fromSecretKey(key).toSuiAddress();
  console.log(`address derived from the key: ${address}`);
}

if (!address || !/^0x[0-9a-f]{64}$/i.test(address)) {
  console.error(
    'Need an address. Either:\n' +
      '  npm run memwal:find -- --address 0x…\n' +
      '  npm run memwal:find -- --key suiprivkey1…\n' +
      '  or set MEMWAL_OWNER_SECRET / KOLO_PAYER_SECRET in .env\n',
  );
  process.exit(2);
}

const client = new SuiGrpcClient({
  network: 'mainnet',
  transport: new GrpcTransport({ host: 'fullnode.mainnet.sui.io', channelCredentials: credentials.createSsl() }),
});

// The registry object tells us where its accounts table lives, so nothing here is hardcoded twice.
const registry: any = await client.getObject({ objectId: REGISTRY_ID, include: { json: true } });
const reg = registry.object?.json ?? registry.json;
const tableId: string | undefined = reg?.accounts?.id;
if (!tableId) {
  console.error('could not read the AccountRegistry.accounts table; the deployment may have changed');
  process.exit(1);
}

console.log(`registry  ${REGISTRY_ID}`);
console.log(`table     ${tableId} (${reg.accounts.size} accounts)\n`);

const addressBytes = Uint8Array.from(Buffer.from(address.replace(/^0x/i, ''), 'hex'));

let accountId: string | undefined;
try {
  const field: any = await client.getDynamicField({
    parentId: tableId,
    name: { type: 'address', bcs: addressBytes },
  });
  const df = field.dynamicField ?? field;
  const value: any = df.value ?? df.json;
  if (typeof value === 'string') {
    accountId = value;
  } else if (value?.bcs) {
    // object::ID arrives as 32 BCS bytes, not a hex string.
    const bytes = Buffer.isBuffer(value.bcs) ? value.bcs : Uint8Array.from(value.bcs.data ?? value.bcs);
    accountId = `0x${Buffer.from(bytes).toString('hex')}`;
  } else if (value?.id) {
    accountId = value.id;
  }
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  if (!/not found|does not exist|no such/i.test(message)) {
    console.error(`lookup failed: ${message}`);
    process.exit(1);
  }
}

if (!accountId) {
  console.log(`${address} has no Walrus Memory account.\n`);
  console.log('Create one (two transactions, ~0.005 SUI):');
  console.log(`  npm run memwal:account -- --owner ${key ? '<the same key>' : 'suiprivkey1…'}`);
  process.exit(1);
}

console.log(`MEMWAL_ACCOUNT_ID=${accountId}\n`);

// Confirm what is actually registered on it — an account with no delegate key cannot be used.
try {
  const acc: any = await client.getObject({ objectId: accountId, include: { json: true } });
  const a = acc.object?.json ?? acc.json;
  const delegates = Array.isArray(a?.delegate_keys) ? a.delegate_keys : [];
  console.log(`owner      ${a?.owner ?? 'unknown'}`);
  console.log(`active     ${a?.active ?? 'unknown'}`);
  console.log(`delegates  ${delegates.length}`);
  for (const d of delegates) {
    console.log(`  · ${d.label ?? '(no label)'}  ${d.sui_address ?? ''}`);
  }
  if (delegates.length === 0) {
    console.log('\nNo delegate key yet, so the relayer will reject SDK calls. Add one:');
    console.log(`  npm run memwal:account -- --owner <owner key> --reuse-account ${accountId}`);
  }
} catch (err) {
  console.log(`(could not read the account object: ${err instanceof Error ? err.message : String(err)})`);
}

console.log(`\npackage ${PACKAGE_ID}`);
