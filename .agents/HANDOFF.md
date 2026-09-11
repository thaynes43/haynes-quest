# Current handoff

- **Updated:** 2026-09-11 after Tom's enemy-parody and obby corrections
- **Stage:** PLAN-005 in progress. The original demo and the generic creature roster do not meet the intended game. Technical checks are not product acceptance.
- **Root:** `/home/dev/work/quest-era-boss-loop`, branch `agent/quest-era-asset-intake`, based on merged core `f6a8f0d`.
- **Team:** [TEAM](TEAM.md). Root Astra max owns architecture, UI/copy, art direction and serial image generation. Ordinary native Sol xhigh; all Blender tasks fresh native Astra max with exclusive lease. Separate Fable5.1 xhigh coding/review explicitly authorized.
- **Limits:** OAuth/admission deferred; no dev-env restart. No real photos in public files or fixture credentials. Exact visual/audio owner approval remains required for gameplay promotion.

## Latest owner rulings: read before work

1. Find useful equipment in each period level, fight its enemies and boss, then reveal and consume the released memory bundle. Only then advance the age bracket and enter its corresponding calendar period. A photo reveal cannot grow the avatar mid-level.
2. Enemies must be **recognizable, funny pop-culture parodies**, using photo capture metadata and the person's birthday to establish period and age. Tom cited the loose, recognizable references in Roblox and South Park; the intended game is for his kids. Root had incorrectly written a broad-inspiration-only rule. That restriction is removed from the brief and DESIGN-002/005. Generic wood creatures with vague cultural labels miss the vision.
3. **Roblox-style obby play is core**, mixed with goofy fights: hazards, movement timing and jumps, approachable for Tom's six-year-old daughter. [DESIGN-011](../docs/designs/011-forgiving-obby.md) specifies forgiving routes and recovery. Flat corridor combat is insufficient.

The six produced creatures are **not selected enemies**. Preserve Blockling, Signal Moth, Buffer Baron, Loop Dancer, Prism Mimic and Trendweaver only as possible ambient/friendly studies. That alternative role is not automatically approved or placed in the game. Root discarded its uncommitted enemy scene wiring and removed the enemy art registry mapping. Equipment and reusable loading/animation work remain useful. Do not regenerate, deploy or continue integrating the rejected cast as enemies.

## Current independent work

- Native Sol `parody_period_evidence`, WT `/home/dev/work/quest-parody-period-evidence`, WO-022: primary historical evidence for specific 2020/2024 cultural references, debut versus popularity and within-year eligibility. No art direction or final roster decisions delegated.
- Native Sol `photo_era_contract_audit`, WT `/home/dev/work/quest-photo-era-audit`, WO-023: actual birthday/photo-date/period contract and selection gaps, plus current controller/ability seams for an obby. Read-only findings; root makes architecture decisions.
- Native Sol `era_catalog_intake`, WT `/home/dev/work/quest-era-catalog-audit`, WO-020 resumed: full seven-page/ten-model catalog delivery audit against local root site, including thirty clips, exact manifests, internal master downloads and mobile orbit. Script prep `88239e7` is integrated as `99a4fe5`. Full audit passed; source0932355 integrated533f981. Sevenpages/tenmodels/thirtyclips/twotouchorbits/tenmasters verified. Durable report andsafe captures are in docs/assets/media/era-catalog-intake/v001. Six narrowlycheckedvideo metadata cancellations are expected, no unexpectederrors. Explicitly report studies as possible ambient/friendly candidates, not accepted enemies.
- No live Blender scene owner or running authoring jobs. All scoped model production is preserved below. Replacement enemy briefs must name recognizable references, visual jokes, encounter behaviors and verified historical windows before new modeling.

## Core code and published image

