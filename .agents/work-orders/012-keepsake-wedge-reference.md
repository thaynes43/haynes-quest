# WO-012: Correct the keepsake rear reference

- **Status:** Reference corrected and model verified; publication evidence tracked in the linked operations record
- **Owner request:** Tom, 2026-09-11: the rear wedge is missing from the concept sheet's back view.
- **Worktree:** `/home/dev/work/quest-keepsake-wedge-review`, branch `agent/quest-keepsake-wedge-review`, base `10d3854`.
- **Scope:** Correct the raster construction reference, preserve the original, verify the existing model, update the private review catalog through checked PRs. No gameplay asset promotion, OAuth work or dev-env restart.
- **Team:** Root Astra max owns serial built-in image edits, inspection and writing. Fresh native Astra max `keepsake_wedge_audit` independently inspected the Blender export, renders and source without mutating the scene. Sol handles deployment verification.

The original concept's BACK panel omitted the support already shown in its SIDE/detail views. Root edited the original source PNG with the built-in image tool. The first result's rear support was too narrow; one further localized edit widened it using the actual model's rear render as geometry evidence. Concept v002 is selected as the corrected illustration, with the original v001 and prompt/provenance retained. This is a concept correction, not a new model export or owner approval.

The v001 GLB already contains one centered closed rear triangular prism: 0.225366 m wide, 0.154991 m high and 0.033005 m deep. Its base reaches Y=0 and overlaps the rear backing by about 2.54 mm; the flat support area is 0.007438 m². The actual back/side renders agree. The source and construction record name `Integral stable rear wedge`. No model, material, master or scene change was required.

Unchanged runtime GLB: 116,304 bytes, SHA-256 `059d92ca7bad6d1397e5fab9677a0ef0730fb45d54a4770b22675988a55fa137`. Root owns the review page correction and final intake. The updated page distinguishes the original construction input from the later corrected illustration and preserves pending exact-version owner approval.

Verification and live publication evidence belong to the [operations release record](https://github.com/thaynes43/haynes-ops/blob/main/.agents/work-orders/2026-09-11-quest-keepsake-wedge.md). Local strict docs/media checks and required application/container CI checks precede merge. The app's source code and game assets are unchanged.
