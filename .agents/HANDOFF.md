# Current handoff

- **Project:** Haynes Quest
- **Last updated:** 2026-09-10
- **Stage:** Authoring dependency setup in progress before fresh-context game development; implementation not started
- **Driving model and team:** GPT-6 Astra; new development agents start with empty conversation context and self-contained work orders

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

[DESIGN-008](../docs/designs/008-audio-pipeline.md) now recommends a self-hosted Stable Audio Small-SFX CPU trial, with ElevenLabs optional. Tom asked about free/self-hosted choices and has been asked which trial to prepare. ElevenLabs offers 10,000 free monthly shared credits for noncommercial output; Stable Audio requires gated Hugging Face access and model terms acceptance. No audio model, generation account, quality/speed trial, or final output is verified. Both routes use FFmpeg/ffprobe and prepared Web Audio playback. Music/narration remain later options.

Astra lanes cover code, visuals, audio, story/design, and independent verification. Each development task starts with `fork_turns: "none"`, the applicable repo instructions, and a self-contained [work order](work-orders/000-template.md); do not inherit the planning conversation or reuse an unrelated research session. Give each task owned paths and stable contracts; serialize shared Blender use or isolate sessions. The team size follows available concurrency rather than requiring permanent agents for every role.

## Readiness and next step

Finish PLAN-003's dependency checkpoint first. The image build is [haynes-ops PR #2831](https://github.com/thaynes43/haynes-ops/pull/2831); runtime activation will be a separate held draft because changing this pod's image/MCP config restarts the session. Record build, activation, and live verification separately. Then start PLAN-002 in a fresh worktree with new-context Astra agents: record the small action/camera/cue contracts, scaffold the stack, and produce a runnable synthetic collection/unlock route. Stage durable saves, hosted Authentik, reviewed-asset integration, and physical-device validation separately. A local development fixture identity is never an alternative hosted login; a temporary save is not durable persistence evidence. Live Immich integration is later work.

Image generation is available. No Blender MCP or audio-generation tool is connected in this session. Node, pnpm, Python, uv, and Xvfb/Mesa are available; Blender, xauth, glTF Transform, FFmpeg, and ffprobe are missing from PATH in the currently running image. The new image adds those tools with a lazy, loopback-only Blender session on a virtual display, persistent shared files, and no GPU allocation. No app, database, Authentik client, photo connection, or final game asset has been provisioned by this documentation work. Tool setup and any pod-restarting changes follow `haynes-ops` rules when that milestone is undertaken.

## Repository and references

The [completed bootstrap plan](plans/completed/001-repository-bootstrap.md) records the initial reviewed scaffold. Subsequent requirements and designs are merged through PRs; the current repository still contains no runnable game or deployment. The canonical clone is `/home/dev/repos/haynes-quest`; work only in task worktrees.

- [Contributor guide](../AGENTS.md)
- [Project brief](../docs/prds/001-project-brief.md)
- [Documentation index](../docs/README.md)
- [Reviewed sibling conventions](../docs/reference/repository-conventions.md)
