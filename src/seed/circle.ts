/**
 * The demo circle, seeded.
 *
 * Cycles 1 and 2 are history: they exist so the app has something to have learned
 * from on day one. Every one of these is written to Walrus Memory on Mainnet for
 * real — the history is scripted, the memory writes are not. That distinction is
 * stated plainly in the README and the blog post.
 *
 * Members are fictional. Amounts are base units (USDC has 6 decimals).
 */
import type { MemoryEntity } from '../lib/schema';

export const CIRCLE = 'kolo-circle-1';
export const CIRCLE_2 = 'kolo-circle-2';
export const MEMBERS = ['Ada', 'Emeka', 'Tunde'] as const;
export const MEMBERS_2 = ['Emeka', 'Ngozi', 'Bola'] as const;
export const CONTRIBUTION_BASE = '20000000'; // 20 USDC
export const ROUND_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * A member's Sui address. Identity, not membership: one address, every circle.
 *
 * Placeholders by default. Set KOLO_ADDR_ADA / KOLO_ADDR_EMEKA / etc. to real Mainnet
 * addresses and every claim check below verifies against the chain for real. Read at
 * call time, not import time, so a script and the app agree.
 */
const PLACEHOLDER: Record<string, string> = {
  Ada: `0x${'a1'.repeat(32)}`,
  Emeka: `0x${'e7'.repeat(32)}`,
  Tunde: `0x${'7d'.repeat(32)}`,
  Ngozi: `0x${'11'.repeat(32)}`,
  Bola: `0x${'b0'.repeat(32)}`,
};

/** The addresses that exist only so the demo UI has something to render. Never pay these. */
export const PLACEHOLDER_ADDRESSES = new Set(Object.values(PLACEHOLDER).map((a) => a.toLowerCase()));

export function isPlaceholderAddress(address: string): boolean {
  return PLACEHOLDER_ADDRESSES.has(address.toLowerCase());
}

/**
 * Resolve a member to a Sui address.
 *
 * `requireReal` is for anything that moves money. Without it, an unset KOLO_ADDR_* quietly falls
 * back to a placeholder — fine for the demo UI, fatal for a payment: the fee would be sent to an
 * address nobody holds a key for, and the flow would look like it worked.
 */
export function addressOf(member: string, opts: { requireReal?: boolean } = {}): string {
  const key = `KOLO_ADDR_${member.toUpperCase()}`;
  const real = process.env[key];
  if (!real) {
    if (opts.requireReal) {
      throw new Error(`${key} is not set; refusing to use a placeholder address for a real payment`);
    }
    return PLACEHOLDER[member] ?? '';
  }
  // A malformed address must stop the run, not fall back. Silently using a placeholder
  // here would make a demo verify against a fake address while looking real.
  if (!/^0x[0-9a-f]{64}$/i.test(real)) {
    throw new Error(`${key} is not a Sui address (expected 0x and 64 hex characters, got "${real}")`);
  }
  return real;
}

export const ACCOUNTS: Record<string, string> = new Proxy(PLACEHOLDER, {
  get: (_t, prop: string) => (typeof prop === 'string' ? addressOf(prop) : undefined),
});

export const CIRCLES = [
  { id: CIRCLE, name: 'Lagos circle · week', members: MEMBERS, round: 3 },
  { id: CIRCLE_2, name: 'Ikeja circle · week', members: MEMBERS_2, round: 1 },
] as const;

const at = (iso: string) => iso;

