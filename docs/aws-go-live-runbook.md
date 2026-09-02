# BRB NGX Analyst — AWS Go-Live Runbook (EC2 + EBS)

Deploy target: **single EC2 instance (Ubuntu 22.04) + EBS volume + systemd + nginx/TLS.**
This matches the app's architecture — an embedded PGlite database on a persistent disk,
run as one long-lived Node process. **Do not** run it on Lambda/Fargate-ephemeral/autoscaled
tiers (see the constraint in `docs/deployment-guide.html`). To scale beyond one box later,
migrate to managed Postgres (guide §11).

> You run every step below on your AWS account/host. Files referenced live in this repo:
> `.env.production.example`, `deploy/brb-analyst.service`, `deploy/nginx-brb-analyst.conf`.

---

## 0 · Provision (AWS console / CLI)

- **EC2**: `t3.small` (2 GB RAM) or larger, Ubuntu 22.04 LTS, in a public subnet.
- **Elastic IP**: allocate + associate — gives a **stable egress IP** to allow-list with NGN Market, and a stable inbound IP for DNS.
- **EBS data volume**: create a separate gp3 volume (e.g. 20 GB), attach it (e.g. `/dev/sdf`) — this holds the database and is snapshotted for backups. Keep it separate from the root volume.
- **Security group** (least privilege):
  - `443/tcp` from `0.0.0.0/0` (HTTPS)
  - `80/tcp` from `0.0.0.0/0` (HTTP→HTTPS redirect + certbot ACME)
  - `22/tcp` from **your admin IP only**
- **DNS**: point `analyst.brbcapital.example` (A record) at the Elastic IP.
- **NGN Market dashboard**: allow-list the Elastic IP for the API key.

## 1 · Base host + persistent volume

```bash
sudo apt update && sudo apt -y upgrade
# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt -y install nodejs nginx
node -v   # expect v20.x

# Format + mount the EBS data volume (ONCE — skip mkfs on an existing volume!)
lsblk                                   # find the device, e.g. nvme1n1
sudo mkfs -t ext4 /dev/nvme1n1          # ⚠ only on a brand-new volume
sudo mkdir -p /var/lib/brb
echo '/dev/nvme1n1 /var/lib/brb ext4 defaults,nofail 0 2' | sudo tee -a /etc/fstab
sudo mount -a

# Service user that owns the app + data
sudo useradd --system --create-home --shell /usr/sbin/nologin brb
sudo mkdir -p /var/lib/brb/pg && sudo chown -R brb:brb /var/lib/brb
```

## 2 · Deploy the application

```bash
sudo mkdir -p /opt/brb-analyst && sudo chown brb:brb /opt/brb-analyst
sudo -u brb git clone <your-repo-url> /opt/brb-analyst   # or rsync the source (NOT .data/ or .env.local)
cd /opt/brb-analyst
sudo -u brb npm ci

# Quality gates (optional but recommended on the box)
sudo -u brb npm run typecheck && sudo -u brb npm test

# Production build
sudo -u brb npm run build
```

> Deploy **fresh source** — never copy your dev `.data/pg` or `.env.local`. The live DB seeds itself on first boot.

## 3 · Secrets & environment

```bash
sudo mkdir -p /etc/brb
sudo cp /opt/brb-analyst/.env.production.example /etc/brb/brb.env
sudo nano /etc/brb/brb.env      # fill EVERY required value

# Generate the stable encryption key + a strong seed password:
openssl rand -hex 32            # -> APP_ENCRYPTION_KEY  (set once, NEVER change)
openssl rand -base64 24         # -> BRB_SEED_PASSWORD

sudo chown root:brb /etc/brb/brb.env && sudo chmod 640 /etc/brb/brb.env
```

Required in `brb.env`: `NODE_ENV=production`, `APP_ENCRYPTION_KEY`, `BRB_SEED_PASSWORD`,
`NGNMARKET_API_KEY`, `ANTHROPIC_API_KEY`, `PGLITE_DIR=/var/lib/brb/pg`.

> **AWS-native alternative:** store these in SSM Parameter Store / Secrets Manager and render
> `brb.env` at boot (e.g. a small `ExecStartPre` script), instead of a plaintext file.

## 4 · Run under systemd

