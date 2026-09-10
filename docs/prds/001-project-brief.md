# PRD-001: Haynes Quest — initial project brief

- **Status:** Draft
- **Owner:** Tom Haynes
- **Last updated:** 2026-09-10
- **Source:** Owner's project kickoff and controls/login brief on 2026-09-10

## Summary

A novelty 3D web game for Tom's kids, with Roblox as the style reference. Real photos from the household's Immich instance are the things players collect. Players use on-screen controls on a touchscreen or a keyboard and mouse at a computer, and sign in through Authentik using the same approach as Haynes Network. The project has its own GitHub repository and will run on the local cluster through `haynes-ops`.

Tom selected **Haynes Quest**, repository slug **`haynes-quest`**, on 2026-09-10. The repository and documentation scaffold are established, and the game brief is being developed with Tom.

## Confirmed requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| R-01 | The game runs in a web browser and uses 3D. | Must |
| R-02 | The intended players are Tom's kids; this is a novelty family game. | Must |
| R-03 | Players collect real photos sourced from Immich. | Must |
| R-04 | The project gets its own GitHub repository, with local hosting managed through `haynes-ops`. | Must |
| R-05 | Repository and documentation conventions stay consistent with Tom's existing projects. | Must |
| R-06 | GPT-6 Astra leads the project end to end. | Must |
| R-07 | Use Roblox as the reference for the game's style. The specific look, camera, movement, and game world will be defined in the gameplay design. | Must |
| R-08 | Support touchscreen play with on-screen gameplay controls. | Must |
| R-09 | Support play with a keyboard and mouse at a computer. | Must |
| R-10 | Consider gamepad support after the initial playable scope; it is optional future work. | Later option |
| R-11 | Require players to sign in through Authentik, following Haynes Network's sign-in approach. Authentik is the only login method; do not add game-local passwords or separate login providers. | Must |

## Input and sign-in direction

Touchscreen and keyboard/mouse are both required ways to play the first playable slice. Design the core interactions for both from the start. Exact devices, supported browsers, touch layout, keyboard bindings, and camera controls will follow the gameplay design. Optional gamepad support does not block that slice.

The Roblox reference establishes a style direction. It does not yet specify a camera viewpoint, character design, building system, multiplayer mode, or support for user-created games.

The Authentik decision is recorded in [ADR-001](../adrs/001-authentik-sign-in.md). The identity provider is settled; the policy for which signed-in people may enter this family game still needs to be defined. An existing Haynes Network account does not by itself establish permission to access the game's photos.

## Acceptance criteria for the first playable slice

These are requirements for future implementation, not completed checks. The playable loop and device/browser matrix must be defined before validating them.

| ID | Criterion | Requirements |
| --- | --- | --- |
| AC-01 | On an agreed touchscreen device, a player can complete the core play-and-collect loop using touch and the on-screen controls without a keyboard or mouse. | R-03, R-08 |
| AC-02 | On an agreed desktop browser, a player can complete the same loop using a keyboard and mouse without a touchscreen. | R-03, R-09 |
| AC-03 | A signed-out visitor must sign in through Authentik before entering gameplay or accessing protected collectible photos. The game offers no alternative login method. | R-11 |
| AC-04 | A player admitted by the game's eventual access policy can sign in with their existing Authentik identity without setting up a game-local password. | R-11 |

## Current scope

The bootstrap established the name, contributor guide, document templates, project brief, vocabulary, handoff, and completion record after reviewing sibling repositories. The current phase captures the game requirements and decisions as Tom provides them; it does not implement a runtime or provision authentication.

Further gameplay acceptance criteria will follow the remaining brief. A game engine, viewpoint, progression system, multiplayer mode, database, and authentication library have not been selected.

## Open and deferred decisions

| ID | Decision | Needed by | Status / resolution |
| --- | --- | --- | --- |
| Q-01 | Project name and repository slug | Repository creation | Resolved by Tom on 2026-09-10: `haynes-quest` (Haynes Quest). |
| Q-02 | Game world, player loop, controls, and target devices | Product/design phase | Partially resolved by Tom on 2026-09-10: Roblox-style direction, touchscreen with on-screen controls, and keyboard/mouse are required; gamepad is a later option. World, loop, precise controls, and device/browser matrix remain deferred to the gameplay brief. |
| Q-03 | Which Immich photos are eligible and how they become collectibles | Integration design | Deferred to the game and photo-selection brief. |
| Q-04 | Engine, app structure, persistence, and access model | Architecture phase | Partially resolved by Tom on 2026-09-10: Authentik-only login, following Haynes Network. Engine, app structure, persistence, and the policy admitting players remain deferred to architecture and access design. |
