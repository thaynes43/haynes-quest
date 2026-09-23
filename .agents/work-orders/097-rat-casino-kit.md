# WO097 · Rat Casino static prop kit

- **Status:** Ready for exclusive Blender authoring
- **Owner:** Fresh native GPT-6 Astra subagent at max
- **Asset/version:** `rat-casino-kit/v001`
- **Scope:** Three original, static studio candidates; no character modeling or gameplay promotion
- **Scene lease:** One exclusive live Blender scene under `/workspace/haynes-quest/rat-casino-kit/v001/` until the agent saves and releases it

## Inputs and visual decision

Tom has selected a spooky retro Rat Casino and Halloween Haynesnightmares direction, and wants Blender models before new levels. The earlier Midnight Arcade v001 was too young, although the arcade theme was right. The driving Astra generated and inspected [this darker three-prop concept](../../docs/assets/media/rat-casino-kit/v001/concept.png) on September 23, 2026. SHA-256 `eb10826504b05d8e2cfaee9f7881a994640c29a9f22401a00c32bce56fe4fee4`; exact prompt and source record are adjacent. Its mood is selected for a studio environment candidate; Tom's exact model review remains pending. No family media was used.

The concept shows (left to right) an entrance marquee, a roulette dais and a slot cabinet with small side views. Read the [project art brief](../../docs/assets/art-direction.md), [asset pipeline](../../docs/designs/002-asset-pipeline.md), [PLAN015](../plans/015-haynesnightmares-asset-first.md), and current [Blender runbook](https://github.com/thaynes43/haynes-ops/blob/main/.agents/runbooks/blender-authoring.md). Inspect the actual local concept image with `view_image`; local worktree paths are not visible inside Blender. Use the concept as visual guidance; the background hall and tiny scale cylinders are not deliverable models.

## Blender task

Before mutation, verify `/readyz` is idle and inspect the current scene. It contains the previously released Skyline Toybox objects; its immutable master is `/workspace/haynes-quest/skyline-toybox-kit/v001/skyline-toybox-kit.blend` with release evidence in WO096. Do not overwrite that master. Save a new named scene for this work order and retain construction/export Python scripts to make later revision possible. You alone own the live scene until your final saved checkpoint and explicit release note.

Create three separately exported self-contained GLBs, Blender Z-up authoring, glTF/Three.js Y-up, forward -Z, floor-centered origin:

1. `marquee-arch.glb`: ~6 m wide and ~3.6 m tall, clear inner walkway >=4.0 m wide and >=2.6 m high. Abstract rat-ear crown, blank oval plaque, amber bulbs, plum drapes and tarnished brass. No text or obstructing curtain in the playable opening.
2. `roulette-dais.glb`: ~3.5 m diameter and <=0.6 m high, broad flat stable top with large colored wedges, low rounded bumper and a central star mechanism. Static for this candidate; an eventual rotation must be driven by a reviewed animation or runtime behavior rather than implied by this export. It is scenery, not a betting UI.
3. `slot-cabinet.glb`: ~1.1 m wide, ~1.0 m deep and ~2.1 m high, moon/star/bat reel symbols, robust lever and warm bulbs. Original invented symbols, no franchise art or readable gambling instruction.

Make each silhouette read at a mobile third-person camera distance. Use low-noise matte wood/velvet, aged brass and restrained emissive amber. Add no gore, jump scare, real-world casino branding or personal media. Provisional target per static prop: <=5k triangles, <=4 materials and <=1.5 MiB GLB; measure the actual result. Source should be editable with sensible named collections/objects. The GLB must load without external textures or decoder requests.

Render matching front three-quarter `*-beauty.png` and side `*-side.png` for each model plus an assembly still beside a neutral traveler-size cylinder. Save `.blend`, scripts, export report, manifest/checksums and a scene release marker under the remote version directory. Validate each exact GLB with Khronos glTF Validator for zero errors/warnings; measure bounds, triangles, materials and bytes. Inspect at least one exported GLB in a real browser model-viewer and return the evidence/limitations. A Blender still alone does not count as browser inspection. Copy required small files into the worktree's `docs/assets/media/rat-casino-kit/v001/` and verify remote/local SHA-256s; the lead owns public review copy, inventory/cards, thumbnail generation and publication.

## Handoff

Return exact remote relative artifact IDs and checksums, exported model paths, stills, measured dimensions and openings, validation and browser result, any deviations, and the saved scene release state. No new level or runtime manifest change is authorized by this work order. The lead must make a review page and one inventory/card entry per GLB in the same PR before claiming asset completion.
