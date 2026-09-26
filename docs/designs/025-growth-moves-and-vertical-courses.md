# DESIGN-025: Growth moves and vertical courses

- **Status:** Accepted for the first family release, September 25, 2026
- **Last updated:** 2026-09-25
- **Satisfies:** [PRD-004](../prds/004-family-release.md) R-07–R-09, R-11
- **Builds on:** DESIGN-006 (age and abilities), DESIGN-011 (forgiving obby), DESIGN-019/020 (editor and world builder), DESIGN-021/022 (Rat Casino and fun pass); resolves DESIGN-022's ★ double-jump decision through PRD-004 Q-04

## Overview

Levels feel flat mostly because of a validator rule, not the physics. Required jumps may rise only 0.35 m, while the current jump reaches about 0.83 m, and scenery is generated from platform sizes rather than placed. This design adds three things:

- an **age ladder of lasting moves**, so growing up changes how you play;
- **new course pieces** that create height with little authoring effort;
- **placed, themed decor** from data-driven theme kits.

All of it is available only to new world projects and `family-world-plan-v1`. Published routes, v1–v3 documents, frozen plans and their physics stay byte-for-byte unchanged.

## Player journey

The avatar starts small. After each boss, the big memory plays "Turning N!", the avatar visibly grows, and any newly unlocked move appears on a short card ("New move: Double Jump — press Jump again in the air!"). The next chapter opens with a safe practice stretch for that move over a catch floor before the route asks for it.

Courses climb, with visible landmarks above the player:

- terraces and towers on the required path;
- lifts that carry you up;
- bounce pads that launch you to a balcony;
- optional side routes for the older child that need the latest move and hold the golden collectibles.

Themed props frame every room without blocking movement or fights.

## Detailed design

**D-01 Move ladder.** Moves are derived only from the plan's recovered age and frozen in the plan. Older plans grant jump only, with today's constants.

| Age | Move | Physics (60 Hz `stepObby`) | Controls |
| --- | --- | --- | --- |
| 0+ | Jump | Launch 5.0 m/s, gravity −15 m/s² (apex 0.83 m), unchanged | Space / Jump button |
| 2+ | High jump | Launch 5.9 m/s (apex 1.16 m) | Same |
| 4+ | Double jump | One mid-air launch of 4.6 m/s per airtime, reset on landing, coyote time respected | Press Jump again in the air |
| 8+ | Glide | While Jump is held and falling, fall speed is capped at 1.6 m/s and horizontal control keeps full speed | Hold Jump while falling |

Move speed, coyote time and jump buffer are unchanged. Falling and sweeper recovery are unchanged.

**D-02 Visible growth.** The avatar's visual scale is `min(1.16, 0.72 + 0.04 × age)`, using the infant model under 4 and the child model from 4. The collider is unchanged, so gameplay never depends on scale. The follow camera distance scales by `0.9 + 0.1 × scale`.

**D-03 Ability-aware connections.** Connections gain an optional `requires` field: `high-jump`, `double-jump` or `glide`. The validator applies these limits (about 60–75% of physical reach, for forgiveness):

| Connection | Max rise | Max gap | Notes |
| --- | --- | --- | --- |
| Jump (none) | 0.35 m | 1.4 m | Existing |
| `high-jump` | 0.70 m | 1.7 m | |
| `double-jump` | 1.30 m | 2.4 m | |
| `glide` | 0 (must descend ≥ 0.8 m) | 4.0 m | |
| `bounce` | 2.6 m | 2.2 m | From a bounce pad; any age |
| `drop` (mode) | Must descend 0.36–3.0 m | 1.4 m | To a surface that does not move; any age; a jump's gateway strips |

A `drop` replaces spending a growth move on a descent. A plain jump already covers 0.35 m either way, so a drop starts just below that. The lower surface of a `drop` or a `glide` may reach back under the takeoff deck, but along the travel axis it must extend at least 1.05 m past the takeoff edge: the avatar inset plus a 0.75 m landing strip. Otherwise the landing lies under the deck, the gap reads as zero, and a player who leaves the edge has already overshot it (`connection.landing-under-source`). Where the landing reaches back under the deck, the auto-pilot steers for the middle of its part beyond the edge instead of its centre.

Rules:

- A required (main-path) connection may require only moves unlocked at the chapter's **start** age.
- A branch connection may require any move unlocked at the start age.
- A branch must never hold a required objective (existing rule).
- Each chapter's first required use of a newly unlocked move must follow a practice stretch with a safe-miss floor (`safeMissPlatformId`). The validator reports a missing one as an error.
- A `bounce` may also declare a `safeMissPlatformId`, so a practice bounce over a catch floor counts as practice. Its catch floor sits well below the pad, so its retry connection may lead either to the pad or to a deck that leads onto the pad.

**D-04 New pieces** (world projects, `authored-level-v4`):

