# WO028 authoring evidence

Worktree `/home/dev/work/quest-block-party-pair`, branch `agent/quest-block-party-pair`, initial base `3985dbe`. Fresh native GPT-6 Astra at max authored both candidates. Root retained concepts, art direction, review pages and integration. No push, PR, infrastructure, OAuth, private image inputs, downloaded meshes/textures or paid API calls.

Read AGENTS, TEAM, WO028, WO027 delivery contract, DESIGN002/005/007/011, art brief and asset-review template; inspected both exact committed concepts with `view_image`. Root confirmed glTF **-Z forward**, +Y up, meters, feet Y0 and a unit caller-controlled root. No extra runtime yaw correction is required.

## Final candidates

| Measurement | Peel Patrol v001 | The Drama Dragon v001 |
|---|---:|---:|
| GLB bytes | 652,424 | 917,980 |
| Rendered model triangles | 9,084 | 11,960 |
| Opaque material primitives | 4 | 3 |
| Joints | 21 | 29 |
| Editable named source parts | 71 | 110 |
| Neutral total height | 1.15 m | 1.80 m |
| Neutral width/span | 0.49 m | 2.60 m |
| Neutral depth/nose-to-tail | 0.414399 m | 3.00 m |
| Embedded original atlas | 1024×1024 JPEG | 1024×1024 JPEG |
| Major attachment seams checked | 13 | 16 |

GLB SHA-256:

- Peel Patrol: `72962eb3a1cb2a08e13d9082dd506fbe7186798f48d0dee7af3cdd72b7891ed5`
- Drama Dragon: `13c6cb5185385f85cda2e16027ad201a2ea1e2a4ad0f5eb7a13cba9d073fa933`

Both satisfy the 2 MiB / 15,000 triangle / six opaque material and primitive ceilings, without external resources or decoder requirements. Original deterministic pigment PNGs, atlas generation and build sources are retained. Meshes have softened hard edges and textured surfaces. Editable `.blend` masters retain named construction parts and the combined runtime skin. Runtime exports contain only the intended model, rig and five clips.

Peel has two attached arms, two legs, four fingers per hand, navy cap/vest, banana badge, exactly one secured whistle and exactly one trailing strip attached at the left belt. Root selected actual GLB front/back/quarter views, then the corrected seated slip. The final stance and animation corrections retain that geometry. The cord reaches the whistle through its lift; the belt strip stays attached during the lunge and seated defeat.

Dragon has four cuboid legs with three toe blocks per foot, two angular wing membranes with gray struts, one eight-segment tail, two short gray horns, purple eyes, one attached three-point cardboard crown and a plum ruff with a connected brass back clasp. Root selected the corrected visible clasp, sideward quarter, exact side and seated defeat. The sideward quarter exposes the tail and four feet. Ordinary idle folds the wings; the dimensioned authored rest retains the full 2.60 m span. The tail rises clear during the seated huff.

Lead selection is recorded in each `lead-checkpoint-review.json`; **owner approval remains pending**.

## Animation and runtime contract

| Clip | Peel duration | Dragon duration | Playback |
|---|---:|---:|---|
| `idle` | 2.5 s | 3.0 s | repeat |
| `move` | 1.2 s | 1.6 s | repeat |
| `attack` | 1.6 s | 2.0 s | once, clamp |
| `hit` | 0.6 s | 0.7 s | once, clamp |
| `defeat` | 2.0 s | 2.4 s | once, clamp and retain terminal seated pose |

Peel attack contacts at **1.0 s / 0.625**; Dragon stomp contacts at **1.25 s / 0.625**. Float32 duration measurements are within 0.0000001 s of the intended timings. Animation is authored at 40 fps. Preview videos sample at 20 fps and play at the exact runtime durations. Visible lunge/stomp motion is articulated in place; neither clips nor cloned skeletons translate the caller's root. Defeat contains no embedded fade: removal must wait until its duration completes.

## Actual checks

