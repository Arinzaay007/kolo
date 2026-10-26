import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildChallenge,
  forgetFacilitatorCapabilities,
  canSettle,
  decodeHeader,
  encodeHeader,
  formatUsdc,
  sameAsset,
  supportedKinds,
  usdcAsset,
  NETWORK_SUI_MAINNET,
  NETWORK_SUI_TESTNET,
} from '../src/lib/x402';
import { COIN_TYPE_USDC } from '../src/lib/config';

const PAY_TO = `0x${'ab'.repeat(32)}`;

describe('the 402 challenge', () => {
  it('asks for exact USDC on Sui mainnet by default', () => {
    const c = buildChallenge({ payTo: PAY_TO, resource: 'https://kolo.app/api/collector', description: 'round fee' });
    expect(c.x402Version).toBe(2);
    const req = c.accepts[0]!;
    expect(req.scheme).toBe('exact');
    expect(req.network).toBe(NETWORK_SUI_MAINNET);
    expect(req.asset).toBe(COIN_TYPE_USDC);
    expect(req.maxAmountRequired).toBe('10000'); // $0.01
    expect(req.payTo).toBe(PAY_TO);
  });

  it('binds the fee to the digest of the round it reconciled', () => {
    const c = buildChallenge({
      payTo: PAY_TO,
      resource: 'r',
      description: 'd',
      reconcileDigest: 'DIGEST123',
    });
    expect(c.accepts[0]?.extra?.reconcileDigest).toBe('DIGEST123');
  });

  it('refuses to build a challenge with a payee that is not a Sui address', () => {
    expect(() => buildChallenge({ payTo: '0xnotreal', resource: 'r', description: 'd' })).toThrow(/not a Sui address/);
  });

  it('uses testnet USDC on testnet, never the mainnet token', () => {
    const test = usdcAsset(NETWORK_SUI_TESTNET);
    expect(test).not.toBe(COIN_TYPE_USDC);
    expect(test).toContain('::usdc::USDC');
  });
});

describe('headers and amounts', () => {
  it('round-trips a challenge through a base64 header', () => {
    const c = buildChallenge({ payTo: PAY_TO, resource: 'r', description: 'd' });
    expect(decodeHeader(encodeHeader(c))).toEqual(c);
  });

  it('returns null for a header that is not ours, rather than throwing', () => {
    expect(decodeHeader('not-base64!!')).toBeNull();
    expect(decodeHeader(null)).toBeNull();
  });

  it('formats atomic USDC with six decimals', () => {
    expect(formatUsdc('10000')).toBe('$0.01');
    expect(formatUsdc('1000000')).toBe('$1.00');
    expect(formatUsdc('500000')).toBe('$0.50');
  });

  it('compares assets case-insensitively', () => {
    expect(sameAsset(COIN_TYPE_USDC.toUpperCase(), COIN_TYPE_USDC)).toBe(true);
  });
});

describe('does the facilitator actually support us', () => {
  // Each case injects its own fetch, so nothing may be served from cache.
  beforeEach(() => forgetFacilitatorCapabilities());

  const fakeFetch = (kinds: unknown[]) =>
    vi.fn(async () => new Response(JSON.stringify({ kinds }), { status: 200 })) as unknown as typeof fetch;

  it('accepts when exact/sui:mainnet is advertised with our USDC', async () => {
    const f = fakeFetch([
      { x402Version: 2, scheme: 'exact', network: 'sui:mainnet', extra: { usdc: COIN_TYPE_USDC, decimals: 6 } },
    ]);
    const req = buildChallenge({ payTo: PAY_TO, resource: 'r', description: 'd' }).accepts[0]!;
    const out = await canSettle(req, 'https://fake', f);
    expect(out.ok).toBe(true);
  });

  it('refuses when the network is not offered', async () => {
    const f = fakeFetch([{ x402Version: 2, scheme: 'exact', network: 'eip155:8453' }]);
    const req = buildChallenge({ payTo: PAY_TO, resource: 'r', description: 'd' }).accepts[0]!;
    const out = await canSettle(req, 'https://fake', f);
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/does not advertise/);
  });

  it('allows a non-USDC asset but says so, because the facilitator is asset-agnostic', async () => {
    const f = fakeFetch([
      { x402Version: 2, scheme: 'exact', network: 'sui:mainnet', extra: { usdc: `0x${'ff'.repeat(32)}::usdc::USDC` } },
    ]);
    const req = buildChallenge({ payTo: PAY_TO, resource: 'r', description: 'd', asset: '0x2::sui::SUI' }).accepts[0]!;
    const out = await canSettle(req, 'https://fake', f);
    expect(out.ok).toBe(true);
    expect(out.reason).toMatch(/asset-agnostic/);
  });

  it('reports a dead facilitator as a reason, never as success', async () => {
    const f = vi.fn(async () => new Response('nope', { status: 503 })) as unknown as typeof fetch;
    const req = buildChallenge({ payTo: PAY_TO, resource: 'r', description: 'd' }).accepts[0]!;
    const out = await canSettle(req, 'https://fake', f);
    expect(out.ok).toBe(false);
    expect(out.reason).toContain('503');
  });
});
