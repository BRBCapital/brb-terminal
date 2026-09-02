# BRB NGX Analyst — CI/CD Pipeline

Companion to **`BRB-NGX-Analyst-AWS-Deployment-Manual.pdf`** (canonical for the AWS
topology). This document covers only what the manual does not: the automated
pipeline, the IAM/GitHub configuration it needs, and the two places it
deliberately supersedes the manual.

---

## 1 · What the pipeline does

```
 push / PR ──► CI (.github/workflows/ci.yml)
               ├── npm ci
               ├── npm run typecheck            0 errors
               ├── npm test                     127/127
               ├── NODE_ENV=production build    clean
               ├── boot the built app on a throwaway PGlite DB
               ├── node scripts/qa.mjs          72 passed / 0 failed
               └── node scripts/pentest.mjs     0 vulnerable
                            │
 tag v* / manual dispatch ──┴──► Deploy (.github/workflows/deploy.yml)
               ├── re-runs every CI gate above
               ├── ⏸ GitHub Environment approval  (required reviewers)
               ├── package source tarball ──► S3
               ├── pre-deploy EBS snapshot of the data volume
               ├── SSM Run Command ──► deploy/deploy.sh on the instance
               │      ├── download the vetted tarball from S3
               │      ├── npm ci + npm run build   into releases/<sha>/
               │      ├── atomic symlink swap      current → releases/<sha>
               │      ├── systemctl restart
               │      └── health check → auto-rollback if unhealthy
               └── verify the public HTTPS health endpoint
```

**CI needs no secrets.** The dynamic gates run against a per-run throwaway
database with per-run random `APP_ENCRYPTION_KEY` / `BRB_SEED_PASSWORD`; the AI
checks self-skip (`RUN_AI` unset) and the market-data checks tolerate an absent
NGN key. Verified locally: 72 passed / 0 failed with no external keys.

**No SSH, no static AWS keys.** GitHub authenticates to AWS through OIDC; the
instance is driven through SSM Run Command. The instance holds no GitHub
credentials — it pulls the exact source that passed the gates from S3 using its
own instance role.

---

## 2 · Two deliberate departures from the manual

| # | Manual says | Pipeline does | Why |
|---|---|---|---|
| 1 | `WorkingDirectory=/opt/brb-analyst`, deploy = `git pull && npm ci && npm run build` in place (§7, §14) | `WorkingDirectory=/opt/brb-analyst/current` → symlink to `releases/<sha>/` | `next build` overwrites `.next` in place. If an automated build fails midway, an in-place layout leaves the running app serving a half-written build with no fast way back. Building the new release *beside* the live one makes a failed build a no-op and makes rollback a symlink swap (seconds, no rebuild). |
| 2 | Instance clones the git repo (§5) | Instance downloads a source tarball from S3 | The instance needs no GitHub deploy key, and the deployed bytes are provably the ones that passed the gates. |

`deploy/brb-analyst.service` in this repo already reflects (1). Nothing else in
the manual changes — same single instance, same PGlite-on-EBS database, same
env-file contract, same `/api/health`.

**The database is untouched by all of this.** `PGLITE_DIR=/var/lib/brb/pg` lives
on the EBS volume, outside every release directory.

---

## 3 · One-time AWS setup

### 3.1 S3 release bucket

Private bucket (block all public access, default encryption on):

```bash
aws s3 mb s3://brb-analyst-releases --region eu-west-1
aws s3api put-public-access-block --bucket brb-analyst-releases \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

Optionally add a lifecycle rule expiring `releases/` after 90 days.

### 3.2 GitHub OIDC provider (once per AWS account)

Provider URL `https://token.actions.githubusercontent.com`, audience
`sts.amazonaws.com`.

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com
```

### 3.3 Deploy role for GitHub Actions

**Trust policy** — scoped to the `production` environment of one repo, so only
the approved deploy job can assume it:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "repo:<ORG>/<REPO>:environment:production"
      }
    }
  }]
}
```

