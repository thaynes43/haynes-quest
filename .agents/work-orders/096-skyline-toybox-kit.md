# WO096 · Skyline toybox environment kit

- **Status:** Three static model candidates delivered, technically checked and cataloged; publication and exact owner review pending
- **Owner:** Fresh native GPT-6 Astra subagent at max; exclusive scene claimed after WO095 and now released
- **Asset/version:** `skyline-toybox-kit/v001`
- **Scope:** Three original static environment props for isolated asset-studio review, not gameplay promotion

## Selected references

The driving Astra generated and inspected [the concept sheet](../../docs/assets/media/skyline-toybox-kit/v001/concept.png) on 2026-09-23. SHA256 `384cd2a3ccae6d1debacd90377b538d7319290ce250ba84462473ef8746485fa`; [exact prompt](../../docs/assets/media/skyline-toybox-kit/v001/prompt.txt) and [source record](../../docs/assets/media/skyline-toybox-kit/v001/source.json). Shared reference images and hashes are in the source record. Follow [art direction](../../docs/assets/art-direction.md), [DESIGN002](../../docs/designs/002-asset-pipeline.md), and the haynes-ops `.agents/runbooks/blender-authoring.md`.

The upper panel establishes soft blue-green and peach block scenery, warm light, safe broad steps and muted-blue rails. The bottom strip supplies construction cues. Preserve rounded matte wood/painted stone/felt forms and mobile-readable silhouettes. Tiny foliage or distant castles in the image are mood, not a requirement for this bounded kit. The wind-up lantern is scenery, not a friendly or enemy. Do not use franchise art, legible text, personal media or logos.

## Deliverable and checks

Once WO095 explicitly releases the live Blender scene, create one editable master under `/workspace/haynes-quest/skyline-toybox-kit/v001/`, with named collections and separate GLBs:

1. `block-tower.glb`: modular three-piece tower with a broad rounded arch opening; approximate assembled dimensions 1.7 m wide, 0.9 m deep, 2.4 m tall. Decorative off-route scenery; do not imply arbitrary stacking physics.
2. `safety-rail.glb`: one repeatable cushioned rail/bridge-edge segment about 2.4 m long, 0.75 m tall, with blue posts and warm wood handrail. It is scenery outside the collision route; the gameplay course's actual safety physics remain code-defined.
3. `windup-lantern.glb`: ~0.8 m tall rounded blue-and-peach wind-up toy with a honey-lit window, readable key and no face that could be confused with a friendly creature.

Place origins at floor center, keep a coherent orientation across exports, and verify glTF Y-up in Three.js. Working trial ceiling 3,000 triangles and three materials per prop; report actual counts. Export a beauty and side still for each prop, plus one shared gameplay-scale assembly still. Retain editable `.blend`, meaningful build/export script and SHA256s. Run the available Khronos glTF validator on all GLBs; inspect exported files in a browser/glTF viewer if possible, and report actual sizes, mesh/material/triangle counts and bounds. Transfer public-safe outputs to `docs/assets/media/skyline-toybox-kit/v001/` with checksums. Do not place models in the ordinary gameplay manifest or call them approved. Return concise catalog intake; the coordinator owns review copy, inventory, cards, thumbnails, docs build and publication in the same PR.

## Author delivery · September 23

The live Blender scene is **released**, with no remaining render jobs. The editable master is `/workspace/haynes-quest/skyline-toybox-kit/v001/skyline-toybox-kit.blend`, SHA256 `dcfcac4a9360529edd6d818827db7b0f3bd9d75534c0b49a5ac5b245358ae1f3`. It retains 39 named source mesh parts in three prop collections, a separate review studio and embedded build/render/validation scripts. The final source reopened successfully for the last source render. [Release record](../../docs/assets/media/skyline-toybox-kit/v001/scene-release.json).

| Export | Width × height × depth (m, glTF Y up) | Triangles | Materials | Bytes |
| --- | --- | --- | --- | --- |
| `block-tower.glb` | 1.700 × 2.377 × 0.912 | 1,324 | 1 | 33,728 |
| `safety-rail.glb` | 2.400 × 0.756 × 0.380 | 1,532 | 1 | 38,988 |
| `windup-lantern.glb` | 0.659 × 0.814 × 0.427 | 2,664 | 3 | 68,200 |

Each export is one static mesh with identity transforms and a floor-centered origin. Khronos glTF Validator 2.0.0-dev.3.10 reports zero errors, warnings, infos or hints for every GLB. Actual model-viewer 4.3.1 in Chromium 153 software WebGL loaded all three exact hashes, confirmed Y-up dimensions and ground origins, and produced no page/console errors, failed requests or external requests. All seven source stills and three browser screenshots were visually inspected. Nineteen local files match their corresponding remote artifact checksums.

The lantern deliberately has no face or bird features. Fine grain and felt fibers are simplified to matte rounded geometry and broad vertex colors. This is isolated asset review, with no gameplay placement, physics or physical Safari performance claim. Owner approval remains pending.

The [precise catalog intake](../../docs/assets/media/skyline-toybox-kit/v001/catalog-intake.json), [export measurements](../../docs/assets/media/skyline-toybox-kit/v001/glb-measurements.json), [browser evidence](../../docs/assets/media/skyline-toybox-kit/v001/browser-report.json), [remote source/artifact record](../../docs/assets/media/skyline-toybox-kit/v001/remote-artifacts.json) and [local checksums](../../docs/assets/media/skyline-toybox-kit/v001/checksums.sha256) accompany the deliverable. The coordinator added all three separately reviewable models to the shared inventory and catalog cards; checked publication through the application image remains open.
