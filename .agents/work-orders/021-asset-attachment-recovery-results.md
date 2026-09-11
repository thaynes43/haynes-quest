# Work order result: transactional asset attachment recovery

- **Status:** Complete; ready for coordinator cherry-pick
- **Model / dispatch:** Native GPT-5.6 Sol, `xhigh`, fresh context
- **Worktree / branch / base:** `/home/dev/work/quest-asset-attach-recovery`; `agent/quest-asset-attach-recovery`; `f6a8f0de4a6b132ef5d4244a8bf5f1e37d56d531`
- **Owned paths:** `src/game/scene-assets.ts`, `tests/game/asset-attachment-recovery.test.ts`, and this result
- **Excluded scope:** Bitmap cache disposal, loading/disposal policy, static instancing, model URLs, Blender and asset/UI work

## Required outcome

`SceneAssets.attach()` must treat hierarchy construction, target attachment, and the ready callback as one transaction. A construction or callback exception must detach the candidate, release only candidate-owned resources, keep the cached GLTF intact, and register one visible retry job. Completion is recorded only after the callback succeeds and the target remains valid. A retry must reuse the successful cached load and leave exactly one attached hierarchy.

Clone cleanup must preserve shared geometry, material, texture, and source-image ownership. Skeleton clones belong to the candidate. A partially built candidate can still contain borrowed cache resources, so construction rollback disposes only resources recorded as cloned; callback rollback additionally collects non-source resources introduced under the completed candidate. Individual candidate cleanup disposes cloned textures without closing their shared source image.

## Verification

- `pnpm exec vitest run tests/game/asset-attachment-recovery.test.ts tests/game/scene-assets.test.ts` — 2 files, 10 tests passed.
- `pnpm typecheck` — passed.
- `pnpm exec eslint src/game/scene-assets.ts tests/game/asset-attachment-recovery.test.ts --max-warnings 0` — passed with zero warnings.
- `pnpm test` — 18 files and 95 tests passed; the existing PostgreSQL file and its eight tests skipped without a configured database.
- `pnpm exec prettier --check src/game/scene-assets.ts tests/game/asset-attachment-recovery.test.ts .agents/work-orders/021-asset-attachment-recovery-results.md` and `git diff --check` — passed.

## Handoff and recovery

The branch contains one bounded commit for coordinator cherry-pick. `attach()` now holds `inFlight` through callback completion, marks `finished` only after callback success plus a final validity check, and retains/re-registers one retry job on clone or callback failure. Rollback removes the failed root and disposes tracked clone resources plus callback-created resources that remain under that root, excluding cached source identities. Shared cache resources stay available for a retry without another loader request.

No bitmap-closing policy, loader/cache disposal, static batching, model URL, UI, authored asset, private-data, Blender, infrastructure, push, PR, or deployment work was performed. Tests use a mocked loader with actual Three.js objects and do not exercise WebGL rendering or a browser. Cleanup can only reclaim callback-created objects still reachable from the candidate root; callbacks remain responsible for unrelated external side effects. The coordinator's newer animation/equipment callback files are outside this branch base and require integration verification after cherry-pick.
