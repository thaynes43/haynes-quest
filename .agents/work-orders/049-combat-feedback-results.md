# WO-049 results: Prism wand, enemy threat and touch combat

- **Status:** Ready for coordinator review; physical Safari and browser integration remain
- **Model / dispatch:** Native GPT-5.6 Sol, `xhigh`, fresh context
- **Worktree / branch / base:** `/home/dev/work/quest-playtest-feedback`; `agent/quest-playtest-feedback`; `698c9c77ae2898e3965b924db960aee827b0b8c9`
- **Owned scope:** combat targeting/simulation, runtime input integration, technical feedback hooks and focused regressions; no copy, assets, server rules, deployment or commits

## Reproduction and causes

The routed chapter-two save resumes after the ordinary fights at the boss-landing checkpoint `(0, 0, -19)`. The dragon spawns at `z=-22` and its island-safe arena clamps it to `z<=-21`. The former boss stop/strike ranges were 1.5/1.75 metres. The dragon therefore reached the clamp two metres from the player and remained in `chasing` forever: the move clip looked like pacing, but the state could never enter its attack telegraph. The correction preserves the arena and gaps while giving the large boss a 2.1 metre stop distance and 2.25 metre strike reach. Arena reachability now prevents any bounded enemy from entering a permanent chase against an unreachable island edge.

Player targeting used only two centre metres for the boss and 1.7 metres for ordinary enemies, regardless of equipped tool. That put the three-metre-long dragon exactly on a brittle boundary and made the Prism wand behave like the starting mallet. Targeting now derives reach from the collected, equipped attack tier: the tier-one mallet retains its previous 1.7/2.0 metre melee reach, and tier two or later uses a 4.25 metre ranged reach. Existing boss availability, defeated-enemy, facing, one-metre vertical separation and authoritative command checks remain in force.

The prior touch journey tapped Attack after releasing movement. Its state-only unit check did not exercise cancellation. Browser input also cleared every movement/action channel when any pointer was cancelled. A cancelled secondary action could therefore erase a held joystick; action buttons also requested pointer capture before queueing the press, so a capture exception could make a valid touch silent. Each gameplay control now cancels only its own channel, a canvas cancellation only drops that camera pointer, and the action is queued before the guarded capture request.

## Technical integration hooks

`SceneFrame.attackTargetId` latches the exact accepted encounter for the 0.28-second cast window, including a defeating response. `GameStatus.attackFeedback` is either null or `{ sequence, outcome }`; the outcome is `accepted`, `no-target`, `unarmed`, `cooldown`, `busy` or `unavailable`. The sequence increments for repeated equal outcomes. These hooks contain no player-facing copy and let the coordinator render the Prism effect and explain otherwise silent taps.

## Verification

- Focused runtime/combat/input suite: 46 tests passed across `combat`, `input`, `runtime-obby`, `runtime` and `action-edge`.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed before unrelated concurrent catalog changes entered the shared worktree.
- `pnpm build`: passed; client and server bundles completed. The existing client chunk-size advisory remains.
- `pnpm test`: 236 passed and nine skipped; one failure came from the concurrently added, out-of-scope `tests/game/audio.test.ts` retry expectation. All WO-049 tests passed in that run.
- `git diff --check`: passed before later concurrent worktree changes.

Regression coverage proves the routed dragon contacts the checkpoint-adjacent player without leaving `[-24, -21]`, the Prism boundary accepts 4.20 metres and rejects 4.26 metres, the mallet still rejects 2.01 metres, an empty tap records `no-target`, a held joystick survives a cancelled Attack touch, and a held-stick Prism tap dispatches the real boss attack command with the latched target.

## Limits

No browser/server was started because the coordinator retained the browser lease. Physical iPhone/iPad Safari remains the necessary input and feel check. The gameplay-facing beam, impact and feedback copy are coordinator-owned consumers of the hooks above. The server still owns damage, cooldowns, boss gating, revisions and idempotency; no persisted save shape or shared domain rule changed.
