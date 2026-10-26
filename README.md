# Kolo — the circle that remembers

Rotating savings circle where the pot remembers. Members pay in, one collects each round, and
the circle learns who actually pays, which nudge works, and who has earned an earlier turn —
a record that travels with a member to their next circle.

Built for **Total Recall — Tatum × Walrus Memory Hackathon** (Track 3 · Consumer Finance).

📄 [`BLOG.md`](BLOG.md) — the write-up · 🎬 [`DEMO.md`](DEMO.md) — shot-by-shot script ·
🚀 [`DEPLOY.md`](DEPLOY.md) — Vercel setup

> Kolo never holds your money. It knows what happened to it. That is a memory problem, which is
> why it runs on Walrus.

---

## Status: day 0–4 of 16

| Piece | State |
|---|---|
| Memory schema (8 entity types) + envelope | ✅ 5 tests |
| Walrus Memory client (`KoloMemory`) | ✅ written, needs your keys to run |
| Tatum Sui **gRPC** client | ✅ **verified live against Mainnet from this repo** |
| Claim reconciliation (pure) | ✅ 12 tests |
| Data layer: one interface, fixture + live | ✅ 10 tests |
| **UI: circle, claim check, inspector, portability, member record** | ✅ **five screens, production build passing** |
| Second circle + cross-circle rotation evidence | ✅ portability proven in the UI, 4 tests |
| Member can see **and contest** their own record | ✅ 2 tests |
| Dispute **ruling** → correction that supersedes | ✅ 9 pure + 4 store tests |
| Live recall hardened (7-query union, 5s cache, bust on write) | ✅ |
| Collector address recalled from memory (was an env var) | ✅ 2 tests |
| Seed circle (15 memories) on Mainnet | ⏳ `npm run seed` with keys |
| x402 collector fee | ⏳ stretch, day 11+ |

```bash
npm run dev      # http://localhost:3000
```

