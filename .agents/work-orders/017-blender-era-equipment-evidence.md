# WO-017 equipment authoring evidence

- Author: fresh native `gpt-6-astra`, `max`; worktree `quest-era-equipment-models`, branch `agent/quest-era-equipment-models`, starting at `abee156`.
- Scope: four rigid equipment candidates from the two lead-selected concept sheets. No concept, prompt, provenance, review-page, application, traveler, or deployment files were changed.
- Scene lease: granted by the lead after WO-016 release; explicitly released **2026-09-11 15:08:52 UTC**. [Release record](../../scripts/assets/era-equipment/scene-release.json).
- Completion: all four candidates, source masters, exact-export review masters, stills, browser captures, validation and attachment measurements are delivered. The final isolated render process exited 0 and was reaped; the initial quick process was already reaped. [Job completion](../../scripts/assets/era-equipment/render-job-completion.json).
- Review boundary: lead Astra inspected the final 900px Ribbon Shield and Prism Wand beauties, the corrected final mallet wrap and both shield backs, then **selected all four exact candidates for catalog/intake** on 2026-09-11. No further geometry revision was requested. Exact-version owner approval remains pending; no gameplay promotion or deployment is claimed.

## Exact delivered candidates

The [kit manifest](../../docs/assets/media/era-equipment/v001/manifest.json) records complete SHA256s, all files, source references, physical bounds, grip transforms and nine remotely retained `.blend` files. Each item has a 900 × 900 Blender beauty/front/side/back set and an 800 × 800 Three.js browser set. Both shields also have an oblique rear-grip view.

| Asset | Height | Triangles | Materials / model primitives | GLB bytes | Final views |
| --- | --- | --- | --- | --- | --- |
| [Spark Mallet](../../docs/assets/media/era-equipment/v001/spark-mallet/spark-mallet.glb) | 0.55 m | 3,728 | 4 / 4 | 161,872 | [Beauty](../../docs/assets/media/era-equipment/v001/spark-mallet/beauty.png), [back](../../docs/assets/media/era-equipment/v001/spark-mallet/back.png) |
| [Acorn Shield](../../docs/assets/media/era-equipment/v001/acorn-shield/acorn-shield.glb) | 0.40 m | 3,624 | 4 / 4 | 184,460 | [Beauty](../../docs/assets/media/era-equipment/v001/acorn-shield/beauty.png), [back](../../docs/assets/media/era-equipment/v001/acorn-shield/back.png), [rear grip](../../docs/assets/media/era-equipment/v001/acorn-shield/rear-grip.png) |
| [Prism Wand](../../docs/assets/media/era-equipment/v001/prism-wand/prism-wand.glb) | 0.65 m | 2,076 | 5 / 5 | 143,444 | [Beauty](../../docs/assets/media/era-equipment/v001/prism-wand/beauty.png), [side](../../docs/assets/media/era-equipment/v001/prism-wand/side.png) |
| [Ribbon Shield](../../docs/assets/media/era-equipment/v001/ribbon-shield/ribbon-shield.glb) | 0.48 m | 4,128 | 4 / 4 | 197,244 | [Front](../../docs/assets/media/era-equipment/v001/ribbon-shield/front.png), [back](../../docs/assets/media/era-equipment/v001/ribbon-shield/back.png), [rear grip](../../docs/assets/media/era-equipment/v001/ribbon-shield/rear-grip.png) |

All four fit the work order's 5,000-triangle, five-material and 1 MiB limits without exceptions. Static parts are joined for export while the source masters retain named editable parts. Shared 512px directional pigment maps are generated from original deterministic fields, packed into the masters and embedded as ordinary JPEG images in each GLB. No texture URL, mesh service, decoder, family photograph or third-party model is required. The rigid props have no skeleton or clips; player motion supplies their animation.

The first mallet's shaft intersected the upper grip wrapping; its internal shaft was narrowed beneath the existing wrap. The ribbon shield's diagonal bands initially extended beyond the rim; their endpoints were trimmed beneath the frame. A redundant UV layer on the rounded shield anchors was removed. Initial exports and source files remain under `haynes-quest/era-equipment/v001/checkpoints/initial-export/` on the authoring PVC.

## Physical attachments

Exports use meters, +Y up and forward -Z. Every complete prop is centered at its physical hand-grip origin `[0, 0, 0]`. The shield boards face -Z; their open forearm straps, distinct hand grips and fixed mounts are behind the board toward +Z. Geometry, rather than a texture, supplies every rear attachment.

| Asset | Grip axis | Measured diameter at origin | Upright ground-display translation |
| --- | --- | --- | --- |
| Spark Mallet | +Y | 0.050989 m, including wrap | `[0, 0.110398, 0]` |
| Acorn Shield | +X | 0.023767 m | `[0, 0.121727, 0]` |
| Prism Wand | +Y | 0.042599 m, including wrap | `[0, 0.110000, 0]` |
| Ribbon Shield | +Y | 0.026973 m | `[0, 0.240000, 0]` |

