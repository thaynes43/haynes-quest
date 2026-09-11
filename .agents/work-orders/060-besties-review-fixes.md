# WO060: Besties recovery and renderer review fixes

- **Status:** Implementation and root call-site integration complete locally; combined release remains.
- **Model / dispatch:** Native Codex GPT-5.6 Sol, `xhigh`, fresh context.
- **Worktree / branch / base:** `/home/dev/work/quest-playtest-feedback`, `agent/quest-playtest-feedback`, HEAD `287e611` with concurrent root/agent changes preserved.
- **Required reading completed:** `AGENTS.md`, `.agents/TEAM.md`, PLAN006, DESIGN014 and the Fable WO056 findings F6/F8.
- **Owned paths:** `src/game/besties.ts`, `src/game/scene-catalog.ts`, `tests/game/besties.test.ts`, `tests/game/scene-catalog.test.ts`, the additionally granted `tests/game/runtime-obby.test.ts` regression and this technical record. Root retains `createGame.ts`, scene integration, UI/copy, release and PR ownership.

## Outcome and method contract

`BestiesSimulation.restartThreatenedTrick(): void` now restarts either Pink phase (`pink-warning` or `pink-trick`) at `pink-warning`, and either Black phase (`black-warning` or `black-trick`) at `black-warning`. The warning restarts at zero progress with non-damaging geometry, so the player receives the full 1.2-second telegraph after a fall or background resume. The method preserves `cycleIndex`, `blackLaneSide` and the trick's existing contact-consumption state. If the interrupted trick had already produced its one authoritative hit, its retried warning/trick cannot produce another. `inactive`, `high-five`, `dizzy` and `defeated` are unchanged.

The warning-to-trick transition now carries the contact-consumption state forward. Normal cycles remain unchanged because every ordinary entry into a warning begins with that state false; only a restarted already-contacted trick carries true into its retry.

Root wired `besties.restartThreatenedTrick()` into `src/game/createGame.ts` for actual traversal recovery and when visibility becomes hidden. Ordinary modal pause/resume deliberately preserves the exact phase. This lane did not edit the root-owned call sites; its runtime regression drives the controller off the boss island during `pink-trick`, observes recovery at `boss-landing`, and proves the restarted warning remains frozen throughout recovery protection before running for its full duration without an immediate authoritative contact.

## Renderer paths and frozen identity

After the existing four-field exact catalog match succeeds, the duo renderer derives both actor URLs from the matched immutable `entry.assetVersion`:

- `/studio/assets/media/bestie-pink/<entry.assetVersion>/bestie-pink.glb`
- `/studio/assets/media/bestie-black/<entry.assetVersion>/bestie-black.glb`

Unknown or mismatched catalog-entry/asset identities still return `null`. No new catalog version or speculative v002 asset was created. Current v001 paths still resolve to the delivered files, whose bytes were unchanged:

- Pink: `0f7020f53ed257dd88e6a8cb9e8fb0011c70e84bf33bc2e55fb671473aea96ae`
- Black: `0819c67a17d38f340ace0ebdaff6bd316a800286af7f7a0da91273e898d80f05`

## Verification

- Focused state-machine, controller/runtime and adjacent catalog identity tests: 5 files passed, 66 tests passed.
- TypeScript `tsc --noEmit`: passed.
- ESLint on the five implementation/test files: passed with zero warnings.
- Prettier check on the five implementation/test files and this record: passed.
- `git diff --check` on all owned files: passed.
- Exact SHA256 check of both current v001 GLBs: matched the published hashes above.

No browser, model/audio generation, PR, deploy, OAuth, family-photo access or dev-env restart was performed. Root still owns call-site integration, the combined checks, commit/PR, image publication and checked playtest release.
