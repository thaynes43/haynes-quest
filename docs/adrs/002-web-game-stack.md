# ADR-002: Browser game stack and saved-game storage

- **Status:** Proposed
- **Date:** 2026-09-10
- **Decision lead:** Astra; recommendation under Tom's instruction to establish the stack first
- **Related requirements:** [PRD-001 R-01, R-03, R-08–R-19](../prds/001-project-brief.md)
- **Builds on:** [ADR-001: Authentik sign-in](001-authentik-sign-in.md)

## Context and problem statement

The game needs animated 3D characters, touch and desktop controls, conventional sign-in and save-selection screens, persistent player saves, and configured photo connections. Users supply a photo-service URL, API key, and people; retrieved photos drive game content and an open-ended generated-character roster. It will run in the existing homelab Kubernetes environment and be accessed as a normal web app on iPad, iPhone, and PC. The owner explicitly excludes native iOS/TestFlight delivery. There is no current requirement for multiplayer or a visual level editor.

## Decision drivers

- A code-driven 3D workflow that can be tested and maintained from the dev pod.
- A practical mobile-browser baseline and a stable model/animation format.
- Reuse of the household's TypeScript, authentication, database, and GitOps experience.
- Few runtime services and clear separation between frame-by-frame gameplay and account data.

## Considered options

| Option | Fit and tradeoff |
| --- | --- |
| **Babylon.js with a React shell** | Recommended. Animation, asset loading, input facilities, collisions, and optional physics are available within one engine. We still own game behavior, the controls, and the save system. |
| Three.js + React Three Fiber + Rapier | Capable alternative with declarative React scene composition. More separate systems must be joined for input, physics, animation, and gameplay. Prefer it if that composition becomes a central design need. |
| Godot web export | Strong editor-led alternative. Adds a separate engine/build boundary around the web application; its web renderer and mobile limitations need consideration. Visual editing could justify it; native export is outside the confirmed delivery scope. |
| PlayCanvas | Credible browser engine with an optional editor and a standalone npm workflow. No current requirement gives it an advantage over Babylon for this project. |

These are architectural judgments, not benchmark results. Babylon's capabilities are documented in its [specifications](https://www.babylonjs.com/specifications/). The alternatives were checked against the [Three.js game guide](https://threejs.org/manual/en/game.html), [R3F performance guidance](https://github.com/pmndrs/react-three-fiber/blob/master/docs/advanced/pitfalls.mdx), [Rapier character controller](https://rapier.rs/docs/user_guides/javascript/character_controller/), [Godot web export constraints](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html), and [PlayCanvas standalone workflow](https://developer.playcanvas.com/user-manual/engine/standalone/).

## Recommended outcome

After technical and nontechnical requirements documentation and subsequent tool setup are complete, use the following stack for the foundation prototype. Accept or revise the browser/API/storage choices after their integration and device trial; keep the generator and worker choices open until a real generation trial establishes their fit.

| Layer | Recommendation | Reason |
| --- | --- | --- |
| Language and tooling | TypeScript, pnpm, Node.js | Familiar across the sibling repos; shared types for saves and game commands. Pin compatible supported versions and commit the lockfile when scaffolding. |
| Menus and application UI | React + Vite | Login, photo-connection/person setup, preparation status, saves, character selection, menus, and touch controls. |
| 3D runtime | Babylon.js, loaded when entering the game | Engine-owned frame loop and scene, isolated from React rendering. Use WebGL2 as the initial baseline; WebGPU can be evaluated later. |
| API and hosting | Hono on Node.js, serving the Vite production build and API on one origin | One application image and origin; Hono already has a sibling precedent in `libretto`. |
| Sign-in | Better Auth with Authentik OIDC only | Carries forward Haynes Network's provider/session pattern using the game's own registration. |
| Persistent state | PostgreSQL + Drizzle | Sessions, private photo-connection metadata, configured people, characters, saves, and durable generation-job metadata. Credentials need separate encryption-key delivery. |
| Validation | Zod at API/save boundaries; Vitest and Playwright for appropriate tests | Runtime data validation, save/ownership tests, and browser journeys. Actual hardware still determines graphics performance. |
| Photo integration | Server-side adapter, Immich first | Resolve configured names and query photos within each connection's permissions; do not bake a household URL/key into the app. |
| Character preparation | Persisted jobs and a separate generation worker/provider boundary | Photo selection → references → model/rig → validation → ready asset. Concrete generators and job execution tooling require a capability trial. |
| Developer asset authoring | Image-generated sketches + Blender through MCP | Preferred workflow for shared assets, character templates, rigs, and reusable processing recipes. Bridge/host setup follows requirements documentation and does not select the app's runtime generator. |
| Runtime art | GLB/glTF 2.0, with Blender for prototyping and reproducible processing where appropriate | A shared asset contract independent of the person or generator. Manual Blender work cannot be required for every new roster entry. |

