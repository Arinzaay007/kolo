# Getting the keys

Four credentials. Two are free and instant, one is five commands, one needs about a cent of real
SUI. Do them in this order — each step verifies itself before the next one matters.

**One rule first:** type keys into `.env`, not into chat. `.env` is gitignored and stays on your
machine; a chat transcript is a log. If a key does end up pasted somewhere, rotate it — they are all
free to regenerate except the funded wallet.

```bash
cd kolo && cp .env.example .env     # then fill it in as you go
```

---

## 1. Walrus Memory — `MEMWAL_KEY`, `MEMWAL_ACCOUNT_ID` (+ `MEMWAL_AGENT_ID`)

**Free. ~2 minutes. This is the credential the whole submission depends on.**

**Two ways to do this. If the playground gives you an error, use the second one.**

### Path A — the playground (if it works)

1. Open **<https://memory.walrus.xyz>** (verified live, `200`).
2. Generate an **account ID** and a **delegate key**. You get three things:
   - **account ID** → `MEMWAL_ACCOUNT_ID`
   - **delegate private key** (ed25519, hex) → `MEMWAL_KEY`
   - **delegate public key** → `MEMWAL_AGENT_ID` — this is what the submission form asks for

### Path B — create it yourself, with no sponsor (if the playground errors)

The playground creates your on-chain account with a **sponsored** transaction. When that sponsor's
authorization is stale you get **"Invalid sponsor authorization"** and no way forward. Nothing about
the account actually needs a sponsor — it is two ordinary transactions costing a fraction of a cent:

```bash
npm run memwal:account -- --dry                    # just generate a keypair, offline, free
npm run memwal:account -- --owner suiprivkey1...   # create the account + register the delegate
```

It prints a paste-ready `MEMWAL_ACCOUNT_ID` / `MEMWAL_KEY` / `MEMWAL_AGENT_ID` block. Uses the
public Mainnet deployment IDs:

```
package   0xe7c16fbea0560e7057e2bf7422feaa4fb313749fc69c9e9092fac7a33b81d7f5
registry  0x8bf82c9e09e36b8d1c38298f68b7cb68e7b8762887e7592add9986d5e9cf199f
```

The `--owner` wallet needs ~0.1 SUI. If that wallet already owns an account, it says so and tells you
to pass `--reuse-account 0x…` — a Sui address can only ever own one.

3. Leave the relayer URL alone. The default in `.env.example` is already the **production**
   relayer:

   ```
   MEMWAL_SERVER_URL=https://relayer.memory.walrus.xyz   ✅ Mainnet
   MEMWAL_SERVER_URL=https://relayer-staging.memory.walrus.xyz   ❌ instant disqualification
   ```

   `KoloMemory.fromEnv()` refuses `staging`/`testnet` URLs outright, so you cannot get this wrong by
   accident — but you can get it wrong by pasting the staging key into a staging URL and wondering
   why the app has no memories.

**Why it costs nothing:** the hosted relayer sponsors both the WAL and the SUI gas. Do **not** fund
anything for memory writes. If something asks you to pay for storage, you are in the wrong place.

**Verify** (before touching anything else):

```bash
npm run spike        # health → remember → waitForRememberJob → recall
```

A pass looks like `status: ok` from `/health` and a blob ID back from the write. Note the `/health`
body reports `remember.asyncJobs` — writes are jobs, so `waitForRememberJob` is not optional.

> `MEMWAL_AGENT_ID` is the public key, **not** a secret. Keep it — the form needs it — but it can go
> in the README without harm.

---

## 2. Tatum — `TATUM_API_KEY` (+ dashboard **account ID** for the form)

**Free. ~2 minutes.**

1. Sign in at **<https://dashboard.tatum.io>**.
2. Create an **API key**. Free tier is enough for Kolo — it does one gRPC read per claim verified.
3. Copy the **account ID** from the dashboard too. The submission form wants it, and it is a
   different string from the API key.

```
TATUM_API_KEY=t-…
TATUM_SUI_GRPC_HOST=sui-mainnet-grpc.gateway.tatum.io    # leave as is
```

**Verify:**

```bash
npm run verify -- 4ETyDNa5bhLXzTQsvVyR8LziWiEivrM15oZThd9jxndn
```

Expect `status success`, the sender, and `CONTROLLED`/`CONTESTED` against this round's window —
that digest is a **real Mainnet transfer** already used to prove the read path, so if it comes back
you know the key works on Mainnet.

**If you skip it:** keyless Tatum allows roughly one call then returns `429`. The app will look
broken in a way that has nothing to do with the app.

---

## 3. Member addresses — `KOLO_ADDR_ADA`, `…_EMEKA`, `…_TUNDE`, `…_NGOZI`, `…_BOLA`

**Free. One command.**

```bash
npm run keys:sui                      # five fresh addresses, prints a paste-ready .env block
npm run keys:sui -- --check           # validates whatever is already in .env
```

These are public addresses that member contributions are checked against. They do not need funds —
Kolo reads the chain to see whether a transfer arrived, it never sends to a member.

Three ways to fill them, all fine:

| Option | When |
|---|---|
| `npm run keys:sui` | Default. Fresh, unused, nothing to leak. |
| Your own wallet addresses | If you want the demo to reference addresses you actually control. |
| The sender of a real transfer | Best for a live claim, e.g. `0x34729f8d…` from the verified digest above. |

