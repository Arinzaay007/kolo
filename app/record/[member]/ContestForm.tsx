'use client';

import { useActionState } from 'react';
import { contestMemory, type ContestState } from '../../actions';

const initial: ContestState = { status: 'idle' };

export function ContestForm({ member, targetId }: { member: string; targetId: string }) {
  const [state, action, pending] = useActionState(contestMemory, initial);

  return (
    <form action={action} className="contest">
      <input type="hidden" name="member" value={member} />
      <input type="hidden" name="targetId" value={targetId} />
      <div className="field">
        <label htmlFor={`reason-${targetId}`}>Something here is wrong?</label>
        <input
          id={`reason-${targetId}`}
          name="reason"
          placeholder="say what happened — it is recorded, not hidden"
          minLength={8}
          required
        />
      </div>
      <button className="primary small" type="submit" disabled={pending}>
        {pending ? 'Recording…' : 'Contest this memory'}
      </button>
      {state.status === 'error' && <p className="hint">Not recorded: {state.message}</p>}
      {state.status === 'done' && (
        <p className="hint">
          Recorded as an open dispute · blob <code>{state.blobId}</code>
        </p>
      )}
    </form>
  );
}