| Piece | Behavior | Validator limits |
| --- | --- | --- |
| `lift` | A platform moving vertically with sine motion; connections touching it are `ride`. An optional `dwell` pauses it at each stop | Distance 0.5–8 m, period 4–20 s, dwell 0–3 s; the top and bottom stops each need a clear landing |
| `bounce-pad` | A flat pad ≥ 1.2 × 1.2 m that launches straight up at `small` 7.5 m/s (apex 1.9 m) or `big` 9 m/s (apex 2.7 m), with a squash animation and sound; the only start of a `bounce` connection | — |
| `crumble` | A platform that shakes 0.8 s after the first touch, drops, and returns after 3 s | Only on branch routes, never under an objective, arena or checkpoint |
| `decor` | A non-colliding prop instance: `{kitPropId, position, rotationY, scale 0.25–4}` from the theme-kit registry | ≤ 200 per level; its registry bounding box must not intersect any walkable volume (platform top to +2.4 m), connection strip or arena cylinder, unless it sits entirely ≥ 3 m above the route as overhead trim that clears the trailing camera |

**Lift dwell.** With `travel.dwell` of `d` seconds, a lift waits `d` at its bottom stop, rises for `period / 2` with the same eased speed profile, waits `d` at its top stop and descends for `period / 2`. A cycle lasts `period + 2d`, and phase 0 still starts at the bottom stop, at the start of its pause. A zero or absent dwell produces exactly the original course and motion. The dwell turns a moving target into a platform a child can walk on and off.

Collectible trails (tokens and golden tickets) extend from the casino to every v4 theme, each with a themed look. Counts stay client-only for the run.

**D-05 Theme kits.** A data-driven registry maps a theme id to:

- palette, sky, fog and ground;
- a procedural fallback;
- its kit props, each with an id, a versioned GLB URL under `/studio/assets/media/...`, bounding box and SHA-256.

The hard-wired `CasinoScene` becomes one registry entry with identical output. A theme can go live with its procedural fallback and gain placed props as candidates land. A missing or failed GLB falls back to procedural geometry, never a broken scene. New themes follow the locked era table in [DESIGN-026](026-personal-era-casts.md).

**Era themes.** Five themes exist only in `authored-level-v4` levels, one per new era in DESIGN-026:

| Theme | Name | Trail token / golden collectible | Kit props (procedural until the WO111 kit lands) |
| --- | --- | --- | --- |
| `clubhouse` | Toon Clubhouse | toon star / golden gadget | clubhouse tower facade, curly slide, gadget toolbox stand, rounded hedge, stage marker |
| `harbor` | Rescue Harbor | rescue badge / golden bone | lookout tower facade, pier bollard, rescue buoy stand, small boat |
| `rooftop` | Hero City Rooftops | city coin / golden gizmo | water tower, rooftop AC unit, crane hook, billboard frame |
| `playroom` | Sing-Along Playroom | bubble / golden rattle | stacking-block tower, toy bus garage, crib-rail fence, giant plush ball |
| `casita` | Magic House Garden | butterfly / golden candle | casita terrace wall, flower planter, patterned door, butterfly arch |

Each has a bright storybook palette and no automatic scenery: no clearing trees, meadow, hills or placeholder props. They also drop the two non-colliding side banks the older themes draw level with y=0 beside a course, which would sit beside ground-level decks as a fake floor; the course ground stays 1.4 m below. Only the level's placed decor dresses it, and the finish shows the procedural pending marker. Their fog runs from 30 m to 95 m, inside the camera's 100 m far plane, so tall landmarks read from across a chapter; the older themes keep 20–52 m. The party kit also gains concert props for the Besties stage finale: a stage speaker, a light truss and a star backdrop. Stand-ins can now be a ball, a tank on legs, stacked blocks or a panel on legs, as well as a slab, post or arch.

**Shared props.** Props registered to the `shared` kit may be placed in any v4 theme; every other prop stays bound to its own theme. The shared kit holds the existing exact GLBs: the clearing tree, stone and arrival landmark, the skyline toybox block tower, safety rail and wind-up lantern, and the midnight arcade ticket arch, cabinet and joystick bollard. Their ids are the catalog-inventory ids. Their bounds are measured from each GLB (accessor extents through the node transforms, rounded outward to the millimetre), and each SHA-256 is the inventory checksum of the exact file. Registering a prop does not put it in play: the first level that places a shared prop records that gameplay use in the asset catalog in the same PR.

**D-06 Authoring.** Each family world is produced by a TypeScript generator in `scripts/levels/` that emits ordinary editor command batches through the shared editor/CLI commands. Helpers such as `terrace`, `tower`, `liftShaft`, `bounceBalcony`, `practiceStrip` and `decorRing` are generator code; the output is plain level documents, never executable level content. Commands and fixtures are checked in and replay byte-identically under `pnpm levels:validate`. Every level satisfies DESIGN-011: broad landings, no timers or lives, and checkpoints before and after each section.

