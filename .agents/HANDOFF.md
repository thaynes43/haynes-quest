# Current handoff

**Active correction: [WO090](work-orders/090-app-wide-zoom-lock.md).** Tom clarified his son was playing and browser zoom must be disabled throughout the game app. The prior release below deliberately kept start-page zoom and is superseded by this requirement. Root owns the new app/release worktrees named in WO090; port 4422 is reserved for its candidate. Enemy models and platform requirements follow this repair.

**September 19: the phone page-zoom repair is deployed and verified.** [WO089](work-orders/089-phone-viewport-zoom.md) and its [release index](evidence/phone-viewport-release.json) preserve exact source, images, test results and cleanup. Tom reported that the previous joystick and memory repairs worked on his phone; this follow-up addresses the enlarged view that required quitting. No model authoring is running.

A trusted two-finger pinch over the old chapter heading reproduced browser zoom to 2.46× and cropped the controls. The game screen now uses `touch-action: pan-y`, blocking page magnification across its chrome while preserving vertical dialog scrolling. The canvas and thumb controls retain their existing gesture handling. Browser zoom outside gameplay remains available. JavaScript, camera behavior, geometry, progression and artwork are unchanged.

## Current private release

[Application PR48](https://github.com/thaynes43/haynes-quest/pull/48) merged as `9a01cbd034b50031638c81bc3e899089cd5eed1b`. Operations [PR2985](https://github.com/thaynes43/haynes-ops/pull/2985) merged as `8ee4b5f40ce9856f8b5e6fb5f04b475f40756649`. The verified private image is:

`ghcr.io/thaynes43/haynes-quest:sha-9a01cbd034b50031638c81bc3e899089cd5eed1b@sha256:3d5b0fd20b05f26e8f055ae6d180c86d4d432e7c240b6f01de9f90bba66bd678`

The hosted stylesheet is `index-BkwX-UiJ.css`, 41,908 bytes, SHA256 `55c0f3cd2eaec7ac3625bd9c6356ae3fd5007dd265582f3ff5d248f8678eab12`. JavaScript is `index-C4SUeEy7.js`, 1,193,022 bytes, SHA256 `c1ebea0d164c81561b58495dc2a992149bcb9ff1ccc34d651408b3cf319de81c`; those JS bytes match the previous release, so its digest alone cannot verify this fix.

- [Private playtest](https://haynes-quest-playtest.haynesops.com/): reload an older tab; each new test starts fresh, while in-game death retains memory checkpoints.
- [Playtest guide](https://haynes-quest-playtest.haynesops.com/studio/assets/playtest.html): controls, recovery and fictional scope.
- [Visual catalog](https://haynes-quest-playtest.haynesops.com/studio/assets/catalog.html): 37 entries and 54 navigation thumbnails, with versions, previews and approval status.

All 562 CI tests, including 12 disposable PostgreSQL cases, and the required app/docs/container checks passed. The same reviewed native-touch harness reproduces zoom on the old hosted header and keeps the candidate and new hosted game at scale 1, full viewport and zero offsets after header, canvas, HUD, Attack and Help pinches and header double taps. Help still scrolls, ordinary start-page pinch still works, and the initial visible controls remain in view. Bash is absent at the unarmed test spawn; no separate equipped-Bash bounds claim is made. The existing portrait regression independently passes failed-capture release/re-arm, independent fingers, resize and rotation on the unchanged JS with the new CSS.

These are Chromium 153 touch-emulation checks, not physical Safari acceptance or OS accessibility-zoom testing. The original phone gesture was not captured. The prior complete two-chapter and missed-memory recovery evidence remains in [WO085](work-orders/085-portrait-and-completion-repair.md), [WO086](work-orders/086-portrait-completion-browser-evidence.md), and [PLAN011](plans/completed/011-familiar-controls-and-checkpoints.md).

## Resources and next stage

The final rollout audit verifies exact image, JS and CSS, healthy endpoints, and unchanged normal Quest/dev-env state. Scoped activity `act-232102-94203` is ended. The owned `quest-phone-zoom-fixture` tmux session is stopped and port 4421 no longer listens. Preserve raw browser reports under ignored `test-results/` in `/home/dev/work/quest-phone-zoom-20260919`; the committed index carries their hashes and compact observations. The operations evidence is in `/home/dev/work/quest-phone-zoom-release-20260919/.private/quest-phone-zoom/`. Repository-only closeout records do not require another game deployment.

Tom's next sequence is a few more enemy models, then requirements and ADRs for the level-building platform. Discuss the next encounter concepts before expensive production, and keep each version's catalog/review/thumbnail updates in the same asset PR. Root Astra owns concepts and art direction; Blender uses a fresh native Astra max agent per bounded work order under [TEAM.md](TEAM.md), with exclusive scene ownership. Exact final visual/audio versions require Tom's review before promotion.

This sequence precedes implementing [PLAN010](plans/010-parent-prepared-memories.md). Its admission and media requirements, [WO080](work-orders/080-identity-curation-readiness.md), DESIGN012/016 and the backlog remain inputs to the platform decisions. Current pictures and chronology remain fictional; do not query family photos before the parent/admission/media contract is defined. Existing assets remain 23 GLBs, four source WAVs and six fictional pictures. The joint Besties look is approved; exact final-art review remains separate.

Preserve Besties master `/workspace/haynes-quest/bickering-besties/v001/live-scene-release.blend` (SHA256 `927ee5a27a13707798ed0e1a98060f9eeda999de6fe485cf4bda410055a74e2f`) and Nap partial master `/workspace/haynes-quest/parody/remix-trio/v001/live-scene-release.blend` (SHA256 `9a84bd4c72e70292512bd605f4da44f6fcccdca290816d230aa0bc053c972afe`). Preserve Diva's concept and keepsake rear-wedge work. No Blender scene or audio job is owned; do not restart dev-env.
