import Link from 'next/link';
import { getStore } from '../../src/data/store';
import { SourceBadge } from '../components/Bits';
import { ClaimForm } from './ClaimForm';

export const dynamic = 'force-dynamic';

export default async function ClaimPage({ searchParams }: { searchParams: Promise<{ digest?: string; member?: string }> }) {
  const { digest, member } = await searchParams;
  const store = await getStore();

  return (
    <div className="stack">
      <section className="hero">
        <div className="section-head">
          <p className="eyebrow">Claim check</p>
          <SourceBadge source={store.source} />
        </div>
        <h1>Did the money actually arrive?</h1>
        <p className="lede">
          In a circle, the awkward moment is always the same: someone says they paid. Kolo checks Sui
          Mainnet through Tatum and records what it found — including when the answer is
          &ldquo;not this round&rdquo;.
        </p>
      </section>

      <ClaimForm digest={digest ?? ''} member={member} />

      <div className="note">
        <strong>About the demo.</strong>{' '}
        {store.source === 'fixture' ? (
          <>
            This instance has no keys, so the verdict is computed from a stand-in observation rather than a
            chain read — the reconciliation logic is real and unit-tested, the chain is not being asked. Try
            a digest containing <code>old</code> to see the contested case, or starting with{' '}
            <code>missing</code> for a digest that is not on chain. Add <code>MEMWAL_KEY</code>,{' '}
            <code>MEMWAL_ACCOUNT_ID</code> and <code>TATUM_API_KEY</code> to make every line below a real
            read and a real write.
          </>
        ) : (
          <>
            Every verdict on this page is a real Tatum Sui gRPC read, and every verdict writes a real
            memory to Walrus Memory on Mainnet. Distrust the &ldquo;verified&rdquo; badge and open the
            digest yourself.
          </>
        )}
      </div>

      <p className="small muted">
        <Link className="evidence-link" href="/memory">
          Read what the circle remembers →
        </Link>
      </p>
    </div>
  );
}
