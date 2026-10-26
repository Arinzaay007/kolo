import { describe, expect, it } from 'vitest';
import { resolve, UPHELD_DELTA } from '../src/lib/dispute';
import { MemoryEntitySchema } from '../src/lib/schema';

const at = '2026-10-26T10:00:00.000Z';
const dispute = {
  id: 'dispute-tunde-1',
  circle: 'kolo-circle-1',
  member: 'Tunde',
  targetId: 'shortfall-r2-tunde',
  reason: 'I repaid that in cash on the 21st and it was never recorded',
};
const current = { score: 61, evidenceIds: ['rhythm-tunde'], id: 'reliability-tunde' };

describe('ruling on a dispute', () => {
  it('a rejected ruling writes one memory and leaves standing alone', () => {
    const out = resolve({ dispute, current, ruling: 'rejected', note: 'No transfer found in any window that matches the claim.', at });
    expect(out.memories).toHaveLength(1);
    expect(out.memories[0]?.type).toBe('dispute_resolution');
    expect(out.nextScore).toBe(61);
  });

  it('an upheld ruling writes a resolution AND a correction', () => {
    const out = resolve({ dispute, current, ruling: 'upheld', note: 'The cash repayment is confirmed by the collector.', at });
    expect(out.memories.map((m) => m.type)).toEqual(['dispute_resolution', 'reliability_trajectory']);
    expect(out.nextScore).toBe(61 + UPHELD_DELTA);
  });

  it('the correction supersedes the old record instead of editing it', () => {
    const out = resolve({ dispute, current, ruling: 'upheld', note: 'Confirmed by the collector in writing.', at });
    const correction = out.memories.find((m) => m.type === 'reliability_trajectory');
    expect(correction?.supersedes).toBe('reliability-tunde');
  });

  it('the correction cites the resolution as its evidence', () => {
    const out = resolve({ dispute, current, ruling: 'upheld', note: 'Confirmed by the collector in writing.', at });
    const correction = out.memories.find((m) => m.type === 'reliability_trajectory');
    if (correction?.type !== 'reliability_trajectory') throw new Error('expected a correction');
    expect(correction.data.evidenceIds).toContain('resolution-dispute-tunde-1');
  });

  it('never lets a score exceed 100', () => {
    const out = resolve({ dispute, current: { score: 99, evidenceIds: [], id: 'r' }, ruling: 'upheld', note: 'Confirmed by the collector in writing.', at });
    expect(out.nextScore).toBe(100);
  });

  it('makes no claim about a member with no prior standing', () => {
    const out = resolve({ dispute, current: null, ruling: 'upheld', note: 'Confirmed by the collector in writing.', at });
    expect(out.nextScore).toBe(50 + UPHELD_DELTA);
  });

  it('every memory it produces is schema-valid', () => {
    for (const ruling of ['upheld', 'rejected'] as const) {
      const out = resolve({ dispute, current, ruling, note: 'A ruling with enough characters to pass the schema.', at });
      for (const m of out.memories) {
        expect(MemoryEntitySchema.safeParse(m).success).toBe(true);
      }
    }
  });

  it('the summary says what happened in words a member can read', () => {
    const up = resolve({ dispute, current, ruling: 'upheld', note: 'Confirmed by the collector in writing.', at });
    expect(up.summary).toMatch(/upheld/);
    expect(up.summary).toContain('61 → 67');
    const down = resolve({ dispute, current, ruling: 'rejected', note: 'No matching transfer was found anywhere.', at });
    expect(down.summary).toMatch(/not upheld/);
  });

  it('is deterministic: same input, same output', () => {
    const args = { dispute, current, ruling: 'upheld' as const, note: 'Confirmed by the collector in writing.', at };
    expect(JSON.stringify(resolve(args))).toBe(JSON.stringify(resolve(args)));
  });
});
