# A7 synthetic render cost · 2026-10-04

The isolated editor playtest returned the checked-in World A v7 Toon Clubhouse chapter unchanged: `family-world-a` revision 2, project fingerprint `5d8773fa545c019944b4a022cf978ddfb9349e5e9f9c22bbf13ad6d344df4850`, authored-level-v4 theme `clubhouse`, and 71 placed props. Every requested model loaded and there were no page, console or HTTP errors. The [first-fight capture](a7-first-fight-before.png) shows the original sparse route at an ordinary enemy; its broad red and lime platforms are the authored clubhouse palette, rather than a missing theme.

The same A7 project was loaded in local synthetic ephemeral fixtures on the same host and studio directory. Port 3014 ran game source `ea5f86c74807eddcf29c7ac0ed628f59722fc5e7`; port 3015 ran `babb8ee6e1bd1d9634b72064b7f609c32ea653a4`, including two-call slab face grouping and an unused static-primitive merge. That merge finds no repeated same-material primitives in the current kit files and is excluded from the release. The separate source diagnostic attributed the draw-call change to the course surfaces; other scene-owner counts were unchanged. Both samples used Playwright Chromium with ANGLE SwiftShader at a 1280×760 CSS viewport and 0.25 device scale. The page clock flowed normally for at least three seconds after all critical models loaded, then for a five-second frame and WebGL draw-call sample.

| A7 spawn | [Before grouping](a7-spawn-before.png) | [Grouped slabs](a7-spawn-grouped.png) |
| --- | ---: | ---: |
| Draw calls per frame, mean | 515.6 | 362.1 |
| Real frames in five seconds | 77 | 70 |
| Mean frame interval | 62.26 ms | 76.79 ms |
| P95 frame interval | 393 ms | 516 ms |

Observed draw calls fell by 153.5 per frame, or 29.8%. Both runs fetched the same 18 GLBs totaling 7,122,036 bytes, and both returned the same frozen project fingerprint. Five fixed static crops across the pads, sky and clubhouse tower covered 145,625 pixels; every RGB pixel was byte-identical in the two full-resolution screenshots. The whole screenshots differ as the tokens animate. The unoptimized A7 [first-fight capture](a7-first-fight-before.png) also has a separate warmed real-time sample: 67 frames in five seconds, mean 74.51 ms, P95 489 ms and 513.8 draw calls per frame. The normal-control lockstep route reached that fight in 820 stepped frames with no recovery.

The second spawn frame-time sample was slower despite fewer draw calls. These short software-rendered samples on a busy shared host show render cost and a visual equivalence check; they do not establish a frame-time win, physical-device FPS, iPhone or iPad Safari behavior. Exact method, paths, loaded models, crop coordinates and errors are in [the paired JSON record](a7-render-cost.json).
