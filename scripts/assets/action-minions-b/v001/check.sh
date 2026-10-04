#!/usr/bin/env bash
# Fetch one exact GLB from instance 2, then run the three.js adapter inspection and the Chromium preview locally.
# usage: scripts/assets/action-minions-b/v001/check.sh <asset-id>   (from the repo root)
set -euo pipefail
id=$1; here=scripts/assets/action-minions-b/v001; mkdir -p /tmp/mb/insp
python3 -c "import sys;sys.path.insert(0,'$here');from transfer import fetch;fetch('$id/$id.glb','/tmp/mb/insp/$id.glb')"
node_modules/.bin/tsx $here/inspect-three.mjs "$id" /tmp/mb/insp/$id.glb /tmp/mb/insp/$id-three.json
rm -rf /tmp/mb/insp/$id-preview
node $here/preview.mjs "$id" /tmp/mb/insp/$id.glb /tmp/mb/insp/$id-preview
