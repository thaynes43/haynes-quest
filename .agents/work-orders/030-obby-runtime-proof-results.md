# WO-030 results: Obby runtime proof

- **Status:** Complete; ready for coordinator integration
- **Model / dispatch:** Native GPT-5.6 Sol, `xhigh`, fresh context
- **Worktree / branch / base:** `/home/dev/work/quest-obby-runtime-proof`; `agent/quest-obby-runtime-proof`; `3741b75fbcc35f58dd4648c3fb558ee21b3e30db`
- **Test commit:** `acc471e34276bf7259a7a59bb0d03cf72c9c04f3`
- **Owned paths:** new `tests/game/runtime-obby.test.ts` and this result record

## Delivered

Six deterministic JSDOM runtime regressions exercise `createGame` only through its public game handle, the requested animation frames, `setInput`, `updateSave`, and `inspect`. The fixture adds the frozen v2 plan/catalog, route/period, and encounter content identities to the existing synthetic era save.

1. The runtime exposes the authored `gentle-intro-v1` platform and two hazards, advances movement on its sampled ground, and sends the exact same time-0.1 course sample to inspection and scene rendering.
2. Walking into the real moving intro sweeper performs one local recovery to `start`. HP 6, both collected pickups, the defeated second encounter, and revision 7 remain authoritative. No action is emitted automatically. The already-chasing first enemy remains byte-for-byte unchanged throughout the 0.8 s protection interval and resumes afterward; a manual guard proves the retained inventory and outgoing expected revision.
3. Walking sideways off the genuine `second-clearing-island` performs one local gap recovery to `second-clearing`. HP 5, both pickups, a defeated encounter, and revision 12 remain intact. Again, no automatic action occurs; the only request is a later manual guard with expected revision 12, so neither traversal case emits `retry-level` or `take-hit`.
4. The later route is crossed through its first 0.7 m gap with the public movement and jump inputs. Its `first-clearing` checkpoint and current position survive a same-level revision-21 inventory update, while both pickups become collected and the scene receives an update rather than a rebuild.
5. A 10 s modal pause and a separate 10 s hidden-document pause both hold the complete `gentle-jump-v1` sample exactly, including its moving ferry platform and rotating hazard. Each resume consumes a zero-delta re-entry frame; the next frame advances the course by only 0.05 s, with no wall-time leap. The scene receives the same resumed sample exposed by inspection.
6. A level-identity change replaces a settled `second-clearing-island` support with a fresh `gentle-intro-v1` state at the start checkpoint, clears local checkpoint/support/recovery counts, resets the sampled clock to zero, rebuilds the route once, and settles safely onto `intro-ground` on the next active step.

No production defect was reproduced in these boundaries, so no production source was edited.

## Verification

- `pnpm exec vitest run tests/game/runtime-obby.test.ts` — 1 file and 6 tests passed.
- `pnpm exec vitest run tests/game/runtime-obby.test.ts tests/game/runtime.test.ts tests/game/obby.test.ts tests/game/combat.test.ts` — 4 files and 70 tests passed. This includes all existing route-less runtime cases for the older plan behavior.
- `pnpm typecheck` — passed.
- `pnpm exec eslint tests/game/runtime-obby.test.ts --max-warnings 0` — passed with zero warnings.
- `pnpm exec prettier --check tests/game/runtime-obby.test.ts` and `git diff --check` — passed.

## Limits

The scene is replaced by a narrow test double so the suite proves runtime sampling and frame delivery but does not exercise Three.js/WebGL geometry, visible materials, browser controls, touch, or a complete route. The clock is a deterministic fake animation clock in JSDOM. The tests use synthetic saves and do not call the server, database, retry path, or authoritative combat reducer. They establish local state preservation by public inspection plus the unchanged revision on the next request; they do not claim a browser/device journey, frame-time performance, child playability, deployment, or final visual acceptance. No UI/copy, art, Blender, image generation, infrastructure, push, or pull request is included.
