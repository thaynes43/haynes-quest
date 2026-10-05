# Opus action minions A · October 4

## Objective and ownership

Tom explicitly requests Claude Code Opus 5.5 model production in parallel via Blender. Use exact `claude-opus-5-5`, xhigh on his plan, not an API key. Own only Blender instance **1**, `http://blender-authoring.dev.svc.cluster.local:8000/mcp`; instance 2 belongs to the other author. Use your agent-run worktree under `/home/dev/work`, never the canonical clone. Do not PR/merge/deploy.

Read AGENTS.md, .agents/TEAM.md, docs/PROCESS.md, docs/designs/029-action-and-inhabited-worlds.md in the lead worktree `/home/dev/work/hq-action-worlds-1004`, docs/designs/002-asset-pipeline.md, docs/designs/026-personal-era-casts.md, src/game enemy GLB loader/manifest and relevant existing scripts/assets helpers.

## Art brief

The coordinator-generated construction reference is `/home/dev/work/hq-action-worlds-1004/docs/assets/media/action-minions-a/v001/concept.png`. Inspect it and copy into your candidate media/source references. Three rows correspond to THREE separate full enemy assets:

1. `gadget-hammer-hopper@v001`: teal runaway toolbox, ochre lid, cartoon face, hose arms, soft giant rubber mallet, one spring and chunky boot. Expressive asymmetrical mechanical silhouette; Clubhouse cast.
2. `mischief-kitten-skater@v001`: lilac striped kitten, plum mini stovepipe, raspberry bell collar, teal roller skates, arched tail and naughty eyebrows. Harbor cast.
3. `lab-robot-sentry@v001`: broad cream/teal toy robot, round orange radar eye, dark plum limbs, pincer hands, antenna. Hero City cast.

Treat image as build direction, not a texture pasted on geometry. Match silhouettes/colors/face cues with bevels and sculpted mesh. Distinct meshes and animations, not recolors or generic primitive bodies. Approximately 1.3–1.6m high, facing the current enemy adapter orientation. Readable small scale. Reuse technical rig/export helpers where sound, but make these recognizable original variants of current era identities. No copied meshes/logos, no gore.

## Scene safety and deliverables

Instance1 was read-only checked released at `/workspace/haynes-quest/family-eras/web-slinger-helper/v001/live-scene-release.blend`, scene_owner none, scene_lease released, WO111. Recheck before claiming; preserve all earlier masters byte-for-byte. Claim lease using scene properties and durable JSON in `/workspace/haynes-quest/action-worlds/minions-a/v001/`; save checkpoint before changes. Own one scene throughout pack, save separate editable `.blend` for each asset and released pack master. Never overwrite previous candidates.

For EACH asset deliver: original concept reference, editable master+checksum, runtime GLB with adapter-required clips (inspect exact idle/walk/attack/hurt/defeat convention), front/side/back and action rendered previews, source scripts, provenance actual Blender/tool/model settings, triangle/material/file budgets, Khronos zero errors/warnings or justified report, actual Three loader/animation/scale checks. Use repo scripts/harnesses, not claimed theoretical validation. Fetch artifacts through service `/artifacts/` into versioned repo `docs/assets/media/<asset-id>/v001/` and durable `/home/dev/artifacts/haynes-quest/action-worlds/v001/minions-a/`. Keep previews bounded and compress review video, avoid giant unneeded PNG exports. New candidate review gates follow PRD004 Q03; label awaiting owner review, root handles runtime/catalog registration after checks.

Supply precise inventory/catalog intake JSON including IDs, names, description, current review image paths, model paths, hashes, clip mappings and suggested chapter placements, and model review Markdown drafts. Do not modify shared catalog.md, catalog-inventory.json, parody-catalog.ts or scene manifests; root owns shared integration/UI text. Source-to-model quality is mandatory. Deliver full coherent pack autonomously; checkpoint after each model.

Commit owned asset/source/review files, record commit and short results in `/home/dev/artifacts/haynes-quest/action-worlds/v001/minions-a/RESULT.md`. Record progress there so root can poll. Save/release scene and confirm prior master unchanged at completion. All repo edits in worktree. Do not wait for owner approval; technically checked family candidates are authorized under Q03.
