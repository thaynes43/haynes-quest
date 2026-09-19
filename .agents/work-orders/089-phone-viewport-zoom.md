# WO089: Phone viewport zoom during gameplay

Status: Complete, September 19, 2026. Root Astra owns `/home/dev/work/quest-phone-zoom-20260919`, branch `agent/quest-phone-zoom-20260919`, from `cbbb80f`. Operations release preparation is isolated in `/home/dev/work/quest-phone-zoom-release-20260919`.

## Report and contract

Tom's phone playtest otherwise worked, including the prior control and memory repairs, but the view became enlarged and stayed that way until he quit. The supplied landscape screenshot enlarges the DOM action buttons as well as the scene and crops away the HUD/movement control. Native page zoom is the leading diagnosis; do not claim the exact triggering gesture without evidence.

Gameplay gestures must not magnify or pan the browser viewport. Cover the entire game surface, including passive HUD areas and spaces around controls, while retaining independently owned joystick/action contacts and camera dragging. Preserve vertical scrolling inside Help, Memories and other game dialogs. Normal non-game pages retain browser scrolling and zoom; do not globally disable user scaling or add page-wide gesture cancellation as a shortcut. Keep the existing camera, layout, assets and progression unchanged unless reproduction establishes another cause.

Reproduce the old behavior with real browser touch gestures and measured viewport scale/offsets, then verify the candidate, rapid action taps, multiple fingers, rotation, and dialog scrolling. Preserve actual browser limitations; Chromium emulation is not physical Safari acceptance. A direct forced page-scale command may be diagnostic but is not proof of a user gesture regression.

## Implementation ruling

The game root currently admits `auto`, while the canvas and thumb controls separately use `none`. Header chrome and the fixture label therefore permit page gestures. Set the game root to `pan-y`, restricting zoom across its descendants while preserving native vertical dialog scrolling. Do not restore the previous root `none`: WO074/WO076 record a WebKit scrolling concern that caused its removal. This is a CSS gesture-boundary repair; no camera, viewport metadata or event lifecycle changes are required by the current evidence.

Source audit found fixed camera field of view and aspect-dependent distances, with no camera zoom input. A trusted two-contact browser pinch beginning on the old chapter heading reproduced page scale 1→1.2160116, visual width 844→694.07 and horizontal offset 0→83; the same gesture on the canvas stayed at scale 1 and zero offsets. The baseline screenshot crops the HUD and controls, matching the reported class of failure. The original phone gesture and OS magnification settings remain unknown.

## Candidate verification

The production candidate has `index-BkwX-UiJ.css`, 41,908 bytes, SHA256 `55c0f3cd2eaec7ac3625bd9c6356ae3fd5007dd265582f3ff5d248f8678eab12`. Its `index-C4SUeEy7.js` is byte-identical to the previous deployed JavaScript: 1,193,022 bytes, SHA256 `c1ebea0d164c81561b58495dc2a992149bcb9ff1ccc34d651408b3cf319de81c`. Verify the stylesheet as well as the JS during publication and release; the JS digest alone cannot establish this fix.

Local typecheck, lint, production build, strict documentation/media build and all 550 available tests pass. Twelve PostgreSQL cases require CI's disposable database. The existing strengthened portrait browser regression also passes against the candidate, including failed-capture release/re-arm, independent action/movement fingers, geometry recalculation on same-orientation resize and rotation cleanup. Its report is `test-results/portrait-completion-regression/phone-zoom-candidate/report.json`, with no response, page or console errors.

The final same-source viewport harness has SHA256 `8dad2b514f5bce1ffc8c5d6387a9c485dc5969a8aa155f21081f9626714e625e`. The hosted baseline report `hosted-baseline-final-20260919-1910` reproduces header zoom 1→2.4589865, width 844→343.23 and horizontal offset 0→392. Candidate `candidate-pan-y-final-20260919-1912` keeps header, canvas, passive HUD, Attack and Help pinch attempts plus header double taps at scale 1, full 844×390 viewport and zero offsets/page scroll. Actual touches remain trusted and their hit surfaces are asserted. A native Help swipe scrolls 0→215 while its viewport stays neutral; ordinary start-page pinch still reaches 2.155×. Header, joystick, action area, Jump and Attack stay entirely visible. Bash is not rendered at the unarmed spawn, so this is not a separate equipped-Bash bounds claim.

