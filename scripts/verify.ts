/**
 * Read a real Mainnet transaction and say what Kolo would conclude.
 *
 * This is the real-funds tool: no writes, no keys beyond Tatum, nothing invented.
 *
 *   npm run verify -- <digest> [--expected <base units>] [--recipient <0x...>]
 *
 * With KOLO_ADDR_* set it checks against the round's real collector, exactly as the
 * app does. Use it to prove the pipeline before you ever demo it.
 */
import 'dotenv/config';
import { coinType, contributionBase, describe, formatAmount, roundWindow } from '../src/lib/config';
import { createTatumSui, observeTransfer } from '../src/lib/tatum';
import { reconcile, sameAddress } from '../src/lib/reconcile';
import { addressOf } from '../src/seed/circle';

const args = process.argv.slice(2);
const digest = args.find((a) => !a.startsWith('--'));
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

if (!digest) {
  console.error('usage: npm run verify -- <digest> [--expected <base units>] [--recipient 0x...]');
  process.exit(2);
}

const expectedBase = flag('expected') ?? contributionBase();
const collector = flag('recipient') ?? addressOf(process.env.KOLO_COLLECTOR_MEMBER || 'Emeka');
const window = roundWindow();

console.log('Kolo is pointed at:');
for (const line of describe()) console.log('  ' + line);
console.log(`  collector       ${process.env.KOLO_COLLECTOR_MEMBER || 'Emeka'} → ${collector}`);
console.log();

const client = createTatumSui();
const observed = await observeTransfer(client, digest, coinType());

console.log(`read ${digest}`);
if (!observed.found) {
  console.log(`  NOT READ: ${observed.error ?? 'no such transaction on Sui Mainnet'}`);
} else {
  console.log(`  status        ${observed.status}`);
  console.log(`  at            ${observed.timestampMs ? new Date(observed.timestampMs).toISOString() : 'not checkpointed'}`);
  console.log(`  sender        ${observed.sender ?? 'unknown'}`);
  console.log(`  coins moved   ${observed.coinTypes.join(', ') || 'none'}`);
  for (const r of observed.recipients) {
    const mark = sameAddress(r.address, collector) ? ' ← the collector' : '';
    console.log(`  received      ${r.amountBase} of ${r.coinType} by ${r.address}${mark}`);
  }
}

const out = reconcile(
  { id: 'verify', circle: 'kolo-circle-1', member: process.env.KOLO_COLLECTOR_MEMBER || 'Emeka', round: 3, amountBase: expectedBase, digest, claimedAt: new Date().toISOString() },
  { recipient: collector, amountBase: expectedBase, windowStartMs: window.startMs, windowEndMs: window.endMs },
  observed,
);

console.log();
console.log(`verdict: ${out.verdict.toUpperCase()}  (expecting ${formatAmount(expectedBase)})`);
for (const r of out.reasons) console.log(`  · ${r}`);
if (out.verdict === 'verified') console.log('  the chain agrees. this is what the app would record as a verified contribution.');
process.exit(out.verdict === 'verified' ? 0 : 1);
