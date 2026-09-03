# Vercel Migration — BRB NGX Analyst

Moves the app off its embedded on-disk database and in-process schedulers so it
can run on Vercel's serverless platform.

**Status:** code complete and verified as far as it can be without a live
database (see §6). **One blocking decision remains — §4.**

> This **supersedes `docs/HANDOVER.md` §1 and the PDF manual §1**, which state
> the app cannot run on serverless. That was true of the previous architecture.
> The three properties that forced single-instance hosting have been addressed
> or consciously accepted below.

---

## 1 · What changed

| Was | Now | Why |
|---|---|---|
| PGlite — Postgres-in-WASM, stored as **files on disk** (`PGLITE_DIR`) | Networked Postgres via `pg` pool → `DATABASE_URL` | Serverless has no persistent disk. This was the actual cause of the 500s on login: `/api/health` returned 503 `db_unavailable` because there was no database at all |
| Schema + seed ran on **every process start** | Hash-gated migration inside a transaction holding `pg_advisory_xact_lock` | Two problems on serverless. (1) "Once per process" becomes "once per **cold start**", and this schema is 69 `CREATE`/`ALTER` statements plus a seed check — wasteful when instances recycle constantly, which they do at 5 users. Now a SHA-256 of `SCHEMA_SQL` is recorded in a `schema_state` table, so a warm database is confirmed with **one indexed SELECT** and the DDL is skipped; the hash changes automatically when `schema.ts` does, so upgrades still migrate. (2) Concurrent cold starts running DDL can deadlock — the advisory lock serialises them, with double-checked locking so only one instance migrates |
| `instrumentation.ts` started two `setInterval` workers | `POST/GET /api/cron/alerts` and `/api/cron/engine`, guarded by `CRON_SECRET` | No long-lived process exists to hold a timer |
| `serverComponentsExternalPackages: ["@electric-sql/pglite"]` + `instrumentationHook` | `serverComponentsExternalPackages: ["pg"]` | PGlite is gone; `pg` opens TCP sockets and must stay unbundled |

**Deliberately unchanged: rate limiting.** `src/lib/rate-limit.ts` still uses an
in-process `Map`, so counters are per-instance rather than global. With 5
internal users behind staff-only login this still throttles effectively, and it
avoided an async refactor across 16 call sites in 13 files. If the user base
grows, move it to a Postgres counters table — the seam is `enforce()`.

**Also unchanged: 21 repository modules.** `client.ts` kept the exact
`query()` / `queryOne()` / `newId()` signatures, and the SQL was already
portable — no extensions, no `gen_random_uuid`, no transactions, no
PGlite-specific syntax. Nothing else in the data layer was touched.

### Why plain `pg` rather than Neon's serverless driver

`@neondatabase/serverless` needs a WebSocket constructor shim on Node 20 (our
pinned version). Plain `pg` over Neon's pooled TCP endpoint avoids that whole
class of problem, and keeps the module portable — the identical build runs on
Vercel, or on EC2/RDS if you ever move. `max: 1` per instance leaves the real
pooling to PgBouncer.

---

## 2 · Environment variables to set in Vercel

Project → Settings → Environment Variables.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | **yes** | Already present from the Neon integration. Must be the **pooled** url — Neon's pooled host contains `-pooler`. Not `*_UNPOOLED` / `*_NON_POOLING` |
| `APP_ENCRYPTION_KEY` | **yes** | `openssl rand -hex 32`. Generate **once**, escrow separately, never rotate in place — everything encrypted at rest is unreadable without the exact key that wrote it |
| `BRB_SEED_PASSWORD` | **yes** | `openssl rand -base64 24`. Seeds the three staff accounts on first successful boot |
| `CRON_SECRET` | for scheduling | `openssl rand -hex 32`. The cron routes fail closed (503) without it |
| `NGNMARKET_API_KEY` | for market data | `ngm_live_…`. **Vercel egress IPs are not static on Hobby/Pro** — see §5 |
| `ANTHROPIC_API_KEY` | for AI | `sk-ant-…` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | optional | Inlined at **build** time, so it must exist before the build, not just at runtime |

`PGLITE_DIR` is obsolete — remove it if present.

---

## 3 · Wire up continuous deployment

