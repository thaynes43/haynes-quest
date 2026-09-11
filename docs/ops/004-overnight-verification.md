# Overnight MVP verification

The private [game](https://haynes-quest.haynesops.com) and [asset studio](https://haynes-quest.haynesops.com/studio/assets/catalog.html) are reachable through the home network’s internal ingress. All player records and pictures used for these checks were fictional. Gameplay uses temporary code-built art and remains silent while candidate assets await review.

## Build and deployment

Application [PR #21](https://github.com/thaynes43/haynes-quest/pull/21) merged as `6263dc42443eb5c33943d26f668da386df4900d4`. Its exact-head checks passed typecheck, lint, all 45 tests including three fresh PostgreSQL 16 integration tests, client/server build, strict documentation/media links and the container build. The [main image workflow](https://github.com/thaynes43/haynes-quest/actions/runs/34564020967) published the immutable image with provenance and keyless signing.

Initial deployed image: `ghcr.io/thaynes43/haynes-quest:sha-6263dc42443eb5c33943d26f668da386df4900d4@sha256:36b363a9e43912691d93a65c776cc9d958101a9d3a4379b7e1f4737e0a3f23b0`. Anonymous manifest, architecture, configuration and layer retrieval passed. Independent attestation download from dev-env was blocked by its existing Azure egress restriction; the successful signing/provenance workflow is the available evidence, and no egress policy was changed for that optional check.

Deployment [haynes-ops #2851](https://github.com/thaynes43/haynes-ops/pull/2851) merged as `6622a9b0988c69de2c9dedd7e51626ed439d2aea` after all nine required checks passed. Flux and Helm became Ready at the expected revision/chart. Normal HTTPS requests passed health, database readiness, studio and catalog checks. The fixture process receives its dedicated application Secret only, with internal-Traefik ingress and DNS/Postgres egress. It has no Immich or database administrator Secret.

## Final catalog release

Application [PR #23](https://github.com/thaynes43/haynes-quest/pull/23) merged as `71c45b5fdba69cb38c59ccd336935218b322cd5c` after all 46 tests, including three fresh PostgreSQL 16 integration tests, typecheck, lint, client/server build, strict docs and container checks passed. [Main workflow 34568145769](https://github.com/thaynes43/haynes-quest/actions/runs/34568145769) published, attested and signed the image pinned in the current handoff.

[Deployment #2853](https://github.com/thaynes43/haynes-ops/pull/2853) merged `026deb4584dac21532547ec174f3a8c36058d66d`. Flux became Ready/Healthy at that exact revision, HelmRelease Ready, and the new pod was Ready with zero restarts and the expected image digest. Normal HTTPS health/readiness/catalog checks passed, as did delivery of all nine `model/gltf-binary` exports and four `audio/wav` auditions. The original runtime Secret, security and network boundaries remained intact. [Ops evidence #2854](https://github.com/thaynes43/haynes-ops/pull/2854) merged `17ac580cea032b91a720043b35865df541214e06`; the rollout activity ended. This rollout created no player records and used no manual pod deletion.

The full live studio browser audit passed at **2026-09-11 06:15:02.885 UTC**, in 23.89 seconds, against that final image:

| Check | Result |
| --- | --- |
| Review inventory | 12 pages, nine visible GLBs, seven traveler clips played/paused, four decoded WAVs |
| Delivery | 112 unique media files, correct MIME and nonempty responses; all model hashes/sizes matched seven exact manifests |
| Phone viewers | All nine visibly rendered at 358 × 358 within the 390 × 844 viewport |
| Touch orbit | Actual CDP touch gestures changed the traveler and keepsake camera orbits |
| Errors | Zero page errors, console errors, bad responses or external requests |

Sol inspected all nine settled live crops; root inspected the live child and stone crops after its earlier complete export intake. See the [safe live report](../assets/media/storybook-reference/v001/browser-intake/catalog-live-report.json), [child browser crop](../assets/media/storybook-reference/v001/browser-intake/live-traveler-child-phone.png), [stone browser crop](../assets/media/storybook-reference/v001/browser-intake/live-clearing-stone-phone.png) and [WO-011](../../.agents/work-orders/011-catalog-verification.md). Browser rendering used Chromium 153 with requested SwiftShader software graphics. Decoding audio does not establish listening quality.

The coordinator rechecked the original dev-env pod UID and all zero restart counts after the final catalog rollout. The local memory-only test harness was stopped by its verified PID. Postdeployment evidence/archive commits do not change the audited runtime image.

## Live play

The coordinator completed the live browser run at **2026-09-11 05:13:46.653 UTC**, using Playwright 1.63.0 and Chromium 153.0.8010.12 with ANGLE SwiftShader rendering.

| Journey | Observed result |
| --- | --- |
| Keyboard | All three chronological memories, visible age-four growth, jump unlock, low-step crossing and finish |
| Save/resume | Leave, reload and continue preserve progress; the next memory remains reachable |
| Touch, 844 × 390 | Complete route with simultaneous stick/camera and stick/jump contacts |
| Portrait, 390 × 844 | Home and game have no horizontal overflow; movement and action controls fit the viewport |
| Cleanup | Pointer cancellation, focus loss and leaving desktop/touch/portrait scenes release inputs/canvases |
| Preferences | Mute and 0.65 volume survive game remount through local storage |
| Browser errors | Zero page errors |

[Machine-readable summary](media/overnight-mvp/journey-evidence.json)

![Live fictional game after the age-four memory unlocks jumping](media/overnight-mvp/game-growth.png)

![Completed live touch-emulation journey](media/overnight-mvp/touch-complete.png)

![Live portrait layout with controls within the viewport](media/overnight-mvp/game-phone.png)

## Persistence and isolation

The deployment lane retained one private signed cookie while creating a three-memory synthetic save and recovering its first two memories. After replacing only the application pod, it verified that the new pod had a different UID and was Ready. The same cookie resolved the same player and identical save state: selected manifest, recovery order, revision, age, abilities, appearance, rule versions and timestamps. The route then recovered its third memory and finished at revision four. A fresh independent session received 404 for both the other player’s save and its media. [Durable ops evidence](https://github.com/thaynes43/haynes-ops/pull/2852) merged as `8a37feb512f4c83a269789d8f705c3b5bfe09681`.

The audit left two synthetic saves: one completed and one partial from an earlier local assertion failure. The browser journeys added two completed saves and one portrait setup save. No direct database deletion was used to tidy these records. Private audit cookie files were removed, no temporary Jobs remained and the scoped activity declaration ended.

Dev-env was not restarted: the coordinator verified its original pod UID and zero container restart counts after the live browser run.

## Limits

Chromium touch emulation and software rendering do not establish physical iPhone/iPad Safari compatibility or frame rate. OAuth, admitted-player access, actual private subject setup/media and photo-derived likeness remain tomorrow’s work. An isolated Immich schema/thumbnail transport smoke is recorded in the handoff; it is not evidence of a real-player application journey. Candidate audio decoding and waveform measurements do not replace listening review, and no candidate model or sound is approved for gameplay.
