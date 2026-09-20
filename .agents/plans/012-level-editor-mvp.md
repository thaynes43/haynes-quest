# PLAN012: Human and agent level editor MVP

Status: In progress. Requirements: PRD002, ADR003, DESIGN016 and DESIGN019. Root worktree `/home/dev/work/quest-level-editor-mvp`, branch `agent/quest-level-editor-mvp`, base `903ef93`. User directs autonomous delivery through deployed testing and requests Sol Ultra/Opus delegation to conserve lead usage.

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
