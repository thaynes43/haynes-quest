# PLAN-002: Build and validate the playable foundation

- **Status:** In progress
- **Current milestone:** PLAN-004 delivered the synthetic application and candidate pipeline in PR #21; private deployment/catalog completion is underway. Authentik, physical Safari and approved-asset integration remain later gates.
- **Depends on:** Tom's dependency-first checkpoint in [PLAN-003](completed/003-authoring-tool-setup.md), then slice contracts in DESIGN-007; authoring tools, live admission/provisioning, and owner asset review are dependencies of the later milestones that use them
- **Requirements/designs:** [PRD-001 R-01, R-08–R-14, R-16–R-24, R-30–R-39](../../docs/prds/001-project-brief.md), [ADR-002](../../docs/adrs/002-web-game-stack.md), [DESIGN-001](../../docs/designs/001-technical-foundation.md), [DESIGN-002](../../docs/designs/002-asset-pipeline.md), [DESIGN-003](../../docs/designs/003-photo-connections-and-people.md), [DESIGN-004](../../docs/designs/004-memory-journey.md), [DESIGN-006](../../docs/designs/006-memory-age-and-abilities.md), [DESIGN-007](../../docs/designs/007-poc-development-loop.md), [DESIGN-008](../../docs/designs/008-audio-pipeline.md)

## Current overnight extension

[PLAN-004](004-overnight-mvp.md) extends this foundation: implement the Immich adapter and finite setup now, demonstrate visible avatar growth, and allow a private synthetic placeholder account while OAuth is deferred until tomorrow. Its current milestone takes precedence over the older exclusions below. Final Authentik-only access and reviewed assets remain release requirements.

## Outcome and scope

Build a small playable proof of chronological memory recovery and cumulative abilities, then validate the authored-asset workflow, account-owned saves, and browser delivery. The proposed route has one compact level, a generic avatar, three synthetic dated memories, one new movement action, retained starting actions, and a reachable finish. A fictional known birth date supplies the test age mapping. These are prototype defaults, not final age thresholds, level quotas, or a resolution of real-person setup policy.

Tom's latest direction narrows the earlier blanket documentation prerequisite. Complete the current PLAN-003 dependency checkpoint, define the slice's contracts, then code with clearly synthetic placeholders while authoring candidates. Full fighting, extra collectibles, story, and era content are [later work](../../docs/BACKLOG.md). Real Immich access, complete library reconciliation, multiplayer, gamepad support, and automatic character generation are outside this plan. Preserve integration boundaries; do not present synthetic adapter tests as proof of live Immich compatibility.

The initial planning pass did not execute this work. PLAN-003 is now complete, and PLAN-004 implements the private synthetic milestone with placeholders while candidates are produced and reviewed. Later hosted and reviewed-asset milestones have their own prerequisites and completion evidence.

## Milestones

### 1. Runnable synthetic gameplay

- Scaffold the proposed TypeScript/React/Vite/Three.js and Hono application with pinned compatible dependencies, build/type-check/test commands, and CI. Keep client, game, and server boundaries explicit. Record the proposed initial actions, camera, control mapping, synthetic dates/threshold, and stable memory/ability/asset/cue IDs before parallel implementation.
- Use simple geometry and a generic placeholder. Start at zero, reach the first memory with the initial actions, unlock one later action in order, then use it and an earlier action to finish. Implement the same action interface for keyboard/mouse and simultaneous touch movement plus another action. Decide whether a physics library is needed from this probe.
- Use a small synthetic adapter and clearly labeled development fixtures. Temporary local saves may support iteration but do not prove durable persistence; development identities must be excluded from the hosted production configuration.
- Implement a small game-owned audio service with synthetic cues, explicit unlock, mute/volume preferences, visible feedback, bounded effects, and cleanup/interruption handling under DESIGN-008. Final sound candidates are reviewed separately.
- Return a runnable checkpoint and focused evidence for chronology, locked-action rejection, duplicate collection, retained abilities, and scene/input/audio lifecycle. Record what still requires actual-device validation.

### 2. Durable saves and hosted identity boundary

