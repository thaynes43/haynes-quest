# Contributor and agent guide

This project is a novelty 3D browser game for Tom Haynes's kids, with real photos sourced from Immich as collectibles. The planned hosting target is the local cluster through `haynes-ops`.

Read [`.agents/HANDOFF.md`](.agents/HANDOFF.md) for the current stage, then the [project brief](docs/prds/001-project-brief.md) and the documents named by the active plan.

## Working rules

- GPT-6 Astra leads this project. Follow the owner's current model choices. Use native Codex collaboration tools for Codex subagents; use `agent-run` when a separate Claude Code session is needed.
- Work in a task worktree on `agent/<slug>`. Canonical clones are fetch-only. Use branches and PRs, then squash-merge once the required checks pass. Never push directly to `main`.
- Document the requirements and significant decisions before implementing them. Follow [docs/PROCESS.md](docs/PROCESS.md), and update the relevant docs in the same PR as the behavior.
- Keep the current scope explicit. The brief establishes Roblox-style direction, touch and keyboard/mouse input, Authentik-only login, saved games, and Jackson/Penelope selection for new games. Gamepad and character likeness production are later work. Establish the stack and asset workflow before expanding gameplay; ADR-002 is a proposal to validate, not an implemented stack. Do not turn deferred mechanics, exact device coverage, or admission rules into settled requirements.
- Carry authorized work through implementation, meaningful validation, PR/merge, and any deployment the task includes. A documentation-only task does not imply deploying a placeholder application.
- Cluster configuration belongs in `haynes-ops` and deploys through Flux. Follow that repo's applicable instructions for any deployment work.
- Keep Immich credentials and family photos out of git, published build artifacts, and diagnostic output. Use clearly synthetic fixtures for development until the photo-selection contract is defined.
- Give the game its own name, visual identity, and interaction design. Reuse proven engineering conventions from sibling repos where they fit.
- Keep the handoff concise and current. Completed plans retain their IDs when moved to `.agents/plans/completed/`.

## Verification

Check documentation links and placeholders during the bootstrap. Add executable build, lint, and test commands when their tooling exists, then make CI and local verification agree. For gameplay work, document the actual device/browser journeys and frame-time targets the later brief requires.

Do not claim a release is deployed or an integration works until the relevant live checks have run.
