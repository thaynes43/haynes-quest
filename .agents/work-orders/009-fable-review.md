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


## Lead intake — 2026-09-11

Fable completed exact-commit review as `0b9ac10`, integrated as `c760e31`; [full findings](009-fable-review-results.md). Actual model verified from the session record. No authorization bypass was found under the listed probes. Follow-up resolutions:

- **F1:** reproduced unsupported grounded state after leaving the step; controller now falls and the regression checks landing plus blocked re-entry.
- **F2:** Sol browser lane independently corrected CDP jump-contact release and steering (`35bdd13`). Full keyboard/touch/cleanup checks passed; prior failed script evidence is preserved, not presented as passing.
- **F3:** production dependency stage replaces copied development dependencies; browser source maps disabled. Container CI verifies packaging.
- **F4:** accepted development-preview boundary explicitly documented: both environment flags, internal Traefik and only the application Secret. Default production image refuses fixture sessions. No fake OAuth or real-photo access.
- **F5:** scan the entire bounded eight-page/800-image window before sampling 96 candidates; regression uses a 500-photo history and retains earliest/latest dates. Libraries beyond the scan remain honestly incomplete and date-range refinable. No unbounded scan added.
- **F6:** exact setup/expired-preview/no-photo error codes mapped by lead; cleared numeric limit remains editable and required.
- **F7:** map cap/expiry already fixed in `7a6713b`; session issuance/expiry maintenance is the next bounded follow-up before merge.
- **F8:** DESIGN-009 corrected to describe the existing MkDocs product: candidates plus public-safe project documentation. No private runtime records are in its input.
- **F9:** media permission checks no longer conflate a source date correction with revocation; frozen age/date remain unchanged. UTC date extraction is the explicit provisional adapter policy; source-local timezone/age anchors are a real-person activation check tomorrow.
- **F10:** privacy-safe unexpected-error diagnostics are included in the server follow-up; no raw error message/stack/request data should be logged.
- **F11:** candidate modeling/review production continues under WO-007/010. All final catalog entries will include matching concept/model views, provenance and exact checksums; no candidate is approved.

I1: finite preview thumbnails intentionally show before recovery, allowing players to choose a manifest; future private activation can cache sanitized media within its authorization lifetime. I2: browser tests are recorded manual runs; CI's source/DB/container checks are labeled separately. I3: direct binaries work in temporary review trees with linked dependencies; normal development uses its own pinned pnpm install. I4: concrete Sharp sanitizer/private factory added in `7a6713b`; live isolated schema/thumbnail smoke validates transport only. Full admitted-player source flow still waits for OAuth.

Review process recovery: the separate reviewer used a broad harness-name `pkill`, which also stopped the lead's temporary loopback harness. No application or cluster workload was affected. Future reviewers must retain their own server PID and stop only that process; shared-pod process-name termination is inappropriate.
