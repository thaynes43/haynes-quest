# Contributor and agent guide

This project is a novelty 3D browser game, initially a family PoC for Tom Haynes's kids. Users configure a self-hosted photo-service URL, API key, and people; their photos supply chronological memory journeys. The PoC uses a shared generic, mysterious avatar who starts at memory age zero with no memories and baby abilities, independently of the selected person. Immich is the first integration. The planned hosting target is the local cluster through `haynes-ops`.

Read [`.agents/HANDOFF.md`](.agents/HANDOFF.md) for the current stage, then the [project brief](docs/prds/001-project-brief.md) and the documents named by the active plan.

## Working rules

- GPT-6 Astra leads this project. Follow the owner's current model choices. Use native Codex collaboration tools for Codex subagents; use `agent-run` when a separate Claude Code session is needed.
- Work in a task worktree on `agent/<slug>`. Canonical clones are fetch-only. Use branches and PRs, then squash-merge once the required checks pass. Never push directly to `main`.
- Document the requirements and significant decisions before implementing them. Follow [docs/PROCESS.md](docs/PROCESS.md), and update the relevant docs in the same PR as the behavior.
- Keep the current scope explicit. The brief establishes Roblox-style direction, touch and keyboard/mouse input, Authentik-only login, saved games, configured journey subjects, a shared avatar, chronological photo memories, and an authored catalog of enemies/bosses tied to the represented cultural eras. Never hard-code personal names or require a per-person avatar asset. Photo coverage is not evidence of birth or current age; follow DESIGN-004. DESIGN-006 makes ordered memory recovery unlock age-appropriate abilities that carry forward; use an explicit age source and ensure required paths are reachable with the current ability set. Use explicitly supplied gender/settings, not image inference. DESIGN-005 defines date-based enemy eligibility and original-art provenance; dynamic selection uses prepared catalog entries. Current work is documenting technical and nontechnical requirements; Tom deferred tool setup until that phase is complete. ADR-002 is a proposal to validate, not an implemented stack.
- Image generation followed by Blender MCP is the preferred asset-authoring direction, for the shared avatar, enemies/bosses, and world assets. Document the workflow now; defer connections, installations, assets, and prototype execution. Automatic per-person character generation is [conditional future backlog BL-01](docs/BACKLOG.md#bl-01-automatic-playable-character-generation) if Tom chooses a broader release and separately reintroduces person-specific avatars. Its workers, mock jobs, provider selection, and trials must not gate the PoC.
- Carry authorized work through implementation, meaningful validation, PR/merge, and any deployment the task includes. A documentation-only task does not imply deploying a placeholder application.
- Cluster configuration belongs in `haynes-ops` and deploys through Flux. Follow that repo's applicable instructions for any deployment work.
- Deliver a normal homelab-hosted web app for iPad, iPhone, and PC. Use Safari as the touch validation baseline. Do not introduce native iOS packaging, TestFlight, or a required app-install workaround.
- Keep Immich credentials and family photos out of git, published build artifacts, and diagnostic output. Use clearly synthetic fixtures for development until the photo-selection contract is defined.
- Give the game its own name, visual identity, and interaction design. Reuse proven engineering conventions from sibling repos where they fit.
- Keep the handoff concise and current. Completed plans retain their IDs when moved to `.agents/plans/completed/`.

## Verification

Check documentation links and placeholders during the bootstrap. Add executable build, lint, and test commands when their tooling exists, then make CI and local verification agree. For gameplay work, document the actual device/browser journeys and frame-time targets the later brief requires.

Do not claim a release is deployed or an integration works until the relevant live checks have run.
