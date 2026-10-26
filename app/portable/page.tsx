import Link from 'next/link';
import { getStore } from '../../src/data/store';
import { CIRCLE, CIRCLE_2 } from '../../src/seed/circle';
import { SourceBadge } from '../components/Bits';

export const dynamic = 'force-dynamic';

export default async function PortabilityPage() {
  const store = await getStore();
  const [record, second, rotation2, circles] = await Promise.all([
    store.record('Emeka'),
    store.members(CIRCLE_2),
    store.rotation(CIRCLE_2),
    store.circles(),
  ]);

  const emekaInSecond = second.find((m) => m.name === 'Emeka');
  const carried = record.byCircle.find((c) => c.carriesHistory);
  const c1 = circles.find((c) => c.id === CIRCLE);
  const c2 = circles.find((c) => c.id === CIRCLE_2);

  return (
    <div className="stack">
      <section className="hero">
        <div className="section-head">
          <p className="eyebrow">Portability</p>
          <SourceBadge source={store.source} />
        </div>
        <h1>
          Emeka joins a circle where
          <br />
          <em>nobody has ever met him.</em>
        </h1>
        <p className="lede">
          Same person, a different group, day one. He has no history here — every memory of him was
          earned somewhere else. Kolo still knows his record, because the record is his, not the
          circle&apos;s.
        </p>
      </section>

      <div className="split">
        <section className="card">
          <p className="eyebrow">Where the record came from · {c1?.name}</p>
          <h2>Earned over three rounds</h2>
          <p className="small muted">
            {record.byCircle.find((c) => c.circle === CIRCLE)?.events.length ?? 0} memories about Emeka,
            written from verified payments and the shortfalls he covered.
          </p>
          <ul className="memories" style={{ marginTop: '0.8rem' }}>
            {(record.byCircle.find((c) => c.circle === CIRCLE)?.events ?? []).slice(0, 6).map((row) => (
              <li className="memory" key={row.id}>
                <div className="head">
                  <span className="chip">{row.type}</span>
                </div>
                <p className="text">{row.sentence}</p>
                <span className="blob">blob {row.blobId}</span>
              </li>
            ))}
          </ul>
        </section>

        <aside className="stack">
          <div className="card" style={{ borderColor: '#cfe0d4', background: '#f8fbf9' }}>
            <p className="eyebrow">Day one · {c2?.name}</p>
            <h2 style={{ fontSize: '1.05rem' }}>Nothing has happened here yet</h2>
            <p className="small">
              {carried ? (
                <>
                  <strong>{carried.events.length} memories</strong> about Emeka in this circle. And still
                  Kolo shows <strong>{emekaInSecond?.reliability ?? record.reliability}/100</strong> —
                  recalled from the other circle, not from this one.
                </>
              ) : (
                <>No history here, and none carried.</>
              )}
            </p>
            <p className="small muted" style={{ marginBottom: 0 }}>
              A database per circle could not do this without an operator brokering the two, which is
              exactly the middleman memory on Walrus removes.
            </p>
          </div>

          {rotation2 && (
            <div className="card">
              <p className="eyebrow">Round {rotation2.round} · who collects first</p>
              <ol className="rotation">
                {rotation2.order.map((who, i) => (
                  <li key={who}>
                    <span className="slot">{i + 1}</span>
                    <div>
                      <span className="who">{who}</span>
                      <p className="why">{rotation2.reasons[i]}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="small muted" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
                <Link className="evidence-link" href={`/memory?evidence=${rotation2.memoryIds.join(',')}`}>
                  The evidence is in the other circle — open it →
                </Link>
              </p>
            </div>
          )}

          <div className="card">
            <p className="small muted" style={{ margin: 0 }}>
              <Link className="evidence-link" href="/record/Emeka">
                Emeka&apos;s own view of his record →
              </Link>
            </p>
          </div>
        </aside>
      </div>

      <div className="note info">
        <strong>What this page is really claiming.</strong> One Walrus Memory namespace, many circles.
        Recall is scoped per account and namespace, so a member&apos;s standing follows them without any
        server of ours deciding to share it. The rotation in the second circle put Emeka first on day
        one and cited three memories written in the first circle — click through and check.
      </div>
    </div>
  );
}
