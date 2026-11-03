# Setup

Run `./install.sh` from the repo root. It copies agents, commands, rules and skills into `~/.claude`, copies the hook scripts into `~/.claude/ecc`, and merges the hook wiring into `~/.claude/settings.json` (a `.bak` copy is kept when that file already exists). Requires `node`.

`setup/install.sh` is kept only as a pointer to the root installer. `setup/settings.hooks.json` is no longer needed and is superseded by the merge.
