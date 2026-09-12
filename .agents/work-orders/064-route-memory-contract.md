# Work order: route-memory and baseline-action contracts

- **Status:** Complete
- **Model / dispatch:** Native GPT-5.6 Sol, exact model `gpt-5.6-sol`, effort `xhigh`
- **Context:** Fresh development agent; native `fork_turns: "none"`; bounded PLAN007 server/domain lane
- **Required reading:** `AGENTS.md`, `.agents/TEAM.md`, `.agents/HANDOFF.md`, `.agents/plans/007-playtest-reset-and-controls.md`
- **Worktree / branch / base commit:** `/home/dev/work/quest-playtest-reset`; `agent/quest-playtest-reset`; `ed7ae72963d9d9902cb42f1fec545d15e659fe25`
- **Depends on / stable contracts:** Frozen parody catalog v3 and existing era combat state v2; route-memory creation is selected only by the isolated ephemeral playtest server
- **Owned paths:** `src/shared/adventure.ts`, memory/adventure portions of `src/shared/contracts.ts`, `src/server/domain.ts`, `src/server/adventure-schema.ts`, `src/server/photos/fixture.ts`, the gameplay action addition in `src/server/validation.ts`, `src/game/createGame.ts`, new `src/game/frame-step.ts`, focused tests, and this record. The coordinator owns the other game/runtime/UI files, fixture SVG art and release metadata. WO063 owns ephemeral app/config/index/store behavior.

## Outcome and scope

Add an opt-in, versioned route-memory plan without rewriting or deleting existing saves. The isolated playtest receives six fictional memories at ages 0, 2, 4, 5, 6 and 7. They form two chapters with exactly two route minors followed by one boss-gated major. Minor recovery never changes age. Recovering the major after both minors and the boss atomically consumes the chapter memories and advances age. The route starts with jump at age zero.

The default fixture source and `createAdventurePlan` remain v2 with their original three-photo arc, age-zero ability set and first route. Stored v1/v2 plans retain their strict schemas and validation. The v3 plan stores `minorMemoryIds` and `majorMemoryId`; API level views retain the ordered combined `memoryIds` for client compatibility and expose the role fields. Memory views expose optional `minor`/`major` roles only for v3.

PLAN007 also turns the v3 guard tool into an offhand secondary attack. Tier one deals 2 damage and tier two deals 3, with a separate 1,000 ms cooldown stored in the existing guard deadline. V3 primary cooldown is 400 ms. V3 rejects the legacy guard action; v1/v2 keep the 600 ms primary attack and guard behavior. The secondary action is parsed by the normal strict action request and rejected for archived plans.

The v3 runtime uses grounded contact to collect equipment, recover eligible memories and help eligible friendlies. An attacked friendly must be left and re-entered before automatic amends can fire. Primary and secondary attempts expose distinct animation state and a monotonic attempt sequence; accepted pickups, memory recovery and friendly help expose an interaction beat. Confirmed physics jumps expose a separate monotonic jump sequence.

Foreground frames preserve up to 200 ms of real elapsed time through physics slices no larger than 50 ms. Pause, hidden-tab and resume frames remain zero-time and discard background stalls. Legacy route movement stays at 3.1 m/s; v3 opts into 4 m/s and can traverse the second gap without landing in the runway hazard.

No existing saved-data deletion, OAuth, private photos, generation, catalog edits, cluster changes or dev-env restart is authorized in this lane. `src/shared/parody-catalog.ts` remains untouched.

## Inputs and contract

`era-level-plan-v3` retains the frozen `catalogVersion`, route, equipment and encounter content identities. Each of its two level records stores:

- `minorMemoryIds: [string, string]`
- `majorMemoryId: string`

The existing `era-combat-state-v2` has sufficient progression fields and stays unchanged. While a v3 chapter is active, both minors are released and recoverable in exploration; they remain recovered across falls/retries. The major stays locked until the boss is defeated. If a minor was missed it can still be recovered in `memory-released`; major recovery fails with `MEMORY_BUNDLE_INCOMPLETE` until both exist. Successful major recovery completes and advances immediately. The old `consume-memory-bundle` action is unavailable for v3 and remains authoritative for v1/v2.

The ephemeral server selects the new behavior through internal `CreateSaveCommand.planMode: "route-memories"`; this field is not accepted from player JSON. Its v3 save reports journey `era-level-plan-v3` and progression `route-major-recovery-v3`. The default command remains v2. WO063 forwards the internal mode only when ephemeral playtest mode is enabled and prepares chapter-two shortcuts through ordinary stored gameplay actions.

## Deliverables and verification

- Versioned v3 plan and view types, deterministic construction, memory-role helpers and strict stored-data validation.
- Minor, major and age transition reducer semantics with legacy v1/v2 behavior preserved.
- V3 primary/secondary timing and tool gates, plus a strict secondary action request schema.
- Opt-in six-photo fictional fixture discovery; default fixture discovery remains the archived three-photo set.
- Focused tests for exact grouping/roles, age-zero jump, pre/post-boss access, atomic age progression, retry persistence, receipt replay, secondary damage/cooldowns/gating, strict schema behavior and v2 compatibility.
- Run `pnpm typecheck`, focused server tests and the repository lint/test/build checks after concurrent PLAN007 integration settles.

Completed verification:

- `pnpm typecheck`
- ESLint across the owned source and focused test files
- Full suite: 323 passed and 10 skipped across 41 files
- Production client/server build passed (with the existing client chunk-size advisory)
- Runtime checks cover 60 fps versus 10 fps travel, the 200 ms foreground cap, no pause/background catch-up, v3-only 4 m/s tuning, the second-gap landing, automatic pickup/minor/major actions, secondary input/range/animation, jump and attack sequences, and the friendly amends re-entry latch

## Handoff and recovery

All edits are in the shared lead worktree and intentionally uncommitted for coordinator review. No remote resource, browser lease or authoring service is owned. If interrupted, inspect the shared worktree before editing because WO063 and the coordinator also modify adjacent app/contracts/game files.
