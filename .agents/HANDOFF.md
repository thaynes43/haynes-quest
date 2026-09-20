# Current handoff

**September 19: app-wide browser zoom prevention is deployed and verified.** [WO090](work-orders/090-app-wide-zoom-lock.md) and [its release index](evidence/app-zoom-lock-release.json) record the exact source, live build, checks and cleanup. Tom clarified that his son was playing and zoom must be disabled throughout the game app. This supersedes WO089's intentional start-page exception. No model or audio authoring is running.

Loading, start/setup, gameplay and menus now share a fixed viewport and document-wide scroll-only touch policy. A document-lifetime guard cancels Safari pinch defaults, Ctrl-wheel and app-received Ctrl/Cmd plus/minus shortcuts. Text-entry fields use 16px text. Ordinary page/Help scrolling, separate movement/action contacts and camera dragging remain available. Ctrl/Cmd-0 can restore the default browser scale.

## Current private release

[Application PR50](https://github.com/thaynes43/haynes-quest/pull/50) merged as `2ac16b9cc4840dea19411318ac7615ccf7fd0070`. Operations [PR2986](https://github.com/thaynes43/haynes-ops/pull/2986) merged as `7984c98dc217c61c0d5f5179f01ce900e49d42ac`. Verified private image:

`ghcr.io/thaynes43/haynes-quest:sha-2ac16b9cc4840dea19411318ac7615ccf7fd0070@sha256:fe0c1c06e52cbb7d3e711999d57a529014111cb0e7b9632d96f3e4473dc0aa68`

Hosted JavaScript: `index-BbxFx3Yj.js`, 1,193,622 bytes, SHA256 `66d829432a86b1d40bc9ac56717011a36d19e84026dc3c2562f63ce4958423a2`. CSS: `index-CFAjhIJT.css`, 41,949 bytes, SHA256 `7a844ac3d16e8641b9ef068fa2f2da08fec20bfe5023d1bd20f935084b05cf9d`. The hosted HTML also includes the fixed viewport policy.

- [Private playtest](https://haynes-quest-playtest.haynesops.com/): reload an older tab to load this release. New tests start fresh; in-game death retains memory checkpoints.
- [Playtest guide](https://haynes-quest-playtest.haynesops.com/studio/assets/playtest.html): controls, recovery and fictional scope.
- [Visual catalog](https://haynes-quest-playtest.haynesops.com/studio/assets/catalog.html): 37 entries and 54 navigation thumbnails with exact versions and review status.

All 568 CI tests, including 12 disposable PostgreSQL cases, pass, along with required app/docs/container checks. The same trusted-touch harness reproduces 2.155× zoom on the old start page and holds the candidate and new hosted app at 1× through start/game pinches, double taps, entry/leave transitions and zoom shortcuts. Native page scrolling and Help scrolling still work. The portrait regression preserves failed-capture release/re-arm, independent contacts, resize geometry and rotation cleanup. Earlier complete chapter/progression evidence remains in WO085, WO086 and PLAN011; no combat, memory, level or asset logic changed.

The browser checks use Chromium 153 touch emulation. Safari gesture cancellation also has unit coverage, but physical Safari is not verified by those tests. Browser-menu/accessibility overrides and OS magnification remain outside page control; never promise a web page can disable them. Bash is absent at the unarmed viewport-test spawn, so no equipped-Bash bounds claim is made.

## Resources and next stage

The live audit confirms exact image/HTML/JS/CSS, healthy endpoints, and unchanged normal Quest/dev-env identities, generations, images and pod state. Activity `act-235124-103012` is ended. Owned tmux `quest-app-zoom-fixture` is stopped, port 4422 is closed, and browser contexts are closed. Raw browser evidence remains under ignored `test-results/` in `/home/dev/work/quest-app-zoom-lock-20260919`; operations evidence is in `/home/dev/work/quest-app-zoom-release-20260919/.private/quest-app-zoom/`. The committed index retains hashes and essential measurements. Repository closeout records do not require another game image promotion.

Tom's next sequence is a few more enemy models, then requirements and ADRs for the level-building platform. Discuss encounter concepts before expensive production. Root Astra owns concepts/art direction; Blender uses fresh native Astra max agents with exclusive scene ownership under [TEAM.md](TEAM.md). Keep catalog/review/thumbnail updates in each asset PR, and obtain Tom's review of exact final visual/audio versions before promotion.

This sequence precedes implementing [PLAN010](plans/010-parent-prepared-memories.md). Its admission/media requirements, [WO080](work-orders/080-identity-curation-readiness.md), DESIGN012/016 and the backlog remain inputs to platform decisions. Pictures and chronology remain fictional; define the parent/admission/media contract before querying family photos. Assets remain 23 GLBs, four source WAVs and six fictional pictures. The joint Besties look is approved; exact final-art review remains separate.

Preserve Besties master `/workspace/haynes-quest/bickering-besties/v001/live-scene-release.blend` (SHA256 `927ee5a27a13707798ed0e1a98060f9eeda999de6fe485cf4bda410055a74e2f`) and Nap partial master `/workspace/haynes-quest/parody/remix-trio/v001/live-scene-release.blend` (SHA256 `9a84bd4c72e70292512bd605f4da44f6fcccdca290816d230aa0bc053c972afe`). Preserve Diva's concept and keepsake rear-wedge work. No authoring scene or audio job is owned; do not restart dev-env.
