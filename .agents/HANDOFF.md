# Current handoff

- **Project:** Haynes Quest
- **Last updated:** 2026-09-10
- **Stage:** Documentation bootstrap complete; capturing the game-design brief
- **Driving model:** GPT-6 Astra

## Established

Tom wants a novelty 3D browser game for his kids, with real Immich photos as collectibles and local hosting through `haynes-ops`. He chose `haynes-quest` on 2026-09-10.

His controls and login brief establishes Roblox as the style reference, touchscreen play with on-screen controls, keyboard/mouse play at a computer, and optional later gamepad support. Players must sign in through Authentik using the same approach as Haynes Network, with no alternative login method. These requirements are in PRD-001; [ADR-001](../docs/adrs/001-authentik-sign-in.md) records the identity-provider decision.

Reviewed `haynesnetwork`, `cigar-journal`, `libretto`, and their hosting patterns in `haynes-ops`. The seed follows their docs-first and PR workflows. It contains no application code or deployment.

## Completed

[Bootstrap PR #1](https://github.com/thaynes43/haynes-quest/pull/1) was squash-merged to `main` at `3b1ae9372cffd9162544e6b0f820cbf52019875b`. The repository contains the contributor guide, brief, vocabulary, templates, and hosting references. Local link and whitespace checks passed, and a separate Astra review found no blockers. No application build or deployment was included.

The evidence is in [completed PLAN-001](plans/completed/001-repository-bootstrap.md). The canonical clone is `/home/dev/repos/haynes-quest`; start future work in a fresh task worktree from `origin/main`.

## Next step

Continue capturing Tom's game brief in PRD-001, then develop the gameplay and architecture documents needed for the first playable slice. The core loop, world, camera, precise controls, device/browser matrix, engine, persistence, player admission rules, and eligible Immich photos remain undecided. Do not infer those choices from the Roblox reference or sibling application stacks. Authentication uses Authentik; its game client and runtime integration have not been provisioned.

## Resume references

- [Contributor guide](../AGENTS.md)
- [Project brief](../docs/prds/001-project-brief.md)
- [Documentation index](../docs/README.md)
- [Reviewed sibling conventions](../docs/reference/repository-conventions.md)
