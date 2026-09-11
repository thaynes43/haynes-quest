# WO-014: The Pixel Orchard enemy candidates

- Status: Ready for fresh Astra dispatch, 2026-09-11.
- Authoring model: native `gpt-6-astra`, `max`, empty context.
- Exclusive scene lease: the dispatched `era_2020_models` agent only, until explicit release.
- Remote directory: `/workspace/haynes-quest/era-2020/v001`.
- Owned repository paths: `scripts/assets/era-2020/`, `docs/assets/media/{blockling,signal-moth,buffer-baron}/v001/` except lead-authored concept/prompt/provenance files, and this work order's evidence sibling. Root owns review prose, catalog and gameplay integration.

## Direction

Build three original, expressive, warm storybook enemies from the lead's serial concept sheets. Walnut, honey brass, sage and muted plum match storybook-v001. These embody block-building play and streaming culture for the fictional 2020 level. They are not replicas of existing franchise characters. Concepts and models are candidates; owner approval is pending.

1. **Blockling**, 0.85 m tall: an asymmetric carved wooden toy-block quadruped, large tilted pentagonal head with two inset honey eyes, four short legs, moss and sprouting leaves. The concept's silhouette is selected; resolve any view ambiguity as four feet and a forward-heavy animal stance. Initial concept hash `ef74355e4f1a328cdab3e454b0964c59ba2a5ff64a85dc9ddf6d6f30ab59e101`.
2. **Signal Moth**, concept to follow from lead: a low-hovering walnut/brass moth with four broad segmented leaf-shaped wings and luminous inset panels, antennae, no screen logo. Total posed height 0.9 m, wingspan 1.25 m.
3. **Buffer Baron**, concept to follow from lead: 1.85 m floating wooden lantern boss, broad pear-shaped body, carved mask with inset eyes, a segmented brass loading halo and two articulated arms. A large readable wind-up before its radial pulse attack.

Inspect each actual concept before constructing that asset. The lead may supply the next concept while the current asset is authored. Do not invent replacements or run image generation. Every Blender task, including scripts and renders, stays on this Astra lane. Never factory-reset Blender or unload its MCP addon. Preserve existing remote masters and use new scene data only within the assigned lease.

## Output contract

Export GLB 2.0 in meters, +Y up, forward -Z, ground origin Y=0, fixed root translation. Required named clips: `idle`, `move`, `attack`, `hit`, `defeat`; loops idle/move, other clips once. Root supplies movement and combat values. Keep attack timing legible; record clip duration and the impact time. Aim under 15k triangles and six materials per enemy, 2 MiB GLB, no decoder or external texture dependencies. Broad vertex color variation and actual carved relief should survive close inspection; do not substitute plain box/sphere placeholders for selected silhouettes. Material/triangle exceptions need measured justification.

Retain editable .blend masters, construction/export scripts, exact exported GLBs, front/side/back/beauty renders, motion sheet and bounded clips/turntable, hashes, dimensions, material/triangle/clip counts and Khronos validation. Re-import and inspect the exported files, not just the authoring scene. Verify Three animation geometry changes and fixed root. Transfer real outputs through the artifact service and verify bytes/checksums. Record limitations honestly and release the live scene explicitly at completion.
