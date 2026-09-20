# WO091: Human and agent level editor MVP

Status: Complete, deployed and verified. September 20, 2026. Governed by PLAN012, PRD002, ADR003 and DESIGN019. Root worktree `/home/dev/work/quest-level-editor-mvp`, branch `agent/quest-level-editor-mvp`, base `903ef93`. Application PR52; private operations release follows exact reviewed source publication.

## Owner direction and delivery

Tom requests a Roblox-style authoring surface that humans and inexpensive agents can use to recreate both existing chapters. Native GPT-5.6 Sol Ultra owns ordinary implementation, tests and review; explicitly authorized Opus 5 sessions own bounded runtime, browser and release lanes. Root Astra retains architecture, UX, documentation and integration judgment. New art and personal-photo admission remain separate stages.

The MVP shares one versioned portable project, strict command schema, atomic revision-checked edits, validation and CLI with a visual `/editor`. It supports both immutable current templates, course pieces, fixed gameplay slots, arenas, connections/main routes/branches, transforms, undo/redo, browser-local drafts, import/export and snapshots played in the existing game runtime. Semantic problems remain editable; invalid previews create no save. The private fixture retains its established two recent ephemeral runs per browser session. Published level files, real media and normal Quest are untouched.

## Candidate evidence

The shared/runtime/server/UI suites establish document round trips and immutable template parity, command atomicity, attached-object movement, gameplay guards, frozen preview lifetime through actions/retries/chapter transitions, request protection, isolation and local draft handling. Required typecheck/lint/course validation, production build and strict documentation build pass at the implementation checkpoint; final exact-head CI remains the release gate.

The browser workflow verifies actual inspector edits, attached movement, undo/redo, portable deterministic export/import, malformed-import preservation, invalid-preview blocking, reload recovery, edited runtime geometry retained after an ordinary pickup action, chapter/full-adventure entry, return history, touch panels and zoom lock. Expanded checks identified clipped responsive toolbar controls and unfitted initial camera bounds; both were corrected. Actual route-form checks also identified strict-schema rejection of a connection match containing a safe-landing field; the adapter correction is included before release.

Normal-input report `editor-entry-both-chapters` passed both chapters through the editor on candidate `310fcb7`: expected v2 course identities, equipment, minor memories, ordinary and boss combat, safe-miss landings, checkpoint recovery, moving platforms, major memories, chapter transition and completion. Its report SHA256 is `993fc87ab5706527fb57a861b8ee622ae3a4c4d06cdcc6747f5974c6dc7acdc5`; candidate JavaScript SHA256 is `7c98acc5cb089d5ef38b3ac02fe477910eff05457e3a416a6ff006f6c0facba9`. HTTP/page/console error arrays are empty. Separate concurrent runs exposed test-driver timing assumptions; they are retained as failed attempts, not counted as passes.

## Published release and hosted acceptance

[App PR52](https://github.com/thaynes43/haynes-quest/pull/52) passed exact-head checks at `ddafb250de02e0c9225697156d65de3ac179f0bf` and merged as `e017c58fa79d3fd63fd899124ec7a8929ba067d7`. All 675 CI tests pass, including real PostgreSQL. Main Application `35484238763` and Documentation `35484238780` succeeded. Publication and attestation presence were verified; independent cryptographic verification is not claimed.

[Ops PR2988](https://github.com/thaynes43/haynes-ops/pull/2988) passed all nine required checks and merged as `445ab293aa30e0e7b8a187c92ba1db8aa399b352`. The only runtime change is the private image, now `ghcr.io/thaynes43/haynes-quest:sha-e017c58fa79d3fd63fd899124ec7a8929ba067d7@sha256:6c6b12f6f7c776ab361c131af24770e0c746874d4cb091d6ec261c0135d9940c`. Flux/Helm applied generation12, deployment1/1 ready with zero restarts. `/editor` serves the expected shell and exact reviewed assets; the guide and health endpoints return200. Normal Quest and dev-env identities, generations, images and pod state remain unchanged.

The exact hosted bundle passes all 18 workflow scenarios and three authoring groups. Actual edited geometry survives a normal pickup/save round trip; import, undo/redo, invalid-draft handling, draft reload, route forms, duplicate-connection repair and completed/interrupted gizmo transactions pass. Phone, tablet and desktop controls are reachable, tablet tabs work and browser zoom remains locked. A separate full normal-input editor adventure completes both chapters, bosses, final memories, chapter transition and final completion. HTTP/page/console error arrays are empty. No gameplay state was seeded to claim these journeys. Failed diagnostic attempts remain separate from passing evidence.

[The release index](../evidence/level-editor-release.json) records exact hashes, report paths and compact results. Raw evidence is archived at `/home/dev/artifacts/haynes-quest/level-editor-mvp-20260920-e017c58`. Activity `act-023946-191874` is ended, local fixture4430 is closed, browser contexts are closed and separate agent worktrees are reaped. No Blender/audio jobs are owned. Repository-only closeout records require no second game-image promotion.

Chromium desktop/touch emulation does not establish physical Safari or hardware performance. Current assets and the fixed two-chapter roster remain the MVP scope; browser-local drafts require Export for portable backup or sharing. Personal photos and shared publishing remain future platform work, not hidden dependencies of this release.
