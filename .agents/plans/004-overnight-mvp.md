# PLAN-004: Overnight MVP with deferred OAuth

- **Status:** Ready for a cold-start Astra lead after the single dev-env activation
- **Owner direction:** Tom, 2026-09-11: implement overnight, reuse AppDaemon's Immich connection, keep personal configuration server-side, make the avatar grow toward the recovered person's age/likeness, and defer OAuth setup until tomorrow. A placeholder account is explicitly allowed for coding/testing.
- **Precedence:** This is the current implementation scope. It extends PLAN-002 to implement the Immich adapter and evolving-avatar contract. Older statements that permanently exclude likeness or make live OAuth a prerequisite to starting code do not govern this overnight milestone. Authentik remains the sole eventual player login under ADR-001.
- **Read with:** [PLAN-003](003-authoring-tool-setup.md), [DESIGN-007](../../docs/designs/007-poc-development-loop.md), [DESIGN-008](../../docs/designs/008-audio-pipeline.md), [Immich source review](../../docs/reference/immich-appdaemon.md).

## Tonight's outcome

Produce a runnable, private browser MVP with touch and keyboard/mouse controls, a mysterious age-zero avatar, chronological memory collection, visible growth, at least one new ability with earlier actions retained, a reachable finish, and server-owned save/resume. Start with one complete compact level and synthetic dated photos. Add configuration and the real Immich adapter behind the same tested contracts; do not stop after a plan, scaffold, or disconnected screens.

Astra leads with the full project context. Delegate bounded work to native GPT-5.6 Sol subagents at `xhigh`, `fork_turns: "none"`, with self-contained work orders and owned paths. Astra owns visual direction, user-facing writing, architecture, integration and final review. Keep fresh agents productive through small integrated milestones and preserve a durable handoff through context resets.

## Secrets and identity

No new 1Password item, OAuth client, redirect setup or dev-env image change is required to start tonight. The existing AppDaemon Immich key already comes from 1Password. New production session/database/OIDC secrets can be prepared tomorrow. Do not reuse another application's session secret or database identity.

- Coding/tests may use a clearly labeled fictional account and temporary local/CI database/session values generated at runtime outside git. Give it a server-assigned identity; do not trust an arbitrary account ID from the browser. Keep this mode development-only and disabled by default in production. It is not another player login method.
- A reachable demo before OAuth uses synthetic subjects/photos only. It must not expose the real Immich adapter, key, people search, private media or real profile records through placeholder access. Keep any credentialed live smoke isolated from that demo.
- If persistent cluster credentials are needed, use ExternalSecrets with `ClusterSecretStore/onepassword-connect` and 1Password source fields. Never put values in public git, PRs, logs, images or test artifacts; do not introduce SOPS files as a substitute. Do not invent a new credential dependency that blocks the private development milestone.
- Production Better Auth session material, dedicated Postgres role/password and a separate Authentik client ID/secret belong to a game-specific 1Password entry when that deployment is enabled. Database administrator credentials belong only to provisioning, not the game runtime. Final callback paths must match the pinned Better Auth implementation.
- Authentik admission/sharing policy, real login journeys and physical-device verification remain explicit tomorrow checks. Do not claim them complete through a fixture account or browser emulation.

Use the proposed TypeScript/pnpm, React/Vite, Three.js, Hono/Node, Better Auth and Postgres/Drizzle foundation. Validate installed APIs and record tested choices. Real Postgres integration tests can run against a disposable CI database while interactive development uses an appropriate private test harness; distinguish this from a production database deployment and document the actual persistence behavior.

## Immich and private player setup

Tom authorizes reuse of the URL/API key used by `hass-sandbox` AppDaemon. Source configuration is `haynes-ops/kubernetes/main/apps/home-automation/appdaemon/app/externalsecret.yaml`: URL `http://immich-server.photos.svc.cluster.local:2283`, source item `appdaemon`, field `IMMICH_API_KEY`. A game ExternalSecret should select only that field, rather than import AppDaemon's unrelated credentials. Its server environment uses `IMMICH_URL` and `IMMICH_API_KEY`. This can be deployed with the game later without restarting dev-env or changing 1Password tonight.

