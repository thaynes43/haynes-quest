# Documentation

Read [PROCESS.md](PROCESS.md) for the workflow and the [project brief](prds/001-project-brief.md) for what Tom has established so far.

| Area | Purpose | Starting point |
| --- | --- | --- |
| Product | What players should experience and why | [PRD-001: Project brief](prds/001-project-brief.md), [template](prds/000-template.md) |
| Backlog | Deferred gameplay/content and conditional work beyond the family PoC | [BL-01–BL-05](BACKLOG.md) |
| Engine and asset evidence | Creator reports, inspected source, and limits of the Astra examples | [Astra game workflows](reference/astra-game-workflows.md) |
| Architecture decisions | Significant choices and their tradeoffs | [ADR-001: Authentik sign-in](adrs/001-authentik-sign-in.md), [ADR-002: Proposed stack](adrs/002-web-game-stack.md), [template](adrs/000-template.md) |
| Vocabulary | Consistent terms for the game and its integrations | [DDD-001: Ubiquitous language](domain-driven-design/001-ubiquitous-language.md), [template](domain-driven-design/000-template.md) |
| Designs | Gameplay, interactions, integration contracts, and implementation detail | [Technical foundation](designs/001-technical-foundation.md), [Asset pipeline](designs/002-asset-pipeline.md), [Photo connections and people](designs/003-photo-connections-and-people.md), [Memory journey and life chapters](designs/004-memory-journey.md), [Era-based enemies and bosses](designs/005-era-enemy-catalog.md), [Memory age and abilities](designs/006-memory-age-and-abilities.md), [PoC development loop](designs/007-poc-development-loop.md), [Audio authoring and playback](designs/008-audio-pipeline.md), [template](designs/000-template.md) |
| Operations | Local development, release, hosting, and recovery | [Hosting context](ops/001-hosting-context.md), [runbook template](ops/000-template.md) |
| Plans | Executable work and evidence of completion | [Foundation prototype](../.agents/plans/002-foundation-prototype.md), [Authoring tool setup](../.agents/plans/003-authoring-tool-setup.md), [Completed bootstrap plan](../.agents/plans/completed/001-repository-bootstrap.md), [template](../.agents/plans/000-template.md) |
| Work orders and asset reviews | Bounded Astra tasks and exact-version owner review | [Work-order template](../.agents/work-orders/000-template.md), [Asset-review template](assets/000-review-template.md) |
| References | Conventions borrowed from sibling repos | [Repository review](reference/repository-conventions.md) |

The resume point is [`.agents/HANDOFF.md`](../.agents/HANDOFF.md). Plans live only in `.agents/plans/`; sequences belong in designs. Add release automation when there is a versioned application to release.
