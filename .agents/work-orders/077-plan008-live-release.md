# WO077: PLAN008 release and hosted verification

Status: complete — final private image deployed and hosted acceptance passed, September 12, 2026. Root Astra max owns final review and delivery. WO071–076 record source diagnosis and the initial integration. This record preserves the initial hosted failure and the checked follow-up.

## Final release

Application [PR38](https://github.com/thaynes43/haynes-quest/pull/38) passed application/database, documentation and container checks at head `e82d01002f56ce7c86d9ae2855f3bf0f36876235`, then squash-merged as `6e71ba1556784efb340056e27be11e2bd7ae6c10`. Exact main Application `34707413422` and Documentation `34707413477` succeeded. Buildx provenance/SBOM, GitHub build-provenance attestation and cosign signing steps passed. Registry HTTP 200 returned an 857-byte OCI index whose header and independently hashed bytes both match `3112a716b888a3e5dbcbfca35d5680a52f49c43ae3b9347e34408b86b954bf0f`. Independent signature verification is not claimed.

Operations [PR2867](https://github.com/thaynes43/haynes-ops/pull/2867) passed all nine checks at head `42fef3752b9c6a7ddd5d98bc8202fffca7f4ebd7`, then squash-merged as `a621f1b4463f371fcc08f01e85c5c281e9600f36`. The reviewed manifest and rendered main diffs change only the private image; both edge diff jobs passed and emitted no nonempty-diff comment. Local Helm lint, normalized render comparison, Kustomize and protected-file checks agree. Raw edge logs redirect to a non-allowlisted Azure host; no bypass was attempted.

The deployed pin is `ghcr.io/thaynes43/haynes-quest:sha-6e71ba1556784efb340056e27be11e2bd7ae6c10@sha256:3112a716b888a3e5dbcbfca35d5680a52f49c43ae3b9347e34408b86b954bf0f`. Targeted Flux reconciliation fetched and applied the exact operations merge. Private HelmRelease and Deployment settled at generation 6/6; pod `haynes-quest-playtest-84f9856fc7-cdv4g` is Ready with zero restarts and the expected image. All 24 rollout/isolation assertions pass, including health/readiness, endpoints, environment and Cilium labels, and unchanged normal Quest/dev-env/services/routes/policies.

The immediate preflight initially required the newer GitHub main revision `6772777`, while the live Ready source and Quest Kustomization still reported `0240665`. Its other 22 resource assertions passed. Rechecking the actual observed revision passed 24/24; the post-release verification independently requires the new exact `a621f1b` revision and also passes 24/24. This was an incorrect preflight expectation, not a resource or deployment failure. Preserve both observations.

Activity `act-164947-373500` covered both private rollouts with scope `frontend,haynes-quest,haynes-quest-playtest`. It ended after final rollout/isolation checks; the subsequent hosted browser tests completed successfully. Normal Quest retains its original image and pod; dev-env retains pod UID `c3a94756-af35-405e-93bc-eb05c2979d3a`, all three containers Ready with zero restarts, Deployment generation 100 and HelmRelease generation 30. No database records, OAuth settings, real photos or dev-env configuration changed.

## Why the follow-up was necessary

The first repair shipped in app PR37 (`c5696e3`) and ops PR2864 (`882ef5a`), image digest `b5e6aee`. Initial API, audio and touch checks passed. The hosted full route cleared chapter one, then exposed an artwork-retry warning that remained visible while the player was fallen. A diagnostic proved the first actual click started the successful download: renderer status reached `mediaLoading=0/mediaFailed=0`, but the warning stayed for 20 seconds until a second click forced an update. The first route's landscape and catalog tests were not run after the suite aborted; their original pending records remain pending.

Status cadence used simulation delta, which is zero while gameplay is paused. The fix changes only that cadence to raw frame time; simulation, enemy movement and animation time remain frozen. Regressions cover asynchronous media success and repeat failure while fallen and explicitly paused, including the real status callback and unchanged player/enemy positions. Native commit `8acc52e` was integrated as `7d335db`.

The tracked full-route browser test now supports `QUEST_E2E_PAUSED_ARTWORK_RETRY=true`: let actual Besties attacks knock out the player, tap Retry artwork once, require the warning to clear while the fallen modal remains open, then continue through victory and growth. This passes on the exact local follow-up client. The initial failure and [paused-retry diagnostic](../../docs/assets/media/release/v004/paused-retry-diagnostic.json) remain evidence, not successful acceptance.

## Acceptance and limits

Final client: `index-Dg49Dt7R.js`, 1,046,626 bytes, SHA256 `14fdb50c25753fbaffa5e389dc224f293a4ed0de4048e667e7f11fd91c9fc35d`. Typecheck, lint, build and 380 local tests pass; the 10 dedicated Postgres cases pass in CI. [Follow-up local acceptance](../../docs/assets/media/release/v004/follow-up-local-acceptance.json) records the complete age 0 → 4 → 7 route, all six memories, one-tap paused artwork recovery and scrolled sound retry. All six final hosted reports pass against that client:

| Check | Evidence |
| --- | --- |
| API: 53 assertions, ephemeral fresh starts, both chapters and six exact fictional SVGs | [Final API](../../docs/assets/media/release/v004/final-live-api.json) |
| Scrolled Help sound failure, one-tap retry and repeated playback | [Final audio](../../docs/assets/media/release/v004/final-live-audio.json) |
| Real-touch movement, quick tap/held-stick jump and combat controls | [Final controls](../../docs/assets/media/release/v004/final-live-controls.json) |
| Age 0 → 4 → 7, six memories, actual hidden minor roots, enemy/boss damage, moving Besties models, defeat and one-tap paused artwork retry | [Final route](../../docs/assets/media/release/v004/final-live-route.json) |
| Landscape controls and accepted held-wand damage | [Final landscape](../../docs/assets/media/release/v004/final-live-landscape.json) |
| Catalog: 37 entries, 54 thumbnails, 26 model viewers | [Final catalog](../../docs/assets/media/release/v004/final-catalog-live.json) |

[Publication](../../docs/assets/media/release/v004/follow-up-publication.json), [operations checks](../../docs/assets/media/release/v004/follow-up-operations-checks.json), [preflight](../../docs/assets/media/release/v004/follow-up-pre-release.json) and [24/24 final rollout checks](../../docs/assets/media/release/v004/follow-up-rollout-verification.json) preserve exact release identities and source hashes. The paused retry record shows one press, failed media 1 → 0, loading 0, warning hidden and the fallen modal still open. The complete route then resumes and wins.

Browser validation uses Chromium 153.0.8010.12 with SwiftShader, including real touch-event smoke and mixed keyboard/touch route controls. It is not physical Safari or speaker listening. Cached WebKit cannot start because GStreamer dependencies are absent; no host packages or dev-env changes were made. Audio buffer starts and analyser output prove the tested browser pipeline, not sound from Tom's iPhone speakers. The v004 guide captures belong to the initial repaired client `index-DGbCshsH.js`; their capture manifest remains accurate. The follow-up changes status timing, and its separate final records identify `index-Dg49Dt7R.js`.

[DESIGN016](../../docs/designs/016-authored-levels.md) records the authored-level direction: shared reusable pieces and validation, free memory placement from integrations/manual uploads, and period suggestions with Show more. The editor, upload flow and longer branching obby remain future implementation. No new visual or audio asset was generated; the catalog still covers 37 entries, 54 thumbnail images and 26 model viewers. Exact final asset approval and child/device inspection remain open.

## Durable locations and closeout

- Source and final browser reports: `/home/dev/work/quest-plan008-records`, `test-results/hosted-plan008-final/` and `test-results/fresh-playtest/plan008-final-hosted-*`.
- Follow-up deployment baseline and verification: `/home/dev/work/quest-plan008-paused-release/.private/test-results/plan008-paused-release/`.
- Initial source, browser failures and diagnostic: `/home/dev/work/quest-mobile-reliability`; initial deployment audit: `/home/dev/work/quest-plan008-private-release`.
- Final repository evidence: `docs/assets/media/release/v004/` in `/home/dev/work/quest-plan008-closeout`. Keep initial failures alongside final results; no private cookies/session identifiers in committed browser records.

Owned fixtures 4398 and 4399 were stopped after final acceptance; unrelated 4392 stays untouched. The browser suite exited successfully and the scoped activity ended. PLAN008 is complete and archived. Strict MkDocs generation, local links and the clean build passed. Carry the checked documentation closeout through merge; the runtime stays pinned to the verified PR38 image for this records-only change. Separate Fable review had already completed and been reaped; Tom's latest quota rule now routes any needed review to exact Opus 5 xhigh until Fable's Monday 8 AM reset is verified.
