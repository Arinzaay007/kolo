/**
 * The one data interface the UI reads through.
 *
 * fixtureStore — the seed circles, in memory, for building and demos without keys.
 * liveStore    — Walrus Memory on Mainnet + Tatum Sui gRPC.
 *
 * The UI never learns which one it has, except through `source`, which it must show
 * on screen. A demo that looks like Mainnet and isn't would be the one thing worth
 * failing over.
 */
import type { MemoryEntity, MemoryType } from '../lib/schema';
import { sentence } from '../lib/schema';
import { ACCOUNTS, CIRCLE, CIRCLE_2, CIRCLES, MEMBERS, MEMBERS_2, SEED_MEMORIES } from '../seed/circle';
import { coinType, contributionBase, roundWindow } from '../lib/config';
import { KoloMemory } from '../lib/memory';
import { createTatumSui, observeTransfer } from '../lib/tatum';
import { reconcile, stamp, type ContributionClaim, type Expectation, type ReconcileOutcome } from '../lib/reconcile';

export type Source = 'mainnet' | 'fixture';

export interface MemoryRow {
  id: string;
  type: MemoryType;
  sentence: string;
  blobId: string;
  at: string;
  member?: string;
  circle: string;
}

export interface MemberView {
  name: string;
  reliability: number;
  rhythmNote: string;
  bestNudge: string;
  paidThisRound: boolean;
  evidenceIds: string[];
  /** Where this member's standing was earned. Empty for a member new here but known elsewhere. */
  earnedIn: string[];
}

export interface RotationView {
  circle: string;
  round: number;
  order: string[];
  reasons: string[];
  memoryIds: string[];
}

export interface CircleView {
  id: string;
  name: string;
  members: readonly string[];
  round: number;
}

export interface RecordView {
  member: string;
  /** Latest reliability across all circles. null when the member has no history anywhere. */
  reliability: number | null;
  byCircle: Array<{ circle: string; events: MemoryRow[]; carriesHistory: boolean }>;
  disputes: MemoryRow[];
  address: string | null;
}

export interface ClaimResult extends ReconcileOutcome {
  digest: string;
  member: string;
  blobIds: string[];
  /** The address the claim was checked against — recalled from memory, shown so it can be traced. */
  recipient: string;
  recipientSource: MemoryRow | null;
}

export interface KoloStore {
  source: Source;
  circles(): Promise<CircleView[]>;
  members(circle?: string): Promise<MemberView[]>;
  rotation(circle?: string): Promise<RotationView | null>;
  memories(type?: MemoryType): Promise<MemoryRow[]>;
  byIds(ids: string[]): Promise<MemoryRow[]>;
  record(member: string): Promise<RecordView>;
  contest(input: { member: string; targetId: string; reason: string }): Promise<{ blobId: string; id: string }>;
  accountOf(member: string): Promise<{ address: string | null; source: MemoryRow | null }>;
  verifyClaim(input: { member: string; digest: string; amountBase?: string; circle?: string }): Promise<ClaimResult>;
}

const memberOf = (e: MemoryEntity): string | undefined =>
  'member' in e.data ? (e.data as { member: string }).member : undefined;

const toRow = (e: MemoryEntity, blobId: string): MemoryRow => ({
  id: e.id,
  type: e.type,
  sentence: sentence(e),
  blobId,
  at: e.at,
  circle: e.circle,
  ...(memberOf(e) ? { member: memberOf(e) } : {}),
});

/** Deterministic pseudo blob id for the fixture store — prefixed so it can never pass as real. */
function fakeBlob(id: string): string {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return `fixture_${h.toString(36).padEnd(8, '0')}${'0'.repeat(10)}`.slice(0, 44);
}

