# DESIGN016: Personalized authored levels

Status: Accepted product direction from Tom, September 12, 2026. Builder contracts below are Astra's proposed architecture for subsequent implementation. This amends DESIGN012's setup emphasis; PLAN008 repairs the playtest first.

People build an adventure for a particular person. They choose the route, challenges, residents and bosses, and place meaningful pictures in the world. A photo service is a source of memories; manual uploads are another source. Connecting Immich and entering a name must not dictate a fixed generated campaign.

Each level has a represented date range and intended recovered-age transition. Its photo and encounter pickers suggest relevant options first. **Show more** opens the wider authorized library/catalog so the author can choose a cross-decade favorite or a picture outside those suggestions. This changes recommendation filtering, never media authorization, asset approval, source dates or earned progression. Birthday remains useful for age mapping; full name is useful for person lookup when that integration is used, not a prerequisite for an upload-only draft.

The current gameplay contract remains: useful equipment and two minor memories along the route, then a major memory after boss victory advances age. Three memories are the test quota, not a permanent builder restriction. Authors assign picture roles and locations deliberately. Completed published journeys retain their frozen content; editing a draft does not silently rewrite a player's past.

## Proposed reusable authoring contract

A versioned level document describes stable instances of reusable pieces, their transforms, connectors and settings. Pieces include platforms, bridges, moving platforms, hazards, checkpoints, encounters, pickups, memory anchors and the boss exit. Renderers, collision, combat and interaction use the same resolved placements. A visible actor and its attack target must not have separate guessed locations.

Humans use an editor; agents use the same validated document and commands. Both can add, move, inspect, validate, preview and publish. Avoid a second agent-only route generator or executable scripts embedded in level data. Reusable pieces carry tested behavior and placement limits so new layouts inherit fixes.

Before publication, validation should check:

- Stable unique IDs, finite transforms, supported piece/asset versions and bounded scene cost.
- Connected walk/jump routes, safe spawn/checkpoint clearance and required abilities available before their obstacles. Dynamic pieces need bounded travel, safe landing windows and a reset path.
- Encounter arenas, visible actors, hit targets and hazards sharing consistent coordinates; required opponents reachable by the available equipment; readable attack warnings and recoverable failure.
- Equipment obtainable before the fights that require it; optional friends excluded from victory gates; required memories reachable with a post-boss major gate that cannot be bypassed.
- Private photo authorization and upload admission, assigned minor/major roles, explicit represented dates and age transitions. Date mismatches are visible author choices, not silent metadata changes.
- Preview using the same runtime as published levels, with touch and keyboard checks, then a frozen revision for players. Invalid drafts remain editable with specific placement errors.

These checks need both deterministic geometry/contract validation and playable previews. A connectivity graph alone cannot prove a moving-platform jump is possible or an encounter is fun.

## Delivery sequence

First repair the existing interactions and combat. Then extract the current course into reusable authored pieces without changing its behavior, add a schema/validator and regression fixtures, and use that foundation for a longer branching obby with forgiving checkpoints. A visual editor, agent editing commands, manual-upload admission and period-aware pickers follow that shared contract. Parent creative review guides new enemies and routes before expensive artwork.

The six-year-old's opening should teach one idea at a time; later recovered ages can combine abilities and more demanding routes for an experienced eleven-year-old or adult. Actual age, recovered age and author-selected difficulty remain distinct. The lifetime campaign and explicit future extensions remain BL06.
