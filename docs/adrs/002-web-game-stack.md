# ADR-002: Browser game stack and saved-game storage

- **Status:** Proposed
- **Date:** 2026-09-10
- **Decision lead:** Astra; recommendation under Tom's instruction to establish the stack first
- **Related requirements:** [PRD-001 R-01, R-03, R-08–R-14, R-16–R-24](../prds/001-project-brief.md)
- **Builds on:** [ADR-001: Authentik sign-in](001-authentik-sign-in.md)

## Context and problem statement

The game needs a generic animated 3D avatar, touch and desktop controls, sign-in and save-selection screens, persistent player saves, and configured photo connections. Users supply a photo-service URL, API key, and people; retrieved photos form chronological memory journeys tailored to the selected subject. The mysterious avatar begins without memories and is independent of that subject. The family PoC uses developer-authored avatar and world assets. It will run in the existing homelab Kubernetes environment and be accessed as a normal web app on iPad, iPhone, and PC. The owner explicitly excludes native iOS/TestFlight delivery. There is no current requirement for multiplayer or a visual level editor.

## Decision drivers

- A code-driven 3D workflow that can be tested and maintained from the dev pod.
- Inspectable examples of Astra-assisted browser games and reference-driven asset authoring, following Tom's request to prefer demonstrated workflows.
- A practical mobile-browser baseline and a stable model/animation format.
- Reuse of the household's TypeScript, authentication, database, and GitOps experience.
- Few runtime services and clear separation between frame-by-frame gameplay and account data.

## Considered options

| Option | Fit and tradeoff |
| --- | --- |
| **Three.js with a React shell** | Recommended for the foundation trial. The reviewed Astra examples include inspectable browser-game source and the intended imagegen → Blender → Three.js workflow. Keep the game loop separate from React and explicitly own input, movement, and collision integration. |
| Babylon.js with a React shell | Credible fallback with integrated animation, asset loading, input facilities, collisions, and optional physics. The reviewed Chess Cubed creator also reports Astra + Blender MCP + Babylon. Prefer it if the trial exposes costly integration in Three.js. |
| Three.js + React Three Fiber + Rapier | Viable composition when React scene components and physics help. R3F and Rapier are optional choices to justify against gameplay; using Three.js does not require either package. |
| Godot web export | Strong editor-led alternative. Adds a separate engine/build boundary around the web application; its web renderer and mobile limitations need consideration. Visual editing could justify it; native export is outside the confirmed delivery scope. |
| PlayCanvas | Credible browser engine with an optional editor and a standalone npm workflow. The reviewed evidence gives no current reason to prefer it for this project. |

These are architectural judgments, not benchmark results. Babylon's capabilities are documented in its [specifications](https://www.babylonjs.com/specifications/). The alternatives were checked against the [Three.js game guide](https://threejs.org/manual/en/game.html), [R3F performance guidance](https://github.com/pmndrs/react-three-fiber/blob/master/docs/advanced/pitfalls.mdx), [Rapier character controller](https://rapier.rs/docs/user_guides/javascript/character_controller/), [Godot web export constraints](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html), and [PlayCanvas standalone workflow](https://developer.playcanvas.com/user-manual/engine/standalone/).

The [Astra workflow review](../reference/astra-game-workflows.md) records creator posts, source snapshots, and access limits. It changes this proposal's initial Babylon preference to Three.js because the accessible examples offer useful implementation precedents for the family PoC. It does not demonstrate a model-capability or device-performance advantage. No benchmark, successful local playtest, or owner acceptance of an implemented stack is implied.

## Recommended outcome

