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
- Final current client `index-BwiNr1P8.js`, SHA256 `4af858bac3036191081deed6f01f743fa281fef922367fd2d11b516fcc4f3f8f`. WO055 is testing final-bundle friendly, wand/dragon, Besties and Web Audio behavior through actual touch controls. Root awaits its results and screenshots.
- Catalog source has 36 entries: 26 GLBs (25 complete, one partial), five reference entries, one model-less concept, four audio entries. Fifty-three thumbnail derivatives total 992266 bytes. `playtest/v002/artwork.json` records 23 runtime GLBs/four cues; v001 remains historical. Final catalog source/hash/link/browser checks are required after the authoring handoff.

## Required remaining release work

Finish the authoring lease and final review links; integrate final browser findings/captures into the guide; run full source/docs/asset checks and the authorized Fable WO056 review. Open/check/squash-merge the app PR, verify main image publication/signing and exact registry digest. Only then pin `playtest-helmrelease.yaml` in `/home/dev/work/quest-plan006-release`, pass/review all operations checks and the rendered diff, declare scoped activity, squash-merge/reconcile, and verify live game/catalog against the exact image. The normal demo and dev-env must keep their existing UIDs/restarts; no OAuth or real-photo access is part of this work. End activity and owned fixtures promptly, then update HANDOFF and PLAN006 with final outcomes.
