# Astra coordination and authoring team

**September 20 editor MVP directive:** use Sol Ultra whenever possible for ordinary work and freely use explicitly authorized Opus 5 dev-env sessions for bounded parallel tasks. Conserve Astra usage for architecture, UX, tricky mechanics/art and final review. Deliver PLAN012 autonomously through a deployed testable MVP. This overrides the older ordinary-task effort and enemy-model-first sequencing.

**September 23 asset priority:** PLAN012 and the world builder are released. Tom now requests a full original spooky animatronic parody lineup, Rat Casino and Haynesnightmares, with Blender models before more levels. The previous one-entry-at-a-time cost guard does not reduce his requested full cast. Tom directed a central lead rat and Chick-flia as a side character, then rejected the glossy v001/v002 images as too glam rock. The [v003 concept](../docs/assets/reviews/rat-casino-ensemble/v003.md) is the current classic original-era mascot construction reference. The first v001 Rat Pit Boss export is a paused, unvalidated historical checkpoint; [WO099](work-orders/099-rat-pit-boss-classic.md) through [WO104](work-orders/104-golden-after-hours-rat-classic.md) delivered six technically checked separate studio candidates. [WO105](work-orders/105-moth-projectionist-export-metadata-correction.md) owns a narrow Moth metadata re-export after an adversarial review found a stale embedded status string; it is the current exclusive Blender scene owner. Preserve the older arcade/toybox versions and every exact owner-art gate. [PLAN015](plans/015-haynesnightmares-asset-first.md) and [DESIGN012](../docs/designs/012-player-journey-curation.md) record the current stage.

Tom's latest project instruction governs the model exceptions below. The pod's native Sol default remains useful for ordinary work; **Blender always uses Astra**, and **separate Fable sessions are explicitly authorized** for this project. No dev-env startup change is needed to apply these project rules.

## Temporary review quota override

Tom reports on September 12, 2026 that Fable usage is exhausted until Monday at 8 AM. Until that reset, any needed separate adversarial review uses **Claude Opus 5**, exact `claude-opus-5`, effort `xhigh`, through `agent-run`; do not dispatch Fable. The reported reset has no recorded timezone, so verify quota availability before returning to Fable. This changes the review lane during the quota window, not Astra's lead role, native Sol delegation or the Astra-only Blender rule. Do not start a review merely to use the available model.

## Routing

| Work | Model and dispatch | Ownership |
| --- | --- | --- |
| Lead, architecture, art direction, story, user-facing text, integration | GPT-6 Astra (`gpt-6-astra`, `max`) | Keep full lead context; coordinate bounded tasks and review every handoff. |
| Image concepts and revisions | Driving Astra using the built-in image generation tool | One generation/edit at a time, across the project. Inspect each result and retain the common references before starting the next. Never fan image generation out to agents. |
| **Any Blender work**, including scripts, modeling, materials, rigs, animation, optimization and renders | **Native GPT-6 Astra subagent**, `model: "gpt-6-astra"`, `reasoning_effort: "max"`, `fork_turns: "none"` | Start a fresh subagent for each bounded Blender task, including a separately dispatched revision; grant one exclusive owner of the live scene. Return editable masters, exports, renders and evidence. Do not route Blender work to Sol, Fable or Opus. |
| Bounded coding, tests, research, non-Blender tooling, audio execution and verification | Native GPT-5.6 Sol, `model: "gpt-5.6-sol"`, `reasoning_effort: "ultra"`, `fork_turns: "none"` | Default delegation lane. Audio direction and final judgment stay with Astra. |
| Adversarial review or bounded coding to balance plan use | Separate Claude Code **Fable 5.1**, `claude-fable-5-1`, `xhigh`, through `agent-run`; apply the temporary quota override above first | Explicitly authorized by Tom. Fresh session with a repository work order, scoped paths and concrete evidence. Fable may challenge Astra's decisions; Astra resolves findings. |
| Subagents inside a Claude Code session | Claude Opus (`claude-opus-5`, `xhigh`) | Follow Claude's pod policy. A Fable session must return any Blender task to the Astra lead. |