After technical and nontechnical requirements documentation and subsequent tool setup are complete, use the following stack for the foundation prototype. Accept or revise the browser/API/storage and authored-asset choices after their integration and device trial. Automatic character generation is conditional future work under [BL-01](../BACKLOG.md#bl-01-automatic-playable-character-generation).

| Layer | Recommendation | Reason |
| --- | --- | --- |
| Language and tooling | TypeScript, pnpm, Node.js | Familiar across the sibling repos; shared types for saves and game commands. Pin compatible supported versions and commit the lockfile when scaffolding. |
| Menus and application UI | React + Vite | Login, photo-connection/person setup, timeline previews, saves, journey selection, menus, and touch controls. |
| 3D runtime | Three.js, loaded when entering the game | A dedicated game module owns the frame loop, scene, animation, and input integration, isolated from React rendering. Use WebGL2 as the initial baseline; WebGPU can be evaluated later. |
| API and hosting | Hono on Node.js, serving the Vite production build and API on one origin | One application image and origin; Hono already has a sibling precedent in `libretto`. |
| Sign-in | Better Auth with Authentik OIDC only | Carries forward Haynes Network's provider/session pattern using the game's own registration. |
| Persistent state | PostgreSQL + Drizzle | Sessions, private photo-connection metadata, configured people, versioned journeys, memory progress, asset metadata, and saves. Credentials need separate encryption-key delivery. |
| Validation | Zod at API/save boundaries; Vitest and Playwright for appropriate tests | Runtime data validation, save/ownership tests, and browser journeys. Actual hardware still determines graphics performance. |
| Photo integration | Server-side adapter, Immich first | Resolve configured names and query photos within each connection's permissions; do not bake a household URL/key into the app. |
| Developer asset authoring | Image-generated sketches + Blender through MCP | Preferred workflow for the PoC's shared avatar, world assets, rigs, and animations. Bridge/host setup follows requirements documentation. |
| Runtime art | Validated, versioned GLB/glTF 2.0 with a stable avatar-asset identity | The runtime loads the shared prepared avatar independently of the selected subject and journey. |

Vite plus Hono is preferred over Next.js for this prototype because the current application is a browser game with a small set of account screens and no established server-rendering need. Next.js remains viable, but adopting it solely to reproduce the sibling stack would add a server/client rendering boundary without a current benefit. Hono supports [Node.js and static assets](https://hono.dev/docs/getting-started/nodejs) and [Better Auth integration](https://hono.dev/examples/better-auth); Vite documents [production builds](https://vite.dev/guide/build).

Better Auth supports [custom OIDC providers](https://better-auth.com/docs/plugins/generic-oauth) and a [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle). Reuse Haynes Network's behavior and tests as references, but verify callback paths, APIs, and adapter imports against the versions actually installed; current documentation differs from the older sibling snapshot. Example providers/passwords in upstream tutorials are not this game's configuration.

Postgres is chosen for operational consistency and server-owned saves, not expected player count. SQLite would suffice for a small single-instance game, but introduces a separate application-volume/backup pattern. Browser-only storage does not provide the proposed account-linked resume experience across devices.

Start with one package and clear client, game, server, and shared modules. The family PoC needs no generation worker, queue, mock-job layer, or generation-provider trial. Blender MCP belongs to the developer's authoring workflow; browser play loads validated assets. A multiplayer service has not been selected. Start the movement probe with the smallest collision implementation that exercises the agreed movement; evaluate Rapier if the controller or dynamic objects need it. Add R3F only if React scene composition earns its place in the design. Do not store scene objects in saves.

## Consequences

| ID | Consequence |
| --- | --- |
| C-01 | React and the Three.js game module need an explicit lifecycle bridge and typed command interface; per-frame motion must stay out of React state. Dispose renderer resources and stop input/frame-loop work when leaving the scene. |
| C-02 | The server owns identity and authorization for saves, connections, people, journeys, memories, and private assets. The setup form can submit a key; saved credentials are never returned to gameplay clients. Photo selection/delivery stays within the configured connection and people. |
| C-03 | The app needs a dedicated database/schema, credentials, migrations, backups, and restore verification through `haynes-ops`; it does not share Haynes Network tables. |
| C-04 | Required engine loaders, optional physics WASM, and mesh/texture decoders must be packaged or served locally. Compressed assets must not silently depend on public CDN defaults. |
| C-05 | Confirmed device families are iPad, iPhone, and PC, using browser-only homelab delivery. Validate touch in iPadOS/iOS Safari and keyboard/mouse in the selected PC browsers. Record exact hardware models and OS/browser versions during the trial; Android is not a required target. |
| C-06 | A successful browser automation run is not evidence of mobile GPU performance. Engine and asset budgets remain provisional until actual-device measurements. |
| C-07 | Adding a photo-library person with usable photos makes another memory journey available using the shared avatar; no person-specific model is required. Automatic generation remains conditional future BL-01 and would require reconsidering the avatar premise. |

## Acceptance evidence and references

The [technical foundation design](../designs/001-technical-foundation.md), [asset pipeline](../designs/002-asset-pipeline.md), [connection/person contract](../designs/003-photo-connections-and-people.md), [memory-journey design](../designs/004-memory-journey.md), and [PLAN-002](../../.agents/plans/002-foundation-prototype.md) define the initial trial. It establishes the browser/API/storage foundation and prepared-asset workflow. No application has been built or deployed for this proposal.

The existing [repository comparison](../reference/repository-conventions.md) and [hosting context](../ops/001-hosting-context.md) provide the local precedents. External documentation was checked on 2026-09-10; dependency versions will be fixed during the prototype.