**There is currently no CD.** The repo has no Vercel Git integration — no
deployments, no check runs, no commit statuses. The live site was deployed by
hand with the Vercel CLI, so **pushing to GitHub does not deploy**.

Fix: Vercel → project → Settings → Git → connect `BRBCapital/brb-terminal`.
Then every push to `main` deploys, and PRs get preview deployments.

GitHub Actions CI (`.github/workflows/ci.yml`) already runs the five gates on
every push and passes. It now provisions a throwaway `postgres:16-alpine`
service container for the dynamic gates, so it still needs **no secrets** and
never touches production data.

> **`.github/workflows/deploy.yml` (AWS EC2) has been deleted** — it never ran,
> and left in place it would fire on `v*` tags and fail for want of AWS
> credentials. The EC2 path itself remains valid and is now *less* constrained
> than before (a networked Postgres removes the single-writer requirement); it
> is documented in the PDF manual and recoverable from git history if wanted.

### ⚠ Which Vercel project actually serves the app?

`terminal.moneylot.com` serves this app — its `/api/health` returns this
codebase's exact response shape. But the Vercel project behind it is **not
connected to `BRBCapital/brb-terminal`**: that repo has one branch (`main`),
zero GitHub deployments, and no `vercel[bot]` activity.

What *does* have a Vercel Git integration is a **different** repo:
`BRBCapital/MoneylotWeb` → Vercel project `moneylot` (team `brbcapitalltd`) →
serves `moneylot.com`, the marketing site. Different app: its `package.json`
name is `moneylotweb`, not `brb-ngx-analyst`.

So "the branch is set up for Vercel CI/CD" is most likely about the marketing
site, not the analyst terminal. **Consequence: pushing to `brb-terminal` will
not update `terminal.moneylot.com`.** Confirm with DevOps which Vercel project
serves that domain, then either connect it to `brb-terminal` or have him
`vercel --prod` from an updated copy.

---

## 4 · ⚠ The blocking decision: Hobby caps functions at 60s

**11 routes declare a `maxDuration` above 60 seconds.** The Hobby plan caps
function execution at **60s**; 300s is the **Pro** ceiling.

| Route | Declared | Fate on Hobby |
|---|---|---|
| `api/portfolio-builder` | 300s | times out mid-build |
| `api/strategies/insight` | 300s | times out |
| `api/portfolios/[id]/analysis-report` | 300s | times out |
| `api/filings/[symbol]` | 300s | times out |
| `api/engine/backtest` | 300s | times out |
| `api/engine/report` | 300s | times out |
| `api/engine/run` | 300s | times out |
| `api/cron/engine` | 300s | times out once the engine is enabled |
| `api/portfolios/[id]/ai-review` | 180s | times out |
| `api/ai-summary` | 120s | times out |
| `api/stocks/[symbol]/analysis/[kind]` | 120s | times out |

These are the AI features — the product's differentiator. **This is not
solvable by configuration.** The options:

1. **Vercel Pro, $20/month — recommended.** Lifts the ceiling to exactly 300s
   and unlocks minute-level cron. Cheapest correct answer by a wide margin.
2. **Re-architect the AI routes** into a job queue (kick off → poll for
   result), so no single request exceeds 60s. Real work: new tables, polling UI,
   and a worker. Weeks, not hours.
3. **Ship on Hobby knowingly** — everything except long-running AI works. Login,
   dashboard, portfolios, watchlists, screener, transactions and alerts are all
   fine. Reports and deep analysis fail at 60s.

**Option 3 is a legitimate interim state.** The rest of the app is fully usable,
and the engine ships paused — so `api/cron/engine` is a no-op returning
immediately until someone deliberately enables it.

---

## 5 · Scheduling — and a cost trap

The cadences are now HTTP endpoints, so any scheduler works. Both accept `GET`
and `POST` with `Authorization: Bearer $CRON_SECRET`.

| Option | Interval | Cost |
|---|---|---|
| **Vercel Cron** | 1 min (Pro) · **once per day (Hobby)** | included |
| **GitHub Actions** (`.github/workflows/scheduler.yml`, shipped) | 5 min min. | free on **public** repos; a private repo bills minutes |
| **External pinger** (e.g. cron-job.org) | 1 min | free |

⚠ **The GitHub Actions cost trap.** Actions minutes are free on public repos but
billed on private ones (2,000 min/month free), at a 1-minute minimum per run:

