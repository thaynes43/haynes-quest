# Rebuild action minions B v001

These are three animated ordinary enemies (`broccoli-bouncer`,
`bin-chicken-flower-thief`, `demon-idol-drummer`) and the static
`storybook-planting-kit` (canopy tree, cypress, flowering shrub), built from the
coordinator's October 4 construction references for DESIGN-029. The work order
was `.agents/work-orders/20261004-opus-action-minions-b.md` in the coordinator's
tree. Claude Code Opus 5.5 (xhigh) authored them on Blender instance 2 only.

## Transport and lease

`transfer.py` is a bounded streamable-HTTP MCP client for
`blender-authoring-2`. It sends `Host: localhost:8000` because the image's
allowlist names only instance 1 (haynes-ops#3209); the TCP destination is still
instance 2. The native `blender` MCP server points at instance 1 and is never
used. `claim.py` claims a released, clean scene and refuses an existing
candidate directory. It records 89 predecessor `.blend`/`.glb` hashes in
`scene-lease.json` and saves `claim-checkpoint.blend`. `run.py` uploads scripts
to `source/` and runs the last one with `runpy`. `release.py` assembles the pack
master from the four separate masters, re-hashes every predecessor, and releases
the lease. It saves the clean `live-scene-release.blend`; Blender cannot append
from the open file, so it first saves an empty `pack-assembly-start.blend`.

## Models

`common.py` holds the shared code: original primitives (ellipsoid, rounded box,
lathe, Catmull-Rom tube, leaf, torus, star) coloured by a per-part flat vertex
colour; two shared vertex-coloured materials per enemy; a rigid one-influence
skin on a rig whose bones all point +Z, so a pose is written in world axes; a
60 fps procedural clip baker with one NLA track per clip; an all-vertex culling
envelope; and an identity-only glTF export. `broccoli.py`, `ibis.py` and
`drummer.py` define each enemy's geometry, bones and five clips. The drummer's
legs and arms are solved with two-bone IK while authoring, so its boots stay
planted and its stick tips land on the drumhead. `kit.py` builds the three props
into one mesh node each, sharing one material, with the base centred on the
ground origin.

```bash
python3 claim.py                                    # only on a released instance; never over an existing candidate
python3 run.py common.py broccoli.py -- stage=full  # likewise ibis.py, drummer.py, kit.py
python3 run_validate.py broccoli-bouncer/broccoli-bouncer.glb
python3 run_validate.py storybook-planting-kit/storybook-cypress.glb --static .85,3.2,.85
python3 run.py common.py release.py
```

`replace=draft` replaces only an undelivered draft of the same work. Never use it
over a delivered or predecessor file; `common.save_master` refuses to overwrite
otherwise.

## Checks (run locally from the repository root after `pnpm install --offline`)

- `check.sh <enemy-id>` fetches the exact GLB from the `/artifacts/` route. It
  runs `inspect-three.mjs` (the GLTFLoader and the real
  `src/game/enemy-animation.ts` adapter, sampling every vertex at 60 Hz) and
  `preview.mjs` (Chromium WebGL stills, a motion contact sheet, a
  gameplay-scale strip and realtime playback).
- `inspect-static.mjs` and `preview-kit.mjs` do the same for the kit.
- `validate.mjs` runs inside the Blender pod with its global Khronos validator.
- `deliver.py` / `deliver_kit.py` copy the verified files into
  `docs/assets/media/<id>/v001/` and `/home/dev/artifacts/haynes-quest/action-worlds/v001/minions-b/`.
  `intake.py` writes `catalog-intake.json` for the coordinator.

`look.py`, `fetch_look.py` and `diag.py` are iteration helpers: quick Cycles
views and per-clip floor-contact diagnosis.
