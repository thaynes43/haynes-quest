# WO-034: Parody catalog browser intake results

- **Status:** Partial — the three completed Block Party models passed; the Remix Runway trio was still being authored and was not tested or counted as complete.
- **Owner:** Native GPT-5.6 Sol, xhigh, browser/file/network verification only.
- **Branch/worktree:** `agent/quest-parody-catalog-intake` in `/home/dev/work/quest-parody-catalog-intake`.
- **Base and source manifests:** `9a6a962fc62c68b3e86ec738eae38f02234399c2`.
- **Hosted source:** the frozen studio at `http://127.0.0.1:4392`, serving the root worktree's built `site/`.
- **Run:** 2026-09-11T17:31:41Z.

## Initial three-model result

The bounded audit passed in Playwright 1.63 / Chromium 153.0.8010.12 at a 390 × 844 touch viewport, device scale factor 1, with requested SwiftShader software rendering:

- the Mister Hiss, Peel Patrol and Drama Dragon review pages returned 200 and each loaded exactly one same-origin `model-viewer` with a nonempty WebGL canvas, positive finite dimensions and visibly varied rendered pixels;
- each downloaded GLB matched the exact manifest byte count and SHA-256, parsed as GLB v2 and contained an embedded image and textures with no external buffer or image URI;
- all three models exposed exactly `idle`, `move`, `attack`, `hit` and `defeat`. All 15 selections advanced and paused with stable time. The six repeating clips used infinite repetitions; all nine one-shots used one repetition, reached their declared end, held there and restored the Play label;
- all 15 per-clip MP4 previews, three combined animation reels and three turntables matched their manifest bytes and hashes. Chromium decoded a presented frame, positive duration and positive video dimensions from every file;
- each page's five expected stills decoded with positive dimensions, and the expected model/reel posters were present;
- all three full pages had no horizontal overflow, their square viewers fit the portrait viewport, and real CDP touch drags changed each viewer's camera orbit;
- the three named main editable `.blend` masters were retrieved independently through the manifest's internal `/artifacts/` URL and matched the full manifest byte counts and SHA-256. The audit made no Blender or scene API call;
- page errors, console errors, HTTP error responses, unexpected failed requests and external requests were all zero.

The visible reels produced three `net::ERR_ABORTED` events after successful 206 metadata responses. They were accepted only because each same-origin player had fired `loadedmetadata`, reached ready state 4 and had no media error. The separate full-byte retrieval, manifest comparison and Blob-backed frame decode passed for those reels. Any other cancellation, missing metadata, media error, HTTP error or external request remains a harness failure.

## Exact model and master delivery

| Asset        | GLB bytes | GLB SHA-256                                                        | Main master bytes | Main master SHA-256                                                |
| ------------ | --------: | ------------------------------------------------------------------ | ----------------: | ------------------------------------------------------------------ |
| Mister Hiss  | 1,202,456 | `14bcfe2dcc060cbfd6908a281de0795f6b426144a63d322f89f1ec234e42572f` |         8,218,611 | `18781a327b2aba9387308daacf5f6e5aaf62851eae5a00e47fb15a2e93bf266a` |
| Peel Patrol  |   652,424 | `72962eb3a1cb2a08e13d9082dd506fbe7186798f48d0dee7af3cdd72b7891ed5` |         9,172,051 | `d9dacbbee93b4b660e64ed351092731016a184fc38a64eb45b73dabe76628e5e` |
| Drama Dragon |   917,980 | `13c6cb5185385f85cda2e16027ad201a2ea1e2a4ad0f5eb7a13cba9d073fa933` |        13,530,294 | `59a45076f2cc5ab6f12b135b8272cbd771a25724d9275cfb98f24948f2fd9561` |

The three main masters totaled 30,920,956 bytes. The source manifests also declare export-review and release checkpoints where applicable; this run intentionally retrieved the named main master for each model, matching the earlier catalog audit convention.

## Presentation finding

Mister Hiss's `turntable.mp4` is present in its manifest and hosted media, and its exact file decoded successfully, but the frozen review page does not link it. Peel Patrol and Drama Dragon link their turntables. This does not invalidate the delivered Mister Hiss media, but the final studio page should expose that link when the lead next rebuilds it.

## Evidence and command

The complete ignored report is `/home/dev/work/quest-parody-catalog-intake/test-results/parody-catalog/report.json`, 25,878 bytes, SHA-256 `b257fe65f8cf637791c9f8d1c3392617c367bd5409fdbb49a59ef46cda9c5190`. It records only local/public paths without request queries or credentials.

The compact tracked evidence report is [`docs/assets/media/parody-catalog-intake/v001/report.json`](../../docs/assets/media/parody-catalog-intake/v001/report.json), 24,638 bytes, SHA-256 `a151cdd27a6265ccffe29379e70b4705c3834ef44be936edb063843b3808a765`. The three sanitized full-page captures are alongside it:

| Capture                       | SHA-256                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| `mister-hiss-page-phone.png`  | `0383a775f1f491a4404c6fec05730007f035e2afbec3ac2c59a8131e8508e195` |
| `peel-patrol-page-phone.png`  | `da6747ba05503071f2f728c441526ca03e74330a259583fae0bab8270af53ccc` |
| `drama-dragon-page-phone.png` | `2afa6c6e3357614e8b157709ac730cde554c7714bb4d71a3d5fadea299f989f7` |

Initial bounded command:

```bash
QUEST_E2E_URL=http://127.0.0.1:4392 \
QUEST_REPO_ROOT=/home/dev/work/quest-parody-catalog-intake \
QUEST_E2E_RESULTS_DIR=/home/dev/work/quest-parody-catalog-intake/test-results/parody-catalog \
QUEST_E2E_EVIDENCE_DIR=/home/dev/work/quest-parody-catalog-intake/docs/assets/media/parody-catalog-intake/v001 \
QUEST_PARODY_IDS=mister-hiss,peel-patrol,drama-dragon \
QUEST_SOURCE_COMMIT=9a6a962fc62c68b3e86ec738eae38f02234399c2 \
QUEST_E2E_OVERALL_TIMEOUT_MS=240000 \
node tests/e2e/parody-catalog.mjs
```

`QUEST_PARODY_IDS` accepts a bounded comma-separated subset. When omitted, the harness requires and audits all six frozen parody IDs: Mister Hiss, Peel Patrol, Drama Dragon, Sir Flush-a-Lot, Nap Captain and One-Star Diva. It has a four-minute default overall deadline, closes only its own Playwright browser, and handles `SIGINT`/`SIGTERM` through the same cleanup path.

A separate one-model interruption probe sent `SIGTERM` after one second. The harness recorded only `received SIGTERM`, closed its exact Playwright browser and removed that browser's temporary profile; it did not signal or inspect unrelated browser processes.

## Boundary

This is technical evidence for three delivered candidates. It does not claim that Sir Flush-a-Lot, Nap Captain or One-Star Diva is complete, and it does not approve art, promote assets into gameplay or authorize a private release. The screenshots contain only public synthetic review content. SwiftShader Chromium touch emulation is not physical iPhone/iPad Safari evidence, hardware rendering evidence, a frame-time result or a child playtest. Root retains final visual judgment, and exact owner review remains pending.
