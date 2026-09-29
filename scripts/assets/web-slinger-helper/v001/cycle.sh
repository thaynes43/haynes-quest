#!/usr/bin/env bash
# WO111 web-slinger-helper author loop (helper, not evidence): [build] animate [bounds] validate audit fetch inspect preview compare
# usage: cycle.sh <workdir> [build] ; PREVIEW_MODE=--early for quick stills; BOUNDS=1 to refresh the stored culling envelope first
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd);REPO=$(cd "$HERE/../../../.." && pwd);W=$1;mkdir -p "$W"
cd "$HERE"
if [[ "${2:-}" == build ]];then python3 author_run.py common.py paint.py rig.py build.py | tail -1 | cut -c1-300;fi
fetchall(){ python3 -c "
import sys;sys.dont_write_bytecode=True
from transfer import fetch
for n in ['web-slinger-helper.glb','construction.json','validation.json','attachment-inspection.json']:
 try:fetch(n,'$W/'+n)
 except Exception as e:print('skip',n,e)"; }
if [[ -n "${BOUNDS:-}" ]];then
 python3 author_run.py rig.py animate.py | grep -E 'RUN FAILED|Error|elapsed' | cut -c1-400
 fetchall;(cd "$REPO" && node_modules/.bin/tsx "$HERE/inspect-three.mjs" "$W" --write-bounds >/dev/null || true)
 python3 author_run.py bounds.json | tail -1
fi
python3 author_run.py rig.py animate.py | grep -E 'RUN FAILED|Error|elapsed' | cut -c1-400
python3 run_validate.py | grep -E 'triangles|EXIT' | cut -c1-300
python3 author_run.py inspect-attachments.py | grep -oE '"checks": \{[^}]*\}' | cut -c1-600
fetchall
cd "$REPO"
node_modules/.bin/tsx "$HERE/inspect-three.mjs" "$W" | cut -c1-600 || true
node "$HERE/preview.mjs" "$W/web-slinger-helper.glb" "$W/preview" ${PREVIEW_MODE:-} | cut -c1-600 || true
node "$HERE/compare.mjs" /home/dev/artifacts/haynes-quest/family-eras/web-slinger-helper/v001/reference-sheet.png "$W/preview" "$W/sheet-vs-export.png" | cut -c1-300
