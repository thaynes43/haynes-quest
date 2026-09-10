# PLAN-002: Validate the technical foundation

- **Status:** Draft
- **Depends on:** Documentation bootstrap complete
- **Requirements/designs:** [PRD-001 R-01, R-08–R-19](../../docs/prds/001-project-brief.md), [ADR-002](../../docs/adrs/002-web-game-stack.md), [DESIGN-001](../../docs/designs/001-technical-foundation.md), [DESIGN-002](../../docs/designs/002-asset-pipeline.md), [DESIGN-003](../../docs/designs/003-photo-connections-and-people.md)

## Outcome and scope

Establish that the proposed stack can configure a synthetic photo connection and roster, load an animated synthetic character, support both input modes, create and resume account-owned saves, and deliver the game from the local cluster. Exercise persisted generation-job states with a simulated backend. Use the results to accept or revise the browser/API/storage foundation; real generation and its worker/provider choice remain a separate capability trial.

This plan describes the next implementation stage. The current stack/asset documentation task does not execute it. Final characters, real Immich content, game worlds, progression, multiplayer, and gamepad support are outside this prototype.

## Steps

1. Scaffold the proposed TypeScript/Vite/React/Babylon and Hono application with pinned compatible dependencies, scripts, CI, and clear client/game/server boundaries. Verify the installed Better Auth API and callbacks rather than copying an older sibling version's calls.
2. Prove the canvas lifecycle and common action interface with a small synthetic scene, data-configured character IDs, keyboard/mouse, and on-screen touch controls. Cover empty, single-person, and larger rosters. Keep movement and camera choices explicitly experimental.
3. Implement the connection/person and durable generation-job contracts against synthetic adapters: name resolution, account boundaries, destination/key handling, pending/failed/ready states, interrupted jobs, retries, and regeneration. Establish a reproducible synthetic GLB export/validation trial and local loader resources. A stub must be clearly identified and never treated as real generation evidence.
4. Implement and test the save envelope and ownership rules using isolated test identities and the proposed Postgres/Drizzle store. Cover dynamic character selection, missing/renamed people, empty and multiple-save lists, persistence, malformed data, another user's IDs, stale updates, and model replacement preserving saves.
5. Resolve the live admitted-player policy, then provision the game's own Authentik client, application secrets, and database through the established workflows. Test fresh login, existing-session SSO, expiry, and logout.
6. Release the application image, open and merge the `haynes-ops` deployment PR once checks pass, and verify Flux, health, and the complete browser journey at the homelab HTTPS route. Delivery is a normal web app with no native iOS or TestFlight build step.
7. Test and measure the synthetic scene in Safari on actual iPad and iPhone hardware and in the selected PC browsers. Record models/OS/browser versions, results, and the proven parts of ADR-002, retaining the generator/worker choice as unresolved until a real generation trial. Update the handoff with the next capability trial before claiming the configurable photo-to-character feature complete.

## Completion evidence

- Passing build, type checks, relevant tests, browser journeys, and asset validation, with commands and results recorded.
- Saves from data-configured rosters survive reload, name edits, simulated model replacement, and another authenticated session; ownership and stale-update checks pass.
- Synthetic connection/person/job tests cover missing and ambiguous names, credential isolation, cross-account access, revocation, interrupted generation, retries, and ready-version preservation. Record explicitly that this is contract evidence, not generation quality evidence.
- Repeatable GLB export and optimization, working clips, local decoder requests, and no family photos in source/build artifacts.
- Successful live Authentik flows and GitOps rollout, with image/version, PRs, and live checks recorded.
- Recorded iPad, iPhone, and PC browser journeys and actual-device graphics results, plus an explicit ADR-002 revision separating validated foundation choices from the unresolved real-generation backend. Desktop touch emulation alone is insufficient.

## Result

Not started. Device families and browser-only homelab delivery are confirmed. Record the exact hardware/browser versions and establish live admission policy during prototype preparation.
