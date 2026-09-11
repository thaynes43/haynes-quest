# WO-007 traveler authoring evidence

- **Owner:** native `gpt-6-astra`, `max`, fresh context
- **Branch/worktree:** `agent/quest-blender-travelers`, `/home/dev/work/quest-blender-travelers`, from `e01c211`
- **Status:** Complete; all required candidate files delivered and verified, ready for lead intake
- **Scope:** `scripts/assets/travelers/**`, the infant/child `v001` media directories, this evidence record. No gameplay promotion, review-page copy, PR or merge.
- **Scene lease:** **RELEASED at 2026-09-11 04:37:50 UTC.** The next author may replace the saved child scene. Remote `scene-lease.json` records the release.
- **Durable root:** `/workspace/haynes-quest/travelers/v001` in `blender-authoring`; GET artifacts through `http://blender-authoring.dev.svc.cluster.local:8000/artifacts/haynes-quest/travelers/v001/`.

## Candidate construction

Inspected the coordinator's actual `traveler-ages.png`, `environment.png` and `props-materials.png` with `view_image` before authoring. Their SHA-256 values are embedded in `build.py` and the manifests. No image generation, imported meshes, downloaded textures, private likeness or family inputs were used.

Both figures have a plum cloth hood with a geometric recessed lining, leaf tunic, honey round clasp, wearer-right satchel, mittens and muted boots. Age growth changes head/body/limb proportions. The primary mesh is skinned to a shared set of 16 bone names, with age-specific rest poses and authored clips. No arbitrary animation retargeting claim is made.

Blender is Z-up with forward +Y; standard glTF export converts to Y-up with forward -Z. Standing soles are at zero, scene units are meters, and assets are 0.75 m / 1.20 m. Root translation stays fixed; external controller movement remains outside these assets. The child jump includes a 0.17 m local visual lift on the pelvis. Color variation is baked into vertex colors; eight materials, no image textures, UV maps or external decoders.

| Final geometry | Infant | Child |
| --- | --- | --- |
| Triangles | 11,296 | 11,296 |
| GLB bytes | 448,656 | 460,616 |
| Materials / joints | 8 / 16 | 8 / 16 |
| Clips | `idle`, `move`, `interact` | `idle`, `move`, `interact`, `jump` |
| Clip durations | 2 s, 1 s, 2 s | 2 s, 1 s, 2 s, 1.5 s |
| GLB SHA-256 | `1c7c2ae03f888d5164bbee2c99b4180b1e275f19979019b659bf757f1b6de64c` | `4fc44919588b16ec1055bbb042fda326571ce1f4ebfc484535f102293bd7ff4e` |
| Master SHA-256 | `3cabf68bb6d9af4a607185b3a69927ef2add54ba0211f78d1e7be4843bcade2b` | `6370d57445e7cc1a42877d9e257f7b37c7b31a051cbb764e373c93270a2a9138` |

Masters are `traveler-infant.blend` and `traveler-child.blend` under the durable root. Each contains the construction script as a text block, the editable mesh/rig and named NLA clips. Earlier inspected iterations are retained under `iterations/shape-a`, `shape-b` and `shape-c`.

## Verification and inspection

Khronos glTF Validator passes both exact GLBs with **zero errors, warnings, infos or hints**. `validate.mjs` additionally checks physical height, ground origin, exact clips, animation channels, vertex colors, skin influence limits, the 12k-triangle / 8-material / 2 MiB budgets and embedded resources.

The exact GLBs were also loaded through Three.js `0.186.0` `GLTFLoader` and sampled with `AnimationMixer` and precise CPU skinned bounds, 33 samples per clip. Every named clip deforms geometry; root bones remain fixed; translating the containing scene moves all geometry correctly. No decoder or external fetch was needed. These are CPU loader/skinning checks, not WebGL or Safari performance evidence.

The Blender preview pipeline reimports the GLBs and measures 17 samples per clip. The corrected maximum sampled sole penetration is approximately 0.7 mm for the infant walk, 2.3 mm for the child walk and 0.18 mm for the child jump. Standing soles are at zero within floating-point tolerance. Runtime collision remains independent.

