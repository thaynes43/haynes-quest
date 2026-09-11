# WO-038: Playtest artifact contract results

- **Status:** Complete on `agent/quest-playtest-artifacts`.
- **Owner:** Native GPT-5.6 Sol, xhigh; bounded artifact-test lane.
- **Base:** `35c6c62f43697b73cb29ea3dcb62dc90c978fe0b` from `agent/quest-parody-obby`.
- **Owned files:** `tests/game/parody-artifact-contract.test.ts`, `tests/e2e/parody-catalog.mjs`, this result, and `docs/assets/media/parody-playtest-audit/v001/`.

## Result

The new `parody-catalog-v2` exposes six encounter identities backed by four unique completed v001 assets. The test derives that unique physical set from `PARODY_CANDIDATES`, requires every selectable identity to resolve through the production `parodyArtwork` resolver, and locks the encore aliases to their intended source assets:

| Selectable encounter     | Resolved asset         |
| ------------------------ | ---------------------- |
| `mister-hiss`            | `mister-hiss@v001`     |
| `peel-patrol`            | `peel-patrol@v001`     |
| `drama-dragon`           | `drama-dragon@v001`    |
| `sir-flush-a-lot-encore` | `sir-flush-a-lot@v001` |
| `peel-patrol-encore`     | `peel-patrol@v001`     |
| `drama-dragon-encore`    | `drama-dragon@v001`    |

Neither the archived `nap-captain` nor `one-star-diva` identity or asset is selectable in v2. Their absent/incomplete published artifact pairs are not opened or required by this test.

## Exact delivered files

| Asset           | GLB bytes | GLB SHA-256                                                        | Manifest bytes | Manifest SHA-256                                                   |
| --------------- | --------: | ------------------------------------------------------------------ | -------------: | ------------------------------------------------------------------ |
| Mister Hiss     | 1,202,456 | `14bcfe2dcc060cbfd6908a281de0795f6b426144a63d322f89f1ec234e42572f` |         93,676 | `b7ad2d5672747bc2b13be5b0e776c0edb0dd8841c74652feb8b84789b70b3a89` |
| Peel Patrol     |   652,424 | `72962eb3a1cb2a08e13d9082dd506fbe7186798f48d0dee7af3cdd72b7891ed5` |         65,809 | `350734a909e7043e5093a503a03361cea5030d08b8bfa009f57a636ca28e97b9` |
| Drama Dragon    |   917,980 | `13c6cb5185385f85cda2e16027ad201a2ea1e2a4ad0f5eb7a13cba9d073fa933` |         84,422 | `ac5b4c432518f7f1e9275cc6b9a95f30ab2fe0955c8e055da4cdca1c9ced9281` |
| Sir Flush-a-Lot |   782,488 | `c4db8f231fcdb29d71ddc605df89b928ef0aeaa29b91af3b1e3041041f0cdf49` |         58,013 | `1c29300de08956176879b9bc1e1407ef359c4918f5ed9248c4f25568696fb2ad` |

The four GLBs total 3,555,348 bytes and the four manifests total 301,920 bytes. The test checks the file bytes and hashes against these fixed values, then also verifies each manifest's own GLB declaration against the file.

## Runtime and resource counts

| Asset           | Binary buffer bytes | Triangles | Primitives | Materials | Images | Textures | Skins | Ground height | Contact fraction |
| --------------- | ------------------: | --------: | ---------: | --------: | -----: | -------: | ----: | ------------: | ---------------: |
| Mister Hiss     |           1,145,660 |    12,872 |          3 |         3 |      1 |        3 |     1 |        1.00 m |            0.600 |
| Peel Patrol     |             588,856 |     9,084 |          4 |         4 |      1 |        4 |     1 |        1.15 m |            0.625 |
| Drama Dragon    |             831,380 |    11,960 |          3 |         3 |      1 |        4 |     1 |        1.80 m |            0.625 |
| Sir Flush-a-Lot |             741,444 |    14,676 |          5 |         5 |      1 |        5 |     1 |        1.00 m |            0.625 |

The enforced upper limits are 2 MiB per GLB, 15,000 triangles, six primitives and six materials. Each GLB must also have one embedded buffer, one embedded image, one skin, no external buffer/image URI, and no required extension. Mesh-node transforms stay identity and rest geometry starts at ground Y=0.

Every asset has exactly `idle`, `move`, `attack`, `hit`, and `defeat`. Durations in seconds are locked in the manifest and checked against animation sampler data:

| Asset           | Idle | Move | Attack | Hit | Defeat |
| --------------- | ---: | ---: | -----: | --: | -----: |
| Mister Hiss     |  2.5 |  1.0 |    1.5 | 0.5 |    2.0 |
| Peel Patrol     |  2.5 |  1.2 |    1.6 | 0.6 |    2.0 |
| Drama Dragon    |  3.0 |  1.6 |    2.0 | 0.7 |    2.4 |
| Sir Flush-a-Lot |  2.5 |  1.0 |    1.6 | 0.5 |    2.0 |

Attack contact time must equal the attack duration times the production resolver's contact fraction in both manifest declarations.

## Verification

- `pnpm exec vitest run tests/game/parody-artifact-contract.test.ts` — passed, one file and five tests.
- `pnpm exec eslint tests/game/parody-artifact-contract.test.ts` — passed with zero warnings.
- `pnpm exec prettier --check tests/game/parody-artifact-contract.test.ts` — passed.
- `pnpm typecheck` — passed.
- `git diff --check` — passed.

## Harness default follow-up

