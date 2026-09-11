# Current handoff

- **Project:** Haynes Quest
- **Last updated:** 2026-09-11
- **Stage:** Authoring dependency setup in progress before fresh-context game development; implementation not started
- **Driving model and team:** GPT-6 Astra (`max`) leads; native Codex subagents use GPT-5.6 Sol (`xhigh`) with empty conversation context and self-contained work orders

This handoff is for Astra to resume as the Haynes Quest lead with the full project context and decision rationale. Preserve useful planning context; the empty-context requirement applies to delegated Sol subagents and their bounded work orders.

## Latest overnight ruling

[PLAN-004](plans/004-overnight-mvp.md) is the current cold-start implementation order and takes precedence over older milestone exclusions below. Tom authorizes a placeholder account for coding/testing and defers OAuth until tomorrow. No new 1Password item is needed to start; later cluster secrets always use ExternalSecrets from 1Password. Reuse AppDaemon’s existing Immich source reference when enabling private integration; never expose real family data through the fixture demo. Implement finite photo configuration and the adapter now, with synthetic fixtures and private server storage for entered person names. Avatar age/likeness evolution is now product direction; overnight defaults prove visible age growth and a future private likeness-variant contract. Final photo-derived likeness and asset review remain separate work.

The unseen question cards did not obtain owner decisions. PLAN-004 labels birth-date input, photo limits and placeholder age variants as provisional defaults. Authentik admission is deferred with OAuth, so it does not block tonight’s private coding milestone. Keep the Astra lead’s full context and use fresh Sol subagents. The external activation agent only merges/verifies the single restart; it does not provision 1Password or OAuth.

## Established

A novelty Roblox-style 3D browser game, initially for Tom's family, hosted through `haynes-ops`. Required targets are iPad/iPhone Safari with on-screen touch controls and PC keyboard/mouse. It opens as a normal HTTPS web app; no native iOS, TestFlight, or required installation. Gamepad is later work.

Players sign in through Authentik only, following Haynes Network. [ADR-001](../docs/adrs/001-authentik-sign-in.md) is accepted. The game's separate client and admitted-player policy still need setup before hosted access; owning an Authentik identity alone does not authorize access to photos. Players choose among their own saves or start a new journey.

Users configure a self-hosted photo-service URL, key, and people, with Immich first. A selected person supplies dated memories independently of the shared generic, mysterious avatar. Every new save begins at memory age zero without memories and with baby abilities. Chronological recovery advances age and unlocks actions that carry forward. Current abilities must suffice for every required path. Photo coverage is not proof of birth/current age; do not infer age or gender from pictures. The real-person birth-date versus age-anchor question remains pending; the PoC uses an explicit fictional birth date.

The full game groups history into decade-like/proportional chapters and selects from an authored original enemy/boss catalog by actual calendar period. Manual subject gender/settings may inform selection; requiredness and weights remain open. Era determines eligible influences, memory age determines abilities, and human difficulty is separate. Saves preserve subject identity, versioned journey/progression data, and progress across name or asset changes.

[ADR-002](../docs/adrs/002-web-game-stack.md) proposes TypeScript, React/Vite, Three.js, Hono/Node, Better Auth, and Postgres/Drizzle. Babylon remains a fallback; R3F/Rapier are optional choices to justify during the trial. The [source review](../docs/reference/astra-game-workflows.md) supports testing this direction; no local app or actual-device validation has occurred.

## Current scope ruling

Tom now wants the core gameplay flowing before filling out fighting, extra collectibles, and the full story. [DESIGN-007](../docs/designs/007-poc-development-loop.md) narrows the former all-requirements prerequisite: define the small slice's contracts and use placeholders during implementation. The newer dependency-first sequence below applies before that development dispatch. The PLAN-002 slice is defined; Tom subsequently prioritized [PLAN-003 dependency setup](plans/003-authoring-tool-setup.md) before dispatching its development agents. Broader gameplay/story design still does not block that slice.

