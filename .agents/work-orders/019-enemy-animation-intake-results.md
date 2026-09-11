# WO-019 results: enemy playback adapter and decoded image ownership

- Lane: separate Fable 5.1 (`claude-fable-5-1`, xhigh) task session via `agent-run`, worktree `/home/dev/work/haynes-quest-0911-103230`, branch `agent/haynes-quest-0911-103230`, based on main `f6a8f0d`. One native Opus 5 (`claude-opus-5`) subagent ran a read-only adversarial pass over the adapter; its findings and dispositions are below.
- Scope held to the owned paths: new `src/game/enemy-animation.ts`, new `tests/game/enemy-animation.test.ts`, the final-disposal change in `src/game/scene-assets.ts` with tests appended to `tests/game/scene-assets.test.ts`, and this record. No edits to `scene.ts`, UI, copy, model URLs, art, general docs, gameplay or server state. No Blender, browser, database, deploy or infrastructure work; nothing pushed, no PR.
- Commits for root cherry-pick are listed at the end. Root integrates the adapter with the actual models; this lane did not wire it into the scene.

## Adapter: `EnemyAnimation`

Construction takes the exact cloned GLTF root, its clips and an attack-contact fraction. It validates before touching the mixer, so a throw leaves the model untouched and root can report the load or attachment as failed:

- each of `idle`, `move`, `attack`, `hit`, `defeat` must exist exactly once by name, have a finite positive duration, at least one track, and at least one track that binds to an existing property of a node below the supplied root (a clip that animates nothing of this model is treated as missing, not fabricated); any track aimed at the root object itself is rejected because the caller owns the root transform;
- the contact fraction must be finite and within `(0, 1]`. Exactly 1 is accepted for an attack authored with contact on its final frame; the strike then holds that pose.

`update(frame, deltaSeconds)` returns `{ visible, vanish }`. The delta is bounded to `[0, 0.1]` seconds; zero, negative and NaN deltas advance nothing, so a modal or visibility pause freezes the pose and any fade in place. Behavior, all verified by sampling bone transforms driven by real `VectorKeyframeTrack`s:

- **Locomotion.** `idle`/`move` loop for the idle/chasing phases with a 0.1 s cross-fade. The adapter never writes the root transform; the root position is asserted unchanged.
- **Attack.** During windup the attack action is paused and seeked to `windupProgress × duration × contactFraction` every frame, so a reset progress (pause/resume, `restartThreatenedAttacks`) visibly snaps the pose back to the start. On entry to strike the time is set exactly to the contact pose and playback resumes; the remainder runs through strike and cooldown and clamps at the clip end. A strike seen without a prior windup starts at the contact pose. A cancelled windup fades back to idle/move.
- **Hit.** A real HP decrease while not in windup/strike plays `hit` once and then fades back to the locomotion for the current phase. A drop during windup/strike is ignored and not deferred; the attack cue stays authoritative. A drop during cooldown interrupts the held attack pose with the hit. An HP rise while a hit is playing ends the hit, cross-fading to the current phase's pose, and resets hit state so a later drop plays again.
- **Defeat.** Alive→defeated plays `defeat` once with `clampWhenFinished`, holds the end pose, then advances `vanish` 0→1 over `enemyVanishSeconds = 0.3` s, computed continuously from the leftover delta on the frame the clip ends. `visible` becomes false at `vanish = 1`; repeated defeated frames neither restart nor change the pose. A model whose very first frame is already defeated goes hidden without playing anything. Defeated→alive at any point stops the defeat, clears `vanish`, and restarts fresh idle/move from time 0; the HP rise that comes with revival is not treated as a hit.
- **Dispose.** `dispose()` stops all actions and `uncacheRoot`s the exact root, which also restores the bind pose. It never disposes geometry, materials or the skeleton; those stay with the scene's clones. Further `update` calls are inert and return `{ visible: false, vanish: 1 }`.

Exported constants: `enemyClipNames`, `enemyVanishSeconds`, `enemyAnimationMaxDeltaSeconds`, `enemyAnimationFadeSeconds`.

