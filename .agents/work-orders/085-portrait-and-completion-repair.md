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
