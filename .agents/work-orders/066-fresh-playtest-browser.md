# Work order 066: fresh playtest browser journey

- **Status:** Ready for coordinator review
- **Model / dispatch:** Native GPT-5.6 Sol, `xhigh`, fresh context
- **Required reading:** `AGENTS.md`, `.agents/TEAM.md`, PLAN007, current client/game contracts
- **Worktree / branch / base:** `/home/dev/work/quest-playtest-reset`, `agent/quest-playtest-reset`, `ed7ae72963d9d9902cb42f1fec545d15e659fe25`
- **Owned paths:** `tests/e2e/fresh-playtest.mjs`, this work order
- **Evidence directory:** `test-results/fresh-playtest/` (ignored browser reports and screenshots)

## Scope and harness

`tests/e2e/fresh-playtest.mjs` drives the production-built ephemeral fixture server through the visible UI. It does not seed saves, call mutation APIs directly, teleport, or resume an old record. Successful action responses are observed only to assert the server-authoritative result of UI and game actions; the game inspection surface is read only and steers movement toward visible world targets.

Before browser launch, the harness checks `Cache-Control: no-store` on the root document, discovers the client bundle, checks its immutable cache policy, and can pin its SHA-256 with `QUEST_E2E_BUNDLE_SHA256`. It exercises a 390×844 mobile touch viewport, fresh start and reload behavior, Help and sound controls, age-zero jumps and cancellation, automatic pickups and memories, both ordinary encounters before each boss, major-memory age transitions, Besties dizzy, the direct chapter-two shortcut, missing-artwork recovery, and sampled audio output. Focused modes cover the controls smoke, touch diagnostics, a hybrid route, the runway, and 844×390 landscape controls.

An init script inserts an analyser between the game's compressor and browser destination. Nonzero samples prove that the final Web Audio graph produced signal; zero samples while muted prove graph-level suppression. Headless output cannot prove physical iPad or iPhone audibility.

The first Bestie Pink model request is intentionally answered with 503. The test captures the playable pink fallback, uses the visible Retry artwork action, and waits for `mediaFailed` to clear before continuing. Unexpected page, response, or console errors fail a completed run.

## Exact final-build acceptance

All final evidence below loaded `/assets/index-Bn3nnDAn.js`, 1,041,657 bytes, SHA-256 `0e795d99f5fd820bc5388c8ae24c350f4214c3ac5a6fbcbdc444b9ae5db43702` from `http://127.0.0.1:4397`.

`final-bn3-route-complete/report.json` is the uninterrupted passing journey. It started a new chapter-one session at age zero and completed both chapters to ages four and seven. In each chapter, both minor memories were recovered while age stayed unchanged, both ordinary encounter records were asserted defeated before the boss, Bash damage was accepted, the boss was defeated, and only the major memory advanced age. Besties entered the dizzy phase. The forced Bestie Pink failure displayed a playable fallback and the visible retry restored the actor. All six memories completed, Play again returned home, and Try the Besties chapter created a different session at age four in chapter two. There were no unexpected page or response errors.

Traversal in that report is deliberately labeled hybrid: keyboard movement and jumps with visible touch UI for combat and product actions. The headless SwiftShader renderer made native multi-touch delivery too variable for a dependable ten-minute route. Chapter one sampled 28 frame intervals over 2,849.9 ms: 101.8 ms average / 9.82 fps, p50 116.7 ms, p95 166.7 ms, maximum 249.9 ms. Chapter two sampled 26 intervals over 2,783.3 ms: 107.1 ms average / 9.34 fps, p50 133.2 ms, p95 166.7 ms, maximum 333.3 ms. These are material pod measurements and do not establish physical-device performance.

The uninterrupted journey recorded zero health-loss combat retries and five local course recoveries: one at the first chapter-one gap, one at the chapter-one runway, and three while approaching the chapter-two boss. These counters are intentionally separate. The route therefore does not claim zero traversal resets.

`final-bn3-landscape/report.json` closes the original wand and responsive-control cases. In a naturally reached live encounter, a held touch joystick stayed at `moveX: -1` while touch Attack changed the authoritative ordinary-enemy record from 6 HP to 3 HP and revision 15 to 16. At 844×390, Attack was 84×84, Bash 60×60, the joystick 104×104, and all targets stayed inside the viewport without action/joystick or action/header overlap. Help opened and closed in landscape, then the viewport returned to 390×844. Captures are `final-bn3-landscape/landscape-controls.png` and `landscape-help.png`.

