# WO073: Memory pickup reliability and reusable level seams

- **Status:** Complete — read-only source audit
- **Model / dispatch:** Native GPT-5.6 Sol, `xhigh`, fresh delegated context
- **Worktree / branch / base commit:** `/home/dev/work/quest-memory-reliability`; `agent/quest-memory-reliability`; `d461cda8e6fe7aecdb37933c21fd53e934ffabeb`
- **Owned path:** This report only. The coordinator owns PLAN008, design/UI text, implementation, tests, review and delivery.
- **Boundaries:** No game source, tests, assets, browser fixture, private media, OAuth, cluster state or dev-env changes.

## Reported observation

The physical iPhone capture shows chapter two at age 4 with `2 / 2` minor memories while collected keepsakes remain in the world. The owner also reports that tapping Attack near a keepsake appeared to open the memory feedback, although route memories are supposed to collect through contact.

The two symptoms have separate causes. The persisted progression is correct. One scene predicate deliberately leaves a `revealed` keepsake visible, and one frame can process an automatic contact action before an Attack edge while presenting both outcomes through the same feedback surface.

## Cause 1: collected minor memories intentionally remain visible until chapter completion

1. The v3 reducer treats a minor contact as `revealed`, not `consumed`. `reduceAdventureAction` appends the ID to `revealedMemoryIds` at `src/shared/adventure.ts:469-490`. Only recovering the major calls `completeLevel` at `src/shared/adventure.ts:491-493`; `completeLevel` then copies all three level IDs into `consumedMemoryIds` at `src/shared/adventure.ts:591-614`.
2. `toSaveView` correctly maps recovered-but-not-consumed IDs to `state: "revealed"` at `src/server/domain.ts:321-347`. Both stores use this shared reducer/view path: `src/server/db/memory-store.ts:185-198` and `src/server/db/postgres-store.ts:195-230`. There is no divergent ephemeral-store or Postgres cause.
3. The client rebuilds the in-memory `LevelLayout` from every accepted save, including the new memory state, at `src/game/createGame.ts:490-515`. A revealed memory is no longer eligible for another action because `nearestMemoryId` accepts only `state === "released"` at `src/game/createGame.ts:252-283`. The object is therefore inert after collection; it is not being collected repeatedly.
4. The world renderer nevertheless shows both `released` and `revealed` roots. `GardenScene.updateProgress` hides only `locked` and `consumed` states at `src/game/scene.ts:478-487`. This predicate is the direct source of the persistent keepsakes in the capture. The asset-ready callback re-runs the same predicate at `src/game/scene.ts:377-393`, so late GLB attachment does not correct it.

For the fresh v3 route, the world-visibility rule should distinguish a collectible from the durable album record: render a route keepsake only while it is `released`; retain the recovered picture in `SaveView`, the counter and album. If archived v1/v2 behavior still needs revealed reward objects visible until explicit bundle consumption, preserve that behavior behind the plan/level shape rather than changing the shared reducer. `activeLevel.majorMemoryId` is the existing client discriminator (`src/game/createGame.ts:121-123`), including the retained final world assembled at `src/game/createGame.ts:485-499`.

## Cause 2: contact and Attack are both handled in one frame

The Attack control is not mapped to `recover-memory`, and the server never interprets an attack as a memory interaction. The apparent linkage is caused by frame ordering and shared feedback:

1. A route memory within the 1.4 m horizontal radius is selected by `nearestMemoryId` (`src/game/createGame.ts:36`, `src/game/createGame.ts:252-283`). `performAutoInteraction` gives contact priority in the order equipment, memory, eligible friendly and builds a `recover-memory` command without reading `actions.interact` or `actions.attack` (`src/game/createGame.ts:793-847`).
2. Each active frame advances movement, then calls `performAutoInteraction(now)`, then handles the queued explicit Attack edge (`src/game/createGame.ts:881-972`, `src/game/createGame.ts:1006-1019`). A player can cross into the radius and tap Attack during the same frame. Contact dispatch happens first.
3. `ActionCoordinator.perform` moves to `acting` synchronously before sending the request (`src/game/actions.ts:105-123`). If contact was accepted, a same-frame attack at a target is rejected as `busy` (`src/game/createGame.ts:677-690`), but its animation has already started before validation (`src/game/createGame.ts:633-642`). With no target, the frame still starts an empty attack animation and records `no-target` (`src/game/createGame.ts:1015-1018`). Thus one tap can visibly swing/show attack feedback even though the only server command was contact recovery.
4. The accepted recovery response is passed to `GameScreen.update` with its actual `recover-memory` action (`src/client/GameScreen.tsx:202-212`, `src/client/GameScreen.tsx:330-336`). A minor response sets `pickupMemoryId` and the `Little memory found` notice for 2.3 seconds (`src/client/GameScreen.tsx:307-326`). Attack outcomes also write the same `attackNotice` state (`src/client/GameScreen.tsx:349-400`), and that shared surface renders the optional memory image at `src/client/GameScreen.tsx:649-665`. This sequencing makes Attack look causal even though the request payload proves contact was causal.

A route minor does not open a blocking `role="dialog"`: its response uses the transient status notice. `photoDetail` is limited to archived non-route levels at `src/client/GameScreen.tsx:286-292`. The first major recovery changes age and opens the next-chapter modal through `chapterNotice` at `src/client/GameScreen.tsx:293-305`; the final major opens completion because `activeModal` prioritizes `save.completed` at `src/client/GameScreen.tsx:431-447`. Those major dialogs are also caused by automatic contact.