- Khronos glTF Validator: zero errors, warnings, infos and hints for both exact final GLBs. Budgets, clip set, UVs, one embedded image, opaque surfaces, one skin, normalized weights and at most four influences pass.
- Blender 4.5.13 LTS reimported each final GLB for front/back/side/quarter images and animation media. The importer scene runs at 40 fps before import, preserving exported clip timing. Image and motion reports record the exact GLB hashes.
- Source-to-export comparison matched every vertex of all 71 / 110 named parts at zero measured displacement, with unchanged joint influences. All thirteen / sixteen tested construction seams intersect physically. Explicit counts verify Peel's single whistle/strip and Dragon's four feet, two wings, eight tail segments, crown and clasp.
- Three r186 GLTFLoader decoded the embedded images and measured actual skinned vertices through all five clips. Dimensions, finite geometry, floor bounds, fixed root, idle/move loop seams, attack clamp, exact contact timing, complete track binding below the attachment root and independently animated SkeletonUtils clones pass.
- Detailed Three foot inspection samples every clip plus exact contact. Largest limb seam separation is 0.000000083 m for Peel and 0.000000156 m for Dragon. Lowest sampled boot vertices are -0.000314 m and -0.000546 m, within the declared 0.002 m tolerance. Idle feet remain grounded and march phases retain stance support. Peel has one grounded boot at contact (the other lifts 0.01 m); all four Dragon feet are grounded at 1.25 s.
- Isolated Chromium 153.0.8010.12 with ANGLE SwiftShader loaded the exact exports through Three r186. Every clip changes actual raster output; no browser/WebGL errors or external requests. Observed color-pass counts are four / three model draws and 9,084 / 11,960 model triangles; diagnostic floor adds one draw and two triangles. Browser and temporary local server were closed.
- Inspected actual exported front/back/quarter/side, contact and terminal defeat views and both completed five-row motion grids. Peel shows the march, whistle lift/lunge, wobble and seated slip with attached props. Dragon shows its four-foot march, wing raise into stomp, offended recoil and seated head-bow/huff; crown, clasp, wings and tail remain attached. Numeric skin/foot checks cover the intermediate poses and exact attack contact that the grids sample sparsely.
- Python compile and JavaScript syntax checks pass for the authored utilities. Full application CI, integrated gameplay, physical iPhone/iPad Safari and hardware GPU performance are root/integration concerns and are not claimed here.

## Sources and transfer

Remote root: `/workspace/haynes-quest/parody/block-party-pair/v001`. Each asset subdirectory contains its editable master, exact GLB, export-review `.blend`, original pigment and source, all views, five clip videos, combined reel, turntable and evidence. Access is through the authoring service `/artifacts/haynes-quest/parody/block-party-pair/v001/` route.

Editable master hashes:

- `peel-patrol/peel-patrol.blend`: 9,172,051 bytes, `d9dacbbee93b4b660e64ed351092731016a184fc38a64eb45b73dabe76628e5e`
- `drama-dragon/drama-dragon.blend`: 13,530,294 bytes, `59a45076f2cc5ab6f12b135b8272cbd771a25724d9275cfb98f24948f2fd9561`

Per-asset manifests contain every file's bytes and SHA-256, source provenance, measured dimensions, exact clip/contact contract, video stream metadata, validation summaries and owner-pending status. Shared delivery/source inventories and transfer verification reside in `scripts/assets/parody-block-party-pair/`. Large masters are downloaded and hash verified into that directory's ignored `masters/`; exact per-asset build snapshots remain tracked under `snapshots/`, with hash-checked `source-build.json` transfer envelopes alongside the candidate media. Shared source utilities also roundtrip through `source-bundle.json`.

Final collection verified **81 artifact/decoded-snapshot records and thirteen source utilities**, including all five `.blend` files. A separate local reread confirmed every recorded byte length and SHA-256. All required media exist. Every video is H.264/yuv420p at 20 fps with no audio; the combined reels are 7.9 s / 9.7 s and both turntables are 3.0 s. All ten individual clip video durations match the table above. Final shared delivery manifest: 192,326 bytes, SHA-256 `c8718f39d1690941555b6131d4dd650e8eeb4b9b4e28b2664f4b993993efc7c1`.

Remote encoding and `ffprobe` stream checks completed successfully. An optional local full-video `ffmpeg` decode check could not run because that binary is absent in dev-env; no local decode pass is claimed.

The immutable root-selected concept, prompt and provenance files are preserved. Concept hashes remain `4ce40a6669cec9ad87e249c877c7c73cf8633369bd0ae30ee3ffcdadc6f60be5` (Peel) and `d4983359fa757c7a5aa647117ece7d29553061dd38386ba03fb23ab6749af7c8` (Dragon).

## Lease and process state

Preparation was offline until root granted the exclusive lease after WO027 release at 2026-09-11 16:20:52.953 UTC. Authored Peel then Dragon serially. No factory reset or addon unload occurred. Previous WO027 `/workspace/haynes-quest/parody/mister-hiss/v001/live-scene-release.blend` remains 8,246,307 bytes with SHA-256 `d44ef91177adcc469431efa2310b56384bc37d168aabeea0671effaf54e9871f`. Earlier work-order checkpoints and retained correction iterations remain on the remote PVC.

**Released at 2026-09-11 17:05:53.540911 UTC.** All eleven owned Popen workers exited zero and were waited/reaped; all retained log handles were closed. Final Dragon render PID48115 exited zero with both stills and video completion flags true. Complete PID/command/exit records are in `render-process-completion.json`.

Final live checkpoint: `/workspace/haynes-quest/parody/block-party-pair/v001/live-scene-release.blend`, 13,540,486 bytes, SHA-256 `d89132f2ba7526a78b933aca4dea9de248cc7653a710d09e49abd2e5885c7b3c`. The previous WO027 checkpoint hash was rechecked unchanged before release. Metadata packaging and route downloads are complete. Root received an explicit lease/process release; this author has no active service jobs or remaining scene writes.
