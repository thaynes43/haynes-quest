#!/usr/bin/env bash
# WO111 demon-band-idol author loop (helper, not evidence): [build] animate validate fetch inspect preview compare
# usage: cycle.sh <workdir> [build]
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd);REPO=$(cd "$HERE/../../../.." && pwd);W=$1;mkdir -p "$W"
cd "$HERE"
if [[ "${2:-}" == build ]];then python3 author_run.py common.py paint.py rig.py build.py | tail -1 | cut -c1-400;fi
python3 author_run.py rig.py animate.py | grep -E 'RUN FAILED|Error|clips|elapsed' | cut -c1-600
python3 run_validate.py | grep -E 'triangles|EXIT' | cut -c1-300
python3 -c "
import sys;sys.dont_write_bytecode=True
from transfer import fetch
for n in ['demon-band-idol.glb','construction.json']:fetch(n,'$W/'+n)"
cd "$REPO"
node_modules/.bin/tsx "$HERE/inspect-three.mjs" "$W" ${WRITE_BOUNDS:-} | cut -c1-900 || true
node "$HERE/preview.mjs" "$W/demon-band-idol.glb" "$W/preview" ${PREVIEW_MODE:---early} | cut -c1-600 || true
node "$HERE/compare.mjs" /home/dev/artifacts/haynes-quest/family-eras/demon-band-idol/v001/reference-sheet.png "$W/preview" "$W/sheet-vs-export.png" | cut -c1-300
