# WO-027 Mister Hiss authoring evidence

- Author: fresh native `gpt-6-astra`, `max`; worktree `/home/dev/work/quest-mister-hiss-model`, branch `agent/quest-mister-hiss-model`, starting commit `81c8d1b`.
- Scope: one Mister Hiss v001 candidate. The root concept, prompt and concept provenance remain unchanged. No runtime application, UI, other asset, infrastructure, PR, push or deployment changes are part of this work order.
- Reference: the exact lead-selected Minecraft Creeper confetti-parody concept was viewed before authoring. The cuboid head, tall armless lime body, four short feet, pixel frown, crooked party hat and strapped diagonal popper deliberately preserve that recognizable direction.
- Lead review: root selected the actual front/back/three-quarter checkpoint, then inspected the final side and five-row motion grid after the fastening correction. Root confirmed readable puff/sneeze and intact seated defeat, with no further art revision requested. Exact owner approval remains pending.
- Scene lease: claimed 2026-09-11 15:46:04 UTC and explicitly **released at 16:20:52.953 UTC**. Final render PID 38372 exited 0; all eight owned render/checker processes were exited and reaped before release. The previous equipment checkpoint remains unchanged. [Lease](../../scripts/assets/parody-mister-hiss/scene-lease.json), [process completion](../../scripts/assets/parody-mister-hiss/render-process-completion.json).

## Exact candidate and playback

The candidate uses meters, glTF +Y up / -Z forward and unit root scale. Rest geometry runs from Y=0 to Y=1.000000, including the party hat. Width is 0.442138 m and depth is 0.466843 m. It contains **12,872 rendered triangles, three opaque materials/primitives, 16 joints and 1,202,456 GLB bytes**.

GLB SHA256: `14bcfe2dcc060cbfd6908a281de0795f6b426144a63d322f89f1ec234e42572f`.

| Clip | Duration | Playback | Contact / end behavior |
| --- | --- | --- | --- |
| `idle` | 2.5 s | Repeat | Small nervous breath and head tilt |
| `move` | 1.0 s | Repeat | Four-foot shuffle with fixed world root |
| `attack` | 1.5 s | Once, clamp | Confetti onset/contact **0.9 s**, fraction **0.6**; six small skinned paper bits |
| `hit` | 0.5 s | Once, clamp | Clear brief flinch |
| `defeat` | 2.0 s | Once, clamp | Wobbles and sits intact; remove only after the clip finishes |

The gameplay controller owns positioning and final removal. Clips target named descendant joints, never the caller's scene attachment root. No external image, decoder, audio stream or runtime particle system is embedded.

## Construction and corrections

The editable master retains **359 exact named construction parts** in an excluded source collection. Runtime geometry joins those pieces into one skinned node and three material primitives. All 359 source parts match the actual re-imported GLB at **0.0 m maximum nearest-vertex error within their assigned bone**, and every exported runtime vertex has exactly one weight of 1.0.

Exactly four separate green foot cores survive export. The sash is one continuous closed loop; two concealed glued plum tabs connect it to the torso. Each tab has eight source surface intersections with the torso and eight with the sash. The canister intersects the sash at six triangle pairs. The hat brim overlaps the solid head by **0.0119543 m**, and its joint is parented to `head`; its tilted rim is physically attached.

The first actual GLB render caught a default cube UV layer displacing the intended atlas coordinates. Keeping only the explicitly active atlas layer fixed it before lead selection. The later side/contact inspection found a small clearance between sash and torso; the concealed tabs fix that physical connection without changing the selected silhouette. Both earlier candidate sources and available exact renders remain in the remote `iterations/` directories. The initial source comparison also counted Blender's unweighted armature display shape; the final comparison correctly limits its weight assertion to actual skinned runtime geometry.

The original 1024px pigment atlas comes from deterministic authored paper fields, palette swatches and party motifs, with no input texture or downloaded mesh. The atlas generator uses seed 27001, Pillow 12.3.0 and NumPy 2.5.2; the GLB embeds a JPEG derived from that atlas. Source concepts were not used as textures.

## Verification and artifacts

- Blender **4.5.13 LTS** builds the editable source and re-imports the exact exported GLB for all final views and motion.
- Khronos glTF Validator reports **zero errors, warnings, informational messages and hints**. Size, triangle/material/primitive counts, exact clips, single skin, UVs, opaque surfaces and embedded resources pass.
- Three.js **0.186.0** loads and decodes the atlas, samples actual skinned geometry at 49 times per clip, checks rest dimensions/ground, loop seams, bounded deformation and fixed root, then verifies independent `SkeletonUtils` clones and every track's descendant binding. One-shot clamping and exact 0.9-second contact arithmetic pass.
- Isolated Chromium **153.0.8010.12**, WebGL 2 / SwiftShader renders the exact GLB. All five clips change actual raster output. There are no page/console/request errors, WebGL errors or external requests. The scene renders four color-pass draws including its ground: three character primitives and 12,872 character triangles.
- All **34 artifact files**, including **three editable masters**, were downloaded through the authoring service artifact route and verified against their exact byte counts and SHA256s. All **nine source files** also passed byte-for-byte round-trip verification through the source bundle. [Collection proof](../../scripts/assets/parody-mister-hiss/collection-verification.json), [asset manifest](../../docs/assets/media/mister-hiss/v001/manifest.json). Raw script extensions are not served by the artifact route, so the JSON source bundle retains their bytes and hashes.
- Four final stills are **900 × 1000**. All five clips and the combined **7.5-second** reel are actual **24fps, 480 × 560 H.264/yuv420p** video; the turntable is **3 seconds**. All seven videos were fully decoded successfully. The five-row motion grid uses actual rendered clip samples. Early checkpoint files identify the pre-fastening GLB hash separately; all final named stills and videos use the delivered GLB.

Required output paths are `docs/assets/media/mister-hiss/v001/` and `scripts/assets/parody-mister-hiss/`. Editable masters remain under `/workspace/haynes-quest/parody/mister-hiss/v001` and verified local copies under ignored `.docs-build/mister-hiss-masters/`. The complete source, exact-GLB review scene and final live-scene checkpoint are separate `.blend` files.

Reproduction requires a fresh exclusive live scene lease and a new version directory. Transfer the original atlas and owned sources, execute `build.py`, run `validate.mjs` with the service's validator package, and run `render.py -- --name mister-hiss --stills --video` in an isolated Blender process. Local geometry and browser checks use:

```bash
node scripts/assets/parody-mister-hiss/inspect-three.mjs docs/assets/media node_modules/three mister-hiss
node scripts/assets/parody-mister-hiss/inspect-browser.mjs "$PWD" node_modules
python3 scripts/assets/parody-mister-hiss/collect.py
```

Authoring-only Python and Node syntax checks pass. The lead owns review-page prose, strict site/repository checks and any integration. No physical iPhone/iPad Safari, hardware frame-time, final owner approval, integrated gameplay or deployed-game result is claimed.
