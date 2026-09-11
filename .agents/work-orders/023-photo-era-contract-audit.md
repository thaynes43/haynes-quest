# WO-023: Photo-era, catalog identity and obby contract audit

- **Status:** Complete; read-only findings for Astra ratification
- **Model / dispatch:** Native Codex GPT-5.6 Sol, `xhigh`, fresh-context bounded audit
- **Worktree / branch / audited base:** `/home/dev/work/quest-photo-era-audit`, `agent/quest-photo-era-audit`, `d160f20e50dce83629da88e5eccac1baae9fdebf`
- **Parent branch movement during audit:** `agent/quest-era-asset-intake` advanced to `fc4791f`; its intervening source changes add enemy-animation/media-cache support and do not change the date, plan, roster-selection, movement or checkpoint contracts below.
- **Owned path:** `.agents/work-orders/023-photo-era-contract-audit.md` only
- **Required reading completed:** repository instructions and handoff; PLAN-005; DESIGN-003/004/005/006/009/010; shared adventure/contracts; photo setup, fixture and Immich adapters; stored-data schemas/migrations; client era/scene selection; controller, level and combat runtime; related server/game/E2E tests
- **Boundaries:** No production data, credentials, Immich calls, Blender, generation, infrastructure, PR, implementation or user-facing copy. The Astra lead owns the design ruling and integration.

## Lead disposition at intake

The auditor's age-zero short-hop / age-four stronger-jump wording below is a **proposed implementation**, not a user ruling. Tom asked for forgiving obby gameplay and timed jumps, without specifying new starting abilities. Root retains the existing age-zero movement tutorial and introduces jumping after first-boss growth, as recorded in DESIGN-011 and WO-024. No ability-version migration is currently selected. The birthday and catalog-identity findings are accepted; the source-local date basis remains a required decision before real Immich admission. The six rejected creatures are not eligible as neutral enemy fallbacks.

## Owner corrections audited

The current requirements supplied to this audit supersede two assumptions in the reviewed documents and assets:

1. Enemies must read as recognizable pop-culture parodies from the periods represented by the journey, with eligibility driven by photo capture dates and the selected person's birthday. Generic ambient creatures do not meet that content requirement.
2. Roblox-style obstacle-course play is essential alongside combat. A short hop from age zero and stronger jumping at age four were discussed as a possible implementation; see the lead disposition above. The main path uses forgiving, wide platforms, moving obstacles, checkpoints and fall recovery suitable for a six-year-old player.

OAuth/admission remains deferred. That does not permit fixture-year shortcuts to become the real-photo or production journey contract.

## What already works and should be retained

### Dates, age and progression

- Setup already requires a field named `birthDate` in the shared request and strict server schema (`src/shared/contracts.ts`, `src/server/validation.ts:15-41`). Both preview and save rows freeze it in a PostgreSQL `date` column (`src/server/db/schema.ts:37-80`). There is no implemented age-anchor alternative. The new owner correction therefore settles stale document language in favor of the code's birthday model; no `birth_date` rename is needed.
- Immich discovery is person-scoped and image/date filtered. It uses the resolved source person ID, requires timeline visibility and membership, excludes archived/trashed/offline media, and orders the bounded search ascending (`src/server/photos/immich.ts:179-239,316-339`). Upload order is not consulted.
- The adapter derives `ageYears` from the frozen birthday and chosen gameplay date. `wholeYearsAt` subtracts one before the birthday in a calendar year; `isValidFrozenManifest` recomputes every stored age, rejects pre-birth dates, duplicate IDs and nonmonotonic dates/ages (`src/server/domain.ts:129-167`). Selected IDs may arrive in checkbox order, but both stores filter the already ordered preview manifest, so the save remains chronological.
- Journey planning correctly starts at memory age zero. The first level's `startDate` is the birthday. Later levels use the last photo date consumed in the prior bundle. `eraYear` is derived from that start date (`src/shared/adventure.ts:130-177`), which matches the corrected sequence: fight in the current age/calendar period, then consume the bundle, then enter the period reached. It does not grant the target photo's later period before victory.
- Age thresholds are provisional but the implemented gating is sound: boss defeat only changes the phase to `memory-released`; each reveal only records a memory; one complete-bundle action changes age, abilities, appearance and active level (`src/shared/adventure.ts:276-351`). The store supplies server-owned frozen values, revision checks and action receipts. Existing server and E2E tests prove age remains zero through boss/reveal, becomes four only after consumption, then enters 2024.
- Plans, memories and mutable state are persisted separately in JSONB. Existing save validation checks that plan memory order matches the frozen manifest, every later `startDate` equals the preceding bundle's last photo date, and state age equals the last completed level's target (`src/server/domain.ts:299-355`; `src/server/adventure-schema.ts:141-302`). Later source date edits do not recalculate a save, while media authorization is rechecked.
- Existing combat defeat/retry retains inventory and completed prior levels while restoring current health and current-level encounters. This is useful for combat defeat, but has different semantics from obstacle fall recovery.

