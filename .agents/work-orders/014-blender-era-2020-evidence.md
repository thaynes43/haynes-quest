# WO-014 authoring evidence

**Candidate production complete on 2026-09-11.** Native `gpt-6-astra` at `max` built, revised and checked all three selected 2020 concepts. The Astra lead inspected the final images and selected all three exact exports for first-pass candidate packaging. **Tom approval and gameplay promotion remain pending.** Root owns catalog/review prose, integration and PR/merge.

The worktree is `/home/dev/work/quest-era-2020-models`, branch `agent/quest-era-2020-models`, based on `f0756bc`. The remote artifact root is `/workspace/haynes-quest/era-2020/v001`. Prior traveler and clearing masters were preserved; no factory reset or addon unload occurred.

## Final delivery

| Candidate | GLB SHA-256 | Triangles | GLB bytes | Materials / primitives / color-pass calls |
| --- | --- | --- | --- | --- |
| [Blockling](../../docs/assets/media/blockling/v001/beauty.png) | `57f8cf41898c856f90d3aa4df50880c242db9718a8df9acbda3fa46d06fcc1cb` | 14,930 | 1,121,948 | 6 / 6 / 6 |
| [Signal Moth](../../docs/assets/media/signal-moth/v001/beauty.png) | `9e964faf1b483193a399cb0e410a5b6d6e68ccd158c16bf2d2a88cbbaa9144fe` | 13,520 | 1,083,900 | 6 / 6 / 6 |
| [Buffer Baron](../../docs/assets/media/buffer-baron/v001/beauty.png) | `9d343e07e9d2593fce5ad9c99df29672ac81cc235ea66fdd276199b7c6da6915` | 14,840 | 1,195,688 | 6 / 6 / 6 |

Each GLB contains one joined skin with six opaque material primitives. Three loads those primitives as six skinned meshes. Non-independent ornaments share the skin and materials; bolts, moss, grain and fingers do not each create a separate draw submission. Shadows add their own passes; six is the measured color-pass count, not a whole-game draw count.

Every export contains UVs, vertex colors, skin weights, all five clips and one embedded 1024 × 1024 original pigment image. The image is JPEG quality 90 inside the GLB; the lossless baked `pigment.png`, editable pigment vertex layer and source nodes are retained with the master. Materials use walnut, honey brass, sage moss, plum inlay, carved recess and amber light. No external texture, mesh or decoder download is required. All three pass the 15k-triangle, six-material, six-primitive and 2 MiB limits without an exception.

For each asset, `docs/assets/media/<asset>/v001/` contains the exact GLB, beauty/front/side/back renders, browser beauty, five individual clips, combined animation preview, turntable, motion sheet, runtime contract, construction/export/Three/browser/Khronos reports and manifest. The [Blockling manifest](../../docs/assets/media/blockling/v001/manifest.json), [Moth manifest](../../docs/assets/media/signal-moth/v001/manifest.json) and [Baron manifest](../../docs/assets/media/buffer-baron/v001/manifest.json) record every delivered file's size and SHA-256.

The [central delivery manifest](../../scripts/assets/era-2020/delivery-manifest.json) is **34,193 bytes**, SHA-256 **`f2947beeea0f02d247f4f04b79f040663f9a2ce2f764b6260ae77fc3a4fa51e1`**. [Collection verification](../../scripts/assets/era-2020/collection-verification.json) records **75 verified asset files**, including all three masters, plus 11 common source/lease/completion files. These were retrieved from the service's `/artifacts/haynes-quest/era-2020/v001/` route and verified again locally. The route serves source through the hashed `source-bundle.json`; the decoded construction snapshots are retained in `scripts/assets/era-2020/snapshots/`.

Editable masters remain on the authoring PVC at `<remote-root>/<asset>/<asset>.blend`. Verified copies also remain on the dev PVC at `/home/dev/work/quest-era-2020-models/test-results/era-2020-masters/`; these editable files are intentionally outside static site input.

| Editable master | Bytes | SHA-256 |
| --- | --- | --- |
| `blockling.blend` | 5,103,852 | `ea7075a8729424bb476c8ee103bee654df2bae077c764d768a1d1dafcc4d52a9` |
| `signal-moth.blend` | 4,665,008 | `eec5407e9dd891dcfe2ee7617fed4f771f5e92668f3a2e17b454c69e17b8d22f` |
| `buffer-baron.blend` | 4,966,578 | `5b262f65de2ccd65c5c65c970088e81fa72b8f14c4eb30e5714d7611c9a9172c` |

## Construction and inspection

All three exact concept PNGs were inspected before their models were constructed. Their hashes and paths are in [source-concepts.json](../../scripts/assets/era-2020/source-concepts.json). No concept was regenerated or replaced, and no external mesh, downloaded texture, private reference or family media was used. The lead's existing concepts, prompts and provenance were left untouched.

Blockling was revised from its early angular construction into a rounded, forward-heavy quadruped with bent knees and paws, an asymmetric convex pentagonal head, shallow plank seams, directional pigment, inset amber lenses and clustered moss. Signal Moth has four articulated leaf-shaped wings with inset amber panels on both sides, brass hinges and antennae, plum eyes and six small claws. Buffer Baron has a pear-shaped body, carved mask, inset lantern chest, mantle, gauntlets and six separated halo segments. The final bounded halo revision moved its lower two segments outward and upward; the lead inspected that exact final front and beauty image before selection.

The original construction source is embedded in each master and extracted without editing into its source snapshot. The final shared `build.py` adds the reusable command entry point and cleanup of obsolete comments/code. The Baron snapshot also records its final halo positions. `render.py` uses adapted repository WO-007 studio helpers and renders only an exact re-imported GLB in a separate Blender process.

