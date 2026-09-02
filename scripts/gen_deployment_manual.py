#!/usr/bin/env python3
"""Generate the BRB NGX Analyst — Production Deployment Manual (branded PDF)."""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, ListFlowable, ListItem, KeepTogether,
)

OUT = "docs/BRB-NGX-Analyst-Deployment-Manual.pdf"
VERSION = "v2.0 · July 2026"

# ── Brand palette ─────────────────────────────────────────────────────────
FOREST = colors.HexColor("#052A22")
FOREST_SOFT = colors.HexColor("#1A4D40")
FRESH = colors.HexColor("#8AC873")
INK = colors.HexColor("#1F2A26")
MUTED = colors.HexColor("#5B6B64")
LINE = colors.HexColor("#D9DDD6")
SAND = colors.HexColor("#F6F5F0")
CODE_BG = colors.HexColor("#0E1F18")
CODE_FG = colors.HexColor("#CFE8C6")
AMBER = colors.HexColor("#B8860B")
AMBER_BG = colors.HexColor("#FBF6E9")
LOSS = colors.HexColor("#C0392B")
LOSS_BG = colors.HexColor("#FBECEA")

SERIF, SERIF_B = "Times-Roman", "Times-Bold"
SANS, SANS_B = "Helvetica", "Helvetica-Bold"
MONO = "Courier"

# ── Styles ────────────────────────────────────────────────────────────────
def ps(name, **kw):
    return ParagraphStyle(name, **kw)

st_h1 = ps("h1", fontName=SERIF_B, fontSize=15, textColor=FOREST, spaceBefore=16,
           spaceAfter=4, leading=18)
st_h2 = ps("h2", fontName=SERIF_B, fontSize=11.5, textColor=FOREST_SOFT,
           spaceBefore=11, spaceAfter=3, leading=14)
st_body = ps("body", fontName=SANS, fontSize=9.3, textColor=INK, leading=13.5,
             spaceAfter=5, alignment=TA_LEFT)
st_small = ps("small", fontName=SANS, fontSize=8, textColor=MUTED, leading=11)
st_bullet = ps("bullet", parent=st_body, leftIndent=6, spaceAfter=2)
st_code = ps("code", fontName=MONO, fontSize=7.8, textColor=CODE_FG, leading=11)
st_th = ps("th", fontName=SANS_B, fontSize=7.6, textColor=FOREST, leading=10)
st_td = ps("td", fontName=SANS, fontSize=8.4, textColor=INK, leading=11.5)
st_eyebrow = ps("eyebrow", fontName=SANS_B, fontSize=8, textColor=FOREST_SOFT,
                leading=11, spaceAfter=1)

story = []


# ── Flowable helpers ──────────────────────────────────────────────────────
def h1(txt, num=None):
    label = f"{num} &nbsp; {txt}" if num else txt
    story.append(Paragraph(label, st_h1))
    story.append(HRFlowable(width="100%", thickness=1.4, color=FRESH,
                            spaceBefore=1, spaceAfter=6))


def h2(txt):
    story.append(Paragraph(txt, st_h2))


def body(txt):
    story.append(Paragraph(txt, st_body))


def bullets(items):
    story.append(ListFlowable(
        [ListItem(Paragraph(t, st_bullet), leftIndent=12,
                  value="▸", bulletColor=FRESH) for t in items],
        bulletType="bullet", start="▸", spaceAfter=6, leftIndent=8,
    ))


