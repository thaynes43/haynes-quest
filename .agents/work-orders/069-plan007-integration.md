# WO069: PLAN007 integration and review resolution

Status: completed. Lead Astra max, `/home/dev/work/quest-playtest-reset`, branch `agent/quest-playtest-reset`, merged PR35. The private release is verified under WO070.

## Fable review

[WO068 results](068-fable-plan007-review-results.md) records Fable5.1 xhigh review of exact `b11f97a`, committed and pushed as `04eb71d` on `agent/haynes-quest-0911-212453`. It independently completed both chapters using real runtime/domain/API code with the renderer mocked; it found no blocker. Its 11 intentionally failing probes demonstrate review findings and are retained on the review branch, not imported as failing application tests. The report's lead-tree drift snapshot is historical and predates the fixes below.

| Finding | Lead resolution |
| --- | --- |
| M1 studio cache policy | Explicit no-cache on studio redirect, pages, media and errors; WAV content type retained. Corrected WO063's earlier inaccurate revalidation claim. |
| M2 temporary storage exhaustion | Newest two runs per owner, bounded least-recently-used run/session retirement and oldest unreferenced preview retirement, ephemeral mode only. Retained receipts and ownership remain intact; persisted stores are unchanged. |
| L1 stale-client partial selection | Ephemeral create-save validates six selections and returns 422 before the store. |
| L2 friendly attack cooldown | Friendly and enemy primary attacks now share the plan's 400 ms v3 / 600 ms archived cadence. |
| L3 failed audio source | Failed start removes and disconnects its source, allowing later low-priority effects. |
| L4 interrupted celebration | The open chapter/completion panel retries its one celebration from a direct gesture, with concurrent pointer/touch attempts deduplicated. |
| L5 zero volume | Audio reports silent; header says Sound off and enabling restores 0.8 volume. |
| L6 phantom guard cooldown | V3 exposes its separate secondary cooldown with guard cooldown zero. |
| L7 loose immutable matcher | Exact eight-character suffix on JavaScript/CSS only; tested unhashed assets revalidate. |
| L8 fixture media reads | Public fictional SVGs remain public like their catalog exports, with the existing bounded read limiter. |
| N1 shortcut timestamps | Accepted bounded setup-clock artifact: completing chapter one clears cooldowns and the next real action succeeds. No player-visible time or age derives from receipt timestamp. |
| N2 jump cue status interval | Accepted present bound of up to 100 ms simulated status cadence; visual motion is immediate. Physical latency remains unverified. |
| N3 passive overlay dead zones | Age/health, objective and boss-health panels now pass pointer contacts through to the world. |
| N4 Besties timing authority | Existing single-player runtime timing gate is preserved; server owns damage, equipment, phase and cooldown, while local routine timing remains client-owned. This is not a multiplayer or anti-cheat claim. |

The lead also preserves defeated encounters after a v3 health-zero retry: surviving enemies regain health, collected gear/minors and prior victories remain. A reducer regression completes the boss and major after retry. Archived v1/v2 retain their original reset contract. The restored contextual interaction control keeps archived v2 touch saves usable; fresh v3 uses contact collection.

## Held-stick recovery correction

The `e305eda…` touch probe established a real product defect: local obstacle recovery cleared movement while the joystick contact and visible knob remained held. V3 now calls `clearActions()` to discard queued actions while retaining movement. Menus, backgrounding and explicit clear still cancel all input; archived v1/v2 recovery stays unchanged. Independent input/runtime regressions pass, including continued movement after a real first-gap fall without another input event.

## Final local validation

The reviewed client is `index-Bn3nnDAn.js`, 1,041,657 bytes, SHA256 `0e795d99f5fd820bc5388c8ae24c350f4214c3ac5a6fbcbdc444b9ae5db43702`. During local QA its backend was the reviewed 399c992 build in owned fixture 4397, exec session 26874; that fixture is now stopped. No new source defect required a rebuild after 8ead835.

