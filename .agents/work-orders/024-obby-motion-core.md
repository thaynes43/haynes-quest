# WO-024: Pure obstacle-course movement core

- Owner lane: explicitly authorized separate Fable 5.1, xhigh via agent-run, with bounded native Opus5 adversarial test review if useful.
- Base: current root agent/quest-era-asset-intake (root commits before dispatch); launcher may start merged main, copy only shared type assumptions below. Root integrates.
- Own ONLY new `src/game/obby.ts`, new `tests/game/obby.test.ts`, and `.agents/work-orders/024-obby-motion-core-results.md`. No scene, UI/copy, art, level layout, server, contracts, infra, Blender or image generation. No push/PR; return scoped commits. Finish background agents before ending.

## User intent and root choices

Tom requires Roblox-style obby play mixed with goofy fights, approachable for his six-year-old daughter. Root owns layout and tuning decisions. Implement a small pure, deterministic movement/collision core that root can wire into the existing game. Preserve existing server-owned equipment/combat/memory state; this module cannot modify saves or make network calls.

The first level retains non-jumping baby movement and dodges easy visible sweepers on continuous ground. The second, after age4 jump unlock, has broad islands separated by 0.7m gaps and a slow ferry platform before the boss. Root will render the same sampled geometry used by this module. Pause freezes the simulation clock.

## Required API and data

Export plain structural types, importing `PositionSnapshot` and `GameInputSnapshot` only if useful. `ObbyPlatform`: stable id, `center` x/y/z (box CENTER), `size` x/y/z, optional `motion` `{ axis: 'x' | 'z', distance: number, period: number, phase?: number }`. Motion is sinusoidal with distance as amplitude, period seconds, phase radians. `ObbyHazard`: stable id, center x/y/z, halfLength, radius, optional rotation `{period, phase?}`, optional same motion. It is a horizontal capsule along local X at its center height, rotated around Y by the sampled rotation; root uses soft sweeping bars. `ObbyCheckpoint`: id, safe `position` x/y/z (feet), triggerRadius. `ObbyCourse`: platforms/hazards/checkpoints.

`sampleObby(course,timeSeconds)` returns sampled platform center/size/id and hazard capsule endpoints/radius/id. Deterministic immutable results and finite bounded time input handling. Geometry sample is the public source for rendering.

`createObbyState(position)` returns state containing position, velocityY, grounded, facing, supportId, checkpoint position/id, and local timing needed for jump buffering/coyote/recovery. `stepObby(state, input, course, {deltaSeconds, timeSeconds, cameraYaw, canJump, jumpPressed, radius, height})` mutates state and returns `{ recovered: boolean, checkpointChanged: boolean }`. Delta must be bounded 0..0.05, invalid/negative is0, timeSeconds is root's correspondingly advanced paused game clock. dt0 must be a no-op, not allow inputs to advance or start jumps. Root owns global clock advancement.

Root defaults: move speed3.1m/s; gravity-15; jumpVelocity5m/s; coyote grace0.12s; jump buffer0.14s; step-height tolerance0.015m; recovery cooldown0.8s; fall threshold feetY<-2m. Export constants in one named tuning object so root can review/tune. Clamp no hidden world bounds (course edges allow falls). Normalize diagonal input; camera-relative facing same existing controller. One jump per press with canJump=false enforcing no buffered/grace jump.

## Movement and collision

Platforms are finite solid axis-aligned boxes, not a global floor. Land only while descending through a platform top with horizontal foot-circle support; do not teleport onto raised surfaces from a side or below. Resolve horizontal side collision and upward head collision against boxes. Stepping off loses support, coyote jump remains forgracewindow. A supported player rides platform motion by sampled delta without teleporting on re-entry; jumping inherits position at takeoff, does not keep being carried in air. Checkpoints only activate while grounded and within the trigger, never from flying past underneath. Checkpoint must be on a safe platform at recovery time; prefer declared static checkpoint surfaces, handle invalid initial/source definitions without NaN state.

Use bounded substeps or swept collision where needed so a0.05sstep cannot tunnel through a thin declared solid surface or hazard. Never overwrite statecheckpoint from authoritative save changes; root creates a newstate/reset onlevelchange. On falling belowthreshold or intersecting a hazard capsule, reset feet to latestsafecheckpoint, velocity0, clear jump buffer/support coherently, start recoverycooldown and report recovered. Contacts duringcooldown must not retriggerrecovery; avoid repeated invalid spawn loops. Do not damagehealth or reset any encounter. A jumping player above the capsule's vertical contact range must clear it; capsule/player overlap needs actual height/radius, not just XZpoint.

## Verification / handoff

Read AGENTS.md/.agents/TEAM.md/DESIGN011 from root if unavailable inbase. Tests must check supported vs unsupported movement, landing/side/underside collision, walkingoff, coyote andbuffer success/expiry/noairjump, canJumpfalse, carrying/jumpoff movingplatform, hazard avoid/recovery/protection, localcheckpoint activation, pause dt0, invaliddelta, consistent bounds at30/60Hz. Include a representative generousplatform route. Tests must exercisegeometry outcomes, not just reflect implementationcalls. Use no realphotos or DB. Run focused tests,typecheck/lint. Reviewer should seek concrete tunneling, off-edgehover, platformcarry drift and repeatrecovery defects. Commit scoped source/tests/results and return exactcommits/findings/limits. Nofullgameorchildplaytestclaim.