def code(txt):
    p = Paragraph(txt.replace("\n", "<br/>").replace(" ", "&nbsp;"), st_code)
    t = Table([[p]], colWidths=[165 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CODE_BG),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    story.append(t)
    story.append(Spacer(1, 6))


def callout(txt, tone="fresh"):
    border, bg = FRESH, SAND
    if tone == "warn":
        border, bg = AMBER, AMBER_BG
    elif tone == "crit":
        border, bg = LOSS, LOSS_BG
    p = Paragraph(txt, ps("co", parent=st_body, fontSize=8.7, leading=12.5, spaceAfter=0))
    t = Table([[p]], colWidths=[165 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("LINEBEFORE", (0, 0), (0, -1), 3, border),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(t)
    story.append(Spacer(1, 8))


def table(headers, rows, widths):
    data = [[Paragraph(h, st_th) for h in headers]]
    for r in rows:
        data.append([Paragraph(c, st_td) for c in r])
    t = Table(data, colWidths=widths, repeatRows=1)
    ts = [
        ("BACKGROUND", (0, 0), (-1, 0), SAND),
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, FOREST),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    t.setStyle(TableStyle(ts))
    story.append(t)
    story.append(Spacer(1, 8))


def checklist(items):
    rows = [[Paragraph("☐", ps("cb", fontName=SANS, fontSize=10, textColor=FOREST_SOFT)),
             Paragraph(t, st_td)] for t in items]
    t = Table(rows, colWidths=[8 * mm, 157 * mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t)
    story.append(Spacer(1, 6))


# ── Page furniture ────────────────────────────────────────────────────────
def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(20 * mm, 14 * mm, 190 * mm, 14 * mm)
    canvas.setFont(SANS, 7)
    canvas.setFillColor(MUTED)
    canvas.drawString(20 * mm, 10 * mm,
                      "BRB Capital Group — NGX Analyst Platform · Confidential engineering document")
    canvas.drawRightString(190 * mm, 10 * mm, f"Deployment Manual {VERSION} · p.{doc.page}")
    canvas.restoreState()


# ── Cover ─────────────────────────────────────────────────────────────────
def cover():
    story.append(Spacer(1, 30 * mm))
    mark = Table([[Paragraph('<font color="#8AC873"><b>B</b></font>',
                             ps("m", fontName=SERIF_B, fontSize=22))]],
                 colWidths=[16 * mm], rowHeights=[16 * mm])
    mark.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), FOREST),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    story.append(mark)
    story.append(Spacer(1, 8))
    story.append(Paragraph("BRB CAPITAL GROUP · NGX ANALYST PLATFORM",
                           ps("cev", fontName=SANS_B, fontSize=9, textColor=FOREST_SOFT)))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Production Deployment Manual",
                           ps("ct", fontName=SERIF_B, fontSize=27, textColor=FOREST, leading=30)))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Live-server deployment for the Engineering Department",
                           ps("cs", fontName=SANS, fontSize=12, textColor=MUTED)))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="38%", thickness=2.5, color=FRESH, spaceAfter=8))
    story.append(Paragraph(
        f"Confidential — internal engineering document &nbsp;·&nbsp; {VERSION}<br/>"
        "Next.js 14 · Node 20 · embedded PGlite · single-instance, persistent-disk deployment",
        st_small))
    story.append(PageBreak())


# ═══════════════════════════════════════════════════════════════════════════
cover()

callout(
    "<b>Read first — the defining constraint.</b> This application embeds its database "
    "(<b>PGlite</b>, Postgres compiled to WebAssembly) with on-disk persistence in a local "
    "directory. It is therefore a <b>single-instance</b> application requiring a "
    "<b>persistent writable volume</b> and a <b>long-running Node server</b>. It is NOT "
    "compatible with serverless platforms (Lambda / Fargate-ephemeral), read-only filesystems, "
    "or horizontal autoscaling as-is. To scale out later, migrate the data layer to a managed "
    "Postgres (§10). A single always-on Linux host (VM or VPS) + TLS + a durable volume is the "
    "correct target.", tone="crit")

h1("Architecture at a glance", "1")
bullets([
    "<b>Framework:</b> Next.js 14 (App Router) + React 18 + TypeScript, run as a long-lived Node "
    "server (<font name='Courier'>next start</font>).",
    "<b>Data:</b> PGlite embedded Postgres persisted to a directory (default "
    "<font name='Courier'>.data/pg</font>, override with <font name='Courier'>PGLITE_DIR</font>). "
    "Repositories use plain parameterised SQL.",
    "<b>Market data:</b> all NGN Market API calls are proxied server-side (the API key never "
    "reaches the browser), fronted by an in-memory TTL cache to conserve quota.",
    "<b>AI features:</b> Claude API (Anthropic SDK) powers the daily briefing, filing extraction "
    "and portfolio review. Keys resolve DB-first (encrypted) then environment.",
    "<b>Background worker:</b> an in-process alert evaluator starts via Next's instrumentation "
    "hook (Node runtime only) — another reason a persistent server is required.",
    "<b>Auth:</b> email/password (scrypt), httpOnly cookie sessions, RBAC (analyst &lt; pm &lt; "
    "admin). Edge middleware gates pages; every API route self-guards.",
])

