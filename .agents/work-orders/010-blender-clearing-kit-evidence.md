# WO-010 clearing kit authoring evidence

- **Author:** fresh native `gpt-6-astra`, `max`; no modeling delegation.
- **Worktree / branch:** `/home/dev/work/quest-blender-clearing`, `agent/quest-blender-clearing`, from `2308cb0`.
- **Status:** Seven complete first-pass candidates delivered; coordinator integration and Tom exact-version approval remain separate.
- **Scene lease:** **RELEASED at 2026-09-11T05:33:31.020855+00:00.** Live scene is the saved exact arrival-landmark GLB re-import. No rendering or authoring remains active.
- **Durable artifact root:** `/workspace/haynes-quest/clearing-kit/v001` on the dedicated authoring PVC; HTTP GET through `http://blender-authoring.dev.svc.cluster.local:8000/artifacts/haynes-quest/clearing-kit/v001/`.

## Inventory

| Model | Triangles | Materials | GLB bytes | Editable master bytes |
| --- | ---: | ---: | ---: | ---: |
| `memory-keepsake` | 1,741 | 3 | 116,304 | 209,594 |
| `ground-tile` | 702 | 2 | 50,724 | 189,932 |
| `path-tile` | 392 | 2 | 30,084 | 185,406 |
| `low-step` | 188 | 2 | 15,968 | 182,356 |
| `clearing-tree` | 2,840 | 2 | 71,316 | 218,629 |
| `clearing-stone` | 348 | 1 | 41,284 | 187,725 |
| `arrival-landmark` | 1,880 | 4 | 118,348 | 203,825 |

The seven GLBs total **444,028 bytes**. All meet WO-010 dimensions, material counts, triangle and file budgets. `scripts/assets/blender/clearing-kit-v001/delivery-manifest.json` contains exact SHA-256, bytes, artifact IDs, remote URLs and repository paths for every delivered stream, including the seven `.blend` masters, kit review master and final live-scene snapshot. Manifest SHA-256: `95a477b3f55e47c8d300ab03257117fbfe21236483fe16c91c2d84d4acf7353a`.

Standalone catalog media uses `beauty.png`, `front.png`, `side.png`, `back.png`, `top.png`, `scale.png`, `turntable.png` beside its named GLB. The three path-kit pieces prefix each corresponding view/check with `ground-tile-`, `path-tile-` or `low-step-`. Each catalog has `manifest.json`. Tree and stone add `reuse.png`; the path catalog includes `tile-joins.png`, `tile-joins.json` and `kit-beauty.png`. Every turntable is a six-angle compact PNG sheet, left to right across the top row then bottom row, at 0/60/120/180/240/300 degrees. No audio or autoplay is included.

## Construction and validation

Inspected all five actual concept PNGs and both shared reference PNGs before modeling, then compared the traveler render to the shared materials. Exact concept/prompt hashes are retained in `source-concepts.json`. All geometry and vertex-color materials are original script-authored content; no downloaded models, generated textures, private photos or family references were used.

Blender uses Z-up meters with front +Y; glTF export converts to Y-up with front -Z. All geometry is at its centered footprint and ground zero. Editable masters preserve named construction parts and the complete construction script as a text block. Export combines static shells into one mesh per asset, with one additional dedicated `PhotoSurface` for the keepsake. Each requires only 1–4 material primitives, no texture fetch or required compression extension.

`PhotoSurface` is a single flat mesh/material with continuous UVs and front-readable U orientation. The fictional amber tree is a planar geometric vertex-color illustration. A replacement photo material uses `TEXCOORD_0` and ignores `COLOR_0`; there are no separate illustration overlays to remove. Three.js verifies the replacement assignment and UV direction.

All seven exact GLBs pass Khronos glTF Validator with **zero errors and warnings**. The keepsake has one expected informational `UNUSED_OBJECT` for its reserved UV attribute because the candidate has no image texture; the others have zero infos/hints. `validation.json` records exact dimensions, bounds, triangles, material properties, bytes/hash, closed source shells, stable flat ground support, resource and extension checks. `reimport.json` records Blender 4.5.13 LTS inspection of the actual exports. Every delivered model view is from a GLB re-import.

Three.js `0.186.0` / GLTFLoader CPU checks passed for all seven models. Four instances of each ground/path tile form a 4×4 m footprint. Each grid passed 164 downward seam samples with zero misses. Path joints retain a closed supporting bed; sampled seam surfaces range from 0.067 m to about 0.074 m within the 0.08 m piece. Gateway rays measured a minimum 1.5999999 m clear width across 65 heights from 0.005 to 1.60 m, with no blocking floor. All exact exports have nonzero planar ground support; the stone has 0.320786 m². These are CPU geometry checks, not browser, WebGL or physical Safari performance evidence.

## Creator inspection and limits

`inspection-history.json` records preserved `shape-a`, `shape-b` and `shape-c` artifacts, GLB hashes, findings and corrections. Exact views caught inset edge gaps, horizontal stone bands, timber crossing a stone-foot course, paver edge overlap, a detached keepsake wedge, raised front feet, mirrored photo UVs, a stone underside dip and review-label orientation/framing. Those were corrected and the affected exact exports re-imported/rendered again. Final front/side/back/beauty views, compact turns, scale references, reuse, tile joins and kit coherence were inspected.

These candidates intentionally simplify the illustrated fine grain, individual leaves and painterly texture to broad matte colors, smooth cushions, faceted walnut and plain stone courses. Ground-tile color repetition remains visible in the join view. No additional biome, character, texture, gameplay integration or owner approval is included.

## Collection and reproduction

Collection streamed and verified **107 remote artifacts**, including **nine `.blend` files**, saved 98 artifact files and decoded six independently hashed source files. A second local pass checked all 104 saved/decoded files against their manifest hashes. The artifact route does not serve raw source extensions; `source-bundle.json` provides their exact bytes in the supported JSON format. `collect.py` writes atomically after verification. No service or dev-env restart occurred.

`scripts/docs/build.sh` passed using the shared docs virtual environment: 240 static files prepared, 57 Markdown files and their local media references checked, and the strict MkDocs build completed. Browser delivery checks remain with the coordinator after integration.

Source directory: `scripts/assets/blender/clearing-kit-v001/`. Rebuild only with a new exclusive scene lease. The service-side commands for an isolated background process are:

```sh
blender -b --factory-startup --python /workspace/haynes-quest/clearing-kit/v001/build.py
NODE_PATH=/usr/local/lib/node_modules node /workspace/haynes-quest/clearing-kit/v001/validate.mjs /workspace/haynes-quest/clearing-kit/v001
blender -b --factory-startup --python /workspace/haynes-quest/clearing-kit/v001/render.py
```

Never factory-reset the live MCP Blender instance. Upload source/provenance bytes explicitly: repository paths are not mounted in the authoring service. Run `inspect-three.mjs` against the exact GLBs using the repository's Three.js package, transfer its JSON checks to the remote model folders, then run `delivery.py`. From the task worktree, `python3 scripts/assets/blender/clearing-kit-v001/collect.py` retrieves the scoped artifacts and verifies masters without committing their binaries. Root owns pages, browser delivery checks, PR/merge and final review state.
