# Handover — BRB NGX Analyst: local bring-up + AWS CI/CD

**Date:** 2026-08-28 · **Status:** runs clean locally; all five gates green; CI/CD
authored but **never executed against AWS**. No AWS resource has been created,
modified, or deployed to.

Written to be picked up cold. Read §1–§3 before changing anything.

---

## 0 · Handover: who does what

DevOps can execute the whole AWS build from the PDF manual + `docs/CICD.md`.
Seven things they **cannot** get for themselves — these block the deploy until
the application owner supplies them.

### Blocking — the owner must provide

| # | Item | Why DevOps can't self-serve | Status |
|---|---|---|---|
| 1 | **The code, in a GitHub repo** | It currently exists only on the author's laptop: git initialised, **0 commits, no remote**. Nothing to clone, nothing for CI to run against. | ❌ **blocking everything** |
| 2 | **`NGNMARKET_API_KEY`** (`ngm_live_…`) | Tied to BRB's NGN Market account. Not in the repo or any doc — deliberately. | ❌ |
| 3 | **`ANTHROPIC_API_KEY`** (`sk-ant-…`) | Tied to BRB's Anthropic billing account. | ❌ |
| 4 | **The real domain** | Every config ships the placeholder `analyst.brbcapital.example`. Needed before TLS/DNS. | ❌ |
| 5 | **Target AWS account + region** | Which account, and who grants DevOps access to it. | ❌ |
| 6 | **`APP_ENCRYPTION_KEY` escrow decision** | *Who holds it and where* is a security/governance call, not a DevOps one. Generate once (`openssl rand -hex 32`), escrow outside AWS. See the warning in §1. | ❌ |
| 7 | **NGN Market IP allow-listing** | DevOps produces an Elastic IP; someone with NGN dashboard access must allow-list it or all market data 401s. | ⏳ after provisioning |

### Owner decisions DevOps will ask for

- **TLS: option A or B** — nginx + certbot on the instance (manual §8A) *or* ALB
  + ACM (§8B). A is cheaper and simpler; B is better if an ALB is wanted later
  anyway. Either is fine; the app is agnostic as long as
  `X-Forwarded-Proto: https` reaches it.
- **Who gets which staff account** at first-boot hardening (manual §9) — real
  admin / PFM / analyst accounts, and the three seeded `@brb.local` accounts
  deleted afterwards.
- **Backup interval** → defines RPO (manual §12).
- **Who approves releases** — the GitHub `production` Environment reviewers.
- **When the engine goes live** — it ships paused and in human-approval mode.
  A business decision; leave it paused at launch.

### DevOps owns, end to end

Provisioning (manual §3–§4) · secrets plumbing into `/etc/brb/brb.env` or
Secrets Manager (§6) · S3 bucket, GitHub OIDC provider, IAM roles (`docs/CICD.md`
§3) · GitHub secrets/variables + the `production` Environment (§4) · host
bootstrap and first deploy (§5) · TLS (§8) · backups, CloudWatch, alarms, and
the restore drill (§12–§13).

### Getting the code to them

```bash
# from the project root — .gitignore is already verified to exclude every
# .env*, .data/, node_modules/ and .next/
git add -A
git commit -m "BRB NGX Analyst: initial commit with CI/CD pipeline"
gh repo create <org>/brb-ngx-analyst --private --source=. --remote=origin --push
```

Then grant DevOps access, and **either** add the GitHub secret/variables
yourself (`docs/CICD.md` §4) **or** give them repo admin so they can.

> ⚠ Keep the repo **private**. It is internal analytical tooling for a financial
> business, and its history will carry the deployment topology.

---

## 1 · The one constraint that shapes everything

This is a **single long-lived Node process that must run on exactly one
instance**. Three properties in the code force it:

| Property | Where | Consequence |
|---|---|---|
| Embedded PGlite database (Postgres→WASM) stored as files | `src/lib/db/client.ts:13` — `PGLITE_DIR ?? ".data/pg"` | Needs a persistent disk. **Single-writer** — one process may open the directory at a time. |
| In-process schedulers (alert worker + trading scheduler on `setInterval`) | `src/instrumentation.ts` → `lib/alert-worker`, `lib/strategy-worker` | Must be one always-on instance. Incompatible with scale-to-zero or request-scoped compute. |
| In-memory fixed-window rate limiting | `src/lib/rate-limit.ts` | Correct on one node only; N nodes would each keep separate counters. |

**Therefore: no Lambda, no App Runner, no autoscaling, no multi-task ECS, no
blue/green.** Not a preference — the app would be incorrect. The migration path
out (RDS → ElastiCache → extracted workers, in that order) is manual §11. None of
it is needed to go live.

