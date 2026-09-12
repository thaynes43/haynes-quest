# WO070: PLAN007 release and hosted verification

Status: complete, September 12, 2026. Root Astra max completed the release after collaboration could not resume completed agents. All browser and authoring leases are released; physical-device review remains separate.

## Published application and operations release

Application PR35 merged as `b66b8ee2723480c6c1e0226af9018109489a1817`. Final PR head 96c5a03 passed all 350 tests and application/docs/container checks. Main Application 34670404335 and Documentation 34670404348 passed, including provenance/SBOM and signing. Anonymous registry header and independently hashed bytes match image digest `eb685f46f8682e2b73505e02e0a52e738879d4c142b42c6af83fe7d2ec858cdc`; independent signature verification is not claimed. The exact tested and hosted client is Bn3 / SHA256 `0e795d99f5fd820bc5388c8ae24c350f4214c3ac5a6fbcbdc444b9ae5db43702`.

Operations PR2862 passed all nine checks at head `6ba1b87974f52205ed708f7df5c273c77784144f` and merged as `6b39ea6cb74880be0e274a5501ad5c067bab8d93`. Both main CI diff comments were reviewed: only the private image and ephemeral flag differ. Local exact Helm/Kustomize/artifact/source invariants passed. Edge checks passed, but downloading their raw logs from GitHub's Azure blob host failed in dev-env; those logs were not independently read. The source diff and reviewed main renders remain scoped to the private release.

During the usage pause, unrelated Plex collector PR2861 advanced operations main to f5f6e5d. The worktree fast-forwarded without changing Quest resources. The first resumed baseline comparison passed 21/23 because only the expected Flux revision had changed; the current-revision reread passed 23/23 while retaining the original fixed UID/image/restart baseline. The temporary verifier's registry header parser was corrected for portable case-insensitive matching before its successful final pass.

## Live rollout

Targeted Flux reconciliation applied exact operations merge 6b39ea6. The private Deployment and HelmRelease are observed at generation 4/4. Pod `haynes-quest-playtest-5fd6bf5558-4mtxj`, UID `0f42455e-4dc1-4354-a605-923446132889`, is Running/Ready with zero restarts on the exact image and ephemeral flag. All 23 infrastructure/isolation checks passed: image, flag, source revision, health/readiness, Services, endpoint/routing/policies and unchanged normal/dev-env identities/images/restarts.

Live HTTP proof reports `mode: fixture`, `progressMode: ephemeral`, zero discoverable saves, and all six fictional SVGs match their exact catalog bytes. An initial probe mistakenly expected a boolean fixtureMode field; it was corrected against the actual SessionView contract. No product fix was needed. The combined Secret and Postgres egress remain present but unused by the memory-store path; no old database records were deleted.

## Hosted browser acceptance

The clean real-touch smoke proved fresh Leave/reload, no save UI, age-zero Space/world jumping, simultaneous held-stick action/jump and real cancellation. Audio analyser peak was 0.4679 for the Help test, exactly zero while muted and 0.3636 after unmute; this does not prove physical audibility. Direct Besties entry and natural gear approach passed, followed by actual held-stick wand damage HP 6 → 3 / revision 15 → 16 while movement stayed −1. Landscape controls and Help passed. The complete two-boss age 0 → 4 → 7 route remains exact-client local acceptance; it was not replayed in full on the hosted release.

A separate browser-only forced Pink 503 recovered through the visible Retry artwork action. Its 956,924-byte GLB exactly matched SHA256 `0f7020f53ed257dd88e6a8cb9e8fb0011c70e84bf33bc2e55fb671473aea96ae`; the warning cleared and Leave returned to the fresh home. The first driver used an incorrect exact-text locator whose element included the adjacent button label; the corrected selector passed without a product change. Only the intentionally injected 503 appeared in console output; accepted browser reports have no unexpected errors.

Hosted catalog audit passed 37 entries, 54 thumbnails, 28 review pages, 26 exact model deliveries and both eight-clip Besties viewers at desktop/phone sizes, with zero unexpected errors. [Release evidence](../../docs/assets/media/release/v003/publication.json) includes publication, pre-release, rollout-verification, live-api, live-controls, live-besties, live-artwork, catalog-live, operations-checks and activity JSON. Cookies, credentials and browser session identifiers are excluded. Raw browser probes remain ignored in the implementation worktree. Release verifiers/logs are preserved in this records worktree's ignored `test-results/release-tools/`.

## Closure and limits

Activity `act-033848-289886` began at 03:38:48 UTC and ended after hosted checks. Owned fixture 4397 (PID 275344) stopped; unrelated 4392 was not touched. There is no running browser, authoring job, rollout, OAuth/photo import or dev-env restart. These closing records change documentation only; the private game, catalog and guide remain pinned to the reviewed b66b8ee image.

Physical iPhone/iPad Safari feel, frame times, speaker listening, child response and exact final model/audio review remain owner inspection. SwiftShader's measured 9–10 fps does not meet the device frame budget and does not establish physical-device performance. Cached WebKit lacks required GStreamer libraries; no host or dev-env change was made.