The final baseline and candidate reports have no HTTP, page or console errors. Earlier diagnostic reports are retained under separate labels, not relabeled as final-harness runs. Independent review strengthened trace isolation, target assertions, viewport neutrality and visible-control checks before the final pair. Root inspected the baseline's enlarged/cropped screen and the candidate's normal framing. [The release index](../evidence/phone-viewport-release.json) preserves compact observations, exact report hashes and browser limits. The same frozen harness also passes against the newly deployed private release; see the hosted report and rollout evidence below.

## Published release and acceptance

[Application PR48](https://github.com/thaynes43/haynes-quest/pull/48) merged as `9a01cbd034b50031638c81bc3e899089cd5eed1b` after exact-head application, documentation and container checks. All 562 CI tests passed, including the 12 disposable PostgreSQL cases. Main publication run `35475207317` completed image build/push, provenance, SBOM and signing. Anonymous registry retrieval confirmed the OCI index digest; attestation presence was checked, without claiming independent cryptographic verification.

[Operations PR2985](https://github.com/thaynes43/haynes-ops/pull/2985) passed all nine checks at `26e8ea7c96d39025602e0da96d823b2fd4305dff` and merged as `8ee4b5f40ce9856f8b5e6fb5f04b475f40756649`. Only the private playtest image changed in the rendered deployment. Flux applied that revision and Helm release 10; the running image is `ghcr.io/thaynes43/haynes-quest:sha-9a01cbd034b50031638c81bc3e899089cd5eed1b@sha256:3d5b0fd20b05f26e8f055ae6d180c86d4d432e7c240b6f01de9f90bba66bd678`.

Hosted report `hosted-release-final-20260919-2324` passed on September 19 at 23:24 UTC with SHA256 `d6917405905626a88c8cd210b5f01c45c86f2197c90b401dd0fecde3432547f8`. The frozen native-touch harness verified the exact new CSS and JS. All gameplay pinch attempts and header double taps retained scale 1, full 844×390 viewport and zero offsets/page scroll. Help scrolled 0→215; ordinary start-page pinch still reached 2.155×. Initial header, joystick, action cluster, Jump and Attack remained fully visible; Bash was absent at the unarmed spawn. HTTP, page and console errors were empty. Root inspected the normal framing in the final hosted screenshot.

The final rollout audit matches the exact hosted JS and CSS above, confirms both apps' health/readiness endpoints, and proves normal Quest and dev-env retain their baseline deployment UIDs, generations, images and pod state. The private playtest is ready with zero container restarts. Scoped activity `act-232102-94203` is ended; the owned `quest-phone-zoom-fixture` tmux session is stopped and port 4421 is closed. Browser contexts are closed. [The release index](../evidence/phone-viewport-release.json) contains the audit observations and raw report hashes. Repository-only closeout records do not require a new game image promotion.

This verifies Chromium 153 mobile touch emulation. Physical Safari acceptance, OS accessibility zoom, and the original phone gesture remain unverified; do not describe this as device-level proof. The earlier full two-chapter and missed-memory recovery runs remain valid evidence for the unchanged JavaScript; they were not repeated for this CSS-only repair.

## Ownership and delivery

- Root Astra owns diagnosis ratification, UX, user-visible text, shared documentation, integration and release.
- Native Sol `regression_review` audits source and proposed regression coverage, then independently reviews the bounded change.
- Native Sol `browser_finish` owns `tests/e2e/phone-viewport-regression.mjs` and ignored browser reports, using isolated contexts and actual controls.
- Native Sol `release_finish` prepares read-only deployment evidence and the private image-only operations lane. Root authorizes the exact candidate once application publication is verified.

Run meaningful browser checks plus required typecheck, lint, tests, production and strict documentation checks. Carry application and private-image GitOps PRs through exact-head green checks, squash merge and hosted verification. Declare scoped rollout activity and verify normal Quest/dev-env isolation. End owned processes and activity after acceptance; preserve compact evidence in git.

## Next stage directed by Tom

After this small repair, discuss and produce a few more enemy models, then lock down requirements and ADRs for the level-building platform. This latest sequence precedes the previously planned personal-photo implementation; its authorization and privacy requirements remain applicable when that stage begins. Choose the next encounter concepts with Tom before expensive authoring, retain exact-version art review, and use existing DESIGN012/016 and PLAN010 as inputs to the platform decisions rather than treating them as already settled requirements.
