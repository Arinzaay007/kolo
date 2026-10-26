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
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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

type Record_ = { id: string; type: string; blobId: string; at: string; sentence: string };
const EVIDENCE = 'evidence/seed-mainnet.json';

// Resume, do not duplicate. If an earlier run was interrupted (or rate limited), everything it
// already wrote is on chain and must not be written a second time.
const records: Record_[] = [];
try {
  const prev = JSON.parse(await readFile(EVIDENCE, 'utf8')) as { memories?: Record_[] };
  for (const r of prev.memories ?? []) records.push(r);
  if (records.length) console.log(`resuming: ${records.length} already written, ${SEED_MEMORIES.length - records.length} to go`);
} catch {
  /* first run */
}
const done = new Set(records.map((r) => r.id));

// The relayer allows 60 weighted requests/min per delegate key, and a write costs several
// (submit, then poll the job). Pace deliberately rather than discovering the limit at write 12.
const PACE_MS = Number(process.env.KOLO_SEED_PACE_MS ?? 2200);

const save = async () => {
  await mkdir('evidence', { recursive: true });
  await writeFile(
    EVIDENCE,
    JSON.stringify(
      {
        wroteAt: new Date().toISOString(),
        network: 'Sui Mainnet (Walrus Memory production relayer)',
        relayer: process.env.MEMWAL_SERVER_URL || 'https://relayer.memory.walrus.xyz',
        namespace: process.env.MEMWAL_NAMESPACE || 'kolo',
        count: records.length,
        memories: records,
      },
      null,
      2,
    ),
  );
};

/** A 429 is not a failure — it is the relayer asking for a minute. Honour the number it gives. */
async function writeWithBackoff(entity: (typeof SEED_MEMORIES)[number], attempt = 1): Promise<Awaited<ReturnType<typeof memwal.remember>>> {
  try {
    return await memwal.remember(entity);
  } catch (err) {
    const e = err as { status?: number; retryAfterSeconds?: number; cause?: string };
    if (e.status === 429 && attempt <= 4) {
      const wait = (e.retryAfterSeconds ?? 60) * 1000;
      console.log(`  rate limited, waiting ${Math.round(wait / 1000)}s (attempt ${attempt})`);
      await new Promise((r) => setTimeout(r, wait));
      return writeWithBackoff(entity, attempt + 1);
    }
    throw err;
  }
}

for (const entity of SEED_MEMORIES) {
  if (done.has(entity.id)) continue;
  const written = await writeWithBackoff(entity);
  records.push({
    id: entity.id,
    type: entity.type,
    blobId: written.blobId,
    at: entity.at,
    sentence: sentence(entity),
  });
  console.log(`✓ ${entity.type.padEnd(24)} ${written.blobId}`);
  await save();
  await new Promise((r) => setTimeout(r, PACE_MS));
}
if (records.length < SEED_MEMORIES.length) await save();

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
