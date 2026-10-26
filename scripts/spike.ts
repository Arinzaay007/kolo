/**
 * Day 0 gate. Three things must be true before any UI is written.
 *
 *   1. Walrus Memory answers, on the PRODUCTION relayer.
 *   2. A memory written now can be recalled by meaning a moment later.
 *   3. Tatum's Sui Mainnet gRPC gateway authenticates and reaches a node.
 *
 * Run: npm run spike
 * Pass SPIKE_DIGEST / SPIKE_OWNER to also read a real transaction or balance.
 */
import 'dotenv/config';
import { KoloMemory } from '../src/lib/memory';
import { createTatumSui, observeBalance, observeTransfer, TATUM_SUI_MAINNET_GRPC } from '../src/lib/tatum';
import { encode } from '../src/lib/schema';
import { toBase58 } from '@mysten/sui/utils';

const results: Array<{ gate: string; ok: boolean; detail: string }> = [];
const record = (gate: string, ok: boolean, detail: string) => {
  results.push({ gate, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${gate}\n      ${detail}\n`);
};

async function gateMemory() {
  const memwal = await KoloMemory.fromEnv();
  const health = await memwal.health();
  const writes = health.writes ?? 'unknown';
  record(
    '1 · Walrus Memory relayer',
    health.ok && writes !== 'paused',
    `ok=${health.ok} writes=${writes} (a paused or degraded write path means store nothing and come back)`,
  );

  const entity = {
    id: `spike-${Date.now()}`,
    circle: 'kolo-spike',
    at: new Date().toISOString(),
    type: 'member_rhythm' as const,
    data: { member: 'Spike', typicalDayOfMonth: 5, varianceDays: 0.5, samples: 1 },
  };
  const written = await memwal.remember(entity);
  record('2 · write + recall by meaning', true, `blob ${written.blobId}`);

  const hits = await memwal.recall('when does this member usually pay?', 5);
  const found = hits.some((h) => h.entity.id === entity.id);
  record(
    '2b · recall found what we just wrote',
    found,
    found ? `found among ${hits.length} hits` : `NOT found among ${hits.length} hits — check namespace ${process.env.MEMWAL_NAMESPACE || 'kolo'}`,
  );
}

async function gateTatum() {
  const client = createTatumSui();
  const keyed = Boolean(process.env.TATUM_API_KEY);

  // 3a. A real Mainnet read — the same call the pot's balance will use.
  const owner = process.env.SPIKE_OWNER || '0x0000000000000000000000000000000000000000000000000000000000000002';
  try {
    const bal = await observeBalance(client, owner);
    const sui = Number(BigInt(bal.totalBase)) / 1e9;
    record('3 · real Sui Mainnet read via Tatum gRPC', true, `${owner.slice(0, 10)}… holds ${bal.totalBase} base units (${sui.toLocaleString()} SUI)`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const rateLimited = /429|rate.?limit|too many/i.test(message);
    record(
      '3 · real Sui Mainnet read via Tatum gRPC',
      false,
      rateLimited
        ? `HTTP 429 — the keyless "anonymous" plan allows roughly one call. Set TATUM_API_KEY (dashboard.tatum.io); a demo will need it.`
        : message,
    );
  }

  // 3b. Optional: a real transaction, to prove the read we settle claims with.
  const digest = process.env.SPIKE_DIGEST;
  if (digest) {
    const seen = await observeTransfer(client, digest);
    record(
      '3b · a real transaction read',
      seen.found && !seen.error,
      seen.found
        ? `digest ${digest.slice(0, 10)}… status=${seen.status} recipients=${seen.recipients.length}`
        : `not read: ${seen.error ?? 'not found on chain'}`,
    );
  } else {
    // A digest that cannot exist proves auth + routing without needing a fixture.
    const absent = toBase58(new Uint8Array(32).fill(1));
    const seen = await observeTransfer(client, absent);
    record(
      '3b · absent digest answers "not found"',
      seen.error === null,
      seen.error === null
        ? 'the node answered as it should (key ' + (keyed ? 'present' : 'absent — anonymous plan') + ')'
        : `unexpected: ${seen.error}`,
    );
  }
}

try {
  await gateMemory();
} catch (err) {
  record('1 · Walrus Memory relayer', false, err instanceof Error ? err.message : String(err));
}
try {
  await gateTatum();
} catch (err) {
  record('3 · Tatum Sui gRPC', false, err instanceof Error ? err.message : String(err));
}

const failed = results.filter((r) => !r.ok);
console.log(
  failed.length === 0
    ? '\nAll gates green. Do not build UI until you can say this twice in a row.'
    : `\n${failed.length} gate(s) failed. Fix these before writing any UI.`,
);
process.exit(failed.length === 0 ? 0 : 1);
