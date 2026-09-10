# Documentation

Read [PROCESS.md](PROCESS.md) for the workflow and the [project brief](prds/001-project-brief.md) for what Tom has established so far.

| Area | Purpose | Starting point |
| --- | --- | --- |
| Product | What players should experience and why | [PRD-001: Project brief](prds/001-project-brief.md), [template](prds/000-template.md) |
| Architecture decisions | Significant choices and their tradeoffs | [ADR template](adrs/000-template.md) |
| Vocabulary | Consistent terms for the game and its integrations | [DDD-001: Ubiquitous language](domain-driven-design/001-ubiquitous-language.md), [template](domain-driven-design/000-template.md) |
| Designs | Gameplay, interactions, integration contracts, and implementation detail | [Design template](designs/000-template.md) |
| Operations | Local development, release, hosting, and recovery | [Hosting context](ops/001-hosting-context.md), [runbook template](ops/000-template.md) |
| Plans | Executable work and evidence of completion | [Bootstrap plan](../.agents/plans/001-repository-bootstrap.md), [template](../.agents/plans/000-template.md) |
| References | Conventions borrowed from sibling repos | [Repository review](reference/repository-conventions.md) |

The resume point is [`.agents/HANDOFF.md`](../.agents/HANDOFF.md). Plans live only in `.agents/plans/`; sequences belong in designs. Add release automation when there is a versioned application to release.
