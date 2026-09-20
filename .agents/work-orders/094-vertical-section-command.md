# WO094: Shared vertical section command

- **Status:** In progress — core integrated; review corrections in progress
- **Dispatch:** Explicitly authorized Opus 5 xhigh
- **Owned paths:** `src/shared/editor-project.ts`, NEW `src/shared/editor-sections.ts`, NEW targeted tests under `tests/game/` for section commands/controller traversal. Do not modify authored-level.ts, existing editor-project tests, CLI, UI, documentation, published level JSON, or runtime physics.

Read AGENTS.md, docs/PROCESS.md, PLAN013 and DESIGN019 Section builder contract. Implement that contract as an atomic shared `section.add` command. Root owns UI/copy/design. Ordinary pieces only; no special runtime generator. Retain input immutability, deterministic IDs/revision handling, command schema JSON publication and batch rollback. Generated IDs should be `${idPrefix}-step-1` etc and `${idPrefix}-checkpoint-1` etc so root can select the first created piece. Forward edges start->steps->end, branch registered, checkpoints each step with platform activation. Use existing validators and reject NEW semantic issues atomically; do not let builder mark unsafe sections successful. Keep errors concise and repair-oriented. Preserve existing pieces/anchors/mainPath and never mutate shipped JSON.

At minimum support both chapters from their welcome platform to picnic or woodland/ribbon rest with sensible step counts. Use the earlier audit/probe at `/tmp/quest-vertical-probe/` as evidence, not trusted production code. Prove representative arch and zigzag variants, both left/right orientations including a rotated/translated course, endpoint height differences, minimum and maximum step counts, malformed bounds, conflicts, preexisting semantic issues, rollback, budgets and full real-controller traversal for infant/child, including ascent/descent and checkpoint recovery. Avoid implementation-mirroring test inflation. Run targeted tests and typecheck/lint where owned implementation permits.

Work in your own task worktree. Commit owned files only, no PR/merge. Report the commit, tests, exact valid sample commands and any limitations to `/home/dev/work/quest-vertical-authoring/.private/section-command-result.md`. Finish your active task rather than claiming a background watcher will resume after exit. Coordinator integrates, reviews and releases.


## Review corrections and taller sections

Core `508e065` is integrated as `119afbd`. Native Sol `vertical_runtime_audit` owns the final planner correction in the coordinator worktree: increase descent landing count when needed for long spans with differing endpoint heights; handle blockers locally along the lane rather than pushing both endpoints because of a distant wide deck. Enforce actual traversal on the reported welcome-to-rest cases. The final contract raises maximum climbing steps from six to twelve, default four unchanged, to support a representative peak of at least three units. Existing object/route/checkpoint budgets and jump physics remain unchanged. Root owns UI/docs; regression tests from WO093/surface review are integrated separately.
