#!/usr/bin/env bash
# WO111 magic-house author loop: rebuild (optional), animate, fetch the exact GLB, inspect, preview.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd); W=${W:-/home/dev/artifacts/haynes-quest/family-eras/magic-house/v001/work}; REPO=$(cd "$HERE/../../../.." && pwd)
cd "$HERE"
if [[ "${1:-}" == "build" ]]; then python3 transfer.py run common.py build.py | tail -2; shift; fi
python3 transfer.py run animate.py | tail -1
python3 transfer.py fetch magic-house.glb "$W/magic-house.glb" construction.json "$W/construction.json" >/dev/null
"$REPO/node_modules/.bin/tsx" inspect-three.mjs "$W" "$@" || true
