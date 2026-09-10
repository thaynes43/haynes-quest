# Haynes Quest

[GitHub repository](https://github.com/thaynes43/haynes-quest)

A Roblox-style 3D browser game for a family proof of concept, personalized from a self-hosted photo library with Immich as the first integration. Users configure their photo-service URL, API key, and people's names. The player controls a generic, mysterious avatar with no memory, recovering the selected person's photos through chronological chapters. Touchscreen and keyboard/mouse play are required, with gamepad support a later option. Players will sign in through Authentik, as they do on Haynes Network.

The game will run as a normal web app on **iPad, iPhone, and PC**, hosted on the homelab through `haynes-ops`. Players open its HTTPS URL; no native iOS app or TestFlight installation is needed. This repository starts with the project brief and documentation templates. The proposed runtime stack will be validated after the requirements phase and tool setup.

After login, players will choose a saved game or select whose memories to explore. Each [memory journey](docs/designs/004-memory-journey.md) begins with the earliest available photos, including babyhood when covered, and progresses through later represented years. Its chapters adapt to the library; the same shared avatar works for every subject. The [proposed stack](docs/adrs/002-web-game-stack.md), [photo connection design](docs/designs/003-photo-connections-and-people.md), and [asset pipeline](docs/designs/002-asset-pipeline.md) establish the technical foundation to validate with synthetic fixtures.

The preferred authoring workflow is image-generated sketches followed by Blender through MCP, for the shared avatar and world assets. Automatic person-specific character generation remains [conditional future backlog](docs/BACKLOG.md#bl-01-automatic-playable-character-generation) and would need a separate decision about its fit with this premise. Technical and nontechnical requirements are being documented first; tool setup and asset production follow that phase.

Start with the [project brief](docs/prds/001-project-brief.md), then the [documentation index](docs/README.md). Current work and the next step live in [`.agents/HANDOFF.md`](.agents/HANDOFF.md).

| Area | Location |
| --- | --- |
| Contributor and agent guide | [AGENTS.md](AGENTS.md) |
| Documentation process | [docs/PROCESS.md](docs/PROCESS.md) |
| Product requirements | [docs/prds/](docs/prds/) |
| Architecture decisions | [docs/adrs/](docs/adrs/) |
| Shared vocabulary | [docs/domain-driven-design/](docs/domain-driven-design/) |
| Gameplay and technical designs | [docs/designs/](docs/designs/) |
| Hosting and operations | [docs/ops/](docs/ops/) |
| Executable plans | [.agents/plans/](.agents/plans/) |

There is no runnable game or deployment in this initial documentation scaffold.
