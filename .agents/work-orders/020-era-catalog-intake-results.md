# WO-020: Era catalog browser intake results

- **Status:** Complete.
- **Owner:** Native GPT-5.6 Sol, xhigh, browser/file/network verification only.
- **Branch/worktree:** `agent/quest-era-catalog-audit` in `/home/dev/work/quest-era-catalog-audit`.
- **Base:** `f6a8f0de4a6b132ef5d4244a8bf5f1e37d56d531`; preparation commit `88239e73591c97de7e734dabcd6ddc8a13664153`.
- **Source under test:** `/home/dev/work/quest-era-boss-loop`, HEAD `fc4791f` with the root-owned review/catalog edits still pending commit, as expected. The hosted and source manifests were equal during the run.
- **Run:** 2026-09-11T15:30:49Z against `http://127.0.0.1:4390`, which served the root worktree's `site/`.

## Result

The full audit passed in Playwright 1.63 / Chromium 153.0.8010.12 at a 390 × 844 touch viewport with requested SwiftShader rendering:

- seven review pages and exactly ten GLB viewers returned 200;
- every viewer reported loaded and visible through `model-viewer`, created a real WebGL 2 context, had positive finite 3D dimensions and a nonempty canvas, and produced varied rendered pixels in its viewer screenshot;
- all six creature studies exposed exactly `idle`, `move`, `attack`, `hit` and `defeat`; all 30 clip checks advanced time and paused with stable time;
- all 12 `idle`/`move` checks sent infinite repetitions; all 18 `attack`/`hit`/`defeat` checks sent one repetition, held their completion time, and returned the control label to Play;
- the four equipment viewers exposed no animation clips;
- all seven pages had no horizontal overflow and all ten square viewer frames fit the 390-pixel viewport;
- real CDP touch drags changed `model-viewer.getCameraOrbit()` for Blockling and Spark Mallet;
- built manifests matched the repository manifests, and every downloaded GLB matched its repository byte count and SHA-256;
- all ten named final `.blend` masters were retrieved independently through the internal Blender service's declared `/artifacts/` paths and matched their manifest byte counts and SHA-256. No Blender or scene API was invoked;
- page errors, console errors, HTTP error responses, unexpected failed requests and external requests were all zero.

Chromium reported six `net::ERR_ABORTED` events after successful 206 responses for the creature pages' `<video preload="metadata">` reels. These were classified narrowly as expected metadata-only cancellations: every affected video fired `loadedmetadata`, had `readyState === 4`, had `video.error === null`, used a same-origin public media path and had a prior successful response. Any other cancellation, missing metadata, media error, failed response or external URL remains an audit failure.

## Exact delivery

| Asset         | GLB bytes | GLB SHA-256                                                        | Master bytes | Master SHA-256                                                     |
| ------------- | --------: | ------------------------------------------------------------------ | -----------: | ------------------------------------------------------------------ |
| blockling     | 1,121,948 | `57f8cf41898c856f90d3aa4df50880c242db9718a8df9acbda3fa46d06fcc1cb` |    5,103,852 | `ea7075a8729424bb476c8ee103bee654df2bae077c764d768a1d1dafcc4d52a9` |
| signal-moth   | 1,083,900 | `9e964faf1b483193a399cb0e410a5b6d6e68ccd158c16bf2d2a88cbbaa9144fe` |    4,665,008 | `eec5407e9dd891dcfe2ee7617fed4f771f5e92668f3a2e17b454c69e17b8d22f` |
| buffer-baron  | 1,195,688 | `9d343e07e9d2593fce5ad9c99df29672ac81cc235ea66fdd276199b7c6da6915` |    4,966,578 | `5b262f65de2ccd65c5c65c970088e81fa72b8f14c4eb30e5714d7611c9a9172c` |
| loop-dancer   | 1,096,328 | `99e2ddac66bc2f63fa00e44b1b9b7513c083023d9926343bc67ce52ecfbf9e79` |    5,889,460 | `e1ea1e148f009fe9fd8fa33d44b8895a743a08883091b64b1cfa00a6fde457d0` |
| prism-mimic   | 1,079,220 | `60b6fe89f1397fe32269d6f858f91f3cb9a0c6459f03595d24257830a170aef0` |    5,433,886 | `9279833543039de1a07ab801a07d8db233bd5951a1db7d428e9779d6372ae746` |
| trendweaver   | 1,089,712 | `2191ef48a3e71853f0e67899b9335a18b8e31c5ede33f43e39f24dcd2adc64ce` |    5,589,689 | `ab8730924e3b2025bf0185bc129c67a2b1f4e1f916b4e8c2ec53fc195b003c6c` |
| spark-mallet  |   161,872 | `f7d8607192a1634efd34fa27b708dcfc50cc8cb1185fe7eb5907f11b931b10ae` |      594,982 | `b794e64fc21cb39fd40ba2845c64f435a57f0d0e410b8021c2431ee4c85922c1` |
| acorn-shield  |   184,460 | `2f499570f1579acc066e4b5b50ed91a6540daed799c245ec4f4038a99e3df1c6` |      605,496 | `911ae6b54cefc02622ac9d5682846de355c0dc8237cbbe0514875cd839f31a3b` |
| prism-wand    |   143,444 | `5b4e4abc4989db3579a4240e002561a54952098515e759f30a1ef3c4a35ba1dc` |      586,817 | `ed65e04ebaf8382bf445d923c5840d9292e617f7edd7a8dbca589c89ee153374` |
| ribbon-shield |   197,244 | `cdeae334f480b422df98853358b8b24c7932c81eb20906de3e4bb1583a7448f9` |      609,919 | `6d4cf8de5781564cd1315b510627f8255102394ef2d3fee37425d6c58c8f25ae` |

## Evidence and command

The compact ignored report is `/home/dev/work/quest-era-catalog-audit/test-results/era-catalog/report.json`, 29,974 bytes, SHA-256 `692658a50db529e8d30c69f5c76754d3e26eca6042481974360269ffe6b98538`. Diagnostic request and media locations are recorded as public paths without queries or credentials. Seventeen ignored safe screenshots were retained. Visual inspection found the models visibly rendered in the tested viewport; useful selected evidence is:

- `/home/dev/work/quest-era-catalog-audit/test-results/era-catalog/blockling-page-phone.png`
- `/home/dev/work/quest-era-catalog-audit/test-results/era-catalog/era-equipment-page-phone.png`
- `/home/dev/work/quest-era-catalog-audit/test-results/era-catalog/trendweaver-viewer-phone.png`

Final command:

```bash
QUEST_E2E_URL=http://127.0.0.1:4390 \
QUEST_REPO_ROOT=/home/dev/work/quest-era-boss-loop \
QUEST_E2E_RESULTS_DIR=/home/dev/work/quest-era-catalog-audit/test-results/era-catalog \
node tests/e2e/era-catalog.mjs
```

Prettier, ESLint, the Node syntax check and `git diff --check` also passed after the final script correction.

## Boundary

The six creature models are archived possible friendly/ambient studies. This technical audit does not select them as enemies or approve them for gameplay. The four equipment models remain candidates; no owner approval, gameplay promotion or new private release is inferred. Chromium touch emulation is not physical iPhone/iPad Safari evidence, performance certification or art approval. No private photos, credentials, player/save identifiers, OAuth, database writes, cluster changes, Blender scene changes, deploy, PR or release were involved.
