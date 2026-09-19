# WO085: Portrait input and chapter completion repair

Status: In progress, September 19, 2026. Root Astra coordinates from `/home/dev/work/quest-playtest-blockers-20260919`, branch `agent/quest-playtest-blockers-20260919`, base `191f8c2420aa00e98caf026af334987aee98e593`.

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

The cluster on September 19 serves main `191f8c2` as `ghcr.io/thaynes43/haynes-quest:sha-191f8c2420aa00e98caf026af334987aee98e593@sha256:21d4e4052609299734c10aa984feb2d1d8ed650e007b9479a768fbbdf4e059c5` in `frontend/haynes-quest-playtest`. The preexisting handoff incorrectly still described PR44 as awaiting merge; replace that stale current status as part of closeout.

Require failure-before/fix-after regressions, typecheck, lint, full tests, build, strict documentation checks and real browser controls. Record exact build hashes and actual phone emulation/browser limits. Dedicated PostgreSQL checks run in CI against disposable storage. Carry app PR through green checks and squash merge, verify immutable image publication, then use the separate `/home/dev/work/quest-blockers-release-20260919` haynes-ops worktree for an image-only private release. Declare scoped rollout activity, verify hosted controls/progression and health, end the declaration, and retain concise durable evidence. Protect normal Quest and dev-env.

## Integrated candidate

Source commit `09d6642` is in [application PR46](https://github.com/thaynes43/haynes-quest/pull/46). Final source review resolved pointer/touch start ordering, ownership, stale-contact cleanup and the analogous off-control action-button latch. Typecheck, lint, production and strict documentation builds pass; the final local suite passes 550 tests, with 12 dedicated PostgreSQL cases reserved for CI.

The final client is `index-B6ZOcLIe.js`, 1,193,022 bytes, SHA256 `c1ebea0d164c81561b58495dc2a992149bcb9ff1ccc34d651408b3cf319de81c`. The baseline `191f8c2` and provisional action-button failure remain under ignored `test-results/portrait-completion-regression/`. Chromium 153 on the final client passes the focused portrait regression: forced-capture joystick release clears the old upper-left vector, a new touch drives normally and releases to zero, failed-capture Jump re-arms from sequence 1 to 2, ending/cancelling another finger preserves held movement, same-orientation resize preserves the contact, and portrait-to-landscape rotation clears input. Independent browser review found that the initial resize snapshot did not prove vector remeasurement and multi-touch needed an explicit Jump-release assertion. Both assertions are strengthened and re-reviewed; the final rerun is pending. Root inspected the neutral-stick portrait capture.

Local run `final-missed-minor-attempt-06` proved the first-chapter sequence: one minor remained missing after dragon victory, contacting the visible major sent no ineligible request, the player returned along five actual edges, collected the missing minor, returned forward and advanced to age four. Root inspected the hint at 390×844, 844×390 and 568×320. That run then failed an existing Besties safe-miss helper assumption at the start of chapter two; it is retained as a failed whole-run result, with its bounded first-chapter evidence. The corrected helper uses a takeoff outside overlapping catch geometry and holds real input until the landing is observed. Earlier helper failures and fixes remain in raw reports; game source has not changed.

Independent `final-besties-shortcut-attempt-01` passes the full chapter-two shortcut: five fights, actual boss damage and hit reactions, major collection and completion, with no response/page/console errors. Combined run `final-missed-minor-attempt-07` and the strengthened focused rerun are pending before merge. WO086 will record their final evidence. No repair deployment is claimed at this checkpoint. Baseline port4410 and candidate port4411 are root-owned and must be stopped after verification. After the interrupted browser run, both fixtures were restored in the dedicated `quest-blockers-fixtures` tmux session on September 19 at 19:52 UTC; do not rely on the prior process IDs. No cluster activity declaration is active.
