# WO069: PLAN007 integration and review resolution

Status: final integration in progress. Lead Astra max, `/home/dev/work/quest-playtest-reset`, branch `agent/quest-playtest-reset`, draft PR35. No PLAN007 live release yet.

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
| N3 passive overlay dead zones | Objective and boss-health panels now pass pointer contacts through to the world. |
| N4 Besties timing authority | Existing single-player runtime timing gate is preserved; server owns damage, equipment, phase and cooldown, while local routine timing remains client-owned. This is not a multiplayer or anti-cheat claim. |

The lead also preserves defeated encounters after a v3 health-zero retry: surviving enemies regain health, collected gear/minors and prior victories remain. A reducer regression completes the boss and major after retry. Archived v1/v2 retain their original reset contract. The restored contextual interaction control keeps archived v2 touch saves usable; fresh v3 uses contact collection.

## Validation boundary

WO066 owns browser evidence. Preliminary runs established fresh reset behavior, touch combinations, nonzero output and both chapter transitions. A complete independent Besties touch run reached age seven, recovered a deliberately missing Pink model and restarted fresh. Later continuous-route probes are still in progress; repeated short stick pulses at 8.31 fps software rendering caused local obstacle resets and are being replaced with deliberate held-stick navigation. Do not call those zero-recovery passes: the early counter tracked only health-zero dialog retries. The current browser bundle before final review rebuild is `index-KZwwQTdX.js`, SHA256 `b333306a82560974dd7635787951ab0d6012241c23be992bc2ca9f7baa53cc28`.

CI at `528ac89` passed all 333 tests including ten Postgres cases, docs and container build. Later local suite passed 328 / 10 skipped; focused review regressions and final full checks are still being completed. One interim CI run on `f51dd5f` caught a nullable assertion in the newly added retry test; the assertion was corrected and local typecheck passed. Do not substitute these interim results for final PR checks.

WebKit cannot launch here because required GStreamer libraries are absent. Physical iPad/iPhone Safari controls, device performance, listening and final-art approval remain open. No private photo, OAuth, asset generation or dev-env restart occurred.
