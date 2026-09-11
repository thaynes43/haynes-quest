# WO-015: Independent review of the corrected era loop

- Model: separate Claude Code Fable 5.1, `claude-fable-5-1`, `xhigh`, explicitly authorized by TEAM.md.
- Review target: root commit `faa8bab` on `agent/quest-era-boss-loop` in `thaynes43/haynes-quest`.
- Status: Ready for dispatch. This is a read-only technical review; root retains final architecture, UX/copy and art judgment.

Create/use the launcher's own task worktree. Fetch the review branch and inspect exact commit `faa8bab` there (detached checkout is fine in the new clean review worktree). Read AGENTS.md, TEAM.md, PLAN-005, DESIGN-010, WO-013 and the root handoff. Do not edit the canonical clone or root worktree. Do not do any Blender work, image generation, auth configuration, cluster mutations or deployment. Do not inspect secrets or use live game data; test records must be fictional.

Review the server/action/state boundary, legacy migration preservation, idempotency and concurrency, photo release/authorization, client action reconciliation, combat pause/retry, input lifecycle, media failures and scene resource cleanup. Try to find concrete failures in the intended sequence: equipment → ordinary encounters → boss → released pictures → consumption → age/appearance/retained abilities → next period. Boss defeat and individual revelation must not age the traveler. The first fixture period is 2020 at age zero, followed by 2024 at age four, ending at seven. Local collision reporting is explicitly not server-authoritative physics.

Existing visual candidates are used only in the isolated local review. New encounter/equipment studies are temporary; fresh Astra Blender dispatch failed at the native task limit. Owner demo-use approval is pending; OAuth and real Immich player integration remain deferred. These known gaps must stay honest, but merely repeating them is not a new code finding.

The root's latest source passed typecheck/lint/build and 65 non-Postgres tests. The server lane's isolated PostgreSQL 16.14 Job passed eight integration tests, including migration preservation, action races, receipt pruning and malformed-state rejection; the Job was deleted. Browser smoke rendered the actual catalog traveler/environment with zero page errors. Complete browser journeys are in progress; do not assume they pass.

Return prioritized actionable findings with exact file/line, trigger, observable consequence and a minimal fix. Separate demonstrated defects from concerns requiring reproduction. Do not silently modify code or rubber-stamp incomplete checks. Write the bounded report to `.agents/work-orders/015-era-adversarial-results.md` in your own task worktree, commit it on your own `agent/` branch, and put the branch/commit and remaining findings in your final output. Root will integrate fixes and carry checked PRs through merge. Do not open or merge a competing implementation PR.