h1("Prerequisites", "2")
table(["Requirement", "Detail"], [
    ["Node.js", "v20 LTS or newer (built &amp; run on Node 20). Includes <font name='Courier'>npm</font>."],
    ["Host", "One always-on Linux VM/VPS (e.g. Ubuntu 22.04) with a persistent disk. ~1 vCPU / "
             "1–2 GB RAM suffices for a single firm; size up for build headroom."],
    ["Reverse proxy", "nginx (or Caddy/Traefik) terminating <b>TLS</b> — mandatory, because the "
                      "session cookie is issued <font name='Courier'>Secure</font> in production."],
    ["Outbound network", "HTTPS egress to <font name='Courier'>api.ngnmarket.com</font>, "
                         "<font name='Courier'>doclib.ngxgroup.com</font> (filing PDFs) and the "
                         "Anthropic API."],
    ["NGN Market key", "A live key (<font name='Courier'>ngm_live_…</font>). The server's egress "
                       "IP may need allow-listing in the NGN Market dashboard."],
], [42 * mm, 123 * mm])

h1("Environment variables", "3")
body("Provide these to the Node process via your process manager or a root-owned env file (never "
     "commit them). <b>Required</b> values must be set before first boot.")
table(["Variable", "Req", "Purpose"], [
    ["<font name='Courier'>NODE_ENV</font>", "Yes", "Set to <font name='Courier'>production</font> — enables Secure cookies + the encryption-key safety check."],
    ["<font name='Courier'>APP_ENCRYPTION_KEY</font>", "Yes", "Strong random secret (<font name='Courier'>openssl rand -hex 32</font>) deriving the AES-256-GCM key that encrypts stored API keys. <b>Must be stable</b> — changing it makes previously saved in-app keys unreadable."],
    ["<font name='Courier'>BRB_SEED_PASSWORD</font>", "Yes", "Password for the three seeded staff accounts on first boot. Strong value; rotate/remove accounts after go-live."],
    ["<font name='Courier'>NGNMARKET_API_KEY</font>", "Yes*", "NGN Market key. *Or enter it (encrypted) in Admin → Settings; set in env for unattended boot."],
    ["<font name='Courier'>ANTHROPIC_API_KEY</font>", "Yes*", "Claude key for AI features. Env keys are used directly (never encrypted) — the robust place for it."],
    ["<font name='Courier'>PGLITE_DIR</font>", "Rec", "Absolute path to the DB directory on the persistent volume, e.g. <font name='Courier'>/var/lib/brb/pg</font>."],
    ["<font name='Courier'>PORT</font>", "Opt", "Server port (default 3000). Bind the reverse proxy to it."],
], [46 * mm, 13 * mm, 106 * mm])
callout("<b>Encryption-key discipline.</b> If <font name='Courier'>APP_ENCRYPTION_KEY</font> is "
        "unset the app derives a key from <font name='Courier'>BRB_SEED_PASSWORD</font> — so "
        "changing the seed password later silently corrupts stored keys (symptom: "
        "<font name='Courier'>could not decrypt …; treating as unset</font> and AI/keys stop). "
        "Set a dedicated <font name='Courier'>APP_ENCRYPTION_KEY</font> once and keep it — and "
        "<font name='Courier'>BRB_SEED_PASSWORD</font> — stable.", tone="warn")

