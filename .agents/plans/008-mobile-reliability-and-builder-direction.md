# PLAN008: Mobile reliability and the authored-level direction

Status: In progress, September 12, 2026. Lead: Astra max. Worktree: `/home/dev/work/quest-mobile-reliability`, branch `agent/quest-mobile-reliability`, base `d461cda8e6fe7aecdb37933c21fd53e934ffabeb`.

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
- Lead: UI/copy, architecture, `createGame.ts`/`scene.ts`, integration, builder direction, review and delivery. Separate Fable5.1 xhigh adversarial review is authorized through `agent-run` once a concrete candidate exists.

Each agent uses its own task worktree. No authoring/browser shared-resource lease is granted implicitly. Unrelated fixture port 4392 remains untouched. No dev-env restart, host dependency installation, OAuth, private photo import or new generation.

## Completion evidence

Record source causes, focused regression results, full checks, exact browser/viewport/input paths, remaining physical-device limits, app/ops merges, image/client identities and hosted tests in this plan and the handoff. Do not mark the new physical complaints resolved solely because the prior suite still passes.
