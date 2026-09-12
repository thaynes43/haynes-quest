# WO072 — Physical Besties encounter reliability

- **Status:** Scene-module fix ready for coordinator integration
- **Date:** September 12, 2026
- **Model / dispatch:** Native Codex GPT-5.6 Sol, `xhigh`, fresh context
- **Worktree / branch:** `/home/dev/work/quest-boss-reliability`, `agent/quest-boss-reliability`
- **Compared revisions:** released source `b66b8ee`; current `origin/main` / starting head `d461cda`
- **Owned implementation:** `src/game/besties-scene.ts`, `tests/game/besties-scene.test.ts`, and this engineering record
- **Read-only trace:** `src/game/createGame.ts`, `src/game/scene.ts`, `src/game/besties.ts`, `src/game/combat.ts`, route layout and existing runtime/browser tests

## Physical report and screenshot boundary

The iPhone screenshot shows age 4, both minor memories, both pieces of gear, a full Besties HP bar, the objective to face the Besties, and the player still around the second minor / ordinary-B stretch. The models are distant at the boss island. A still image cannot prove whether animation later advanced, but this particular frame is consistent with the source's inactive routine: the controller has not yet crossed the Besties proximity threshold.

No source under the released commit changed between `b66b8ee` and `d461cda`; the later commit only closed release records. The physical behavior therefore reflects the released implementation rather than unshipped runtime drift.

## Verified runtime causes

1. **HUD and encounter activation disagree about when the fight begins.** The Besties simulation is active only while the world is in exploration, all ordinary enemies are defeated, and `controller.position.z < -17.5`. Every step outside that conjunction calls the simulation with `active: false`, which replaces its state with `inactiveState()`. The full boss bar and objective are selected independently once ordinary enemies are gone, so they can announce an encounter whose actors are still deliberately idle several metres away.

2. **The route has a safe through-line past the boss.** Pink's foam bar travels across X at fixed world Z `-20.4` with Z half-extent `1.35`; a player behind approximately Z `-21.75` is outside it. Black's lane spans Z `-26.5..-19`, but its left/right boxes leave the central strip around X `-1.2..1.2` safe after the player-radius expansion. The scripted composite is explicitly excluded from generic enemy collision. Nothing in this module or the traced controller locks the exit, so the player can walk between the stationary actors and remain safe at the route end. This explains the report without requiring a failed damage action.

3. **Gameplay and rendering target different positions.** The renderer places Pink and Black at local X `+1.25` and `-1.25` around the logical encounter centre and brings them inward only during the high-five. `BestiesScene.targetPosition()` correctly selects the nearest current actor in world space for the spell beam. Primary and Bash eligibility, range and facing are nevertheless computed from the one logical enemy position `{ x: 0, y: 0, z: -22 }`. Bash's `2.25 m` range is especially sensitive to the resulting error. An attack can therefore be allowed or rejected against a position different from the actor receiving its visual beam.

4. **Shared HP damage animated both bodies.** Before this work order, any Besties HP decrease set one shared `hitRemaining` timer, and both actors selected the `hit` clip. DESIGN014 requires feedback on the nearer visible actor. `BestiesScene.update()` now accepts an optional actor recipient and applies the hit clip only to that actor. Omitting the new argument temporarily preserves the old two-actor response so the coordinator can integrate the producer and consumer independently; passing `null` deliberately applies no actor hit clip.

5. **A general mixer freeze was not reproduced.** Focused synthetic clips exercise a manually scrubbed warning/trick attack, the manually scrubbed high-five contact pose, and the following looping cheer. All change pose under Three r186 with the current pause/crossfade implementation. The work order therefore does not replace working mixer logic based on a Safari hypothesis. The authored GLB evidence also reports all eight exact clips and track bindings below the caller-owned attachment root. Physical Safari animation remains an empirical device check after the encounter is made visible and unavoidable enough to judge.

6. **Authoritative victory could never reach the defeat visual.** The original simulation checks `!active` before `defeated`. On boss death the authoritative phase becomes `memory-released`, `combatActive` becomes false, and the controller consequently sends `active: false, defeated: true`; the simulation resets to `inactive` rather than emitting `defeated`. The coordinator's prerequisite state-machine fix gives defeat priority. Once a defeated frame reaches this module, each actor now plays its authored one-shot and disappears after the finite clip duration, capped at five seconds. A missing-art fallback disappears after 0.6 seconds instead of standing forever.

7. **Pink's warning renderer encoded the old arena rather than the frame contract.** It forced the warning to local X zero with width six regardless of `sweep.from` and `sweep.to`. The renderer now derives the warning centre and full X/Z corridor from both announced endpoints plus the bar half extents. This remains correct when the fresh-playtest simulation freezes a player-aimed Z at warning entry.

## Coordinator contract required

The integration now derives actor local/world placements from `bestiesActorOffset()` / `nearestBestiesActor()`. This scene consumes the shared offset helper rather than repeating high-five math, including the active actor's visible step into a trick. The controller must pass the actor ID chosen from the player's attack-time position into `BestiesScene.update()` when authoritative HP decreases. Do not infer the recipient from the active routine actor: damage is accepted during dizzy, when `activeActor` is intentionally null. An optional player position also turns each actor toward the player in the actor parent's local coordinate space; the fixed authored facing remains the compatibility fallback until the caller supplies it.

The coordinator owns the encounter changes ratified for PLAN008: activate on the boss-island landing, delay the boss HUD until the arena, make Pink's announced sweep cover the actual fight line, choose Black's dangerous lane from the player's warned position while preserving visible free ground, face or reposition the actors clearly, and visibly block the route exit until shared defeat. Recovery, backgrounding and arena-boundary behavior need tests that distinguish a paused phase from a deliberate full-warning restart.

## Focused verification

- `pnpm exec vitest run tests/game/besties-scene.test.ts`: 10 tests passed. Existing tests retain transformed current-pose spell targeting and failed-load/retry disposal. New synthetic-clip tests prove shared active/high-five placement, player-facing actors, attack scrubbing, transition back to looping motion, high-five scrubbing, one-recipient shared-HP feedback, defeat from warning and dizzy, bounded fallback removal, and full frame-derived Pink warning geometry.
- `pnpm exec vitest run tests/game/besties-scene.test.ts tests/game/besties.test.ts tests/game/runtime-obby.test.ts`: 3 files and 58 tests passed against the prerequisite shared-helper commit.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm exec eslint src/game/besties-scene.ts tests/game/besties-scene.test.ts --max-warnings 0`: passed.
- `pnpm exec prettier --check src/game/besties-scene.ts tests/game/besties-scene.test.ts .agents/work-orders/072-boss-reliability.md`: passed.
- `git diff --check`: passed.

No asset, Blender, UI/copy, shared encounter controller, deployment, browser fixture or physical device was mutated by this lane. The supplied screenshot was inspected read-only and is not copied into git.