### Input and runtime seams useful for an obby

- Keyboard and touch already expose one edge-triggered `jump` input through the shared game input layer. Movement is camera-relative, frame delta is capped, input is cleared on pause/visibility/pointer lifecycle, and the controller has grounded/gravity state.
- `LevelLayout`, `createLevelLayout`, `checkpointForSave`, `stepController` and `createGame.applySave/resetController` are clear seams for route geometry, controller collision and respawn. The runtime already resets position, velocity, facing, enemies and scene on a level transition or authoritative combat retry (`src/game/createGame.ts:263-345`).
- The current tests meaningfully cover camera-relative movement, a legacy raised step, walking off a raised surface, age gating of that step, level-transition reset and combat retry with retained inventory. These tests are useful foundations, although they do not exercise an era-level obstacle course.

## Concrete date and era gaps

### P0: There is no catalog selection contract in the saved plan

`FrozenEncounterDefinition` stores only a generated encounter ID, generic role/kind and combat numbers. `createEncounters` always creates `ordinary-a`, `ordinary-b` and `boss`; it receives the level index but no date, birthday, catalog or setup choices (`src/shared/adventure.ts:30-36,384-413`). `RULE_VERSIONS.catalog = generic-era-catalog-v1` is a label only. No server function filters historical eligibility, selects a character, or freezes a catalog/asset identity.

Consequences:

- Encounter IDs such as `level-1-1990-encounter-1` identify a slot, not the parody occupying it.
- A later client/catalog release can silently change what an active save renders without changing the plan or progress.
- The server cannot reject a later-created parody in an earlier period, prove ordinary and boss eligibility, handle a revival window, or report missing coverage.
- Current stored-data validation correctly treats frozen combat numbers as authority, but it has no frozen content identity to validate structurally.

Recommended bounded code seam for new journeys:

1. Add a finite versioned runtime catalog module with stable entry IDs. Each entry needs at least `id`, `definitionVersion`, `role`, reusable `behaviorKind`, inclusive `eligibleFrom`/`eligibleThrough` day windows (or multiple explicit windows for revivals), required/compatible abilities, and pinned model/animation/audio asset IDs and versions. Period evidence, parody target and recognizability-review evidence belong in the catalog/source manifest; runtime does not need to expose private photos or fetch reference media.
2. Add `selectEncounterPlan(periodDate, availableAbilities, catalogVersion, stableSeed/preferences)` and call it while the store creates the save. Filter exact date eligibility first, then ability compatibility, then stable variety/preferences. Return an explicit `ERA_CATALOG_UNAVAILABLE` setup/create error when the required ordinary/boss roles are absent unless Astra defines an authored neutral fallback. Never substitute a later-era entry.
3. Freeze the selected identity into each encounter definition: at minimum `catalogEntryId`, `catalogEntryVersion`, `assetId`, `assetVersion`, plus its role/behavior/combat values. Freeze the catalog version and selection seed or explicit selections at plan/level scope. Prefer explicit selections because they remain inspectable after selection code changes.
4. Preserve `startDate` as the authoritative period date and use it for eligibility. Keep `eraYear` only as a derived display value. Year-only matching cannot express a mid-year debut or a bounded revival window.
5. Validate creation against the selected catalog version, then validate stored plans structurally without recomputing them from today's catalog. A withdrawn asset should enter a recoverable unavailable/replacement path without rerolling progress.

