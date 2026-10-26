import { describe, expect, it } from 'vitest';
import { DELIM, decode, encode, sentence, type MemoryEntity } from '../src/lib/schema';
import { SEED_MEMORIES } from '../src/seed/circle';

describe('memory envelope', () => {
  it('round-trips every seed memory', () => {
    for (const entity of SEED_MEMORIES) {
      const back = decode(encode(entity));
      expect(back).not.toBeNull();
      expect(back).toEqual(entity);
    }
  });

  it('keeps a readable sentence ahead of the JSON, for the embedding', () => {
    const text = encode(SEED_MEMORIES[0] as MemoryEntity);
    const [head] = text.split(DELIM);
    expect(head).toMatch(/Ada usually pays around the 5th of the month/);
  });

  it('rejects text that is not ours', () => {
    expect(decode('a memory from some other app')).toBeNull();
    expect(decode(`looks close${DELIM}{"nope":true}`)).toBeNull();
  });

  it('refuses an entity that breaks its own schema', () => {
    const bad = { ...SEED_MEMORIES[0], data: { member: 'Ada', typicalDayOfMonth: 99, varianceDays: 0, samples: 1 } };
    expect(decode(`${DELIM}${JSON.stringify(bad)}`)).toBeNull();
  });

  it('says the rotation reason out loud, because that is the claim we make', () => {
    const rotation = SEED_MEMORIES.find((e) => e.type === 'rotation_decision');
    expect(rotation).toBeDefined();
    if (!rotation) return;
    const said = sentence(rotation);
    expect(said).toContain('Emeka');
    expect(said).toContain('Because:');
  });
});
