#!/usr/bin/env bash
# Deploys The Wig Atelier & Vault to Fly.io from your own computer.
#
# Usage:
#   ./scripts/deploy-fly.sh                       # deploy with defaults
#   APP=my-app REGION=ord ./scripts/deploy-fly.sh # choose app name and region
#
# Optional, for confirmation emails:
#   RESEND_API_KEY=re_xxx EMAIL_FROM="The Wig Atelier <bookings@yourdomain.com>" ./scripts/deploy-fly.sh
#
# Safe to run again. It only creates the app, volume, and owner token when they're missing.
set -euo pipefail

APP="${APP:-wig-atelier-vault}"
REGION="${REGION:-iad}"
VOLUME="atelier_data"
TOKEN_FILE="${TOKEN_FILE:-$HOME/.config/wig-atelier/owner-token}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

say() { printf '\n==> %s\n' "$*"; }
die() { printf '\nError: %s\n' "$*" >&2; exit 1; }

# 1. flyctl must be installed.
if ! command -v flyctl >/dev/null 2>&1 && [ -x "$HOME/.fly/bin/flyctl" ]; then
  export PATH="$HOME/.fly/bin:$PATH"
fi
if ! command -v flyctl >/dev/null 2>&1; then
  say "flyctl is not installed. Installing it now."
  curl -fsSL https://fly.io/install.sh | sh
  export PATH="$HOME/.fly/bin:$PATH"
  command -v flyctl >/dev/null 2>&1 || die "flyctl install failed. See https://fly.io/docs/flyctl/install/"
fi
echo "flyctl $(flyctl version | head -1)"

# 2. You must be signed in.
if ! flyctl auth whoami >/dev/null 2>&1; then
  say "Signing in to Fly.io. Your browser will open."
  flyctl auth login
fi
echo "Signed in as $(flyctl auth whoami)"

# 3. Create the app if it doesn't exist.
if flyctl apps list --json | grep -q "\"Name\": *\"$APP\""; then
  echo "App '$APP' already exists."
else
  say "Creating app '$APP' in $REGION."
  flyctl launch --no-deploy --copy-config --yes --name "$APP" --region "$REGION"
fi

# 4. Create the database volume if it doesn't exist.
if flyctl volumes list --app "$APP" --json | grep -q "\"name\": *\"$VOLUME\""; then
  echo "Volume '$VOLUME' already exists."
else
  say "Creating the 1 GB database volume."
  flyctl volumes create "$VOLUME" --size 1 --region "$REGION" --app "$APP" --yes
fi

# 5. Owner token: create once, keep the same one on later runs.
mkdir -p "$(dirname "$TOKEN_FILE")"
if [ ! -s "$TOKEN_FILE" ]; then
  say "Creating a new owner token at $TOKEN_FILE"
  (umask 077 && openssl rand -hex 32 > "$TOKEN_FILE")
fi
flyctl secrets set ADMIN_TOKEN="$(cat "$TOKEN_FILE")" --app "$APP" --stage >/dev/null

# 6. Optional email settings, passed through only when you set them.
if [ -n "${RESEND_API_KEY:-}" ] && [ -n "${EMAIL_FROM:-}" ]; then
  flyctl secrets set RESEND_API_KEY="$RESEND_API_KEY" EMAIL_FROM="$EMAIL_FROM" --app "$APP" --stage >/dev/null
  echo "Email settings staged."
fi

# 7. Deploy.
say "Building and deploying. This takes a few minutes the first time."
flyctl deploy --app "$APP" --ha=false --remote-only

say "Done."
echo "Site:       https://$APP.fly.dev"
echo "Dashboard:  https://$APP.fly.dev/owner"
echo "Owner token is saved at: $TOKEN_FILE (keep it private)"