- Add the proposed Postgres/Drizzle save store and validate ownership, stable subject identity, memory age, unlocks, collected-memory state, rule versions, and reload/resume. Test another user's identifiers, malformed requests, retries, stale updates, duplicate/out-of-order memories, and forged client ages/abilities.
- Keep photo connections and resolved people behind the DESIGN-003 interface using synthetic adapters. Cover empty/multiple saves, missing/ambiguous subjects, name changes, and credential/account isolation for the implemented boundary. Unsupported library refresh or age-source edits remain explicit states, not silent progress changes; full reconciliation follows its later integration design.
- Before hosted access, establish the admitted-player policy and provision the game's own Authentik client, secrets, and database through the established workflows. Verify installed Better Auth APIs and callback paths against pinned dependencies. Test fresh sign-in, existing-session SSO, expiry/logout, and server authorization. No alternative player login is added.

### 3. Repeatable authoring and Tom's review

This milestone can overlap code work once its own tools are ready. Use bounded work orders under [TEAM.md](../TEAM.md), with Astra for Blender, Sol for ordinary tasks and authorized Fable review/coding, with owned files/resources; serialize access to a shared Blender scene or isolate sessions.

- Use the dedicated cluster Blender service and explicit remote artifact workflow verified by PLAN-003 and DESIGN-002. Prove scene inspection, viewport capture, editable save/reopen, and GLB export/load with a synthetic object before producing final candidates. Manage homelab tooling through `haynes-ops`.
- Use the DESIGN-008 self-hosted Small-SFX service verified by PLAN-003. Supply its remote MCP endpoint, job/artifact conventions, pinned provenance, and cue brief in the work order. Generate a bounded candidate set, prepare browser exports, and collect listening/review evidence. The CPU baseline needs no hosted account or GPU; music and narration remain optional later work.
- Author only the avatar/props/materials/animations and small cue set the route needs. Use image-generated visual sketches followed by Blender. Retain editable masters, provenance, scripts/settings, checksums, and format/performance checks. No private family references are needed.
- Present concrete visual and audio candidates in isolated review previews using the asset-review template. Obtain and record Tom's review of the exact final versions before gameplay promotion. Keep placeholders or the previous approved version in the runnable game while review is pending.

### 4. Integrate, host, and playtest

- Integrate approved final versions through stable asset/cue IDs. Verify animations, orientation, collider/camera fit, bounded delivery formats, local decoder resources, and audio behavior. Replacing assets must preserve saves and unlocked abilities; rejection or failure preserves a usable version.
- Release the application image and deliver its deployment through a checked, squash-merged `haynes-ops` PR and Flux. Verify health, the homelab HTTPS route, Authentik-only entry, and server-owned save/resume. No native iOS or TestFlight build is involved.
- Complete the route in Safari on actual iPad and iPhone hardware and in the selected PC browser. Record models, OS/browser versions, graphics measurements, simultaneous input behavior, audio unlock/mute/background/screen-lock/resume, and missing-file behavior. Desktop touch emulation cannot replace these checks.
- Review the gameplay feel and asset results, accept or revise the tested stack decisions in ADR-002, and record the next small iteration. Do not start a full combat/story/content production pass merely because the foundation works.

## Completion evidence

All [DESIGN-007 PoC acceptance criteria](../../docs/designs/007-poc-development-loop.md#poc-acceptance) must have recorded evidence before the entire plan is Completed:

- Passing build/type checks, focused progression/ownership/lifecycle tests, and browser journeys, with commands and results.
- The route runs from zero through ordered memories and one new ability while retaining earlier actions; progress survives server-owned save/resume and approved asset replacement.
- Reproducible visual/audio candidates, technical validation, exact-version owner review, and approved gameplay integration. A placeholder-only milestone is useful progress but not proof of the final-asset pipeline.
- Authentik and GitOps release checks, with image/version and PR references; no family photos or authoring secrets in source/build artifacts.
- Recorded actual iPad, iPhone, and PC results, plus the tested scope and remaining photo/gameplay work in the handoff. No unperformed device, generation, or deployment check is reported as complete.

## Result

Not started. The bounded coding scope is defined, but Tom now wants PLAN-003 dependency setup first; fresh-session native tool discovery, owner asset reviews, live admission/provisioning, and actual-device testing remain milestone dependencies. The separate authoring services have passed live checks under PLAN-003. The current repository remains documentation-only.