story.append(PageBreak())
h1("Build &amp; run", "4")
h2("Base host + persistent volume")
code("sudo apt update &amp;&amp; sudo apt -y upgrade\n"
     "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -\n"
     "sudo apt -y install nodejs nginx\n"
     "node -v                              # expect v20.x\n\n"
     "# mount the persistent data disk (skip mkfs on an EXISTING volume!)\n"
     "sudo mkfs -t ext4 /dev/nvme1n1        # only on a brand-new volume\n"
     "sudo mkdir -p /var/lib/brb\n"
     "echo '/dev/nvme1n1 /var/lib/brb ext4 defaults,nofail 0 2' | sudo tee -a /etc/fstab\n"
     "sudo mount -a\n"
     "sudo useradd --system --create-home --shell /usr/sbin/nologin brb\n"
     "sudo mkdir -p /var/lib/brb/pg &amp;&amp; sudo chown -R brb:brb /var/lib/brb")
h2("Deploy the application")
code("sudo mkdir -p /opt/brb-analyst &amp;&amp; sudo chown brb:brb /opt/brb-analyst\n"
     "sudo -u brb git clone &lt;repo-url&gt; /opt/brb-analyst    # fresh source only\n"
     "cd /opt/brb-analyst\n"
     "sudo -u brb npm ci\n"
     "sudo -u brb npm run typecheck &amp;&amp; sudo -u brb npm test   # optional gates\n"
     "sudo -u brb npm run build")
callout("Deploy <b>fresh source</b> — never copy a development <font name='Courier'>.data/pg</font> "
        "database or <font name='Courier'>.env.local</font>. The live DB seeds itself on first boot.")
h2("Secrets &amp; environment")
code("sudo mkdir -p /etc/brb\n"
     "sudo cp /opt/brb-analyst/.env.production.example /etc/brb/brb.env\n"
     "sudo nano /etc/brb/brb.env            # fill EVERY required value\n"
     "openssl rand -hex 32                  # -> APP_ENCRYPTION_KEY (set once, never change)\n"
     "openssl rand -base64 24               # -> BRB_SEED_PASSWORD\n"
     "sudo chown root:brb /etc/brb/brb.env &amp;&amp; sudo chmod 640 /etc/brb/brb.env")
h2("Run under systemd")
code("sudo cp /opt/brb-analyst/deploy/brb-analyst.service /etc/systemd/system/\n"
     "sudo systemctl daemon-reload\n"
     "sudo systemctl enable --now brb-analyst\n"
     "journalctl -u brb-analyst -f          # watch for '[alerts] background worker started'\n"
     "curl -s localhost:3000/api/health     # {\"ok\":true,\"status\":\"healthy\",...}")
body("(PM2 is an equally valid supervisor: <font name='Courier'>pm2 start \"npm run start\" "
     "--name brb-analyst</font>.)")

h2("nginx + TLS")
code("sudo cp /opt/brb-analyst/deploy/nginx-brb-analyst.conf /etc/nginx/sites-available/brb-analyst\n"
     "sudo nano /etc/nginx/sites-available/brb-analyst      # set server_name\n"
     "sudo ln -s /etc/nginx/sites-available/brb-analyst /etc/nginx/sites-enabled/\n"
     "sudo rm -f /etc/nginx/sites-enabled/default &amp;&amp; sudo nginx -t\n"
     "sudo apt -y install certbot python3-certbot-nginx\n"
     "sudo certbot --nginx -d analyst.yourfirm.example      # cert + auto-renew\n"
     "sudo systemctl reload nginx")
callout("TLS is <b>mandatory</b>. Without it (and <font name='Courier'>X-Forwarded-Proto=https</font> "
        "from the proxy) the Secure session cookie is dropped and sign-in silently fails.", tone="warn")

story.append(PageBreak())
h1("First-boot hardening", "5")
body("On first start the app creates its schema and seeds three accounts using "
     "<font name='Courier'>BRB_SEED_PASSWORD</font>: <font name='Courier'>analyst@brb.local</font>, "
     "<font name='Courier'>pm@brb.local</font>, <font name='Courier'>admin@brb.local</font>.")