Creator inspection found and corrected overly pale materials, sleeve shoulder joins, disconnected back satchel straps, boot strap orientation, coarse side hood curvature, a protruding crown seam and substantial jump landing penetration. The visible back scarf corner remains a small cloth silhouette detail. The final candidate intentionally retains smoother cloth, sparse embroidery, rounded mittens and a simpler satchel than the illustrated guide. It is not an identical textured reconstruction.

The final render job completed in an isolated background Blender process (PID `3803` when started), with `/workspace/haynes-quest/travelers/v001/render-final.log`. Delivered output: front, wearer-right side, back, beauty, age comparison, per-clip MP4s, combined reel and motion contact sheet. Creator inspected all matching views, both age variants together and the sampled clip sheets. Videos use H.264/yuv420p at original GLB clip durations; combined reels are 5 s infant and 6.5 s child. `delivery.py` checked completion, hashes, video streams/durations and matching validation before creating `delivery-manifest.json`.

The delivery manifest SHA-256 is `3c12d43457b75138c5ead04ad48635335ea2d45ab869b5d86443da0f0ef978f1`. `collect.py` downloaded and verified all 15 infant and 16 child artifact streams, including both masters; masters remain on the remote PVC. A separate local pass verified every collected file and repository script against the manifest. The strict MkDocs build and local links/media check passed (44 Markdown files checked). The installed Material package printed its general MkDocs 2.0 notice; no build or link failure occurred.

## Recovery record

The first build invoked `bpy.ops.wm.read_factory_settings` in the live MCP process. This unloaded the bridge addon and invalidated the active-object context. Logs showed the exact addon/active-object errors; no masters or GLBs were falsely reported as complete. The construction script had already been saved locally and on the authoring PVC.

Maintenance `act-041126-15493` declared only `dev,blender-authoring` for 10 minutes. After confirming the saved script and empty/partial scene, the dedicated old authoring pod `blender-authoring-845d777df7-dx98w` was deleted. Replacement `blender-authoring-845d777df7-qkwdz` reached Ready with zero restarts; native `get_scene_info` succeeded. Maintenance ended immediately. **Dev-env was not restarted.** The build now deletes authored objects/data explicitly, preserving the addon. Factory startup is used only for isolated background preview processes.

## Rebuild and collect

With the same scene lease, run the saved build through native `execute_blender_code` using a private namespace and `build('/workspace/haynes-quest/travelers/v001')`. Upload any changed script bytes explicitly; local repository paths are not mounted in the service. Background CLI equivalents in that dedicated service are:

```sh
blender -b --factory-startup --python /workspace/haynes-quest/travelers/v001/build.py
NODE_PATH=/usr/local/lib/node_modules node /workspace/haynes-quest/travelers/v001/validate.mjs /workspace/haynes-quest/travelers/v001
blender -b --factory-startup --python /workspace/haynes-quest/travelers/v001/render.py -- --stills --video
```

From the repository, `node scripts/assets/travelers/inspect-three.mjs docs/assets/media` uses its installed Three.js package. The actual check here supplied the lead worktree's installed Three package as the optional third argument. Copy that exact JSON evidence to the remote root, then run `delivery.py` there. Finally, `python3 scripts/assets/travelers/collect.py` downloads the scoped media and verifies every stream, including the remotely retained masters.

## Handoff gate

Creator inspection and technical validation do not constitute coordinator intake or Tom's approval. Candidate media stays in the asset studio. Physical iPad/iPhone Safari, production frame times, private likeness and gameplay promotion remain outside this work order.

All scoped media and source/evidence files are committed together on the branch named above. Lead owns cherry-pick/integration, review pages and final coordinator/owner decisions. No independent PR, merge or gameplay promotion was performed. The live scene was verified as the saved child mesh plus its armature, eight materials, immediately before release; no Blender work remains in progress for WO-007.
