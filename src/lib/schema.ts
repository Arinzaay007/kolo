/**
 * Kolo's memory schema.
 *
 * Walrus Memory stores text and embeds it. So every memory is written as:
 *
 *     <one plain sentence a person would say>
 *     <<<kolo-json>>>
 *     {the same fact, machine-readable}
 *
 * The sentence is what makes `recall({ query: "which nudge works on Ada" })`
 * actually find the memory — JSON alone embeds badly. The JSON tail is what
 * lets the app read the fact back exactly. Neither half is optional.
 */
import { z } from 'zod';

export const SCHEMA_ID = 'kolo.memory/1';
export const DELIM = '\n<<<kolo-json>>>\n';

const isoDate = z.string().datetime();
const memberId = z.string().min(1);

const base = z.object({
  /** Stable id, so a memory can be superseded rather than duplicated. */
  id: z.string().min(1),
  /** Circles share one namespace; the circle is named here, not in the namespace,
   *  so a member's reliability travels with them to the next circle. */
  circle: z.string().min(1),
  at: isoDate,
  /** The id of the memory this one corrects. Corrections are recorded, never silent. */
  supersedes: z.string().optional(),
});

export const MemberRhythm = base.extend({
  type: z.literal('member_rhythm'),
  data: z.object({
    member: memberId,
    typicalDayOfMonth: z.number().int().min(1).max(31),
    varianceDays: z.number().min(0),
    samples: z.number().int().min(0),
  }),
});

export const NudgeOutcome = base.extend({
  type: z.literal('nudge_outcome'),
  data: z.object({
    member: memberId,
    channel: z.enum(['whatsapp', 'sms', 'call', 'email']),
    hour: z.number().int().min(0).max(23),
    tone: z.enum(['gentle', 'firm', 'final']),
    paidWithinHours: z.number().min(0).nullable(),
  }),
});

export const ShortfallEvent = base.extend({
  type: z.literal('shortfall_event'),
  data: z.object({
    round: z.number().int().min(1),
    member: memberId,
    amountBase: z.string(),
    coveredBy: memberId.nullable(),
    repaid: z.boolean(),
    daysLate: z.number().min(0).nullable(),
  }),
});

export const ContestedClaim = base.extend({
  type: z.literal('contested_claim'),
  data: z.object({
    round: z.number().int().min(1),
    member: memberId,
    claimedDigest: z.string().nullable(),
    chainSays: z.string(),
    reasons: z.array(z.string()),
    resolved: z.enum(['open', 'member_right', 'chain_right']),
  }),
});

export const ContributionVerified = base.extend({
  type: z.literal('contribution_verified'),
  data: z.object({
    round: z.number().int().min(1),
    member: memberId,
    digest: z.string(),
    amountBase: z.string(),
    paidAt: isoDate,
  }),
});

export const ReliabilityTrajectory = base.extend({
  type: z.literal('reliability_trajectory'),
  data: z.object({
    member: memberId,
    score: z.number().min(0).max(100),
    evidenceIds: z.array(z.string()),
  }),
});

export const CircleConstitution = base.extend({
  type: z.literal('circle_constitution'),
  data: z.object({
    rule: z.string().min(1),
    origin: z.enum(['founded', 'learned_from_dispute', 'learned_from_lateness']),
    version: z.number().int().min(1),
  }),
});

/** Where a member receives contributions. Recalled, not configured: the address a
 *  claim is checked against comes out of memory, so a judge can trace it. */
export const CircleAccount = base.extend({
  type: z.literal('circle_account'),
  data: z.object({
    member: memberId,
    address: z.string().regex(/^0x[0-9a-f]{64}$/i, 'a Sui address is 0x and 64 hex characters'),
  }),
});

/** A member saying "that memory about me is wrong". Kept open until someone rules. */
export const MemberDispute = base.extend({
  type: z.literal('member_dispute'),
  data: z.object({
    member: memberId,
    targetId: z.string().min(1),
    reason: z.string().min(8),
    status: z.enum(['open', 'upheld', 'rejected']),
  }),
});

/** Someone rules on a dispute. A ruling that upholds the member writes a correction;
 *  nothing is ever deleted, and the original stays readable. */
export const DisputeResolution = base.extend({
  type: z.literal('dispute_resolution'),
  data: z.object({
    member: memberId,
    disputeId: z.string().min(1),
    targetId: z.string().min(1),
    ruling: z.enum(['upheld', 'rejected']),
    note: z.string().min(8),
  }),
});

export const RotationDecision = base.extend({
  type: z.literal('rotation_decision'),
  data: z.object({
    round: z.number().int().min(1),
    order: z.array(memberId).min(1),
    reasons: z.array(z.string()).min(1),
    memoryIds: z.array(z.string()).min(1),
  }),
});

/** The validator. Kept separate from the type so the type stays a discriminated
 *  union that TypeScript narrows on `e.type` — Zod's own inference of a union of
 *  extended objects collapses it into one object with a union-typed `data`. */
