# WO090: Disable browser zoom throughout the game app

Status: Complete, September 19, 2026. Root Astra owns `/home/dev/work/quest-app-zoom-lock-20260919`, branch `agent/quest-app-zoom-lock-20260919`, from `d8044f7`; release lane `/home/dev/work/quest-app-zoom-release-20260919`. Native Sol owns the viewport harness and bounded review. No authoring jobs.

## Owner correction and contract

Tom clarified that his son was playing and browser zoom must never be available in the game app, regardless of screen or target. Supersede WO089's intentional non-game/start-page zoom exception. DESIGN018 records the app-wide policy and browser/system limits. Root owns UX, source integration, documentation, merge and release; native Sol owns `tests/e2e/phone-viewport-regression.mjs` and ignored browser evidence. Preserve all existing pointer ownership, native menu/dialog scrolling and gameplay behavior.

## Delivery

Add a document-wide CSS/viewport boundary and narrow Safari gesture, Ctrl-wheel and Ctrl/Cmd zoom-shortcut guards. Cover lifecycle cleanup and unrelated input preservation with meaningful unit tests; use actual touch trajectories for browser zoom proof. Reproduce the old start-page zoom, verify the new start/game/return flow plus page/Help scrolling and portrait input regression. Run required checks, merge the app PR, verify published image, promote only private playtest via checked GitOps PR, then verify hosted HTML/JS/CSS and browser results. Declare/end scoped activity and stop owned port 4422 after acceptance. Record exact release evidence here and in the handoff.

## Next stage

After this corrected zoom policy, discuss a few enemy concepts before model production, then lock requirements and ADRs for the level-building platform. No model or family-photo work belongs to this repair.

## Candidate verification

Typecheck, lint, production build and strict documentation/media checks pass. Local tests: 556 passed, with 12 database cases reserved for disposable-PostgreSQL CI. Six new unit cases cover Safari gesture default cancellation, Ctrl-wheel, keyboard zoom, unrelated input, independent event delivery and listener cleanup. The portrait candidate regression passes release/re-arm after failed capture, independent jump/movement contacts, resize geometry and rotation cleanup, with no HTTP/page/console errors.

The expanded viewport candidate keeps start/game pinch and double tap at scale 1, full 844×390 and zero viewport offsets. Native start-page scrolling reaches 295 CSS pixels and Help scrolls 215; app-received zoom shortcuts are cancelled. Entry and leaving retain the neutral viewport. The browser is Chromium 153 touch emulation; the old start-page reproduction and exact report hashes are retained in [the release index](../evidence/app-zoom-lock-release.json). The final published release and hosted acceptance follow.

## Published release and hosted acceptance

[App PR50](https://github.com/thaynes43/haynes-quest/pull/50) passed required checks at `e87b965703eb3eec7baf59f2efa4895e78814c8c` and merged as `2ac16b9cc4840dea19411318ac7615ccf7fd0070`. All 568 CI tests passed, including 12 PostgreSQL cases. Main Application `35476977957` and Documentation `35476977977` passed; publication/provenance/signing succeeded. The OCI index digest was checked against the anonymous registry body; attestation presence was checked, without claiming independent cryptographic verification.

[Ops PR2986](https://github.com/thaynes43/haynes-ops/pull/2986) passed all nine checks at `81d3ad9dbae752d6c9b738be1eda7c95ba2c0b40` and merged as `7984c98dc217c61c0d5f5179f01ce900e49d42ac`. Its rendered runtime diff changes only the private image; a stale direct-main-push instruction was also corrected. Flux and Helm applied the release. Verified image: `ghcr.io/thaynes43/haynes-quest:sha-2ac16b9cc4840dea19411318ac7615ccf7fd0070@sha256:fe0c1c06e52cbb7d3e711999d57a529014111cb0e7b9632d96f3e4473dc0aa68`.

The hosted HTML has initial/minimum/maximum scale 1 and user-scalable=no. Live JS `index-BbxFx3Yj.js` is 1,193,622 bytes, SHA256 `66d829432a86b1d40bc9ac56717011a36d19e84026dc3c2562f63ce4958423a2`; CSS `index-CFAjhIJT.css` is 41,949 bytes, SHA256 `7a844ac3d16e8641b9ef068fa2f2da08fec20bfe5023d1bd20f935084b05cf9d`.

Frozen harness `d943e8410ac2d97fe0b5293ea0a0e06f0a129134c7cd4ad567487e4967788d95` passes hosted report `hosted-app-wide-release-final`, SHA256 `1829aec33c07149714dfcb71e069e3a1272e22cf0adfdf145b524e5e0b845a34`. All nine scenarios pass: start/game pinch and double tap stay scale 1 with full 844×390 and zero offsets; start-page scrolling reaches 295 and Help 215; entry/leave remain neutral; app-received Ctrl-wheel and Ctrl/Cmd zoom shortcuts are cancelled. HTTP/page/console errors are empty. Root inspected the hosted game framing and controls. Independent review found no actionable source/test issues. The initial diagnostic candidate remains separate from the final same-harness baseline/candidate pair.

The final live audit matches the fixed HTML and exact assets, verifies healthy endpoints and zero private container restarts, and confirms unchanged normal Quest/dev-env deployment UIDs, generations, images and pod state. Activity `act-235124-103012` is ended; `quest-app-zoom-fixture` is stopped; port 4422 is closed on IPv4/IPv6; browser contexts are closed. No Blender/audio jobs are owned. Raw reports and audit hashes remain in the release index. Repository-only closeout records need no second game image promotion.

Physical Safari is not established by Chromium touch emulation or unit gesture events. Browser-menu/accessibility overrides and OS magnification remain outside webpage control. The original phone gesture was not captured. Prior chapter/progression tests remain evidence for unchanged combat/level/memory logic; this repair reran viewport and portrait controls rather than the complete two-chapter route.
