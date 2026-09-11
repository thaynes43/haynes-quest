# Work order 055: PLAN006 focused browser verification

- **Status:** Complete
- **Scope:** Isolated test fixture and touch-browser acceptance only
- **Product files changed by this lane:** None

## Harness

`tests/e2e/feedback-fixture.ts` serves three owner-isolated, validated in-memory
checkpoints on port 4396. It advances current V3 and immutable V2 saves with the
production plan builder, archived catalog and gameplay reducer before browser
play. All friendly harm, combat, movement and modal interactions under test use
the rendered touch controls. Existing fixtures on ports 4395 and 4392 were not
modified.

`tests/e2e/playtest-feedback.mjs` checks the exact built client and Besties model
hashes, exercises 820 x 1180 and 390 x 844 touch viewports, records browser and
save evidence, and writes screenshots plus a machine-readable report under the
ignored `test-results/feedback/` directory.

## Browser evidence

- Current V3 friendly: ordinary Attack beside Blockling produced no target and
  no revision or friendly-health change. A full-health greeting remained
  unclaimed. Two deliberately confirmed attacks caused weapon damage, charged
  the two-point player-health penalty only on first harm, defeated the friend,
  and displayed the explicit harm/Make amends feedback. Make amends restored
  four friendly HP and cleared the penalty without claiming the boon. Later
  damage followed by greeting restored two player HP exactly once; reload kept
  the claimed boon and repaired friendly state.
- Web Audio: a browser init script wrapped the native `AudioContext` and its
  gain/source nodes without replacing audio output. The friendly run observed a
  touch gesture before context creation/resume, a running context, connected
  buffer sources with nonzero decoded duration and channels, a zero master gain
  while muted, a context suspension while paused, and the saved volume after
  unmuting. This is graph/lifecycle evidence; nobody listened to the output.
- Immutable parody-catalog-v2 age-four checkpoint: an actual multitouch wand
  attack left joystick input held while the player continued moving and dealt
  three damage to Drama Dragon. The first candidate exposed an arena-edge
  chase condition: the boss could be within its 2.25 m strike radius while the
  arena prevented entry into its shorter preferred stopping radius, so no
  retaliation was dispatched. Root added a focused combat correction and unit
  regression. On the final browser pass, the original no-reposition flow left
  the player stationary at x=0.697, z=-19 after the multitouch proof. The Dragon
  entered windup at 2.234 m and dealt its expected four damage 2.038 seconds
  after browser polling began.
- Current parody-catalog-v3 Besties: both final GLBs returned 200 with their
  pinned hashes, media loading and failure counts reached zero, and the rendered
  phone canvas was nonblank. Both actors, the hazard runway and touch HUD fit in
  the 390 x 844 frame. An attack during `pink-warning` was visibly guarded and
  left the save revision and boss HP unchanged. The routine reached `dizzy`, and
  an actual touch attack then dealt three damage. No page errors or failed HTTP
  responses were observed.

Current exact asset evidence:

- Pink Bestie: 956,924 bytes, SHA-256
  `0f7020f53ed257dd88e6a8cb9e8fb0011c70e84bf33bc2e55fb671473aea96ae`.
- Black Bestie: 928,000 bytes, SHA-256
  `0819c67a17d38f340ace0ebdaff6bd316a800286af7f7a0da91273e898d80f05`.

The clean all-scenarios pass used Chromium 153.0.8010.12 and completed in 87.1
seconds against `/assets/index-CNYrbMX0.js` (1,027,516 bytes, SHA-256
`6ef2c5122471f86cf7c42d5f96bbdc293bd5c79fba9296fb772e26c311350aad`).
Its `test-results/feedback/report.json` records every save transition, audio
graph observation, Dragon phase sample, exact asset response and canvas check.
It observed zero page errors and zero failed HTTP responses.

Selected screenshots:

- `test-results/feedback/ipad-friendly-world.png`
- `test-results/feedback/ipad-friendly-harm-confirm.png`
- `test-results/feedback/ipad-friendly-amends.png`
- `test-results/feedback/ipad-v2-dragon-wand.png`
- `test-results/feedback/ipad-v2-dragon-retaliation.png`
- `test-results/feedback/phone-besties-hazard.png`
- `test-results/feedback/phone-besties-dizzy.png`
- `test-results/feedback/phone-besties-open-hit.png`

## Limits

The run uses Chromium touch emulation and SwiftShader rather than physical
iPad/iPhone Safari. It establishes the actual control path, persistence, model
responses, rendered framing and native Web Audio graph behavior. It does not
claim physical-device performance, child usability, audible listening or Safari
Web Audio behavior.

## Post-baseline jsdom regressions

After the accepted browser baseline, `tests/game/game-screen-feedback.test.tsx`
added four focused React boundary tests for the follow-up client corrections:

- A prompt that remains rendered after the runtime has moved out of friendly
  range refuses its click, leaves the world unpaused, opens no dialog and shows
  the landing guidance.
