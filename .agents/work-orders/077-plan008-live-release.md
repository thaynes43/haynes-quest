# WO077: PLAN008 release and hosted verification

Status: checked operations PR merged; scoped reconciliation and hosted verification running, September 12, 2026. Root Astra max owns final release review. Source fixes and local acceptance are WO076; this work order closes the scoped deployment.

Application PR37 merged as `c5696e3b884059040bcf67d225697139979a3551` after final head `9ae5c8d05b535681eefee6dbf6ff1925784a8c94` passed application/database verification, documentation and container checks. The merge tree exactly matches the tested head. Main Application run `34705837653` and Documentation run `34705837648` both completed successfully at that exact merge. Buildx provenance/SBOM, GitHub build-provenance attestation and cosign signing succeeded. Anonymous registry HTTP 200 returned an 857-byte index whose header and independently hashed bytes both match digest `b5e6aee84795299699bc8f02304a5ddd1cb644f81bf458718bdaa9540e988fd5`. Independent signature verification is not claimed.

Local client `index-DGbCshsH.js` is 1,046,627 bytes, SHA256 `999cb163fc55304ced6f2f244d1b0dab8584d1c143ab0e62ee3a9f5c08535982`. The full route, touch smoke, scrolled Help sound failure/retry/repeat, held-wand landscape checks and catalog pass; 378 tests pass locally and 10 dedicated Postgres cases are exercised in CI. Separate API verification passes 53 assertions including ephemeral fresh starts, both chapter entries and all six exact fictional SVG bytes. The v004 local evidence records scope and limitations.

The immutable image is `ghcr.io/thaynes43/haynes-quest:sha-c5696e3b884059040bcf67d225697139979a3551@sha256:b5e6aee84795299699bc8f02304a5ddd1cb644f81bf458718bdaa9540e988fd5`. No PLAN008 deployment, hosted behavior or physical speaker result is claimed at this checkpoint. Normal Quest, routing, policy and dev-env invariants remain required. Physical Safari and listening require device inspection; no host dependency or dev-env change is part of this release.


Operations PR2864 passed all nine checks at head `c85ce284bbe55d5afdabaf4c5bb39920bdddf053`, then merged as `882ef5a847f0b7461234a2642a446480de248273`. Root reviewed both main sticky diffs: only the private Deployment image and HelmRelease tag changed. Both edge diff jobs succeeded and emitted no sticky comment; the workflow emits comments for nonempty diff files, supporting empty edge diffs. Raw edge logs could not be downloaded through the non-allowlisted GitHub Azure redirect; no bypass was attempted. Local Helm/source checks also prove no non-image resource or environment change.

Immediately before merge, all 24 baseline checks passed. Activity `act-164947-373500` began at 16:49:47 UTC with the scoped 45-minute lease. Targeted `flux reconcile kustomization haynes-quest -n frontend --with-source` is running. Hosted exact-client, full two-chapter route, touch/audio, landscape and catalog verification remain; end the activity and owned fixture4398 after checks. No normal Quest or dev-env mutation is authorized by this checkpoint.

## Settled private rollout

Flux applied exact revision 882ef5a. Private HelmRelease and Deployment are observed at generation 5/5; Helm reports UpgradeSucceeded. Pod `haynes-quest-playtest-549c4d7b76-nn4tf`, UID `7ae5b272-2a6d-4784-9422-4c5fc21d9545`, is Ready with zero restarts at the exact registry digest. All 24 rollout/isolation assertions pass, including public environment, health/readiness, current service endpoint, Cilium identity labels and unchanged normal Quest/dev-env/routing/policy state. [The verification record](../../docs/assets/media/release/v004/rollout-verification.json) contains exact observed and expected values.

Hosted HTTP validation already passes 53 assertions against the exact client hash: fixture/ephemeral session, empty save discovery, distinct fresh starts, both chapter entry states and all six fictional SVG byte hashes. Hosted real-touch smoke and scrolled Help failure/retry/repeat pass. The full hosted route and remaining catalog/layout checks are running; do not treat this partial checkpoint as their completion.


## Hosted blocker: asynchronous status while paused

The first hosted full route passed chapter one, then failed the Besties artwork-retry assertion while the player was fallen. This is a real defect, not a lost tap. The bounded diagnostic records the first actual button click starting a load; direct renderer status later reaches `mediaLoading=0/mediaFailed=0`, while the warning remains visible for 20 seconds. A second click forces a status emission and clears it. The frame's status cadence advances with simulation delta, which is zero while the modal pauses gameplay. [Diagnostic evidence](../../docs/assets/media/release/v004/paused-retry-diagnostic.json) records the actual observations. The diagnostic's later boss clear is not first-tap retry acceptance.

A follow-up changes only status cadence to use raw frame time; paused physics and combat remain frozen. Add regressions for asynchronous success and failure while paused, then publish a checked replacement image and re-run hosted acceptance. The initial failed full-route record remains preserved. The original suite aborted before landscape/catalog; their pending records are not passes.


The follow-up candidate integrates native fix `8acc52e` as `7d335db`. Typecheck, lint, build and 380 tests pass (10 local Postgres cases run in CI). Client `index-Dg49Dt7R.js` is 1,046,626 bytes, SHA256 `14fdb50c25753fbaffa5e389dc224f293a4ed0de4048e667e7f11fd91c9fc35d`. The browser driver now has an explicit `QUEST_E2E_PAUSED_ARTWORK_RETRY=true` mode: let real Besties attacks reach the fallen modal, press Retry artwork once, require the warning to hide while still fallen, then continue the route. Local fixture 4399 hosts this candidate; the existing 4398 fixture remains an owned initial-release reference. The private host remains on c5696e3 until a checked follow-up image is published and pinned.


Follow-up application PR38 passed all checks at head `e82d01002f56ce7c86d9ae2855f3bf0f36876235`, including the real database and container checks, then merged as `6e71ba1556784efb340056e27be11e2bd7ae6c10`. The exact local full route passed age 0 → 4 → 7 and all six memories; one retry clears the warning while still fallen, then the boss fight and growth finish. The scrolled sound retry passes. [Follow-up local evidence](../../docs/assets/media/release/v004/follow-up-local-acceptance.json) preserves source hashes. Main Application 34707413422 and Documentation 34707413477 are the required publication runs. No final hosted pass is claimed before their image is pinned.


Both exact follow-up main publication runs succeeded. Registry HTTP 200 and independently hashed 857-byte manifest match digest `3112a716b888a3e5dbcbfca35d5680a52f49c43ae3b9347e34408b86b954bf0f`. Buildx provenance/SBOM, attestation and signing succeeded; independent signature verification is not claimed. The follow-up private image is `ghcr.io/thaynes43/haynes-quest:sha-6e71ba1556784efb340056e27be11e2bd7ae6c10@sha256:3112a716b888a3e5dbcbfca35d5680a52f49c43ae3b9347e34408b86b954bf0f`; its checked operations pin and final hosted acceptance remain pending.
