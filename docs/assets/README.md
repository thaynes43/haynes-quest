# Asset studio

Review the images, models and sounds that will make Haynes Quest's storybook world. Start with the [art direction](art-direction.md), then browse the [first-pass catalog](catalog.md).

The first reference set and prop concepts are ready. Model and audio candidates are in production alongside the private playable preview. Infrastructure test meshes and sounds are not game candidates or approved assets.

Each finished candidate gets a page with its source concepts, model views or audio player, exact version, technical results and feedback history. The [review template](000-review-template.md) defines that record. The coordinator can create and refine the whole first pass before Tom reviews it.

| Label | Meaning |
| --- | --- |
| Not started | Planned in the current slice; no candidate exists yet. |
| In production | Concept or model/audio work is underway. |
| Needs iteration | The coordinator found a concrete issue to correct. |
| Ready for Tom | The coordinator selected this candidate and attached its checks/previews. |
| Changes requested | Tom reviewed the version and requested revisions. |
| Approved | Tom approved this exact version for gameplay. |
| Superseded | Retained for history; a newer version is current. |

Coordinator acceptance and Tom's approval are separate fields. An isolated candidate viewer can show unapproved assets; ordinary gameplay uses identified placeholders or previously approved versions. Feedback names the asset ID and version so improvements remain traceable.

## Where files live

Keep public-safe review pages under `docs/assets/reviews/<asset-id>/<version>.md` and their original or permitted media under `docs/assets/media/<asset-id>/<version>/`. Link every relevant concept, turntable, GLB, animation preview and audition from its review record. Small nonpersonal sources can live here; keep large editable masters on the durable authoring PVC and record their checksum and durable relative artifact ID. Do not embed a temporary pod path as the only surviving master location.

This repository and any static documentation output must be safe to publish. **Real photos, person names, birth information, private likeness references/models and secrets stay outside the docs tree and public git**, including filenames, metadata, search indexes and generated previews. Git LFS and hidden navigation do not make a file private. Later private-person reviews need separate authenticated storage and delivery; document that integration before using such assets. Never insert signed or credential-bearing URLs into public pages.

Use local media URLs in previews; do not require a third-party CDN to view family assets. Provide stills and downloadable GLBs when interactive 3D is unavailable, and audio controls with a descriptive text alternative. No autoplay. Full production/review rules live in [DESIGN-002](../designs/002-asset-pipeline.md) and [DESIGN-008](../designs/008-audio-pipeline.md).