The narrow runtime correction is to make automatic interaction report whether it accepted a command and, when it did, consume/suppress primary and secondary attack handling for that frame. That establishes a single winning intent: contact performs the pickup and its interaction beat, while an Attack edge cannot add a swing or attack notice to the same moment. If contact validation returns false, normal combat handling can continue. This does not require a new action type or server/persistence change.

## Existing coverage and minimal regression additions

`tests/game/runtime-obby.test.ts:474-552` already proves movement contact dispatches one equipment or memory command. Its `onAction` promise never resolves and `GardenScene` is mocked at `tests/game/runtime-obby.test.ts:23-68`, so it cannot detect either reported symptom. There is no assertion covering an Attack edge on the same contact frame or route-memory world visibility after an authoritative response.

Recommended behavior-level additions:

- Extend the existing contacted-minor runtime case so the player enters the memory radius with an Attack edge queued. Assert exactly one `recover-memory` request, one interaction beat, no attack feedback/attack pose for that frame, and no later duplicate recovery after the authoritative `revealed` response. This directly covers the iPhone action ambiguity without mirroring the branch structure.
- Extract the world-memory visibility decision into a pure function and table-test the player-visible contract: v3 `released` is visible; v3 `revealed`, `consumed` and `locked` are hidden. Include an archived-plan `revealed` expectation only if that old explicit-bundle behavior is intentionally retained. This avoids constructing WebGL merely to test a state-to-visibility rule.
- Keep reducer/store tests unchanged unless implementation changes those layers. Existing domain semantics are correct, and adding another reducer test for `revealed` would mirror coverage rather than protect the reported rendering/input behavior.

## Reusable level and placement inventory

### Useful seams already present

- `FrozenLevelPlanV3` separates immutable level identities/content from mutable `AdventureState` and already persists stable memory, pickup, encounter, period and route IDs (`src/shared/adventure.ts:62-112`, `src/shared/adventure.ts:126-145`). `src/server/adventure-schema.ts:75-131` and `src/server/adventure-schema.ts:248-325` provide a versioned validation boundary and referential/content checks.
- `LevelLayout` is a useful client-side intermediate representation for positions, arenas, bounds and checkpoints (`src/game/level.ts:14-58`). Runtime systems consume that representation rather than reaching into scene objects.
- `ObbyCourse` is a pure numeric platform/hazard/checkpoint contract (`src/game/obby.ts:18-74`). Sampling drives physics, and `ObbyScene` renders the exact same sampled dimensions (`src/game/obby-scene.ts:1-5`, `src/game/obby-scene.ts:124-149`). This single-source collision/render relationship is the strongest precedent for a builder.
- Scene asset attachment is isolated behind stable asset URLs and retry-aware cloning (`src/game/scene-assets.ts:5-13`, `src/game/scene-assets.ts:452-528`).

### Coupling that blocks reusable authored levels

- Frozen plans persist `periodId` and `routeId`, but no layout identity/version or placements (`src/shared/adventure.ts:78-110`). A client release can therefore change an existing save's memory, pickup, friendly and encounter positions without changing its frozen plan.
- `createEraLevelLayout` hard-codes the three memory positions, two equipment positions, three cycling friendly positions, three encounter positions/arenas, checkpoint, finish and world bounds in one function (`src/game/level.ts:135-236`). It derives placement from array index, `kind` and the presence of `majorMemoryId`; the content IDs do not select authored slots.
- `selectParodyLevel` chooses one of only two route IDs from the presence of Jump (`src/shared/parody-selection.ts:41-73`), while `createObbyCourse` turns those IDs into two hard-coded courses (`src/game/obby-layout.ts:17-91`). Period/content selection and spatial authoring cannot currently vary independently.
- `GardenScene.rebuildRoute` separately infers visual theme from a list of period IDs/year and procedurally places ground, path, foliage and era props (`src/game/scene.ts:232-370`). These visual decisions are not represented in `LevelLayout` or frozen alongside the course.
- Interaction radius lives in `createGame.ts:36`; enemy ranges/collision sizes live in `src/game/combat.ts:7-64`; friendly asset heights live in `src/game/friendly-scene.ts:8-15`; placements live elsewhere. There is no author-time validation that objects are separated, supported, reachable or visually clear at those actual sizes.

### Guardrails for a future human-and-agent builder

The smallest durable direction is a versioned declarative level registry that compiles to the existing `FrozenLevelPlan` identity plus `LevelLayout`/`ObbyCourse`, instead of permitting generated runtime code. Its validator should enforce:

- globally unique stable IDs and exact references among authored slots, memories, equipment, encounters, checkpoints, assets, period and route; a frozen save records the layout ID/version so later edits do not move an existing journey;
- finite bounded coordinates and positive extents; every spawn, collectible, encounter and recovery point has valid platform support at the declared feet height;
- minimum horizontal/vertical separation using the real interaction radius, player collider, enemy collision radius and attack range, especially around spawn/recovery points and between mutually exclusive contact targets;
- progression reachability with starting abilities: required gear and both minors before the boss, ordinary encounter gates before the boss, and the major reachable only in the post-boss phase; no required target on an island or beyond a jump unavailable at that level;
- checkpoint ordering and recovery safety: checkpoints cannot arm from the wrong platform, respawns cannot immediately retrigger a pickup/hazard/enemy, and the reward checkpoint can reach the major without rearming traversal checkpoints;
- one sampled geometry source for collision and rendering, retaining the current `ObbyCourse`/`ObbyScene` property; decorative art may extend it but cannot silently redefine colliders;
- asset/animation/version compatibility and declared visual bounds so an apparently valid point is not hidden inside an oversized model;
- deterministic compilation and checked-in fixtures, with semantic tests for complete route traversal and gate order rather than snapshots of generated coordinates.

This inventory is technical input only. PLAN008 and any product/editor workflow decisions remain with the Astra coordinator.
