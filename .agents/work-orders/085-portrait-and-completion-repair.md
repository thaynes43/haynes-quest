# WO085: Portrait input and chapter completion repair

Status: Completed and deployed, September 19, 2026. Implementation ran in `/home/dev/work/quest-playtest-blockers-20260919`, branch `agent/quest-playtest-blockers-20260919`, from base `191f8c2420aa00e98caf026af334987aee98e593`. Root Astra owns the subsequent release-record branch `agent/quest-blockers-release-record-20260919` from merged `032b996` in the same worktree.

## Report and contract

Tom's latest phone portrait playtest left the stick pointing upper-left until the game was closed and reopened. Defeating the first dragon then left the final memory uncollectable, preventing chapter two. Repair both blockers and verify the actual playable route before resuming expanded content authoring. Existing DESIGN018 controls, separate simultaneous fingers, memory checkpoints and progression rules remain the baseline.

Movement must return to neutral after its owning contact ends or is cancelled, including capture failure, window/document lifecycle changes and overlays. A different finger's action must not erase an active movement contact. Browser chrome resizing may reposition controls without creating a permanently held or displaced input. A subsequent valid touch must work without restarting the game.

Both minor memories and boss victory remain required for chapter advancement. Once those conditions hold, the major memory must be physically reachable, visibly collectable and accepted by the authoritative action path. If a prerequisite is missing, the player must receive useful feedback and be able to recover it. Exercise the raised first-boss terrace and actual chapter transition, then verify chapter two completion and the shortcut independently.

## Ownership

- Root Astra owns requirements, UX/copy, integration, review, release and the current handoff. No new assets or real family media are part of this repair.
- Fresh native Sol `portrait_input_fix`, `gpt-5.6-sol` at `xhigh`, owns joystick/input lifecycle code and focused tests; technical findings are WO087.
- Fresh native Sol `major_memory_blocker`, the same model/effort, owns bounded runtime/progression diagnosis and focused tests; technical findings are WO084. Root ratifies any rule/geometry change.
- Shared worktree edits are isolated by owned paths. Root serializes build/browser validation. No agent commits or merges without a separate explicit work order.

## Evidence and delivery

At the start of this repair, the cluster served main `191f8c2` as `ghcr.io/thaynes43/haynes-quest:sha-191f8c2420aa00e98caf026af334987aee98e593@sha256:21d4e4052609299734c10aa984feb2d1d8ed650e007b9479a768fbbdf4e059c5` in `frontend/haynes-quest-playtest`. The preexisting handoff incorrectly described PR44 as awaiting merge; the current handoff now records the verified replacement below.

Require failure-before/fix-after regressions, typecheck, lint, full tests, build, strict documentation checks and real browser controls. Record exact build hashes and actual phone emulation/browser limits. Dedicated PostgreSQL checks run in CI against disposable storage. Carry app PR through green checks and squash merge, verify immutable image publication, then use the separate `/home/dev/work/quest-blockers-release-20260919` haynes-ops worktree for an image-only private release. Declare scoped rollout activity, verify hosted controls/progression and health, end the declaration, and retain concise durable evidence. Protect normal Quest and dev-env.

## Implemented and checked release

[Application PR46](https://github.com/thaynes43/haynes-quest/pull/46) merged as `032b996e2e9c99271bbf47fb49bee4ee947a7473`; final checked PR head was `6576a53`. Source behavior froze at `09d6642`. Independent source review resolved pointer/touch ordering, ownership, stale-contact cleanup and the analogous action-button latch. Exact-head and main CI pass all 562 tests, including 12 disposable PostgreSQL cases, typecheck, lint, production, strict documentation and container checks.

The final client is `index-B6ZOcLIe.js`, 1,193,022 bytes, SHA256 `c1ebea0d164c81561b58495dc2a992149bcb9ff1ccc34d651408b3cf319de81c`. [WO086](086-portrait-completion-browser-evidence.md) records the passing local full journey, independent Besties shortcut and strengthened focused input regression, with the exact failed-before evidence and honest limits of earlier failed driver attempts. Both independent browser-review findings were corrected and re-reviewed. The focused hosted run also passes on the exact deployed client.

The full local memory probe defeated the dragon with one minor still missing, contacted the visible major without an ineligible request, traversed six real-control edges back to the missed memory, then returned along the same route and advanced to age four. It completed the Besties chapter in that same session. Root inspected the missing-memory hint at 390×844, 844×390 and 568×320; it stayed legible and clear of controls. This is a matching failure scenario, not proof of the original phone's prerequisite state.

[Operations PR2983](https://github.com/thaynes43/haynes-ops/pull/2983) merged as `be4912ee052c5f2d40ba956c1e8c2c1a052f4874` after all nine checks passed on final head `02b74ab`. The initial main HelmRelease comparison failed with an inaccessible runner log; a documentation push triggered fresh checks without weakening any requirement, and all rendered comparisons then passed. The actual diff changes only the private Deployment image. Anonymous registry verification matched the raw OCI index hash to the digest header, and publication/provenance/signing workflow steps succeeded.

The Ready private release is `ghcr.io/thaynes43/haynes-quest:sha-032b996e2e9c99271bbf47fb49bee4ee947a7473@sha256:a87013f9b806008dcd95caa2a487acc61c919374630bd49ccd4a62b8206f2dcc`. Targeted Flux reconciliation applied the exact operations merge. The hosted JS and CSS match the tested build; the updated guide and catalog return 200. All four health/readiness checks pass, with normal Quest and dev-env identities, generations, images and readiness unchanged from the post-interruption baseline. The earlier unrelated pod roll is not attributed to this deployment.

## Final acceptance and cleanup

The hosted full missed-minor journey passed from 20:54:00 through 21:01:34 UTC with no response, page or console errors. After dragon victory, the missing minor remained released and touching the major left revision 26 unchanged. Six backward edges reached the minor at revision 28; six forward edges returned to the major and accepted chapter one at revision 29. Chapter two then completed in the same session. Root inspected the hosted portrait hint and final two-era, six-memory completion captures.

An earlier hosted attempt accidentally picked up the deferred minor on a boss-death retry and advanced normally. The driver now follows its existing forward plan during retries and explicitly asserts that the minor remains uncollected after the boss. This corrects the test scenario without changing game state or runtime code. The passing hosted run used that correction; a later one-line change preserves original edge indices in diagnostic output and was checked statically without repeating the full journey.

The final rollout audit passed after gameplay. Activity `act-204155-42536` is ended. The owned `quest-blockers-fixtures` tmux session is stopped, and ports 4410/4411 no longer listen. The [release index](../evidence/portrait-completion-release.json) preserves compact results, exact harness hashes, raw report hashes and final deployment evidence. The verified runtime stays at `032b996`; repository records and test-driver changes do not require a second game deployment.

Browser evidence is Chromium 153 touch emulation using real keyboard/touch controls, not physical iPhone/iPad Safari acceptance or phone frame-time measurement. Source/unit tests cover lifecycle and camera-capture cases outside the focused browser scope. No model, audio, private photo, gameplay geometry or progression requirement changed. The next content stage still follows the concept and final-art review requirements in the handoff.
