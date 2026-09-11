# WO-019: Playback and image ownership for authored enemies

- Status: Ready for the authorized Fable coding lane.
- Driver: separate `claude-fable-5-1`, `xhigh`, through `agent-run`; native Opus for its bounded coding/tests as appropriate. No Blender work.
- Base: current main `f6a8f0de4a6b132ef5d4244a8bf5f1e37d56d531`.
- Own: new `src/game/enemy-animation.ts`, focused `tests/game/enemy-animation.test.ts`, bitmap cleanup changes in `src/game/scene-assets.ts` and its tests, and a sibling results record. Do not edit `scene.ts`, UI/copy, model URLs, art files, general docs or gameplay/server state.
- Lead worktree: `/home/dev/work/quest-era-boss-loop`, branch `agent/quest-era-asset-intake`. Work only in the launcher's isolated task worktree.

Implement a small Three.js enemy animation adapter, with the lead-specified behavior below. Root will integrate it with actual models. Read the current `EnemyFrame` in `src/game/types.ts`, `combat.ts` timing and SceneAssets ownership before coding.

Expose a class constructed with an exact cloned GLTF root, its clips, and an attack-contact fraction. Read durations from clips. Required clip names: idle, move, attack, hit, defeat. Validate required clips/contact fraction at construction; root can report load/attachment failure. Do not silently fabricate missing clips.

`update(frame: EnemyFrame, deltaSeconds: number)` returns `{ visible: boolean; vanish: number }`, where vanish is zero normally and advances 0→1 over 0.3 s after the defeat clip has ended. The caller scales the model during that final disappearance. Use only bounded nonnegative simulation delta, so modal/visibility pause does not advance motion. Provide `dispose()` to stop all actions and uncache the actual GLTF root, without disposing geometry owned by SceneAssets.

Playback behavior:

- Idle and move repeat while idle/chasing. Smooth short transitions if reliable; no root translation is introduced by the adapter.
- Synchronize authored attack during windup to `windupProgress * duration * contactFraction`. At entry to strike, the clip is at its contact pose; advance the remainder during strike/cooldown, clamped at the end. A cancelled windup switches to chasing/idle. A repeated windup, including pause/resume resetting progress, must visibly restart its warning pose.
- Detect a real HP decrease and play the hit clip once when not in windup/strike. Windup/strike remain visually authoritative; do not erase their attack cue with a hit pose. Reset hit state when HP rises on retry.
- Alive→defeated plays defeat exactly once, then holds its end pose before vanishing. A model whose very first frame is already defeated stays hidden (resume must not replay old victories). Defeated→alive clears the disappearance and restores fresh idle/move playback. A repeated update of defeated state must not restart it.
- Mixing must work with actual Three.js tracks: tests should sample a bone/object transform to prove movement, seeking, hit/defeat once, pause, retry and disposal. Do not write tests that only assert internal enum bookkeeping.

Separately inspect GLTFLoader's use of ImageBitmap and the cache's current ownership. New assets embed JPEG pigment atlases. Texture clones share decoded images, so disposing a level or attachment MUST NOT close a cache-owned bitmap still needed for a later clone/retry. If inspection confirms the leak, close each cache-owned bitmap exactly once at final SceneAssets disposal, including assets whose in-flight load resolves after disposal. No closure during ordinary disposeTree. Test shared images, delayed resolution, final disposal and a later attachment after a prior clone is disposed. Keep the cleanup narrowly scoped; no global cache or renderer redesign.

Run focused tests, typecheck and lint. Retain results, exact commands and limits, commit only owned files and return commits for root cherry-pick. Do not push/PR/merge, deploy, touch infrastructure, read private data or run real database tests. No user-facing design or new dependency is authorized. Return findings directly; do not leave background agents running.

Lead addendum for the same owned SceneAssets file: `attach()` currently marks `finished` before calling `ready`, so a thrown required-clip/hand-bone intake error is swallowed as a finished blank/broken attachment. Make clone construction and ready-callback failure transactional: detach and dispose the failed clone, leave a retry job visible, and allow a later retry without duplicate children. Set finished only after successful ready. Account for partially cloned resources without disposing the cache source. Add a focused callback-failure/retry ownership test. Root will ensure callbacks do not retain a failed mixer/gear object.
