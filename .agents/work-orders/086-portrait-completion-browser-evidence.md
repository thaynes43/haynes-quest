# WO086: Portrait controls and completion browser evidence

Status: Local and hosted browser acceptance completed September 19, 2026. Application source behavior was frozen at `09d6642`; the pre-release browser harness checkpoint is `6576a53`. Application PR46 merged to main as `032b996e2e9c99271bbf47fb49bee4ee947a7473`. The post-release driver correction and this record remain uncommitted for the [WO085](085-portrait-and-completion-repair.md) closeout.

## Exact local candidate

All passing reports below exercised Chromium `153.0.8010.12` against the same production build, first from the isolated candidate fixture on port 4411 and then from `https://haynes-quest-playtest.haynesops.com`:

```text
/assets/index-B6ZOcLIe.js
bytes: 1,193,022
SHA256: c1ebea0d164c81561b58495dc2a992149bcb9ff1ccc34d651408b3cf319de81c
```

The hosted image is application main `032b996e2e9c99271bbf47fb49bee4ee947a7473@sha256:a87013f9b806008dcd95caa2a487acc61c919374630bd49ccd4a62b8206f2dcc`, released by operations merge `be4912ee`. The application client did not change while the browser drivers were strengthened. All final reports have empty response-error, page-error and console-error arrays. Raw reports and captures remain in ignored `test-results/`; root owns the separate sanitized release index.

## Focused portrait input regression

`test-results/portrait-completion-regression/final-candidate-strengthened-20260919t2017z/report.json` passed from `20:22:46.417Z` through `20:23:15.599Z`.

- The harness forced `setPointerCapture` to throw, released Chromium's implicit capture, moved the owning joystick contact outside the control and ended it there. The held upper-left input `(-0.707107, 0.707107)` cleared to `(0, 0)`. A new contact then produced rightward input `0.926041` and also cleared on release, proving re-arm without remounting.
- The equivalent failed-capture Jump path was held before owner end, released to `jump=false`, and a later trusted press advanced the Jump sequence from 1 to 2.
- A simultaneous action contact and an unrelated cancellation left the owning movement input at `moveX=-0.576790`. The final strengthened assertions explicitly require `jump=false` after both the action release and the unrelated cancellation. Releasing the movement owner then returned both movement axes to zero.
- Same-orientation resize changed the joystick bounds from `171.59375 × 171.59375` at `(12, 644.40625)` to `158.390625 × 158.390625` at `(12, 657.609375)`. For the stationary owning contact, the new geometry predicted `(moveX=0.8120459623, moveY=0.1385585025)` and the browser reported `(0.8120458759, 0.1385584996)`. Moving that same contact to the new center produced exact neutral, moving it right produced `moveX=0.569923`, and owner release returned to neutral. This proves live remeasurement rather than accepting a stale pre-resize vector.
- Changing the viewport from portrait `390 × 844` to landscape `844 × 390` cleared a held rightward vector from `moveX=0.576790` to zero.

An independent reviewer initially identified two false-pass gaps: the multi-touch case did not explicitly assert that Jump released, and the resize case sampled too early to prove recalculation from the new bounds. Both assertions were corrected as described above. The reviewer re-inspected the final harness and reported no remaining focused finding.

This focused browser case covers capture failure, off-control owner termination, subsequent-contact re-arm, action release, pointer ownership with multiple contacts, same-orientation resize and orientation cleanup in automated Chromium touch emulation. The `blur`, hidden-visibility, `pagehide`, document `freeze`, raw-touch event ordering, `visualViewport` listener and canvas-camera cases are source/unit evidence recorded in [WO087](087-portrait-input-findings.md); they are not claimed from this focused browser run.

## Missed-memory recovery and both chapters

`test-results/authored-playtest/final-missed-minor-attempt-07/report.json` passed from `20:16:18.990Z` through `20:22:27.480Z`. The run began in chapter one because the missed-minor flag now rejects shortcut starts. It used browser controls for the playable route and did not mutate game state, save state or API responses.

The Garden route deliberately left `demo-memory-2022-01` behind, completed all five fights and defeated Drama Dragon. The released major memory remained visible while the HUD said, “1 little memory left. Follow the path back to find it, then return to the big memory.” Walking into the major at `(0, 0.3, -122.3)` left revision 22 unchanged: client eligibility suppressed the dispatch, request state stayed `idle`, no request error appeared and the network log contained no `recover-memory` POST for the ineligible major.

The player then followed six real-control edges back from `garden-reward` through `dragon-clearing`, both ferry endpoints and the two little stepping platforms to `memory-grove`. Collecting the missing minor reached revision 24. The same six edges were traversed forward, including the live ferry, and walking across the raised boss terrace accepted the major at revision 25 and advanced into chapter two. The report's final guard requires the missed-minor object, both nonempty traversal directions and accepted chapter completion, so this result cannot silently pass through a shortcut route.

The same run completed `besties-playground-v2`, including five fights, actual boss damage and hit reactions, both Besties models visibly animated, the major at revision 54 and final completion. Both chapters exercised their declared safe-miss catch and return, moving ferry, hazards, branches and recovery behavior. No playable proof relied on direct runtime or save mutation.

The post-boss guidance remained on screen and clear of the mobile controls in every recorded layout:

