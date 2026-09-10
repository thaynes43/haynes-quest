# Haynes Quest

[GitHub repository](https://github.com/thaynes43/haynes-quest)

A Roblox-style 3D browser game for a family proof of concept, personalized from a self-hosted photo library with Immich as the first integration. Users configure their photo-service URL, API key, and people's names. The player starts as a generic, mysterious avatar at memory age zero, with no memories and baby abilities. Recovering the selected person's photos advances the avatar's memory age, unlocks abilities that carry into later periods, and brings encounters with original enemies and bosses inspired by each era's pop culture. Touchscreen and keyboard/mouse play are required, with gamepad support a later option. Players will sign in through Authentik, as they do on Haynes Network.

The game will run as a normal web app on **iPad, iPhone, and PC**, hosted on the homelab through `haynes-ops`. Players open its HTTPS URL; no native iOS app or TestFlight installation is needed. This repository currently contains the requirements and documentation templates. A small playable prototype will validate the proposed runtime stack.

After login, players will choose a saved game or select whose memories to explore. Each [memory journey](docs/designs/004-memory-journey.md) begins with the earliest available photos, including babyhood when covered, and progresses through later represented years. Its chapters adapt to the library, using decade-like or proportional periods. [Memory-age progression](docs/designs/006-memory-age-and-abilities.md) grows the available movement, interaction, and puzzle abilities as memories are recovered. An authored [enemy and boss catalog](docs/designs/005-era-enemy-catalog.md) lets a childhood in the 1990s feel different from one in a later era, while the same shared avatar works for every subject. The [proposed stack](docs/adrs/002-web-game-stack.md), [photo connection design](docs/designs/003-photo-connections-and-people.md), and [asset pipeline](docs/designs/002-asset-pipeline.md) establish the technical foundation to validate with synthetic fixtures.

The agreed visual workflow is image-generated sketches followed by Blender through MCP. Tom reviews final visual and audio assets before they enter gameplay. The [audio proposal](docs/designs/008-audio-pipeline.md) uses ElevenLabs for sound effects/ambience, FFmpeg for preparation, and Web Audio for browser playback; setup and an authoring trial are still ahead. Automatic person-specific character generation remains [conditional future backlog](docs/BACKLOG.md#bl-01-automatic-playable-character-generation).

The immediate focus is the [core development loop](docs/designs/007-poc-development-loop.md): one test level, three synthetic memories, a new ability that builds on the starting actions, and save/resume. Astra agents coordinate code, assets, audio, design, and verification. Placeholder geometry lets gameplay progress while tools and candidate assets are prepared. Detailed combat, other collectibles, and the full story are deferred until this loop can be evaluated.

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
