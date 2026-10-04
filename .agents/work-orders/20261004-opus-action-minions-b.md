# Opus action minions B and planting kit · October 4

## Objective and ownership

Tom explicitly requests Claude Code Opus 5.5 model production in parallel via Blender. Use exact `claude-opus-5-5`, xhigh on his plan, not an API key. Own only Blender instance **2**, `http://blender-authoring-2.dev.svc.cluster.local:8000/mcp`; instance 1 belongs to the other author. Use your agent-run worktree under `/home/dev/work`, never the canonical clone. Do not PR/merge/deploy. Native `blender` MCP points at instance1: DO NOT use it. Use bounded streamable HTTP transfer helper as in `scripts/assets/rooftop-city-kit/v001/transfer.py`; only host header localhost resolves image allowlist, TCP still instance2. No proxies or third-party generation tools.

Read AGENTS.md, .agents/TEAM.md, docs/PROCESS.md, root design `/home/dev/work/hq-action-worlds-1004/docs/designs/029-action-and-inhabited-worlds.md`, docs/designs/002-asset-pipeline.md, docs/designs/026-personal-era-casts.md, enemy GLB loader/manifest and existing scripts/assets helpers.

## Art brief

Coordinator-generated construction reference: `/home/dev/work/hq-action-worlds-1004/docs/assets/media/action-minions-b/v001/concept.png`. Inspect and retain. THREE distinct separate enemies:

1. `broccoli-bouncer@v001`: chunky green floret head, pale green stalk torso, naughty cream face, leaf hands, orange sneakers. Nursery vegetable cast.
2. `bin-chicken-flower-thief@v001`: white ibis, long curved dark beak, dark wing tips, orange eyes, coral legs, teal satchel spilling raspberry flowers. Magical garden cast.
3. `demon-idol-drummer@v001`: magenta swept hair, small plum horns, teal short jacket, black star shirt, plum pants, white boots, raspberry waist snare and two sticks. Big Stage cast.

Match silhouette/colors/face cues with modeled geometry, not flat image textures. Distinct shapes and animation. About 1.3–1.6m game height with adapter orientation. Original parody variants of existing era identities; no copied meshes/logos, no gore. Strong mobile-scale faces.

After enemies, deliver static planting kit `storybook-planting-kit@v001` with THREE separate reusable props: broad rounded layered canopy tree with crooked ochre trunk and green/lime leaves (~4m high); slim deep teal cypress with layered drooping crown (~3m high); low raspberry/cream flowering shrub with shaped leaves (~0.8m high). Root is generating a construction reference at `/home/dev/work/hq-action-worlds-1004/docs/assets/media/storybook-planting-kit/v001/concept.png`; start enemies now, check that path before foliage. Use low draw calls, shared materials, no fine texture details. Tree base at ground origin, centered; no baked scenery base blocking placement. Three static GLBs, editable kit master, front/side previews, technical checks and catalog intake. No animations required on props.

## Scene safety and deliverables

Instance2 was most recently released by rooftop-city-kit at `/workspace/haynes-quest/family-eras/rooftop-city-kit/v001/live-scene-release.blend`. Recheck actual scene props before claiming; preserve prior masters. Claim lease with scene props and JSON at `/workspace/haynes-quest/action-worlds/minions-b/v001/`, save checkpoint, separate masters per enemy and planting kit, released pack master. Never overwrite prior assets. Only one author on this scene. No dev-env restart.

Each enemy: concept, editable master/hash, runtime GLB with exact adapter-required clips, front/side/back/action renders, source scripts/provenance, actual tool/model versions, budgets, Khronos validation, Three loader/clip/scale checks. Fetch through instance2 artifacts into `docs/assets/media/<asset-id>/v001/` plus `/home/dev/artifacts/haynes-quest/action-worlds/v001/minions-b/`. Keep preview files bounded/compressed. Supply precise catalog intake JSON (IDs,names,descriptions,paths,hashes,clip mappings) and per-asset review drafts. Do NOT edit shared catalog.md, catalog-inventory.json, parody-catalog.ts or scene manifests; root owns integration/copy. Candidate permission PRD004 Q03 applies; awaiting owner review does not block authoring.

Checkpoint after each model and send durable progress at `/home/dev/artifacts/haynes-quest/action-worlds/v001/minions-b/RESULT.md`. Commit owned outputs. Finish/release scene, confirm old master hashes unchanged. Root polls RESULT; document commit, checks and constraints concisely. Deliver coherent full scoped pack, not tiny partial primitives.
