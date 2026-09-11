# WO-016: Ribbon Fair candidate delivery

- Status: Complete authoring, exact-byte delivery and isolated browser intake. Root selected the final shapes for first-pass packaging; owner approval and integrated gameplay/studio intake remain pending.
- Author: fresh native `gpt-6-astra`, `max`, `/root/era_2024_authoring`.
- Worktree: `/home/dev/work/quest-era-2024-models`, branch `agent/quest-era-2024-models`, base `abee156`.
- Scope: only this evidence file, `scripts/assets/era-2024/` and generated media under the three owned `v001` directories. Lead concepts, prompts and provenance were read without modification.
- Scene lease: claimed at 2026-09-11 14:40:05 UTC after root's explicit grant; released at **14:57:02 UTC**. No live-scene call occurred after release. The final live master was the corrected Prism Mimic rig/skin. Earlier 2020 masters and the addon were preserved.

## Exact candidates

| Asset | Triangles | Materials / color draw primitives | GLB bytes | Rest height / clearance |
| --- | ---: | ---: | ---: | --- |
| Loop Dancer | 14,848 | 6 / 6 | 1,096,328 | 1.10 m / 0 m |
| Prism Mimic | 14,770 | 6 / 6 | 1,079,220 | 1.05 m / 0 m |
| Trendweaver | 14,874 | 6 / 6 | 1,089,712 | 1.90 m / 0.12 m |

All are GLB 2.0, meters, +Y up, forward -Z, with a fixed ground-centered root and one embedded original 1024 × 1024 pigment atlas. No external resource or decoder is required. Loop Dancer has 22 rig bones including root; the other two have 18 each. Geometry joins into six material primitives while independent limb, tail and ribbon bones retain motion.

GLB SHA-256:

- Loop Dancer: `99e2ddac66bc2f63fa00e44b1b9b7513c083023d9926343bc67ce52ecfbf9e79`
- Prism Mimic: `60b6fe89f1397fe32269d6f858f91f3cb9a0c6459f03595d24257830a170aef0`
- Trendweaver: `2191ef48a3e71853f0e67899b9335a18b8e31c5ede33f43e39f24dcd2adc64ce`

## Motion contract

| Asset | idle | move | attack | hit | defeat | Attack contact |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Loop Dancer | 2.5 s | 1.25 s | 1.5 s | 0.625 s | 2 s | 0.75 s / fraction 0.5 |
| Prism Mimic | 2.5 s | 1.25 s | 1.25 s | 0.625 s | 2 s | 0.625 s / fraction 0.5 |
| Trendweaver | 2.5 s | 1.25 s | 1.875 s | 0.625 s | 2 s | 1.125 s / fraction 0.6 |

Idle/move loop; attack/hit/defeat play once. Defeat holds its authored terminal pose, with no embedded fade or root movement. The controller maps its windup/strike/cooldown to the recorded contact fraction and handles movement/removal. The dancer slumps, the fox rolls sideways, and the hovering boss tilts and settles downward.

Every exact clip passed 49-sample Three geometry inspection, including actual skinned vertex displacement, fixed root, loop seams, translated-scene behavior and finite bounds. Maximum idle/move seam error is 0.1501 mm. Sampled floor penetration is 0.374 mm for Loop Dancer and 1.536 mm for Prism Mimic; Trendweaver remains above ground. These small visual bounds do not define collision.

## Inspection and corrections

The three selected concept PNGs were visually inspected; exact hashes are in `scripts/assets/era-2024/source-concepts.json`. The source retains the winding key and two scarf anchors; four feet, two ears, one fox mask and one tail; and five crown arches, two arms, two rear ribbons, three bobbins and the left-hand shuttle.

Creator/lead intake corrected the dancer's cap/base opening and trimmed small-detail density without changing its selected proportions. Fox mask transforms and ankle joins were corrected. Its tail became one uninterrupted skinned surface with a material transition, eliminating the earlier wooden/sage seam in the exact back view. Trendweaver's overlapping thread shells became continuous ribbed surfaces, preserving its winding silhouette within budget. Earlier geometry/source candidates remain under remote `iterations/`.

The author inspected all exact front/side/back/beauty renders, all three five-row motion sheets, and actual Chromium renders. Root explicitly selected the final corrected shapes for first-pass packaging. These are original fictional candidates, not approved gameplay assets.

## Validation and delivery

- Blender **4.5.13 LTS**, original scripted meshes, rounded relief, retained pigment graphs, packed atlas, armatures/NLA clips and editable masters.
- Khronos validator: **zero errors, warnings, infos or hints** on all three exact GLBs; budgets and resource/clip contracts pass.
- Three revision **186**: real GLTFLoader, decoded embedded atlas and AnimationMixer/CPU skinned vertex inspection; all checks pass.
- Separate **Chromium 153.0.8010.12**, ANGLE SwiftShader: exact GLB hashes, one decoded 1024-pixel image per model, six skinned draw primitives, seven actual color calls including the test ground, and four distinct rendered samples for every clip. No page/console/WebGL errors or external network requests. The temporary browser and HTTP server were closed. This is software WebGL intake, not integrated gameplay or physical-device performance.
- All 60 remote files were downloaded and SHA-256/length checked. Each model has front, side, back, beauty, five-clip motion grid, five separate H.264/yuv420p clips, combined animation reel and turntable. Remote FFprobe verified codec, dimensions, durations and no audio.
- Local manifests add the verified browser screenshots/report and final creator intake. The remote delivery manifest remains the original transport inventory. `collection-verification.json`, `master-download-verification.json`, `local-finalization.json` and `final-candidate-summary.json` retain the evidence.
- All Python sources parse, all JavaScript sources pass `node --check`, and the final scoped diff passes whitespace checks. App tests and integrated studio/game journeys belong to root's integration work.

Final authoring PVC directory: `/workspace/haynes-quest/era-2024/v001`. Download through `http://blender-authoring.dev.svc.cluster.local:8000/artifacts/haynes-quest/era-2024/v001/` plus the manifest-relative filename. The three editable masters were also retrieved to `/home/dev/work/quest-era-2024-models/test-results/era-2024-masters/<asset>/<asset>.blend` on the local PVC; their exact hashes are in the public candidate manifests and master verification record.

After lease release, isolated immutable render PIDs 31411 (Prism Mimic) and 29043 (Trendweaver), each limited to three CPU threads, finished their explicit GLB packages. Loop render PID 27970 had already exited. Filesystem-only finalizer PID 31918 completed the checked inventory with delivery exit 0; `finalize-status.json` records the result. No scene mutation, new image generation, private media, OAuth, live database, deployment or dev-env change occurred after or as part of this work order.
