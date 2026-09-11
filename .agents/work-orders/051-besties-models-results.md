# WO051 model handoff

Status: complete authoring handoff. Both exact candidate models, editable masters, reimported views, joint pose, all-clip reel, manifests and catalog intake are local. Scene and browser ownership are released; all owned processes have exited and been reaped. Root owns catalog publication, integration and checked PR/release.

The approved joint input was inspected directly, SHA256 `1fb8f525b23c811dd1c3946faca219224bb10800c2517ae87ffdb40beaa0aee1`. No additional concept images, audio, downloaded models/textures or private inputs were used. Native Astra max authored the geometry, materials, rig, animation and evidence scripts. Root owns catalog prose, inventory/navigation, client/server integration and release.

| Asset | Version | Triangles | Opaque primitives | GLB bytes | SHA256 |
| --- | --- | ---: | ---: | ---: | --- |
| `bestie-pink` | v001 | 14,588 | 5 | 956,924 | `0f7020f53ed257dd88e6a8cb9e8fb0011c70e84bf33bc2e55fb671473aea96ae` |
| `bestie-black` | v001 | 14,056 | 5 | 928,000 | `0819c67a17d38f340ace0ebdaff6bd316a800286af7f7a0da91273e898d80f05` |

Each runtime asset lives at `docs/assets/media/<id>/v001/<id>.glb`, with an editable `<id>.blend`, original `pigment.png`, construction/validation records and reimported reviews beside it. All build, atlas, export, rendering, transfer and checking sources are under `scripts/assets/bickering-besties/`. Both assets are exactly 1.4m tall at rest, Y-up/-Z-forward, floor at Y=0, scale one, stationary root. Each has one original embedded 1024² atlas, five materials, a connected 21-bone hierarchy, continuous weighted sleeves and trouser legs, and explicit ankle collars.

| Clip | Duration | Runtime behavior |
| --- | ---: | --- |
| `idle` | 2.4s | Loop |
| `move` | 1.2s | Loop, in place with alternating foot support |
| `attack` | 1.6s | Once; obstacle gesture contacts at 1.0s / 0.625 fraction |
| `hit` | 0.6s | Once |
| `defeat` | 2.0s | Once; comic sit held at end, no fade/removal |
| `cheer` | 2.0s | Loop |
| `high-five` | 1.6s | Once; pink right hand / black left hand |
| `dizzy` | 2.4s | Loop |

For the agreed runtime staging, both actors face `Math.PI`: pink is on world +X, black on world -X. Root moves their centres from ±1.25m to 0.90m apart at high-five t=1.0s, then returns them for the shared dizzy recovery. No added depth offset is needed. The 0.90m spacing clears every surface of both actors at t=0.85s, 1.0s and 1.15s; the palms miss by approximately 7.6cm. The preliminary 0.80m spacing allowed the sleeves to graze and is superseded. Root owns one boss encounter and one reward. The authored wrist/tip coordinates at t=1.0s are in each `attachment-foot-inspection.json` and the final intake; the small height/depth miss is intentional.

Validation completed on the exact GLBs: Khronos reports zero errors, warnings, infos and hints; budgets/embedded resources pass. Three GLTFLoader/AnimationMixer checks cover all eight clips, every loop seam, animated bounds, unit attachment root, SkeletonUtils clone independence, track binding and exact attack timing. Anatomical seams remain below 0.00000022m; weighted sole samples stay within 0.07mm of the plane in planted clips. Blender matches every named source vertex and weight to the reimported GLB and checks all required sleeve/cuff/hand and trouser/collar/shoe surface attachments in all clips. Chromium 153.0.8010.12 software WebGL renders six draws including one floor, with no browser/GL errors or external requests and four distinct rasters per clip.

Final art approval remains with Tom. These checks establish exact export/rig behavior; physical Safari, device performance and integrated gameplay remain root's separate verification scope. No commit, push, deployment, cluster change or dev-env restart was performed.

Final intake is `scripts/assets/bickering-besties/catalog-intake.json`; `sha256-manifest.json` binds all delivered media, sources and technical records. Each actor's `manifest.json` and `runtime.json` contain its exact resource and animation contract. Preferred thumbnail source is each actor's `beauty.png`.

Shared media live under `docs/assets/media/bestie-pink/v001/`: `joint-pose.png`, `joint-motion-grid.png`, `joint-animations.mp4` and `joint-export-review.blend`. The 13.8s reel contains all eight clips for both actors, rendered at 10 samples/s and encoded as H.264 720×560, 30fps, yuv420p, with 414 frames and no audio. It is 602,737 bytes, SHA256 `214b423c6c7aeaa73743665feb31952256a5df31b6a68557f2d0fa0bd5d8cdc7`; a full FFmpeg decode passed. All per-model orthographic/beauty views, the full-body pair pose and all representative clip poses were visually inspected. `visual-review.json`, `video-inspection.json` and `pair-inspection.json` retain that evidence. No extra per-model reels were generated.

The editable pink master is SHA256 `c4f1b422552a64e8fdc283425b753c30f84e90d31e81aae54010ad046d30f0a2`; black is `f4e43b9061ead88e7bd90ce34669ccb66c08b8330ce854789cde7478c6468b85`. Each contains the final build-source text blocks, separately hashed in `authoring-source.json`.

Scene released September 11, 2026 at 23:02:30 UTC. Final recovery checkpoint: `/workspace/haynes-quest/bickering-besties/v001/live-scene-release.blend`, SHA256 `927ee5a27a13707798ed0e1a98060f9eeda999de6fe485cf4bda410055a74e2f`. The earlier Nap checkpoint remains unchanged at SHA256 `9a84bd4c72e70292512bd605f4da44f6fcccdca290816d230aa0bc053c972afe`; a separate safety copy is preserved in the Besties remote directory. `scene-lease.json` records no current owner, no running render and no owned worker. `processes.json` records completion, including the stopped superseded framing pass. Both isolated browser sessions and their ephemeral servers closed before release.
