# WO-031 results: actual obby browser journey

- **Status:** Partial frozen-bundle audit; durable driver ready for coordinator integration and final-build rerun
- **Model / dispatch:** Native GPT-5.6 Sol, `xhigh`, fresh context
- **Worktree / branch / base:** `/home/dev/work/quest-obby-browser-journey`; `agent/quest-obby-browser-journey`; `c556175c5b305e65ad8c9b500e6827b6df57120d`
- **Driver commit:** `6e58d9417951cff15c93fc76a8a673ee55ec228f`
- **Owned paths:** `tests/e2e/journey.mjs`, new `tests/e2e/obby-helpers.mjs`, and this result record

## Delivered

The browser journey now recognizes both authored course routes and operates only through visible keyboard controls or real CDP touch events. It uses the existing public read-only game inspection to stop broad movements, identify the intended visible pickup or encounter, sample course geometry, and prove local-only behavior. It does not arrange server state, set private controller input, or set player positions.

The driver adds these checks for each full mode:

1. Open and close the help modal through that mode's controls. The complete course sample, moving platforms, hazards, and course clock must hold for 850 ms; resume must not apply the hidden wall time.
2. Collect each tool through visible controls with short feedback-guided movement. Combat approach requires the public nearby encounter ID to match the intended encounter before using guard, jump, or attack controls, avoiding false success against another foe.
3. Deliberately contact the first course's moving sweeper, then compare revision, age, HP, phase, completed levels, inventory, and every encounter's HP/defeated/available state before and after the local recovery. After the protection window, take a broad path around the moving bar without another recovery.
4. On the second course, deliberately walk off the first gap and apply the same authoritative-state comparison. Then use a natural forward-plus-jump chord, sample the flight, require a meaningful apex, land without recovery, and activate the next checkpoint.
5. Cross the later short gap, sample and jump the rotating runway hazard, board the moving ferry, prove the rider keeps a stable platform-relative offset while it moves, and jump to the boss landing.
6. Preserve the existing visible save/leave/resume, guard use, boss gates, media failure/retry, three fictional image reveals, and age 0→4→7 assertions.
7. Write the served bundle path, byte count, SHA-256, viewports/DPR, browser version, and collected course evidence to ignored `test-results/journey[-mode]-evidence.json` only after a complete pass.

The final driver defaults to keyboard 1024×768 DPR1 and touch 390×844 DPR1. Read-only save requests share the authenticated browser context, retry only transport failures and 429 responses, and have a 5 s request timeout. Per-mode execution has a 10 minute overall deadline; combined execution has a 20 minute deadline. SIGINT, SIGTERM, and the overall deadline close Chromium, with a 10 s hard-exit fallback. Stage markers make the last completed boundary visible.

## Frozen bundle evidence

The audited fixture was `http://127.0.0.1:4391`, serving `/assets/index-kSVHgsz1.js`, 990,712 bytes, SHA-256 `f41faf10ecfa3bae483bfd5076ccb91e0fb139384dd546478e8952bad757ced8`. Runtime browser was Chrome for Testing 153.0.8010.12 with Playwright 1.63.0 and SwiftShader.

No keyboard or touch run completed the whole journey on this frozen bundle, so this record makes no full-pass claim. Repeated actual keyboard runs did establish:

- The `gentle-intro-v1` route was live, and opening the visible help modal held course time, platform samples, and hazard samples before a bounded resume.
- The attack tool was collected through keyboard movement and the visible use action.
- Deliberate first-sweeper contact incremented only the local recovery counter, returned to `start`, started the protection window, and left authoritative revision, HP, equipment, victories, and encounter state deeply equal. `test-results/keyboard-era-1-hazard-recovery.png` records the recovered scene.
- A second attempt crossed around the sweeper at the broad platform edge without another recovery.
- Both first-era ordinary encounters and the first boss were defeated through keyboard guard/attack controls in runs that proceeded to the second era. The media failure/retry path completed and the first two fictional images were revealed before age advanced from 0 to 4.
- Deliberately walking off the first second-era gap performed a local recovery with the same authoritative-state equality. `test-results/keyboard-era-2-gap-recovery.png` records that scene.
- An actual held-W plus Space chord cleared the first gap, reached `first-clearing`, and activated that checkpoint without a recovery. The subsequent failure capture shows the avatar at that checkpoint before an old diagonal pickup approach was replaced.

Early failures were driver adaptations rather than production blocks: the previous blind diagonal met the first sweeper; generic combat proximity defeated ordinary-b while the script intended ordinary-a; a separated jump-then-forward pulse failed where the natural chord passed; and another diagonal line passed beside the guard pickup. The committed driver replaces these with broad, observable, short control steps rather than tighter frame windows.

The frozen audit did not reach the second short-gap proof, runway hazard proof, ferry carry, second boss, third image, age 4→7, or a touch journey. Several later attempts were stopped rather than extending nested bounds after marked browser operations took tens of wall-clock seconds. RAF throughput was not measured, so no rendering or infrastructure cause is claimed. A process-lineage audit after stopping found no live journey Node process or non-zombie Chromium child; recent owned Chromium entries had already become `STAT Z` under PID 1 and consumed no current CPU.

During this audit, the coordinator independently reproduced a zero-delta quick-tap input seam and a narrow checkpoint-trigger issue and prepared production fixes outside this branch. Neither fix is present in `index-kSVHgsz1.js`, and this partial record does not validate them. The coordinator also stated that this frozen bundle still used temporary procedural foes, so it is not final enemy/media acceptance.

## Verification

- `pnpm typecheck` — passed.
- `node --check tests/e2e/journey.mjs` — passed.
- `node --check tests/e2e/obby-helpers.mjs` — passed.
- `pnpm exec eslint tests/e2e/journey.mjs tests/e2e/obby-helpers.mjs` — passed with zero warnings.
- `pnpm exec prettier --check tests/e2e/journey.mjs tests/e2e/obby-helpers.mjs` — passed.
- `git diff --check` — passed.
- `QUEST_E2E_URL=http://127.0.0.1:4391 QUEST_E2E_MODE=keyboard QUEST_E2E_TIMEOUT_MS=1000 node tests/e2e/journey.mjs` — deliberately exited 124 with `overall timeout 1000ms exceeded; closing Chromium`; follow-up process inspection found no live journey or owned Playwright profile.
- `QUEST_E2E_URL=http://127.0.0.1:4391 QUEST_E2E_MODE=keyboard node tests/e2e/journey.mjs` — multiple bounded adaptation runs produced the partial evidence above; none completed, and interrupted over-budget runs are not passes.

## Remaining final-build proof

Run keyboard and touch modes separately on the coordinator's final combined bundle, preserving their generated evidence JSON and complete screenshots. Both must complete the two bosses, all three image reveals, age 0→4→7, deliberate recovery invariants, both gap crossings, runway hazard, ferry carry, boss landing, save/leave/resume, modal pause, and touch cancellation before WO-031 can be marked complete. The final record must replace this partial result with exact commands, bundle identity, frame/RAF observations, exit statuses, and any final-build limitations.

No production, scene, runtime, layout, UI, copy, art, Blender, image generation, infrastructure, server-save, push, or pull-request change is included.
