# WO-043 results: retained-touch menu regression

- **Status:** Passed against the frozen `ff3ad87` client
- **Model / dispatch:** Native GPT-5.6 Sol, `xhigh`, fresh context
- **Worktree / branch / base:** `/home/dev/work/quest-touch-menu-regression`; `agent/quest-touch-menu-regression`; `ff3ad873113efa9d65076fb49fc31131f24d0c11`
- **Owned paths:** `tests/e2e/touch-menu-regression.mjs` and this result record

## Delivered regression

The focused browser script reuses `createJourneyDriver()` and its CDP touch controls. It starts one journey through visible setup controls, then keeps the original joystick contact physically down while a second contact opens and closes Help, opens and closes the album, toggles sound, and activates Save & leave. It makes no direct gameplay API mutation. Read-only save requests prove leaving returns the same single journey rather than creating or removing one.

The sound sequence guards the deduplication boundary explicitly: a secondary touch toggles sound, a real keyboard Enter follows within 600 ms and toggles it again, then a normal primary touch and a Playwright mouse click each toggle it exactly once. The script records capture-phase pointer, click, keydown, cancellation and lost-capture events, including trust, pointer type/ID, primary status and `hasPointerCapture()` at dispatch time.

## Actual frozen-client result

- Command: `QUEST_E2E_URL=http://127.0.0.1:4391 QUEST_TOUCH_MENU_TIMEOUT_MS=120000 node tests/e2e/touch-menu-regression.mjs`
- Result: passed in 12.8 seconds including the preceding static checks; zero page errors.
- Client: `/assets/index-BPeATrrp.js`, 1,001,106 bytes, SHA-256 `15487f825f0f7d8125144d3a1eb49c37e5212bf6c7d0bb8de8f368f141bc6051`.
- Runtime: Chromium `153.0.8010.12`, 390×844, DPR 1, mobile/touch context with real CDP touch contacts and SwiftShader launch flags.
- Help open, Help close, album open, album close, sound and Save & leave each received a non-primary trusted touch `pointerup` while the original joystick contact remained down. Chromium reported both target and control implicit capture as `true` at every tested secondary `pointerup`; the application then emitted one untrusted programmatic click for each action.
- Sound labels progressed `Enable sound` → `Mute sound` by secondary touch and back to `Enable sound` by trusted keyboard activation. Keyboard `keydown` arrived 10.9 ms after the synthesized click, inside the 600 ms deduplication window.
- The subsequent primary touch produced one trusted touch click and changed `Enable sound` → `Mute sound`. The subsequent mouse action produced one trusted mouse click and changed `Mute sound` → `Enable sound`.
- Save & leave began with the second joystick input actively moving, activated from a non-primary captured touch, removed the game canvas, and returned one save before/after with the current journey represented exactly once.

The complete ignored report is `/home/dev/work/quest-touch-menu-regression/test-results/touch-menu-regression/report.json` (37,131 bytes). It contains the full 39-event game trace and per-action trace slices. The failure screenshot path is also bounded under that ignored directory.

An initial harness attempt opened Help but compared the requested CDP contact ID with the browser-assigned DOM pointer ID. Chromium assigns DOM IDs independently after earlier setup taps. The script now discovers the observed joystick DOM pointer ID and matches each isolated secondary action by its trace slice. This was a harness correction; no runtime failure was observed.

## Verification

- `node --check tests/e2e/touch-menu-regression.mjs` — passed.
- `pnpm exec eslint tests/e2e/touch-menu-regression.mjs` — passed with zero warnings.
- `pnpm exec prettier --check tests/e2e/touch-menu-regression.mjs` — passed.
- `git diff --check` — passed.
- Focused actual-browser command above — passed.

No full journey, build, server start, gameplay source, UI, copy, assets, documentation site or private inputs are part of WO-043.
