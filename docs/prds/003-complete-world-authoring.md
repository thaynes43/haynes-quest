# PRD003: Author complete new worlds

- **Status:** Proposed implementation scope, September 23, 2026
- **Source:** Tom's request to extend the world builder beyond edits to the two shipped levels, support new encounters, and create distinct worlds and assets
- **Related:** [PRD002](002-level-editor-mvp.md), [DESIGN016](../designs/016-authored-levels.md), [DESIGN019](../designs/019-level-editor-workspace.md), [DESIGN012](../designs/012-player-journey-curation.md)

## Outcome

A human or agent can add an independently identified level to a portable project, author its course and encounter choices, and play it through the real fictional runtime. The two published levels and existing saves remain immutable. New artwork follows the asset studio's concept, Blender, and exact-version review process.

## Requirements

| ID | Requirement |
| --- | --- |
| R-01 | A versioned project can contain a bounded ordered set of independently identified levels. Add, duplicate, rename, reorder and remove levels without changing a published route ID. Existing project exports and browser drafts remain importable. |
| R-02 | Each level uses the shared authored geometry, placement and progression validators. A newly added level has editable spawn, equipment, two minor memories, four ordinary encounters, boss, major memory, finish, friendlies and routes. An unfinished level remains editable; a preview starts only after validation. |
| R-03 | An author chooses a represented date range, three explicitly dated fictional preview memories and an intended recovered-age transition. Validation enforces chronology, the boss-to-major-memory gate and reachable abilities. Authoring never fabricates dates for a real person's journey. |
| R-04 | An author can choose a prepared enemy or boss identity for each encounter slot and add a new candidate to the authoring catalog with a stable ID, period, recognizable reference, visual joke and a supported behavior preset. Candidate entries use a clearly identified placeholder in isolated previews until an exact artwork version passes its review gate. Arbitrary model URLs and executable behavior are not project data. |
| R-05 | Distinct world themes can select prepared environment kits and art direction without changing collision or route semantics. A missing or pending kit has an honest preview fallback; it cannot silently become approved final gameplay art. |
| R-06 | The private editor and agent CLI expose equivalent commands and validation for level and cast changes. Export remains a durable handoff; browser autosave remains local until parent/admission and shared-draft ownership are designed. |
| R-07 | Playtest freezes both the complete authored project and its encounter plan. Starting from any level and finishing a multi-level test use the normal action reducer, movement, collision and memory gates. Another draft edit or tab cannot mutate that run. |
| R-08 | The first new world includes a short owner-selected encounter brief, one inspected concept before expensive modeling, versioned model/environment candidates with previews and exact checksums, and the same-PR review, inventory, thumbnail and catalog updates. Tom's exact-version approval is required before final gameplay promotion. |
| R-09 | The fictional fixture remains isolated. Real photos, private likeness material and person identifiers cannot enter exported projects, static docs, diagnostic output or the new preview endpoint. Shared publishing and real player admission still follow PLAN010. |

## Acceptance

Create a third level through the browser and the CLI, assign a different cast, export/import the project, validate it and traverse its route in the real playtest. Confirm the original two routes and older saves are unchanged, invalid period/asset/geometry choices fail with actionable paths, and two concurrent previews keep their frozen content separate. Test keyboard and touch browser journeys; physical Safari acceptance must be recorded separately. Publish the candidate asset review with the actual concept-to-model relationship and live catalog checks.

## Owner decision

**Q-01 resolved, September 23:** Tom chose a spooky retro Rat Casino for the first new world, with a full original animatronic parody lineup and a Halloween Haynesnightmares mood. The rat leads; Chick-flia is a supporting character. After reviewing the early images, he rejected their glam-rock finish and selected a classic, worn family-venue animatronic direction. The [v003 cast reference](../assets/reviews/rat-casino-ensemble/v003.md) and [completed PLAN015](../../.agents/plans/completed/015-haynesnightmares-asset-first.md) record that correction and the six published Blender candidates. Tom asked for those models before building the level, then said “Looks great, let’s move forward to the rat casino level” after viewing the displayed cast. The exact models now enter a private fictional level trial; final device/art acceptance is still required before normal gameplay promotion.
