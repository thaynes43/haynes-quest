# Current handoff

- **Project:** Haynes Quest
- **Last updated:** 2026-09-10
- **Stage:** Documenting technical and nontechnical requirements; tool setup is deferred
- **Driving model:** GPT-6 Astra

## Established

Tom wants a novelty 3D browser game as a family PoC, with a configurable self-hosted photo library supplying memories for chronological journeys and a shared generic avatar. Immich is the first integration, with local hosting through `haynes-ops`. He chose `haynes-quest` on 2026-09-10.

His controls and login brief establishes Roblox as the style reference, touchscreen play with on-screen controls, keyboard/mouse play at a computer, and optional later gamepad support. Players must sign in through Authentik using the same approach as Haynes Network, with no alternative login method. These requirements are in PRD-001; [ADR-001](../docs/adrs/001-authentik-sign-in.md) records the identity-provider decision.

Tom confirmed **iPad, iPhone, and PC** on 2026-09-10, delivered as a normal web app hosted on his homelab. No native iOS app, TestFlight, or installation workaround. Safari is the touch validation baseline; exact hardware models, OS/browser versions, and PC browsers still need recording for the trial.

After login, players choose a saved game or select whose memories to recover. Users supply the photo-service URL, API key, and people's names; the application resolves people and retrieves eligible dated photos. Tom's latest direction uses a generic, mysterious avatar with no memory. Journeys move chronologically from the earliest available photos through later represented periods, adapting to library coverage. No personal names are built in, and adding an eligible subject requires no model. Saves retain subject, chapter, and memory progress across name edits and avatar replacement.

[ADR-002](../docs/adrs/002-web-game-stack.md) proposes TypeScript, React/Vite, Three.js, Hono/Node, Better Auth, and Postgres/Drizzle. Tom asked for demonstrated Astra/GPT-6 game workflows; the [community and source review](../docs/reference/astra-game-workflows.md) informs the revised Three.js recommendation. Babylon remains a fallback; R3F and Rapier are optional choices to justify against gameplay. The evidence includes creator reports and inspected manifests, not local live play or physical-device validation. [DESIGN-001](../docs/designs/001-technical-foundation.md) covers saves/runtime; [DESIGN-002](../docs/designs/002-asset-pipeline.md) covers asset authoring; [DESIGN-003](../docs/designs/003-photo-connections-and-people.md) covers private connections, resolved people, and photo dates. [DESIGN-004](../docs/designs/004-memory-journey.md) defines memory journeys, incomplete libraries, and stable progress. Optional birth-date setup with calendar-year fallback is proposed pending Tom's response; photo range alone does not establish age.

Tom proposed image generation for sketches followed by agent-driven Blender authoring through MCP. This remains the preferred workflow for the shared avatar and world assets. On 2026-09-10 he deferred automatic character generation to [BL-01](../docs/BACKLOG.md#bl-01-automatic-playable-character-generation), to revisit if he chooses a release beyond the family PoC. With the new generic-avatar premise, person-specific models would also need a separate product decision. No generation worker, mock-job implementation, provider selection, or automation trial blocks the PoC. **Finish documenting technical and nontechnical requirements first; Tom will arrange tool setup afterward.** The concrete Blender host/bridge remains unselected.

Reviewed `haynesnetwork`, `cigar-journal`, `libretto`, and their hosting patterns in `haynes-ops`. The seed follows their docs-first and PR workflows. It contains no application code or deployment.

## Completed

[Bootstrap PR #1](https://github.com/thaynes43/haynes-quest/pull/1) was squash-merged to `main` at `3b1ae9372cffd9162544e6b0f820cbf52019875b`. The repository contains the contributor guide, brief, vocabulary, templates, and hosting references. Local link and whitespace checks passed, and a separate Astra review found no blockers. No application build or deployment was included.

The evidence is in [completed PLAN-001](plans/completed/001-repository-bootstrap.md). The canonical clone is `/home/dev/repos/haynes-quest`; start future work in a fresh task worktree from `origin/main`.

## Next step

Continue the requirements documentation with Tom. The amnesiac avatar and chronological memory collection establish the narrative direction. The world, challenges, camera, final controls, chapter grouping/completion, save cadence, timeline refresh, detailed photo filters, and admission rules still need design. Keep [PLAN-002](plans/002-foundation-prototype.md) Draft until the documentation phase and subsequent tool setup are complete. Its synthetic prototype will validate the shared avatar, controls, photo/timeline contracts, and saved journeys, including iPad/iPhone Safari and PC browser trials.

Image generation is available in the agent session; no Blender MCP is connected. Node, pnpm, and Python are available; Blender and glTF Transform are not installed in the dev pod. DESIGN-002 records the later connection and private-file requirements. No app, database, Authentik client, photo connection, or game assets have been provisioned by this documentation work.

## Resume references

- [Contributor guide](../AGENTS.md)
- [Project brief](../docs/prds/001-project-brief.md)
- [Documentation index](../docs/README.md)
- [Reviewed sibling conventions](../docs/reference/repository-conventions.md)