### P0: The browser collapses every possible date into two fixture rosters

- `src/client/era.ts:3-26` maps every year below 2024 to Pixel Orchard/Blockling/Signal Moth/Buffer Baron and hardcodes a **2020** subtitle; every year at or above 2024 maps to Looplight Fair/Loop Dancer/Prism Mimic/Trendweaver and hardcodes a **2024** subtitle.
- `src/game/scene.ts:163-173` independently reduces the level to `later = eraYear >= 2024`, selecting one of two palettes and environments. It builds encounters from `kind` plus that boolean (`src/game/scene.ts:303-334`).
- `src/game/scene-catalog.ts:4-20` contains exact model mappings but has the same boolean split; on the audited base, `GardenScene` does not call `encounterArtwork` for encounters yet.

A 1990, 2010 or 2023 journey is therefore labeled 2020 and gets 2020 content. A 2035 journey is labeled 2024 and gets 2024 content. The existing tests cover only the 2020/2024 fixture and therefore affirm the shortcut rather than the date contract.

Replace year/boolean dispatch with the frozen level and encounter identities. `ActiveLevelView` should carry the pinned period/environment identity and each `EncounterView` the pinned catalog/asset identity. UI names and scene assets must resolve those IDs under the frozen catalog version; they must not infer identity again from `EncounterKind` or compare the year to 2024.

### P0: The authored/design contract conflicts with the recognizability correction

DESIGN-005 currently says broad period influences with original names/silhouettes and expressly rejects a renamed or recolored recognizable franchise character. The current roster studies are broad ambient metaphors (blocks, signals, ribbons, masks and spools), and DESIGN-004 calls them original curation. That direction does not meet the owner's new requirement for recognizable pop-culture parody.

This is a content/design conflict, not a date-selection implementation detail. Astra must revise the design and exact-version review criteria before more roster generation. Code can enforce stable identity, date windows, provenance and approval state; it cannot prove that a silhouette reads as the intended parody to a player. Existing generic candidates may remain preserved as historical studies or an explicitly selected neutral fallback, but must not be represented as satisfying the corrected roster.

### P1: The real-photo date basis is explicitly provisional

The adapter currently takes `fileCreatedAt`, converts the timestamp to an instant, then truncates its UTC ISO date (`src/server/photos/immich.ts:29-40,316-332`). The search boundaries are also UTC midnight strings. DESIGN-009 accurately records this as provisional and says source-local date/timezone must be settled before real activation.

This can move a near-midnight capture across its displayed day, birthday boundary, age threshold, year boundary and catalog eligibility boundary. Existing tests use noon UTC only. The upstream `fileCreatedAt` field is at least a capture-oriented field rather than an upload-order field, but this repository does not freeze its original offset, source-local day, precision or conflict evidence.

Before real-photo activation, ratify one provider mapping and keep it versioned:

- Keep `FrozenMemory.date` as the normalized gameplay day, but add a frozen `dateBasis`/precision record (for example provider field, source-local/UTC/unknown basis and rule version), or place the equivalent on the frozen manifest. Do not expose it in normal client views unless needed.
- Derive search bounds and the final gameplay date with the same rule. If Immich cannot supply enough timezone/precision information for an unambiguous day, return an actionable correction/setup state rather than guessing across a birthday or catalog boundary.
- Bump the age/date rule version for new saves when this mapping changes. Existing `fileCreatedAt`-UTC saves keep their frozen dates and ages.

