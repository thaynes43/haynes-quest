# Coordination and authoring team

**September 20 editor MVP directive:** use Sol Ultra whenever possible for ordinary work and freely use explicitly authorized Opus 5 dev-env sessions for bounded parallel tasks. Conserve Astra usage for architecture, UX, tricky mechanics/art and final review. Deliver PLAN012 autonomously through a deployed testable MVP. This overrides the older ordinary-task effort and enemy-model-first sequencing.

**September 24 Rat Casino release:** PLAN012 and the world builder are released. Tom requested a full original spooky animatronic parody lineup, Rat Casino and Haynesnightmares, with Blender models before more levels. The [v003 concept](../docs/assets/reviews/rat-casino-ensemble/v003.md) corrected the glossy v001/v002 look toward the classic original-era mascot mood, with the Rat Pit Boss as lead and Chick-flia supporting. The first v001 Rat Pit Boss export is a paused, unvalidated historical checkpoint; [WO099](work-orders/099-rat-pit-boss-classic.md) through [WO104](work-orders/104-golden-after-hours-rat-classic.md) delivered six technically checked separate candidates. [WO105](work-orders/105-moth-projectionist-export-metadata-correction.md) corrected a stale Moth export status string without changing geometry, animation or previous preview pixels. [PLAN015](plans/completed/015-haynesnightmares-asset-first.md) and its [release record](evidence/classic-cast-release.json) document their private studio publication. Tom then said “Looks great, let’s move forward to the rat casino level.” [Completed PLAN014](plans/completed/014-complete-world-builder.md) and the [Rat Casino release record](evidence/rat-casino-level-release.json) document the private fictional level, exact Blender gameplay candidates and hosted journey. Final device/art acceptance remains separate. The Blender scene is released and idle; preserve older arcade/toybox versions.

**September 25 first family release:** Tom started [PLAN-019](plans/019-first-family-release.md) in a Claude Code session, which coordinates it. The coordinator (`claude-opus-5-5`) keeps architecture, UX, user-visible copy, integration and final review. Bounded code, test and verification lanes use native Opus 5.5 subagents (`claude-opus-5-5`, xhigh), per the pod's current Claude policy.

**Blender model rule, clarified by Tom on September 26:** the earlier "Blender always uses Astra" rule was a **Codex-internal choice of Astra over Sol** for Blender subagents. It was never a Claude-versus-Codex rule and is withdrawn in that form. Blender work goes to a fresh subagent on the **driving provider's top tier**:

- **Codex driver:** a native GPT-6 Astra subagent at `max`, not Sol.
- **Claude Code driver:** a Claude Opus 5.5 subagent (`claude-opus-5-5`, xhigh), or Fable 5.1 when Tom asks for it by name.

One exclusive scene lease at a time still applies. Concept images need an image-capable driver, such as Codex Astra's built-in image tool. A Claude-authored asset without a generated concept uses a clearly labeled Blender reference render as its inspiration image.

Codex's September 26 usage limit (reset September 30) paused the WO111 Astra art lead, and Claude Opus 5.5 continues the art lane. Per Tom's ruling, era-cast assets started only after he locked [DESIGN-026](../docs/designs/026-personal-era-casts.md).

The pod's native Codex subagent default is now `gpt-6-sol` (previously `gpt-5.6-sol`). The September 12 Fable quota override has expired, and separate Fable sessions remain explicitly authorized for this project.

## Routing

| Work | Model and dispatch | Ownership |
| --- | --- | --- |
| Lead, architecture, art direction, story, user-facing text, integration | The driving session: GPT-6 Astra (`gpt-6-astra`, `max`) or Claude Code (`claude-opus-5-5`, or Fable 5.1 by name) | Keep full lead context; coordinate bounded tasks and review every handoff. |
| Image concepts and revisions | An image-capable driver, such as Codex Astra's built-in image generation tool | One generation or edit at a time, across the project. Inspect each result and retain the common references before starting the next. Never fan image generation out to agents. |
| **Any Blender work**: scripts, modeling, materials, rigs, animation, optimization and renders | A fresh subagent on the driving provider's top tier: **Astra `max`** (`model: "gpt-6-astra"`, `fork_turns: "none"`) from a Codex driver, or **Opus 5.5** (`claude-opus-5-5`, xhigh) from a Claude driver. Never Sol | Start a fresh subagent for each bounded Blender task, including a separately dispatched revision. Grant one exclusive owner of the live scene. Return editable masters, exports, renders and evidence. |
| Bounded coding, tests, research, non-Blender tooling, audio execution and verification | Native Sol (`gpt-6-sol`, `xhigh`) from a Codex driver; Opus 5.5 subagents from a Claude driver | Default delegation lane. Audio direction and final judgment stay with the lead. |
| Adversarial review or bounded coding to balance plan use | Separate Claude Code **Fable 5.1**, `claude-fable-5-1`, `xhigh`, through `agent-run`, or an Opus 5.5 reviewer | Explicitly authorized by Tom. Fresh session with a repository work order, scoped paths and concrete evidence. The reviewer may challenge the lead's decisions; the lead resolves findings. |

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

Use both authorized plans for useful work, choosing Fable coding/review tasks when that balances capacity. There is no target token burn, fixed session lifetime or promise of a quota reset. If a model reaches a real usage limit, record the observed failure and completed work. Continue independent tasks on an available authorized lane; **never silently downgrade Blender work below the driving provider's top tier**. Do not repeatedly launch a model that is refusing work.

After every integrated milestone and before a context reset or usage wall, update [HANDOFF.md](HANDOFF.md), active work orders and the [asset catalog](../docs/assets/catalog.md): merged commits, remaining branches, exact run/preview commands, actual checks, current asset versions, scene owner, pending jobs and next bounded tasks. Save project artifacts to durable storage and release idle scene ownership. A replacement lead reads these records and resumes rather than regenerating completed assets.

**Every asset work order includes catalog maintenance as acceptance.** Follow the [mandatory catalog procedure](../docs/PROCESS.md#asset-catalog-must-stay-current), including concepts, revisions, audio and paused work. Authoring agents return exact intake data; the lead owns visible text, thumbnails and catalog integration in the same asset PR, then verified publication. Delegation or pending owner review does not excuse catalog drift. Do not close the overall asset task with catalog work left for another task.

Keep working through the playable MVP and its scoped first-pass catalog. Pending Tom review does not block candidate production, iteration, tests or ordinary PR merges. Final asset promotion still follows [DESIGN-002](../docs/designs/002-asset-pipeline.md); report tool and review limitations honestly.

## Owner-directed roster and cost control

Tom's September 11 correction superseded unattended completion of the former fixed enemy batch. The Besties duo was delivered as a private playtest candidate using the approved joint look. Tom's September 23 full FNAF-esque original parody cast has six published Blender candidates. His central-rat/side-Chick-flia hierarchy remains, while the classic original-era mood replaces the rejected glam-rock finish; see the [v003 review](../docs/assets/reviews/rat-casino-ensemble/v003.md) and [completed PLAN015](plans/completed/015-haynesnightmares-asset-first.md). Tom authorized a private fictional Rat Casino trial after seeing the exact cast. The final device/art decision remains open before normal gameplay promotion. Any requested model revision uses one exclusive Blender scene author at a time; preserve and release every scene safely. Independent catalog work, tests and ordinary checked PRs can continue. See [DESIGN-012](../docs/designs/012-player-journey-curation.md).
