import Link from 'next/link';
import { getStore } from '../src/data/store';
import { MemberCard, RotationList, SourceBadge } from './components/Bits';

export const dynamic = 'force-dynamic';

export default async function CirclePage() {
  const store = await getStore();
  const [members, rotation, memories, circles] = await Promise.all([
    store.members(),
    store.rotation(),
    store.memories(),
    store.circles(),
  ]);
  const circleName = circles.find((c) => c.id === (rotation?.circle ?? ''))?.name ?? 'kolo-circle-1';
  const turns: Record<string, string> = {};
  if (rotation) {
    turns[rotation.order[0] ?? ''] = 'collects first';
    turns[rotation.order.at(-1) ?? ''] = 'collects last';
  }

  return (
    <div className="stack">
      <section className="hero">
        <div className="section-head">
          <p className="eyebrow">Round {rotation?.round ?? 3} · {circleName}</p>
          <SourceBadge source={store.source} />
        </div>
        <h1>
          Kolo holds no money.
          <br />
          <em>It knows what happened to it.</em>
        </h1>
        <p className="lede">
          A rotating savings circle: everyone pays in, one member collects each round. The circle keeps a
          record of who actually pays, which reminder works, and who has earned an earlier turn — and that
          record follows a member to their next circle.
        </p>
        <p className="small muted">
          {members.length} members · 20 USDC a round · {memories.length} memories, each with its own blob.
        </p>
      </section>

      <div className="split">
        <section>
          <div className="section-head">
            <h2>Who pays, in practice</h2>
            <span className="small muted">read from memory, not configured</span>
          </div>
          <div className="grid-3">
            {members.map((m) => (
              <MemberCard key={m.name} member={m} />
            ))}
          </div>

          <div className="note info" style={{ marginTop: '1.25rem' }}>
            <strong>Why this is a memory problem.</strong> Ada&apos;s &ldquo;pays on the 5th&rdquo;, Emeka&apos;s
            &ldquo;never late, covered two shortfalls&rdquo; and Tunde&apos;s &ldquo;late twice&rdquo; are not
            settings anyone typed. They were written as memories from verified payments and settled disputes,
            and the board annotates itself from them.
          </div>
        </section>

        <aside className="stack">
          <div>
            <div className="section-head">
              <h2>Who collects, and why</h2>
            </div>
            {rotation ? (
              <>
                <RotationList rotation={rotation} />
                <p className="small muted" style={{ marginTop: '0.6rem' }}>
                  <Link className="evidence-link" href={`/memory?evidence=${rotation.memoryIds.join(',')}`}>
                    Show the {rotation.memoryIds.length} memories behind this order →
                  </Link>
                </p>
              </>
            ) : (
              <p className="muted">No rotation decision recorded yet.</p>
            )}
          </div>

          <div className="card">
            <p className="eyebrow">Next</p>
            <h3>Check a contribution</h3>
            <p className="small muted">
              A member says they paid. Kolo asks Sui Mainnet through Tatum whether that is true, and writes
              down what it found — either way.
            </p>
            <p style={{ marginBottom: 0 }}>
              <Link className="evidence-link" href="/claim">
                Open the claim check →
              </Link>
            </p>
          </div>

          <div className="card">
            <p className="eyebrow">The record travels</p>
            <h3>Emeka joins a second circle</h3>
            <p className="small muted">
              Day one in a group that has never met him, and his standing is already there.
            </p>
            <p style={{ marginBottom: 0 }}>
              <Link className="evidence-link" href="/portable">
                See the portability proof →
              </Link>
            </p>
          </div>

          <div className="card">
            <p className="eyebrow">Every fact, checkable</p>
            <p className="small muted" style={{ margin: 0 }}>
              Each memory names the blob it lives in. Open the{' '}
              <Link href="/memory">memory inspector</Link> to read them all.
            </p>
          </div>
        </aside>
      </div>

      {Object.keys(turns).length > 0 && (
        <p className="small muted">
          This round: <strong>{rotation?.order[0]}</strong> collects first,{' '}
          <strong>{rotation?.order.at(-1)}</strong> collects last.
        </p>
      )}
    </div>
  );
}