### P1: Birthday is implemented, while documents still claim birthday versus anchor is open

DESIGN-003, DESIGN-006 and PRD Q-06 still describe birth date versus earliest-photo age anchor as unresolved. The request schema, UI, database and frozen-manifest validator all require an exact birthday and implement no anchor. The owner correction now explicitly names the person's birthday.

Ratify `birth-date-whole-years` as the production age source and remove the alternative-anchor claim. The existing columns require no migration. Keep an explicit rule version and settle leap-day birthday behavior with a test; do not reinterpret an old save if that policy changes. If Astra wants a future approximate birthday, model that later as a new discriminated age-source kind with precision, rather than overloading `birthDate`.

### P2: Bundle grouping has untested same-age and broad-gap edges

Threshold grouping is internally coherent, including sparse catch-up, but it ends a bundle at the first photo reaching a threshold. A following photo at the same age becomes a new level that may have `targetAgeYears === startAgeYears`. Also, a sparse opening can include memories years beyond the birthday period and then finish without a separate fight in the final photo's period. The current sparse test explicitly accepts a 1980 opening containing 1981 and 1995 memories as one level.

The latter follows the current "fight, then reach that age/period" ordering; a final memory does not promise another level. The same-age zero-growth level needs an explicit ruling because the new wording ties growth to the transition. Test the chosen behavior: either include the remaining same-age memories in the preceding bundle, allow a same-age sublevel with no growth claim, or split by a separately defined calendar-period rule. Do not silently use the target memory date for pre-boss enemies, which would reveal a future period early.

## Concrete obby and jump gaps

### Proposal: age-zero hopping would require versioned ability changes

`abilitiesForAge(0)` returns only `move, interact`; age four adds the only `jump` ability (`src/shared/adventure.ts:119-121`). `createGame` passes `save.abilities.includes("jump")` as a boolean to the controller (`src/game/createGame.ts:528-536`), and both keyboard and touch actions are ignored while it is false. The touch button and keyboard hint are disabled/hidden at age zero (`src/client/GameScreen.tsx:394-420`). DESIGN-006/009 and tests explicitly describe jumping as an age-four unlock.

Do not merely change `abilitiesForAge` globally. Stored v1 era saves are validated against that global function; adding age-zero `jump` would make existing state fail validation or silently rewrite its capability meaning.

Recommended bounded versioned seam:

1. For new plans, make basic `jump` part of the age-zero ability set and add a distinct accumulated capability such as `strong-jump` at age four. Keep one Jump input action.
2. Add an ability/movement rule version to the frozen plan or `RuleVersions`; the current `age` version describes age arithmetic and should not have to hide movement semantics. Make stored-state validation choose the expected set by that frozen version. Existing `era-level-plan-v1` saves retain the old no-jump/jump-at-four behavior unless Astra chooses an explicit compatible migration.
3. Replace `stepController(..., canJump: boolean, ...)` with a frozen/runtime movement profile derived from the versioned ability set. The controller already has the correct point to consume jump velocity; its current single constant is `5` with gravity `-15` (about a 0.83 m ideal apex). Astra owns the short/strong values and forgiveness tuning.
4. Update the post-consumption ability announcement and tests to describe stronger jumping, not first acquiring Jump.

### P0: Era levels contain no traversable obstacles or falls

Every era level has `step: null`, one flat rectangular collision surface and fixed landmarks (`src/game/level.ts:127-180`). `groundHeightAt` supports only the legacy route's single Z threshold. Movement clamps X/Z inside the rectangle, so the player cannot leave the ground, fall through a gap, land on a platform or interact with a moving obstacle. Scene geometry is decorative and does not define controller collision.

Use the existing level/runtime seams to add a bounded versioned route definition rather than deriving collision from rendered meshes:

