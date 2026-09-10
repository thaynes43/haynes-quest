# PRD-001: Haynes Quest — initial project brief

- **Status:** Draft
- **Owner:** Tom Haynes
- **Last updated:** 2026-09-10
- **Source:** Owner's project kickoff on 2026-09-10

## Summary

A novelty 3D web game for Tom's kids. Real photos from the household's Immich instance are the things players collect. The project will have its own GitHub repository and run on the local cluster through `haynes-ops`.

Tom selected **Haynes Quest**, repository slug **`haynes-quest`**, on 2026-09-10. The current step is publishing the documentation bootstrap. Tom will provide the game details later.

## Confirmed requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| R-01 | The game runs in a web browser and uses 3D. | Must |
| R-02 | The intended players are Tom's kids; this is a novelty family game. | Must |
| R-03 | Players collect real photos sourced from Immich. | Must |
| R-04 | The project gets its own GitHub repository, with local hosting managed through `haynes-ops`. | Must |
| R-05 | Repository and documentation conventions stay consistent with Tom's existing projects. | Must |
| R-06 | GPT-6 Astra leads the project end to end. | Must |

## Current scope

Review sibling repositories, select the project name, and establish the contributor guide, document templates, project brief, vocabulary, handoff, and bootstrap plan.

Detailed acceptance criteria for the playable game will be added after the next owner brief. This document does not prescribe a game engine, viewpoint, controls, progression system, multiplayer mode, database, or sign-in flow.

## Open and deferred decisions

| ID | Decision | Needed by | Status / resolution |
| --- | --- | --- | --- |
| Q-01 | Project name and repository slug | Repository creation | Resolved by Tom on 2026-09-10: `haynes-quest` (Haynes Quest). |
| Q-02 | Game world, player loop, controls, and target devices | Product/design phase | Deferred by owner to the next brief. |
| Q-03 | Which Immich photos are eligible and how they become collectibles | Integration design | Deferred to the game and photo-selection brief. |
| Q-04 | Engine, app structure, persistence, and access model | Architecture phase | Deferred until requirements justify the choices. |
