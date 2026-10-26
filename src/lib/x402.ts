/**
 * x402: the collector agent earns a fee per round it actually reconciles.
 *
 * This is the honest shape of an agent payment in this product. Not "the agent pays for a
 * data refresh", which is contrived here — but the circle's collector doing verifiable work
 * (reconciling contributions against Sui Mainnet) and being paid per round it reconciles.
 * The fee is only chargeable because the round reconciled: proof-gated payment, again.
 *
 * Transport, per the x402 v2 facilitator API:
 *   402 + PAYMENT-REQUIRED   → the client builds and signs its own transaction
 *   retry + PAYMENT-SIGNATURE → we call the facilitator /verify then /settle
 *   200 + PAYMENT-RESPONSE    → the receipt, carrying the Sui digest
 *
 * The facilitator never holds funds and cannot redirect a payment: it relays the payer's
 * own signed bytes. We never see a key.
 */
import { COIN_TYPE_USDC } from './config';

export const X402_VERSION = 2 as const;
export const NETWORK_SUI_MAINNET = 'sui:mainnet' as const;
export const NETWORK_SUI_TESTNET = 'sui:testnet' as const;

export const FACILITATOR_URL = 'https://sui-facilitator.onrender.com';

export interface PaymentRequirements {
  scheme: 'exact';
  network: typeof NETWORK_SUI_MAINNET | typeof NETWORK_SUI_TESTNET;
  /** Atomic units. USDC has 6 decimals, so 10000 is $0.01. */
  maxAmountRequired: string;
  asset: string;
  payTo: string;
  resource: string;
  description: string;
  mimeType: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
}

export interface Challenge {
  x402Version: typeof X402_VERSION;
  error?: string;
  accepts: PaymentRequirements[];
}

/** The fee per reconciled round, in atomic USDC. $0.01 — small, and defensible. */
export const COLLECTOR_FEE_USDC_6DP = '10000';
export const USDC_DECIMALS = 6;

export function formatUsdc(atomic: string): string {
  const n = Number(BigInt(atomic)) / 10 ** USDC_DECIMALS;
  return `$${n.toFixed(2)}`;
}

export function network(): typeof NETWORK_SUI_MAINNET | typeof NETWORK_SUI_TESTNET {
  return process.env.KOLO_X402_NETWORK === NETWORK_SUI_TESTNET ? NETWORK_SUI_TESTNET : NETWORK_SUI_MAINNET;
}

/** Mainnet USDC is Circle's; testnet has its own. Never mix them up. */
export function usdcAsset(net: string = network()): string {
  return net === NETWORK_SUI_TESTNET
    ? '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC'
    : COIN_TYPE_USDC;
}

export interface ChallengeInput {
  payTo: string;
  resource: string;
  description: string;
  amount?: string;
  timeoutSeconds?: number;
  /** The Sui digest that proves the round reconciled. Binds the fee to the actual work. */
  reconcileDigest?: string;
  net?: string;
  asset?: string;
}

export function buildChallenge(input: ChallengeInput): Challenge {
  if (!/^0x[0-9a-f]{64}$/i.test(input.payTo)) {
    throw new Error(`payTo is not a Sui address: "${input.payTo}"`);
  }
  const net = input.net ?? network();
  return {
    x402Version: X402_VERSION,
    error: 'payment required: the collector fee is charged once the round reconciles',
    accepts: [
      {
        scheme: 'exact',
        network: net as PaymentRequirements['network'],
        maxAmountRequired: input.amount ?? COLLECTOR_FEE_USDC_6DP,
        asset: input.asset ?? usdcAsset(net),
        payTo: input.payTo,
        resource: input.resource,
        description: input.description,
        mimeType: 'application/json',
        maxTimeoutSeconds: input.timeoutSeconds ?? 120,
        extra: input.reconcileDigest ? { reconcileDigest: input.reconcileDigest } : {},
      },
    ],
  };
}