export const MemoryEntitySchema = z.discriminatedUnion('type', [
  MemberRhythm,
  NudgeOutcome,
  ShortfallEvent,
  ContestedClaim,
  ContributionVerified,
  ReliabilityTrajectory,
  CircleConstitution,
  CircleAccount,
  MemberDispute,
  DisputeResolution,
  RotationDecision,
]);

export type MemberRhythmEntity = z.infer<typeof MemberRhythm>;
export type NudgeOutcomeEntity = z.infer<typeof NudgeOutcome>;
export type ShortfallEventEntity = z.infer<typeof ShortfallEvent>;
export type ContestedClaimEntity = z.infer<typeof ContestedClaim>;
export type ContributionVerifiedEntity = z.infer<typeof ContributionVerified>;
export type ReliabilityTrajectoryEntity = z.infer<typeof ReliabilityTrajectory>;
export type CircleConstitutionEntity = z.infer<typeof CircleConstitution>;
export type CircleAccountEntity = z.infer<typeof CircleAccount>;
export type MemberDisputeEntity = z.infer<typeof MemberDispute>;
export type DisputeResolutionEntity = z.infer<typeof DisputeResolution>;
export type RotationDecisionEntity = z.infer<typeof RotationDecision>;

export type MemoryEntity =
  | MemberRhythmEntity
  | NudgeOutcomeEntity
  | ShortfallEventEntity
  | ContestedClaimEntity
  | ContributionVerifiedEntity
  | ReliabilityTrajectoryEntity
  | CircleConstitutionEntity
  | CircleAccountEntity
  | MemberDisputeEntity
  | DisputeResolutionEntity
  | RotationDecisionEntity;

export type MemoryType = MemoryEntity['type'];

/** Omit that distributes over a union, so each member keeps its own `type` literal. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A memory without its timestamp — what the engine drafts before it is written. */
export type MemoryDraft = DistributiveOmit<MemoryEntity, 'at'> & { at?: string };

export const ENTITY_TYPES: MemoryType[] = [
  'member_rhythm',
  'nudge_outcome',
  'shortfall_event',
  'contested_claim',
  'contribution_verified',
  'reliability_trajectory',
  'circle_constitution',
  'circle_account',
  'member_dispute',
  'dispute_resolution',
  'rotation_decision',
];

/**
 * The sentence half of the envelope. Written for a person, because that is what
 * gets embedded, and because a judge should be able to read the memory list.
 */
export function sentence(e: MemoryEntity): string {
  switch (e.type) {
    case 'member_rhythm': {
      const d = e.data;
      return `${d.member} usually pays around the ${ordinal(d.typicalDayOfMonth)} of the month, give or take ${d.varianceDays} days (${d.samples} payments seen).`;
    }
    case 'nudge_outcome': {
      const d = e.data;
      return d.paidWithinHours === null
        ? `${d.member} was nudged on ${d.channel} at ${d.hour}:00 and nothing arrived.`
        : `${d.member} was nudged on ${d.channel} at ${d.hour}:00 and paid ${d.paidWithinHours} hours later.`;
    }
    case 'shortfall_event': {
      const d = e.data;
      return d.coveredBy
        ? `In round ${d.round} ${d.member} fell short; ${d.coveredBy} covered it${d.repaid ? ' and was repaid' : ' and has not been repaid'}.`
        : `In round ${d.round} ${d.member} fell short and nobody covered it.`;
    }
    case 'contested_claim': {
      const d = e.data;
      return `${d.member} claimed a contribution in round ${d.round}, but the chain says: ${d.chainSays}.`;
    }
    case 'contribution_verified': {
      const d = e.data;
      return `${d.member} paid into round ${d.round}; the transfer is on Sui mainnet.`;
    }
    case 'reliability_trajectory': {
      const d = e.data;
      return `${d.member}'s reliability is ${Math.round(d.score)} out of 100, from ${d.evidenceIds.length} recorded events.`;
    }
    case 'circle_constitution': {
      const d = e.data;
      return `Circle rule: ${d.rule} (adopted ${d.origin.replaceAll('_', ' ')}, version ${d.version}).`;
    }
    case 'circle_account': {
      const d = e.data;
      return `${d.member} receives contributions at ${d.address}.`;
    }
    case 'member_dispute': {
      const d = e.data;
      return `${d.member} disputes a memory held about them: ${d.reason} (${d.status}).`;
    }
    case 'dispute_resolution': {
      const d = e.data;
      return `${d.member}'s dispute was ${d.ruling}: ${d.note}`;
    }
    case 'rotation_decision': {
      const d = e.data;
      return `Round ${d.round} pays out in this order: ${d.order.join(', then ')}. Because: ${d.reasons.join('; ')}.`;
    }
  }
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'] as const;
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** Entity → the exact text written to Walrus Memory. */
export function encode(e: MemoryEntity): string {
  return `${sentence(e)}${DELIM}${JSON.stringify(e)}`;
}

/** Text from Walrus Memory → entity, or null when it is not one of ours. */
export function decode(text: string): MemoryEntity | null {
  const at = text.indexOf(DELIM);
  if (at === -1) return null;
  try {
    const parsed = MemoryEntitySchema.safeParse(JSON.parse(text.slice(at + DELIM.length)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