```bash
sudo cp /opt/brb-analyst/deploy/brb-analyst.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now brb-analyst
sudo systemctl status brb-analyst
journalctl -u brb-analyst -f            # watch for "[alerts] background worker started"

# Local smoke test (before TLS):
curl -s localhost:3000/api/health        # {"ok":true,"status":"healthy",...}
```

## 5 · nginx + TLS

```bash
sudo cp /opt/brb-analyst/deploy/nginx-brb-analyst.conf /etc/nginx/sites-available/brb-analyst
# edit server_name to your domain:
sudo nano /etc/nginx/sites-available/brb-analyst
sudo ln -s /etc/nginx/sites-available/brb-analyst /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t

sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d analyst.brbcapital.example   # issues cert + enables auto-renew
sudo systemctl reload nginx
```

TLS is **mandatory** — without it (and `X-Forwarded-Proto=https`) the Secure session cookie
is dropped and login silently fails.

## 6 · First-boot hardening (in the app)

1. Browse to `https://analyst.brbcapital.example` → sign in as `admin@brb.local` with `BRB_SEED_PASSWORD`.
2. **Admin → Settings → Users & roles**: create real staff accounts (Admin, PFM, Analyst) with strong passwords.
3. Delete the seeded `analyst@brb.local` / `pm@brb.local` / `admin@brb.local` (create your real admin first — the last admin can't be removed).
4. Confirm market data loads (NGN key + IP allow-list) and generate one AI summary (Claude key).
5. Locked out? Stop the service and run `RESET_EMAIL=… RESET_PASSWORD='…' RESET_ROLE=admin npm run reset-admin`, then restart (guide §6).

## 7 · Backups & monitoring

- **Backups:** enable scheduled **EBS snapshots** (AWS Backup / DLM) of the data volume. The entire DB is `PGLITE_DIR`. Also keep `APP_ENCRYPTION_KEY` in a safe place — a restored volume is undecryptable without it.
- **Health check:** target group / uptime monitor → `GET /api/health` (200 healthy, 503 if the DB is down). Only `/api/health`, `/login`, `/brb-logo.png` and static assets are unauthenticated.
- **Logs:** `journalctl -u brb-analyst` (ship to CloudWatch via the agent if desired).
- **Quota/audit:** Admin → Quota & Audit shows NGN Market usage + the analyst audit trail.

## 8 · Upgrades & rollback

```bash
# In CI: npm run typecheck && npm test && npm run build (before promoting)
aws ec2 create-snapshot --volume-id vol-XXXX --description "pre-deploy"   # snapshot first
cd /opt/brb-analyst && sudo -u brb git pull && sudo -u brb npm ci && sudo -u brb npm run build
sudo systemctl restart brb-analyst
curl -s localhost:3000/api/health
```
Schema changes are additive/idempotent (`CREATE TABLE / ALTER … ADD COLUMN IF NOT EXISTS`) and apply on boot — no manual migration. Roll back by checking out the prior release and (if needed) restoring the volume snapshot.

---

## ✅ Go-live checklist

- [ ] Elastic IP allocated + associated; DNS A record points to it
- [ ] EBS data volume mounted at `/var/lib/brb`; `PGLITE_DIR=/var/lib/brb/pg`
- [ ] Security group: 443 open, 80 open (redirect/ACME), 22 admin-IP only
- [ ] `brb.env` complete; `APP_ENCRYPTION_KEY` generated & recorded (stable), `BRB_SEED_PASSWORD` strong; file `chmod 640` root:brb
- [ ] `npm run build` succeeded; service enabled and `active (running)`
- [ ] `curl localhost:3000/api/health` → 200
- [ ] TLS live (certbot); HTTP→HTTPS redirect works; `X-Forwarded-Proto` set
- [ ] Signed in over HTTPS (cookie persists); market data + one AI summary confirmed
- [ ] NGN Market: Elastic IP allow-listed
- [ ] Seeded `@brb.local` accounts removed; real staff created
- [ ] EBS snapshot schedule enabled; `APP_ENCRYPTION_KEY` backed up securely
- [ ] Health check wired to `/api/health`; logs shipping

---
_BRB Capital Group — internal engineering document. Pair with `docs/deployment-guide.html` (env vars, security posture, troubleshooting)._