bullets([
    "Sign in over <b>HTTPS</b> as <font name='Courier'>admin@brb.local</font>, go to "
    "<b>Admin → Settings → Users &amp; roles</b>.",
    "Create real staff accounts (Admin, PFM, Analyst) with strong passwords.",
    "Delete the seeded <font name='Courier'>@brb.local</font> accounts (create your real admin "
    "first — the last admin cannot be removed).",
    "Confirm market data loads (NGN key + IP allow-list) and generate one AI briefing (Claude key).",
    "Locked out? Stop the service and run "
    "<font name='Courier'>RESET_EMAIL=… RESET_PASSWORD='…' RESET_ROLE=admin npm run reset-admin</font>, "
    "then restart.",
])

h1("Data persistence &amp; backups", "6")
bullets([
    "All state (users, portfolios, ledgers, AI outputs, encrypted settings) lives in "
    "<font name='Courier'>PGLITE_DIR</font>. <b>This directory is the entire database — back it up.</b>",
    "Mount it on a persistent, snapshotted volume separate from the app code.",
    "Back up by snapshotting the volume (or copying the directory during a quiet window). Restore "
    "by replacing the directory and restarting.",
    "Keep a secure record of <font name='Courier'>APP_ENCRYPTION_KEY</font> — a restored volume is "
    "undecryptable for its stored secrets without the same key.",
])

h1("Security checklist", "7")
bullets([
    "<font name='Courier'>NODE_ENV=production</font> and TLS enforced end-to-end.",
    "<font name='Courier'>APP_ENCRYPTION_KEY</font> strong &amp; stable, from a secrets manager.",
    "Seeded demo accounts removed; <font name='Courier'>BRB_SEED_PASSWORD</font> strong, not reused.",
    "Firewall: inbound 443 (and 80 redirect/ACME) open; 22 from admin ranges only. Egress IP "
    "allow-listed with NGN Market.",
    "Secrets never in the repo, image, or logs; env file root-owned <font name='Courier'>chmod 640</font>.",
    "Every API route self-guards (middleware excludes <font name='Courier'>/api</font>); the NGN "
    "proxy requires a signed-in user and restricts <font name='Courier'>account/*</font> to admins.",
    "Password resets revoke sessions; the last admin cannot be demoted/deleted.",
])

h1("Observability", "8")
bullets([
    "<b>Health check:</b> point the load balancer/monitor at <font name='Courier'>GET /api/health</font> "
    "— 200 when the DB answers, 503 otherwise. Unauthenticated paths are limited to "
    "<font name='Courier'>/api/health</font>, <font name='Courier'>/login</font>, "
    "<font name='Courier'>/brb-logo.png</font> and static assets.",
    "<b>Logs:</b> the Node process logs to stdout/stderr — capture via "
    "<font name='Courier'>journalctl -u brb-analyst</font> (or PM2) and ship to your log stack.",
    "<b>Quota &amp; audit:</b> Admin → Quota &amp; Audit shows NGN Market usage and the analyst "
    "audit trail.",
    "<b>Alert worker:</b> confirm on boot that the instrumentation worker started (logged once).",
])

h1("Upgrades &amp; rollback", "9")
code("# CI: npm run typecheck &amp;&amp; npm test &amp;&amp; npm run build (before promoting)\n"
     "# snapshot the data volume first, then:\n"
     "cd /opt/brb-analyst &amp;&amp; sudo -u brb git pull &amp;&amp; sudo -u brb npm ci &amp;&amp; sudo -u brb npm run build\n"
     "sudo systemctl restart brb-analyst &amp;&amp; curl -s localhost:3000/api/health")
body("Schema changes are additive/idempotent "
     "(<font name='Courier'>CREATE TABLE / ALTER … ADD COLUMN IF NOT EXISTS</font>) and apply on "
     "boot — no manual migration. Roll back by checking out the prior release and, if needed, "
     "restoring the volume snapshot.")

h1("Scaling beyond one instance", "10")
body("When one node is no longer enough, migrate off the embedded DB: stand up a managed Postgres, "
     "repoint the repository layer's <font name='Courier'>query()</font> (in "
     "<font name='Courier'>src/lib/db/client.ts</font>) at a connection pool — the SQL is standard "
     "and backend-agnostic — and export/import the data. The app can then run as multiple stateless "
     "replicas behind a load balancer, with the alert worker moved to a single dedicated instance "
     "to avoid duplicate evaluation.")

