#!/usr/bin/env bash
# WO111 putty-grunt author loop: rebuild (optional), animate, fetch the exact GLB and records, run the Three.js
# inspection. Adapted from the inator-monster cycle.sh. W must name a scratch work directory.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd); REPO=$(cd "$HERE/../../../.." && pwd)
W=${W:?set W to a work directory}
cd "$HERE"; mkdir -p "$W/source"
if [[ "${1:-}" == "build" ]]; then python3 author_run.py build.py | grep -E '^\{"triangles|RUN FAILED|Error' | cut -c1-400; shift; fi
python3 author_run.py $( [[ -f bounds.json ]] && echo bounds.json ) animate.py | grep -E '^\{"clips|RUN FAILED|Error|assert' | cut -c1-600
python3 -c "
import sys;sys.dont_write_bytecode=True
from transfer import fetch
for f in ['putty-grunt.glb','construction.json','source/rig-rest.json','source/fidelity-samples.json']:fetch(f,'$W/'+f)"
cd "$REPO" && "$REPO/node_modules/.bin/tsx" "$HERE/inspect-three.mjs" "$W" "$@" || true
