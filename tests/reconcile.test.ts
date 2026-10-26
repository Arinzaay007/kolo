import { describe, expect, it } from 'vitest';
import { reconcile, sameAddress, stamp, type ContributionClaim, type Expectation } from '../src/lib/reconcile';
import type { TransferObservation } from '../src/lib/tatum';

const COLLECTOR = '0x7d4e1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7';
const AMOUNT = '20000000'; // 20 USDC in base units
const WINDOW = { windowStartMs: Date.parse('2026-11-01T00:00:00Z'), windowEndMs: Date.parse('2026-11-08T00:00:00Z') };

const claim = (over: Partial<ContributionClaim> = {}): ContributionClaim => ({
  id: 'claim-1',
  circle: 'kolo-circle-1',
  member: 'Ada',
  round: 3,
  amountBase: AMOUNT,
  digest: 'DIGEST123',
  claimedAt: '2026-11-02T10:00:00.000Z',
  ...over,
});

const expected = (over: Partial<Expectation> = {}): Expectation => ({
  recipient: COLLECTOR,
  amountBase: AMOUNT,
  ...WINDOW,
  ...over,
});

const observed = (over: Partial<TransferObservation> = {}): TransferObservation => ({
  found: true,
  digest: 'DIGEST123',
  sender: '0xada',
  recipients: [{ address: COLLECTOR, amountBase: AMOUNT, coinType: '0x2::sui::SUI' }],
  coinTypes: ['0x2::sui::SUI'],
  timestampMs: Date.parse('2026-11-02T09:00:00Z'),
  status: 'success',
  error: null,
  ...over,
});

describe('reconcile', () => {
  it('verifies a real transfer to the collector, and writes the memory that proves it', () => {
    const out = reconcile(claim(), expected(), observed());
    expect(out.verdict).toBe('verified');
    expect(out.reasons).toEqual([]);
    expect(out.memories).toHaveLength(1);
    expect(out.memories[0]?.type).toBe('contribution_verified');
  });

  it('contests a claim with no digest, rather than guessing', () => {
    const out = reconcile(claim({ digest: null }), expected(), observed({ found: false }));
    expect(out.verdict).toBe('contested');
    expect(out.reasons[0]).toMatch(/no transaction digest/);
  });

  it('contests a digest that is not on chain', () => {
    const out = reconcile(claim(), expected(), observed({ found: false }));
    expect(out.verdict).toBe('contested');
    expect(out.reasons.join(' ')).toMatch(/no transaction with this digest/);
  });

  it("tells a read failure apart from an absent transaction", () => {
    const out = reconcile(claim(), expected(), observed({ found: false, error: 'UNAUTHENTICATED: bad key' }));
    expect(out.reasons.join(' ')).toMatch(/could not be read/);
  });

  it('contests a transfer that reached somebody else', () => {
    const out = reconcile(claim(), expected(), observed({ recipients: [{ address: '0xsomeone', amountBase: AMOUNT, coinType: '0x2::sui::SUI' }] }));
    expect(out.verdict).toBe('contested');
    expect(out.reasons.join(' ')).toMatch(/did not reach this round's collector/);
  });

  it('contests the wrong amount, and says both numbers', () => {
    const out = reconcile(claim(), expected(), observed({ recipients: [{ address: COLLECTOR, amountBase: '5000000', coinType: '0x2::sui::SUI' }] }));
    expect(out.verdict).toBe('contested');
    expect(out.reasons.join(' ')).toContain('5000000');
    expect(out.reasons.join(' ')).toContain(AMOUNT);
  });

  it('contests a real transfer that happened outside the round', () => {
    const out = reconcile(claim(), expected(), observed({ timestampMs: Date.parse('2026-10-02T09:00:00Z') }));
    expect(out.verdict).toBe('contested');
    expect(out.reasons.join(' ')).toMatch(/outside this round/);
  });

  it('contests a transaction that failed on chain', () => {
    const out = reconcile(claim(), expected(), observed({ status: 'failure' }));
    expect(out.verdict).toBe('contested');
    expect(out.reasons.join(' ')).toMatch(/failure/);
  });

  it('contests a transaction not yet in a checkpoint', () => {
    const out = reconcile(claim(), expected(), observed({ timestampMs: null }));
    expect(out.verdict).toBe('contested');
    expect(out.reasons.join(' ')).toMatch(/checkpoint/);
  });

  it('writes a contested claim that keeps both sides, never an accusation', () => {
    const out = reconcile(claim(), expected(), observed({ timestampMs: Date.parse('2026-10-02T09:00:00Z') }));
    const memory = out.memories[0];
    expect(memory?.type).toBe('contested_claim');
    if (memory?.type !== 'contested_claim') return;
    expect(memory.data.member).toBe('Ada');
    expect(memory.data.claimedDigest).toBe('DIGEST123');
    expect(memory.data.resolved).toBe('open');
    expect(memory.data.reasons.length).toBeGreaterThan(0);
  });

  it('matches a zero-padded address to an unpadded one', () => {
    expect(sameAddress(`0x0000${COLLECTOR.slice(2)}`, COLLECTOR)).toBe(true);
    expect(sameAddress(COLLECTOR, '0xdeadbeef')).toBe(false);
  });

  it('stamps drafts so nothing reaches the engine without a time', () => {
    const [entity] = stamp(reconcile(claim(), expected(), observed()).memories, '2026-11-02T12:00:00.000Z');
    expect(entity?.at).toBe('2026-11-02T12:00:00.000Z');
  });
});