### Integration notes for root

- Construct inside the `SceneAssets.attach` ready callback with the delivered `root` and `clips`; catch the constructor error to mark the encounter model failed. The contact fraction is per authored attack clip and belongs with the catalog entry.
- Each render frame: `const { visible, vanish } = animation.update(frame, deltaSeconds)` using the same bounded simulation delta the enemy step uses (pass 0 while paused), then `root.visible = visible` and scale the model by `1 - vanish`. Position and facing remain the caller's writes.
- Call `animation.dispose()` before `disposeTree` on the model, on level teardown and on model replacement.

## Decoded image ownership: inspection and fix

Inspected `three@0.186.0`:

- `GLTFLoader` (`examples/jsm/loaders/GLTFLoader.js`) uses `ImageBitmapLoader` whenever `createImageBitmap` exists outside old Safari/Firefox. `loadImageSource` decodes each glTF image once into an `ImageBitmap` wrapped in a `Texture`; every further texture that references the same image (different sampler) receives `texture.clone()`, which shares the same `Source` and therefore the same bitmap. Embedded JPEG atlases go through the bufferView → Blob → object URL branch of the same path.
- `Texture.dispose()` only dispatches the `dispose` event; nothing in `Texture`, `TextureSource`, `WebGLTextures` or `ImageBitmapLoader` calls `ImageBitmap.close()`. Our `attach`/`attachInstances` clones share the cached `Source` as well.
- Consequence: `SceneAssets.dispose()` released GPU textures of the cached scenes but left every decoded bitmap open until garbage collection, and there was no owner that could close them. Leak confirmed for the new pigment atlases.

Fix, kept to `SceneAssets.dispose()`: after `disposeTree(gltf.scene)`, `closeDecodedBitmaps` walks the cached scene's Mesh/Points/Line materials, collects each `ImageBitmap` image once in a `Set`, and closes it. The chain hangs off the cached load promise, so a load that resolves after disposal is released too, and a failed load is ignored. `disposeTree`, attachment clones, instanced batches and stale assemblies never close anything. Tests fake `ImageBitmap` via `vi.stubGlobal` because Node has none; three of the four new tests fail against the previous `scene-assets.ts` (verified in a throwaway worktree at `f6a8f0d`), the fourth (non-bitmap images untouched) passes on both by design.

## Verification (this worktree, 2026-09-11)

| Check | Command | Result |
|---|---|---|
| Typecheck | `node_modules/.bin/tsc --noEmit` | exit 0 |
| Lint | `node_modules/.bin/eslint src tests --max-warnings 0` | exit 0 |
| Focused tests | `node_modules/.bin/vitest run tests/game/enemy-animation.test.ts tests/game/scene-assets.test.ts` | 2 files, 23 tests passed (13 adapter, 10 assets) |
| Full local suite | `node_modules/.bin/vitest run` | 18 files passed, 1 skipped; 108 tests passed, 8 skipped (Postgres, no `QUEST_TEST_DATABASE_URL`) |
| Client build | `node_modules/.bin/vite build` | exit 0 (pre-existing chunk-size warning only) |
| Regression proof | new `scene-assets.test.ts` against `f6a8f0d` sources in a temporary worktree, then removed | 3 of 4 new bitmap tests fail on the old code |

Dependencies were installed offline from the pod's pnpm store (`pnpm install --frozen-lockfile --offline --ignore-scripts`); the `.bin` binaries run the same commands as the `package.json` scripts.

## Adversarial review

A native Opus 5 (`claude-opus-5`, xhigh) subagent reviewed the adapter read-only against the order for about 25 minutes: 400 randomized legal phase sequences of 40 frames (including zero deltas, HP drops, defeat and revival), 40 real `EnemySimulation` encounters of 500 frames with `restartThreatenedAttacks` and save-driven HP changes, hand-checked edge sequences (cooldown→windup without chasing, strike→windup restart after the clip clamped, windup→cooldown with the strike dropped, boss deactivation mid-windup/strike, first observed frame of every phase, revival from mid-defeat and from hidden), delta handling, vanish continuity at the clip-end frame and disposal. It found no invariant violation in those areas and four minor reproducible defects, all fixed in `d31c4c3` with a regression test each:

| Finding | Disposition |
|---|---|
| Cooldown re-armed the finished attack every frame, so the mixer fired `finished` for the attack on every frame of every cooldown. | `resumeAttack` unpauses only before the clip end. Test: exactly one `finished` event for the attack across strike plus twenty cooldown frames while the arm holds the end pose. |
| The HP-rise reset stopped the hit and cleared the current action, so the next pose snapped instantly and locomotion restarted without a fade. | The reset now only leaves hit mode; the phase switch cross-fades from the hit pose. Test: the head fades back over the transition instead of snapping, no hit replays, a later drop plays again. |
| A track that named an existing node but a property the model lacks passed validation, so a degenerate clip set faded the model to its bind pose. | Validation binds every track through `PropertyBinding` and requires the getter to resolve. Test: `Hips.morphTargetInfluences[weep]` is rejected. |
| A clip whose only track targets the root object passed validation and translated the root under the caller. | Any track resolving to the root throws. Test: both `.position` and the root's own name are rejected and the root stays put. |

The reviewer also noted, as a non-defect, that the adapter bounds its delta at 0.1 s while `EnemySimulation.step` bounds at 0.05 s and the scene receives the raw wall delta, so during a lag spike the attack remainder can advance faster than the simulation between windup resyncs. Root should pass the same bounded delta to both at integration.

Two further corrections came out of the same round, both in `d31c4c3`: a locomotion switch landing right after a hit hand-back faded the not-yet-visible idle from a stale weight of one (now computed from the mixer time; test samples the hips at exactly half the move pose on the switch frame), and clip-end detection now tolerates summed float deltas that land a hair short of the duration, which otherwise delayed the hit hand-back by one frame.

## Limits

- Not integrated: `scene.ts` still runs its procedural enemy motion. No authored enemy GLB was available in this worktree, so the tests drive synthetic bone tracks with exact linear values rather than exported clips; the first real model should be checked for track names resolving on the SkeletonUtils clone and for the chosen contact fraction.
- Every transition restarts the incoming clip from its first frame, so a walk cycle interrupted by a hit resumes from the start of the cycle rather than its prior phase. Bones the outgoing clip animates but the incoming one does not blend toward the bind pose during the 0.1 s fade; authored clips that animate every bone in every clip do not show this.
- The adapter bounds its delta at 0.1 s; the simulation bounds at 0.05 s. Pass the same bounded delta to both at integration.
- During cooldown the attack clip holds its final pose until the phase changes, per the order; if authored attacks end in a recovery pose this reads as intended, otherwise root may prefer an earlier fade to idle.
- Bitmap closure covers textures reachable from the cached `gltf.scene` materials, matching what `disposeTree` releases. Images decoded by a glTF whose parse then failed are unreachable and are not closed. WebGL texture sharing per `Source` was not changed.
- `ImageBitmap` behaviour is faked in Node; the closure path was not exercised in a browser here. Root's Chromium smoke should confirm no `InvalidStateError` from a closed bitmap after a level change, which the shared-image tests guard against by construction.

## Commits

Branch `agent/haynes-quest-0911-103230`, based on `f6a8f0d`; nothing pushed. Cherry-pick onto the lead branch in this order:

| Commit | Content |
|---|---|
| `d31c4c3` | `feat(game): add EnemyAnimation adapter for authored enemy clips` — `src/game/enemy-animation.ts`, `tests/game/enemy-animation.test.ts` (includes the review fixes above) |
| `aa6b664` | `fix(scene-assets): close cache-owned decoded bitmaps at final disposal` — `src/game/scene-assets.ts`, `tests/game/scene-assets.test.ts` |
| the commit carrying this file | `docs: record WO-019 enemy animation intake results` — `.agents/work-orders/019-enemy-animation-intake-results.md` |

The two code commits are independent of each other and of the record. No other files changed; the temporary regression-proof worktree was removed.
