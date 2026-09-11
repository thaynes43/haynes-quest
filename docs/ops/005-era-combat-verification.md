# Era combat verification

**Historical checkpoint:** the pending work described below records earlier stages of the rebuild. The two-chapter private playtest and full visual catalog have since shipped; see the [current handoff](../../.agents/HANDOFF.md) and [final release evidence](../../.agents/work-orders/048-release-verification.md).

This record concerns the PLAN-005 correction: useful gear → era encounters → boss victory → released pictures → memory consumption → age and next period. It does not replace the separate evidence for the earlier deployed prototype.

**State recorded September 11 at 17:48 UTC:** the server/combat foundation is merged in PR26 and the supporting asset work in PR27. [PR28](https://github.com/thaynes43/haynes-quest/pull/28) adds the forgiving obby and recognizable parody cast. Its first automated verification, PostgreSQL tests, documentation and container checks passed; candidate production and full final playthroughs are still in progress. No PLAN-005 release has been deployed. Real library photos, admitted-player OAuth and physical Safari have not been validated by these checks.

## Obby and parody correction

The current local build alternates slow hazards and broad landing platforms with era encounters. Missed jumps and obstacle bumps return the player nearby while retaining equipment, health and victories. Age zero uses movement timing; after the first boss and memory consumption, age four unlocks jumping for two short gaps and a moving platform. The course, checkpoint, combat-height, input-clearing and pause regressions pass. [The latest review](../../.agents/work-orders/033-parody-obby-review-results.md) records the concrete findings and fixes.

The first three actual parody models are delivered: Mister Hiss, Peel Patrol and Drama Dragon. [Their catalog audit](../../.agents/work-orders/034-parody-catalog-intake-results.md) passed the exact models, all 15 interactive animation clips, 21 decoded videos, phone layout and touch orbit, and the editable-master checksums. Sir Flush-a-Lot, Nap Captain and One-Star Diva remain in production. The earlier generic creature studies are rejected as enemies and are preserved only for possible future friendly or ambient roles.

[The current control audit](../../.agents/work-orders/031-obby-browser-journey-results.md) is explicitly partial: keyboard controls completed the first period, boss, pictures and growth to age four, then a deliberate missed-jump recovery and the first gap. It does not yet establish the ferry, second boss, final growth or a full touch journey with the final cast. The software renderer measured about 8–9 frames per second at the recorded test viewports; tests are being corrected to follow actual movement and landings rather than short fixed delays. This is not a physical-device performance result or a child playtest.

The remaining sections preserve the earlier combat foundation's evidence. Those earlier complete journeys used the former corridor and temporary studies; they do not establish the corrected obby or final visual quality.

## Source and checks

Root worktree: `/home/dev/work/quest-era-boss-loop`, branch `agent/quest-era-boss-loop`, based on `3502ac7`. The integrated server/migration is `f7df719`, stored-state/PostgreSQL fixes `d25377d`, scene and UI `faa8bab`, low-frame-rate timing correction `08e1337`, and media regression test `88cdcec`.

TypeScript, lint and production build passed. The local suite passed 65 tests with eight PostgreSQL tests skipped because the local run had no database URL. The separate real-database result below covers those eight tests. Actual keyboard and emulated-touch gameplay passed both bosses and final age-seven completion, with all completion pictures decoded. Independent technical findings were recovered and fixed; the original separate Fable browser lane timed out and is not claimed complete.

The earlier isolated harness served synthetic fixtures with in-memory storage at `127.0.0.1:4390`; its owned tmux window was closed at 16:48 UTC after the audit. Its log remains at `/tmp/quest-era-fixture.log`. Two earlier tool-owned processes ended with signal 143; their in-memory saves were discarded. These were local test interruptions, not live application or dev-env restarts. In-memory reload tests demonstrate save/resume semantics within that process; they do not establish persistence across process replacement. The current harness locations and freeze ownership are in [HANDOFF](../../.agents/HANDOFF.md).

## Real PostgreSQL

The server lane ran `QUEST_TEST_DATABASE_URL=postgres://quest_test@127.0.0.1:5432/quest_test pnpm test:db` against PostgreSQL **16.14** in disposable Job `dev/quest-era-pg16-validation-0911`, using `postgres:16-alpine` and `/tmp/pgdata`. Result: **8 passed**, 36 skipped by the Postgres test-name filter, 3.94 seconds.

Coverage included owner isolation and state persistence, save-scoped action receipts, stale-tab serialization, simultaneous one-time bundle consumption, bounded receipt pruning, invalid persisted state, and migration of v1 saves without fabricated boss progress. The test used no application database or secrets.

The Job was deleted after verification. Scoped activity `act-131053-68425`, declared at `2026-09-11T13:10:53Z` for `dev`, was ended. The server lane retained the result in the task transcript; there is no archived raw Job log. CI will run the database suite again against the PR revision.

## Media delivery and failure recovery

Command: `QUEST_E2E_URL=http://127.0.0.1:4390 node tests/e2e/media.mjs`, test commit `88cdcec`, Chromium 153 / Playwright 1.63. Passed against the isolated candidate build:

- Three of three setup illustrations decoded.
- Two released owner-scoped media routes returned image bytes. Both photo canvases successfully reached actual WebGL texture uploads.
- Four deliberately aborted image requests recovered through bounded automatic retries.
- A picture held in permanent failure showed an explicit fallback; manual retry then decoded it.
- An aborted infant GLB load recovered through manual retry. Double-clicking retry created one replacement request, without duplicate attachment.
- Eight injected request failures and their corresponding browser/Three warnings were classified as expected. There were no unexpected console, page or network failures.

This test used API commands to arrange post-boss state solely for media delivery checks. It is not evidence of playable combat; the separate journey uses actual controls. The new image path fetches owner-authorized bytes, decodes through a document-origin blob, checks readable canvas pixels and applies the image to the keepsake’s named photo surface. Failures remain visible and retryable.

## Rendering measurements

Before static-model batching, two eight-second samples per viewport on build `index-B9Quey_b.js` measured 360 draw calls and 147,016 triangles per desktop frame (1440 × 1000, DPR 1), and 366 calls / 152,620 triangles in touch landscape (844 × 390, DPR 1). Desktop mean was 7.6–8.1 FPS; touch landscape was 11.2–14.6 FPS. Median callback CPU time was approximately 2–3 ms. The repeated static models and their shadow passes were the principal measured draw-call target.

These are Chromium SwiftShader software-rendering measurements. They are not physical-device acceptance or a claim of playable hardware performance. The measured batching result is below; actual device checks remain outstanding.


After batching repeated static GLBs, desktop draw calls fell from 360 to 222 and touch landscape from 366 to 225. Buffers fell about 40%; texture count remained 15. Two samples measured desktop 9.9–10.8 FPS and touch landscape 14.3–16.2 FPS. Submitted triangles increased by 10.9% / 7.2% because an instanced batch has a shared visibility bound. This trades fewer draw calls for coarser culling; spatial batches remain an option if real-device measurements warrant them.

[Exact sanitized renderer/media report](media/era-combat/render-media-report.json). Baseline bundle: `index-B9Quey_b.js`; batched candidate: `index-BXPUs-MN.js`. The media regression passed again on the candidate with no unexpected failures. These initial-scene captures confirm batch delivery; they show temporary encounter/equipment studies and do not establish finished art quality.

![Actual isolated desktop game capture with temporary encounter studies](media/era-combat/initial-desktop.png)

![Actual isolated touch landscape game capture](media/era-combat/initial-touch.png)

## Adversarial review and later corrections

[WO-015 results](../../.agents/work-orders/015-era-adversarial-results.md) records recovered independent client/server findings and lead dispositions. The Fable parent timed out waiting for its browser lane; that lane is not claimed complete. Concrete fixes cover secure UUID availability, stale-tab enemy revival, retained pending contact, fair pause telegraphs, cached-picture display, model retry/texture ownership, and dialog feedback. The subsequent combined local suite passed 82 tests with eight database tests skipped. Remote-retry regressions are integrated as `46ad8b9`, cached-picture fixes as `c5d217c`, and the bounded Fable server follow-up as `abee156`. The resulting full local suite passed **91 tests**, with **eight PostgreSQL tests skipped** pending PR CI. Typecheck, lint and production build passed.


## Final control journeys for the code PR

[Keyboard evidence](media/era-combat/journey-keyboard-evidence.json), completed `2026-09-11T14:10:04Z`; [touch evidence](media/era-combat/journey-touch-evidence.json), completed `2026-09-11T14:11:54Z`. Both use Chromium `153.0.8010.12`, final client bundle `index-C3rM52AX.js`, and real movement/actions through both periods. Read-only save assertions verified equipment, encounter/boss gates, unchanged age through victory and revelation, absorption from 0 → 4 → 7, save/leave/resume and the retained final 2024 world. Touch used 844 × 390 emulation with simultaneous controls, guard/jump and pointer cancellation. There were zero page errors. Keyboard also forced picture failures and recovered through the in-dialog retry.

These journeys ran on the in-memory harness before the final server clock/write-validation follow-up. After integrating `abee156`, root restarted only that owned local harness, repeated the media/first-boss action regression against the updated server and received the same passing counts: three previews, two released pictures, two actual WebGL uploads, bounded automatic/manual retries, no unexpected errors. PR CI verifies the full updated server and database suite. This distinction avoids claiming the earlier browser run used code that had not yet been loaded by the server.

![Keyboard completion with all three fictional pictures visibly loaded](media/era-combat/keyboard-complete.png)

![Touch completion with all three fictional pictures visibly loaded](media/era-combat/touch-complete.png)

These captures show fixture illustrations, not imported family photographs. The completion dialog scrolls within the touch viewport to reveal its captions and return control.

## Checked code merge

[PR #26](https://github.com/thaynes43/haynes-quest/pull/26) squash-merged at `f6a8f0de4a6b132ef5d4244a8bf5f1e37d56d531` on September 11, 2026 at 14:27:55 UTC. The final reviewed head `231b4f74a6492cac700e5b829fa5c935ff77f4e1` passed [application verification and container build](https://github.com/thaynes43/haynes-quest/actions/runs/34609792353), including all 99 tests against the dedicated CI database, and the [strict documentation build](https://github.com/thaynes43/haynes-quest/actions/runs/34609792372). A source-file link that escaped the standalone documentation build was corrected before the green container check. This merge does not establish asset approval or private deployment.
