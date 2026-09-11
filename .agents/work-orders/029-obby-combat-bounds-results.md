# WO-029 results: Obby combat bounds and vertical contact

- **Status:** Complete; ready for coordinator integration
- **Model / dispatch:** Native GPT-5.6 Sol, `xhigh`, fresh context
- **Worktree / branch / base:** `/home/dev/work/quest-obby-combat-bounds`; `agent/quest-obby-combat-bounds`; `2c32879a96aacf2ad44dbef60c5fe4904c5072bc`
- **Implementation commit:** `0b1b461b023c2c96a44d64f50e011b60b8ac7bf2`
- **Owned paths:** `src/game/combat.ts`, `tests/game/combat.test.ts`, and this result record

## Delivered

`EnemySimulation` now copies each optional placement arena into local enemy state. Enemy centers are clamped to those X/Z center bounds when created or reset, when a synchronized layout supplies updated bounds, while chasing, and while a dormant boss returns to spawn. A placement without an arena follows the previous unbounded chase behavior.

Combat height checks now compare feet heights relative to each enemy instead of comparing player height with world zero. Enemy strike contact and player collision require at most a 0.3 m feet-height difference, preserving the existing jump-over behavior. Player target selection permits up to a 1 m feet-height difference, which includes the current approximately 0.83 m jump apex but excludes enemies on distinctly separated platforms.

The numeric regressions verify an enemy stops exactly at `z = -7.5` while chasing a player across a gap, sync clamps it to a newly narrowed `z = -7.75` edge, reset returns it to its in-bounds `z = -8` spawn, and the same legacy placement reaches `z = -6.3425`. Elevated-floor strike tests cover same-floor contact and players both below the island and 0.31 m above contact. Collision tests cover same-floor push and vertically clear airborne/below-island positions. Targeting tests retain a 0.84 m jumping attack and reject a 2 m separation.

## Verification

- `pnpm exec vitest run tests/game/combat.test.ts` — 1 file and 11 tests passed.
- `pnpm typecheck` — passed.
- `pnpm exec eslint src/game/combat.ts tests/game/combat.test.ts --max-warnings 0` — passed with zero warnings.
- `pnpm test` — 23 files and 175 tests passed; the PostgreSQL file and its 9 tests skipped without a configured test database.
- `pnpm lint` — passed with zero warnings.
- `pnpm exec prettier --check src/game/combat.ts tests/game/combat.test.ts` and `git diff --check` — passed.

## Handoff and limits

The coordinator's level placement remains the source of arena bounds; this change does not infer bounds from platform geometry. The contract treats supplied bounds as already inset center limits and leaves enemy Y fixed at its placement floor. No scene, route layout, traversal recovery, UI/copy, server/persistence, retry, save authority, assets, browser journey, infrastructure, deployment, push, or pull request is included. These pure tests do not establish full route playability or physical-device behavior.
