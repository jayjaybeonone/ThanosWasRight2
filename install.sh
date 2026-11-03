#!/usr/bin/env bash
# Installs this collection into ~/.claude (agents, commands, rules, skills, ecc/ scripts)
# and merges the lifecycle hooks into ~/.claude/settings.json.
# Safe to re-run: existing files are never overwritten, and only hook entries that
# point into ~/.claude/ecc are replaced. Other hooks and settings are preserved.
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="${CLAUDE_HOME:-$HOME/.claude}"
command -v node >/dev/null || { echo "node is required for the hook scripts" >&2; exit 1; }
mkdir -p "$DEST"/{agents,commands,rules,skills,ecc}
for d in agents commands rules skills; do cp -rn "$SRC/$d/." "$DEST/$d/" 2>/dev/null || true; done
cp -r "$SRC/scripts" "$SRC/contexts" "$SRC/mcp-configs" "$SRC/examples" "$DEST/ecc/"
python3 - "$SRC/hooks/hooks.json" "$DEST" <<'PY'
import json, os, shutil, sys
src, dest = sys.argv[1], sys.argv[2]
root = os.path.join(dest, "ecc")
hooks = json.load(open(src))["hooks"]
ours = {}
for event, entries in hooks.items():
    for e in entries:
        cmd = e["hooks"][0]["command"]
        if "CLAUDE_PLUGIN_ROOT" not in cmd:
            continue  # inline checks use plugin-only matchers; not portable to settings.json
        m = e["matcher"]
        if "Edit" in m and "Write" in m:
            m = "Edit|Write"
        ours.setdefault(event, []).append({"matcher": m, "hooks": [{"type": "command", "command": cmd.replace("${CLAUDE_PLUGIN_ROOT}", root)}]})
p = os.path.join(dest, "settings.json")
s = {}
if os.path.exists(p):
    shutil.copy2(p, p + ".bak")
    s = json.load(open(p))
existing = s.setdefault("hooks", {})
for event in set(existing) | set(ours):
    kept = [e for e in existing.get(event, [])
            if not any(root in h.get("command", "") for h in e.get("hooks", []))]
    merged = kept + ours.get(event, [])
    if merged:
        existing[event] = merged
    else:
        existing.pop(event, None)
json.dump(s, open(p, "w"), indent=2)
print("Hooks merged into", p, "(" + str(sum(len(v) for v in ours.values())) + " entries from this repo)")
PY
echo "Installed to $DEST"
