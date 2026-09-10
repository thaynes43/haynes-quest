# Haynes Quest

[GitHub repository](https://github.com/thaynes43/haynes-quest)

A Roblox-style 3D browser game for the Haynes kids, with real photos from Immich as the things players collect. The game will support touchscreen play with on-screen controls and keyboard/mouse play, with gamepad support a later option. Players will sign in through Authentik, as they do on Haynes Network.

This repository starts with the project brief and documentation templates. The proposed runtime stack will be validated before expanding the gameplay design. Deployment will live in `haynes-ops` on the local cluster.

After login, players will choose a saved game or start a new adventure as **Jackson** or **Penelope**. The [proposed stack](docs/adrs/002-web-game-stack.md) and [asset pipeline](docs/designs/002-asset-pipeline.md) establish the next technical step, using placeholders before producing the final character models.

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
