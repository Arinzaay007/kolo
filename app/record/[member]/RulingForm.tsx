'use client';

import { useActionState } from 'react';
import { ruleOnDispute, type RulingState } from '../../actions';

const initial: RulingState = { status: 'idle' };

/**
 * The other half of a dispute. Someone rules; the record grows a resolution, and if the
 * objection holds it grows a correction that supersedes — it never edits the original.
 */
export function RulingForm({ member, disputeId }: { member: string; disputeId: string }) {
  const [state, action, pending] = useActionState(ruleOnDispute, initial);

  if (state.status === 'done') {
    return (
      <div className="ruling-done">
        <p className="small" style={{ margin: 0 }}>
          <strong>Ruling recorded.</strong> {state.summary}
        </p>
        {state.blobIds && state.blobIds.length > 0 && (
          <p className="wrote" style={{ margin: 0 }}>
            {state.blobIds.length} new {state.blobIds.length === 1 ? 'memory' : 'memories'}:{' '}
            {state.blobIds.map((b) => (
              <code key={b}>{b}</code>
            ))}
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="ruling">
      <input type="hidden" name="member" value={member} />
      <input type="hidden" name="disputeId" value={disputeId} />
      <div className="field">
        <label htmlFor={`note-${disputeId}`}>Rule on this objection</label>
        <input
          id={`note-${disputeId}`}
          name="note"
          placeholder="what did you find — the ruling quotes this"
          minLength={8}
          required
        />
      </div>
      <div className="ruling-buttons">
        <button className="primary small" name="ruling" value="upheld" type="submit" disabled={pending}>
          {pending ? 'Recording…' : 'Uphold — the member was right'}
        </button>
        <button className="ghost small" name="ruling" value="rejected" type="submit" disabled={pending}>
          Reject — the memory stands
        </button>
      </div>
      {state.status === 'error' && <p className="hint">Not recorded: {state.message}</p>}
    </form>
  );
}
