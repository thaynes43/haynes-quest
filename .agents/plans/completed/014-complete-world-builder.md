# PLAN014: Complete world builder and first new world

- **Status:** Complete for the private fictional fixture; exact owner art and physical-device acceptance remain separate gates
- **Date:** 2026-09-23
- **Requirements:** [PRD003](../../../docs/prds/003-complete-world-authoring.md)
- **Decision:** [ADR004](../../../docs/adrs/004-versioned-world-projects.md)
- **Existing boundaries:** [DESIGN012](../../../docs/designs/012-player-journey-curation.md), [DESIGN016](../../../docs/designs/016-authored-levels.md), [DESIGN019](../../../docs/designs/019-level-editor-workspace.md), [asset process](../../../docs/PROCESS.md#asset-catalog-must-stay-current)

## Scope and order

1. Ratify a bounded, versioned project contract for independently identified chapters, represented dates, encounter assignments and new candidate briefs. Preserve v1 imports, immutable shipped courses and the fictional preview boundary.
2. Extend shared document validation and commands, then the visual editor and agent CLI. Add a new chapter and cast through both surfaces; keep invalid drafts repairable.
3. Build a frozen multi-chapter fixture plan from the project. Use the real reducer, authored collision and gameplay placements in preview; test from any chapter and a complete journey.
4. Author one owner-selected world brief and source concept. Inspect the concept with Tom before expensive character modeling, then dispatch one exclusive Astra Blender scene owner. Prepare environment and encounter candidates, validate exports and compare matching views.
5. Update versioned asset reviews, inventory, thumbnails, catalog cards, documentation and handoff in the asset PR. Run strict docs/media checks and private browser journeys. Merge green PRs, deploy through the existing app and GitOps process where the change is included, and verify live editor/catalog results. Final gameplay asset promotion waits on Tom's exact-version review.

## Evidence to retain

Record the project export and deterministic CLI commands; validator/test results; normal-control browser traversal and snapshot isolation; source concept paths/checksums; Blender master/GLB/render/animation checksums and technical checks; live catalog links and deployed source/image identity; Tom's versioned decisions. Do not claim physical Safari acceptance from emulation.

## Active decision

Tom selected a full original haunted animatronic parody cast in a spooky retro Rat Casino and Halloween Haynesnightmares mood. The rat leads and Chick-flia supports. The prior Midnight Arcade treatment was too young, and the later cast images read too glam rock; he selected the worn classic-animatronic direction recorded in the [v003 cast review](../../../docs/assets/reviews/rat-casino-ensemble/v003.md). He explicitly put the six Blender character models before new level building. [PLAN015](015-haynesnightmares-asset-first.md) completed and deployed those six studio candidates. He then said “Looks great, let’s move forward to the rat casino level,” authorizing a private fictional trial with these exact versions. The [Rat Casino design](../../../docs/designs/021-rat-casino-level.md) pins the date, boss, four ordinary encounters, Golden cameo and scenic kit. The checked-in v2 project, shared command history, catalog mapping and direct playtest entry were released to the isolated private playtest. Final device/art acceptance remains separate from this private trial.

## Released checkpoint · September 23

The versioned builder, shared CLI, three-level fictional fixture preview, arcade/toybox procedural themes, two concept sheets and six studio-only Blender props were deployed through [app PR56](https://github.com/thaynes43/haynes-quest/pull/56) and [ops PR3133](https://github.com/thaynes43/haynes-ops/pull/3133). [The earlier release record](../../evidence/world-builder-release.json) tracks exact checks, image, Flux revision and browser proof. Completed PLAN015 then supplied six Rat Casino character candidates. No family media was used.

## Rat Casino private release · September 24

[App PR62](https://github.com/thaynes43/haynes-quest/pull/62) added the first owner-selected new world. It uses the exact prior Blender cast and scenic kit, an opt-in frozen catalog v6, shared editor/CLI validation, a portable three-chapter project and a direct chapter-only entry. [Ops PR3149](https://github.com/thaynes43/haynes-ops/pull/3149) pinned the signed image only to the private fixture workload. [The release record](../../evidence/rat-casino-level-release.json) contains the source/image identity, CI and Flux checks, exact model-byte comparisons, normal-control hosted traversal, editor preview and narrow Chromium evidence. The hosted trial cleared all four supporting mascots and Rat Pit Boss, recovered three synthetic memories, and showed a three-card chapter completion. Golden remained scenic. Final owner art review and physical Safari play remain open before normal gameplay promotion; PLAN010 still governs real family media.