- `*/15` → ~96 runs/day → **~2,900 min/month** (over the free tier)
- `*/30` → ~48 runs/day → ~1,450 min/month (inside it)

The shipped workflow uses `*/15` and hits **both** endpoints in one job, since
two jobs would double the billable minutes for nothing. **This repo is
currently public, so it is free today — but it should be private (§7), and once
it is, Vercel Pro is both cheaper and more capable than paying for Actions
minutes.**

**Tick rate barely matters.** The scheduler's windows are hours wide
(`inOpenWindow` = 09:30–16:00, `afterClose` = ≥16:00) and each job is claimed
atomically via `strategy_runs UNIQUE(kind, run_key)` keyed on the date — so a
job fires **once per day** regardless of tick frequency. A 15-minute tick
behaves identically to the old 60-second one, just with up to 15 minutes of
latency after the open. Over-invoking is safe by construction.

### Set the scheduler up

Repo → Settings → Secrets and variables → Actions:
- secret **`CRON_SECRET`** — same value as in Vercel
- variable **`PUBLIC_APP_URL`** — e.g. `https://terminal.moneylot.com`

Then trigger it once by hand (Actions → Scheduler → Run workflow) to confirm both
endpoints return 200.

---

## 6 · Verification status

Verified locally:

| Gate | Result |
|---|---|
| `npm run typecheck` | **0 errors** |
| `npm test` | **127/127** passed |
| `NODE_ENV=production npm run build` | **clean**; both cron routes registered as dynamic functions |
| PGlite removal | no references left in `src/`, `package.json`, or `next.config.mjs` |
| Workflow YAML | all three parse |

**Not yet verified: the live database path.** No local Postgres was available
(Homebrew's formula API is unreachable from the dev sandbox, Docker not
running), so the `pg` connection, the advisory-lock schema init, and the seeding
have **not been executed against a real Postgres**. They compile and the SQL is
unchanged, but first contact with Neon is still first contact.

**To verify before trusting it**, either:

- **(a) Local, against a Neon dev branch — preferred.** Create a branch in the
  Neon console (free, instant), put its pooled url in `.env.local` as
  `DATABASE_URL`, then `npm run dev` and check `/api/health` returns 200 and
  login works. Keeps production data untouched.
- **(b) A Vercel preview deployment.** Push to a branch, open the preview, hit
  `/api/health`. Note this uses the **production** database unless the preview
  environment has its own `DATABASE_URL`.

Expected on first successful boot: `/api/health` → `200 {"ok":true}`, schema
created, and the three `@brb.local` staff accounts seeded from
`BRB_SEED_PASSWORD`.

---

## 7 · Remaining work

1. **Decide §4** — Pro, queue re-architecture, or ship knowingly on Hobby.
2. **Verify the DB path** — §6(a).
3. **Connect the Vercel Git integration** — §3. Without it nothing auto-deploys.
4. **Set `CRON_SECRET`** in both Vercel and GitHub, then test the scheduler.
5. **Make the repo private.** `BRBCapital/brb-terminal` is **public** today — a
   full portfolio/trading system with its deployment topology and
   `scripts/pentest.mjs` readable by anyone. No credentials are committed (only
   `*.example` templates, all values blank), so this is not a rotation
   emergency, but: `gh repo edit BRBCapital/brb-terminal --visibility private`.
   Re-read §5 afterwards — it changes the scheduler economics.
6. **NGN Market IP allow-listing.** The old design had a stable Elastic IP to
   allow-list. **Vercel egress IPs are not static** on Hobby/Pro, so if the NGN
   Market key is IP-restricted it will fail unpredictably. Check whether the key
   is IP-bound; if it is, you need either Vercel's static-egress feature
   (Enterprise) or a small fixed-IP proxy. **This is the one migration risk with
   no clean workaround on Hobby/Pro** — worth confirming early.
7. **Region check.** Functions run in `iad1`. If the Neon database is in another
   region, every query pays cross-region latency — put them in the same one.
8. **First-boot hardening** (manual §9) — create real staff accounts, delete the
   three seeded `@brb.local` ones, and leave the engine paused.

---

_BRB Capital Group — internal engineering document. Pair with `docs/HANDOVER.md`
(architecture, ownership split) and the PDF manual (the EC2 path, still valid)._
