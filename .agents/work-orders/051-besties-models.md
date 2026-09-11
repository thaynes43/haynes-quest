# WO051: Operation Besties — approved joint look, two models

- **Status:** Ready for author dispatch. Tom approved the shown pink/black concept on September 11: “Use this look for the duo.” This authorizes this visual brief and modeling, not final acceptance of unseen exports.
- **Model:** fresh native GPT-6 Astra, max, empty context. All Blender work stays on Astra under TEAM.
- **Root/worktree:** `/home/dev/work/quest-playtest-feedback`; root owns integration/UI/copy/catalog. Agent owns `scripts/assets/bickering-besties/`, model media directories below, and its technical result record. Do not edit current game/client/shared contracts.
- **Input:** `docs/assets/media/bickering-besties/v001/concept.png`, SHA256 `1fb8f525b23c811dd1c3946faca219224bb10800c2517ae87ffdb40beaa0aee1`. Inspect this actual image. Follow both front/back designs; the pink-white varsity outfit, large pink bow and blonde hair contrast with black hoodie/trousers, purple star/streak/laces and black hair. Retain sturdy footwear and mitt-like hands. No extra hats, props, weapons or competing art direction.

## Two separate runtime assets

Stable IDs: `bestie-pink` and `bestie-black`, each version `v001`, with own `.glb` at `docs/assets/media/<id>/v001/<id>.glb`. One shared joint concept at the path above. Two runtime actors share one boss encounter and one reward; neither model owns progression. Root will supply actor positions and coordinate their animation phases. Their approved routine alternates gentle obstacle tricks then a missed high-five and generous shared recovery. Their defeat is a comic sit/stumble and reconciliation, not frightening death.

Each character: approximately 1.4 m standing, meters, exported Y-up and forward -Z, feet at y=0, root transform identity. Use a deliberate connected skinned rig; shoulders/elbows/wrists/legs must remain attached throughout clips, soles planted where expected, no disappearing geometry or oversized hidden meshes. Preserve distinct facial expressions (sunny pink, dryly skeptical black) at phone scale. Hair in large readable sculpted locks, not thousands of expensive strands. Polished bevels and an original embedded color/material atlas. No downloaded textures or private media.

Per-character working ceilings: 15,000 triangles, GLB 2 MiB, at most six opaque materials/primitives, one 1024² atlas. Prefer fewer without flattening the approved silhouette. Report actual counts and any justified deviations before claiming completion.

Required named clips: `idle` 2.4s loop; `move` 1.2s loop; `attack` 1.6s once (dramatic obstacle-summoning gesture, contact 1.0s/0.625 fraction); `hit` 0.6s once; `defeat` 2.0s once held final comic sit; `cheer` 2.0s loop (non-active actor); `high-five` 1.6s once (pink uses right hand and black uses left hand so actors can meet with a small clear miss); `dizzy` 2.4s loop (shared recovery). Clip roots remain stationary; game owns translation/facing. Arm/hand attachment and planted feet matter more than extra renders. No voices or extra asset generation.

## Service lease and recovery

Service: `http://blender-authoring.dev.svc.cluster.local:8000/mcp`, artifact download `http://blender-authoring.dev.svc.cluster.local:8000/artifacts/<workspace-relative-path>`. Local paths do not exist remotely. Remote output root `/workspace/haynes-quest/bickering-besties/v001`. Native tools are available; bounded chunked source transfer via MCP is established in `scripts/assets/parody-remix-trio/transfer.py` (adapt only into owned directory). The old Nap scene was released and must remain recoverable at `/workspace/haynes-quest/parody/remix-trio/v001/live-scene-release.blend`; never overwrite it or resume its production.

Root grants exclusive mutable-scene ownership only in the dispatch message after a read-only job check. Save current recovery state to a separate named safety checkpoint before replacing the scene, then start Besties in its own directory. Save after each completed character/rig/animation milestone. One active author only. Do not restart Blender or dev-env. No external render Jobs/GPU needed. End any spawned background render/export processes and explicitly release ownership with final checkpoint path.

## Deliverables

Both editable masters, construction/atlas/export scripts, GLBs, per-file SHA256 manifest, validation and actual animation/attachment checks. Supply matching front/side/back and beauty renders of each model plus a compact joint pose. Provide a bounded animation reel or representative previews showing every named clip; don't spend hours producing redundant camera/clip variants. View/export checks must inspect actual re-imported GLBs as well as source rigs. Check Three.js animation names/bounds, skin weights/attachments and feet, orientation/scale, embedded resources and Khronos validator results. Request a browser lease before running the shared browser; pure parser checks are independent.

Return exact paths/IDs/versions/source and model hashes, thumbnail sources and catalog intake data in `.agents/work-orders/051-besties-models-results.md`. Root owns all review-page prose and final shared inventory/card wiring in the same asset PR. Record known limits honestly, not owner approval of exports. No commit/push/deploy without root coordination.