story.append(PageBreak())
h1("Troubleshooting", "11")
table(["Symptom", "Likely cause &amp; fix"], [
    ["Server exits on boot with an APP_ENCRYPTION_KEY error",
     "Working as designed — set a strong <font name='Courier'>APP_ENCRYPTION_KEY</font> in production."],
    ["Login succeeds then immediately logs out",
     "TLS not terminated / <font name='Courier'>X-Forwarded-Proto</font> not set → Secure cookie "
     "dropped. Fix proxy headers and serve over HTTPS."],
    ["Dashboard tiles show “API key not configured”",
     "Set <font name='Courier'>NGNMARKET_API_KEY</font> (env) or enter it in Admin → Settings; "
     "confirm the egress IP is allow-listed."],
    ["AI features / a saved key silently stop; logs show <font name='Courier'>could not decrypt</font>",
     "The in-app key was encrypted under a different master key (i.e. "
     "<font name='Courier'>APP_ENCRYPTION_KEY</font>/<font name='Courier'>BRB_SEED_PASSWORD</font> "
     "changed). Restore the original key, re-enter the key in Admin → Settings, or set the plain "
     "env var (env keys aren't encrypted). Keep the key stable thereafter."],
    ["No admin can sign in / seed password unknown",
     "Stop the service and run <font name='Courier'>npm run reset-admin</font> (§5), then restart."],
    ["Data lost after redeploy",
     "DB directory was not on a persistent volume — mount "
     "<font name='Courier'>PGLITE_DIR</font> on durable storage."],
    ["Filing extraction times out",
     "Raise <font name='Courier'>proxy_read_timeout</font> and "
     "<font name='Courier'>client_max_body_size</font> at the proxy."],
], [58 * mm, 107 * mm])

h1("Go-live checklist", "12")
checklist([
    "Persistent volume mounted; <font name='Courier'>PGLITE_DIR</font> points to it",
    "Firewall: 443 open, 80 open (redirect/ACME), 22 admin-IP only; egress IP allow-listed with NGN Market",
    "<font name='Courier'>brb.env</font> complete; <font name='Courier'>APP_ENCRYPTION_KEY</font> "
    "generated &amp; recorded (stable); <font name='Courier'>BRB_SEED_PASSWORD</font> strong; file chmod 640",
    "<font name='Courier'>npm run build</font> succeeded; service enabled and active (running)",
    "<font name='Courier'>curl localhost:3000/api/health</font> → 200",
    "TLS live (certbot); HTTP→HTTPS redirect works; <font name='Courier'>X-Forwarded-Proto</font> set",
    "Signed in over HTTPS (cookie persists); market data + one AI briefing confirmed",
    "Seeded <font name='Courier'>@brb.local</font> accounts removed; real staff created",
    "Volume snapshot schedule enabled; <font name='Courier'>APP_ENCRYPTION_KEY</font> backed up securely",
    "Health check wired to <font name='Courier'>/api/health</font>; logs shipping",
])
story.append(Spacer(1, 4))
story.append(Paragraph(
    "Companion files in the repository: <font name='Courier'>.env.production.example</font>, "
    "<font name='Courier'>deploy/brb-analyst.service</font>, "
    "<font name='Courier'>deploy/nginx-brb-analyst.conf</font>, "
    "<font name='Courier'>docs/aws-go-live-runbook.md</font> (AWS EC2 specifics).", st_small))


# ── Build ─────────────────────────────────────────────────────────────────
doc = BaseDocTemplate(OUT, pagesize=A4,
                      leftMargin=20 * mm, rightMargin=20 * mm,
                      topMargin=18 * mm, bottomMargin=20 * mm,
                      title="BRB NGX Analyst — Production Deployment Manual",
                      author="BRB Capital Group")
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=footer)])
doc.build(story)
print("Wrote", OUT)