[PR26](https://github.com/thaynes43/haynes-quest/pull/26) squash-merged **f6a8f0de4a6b132ef5d4244a8bf5f1e37d56d531** at 14:27:55 UTC September11. Final PR head231b4f7 passed all99 tests including isolated PostgreSQL, strictdocs and container. Application run34609792353, docs34609792372. Main publication34610279261 succeeded with provenance/signing.

Published, **not deployed**:
`ghcr.io/thaynes43/haynes-quest:sha-f6a8f0de4a6b132ef5d4244a8bf5f1e37d56d531@sha256:be36615ae6e44a8e4e20ef3c4197aaec1772eafbba302a63d7f089bd1551b3d2`.

Core v2 has server-owned equipment, health, encounter/boss progression, bundle release/consumption and age transitions; idempotent revisioned actions; transactional PostgreSQL saves and preserved v1 legacy records. Spatial movement remains local, not anti-cheat. Fictional2020 birthday/photos0,4,7 demonstrate age0→4→7, two bosses. This finite fixture's generic roster is not a real historical-selection catalog. Date/age audit is now active.

Keyboard and real emulated-touch journeys completed both levels on **index-C3rM52AX.js**, showing allthree synthetic images. The media regression checked actual WebGL photo uploads and automatic/manual retries. [Verification](../docs/ops/005-era-combat-verification.md) preserves exact older evidence and limits. New equipment/client edits require a new actual-browser pass; obby and recognizable enemy acceptance remain outstanding.

## Asset intake branch

- Root checkpoints6c4917a/19fea76; gear registry, actual hand sockets/poses and explicit reward opening **eb4931d**. Root owns scene/UI changes. Three real-child-GLB tests caught dotted joint-name sanitization and verify attachments, replacement and pose restoration.
- 2020 studies **42debaa/feae9e1** from01ac98c/55c0d50; review pages765fdfa.
- 2024 studies **cc821f5/0ab5e6d/d160f20** fromfb5851d/0eeb260/a170a7a.
- Equipment **880d955/e1c2c13** fromd7ef884/fe09318.
- Transactional attachment recovery **d9e2774** fromSolfeaf7fe, WO021. Failed callbacks roll back clones without disposing cached source resources; retry is visible and reuses cachedGLTF.
- Fable WO019 **47db0e9/806b540/fc4791f** fromd31c4c3/aa6b664/206a13f: reusable EnemyAnimation helper and final cache-owned ImageBitmap closure. Separate sessionhaynes-quest-0911-103230 used verifiedFable5.1 and Opus5 review, finishedTASK-EXIT0, reaped. Log remainsPVC. Helper is deliberately not wired to rejected models. Root added a mixed-track regression: validation must inspect all tracks so a valid bone track cannot hide later root motion.
- Root latest changes remove enemy registry mapping, preserve all ten new models in sevenreview pages with corrected roles, fix model-viewer one-shot button/end/replay behavior, and record parody/obby requirements. These need checkpoint commit and checked PR after audit; no asset-intakePR exists yet.

Local combined application suite after integration: **125 passed,8 PostgreSQL skipped**. New10model tests verify embedded GLB resources, six study rigs/clipsets and four rigid tool exports. Strictdocs passed with all sevenpages; typecheck/lint/full client+server build passed; client bundle is `index-D5ZBrG7T.js`. Final CI must run PostgreSQL.

## Local review harness and commands

Root-owned tmux `main:quest-era-fixture`, pane89840:
`QUEST_E2E_PORT=4390 pnpm exec tsx tests/e2e/serve-fixture.ts`, log `/tmp/quest-era-fixture.log`, **127.0.0.1:4390**, in-memory. Serves **dist/client** and **site/**. It started with final core server; source server has not changed. Root may rebuild static client/docs without restarting this process. Preserve it for independent audits; do not restart dev-env.

Strictdocs:
`PATH=/home/dev/work/haynes-quest-overnight-mvp/.venv-docs/bin:$PATH pnpm docs:build`.
Application: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
Browser: `QUEST_E2E_URL=http://127.0.0.1:4390 node tests/e2e/journey.mjs` and`tests/e2e/media.mjs` after finalcandidatebuild. Catalog command is inWO020; resultsroot can be overridden. Avoid independent full-suite repetition without a change or concern.

Model-viewer one-shots require `repetitions:1`; a small playing-only RAF watcher finishes at duration because model-viewer4.3.1 sometimes does not emitfinished. `viewer.currentTime=viewer.duration` wraps tozero—do not use it for the held pose. Root actualBlockling smoke passed hold/replay; fullallclipaudit pending.

## Completed model packages

All leases released, all renders ended. Exact manifests and source evidence are preserved:

- [WO014](work-orders/014-blender-era-2020-evidence.md): Blockling14930tri/1121948B, Moth13520/1083900, Baron14840/1195688; sixmaterials/primitives and fiveclips each. Root inspected finalviews/motions.75artifacts hashed. Remote `/workspace/haynes-quest/era-2020/v001`; lease released14:38:57.
- [WO016](work-orders/016-blender-era-2024-evidence.md): Loop14848tri/1096328B, Prism14770/1079220, Trend14874/1089712; sixmaterials/primitives/fiveclips each. Root inspected correctedcapjoin, fox tailjoin, continuous spoolcoils and finalmotiongrids.60artifacts hashed. Remote `/workspace/haynes-quest/era-2024/v001`; lease released14:57:02.
- [WO017](work-orders/017-blender-era-equipment-evidence.md): Mallet3728tri/161872B, Acorn3624/184460, Wand2076/143444, Ribbon4128/197244;4–5materials/primitives, rigidprops. Root selected finalviews including shieldbacks.105namedparts survivedexportexactly;60runtime/artifacts+9sourcefileshashverified. Remote `/workspace/haynes-quest/era-equipment/v001`; lease released15:08:52. Finalrender37134exit0/reaped, quick32174gone.

All source `.blend` masters are onauthoringPVC and hashed, with local ignored verifiedcopies. Their exactversions are immutable; do not overwrite them with a new direction. No authoring process remains. NewBlender task requires freshAstra max and explicitexclusivelease; neverfactoryreset/unloadaddon.

## Private live and remaining boundary

[Private game](https://haynes-quest.haynesops.com) still serves the **old rejected memory-walking prototype**, with fictional SVGs, procedural graphics and no audio. [Studio](https://haynes-quest.haynesops.com/studio/assets/catalog.html) has the originalcatalog/wedgecorrection. Currentlive image:
`ghcr.io/thaynes43/haynes-quest:sha-3502ac7120f6d7741a1a209415f4c9eeb33f826b@sha256:743bca475c2e19d2534ecd3be7f952e52d0d5adb5724599f1285218f91e87e37`.

No PLAN005 code/assets deployed. The prior question about using currentvisuals predates the explicit enemy rejection; it cannot authorize the rejectedcast. Ordinary code/docsPR merges remain authorized and must be squashmerged aftergreenchecks. Deployment of candidate gameplay remains subject to applicableexactversionreview. No currentactivitydeclaration.

OriginalPLAN004 is historical: [completedplan](plans/completed/004-overnight-mvp.md), [verification](../docs/ops/004-overnight-verification.md). Original9models+4auditions retain exactmanifests/masters/reviews. Keepsakeconceptv002 fixesmissingrearwedge; itsv001modelalreadyhadit. No regeneration needed. Audio was decoded/measured but not listened; cues remainunmapped/silent.

Real photos have **not been pulled into the live game**. Fixture access refusesImmichcredentials. A separateboundedadapter exists, but OAuth/admissionandrealplayerjourney aredeferred. Familyphotos,names,IDs,birthdates,secrets stay out ofgit/staticart/prompts/logs. PhysicalSafari/selectedhardware and daughter'splaytestareunperformed.

## Next bounded work

1. ConsumeWO022/023 findings; ratify specific recognizable parody briefs and actualmetadata-driveneligibility. Implement the forgivingobby underDESIGN011 with realkeyboard/touchproof. Do not resume genericenemyproduction.
2. FinishWO020deliveryaudit and preserveallcompletedcandidates with correctroles. Commit/check/merge the reusable intake and directioncorrection. Recordfullcommands/evidencehonestly.
3. Prepare replacementenemyconceptsserially, then freshAstraBlenderownership asneeded. Rootchecksreference recognition, era, joke and combatbehavior beforeexpensiveproduction.
4. Complete actualgamevisual/obstacle/combat/photoconsumption/resumeverification. CarrycheckedPRstomerge. AuthorizedprivatepromotionrequiresGitOpscheckedopsPR,scopeactivity,exactimage/livechecksandactivityend; nodev-envbounce.

## Latest continuation

Direction checkpointca9c6ae is committed. WO022 basec9449e6/supplement2bb2135 integratedaafe3da/769b3d5. WO02341a0674 integratedcc9939e; rootexplicitlyrejectsitsimpliedownerage0hopruling and retainsage4jumpunderDESIGN011.

WO024 pureobstaclecore is nowrunning as separateFable task **haynes-quest-0911-112809**, WT ofthatname, logPVC. Launcher verified exactFable5.1/xhighcommand andliveprocess; outputmetadata modelstillneedscheck. Ownonlysrc/game/obby.ts,tests/game/obby.test.ts,resultrecord. Rootowns course/layout/scene integration.

NativeSol equipment_game_intake hasbounded currentbundleD5ZBrG7T keyboard/touch/media+actualhandposecaptures; noobbyacceptanceclaim. Rootharnessmustnotrebuilduntilthatauditfinishes.

Firstreplacementconcept **Mister Hiss v001**, explicitrecognizableCreeper/confettiparody, generatedandinspectedbyroot. Savedconcept/prompt/provenance/reviewpageunderstablemister-hisspaths. NoBlenderdispatchyet. Rootstillownsremainingrosterselectionandconcepts.
