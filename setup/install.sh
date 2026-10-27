#!/usr/bin/env bash
# Installs this collection into ~/.claude (non-destructive: existing files are kept).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${CLAUDE_HOME:-$HOME/.claude}"
mkdir -p "$DEST"/{agents,commands,rules,skills,ecc}
for d in agents commands rules skills; do cp -rn "$ROOT/$d/." "$DEST/$d/" 2>/dev/null || true; done
cp -r "$ROOT"/{scripts,contexts,mcp-configs,examples} "$DEST/ecc/"
echo "Installed to $DEST."
echo "Hooks: merge the \"hooks\" block from setup/settings.hooks.json into $DEST/settings.json"