- Freeze or pin a `routeDefinitionId`/version per level. A route definition supplies broad platform collision volumes, moving-platform paths/phases, obstacle/hazard volumes, a kill plane, and ordered checkpoint IDs/positions. The client scene and controller must read the same definition.
- Generalize `groundHeightAt` into a support/collision query over static and time-dependent platform volumes. Pass the same bounded simulation time/transform to collision and rendering so moving obstacles do not drift visually from their hit volumes.
- Keep the main route's dimensions and timing data explicit and testable; Astra owns final widths, speeds, optional side challenges and child-friendly margins.
- Treat route capability requirements as catalog/plan data and validate them against abilities available at the level's **start**, just as encounter requirements are validated. The opening route may require only the short hop; the stronger jump cannot gate the boss that awards it.

### P0: Current retry is the wrong fall-recovery operation

There is no hazard/fall state. The only `fallen` phase comes from combat HP reaching zero. `retry-level` restores health and resets every encounter in the current level, while preserving inventory and earlier levels (`src/shared/adventure.ts:232-247`). Reusing it for every missed platform would erase current-level fight progress and make a forgiving obby punitive.

Add a distinct fall recovery path:

- At minimum, local hazard detection resets the controller to the last reached checkpoint, clears vertical velocity/input/pending hit contact, and restarts threatened enemy telegraphs while leaving the authoritative save untouched. This preserves inventory, encounter HP/defeats, memory states, age and revision by construction.
- If checkpoints must survive leave/resume or another device, add frozen checkpoint definitions plus `activeCheckpointId` to a new adventure-state version and a discrete idempotent `activate-checkpoint` action. The server can validate that the ID belongs to the active route and advances monotonically; it need not accept coordinates or claim authoritative physics. Reload then derives the position from the frozen route ID/checkpoint ID.
- Add a separate `recover-from-fall` server action only if falling changes server-owned health or another durable value. It must preserve current encounter progress; do not alias it to `retry-level`.

### P1: A baseline hop changes combat balance through a hardcoded height check

Enemy contacts and `validStrike` treat any player Y above `0.3` as fully safe (`src/game/combat.ts:233-242`; `src/game/createGame.ts:394-412`). A test explicitly proves `y = 0.31` clears the entire strike. Giving age zero even a modest hop can therefore add invulnerability that the opening combat was not balanced around.

Make attack avoidance use an explicit encounter hit volume/avoidance rule compatible with the versioned movement profile. Test the opening short hop and age-four stronger jump against ordinary/boss attacks. Whether a specific parody can be jumped over is a design value, not a universal `y > 0.3` rule.

## Schema and migration boundary

The physical PostgreSQL shape can remain unchanged for the first catalog/date/route correction because plans, states and versions are JSONB. The strict JSON schemas cannot: `planSchema` accepts only literal `era-level-plan-v1`, encounter objects reject extra identity fields, state validation uses one global ability rule, and `SaveFormat` currently knows only legacy v1 and era-combat v2.

A bounded compatible migration is:

1. Introduce `era-level-plan-v2` as a discriminated schema/type carrying frozen encounter/catalog/asset IDs, exact period date and route/ability rule IDs. Keep the v1 parser and renderer.
2. Keep `era-combat-state-v2` only if no durable checkpoint/capability state shape changes. If `activeCheckpointId` or a materially new state invariant is added, introduce `era-combat-state-v3` and a schema union.
3. `save_format` can remain `era-combat-v2` if the API/reducer supports both plan/state variants under it. If the format string is bumped, migration SQL must first widen `quest_saves_format_known` and `quest_saves_adventure_shape`; do not rewrite legacy or v1 plans in place.
4. Make new saves use the new catalog, date-basis, ability and route versions. Existing v1 saves keep their exact two-roster mapping and old jump semantics. Do not resolve their generic slots to newly authored parodies automatically; they lack a frozen selection from which to prove identity.
5. Add current catalog/route availability handling separately from stored-plan validity. A missing asset may block rendering with a recoverable state, but must not corrupt or reroll the save.

No data backfill is required merely to add fields inside new-version JSON documents. A backfill is appropriate only if Astra defines an explicit, deterministic compatibility map for existing v1 saves; the safer default is versioned preservation.