Prefer delegation whenever an independent, bounded task can progress alongside useful coordination. Keep model choice explicit in each [work order](work-orders/000-template.md). Start development agents with fresh contexts and enough repository readings, decisions and artifact versions to succeed without this conversation. The lead handoff preserves the whole project's useful context.

## Parallel work and scarce resources

Run gameplay, server/persistence, authoring and verification lanes as concurrency permits; these are roles, not a requirement to keep permanent agents running. Use task worktrees, owned paths and stable contracts. Native tools create Codex subagents; `agent-run` is reserved for the separate CLI sessions above.

The coordinator alone runs image generation, serially. A Blender agent may build a selected earlier concept while the lead generates the next, and audio or coding may run alongside them. There is only one mutable Blender scene: record its owner, asset/version, remote directory and handoff in the active work order. Do not dispatch another Blender writer until the current agent releases it; stop/inspect before taking over an abandoned session. Parallel Blender tasks require actually isolated instances, not different filenames in the same running scene. Audio has its own single-generation queue.

For a Fable task, use the supported launcher from a shell in dev-env:

```bash
agent-run --repo haynes-quest --agent claude --model claude-fable-5-1 --effort xhigh -p 'Read AGENTS.md and the lead work order at <absolute PVC path>. Work only within that scope in your new worktree; return the branch, evidence and unresolved findings to its handoff record.'
```

Replace the work-order path before running; use a literal prompt with no private data. Verify the new tmux session is alive and its banner names Fable 5.1 at the requested effort. CLI sessions coordinate through branches, work orders and the PVC, not native Codex mailboxes. They are plan-served sessions; this is not authorization to use paid API keys. Give an adversarial reviewer the exact commit, acceptance criteria and evidence, asking it to find concrete failures in authorization, progression, touch input, asset delivery or claims of completion. Integrate fixes and verify them; a review is not a rubber stamp.

## Autonomous delivery and recovery

Use both authorized plans for useful work, choosing Fable coding/review tasks when that balances capacity. There is no target token burn, fixed session lifetime or promise of a quota reset. If a model reaches a real usage limit, record the observed failure and completed work. Continue independent tasks on an available authorized lane; **never silently downgrade Blender work**. Do not repeatedly launch a model that is refusing work.

After every integrated milestone and before a context reset or usage wall, update [HANDOFF.md](HANDOFF.md), active work orders and the [asset catalog](../docs/assets/catalog.md): merged commits, remaining branches, exact run/preview commands, actual checks, current asset versions, scene owner, pending jobs and next bounded tasks. Save project artifacts to durable storage and release idle scene ownership. A replacement lead reads these records and resumes rather than regenerating completed assets.

**Every asset work order includes catalog maintenance as acceptance.** Follow the [mandatory catalog procedure](../docs/PROCESS.md#asset-catalog-must-stay-current), including concepts, revisions, audio and paused work. Authoring agents return exact intake data; the lead owns visible text, thumbnails and catalog integration in the same asset PR, then verified publication. Delegation or pending owner review does not excuse catalog drift. Do not close the overall asset task with catalog work left for another task.

Keep working through the playable MVP and its scoped first-pass catalog. Pending Tom review does not block candidate production, iteration, tests or ordinary PR merges. Final asset promotion still follows [DESIGN-002](../docs/designs/002-asset-pipeline.md); report tool and review limitations honestly.

## Owner-directed roster and cost control

Tom's September 11 correction superseded unattended completion of the former fixed enemy batch. The Besties duo was delivered as a private playtest candidate using the approved joint look. Tom's September 23 direction now makes the full FNAF-esque original parody cast the active asset pass. His central-rat/side-Chick-flia hierarchy remains, while the new classic original-era mood replaces the rejected glam-rock finish; see the [v003 review](../docs/assets/reviews/rat-casino-ensemble/v003.md). Candidate character rig/model production is authorized one exclusive Blender scene author at a time. Exact exported art remains subject to Tom’s final review before gameplay use. This does not hold independent catalog work, tests or ordinary checked PRs. Preserve and release every Blender scene safely. See [DESIGN-012](../docs/designs/012-player-journey-curation.md).
