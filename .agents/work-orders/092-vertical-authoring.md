# WO092: Optional platforms and reusable vertical sections

- **Status:** In progress
- **Model / dispatch:** Native Sol Ultra for validator/runtime audit and correction; explicitly authorized Opus 5 xhigh for bounded command implementation/review; Astra for UX/contracts/final review.
- **Worktree:** `/home/dev/work/quest-vertical-authoring`, branch `agent/quest-vertical-authoring`, base `08308e0810a002fe77880dccd3a3acec7c7eb2e5`.
- **Required reading:** AGENTS.md, docs/PROCESS.md, PLAN013, PRD002 R-11/R-12, DESIGN019 optional geometry section.

## Objective

Tom could not playtest a manually raised platform because it was not listed in a route. Remove that v2 bookkeeping obstacle and make nonflat course assembly useful to both people and inexpensive agents. This is ordinary code/tooling, with no new assets or owner-art review dependency.

## Ownership

Native `vertical_runtime_audit` owns the minimal v2 validator correction and targeted regression tests in the coordinator worktree. A separate read-only Opus tooling audit runs as `haynes-quest-0919-233628`. Astra owns UI copy/layout, guide, design/plan and final integration. Additional implementation and verification assignments will record their owned paths here before dispatch.

## Acceptance

- A screenshot-equivalent floating static platform and an extra moving platform can resolve into a valid v2 preview without modifying routes.
- Required progression anchors, explicit connection safety, structural limits and v1 semantics remain enforced.
- A deterministic atomic building command shared by UI/CLI creates an elevated section with connections; ordinary pieces remain individually editable and undo restores the whole operation.
- Broad generated jumps stay within existing mechanics. Real-controller and browser checks establish ascent, support and recovery rather than only a valid graph.
- Bounded agent inspection exposes enough spatial information to choose and assess a section, with a reproducible example.
- Required checks, independent review, green PR/merge, private GitOps deployment and exact hosted verification precede completion.

## Evidence

The optional-platform correction is committed in `baa9617`; 50 targeted tests, typecheck and lint pass. Chromium baseline `test-results/vertical-authoring/optional-baseline/report.json` proves a visibly added platform at center `(24,3,-10)` resolves into normal preview collisions with unchanged route arrays and zero issues, and survives return/reload. Strict docs build populated the local static asset site; final rerun reports no HTTP/page/console errors. Source/UI/core integration and final candidate verification remain in progress.

WO093 owns spatial CLI inspection; WO094 owns shared section construction and controller tests. Root owns SectionBuilder UI and top-surface/snap improvements. Separate read-only release preparation is saved at `/home/dev/work/haynes-ops-0919-234521/.private/quest-vertical-release-prep/`; capture a fresh protected baseline at release time. No gameplay artwork, family media, normal Quest deployment or dev-env restart is authorized by this work order.


## Active implementation checkpoints

- Core generator: Opus task `haynes-quest-0919-234803`, own worktree `/home/dev/work/haynes-quest-0919-234803`, WO094. Return commit/results at coordinator `.private/section-command-result.md`; cherry-pick only owned shared-command/module/new-tests files after review.
- Spatial inspection: Opus task `haynes-quest-0919-234305`, commit `9122205`, integrated as `9d71295`; machine-contract report at coordinator `.private/spatial-inspection-result.md`. Full suite there passed 668 tests with 12 Postgres cases skipped; final integrated checks remain required.
- Surface review: read-only Opus task `haynes-quest-0919-235529`, report expected at coordinator `.private/surface-review.md`. This review excludes the still-pending generator; separately review that implementation before release.
- Browser lane: native Sol `vertical_runtime_audit` owns `tests/e2e/vertical-authoring.mjs`; baseline is green and full builder/phone/tablet cases are written but await integrated candidate. Local fixture tmux `quest-vertical-candidate` serves port4430 from coordinator `dist/`; rebuild/restart it after core integration. Strict docs assets are in coordinator `site/`.
- Root owns UI/docs and final review. No new app/ops PR or private deployment has happened yet. Retain audit worktree `haynes-quest-0919-233628` while its `/tmp/quest-vertical-probe/` scripts are used; their imports refer there. Reap owned separate tasks after archival and completed release.
