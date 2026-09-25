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

Rules:

- A required (main-path) connection may require only moves unlocked at the chapter's **start** age.
- A branch connection may require any move unlocked at the start age.
- A branch must never hold a required objective (existing rule).
- Each chapter's first required use of a newly unlocked move must follow a practice stretch with a safe-miss floor (`safeMissPlatformId`). The validator reports a missing one as an error.

**D-04 New pieces** (world projects, `authored-level-v4`):

| Piece | Behavior | Validator limits |
| --- | --- | --- |
| `lift` | A platform moving vertically with sine motion; connections touching it are `ride` | Distance 0.5–8 m, period 4–20 s; the top and bottom stops each need a clear landing |
| `bounce-pad` | A flat pad ≥ 1.2 × 1.2 m that launches straight up at `small` 7.5 m/s (apex 1.9 m) or `big` 9 m/s (apex 2.7 m), with a squash animation and sound; the only start of a `bounce` connection | — |
| `crumble` | A platform that shakes 0.8 s after the first touch, drops, and returns after 3 s | Only on branch routes, never under an objective, arena or checkpoint |
| `decor` | A non-colliding prop instance: `{kitPropId, position, rotationY, scale 0.25–4}` from the theme-kit registry | ≤ 200 per level; its registry bounding box must not intersect any walkable volume (platform top to +2.4 m), connection strip or arena cylinder, unless it sits entirely ≥ 3 m above the route as overhead trim that clears the trailing camera |

Collectible trails (tokens and golden tickets) extend from the casino to every v4 theme, each with a themed look. Counts stay client-only for the run.

**D-05 Theme kits.** A data-driven registry maps a theme id to:

- palette, sky, fog and ground;
- a procedural fallback;
- its kit props, each with an id, a versioned GLB URL under `/studio/assets/media/...`, bounding box and SHA-256.

The hard-wired `CasinoScene` becomes one registry entry with identical output. A theme can go live with its procedural fallback and gain placed props as candidates land. A missing or failed GLB falls back to procedural geometry, never a broken scene. New themes follow the locked era table in [DESIGN-026](026-personal-era-casts.md).

**D-06 Authoring.** Each family world is produced by a TypeScript generator in `scripts/levels/` that emits ordinary editor command batches through the shared editor/CLI commands. Helpers such as `terrace`, `tower`, `liftShaft`, `bounceBalcony`, `practiceStrip` and `decorRing` are generator code; the output is plain level documents, never executable level content. Commands and fixtures are checked in and replay byte-identically under `pnpm levels:validate`. Every level satisfies DESIGN-011: broad landings, no timers or lives, and checkpoints before and after each section.

**D-07 Pacing targets per chapter** (the first release's authoring checklist):

- Height: the required route climbs at least 4 m overall and reaches at least three distinct levels.
- Content: at least one lift, one bounce pad, two sweepers or moving platforms, and one optional ability route with a golden collectible.
- Pace: something new happens on screen every 10–15 seconds of normal play.
- Length: the required route takes about 4–7 minutes for an experienced player.

## Limits and failure behavior

- `requires` connections, new pieces and decor fail validation in v1–v3 documents.
- A plan without a ladder behaves as jump-only.
- If a decor GLB fails to load, it is skipped and the theme falls back to procedural geometry.
- Reduced-motion settings disable lift and pad camera shake.

## Validation

- **Unit tests:** move ladder physics for every age boundary; ability-aware validator accept and reject cases; decor intersection rules; lift, bounce and crumble timing.
- **Autopilot (`authored-traversal-lib.ts`):** every required edge of every family chapter is traversed with **only** the moves unlocked at that chapter's start age; every branch edge with its declared move; every practice strip with a deliberate miss onto its catch floor.
- **Browser (lockstep Chromium):** each chapter completes. A real-time spot check of each chapter records frame time on desktop Chromium. Physical Safari feel stays an owner check.
