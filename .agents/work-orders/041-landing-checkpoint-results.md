# WO-041: Prove checkpoints arm from safe landing islands

- **Status:** Complete
- **Model / dispatch:** Native GPT-5.6 Sol, `xhigh`
- **Context:** Fresh bounded regression task
- **Required reading:** `AGENTS.md`, `.agents/TEAM.md`, WO-040 findings and source fix `6070cc1`
- **Worktree / branch / base commit:** `/home/dev/work/quest-landing-checkpoint`, `agent/quest-landing-checkpoint`, `6070cc1`
- **Depends on / stable contracts:** `gentle-jump-v1` platform geometry, local checkpoint recovery and the existing height/grounding gate
- **Owned paths:** `tests/game/obby.test.ts`, `tests/game/runtime-obby.test.ts` only if needed, and this result record. No browser, build, site, runtime source, copy or deployment changes.

## Outcome and scope

Prove the actual second-gap jump observed in WO-040 arms `second-clearing` when the player lands naturally beyond the old narrow marker strip. The preceding island and airborne path must not arm it, and a subsequent miss must recover to the declared safe marker on the second island. The intro route retains its bounded landing-strip behavior.

## Deliverables and verification

Add focused pure-simulation regressions using the production course and existing deterministic helpers. Run only the two focused gameplay test files, typecheck and lint. Record exact results and return one commit to the coordinator for intake.

## Handoff and recovery

The production `gentle-jump-v1` regression starts at the observed `x=0.724`, `z=-9.075` second-gap approach. It proves the preceding island retains `first-clearing`, every airborne frame retains it, and the natural landing on `second-clearing-island` occurs beyond the former strip while arming `second-clearing`. Walking back into the gap then recovers exactly to `{ x: 0, y: 0, z: -10.6 }` on that safe island. A separate production intro-route case proves its original bounded strip still arms across the broad width and does not arm elsewhere on the continuous ground.

Verification in `/home/dev/work/quest-landing-checkpoint`:

- `pnpm exec vitest run tests/game/obby.test.ts tests/game/runtime-obby.test.ts`: 2 files and 58 tests passed.
- `pnpm typecheck`: passed.
- Focused ESLint for both test files: passed with zero warnings.

Root owns the source architecture, combined build and resumed browser journey. This task changed no runtime source or live process.