Surface iterations corrected overly dark line grain, lumpy relief and double pigment tint. Animation iteration corrected keyframing order before final export; actual vertex deformation was then checked. The final skin is a scene root with an armature modifier. Blender's exporter emitted a generic armature-parent message for that arrangement; all exact final files pass Khronos with zero issues and move correctly in Three.

All beauty/front/back/side stills and all three motion grids were visually inspected. Motion-grid rows are `idle`, `move`, `attack`, `hit`, `defeat`, with four samples per row. The stills and videos show the exported geometry and materials, not a separate presentation model. The five clips show distinct articulated motion, readable attack preparation/recovery, recoil and a final collapsed or drooping defeat pose.

## Runtime contract

All assets use **runtime scale 1.0**, meters, glTF +Y up and forward -Z. The root is at ground origin and never supplies controller movement. Construction scale correction is already baked into geometry and rig; do not apply that historical correction again. Ground-to-top / lowest rest geometry: Blockling **0.85 / 0 m**; Signal Moth **0.90 / 0.12 m**; Buffer Baron **1.85 / 0.10 m**. The moth's rest wingspan is **1.25 m**. Motion extends beyond rest bounds; full sampled extents are recorded in each `three-inspection.json`.

All three have `idle` **2.5 s**, `move` **1.0 s**, `hit` **14/24 s** (0.583333 s; glTF float value 0.5833333135) and `defeat` **1.75 s**. `idle` and `move` loop. Other clips play once; `defeat` ends in a collapsed or drooping pose and the runtime must set `LoopOnce` plus `clampWhenFinished` to hold it until removal. glTF itself does not encode that playback policy. Stop actions, uncache the mixer root and dispose the owning model's resources when removing an encounter.

| Attack | Duration | Contact time | Contact fraction | Follow-through |
| --- | --- | --- | --- | --- |
| Blockling | 1.25 s | 0.65 s | 0.52 | 0.60 s |
| Signal Moth | 1.25 s | 0.70 s | 0.56 | 0.55 s |
| Buffer Baron | 1.75 s | 1.05 s | 0.60 | 0.70 s |

These are the authored contact cues to map to controller wind-up/strike/cooldown. The per-asset `runtime.json` records the same scale, origin, clip and playback contract for intake.

## Measured checks

- **Khronos glTF Validator:** all three final GLB hashes have zero errors, warnings, infos and hints. Exact clip set, embedded resources, budgets, UV/color attributes, one skin and opaque surfaces pass.
- **Blender 4.5.13 LTS re-import:** matching GLB hashes; rest dimensions and all five actions inspected, with 17 geometry-bound samples per clip. Separate final renders provide four 700 × 800 stills, a 960 × 1400 motion grid, five individual MP4s, a combined MP4 and a three-second turntable per asset.
- **Three r186 CPU intake:** real embedded-image decode and `GLTFLoader`/`AnimationMixer`, 49 time samples per clip, sampled skinned vertex displacement and precise geometry bounds. All clips move actual vertices; idle/move seams close within 0.3 mm; fixed root and external scene translation pass. Sampled floor penetration stays within the 4 mm tolerance and all geometry is finite.
- **Actual Chromium 153.0.8010.12 WebGL intake:** all three final files render every clip with exactly six color-pass draw calls and matching triangle counts. No page errors, WebGL errors or external requests. Each loaded model reports six geometries and three GPU textures including skeleton data; resources are disposed between models.
- **Video audit:** all 21 MP4s are H.264/yuv420p at 480 × 560 with measured durations within 0.05 s of the contract. Individual motion previews use 24 rendered samples retimed to authored duration; the turntable uses 36 samples over three seconds. These bounded previews are not a frame-by-frame production animation bake.
- **Repository checks:** `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` pass. Tests: 67 passed, eight Postgres tests skipped without a dedicated database; 13 files passed and one skipped. The existing Vite chunk-size advisory remains. No Postgres integration claim is made by this authoring lane.
- **Documentation:** `PATH="/home/dev/work/haynes-quest-overnight-mvp/.venv-docs/bin:$PATH" scripts/docs/build.sh` passes the staged documentation/media link check and strict MkDocs build. Python construction/packaging sources compile and JavaScript inspection sources pass syntax checks.

The WebGL evidence uses Chromium software rasterization (SwiftShader). It does not establish physical Safari behavior, target-device frame time, gameplay admission or owner approval. These are authored browser candidates with simplified fine foliage/grain/ornament; the exports do not claim a pixel-identical reconstruction of the concept paintings.

## Lease and process completion

**The live Blender scene was explicitly released at 2026-09-11 14:38:57 UTC with root authorization.** The 2024 Astra author received the live lease. WO-014 made no later live-scene call; remaining work was restricted to its separate immutable-GLB render processes and artifact I/O.

| Isolated render | PID | Matching-hash completion, UTC | Final process state |
| --- | --- | --- | --- |
| Blockling | 19265 | 2026-09-11 14:28:52.227933 | Exited |
| Signal Moth | 19688 | 2026-09-11 14:35:34.435806 | Exited |
| Buffer Baron | 22588 | 2026-09-11 14:38:25.852384 | Exited |

[Process completion](../../scripts/assets/era-2020/render-process-completion.json) was verified at **2026-09-11 14:43:33.868275 UTC**. No WO-014 render job remains pending. The superseded Baron PID 22021 was identified by its exact command line, terminated and reaped before the final halo revision. The [lease record](../../scripts/assets/era-2020/scene-lease.json) preserves the release event and the isolated process ownership at handoff. Explicit UTC timestamps are used here; Blender console lines used the container's local UTC−4 display.

The authoring scope is complete. Root can integrate the scoped commits and candidate media; Tom's review remains the separate final asset-promotion gate.
