#!/usr/bin/env bash
# deploy/deploy.sh — on-instance release script for BRB NGX Analyst.
#
# Invoked by the CI/CD pipeline via AWS SSM Run Command (as root). It never
# touches the database: PGLITE_DIR lives on the EBS volume at /var/lib/brb/pg,
# outside every release directory.
#
#   bash deploy.sh s3://BUCKET/releases/<sha>.tar.gz <sha>
#
# Layout (supersedes manual §7's flat WorkingDirectory — see docs/CICD.md):
#   /opt/brb-analyst/releases/<sha>/   one immutable release (code + deps + .next)
#   /opt/brb-analyst/current           symlink → the live release
#
# A release is built BEFORE the symlink moves, so a failed build never disturbs
# the running app. If the new release fails its health check the symlink is
# swapped back and the service restarted on the previous release.
set -euo pipefail

APP_ROOT=/opt/brb-analyst
RELEASES="$APP_ROOT/releases"
CURRENT="$APP_ROOT/current"
ENV_FILE=/etc/brb/brb.env
SERVICE=brb-analyst
APP_USER=brb
KEEP_RELEASES=3
HEALTH_TIMEOUT=90

S3_URI="${1:?usage: deploy.sh <s3-uri> <sha>}"
SHA="${2:?usage: deploy.sh <s3-uri> <sha>}"
TARGET="$RELEASES/$SHA"

log() { echo "[deploy $(date -u +%H:%M:%SZ)] $*"; }
die() { echo "[deploy] FATAL: $*" >&2; exit 1; }

# Port the app listens on (health check must match the service's actual port).
PORT="$(grep -E '^PORT=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"'"'"' ' || true)"
PORT="${PORT:-3000}"
HEALTH_URL="http://127.0.0.1:${PORT}/api/health"

health_ok() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT))
  while (( SECONDS < deadline )); do
    if curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null | grep -q '"ok":true'; then
      return 0
    fi
    sleep 3
  done
  return 1
}

[[ -f "$ENV_FILE" ]] || die "$ENV_FILE missing — provision secrets first (manual §6)"
id "$APP_USER" >/dev/null 2>&1 || die "service user '$APP_USER' does not exist (manual §4)"
command -v aws >/dev/null || die "aws CLI not installed"

# Record what is live now, so we can roll back to exactly that.
PREVIOUS=""
if [[ -L "$CURRENT" ]]; then
  PREVIOUS="$(readlink -f "$CURRENT")"
  log "current release: $PREVIOUS"
else
  log "no current release — this is the first deploy"
fi

if [[ "$PREVIOUS" == "$TARGET" ]]; then
  log "release $SHA is already live; rebuilding in place is not supported — nothing to do"
  exit 0
fi

# ── 1. Fetch + unpack the exact source that passed CI ───────────────────────
log "fetching $S3_URI"
install -d -o "$APP_USER" -g "$APP_USER" "$RELEASES"
rm -rf "$TARGET"; install -d -o "$APP_USER" -g "$APP_USER" "$TARGET"
TARBALL="$(mktemp /tmp/brb-release-XXXXXX.tar.gz)"
aws s3 cp "$S3_URI" "$TARBALL" --only-show-errors || die "could not download $S3_URI"
tar -xzf "$TARBALL" -C "$TARGET"
rm -f "$TARBALL"
chown -R "$APP_USER":"$APP_USER" "$TARGET"

# ── 2. Install + build as the service user (NOT root) ───────────────────────
# The build is sourced from the env file because NEXT_PUBLIC_* values are
# inlined at build time (e.g. the Turnstile site key).
log "npm ci"
runuser -u "$APP_USER" -- bash -lc "cd '$TARGET' && npm ci --no-audit --no-fund" \
  || { rm -rf "$TARGET"; die "npm ci failed — nothing was swapped, app still on $PREVIOUS"; }

log "npm run build"
runuser -u "$APP_USER" -- bash -lc "
  set -a; . '$ENV_FILE'; set +a
  export NODE_ENV=production
  cd '$TARGET' && npm run build
" || { rm -rf "$TARGET"; die "build failed — nothing was swapped, app still on $PREVIOUS"; }

# ── 3. Atomic symlink swap ─────────────────────────────────────────────────
log "activating $SHA"
ln -sfn "$TARGET" "$CURRENT.tmp"
mv -Tf "$CURRENT.tmp" "$CURRENT"

# ── 4. Restart + verify, roll back if unhealthy ────────────────────────────
log "restarting $SERVICE"
systemctl restart "$SERVICE"

if health_ok; then
  log "healthy on $SHA"
else
  log "UNHEALTHY after ${HEALTH_TIMEOUT}s — rolling back"
  journalctl -u "$SERVICE" -n 60 --no-pager || true
  if [[ -n "$PREVIOUS" && -d "$PREVIOUS" ]]; then
    ln -sfn "$PREVIOUS" "$CURRENT.tmp"
    mv -Tf "$CURRENT.tmp" "$CURRENT"
    systemctl restart "$SERVICE"
    if health_ok; then
      die "deploy of $SHA failed; rolled back to $(basename "$PREVIOUS") and it is healthy"
    fi
    die "deploy of $SHA failed AND rollback to $(basename "$PREVIOUS") is unhealthy — MANUAL INTERVENTION REQUIRED"
  fi
  die "deploy of $SHA failed and there is no previous release to roll back to"
fi

# ── 5. Prune old releases (keep the live one + KEEP_RELEASES-1 previous) ────
log "pruning old releases (keeping $KEEP_RELEASES)"
LIVE="$(readlink -f "$CURRENT")"
# shellcheck disable=SC2012
ls -1dt "$RELEASES"/*/ 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) | while read -r old; do
  old="${old%/}"
  [[ "$(readlink -f "$old")" == "$LIVE" ]] && continue
  log "  removing $(basename "$old")"
  rm -rf "$old"
done

log "deploy complete: $SHA"
