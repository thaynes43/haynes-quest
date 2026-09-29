# Runtime studio media

[ADR-007](../adrs/007-runtime-media-packaging.md) defines which media the Quest image publishes. The repository keeps the complete source archive and SHA-256 manifests. The runtime site keeps every directly linked review download and game asset, while generated intermediate preview frames with no review URL remain available from the same repository commit.

The September 29 baseline image had 1,076,961,748 compressed Linux/amd64 layer bytes. Its single copied-site layer was 954,996,850 bytes. The image build now copies pruned media and generated site pages in separate layers. A code or documentation change that leaves `docs/assets/media` and the prune rule unchanged can reuse the media layer; a new media version still publishes a new signed image.

## Change and verify media

1. Keep new GLBs, editable Blender masters, audio, catalog thumbnails, review images and audit captures in `docs/assets/media`, with their versioned review and catalog records. `scripts/docs/build.sh` checks the complete source site before runtime packaging.
2. If a review links a generated PNG in `preview`, `final-preview`, `checkpoint-preview-rebuild2` or `blender-previews`, add its relative path to the keep list in `scripts/docs/prune_runtime_media.py`. The final-site check in the Docker build fails when a rendered local link is missing.
3. Run `scripts/docs/build.sh`, prune a *copy* of `site/assets/media` with `python3 scripts/docs/prune_runtime_media.py <copied-media-root>`, then run `python3 scripts/docs/check_runtime_site.py <copied-site-root>`. Never prune the tracked source tree. Run the catalog browser audit and the app checks required by [the private-preview runbook](002-private-preview.md).
4. After the main workflow builds, attests and signs the image, compare its Linux/amd64 compressed layer bytes with the prior digest. Pin the exact tag and digest in both GitOps HelmReleases, then verify Flux, pod image IDs, `/readyz`, review pages and hosted GLB, Blender and audio downloads. A family-host studio request without a session must still be rejected; the fixture must remain free of family secrets.

Checksum manifests enumerate some intermediate frames that are not served by `/studio`. Their paths and hashes identify files in the versioned repository source, not runtime download URLs. To inspect one, open the manifest's `files[*].path` in the repository at the same app commit. Do not infer an HTTP URL from a manifest path unless a review page or catalog field links it.
