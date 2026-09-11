# WO-006: Bounded garden gameplay

- **Status:** Ready for review
- **Model / dispatch:** Native GPT-5.6 Sol, `xhigh`, delegated by the Astra coordinator
- **Context:** Fresh development agent with a self-contained gameplay brief
- **Required reading:** `AGENTS.md`, `.agents/TEAM.md`, `.agents/plans/004-overnight-mvp.md`, `docs/designs/009-overnight-contracts.md`, `docs/designs/007-poc-development-loop.md`, `docs/designs/006-memory-age-and-abilities.md`, and `docs/assets/art-direction.md`
- **Worktree / branch / base commit:** `/home/dev/work/quest-game`, `agent/quest-game`, base `bd55863`; shared scaffold cherry-picked at `599258f` from lead commit `948d917`
- **Depends on / stable contracts:** `src/shared/contracts.ts` `SaveView`; direct Three.js `0.186.0`; DESIGN-009 input, progression, appearance, level and palette contracts
- **Owned paths and remote resources:** `src/game/**`, `tests/game/**`, `.agents/work-orders/006-game.md`; no remote authoring resources, Blender scene, image generation, candidate assets or audio

## Outcome and scope

Implement a disposable direct-Three.js garden scene and a pure gameplay simulation for one ordered 1–24-memory route, exercised for the required 3–24 range. The initial route remains flat through the age-four memory. When a later memory exists and the manifest can unlock jump, a low step follows that unlock; otherwise the whole required path is flat. Recovery and completion remain server-authoritative through callbacks that return `SaveView`.

The temporary traveler uses code-built infant and child proportions from `storybook-v001`. The scene contains only matte procedural greybox geometry and synthetic keepsake shapes. React UI, player copy, server code, shared contracts, approved assets, audio and final layout remain coordinator-owned.

## Inputs and authoring contract

Export `createGame({container, save, onRecover, onFinish, onStatus})`. Its handle exposes `updateSave(save)`, independent `setInput(action, value)` channels for `moveX`, `moveY`, `lookX`, `lookY`, `jump`, and `interact`, `clearInput()`, `inspect()`, and `dispose()`. Keyboard uses camera-relative WASD/arrows, E, and Space. Canvas pointer drag controls the camera while ignoring `[data-quest-ui]`; touch camera capture starts on the right half. Pure joystick math is exported for coordinator-owned touch controls.

Callbacks return authoritative `SaveView` values. The client does not infer an unlock or recovery while a request is pending. Disposal invalidates every pending callback. Status is structured state only and contains no user-facing prose.

## Deliverables and verification

- Direct Three.js scene lifecycle with capped simulation time, Y-up meter scale, safe resume checkpoint, collisions, camera and complete resource/listener disposal.
- Code-built age variants whose foot position, controller state and camera framing survive authoritative appearance changes.
- Ordered keepsakes, conditional low step, finish interaction and inspection/status integration.
- Pure controller/input/progression tests covering reachability before/after jump, 24-memory order, appearance proportions, simultaneous inputs/cleanup and async authority/disposal.
- Actual typecheck, lint and focused/full test evidence recorded below before handoff.

## Checkpoints

1. 2026-09-11: isolated worktree created at the requested base; all required contracts read; lifecycle/input proposal accepted by the coordinator; shared scaffold imported.
2. 2026-09-11: implemented the pure controller, route, input and authoritative-progression core plus the disposable Three.js garden renderer. The route test reaches both flat memories without jump, remains blocked by the raised section, then reaches the last memory after the age-four jump unlock. A 24-memory no-unlock route remains ordered and flat.
3. 2026-09-11: direct shared-worktree tool binaries passed TypeScript `--noEmit`, ESLint over `src tests` with zero warnings, and Vitest (11 tests in 3 files). `git diff --check` passed. Browser/WebGL rendering, React integration, browser automation and physical touch devices remain lead integration checks; no such coverage is claimed here.

## Handoff and recovery

Cherry-pick only the unique gameplay commit after shared scaffold commit `599258f`; the branch log is the commit record. No independent PR or merge. No mutable authoring scene or queued generation exists. The gameplay uses only temporary procedural geometry and contains no audio resources, candidate assets or private media.
