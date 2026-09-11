# WO-004: Overnight coordination

- **Status:** In progress
- **Lead:** native driving GPT-6 Astra, max
- **Worktree:** `/home/dev/work/haynes-quest-overnight-mvp`, `agent/haynes-quest-overnight-mvp`, base `1b18f48`
- **Authorization:** PLAN-004 through private runnable MVP and complete scoped candidate catalog; checked PRs self-merge; OAuth tomorrow; no dev-env restart.
- **Preflight:** fresh native Blender `get_scene_info` and audio `list_generations` both succeeded 2026-09-11. Startup files carry expected model/MCP rules. Prior PLAN-003 activation evidence remains valid.
- **Contracts:** `docs/designs/009-overnight-contracts.md` before implementation.
- **Ownership:** lead shared contracts/scaffold, client UI/copy, docs/catalog, integration; delegated server/game/ops work in independent worktrees. Image generation lead-only, serial. Blender scene currently unleased and unchanged from `QuestServiceFixture`; audio queue idle at kickoff.

## Checkpoints

1. Fetched origin/main and created task worktree; all required kickoff documents read. No runnable code existed.
2. Defined API, progression, appearance, fixture isolation, art and input contracts. Starting bounded work orders next.

## Recovery

Read HANDOFF, this work order, PLAN-004 and TEAM. Preserve all artifact versions. Never promote candidates without Tom's exact-version review. Update this record with active branches/agents, scene owner and pending generation IDs at every integrated milestone.