/** Base64 JSON in the PAYMENT-REQUIRED / PAYMENT-RESPONSE headers, per the spec. */
export function encodeHeader(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

export function decodeHeader<T = unknown>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export interface VerifyResult {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
}

export interface SettleResult {
  success: boolean;
  errorReason?: string;
  payer?: string;
  transaction?: string;
  network?: string;
  amount?: string;
}

export interface FacilitatorKind {
  x402Version: number;
  scheme: string;
  network: string;
  extra?: Record<string, unknown>;
}

/**
 * What each facilitator says it can do. Cached PER BASE URL — caching one global answer
 * would let a client pointed at facilitator B inherit facilitator A's capabilities, which
 * is exactly the kind of quiet lie this project is trying to avoid. An injected fetch is
 * never served from cache, so tests and one-off probes always hit the wire.
 */
const supportedCache = new Map<string, { at: number; kinds: FacilitatorKind[] }>();
const SUPPORTED_TTL_MS = 10 * 60_000;

export async function supportedKinds(
  base = FACILITATOR_URL,
  fetchImpl?: typeof fetch,
): Promise<FacilitatorKind[]> {
  const injected = Boolean(fetchImpl);
  const doFetch = fetchImpl ?? fetch;
  const hit = supportedCache.get(base);
  if (!injected && hit && Date.now() - hit.at < SUPPORTED_TTL_MS) return hit.kinds;

  const res = await doFetch(`${base}/supported`, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`facilitator /supported returned ${res.status}`);
  const body = (await res.json()) as { kinds?: FacilitatorKind[] };
  const kinds = body.kinds ?? [];
  if (!injected) supportedCache.set(base, { at: Date.now(), kinds });
  return kinds;
}

/** Clears the capability cache. Used by tests and by any long-running process that must re-check. */
export function forgetFacilitatorCapabilities(): void {
  supportedCache.clear();
}

/** True when the facilitator will settle the scheme/network/asset we are asking for. */
export async function canSettle(
  requirements: PaymentRequirements,
  base = FACILITATOR_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; reason?: string }> {
  let kinds: FacilitatorKind[];
  try {
    kinds = await supportedKinds(base, fetchImpl);
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
  const match = kinds.find((k) => k.scheme === requirements.scheme && k.network === requirements.network);
  if (!match) {
    return {
      ok: false,
      reason: `facilitator does not advertise ${requirements.scheme} on ${requirements.network} (offers: ${kinds
        .map((k) => `${k.scheme}/${k.network}`)
        .join(', ')})`,
    };
  }
  const advertisedAsset = match.extra?.usdc;
  if (typeof advertisedAsset === 'string' && !sameAsset(advertisedAsset, requirements.asset)) {
    return { ok: false, reason: `asset ${requirements.asset} is not the USDC this network settles (${advertisedAsset})` };
  }
  return { ok: true };
}

export function sameAsset(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

async function post<T>(base: string, path: '/verify' | '/settle', body: unknown, fetchImpl: typeof fetch): Promise<T> {
  const res = await fetchImpl(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    // The spec reserves 4xx for malformed bodies; semantic failure is 200 + isValid:false.
    throw new Error(`facilitator ${path} returned ${res.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

export async function verifyPayment(args: {
  paymentPayload: unknown;
  requirements: PaymentRequirements;
  base?: string;
  fetchImpl?: typeof fetch;
}): Promise<VerifyResult> {
  return post<VerifyResult>(
    args.base ?? FACILITATOR_URL,
    '/verify',
    { x402Version: X402_VERSION, paymentPayload: args.paymentPayload, paymentRequirements: args.requirements },
    args.fetchImpl ?? fetch,
  );
}

export async function settlePayment(args: {
  paymentPayload: unknown;
  requirements: PaymentRequirements;
  base?: string;
  fetchImpl?: typeof fetch;
}): Promise<SettleResult> {
  return post<SettleResult>(
    args.base ?? FACILITATOR_URL,
    '/settle',
    { x402Version: X402_VERSION, paymentPayload: args.paymentPayload, paymentRequirements: args.requirements },
    args.fetchImpl ?? fetch,
  );
}