**Permissions policy** — least privilege for exactly what the workflow calls:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublishRelease",
      "Effect": "Allow",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::brb-analyst-releases/releases/*"
    },
    {
      "Sid": "PreDeploySnapshot",
      "Effect": "Allow",
      "Action": ["ec2:CreateSnapshot", "ec2:CreateTags"],
      "Resource": [
        "arn:aws:ec2:<REGION>:<ACCOUNT_ID>:volume/<DATA_VOLUME_ID>",
        "arn:aws:ec2:<REGION>:<ACCOUNT_ID>:snapshot/*"
      ]
    },
    {
      "Sid": "RunDeployCommand",
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": [
        "arn:aws:ec2:<REGION>:<ACCOUNT_ID>:instance/<INSTANCE_ID>",
        "arn:aws:ssm:<REGION>::document/AWS-RunShellScript"
      ]
    },
    {
      "Sid": "ReadCommandResult",
      "Effect": "Allow",
      "Action": ["ssm:GetCommandInvocation", "ssm:ListCommandInvocations"],
      "Resource": "*"
    }
  ]
}
```

> `ssm:GetCommandInvocation` does not support resource-level permissions — `"*"`
> is required by the API, not laxity on our part.

### 3.4 Instance role additions

Add to the EC2 instance role from manual §3:

- **`AmazonSSMManagedInstanceCore`** (AWS managed) — required; without it the
  instance is not an SSM target and the deploy step cannot reach it.
- Inline policy to fetch releases and write deploy logs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::brb-analyst-releases/releases/*"
    },
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:<REGION>:<ACCOUNT_ID>:log-group:/brb/analyst/deploy:*"
    }
  ]
}
```

Keep the manual's existing grants (`secretsmanager:GetSecretValue` if using
§6b, `CloudWatchAgentServerPolicy` if shipping app logs).

Confirm SSM connectivity before the first deploy:

```bash
aws ssm describe-instance-information --query "InstanceInformationList[].InstanceId"
```

The instance ID must appear. If it does not: the SSM agent needs outbound 443
(fine in a public subnet; a private subnet needs VPC endpoints for `ssm`,
`ssmmessages` and `ec2messages`).

---

## 4 · GitHub repository configuration

**Secret** (Settings → Secrets and variables → Actions → Secrets):

| Secret | Value |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::<ACCOUNT_ID>:role/brb-analyst-gha-deploy` |

**Variables** (same page → Variables):

| Variable | Example | Notes |
|---|---|---|
| `AWS_REGION` | `eu-west-1` | |
| `EC2_INSTANCE_ID` | `i-0abc123…` | deploy target |
| `DEPLOY_BUCKET` | `brb-analyst-releases` | |
| `DATA_VOLUME_ID` | `vol-0abc123…` | the **data** volume, not root |
| `PUBLIC_APP_URL` | `https://analyst.brbcapital.example` | optional; enables the external health check |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | — | only if using the signup CAPTCHA (build-time inlined) |

**Environment** (Settings → Environments → **New environment** → `production`):

- Add **required reviewers** — this is the human approval gate before any
  production release.
- Optionally restrict deployment branches to `main` and tags `v*`.

---

## 5 · Bootstrap: the first deploy

The pipeline handles application code, but the host must exist first. Do manual
**§3 (provision), §4 (base host + EBS mount), §6 (secrets)** — then, instead of
manual §5's git clone:

```bash
# Release layout the systemd unit expects
sudo install -d -o brb -g brb /opt/brb-analyst /opt/brb-analyst/releases

# Install the unit but do NOT start it — /opt/brb-analyst/current does not
# exist until the first deploy, and the deploy itself issues the restart.
sudo cp deploy/brb-analyst.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable brb-analyst        # note: no --now

sudo apt -y install awscli jq            # deploy.sh needs the aws CLI
```

Then run the **Deploy to AWS** workflow (Actions → Deploy to AWS → Run workflow
→ type `DEPLOY`). It gates, waits for your approval, ships the release, and
starts the service. Finish with manual §8 (TLS) and §9 (first-boot hardening).

> **Root volume sizing:** each release keeps its own `node_modules` + `.next`
> (~1 GB). `deploy.sh` retains 3 releases, so give the **root** volume ≥ 30 GB.
> The 20 GB figure in the manual is the separate *data* volume.

---

## 6 · Day-to-day

| Task | How |
|---|---|
| Ship to production | Push a `v*` tag, or Actions → Deploy to AWS → type `DEPLOY` → approve |
| Watch a deploy | The workflow run; SSM stdout is echoed into the log and mirrored to CloudWatch `/brb/analyst/deploy` |
| Roll back | Re-run Deploy on the previous tag. Or on the box: `sudo ln -sfn /opt/brb-analyst/releases/<old-sha> /opt/brb-analyst/current && sudo systemctl restart brb-analyst` (seconds — no rebuild) |
| Data rollback | Restore the pre-deploy EBS snapshot (manual §12) |
| See live releases | `ls -lt /opt/brb-analyst/releases && readlink -f /opt/brb-analyst/current` |

Expect a few seconds of downtime per release: one instance, one single-writer
database (manual §14).

---

## 7 · Known limits

- **Serialised deploys.** `concurrency: production-deploy` allows one release at
  a time — correct for a single-writer database, so a queued run waits.
- **Build happens on the instance.** Needs `t3.medium`+ (manual §13.1: `t3.small`
  OOM-stalls the build). Build time dominates the ~5–8 min deploy.
- **No blue/green.** Structural: single instance, single-writer PGlite,
  in-process schedulers. Requires the manual §11 migration (RDS → Redis →
  extracted workers) before a zero-downtime multi-instance tier is possible.
- **`deploy.sh` is fetched from S3 per release**, so the script self-updates with
  the code and never drifts from what the repo says.

---

_BRB Capital Group — internal engineering document. Pipeline: `.github/workflows/`.
On-instance release logic: `deploy/deploy.sh`._