Two production boot fail-safes will refuse to start rather than run insecurely —
both are intentional, do not "fix" them by adding fallbacks:

- `APP_ENCRYPTION_KEY` unset → throws (`src/lib/db/crypto.ts:27`)
- `BRB_SEED_PASSWORD` unset → throws (`src/lib/db/users.ts:135`)

⚠ **`APP_ENCRYPTION_KEY` is the master key for every stored secret.** Generate
once, escrow separately, never rotate in place. A restored data volume is
undecryptable without the exact key that wrote it.

---

## 2 · Verified state (measured on this machine, 2026-08-28)

Local runtime is Node **v26.5.0**; the app is *specified* for Node 20 LTS. It
built and passed every gate on 26, but CI and production are pinned to **20**
via `.nvmrc` — keep them there; treat 26 as unverified for production.

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | **0 errors** |
| Unit tests | `npm test` | **127/127** passed (19 files) |
| Production build | `NODE_ENV=production npm run build` | **clean** |
| Production boot | `npm start` | Ready in 180 ms; both workers logged |
| Health | `curl :PORT/api/health` | **200** `{"ok":true,"status":"healthy"}` |
| Auth | `POST /api/auth/login` → `GET /api/auth/me` | **200**, session persists |
| Functional QA | `node scripts/qa.mjs` | **72 passed / 0 failed / 1 skipped** (AI skipped: `RUN_AI` unset) |
| DAST pentest | `node scripts/pentest.mjs` | **55 secure / 0 vulnerable / 2 info** |

The manual §10 flags a broker-creation SQL bug (12 columns / 12 placeholders in
`src/lib/db/brokers.ts`) present in older builds. It is **fixed in this tree** —
QA's `admin creates broker` and the whole broker loop pass.

### Reproduce locally

`.env.local` was created for local dev (git-ignored, contains a random
`APP_ENCRYPTION_KEY` and `BRB_SEED_PASSWORD=brb-local-dev-pass`). It holds **no
real API keys** — market data and AI features need `NGNMARKET_API_KEY` /
`ANTHROPIC_API_KEY` added there, or entered in Admin → Settings.

```bash
npm ci
npm run dev                                   # http://localhost:3000
# sign in: admin@brb.local / brb-local-dev-pass
```

Full gate run against a production build:

```bash
NODE_ENV=production npm run build
PORT=3010 NODE_ENV=production npm start &
BASE_URL=http://localhost:3010 ADMIN_EMAIL=admin@brb.local \
  ADMIN_PASSWORD='brb-local-dev-pass' node scripts/qa.mjs
BASE_URL=http://localhost:3010 ADMIN_EMAIL=admin@brb.local \
  ADMIN_PASSWORD='brb-local-dev-pass' node scripts/pentest.mjs
```

**PGlite is single-writer.** Stop the dev/prod server before running
`scripts/reset-admin.mjs` or anything else that opens the DB directory, or you
get a directory-locked error (manual §13.1).

---

## 3 · What was added in this session

| File | Purpose |
|---|---|
| `.nvmrc` | Pins Node 20 for CI and the instance |
| `.github/workflows/ci.yml` | All five gates on push/PR; also `workflow_call` so deploy re-runs them |
| `.github/workflows/deploy.yml` | OIDC → S3 → EBS snapshot → SSM → health-verified release, behind a GitHub Environment approval |
| `deploy/deploy.sh` | On-instance release: build beside the live release, atomic symlink swap, health check, **auto-rollback** |
| `deploy/brb-analyst.service` | *Modified* — `WorkingDirectory` now `/opt/brb-analyst/current`; adds `LogsDirectory=brb` + file logging for the CloudWatch agent |
| `docs/CICD.md` | Pipeline design, IAM policies, GitHub secrets/variables, bootstrap sequence |
| `docs/HANDOVER.md` | This file |
| `.env.local` | Local dev only, git-ignored, no real keys |

Everything else — `deploy/nginx-brb-analyst.conf`, `deploy/render-env.sh`,
`deploy/cloudwatch-agent.json`, `.env.production.example`, `scripts/*` — was
already in the repo and is unchanged.

### Where this supersedes the PDF manual

The manual is canonical for topology. Two points are intentionally superseded,
justified in `docs/CICD.md` §2:

1. **§7 path** — releases live in `/opt/brb-analyst/releases/<sha>/` with
   `current` symlinked to the live one, *not* a flat `/opt/brb-analyst` checkout.
   Reason: `next build` overwrites `.next` in place, so an automated build that
   fails midway would leave the running app serving a half-written build. Build
   beside, then swap → failed build is a no-op, rollback is a symlink swap.
2. **§5 code delivery** — the instance downloads a source tarball from S3 rather
   than cloning git. No GitHub deploy key on the box, and the deployed bytes are
   provably the ones that passed the gates.