export function fixtureStore(): KoloStore {
  // Module-level and mutable: in demo mode a contest must show up on the next render.
  const entities: MemoryEntity[] = SEED_MEMORIES.map((e) => ({ ...e }));
  const blobs = new Map(entities.map((e) => [e.id, fakeBlob(e.id)]));
  const rows = () => entities.map((e) => toRow(e, blobs.get(e.id) ?? fakeBlob(e.id)));

  const score = (member: string): { value: number | null; earnedIn: string[]; evidenceIds: string[] } => {
    const traj = entities.filter(
      (e) => e.type === 'reliability_trajectory' && e.data.member === member,
    ) as Array<Extract<MemoryEntity, { type: 'reliability_trajectory' }>>;
    if (traj.length === 0) return { value: null, earnedIn: [], evidenceIds: [] };
    const latest = traj.sort((a, b) => (a.at < b.at ? -1 : 1)).at(-1)!;
    return {
      value: latest.data.score,
      earnedIn: traj.map((t) => t.circle),
      evidenceIds: latest.data.evidenceIds,
    };
  };

  const rotationFor = (circle: string): RotationView | null => {
    const r = entities
      .filter((e) => e.type === 'rotation_decision' && e.circle === circle)
      .sort((a, b) => (a.at < b.at ? -1 : 1))
      .at(-1);
    return r?.type === 'rotation_decision'
      ? {
          circle,
          round: r.data.round,
          order: r.data.order,
          reasons: r.data.reasons,
          memoryIds: r.data.memoryIds,
        }
      : null;
  };

  const accountFor = (member: string): { address: string | null; source: MemoryRow | null } => {
    const e = entities.find((x) => x.type === 'circle_account' && x.data.member === member);
    if (e?.type !== 'circle_account') return { address: null, source: null };
    return { address: e.data.address, source: toRow(e, blobs.get(e.id) ?? fakeBlob(e.id)) };
  };

  return {
    source: 'fixture',
    circles: async () => CIRCLES.map((c) => ({ ...c })),
    members: async (circle = CIRCLE) => {
      const list = circle === CIRCLE_2 ? MEMBERS_2 : MEMBERS;
      return list.map((name) => {
        const { value, earnedIn, evidenceIds } = score(name);
        const rhythm = entities.find((e) => e.type === 'member_rhythm' && e.data.member === name);
        const nudges = entities
          .filter(
            (e): e is Extract<MemoryEntity, { type: 'nudge_outcome' }> =>
              e.type === 'nudge_outcome' && e.data.member === name && e.data.paidWithinHours !== null,
          )
          .sort((a, b) => (a.data.paidWithinHours ?? 1e9) - (b.data.paidWithinHours ?? 1e9));
        const best = nudges[0];
        return {
          name,
          reliability: value ?? 0,
          rhythmNote:
            rhythm?.type === 'member_rhythm'
              ? `pays around the ${rhythm.data.typicalDayOfMonth}th (± ${rhythm.data.varianceDays}d, ${rhythm.data.samples} payments seen)`
              : 'no rhythm learned yet',
          bestNudge: best
            ? `${best.data.channel} at ${String(best.data.hour).padStart(2, '0')}:00 — worked ${best.data.paidWithinHours}h later`
            : 'nothing works yet',
          paidThisRound: name === rotationFor(circle)?.order[0] && rotationFor(circle)?.round === 3,
          evidenceIds,
          earnedIn,
        };
      });
    },
    rotation: async (circle = CIRCLE) => rotationFor(circle),
    memories: async (type) => (type ? rows().filter((r) => r.type === type) : rows()),
    byIds: async (ids) => rows().filter((r) => ids.includes(r.id)),
    record: async (member) => {
      const mine = rows().filter((r) => r.member === member);
      const { value } = score(member);
      // A member only appears in circles they belong to. Showing "no history here" for a
      // circle they are not in would invent a fact rather than report one.
      const belongs = (circle: string) =>
        (circle === CIRCLE_2 ? MEMBERS_2 : MEMBERS).includes(member as never);
      return {
        member,
        reliability: value,
        byCircle: [CIRCLE, CIRCLE_2]
          .filter((c) => belongs(c) || mine.some((r) => r.circle === c))
          .map((circle) => ({
            circle,
            events: mine.filter((r) => r.circle === circle && r.type !== 'reliability_trajectory'),
            carriesHistory: !mine.some((r) => r.circle === circle) && value !== null,
          })),
        disputes: mine.filter((r) => r.type === 'member_dispute'),
        address: accountFor(member).address,
      };
    },
    contest: async ({ member, targetId, reason }) => {
      const id = `dispute-${member.toLowerCase()}-${Date.now()}`;
      const entity: MemoryEntity = {
        id,
        circle: entities.find((e) => e.id === targetId)?.circle ?? CIRCLE,
        at: new Date().toISOString(),
        type: 'member_dispute',
        data: { member, targetId, reason, status: 'open' },
      };
      entities.push(entity);
      blobs.set(id, fakeBlob(id));
      return { blobId: blobs.get(id)!, id };
    },
    accountOf: async (member) => accountFor(member),
    verifyClaim: async ({ member, digest, amountBase = contributionBase(), circle = CIRCLE }) => {
      const window = roundWindow();
      const rotation = rotationFor(circle);
      const collector = rotation?.order[0] ?? '';
      const { address, source } = accountFor(collector);
      const claim: ContributionClaim = {
        id: `claim-${member}-${Date.now()}`,
        circle,
        member,
        round: rotation?.round ?? 1,
        amountBase,
        digest,
        claimedAt: new Date().toISOString(),
      };
      const expected: Expectation = {
        recipient: address ?? '',
        amountBase,
        windowStartMs: window.startMs,
        windowEndMs: window.endMs,
      };
      // Fixture: a digest containing "old" resolves to a real transfer from a past round —
      // the contested case the demo turns on. No chain is contacted in this mode.
      const stale = /old|prev/i.test(digest);
      const observed = {
        found: !/^missing/i.test(digest),
        digest,
        sender: accountFor(member).address,
        recipients: [{ address: address ?? '', amountBase, coinType: coinType() }],
        coinTypes: [coinType()],
        timestampMs: stale ? window.startMs - 30 * 24 * 3600_000 : window.startMs + 3600_000,
        status: 'success',
        error: null,
      };
      const out = reconcile(claim, expected, observed);
      const blobIds: string[] = [];
      for (const e of stamp(out.memories)) {
        entities.push(e);
        blobIds.push(blobs.get(e.id) ?? fakeBlob(e.id));
        blobs.set(e.id, blobs.get(e.id) ?? fakeBlob(e.id));
      }
      return { ...out, digest, member, blobIds, recipient: address ?? '', recipientSource: source };
    },
  };
}

