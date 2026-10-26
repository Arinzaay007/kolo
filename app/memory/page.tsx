import Link from 'next/link';
import { getStore, type MemoryRow } from '../../src/data/store';
import { ENTITY_TYPES, type MemoryType } from '../../src/lib/schema';
import { MemoryCard, SourceBadge } from '../components/Bits';

export const dynamic = 'force-dynamic';

const LABELS: Record<string, string> = {
  member_rhythm: 'pay rhythm',
  nudge_outcome: 'nudge',
  shortfall_event: 'shortfall',
  contested_claim: 'contested',
  contribution_verified: 'verified',
  reliability_trajectory: 'reliability',
  circle_constitution: 'rule',
  rotation_decision: 'rotation',
};

export default async function MemoryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; evidence?: string }>;
}) {
  const { type, evidence } = await searchParams;
  const store = await getStore();
  const evidenceIds = evidence ? evidence.split(',').filter(Boolean) : [];

  const all = await store.memories();
  const shown = await store.memories(type && ENTITY_TYPES.includes(type as MemoryType) ? (type as MemoryType) : undefined);
  const highlighted = evidenceIds.length > 0 ? await store.byIds(evidenceIds) : [];

  return (
    <div className="stack">
      <section className="hero">
        <div className="section-head">
          <p className="eyebrow">Memory inspector</p>
          <SourceBadge source={store.source} />
        </div>
        <h1>Everything the circle remembers</h1>
        <p className="lede">
          {all.length} memories, each a small true thing learned from a verified payment or a settled
          dispute. Every one names the blob it lives in.
        </p>
      </section>

      {highlighted.length > 0 && (
        <section className="card" style={{ borderColor: '#cfe0d4', background: '#f8fbf9' }}>
          <div className="section-head">
            <h2>The memories behind that decision</h2>
            <Link className="evidence-link" href="/memory">
              show all
            </Link>
          </div>
          <ul className="memories">
            {highlighted.map((row) => (
              <MemoryCard key={row.id} row={row} highlighted />
            ))}
          </ul>
          {highlighted.length < evidenceIds.length && (
            <p className="small muted" style={{ marginBottom: 0 }}>
              {evidenceIds.length - highlighted.length} of the named memories were not returned by this
              store — a recall that misses is worth seeing, not hiding.
            </p>
          )}
        </section>
      )}

      <div className="filters">
        <Link href="/memory" aria-current={!type ? 'true' : 'false'}>
          all {all.length}
        </Link>
        {ENTITY_TYPES.map((t) => {
          const n = all.filter((r) => r.type === t).length;
          if (n === 0) return null;
          return (
            <Link key={t} href={`/memory?type=${t}`} aria-current={type === t ? 'true' : 'false'}>
              {LABELS[t] ?? t} {n}
            </Link>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="muted">Nothing of that kind yet.</p>
      ) : (
        <ul className="memories">
          {shown.map((row) => (
            <MemoryCard key={row.id} row={row} />
          ))}
        </ul>
      )}

      <div className="note info">
        <strong>Why this page exists.</strong> It is easy to say an app &ldquo;learns&rdquo;. This is the
        receipt: the sentence a person can read, the machine-readable tail the app acts on, and the blob id
        to look up. The rotation on the front page is not re-derived when the page renders — the reasons were
        stored, and they are these memories.
      </div>
    </div>
  );
}
