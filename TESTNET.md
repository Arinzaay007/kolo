# Testnet → Mainnet

Kolo touches **three different networks**, and only one of them may ever be testnet. Getting this
wrong is the fastest way to fail the submission while believing everything works.

| What | Network | Why |
|---|---|---|
| **Walrus Memory** | **Mainnet only** | "Walrus Memory integrated and writing on Mainnet" is a hard requirement. A testnet write is an instant disqualification that *looks like success*. It is also **free** (the hosted relayer sponsors WAL and gas), so there is no reason to use testnet. `KoloMemory.fromEnv()` refuses a staging URL. |
| **Tatum reads** | **Mainnet only** | These reads are the product's source of truth. Verifying a claim against testnet proves nothing. |
| **x402 fee** | **Testnet first, then one Mainnet settle** | The only place real money appears. Same code both ways. |

So: **yes, start the x402 work on testnet** — but keep the memories on Mainnet the whole time.
These are independent environment variables; mixing them up is the risk, not the design.

```
MEMWAL_SERVER_URL   https://relayer.memory.walrus.xyz   ← never staging
KOLO_X402_NETWORK   sui:testnet                          ← during x402 work
```

## Where the 69 tests fit

**They run on neither network. They make no network calls at all.** Verified by running the whole
suite inside `unshare -rn` — no network namespace, no DNS, no sockets — and all 69 passed.

That is deliberate: the parts that must be correct forever (the envelope that keeps user text from
being parsed as JSON, the reconciliation verdicts, the dispute rule, the payment header encoding)
are pure functions, tested in microseconds. Anything that really hits the wire is checked by a
script you run on purpose, against a network you chose:

| Evidence | Command | Network |
|---|---|---|
| Logic (69 tests) | `npm test` | **none** |
| Facilitator still supports us | `npm run x402:check` | mainnet (read-only) |
| A real claim, verified | `npm run verify -- <digest>` | **Mainnet** |
| A real fee, settled | `npm run x402:pay -- <url>` | testnet → mainnet |
| Real memories written | `npm run seed` | **Mainnet** (10+ required) |

Do not let "69 green" stand in for the last row. It is a completely different claim.

## Why testnet is genuinely cheap here

The Sui facilitator is **asset-agnostic** — it enforces whatever `asset` the payment requirements
name. So the fee does not have to be USDC. It can be **testnet SUI from a faucet**, which costs
nothing and needs no USDC at all:

```bash
sui client new-address ed25519
sui client faucet                       # free testnet SUI

export KOLO_PAYER_SECRET=<the secret key>
export KOLO_X402_NETWORK=sui:testnet
export KOLO_X402_ASSET=0x2::sui::SUI
export KOLO_X402_AMOUNT=1000000          # 0.001 SUI
```

**The catch:** `sui:testnet` is not a canonical x402 network id — the facilitator proposes it,
pending a blessing from the x402 foundation (the spec only defines `sui:mainnet`). If that id
changes, `npm run x402:check` reports *not supported* rather than failing silently. Check before
you demo.

## The sequence

```bash
# 1. does the facilitator still support us, on the network we are about to use?
KOLO_X402_NETWORK=sui:testnet npm run x402:check     # expecting SUPPORTED

# 2. serve
npm run dev

# 3. ask unpaid → 402 with the terms, bound to a reconcile digest
curl -i http://localhost:3000/api/collector

# 4. pay it: the payer signs its OWN transaction, the facilitator relays it
npm run x402:pay -- http://localhost:3000/api/collector
```

Step 3 already works today — verified live:

```
HTTP/1.1 402 Payment Required
payment-required: eyJ4NDAyVmVyc2lvbiI6Miwi…
{"accepts":[{"scheme":"exact","network":"sui:mainnet","maxAmountRequired":"10000",
  "asset":"0xdba3…00e7::usdc::USDC","payTo":"0x…","extra":{"reconcileDigest":"shortfall-r1-tunde"}}]}
```

Step 4 has not been run yet: it needs a funded payer key. That is the only missing piece.

## Moving to Mainnet

Change three things and nothing else:

```bash
KOLO_X402_NETWORK=sui:mainnet
KOLO_X402_ASSET=            # unset → defaults to Circle USDC 0xdba3…00e7::usdc::USDC
KOLO_X402_AMOUNT=           # unset → defaults to 10000 atomic = $0.01
```

Then run the same `npm run x402:pay`. Cost: **$0.01 of USDC plus a fraction of a cent of gas.**
That single settlement is what the "Best Use of Agent Payments" award is asking to see — a testnet
settlement is a rehearsal, not evidence. Keep both receipts: the testnet one proves the loop, the
mainnet one proves the claim.

## What the fee is for

The collector agent is paid **per round it reconciles** — real verifiable work, paid on delivery.
The challenge carries `extra.reconcileDigest`, so the payment is bound to the specific round it
paid for and the receipt cannot be replayed against another one.

Do not describe this as "an agent pays for a data refresh". That is contrived in a consumer app,
and a judge will say so.
