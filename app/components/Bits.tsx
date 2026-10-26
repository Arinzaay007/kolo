import Link from 'next/link';
import type { MemoryRow, MemberView, RotationView, Source } from '../../src/data/store';

/** The badge that keeps us honest about where the data came from. */
export function SourceBadge({ source }: { source: Source }) {
  return source === 'mainnet' ? (
    <span className="badge ok" title="Reads and writes go to Walrus Memory on Sui Mainnet">
      <span className="dot" /> Walrus Memory · Sui Mainnet
    </span>
  ) : (
    <span
      className="badge warn"
      title="Built from the seed circle in src/seed/circle.ts. Add MEMWAL_KEY and MEMWAL_ACCOUNT_ID to read the real Mainnet memories."
    >
      <span className="dot" /> Demo data · not Mainnet
    </span>
  );
}

function band(score: number): 'high' | 'mid' | 'low' {
  if (score >= 85) return 'high';
  if (score >= 70) return 'mid';
  return 'low';
}

export function ReliabilityBar({ score }: { score: number }) {
  return (
    <div className="metric">
      <div className="row">
        <span className="label">Reliability</span>
        <span className="mono">{Math.round(score)}/100</span>
      </div>
      <div className="bar" role="img" aria-label={`reliability ${Math.round(score)} out of 100`}>
        <span className={band(score)} style={{ width: `${Math.max(4, Math.min(100, score))}%` }} />
      </div>
    </div>
  );
}

export function MemberCard({ member }: { member: MemberView }) {
  return (
    <article className="card member">
      <div className="top">
        <span className="name">{member.name}</span>
        {member.paidThisRound ? (
          <span className="badge ok">
            <span className="dot" /> paid
          </span>
        ) : (
          <span className="badge plain">
            <span className="dot" /> expected
          </span>
        )}
      </div>
      <ReliabilityBar score={member.reliability} />
      <div className="learned">
        <span className="tag">learned — pay rhythm</span>
        {member.rhythmNote}
      </div>
      <div className="learned">
        <span className="tag">learned — best nudge</span>
        {member.bestNudge}
      </div>
      {member.earnedIn.length > 0 && !member.earnedIn.includes('kolo-circle-1') && (
        <span className="badge ok" title="Carried from another circle">
          record carried
        </span>
      )}
      <div className="row" style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap' }}>
        <Link className="evidence-link" href={`/record/${encodeURIComponent(member.name)}`}>
          {member.name}&apos;s own record →
        </Link>
        {member.evidenceIds.length > 0 && (
          <Link className="evidence-link" href={`/memory?evidence=${member.evidenceIds.join(',')}`}>
            {member.evidenceIds.length} memories
          </Link>
        )}
      </div>
    </article>
  );
}

export function RotationList({ rotation }: { rotation: RotationView }) {
  return (
    <ol className="rotation">
      {rotation.order.map((who, i) => (
        <li key={who}>
          <span className="slot">{i + 1}</span>
          <div>
            <span className="who">{who}</span>
            <p className="why">{rotation.reasons[i] ?? 'no reason recorded'}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function MemoryCard({ row, highlighted }: { row: MemoryRow; highlighted?: boolean }) {
  return (
    <li className={`memory${highlighted ? ' evidence' : ''}`}>
      <div className="head">
        <span className="chip">{row.type}</span>
        {row.member && <span className="badge plain">{row.member}</span>}
        <span className="small muted">{new Date(row.at).toISOString().slice(0, 10)}</span>
      </div>
      <p className="text">{row.sentence}</p>
      <span className="blob" title={row.blobId}>
        blob {row.blobId}
      </span>
    </li>
  );
}
