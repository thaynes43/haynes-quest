# WO084: First-chapter major-memory completion findings

Status: A matching failure path reproduced and focused regressions added, September 19, 2026. Native Sol investigated from `/home/dev/work/quest-playtest-blockers-20260919` at base `191f8c2`; root Astra owns integration, visible wording, browser acceptance and release under [WO085](085-portrait-and-completion-repair.md).

## Finding and ruling

The raised Garden reward geometry is sound. Drama Dragon stands on `dragon-clearing` at feet height `y=0.3`; the adjacent `garden-reward` surface and major-memory anchor are also at `y=0.3`. The platforms touch at `z=-120.3`, and the major at `(0, 0.3, -122.3)` is inside the runtime's 1.4-metre horizontal and 0.12-metre feet-height contact bounds. A real controller walk from the boss anchor across this terrace automatically dispatches the eligible major memory and applies the chapter-two save.

The reported symptom can be reproduced through a silent prerequisite gate; the exact original phone state was not captured. V2 boss availability deliberately permits reaching and defeating the boss after passing earlier content. On boss defeat, `memoryIsReleased` exposes the major and the scene renders it. `nearestMemoryId` separately excludes that visible major until both minor-memory states are `revealed`; a forced authoritative request is also correctly rejected with `MEMORY_BUNDLE_INCOMPLETE`. Walking into the large visible memory therefore does nothing when either little memory was missed. This preserves the designed two-minor prerequisite but gave no explanation or recovery direction.

Root ratified keeping the large memory visible as the post-boss destination and keeping the authoritative prerequisite. Root owns peripheral guidance beside the memory counter: after victory it identifies how many little memories remain and directs the player back along the route, then directs the player into the big memory once both are collected. No progression rule, persistence format, memory location or contact tolerance changes are needed.

## Regression coverage

- `tests/game/authored-v2-runtime.test.ts` reproduces a player standing grounded on the visible released Garden major with one minor missing: no major request dispatches. It then proves the missing second minor remains collectable during `memory-released`.
- The same file starts the real controller at the Drama Dragon anchor with both minors recovered, holds ordinary forward movement over the raised terrace, observes automatic major recovery, and applies a response that enters `besties-playground-v2` at age 4 and its chapter spawn.
- `tests/game/authored-traversal.test.ts` reverses all five physical edges from `dragon-clearing` through the ferry and stepping platforms to `memory-grove` for infant and child proportions. Every edge starts supported, lands without recovery and reaches its target, so post-boss backtracking to the second memory is physically available.
- The existing `tests/server/boss-route-persistence.test.ts` remains the authoritative store boundary: with one minor missing, premature major recovery returns 409 `MEMORY_BUNDLE_INCOMPLETE`; after recovering the minor, both chapter transitions persist and reread successfully.

Focused verification after adding the runtime and traversal cases:

```text
pnpm exec vitest run tests/game/authored-v2-runtime.test.ts tests/game/authored-traversal.test.ts tests/server/boss-route-persistence.test.ts
Test Files  3 passed (3)
Tests       55 passed (55)

pnpm exec eslint tests/game/authored-v2-runtime.test.ts tests/game/authored-traversal.test.ts --max-warnings 0
exit 0
```

This is source/unit evidence, not a physical-device or hosted acceptance claim. WO085 requires the final browser journey to cover the visible missed-minor guidance, backtracking, raised major contact, first chapter transition, and independent second chapter completion before release.

## Independent integrated-input review

The major-memory lane performed a read-only review of the final joystick, action-button and browser-input changes before browser acceptance. The review initially found three concrete ownership holes: the raw-touch fallback assumed one Pointer Events/Touch Events start order; an action button could remain held after capture failure and an off-button release; and touch association could trust `changedTouches[0]` or bind a new touch to a mouse-owned control. The input lane corrected all three before the candidate was frozen.

The final implementation keeps pending raw touches until an accepted touch pointer can bind the nearest starting coordinates, works with either start order, tracks whether the accepted pointer is actually touch, prunes ended pending contacts before checking ownership, and filters every pointer/touch release or cancellation to the owning contact. Action buttons apply the same capture-failure and lifecycle cleanup without clearing a separately held joystick. Window movement, release, cancellation, viewport exit, page/visibility/freeze interruption and orientation cleanup are paired with listener removal. Same-orientation window or visual-viewport changes remeasure the held joystick and retain its owner.

The W3C [Pointer Events](https://www.w3.org/TR/pointerevents/) specification defines pointer dispatch and capture, while [Touch Events](https://www.w3.org/TR/touch-events/) orders touch events relative to compatibility mouse events; neither provides a normative cross-model Pointer Events/Touch Events order on which this runtime should depend. The regression suite therefore exercises both orders rather than claiming an actual Safari event order was reproduced. It also covers a closer stale non-owner touch ending before pointer association, an unrelated TouchList entry ending first, subsequent valid presses, held-stick independence and a mouse owner surviving a new touch.

Final focused review checks passed: 27 input/GameScreen tests, scoped ESLint, TypeScript typecheck and `git diff --check`. No remaining actionable source or unit-test finding was identified. This does not replace the WO085 real browser and physical-device limitations.