**What does not work:** leaving them empty. An unset `KOLO_ADDR_*` falls back to a placeholder
(`0xa1a1…`), which is fine for the demo UI and **refused everywhere money moves** — the paid route
returns `409` rather than asking for a payment to an address nobody controls. That guard exists
because a preflight caught it.

---

## 4. The payer wallet — `KOLO_PAYER_SECRET`

**The only step that touches real money. Total cost: about one cent.**

```bash
npm run keys:sui -- --secrets
```

Pick **one** of the five and use it as the payer. Set:

```
KOLO_PAYER_SECRET=suiprivkey1…
```

If you would rather use an existing Sui wallet, export the key instead of generating:

```bash
sui keytool export --key-identity <your-address>     # prints suiprivkey1…
```

### Funding it

Only two things are needed:

- **SUI, for gas.** One transfer costs a fraction of a cent. **0.1 SUI is plenty**; anything more is
  just sitting there.
- **USDC, for the fee itself** — `$0.01` (10 000 atomic, 6 decimals) — *unless* you choose to pay in
  SUI, see below.

Getting either onto Sui, in order of least hassle:

1. **Withdraw from an exchange** — pick one that lists **SUI** and lets you withdraw on the **Sui
   network** (not an ERC-20 wrapped version; wrong network means lost funds). Same for USDC: it must
   be **Sui USDC**, address `0xdba3…00e7::usdc::USDC`.
2. **Swap on a Sui DEX** (Cetus, Aftermath, 7K) if you already hold SUI. Swapping 0.2 SUI gets you
   far more than the one cent of USDC the fee needs.
3. **Pay the fee in SUI instead** — the facilitator is asset-agnostic, so no USDC is required at all:

   ```
   KOLO_X402_ASSET=0x2::sui::SUI
   KOLO_X402_AMOUNT=1000000        # 0.001 SUI
   ```

   This works, and it is honest — but a judge scoring an agent-payments award is looking for USDC.
   My recommendation is to settle the real one in USDC and keep SUI for gas.

### Safety

- **Use a fresh wallet, not your main one.** It needs a cent in it; there is no reason for your
  savings to be one bad line of code away.
- If the key ever lands in a git commit, rotate the wallet. `.env` is gitignored, but confirm:

```bash
git status --porcelain | grep -c "\.env$"     # expect 0
git grep --cached -nEi "suiprivkey1|t-[a-z0-9]{20,}" -- . ':!.env.example'   # expect no output
```

---

## The whole `.env`, in one block

```bash
# Walrus Memory (Mainnet, free — relayer sponsors gas)
MEMWAL_KEY=suiprivkey1…
MEMWAL_ACCOUNT_ID=…
MEMWAL_AGENT_ID=…                                  # public key, for the submission form
MEMWAL_SERVER_URL=https://relayer.memory.walrus.xyz
MEMWAL_NAMESPACE=kolo

# Tatum (free tier)
TATUM_API_KEY=t-…
TATUM_SUI_GRPC_HOST=sui-mainnet-grpc.gateway.tatum.io

# Members (public addresses, no funds needed)
KOLO_ADDR_ADA=0x…
KOLO_ADDR_EMEKA=0x…
KOLO_ADDR_TUNDE=0x…
KOLO_ADDR_NGOZI=0x…
KOLO_ADDR_BOLA=0x…

# The collector fee
KOLO_X402_NETWORK=sui:mainnet
KOLO_X402_PAYEE_MEMBER=Emeka
KOLO_PAYER_SECRET=suiprivkey1…                      # fund with ~0.1 SUI + $0.01 USDC
```

---

## Verification ladder — run these in order

Each one is cheap and failure is legible, so a problem stops at the step that caused it instead of
surfacing three steps later as "the demo looks empty".

```bash
npm run keys:sui -- --check    # 1. addresses are real, not placeholders     (no network)
npm run preflight              # 2. every gate: env, facilitator, balances    (read-only)
npm run spike                  # 3. memory health → write → recall            (one write)
npm run seed:dry               # 4. what seeding would write                  (no writes)
npm run seed                   # 5. the real thing — 23 memories on Mainnet
npm test                       # 6. nothing above broke the logic            (no network)
```

Step 5 is the submission requirement (**10+ memories on Mainnet**). Do not skip to the demo before
it prints blob IDs. Then:

```bash
npm run dev
# and in another shell, once the payer is funded:
npm run x402:pay -- http://localhost:3000/api/collector
```

---

## What each key unlocks, and what breaks without it

| Key | Unlocks | Without it |
|---|---|---|
| `MEMWAL_KEY` + `MEMWAL_ACCOUNT_ID` | Real memories on Walrus Mainnet | **Fixture mode.** The app works and is badged *Demo data · not Mainnet*. The submission requirement is unmet. |
| `MEMWAL_AGENT_ID` | The memory award + form | Nothing breaks, but the form cannot be completed |
| `TATUM_API_KEY` | Chain reads at volume | ~1 call, then `429` |
| `KOLO_ADDR_*` | Real claims against real addresses | Placeholders; money paths refuse to run |
| `KOLO_PAYER_SECRET` | A settled x402 fee | The 402 works, the payment never settles |

**Nothing here requires spending money except step 4, and step 4 costs about a cent.**
