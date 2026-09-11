# Asset studio

Browse the [asset catalog](catalog.md) by picture to choose what to review. Each model entry keeps its inspiration image, interactive 3D view and exact version together. The [art direction](art-direction.md) explains the common storybook style.

The catalog includes travelers, world pieces, equipment, parody characters, friendly characters, reference images and sound auditions. Finished candidates and paused work are labeled separately. The [two-chapter playtest](playtest.md) identifies the temporary cast used in the isolated review game; no final artwork approval is implied.

Every candidate gets a review record, including concepts and paused or partial work. Show its source images, available model views or audio player, exact version, actual checks and feedback history; label what is still missing. The [review template](000-review-template.md) defines the record, and the [catalog maintenance rule](../PROCESS.md#asset-catalog-must-stay-current) requires matching inventory and thumbnail navigation with every asset change. Catalog inclusion does not require final artwork approval.

| Label | Meaning |
| --- | --- |
| Not started | Planned in the current slice; no candidate exists yet. |
| In production | Concept or model/audio work is underway. |
| Paused | Work has stopped at a preserved checkpoint; show available artifacts and remaining work. |
| Needs iteration | The coordinator found a concrete issue to correct. |
| Ready for Tom | The coordinator selected this candidate and attached its checks/previews. |
| Changes requested | Tom reviewed the version and requested revisions. |
| Approved | Tom approved this exact version for gameplay. |
| Rejected | This version was rejected for its stated role; record the decision and any separately proposed use. |
| Superseded | Retained for history; a newer version is current. |

Coordinator acceptance and Tom's approval are separate fields. An isolated candidate viewer can show unapproved assets; ordinary gameplay uses identified placeholders or previously approved versions. Feedback names the asset ID and version so improvements remain traceable.

## Where files live

Keep public-safe review pages under `docs/assets/reviews/<asset-id>/<version>.md` and their original or permitted media under `docs/assets/media/<asset-id>/<version>/`. Link every relevant concept, turntable, GLB, animation preview and audition from its review record. Small nonpersonal sources can live here; keep large editable masters on the durable authoring PVC and record their checksum and durable relative artifact ID. Do not embed a temporary pod path as the only surviving master location.

This repository and any static documentation output must be safe to publish. **Real photos, person names, birth information, private likeness references/models and secrets stay outside the docs tree and public git**, including filenames, metadata, search indexes and generated previews. Git LFS and hidden navigation do not make a file private. Later private-person reviews need separate authenticated storage and delivery; document that integration before using such assets. Never insert signed or credential-bearing URLs into public pages.

Use local media URLs in previews; do not require a third-party CDN to view family assets. Provide stills and downloadable GLBs when interactive 3D is unavailable, and audio controls with a descriptive text alternative. No autoplay. Full production/review rules live in [DESIGN-002](../designs/002-asset-pipeline.md) and [DESIGN-008](../designs/008-audio-pipeline.md).
