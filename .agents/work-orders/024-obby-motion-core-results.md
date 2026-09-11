# WO-024 results: pure obstacle-course movement core

- Lane: separate Fable 5.1 (`claude-fable-5-1`, xhigh) task session via `agent-run`, worktree `/home/dev/work/haynes-quest-0911-112809`, branch `agent/haynes-quest-0911-112809`, started from merged `main` (`f6a8f0d`). The shared types (`PositionSnapshot`, `GameInputSnapshot`) and `src/game/controller.ts` are byte-identical between `main` and the root branch, so the base choice changes nothing for this module.
- Scope held to the owned paths: new `src/game/obby.ts`, new `tests/game/obby.test.ts`, this report. No scene, UI, copy, art, level layout, server, contract, infra, Blender or image work. Nothing pushed, no PR opened; root integrates.
- Commits on the branch, in order: `6f6fbc5` module + tests; `283949c` fixes for the adversarial review findings + four regression tests; the final commit adds this report. The background reviewer finished before this session ended.

## What the module provides

`src/game/obby.ts` is side-effect free: no DOM, network, save or random access. Everything it needs arrives in arguments.

Types: `ObbyPlatform` (stable `id`, box `center`, full `size`, optional `motion { axis, distance, period, phase? }`), `ObbyHazard` (id, center, `halfLength`, `radius`, optional `rotation { period, phase? }`, optional motion), `ObbyCheckpoint` (id, feet `position`, `triggerRadius`), `ObbyCourse`, the sampled `ObbySample`, `ObbyState`, `ObbyStepOptions`, `ObbyStepResult`, `ObbyTuning`.

- `sampleObby(course, timeSeconds)` returns deeply frozen platform boxes (`id`, `center`, `size`) and hazard capsules (`id`, `center`, `start`, `end`, `radius`, `angle`). Motion is `distance · sin(2π t / period + phase)`; rotation is `phase + 2π t / period` around +Y, and `angle` equals the Three.js `rotation.y` that maps local +X onto `start → end`, so root can render the same geometry the simulation collides with. Time is wrapped per period before the trig call, so huge clocks keep precision; non-finite time samples at 0; invalid periods/distances freeze the element; non-finite coordinates read as 0 and sizes are taken absolute.
- `createObbyState(position)` returns the state (feet `position`, `velocityY`, `grounded`, `facing`, `supportId`, `supportAnchor`, `checkpointId`, `checkpoint`, `origin`, coyote/buffer/recovery timers, `jumpHeld`, `settled`). It starts ungrounded; the first non-zero step lands it.
- `stepObby(state, input, course, { deltaSeconds, timeSeconds, cameraYaw, canJump, jumpPressed, radius, height, tuning? })` mutates the state in place and returns `{ recovered, checkpointChanged }`.
- `OBBY_TUNING` holds root's defaults (move 3.1 m/s, gravity −15, jump 5 m/s, coyote 0.12 s, buffer 0.14 s, step tolerance 0.015 m, recovery 0.8 s, fall threshold −2 m, max delta 0.05 s) plus the constants the implementation needed: max substep 1/120 s, max 32 substeps, foot-circle overhang 0.6 × radius, checkpoint height tolerance 0.35 m, spawn search depth 1 m. A per-call `tuning` partial overrides any of them.

## Behaviour decisions root should know when wiring it