| Viewport | Message bounds | Joystick bounds | Action bounds |
| --- | --- | --- | --- |
| `844 × 390` | `(199, 67) 219.4375 × 68.390625` | `(20, 234) 140 × 140` | `(644, 194) 180 × 180` |
| `390 × 844` | `(25, 187) 124 × 67.1875` | `(12, 644.40625) 171.59375 × 171.59375` | `(202.5, 606) 175.5 × 210` |
| `568 × 320` | `(187, 67) 147.671875 × 85.1875` | `(16, 164) 140 × 140` | `(372, 124) 180 × 180` |

Root visually inspected the portrait and compact-landscape captures retained in `test-results/authored-playtest/final-missed-minor-attempt-06/11-chapter-1-postboss-missing-minor-portrait.png` and `12-chapter-1-postboss-missing-minor-compact-landscape.png`. The message was legible, stayed beside or above the HUD and remained clear of the joystick and action controls. Root also inspected that attempt's chapter-one completion capture as a genuine transition to age four. Attempt 06 is retained as a failed whole-run artifact because its older Besties safe-miss driver entered an overlapping catch before takeoff; its bounded chapter-one evidence is not promoted to a whole-run pass.

## Independent chapter-two route

`test-results/authored-playtest/final-besties-shortcut-attempt-01/report.json` passed independently from `20:12:17.846Z` through `20:15:52.897Z`. Starting from the supported Besties shortcut, it completed all five fights, observed actual boss hit reactions and non-dizzy damage, animated both Besties, collected `demo-memory-2027-01` at revision 57 and completed the chapter. It also proved the intentional safe-miss landing and return with no recovery, plus automatic post-defeat recovery with progress preserved.

This independent run was completed before the longer combined attempt so the corrected safe-miss driver could not waste or contaminate the Garden proof. Earlier failed reports remain under unique attempt labels. Their failures were driver findings: an ordinary down-jump could land on a declared safe catch, a direct catch-to-start retry encountered the raised stair geometry, boss-death inspection could sample an unsupported transitional frame, and the original Besties miss approach overlapped its catch. The final driver responds to observed support and landing state, uses a declared side lane when needed, waits for a grounded support after recovery and takes off outside overlapping catch geometry while continuing to use real keyboard input.

## Hosted acceptance

The strengthened focused run passed on the deployed endpoint from `20:46:48.852Z` through `20:47:18.308Z`:

```text
test-results/portrait-completion-regression/final-hosted-strengthened-20260919t204626z/report.json
report SHA256: 25d0837c900f6f04fcffa8288018adeaa49729aa6a151d362f0f23e1f274be3c
```

It reproduced every focused local assertion against the exact hosted client: failed-capture off-control joystick termination and re-arm, failed-capture Jump termination and sequence 1→2 re-arm, movement ownership with `jump=false` after both another action's release and an unrelated cancellation, new-bounds resize recalculation with the same owning contact, and orientation cleanup. Response, page and console error arrays are empty.

The first hosted full attempt is preserved at `test-results/authored-playtest/final-hosted-missed-minor-20260919t204626z/report.json` with report SHA256 `ad3276b143c127af380803f09ff382e23903c1b8a6d26a905c617dd8f412a55d`. It is a failed missing-minor proof rather than a game failure. Minor two was still `released` before the boss, but the player began the fight at two health and needed an automatic combat retry. The driver's generic shortest route returned through `woodland-rest → padded-bridge → memory-grove`; its line across the grove incidentally entered the deferred memory's contact radius. The now-eligible major then accepted normal contact and genuinely advanced to Besties. The harness correctly rejected the run because phase `exploring` could not establish the required blocked-major state.

The driver correction reuses the already verified authored-plan edge slice whenever the recovery support and destination occur in forward plan order, retaining graph search only for off-plan or backward recovery. This sends a combat retry through the same woodland side branch that preserved the initial deliberate miss. A new assertion immediately after boss defeat requires phase `memory-released` and the deferred minor state `released`, before any movement toward the reward terrace.

The corrected hosted full journey passed from `20:54:00.113Z` through `21:01:34.615Z`:

```text
test-results/authored-playtest/final-hosted-missed-minor-attempt-02-20260919t205349z/report.json
report SHA256: 64ea943f048556779328049b2e010302ccf4175efbed7b6f022b2e7b29743678
```

The Garden boss again required a real combat retry, making the recovery-route repair observable rather than dormant. The post-boss guard passed with minor two still `released`. Contact with the visible major at revision 26 was client-gated: request state remained `idle`, no request error appeared and no ineligible recovery action was sent. Six actual-control edges led back through the ferry and stepping platforms; the missing minor reached revision 28. The same six edges returned to the raised terrace, where the major reached revision 29 and chapter completion was accepted. Besties then completed all five fights, actual boss hit reactions and non-dizzy damage, both animated models, automatic death recovery and the final major at revision 67. Both safe-miss cases and both chapters completed; all error arrays are empty.

An independent review found no behavioral problem in the recovery-route correction. It found one report-only detail after the passing run: spreading the plan edge and then assigning the loop's local `edgeIndex` replaced the plan edge's global diagnostic index. The final harness uses `index: edge.index ?? edgeIndex`; the accepted report's recovery indices are local, while its recorded endpoints remain authoritative. This metadata-only correction does not alter control input, routing or gameplay and did not require another full traversal. After it, `node --check`, scoped ESLint, all 15 authored-navigation tests and `git diff --check` pass.

## Evidence boundary

These local and hosted runs prove the exact built client's automated Chromium behavior and the complete playable route. They do not reproduce the original phone's exact Safari event ordering or claim physical-device performance. Source/unit coverage supplies lifecycle and canvas-camera cases outside the focused browser scope. Root owns the final release record and sanitized evidence index.