After the browser evidence was captured, the catalog harness default was narrowed from the six-ID historical allowlist to the four completed playtest assets: Mister Hiss, Peel Patrol, Drama Dragon and Sir Flush-a-Lot. `QUEST_PARODY_IDS` still accepts any explicit subset of all six known IDs, so Nap Captain and One-Star Diva remain available for deliberate archive audits without being demanded by a default playtest run. The report's `defaultIds` field now records the actual four-item default rather than the broader allowlist.

The prior successful browser audit already supplied those same four assets explicitly through `QUEST_PARODY_IDS`, as shown in its command and `selectedIds`. No browser was launched and no site build was performed for this follow-up.

- `node --check tests/e2e/parody-catalog.mjs` — passed.
- `pnpm exec eslint tests/e2e/parody-catalog.mjs` — passed with zero warnings.
- `pnpm exec prettier --check tests/e2e/parody-catalog.mjs` — passed.
- `git diff --check` — passed.

## Four-asset frozen-site browser audit

After the focused contract commit, the existing catalog harness audited the root worktree's unchanged built site at `http://127.0.0.1:4392` with source commit `356791d911b4a7835d16d24990fceb89814bb3d9`. The bounded run finished in 34 seconds, closed its own Playwright browser, and released the exclusive site freeze.

The audit passed in Chromium 153.0.8010.12 with requested SwiftShader rendering at a 390 × 844 touch viewport:

- four review pages returned 200 and loaded their exact same-origin GLB in one working WebGL 2 viewer;
- all 20 clips advanced and paused; eight repeating actions used infinite repetitions, while 12 one-shots finished, held their terminal time, and restored the Play label;
- all 28 exact MP4s matched their manifest bytes/hashes, decoded a presented frame, and had positive duration and dimensions;
- all 20 expected stills decoded with positive dimensions, and all eight model/reel posters were present;
- all four viewers rendered varied pixels at 356 × 356, fit the portrait viewport without horizontal overflow, and changed camera orbit under real CDP touch drags;
- all four GLBs had embedded image/texture resources and no external URI;
- all four main editable masters were retrieved from their declared internal artifact paths and matched exact manifest bytes/hashes;
- page errors, console errors, HTTP error responses, unexpected failed requests, external requests, and audit failures were all zero.

Four `animations.mp4` page requests recorded `net::ERR_ABORTED` only after successful 206 metadata responses. Each corresponding video had fired `loadedmetadata`, reached ready state 4, and had no media error; the separate full-byte fetch and frame decode passed. The harness classified these as expected metadata cancellations.

| Editable master |      Bytes | SHA-256                                                            |
| --------------- | ---------: | ------------------------------------------------------------------ |
| Mister Hiss     |  8,218,611 | `18781a327b2aba9387308daacf5f6e5aaf62851eae5a00e47fb15a2e93bf266a` |
| Peel Patrol     |  9,172,051 | `d9dacbbee93b4b660e64ed351092731016a184fc38a64eb45b73dabe76628e5e` |
| Drama Dragon    | 13,530,294 | `59a45076f2cc5ab6f12b135b8272cbd771a25724d9275cfb98f24948f2fd9561` |
| Sir Flush-a-Lot |  7,491,469 | `228a8ff41533a830d386ff05bb8ba3367039f22ce8580186423bfd97912cfb30` |

The four masters total 38,412,425 bytes.

### Reports and captures

The full ignored report is `/home/dev/work/quest-playtest-artifacts/test-results/playtest-parody-catalog/report.json`, 34,256 bytes, SHA-256 `ad2b21a23d6cb74f14bc91a15fa231ac6dfa35736f395100576edf7383d51e6c`. Its directory also contains four viewer crops used by the varied-pixel checks.

The sanitized tracked report is `docs/assets/media/parody-playtest-audit/v001/report.json`, 33,033 bytes, SHA-256 `728ad04d7f6330da9a2787d6d77c90594b092027aa7d61f548cc55355d017bec`. Its four sanitized full-page captures are:

| Capture                          |     Bytes | SHA-256                                                            |
| -------------------------------- | --------: | ------------------------------------------------------------------ |
| `mister-hiss-page-phone.png`     | 1,310,216 | `c98b030dc3738c06c9d484161cf9ef704a1aa8082aee0276397a3d7468239526` |
| `peel-patrol-page-phone.png`     | 1,183,570 | `56bbfc67f705e2fa5b9dfd2ef448ad3a6a20ae926c5fc0cb1e819302b12655eb` |
| `drama-dragon-page-phone.png`    | 1,029,063 | `e76dead1398146a518805fcfb154382b9dc2982e1e757581bbbb324533036771` |
| `sir-flush-a-lot-page-phone.png` | 1,192,260 | `4d1a67153d9d1ca470b78aad73aa97b1b6ad318383acbda65eb4a0359a109c9c` |

Audit command:

```bash
QUEST_E2E_URL=http://127.0.0.1:4392 \
QUEST_REPO_ROOT=/home/dev/work/quest-parody-obby \
QUEST_E2E_RESULTS_DIR=/home/dev/work/quest-playtest-artifacts/test-results/playtest-parody-catalog \
QUEST_E2E_EVIDENCE_DIR=/home/dev/work/quest-playtest-artifacts/docs/assets/media/parody-playtest-audit/v001 \
QUEST_PARODY_IDS=mister-hiss,peel-patrol,drama-dragon,sir-flush-a-lot \
QUEST_SOURCE_COMMIT=356791d911b4a7835d16d24990fceb89814bb3d9 \
QUEST_E2E_OVERALL_TIMEOUT_MS=240000 \
node tests/e2e/parody-catalog.mjs
```

This evidence covers the frozen software-rendered catalog pages and exact public/internal asset delivery. It does not constitute physical iPhone/iPad Safari evidence, gameplay-path evidence, owner art approval, or release promotion. No site build, deployment, authoring mutation, or private-data access occurred in this lane.