1. **Clock convention.** `timeSeconds` is the paused game clock *after* advancing by `deltaSeconds`; the geometry in force at the end of the step is `sampleObby(course, timeSeconds)`, so render from that sample after stepping. Pause means dt 0 with an unchanged clock: nothing is simulated, no timer moves, and a press is swallowed; only a jump *release* is recorded so the next real press is not lost. Root's current `elapsed` keeps running through pause and is not this clock.
2. **Jump press.** `jumpPressed` is the press edge, exactly what `actions.jump` from `consumeActions()` already is. A held value is tolerated: an internal latch yields one jump per press. `canJump=false` clears the buffer and blocks coyote jumps that step.
3. **In-place mutation.** `state.position` and `state.checkpoint` are updated field by field, so the `controller.position` reference pattern used in `createGame.ts` and `scene.render` keeps working.
4. **Recovery ends the frame.** On a fall or hazard contact the remaining substeps of that frame are not simulated, so the caller observes the exact checkpoint position with velocity 0, `grounded` true when the spawn is supported, buffer/support cleared and `recoveryRemaining` = 0.8 s. A fall is an airborne body below `fallThresholdY`; it recovers at once after any landing (a child who walks straight off again is reset immediately), but a fall straight out of an unsupported spawn waits for the cooldown, so a hopeless spawn re-fires at most once per 0.8 s. Hazard contact only recovers outside the protection window.
5. **Spawn resolution.** The latest checkpoint is used if a platform currently supports its declared feet point (static first, then moving; snapping down up to 1 m; never onto a top below the fall line). Otherwise earlier declared checkpoints are tried in reverse list order, then the creation position. When a fallback is used it becomes the latest checkpoint and `checkpointChanged` is reported. If nothing supports any candidate the player is placed at the declared point in the air; state stays finite.
6. **"Latest" checkpoint** means most recently activated: walking back into an earlier trigger re-activates it. Activation needs `grounded`, XZ within `triggerRadius` and feet within 0.35 m of the checkpoint height, so a trigger passed underneath or flown through never arms.
7. **Support and edges.** A player stands while the foot-circle centre is within 0.6 × radius past a platform edge (so `supportOverhang` is the knob for how far a child can lean over an edge). Walls use the full radius; a box whose top is within 0.015 m above the feet is stepped onto, anything taller blocks. Landing requires descending through the top with support; ascending never lands, and heads stop under box bottoms.
8. **Moving platforms.** A supported player moves by the delta of the support's sampled centre, re-anchored at every landing and every grounded substep, so re-entry never applies a stale delta and long rides do not drift (tests hold the rider's offset to < 1e-6 m over three periods at 30 and 60 Hz). The carry looks up the same-id box nearest the anchor and ignores any delta larger than the platform's speed bound allows in one substep, so duplicate ids or a clock discontinuity re-anchor instead of teleporting. A jump keeps the take-off position and inherits no platform velocity, per the order. Boxes moving sideways into a standing player push it.
9. **Substeps and sweeping.** Each frame is split so no substep exceeds 1/120 s, further reduced so neither the player nor the fastest hazard/platform moves more than the thinnest feature (hazard radius or half the thinnest platform footprint) per substep, capped at 32 substeps. Landing and head contact are swept across the substep, push-out exits through the face the centre came from, and hazard contact is evaluated each substep, so 0.05 s frames hold on a 2 cm floor, a 3 cm wall and a 1.5 s-period 8 cm bar. The reviewer pushed further (2 mm walls, 0.05 s-period bars, walls sweeping at 78 m/s) without a miss.
10. **Vertical integration is exact** for constant gravity, so 30 Hz and 60 Hz produce the same apex (0.8333 m) and airtime (0.667 s) within one frame.
11. **Hazard overlap** is the exact test between the horizontal capsule and the player's vertical cylinder (feet to feet + height): a body beside the bar needs the sum of both radii, a body entirely above or below clears it, and the cross-section shrinks toward the bar's top and bottom.

## Tests (`tests/game/obby.test.ts`, 42 cases)

All cases assert geometry outcomes (positions, heights, timings, ids), not implementation calls. Coverage against the order's list:

