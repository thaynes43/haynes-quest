# WO081: Playground publication and hosted acceptance

Status: Hosted verification in progress, September 12, 2026. Application PR41 and private operations PR2872 are merged. The exact new client is live; deployment/isolation and API checks pass. Full hosted browser acceptance is running before PLAN009 closes.

## Published and deployed version

Application [PR41](https://github.com/thaynes43/haynes-quest/pull/41) merged as `ee468101700ed3d0a5f94ffde4226a740a3d3ac4`. All PR checks passed at `dd14285`. Main Application `34715695671` and Documentation `34715695670` passed, including 452 tests (10 real PostgreSQL), production build, strict documentation, container publication, provenance/SBOM, attestation and signing. Anonymous registry headers and independently hashed manifest bytes match the published digest; independent signature verification is not claimed.

Image: `ghcr.io/thaynes43/haynes-quest:sha-ee468101700ed3d0a5f94ffde4226a740a3d3ac4@sha256:9862c6c8f95c74b6c0c5f944125ae7aefe4729f211340a3f43d417e1f663459d`.

Operations [PR2872](https://github.com/thaynes43/haynes-ops/pull/2872) merged as `bdbfc04afe24f8e9046459a62779698e6f0bb8b5` after all nine required checks and independent exact-head review at `8e5f5b7`. Rendered main diffs contain only the private image replacement; edge diffs are empty. Flux applied the exact merge revision. All 24 post-release assertions pass against the immediate pre-merge baseline: private readiness/image, normal Quest and dev-env identities/restarts, services, routes, policies, health and source reconciliation. Scoped activity `act-201013-1664542` remains active during hosted acceptance; end it when verified.

Client: `index-DOmWuEtB.js`, 1,171,500 bytes, SHA256 `40c5715544d0993a2e782065f06be82c29c1b0124dacf6a0ab49136b0f1f29ea`. Merged runtime/package/lockfile/Vite/Dockerfile content matches accepted local source `cfaddf4`. Hosted API probe passes all 59 checks, including exact client bytes, catalog v4, both authored routes, five unique encounter slots per chapter, fresh reset and six exact fictional pictures.

## Browser acceptance

[WO078](078-plan009-playgrounds.md) and the [v005 guide evidence](../../docs/assets/media/playtest/v005/playground-check.json) record local acceptance: full two-chapter control journey, nearby recovery, both attacks and bosses, six memories, branches/ferries/hazards, held-stick/world-tap input, mobile sound failure/retry, authored landscape and the visual catalog. The local full journey took 359.742 seconds, including intentional checks and real combat retries. It uses keyboard movement/jumps with touch combat; separate actual-stick/world-tap checks cover mobile input. These are not child pacing or physical-device performance evidence.

Native Sol owns the exclusive hosted browser lease. It is running the same authored route with landscape controls in each chapter and a model held unavailable until explicit artwork retry while fallen, followed by separate mobile sound, touch/input and catalog checks. No gameplay state injection is permitted. Preserve unsuccessful diagnostics with their concrete cause rather than reporting only successful retries.

## Durable evidence and next stage

Root release worktree: `/home/dev/work/quest-playgrounds-release`, reports under `.private/test-results/plan009-release/`: `publication.json`, `render-candidate.json`, `pr2872-review.json`, `pr2872-independent-audit.json`, `baseline-immediate.json`, `ops-merge.json` and `post-release.json`. Root application/evidence worktree: `/home/dev/work/quest-daughter-levels`; API report `test-results/plan009/review-evidence/playground-api-hosted.json`. Closing worktree: `/home/dev/work/quest-playgrounds-closeout`. Browser reports use distinct `plan009-final-hosted-*` labels.

No new art or audio was generated. The same 23 runtime GLBs, four source WAVs, six fictional pictures, 37 catalog entries, 54 thumbnails and 26 viewers remain. Guide v005 captures/check records describe the longer courses; exact final asset review remains separate. No dev-env restart or private-photo/credential access occurred.

Remaining: finish exact hosted browser/catalog checks, end activity, and close PLAN009 with current handoff and evidence. Identity and curated personal photos remain the next required MVP stage under [WO080](080-identity-curation-readiness.md); the fictional fixture is not a personalized MVP.
