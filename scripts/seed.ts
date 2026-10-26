/**
 * Writes the seed circle to Walrus Memory on Mainnet and records every blob id.
 *
 *   npm run seed            write for real
 *   npm run seed -- --dry   encode and print only, no network
 *
 * The output file (evidence/seed-mainnet.json) is the submission artifact: it is
 * what lets a judge check the "10+ memories on Mainnet" requirement ourselves.
 */
import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { KoloMemory } from '../src/lib/memory';
import { encode, sentence } from '../src/lib/schema';
import { CIRCLE, MEMBERS, RECALL_PROBES, SEED_MEMORIES } from '../src/seed/circle';

const dry = process.argv.includes('--dry');

if (dry) {
  console.log(`circle ${CIRCLE}, members ${MEMBERS.join(', ')}\n`);
  for (const e of SEED_MEMORIES) {
    console.log(`· [${e.type}] ${sentence(e)}`);
    console.log(`  ${encode(e).length} chars\n`);
  }
  console.log(`${SEED_MEMORIES.length} memories would be written.`);
  process.exit(0);
}

const memwal = await KoloMemory.fromEnv();
const health = await memwal.health();
console.log(`relayer: ok=${health.ok} writes=${health.writes ?? 'unknown'} namespace=${process.env.MEMWAL_NAMESPACE || 'kolo'}`);
if (!health.ok) throw new Error('relayer is not healthy; not writing');

const records: Array<{ id: string; type: string; blobId: string; at: string; sentence: string }> = [];
for (const entity of SEED_MEMORIES) {
  const written = await memwal.remember(entity);
  records.push({
    id: entity.id,
    type: entity.type,
    blobId: written.blobId,
    at: entity.at,
    sentence: sentence(entity),
  });
  console.log(`✓ ${entity.type.padEnd(24)} ${written.blobId}`);
}

// Prove they come back, by meaning, before claiming anything.
console.log('\nrecall check:');
let recallsOk = true;
for (const probe of RECALL_PROBES) {
  const hits = await memwal.recall(probe, 3);
  const ok = hits.length > 0;
  recallsOk &&= ok;
  console.log(`  ${ok ? '✓' : '✗'} "${probe}" → ${hits.length} hits${ok ? `: ${hits[0]?.entity.id}` : ''}`);
}

const out = {
  wroteAt: new Date().toISOString(),
  network: 'Sui Mainnet (Walrus Memory production relayer)',
  relayer: process.env.MEMWAL_SERVER_URL || 'https://relayer.memory.walrus.xyz',
  namespace: process.env.MEMWAL_NAMESPACE || 'kolo',
  circle: CIRCLE,
  count: records.length,
  recallsOk,
  records,
};
await mkdir('evidence', { recursive: true });
await writeFile('evidence/seed-mainnet.json', `${JSON.stringify(out, null, 2)}\n`);
console.log(`\n${records.length} memories on Mainnet. Evidence: evidence/seed-mainnet.json`);
if (!recallsOk) {
  console.error('recall returned nothing for at least one probe — investigate before submitting');
  process.exit(1);
}
