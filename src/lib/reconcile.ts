/**
 * Reconciliation: a member's claim against what Sui Mainnet says.
 *
 * Pure on purpose — no network, no clock, no randomness — so the rule that decides
 * whether someone's money landed is unit-tested rather than trusted. This is the
 * leg that makes memory a byproduct: every verdict drafts the memory to write.
 */
import type { MemoryDraft, MemoryEntity } from './schema';
import type { TransferObservation } from './tatum';

export interface ContributionClaim {
  id: string;
  circle: string;
  member: string;
  round: number;
  amountBase: string;
  /** The digest the member pointed at, if they gave one. */
  digest?: string | null;
  claimedAt: string;
}

export interface Expectation {
  /** Who should have received it — this round's collector. */
  recipient: string;
  amountBase: string;
  windowStartMs: number;
  windowEndMs: number;
}

export type Verdict = 'verified' | 'contested';

export interface ReconcileOutcome {
  verdict: Verdict;
  /** Why, in plain words. Shown to the member as-is: contested, never accused. */
  reasons: string[];
  /** The memories this verdict writes. Verification produces memory by construction. */
  memories: MemoryDraft[];
}

export function reconcile(claim: ContributionClaim, expected: Expectation, observed: TransferObservation): ReconcileOutcome {
  const reasons: string[] = [];
  const push = (r: string) => reasons.push(r);

  if (!claim.digest) {
    push('no transaction digest was given, so nothing could be checked');
  } else if (!observed.found) {
    push(
      observed.error
        ? `Sui Mainnet could not be read for this digest (${observed.error})`
        : 'no transaction with this digest exists on Sui Mainnet',
    );
  } else {
    if (observed.status && observed.status !== 'success') push(`the transaction ${observed.status} on chain`);

    const match = observed.recipients.find(
      (r) => sameAddress(r.address, expected.recipient) && BigInt(r.amountBase) === BigInt(expected.amountBase),
    );

    if (!observed.recipients.some((r) => sameAddress(r.address, expected.recipient))) {
      push(`the transfer did not reach this round's collector`);
    } else if (!match) {
      const got = observed.recipients
        .filter((r) => sameAddress(r.address, expected.recipient))
        .map((r) => r.amountBase)
        .join(', ');
      push(`the amount received (${got}) is not this round's contribution (${expected.amountBase})`);
    }

    if (observed.timestampMs === null) {
      push('the transaction is not in a checkpoint yet, so its time cannot be confirmed');
    } else if (observed.timestampMs < expected.windowStartMs || observed.timestampMs > expected.windowEndMs) {
      push('the transfer happened outside this round');
    }
  }

  const verdict: Verdict = reasons.length === 0 ? 'verified' : 'contested';

  const memories: MemoryDraft[] =
    verdict === 'verified'
      ? [
          {
            id: `verify-${claim.circle}-r${claim.round}-${claim.member}`,
            circle: claim.circle,
            type: 'contribution_verified',
            data: {
              round: claim.round,
              member: claim.member,
              digest: claim.digest as string,
              amountBase: expected.amountBase,
              paidAt: new Date(observed.timestampMs ?? Date.parse(claim.claimedAt)).toISOString(),
            },
          } satisfies MemoryDraft,
        ]
      : [
          {
            id: `contest-${claim.circle}-r${claim.round}-${claim.member}`,
            circle: claim.circle,
            type: 'contested_claim',
            data: {
              round: claim.round,
              member: claim.member,
              claimedDigest: claim.digest ?? null,
              chainSays: observed.found
                ? `a real transaction, but not this contribution: ${reasons[0] ?? 'details differ'}`
                : 'nothing at this digest',
              reasons,
              resolved: 'open',
            },
          } satisfies MemoryDraft,
        ];

  return { verdict, reasons, memories };
}

/** Sui addresses arrive zero-padded or not; compare the way the chain means them. */
export function sameAddress(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/^0x/, '').replace(/^0+/, '');
  return norm(a) === norm(b);
}

/** Turn drafts into entities ready to write, stamping the time once. */
export function stamp(drafts: MemoryDraft[], at = new Date().toISOString()): MemoryEntity[] {
  return drafts.map((d) => ({ ...d, at: d.at ?? at }) as MemoryEntity);
}