The proposed slice is one compact level, three synthetic memories, one new movement ability, retained initial actions, a finish point, and save/resume. These are prototype defaults, not final game quotas or age milestones. The premise already supplies an objective; no full campaign, identity reveal, boss, music track, or spoken script is needed. [BL-02–BL-05](../docs/BACKLOG.md) retain later gameplay/story/audio work. [BL-01](../docs/BACKLOG.md#bl-01-automatic-playable-character-generation) remains conditional automatic person-specific generation beyond the family PoC, requiring a separate premise decision.

The agreed visual workflow is image-generated concepts followed by Blender through MCP. Tom reviews final visual and audio versions before gameplay use. Prepare viewable/listenable candidates and technical evidence under the [asset-review template](../docs/assets/000-review-template.md); no asset candidate has been submitted or approved yet. Ordinary code/docs PRs still self-merge after checks. Pending assets leave placeholders or prior approved versions usable.

[DESIGN-008](../docs/designs/008-audio-pipeline.md) selects self-hosted Stable Audio Small-SFX through the official optimized CPU implementation. Its published optimized files support anonymous download; the gated PyTorch checkpoint is not required. Audio gets its own service, model cache, workspace, and private asynchronous MCP endpoint. GPU/music/narration remain later options. A real 10-second stereo test completed on CPU in 7.3 seconds with about 3.9 GiB peak process memory. PLAN-003 records the infrastructure checks; no game audio is approved.

Astra owns architecture, integration, user-facing design/text, and final review. Native Codex Sol subagents at `xhigh` handle bounded code, authoring implementation, and verification tasks. Claude Code uses Opus for its own subagents. Each delegated Sol development task starts with `fork_turns: "none"`, the applicable repo instructions, and a self-contained [work order](work-orders/000-template.md); do not inherit the planning conversation or reuse an unrelated research session. Give each task owned paths and stable contracts; serialize shared Blender use or isolate sessions. The team size follows available concurrency rather than requiring permanent agents for every role.

## Readiness and next step

Finish PLAN-003's dependency checkpoint first. Tom's latest ruling puts Blender, its virtual display, and the MCP bridge in a dedicated cluster pod, reachable over an internal streamable HTTP `/mcp` endpoint with Cilium constraints. The service owns a separate persistent workspace and explicit artifact transfer; its upgrades must leave dev-env running. CPU/software graphics suffice for setup smoke; GPU render Jobs are a later measured option. The dedicated service is deployed and verified through [haynes-ops PR #2836](https://github.com/thaynes43/haynes-ops/pull/2836). Its endpoint is `http://blender-authoring.dev.svc.cluster.local:8000/mcp`; files under its `/workspace` PVC are downloaded through `/artifacts/<relative-path>`. Live MCP, screenshot/export, matching artifact checksums, audio encoding, and recovery after replacing only the Blender pod all passed. Dev-env stayed on the same pod/image with zero restarts.

The old dev-env toolchain in [haynes-ops PR #2831](https://github.com/thaynes43/haynes-ops/pull/2831) is merged and image 0.6.0 was tested and published, but its in-pod Blender activation is superseded. [Held PR #2833](https://github.com/thaynes43/haynes-ops/pull/2833) is the final single-restart activation, with no Blender image bump. Merged PR #2843 temporarily excludes the two startup ConfigMaps from Reloader without changing the live pod. Merged #2844 staged both registrations and startup rules; live ConfigMaps and mounted contents match Git. Held #2833 restores normal reload behavior and changes the pod template once at Tom's session break. The explicit final activation waits for Tom's natural-break merge; later authoring service updates do not restart dev-env. [Cleanup PR #2834](https://github.com/thaynes43/haynes-ops/pull/2834) removed the superseded Blender layers from future dev-env images. PLAN-003 records the live service evidence; initial native tool discovery remains a post-activation check. Tom explicitly requested that audio setup and startup rule changes finish before the single dev-env restart.

After that checkpoint, start PLAN-002 in a fresh worktree with new-context Sol agents under Astra: record the small action/camera/cue contracts, scaffold the stack, and produce a runnable synthetic collection/unlock route. Work orders must name the remote endpoint, session ownership, and artifact transfer/path conventions. Stage durable saves, hosted Authentik, reviewed-asset integration, and physical-device validation separately. A local development fixture identity is never an alternative hosted login; a temporary save is not durable persistence evidence. Live Immich integration is later work.

Image generation is available. Blender and audio HTTP MCP endpoints are verified and callable from dev-env. Their startup registrations are staged, but they are not yet native tools in this existing session. The earlier live-pod inspection found Node, pnpm, Python, uv, and Xvfb/Mesa, with Blender, xauth, glTF Transform, FFmpeg, and ffprobe missing from PATH. Those authoring tools now belong in the dedicated workload; their absence in dev-env is not a reason to activate the superseded image. No app, database, Authentik client, photo connection, or final game asset has been provisioned by this documentation work. Keep PLAN-003 open until the single activation and fresh-session native tool checks are recorded.

## Repository and references

The [completed bootstrap plan](plans/completed/001-repository-bootstrap.md) records the initial reviewed scaffold. Subsequent requirements and designs are merged through PRs; the current repository still contains no runnable game or deployment. The canonical clone is `/home/dev/repos/haynes-quest`; work only in task worktrees.

- [Contributor guide](../AGENTS.md)
- [Project brief](../docs/prds/001-project-brief.md)
- [Documentation index](../docs/README.md)
- [Reviewed sibling conventions](../docs/reference/repository-conventions.md)