Without keys the app runs from the seed circle and **says so on every screen** ("Demo data · not
Mainnet"). Add `MEMWAL_KEY` + `MEMWAL_ACCOUNT_ID` and the same code reads and writes real Mainnet
memory instead — the badge flips to "Walrus Memory · Sui Mainnet". There is no third mode, and
nothing pretends to be on chain when it isn't.

## The five screens

**`/` — the circle.** Member cards showing reliability, the learned pay rhythm ("pays around the
5th, ± 0.4d, 3 payments seen") and the learned nudge ("whatsapp at 19:00 — worked 3h later"). Beside
them, the rotation: who collects first and **why**, with a link to the memories behind the order.

**`/claim` — did the money actually arrive.** Pick the member, paste the digest, and the server
asks Tatum's Sui gRPC gateway. The verdict shows each reason the check failed, and the blob ids of
the memory it wrote. A contested claim is recorded with both what the member said and what the chain
shows — never as an accusation.

**`/portable` — the claim the submission rests on.** Emeka joins a second circle where nobody has
met him. Day one, zero events in that circle — and Kolo still shows his standing, recalled from the
first. The second circle's rotation put him first and cited three memories **written in the other
circle**. Click through and check; every cited id resolves.

**`/record/[member]` — the member's own view.** Everything remembered about a person, grouped by
circle, and every line can be contested by them without anyone's permission. A contest does not edit
or delete the memory: it writes a `member_dispute` that references it, so the original and the
objection both stay readable. Portable reputation without a right of reply is a tool for exclusion.

**`/memory` — the receipt.** Every memory: the sentence a person can read, its type, its date, and
the blob it lives in. Filter by type. Arrive via a rotation reason and the cited memories are
highlighted at the top, so a judge can go **claim → decision → evidence** without leaving the app.

The dev server is live on port 3000. In demo mode try a digest containing `old` (a real transfer
from a previous cycle → contested) or starting with `missing` (nothing on chain → contested).

### What was verified live, 25 Oct 2026

```
PASS  3 · real Sui Mainnet read via Tatum gRPC
      0x00000000… holds 2400568446767 base units (2,400.568 SUI)
PASS  3b · absent digest answers "not found"
```

Read through `sui-mainnet-grpc.gateway.tatum.io:443` with `x-api-key` as gRPC metadata.
Two things learned the hard way, both now encoded in the code:

1. **JSON-RPC is dead.** Sui Foundation disabled it on Mainnet full nodes in the week of
   27 Jul 2026 and removed it from node code in mid-October 2026. Tatum's own blog post and
   several hackathon entries still print `https://sui-mainnet.gateway.tatum.io`. It will not
   connect. Use gRPC.
2. **The keyless "anonymous" plan allows roughly one call**, then HTTP 429. The spike reports
   429 as *"set TATUM_API_KEY"* rather than as a broken pipe, because the difference matters:
   an auth failure must never be read as "the member did not pay".

---

## Run it

```bash
npm install
cp .env.example .env      # fill in MEMWAL_KEY, MEMWAL_ACCOUNT_ID, TATUM_API_KEY

npm run spike             # the day-0 gate: three things must be true
npm run seed -- --dry     # see the 15 memories, no network
npm run seed              # write them to Mainnet, record every blob id
npm test                  # 17 tests
npm run typecheck
```

`npm run seed` writes `evidence/seed-mainnet.json` — every memory, its blob ID, its timestamp.
That file is the submission artifact for *"at least 10 memories stored on Mainnet"*. Keep it.

### Keys

| Value | Where | Goes on the submission form? |
|---|---|---|
| `MEMWAL_KEY` | memory.walrus.xyz/dashboard → agent → delegate private key | never |
| `MEMWAL_ACCOUNT_ID` | same dashboard | no |
| delegate **public** key | same dashboard | **yes — this is `MEMWAL_AGENT_ID`** |
| `TATUM_API_KEY` | dashboard.tatum.io | no |
| Tatum **account ID** | dashboard.tatum.io | **yes** |

`MEMWAL_SERVER_URL` must stay on the production relayer. `KoloMemory.fromEnv()` refuses to start
against a staging or testnet URL, because "writing on Mainnet" is a hard requirement and a
testnet write is an instant disqualification that looks like success.

---

## The memory schema

Ten entity types, each mapping to something a judge can see on screen.

| Type | What it records | What it changes |
|---|---|---|
| `member_rhythm` | typical pay day, variance, samples | board says "expected 5 Nov", no nudge sent |
| `nudge_outcome` | channel, hour, tone → paid within N hours | nudge picker defaults to what worked |
| `shortfall_event` | who fell short, who covered, repaid? | feeds reliability |
| `contested_claim` | claimed digest vs what the chain showed | claim shown as contested, not accused |
| `contribution_verified` | digest, amount, when | board ticks, reliability up |
| `reliability_trajectory` | score + the evidence ids behind it | member card, clickable to evidence |
| `circle_constitution` | a rule, and where it came from | a rule written *because* of a past dispute |
| `circle_account` | a member's Sui address | the address a claim is checked against — recalled, traceable |
| `member_dispute` | a member saying a memory about them is wrong | shown against the memory, never deletes it |
| `rotation_decision` | the order **and the reasons** | the rotation board |

`rotation_decision` is the one that wins or loses the Walrus Memory award: **the reasons are
stored, not written at render time.** A judge clicks a slot and lands on the memories that caused
it. That is the difference between "AI-powered" and "provably learned".

### One namespace, many circles

Every circle shares one namespace (`kolo`), and the circle is named *inside* each memory. Recall
is scoped per account + namespace, so this is exactly what lets Emeka's reliability earned in
circle A be recalled in circle B — the portability claim the $500 memory award asks for.

### The envelope

Walrus Memory stores and embeds **text**, so each memory is written as:

```
Ada usually pays around the 5th of the month, give or take 0.4 days (3 payments seen).
<<<kolo-json>>>
{"id":"rhythm-ada","circle":"kolo-circle-1","at":"2026-10-06T09:00:00.000Z","type":"member_rhythm","data":{...}}
```

The sentence is what makes `recall({ query: "which nudge works on Ada" })` actually find it —
JSON alone embeds badly. The JSON tail is what lets the app read the fact back exactly. Neither
half is optional; `tests/schema.test.ts` round-trips every seed memory to prove it.

---

## Going real: testing with real Mainnet funds

Two independent halves, and only one of them costs anything.

| | Real without spending anything | Needs funds |
|---|---|---|
| Memories on Mainnet | ✅ the hosted relayer is **sponsored** — no SUI, no WAL | |
| Chain reads through Tatum | ✅ free API key | |
| Verifying someone else's transaction | ✅ `npm run verify -- <digest>` | |
| **Your own contributions moving** | | ~0.001 SUI per transfer + gas |

So: the mandatory 10+ Mainnet memories cost nothing. Only make your *own* transfers if you want
the demo's money movement to be yours.

### Setup

```bash
cp .env.example .env      # MEMWAL_*, TATUM_API_KEY, then KOLO_ADDR_*
```

Set `KOLO_ADDR_ADA`, `KOLO_ADDR_EMEKA`, … to real Sui Mainnet addresses. **A malformed address
throws rather than falling back to a placeholder** — a typo must not produce a demo that looks
real while verifying against a fake address.

Then check any real transaction before you trust the pipeline:

```bash
npm run verify -- <digest>                      # what Kolo would conclude, no writes
npm run verify -- <digest> --expected 10000000  # 0.01 SUI
```

It prints the coin, the amount, the round window and where that window came from, reads the
transaction through Tatum, and states the verdict with reasons.

### Three things that had to change for real funds

1. **The round window was hardcoded** to 1–8 Nov 2026, so a transfer made today read as
   "outside this round". It now defaults to the last 7 days ending *now*
   (`KOLO_ROUND_DAYS`), with a 5-minute tail because chain timestamps lag the local clock.
2. **Amounts and coin are configurable.** SUI has 9 decimals and USDC has 6, so
   `1000000` is 0.001 SUI but `20000000` is 20 USDC. Never assume the default.
3. **Transfers are filtered by coin type.** A transaction moving three coins must not satisfy a
   contribution by accident: `observeTransfer(client, digest, coinType())` only counts the
   contribution coin, and `coinTypes` reports what else moved so a wrong-coin transfer can be
   named rather than mis-read.

### Verified live, 26 Oct 2026

```
read 4ETyDNa5bhLXzTQsvVyR8LziWiEivrM15oZThd9jxndn
  status        success
  at            2026-10-11T10:18:53.088Z
  coins moved   0x00…02::sui::SUI
verdict: CONTESTED  (expecting 0.001 SUI)
  · the transfer did not reach this round's collector
  · the transfer happened outside this round
```

A real Mainnet transaction, read through Tatum, rejected for the right two reasons. That is the
negative path working on real data — the part that matters, because a verifier that only ever says
yes is worthless.

## Reconciliation: claim → chain → memory

`src/lib/reconcile.ts` is pure — no network, no clock, no randomness — so the rule that decides
whether someone's money landed is unit-tested rather than trusted. Every verdict drafts the
memory to write, which is why verification produces memory by construction instead of asking the
user to "use the memory feature".

Contested cases covered by tests: no digest, digest absent on chain, digest unreadable (auth),
wrong recipient, wrong amount, outside the round window, failed transaction, not yet checkpointed.

A contested claim is recorded with **both sides** — `claimedDigest` and `chainSays` — never as an
accusation. Resolution writes a correction that supersedes, rather than overwriting.

---

## Layout

```
app/                   Next.js app router — the five screens
  page.tsx             the circle: members, learned notes, rotation + reasons
  claim/               claim check (server action; keys stay server-side)
  memory/              inspector, filters, evidence highlight
  portable/            the same member in a second circle, record carried
  record/[member]/     the member's own view, with a working contest form
  actions.ts           the only place that verifies a claim for the UI
src/lib/schema.ts      8 entity types, the envelope, sentence()
src/lib/memory.ts      KoloMemory over @mysten-incubation/memwal
src/lib/tatum.ts       Sui Mainnet gRPC client + transfer/balance normalisation
src/lib/reconcile.ts   claim + expectation + observation → verdict + memories
src/lib/dispute.ts     objection + ruling → resolution + correction (pure, 9 tests)
src/lib/config.ts      coin, amount, round window, real addresses — one place
src/data/store.ts      one interface, two implementations (fixture | live):
                       circles, members, rotation, memories, record, contest, accountOf, verifyClaim
src/seed/circle.ts     the demo circle (Ada, Emeka, Tunde) and its history
scripts/spike.ts       the day-0 gate
scripts/seed.ts        writes the seed to Mainnet, records blob ids
tests/                 57 tests: envelope, reconciliation, store, claim,
                       portability, disputes, and the ruling loop
```

`src/lib/*` has no Next.js in it, so the engine stays reusable if the shell is ever rewritten.

Stack note: memwal's TypeScript SDK is the reference implementation (Python exists but is beta),
and Tatum AI Builder generates Next.js — so the UI lands in Next.js with no rewrite of this engine.
This code is framework-free on purpose: `src/lib/*` has no Next.js in it.

## Honest limits

- The seed history (cycles 1–2) is scripted. Every memory write is real and on Mainnet. Say so.
- No auth yet: three seeded identities with real delegate keys. Plan is an identity switcher
  ("viewing as Ada") so judges see the multi-member experience without a login.
- Kolo holds no money by design. It coordinates and remembers; members pay each other directly.
