# PLAN008: Mobile reliability and the authored-level direction

Status: Complete, September 12, 2026. The diagnosed repair, checked private release and final hosted acceptance are complete; physical Safari/speaker inspection and future builder/content remain open. Lead: Astra max. Initial implementation: `/home/dev/work/quest-mobile-reliability`. Final source: `/home/dev/work/quest-plan008-records`; closing records: `/home/dev/work/quest-plan008-closeout`.

Tom's new physical iPhone playtest supersedes PLAN007's automated acceptance. He hears no sound, cannot activate Help's test sound, sees collected keepsakes remain, gets an unexpected popup when attacking nearby, and sees stationary Besties with distant hazards and no useful combat feedback. The screenshot already reports two collected minor memories: distinguish collection state from rendering. The persistent jump hint must go.

## Required outcome

1. Diagnose actual input/audio, memory, boss and rendering paths. Correct the failures before expanding content. Verify Help controls on a scrolled phone modal, contact-only collection, removal of collected objects, separate attack input, visible boss motion/hits and attacks that threaten the playable arena.
2. Remove the permanent jump hint. Retain touch/Space jumping, independent movement/attack contacts and discoverable Help. Lead owns all UX/copy decisions.
3. Add meaningful regressions for the causes found and test complete encounters through visible controls, with rendered positions, contact interactions, real input events and damage feedback. Investigate Safari using available tooling; record any physical-device or browser limitation. An analyser signal alone does not prove iPhone speaker sound.
4. Record Tom's pivot in the living brief, designs and backlog: humans and agents author personalized levels from reusable pieces with placement guardrails, freely placing minor/major memories from photo integrations or manual uploads. Level periods suggest photos/bosses; **Show more** permits deliberate out-of-period choices. The full builder and richer obby content follow reliable basics, rather than blocking this repair.
5. Keep the catalog and guide accurate; no new expensive assets or promotion of final artwork. Carry checked application and scoped private GitOps PRs through squash merge and hosted verification. Preserve the normal app, existing saves, OAuth deferral and dev-env uptime.

## Delegation and ownership

- WO071, native Sol xhigh: sound module diagnosis and regression fixes; own `src/client/audio.ts` and its tests.
- WO072, native Sol xhigh: boss visual/runtime investigation; own `src/game/besties-scene.ts` and dedicated tests; lead owns shared runtime integration.
- WO073, native Sol xhigh: read-only memory interaction/rendering audit and modular placement inventory.
- Lead: UI/copy, architecture, `createGame.ts`/`scene.ts`, integration, builder direction, review and delivery. The authorized separate Fable5.1 xhigh review completed before Tom reported its usage exhausted. Apply TEAM’s temporary Opus 5 xhigh override for any needed new review until the Monday 8 AM reset is verified.

Each agent uses its own task worktree. No authoring/browser shared-resource lease is granted implicitly. Unrelated fixture port 4392 remains untouched. No dev-env restart, host dependency installation, OAuth, private photo import or new generation.

## Completion evidence

Record source causes, focused regression results, full checks, exact browser/viewport/input paths, remaining physical-device limits, app/ops merges, image/client identities and hosted tests in this plan and the handoff. Do not mark the new physical complaints resolved solely because the prior suite still passes.

## Verified candidate, September 12

WO071–076 record the diagnosed causes and accepted fixes. Candidate `7256000` passes typecheck, lint, build and 378 tests (10 real-Postgres cases run in CI). Separate Fable5.1 xhigh review is complete; all 15 integrated probes pass, including seven actual-model animation tests now in the main suite. No additional art or audio was generated.

Initial repaired client `index-DGbCshsH.js` (1,046,627 bytes; SHA256 `999cb163fc55304ced6f2f244d1b0dab8584d1c143ab0e62ee3a9f5c08535982`) passes real-touch controls and scrolled Help cue failure/retry/repeat. The full route completes age 0 → 4 → 7 and all six memories, observes actual collected roots disappearing and Besties pose/hit/defeat behavior, and accepts secondary attacks in both chapters. Focused held-wand damage and landscape controls pass. The versioned [v004 evidence](../../../docs/assets/media/playtest/v004/local-acceptance.json) separates these paths from unavailable physical Safari and speaker listening. This preserves the initial local candidate identity; the deployed follow-up and final acceptance are recorded below.


## Completed release

[WO077](../../work-orders/077-plan008-live-release.md) records app PR37 and its initial hosted paused-status failure, followed by the checked fix in app PR38 (`6e71ba1556784efb340056e27be11e2bd7ae6c10`). Exact publication runs passed; image digest `3112a716b888a3e5dbcbfca35d5680a52f49c43ae3b9347e34408b86b954bf0f` was pinned by checked ops PR2867 (`a621f1b4463f371fcc08f01e85c5c281e9600f36`). Flux applied that revision and all 24 rollout/isolation assertions pass. Normal Quest, dev-env, services, routes and policies are unchanged. The activity ended and owned fixtures 4398/4399 stopped.

The final client `index-Dg49Dt7R.js` (1,046,626 bytes; SHA256 `14fdb50c25753fbaffa5e389dc224f293a4ed0de4048e667e7f11fd91c9fc35d`) passes 380 local tests, typecheck, lint and build; 10 dedicated Postgres cases pass in CI. All six final hosted suites pass: API, audio failure/retry/repeat, actual touch controls, complete route with forced-fallen one-tap artwork retry, landscape/held-wand, and the thumbnail/model catalog. The route observes actual hidden collected roots and Besties movement/hits/defeat, all six memories and age 0 → 4 → 7. Initial failed evidence is retained.

The source repairs are complete; automated Chromium evidence does not establish physical iPhone Safari controls, speaker output or device performance. Cached WebKit remains unavailable because its GStreamer dependencies are absent. No host dependency, OAuth/private-photo or dev-env change was made. Final art/audio approval and creative inspection remain open.

DESIGN016, the project brief and BL07 preserve the accepted authored-level pivot. The full editor, uploads, period-aware pickers and longer branching obby are future implementation. The same-PR catalog rule remains mandatory; no new expensive asset was generated by PLAN008.
