import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kolo — the circle that remembers',
  description:
    'A rotating savings circle where the pot remembers: who actually pays, which nudge works, and who has earned an earlier turn.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site">
          <div className="wrap bar">
            <Link href="/" className="brand">
              <span className="mark" aria-hidden>
                <svg viewBox="0 0 32 32" width="22" height="22">
                  <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2.5" />
                  <path d="M16 6.5v9.5l7 4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="23" cy="20" r="2.6" fill="currentColor" />
                </svg>
              </span>
              <span>
                Kolo<em>the circle that remembers</em>
              </span>
            </Link>
            <nav>
              <Link href="/">The circle</Link>
              <Link href="/claim">Claim check</Link>
              <Link href="/memory">Memory</Link>
            </nav>
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer className="site">
          <div className="wrap">
            <p>
              Kolo holds no money. Members pay each other directly; Kolo verifies the transfer on{' '}
              <strong>Sui Mainnet</strong> through <strong>Tatum</strong> and remembers what happened in{' '}
              <strong>Walrus Memory</strong>. Every fact shown here is read back from a memory, and every
              memory names the blob it lives in.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
