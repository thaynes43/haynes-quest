# Current handoff

- **Project:** Haynes Quest
- **Last updated:** 2026-09-10
- **Stage:** Stack and asset pipeline proposed; technical prototype is next
- **Driving model:** GPT-6 Astra

## Established

Tom wants a novelty 3D browser game for his kids, with real Immich photos as collectibles and local hosting through `haynes-ops`. He chose `haynes-quest` on 2026-09-10.

His controls and login brief establishes Roblox as the style reference, touchscreen play with on-screen controls, keyboard/mouse play at a computer, and optional later gamepad support. Players must sign in through Authentik using the same approach as Haynes Network, with no alternative login method. These requirements are in PRD-001; [ADR-001](../docs/adrs/001-authentik-sign-in.md) records the identity-provider decision.

After login, players choose a saved game or start a new one. New game offers exactly Jackson and Penelope; the save retains the chosen character. Tom wants the stack and asset workflow established before further gameplay design. Photo-based character reference generation and modeling are deferred until later.

[ADR-002](../docs/adrs/002-web-game-stack.md) proposes TypeScript, React/Vite, Babylon.js, Hono/Node, Better Auth, and Postgres/Drizzle. [DESIGN-001](../docs/designs/001-technical-foundation.md) covers saves and runtime boundaries; [DESIGN-002](../docs/designs/002-asset-pipeline.md) covers generated references → editable Blender models → rigging/animation → GLB. The stack is a recommendation pending the prototype's integration and device evidence, not a claim of working software.

Reviewed `haynesnetwork`, `cigar-journal`, `libretto`, and their hosting patterns in `haynes-ops`. The seed follows their docs-first and PR workflows. It contains no application code or deployment.

## Completed

[Bootstrap PR #1](https://github.com/thaynes43/haynes-quest/pull/1) was squash-merged to `main` at `3b1ae9372cffd9162544e6b0f820cbf52019875b`. The repository contains the contributor guide, brief, vocabulary, templates, and hosting references. Local link and whitespace checks passed, and a separate Astra review found no blockers. No application build or deployment was included.

The evidence is in [completed PLAN-001](plans/completed/001-repository-bootstrap.md). The canonical clone is `/home/dev/repos/haynes-quest`; start future work in a fresh task worktree from `origin/main`.

## Next step

Prepare and execute [PLAN-002](plans/002-foundation-prototype.md) for the technical foundation using synthetic assets. Exact touch hardware is pending the device question; use ADR-002's provisional cross-platform scope until answered. Establish player admission before live Authentik provisioning. The core loop, world, camera, final controls, save cadence, and eligible Immich photos remain for later design.

Node, pnpm, and Python are available. Blender and glTF Transform are not installed; the asset plan calls for a repeatable builder rather than a live-pod installation. No app, database, Authentik client, or game assets have been provisioned by this documentation work.

## Resume references

- [Contributor guide](../AGENTS.md)
- [Project brief](../docs/prds/001-project-brief.md)
- [Documentation index](../docs/README.md)
- [Reviewed sibling conventions](../docs/reference/repository-conventions.md)
