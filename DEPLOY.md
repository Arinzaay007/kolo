# Deploying Kolo

A public demo URL is a submission requirement, and the sandbox preview dies whenever the session
resets. Deploy once and stop worrying about it.

The Vercel project **`kolo`** already exists (framework: Next.js, region iad1). It needs a source
connection — pick one.

## Path A — GitHub (recommended: every push redeploys)

```bash
cd kolo

# 1. create an empty repo on GitHub, then:
git remote add origin git@github.com:<you>/kolo.git
git branch -M main
git push -u origin main

# 2. in Vercel: the `kolo` project → Settings → Git → Connect Repository → pick kolo
#    (framework auto-detects Next.js; no build settings to change)
```

Then add environment variables in **Settings → Environment Variables** when you go live.

## Path B — CLI, no GitHub

```bash
npm i -g vercel
cd kolo
vercel link              # choose the existing `kolo` project
vercel --prod
```

## Environment variables

Fixture mode needs **none** — the app runs from the seed circles and labels itself
"Demo data · not Mainnet". That is a safe public demo.

To go live, add these in Vercel (Production). Values come from `.env.example`:

| Key | Where | Notes |
|---|---|---|
| `MEMWAL_KEY` | memory.walrus.xyz/dashboard | delegate private key — **mark Sensitive** |
| `MEMWAL_ACCOUNT_ID` | same | |
| `MEMWAL_SERVER_URL` | `https://relayer.memory.walrus.xyz` | production; the app refuses staging |
| `MEMWAL_NAMESPACE` | `kolo` | one namespace, so records travel between circles |
| `TATUM_API_KEY` | dashboard.tatum.io | **mark Sensitive** |
| `TATUM_SUI_GRPC_HOST` | `sui-mainnet-grpc.gateway.tatum.io` | |
| `KOLO_ADDR_*` | your real Sui addresses | `KOLO_ADDR_ADA`, `KOLO_ADDR_EMEKA`, … |
| `KOLO_COIN_TYPE` | `0x2::sui::SUI` | |
| `KOLO_CONTRIBUTION_BASE` | `1000000` | 0.001 SUI (9 decimals) |
| `KOLO_ROUND_DAYS` | `7` | window a contribution must land inside |

Set `MEMWAL_KEY` and `TATUM_API_KEY` as **Sensitive** so they are write-only in the dashboard and
never appear in build logs.

## Order matters

1. Deploy in fixture mode → public URL exists, demo possible today.
2. Add Walrus keys → redeploy.
3. Run `npm run seed` **from your machine** against the same namespace.

If you skip step 3 the live app recalls nothing and the circle looks empty. It isn't broken —
it's unseeded. Seed first, then look.

## Keep a fallback

The hosted relayer is a public good with no SLA. Record a working demo run, and keep the
fixture-mode deployment reachable as a backup URL. If the relayer hiccups during recording, you
still have something to show.
