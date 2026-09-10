# Current handoff

- **Project:** Haynes Quest
- **Last updated:** 2026-09-10
- **Stage:** Configurable photo-driven characters defined; foundation and generation trials are next
- **Driving model:** GPT-6 Astra

## Established

Tom wants a novelty 3D browser game, initially for his kids, with a configurable self-hosted photo library supplying generated characters and game content. Immich is the first integration, with local hosting through `haynes-ops`. He chose `haynes-quest` on 2026-09-10.

His controls and login brief establishes Roblox as the style reference, touchscreen play with on-screen controls, keyboard/mouse play at a computer, and optional later gamepad support. Players must sign in through Authentik using the same approach as Haynes Network, with no alternative login method. These requirements are in PRD-001; [ADR-001](../docs/adrs/001-authentik-sign-in.md) records the identity-provider decision.

Tom confirmed **iPad, iPhone, and PC** on 2026-09-10, delivered as a normal web app hosted on his homelab. No native iOS app, TestFlight, or installation workaround. Safari is the touch validation baseline; exact hardware models, OS/browser versions, and PC browsers still need recording for the trial.

After login, players choose a saved game or start a new one from their configured roster. Users supply the photo-service URL, API key, and people's names; the application resolves those people and uses their photos to generate characters and retrieve gameplay imagery. There are no built-in personal names or fixed two-character limit. Saves retain stable character IDs across name changes and model regeneration. Tom wants the stack and automated asset workflow established before further gameplay design; real generation implementation remains later work.

[ADR-002](../docs/adrs/002-web-game-stack.md) proposes TypeScript, React/Vite, Babylon.js, Hono/Node, Better Auth, and Postgres/Drizzle, with a background generation boundary. [DESIGN-001](../docs/designs/001-technical-foundation.md) covers saves/runtime; [DESIGN-002](../docs/designs/002-asset-pipeline.md) covers the automated asset pipeline; [DESIGN-003](../docs/designs/003-photo-connections-and-people.md) covers private connections, resolved people, character IDs, and job lifecycle. Blender is candidate processing/prototyping tooling, not a mandatory manual step for every user-created character. The real reference/model/rig generator and worker tooling remain unselected.

Reviewed `haynesnetwork`, `cigar-journal`, `libretto`, and their hosting patterns in `haynes-ops`. The seed follows their docs-first and PR workflows. It contains no application code or deployment.

## Completed

[Bootstrap PR #1](https://github.com/thaynes43/haynes-quest/pull/1) was squash-merged to `main` at `3b1ae9372cffd9162544e6b0f820cbf52019875b`. The repository contains the contributor guide, brief, vocabulary, templates, and hosting references. Local link and whitespace checks passed, and a separate Astra review found no blockers. No application build or deployment was included.

The evidence is in [completed PLAN-001](plans/completed/001-repository-bootstrap.md). The canonical clone is `/home/dev/repos/haynes-quest`; start future work in a fresh task worktree from `origin/main`.

## Next step

Prepare and execute [PLAN-002](plans/002-foundation-prototype.md) using synthetic connections, configurable rosters, and a simulated generation backend. That proves integration and recovery contracts only; follow with a real photo-to-character capability trial before considering generation implemented. Test in actual iPad/iPhone Safari and selected PC browsers through the homelab HTTPS URL. Establish player admission before live Authentik provisioning. The core loop, world, camera, final controls, save cadence, and detailed person-photo filters remain for later design.

Node, pnpm, and Python are available. Blender and glTF Transform are not installed; use pinned worker/builder tooling through GitOps if the selected recipe needs them. No app, database, Authentik client, photo connection, generation backend, or game assets have been provisioned by this documentation work.

## Resume references

- [Contributor guide](../AGENTS.md)
- [Project brief](../docs/prds/001-project-brief.md)
- [Documentation index](../docs/README.md)
- [Reviewed sibling conventions](../docs/reference/repository-conventions.md)
