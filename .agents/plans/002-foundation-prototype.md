# PLAN-002: Validate the technical foundation

- **Status:** Draft
- **Depends on:** Documentation bootstrap complete
- **Requirements/designs:** [PRD-001 R-08–R-16](../../docs/prds/001-project-brief.md), [ADR-002](../../docs/adrs/002-web-game-stack.md), [DESIGN-001](../../docs/designs/001-technical-foundation.md), [DESIGN-002](../../docs/designs/002-asset-pipeline.md)

## Outcome and scope

Establish that the proposed stack can load an animated synthetic character, support both input modes, create and resume account-owned saves, and deliver the game from the local cluster. Use the results to accept or revise ADR-002 before substantial gameplay or likeness production.

This plan describes the next implementation stage. The current stack/asset documentation task does not execute it. Final characters, real Immich content, game worlds, progression, multiplayer, and gamepad support are outside this prototype.

## Steps

1. Scaffold the proposed TypeScript/Vite/React/Babylon and Hono application with pinned compatible dependencies, scripts, CI, and clear client/game/server boundaries. Verify the installed Better Auth API and callbacks rather than copying an older sibling version's calls.
2. Prove the canvas lifecycle and common action interface with a small synthetic scene, two character IDs, keyboard/mouse, and on-screen touch controls. Keep movement and camera choices explicitly experimental.
3. Establish the reproducible Blender-to-GLB trial, asset provenance/validation, and local loader resources. Use synthetic art; add a pinned builder through the appropriate repositories if needed.
4. Implement and test the save envelope and ownership rules using isolated test identities and the proposed Postgres/Drizzle store. Cover both characters, empty and multiple-save lists, persistence, malformed data, another user's IDs, and stale updates.
5. Resolve the live admitted-player policy, then provision the game's own Authentik client, application secrets, and database through the established workflows. Test fresh login, existing-session SSO, expiry, and logout.
6. Release the application image, open and merge the `haynes-ops` deployment PR once checks pass, and verify Flux, health, and the complete browser journey at the internal route.
7. Measure the synthetic scene on actual target hardware. Record results, revise or accept ADR-002, and update the handoff. Further gameplay design can build on this evidence.

## Completion evidence

- Passing build, type checks, relevant tests, browser journeys, and asset validation, with commands and results recorded.
- Saves for both characters survive reload and another authenticated session; ownership and stale-update checks pass.
- Repeatable GLB export and optimization, working clips, local decoder requests, and no family photos in source/build artifacts.
- Successful live Authentik flows and GitOps rollout, with image/version, PRs, and live checks recorded.
- Recorded actual-device graphics results and an explicit ADR-002 acceptance or revision. Desktop touch emulation alone is insufficient.

## Result

Not started. The prototype's exact hardware baseline and live admission policy remain to be established during its preparation.
