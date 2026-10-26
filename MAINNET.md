# Full Mainnet

Decision: **no testnet anywhere.** Walrus Memory, Tatum reads and the x402 fee all run on Sui /
Walrus Mainnet. Testnet was considered and rejected — the reasons are below, because "we skipped
the rehearsal" should be a decision someone can argue with, not an accident.

## What that means

| What | Network | Cost |
|---|---|---|
| Walrus Memory | Mainnet | **$0** — the hosted relayer sponsors WAL and SUI gas |
| Tatum reads | Mainnet | **$0** — free API key |
| x402 collector fee | Mainnet | **$0.01** + a fraction of a cent of gas |

Total real-money exposure for the whole submission: **about one cent.** That is the argument for
skipping testnet — the usual reason to rehearse on testnet is that a mistake is expensive, and here
a mistake is not.

## The catch, stated plainly

Testnet would have caught bugs for free. On Mainnet, the first real settle is also the first real
test. So the failure modes move from *losing money* to *losing time and looking foolish*, and the
mitigation is a preflight, not a rehearsal:

```bash
npm run preflight
```

Read-only. It never writes a memory and never settles a payment. It checks, in order:

- x402 network is `sui:mainnet`, and the Walrus relayer is the hosted one (not staging)
- Walrus Memory keys are present — otherwise the app is in fixture mode and **nothing is on Mainnet**
- Tatum key is present — keyless Tatum allows about one call, then 429
- every member resolves to a **real** address, not a placeholder
- the facilitator will settle the exact challenge we issue, in the exact coin
- the payer key parses and actually holds the fee plus gas headroom

Verified as of today:

```
ok    x402 network is Mainnet            sui:mainnet
ok    facilitator accepts our challenge  settles 10000 atomic of 0xdba3…00e7::usdc::USDC
FAIL  Walrus Memory keys present         MEMWAL_KEY / MEMWAL_ACCOUNT_ID missing …
FAIL  address for Emeka                  KOLO_ADDR_EMEKA not set …
FAIL  payer key present                  KOLO_PAYER_SECRET missing …
8 gate(s) failed. Nothing has been spent.
```

That is the honest state: the rails are verified, the credentials are not in place.

## The bug this decision surfaced

Running the preflight is what caught it. `addressOf()` returned a placeholder when `KOLO_ADDR_*`
was unset — correct for the demo UI, **catastrophic for a payment**, because the 402 challenge would
have named `payTo: 0xe7e7…e7e7` and real USDC sent there is unrecoverable, while the flow reported
success. Now:

- `addressOf(member, { requireReal: true })` throws instead of falling back
- the paid route returns **409** rather than a 402 naming a placeholder
- the payer script refuses a placeholder payee before building a transaction
- `isPlaceholderAddress()` is tested, case-insensitively

Money paths get the strict version. The demo UI keeps the lenient one, because it needs something
to render.

## Sponsorship is not an option here

The hosted facilitator can sponsor gas, but only when its own `ENOKI_KEY` is set — and on the
hosted instance it is not. `/gas-station` returns `503 sponsorship not configured`, and `/verify`
rejects any transaction whose gas owner differs from the sender, because `/settle` only broadcasts
the payer's signature.

So if you see **"Invalid sponsor authorization"**, nothing is broken in Kolo — you are on a
sponsored-transaction path that this facilitator does not support. Fund the payer wallet with
~0.1 SUI and let it pay its own gas. `scripts/x402-pay.ts` now checks both ends of this: it refuses
to build when the payer has no SUI, and refuses to sign if the built transaction's gas owner is not
the sender.

That constraint is also a feature of the pitch: the fee comes from the payer's own wallet, and no
party in the stack can move funds on anyone's behalf.

## Pay in USDC or in SUI?

The fee defaults to **$0.01 of Circle USDC** (`0xdba3…00e7::usdc::USDC`) — the canonical x402 asset.
The Sui facilitator is asset-agnostic, so `KOLO_X402_ASSET=0x2::sui::SUI` pays in SUI instead, which
avoids having to get USDC onto Sui at all.

Recommendation: **settle the real one in USDC.** A judge checking an agent-payments award looks for
USDC, and "we paid in SUI because it was easier" is a worse sentence than "we moved $0.01 of USDC."

## The sequence

```bash
# 1. what is missing? spends nothing
npm run preflight

# 2. serve
npm run dev

# 3. ask unpaid → 402 with terms bound to a reconcile digest (works today)
curl -i http://localhost:3000/api/collector

# 4. pay it — the payer signs its OWN transaction, the facilitator relays it
npm run x402:pay -- http://localhost:3000/api/collector

# 5. confirm on chain, through Tatum
npm run verify -- <the digest from the receipt>
```

Step 3 is verified live. Step 4 has not run: it needs `KOLO_PAYER_SECRET`, which is the only
missing piece.

## What the fee is for

The collector agent is paid **per round it reconciles** — real verifiable work, paid on delivery.
The challenge carries `extra.reconcileDigest`, so a payment is bound to the specific round it paid
for and its receipt cannot be replayed against another.

Do not describe this as "an agent pays for a data refresh". That is contrived in a consumer app, and
a judge will say so.

## If it fails on Mainnet

The fee is one cent, so the response is: read the facilitator's `invalidReason`, fix, retry. The
things most likely to fail on a first real run are the payer's coin selection and the facilitator
rejecting a non-canonical asset — both visible in the preflight or in the first 402, neither
expensive. What must **not** happen is a retry loop against a placeholder address, which is why
that is now refused in three places.
