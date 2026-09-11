# Work order 058: PLAN006 catalog static audit

Date: 2026-09-11 UTC

Source checkpoint: `3ba5a0c`

Status: Completed; current catalog data is internally consistent and the root resolved all stale friendly-role statements found during the audit.

## Scope and constraints

Audited the current asset inventory, catalog cards, thumbnail manifest, inventory-linked review pages and media, released Besties delivery records, runtime artwork manifest, and the source catalogs that select playtest models and sound cues. This task did not launch a browser, rebuild MkDocs, alter source or user-facing documentation, operate Blender, change a scene, deploy, or open a PR.

`docs/assets/playtest.md` is concurrent root work. Its two referenced future captures, `docs/assets/media/playtest/v002/friends.png` and `docs/assets/media/playtest/v002/besties-phone.png`, were explicitly known pending QA inputs and were excluded from the initial missing-link finding. The browser lane supplied both paths before this audit closed; their current file presence is verified here, while their visual acceptance remains with that lane and the root.

## Static inventory and link results

A read-only source audit produced the following passing invariants:

- `scripts/assets/catalog-inventory.json` contains 36 unique entries: five reference-sheet entries, 26 model entries/files, one concept-only entry, four audio entries, 25 completed model candidates, one paused partial candidate, and one owner-approved entry. These derived values exactly equal its declared `counts` object.
- `docs/assets/catalog.md` contains exactly the same 36 unique `data-asset-id` cards. Each card contains its inventory-selected review destination and the generated primary thumbnail. All 26 model cards also contain the generated thumbnail for their current first inspiration image.
- All 105 media paths declared directly by inventory records exist. All 35 inventory checksum entries match their files.
- The 36 inventory entries resolve to 27 unique review pages. Every inventory review fragment exists. For every one of the 26 models, its review page exposes both the exact GLB and its current first concept image: 52/52 required model-review targets.
- Across the catalog, playtest guide, and 27 inventory-linked reviews, 726 local links were resolved, including 618 local media links. There are no missing targets in the current working tree. The two QA captures were absent during the initial scan and present during the closing scan.
- `docs/assets/media/catalog-thumbnails/v001/manifest.json` contains 53 unique source-to-derivative mappings. Every source hash, derivative byte count, and derivative hash matches. Its source set exactly equals the primary/inspiration sources derived from the current inventory, and its 53 paths exactly equal the committed WebP files in the thumbnail directory: no omitted or orphan derivative.
- `scripts/assets/bickering-besties/sha256-manifest.json` contains 68 unique delivery paths; every file, byte count, and SHA-256 matches. The Pink and Black per-asset manifests contribute 24 and 20 exact file records respectively, all covered by that delivery manifest. The 15 authoring-source records in `catalog-intake.json` also match their checked-in files and hashes.
- Bestie Pink and Bestie Black inventory, runtime metadata, per-asset manifests, catalog intake, review tables, and `playtest/v002/artwork.json` agree on the final GLB identities: Pink `0f7020f53ed257dd88e6a8cb9e8fb0011c70e84bf33bc2e55fb671473aea96ae` / 956,924 bytes; Black `0819c67a17d38f340ace0ebdaff6bd316a800286af7f7a0da91273e898d80f05` / 928,000 bytes.

## Runtime artwork result

A read-only TypeScript check imported the actual source catalogs and resolvers rather than maintaining a second expected list. It combined:

- seven shared scene model URLs from `src/game/scene-assets.ts`;
- four equipment resolutions from `equipmentArtwork`;
- six friendly identities from `FRIENDLY_CATALOG_V1`;
- every `parody-catalog-v3` entry resolved through `parodyArtwork`, including the two-file Besties composite; and
- all four `playtestCues` from `src/client/audio.ts`.

After de-duplication, the source selected exactly the same 23 GLB paths and four cue paths listed by `docs/assets/media/playtest/v002/artwork.json`. Every listed byte count and SHA-256 matches its repository file, every cue checksum also matches the runtime cue record, and the manifest metadata identifies `parody-catalog-v3`, archived v1/v2 catalogs, and `friendly-catalog-v1`.

The model source groups are seven shared scene models, four equipment models, six friendly models, and six rendered parody actors/models. There are no runtime-only files absent from v002 and no v002 file absent from current runtime selection.

## Resolved friendly-role framing

The catalog landing page, playtest guide, DESIGN005, DESIGN013, inventory states, and the opening/current-role text on all six resident model reviews correctly identify Blockling, Signal Moth, Buffer Baron, Loop Dancer, Prism Mimic, and Trendweaver as friendlies. The initial audit found six statements that still described their superseded enemy/boss role:

1. `docs/assets/reviews/era-combat/v001.md:3` says the sheets define “six original enemies.”
2. `docs/assets/reviews/era-combat/v001.md:27` labels Buffer Baron as a boss.
3. `docs/assets/reviews/era-combat/v001.md:63` labels Trendweaver as a boss.
4. `docs/assets/reviews/era-combat/v001.md:83` says the production does not establish “an implemented friendly role,” although PLAN006 now implements it.
5. `docs/assets/reviews/buffer-baron/v001.md:7` calls Buffer Baron the Pixel Orchard boss.
6. `docs/assets/reviews/trendweaver/v001.md:7` calls Trendweaver the Ribbon Fair boss.

Before audit close, the root corrected all six statements and also replaced the Loop Dancer construction description that said its wind-up announced an attack. A closing exact-string scan across `era-combat`, Buffer Baron, and Trendweaver found none of the seven superseded phrases. The final copy identifies all six as residents, describes Loop Dancer's motion as a greeting, and keeps exact-art review pending.

The individual review pages still name the authored `attack`, `hit`, and `defeat` clips. Those are factual exported clip identities and were not classified as stale links or role assignments. `docs/assets/catalog-history.md` also retains older state language, but its opening explicitly labels the page as the pre-September-11 historical inventory and points readers to the current catalog and playtest guide, so this audit did not treat archival wording as a current-state defect.

No other stale counts, broken inventory/review/media links, missing generated thumbnails, runtime-manifest gaps, or negative friendly-role assignments were found.

## Verification evidence

- Read-only inventory/catalog/review/media audit: PASS; 36 cards, 53 thumbnail hashes, 105 inventory paths, 35 inventory checksums, 726 local links, 618 local media links, 52 model-review targets, and zero current missing targets.
- Read-only released Besties delivery audit: PASS; 68/68 unique delivery records, 44/44 per-asset manifest file records covered, and 15/15 authoring source hashes valid.
- Read-only source-to-v002 runtime manifest audit: PASS; 23/23 unique GLBs and 4/4 cues with exact byte/hash agreement.
- `pnpm exec vitest run tests/game/parody-artifact-contract.test.ts tests/game/scene-catalog.test.ts`: PASS; two files and 18 tests.
- Closing friendly-role scan: PASS; all seven superseded enemy/boss/aggression phrases are absent from the three corrected review documents.
- Root reported the strict documentation build PASS after applying the review-copy fixes and adding both QA captures; this audit did not duplicate that concurrent build.

Browser rendering, responsive card layout, physical Safari, listening review, and visual acceptance of the two concurrently supplied QA screenshots remain separate evidence owned by the active browser/root lanes.
