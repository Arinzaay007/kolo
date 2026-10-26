import { afterEach, describe, expect, it } from 'vitest';
import {
  COIN_TYPE_SUI,
  COIN_TYPE_USDC,
  coinType,
  contributionBase,
  formatAmount,
  hasRealAddresses,
  roundWindow,
} from '../src/lib/config';
import { sameCoin } from '../src/lib/tatum';
import { addressOf } from '../src/seed/circle';

const saved = { ...process.env };
afterEach(() => {
  for (const k of Object.keys(process.env)) if (k.startsWith('KOLO_')) delete process.env[k];
  Object.assign(process.env, saved);
});

describe('pointing Kolo at real funds', () => {
  it('defaults to SUI so a real test needs no USDC', () => {
    delete process.env.KOLO_COIN_TYPE;
    expect(coinType()).toBe(COIN_TYPE_SUI);
  });

  it('reads the contribution from env, and formats it using the coin decimals', () => {
    process.env.KOLO_CONTRIBUTION_BASE = '10000000'; // 0.01 SUI (9 decimals)
    expect(contributionBase()).toBe('10000000');
    expect(formatAmount('10000000')).toMatch(/0\.01 SUI/);

    process.env.KOLO_COIN_TYPE = COIN_TYPE_USDC;
    expect(formatAmount('20000000')).toMatch(/20 USDC/);
  });

  it('defaults the round window to the recent past, so a transfer made today verifies', () => {
    const now = Date.parse('2026-10-26T12:00:00Z');
    const w = roundWindow(now);
    expect(w.startMs).toBeLessThan(now);
    expect(w.endMs).toBeGreaterThanOrEqual(now);
    const sevenDays = 7 * 24 * 3600_000;
    expect(now - w.startMs).toBe(sevenDays);
  });

  it('accepts an explicit window', () => {
    process.env.KOLO_ROUND_START = '2026-10-01T00:00:00Z';
    process.env.KOLO_ROUND_END = '2026-10-08T00:00:00Z';
    const w = roundWindow();
    expect(new Date(w.startMs).toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(w.source).toContain('KOLO_ROUND_START');
  });

  it('takes real addresses from env and rejects a malformed one', () => {
    expect(hasRealAddresses()).toBe(false);
    process.env.KOLO_ADDR_EMEKA = `0x${'e7'.repeat(32)}`;
    expect(hasRealAddresses()).toBe(true);
    expect(addressOf('Emeka')).toBe(`0x${'e7'.repeat(32)}`);

    process.env.KOLO_ADDR_TUNDE = 'not-an-address';
    expect(() => addressOf('Tunde')).toThrow(/not a Sui address/);
  });

  it('falls back to the placeholder when no real address is set', () => {
    expect(addressOf('Ada')).toBe(`0x${'a1'.repeat(32)}`);
  });
});

describe('a transfer of the wrong coin must not count', () => {
  it('matches abbreviated and fully-qualified coin types', () => {
    expect(sameCoin('0x2::sui::SUI', '0x2::sui::SUI')).toBe(true);
    expect(
      sameCoin(`0x${'0'.repeat(63)}2::sui::SUI`, '0x2::sui::SUI'),
    ).toBe(true);
  });

  it('does not confuse SUI with USDC', () => {
    expect(sameCoin(COIN_TYPE_SUI, COIN_TYPE_USDC)).toBe(false);
  });
});
