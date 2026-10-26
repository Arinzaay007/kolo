/**
 * Does the live facilitator still support us?
 *
 *   npm run x402:check
 *
 * Reads /supported and /health from the real service and compares against the challenge
 * Kolo would issue. Fails loudly rather than assuming the answer from a doc.
 */
import 'dotenv/config';
import { buildChallenge, canSettle, FACILITATOR_URL, formatUsdc, network, usdcAsset } from '../src/lib/x402';
import { addressOf } from '../src/seed/circle';

const collector = addressOf(process.env.KOLO_X402_PAYEE_MEMBER || 'Emeka');
const challenge = buildChallenge({
  payTo: collector,
  resource: 'https://kolo.app/api/collector',
  description: 'collector fee, charged once a round reconciles',
  reconcileDigest: 'example-digest',
});
const req = challenge.accepts[0]!;

console.log(`facilitator  ${FACILITATOR_URL}`);
console.log(`network      ${network()}`);
console.log(`asset        ${usdcAsset()}`);
console.log(`amount       ${req.maxAmountRequired} atomic = ${formatUsdc(req.maxAmountRequired)}`);
console.log(`payTo        ${collector}`);
console.log();

try {
  const health = (await fetch(`${FACILITATOR_URL}/health`).then((r) => r.json())) as Record<string, unknown>;
  console.log('health      ', JSON.stringify(health['facilitator'] ?? health).slice(0, 200));
} catch (err) {
  console.log('health       unreachable:', err instanceof Error ? err.message : String(err));
}

const verdict = await canSettle(req);
console.log();
if (verdict.ok) {
  console.log('SUPPORTED — the facilitator will verify and settle this exact challenge.');
  console.log('Next: a payer signs its own transaction and retries with PAYMENT-SIGNATURE.');
  process.exit(0);
}
console.error('NOT SUPPORTED —', verdict.reason);
process.exit(1);