| Requirement | Cases |
|---|---|
| Sampling: offsets, rotation direction, immutability, determinism, huge/negative/NaN clocks, invalid periods and coordinates | 3 |
| Supported movement: settle, speed, camera-relative direction, facing, diagonal normalisation, partial stick, garbage input, step tolerance vs lip | 3 |
| Unsupported movement: overhang edge, fall, single recovery, no hidden bounds, coherent reset of timers | 3 |
| Landing / side / underside: swept landing, hang-over miss, wall block + slide + climb by jump only, ceiling stop without landing on top, thin floor and thin wall at dt 0.05 | 5 |
| Jump timing: one jump per held press, analytical apex, no air jump, coyote success/expiry, buffer success/expiry, `canJump=false` for grounded/buffered/coyote | 4 |
| Moving platforms: carry without drift at 30/60 Hz, mid-motion landing with per-frame displacement bound, jump-off keeps position, boarding a docked ferry, side shove | 4 |
| Hazards: reset to checkpoint, protection window with bounded repeat cadence, radii-sum reach vs miss, above/below clearance, timed jump over a low bar (scan of start times: a narrow window clears it, a standing player is always hit), fast thin bar at dt 0.05 | 5 |
| Checkpoints: grounded activation with declared position, ignore underneath/fly-through/head-bump, fallback to an earlier static checkpoint when the latest one's ferry left (with `checkpointChanged`), NaN checkpoints and creation positions, no-platform course | 4 |
| Pause / delta: dt 0 deep-equal no-op that swallows presses, NaN/negative/Infinity deltas, clamp of dt 1 to 0.05, NaN clock/yaw/radius/height, hazards frozen across 600 paused frames | 3 |
| Frame-rate consistency: apex, airtime and landing distance at 30 vs 60 Hz | 1 |
| Generous route: four 4 m islands with 0.7 m gaps, a slow sweeper crossing the path, a docking ferry, four checkpoints; completed with zero recoveries at 60 Hz and 30 Hz; a skipped jump returns to the island's checkpoint and still finishes; walking blind into the sweeper only costs local resets | 3 |
| Review regressions D1–D4 (below) | 4 |

The route script is deliberately naive: walk forward, jump 0.3 m before an edge, wait at a safe spot until a full-speed crossing is predicted clear of the bar, wait on the bank until the ferry docks within 0.2 m, wait on the ferry until it docks on the far side. It is a representative layout for the tests, not root's level.

## Verification (this worktree, 2026-09-11)

| Check | Command | Result |
|---|---|---|
| Focused tests | `node_modules/.bin/vitest run tests/game/obby.test.ts` | 42 passed |
| Full local suite | `node_modules/.bin/vitest run` | 18 files passed, 1 skipped; 133 tests passed, 8 skipped (PostgreSQL, no `QUEST_TEST_DATABASE_URL`) |
| Typecheck | `node_modules/.bin/tsc --noEmit` | exit 0 |
| Lint | `node_modules/.bin/eslint src tests --max-warnings 0` | exit 0 |
| Regression proof | the four `review regressions` tests run against `6f6fbc5`'s `src/game/obby.ts` | 4 of 4 fail on the old module, all pass on `283949c`; the module file was restored and verified with `cmp` |

Dependencies were installed with `pnpm install --offline --frozen-lockfile` from the pod's store; the `.bin` binaries run the same commands as the `package.json` scripts. No build, browser, device, database, Blender or image step was part of this order and none ran.

