# Setup

- `install.sh` copies agents, commands, rules and skills into `~/.claude` and the hook scripts/contexts into `~/.claude/ecc`.
- `settings.hooks.json` is the hook wiring (SessionStart, PreCompact, SessionEnd, suggest-compact). Merge its `hooks` block into `~/.claude/settings.json`.
