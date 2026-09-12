# WO078: Daughter playground integration

Status: In progress, September 12, 2026. Lead Astra max in `/home/dev/work/quest-daughter-levels`, branch `agent/quest-daughter-levels`, base main `7a5bce0`. Scope is PLAN009 and DESIGN017: longer, varied and forgiving levels for Tom's six-year-old daughter, followed by the required identity and curated-photo stage.

## Integrated checkpoint

- `c4185c9` records Tom's iPhone/sound acceptance and PLAN009.
- `6e3627b` ratifies the shared authored document and gameplay sequence.
- `ca144a9` translates the Besties routine, targets and rendered hazards together; 17 focused simulation/visual checks pass.
- Native Sol progression lane `f9dcba1`, integrated as `bb2f338`, adds catalog v4 with four distinct ordinary encounter instances and a boss. Archived catalogs retain their three encounters and frozen routes.
- `20f57ed` supplies the two JSON course documents. Garden: 19 platforms, three sweepers, eight checkpoints and a friendly branch. Party: 20 platforms, two sweepers, eight checkpoints and a friendly branch. Both include a moving ferry.
- Native Sol browser lane `2ce618f`, integrated as `dbb3e7f`, adds actual-control graph navigation and its pure tests. Browser acceptance remains pending.
- Native Sol core lane `63d0def`, integrated as `86fa829`, adds strict schema, immutable resolution and safety validation; 11 focused checks pass.
- `f2bfe36` integrates the shared document through gameplay, retry, scenery and read-only inspection, and adds `pnpm exec tsx scripts/levels/validate.ts [document.json]` for human/agent authors. Both documents validate with no issues. Typecheck, lint, application build and strict docs build pass at this checkpoint.

Initial client is `index-mdg_2hoq.js`; this is a candidate, not a deployed release. Root owns the fresh synthetic fixture on port 4400. Native Sol `/root/level_test_audit` has the exclusive browser lease for the initial actual-touch route; reports go under `test-results/authored-playtest/plan009-local-initial`. `/root/level_progression_audit` owns per-edge real-physics tests in its separate worktree. `/root/level_contract_audit` owns new layout/runtime regression files in its separate worktree. No Blender scene or audio job is active.

## Subsequent integration checkpoint

Through `629c21e`, September 12, 2026:

- Physics lane integrated as `624478e`: all 39 declared main/branch edges pass actual `stepObby` with infant and child dimensions, including a 1.5m-wide takeoff band, ferry boarding/carry/disembark and actual fall recovery at every checkpoint. These are isolated edge tests, not an uninterrupted browser journey.
- Layout/runtime lane integrated as `e8e300d`: distinct repeated-kind slots, explicit memory roles, old route geometry, defensive inspection, route identity rebuild, visited-checkpoint retry and relocated Besties activation. `4f0a8f5` also makes the common course entry point resolve the new IDs rather than silently falling through to an old route.
- `2076e3b` verifies full-course foliage stays within budget, reaches the far end and clears encounter areas. The integrated suite at that checkpoint reports 430 passed, 10 dedicated Postgres cases skipped locally; typecheck/lint pass. Raw machine results: `test-results/plan009/unit-results-integrated.json`.
- `6567830` fixes a new authored-arena edge case: the wand could target Besties before their routine activated. A failing entrance regression is retained at `test-results/plan009/besties-entrance-before.json`; the corrected runtime activates within actual actor/tool reach, and the focused after report passes.
- Opus's in-progress probes exposed two friendly anchors within ordinary enemy strike distance after an enemy was lured across its arena. `98a699a` strengthens protected-anchor and overlapping-arena validation. `5b2a3cd` moves garden friendly-2 to `(-4.5, 0, -59.5)` and party friendly-3 to `(-5.3, 0, -85.6)`. Both documents validate with no issues. Real EnemySimulation regressions show unsafe control points receive hits and the new visits do not.
- `d8ff67e` prepares an optional real-defeat paused-artwork retry helper; it is not yet connected to the full driver or browser-verified. The lead owns that integration after the browser lane hands off.

The native browser lane is correcting navigation/report assumptions in its new driver, preserving every failed run. Short simulated CDP finger pulses were either delayed for seconds or coalesced within one software frame. The dedicated existing simultaneous-input diagnostic passed real stick/world-tap input on the initial bundle. The long driver now explicitly uses normal WASD/Space movement and real touch Attack/Bash. No game position, physics tuning, health or victory is fabricated. Do not call this an uninterrupted full-touch route.

The refreshed `index-BiCUA771.js` run completed every garden encounter including a real dragon attack, both minors, the branch/rejoin, actual ferry carry and the major transition to age four. Two final-edge/report bookkeeping assumptions prevented a successful overall report; `cd34316` and `629c21e` correct those. Full two-chapter success is still pending. Raw reports and failure captures remain under `test-results/authored-playtest/plan009-local-*`. Some runs require real combat retries at software-rendering cadence; these are not child difficulty or device performance measurements.

Opus review session `haynes-quest-0912-144456` remains active at `/home/dev/work/haynes-quest-0912-144456`; its JSONL confirms exact `claude-opus-5`. Report/probes are not yet final. Fable was not launched. Sol's next-stage source audit is recorded in WO080; no private-media or OAuth work occurred.

Operations preparation is read-only so far: `/home/dev/work/quest-playgrounds-release`, branch `agent/quest-playgrounds-release`, base `98ef332`. The unchanged prior verifier is copied under `.private/test-results/plan009-release/tools/release-verify.mjs`; `initial-baseline.json` is a sanitized live capture. No operations source edit, PR, declaration, rollout or restart has occurred. Recapture immediately before any later authorized private rollout.

## Remaining acceptance

Review and integrate the native tests; finish actual-control two-chapter, branch, ferry, recovery and combat journeys; retain Help/audio and paused-artwork checks; inspect phone captures and adjust the layout from evidence. Update the public-safe guide and catalog facts with actual captures. Obtain a bounded Opus 5 xhigh adversarial review during Fable's quota window. Carry checked application and image-only private operations PRs through merge and verify the exact hosted image/client and protected normal Quest/dev-env state.

Do not claim the daughter finds the levels fun from automation. The five-to-eight-minute target per chapter is a first-time tuning hypothesis. Identity and curated personal photos remain required for the daughter MVP after this level pass; synthetic dates are not her birthday or a personal chronology. No real-photo query, OAuth ceremony, new asset expense or dev-env restart is authorized by this level pass.

## Pre-release checkpoint

Through `cfaddf4`: the exact Opus review is preserved with lead adjudication in [WO079 results](079-plan009-adversarial-results.md). Its landing probe moved in the wrong direction, so the unfinishable claim is not adopted. Correct-direction physics demonstrates the real problem: a narrow late-edge takeoff window. The integrated gateway guard rejects that precision-dependent placement and retains both shipped courses. Native full suite: 442 passed, 10 Postgres cases skipped; root final checks are underway.

The browser driver now accepts the real major-memory finish trigger, supports an explicit chapter-two diagnostic, approaches inside actual Bash reach, and retries transient Playwright button-stability timeouts. Root integrated the one-failed-model / real-defeat paused-retry helper plus actual in-course captures and exact client hashing. Final candidate is `index-DOmWuEtB.js`, SHA256 `40c5715544d0993a2e782065f06be82c29c1b0124dacf6a0ab49136b0f1f29ea`. This remains local, not deployed. The prior browser failures remain recorded; full final journey and publication still gate completion.
