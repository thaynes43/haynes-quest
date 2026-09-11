# Work order 054: Friendly and Besties runtime integration regressions

- **Status:** Complete
- **Scope:** `tests/game/runtime-obby.test.ts` only, plus this technical result record
- **Product files changed:** None

## Coverage added

- A friendly action is rejected outside the 1.7 m runtime interaction range, while each explicit confirmed action (`interact-friendly` and `attack-friendly`) is accepted at range even when its confirmation modal has paused the world.
- An ordinary attack tap beside a friendly reports `no-target` and sends no action; attacking a friendly remains reachable only through the explicit `attack-friendly` action.
- The deliberate `bickering-besties@v001` fixture remains guarded during its closed routine phases and accepts one normal boss attack after entering `dizzy`.
- The composite Besties encounter lets the player enter its arena during a harmless warning without generic enemy collision, chase presentation or contact damage. The logical enemy frame stays anchored at the authored arena centre.
- Modal pause and the first resume frame preserve the complete Besties routine frame; routine progress resumes on the next active frame.
- The pre-existing parody-catalog-v2 Drama Dragon wand regression remains unchanged and passing.

The runtime integration assertions use sampled frames and public game actions. They do not repeat the routine's pure hazard geometry assertions from `tests/game/besties.test.ts`.

## Verification

- `pnpm exec vitest run tests/game/runtime-obby.test.ts`: 1 file, 21 tests passed.
- `pnpm exec vitest run tests/game/runtime-obby.test.ts tests/game/besties.test.ts tests/game/combat.test.ts`: 3 files, 41 tests passed.
- `pnpm exec eslint tests/game/runtime-obby.test.ts --max-warnings 0`: passed.
- `pnpm exec tsc --noEmit`: passed against the current shared worktree.
- `pnpm exec prettier --check tests/game/runtime-obby.test.ts`: passed.
- `git diff --check -- tests/game/runtime-obby.test.ts`: passed.

No product defect was exposed. The first focused run identified only an exact floating point comparison in the new test (`-21.945000000000157` versus `-21.945`); the assertion now uses numeric tolerance and the behavior is unchanged.
