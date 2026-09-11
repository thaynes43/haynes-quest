# WO-014 authoring evidence

- Native Astra max owns the exclusive Blender scene and `agent/quest-era-2020-models` from `f0756bc`.
- Status: all three candidate models saved; final view/motion collection and artifact audit in progress. Candidate production only, no owner approval or gameplay promotion.
- Inspected all three exact concept images before construction using the local image viewer. Blockling is explicitly a four-footed animal despite the partially occluded reference.
- Remote root: `/workspace/haynes-quest/era-2020/v001`. Prior traveler and clearing masters remain untouched. No factory reset or addon unload is permitted.
- Delivery will retain editable masters, exact GLBs, re-imported views and motion evidence, construction scripts, checksums, Khronos reports and Three animation intake.

## Durable checkpoint · 2026-09-11 10:35 UTC

**Exclusive live scene lease remains held by WO-014.** Root's queued 2024/equipment authors are offline only. Current live scene is the saved Buffer Baron rig and mesh. Remote masters and exports are in each asset's folder below `/workspace/haynes-quest/era-2020/v001/`; no prior traveler/clearing master was changed.

| Candidate | GLB SHA-256 | Triangles | Bytes | Materials / primitives |
| --- | --- | --- | --- | --- |
| Blockling | `57f8cf41898c856f90d3aa4df50880c242db9718a8df9acbda3fa46d06fcc1cb` | 14,930 | 1,121,948 | 6 / 6 |
| Signal Moth | `9e964faf1b483193a399cb0e410a5b6d6e68ccd158c16bf2d2a88cbbaa9144fe` | 13,520 | 1,083,900 | 6 / 6 |
| Buffer Baron | `9d343e07e9d2593fce5ad9c99df29672ac81cc235ea66fdd276199b7c6da6915` | 14,840 | 1,195,688 | 6 / 6 |

Blockling and Moth passed exact-byte Khronos validation with zero errors/warnings/infos/hints and the six-primitive / 15k-triangle / 2 MiB contract. The Baron before its bounded halo translation passed the same checks; the final moved-halo bytes still require the final validator rerun. All three passed actual Chromium/SwiftShader WebGL intake with six color-pass draw calls and matching triangle counts, no page/WebGL errors, and no external requests. This is functional software rasterization evidence, not physical Safari or performance evidence. CPU Three GLTFLoader/AnimationMixer checks passed all five actual-deformation clips, root translation, idle/move seam closure and floor clearance for Blockling/Moth and the earlier Baron; final Baron rerun remains part of collection.

Source remains in `scripts/assets/era-2020/`, with the exact historical source also embedded in each master and extracted as remote `construction-source.py`. Every GLB embeds one 1024-pixel original procedural pigment image; lossless `pigment.png` remains separately with the editable master. No external meshes, texture downloads, image generation, private reference or family input was used.

Final render commands run in isolated background Blender processes: Blockling PID `19265`, Moth PID `19688`, Baron PID `22588`. Blockling's completion file exists; current-hash completion is verified during collection. Moth and Baron were still pending at the last check. The superseded Baron render PID `22021` was verified by its exact command line, terminated and reaped before the requested halo revision. The lease will be released only after all remaining owned subprocesses finish.

Root reviewed and selected Blockling and Moth for first-pass candidate packaging, then requested only the Baron's lower two halo pieces be fanned outward/up with space above its collar. That bounded adjustment is saved in the final Baron hash above; exact front/beauty views have been retrieved for final lead review. No Tom approval is implied.

## Runtime contract

All assets use **runtime scale 1.0**, meters, glTF +Y up and forward -Z. The root is at ground origin and never supplies controller movement. Ground-to-top / lowest rest geometry: Blockling 0.85 / 0 m; Signal Moth 0.90 / 0.12 m; Buffer Baron 1.85 / 0.10 m. The moth's exact posed wingspan is 1.25 m.

All three have `idle` 2.5 s, `move` 1.0 s, `hit` 14/24 s and `defeat` 1.75 s. `idle`/`move` loop. Other clips play once; `defeat` ends in a collapsed or drooping pose and the runtime must set `LoopOnce` plus `clampWhenFinished` to hold it until removal. glTF itself does not encode this playback policy.

| Attack | Duration | Contact time | Contact fraction | Follow-through |
| --- | --- | --- | --- | --- |
| Blockling | 1.25 s | 0.65 s | 0.52 | 0.60 s |
| Signal Moth | 1.25 s | 0.70 s | 0.56 | 0.55 s |
| Buffer Baron | 1.75 s | 1.05 s | 0.60 | 0.70 s |

Pending before handoff: finish matching-hash videos/turntables, inspect motion sheets and sides, rerun final Baron validation/Three, stream/hash-verify all delivery files and masters, write runtime/delivery manifests, check docs/media links, commit only owned paths and explicitly release the lease. Root owns integration, PR/merge, catalog/review prose and gameplay promotion.
