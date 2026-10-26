'use client';

import { useActionState } from 'react';
import { checkClaim, type ClaimActionState } from '../actions';
import { MEMBERS } from '../../src/seed/circle';

const initial: ClaimActionState = { status: 'idle' };

export function ClaimForm({ digest, member }: { digest: string; member?: string }) {
  const [state, action, pending] = useActionState(checkClaim, initial);

  return (
    <div className="stack">
      <form action={action} className="card">
        <div className="field">
          <label htmlFor="member">Who says they paid?</label>
          <select id="member" name="member" defaultValue={member && MEMBERS.includes(member as never) ? member : MEMBERS[0]}>
            {MEMBERS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="digest">Transaction digest</label>
          <input
            id="digest"
            name="digest"
            defaultValue={digest}
            placeholder="paste the digest the member sent"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <button className="primary" type="submit" disabled={pending}>
          {pending ? 'Asking Sui Mainnet…' : 'Check against the chain'}
        </button>
        <p className="hint" style={{ marginTop: '0.7rem', marginBottom: 0 }}>
          Kolo asks Tatum for the transaction, then compares recipient, amount and time against this
          round. Whatever it finds is written to Walrus Memory.
        </p>
      </form>

      {state.status === 'error' && (
        <div className="verdict bad">
          <h3>
            <span className="badge bad">not checked</span>
          </h3>
          <p className="small" style={{ margin: 0 }}>
            {state.message}
          </p>
        </div>
      )}

      {state.status === 'done' && state.result && (
        <div className={`verdict ${state.result.verdict === 'verified' ? 'ok' : 'bad'}`}>
          <h3>
            <span className={`badge ${state.result.verdict === 'verified' ? 'ok' : 'bad'}`}>
              <span className="dot" /> {state.result.verdict}
            </span>
            <span className="small muted">
              {state.result.member} · round 3
            </span>
          </h3>

          {state.result.reasons.length === 0 ? (
            <p className="small" style={{ margin: 0 }}>
              The transfer is on Sui Mainnet: right recipient, right amount, inside this round.
            </p>
          ) : (
            <ul className="reasons">
              {state.result.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}

          <p className="wrote" style={{ margin: 0 }}>
            {state.result.blobIds.length > 0 ? (
              <>
                Written to Walrus Memory:{' '}
                {state.result.blobIds.map((b) => (
                  <code key={b}>{b}</code>
                ))}
              </>
            ) : (
              <>No memory was written.</>
            )}
          </p>

          {state.result.verdict === 'contested' && (
            <p className="small" style={{ margin: 0 }}>
              This is recorded as a <strong>contested claim</strong>, not an accusation: the memory keeps
              both what {state.result.member} said and what the chain shows.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
