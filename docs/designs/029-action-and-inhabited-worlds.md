# DESIGN-029: Action and inhabited worlds

- Status: In progress
- Requested: October 4, 2026
- Builds on: [DESIGN-028](028-memory-rescue-and-fights.md), [DESIGN-026](026-personal-era-casts.md)

Tom reports that the working game remains boring: enemies are scarce, easy to run past, and the scenery feels barren. This release gives the routes frequent small fights, enemies that notice and chase the player, and planted spaces with recognizable silhouettes.

## Encounters

New immutable World A v8 and World B v7 templates place sixteen ordinary enemies per chapter: twelve on the main route in six paired regions, and four on optional branches. Equipment appears near the initial safe pads and the first pair appears about 15–22 m into the route. Later pairs aim for no more than 50 m of route between them, with recovery space and obby challenges between groups. Four distinct ordinary victories unlock the boss. Memories, chapter identifiers and age bands stay compatible with carried photo assignments. Published earlier plans and started saves retain their rosters and progression gates.

Ordinary enemies acquire within 8 m when a same-height ground route exists. They run at 4.4 m/s and pursue beyond their small spawn pads across touching static platform tops with a safe seam. Pursuit ends beyond 14 m from the enemy, beyond a 20 m spawn leash, at an unreachable route, or at friendly healing safety. Jump gaps, lifts, moving pieces and floor changes stop pursuit. Friendly healing spots reserve a 1.7 m recovery radius with enemies kept 3.2 m away on the same floor. The player can dodge visible attack windups; at most two ordinary enemies strike together. Existing saved enemy health remains authoritative, and returning home does not heal it. Friendly characters remain excluded from automatic targeting.

## Cast and scenery

Claude Code Opus 5.5 authors two isolated Blender scenes in parallel from image-generated construction references. Six additional ordinary silhouettes extend the locked era cast: Gadget Hammer Hopper, Mischief Kitten Skater, Lab Robot Sentry, Broccoli Bouncer, Bin Chicken Flower Thief and Demon Idol Drummer. Existing bosses remain the chapter leads. These are original parody minions with no copied logos or downloaded franchise meshes.

A broad canopy tree, a slim cypress and a flowering shrub supplement existing scenery. Planting uses visible groups beside safe route pads and larger silhouettes behind them. Garden chapters get green beds and trees; rooftops get planters; the casino and stage get themed potted or theatrical greenery. Decor stays outside movement corridors and does not hide enemies, memories or landing areas. Repeated props should read as a place, rather than a border around an empty platform.

Each model has a versioned concept, editable master, GLB, rendered views, animation and engine checks where applicable, and a current studio review page. The family-release candidate permission in [PRD-004 Q-03](../prds/004-family-release.md#owner-decisions) applies: technically checked candidates may appear in the children's levels while labeled awaiting review in the studio. A rejected candidate can revert to its predecessor. Coordinator review and actual owner approval remain separate.

## Acceptance

- Synthetic journeys verify reachable memories, encounter victories, boss unlocking, fall recovery and completion.
- Chase checks show a player running out of a spawn arena is pursued on the connected route, while height gaps and checkpoints remain safe.
- Desktop and portrait browser views show planted near-route spaces, distinct enemy silhouettes and usable controls without blocked views.
- Record real frame time, draw calls and asset loading for the denser routes; reduce scenery before compromising input responsiveness.
- Merge checked changes, deploy the signed image to both services, and publish the new family templates without resetting started saves or reading private photos.

Physical play with the children remains the measure of fun. Browser tests establish mechanics and rendering; they do not substitute for that feedback.
