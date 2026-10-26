import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '../../../src/data/store';
import {
  buildChallenge,
  canSettle,
  decodeHeader,
  encodeHeader,
  readRequirements,
  settlePayment,
  verifyPayment,
  type PaymentPayload,
  type Receipt,
} from '../../../src/lib/x402';
import { formatAmount } from '../../../src/lib/config';
import { isPlaceholderAddress } from '../../../src/seed/circle';

export const dynamic = 'force-dynamic';

/**
 * The collector's paid endpoint.
 *
 * The collector agent does work — it reconciles the round against Sui Mainnet — and charges a
 * small fee per round it reconciles. Payment is proof-gated in both directions: the fee is only
 * due once a round actually reconciles, and the challenge names the digest of that reconciliation
 * so a receipt cannot be replayed against another round.
 *
 * Flow (x402 v2, Sui `exact` scheme):
 *   no PAYMENT-SIGNATURE  → 402 + PAYMENT-REQUIRED
 *   with PAYMENT-SIGNATURE → facilitator /verify, then /settle
 *   200 + PAYMENT-RESPONSE → receipt, carrying the Sui digest
 *
 * The facilitator relays the payer's own signed bytes: it holds no funds, and we never see a key.
 */
export async function GET(req: NextRequest) {
  const store = await getStore();
  const url = new URL(req.url);
  const member = url.searchParams.get('member') ?? process.env.KOLO_COLLECTOR_MEMBER ?? 'Emeka';

  // Who gets paid: the collector, whose address comes out of memory, not config.
  const account = await store.accountOf(member);
  const rotation = await store.rotation();
  const round = rotation?.round ?? 1;
  const payTo = account.address;

  if (!payTo) {
    return NextResponse.json(
      { error: `no address in memory for ${member}; run the seed or set KOLO_ADDR_*` },
      { status: 409 },
    );
  }

  // Never ask for money on behalf of a placeholder. Real USDC sent to 0xe7e7…e7 is gone for good,
  // and the flow would otherwise report success while doing it.
  if (isPlaceholderAddress(payTo)) {
    return NextResponse.json(
      {
        error: `${member} resolves to a placeholder address, so payment would be unrecoverable`,
        fix: `set KOLO_ADDR_${member.toUpperCase()} to a real Sui address, then seed`,
      },
      { status: 409 },
    );
  }

  // What the round reconciled to. The fee is bound to this, not to a bare request.
  const reconcileDigest = url.searchParams.get('digest') ?? rotation?.memoryIds[0] ?? 'unreconciled';

  // The resource URL is part of the terms a payer agrees to, so it must be the public URL a
  // payer actually sees — not the internal origin behind a proxy or on 0.0.0.0.
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? url.host;
  const proto = req.headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  const publicOrigin = process.env.KOLO_PUBLIC_URL?.replace(/\/$/, '') ?? `${proto}://${host}`;

  const challenge = buildChallenge({
    payTo,
    resource: `${publicOrigin}/api/collector`,
    description: `collector fee for reconciling round ${round}`,
    reconcileDigest,
  });
  const requirements = readRequirements(challenge);

  const header = req.headers.get('PAYMENT-SIGNATURE') ?? req.headers.get('X-PAYMENT');
  if (!header) {
    return new NextResponse(
      JSON.stringify({ ...challenge, hint: 'retry with a PAYMENT-SIGNATURE header carrying a signed Sui transaction' }),
      { status: 402, headers: { 'content-type': 'application/json', 'PAYMENT-REQUIRED': encodeHeader(challenge) } },
    );
  }

  const paymentPayload = decodeHeader<PaymentPayload>(header);
  if (!paymentPayload) {
    return NextResponse.json({ error: 'PAYMENT-SIGNATURE is not base64 JSON' }, { status: 400 });
  }

  // Check we can actually settle before taking the money: a facilitator that cannot settle
  // must not be discovered after verification.
  const supported = await canSettle(requirements);
  if (!supported.ok) {
    return NextResponse.json({ error: 'no facilitator for this payment', reason: supported.reason }, { status: 503 });
  }

  const verified = await verifyPayment({ paymentPayload, requirements });
  if (!verified.isValid) {
    return new NextResponse(JSON.stringify({ error: 'payment not valid', reason: verified.invalidReason ?? 'unknown' }), {
      status: 402,
      headers: { 'content-type': 'application/json', 'PAYMENT-REQUIRED': encodeHeader(challenge) },
    });
  }

  // Only now does the work count as done — settle, then serve.
  const settled = await settlePayment({ paymentPayload, requirements });
  const receipt: Receipt = {
    success: settled.success,
    payer: settled.payer,
    transaction: settled.transaction,
    network: settled.network,
    amount: settled.amount,
    errorReason: settled.errorReason,
  };

  if (!settled.success) {
    return NextResponse.json({ error: 'settlement failed', reason: settled.errorReason ?? 'unknown' }, { status: 402 });
  }

  // Record it: the fee the collector earned is itself a memory about the circle.
  const round_ = await store.verifyClaim({ member, digest: settled.transaction ?? '' }).catch(() => null);

  return NextResponse.json(
    {
      ok: true,
      round,
      reconciledFor: member,
      fee: formatAmount(requirements.maxAmountRequired),
      asset: requirements.asset,
      network: requirements.network,
      digest: settled.transaction,
      payer: settled.payer,
      note: round_
        ? 'the collector fee settled and the round is recorded'
        : 'the collector fee settled; the round record is unchanged',
    },
    { headers: { 'PAYMENT-RESPONSE': encodeHeader(receipt) } },
  );
}
