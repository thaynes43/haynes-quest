# WO075: Rendered-state observation

- **Status:** Complete — ready for coordinator review
- **Model / dispatch:** Native GPT-5.6 Sol, `xhigh`, fresh delegated context
- **Worktree / branch / base commit:** `/home/dev/work/quest-rendered-state-observation`; `agent/quest-rendered-state-observation`; integrated observation commit `9ce3ba0`
- **Depends on / stable contracts:** `GameHandle.inspect()` remains read-only; `GardenScene` owns actual memory roots and composite encounter visuals; `BestiesScene` owns the two actor roots and animation mixers.
- **Owned paths:** Diagnostic-only changes in `src/game/types.ts`, `src/game/createGame.ts`, `src/game/scene.ts`, `src/game/besties-scene.ts`; focused scene-observation tests where necessary; this work order.
- **Boundaries:** No gameplay behavior, UI/copy/layout, asset, browser-control, persistence, server or builder implementation changes. No media URL or private content in diagnostics.

## Outcome and scope

Expose a small serializable `SceneVisualInspection` through the existing `GameHandle.inspect()` result so browser checks can observe what Three.js is actually rendering. The inspection reports each memory ID with its concrete scene-root `visible` value. When the active encounter has a Besties visual, it also reports both actor IDs, effective visibility through their ancestor chain, world position, selected animation clip and world-space samples for the authored `head`, `hand_L` and `hand_R` bones when those nodes are loaded.

The runtime scene method remains optional so existing test doubles and non-rendering harnesses do not need diagnostic boilerplate. Inspection reads existing scene objects only and does not provide mutation hooks.

## Deliverables and verification

- Add typed visual inspection data to `GameInspection`.
- Implement `BestiesScene.inspectVisuals()` from actor roots and loaded bones.
- Implement `GardenScene.inspectVisuals()` from memory roots and any nested Besties scene.
- Wire the optional scene inspection into `createGame().inspect()`.
- Verify direct scene observations cover actual v3/archived memory-root visibility, actor animation/position samples, ancestor visibility and finite defeat hiding.

Verification completed in `/home/dev/work/quest-rendered-state-observation`:

- `pnpm vitest run tests/game/artwork-fallback.test.ts tests/game/besties-scene.test.ts tests/game/runtime.test.ts` — 3 files, 26 tests passed.
- `pnpm typecheck` — passed.
- `pnpm exec eslint src/game/types.ts src/game/createGame.ts src/game/scene.ts src/game/besties-scene.ts tests/game/artwork-fallback.test.ts tests/game/besties-scene.test.ts tests/game/runtime.test.ts --max-warnings 0` — passed.
- `pnpm lint` — passed.
- `pnpm test` — 42 files passed, 1 skipped; 363 tests passed, 10 skipped.
- `pnpm build` — client and server builds passed; Vite retained the existing informational chunk-size warning for the 1,046.38 kB client bundle.
- `git diff --check` — passed.

The observations contain no URLs, labels, save titles, memory dates or media content. Bone samples are absent while authored nodes are unavailable, and the selected clip is `null` until a loaded animation action has actually been chosen. Effective Besties visibility covers the actor root and every current Three.js ancestor; it does not claim camera-frustum visibility or pixel occlusion.

## Integrated full-route assertions

The follow-up extends `tests/e2e/fresh-playtest.mjs` without changing its control path. Each contacted minor now waits for its matching Three.js memory root to report `visible: false`. The Besties fight records selected clips plus bounded actual actor/head samples, requires both loaded head poses, and proves that each actor's rendered position or pose changes without requiring a particular routine phase. After authoritative defeat, the route waits on both actors reporting the selected `defeat` clip and effective `visible: false`; this replaces the fixed 4.5 second delay and tolerates slower frame pacing with a 20 second condition timeout.

The follow-up was source-reviewed and checked with:

- `node --check tests/e2e/fresh-playtest.mjs` — passed.
- `pnpm exec eslint tests/e2e/fresh-playtest.mjs --max-warnings 0` — passed.
- `git diff --check` — passed.

The full browser route was deliberately not run because the coordinator owns the CPU fixture and final route execution.

## Handoff

The coordinator owns the final API/design review and browser run. The follow-up commit is based on `9ce3ba0`; no PR or deployment is part of this work order.
