# Haynes Quest

Haynes Quest is a private browser adventure through the periods of a person's life. Explore for useful equipment, face that era's enemies and boss, then reclaim and absorb memories to grow into the next age and period. Earlier gear and abilities stay with the traveler.

The corrected implementation is under review in [PLAN-005](.agents/plans/005-era-combat-loop.md). Its fictional fixture covers 2020 at age zero and 2024 at age four, ending at age seven. The server owns equipment, health, encounter outcomes, released/consumed memories and age progression. Earlier prototype saves remain readable as preserved albums.

The [private game](https://haynes-quest.haynesops.com) and [asset review catalog](https://haynes-quest.haynesops.com/studio/assets/catalog.html) are reachable from the home network. Check the [handoff](.agents/HANDOFF.md) for the deployed commit: the earlier live memory-walking prototype is distinct from the corrected local review. No private release of the new candidate artwork is implied by a code merge.

The catalog retains source concepts, nine prepared model candidates, traveler animations and four sound auditions with exact versions and provenance. Local review uses the authored travelers and environment; the new enemy/equipment studies still need their finished authoring pass. Owner approval of candidate gameplay use, audio listening and physical iPhone/iPad Safari checks remain pending.

The current fixture supplies fictional illustrations and cannot access real photos. Authentik admission and actual Immich player integration remain deferred; the isolated server adapter does not make photos available to the demo. Automatic personal likeness and the full historical campaign remain additional work.

Start with the [project brief](docs/prds/001-project-brief.md) and [documentation index](docs/README.md). The current release, remaining work and durable checkpoints live in [`.agents/HANDOFF.md`](.agents/HANDOFF.md).

| Area | Location |
| --- | --- |
| Contributor and agent guide | [AGENTS.md](AGENTS.md) |
| Team and authoring ownership | [.agents/TEAM.md](.agents/TEAM.md) |
| Documentation process | [docs/PROCESS.md](docs/PROCESS.md) |
| Product and gameplay | [Project brief](docs/prds/001-project-brief.md), [development loop](docs/designs/007-poc-development-loop.md) |
| Architecture and contracts | [Proposed stack](docs/adrs/002-web-game-stack.md), [Combat and growth contracts](docs/designs/010-era-combat-loop.md) |
| Asset review | [Catalog](docs/assets/catalog.md), [art direction](docs/assets/art-direction.md) |
| Hosting and verification | [Private-preview runbook](docs/ops/002-private-preview.md), [live evidence](docs/ops/004-overnight-verification.md) |
| Executable plans | [.agents/plans/](.agents/plans/) |