## Meaningful tests to add with implementation

### Temporal and catalog

1. Whole-year age immediately before/on/after a birthday, plus the ratified leap-day rule.
2. A source timestamp near midnight with an offset, including a case that crosses both a birthday and January 1; search bounds and frozen gameplay day must use the same mapping.
3. A photo imported years later still selects by capture/event date, never upload/import time. Missing/ambiguous precision follows the chosen correction/error path.
4. Two subjects at the same memory age in different calendar periods get different eligible parody IDs while keeping identical age abilities.
5. Inclusive introduction/end boundaries, a mid-decade debut and a later revival window. An interest/preference cannot select outside the date window.
6. Missing ordinary or boss coverage returns the designed fallback/setup state and never chooses a later period.
7. A threshold-crossing bundle uses the current level's frozen `startDate` for pre-boss encounters; only consumption exposes the next level selected for the prior bundle's final photo date.
8. A 1990, 2010, 2023 and 2035 plan renders the exact frozen period/character names and assets, with no hardcoded 2020/2024 subtitle or `>= 2024` switch.
9. Catalog reorder/addition and app reload do not change a saved encounter ID or asset version. A withdrawn asset produces the recoverable path without altering encounter/memory progress.
10. Old `era-level-plan-v1` JSON remains readable and keeps its historical mapping; new schema fields are rejected on v1 rather than partially interpreted.
11. The ratified same-age-tail rule, sparse missing-infancy catch-up and a child endpoint, without an invented future level.

### Obby and recovery

1. A new age-zero save exposes Jump on keyboard and touch. Its short hop clears every mandatory opening obstacle but cannot clear the age-four strong-jump obstacle.
2. Boss defeat and each reveal leave the jump profile unchanged. Complete-bundle consumption changes it exactly once and keeps the original hop capability accumulated.
3. Static platform edges use the avatar collider consistently; broad main platforms remain reachable under diagonal input and capped slow frames.
4. Moving-platform collision and render transforms remain synchronized; standing riders inherit the platform's motion and can step/jump off without tunneling.
5. Crossing a checkpoint then falling below the kill plane respawns at that checkpoint with zero vertical velocity and cleared input/pending enemy hit. Inventory/equipped tool, enemy HP/defeats, revealed/consumed memories, completed levels, age and save revision remain identical.
6. If checkpoints are durable, reload/another device restores the frozen checkpoint. Forged, future or other-level checkpoint IDs fail; duplicate activation is idempotent.
7. Combat defeat still uses its separate full-health/current-encounter reset. Obstacle fall never invokes that reducer path.
8. Opening and later jump profiles have explicit outcomes against each enemy/boss hit volume; jumping is not universal immunity merely for crossing `y = 0.3`.
9. The full two-period keyboard and simultaneous-touch journey covers one fall/recovery in each period, boss-gated growth and entry into the stronger-jump route. Physical Safari remains a separate acceptance boundary.

## Verification performed

Focused current-contract suite at the audited base:

```text
pnpm exec vitest run tests/server/adventure.test.ts tests/server/immich.test.ts \
  tests/server/domain.test.ts tests/game/controller.test.ts

4 test files passed; 28 tests passed.
```

These passes confirm the implemented 2020/2024 fixture, UTC `fileCreatedAt` adapter, boss-gated growth, legacy step and combat retry. They do not cover historical catalog selection, another calendar period, source-local timestamps, age-zero hopping, strong-jump progression, era obstacles, moving platforms or fall checkpoints.

## Lead decisions required before implementation

The code seams above do not require OAuth or real family-photo access. Astra still needs to ratify: the versioned source-date basis and leap-day rule; recognizable parody catalog records/review criteria and exact first eligible windows; same-age tail behavior; whether checkpoints persist across sessions; and route/jump/hit-volume tuning. Once those are frozen, server/catalog work, controller/route work and tests can proceed independently against `era-level-plan-v2`.
