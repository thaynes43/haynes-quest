# WO082: Child playtest control and recovery pass

Status: In progress. Root Astra max coordinates PLAN011 from `/home/dev/work/quest-familiar-controls`, base `8b3a24d`. Recovery, familiar controls and Besties phase fixes are integrated; new route/version integration and browser validation are active.

## Ownership and findings

- Root owns `GameScreen.tsx`, CSS, input UX, visible writing, new course layouts and cross-lane integration.
- Native Sol `level_contract_audit` found the confirmed obsolete Besties dizzy-only gate: readiness and action dispatch both reject otherwise valid in-range primary/secondary attacks. Existing tests explicitly enforce that old behavior. No shared phase/damage API change is needed. Authored activation also uses world-zero height instead of inclusive actor-relative height; fix that boundary and retain normal encounter prerequisites.
- Native Sol `level_progression_audit` traces death recovery and memory checkpoint persistence; implementation ownership follows its audit.
- Native Sol `level_test_audit` traces height assumptions in the shared builder, controller and runtime; implementation ownership follows its audit.

## Combat implementation work order

For `level_contract_audit`, exact native model `gpt-5.6-sol`, effort `xhigh`: implement the bounded Besties fix after this contract is recorded. Own the Besties activation/readiness/action portions of `src/game/createGame.ts` and focused combat/runtime/server tests only. Root will integrate other sections of that file. Remove dizzy-only damage gates; keep all tricks, normal target availability, range/equipment/cooldown checks and animation state. Align authored activation height with relative inclusive target height. Add meaningful primary/secondary tests across all six active phases, fresh second runtime/session and death retry, including retained negative gates. Do not write UI copy, change route layouts, start browsers, mutate infrastructure or author assets. Return a committed branch and exact validation evidence. Do not put a child's actual name in new docs or fixture content.

## Verification and release

## Recovery implementation ruling

Root ratifies automatic HP defeat recovery from the furthest collected minor memory in the active authored route, mapped to a uniquely validated safe checkpoint on that memory's supporting platform. Before the first minor use chapter spawn; major recovery advances to the next chapter's spawn or completes the journey. Derive this from existing authoritative recovered IDs and frozen route order; do not add a coordinate-bearing action or migration. Preserve collected equipment, memories and beaten encounters. The existing reducer restores each still-undefeated encounter to full health for a fresh attempt; retain that behavior. Local obstacle falls still use their supported nearby checkpoint without changing health/save revision. Accepted memory collection promotes the local fallback immediately.

Native Sol `level_progression_audit` owns `src/game/level.ts`, recovery sections of `src/game/createGame.ts`, and new focused checkpoint tests. It does not own `GameScreen.tsx`, the shared authored schema, existing authored-runtime test file (combat lane), or the authored-layout adapter (height lane). Height lane will enforce the unique safe checkpoint per memory platform invariant. Root integrates overlap explicitly.

## Integrated checkpoints

- `c283c20` integrates the memory checkpoint resolver/promotion/retry implementation and seven focused regressions. `e56375d` adds root-owned Jump UI, proportional stick geometry, peripheral memory thumbnails and automatic recovery. The 26 focused input/UI tests pass, including no empty-attack prose, one automatic retry, bounded failure retry and unmount cleanup.
- `ab9d1f9` integrates both attacks across every Besties phase plus inclusive actor-relative activation and second-run/retry tests. `9d2dcbf` shares the new route-specific boss availability policy between server and client. DESIGN018 supersedes this work order's original ordinary-before-boss prerequisite for the new v2 routes; archived routes retain it.
- `1417fd9` freezes catalog v5 and the new route IDs while preserving v4/v1 selection. Root's new JSON layouts begin with six pads at 0.3, 0.6, 0.9, 0.6, 0.3 and 0.1 metres over broad static ground. Their seven jump edges name that catch support and a declared retry edge leads to the start. Later route coordinates move together to preserve relative placement. Garden's memory grove and dragon clearing also rise, with supporting transition pads; Besties' final two hops climb to a 0.9-metre court and reward terrace. Corresponding memories, encounters and safe checkpoints use their platform height.
- Sol height lane owns schema v2, shared safe-miss/elevated-contact validation and focused physics tests. Sol recovery lane now owns browser-helper adaptation for dedicated Jump, all four device layouts, safe-miss recovery, automatic death recovery and Help-paused artwork retry. Sol combat lane now owns default-version and frozen-plan integration tests.

No new art/audio source is generated. New course/guide captures remain to be taken. Local strict docs and production build pass at the earlier partial checkpoint; they must run on the integrated candidate. Browser and release acceptance remain open.

No implementation or new release is claimed yet. Existing hosted acceptance does not establish this feedback resolved. Preserve old failures and use distinct PLAN011 run labels. Source research: Roblox's current [layout guidance](https://create.roblox.com/docs/tutorials/curriculums/user-interface-design/wireframe-your-layouts) reserves thumbstick lower left and Jump lower right; [mobile input](https://create.roblox.com/docs/input/mobile) supports portrait and landscape, with landscape the default. Primary screenshots were located via image search; direct reference-image retrieval in dev-env currently fails DNS resolution, so no downloaded screenshot is claimed inspected.

## Adversarial review integration

Opus reviewed the earlier scoped commit e278f41. Its staging/version/registry/nav findings are resolved by the subsequent integrated schema, version tests, route registry and docs; root's integrated suite is green. Source-level timeout, same-orientation resize and premature ordinary boss HUD findings are accepted for correction before release. DESIGN018 records the ratified transport/input/presentation rules. Memory-based HP recovery stays as requested; local-slip checkpoints remain separate. Browser evidence currently proves four responsive layouts, simultaneous actual stick+Jump, pointer cancellation, rotation cleanup and safe-miss recovery; full journey and hosted release remain open.
