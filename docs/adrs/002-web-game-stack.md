# ADR-002: Browser game stack and saved-game storage

- **Status:** Proposed
- **Date:** 2026-09-10
- **Decision lead:** Astra; recommendation under Tom's instruction to establish the stack first
- **Related requirements:** [PRD-001 R-01, R-03, R-08–R-16](../prds/001-project-brief.md)
- **Builds on:** [ADR-001: Authentik sign-in](001-authentik-sign-in.md)

## Context and problem statement

The game needs animated 3D characters, touch and desktop controls, conventional sign-in and save-selection screens, persistent player saves, and protected Immich photo delivery. It will run in the existing local Kubernetes environment. There is no current requirement for multiplayer, native app export, or a visual level editor.

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
| Godot web export | Strong editor-led alternative. Adds a separate engine/build boundary around the web application; its web renderer and mobile limitations need consideration. Prefer it if visual editing or native export becomes central. |
| PlayCanvas | Credible browser engine with an optional editor and a standalone npm workflow. No current requirement gives it an advantage over Babylon for this project. |

These are architectural judgments, not benchmark results. Babylon's capabilities are documented in its [specifications](https://www.babylonjs.com/specifications/). The alternatives were checked against the [Three.js game guide](https://threejs.org/manual/en/game.html), [R3F performance guidance](https://github.com/pmndrs/react-three-fiber/blob/master/docs/advanced/pitfalls.mdx), [Rapier character controller](https://rapier.rs/docs/user_guides/javascript/character_controller/), [Godot web export constraints](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html), and [PlayCanvas standalone workflow](https://developer.playcanvas.com/user-manual/engine/standalone/).

## Recommended outcome

Use the following stack for the foundation prototype. Accept or revise the proposal after the prototype establishes its integration and device fit.

| Layer | Recommendation | Reason |
| --- | --- | --- |
| Language and tooling | TypeScript, pnpm, Node.js | Familiar across the sibling repos; shared types for saves and game commands. Pin compatible supported versions and commit the lockfile when scaffolding. |
| Menus and application UI | React + Vite | A browser application for login, saves, character selection, menus, and touch controls. |
| 3D runtime | Babylon.js, loaded when entering the game | Engine-owned frame loop and scene, isolated from React rendering. Use WebGL2 as the initial baseline; WebGPU can be evaluated later. |
| API and hosting | Hono on Node.js, serving the Vite production build and API on one origin | One application image and origin; Hono already has a sibling precedent in `libretto`. |
| Sign-in | Better Auth with Authentik OIDC only | Carries forward Haynes Network's provider/session pattern using the game's own registration. |
| Persistent state | PostgreSQL + Drizzle | Durable per-user saves and application sessions; reuse familiar migrations and cluster database operations. |
| Validation | Zod at API/save boundaries; Vitest and Playwright for appropriate tests | Runtime data validation, save/ownership tests, and browser journeys. Actual hardware still determines graphics performance. |
| Runtime art | GLB/glTF 2.0, produced from editable Blender sources | A shared asset contract independent of final character appearance. |

Vite plus Hono is preferred over Next.js for this prototype because the current application is a browser game with a small set of account screens and no established server-rendering need. Next.js remains viable, but adopting it solely to reproduce the sibling stack would add a server/client rendering boundary without a current benefit. Hono supports [Node.js and static assets](https://hono.dev/docs/getting-started/nodejs) and [Better Auth integration](https://hono.dev/examples/better-auth); Vite documents [production builds](https://vite.dev/guide/build).

Better Auth supports [custom OIDC providers](https://better-auth.com/docs/plugins/generic-oauth) and a [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle). Reuse Haynes Network's behavior and tests as references, but verify callback paths, APIs, and adapter imports against the versions actually installed; current documentation differs from the older sibling snapshot. Example providers/passwords in upstream tutorials are not this game's configuration.

Postgres is chosen for operational consistency and server-owned saves, not expected player count. SQLite would suffice for a small single-instance game, but introduces a separate application-volume/backup pattern. Browser-only storage does not provide the proposed account-linked resume experience across devices.

Start with one package and clear client, game, server, and shared modules. There is no present need for a multi-package monorepo, Redis, background worker, or multiplayer service. Start the movement probe with the smallest collision implementation that exercises the asset; evaluate Babylon's Havok integration only if the controller needs it. Do not store engine scene objects in saves.

## Consequences

| ID | Consequence |
| --- | --- |
| C-01 | React and Babylon need an explicit lifecycle bridge and typed command interface; per-frame motion must stay out of React state. |
| C-02 | The server owns identity, save authorization, and photo selection/delivery. The browser receives only the resources its session is allowed to use. |
| C-03 | The app needs a dedicated database/schema, credentials, migrations, backups, and restore verification through `haynes-ops`; it does not share Haynes Network tables. |
| C-04 | Required engine loaders, optional physics WASM, and mesh/texture decoders must be packaged or served locally. Compressed assets must not silently depend on public CDN defaults. |
| C-05 | Exact touch hardware is still unconfirmed. Until specified, design for iPadOS Safari, Android Chrome, and desktop browsers, and record which devices are actually tested. This is a provisional compatibility scope. |
| C-06 | A successful browser automation run is not evidence of mobile GPU performance. Engine and asset budgets remain provisional until actual-device measurements. |

## Acceptance evidence and references

The [technical foundation design](../designs/001-technical-foundation.md), [asset pipeline](../designs/002-asset-pipeline.md), and [PLAN-002](../../.agents/plans/002-foundation-prototype.md) define the trial and its acceptance evidence. No application has been built or deployed for this proposal.

The existing [repository comparison](../reference/repository-conventions.md) and [hosting context](../ops/001-hosting-context.md) provide the local precedents. External documentation was checked on 2026-09-10; dependency versions will be fixed during the prototype.
