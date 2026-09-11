# Haynes Quest

Haynes Quest is a private browser game about recovering chronological memories. The playable MVP uses fictional photos: start as a mysterious infant, collect three memories, visibly grow, unlock jumping and reach the end of a compact clearing. Progress saves on the server and can be resumed.

Open the [private game](https://haynes-quest.haynesops.com) or [asset review catalog](https://haynes-quest.haynesops.com/studio/assets/catalog.html) from the home network. The game supports keyboard/mouse and simultaneous touch controls. The [private-preview runbook](docs/ops/002-private-preview.md) covers local startup, controls and the deployment boundary; the [verification record](docs/ops/004-overnight-verification.md) states what was actually tested.

The catalog presents original source concepts, nine candidate models, traveler animations and four sound auditions with exact versions and provenance. Gameplay uses temporary geometry and remains silent until Tom approves final assets. Visual selection by the coordinator is separate from owner approval; audio listening and physical iPhone/iPad Safari checks remain pending.

The planned family experience uses Authentik sign-in and a privately configured Immich photo library. The server adapter and versioned age/appearance contracts are implemented, but OAuth and admitted-player access are deferred. The current fixture deployment contains only fictional subjects and cannot access real photos. Person-specific likeness, broader combat, era enemies and the full story remain later work.

Start with the [project brief](docs/prds/001-project-brief.md) and [documentation index](docs/README.md). The current release, remaining work and durable checkpoints live in [`.agents/HANDOFF.md`](.agents/HANDOFF.md).

| Area | Location |
| --- | --- |
| Contributor and agent guide | [AGENTS.md](AGENTS.md) |
| Team and authoring ownership | [.agents/TEAM.md](.agents/TEAM.md) |
| Documentation process | [docs/PROCESS.md](docs/PROCESS.md) |
| Product and gameplay | [Project brief](docs/prds/001-project-brief.md), [development loop](docs/designs/007-poc-development-loop.md) |
| Architecture and contracts | [Proposed stack](docs/adrs/002-web-game-stack.md), [MVP contracts](docs/designs/009-overnight-contracts.md) |
| Asset review | [Catalog](docs/assets/catalog.md), [art direction](docs/assets/art-direction.md) |
| Hosting and verification | [Private-preview runbook](docs/ops/002-private-preview.md), [live evidence](docs/ops/004-overnight-verification.md) |
| Executable plans | [.agents/plans/](.agents/plans/) |