Generators own a whole world with shared commands. `chapter.add`, `chapter.remove` and `chapter.reorder` shape the chapter list, and `chapter.level.replace {chapterId, level}` replaces a v4 chapter's whole level document. The level must be v4 with the chapter's route id; it is validated like any other edit, and the chapter keeps its encounter assignments. `worldShellCommands` in `scripts/levels/lib/growth-kit.ts` turns a new world project's two seeded chapters into an exact chapter list; any chapter may reuse a seeded route id. `levels:editor world-template <id> [name] --catalog parody-catalog-v8` starts a CLI-built world on the family catalog (v8 is v7 plus the landed family-era models). `pnpm levels:validate` replays every `scripts/levels/examples/<name>.project.json` from its `<name>.commands.json` (one batch or an array of batches), starting from a world project with the example's own id and catalog.

**D-07 Pacing targets per chapter** (the first release's authoring checklist):

- Height: the required route climbs at least 4 m overall and reaches at least three distinct levels.
- Content: at least one lift, one bounce pad, two sweepers or moving platforms, and one optional ability route with a golden collectible.
- Pace: something new happens on screen every 10–15 seconds of normal play.
- Length: the required route takes about 4–7 minutes for an experienced player.

**D-08 Family-world lints.** `src/shared/family-world-lint.ts` holds pure checks for the coordinator's family-world rulings. Chapter generators run them in their tests; the game and validator do not, so no published route or saved project changes. `lintFamilyChapter(level, options)` returns structured findings (`rule`, `code`, `severity`, `path`, `subject`, `message`, and a `measured` value with its `limit`):

- **(a) Bounce pads:** the gap from a pad to its landing and to its approach deck is at most 0.35 m. The small gap helps only when the landing's side reaches down to the pad, so a slow bounce meets that wall and bounces again. A landing whose underside sits above the pad top is an error (`family.pad-gap.underhang`): a partial-stick bounce drifts under it.
- **(b) Camera:** no main-path connection heads toward the camera (+z) more than 30° off the lateral axis.
- **(c) Fight clearance:** each strike envelope (the arena expanded by the role's reach: 1.35 m for ordinaries, 2.25 m for bosses) stays a margin inside its deck and off every connection strip and pad or lift approach at its height.
- **(d) Short boss retries:** the route from minor-two to the boss arena is at most a configurable length (25 m).
- **(e) Chapter ending:** the major memory, reward respawn and finish share the final main-path platform, with nothing leaving it.
- **(f) Lifts:** each lift dwells at least a configurable minimum, and its landings sit within 0.15 m horizontally and vertically of their stops. A warning flags a landing a walking child can board from or leave onto only with a hop; the ride's direction, not the stop, decides which way the child steps. Dwell does not close the shaft: a child who walks toward a lift while it is away falls in about two times in three, whatever the dwell. So every landing that boards a lift needs a checkpoint (`family.lift.boarding-checkpoint`), which makes that fall a short retry. A static floor in the shaft is no guard, because a descending lift pushes a player standing on it through the floor, so any surface under a lift must leave at least the actor height (1.22 m) below the lift's bottom stop (`family.lift.shaft-floor`).

World presets set the margin, dwell and boarding-checkpoint severity: World A uses 0.5 m, 1.5 s and a warning, and World B 1.0 m, 2.0 s and an error.

## Limits and failure behavior

- `requires` connections, `bounce` and `drop` connections, new pieces, lift dwell, era themes and decor fail validation in v1–v3 documents.
- A plan without a ladder behaves as jump-only.
- If a decor GLB fails to load, it is skipped and the theme falls back to procedural geometry.
- Reduced-motion settings disable lift and pad camera shake.

## Validation

- **Unit tests:** move ladder physics for every age boundary; ability-aware validator accept and reject cases; decor intersection rules; lift, bounce and crumble timing; lift dwell motion and byte-identical zero dwell; drop and bounce-practice limits; each family-world lint.
- **Autopilot (`authored-traversal-lib.ts`):** every required edge of every family chapter is traversed with **only** the moves unlocked at that chapter's start age; every branch edge with its declared move; every practice strip with a deliberate miss onto its catch floor, including practice bounces. A drop hops by default and can step off the edge instead; lift waits cover a whole cycle, dwell included.
- **Kid model (`family-kid-lib.ts`):** `bounceWalkOn` proves each required bounce at analog stick 0.4–1.0 without a Jump press (R2). `liftWalkIn` counts shaft falls for a child who walks at a lift at random moments. `runGrowthRouteWithWaits` runs the required route like `runGrowthRoute`, but looks ahead on a copy of the simulation. It walks around sweeper zones on the current deck and waits for a sweeper window before walking or at the takeoff, committing the shortest wait that crosses without a recovery. Its `seconds` are the R10 pacing measurement.
- **Browser (lockstep Chromium):** each chapter completes. A real-time spot check of each chapter records frame time on desktop Chromium. Physical Safari feel stays an owner check.
