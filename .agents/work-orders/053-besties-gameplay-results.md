# Work order 053: Besties gameplay routine

- **Status:** Ready for coordinator integration
- **Model / dispatch:** Native Codex GPT-5.6 Sol, `xhigh`, fresh context
- **Required reading completed:** `AGENTS.md`, `.agents/TEAM.md`, PLAN006, WO036, WO051, `src/game/types.ts`, `src/game/combat.ts` and `src/game/obby-layout.ts`
- **Worktree / branch:** `/home/dev/work/quest-playtest-feedback`, `agent/quest-playtest-feedback`
- **Owned paths:** `src/game/besties.ts`, `tests/game/besties.test.ts`, `src/shared/parody-catalog.ts`, the additive period enum in `src/server/adventure-schema.ts`, focused catalog/current-journey test assertions, and this result record
- **Coordination boundary:** Root retains rendering, UI/copy, encounter integration and persistence. The friendly backend owner completed its schema work first and confirmed the additive period-enum edit would not conflict. This lane made no scene or asset changes.

## Outcome and API

`BestiesSimulation` is a rendering-independent state machine for the duo's one logical boss encounter. Construct it once, read `frame()`, and call `step({ player, deltaSeconds, active, paused?, defeated })`. Each result provides the current `frame`, a one-step `hit`/`hitBy` contact edge and a one-step `phaseEntered` edge. It never changes health, grants victory, creates rewards or distinguishes actor defeat state.

The typed frame provides:

- `phase`, normalized `phaseProgress`, `activeActor`, `vulnerable`, `cycleIndex` and the predetermined `blackLaneSide`;
- both stable actor IDs, local X offsets (`+1.25` pink, `-1.25` black) around the exported `{ x: 0, y: 0, z: -22 }` arena centre, and phase-selected clip names;
- zero or one finite, axis-aligned hazard geometry record with `center`, `halfExtents`, `damaging`, kind-specific data and Pink's complete sweep path;
- the complete required clip-name tuple: `idle`, `move`, `attack`, `hit`, `defeat`, `cheer`, `high-five`, `dizzy`.

The fixed routine is `pink-warning` 1.2 s, `pink-trick` 2 s, `black-warning` 1.2 s, `black-trick` 2 s, `high-five` 1.6 s and `dizzy` 5 s: 13 s total. Only `dizzy` is vulnerable. During either actor's turn that actor uses `attack` and the other uses `cheer`; both use the joint clips during `high-five`, `dizzy` and `defeated`.

Pink's low foam bar moves from X `-2.7` to `+2.7` at Z `-20.4`; its 0.3 m X half extent keeps the full shape within X `-3..+3`. Swept contact testing prevents tunnelling between frames. Black's first floor lane is left, then right, alternating by cycle. Each marked lane covers only its outer side of the island and leaves the centre/opposite side broadly clear. Warning frames expose the same future shape or path with `damaging: false`. High-five, dizzy, inactive and defeated frames have no hazards.

Player contact expands horizontal geometry by the required 0.3 m player radius. A trick can emit at most one hit until its next phase. Feet above 0.35 m and players below the island are ignored. Pausing freezes elapsed time and contact; deactivation clears the routine, so reactivation always emits and begins a full pink warning. One `defeated` input changes both actor clips together and remains safe. Finite elapsed time is capped to 0.1 s per call; negative, NaN and infinite elapsed values advance zero time, and invalid player coordinates cannot collide.

## Immutable catalog v3 follow-up

New plans now pin `parody-catalog-v3`; the plan and combat-state wire versions remain `era-level-plan-v2` and `era-combat-state-v2`. V1 and V2 catalog arrays and entries are unchanged and remain accepted by stored-plan validation. V3 is a separately frozen array of frozen entries with separately frozen ability lists, so its immutability does not freeze or mutate archived catalog objects.

V3 contains the complete V2 cast for compatibility fallback plus a second complete 2024 period, `besties-obby-v1`. The supplied period text is `Besties Obby`, `Pink, black and one missed high-five`, and `Two rivals take turns building obstacle tricks. Their missed high-five leaves them dizzy.` The Besties period reuses the currently authored ordinary assets through unique frozen identities `sir-flush-a-lot-besties@v001` → `sir-flush-a-lot@v001` and `peel-patrol-besties@v001` → `peel-patrol@v001`.

Its sole boss entry is `bickering-besties@v001`, with the logical asset identity `bickering-besties@v001`, title `The Bickering Besties`, and required abilities `move` plus `jump`. The existing deterministic selector therefore chooses Besties for an eligible 2024 level whose starting player can jump. A 2024-starting age-zero journey cannot select that incomplete period and falls through to the unchanged `remix-runway-v2` trio. Normal two-chapter fixture plans retain the first `block-party-v1` trio, then freeze one `level-2-2024-boss` record with 11 HP and one reward/progression gate; the server still has no actor-level boss state or reward.

## Verification and limits

- `pnpm exec vitest run tests/game/besties.test.ts`: 1 file, 7 tests passed. Coverage includes harmless warnings, damaging contact edges, safe lane, jump/fall avoidance, exact phase order and duration, sole dizzy vulnerability, deterministic lane alternation, pause/deactivation reset, shared defeat, bounded elapsed time and finite frame geometry.
- `pnpm exec vitest run tests/server/parody-selection.test.ts`: 1 file, 11 tests passed. Coverage includes V3 immutability and exact supplied text, jump-gated selection, deterministic no-jump fallback, one logical boss identity/HP, frozen content, date gates and stored V1/V2 plan compatibility.
- `pnpm exec vitest run tests/server/adventure.test.ts`: 1 file, 7 tests passed with the current V3 journey expectations and full single-boss progression flow.
- `pnpm exec eslint src/game/besties.ts tests/game/besties.test.ts --max-warnings 0`: passed.
- `pnpm exec tsc --noEmit`: passed against the current shared worktree.
- `pnpm exec prettier --check src/game/besties.ts tests/game/besties.test.ts`: run after formatting and expected in final verification.
- `git diff --check -- src/game/besties.ts tests/game/besties.test.ts .agents/work-orders/053-besties-gameplay-results.md`: expected in final verification.

No browser, authoring, deploy or physical-device check ran in this bounded lane. Server behavior was exercised in memory only. The coordinator still needs to instantiate the simulation only for the approved encounter, render its simple geometry and actor clips, resolve the logical boss asset to the two actor models, expose the new period story, gate player attacks with `frame.vulnerable`, dispatch the single encounter's damage/contact actions, and provide the one shared authoritative `defeated` flag.