`final-bn3-controls-smoke-pass-2/report.json` is the clean exact-build prefix. It passed fresh leave and reload with three distinct session IDs and revision reset, age-zero Space and world jumps, standalone touch cancellation without motion, simultaneous held joystick plus Attack recognition and world jump, and held joystick plus real CDP `touchCancel`. The cancel left `jumpSequence` unchanged and cleared `moveX` from −0.1444 to zero. Help's test sound reached peak 0.4604, mute stayed exactly zero, and unmute reached 0.3636. Page, response, and console error arrays were all empty. `final-bn3-route-complete/report.json` independently proved zero-volume restoration to 0.8 with nonzero output peak 0.2909 and passive age/objective HUD taps. Its boss-HUD repetition was explicitly skipped because an earlier exact-build run had already passed it.

Failed exact-build driver runs remain diagnostic only. `final-bn3-hybrid/report.json` reached the chapter-one boss after passing the prefix and all three passive HUD taps, then stopped when Playwright auto-waited 30 seconds after Bash changed from ready to cooldown; its old synthetic pointer-cancel path also caused a `setPointerCapture` page error. Two closing smoke attempts then reproduced the known slow-renderer held-world-tap delay before the final driver queued CDP down/up commands in protocol order without waiting for the renderer to acknowledge the down command. None of these failures is counted as release acceptance or a production defect.

Useful current screenshots include `final-bn3-route-complete/chapter-1-route-start.png`, `chapter-1-complete.png`, `besties-pink-fallback.png`, `besties-pink-restored.png`, `besties-dizzy.png`, `chapter-2-complete.png`, and `besties-shortcut.png`. The coordinator selected publication captures separately.

## Touch timing and recovery diagnosis

The first exact-final candidate exposed a real input-continuity bug. After a local course fall, the CDP joystick contact remained physically down while runtime movement stayed zero because recovery broadly cleared input. On final Bn3, `final-continuity/report.json` retained the same touch contact through local recoveries and repeatedly observed `moveY: 0.7222`, proving the coordinator's v3 recovery fix. That diagnostic still failed route navigation after many badly timed generic jumps, so it is continuity evidence rather than a route pass.

`held-world-input-sequence/report.json` isolates multi-touch after zero-volume restoration and passive HUD taps. Chromium delivered joystick pointerdown/move as pointer 10 on `DIV.joystick`, canvas pointerdown/up as pointer 11 on `CANVAS`, advanced `jumpSequence` 2→3, became airborne, and retained `moveY: 1`. The event timestamps spanned about 504 ms and the host CDP calls took 610 ms despite a requested 70 ms hold. A later requested 10 ms hold still took 756 ms host time and about 523 ms in event timestamps. Under 4 m/s movement, that delay can carry the player roughly two metres before release and let local recovery clear the queued jump.

CDP documents empty touch points for `touchEnd`/`touchCancel` and provides no portable partial-release operation. A probe using `touchMove([held])` kept the joystick but emitted no canvas pointerup and did not jump (`held-world-input-active-set/report.json`). Chromium's permissive `touchEnd([contact])` does emit canvas pointerup while retaining the joystick, and that exact-runtime behavior underpins the passing simultaneous-touch evidence. The final driver queues down/up in protocol order rather than waiting through a slow rendered frame between the commands. The harness comments and reports this limitation instead of presenting it as portable protocol behavior. The final route uses keyboard traversal because the software-renderer timing is not representative enough for reliable course automation.

Historical evidence is retained with these corrections:

- A negative player Y value alone was a fall, not proof of a jump. Final assertions use `jumpSequence`, grounded state, and upward displacement.
- `final-besties/besties-shortcut.png` shows the joystick and Attack before Bash gear is collected; it does not show both action buttons.
- Earlier `recoveries: 0` values counted health-zero combat retries only. They do not prove that no local obby recovery occurred.
- The `index-D7Vsv0cM.js` focused Besties pass remains valid for chapter-two behavior and artwork recovery, while current Bn3 reports supersede it for release acceptance.

## Platform and verification

Playwright 1.63.0 and cached Chromium revision 1243 are runnable. Cached WebKit revision 2359 cannot launch in this pod: both GTK and WPE wrappers lack `libgstreamer-1.0.so.0`, with more host-library gaps behind it. No browser or system dependency was downloaded or changed. Physical iPad/iPhone validation and physical audibility remain coordinator-owned limits.

Final harness verification:

- `node --check tests/e2e/fresh-playtest.mjs`
- `pnpm exec prettier --check tests/e2e/fresh-playtest.mjs`
- `pnpm exec eslint tests/e2e/fresh-playtest.mjs`
- exact-build controls/audio/reset smoke: passed with empty error arrays (`final-bn3-controls-smoke-pass-2/report.json`)
- exact-build hybrid route: passed (`final-bn3-route-complete/report.json`)
- exact-build held wand damage and landscape controls: passed (`final-bn3-landscape/report.json`)

The browser was closed and the exclusive lease released after the landscape pass. The coordinator owns the final guide, capture manifest, integration work order, app build, and PR lifecycle.
