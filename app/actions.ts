'use server';

import { getStore } from '../src/data/store';

export interface ClaimActionState {
  status: 'idle' | 'done' | 'error';
  message?: string;
  result?: {
    verdict: 'verified' | 'contested';
    reasons: string[];
    member: string;
    digest: string;
    blobIds: string[];
    source: string;
  };
}

/**
 * Verify a contribution claim. Runs on the server only: the Tatum key and the
 * Walrus Memory delegate key never reach the browser.
 */
export async function checkClaim(_prev: ClaimActionState, form: FormData): Promise<ClaimActionState> {
  const member = String(form.get('member') ?? '').trim();
  const digest = String(form.get('digest') ?? '').trim();

  if (!member) return { status: 'error', message: 'Choose the member who says they paid.' };
  if (!digest) return { status: 'error', message: 'Paste the transaction digest they gave you.' };

  try {
    const store = await getStore();
    const out = await store.verifyClaim({ member, digest });
    return {
      status: 'done',
      result: {
        verdict: out.verdict,
        reasons: out.reasons,
        member: out.member,
        digest: out.digest,
        blobIds: out.blobIds,
        source: store.source,
      },
    };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}

export interface ContestState {
  status: 'idle' | 'done' | 'error';
  message?: string;
  blobId?: string;
}

/**
 * A member saying a memory held about them is wrong. It does not delete or edit
 * anything: it writes a dispute that references the memory, so the original stays
 * readable and the disagreement is on the record too.
 */
export async function contestMemory(_prev: ContestState, form: FormData): Promise<ContestState> {
  const member = String(form.get('member') ?? '').trim();
  const targetId = String(form.get('targetId') ?? '').trim();
  const reason = String(form.get('reason') ?? '').trim();

  if (!member || !targetId) return { status: 'error', message: 'missing member or target memory' };
  if (reason.length < 8) return { status: 'error', message: 'say a little more — at least 8 characters' };

  try {
    const store = await getStore();
    const { blobId } = await store.contest({ member, targetId, reason });
    return { status: 'done', blobId };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}

export interface RulingState {
  status: 'idle' | 'done' | 'error';
  message?: string;
  summary?: string;
  nextScore?: number | null;
  blobIds?: string[];
}

/**
 * Rule on a member's objection. An upheld ruling writes a correction that supersedes
 * their earlier standing; nothing is deleted, and a rejected ruling changes nothing.
 */
export async function ruleOnDispute(_prev: RulingState, form: FormData): Promise<RulingState> {
  const member = String(form.get('member') ?? '').trim();
  const disputeId = String(form.get('disputeId') ?? '').trim();
  const ruling = String(form.get('ruling') ?? '') as 'upheld' | 'rejected';
  const note = String(form.get('note') ?? '').trim();

  if (!member || !disputeId) return { status: 'error', message: 'missing member or dispute' };
  if (ruling !== 'upheld' && ruling !== 'rejected') return { status: 'error', message: 'choose upheld or rejected' };
  if (note.length < 8) return { status: 'error', message: 'say what you found — at least 8 characters' };

  try {
    const store = await getStore();
    const out = await store.resolveDispute({ member, disputeId, ruling, note });
    return { status: 'done', summary: out.summary, nextScore: out.nextScore, blobIds: out.blobIds };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}
