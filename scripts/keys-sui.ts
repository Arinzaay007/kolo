/**
 * Generate the Sui addresses Kolo needs.
 *
 *   npm run keys:sui -- --check          # validate any addresses already in .env
 *   npm run keys:sui                     # five fresh addresses for the circle
 *   npm run keys:sui -- --secrets        # also print the secret keys (payer wallet)
 *
 * A member's address is public: it is the thing Tatum reads against. Only the PAYER needs a
 * secret, because only the payer signs anything. Nothing here is ever written to disk.
 */
import 'dotenv/config';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { isPlaceholderAddress } from '../src/seed/circle';

const MEMBERS = ['Ada', 'Emeka', 'Tunde', 'Ngozi', 'Bola'];
const args = process.argv.slice(2);
const showSecrets = args.includes('--secrets');
const checkOnly = args.includes('--check');
const valid = (a: string) => /^0x[0-9a-f]{64}$/i.test(a);

if (checkOnly) {
  console.log('Checking KOLO_ADDR_* in the environment\n');
  let bad = 0;
  for (const m of MEMBERS) {
    const key = `KOLO_ADDR_${m.toUpperCase()}`;
    const value = (process.env[key] ?? '').trim();
    if (!value) {
      console.log(`missing  ${key}`);
      bad++;
    } else if (!valid(value)) {
      console.log(`invalid  ${key} = ${value}  (need 0x and 64 hex characters)`);
      bad++;
    } else if (isPlaceholderAddress(value)) {
      console.log(`placeholder ${key} = ${value}  — this is a demo address, not payable`);
      bad++;
    } else {
      console.log(`ok       ${key} = ${value}`);
    }
  }
  console.log(bad === 0 ? '\nAll addresses look real.' : `\n${bad} address(es) need attention.`);
  process.exit(bad === 0 ? 0 : 1);
}

console.log('Five fresh Sui addresses for the circle.');
console.log('These are randomly generated — nobody has ever used them, and they hold nothing.\n');

const rows = MEMBERS.map((member) => {
  const kp = Ed25519Keypair.generate();
  return { member, address: kp.toSuiAddress(), secret: kp.getSecretKey() };
});

for (const r of rows) console.log(`${r.member.padEnd(7)} ${r.address}`);

console.log('\nPaste into .env:\n');
for (const r of rows) console.log(`KOLO_ADDR_${r.member.toUpperCase()}=${r.address}`);

if (showSecrets) {
  console.log('\n─── secret keys ────────────────────────────────────────────────────────────');
  console.log('Only a PAYER needs one. Pick one wallet as the payer and set:');
  console.log('  KOLO_PAYER_SECRET=suiprivkey1…\n');
  console.log('Fund that address with SUI (and USDC if paying the fee in USDC).');
  console.log('Fund nothing else. The other four keys can be thrown away.\n');
  for (const r of rows) console.log(`${r.member.padEnd(7)} ${r.secret}`);
  console.log('\nNever commit these. .env is gitignored; .keys/ is gitignored too.');
} else {
  console.log('\nNo secret keys printed. Run with --secrets only for the wallet that will pay.');
}

console.log('\nThese addresses are not funded and do not need to be: members only ever need to');
console.log('RECEIVE a transfer, and Kolo reads the chain to check whether it arrived.');
