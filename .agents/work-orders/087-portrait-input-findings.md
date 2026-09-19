# WO087: Portrait joystick input findings

Status: Input repair implemented in the shared WO085 worktree on September 19, 2026. Root owns integration, browser evidence and release.

## Diagnosis

The reported upper-left latch has a direct source-level reproduction. `Joystick` caught a failed `setPointerCapture`, but its claimed fallback still depended on `pointerup` or `pointercancel` reaching the joystick element. If Safari delivered the terminal event elsewhere, the component retained both the owning pointer ID and the last nonzero analog vector. Later contacts were rejected because the stale owner was still present. Unmounting the game reset the component and input, matching the reported recovery.

The same input layer also allowed a failed canvas capture to throw and retained its camera contact when an off-target release reached only the window. Page suspension cleared input through blur or hidden visibility only; it did not cover `pagehide` or document `freeze`. Same-orientation window resize already preserved a held stick, but a mobile browser chrome change may report only through `visualViewport`.

Before the implementation change, the new focused reproduction failed with the last `moveY` still `0.7071067811865475` after an off-control window release instead of the expected zero. This was a deterministic unit failure against base `191f8c2`, not a physical-Safari observation.

## Repair

- The joystick now observes movement and terminal pointer events in the window capture phase. Capture success is an optimization rather than a correctness dependency. Only the exact owning `pointerId` may update or release movement.
- A compatibility `touchend`/`touchcancel` fallback records the owning `Touch.identifier` from the joystick's `touchstart`; another finger's terminal event cannot clear the stick. If no owning touch identifier was observed, it deliberately does not guess.
- Touch contacts are retained briefly so ownership can be associated whether `touchstart` or `pointerdown` arrives first. Association uses the accepted pointer's coordinates rather than TouchList order, and ended unowned contacts are pruned before a later pointer can select them. A held mouse or pen can never acquire a later touch identifier.
- Cleanup releases capture when possible, returns the knob and both movement axes to neutral, and retires ownership. It runs for owner release/cancel, lost capture, leaving the viewport, blur, hidden visibility, `pagehide`, document `freeze`, orientation change and unmount. A subsequent valid touch is accepted without remounting the game.
- Window and `visualViewport` resize/scroll changes in the same orientation remeasure the actual control and recalculate the held vector from its last contact. A real orientation change clears movement.
- The canvas input binding now tolerates capture failure, retires off-target camera contacts on window release, and clears all input on `pagehide` or document `freeze`.
- Action buttons now use the same finite pointer/touch ownership rule. An off-button owner release ends the held action after capture failure; cancellation discards its pending edge. Another finger cannot release the action or the movement stick, and unmount/page interruption cannot leave an action held.

The existing action and movement channels remain independent. Tests exercise a second finger's cancellation while the first keeps the stick held. No copy, layout, route, server, asset, infrastructure or deployment behavior changed in this lane.

## Verification

- Failure-before: the focused GameScreen case failed on base behavior with the upper-left vector still held after off-control release.
- Fix-after: `pnpm vitest run tests/game/game-screen-memory-notice.test.tsx tests/game/input.test.ts` passes 27 tests in two files.
- `pnpm typecheck` passes.
- Scoped ESLint over both changed source files and their direct tests passes with zero warnings.
- `git diff --check` passes.

The regressions cover capture failure, both pointer/touch start orders, a stale pre-pointer touch ending, raw owner touch end, unrelated-finger termination, TouchList reordering, a mouse owner remaining independent from touch, a usable subsequent press, simultaneous held stick plus action, `pagehide`, document `freeze`, visual-viewport remeasurement, orientation cleanup and failed canvas capture. The repository browser lane received the exact capture-failure and simultaneous stick-plus-action scenarios for candidate validation.

## Remaining boundary

No physical iPhone Safari session ran in this lane, and the actual phone's event sequence is unobserved. The implementation tolerates either relative order for `touchstart` and `pointerdown`. If an owning touch identifier cannot be observed at all, the exact-pointer and page-lifecycle paths remain active and the code avoids clearing movement for an unrelated finger. Browser automation can prove the native event paths in Chromium, but the original device's exact event sequence remains a physical-device acceptance boundary.
