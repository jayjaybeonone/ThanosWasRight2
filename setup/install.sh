#!/usr/bin/env bash
# Deprecated: delegates to the root installer, which also wires the hooks.
exec "$(cd "$(dirname "$0")/.." && pwd)/install.sh" "$@"