Implement a server-side adapter based on the reviewed source, correcting its fail-open person lookup and pagination/filter/logging gaps. Match the deployed API when a private read-only smoke is possible. Do not modify AppDaemon as part of this task or describe synthetic tests as successful real-photo retrieval.

New-player setup accepts a person name, resolves ambiguity explicitly, and stores the resolved person ID, label, date/age configuration and a bounded selected-photo manifest in private server storage. Real names, birth information, photos and source IDs never become committed fixtures, agent prompts, public screenshots or automated-test artifacts. Use an unmistakably fictional subject such as “Demo Adventurer” for repository tests. User-entered personal records belong in private application storage; infrastructure credentials come through 1Password/ExternalSecrets.

The MVP only needs a finite set of photos. Provisional implementation defaults: a date-range/coverage preview, a configurable cap of 24 selected images, chronological sampling with selection/deselection, and confirmation that freezes the journey's asset/date/age/rule versions. Cap discovery work too, report truncated/incomplete results honestly, and never search the entire library after an unresolved name. Resume must not silently reshuffle after new uploads. Missing/revoked photos do not grant access or erase earned progress.

Use a fictional known birth date in tests. A private birth-date field is the provisional real-person setup path; do not infer birth or current age from appearance or earliest-photo date. Exact alternative age-anchor policy can be settled tomorrow. No real person name is needed to implement or test the configuration flow tonight.

## Evolving avatar

The product direction now includes recovering identity visually: the initially mysterious avatar should grow toward the age and likeness represented by collected photos. Appearance progresses from recovered memory age, independently of photo count or chapter entry, and never advances beyond the journey's represented ages. A child's journey can finish as a child.

For tonight, implement visible age stages using synthetic placeholder proportions/posture/appearance plus a versioned subject-appearance and age-variant contract. A fictional journey should demonstrate at least one visible growth transition alongside an ability unlock. Preserve camera framing, controller/collider behavior, animations and saves through changes. Define a private mapping for later reviewed person-specific variants so likeness can be added without replacing identity/progression models. These are implementation defaults, not a claim that generic color changes reproduce likeness.

Photo-derived likeness, exact rigs/morphing and final art still need design and review. Do not build an automatic photo-to-3D generation service tonight or send private family references to external generators merely to finish a fixture. Image generation → Blender remains the agreed authoring workflow. Use synthetic references for candidate art; serialize the shared Blender scene. Audio authoring is available independently. Tom reviews exact final visual/audio versions before gameplay promotion; keep the private MVP playable with clearly identified placeholders while candidates await tomorrow's review.

## Execution and verification

1. Verify the activated startup rules and both MCP endpoints from the fresh session; record PLAN-003 completion only after those checks.
2. Specify small action/camera/progression/save/photo/appearance contracts, scaffold, and immediately make one collection/growth/unlock route playable.
3. Integrate configuration, finite manifests, server-owned saves and the Immich adapter with synthetic and failure-path tests. Add meaningful ownership, duplicate/out-of-order recovery, forged-age/unlock, missing-name, ambiguous-name, bounded pagination and private-media checks.
4. Exercise keyboard/mouse and simultaneous touch actions with browser automation; capture synthetic-only previews. Test refresh/resume and input/scene/audio cleanup. Build and run real database integration tests where available. State actual browser/device coverage honestly.
5. Produce optional synthetic art/audio review packages, without making owner review a reason to stop coding. Iterate on the implemented route and review integrated subagent output.
6. Carry authorized changes through PRs, passing required checks and squash merges. Publish a runnable private preview where the environment permits. Use GitOps for cluster changes; do not restart dev-env again. No unprotected real-photo deployment or placeholder-login production mode.
7. Keep working autonomously toward this MVP. Choose and document reversible defaults instead of waking Tom for routine decisions. If one credential/tool blocks a milestone, record it and continue independent work. Finish with exact run/preview instructions, merged PRs, verification evidence, known limitations and the bounded OAuth/production-secret/asset-review work for tomorrow.
