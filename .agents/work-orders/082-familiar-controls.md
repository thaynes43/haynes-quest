# WO082: Child playtest control and recovery pass

Status: In progress. Root Astra max coordinates PLAN011 from `/home/dev/work/quest-familiar-controls`, base `8b3a24d`.

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

No implementation or new release is claimed yet. Existing hosted acceptance does not establish this feedback resolved. Preserve old failures and use distinct PLAN011 run labels. Source research: Roblox's current [layout guidance](https://create.roblox.com/docs/tutorials/curriculums/user-interface-design/wireframe-your-layouts) reserves thumbstick lower left and Jump lower right; [mobile input](https://create.roblox.com/docs/input/mobile) supports portrait and landscape, with landscape the default. Primary screenshots were located via image search; direct reference-image retrieval in dev-env currently fails DNS resolution, so no downloaded screenshot is claimed inspected.
