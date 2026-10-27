#!/usr/bin/env bash
# Installs this collection into ~/.claude (agents, commands, rules, skills, scripts, contexts)
# and wires the lifecycle hooks into ~/.claude/settings.json. Existing files are never overwritten.
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="${CLAUDE_HOME:-$HOME/.claude}"
mkdir -p "$DEST"/{agents,commands,rules,skills,ecc}
for d in agents commands rules skills; do cp -rn "$SRC/$d/." "$DEST/$d/" 2>/dev/null || true; done
cp -r "$SRC/scripts" "$SRC/contexts" "$SRC/mcp-configs" "$SRC/examples" "$DEST/ecc/"
python3 - "$SRC/hooks/hooks.json" "$DEST" <<'PY'
import json, os, sys
src, dest = sys.argv[1], sys.argv[2]
root = os.path.join(dest, "ecc")
hooks = json.load(open(src))["hooks"]
out = {}
for event, entries in hooks.items():
    for e in entries:
        cmd = e["hooks"][0]["command"]
        if "CLAUDE_PLUGIN_ROOT" not in cmd:
            continue  # inline hooks depend on plugin-style matchers; skipped
        m = e["matcher"]
        if "Edit" in m and "Write" in m:
            m = "Edit|Write"
        out.setdefault(event, []).append({"matcher": m, "hooks": [{"type": "command", "command": cmd.replace("${CLAUDE_PLUGIN_ROOT}", root)}]})
p = os.path.join(dest, "settings.json")
s = json.load(open(p)) if os.path.exists(p) else {}
s["hooks"] = out
json.dump(s, open(p, "w"), indent=2)
PY
echo "Installed to $DEST"