- A prompt whose fresh runtime inspection still identifies the friend pauses
  the game synchronously while no dialog is mounted, then opens the matching
  friend dialog.
- A locally rejected explicit greeting calls the intended
  `interact-friendly` action and leaves actionable feedback visible inside the
  dialog.
- If the first `pointerdown` audio start returns false, `pointerup` attempts the
  start again successfully. Unmount disposes the audio owner and removes all
  pointerdown, pointerup, touchend, click and keydown gesture listeners.

The suite mocks the `GameHandle` and `QuestAudio` boundaries while rendering the
real `GameScreen` through React DOM in jsdom. It neither changes product code nor
uses a browser. Root expanded the normal Vitest include to cover `.test.tsx`, so
this file is part of the standard test run.

## Besties rendered-target regression

`tests/game/besties-scene.test.ts` covers the F7 spell-endpoint method without a
renderer or asset load. A stub `SceneAssets.attach` constructs the real
`BestiesScene` under a translated, rotated and non-uniformly scaled parent. The
test reads the two actor roots' actual world positions, proves they are distinct
from one another and from the logical boss centre, and verifies that queries
from either side return the nearer actor position exactly.

The test then advances the real `BestiesSimulation` into the middle of the
high-five. Both rendered actors have moved, remain distinct, and become closer;
targeting follows those current world positions rather than either starting
position or the centre. After disposal the scene exposes no target. This return
value is the Besties-first spell endpoint used by `GardenScene` before its
logical enemy-centre fallback.

## Final review-fix integration pass

The established all-scenarios touch run passed again after the Fable and Sol
review fixes on exact source commit `5df49dc`. It completed in 83.7 seconds on
Chromium 153.0.8010.12 against `/assets/index-D3lvcZ1s.js` (1,028,608 bytes,
SHA-256
`718cc412a27bb79d768238f6326f154a0cccb52da555a69ed3ec4ce31173cebe`).

- The current V3 friendly flow retained the full-health gift, excluded the
  friend from normal Attack, applied deliberate harm and its one-time player
  cost, defeated and repaired the friend, delivered the later two-point heal,
  and retained the resulting state after reload.
- Native Web Audio evidence again showed context creation after a gesture, a
  running/resumed context, two decoded nonzero connected sources, zero master
  gain while muted, suspension during pause, and saved volume 0.75. The added
  release/click gesture paths produced additional successful resumes without an
  error.
- The immutable V2 age-four checkpoint kept lateral touch input at 0.5 across
  the wand action, moved the player from x=0 to x=0.439, dealt three Dragon
  damage, then entered a boundary-safe windup at 2.227 m and dealt four player
  damage after 2.030 seconds.
- The current V3 Besties loaded both exact model hashes with zero pending or
  failed media. A closed-window attack left revision and health unchanged; the
  routine reached dizzy and an actual touch attack dealt three damage. The
  phone still shows both full actors and the HUD. The open-hit still captures
  `Zap!` and the wand/impact glow, though its single frame does not clearly show
  the complete beam ending on an actor; the exact endpoint remains covered by
  the composed-world unit regression above.

The final `test-results/feedback/report.json` records zero page errors and zero
failed HTTP responses. All eight named screenshots were refreshed on this
exact build. The isolated port 4396 fixture and browser were closed after the
pass; the port 4395 fixture remained untouched.

## Verification

- `node tests/e2e/playtest-feedback.mjs`: clean all-scenarios pass against the
  exact client hash above.
- `node --check tests/e2e/playtest-feedback.mjs`: passed.
- `pnpm exec eslint tests/e2e/playtest-feedback.mjs tests/e2e/feedback-fixture.ts --max-warnings 0`:
  passed.
- `pnpm exec tsc --noEmit`: passed against the integrated shared worktree.
- `pnpm exec prettier --check tests/e2e/playtest-feedback.mjs tests/e2e/feedback-fixture.ts .agents/work-orders/055-plan006-browser-results.md`:
  passed.
- Scoped `git diff --check`: passed.
- `pnpm exec vitest run tests/game/game-screen-feedback.test.tsx`: one file,
  four tests passed.
- Combined screen, audio and touch-activation run: three files, 18 tests
  passed.
- `pnpm exec eslint tests/game/game-screen-feedback.test.tsx --max-warnings 0`:
  passed.
- Follow-up `pnpm exec tsc --noEmit`: passed against the integrated shared
  worktree.
- Follow-up scoped Prettier check: passed.
- `pnpm exec vitest run tests/game/besties-scene.test.ts`: one test passed.
- Combined Besties scene, routine and runtime run: three files, 40 tests passed.
- Besties scene scoped ESLint, full TypeScript and scoped Prettier checks:
  passed.
- Final `node tests/e2e/playtest-feedback.mjs`: clean all-scenarios pass on
  commit `5df49dc` and the exact `index-D3lvcZ1s.js` hash above.
