#!/usr/bin/env bash
# deploy/render-env.sh — render /etc/brb/brb.env from AWS Secrets Manager at boot.
#
# AWS-native alternative to a hand-edited env file: keep the secrets in one
# Secrets Manager secret whose value is a flat JSON object of KEY: "value"
# pairs, and let the instance render them just before the app starts. The EC2
# instance role must allow secretsmanager:GetSecretValue on the secret ARN.
#
# Wire it into systemd as a pre-start step (see deploy/brb-analyst.service):
#   ExecStartPre=/opt/brb-analyst/deploy/render-env.sh
#
# Configure via the service environment (or edit the defaults below):
#   BRB_SECRET_ID   Secrets Manager secret name/ARN   (default: brb/analyst/prod)
#   BRB_ENV_FILE    output path                        (default: /etc/brb/brb.env)
#   AWS_REGION      AWS region                         (default: instance region)
#
# The secret JSON should contain every REQUIRED key from .env.production.example,
# e.g.: {"APP_ENCRYPTION_KEY":"…","BRB_SEED_PASSWORD":"…","NGNMARKET_API_KEY":"…",
#        "ANTHROPIC_API_KEY":"…"}. NODE_ENV / PGLITE_DIR / PORT may live in the
# secret too, or stay as static Environment= lines in the unit file.
set -euo pipefail

SECRET_ID="${BRB_SECRET_ID:-brb/analyst/prod}"
ENV_FILE="${BRB_ENV_FILE:-/etc/brb/brb.env}"
REGION="${AWS_REGION:-$(curl -s --max-time 2 http://169.254.169.254/latest/meta-data/placement/region || echo '')}"

command -v aws >/dev/null || { echo "render-env: aws CLI not installed" >&2; exit 1; }
command -v jq  >/dev/null || { echo "render-env: jq not installed" >&2; exit 1; }

echo "render-env: fetching ${SECRET_ID}${REGION:+ (${REGION})}"
SECRET_JSON="$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ID" ${REGION:+--region "$REGION"} \
  --query SecretString --output text)"

# Validate it is a flat JSON object before writing anything.
echo "$SECRET_JSON" | jq -e 'type == "object"' >/dev/null \
  || { echo "render-env: secret is not a JSON object" >&2; exit 1; }

umask 077
TMP="$(mktemp)"
{
  echo "# Rendered by render-env.sh from Secrets Manager ($SECRET_ID) — do not edit."
  echo "$SECRET_JSON" | jq -r 'to_entries[] | "\(.key)=\(.value)"'
} > "$TMP"

install -o root -g brb -m 640 "$TMP" "$ENV_FILE"
rm -f "$TMP"
echo "render-env: wrote $(grep -c '=' "$ENV_FILE") keys to $ENV_FILE"
