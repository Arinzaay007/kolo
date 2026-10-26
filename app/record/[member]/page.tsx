import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStore } from '../../../src/data/store';
import { CIRCLE, CIRCLE_2, MEMBERS, MEMBERS_2 } from '../../../src/seed/circle';
import { SourceBadge } from '../../components/Bits';
import { ContestForm } from './ContestForm';
import { RulingForm } from './RulingForm';

export const dynamic = 'force-dynamic';

const KNOWN = [...MEMBERS, ...MEMBERS_2];

const CIRCLE_NAME: Record<string, string> = {
  [CIRCLE]: 'Lagos circle · week',
  [CIRCLE_2]: 'Ikeja circle · week',
};

export default async function RecordPage({ params }: { params: Promise<{ member: string }> }) {
  const { member: raw } = await params;
  const member = decodeURIComponent(raw);
  if (!KNOWN.includes(member as (typeof KNOWN)[number])) notFound();

  const store = await getStore();
  const record = await store.record(member);
  return (
    <div className="stack">
      <section className="hero">
        <div className="section-head">
          <p className="eyebrow">Member record</p>
          <SourceBadge source={store.source} />
        </div>
        <h1>
          What the circles remember
          <br />
          about <em>{member}</em>
        </h1>
        <p className="lede">
          This is {member}&apos;s own view. Not a summary someone wrote: every line is a memory, with the
          blob it lives in, and any line can be disputed by {member} without anyone&apos;s permission.
        </p>
        <p className="small muted">
          {record.corrections > 0 && (
            <>
              <span className="badge ok">
                <span className="dot" /> corrected {record.corrections}×
              </span>{' '}
            </>
          )}
          {record.reliability !== null ? (
            <>
              Standing: <strong>{Math.round(record.reliability)}/100</strong> · {' '}
              {record.byCircle.filter((c) => c.events.length > 0).length} circle(s) with events
            </>
          ) : (
            <>No history anywhere yet.</>
          )}
          {record.address && (
            <>
              {' '}
              · receives at <span className="mono">{record.address.slice(0, 14)}…</span>
            </>
          )}
        </p>
      </section>

      {record.byCircle.map((group) => (
        <section key={group.circle} className="card">
          <div className="section-head">
            <h2>{CIRCLE_NAME[group.circle] ?? group.circle}</h2>
            <span className="small muted">
              {group.events.length} {group.events.length === 1 ? 'memory' : 'memories'}
            </span>
          </div>

          {group.carriesHistory && (
            <div className="note info" style={{ marginBottom: '0.8rem' }}>
              Nothing has happened in this circle yet — {member}&apos;s standing here is carried from
              elsewhere. That is the point of a portable record.
            </div>
          )}

          {group.events.length === 0 ? (
            <p className="small muted">No events in this circle.</p>
          ) : (
            <ul className="memories">
              {group.events.map((row) => (
                <li className="memory" key={row.id}>
                  <div className="head">
                    <span className="chip">{row.type}</span>
                    <span className="small muted">{new Date(row.at).toISOString().slice(0, 10)}</span>
                  </div>
                  <p className="text">{row.sentence}</p>
                  <span className="blob">blob {row.blobId}</span>
                  <ContestForm member={member} targetId={row.id} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="card">
        <div className="section-head">
          <h2>Disputes</h2>
          <span className="small muted">{record.disputes.length} recorded</span>
        </div>
        {record.disputes.length === 0 ? (
          <p className="small muted">Nothing disputed.</p>
        ) : (
          <ul className="memories">
            {record.disputes.map((d) => {
              const ruled = record.resolutions.find((r) => r.disputeId === d.id);
              return (
                <li className="memory" key={d.id}>
                  <div className="head">
                    <span className="chip">dispute</span>
                    {ruled ? (
                      <span className={`badge ${ruled.ruling === 'upheld' ? 'ok' : 'plain'}`}>
                        <span className="dot" /> {ruled.ruling}
                      </span>
                    ) : (
                      <span className="badge warn">
                        <span className="dot" /> open
                      </span>
                    )}
                  </div>
                  <p className="text">{d.sentence}</p>
                  <span className="blob">blob {d.blobId}</span>
                  {ruled ? (
                    <p className="small muted" style={{ margin: 0 }}>
                      Ruling: {ruled.note}
                    </p>
                  ) : (
                    <RulingForm member={member} disputeId={d.id} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="small muted" style={{ marginBottom: 0 }}>
          A dispute never edits or deletes the memory it refers to. Both the original and the objection
          stay readable — the disagreement is part of the record.
        </p>
      </section>

      <p className="small muted">
        <Link className="evidence-link" href="/memory">
          Everything the circles remember →
        </Link>
        {' · '}
        <Link className="evidence-link" href={`/claim?member=${encodeURIComponent(member)}`}>
          Check a contribution from {member} →
        </Link>
      </p>
    </div>
  );
}
