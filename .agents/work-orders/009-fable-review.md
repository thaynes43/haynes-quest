# WO-009: Adversarial MVP review

- **Status:** Ready to dispatch
- **Model:** Separate Claude Code Fable 5.1 `claude-fable-5-1`, xhigh, explicitly authorized under TEAM.md
- **Review commit:** `ad4eedc` in haynes-quest; canonical base `1b18f48`
- **Lead worktree:** `/home/dev/work/haynes-quest-overnight-mvp`
- **Owned output:** your worktree `.agents/work-orders/009-fable-review-results.md`; findings and reproduction only, do not mutate implementation or merge

Read AGENTS.md, TEAM.md, PLAN-004 and DESIGN-009. Fetch/local-checkout review commit in your task worktree created by agent-run. Review the actual code, tests and Docker/CI contracts. Look for concrete counterexamples in ownership/CSRF/session isolation, immutable manifests, order/age/unlock recovery, missing/revoked/ambiguous/bounded Immich data, private-media authorization, browser pointer/keyboard cleanup, runtime storage/restart, static media delivery and claims of completeness. OAuth is explicitly deferred and fixture access is synthetic only, disabled by default and refused under NODE_ENV=production. This is authorized, not a finding by itself.

Current evidence: root source typecheck/lint/build and 32 non-DB tests pass, ops separately ran 2 real PG16 tests successfully. Initial local Chromium render of home/setup/game had no page errors. Full E2E journey test is being corrected to steer to the third memory after resume; its initial straight-line assumption passes beside the memory, so do not confuse that with unreachable map geometry. Root buffered brief action edges between frames and strengthened HUD contrast. No live app deployment yet. First-pass concepts exist; models/audio are in production. Pending Tom asset review and physical Safari are accurately unfinished; no candidates are in game.

Use native Opus subagents only if useful under Claude policy; all Blender is outside your scope and must return to Astra lead. No imagegen, no secrets, no real family data or external authoring. You can run npm/pnpm tests in your isolated worktree and use node_modules symlink to the lead worktree. Do not run destructive tests against a live application DB. Test databases must be dedicated.

Return ordered findings with severity, exact location, concrete reproduction, expected/actual behavior, and recommended bounded fixes. Record limitations and actual commands; do not rubber-stamp. Commit findings and return branch/commit. Write status checkpoint to your owned result file so root can poll independently. Do not send messages outside agent coordination.
