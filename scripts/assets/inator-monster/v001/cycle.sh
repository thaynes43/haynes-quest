#!/usr/bin/env bash
# WO111 inator-monster author loop: rebuild (optional), animate, fetch the exact GLB and records, run the
# Three.js inspection. Adapted from the magic-house cycle.sh. W defaults to a scratch work directory.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd); REPO=$(cd "$HERE/../../../.." && pwd)
W=${W:?set W to a work directory}
cd "$HERE"; mkdir -p "$W/source"
if [[ "${1:-}" == "build" ]]; then python3 author_run.py common.py build.py | grep -E '^\{"triangles|RUN FAILED|Error' | cut -c1-400; shift; fi
python3 author_run.py animate.py | grep -E '^\{"clips|RUN FAILED|Error|assert' | cut -c1-900
python3 -c "
import sys;sys.dont_write_bytecode=True
from transfer import fetch
for f in ['inator-monster.glb','construction.json','source/rig-rest.json']:fetch(f,'$W/'+f)"
"$REPO/node_modules/.bin/tsx" inspect-three.mjs "$W" "$@" || true
