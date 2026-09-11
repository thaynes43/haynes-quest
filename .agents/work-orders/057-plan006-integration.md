# WO057: PLAN006 integration and release record

Status: implementation complete locally; final focused browser checks, exact catalog publication and checked release remain in progress.

Worktree `/home/dev/work/quest-playtest-feedback`, branch `agent/quest-playtest-feedback`, base main `698c9c7`. Root owns integration, UI, review copy and release. Source checkpoints `7d51a44` (plan) and `9814691` (combat/audio/friendly foundations) precede the integrated candidate.

## Implemented behavior

The wand has 4.25m range and a visible beam; unsuccessful attack taps explain why. The dragon's arena-limited approach can now reach the saved boss landing. Action-pointer cancellation no longer cancels held joystick movement. Four existing WAV cues play after a gesture with bounded playback and saved mute/volume preferences.

Both chapters use more of the existing trees, flowers and grass. The six resident models have separate friendly scene objects, green heart markers and explicit healing/harm interactions. Deliberate harm requires a confirmation, costs up to two player health on first harm, suspends that friend's gift and can knock them out. Making amends restores the friend without removing memories, abilities or equipment. The server persists this in a nullable, validated sidecar and retains existing receipt/revision/owner/transaction semantics.

New compatible journeys use immutable parody catalog v3 and the Besties period; old v1/v2 identities remain unchanged. The two models share one boss and reward, alternate visible tricks and expose a five-second dizzy attack window after the high-five. Browser timing is separate from server-owned health and progression. Besties requires jumping; no-jump 2024 journeys retain the compatible remix fallback. Exact final model mapping is a discriminated single/duo resolver.

## Actual evidence so far

- Combat, audio, friendly persistence, impossible future-state validation, catalog compatibility, runtime integration and exact artifact checks have passed their focused tests. WO049/050/052/053/054 hold specific results. A dedicated local Postgres database is unavailable; disposable Postgres CI remains required.
- The first full Chromium touch journey passed both chapters, equipment, hazards, both bosses, decoded fictional pictures, age 0→4→7, saved resume and no page errors. Exact bundle and test details are in `docs/assets/media/playtest/v002/first-touch-evidence.json`. It used the preliminary Black high-five and preceded the final phone camera/HUD refinements; it does not claim final-art or physical-device acceptance.
- Final Pink SHA256 `0f7020f53ed257dd88e6a8cb9e8fb0011c70e84bf33bc2e55fb671473aea96ae`, 956924 bytes. Final Black `0819c67a17d38f340ace0ebdaff6bd316a800286af7f7a0da91273e898d80f05`, 928000 bytes. Authored source/rig/export/browser evidence is WO051; the pair approaches to 0.90m centre spacing so all surfaces clear during the intentional hand miss.
- Current client `index-CNYrbMX0.js`, 1027516 bytes, SHA256 `6ef2c5122471f86cf7c42d5f96bbdc293bd5c79fba9296fb772e26c311350aad`. WO055 is testing final-bundle friendly, wand/dragon, Besties and Web Audio behavior through actual touch controls. Root awaits its results and screenshots.
- Catalog source has 36 entries: 26 GLBs (25 complete, one partial), five reference entries, one model-less concept, four audio entries. Fifty-three thumbnail derivatives total 992266 bytes. `playtest/v002/artwork.json` records 23 runtime GLBs/four cues; v001 remains historical. Final catalog source/hash/link/browser checks are required after the authoring handoff.

## Required remaining release work

Finish the authoring lease and final review links; integrate final browser findings/captures into the guide; run full source/docs/asset checks and the authorized Fable WO056 review. Open/check/squash-merge the app PR, verify main image publication/signing and exact registry digest. Only then pin `playtest-helmrelease.yaml` in `/home/dev/work/quest-plan006-release`, pass/review all operations checks and the rendered diff, declare scoped activity, squash-merge/reconcile, and verify live game/catalog against the exact image. The normal demo and dev-env must keep their existing UIDs/restarts; no OAuth or real-photo access is part of this work. End activity and owned fixtures promptly, then update HANDOFF and PLAN006 with final outcomes.

