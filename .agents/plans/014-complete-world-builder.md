# PLAN014: Complete world builder and first new world

- **Status:** In progress
- **Date:** 2026-09-23
- **Requirements:** [PRD003](../../docs/prds/003-complete-world-authoring.md)
- **Decision:** [ADR004](../../docs/adrs/004-versioned-world-projects.md)
- **Existing boundaries:** [DESIGN012](../../docs/designs/012-player-journey-curation.md), [DESIGN016](../../docs/designs/016-authored-levels.md), [DESIGN019](../../docs/designs/019-level-editor-workspace.md), [asset process](../../docs/PROCESS.md#asset-catalog-must-stay-current)

## Scope and order

1. Ratify a bounded, versioned project contract for independently identified chapters, represented dates, encounter assignments and new candidate briefs. Preserve v1 imports, immutable shipped courses and the fictional preview boundary.
2. Extend shared document validation and commands, then the visual editor and agent CLI. Add a new chapter and cast through both surfaces; keep invalid drafts repairable.
3. Build a frozen multi-chapter fixture plan from the project. Use the real reducer, authored collision and gameplay placements in preview; test from any chapter and a complete journey.
4. Author one owner-selected world brief and source concept. Inspect the concept with Tom before expensive character modeling, then dispatch one exclusive Astra Blender scene owner. Prepare environment and encounter candidates, validate exports and compare matching views.
5. Update versioned asset reviews, inventory, thumbnails, catalog cards, documentation and handoff in the asset PR. Run strict docs/media checks and private browser journeys. Merge green PRs, deploy through the existing app and GitOps process where the change is included, and verify live editor/catalog results. Final gameplay asset promotion waits on Tom's exact-version review.

## Evidence to retain

Record the project export and deterministic CLI commands; validator/test results; normal-control browser traversal and snapshot isolation; source concept paths/checksums; Blender master/GLB/render/animation checksums and technical checks; live catalog links and deployed source/image identity; Tom's versioned decisions. Do not claim physical Safari acceptance from emulation.

## Active decision

PRD003 Q-01 is on Tom's phone. Builder work and non-character authoring can proceed independently. Character modeling starts after the selected concept is inspected with him under DESIGN012.