Diameter is measured from the actual grip mesh's intersection with the plane through the origin perpendicular to the grip axis. The display transforms use identity rotation and unit scale; they put the lowest geometry at Y=0 and do not imply that a shield physically balances upright without a stand.

Both existing traveler GLBs were inspected read-only. [The hashed socket report](../../scripts/assets/era-equipment/traveler-sockets.json) records original bone names, wrist/elbow world positions, identity rest rotations, local axes and source-derived mitten-center translations. Parent the complete prop to a socket under the hand bone, then use the appropriate stage offset:

| Stage | Left hand socket translation | Right hand socket translation |
| --- | --- | --- |
| Infant | `[-0.010140, -0.015210, -0.017477]` | `[0.010140, -0.015210, -0.017477]` |
| Child | `[-0.010852, -0.024243, -0.013849]` | `[0.010852, -0.024243, -0.013849]` |

The authored JSON joints are `hand.L`, `hand.R`, `forearm.L` and `forearm.R`. Actual Three.js GLTFLoader intake of both exact exports verifies that object names become `handL`, `handR`, `forearmL` and `forearmR`; the dotted authored names survive in `object.userData.name`. Resolve that authored-name metadata when attaching equipment. Do not copy a rest world position onto an avatar-root child during animation.

Use identity prop rotation for the tools and Acorn Shield. The Ribbon Shield's off-center grip suits the left hand with identity rotation; quaternion `[0, 0, 1, 0]` rotates it 180 degrees around local Z for the right hand while keeping its face toward -Z. Arm poses and closed-fist fit remain integration checks. These socket measurements do not establish a new combat animation; the existing traveler `interact` clip is not certified as one.

## Verification

- Blender **4.5.13 LTS** constructed and re-imported each GLB. Every vertex of all **105 named source parts** was compared with the exported geometry: maximum nearest-vertex distance **0.0 m** for every part. The separate rear forearm strap and hand grip checks pass for both shields. Per-asset `reimport.json` files retain the measurements.
- Khronos glTF Validator reports **zero errors and zero warnings** for all four exports. The mallet and wand each have one expected unused-UV informational message on their untextured amber primitive; both shields have zero informational messages. Height, source bounds, indexing, embedded resources, rigid export and budgets pass.
- Three.js **0.186.0**, headless Chromium **153.0.8010.12**, WebGL 2 / SwiftShader loaded and rasterized the exact GLBs. Four camera views per prop and extra oblique shield-back views were captured. There were **zero page errors, console errors, failed responses or external requests**. [Browser intake summary](../../docs/assets/media/era-equipment/v001/browser-intake.json). The review scene's floor and shadow pass bring actual studio draw calls to 9 for the four-material props and 11 for the wand; the model primitives remain 4/5.
- All 60 final per-asset runtime/render/intake files were re-hashed against their manifests. All nine source files match the durable source bundle. Four editable source masters, four exact-GLB review masters and the scene-release checkpoint were downloaded and verified in transit. [Collection verification](../../scripts/assets/era-equipment/collection-verification.json).
- Construction/export, rendering, socket inspection, validator, browser intake, collection and finalization sources are retained in `scripts/assets/era-equipment/`. Python syntax parsing and Node syntax checks pass. The lead owns application integration, catalog pages and repository-wide release checks.

No physical iPhone/iPad Safari, hardware frame-time, final combat-pose, owner approval or deployed-game result is claimed by this authoring work order.

## Durable sources and reproduction

The authoring root is `/workspace/haynes-quest/era-equipment/v001`. Each `<asset>/<asset>.blend` preserves named construction parts and packed images; `<asset>/<asset>-export-review.blend` preserves the exact delivered GLB in its still-render scene. `live-scene-release.blend` is the final saved live checkpoint. The lead's concepts, all earlier equipment checkpoints and prior authors' masters remain unchanged.

The internal artifact route serves `haynes-quest/era-equipment/v001/<relative-file>` through the runbook's `/artifacts/` endpoint. [`source-bundle.json`](../../scripts/assets/era-equipment/source-bundle.json) carries the nine exact source files in base64 with individual checksums because raw script extensions are not served by that route. Rebuilding requires a new exclusive scene lease; use a new candidate output directory rather than overwriting a reviewed version.

After authorized remote construction, rendering and validation, the repeatable local intake is:

```bash
python3 scripts/assets/era-equipment/collect.py
node scripts/assets/era-equipment/inspect-browser.mjs docs/assets/media/era-equipment/v001 node_modules
python3 scripts/assets/era-equipment/finalize.py
```

No Blender process or scene lease remains owned by WO-017.