## Focused verification follow-up

The full local suite passed 264 tests (10 dedicated PostgreSQL cases skipped) on checkpoint3ba5a0c. WO055 confirmed touch-friendly rewards/penalties/amends/reload, Web Audio gesture/output connections/preferences, and archived v2 wand damage with held joystick. Root reproduced one further retaliation defect with a failing combat test at landing z=-18.8: the arena permits the 2.25m strike but prevents the preferred 2.1m approach. Chasing now enters a full warning when already within strike range and unable to approach closer. The new regression must pass together with final browser retaliation verification before release.

WO051 authoring and all 68 file hashes are complete; scene/jobs/browser released. Sol’s read-only operations audit found no isolation or additive-schema blocker. It explicitly records that rolling back after v3 saves is not transparent to the old v2 application, although the nullable database migration itself is backward-compatible. Separate Fable5.1 xhigh review task `haynes-quest-0911-190446` is active against checkpoint3ba5a0c; actual assistant model verified.

The subsequent real browser trace also exposed a slow clamped approach after strafing to x≈0.8,z=-19: the boss converged on 2.100001m for seconds before warning. The final rule uses actual strike reach whenever the player is outside the enemy arena, with the full warning still required. It keeps the preferred closer stop for players inside the arena. Thirty-six focused combat/runtime tests pass, including the lateral landing case; WO055 is replaying the original held-stick interaction without a corrective centre step.

Strict MkDocs/link/media build passed after the final model handoff and actual game screenshots. WO058 verified all36cards, 53 thumbnail source/derivative hashes, 68 delivered Besties files, 726 local links and the exact23GLB/four-cue runtime manifest. Root resolved seven stale friendly-role phrases in the construction and individual review pages. Guide screenshots preserve their actual capture scope: friendly UI on the pre-boundary-fix build; Besties phone on the first boundary-fix build. Only ordinary enemy boundary behavior changed after those captures.

## Reviewed source candidate

Fable WO056 completed against checkpoint3ba5a0c; WO061 resolves its findings. Root and Sol corrected stale airborne conversations, touch-release audio unlock, Besties recovery warnings, visible actor spell targeting and versioned duo resolution. All source owners released their paths. The resulting client is `index-D3lvcZ1s.js`, 1028608 bytes, SHA256 `718cc412a27bb79d768238f6326f154a0cccb52da555a69ed3ec4ce31173cebe`. Final focused browser verification targets this build after the source checkpoint is committed.

WO055’s complete preceding baseline is preserved as `playtest/v002/focused-touch-baseline.json`; it includes real stationary dragon retaliation within 2.038 seconds after a held-stick wand attack. WO059 passed the full local catalog: 36 cards, 53 thumbnails, 27 review pages, 26 exact models and both Besties viewers with eight clips plus real high-five play/pause. Root inspected the gallery and game captures. No physical Safari, listening or final-art approval is implied.

## Final pre-release evidence

Application PR33 is open. Exact committed source5df49dc passed all three final touch scenarios, with zero page errors, failed responses or missing media. The report is `playtest/v002/focused-touch-final.json`; guide captures were refreshed from this run. Root inspected the Besties impact/health feedback and the dragon strike warning. The still does not establish the entire moving beam endpoint; the composed-world scene regression covers that geometry. Browser and fixture4396 are closed.

Final local checks: typecheck/lint/build/strict docs all pass; 284 tests pass, ten dedicated PostgreSQL tests skipped locally. Initial PR33 Application CI executed all294tests, with one failure in an outdated synthetic legacy fixture. Sol corrected that test to clear friendly_state when converting the row to legacy-v1, without changing production code or migration behavior. Final CI rerun is required before squash merge. Runtime client remains `index-D3lvcZ1s.js` / `718cc412a27bb79d768238f6326f154a0cccb52da555a69ed3ec4ce31173cebe`.
