# WO095 · Midnight arcade environment kit

- **Status:** Three static models exported and technically checked; exact owner art review pending
- **Owner:** Fresh native GPT-6 Astra subagent at max, exclusive Blender scene
- **Asset/version:** `midnight-arcade-kit/v001`
- **Scope:** Three original static environment props for an isolated asset-studio candidate, not gameplay promotion
- **Lead intake:** This worktree; coordinator owns catalog copy, inventory, thumbnails and publication

## Inputs and decision

The driving Astra generated and inspected [the selected concept](../../docs/assets/media/midnight-arcade-kit/v001/concept.png) on 2026-09-23. SHA256 `77806c6609dcbe2833b389cb334f7ea1b0fbbd79ac80551ef79d86ddad3ec45b`; [exact prompt](../../docs/assets/media/midnight-arcade-kit/v001/prompt.txt) and [source record](../../docs/assets/media/midnight-arcade-kit/v001/source.json). Shared shape/material references: `docs/assets/media/storybook-reference/v001/environment.png` SHA256 `f21b9b7c4a7473634350c30050419cca395a22156b791f2ea1d609688f639908` and `props-materials.png` SHA256 `1f15acf9aeb14cd7f4b00f6bb0b6d15ecbd97eb3775c9eac5a0b546c7a89f251`. Follow [art direction](../../docs/assets/art-direction.md) and [DESIGN002](../../docs/designs/002-asset-pipeline.md).

The upper panel is a mood and scale reference, not an exact geometry layout. The lower panel gives construction views. Keep mobile-readable rounded silhouettes, matte crafted surfaces, deep plum/violet with restrained cherry and honey highlights, and no legible text, logo, franchise character or personal media. Match the concept's shapes without copying tiny texture detail. Warm lanterns may be emissive, but do not rely on bloom.

## Blender deliverable

Read the haynes-ops `.agents/runbooks/blender-authoring.md` before mutating the live Blender scene. The service is reachable at `http://blender-authoring.dev.svc.cluster.local:8000/mcp`; `/readyz` was `ready:true,busy:false`, and `get_scene_info` showed only a default scene. You alone own this one live scene for this work order. Preserve editable work under `/workspace/haynes-quest/midnight-arcade-kit/v001/` and return exact relative artifact paths and checksums. Local worktree files are not automatically visible to Blender; transfer reference bytes explicitly if used in-scene.

Create one editable `.blend` master with named collections and separately exported static GLBs:

1. `ticket-arch.glb`: a broad ~4 m clear opening, ~3.4 m tall, chunky warm wood and stone feet, star token crest and a few honey bulbs. Keep the traversal opening entirely unobstructed.
2. `arcade-cabinet.glb`: ~0.9 m wide, ~1.0 m deep and ~1.8 m high, rounded plum case with abstract moon/star screen and a few tactile controls. Distinct front/side silhouette; no readable writing or actual game/logo art.
3. `joystick-bollard.glb`: ~0.85 m diameter and ~1.05 m tall, padded squat plinth and cherry ball on a short stalk. Decorative only; no physics claims.

Use a consistent Blender Z-up authoring frame and verify exported glTF/Three.js Y-up orientation, front direction, origin at floor center, dimensions and normal/material correctness. Working trial ceiling: 3,000 triangles and three materials per prop; report actual measured counts. Keep GLBs self-contained and static unless a genuinely useful tiny animation can be validated without compromising the brief. Export named beauty and side stills for each prop, plus one assembly still showing the three at gameplay scale beside a simple traveler-scale cylinder. Retain a construction/export script if it materially helps revisions.

Validate each GLB with the available Khronos glTF validator and report errors/warnings, mesh counts, materials, triangles, bounding boxes, file bytes and SHA256s. Inspect at least one actual exported GLB in a browser or glTF-capable viewer if possible; distinguish that from Blender-only renders. Do not add the models to the ordinary game manifest or call them owner-approved. Return a concise handoff with design deviations, limitations, artifact URLs/relative paths and catalog intake data; coordinator will update the review, inventory, cards and thumbnail manifest in this same PR.

## Completed evidence · September 23

The dedicated scene is released. The [versioned review](../../docs/assets/reviews/midnight-arcade-kit/v001.md) shows all three exact exported GLBs, matching stills, source concept, browser views and owner decision. [Catalog intake](../../docs/assets/media/midnight-arcade-kit/v001/catalog-intake.json) and [remote artifacts](../../docs/assets/media/midnight-arcade-kit/v001/remote-artifacts.json) retain measured geometry, validator results, scripts and the durable master checksum. Each prop has its own catalog inventory entry and thumbnail card. All three passed the Khronos glTF validator with zero errors or warnings and actual Chromium model-viewer loading; physical Safari and gameplay placement are untested. No GLB entered the game manifest.
