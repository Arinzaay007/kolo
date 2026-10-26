# Submission status

**Deadline: 10 Nov 2026, 17:00 UTC. Submit by 15:00.** Today: 26 Oct. Days left: 15.

Every line below is either ✅ (done, evidence exists) or ❌ (not done). Nothing is rounded up.

---

## The four mandatory artifacts

| Requirement | Status | Evidence | Blocker |
|---|---|---|---|
| Walrus Memory writing on **Mainnet** | ✅ | 23 blob IDs in `evidence/seed-mainnet.json` | — |
| **10+ memories** on Mainnet | ✅ | **23**, plus 4 recall probes that find them by meaning | — |
| **Tatum** RPC used, not decorative | ⚠️ | read a real Mainnet digest (`4ETyDNa5…`); balance read works keyless | `TATUM_API_KEY` for volume |
| Public repo | ✅ | <https://github.com/Arinzaay007/kolo> — 51 files, `.env` returns 404 | — |
| Blog post | ❌ | `BLOG.md` written, publish-ready | needs publishing |
| Demo video | ❌ | `DEMO.md` shot list written | needs recording against <https://kolo-inky.vercel.app> |

## Code

| Thing | Status |
|---|---|
| 5 screens (`/`, `/claim`, `/memory`, `/portable`, `/record/[member]`) | ✅ all 200 |
| Dispute rulings with superseding corrections | ✅ 9 tests |
| Live recall hardened (7-query union, 5s TTL, bust on write) | ✅ |
| x402 paid route `/api/collector` | ✅ 402 verified live |
| x402 settlement end to end | ❌ never run — needs a funded payer |
| Tests | ✅ 75 passing, no network (`unshare -rn`) |
| `tsc --noEmit`, `next build` | ✅ clean |

## Credentials

| Key | State | What it unlocks |
|---|---|---|
| `MEMWAL_ACCOUNT_ID` | ✅ `0xac392cd6…75aa` (Mainnet, active, 1 delegate: `kolo key`) | — |
| `MEMWAL_KEY` | ✅ verified `MATCH` against the account's delegate list | — |
| `MEMWAL_AGENT_ID` | ✅ `6da31569…e3f8` | the submission form |
| `TATUM_API_KEY` | ❌ empty — keyless still reads, so not blocking | chain reads past ~1 call |
| `KOLO_ADDR_*` | ✅ five generated and validated | — |
| `KOLO_PAYER_SECRET` | ❌ empty | settling the fee |

**Still needed, for the form itself:**

- Tatum **account ID** and **API key** from dashboard.tatum.io
- ~~`MEMWAL_AGENT_ID`~~ ✅ `6da315694f07ca7f80e6aee49ae38516ed220fb254468fc5417e5a2d59b5e3f8`

## Critical path

Ordered so that the two things that could invalidate the whole submission happen first.

```bash
# 1-4. DONE. Delegate verified, addresses generated, spike green, 23 memories written.

# 5. The gate that catches everything else before money moves.
npm run preflight             # Tatum key is the main gap it will name

# 6. Deploy (browser only).
#    push to GitHub, connect the Vercel project, paste env vars — DEPLOY.md
```

Then, in parallel with the above:

- **`npm run x402:pay -- <deployed-url>/api/collector`** once a payer wallet holds ~0.1 SUI + $0.01 USDC. One settlement, ~1 cent, and the agent-payments award has its evidence.
- **Record the demo** against the deployed URL, not localhost.
- **Publish the blog.** `BLOG.md` is final; it discloses that seeded cycles 1–2 are seeded.

## Two decisions still open

1. **AI Builder ($500).** Either drop it — the app was hand-written, and claiming otherwise inside a prize category would be false — or spend ~a day generating a genuine Kolo surface in `ai.tatum.io`. Must be decided before the form is submitted.
2. **Blog venue.** Own domain, dev.to, or Mirror. Not chosen.

## What "done" looks like

Not "the app works". These five, in hand:

1. A blob ID from `npm run seed`, plus `npm run memory` showing ≥10 entries read back
2. The Tatum account ID and `MEMWAL_AGENT_ID`, typed into the form
3. A public repo URL that a stranger can clone and run
4. A deployed URL where the badge does **not** say *Demo data · not Mainnet*
5. A video shorter than 3 minutes that ends on a real, verifiable claim

## Honest assessment

The engineering is done and tested; what remains is credentials, deployment and recording — all of which need you. The riskiest item is no longer technical. Three bugs surfaced the moment real keys arrived — the relayer reports `{ status: "ok" }` rather than `{ ok: true }`, so every write path declared a healthy relayer dead; and 23 writes exceed the 60-requests/minute delegate limit, which is now paced and resumable. Both were invisible in fixture mode. Expect more of that class on deploy, where environment is the only thing that differs.
