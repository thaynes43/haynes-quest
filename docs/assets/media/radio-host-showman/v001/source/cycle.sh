#!/usr/bin/env bash
# WO111 radio-host-showman author loop (helper, not evidence): [build] animate validate fetch inspect preview compare
# usage: cycle.sh <workdir> [build]   env: WRITE_BOUNDS=--write-bounds  PREVIEW_MODE=--early|full
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd);REPO=$(cd "$HERE/../../../.." && pwd);W=$1;mkdir -p "$W/source"
cd "$HERE"
if [[ "${2:-}" == build ]];then python3 author_run.py common.py paint.py rig.py build.py | tail -1 | cut -c1-400;fi
python3 author_run.py rig.py $( [[ -f bounds.json ]] && echo bounds.json ) animate.py | grep -E 'RUN FAILED|Error|"clips"|elapsed' | cut -c1-600
python3 run_validate.py | grep -E 'triangles|EXIT' | cut -c1-400
python3 -c "
import sys;sys.dont_write_bytecode=True
from mclient import fetch
for n in ['radio-host-showman.glb','construction.json','source/rig-rest.json']:fetch(n,'$W/'+n)"
cd "$REPO"
node_modules/.bin/tsx "$HERE/inspect-three.mjs" "$W" ${WRITE_BOUNDS:-} | cut -c1-1200 || true
if [[ "${PREVIEW_MODE:---early}" == full ]];then node "$HERE/preview.mjs" "$W/radio-host-showman.glb" "$W/preview" | cut -c1-600 || true
else node "$HERE/preview.mjs" "$W/radio-host-showman.glb" "$W/preview" --early | cut -c1-600 || true;fi
node "$HERE/compare.mjs" /home/dev/artifacts/haynes-quest/family-eras/radio-host-showman/v001/reference-sheet.png "$W/preview" "$W/sheet-vs-export.png" | cut -c1-300
