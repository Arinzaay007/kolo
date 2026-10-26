# Submission status

**Deadline: 10 Nov 2026, 17:00 UTC. Submit by 15:00.** Today: 26 Oct. Days left: 15.

Every line below is either ✅ (done, evidence exists) or ❌ (not done). Nothing is rounded up.

---

## The four mandatory artifacts

| Requirement | Status | Evidence | Blocker |
|---|---|---|---|
| Walrus Memory writing on **Mainnet** | ❌ | — | `MEMWAL_KEY` not set / not verified |
| **10+ memories** on Mainnet | ❌ | — | `npm run seed` not run |
| **Tatum** RPC used, not decorative | ⚠️ | read a real Mainnet digest (`4ETyDNa5…`) before any key existed — keyless | `TATUM_API_KEY` for volume |
| Public repo | ❌ | 13 commits local, **no remote** | needs GitHub |
| Blog post | ❌ | `BLOG.md` written, publish-ready | needs publishing |
| Demo video | ❌ | `DEMO.md` shot list written | needs recording |

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
| `MEMWAL_KEY` | ❌ empty | **everything memory** |
| `MEMWAL_AGENT_ID` | ❌ empty | the submission form |
| `TATUM_API_KEY` | ❌ empty | chain reads past ~1 call |
| `KOLO_ADDR_*` | ❌ empty | real member addresses (placeholders otherwise) |
| `KOLO_PAYER_SECRET` | ❌ empty | settling the fee |

**Still needed from the dashboard, for the form itself:**

- Tatum **account ID** (different from the API key)
- `MEMWAL_AGENT_ID` — the delegate **public key** hex, *not* the delegate address

## Critical path

Ordered so that the two things that could invalidate the whole submission happen first.

```bash
# 1. Prove the delegate key is the one registered on the account.
npm run memwal:find -- --address 0x2542da4d3e9fa1d39295ccf151b1a7200d498ce4c59737008fc5abaeb3220d68 --key <key>
#    expecting: MATCH: that delegate key is "kolo key"
#    then fill MEMWAL_KEY and MEMWAL_AGENT_ID in .env

# 2. Tatum key, then addresses. Both free.
#    dashboard.tatum.io -> API key
npm run keys:sui              # paste the KOLO_ADDR_* block into .env

# 3. One write. If this fails, stop and fix it — nothing downstream works.
npm run spike

# 4. The requirement itself: 23 memories on Mainnet.
npm run seed:dry              # what it would write
npm run seed                  # do it, then keep the blob IDs

# 5. The gate that catches everything else before money moves.
npm run preflight             # expecting every line ok, or a clear reason

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

The engineering is done and tested; what remains is credentials, deployment and recording — all of which need you. The riskiest item is not technical: it is that **step 1 has not been run**, so we still do not know whether the private key you hold is the delegate the account will accept. That is a one-command check and it gates everything.
