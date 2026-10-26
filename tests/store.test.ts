import { describe, expect, it } from 'vitest';
import { fixtureStore } from '../src/data/store';
import { MEMBERS, SEED_MEMORIES } from '../src/seed/circle';

const store = fixtureStore();

describe('fixture store', () => {
  it('exposes every member with a learned note, not a placeholder', async () => {
    const members = await store.members();
    expect(members).toHaveLength(MEMBERS.length);
    for (const m of members) {
      expect(m.rhythmNote).toMatch(/pays around the \d+/);
      expect(m.bestNudge).toMatch(/worked \d+h later/);
      expect(m.reliability).toBeGreaterThan(0);
      expect(m.reliability).toBeLessThanOrEqual(100);
    }
  });

  it('ranks Emeka highest and Tunde lowest, from the stored scores', async () => {
    const members = await store.members();
    const by = Object.fromEntries(members.map((m) => [m.name, m.reliability]));
    expect(by.Emeka).toBeGreaterThan(by.Ada ?? 0);
    expect(by.Ada).toBeGreaterThan(by.Tunde ?? 0);
  });

  it('serves the stored rotation, reasons and evidence together', async () => {
    const rotation = await store.rotation();
    expect(rotation).not.toBeNull();
    expect(rotation?.order).toEqual(['Emeka', 'Ada', 'Tunde']);
    expect(rotation?.reasons).toHaveLength(3);
    expect(rotation?.memoryIds.length).toBeGreaterThan(0);
  });

  it('resolves every memory id a rotation cites — no dangling evidence', async () => {
    const rotation = await store.rotation();
    const rows = await store.byIds(rotation?.memoryIds ?? []);
    expect(rows).toHaveLength(rotation?.memoryIds.length ?? 0);
  });

  it('filters by type', async () => {
    const nudges = await store.memories('nudge_outcome');
    expect(nudges).toHaveLength(SEED_MEMORIES.filter((e) => e.type === 'nudge_outcome').length);
    expect(nudges.every((n) => n.type === 'nudge_outcome')).toBe(true);
  });

  it('labels fake blob ids so they can never be mistaken for Mainnet', async () => {
    const rows = await store.memories();
    expect(rows.every((r) => r.blobId.startsWith('fixture_'))).toBe(true);
  });
});

describe('claim check (fixture path)', () => {
  it('verifies a transfer inside the round', async () => {
    const out = await store.verifyClaim({ member: 'Ada', digest: 'DIGESTREAL123' });
    expect(out.verdict).toBe('verified');
    expect(out.reasons).toEqual([]);
    expect(out.blobIds).toHaveLength(1);
  });

  it('contests a real transfer that came from an earlier cycle', async () => {
    const out = await store.verifyClaim({ member: 'Ada', digest: 'OLDDIGEST999' });
    expect(out.verdict).toBe('contested');
    expect(out.reasons.join(' ')).toMatch(/outside this round/);
  });

  it('contests a digest that is not on chain', async () => {
    const out = await store.verifyClaim({ member: 'Tunde', digest: 'missing-digest' });
    expect(out.verdict).toBe('contested');
    expect(out.reasons.join(' ')).toMatch(/no transaction with this digest/);
  });

  it('never calls the fixture Mainnet', () => {
    expect(store.source).toBe('fixture');
  });
});

describe('portability (the claim the submission rests on)', () => {
  it("shows Emeka in a circle where he has no events, with his standing carried", async () => {
    const record = await store.record('Emeka');
    const second = record.byCircle.find((c) => c.circle === 'kolo-circle-2');
    expect(second).toBeDefined();
    expect(second?.events).toHaveLength(0);
    expect(second?.carriesHistory).toBe(true);
    expect(record.reliability).toBeGreaterThan(90);
  });

  it("the second circle's rotation cites memories written in the first", async () => {
    const rotation = await store.rotation('kolo-circle-2');
    expect(rotation?.order[0]).toBe('Emeka');
    expect(rotation?.memoryIds).toContain('reliability-emeka');
    const cited = await store.byIds(rotation?.memoryIds ?? []);
    expect(cited.length).toBe(rotation?.memoryIds.length);
    for (const row of cited) expect(row.circle).toBe('kolo-circle-1');
  });

  it('shows only the circles a member actually belongs to', async () => {
    const ada = await store.record('Ada');
    expect(ada.byCircle.map((c) => c.circle)).toEqual(['kolo-circle-1']);
    const emeka = await store.record('Emeka');
    expect(emeka.byCircle.map((c) => c.circle)).toEqual(['kolo-circle-1', 'kolo-circle-2']);
  });

  it('a new member with no history carries nothing and is not given a score', async () => {
    const record = await store.record('Ngozi');
    expect(record.reliability).toBeNull();
    expect(record.byCircle.every((c) => !c.carriesHistory)).toBe(true);
  });

  it('lists both circles', async () => {
    const circles = await store.circles();
    expect(circles.map((c) => c.id)).toEqual(['kolo-circle-1', 'kolo-circle-2']);
  });
});

describe('accounts are recalled, not configured', () => {
  it('finds the collector of round 3 and their address from memory', async () => {
    const rotation = await store.rotation('kolo-circle-1');
    const collector = rotation?.order[0];
    expect(collector).toBe('Emeka');
    const { address, source } = await store.accountOf(collector ?? '');
    expect(address).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(source?.type).toBe('circle_account');
  });

  it('checks a claim against the address the rotation points at', async () => {
    const out = await store.verifyClaim({ member: 'Ada', digest: 'DIGESTREAL123' });
    const emeka = await store.accountOf('Emeka');
    expect(out.recipient).toBe(emeka.address);
    expect(out.recipientSource).not.toBeNull();
    expect(out.verdict).toBe('verified');
  });
});

describe('a member can dispute their own record', () => {
  it('writes a dispute that points at the memory, without editing it', async () => {
    const before = await store.byIds(['shortfall-r2-tunde']);
    expect(before).toHaveLength(1);
    const original = before[0]?.sentence;

    const { blobId, id } = await store.contest({
      member: 'Tunde',
      targetId: 'shortfall-r2-tunde',
      reason: 'I repaid that in cash on the 21st and it was never recorded',
    });
    expect(blobId).toMatch(/^fixture_/);
    expect(id).toContain('dispute-tunde');

    const record = await store.record('Tunde');
    expect(record.disputes.some((d) => d.id === id)).toBe(true);

    // The memory it refers to is still readable, unchanged.
    const after = await store.byIds(['shortfall-r2-tunde']);
    expect(after[0]?.sentence).toBe(original);
  });

  it('a dispute about one member stays off another member record', async () => {
    await store.contest({ member: 'Bola', targetId: 'rhythm-emeka', reason: 'wrong person entirely here' });
    const emeka = await store.record('Emeka');
    expect(emeka.disputes.some((d) => d.sentence.includes('Bola'))).toBe(false);
  });
});