/** Live: every read is a real Walrus Memory recall, every write a real Mainnet write. */
export function liveStore(opts: { memwal: KoloMemory; tatum: ReturnType<typeof createTatumSui> }): KoloStore {
  const { memwal, tatum } = opts;

  /** Recall a wide pool, dedupe, and keep the entity so the app reads exact fields, not prose. */
  const pool = async (query = 'everything this circle remembers', limit = 80) => {
    const hits = await memwal.recall(query, limit);
    const byId = new Map<string, { entity: MemoryEntity; row: MemoryRow }>();
    for (const h of hits) if (!byId.has(h.entity.id)) byId.set(h.entity.id, { entity: h.entity, row: toRow(h.entity, h.blobId) });
    return [...byId.values()];
  };

  const rotationFor = async (circle: string): Promise<RotationView | null> => {
    const all = await pool('why does the rotation pay out in this order');
    const hit = all
      .filter((p) => p.entity.type === 'rotation_decision' && p.entity.circle === circle)
      .sort((a, b) => (a.entity.at < b.entity.at ? -1 : 1))
      .at(-1);
    if (hit?.entity.type !== 'rotation_decision') return null;
    return {
      circle,
      round: hit.entity.data.round,
      order: hit.entity.data.order,
      reasons: hit.entity.data.reasons,
      memoryIds: hit.entity.data.memoryIds,
    };
  };

  const accountFor = async (member: string) => {
    const all = await pool(`where does ${member} receive contributions`);
    const hit = all.find((p) => p.entity.type === 'circle_account' && p.entity.data.member === member);
    if (hit?.entity.type !== 'circle_account') return { address: null, source: null };
    return { address: hit.entity.data.address, source: hit.row };
  };

  return {
    source: 'mainnet',
    circles: async () => CIRCLES.map((c) => ({ ...c })),
    members: async (circle = CIRCLE) => {
      const list = circle === CIRCLE_2 ? MEMBERS_2 : MEMBERS;
      const all = await pool('what does the circle know about its members');
      return list.map((name) => {
        const traj = all
          .filter((p) => p.entity.type === 'reliability_trajectory' && p.entity.data.member === name)
          .sort((a, b) => (a.entity.at < b.entity.at ? -1 : 1));
        const latest = traj.at(-1);
        const rhythm = all.find((p) => p.entity.type === 'member_rhythm' && p.entity.data.member === name);
        const nudge = all
          .filter((p) => p.entity.type === 'nudge_outcome' && p.entity.data.member === name)
          .sort((a, b) => (a.entity.at < b.entity.at ? 1 : -1))
          .at(0);
        const score = latest?.entity.type === 'reliability_trajectory' ? latest.entity.data.score : 0;
        const evidence = latest?.entity.type === 'reliability_trajectory' ? latest.entity.data.evidenceIds : [];
        return {
          name,
          reliability: score,
          rhythmNote: rhythm ? rhythm.row.sentence : 'no rhythm learned yet',
          bestNudge: nudge ? nudge.row.sentence : 'nothing works yet',
          paidThisRound: false,
          evidenceIds: evidence,
          earnedIn: traj.map((t) => t.entity.circle),
        };
      });
    },
    rotation: async (circle = CIRCLE) => rotationFor(circle),
    memories: async (type) => {
      const all = await pool();
      return all.map((p) => p.row).filter((r) => (type ? r.type === type : true));
    },
    byIds: async (ids) => {
      const all = await pool();
      const byId = new Map(all.map((p) => [p.row.id, p.row]));
      return ids.map((id) => byId.get(id)).filter((r): r is MemoryRow => Boolean(r));
    },
    record: async (member) => {
      const all = await pool(`what is remembered about ${member}`);
      const mine = all.map((p) => p.row).filter((r) => r.member === member);
      const traj = all
        .filter((p) => p.entity.type === 'reliability_trajectory' && p.entity.data.member === member)
        .sort((a, b) => (a.entity.at < b.entity.at ? -1 : 1));
      const latest = traj.at(-1);
      const value = latest?.entity.type === 'reliability_trajectory' ? latest.entity.data.score : null;
      const seen = new Set(mine.map((r) => r.circle));
      const account = await accountFor(member);
      const belongs = (circle: string) =>
        (circle === CIRCLE_2 ? MEMBERS_2 : MEMBERS).includes(member as never);
      return {
        member,
        reliability: value,
        byCircle: [CIRCLE, CIRCLE_2]
          .filter((c) => belongs(c) || seen.has(c))
          .map((circle) => ({
          circle,
          events: mine.filter((r) => r.circle === circle && r.type !== 'reliability_trajectory'),
          carriesHistory: !seen.has(circle) && value !== null,
        })),
        disputes: mine.filter((r) => r.type === 'member_dispute'),
        address: account.address,
      };
    },
    contest: async ({ member, targetId, reason }) => {
      const all = await pool();
      const target = all.find((p) => p.row.id === targetId);
      const entity: MemoryEntity = {
        id: `dispute-${member.toLowerCase()}-${Date.now()}`,
        circle: target?.row.circle ?? CIRCLE,
        at: new Date().toISOString(),
        type: 'member_dispute',
        data: { member, targetId, reason, status: 'open' },
      };
      const w = await memwal.remember(entity);
      return { blobId: w.blobId, id: entity.id };
    },
    accountOf: async (member) => accountFor(member),
    verifyClaim: async ({ member, digest, amountBase = contributionBase(), circle = CIRCLE }) => {
      const window = roundWindow();
      const rotation = await rotationFor(circle);
      const collector = rotation?.order[0] ?? '';
      const { address, source } = await accountFor(collector);
      const claim: ContributionClaim = {
        id: `claim-${member}-${Date.now()}`,
        circle,
        member,
        round: rotation?.round ?? 1,
        amountBase,
        digest,
        claimedAt: new Date().toISOString(),
      };
      const expected: Expectation = {
        recipient: address ?? '',
        amountBase,
        windowStartMs: window.startMs,
        windowEndMs: window.endMs,
      };
      // Only the contribution coin counts: a transfer of something else must not pass.
      const observed = await observeTransfer(tatum, digest, coinType());
      const out = reconcile(claim, expected, observed);
      const blobIds: string[] = [];
      for (const entity of stamp(out.memories)) blobIds.push((await memwal.remember(entity)).blobId);
      return { ...out, digest, member, blobIds, recipient: address ?? '', recipientSource: source };
    },
  };
}

/** Which store this process has. Chosen once, honestly labelled in the UI. */
export async function getStore(): Promise<KoloStore> {
  if (!(process.env.MEMWAL_KEY && process.env.MEMWAL_ACCOUNT_ID)) return fixtureStore();
  const memwal = await KoloMemory.fromEnv();
  return liveStore({ memwal, tatum: createTatumSui() });
}

export { ACCOUNTS };
