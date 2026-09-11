# WO056: Fable 5.1 adversarial review of PLAN006

- Model: exact `claude-fable-5-1`, effort `xhigh`, via `agent-run`; plan-served CLI only.
- Lead worktree: `/home/dev/work/quest-playtest-feedback`, branch `agent/quest-playtest-feedback`.
- Review commit: supplied in dispatch after the integrated checkpoint is committed.
- Scope: read-only code review and focused non-browser tests. Return actionable findings with file/line, reproduction and impact to a technical record in your own task worktree. Do not change runtime/UI/assets, deploy, contact anyone, restart dev-env or begin OAuth/photo work.

Read AGENTS.md, TEAM, PLAN006 and DESIGN013/014. In your newly created task worktree, fast-forward your task branch to the exact lead commit named in dispatch; do not work in canonical clones or the lead’s shared tree. The repository and its dependencies are already on the PVC; follow the task-worktree rule. Do not author Blender assets or start other model jobs.

Tom’s physical iPad/iPhone playtest found the age-four wand unresponsive and the dragon pacing without attacking. This change adds longer ranged wand targeting/visible feedback, fixes the boss landing reach and action-pointer cancellation, maps four existing sound cues, restores foliage, integrates six friendly residents with healing and recoverable deliberate-harm penalties, and adds the approved Besties duo routine for compatible new journeys. V1/v2 saved catalogs remain frozen. V3 has a jump-required Besties period and keeps the old compatible remix fallback for 2024 journeys without jumping.

Challenge these properties:

1. Touch actions must survive a held movement finger; no lost or duplicate attack/pause actions.
2. The saved v2 dragon checkpoint is attackable with the wand, and the dragon can visibly retaliate without escaping its island. No progression softlock.
3. Besties has one authoritative health/victory/reward; normal AI must not double-hit or collide from its invisible logical centre. Only dizzy accepts the ordinary player attack in the browser routine. Warnings, active tricks, pause and recovery remain coherent.
4. Friendly characters never enter ordinary targeting or boss gates. Healing, first-harm health cost floored at one, defeat, making amends, cooldowns, receipts, owner/revision races and old/null save state must remain consistent. Stored future-chapter friendly progress is invalid.
5. Audio stays bounded and same-origin, unlocks from a real gesture, honours mute/volume and stops with background/pause/disposal. Check async decode races and event wiring.
6. Exact final model resolution is explicit for the duo; unknown versions fail safely. Existing frozen catalog identities must not be silently reinterpreted.
7. Compare catalog and delivery claims with evidence. Exact final artwork approval remains pending; the joint concept was approved. Chromium/software WebGL is not physical Safari or a listening review.

The lead’s first full touch journey passed gear, hazards, both bosses, memory reveal and 0→4→7 progression with no page errors; it preceded a high-five-only Black revision and camera/HUD refinements. Native Sol is now doing focused final-bundle touch/audio/friendly/old-dragon checks. Do not launch a browser concurrently. Review actual behavior and specific failure paths, not speculative rewrites or style preferences. Root owns architecture, art judgment, user-facing copy and final decisions.

Record the exact commit reviewed, tests actually run, findings or no findings, and explicit untested limits. No commits or PRs are necessary for this review; retain the result file on the PVC and report its location in the session output.
