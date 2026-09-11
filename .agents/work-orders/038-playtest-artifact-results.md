# WO-038: Playtest artifact contract results

- **Status:** Complete on `agent/quest-playtest-artifacts`.
- **Owner:** Native GPT-5.6 Sol, xhigh; bounded artifact-test lane.
- **Base:** `35c6c62f43697b73cb29ea3dcb62dc90c978fe0b` from `agent/quest-parody-obby`.
- **Owned files:** `tests/game/parody-artifact-contract.test.ts` and this result.

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

This is local artifact-contract evidence. It does not build or freeze the root site, run a browser/device journey, approve asset art, publish a private release, or touch authoring/private resources.
