# WO-013: Equipment, bosses and growth

- Status: In progress, 2026-09-11.
- Lead: GPT-6 Astra, max. Root worktree `/home/dev/work/quest-era-boss-loop`, branch `agent/quest-era-boss-loop`.
- Authority: Tom's correction in PLAN-005 and DESIGN-010. The earlier memory-walking prototype is not acceptance of the intended game.

## Lanes

| Owner | Scope | Worktree |
| --- | --- | --- |
| Native Sol, xhigh, `era_loop_code_audit` | Shared v2 contracts, frozen plans, authoritative combat events, persistence, migration and server tests | `/home/dev/work/quest-era-server` |
| Native Sol, xhigh, `era_game_loop` | Input, local movement/encounter behavior, action coordination and game tests; excludes scene rendering | `/home/dev/work/quest-era-game-loop` |
| Driving Astra | Scene composition, asset intake, UI/copy, victory photos, integration and final checks | Root worktree above |

Shared wire contracts committed as `97aab9e` on the root branch (source `452f54f`). Actions have durable UUIDs and expected revisions. The server owns health, inventory, encounter outcomes and age; spatial hit detection remains local and is not an anti-cheat system. Both ordinary enemies precede boss damage. Boss victory releases the bundle; revealing it does not age the traveler; consuming the revealed bundle changes age and period atomically.

Two provisional fictional levels use the existing fixture dates: 2020 at age zero and 2024 at age four, ending at age seven. This does not claim a complete lifetime roster. Existing saves remain readable as legacy records. The fixture service still supplies fictional drawings, not Immich photos. Real-photo identity and OAuth admission remain deferred.

## Visual and media checks

The previous live drawings returned image bytes and uploaded into WebGL in Chromium. Safari blank tiles have not been reproduced. `164809c` preserves image origin under the script-blocking fixture SVG policy. The old scene marked failed photo loads successful and swallowed errors; the replacement needs bounded retry, visible failure state and resource cleanup.

Tom has been asked whether current candidate visuals may be integrated into the demo. No answer is recorded yet. Independent implementation, candidate authoring and isolated review can continue; no exact-version approval is inferred from silence.

## Required delivery

Keyboard and touch must play equipment → ordinary encounters → boss → visible photos → consume/grow → next period. Verify damage, guarding, defeat/retry, pause, resume, idempotency, owner isolation, legacy preservation and locked media. Record actual browser images and errors, merge checked PRs and publish through GitOps without restarting dev-env.
