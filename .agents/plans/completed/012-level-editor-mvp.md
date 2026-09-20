# PLAN012: Human and agent level editor MVP

Status: Complete, September 20, 2026. Requirements: PRD002, ADR003, DESIGN016 and DESIGN019. Root worktree `/home/dev/work/quest-level-editor-mvp`, branch `agent/quest-level-editor-mvp`, base `903ef93`. User directs autonomous delivery through deployed testing and requests Sol Ultra/Opus delegation to conserve lead usage.

## Outcome

A visual editor and agent CLI share validated, portable documents and can recreate both current chapters. Editing does not mutate shipped routes. A frozen snapshot runs in the existing private game for realistic testing.

## Work lanes

1. Root ratifies contract/UX and writes governing documents.
2. Native Sol Ultra implements shared document/commands/validation; another implements the specified visual workspace.
3. Authorized Opus 5 sessions supply independent parity audit, bounded integration/testing or review as needed.
4. Integrate snapshot preview, persistence/import/export, CLI examples and meaningful tests.
5. Verify exact templates, representative edits and full private gameplay progression, then required checks/PR/merge/image/GitOps/live acceptance.
6. Record release and resource cleanup, make the editor available to Tom, and retain any actual platform limitations explicitly.

## Completion evidence

Require shared-schema round trips and immutable-template equivalence, command/undo/validation tests, request/preview isolation tests, browser editing and draft recovery, successful import/export with a visible runtime change, both existing chapter mechanics/progression through the shared preview path, healthy deployed editor/preview and no regression to the normal private playtest. No new art or family-photo data is required.

## Delivered and verified

Shared project/commands/CLI, visual editor, immutable private snapshot preview and Besties footprint validation are deployed. Published courses remain unchanged. Independent review and real browser checks corrected snapshot lifetime, import/history races, route adaptation, duplicate-row repair, camera framing and responsive reachability. Browser-local drafts and the existing two-run ephemeral retention limit are explicit in ADR003.

Local checks pass typecheck, lint, 663 tests, immutable-course validation, production build and strict documentation/media checks. Exact-head CI passes all 675 tests including 12 PostgreSQL cases and the container build. Both template documents round-trip without loss; actual gameplay uses edited snapshots through normal save actions and chapter transitions.

The hosted release passes all 18 editor workflow scenarios and all three authoring groups, including all four Add kinds, duplicate/delete/undo, connection/main-route/branch editing, completed/interrupted transforms, import/export/history, validation, local draft recovery, edited runtime geometry and phone/tablet/desktop controls with zoom lock. A separate normal-input editor-entry adventure completes both v2 chapters, equipment, minor memories, ordinary/boss fights, safe landings, memory checkpoints, moving platforms, major memories, transition and completion. HTTP/page/console errors are empty. These are Chromium desktop/touch-emulation results; physical Safari and hardware performance remain owner testing.

[App PR52](https://github.com/thaynes43/haynes-quest/pull/52) merged as `e017c58fa79d3fd63fd899124ec7a8929ba067d7`; [ops PR2988](https://github.com/thaynes43/haynes-ops/pull/2988) merged as `445ab293aa30e0e7b8a187c92ba1db8aa399b352`. Flux/Helm, immutable image, live HTML/JS/CSS and editor/guide endpoints are verified. Normal Quest and dev-env are unchanged. Scoped activity is ended, local port4430 and browser contexts are closed, and separate agent worktrees are reaped. [WO091](../../work-orders/091-level-editor-mvp.md) and [the release index](../../evidence/level-editor-release.json) retain evidence and archival paths.