Vite plus Hono is preferred over Next.js for this prototype because the current application is a browser game with a small set of account screens and no established server-rendering need. Next.js remains viable, but adopting it solely to reproduce the sibling stack would add a server/client rendering boundary without a current benefit. Hono supports [Node.js and static assets](https://hono.dev/docs/getting-started/nodejs) and [Better Auth integration](https://hono.dev/examples/better-auth); Vite documents [production builds](https://vite.dev/guide/build).

Better Auth supports [custom OIDC providers](https://better-auth.com/docs/plugins/generic-oauth) and a [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle). Reuse Haynes Network's behavior and tests as references, but verify callback paths, APIs, and adapter imports against the versions actually installed; current documentation differs from the older sibling snapshot. Example providers/passwords in upstream tutorials are not this game's configuration.

Postgres is chosen for operational consistency and server-owned saves, not expected player count. SQLite would suffice for a small single-instance game, but introduces a separate application-volume/backup pattern. Browser-only storage does not provide the proposed account-linked resume experience across devices.

Start with one package and clear client, game, server, and shared modules. Automatic character creation requires background work isolated from API requests and gameplay. The foundation can simulate generation while proving persisted job states and ownership; actual generation needs a worker/provider capability trial. There is no current selection of Redis, a queue library, a generator vendor, or a multiplayer service. Start the movement probe with the smallest collision implementation that exercises the asset; evaluate Babylon's Havok integration only if the controller needs it. Do not store engine scene objects in saves.

## Consequences

| ID | Consequence |
| --- | --- |
| C-01 | React and Babylon need an explicit lifecycle bridge and typed command interface; per-frame motion must stay out of React state. |
| C-02 | The server owns identity and authorization for saves, connections, people, jobs, and generated assets. The setup form can submit a key; saved credentials are never returned to gameplay clients. Photo selection/delivery stays within the configured connection and people. |
| C-03 | The app needs a dedicated database/schema, credentials, migrations, backups, and restore verification through `haynes-ops`; it does not share Haynes Network tables. |
| C-04 | Required engine loaders, optional physics WASM, and mesh/texture decoders must be packaged or served locally. Compressed assets must not silently depend on public CDN defaults. |
| C-05 | Confirmed device families are iPad, iPhone, and PC, using browser-only homelab delivery. Validate touch in iPadOS/iOS Safari and keyboard/mouse in the selected PC browsers. Record exact hardware models and OS/browser versions during the trial; Android is not a required target. |
| C-06 | A successful browser automation run is not evidence of mobile GPU performance. Engine and asset budgets remain provisional until actual-device measurements. |
| C-07 | A provider's named-photo lookup does not generate 3D models. Automatic references, geometry, rigging, and validation are a separate capability to prove, with durable jobs, private assets, bounded compute, and recovery. A simulated generator cannot validate the complete feature. |

## Acceptance evidence and references

The [technical foundation design](../designs/001-technical-foundation.md), [asset pipeline](../designs/002-asset-pipeline.md), [connection/person contract](../designs/003-photo-connections-and-people.md), and [PLAN-002](../../.agents/plans/002-foundation-prototype.md) define the initial trial. It can establish the browser/API/storage foundation; the generator/worker choice remains open until real generation is validated. No application has been built or deployed for this proposal.

The existing [repository comparison](../reference/repository-conventions.md) and [hosting context](../ops/001-hosting-context.md) provide the local precedents. External documentation was checked on 2026-09-10; dependency versions will be fixed during the prototype.