[WO066](066-fresh-playtest-browser.md) records exact browser scope. `final-bn3-route-complete` passes an uninterrupted fresh 0 → 4 → 7 route using keyboard movement/jumps and visible touch combat controls: both minors before each boss with age unchanged, all four ordinary enemies and both bosses defeated, both major transitions, six memories complete, Besties dizzy/Bash, deliberately missing Pink fallback/retry and a fresh direct Besties shortcut. Five local obstacle recoveries and zero health-zero combat retries occurred; observed held input remained active after recovery. There were no unexpected page/response/console errors.

`final-bn3-landscape` independently proves real held-stick wand damage: target HP 6 → 3 and authoritative revision 15 → 16 while touch movement stays −1. At 844 × 390, Attack 84 × 84 exceeds Bash 60 × 60; both are inside the viewport and clear of the joystick and header. Help opens/closes. The injected missing Pink model remained as an intentional warning in this separate layout check; the complete route proves retry recovery.

`final-bn3-controls-smoke-pass-2` is a clean real-touch controls/audio/reset pass with no page, response or console errors. It proves new IDs after Leave and reload, discarded revision 1, age-zero Space/world jumps, simultaneous held-stick Attack recognition and world jump, real CDP touch cancellation without jump and with cleared movement, Help test output peak 0.4604, muted output exactly zero and unmute peak 0.3636. The full route separately proves zero-volume restoration to 0.8. The final driver queues down/up commands in protocol order without waiting for a slow-renderer acknowledgement between them. Earlier synthetic-capture and locator-wait errors are retained as driver diagnostics, not final acceptance. Combat still requires authoritative HP/revision changes and defeated states.

A separate tiny held-world-tap diagnostic records canvas pointerdown/up and jumpSequence 2 → 3 while movement stays 1. Earlier negative-Y-only assertions were insufficient because falling also lowers Y. Cached Chromium accepts a partial-contact touchEnd extension outside the documented CDP empty-end contract; a documented active-set touchMove did not release the canvas contact in the observed probe. Slow software rendering makes host 10/70 ms waits produce roughly 500 ms DOM contact spans. Do not portray this driver as portable WebKit coverage or the complete hybrid route as touch-only.

The [sanitized acceptance record](../../docs/assets/media/playtest/v003/local-acceptance.json) preserves source-run status and exact claims without browser credentials or session identifiers. Actual final-client screenshots and capture hashes are in the same versioned folder and linked from the playtest guide. Native Sol memory_route completed the [local catalog audit](../../docs/assets/media/playtest/v003/catalog-local.json): 37 entries, 54 thumbnails, 28 review pages, 26 exact GLBs and both eight-clip Besties viewers. Desktop 1440 × 1000 and phone 390 × 844 passed with no overflow or unexpected errors. The catalog browser lease is released.

At source 8ead835 all PR checks are green: application verification, container build and strict docs. CI ran **350 passing tests in 42 files**, including all ten real Postgres cases (Application run 34666768788). Local checks passed typecheck/lint/build and 340 tests with those ten DB cases skipped. One interim f51dd5f CI run caught a nullable assertion in a newly added test; it was corrected before these green checks. Final evidence, harness formatting, repository lint/typecheck and strict documentation now pass. The final commit must pass PR checks before merge.

## Limits and release boundary

Measured active frame samples on the exact final client average 9.82 fps in chapter one and 9.34 fps in chapter two under headless SwiftShader. This misses the device frame budget and does not establish physical iPhone/iPad performance. Cached WebKit cannot launch because required GStreamer host libraries are absent. Physical Safari controls, speaker audibility, child response and exact final-art review remain owner inspection, not automated claims.

Both Fable tasks were reaped after their reports/probes were pushed and preserved under `test-results/fable-reviews/`. There is no authoring lease, generation, private photo, OAuth or dev-env restart. PLAN007 is deployed and verified. Application PR35 and operations PR2862 are merged; [WO070](070-plan007-live-release.md) records the exact artifact, all 23 live checks, hosted controls/Besties/artwork/catalog evidence and ended activity.
