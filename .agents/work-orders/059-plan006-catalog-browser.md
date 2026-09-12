# Work order 059: PLAN006 catalog browser audit

Date: 2026-09-11 UTC

Source checkpoint: `3ba5a0c`, exercised through the final local catalog fixture on port 4395 after the released catalog and model artifacts were present.

Status: Completed; the full catalog audit and the focused Besties phone interaction passed.

## Scope and constraints

Extended the existing Playwright catalog audit with a focused Besties review check, then exercised the generated catalog and every inventory-linked review in Chromium. This task changed only the test harness and this technical record. It did not alter catalog content, user-facing copy, layout, application runtime, model assets, deployment state, or the fixture.

The run used a 1440×1000 desktop viewport and a 390×844 touch viewport. Chromium 153.0.8010.12 rendered model viewers through requested SwiftShader WebGL. Physical Safari and final art-quality review were outside this audit.

## Catalog coverage

The browser and delivery checks passed these current contracts:

- 36 unique inventory entries exactly match the 36 catalog cards on both desktop and phone.
- The generated thumbnail manifest contains exactly 53 derivatives. Every source hash, derivative byte count, and derivative hash matches its file, and the manifest source set exactly covers all inventory-selected primary and first-inspiration images.
- All cards fit within each viewport without horizontal overflow, expose non-empty state text, use the inventory-selected generated thumbnails, and link only to their exact inventory review destination. The seven category jump targets exist; the phone Sound auditions jump is usable, desktop keyboard navigation follows a focused card link, and phone tap navigation follows a card link.
- The 36 entries resolve to 27 unique review pages. Every review responds successfully, every inventory fragment exists, every current first-inspiration image is displayed, retained inspiration remains reachable, and each model viewer names the exact inventory GLB.
- All 26 unique model deliveries respond with an accepted binary model MIME type. Their delivered SHA-256 values exactly match inventory, their bodies are non-empty, and their declared response lengths match the received bodies.
- Catalog landing pages request no GLB or WAV files. All inspected images decode to positive dimensions, include alternative text, and are served locally.
- The run recorded zero page errors, console errors, HTTP error responses, unexpected failed requests, and externally hosted image requests.

Fourteen browser-cancelled `preload="metadata"` video requests were recorded separately. The harness accepts only `net::ERR_ABORTED` for exact video URLs declared by an inspected review in the same browser scope; HTTP errors, other resource types, other URLs, and every other request failure remain fatal.

## Focused model interaction

The existing Nap Captain check remains substantive: the phone review loaded its exact model, exposed the expected five clips, produced a non-empty visible model-viewer surface, obtained a WebGL context, and changed camera orbit through a real touch drag.

The new Besties check performs a real phone tap on the Bestie Pink catalog card and verifies navigation to `/studio/assets/reviews/bickering-besties/v001.html#bestie-pink`. On that review page it asserts exactly two independent model viewers and only these two model requests:

- Bestie Pink: `bestie-pink/v001/bestie-pink.glb`, 956,924 bytes, SHA-256 `0f7020f53ed257dd88e6a8cb9e8fb0011c70e84bf33bc2e55fb671473aea96ae`.
- Bestie Black: `bestie-black/v001/bestie-black.glb`, 928,000 bytes, SHA-256 `0819c67a17d38f340ace0ebdaff6bd316a800286af7f7a0da91273e898d80f05`.

Both viewers reported loaded and model-visible, occupied positive 356×356 render surfaces, were visible in the phone viewport when inspected, had finite positive model dimensions, and exposed exactly `idle`, `move`, `attack`, `hit`, `defeat`, `cheer`, `high-five`, and `dizzy`.

The Pink viewer's real selector changed the active animation from paused `idle` to paused `high-five` at time zero. Tapping its Play control advanced `high-five` to 0.0334 seconds while unpaused; tapping again returned the control to Play. This proves the visible selector and playback control are connected to the loaded viewer rather than merely listing clip names.

## Verification evidence

Exact command:

```sh
QUEST_CATALOG_URL=http://127.0.0.1:4395/studio/assets/catalog.html QUEST_E2E_RESULTS_DIR=test-results/catalog-plan006-local node tests/e2e/visual-catalog.mjs
```

Result: PASS with exit code 0.

Static harness checks also pass:

```sh
node --check tests/e2e/visual-catalog.mjs
pnpm exec eslint tests/e2e/visual-catalog.mjs
git diff --check -- tests/e2e/visual-catalog.mjs .agents/work-orders/059-plan006-catalog-browser.md
```

Artifacts under `test-results/catalog-plan006-local/`:

- `report.json` — machine-readable assertions, delivery hashes, diagnostics, and interaction values.
- `catalog-desktop.png` and `catalog-desktop-viewport.png`.
- `catalog-phone.png` and `catalog-phone-viewport.png`.
- `nap-captain-viewer-phone.png`.
- `besties-review-phone.png`.

The browser lease is released after this passing run.

## Hosted release verification

The same harness passed against the private playtest after PR33 / opsPR2860 deployment. [The retained hosted report](../../docs/assets/media/release/v002/catalog-live.json) verifies 36 entries, 53 exact thumbnails, all 26 model files, 27 review pages, desktop/phone navigation and the two eight-clip Besties viewers, including actual high-five selection/play/pause. Page/console/HTTP/unexpected request and external-request failures were zero. Fourteen exact video metadata-preload cancellations were classified separately; this catalog route does not claim full video playback verification. Root also inspected the hosted desktop catalog capture. Physical Safari and owner art-quality review remain open.
