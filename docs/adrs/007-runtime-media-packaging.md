# ADR-007: Package review media separately from generated site pages

- **Status:** Accepted
- **Date:** 2026-09-29
- **Deciders:** Quest coordinator, implementing [image-size issue #140](https://github.com/thaynes43/haynes-quest/issues/140)
- **Related:** [ADR-006](006-release-isolation-and-public-surface.md) studio admission boundary

## Context

The signed September 29 Quest image has 1,076,961,748 compressed bytes in its Linux/amd64 layers. Copying the whole MkDocs site creates a 954,996,850-byte layer. The site includes every source file under `docs/assets/media`, including generated Blender preview frames that the review pages do not link. A cold pull took 6 minutes 37 seconds; the former five-minute Helm timeout rolled back an earlier release before [haynes-ops #3261](https://github.com/thaynes43/haynes-ops/pull/3261) raised it to 20 minutes.

The studio's review pages, exact model and Blender downloads, audio, thumbnails and audit captures need their existing URLs. Family `/studio/*` requests still require an admitted session; the isolated fixture remains available on the LAN. Linked checksum manifests also enumerate intermediate preview PNGs as source evidence, although no rendered review page or runtime code links to those frames.

## Decision

**D-01 Keep the full source archive.** All media and checksum manifests remain versioned in git. The strict MkDocs source build and link check continue to see every file. Manifest paths are source-archive paths, not a promise that every intermediate frame is served by the runtime site. A reader can inspect an intermediate and verify its hash from the corresponding repository commit.

**D-02 Publish the review surface.** The runtime media package excludes only generated PNG frames in `preview`, `final-preview`, `checkpoint-preview-rebuild2` and `blender-previews` directories that have no direct review-page or runtime URL. Two directly linked bind-pose frames remain. Every GLB, Blender master, audio file, catalog thumbnail and audit capture remains. A final-site check must reject a review link to any omitted file. If a future review links a preview, the runtime keep list must be updated in the same PR.

**D-03 Use a stable media layer.** Docker builds the pruned media from `docs/assets/media` in its own stage and copies it into the runtime image in its own layer. The full MkDocs build runs separately; its media copy is removed before the generated HTML/CSS/JS site is copied into the runtime image. Code-only and documentation-only releases can reuse the media layer when source media and the keep list are unchanged.

## Consequences

- A review URL and the family/fixture access boundary keep their existing behavior. No new service, credential, external dependency or media URL migration is needed.
- Source manifests retain exact hashes for intermediate frames that are absent from the runtime site. The versioned repository remains the retrieval path for those frames.
- The first slim-image rollout still downloads the new media layer. Future releases that do not change media can reuse it on nodes that already hold that layer; a cold node still pulls the remaining media bytes.
- Image and layer sizes must be measured from the signed OCI manifests, and the hosted fixture must serve exact GLB, Blender and audio downloads after GitOps rollout. [Issue #140](https://github.com/thaynes43/haynes-quest/issues/140) records the acceptance evidence.