export const SEED_MEMORIES: MemoryEntity[] = [
  // --- what the circle knows about how each member pays -------------------
  {
    id: 'rhythm-ada',
    circle: CIRCLE,
    at: at('2026-10-06T09:00:00.000Z'),
    type: 'member_rhythm',
    data: { member: 'Ada', typicalDayOfMonth: 5, varianceDays: 0.4, samples: 3 },
  },
  {
    id: 'rhythm-emeka',
    circle: CIRCLE,
    at: at('2026-10-06T09:00:00.000Z'),
    type: 'member_rhythm',
    data: { member: 'Emeka', typicalDayOfMonth: 4, varianceDays: 0.7, samples: 3 },
  },
  {
    id: 'rhythm-tunde',
    circle: CIRCLE,
    at: at('2026-10-06T09:00:00.000Z'),
    type: 'member_rhythm',
    data: { member: 'Tunde', typicalDayOfMonth: 9, varianceDays: 3.8, samples: 3 },
  },

  // --- which nudge actually works, per member ----------------------------
  {
    id: 'nudge-ada-whatsapp',
    circle: CIRCLE,
    at: at('2026-10-05T22:00:00.000Z'),
    type: 'nudge_outcome',
    data: { member: 'Ada', channel: 'whatsapp', hour: 19, tone: 'gentle', paidWithinHours: 3 },
  },
  {
    id: 'nudge-ada-sms',
    circle: CIRCLE,
    at: at('2026-10-02T22:00:00.000Z'),
    type: 'nudge_outcome',
    data: { member: 'Ada', channel: 'sms', hour: 9, tone: 'firm', paidWithinHours: null },
  },
  {
    id: 'nudge-emeka-whatsapp',
    circle: CIRCLE,
    at: at('2026-10-04T14:00:00.000Z'),
    type: 'nudge_outcome',
    data: { member: 'Emeka', channel: 'whatsapp', hour: 8, tone: 'gentle', paidWithinHours: 6 },
  },
  {
    id: 'nudge-tunde-call',
    circle: CIRCLE,
    at: at('2026-10-10T20:00:00.000Z'),
    type: 'nudge_outcome',
    data: { member: 'Tunde', channel: 'call', hour: 20, tone: 'firm', paidWithinHours: 30 },
  },

  // --- who covered whom --------------------------------------------------
  {
    id: 'shortfall-r1-tunde',
    circle: CIRCLE,
    at: at('2026-10-12T18:00:00.000Z'),
    type: 'shortfall_event',
    data: { round: 1, member: 'Tunde', amountBase: CONTRIBUTION_BASE, coveredBy: 'Emeka', repaid: true, daysLate: 4 },
  },
  {
    id: 'shortfall-r2-tunde',
    circle: CIRCLE,
    at: at('2026-10-19T18:00:00.000Z'),
    type: 'shortfall_event',
    data: { round: 2, member: 'Tunde', amountBase: CONTRIBUTION_BASE, coveredBy: 'Emeka', repaid: false, daysLate: 6 },
  },

  // --- the dispute that taught the circle a rule -------------------------
  {
    id: 'contest-r1-ada',
    circle: CIRCLE,
    at: at('2026-10-11T10:00:00.000Z'),
    type: 'contested_claim',
    data: {
      round: 1,
      member: 'Ada',
      claimedDigest: 'DLwUu1vRRJZ8j6mCk4qZ8j6mCk4qZ8j6mCk4qZ8j6mCk4',
      chainSays: 'a real transaction, but from the previous cycle',
      reasons: ['the transfer happened outside this round'],
      resolved: 'chain_right',
    },
  },
  {
    id: 'constitution-v1',
    circle: CIRCLE,
    at: at('2026-10-11T12:00:00.000Z'),
    type: 'circle_constitution',
    data: {
      rule: 'a contribution claim must name a transaction digest before the round closes',
      origin: 'learned_from_dispute',
      version: 1,
    },
  },

  // --- earned standing ---------------------------------------------------
  {
    id: 'reliability-ada',
    circle: CIRCLE,
    at: at('2026-10-20T09:00:00.000Z'),
    type: 'reliability_trajectory',
    data: { member: 'Ada', score: 88, evidenceIds: ['rhythm-ada', 'nudge-ada-whatsapp', 'contest-r1-ada'] },
  },
  {
    id: 'reliability-emeka',
    circle: CIRCLE,
    at: at('2026-10-20T09:00:00.000Z'),
    type: 'reliability_trajectory',
    data: {
      member: 'Emeka',
      score: 96,
      evidenceIds: ['rhythm-emeka', 'nudge-emeka-whatsapp', 'shortfall-r1-tunde', 'shortfall-r2-tunde'],
    },
  },
  {
    id: 'reliability-tunde',
    circle: CIRCLE,
    at: at('2026-10-20T09:00:00.000Z'),
    type: 'reliability_trajectory',
    data: { member: 'Tunde', score: 61, evidenceIds: ['rhythm-tunde', 'nudge-tunde-call', 'shortfall-r2-tunde'] },
  },

  // --- where each member receives money: recalled, never configured ---------
  ...(['Ada', 'Emeka', 'Tunde', 'Ngozi', 'Bola'] as const).map(
    (member): MemoryEntity => ({
      id: `account-${member.toLowerCase()}`,
      circle: CIRCLE,
      at: at('2026-09-28T08:00:00.000Z'),
      type: 'circle_account',
      data: { member, address: addressOf(member) },
    }),
  ),

  // --- a member saying a memory about them is wrong -----------------------
  {
    id: 'dispute-ada-r1',
    circle: CIRCLE,
    at: at('2026-10-13T08:00:00.000Z'),
    type: 'member_dispute',
    data: {
      member: 'Ada',
      targetId: 'contest-r1-ada',
      reason: 'I sent it on the 3rd of the month, not after the deadline, the app looked at the wrong week',
      status: 'open',
    },
  },

  // --- the second circle: the same member, a different group --------------
  {
    id: 'constitution-c2-v1',
    circle: CIRCLE_2,
    at: at('2026-10-21T09:00:00.000Z'),
    type: 'circle_constitution',
    data: {
      rule: 'a member brings their record with them; no one starts from zero',
      origin: 'founded',
      version: 1,
    },
  },
  {
    id: 'rotation-c2-r1',
    circle: CIRCLE_2,
    at: at('2026-10-22T09:00:00.000Z'),
    type: 'rotation_decision',
    data: {
      round: 1,
      order: ['Emeka', 'Ngozi', 'Bola'],
      reasons: [
        'Emeka has never paid late and covered two shortfalls, earned in another circle and carried here',
        'Ngozi is new with no record yet, so she follows the member who has one',
        'Bola is new too, and collecting last is the cheapest place to learn a payment rhythm',
      ],
      memoryIds: ['reliability-emeka', 'rhythm-emeka', 'shortfall-r2-tunde'],
    },
  },

  // --- the decision memory: on screen, and clickable down to its evidence --
  {
    id: 'rotation-r3',
    circle: CIRCLE,
    at: at('2026-10-20T09:30:00.000Z'),
    type: 'rotation_decision',
    data: {
      round: 3,
      order: ['Emeka', 'Ada', 'Tunde'],
      reasons: [
        'Emeka covered two shortfalls and has never been late, so he collects first',
        'Ada slipped once on a claim, and only from last cycle, so she keeps second place',
        'Tunde was late twice and has not repaid the second shortfall, so he collects last',
      ],
      memoryIds: ['shortfall-r1-tunde', 'shortfall-r2-tunde', 'contest-r1-ada', 'reliability-emeka'],
    },
  },
];

/** Queries the UI will ask, used by the spike to prove recall finds them. */
export const RECALL_PROBES = [
  'which nudge works on Ada',
  'who covered a shortfall',
  'why does Emeka collect first',
  'what did the circle learn from the dispute',
];