Development note for honesty about the evidence: the first test run reported 20 failures, all caused by a harness bug (`onFrame?.(tick(...))` skips the `tick` call entirely when no callback is supplied because optional-call short-circuiting drops argument evaluation). Fixing the harness left ten failures, of which two changed the module: vertical integration became exact (semi-implicit Euler undershot the apex by 2 cm and made 30/60 Hz differ) and recovery now ends the frame and adopts the fallback checkpoint. The rest were wrong expectations in the tests (a slide that rounded the block corner, an airtime that excluded the jump frame, a bar test that started the player on the bar's line, a route sweeper that no walking speed could ever cross). Those were verified with throwaway numeric probes before the tests were changed.

## Adversarial review

A bounded native Opus review of `6f6fbc5` ran from this session with the order's focus list; its report begins with its exact model id, `claude-opus-5`, and it returned in about eight minutes with runnable reproductions under `/tmp/obby-review/` (`CONFIRMED.ts` plus `t1`–`t5`; scratch only, nothing in the repo). Dispositions:

| Finding | Severity | Disposition in `283949c` |
|---|---|---|
| D1 Duplicate platform ids: the carry looked up the first box with the support id, so a rider on a moving box sharing an id with a static island was moved 8.4 m in one frame. | High | Fixed. Carry follows the same-id box nearest the anchor, re-anchors every grounded substep, and drops any delta above `speed × substep`. Regression test at 60 Hz holds the per-frame displacement to the platform's speed bound and the rider's offset to < 1e-6 m. |
| D2 A spawn resolved on a top below `fallThresholdY` returned `recovered: true` on 600 of 600 frames with the cooldown re-armed every frame. | Medium-high | Fixed. A fall is now an airborne body below the line; spawn resolution refuses tops below the line; a fall straight out of an unsupported spawn waits for the cooldown. Regression test: 0 recoveries in 10 s standing on a floor at −2.5 m, one or two when walking off it, and a hopeless spawn recovers 4–6 times in 4 s at ≥ 0.8 s spacing. |
| D3 A jump release during dt 0 frames was never observed, so a press held on resume never jumped. | Low-medium | Fixed. A dt 0 frame records a release only; presses stay swallowed, the deep-equal no-op test still holds. Regression test: press, hold through the jump, release while paused, hold on resume, second jump observed. |
| D4 `timeSeconds` stepping backwards carried the rider by the whole sample delta (2 m in one frame). | Low | Covered by the D1 delta bound. Regression test: a 2 s rewind moves the rider by at most one substep of platform motion and leaves the state finite. |

Reviewer results recorded as clean (worth keeping because they are the classes most likely to be assumed broken): static walls down to 2 mm at 20/30/60 Hz, rotating bars down to a 0.05 s period, linear hazards to ~126 m/s, moving walls from 1 m to 2 cm thick sweeping at up to 78 m/s (always shove, never pass through), a grounded-implies-supported invariant over seven scenarios at three frame rates for 12 s with zero violations, support dropped in the same substep when a platform id disappears, 780 press/release patterns around an edge with at most one take-off, byte-identical serialised state across repeated runs, finite state under NaN/Infinity/negative definitions, no checkpoint from underneath, identical landing at 20/30/60/120 Hz.

Reviewer items left as documented limits (suspected, not reproduced): the `maxSubsteps` cap can void the thin-feature guarantee for extreme geometry (JSDoc now says so); `pushOutOfBox` can eject through the far face only if both the previous and current centres are inside a box, which the substep sizing prevents; `resolveSpawn` does not test the spawn against hazards or solid boxes.

## Known limits

- No platform velocity is inherited at take-off (as ordered); a child jumping from a fast ferry will land short relative to the ferry. Root's ferry is slow, so this is fine for the bounded slice.
- Thin walls are safe down to roughly 1.3 cm at the cap of 32 substeps under the worst-case speed bound; the reviewer's runs held at 2 mm in practice. Landing and head contact are swept and do not depend on thickness.
- Hazards are horizontal capsules only; no vertical or tilted bars, no crush handling between a moving box and a wall, no slopes.
- A checkpoint declared inside a hazard's sweep, below the fall line or with no platform under it is a layout error; the module bounds the consequence (fallback to an earlier checkpoint, or one recovery per cooldown) and keeps the state finite, but it cannot make such a checkpoint safe. Spawns are not checked against hazards or solid boxes.
- A clock discontinuity (rewind or a jump larger than one substep of platform motion) re-anchors a rider without moving it; root should create a fresh state when it re-bases the clock or changes level rather than rely on this.
- `grounded` reads false between `createObbyState` and the first non-zero step.
- Nothing here is evidence of the full game, of rendering, or of a child's playtest. Root owns the layout, tuning and browser/device journeys.
