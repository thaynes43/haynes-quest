# WO047 — Browse every existing asset visually

Status: In progress. Owner request, 2026-09-11: dispatch a subagent to organize all existing assets in MkDocs with inspiration images, 3D review and visible thumbnails on the catalog navigation page.

Lead: Astra max (layout, user-facing copy, integration and review). Inventory and mechanical wiring: fresh native Sol xhigh. Worktree: `/home/dev/work/quest-visual-catalog`, branch `agent/quest-visual-catalog`, base main `9ccc7a8d89210f6da9ba12e031e124eade52ba6b`.

## Scope and presentation contract

- Replace the text-heavy catalog landing page with accessible, responsive thumbnail cards, grouped into parody characters, travelers, world and keepsakes, equipment, preserved creature studies, reference sheets, and sound auditions. Give each distinct existing model its own card, including all path-kit pieces and all four tools; shared review pages may use section anchors.
- Each card links to its versioned review, shows a real existing render or concept thumbnail and a plain readiness label. Model cards pair the original inspiration/construction image with the available interactive model on their review page. Do not imply that a render is the inspiration image.
- Keep exact-version evidence and existing deep links. Clearly distinguish completed candidates, concept-only candidates, paused partial models and creature studies rejected for enemy use. No owner approval is inferred. The Besties and FNAF discussions do not yet have assets.
- Use existing images and models only. No image generation, Blender authoring/render jobs, audio generation, paid API calls, family photos, OAuth work or dev-env changes. Retain all historical sources.
- Navigation must work without JavaScript. Thumbnail cards should not instantiate model viewers or preload all GLBs. Existing local review viewers provide orbit/animation/download fallbacks. Root owns CSS and final visible text.

## Delegated deliverable

Inventory all existing concepts, GLBs, auditions and review records against the repository and preserved authoring records. Return a machine-readable manifest at `scripts/assets/catalog-inventory.json` with stable id, existing title, category, review path/anchor, concept image(s), model image(s), exact model/audio path(s), version and factual state. Paths are repository-relative. Identify missing pairings and unlisted artifacts; do not silently claim a partial export is finished. Do not alter catalog Markdown/CSS or write new end-user copy. Report verification and gaps in this work order. Root will supply any necessary page text and perform final publication.

## Acceptance

All existing reviewable assets reachable from image cards; correct inspiration/model pairing; no broken thumbnail, review or model link; mobile/desktop navigation and local model loading verified; strict MkDocs/media checks and required PR checks green; checked PR merged and updated catalog published to the isolated private playtest. Normal demo and dev-env remain stable.

## Inventory handoff

Initial machine-readable inventory is complete at `scripts/assets/catalog-inventory.json`. Its stable schema is `{schema_version,path_base,counts,assets,notes}`; each asset records `{id,title,category,review,concept_images,model_images,models,audio,thumbnail,version,state,checksums}`. `review` is a repository-relative Markdown path with an optional heading fragment. All other file paths are repository-relative. The catalog has 33 rows: four reference-sheet rows, 24 model rows, one concept-only row and four sound-audition rows. The model rows comprise 23 completed candidates plus Nap Captain's paused partial export. No row is owner-approved.

Independent repository audit on September 11, 2026 found:

- All 24 repository GLBs appear exactly once in the model inventory. This includes all three path-kit pieces and all four tools.
- All nine repository WAVs are represented: four processed audition cues, their four generated sources and the retained effectively silent first `ui-confirmed` attempt. The latter remains clearly marked rejected.
- All 23 source concept/reference images are represented. Review records for all six preserved creature studies state that they were rejected for enemy use and have no approved replacement role.
- All 26 versioned review pages are reachable through at least one row. All 110 unique review/media paths referenced by the manifest exist locally; all 15 review fragments match source headings.
- SHA-256 recomputation matched every cataloged GLB and WAV: 33 checksummed artifacts, zero mismatches. The docs preparation and local-media checker passed over 137 Markdown files with no broken local media references.
- Every completed model review pairs a source concept/reference with an exported-model render and GLB. The three path pieces and four tools use shared construction sheets on their common review pages, and the inventory maps each piece to the correct sheet and page anchor. Storybook and historical construction references intentionally have no model. The One-Star Diva accurately remains concept-only. Root added the previously missing Nap concept/partial-model comparison and viewer while this inventory was being prepared. No unresolved inspiration/model pairing or local link defect remains in the current review records.

The manifest omits browser-audit screenshots, evidence captures, motion videos and pigment/texture internals. Those are supporting evidence rather than distinct catalog subjects and remain reachable from the versioned review pages.

## Nap Captain preserved checkpoint

The already-repository-hosted partial export is safe to include without authoring or retrieval: `docs/assets/media/nap-captain/v001/nap-captain.glb`, 789,036 bytes, SHA-256 `e1cf47bf78e5edb53287e20e0b27ccb7886872bcefe2782a9e1fb31a91a8c7c7`. Its existing browser render is `docs/assets/media/nap-captain/v001/browser-beauty.png`, 163,348 bytes, SHA-256 `12c9e3e5b7b0db1e29b33a618d9d0f5779e2d21b8e79daca193f6501b8328396`. Both are fictional assets already in the repository; no family reference was used.

This remains an unfinished first export. The original GLB has five clips and passed its format, Three.js and browser checks, but the cap bands need correction, a raised paw separates visibly from its arm, the seated defeat pose hovers, and source comparison records a `0.0000422597` tail-weight normalization difference. Proposed cap/arm/tail/seated corrections and atlas changes were never uploaded, built, rendered or verified. The version therefore stays labeled `v001 first-export checkpoint`, paused, with no owner approval or gameplay promotion.

WO032's released live scene remains `/workspace/haynes-quest/parody/remix-trio/v001/live-scene-release.blend`, 7,641,662 bytes, SHA-256 `9a84bd4c72e70292512bd605f4da44f6fcccdca290816d230aa0bc053c972afe`. The original Nap master remains `/workspace/haynes-quest/parody/remix-trio/v001/nap-captain/nap-captain.blend`, 7,634,894 bytes, SHA-256 `dd3d8efcebdda7db6b1381878ec4abdf9a08010c01317822266c07c206a5f7a3`. `scripts/assets/parody-remix-trio/pause-collection-verification.json` preserves their prior transfer verification. This inventory did not retrieve, mutate or resume either checkpoint.
