# Current handoff

**September 19: repairing portrait input and first-chapter completion feedback.** [WO085](work-orders/085-portrait-and-completion-repair.md) owns the current work in `/home/dev/work/quest-playtest-blockers-20260919`, branch `agent/quest-playtest-blockers-20260919`, base `191f8c2`. [PLAN011](plans/011-familiar-controls-and-checkpoints.md) remains active through this physical-playtest repair and fresh hosted verification. Root Astra owns UX, integration and release; fresh native Sol agents own bounded input, progression and browser regressions. No new asset authoring is running.

Tom reports that the portrait joystick stayed upper-left until closing/reopening, and the final first-chapter memory could not be collected after dragon victory. The input lane reproduced a release outside the control leaving its contact latched. The memory path exposes the major after victory but silently excludes it from contact collection while a minor remains missing; the repair preserves both-minor progression and adds peripheral guidance. Fully eligible raised-platform traversal, missing-memory recovery and both chapter transitions are under verification. These findings are not yet a claim that Tom's exact phone sequence is reproduced or the repair is deployed.

## Verified deployment baseline

The prior handoff incorrectly still described PR44 as unmerged. GitHub confirms [application PR44](https://github.com/thaynes43/haynes-quest/pull/44) merged September 13 as `191f8c2420aa00e98caf026af334987aee98e593`; [operations PR2898](https://github.com/thaynes43/haynes-ops/pull/2898) merged as `96c09bc0ba6c800858025593c606ae19f1edac05`. September 19 live inspection confirms `frontend/haynes-quest-playtest` Ready with:

`ghcr.io/thaynes43/haynes-quest:sha-191f8c2420aa00e98caf026af334987aee98e593@sha256:21d4e4052609299734c10aa984feb2d1d8ed650e007b9479a768fbbdf4e059c5`

That release has dedicated Jump, larger responsive sticks, automatic memory-based HP checkpoints, Besties damage in every active phase, v2 bosses without an ordinary-enemy prerequisite, raised practice routes and the persisted-v2-gate correction. [WO082](work-orders/082-familiar-controls.md) retains its implementation and pre-release evidence; its historical pending-release language is superseded by the verified baseline above. Earlier complete PLAN009 evidence remains in [WO081](work-orders/081-plan009-hosted-release.md) and [its index](evidence/plan009-hosted-release.json).

- [Private playtest](https://haynes-quest-playtest.haynesops.com/): start at chapter one or use the Besties shortcut. Every test starts fresh; leaving/reloading resets it.
- [Playtest guide](https://haynes-quest-playtest.haynesops.com/studio/assets/playtest.html): controls, recovery and fictional scope.
- [Visual catalog](https://haynes-quest-playtest.haynesops.com/studio/assets/catalog.html): 37 entries and 54 navigation thumbnails, with versions, previews and approval status.

Browser automation uses software-rendered Chromium emulation. It is not physical iPhone/iPad Safari acceptance or a phone frame-time measurement. New evidence must identify its exact client build and failures honestly.

## Current resources and release

Root owns the baseline ephemeral fixture on port4410, isolated from the deployed game and copied under ignored `test-results/baseline-191f8c2/`. The candidate fixture runs on port4411; after interruption both fixtures are owned by tmux session `quest-blockers-fixtures`. Browser work runs serially. Release worktree: `/home/dev/work/quest-blockers-release-20260919`, branch `agent/quest-blockers-release-20260919` in haynes-ops. Only the private playtest image will change; normal Quest and dev-env stay protected. No scoped rollout activity is active yet. Do not claim fixes live until checked app publication, GitOps merge and hosted verification finish.

## Next content and personal stage

Tom wants these playtest blockers closed before expanding the game with Blender models. [PLAN010](plans/010-parent-prepared-memories.md) and [WO080](work-orders/080-identity-curation-readiness.md) retain the required private identity/parent-curation stage: Authentik admission, owner separate from subject, birthday, authorized integrated photos and uploads, and frozen authored journeys. Current pictures and chronology remain fictional. Wider level-editor/lifetime scope stays in DESIGN016 and the backlog.

No new models, audio or concepts have been generated in this repair. Existing assets remain 23 GLBs, four source WAVs and six fictional pictures. The joint Besties look is approved; exact final model/audio acceptance still requires Tom's review. Discuss the next encounter concept before expensive production and keep its versioned review/catalog/thumbnail updates in the same asset PR. Root Astra owns concept generation and art direction; every Blender task uses a fresh native Astra max agent under [TEAM.md](TEAM.md), with exclusive scene ownership.

Preserve the Besties master `/workspace/haynes-quest/bickering-besties/v001/live-scene-release.blend` (SHA256 `927ee5a27a13707798ed0e1a98060f9eeda999de6fe485cf4bda410055a74e2f`) and Nap partial master `/workspace/haynes-quest/parody/remix-trio/v001/live-scene-release.blend` (SHA256 `9a84bd4c72e70292512bd605f4da44f6fcccdca290816d230aa0bc053c972afe`). Preserve Diva's concept and keepsake rear-wedge work. No Blender scene or audio generation is owned by this task. Do not restart dev-env.