`docs/aws-go-live-runbook.md` and `docs/deployment-guide.*` are **superseded by
the PDF manual** (its own header says so). Prefer the PDF; prefer `docs/CICD.md`
for the two points above.

---

## 4 · What is NOT done — the remaining work

Nothing in AWS exists yet. In order:

1. **Git repository.** This directory is **not a git repo** (`git rev-parse` fails).
   CI/CD cannot run until the code is in GitHub. `.gitignore` already excludes
   `.env*`, `.data/`, `node_modules/`, `.next/`.
2. **AWS provisioning** — manual §3: EC2 `t3.medium`+ (Ubuntu 22.04), Elastic IP,
   separate gp3 data volume, security group, Route 53. **Root volume ≥ 30 GB**
   (3 releases × ~1 GB of `node_modules`+`.next`; the manual's 20 GB is the
   separate *data* volume).
3. **Pipeline infrastructure** — `docs/CICD.md` §3: S3 release bucket, GitHub OIDC
   provider, deploy role, and the instance-role additions
   (`AmazonSSMManagedInstanceCore` is required or SSM cannot reach the instance).
4. **GitHub config** — `docs/CICD.md` §4: one secret, five variables, and a
   `production` Environment with required reviewers.
5. **Host bootstrap** — manual §4 + §6, then `docs/CICD.md` §5. Install the
   systemd unit **without `--now`**; the first deploy starts it.
6. **First deploy** — run the Deploy workflow and approve it.
7. **TLS** — manual §8, option A (nginx + certbot) or B (ALB + ACM). **Mandatory**:
   the session cookie is `Secure` in production, so without HTTPS *and*
   `X-Forwarded-Proto: https` reaching the app, login silently bounces to
   `/login`. This is the single most common go-live failure.
8. **First-boot hardening** — manual §9: create real staff accounts, delete the
   three seeded `@brb.local` accounts, confirm market data + one AI summary, and
   **leave the engine paused / human-approval** until deliberately enabled.
9. **Backups + monitoring** — manual §12/§13: EBS snapshot schedule, CloudWatch
   agent (`deploy/cloudwatch-agent.json`), alarms, and **run the restore drill
   once before go-live**.
10. **NGN Market allow-list** — add the Elastic IP in the NGN Market dashboard,
    or all market data 401s.

### Unverified by design

The pipeline's YAML parses and `deploy.sh` passes `bash -n`, but **neither has
executed** — no AWS account was touched. First run is a real test: expect to
iterate on IAM permissions. Watch for:

- instance missing from `aws ssm describe-instance-information` → SSM agent or
  instance-role problem, deploy step cannot reach the box
- `npm ci` / build failure inside `deploy.sh` → nothing swapped, app untouched
  (by design); read the SSM stdout in the workflow log or CloudWatch
  `/brb/analyst/deploy`
- unhealthy after swap → `deploy.sh` rolls back automatically and fails the job

---

## 5 · Operational quick reference

```bash
# On the instance
sudo systemctl status brb-analyst
journalctl -u brb-analyst -f                  # expect [alerts] and [engine] worker lines
curl -s localhost:3000/api/health
readlink -f /opt/brb-analyst/current          # which release is live
ls -lt /opt/brb-analyst/releases              # rollback candidates

# Instant rollback (seconds, no rebuild)
sudo ln -sfn /opt/brb-analyst/releases/<old-sha> /opt/brb-analyst/current
sudo systemctl restart brb-analyst

# Locked out of every admin account (stop the service first — single-writer DB)
sudo systemctl stop brb-analyst
sudo -u brb RESET_EMAIL=you@brb.local RESET_PASSWORD='…' RESET_ROLE=admin \
  npm run reset-admin --prefix /opt/brb-analyst/current
sudo systemctl start brb-analyst
```

Log locations: journald (`journalctl -u brb-analyst`), `/var/log/brb/app.log`,
CloudWatch `/brb/analyst/app`, `/brb/analyst/nginx-{access,error}`,
`/brb/analyst/deploy` (SSM deploy output).

---

## 6 · Reference

| Document | Scope |
|---|---|
| `BRB-NGX-Analyst-AWS-Deployment-Manual.pdf` | **Canonical** AWS topology, secrets, TLS, backups, scaling, troubleshooting |
| `docs/CICD.md` | Pipeline, IAM, GitHub config, bootstrap |
| `docs/HANDOVER.md` | This file |
| `.env.production.example` | Every environment variable, annotated |
| `docs/ngnmarket-api.md` | Upstream market-data API |
| `docs/aws-go-live-runbook.md`, `docs/deployment-guide.*` | ⚠ superseded by the PDF manual |

---

_BRB Capital Group — internal engineering document._
