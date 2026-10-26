/**
 * Ruling on a dispute — the half of the loop the contest form opened.
 *
 * Pure on purpose: given the dispute, the memory it refers to, and the member's current
 * standing, it returns the memories to write. No network, no clock, no random.
 *
 * The rule the whole product rests on: nothing is deleted and nothing is edited.
 * A ruling writes a `dispute_resolution`, and if it is upheld it writes a
 * `reliability_trajectory` that SUPERSEDES the old one. A reader sees the original
 * memory, the objection, and the correction, in that order, forever.
 */
import type { MemoryEntity, MemberDisputeEntity, ReliabilityTrajectoryEntity } from './schema';

export type Ruling = 'upheld' | 'rejected';

/** How much an upheld dispute moves a score. Small, and stated rather than tuned. */
export const UPHELD_DELTA = 6;

export interface ResolveInput {
  dispute: Pick<MemberDisputeEntity['data'], 'member' | 'targetId' | 'reason'> & { id: string; circle: string };
  /** The member's latest standing, if they have one. */
  current: { score: number; evidenceIds: string[]; id: string } | null;
  ruling: Ruling;
  note: string;
  /** Stamped by the caller so the function stays deterministic. */
  at: string;
}

export interface ResolveOutcome {
  memories: MemoryEntity[];
  /** The standing after the ruling, for the UI to show immediately. */
  nextScore: number | null;
  /** Plain words, shown to the member. */
  summary: string;
}

export function resolve(input: ResolveInput): ResolveOutcome {
  const { dispute, current, ruling, note, at } = input;
  const resolutionId = `resolution-${dispute.id}`;

  const resolution: MemoryEntity = {
    id: resolutionId,
    circle: dispute.circle,
    at,
    type: 'dispute_resolution',
    data: {
      member: dispute.member,
      disputeId: dispute.id,
      targetId: dispute.targetId,
      ruling,
      note,
    },
  };

  if (ruling === 'rejected') {
    return {
      memories: [resolution],
      nextScore: current?.score ?? null,
      summary: `${dispute.member}'s objection was heard and not upheld. Their standing is unchanged, and both the memory and the objection stay on the record.`,
    };
  }

  // Upheld: the memory it referred to is wrong, so standing is corrected upward and the
  // correction says which memory it supersedes and which resolution caused it.
  const base = current?.score ?? 50;
  const nextScore = Math.min(100, Math.round(base + UPHELD_DELTA));
  const corrected: MemoryEntity = {
    id: `reliability-${dispute.member.toLowerCase()}-${Date.parse(at)}`,
    circle: dispute.circle,
    at,
    type: 'reliability_trajectory',
    supersedes: current?.id,
    data: {
      member: dispute.member,
      score: nextScore,
      evidenceIds: [...(current?.evidenceIds ?? []), resolutionId].slice(-12),
    },
  } as ReliabilityTrajectoryEntity;

  return {
    memories: [resolution, corrected],
    nextScore,
    summary: `${dispute.member}'s objection was upheld: ${dispute.targetId} was wrong. Their standing moves ${current ? `${current.score} → ` : ''}${nextScore}, and the correction supersedes the earlier record rather than erasing it.`,
  };
}
