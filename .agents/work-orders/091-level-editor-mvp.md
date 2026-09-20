# WO091: Human and agent level editor MVP

Status: Integrated candidate under final acceptance. September 20, 2026. Governed by PLAN012, PRD002, ADR003 and DESIGN019. Root worktree `/home/dev/work/quest-level-editor-mvp`, branch `agent/quest-level-editor-mvp`, base `903ef93`. Application PR52; private operations release follows exact reviewed source publication.

## Owner direction and delivery

Tom requests a Roblox-style authoring surface that humans and inexpensive agents can use to recreate both existing chapters. Native GPT-5.6 Sol Ultra owns ordinary implementation, tests and review; explicitly authorized Opus 5 sessions own bounded runtime, browser and release lanes. Root Astra retains architecture, UX, documentation and integration judgment. New art and personal-photo admission remain separate stages.

The MVP shares one versioned portable project, strict command schema, atomic revision-checked edits, validation and CLI with a visual `/editor`. It supports both immutable current templates, course pieces, fixed gameplay slots, arenas, connections/main routes/branches, transforms, undo/redo, browser-local drafts, import/export and snapshots played in the existing game runtime. Semantic problems remain editable; invalid previews create no save. The private fixture retains its established two recent ephemeral runs per browser session. Published level files, real media and normal Quest are untouched.

## Candidate evidence

The shared/runtime/server/UI suites establish document round trips and immutable template parity, command atomicity, attached-object movement, gameplay guards, frozen preview lifetime through actions/retries/chapter transitions, request protection, isolation and local draft handling. Required typecheck/lint/course validation, production build and strict documentation build pass at the implementation checkpoint; final exact-head CI remains the release gate.

The browser workflow verifies actual inspector edits, attached movement, undo/redo, portable deterministic export/import, malformed-import preservation, invalid-preview blocking, reload recovery, edited runtime geometry retained after an ordinary pickup action, chapter/full-adventure entry, return history, touch panels and zoom lock. Expanded checks identified clipped responsive toolbar controls and unfitted initial camera bounds; both were corrected. Actual route-form checks also identified strict-schema rejection of a connection match containing a safe-landing field; the adapter correction is included before release.

Normal-input report `editor-entry-both-chapters` passed both chapters through the editor on candidate `310fcb7`: expected v2 course identities, equipment, minor memories, ordinary and boss combat, safe-miss landings, checkpoint recovery, moving platforms, major memories, chapter transition and completion. Its report SHA256 is `993fc87ab5706527fb57a861b8ee622ae3a4c4d06cdcc6747f5974c6dc7acdc5`; candidate JavaScript SHA256 is `7c98acc5cb089d5ef38b3ac02fe477910eff05457e3a416a6ff006f6c0facba9`. HTTP/page/console error arrays are empty. Separate concurrent runs exposed test-driver timing assumptions; they are retained as failed attempts, not counted as passes.

## Completion gate

Integrate and review final browser harnesses; validate completed/interrupted gizmo transactions and all route forms; pass exact-head required CI; self-merge app PR52; verify published immutable image; self-merge scoped private GitOps release; verify Flux, live assets and hosted authoring/gameplay. Preserve normal Quest and dev-env identity/state. Record release hashes and cleanup before marking PLAN012 complete. Chromium desktop/touch emulation does not establish physical Safari or hardware performance.
