# Current handoff

**Active September 12: [PLAN007](plans/007-playtest-reset-and-controls.md).** Lead Astra max: `/home/dev/work/quest-playtest-reset`, branch `agent/quest-playtest-reset`, base `ed7ae72`. Tom's physical iPad/iPhone feedback governs this correction: fresh tests, always-available jumping, contact pickups, Attack/Bash, perceptible feedback, grass and two minor memories plus a post-boss major. DESIGN015 records decisions. No OAuth, real photos, generation, normal-app update or dev-env restart.

Implementation is pushed in draft [PR35](https://github.com/thaynes43/haynes-quest/pull/35), latest `8ead835`. All PR checks are green there: application verification, container build and strict documentation. Latest local suite: 340 passing, ten Postgres cases deferred to CI. Final browser/evidence integration remains before merge; PLAN007 is not deployed yet.

Fable WO062 mobile research and WO068 adversarial review are complete. Both exact Fable5.1/xhigh tasks were reaped after pushing their reports. Remote branches retain `16c5d4f`/`bfadcd1` and `04eb71d`; raw reports/probes/screenshots are preserved in `test-results/fable-reviews/`. WO069 records all review resolutions. No Fable session remains active.

WO066 is complete and all browser leases are released. Current client is `index-Bn3nnDAn.js`, 1,041,657 bytes, SHA256 `0e795d99f5fd820bc5388c8ae24c350f4214c3ac5a6fbcbdc444b9ae5db43702`. Owned fixture 4397 runs in exec session 26874, backend399c992, fixture+ephemeral flags and no DATABASE_URL/Immich. The final client remains pinned for live comparison; do not stop unrelated 4392.

Final exact-client browser evidence now passes an uninterrupted 0 → 4 → 7 run with six memories using keyboard movement/jumps and touch combat, plus direct Besties entry and missing-Pink fallback/retry. Five local obstacle recoveries and zero combat retries occurred. Focused checks prove held touch stick+world jump, actual held-stick wand damage HP 6 → 3, fresh Leave/reload, nonzero sound/mute/zero-volume restore and 844 × 390 control sizing/Help. See WO066/069 and `docs/assets/media/playtest/v003/local-acceptance.json`. Software rendering remains 9–10 fps; physical Safari, device performance and listening remain open. Cached WebKit cannot launch without absent host libraries.

Native Sol `memory_route` completed the local catalog audit: 37 entries, 54 thumbnails, 28 reviews and 26 exact GLBs, desktop/phone viewers and links, zero unexpected errors. Native Sol `fresh_sessions` completed the clean real-touch controls/audio/reset smoke after correcting its driver timing/cancel behavior; all browser leases are released. Final application source remains unchanged since 8ead835. `audible_feedback` has prepared the scoped GitOps release in `/home/dev/work/quest-private-release-prep`: only the private ephemeral flag is prepared; old image remains until app merge/publication. Fixed-baseline read-only verification passes 23/23, origin/main and live Flux remain eed48853. Ready verifiers and PR body are recorded in WO067. No ops PR or cluster mutation yet.

Next: finish catalog/final evidence checks, commit/update/ready/merge PR35 after green checks. Verify the immutable main image, then check/merge only the private image+flag GitOps change, declare/reconcile/validate and close records. No active deployment declaration or authoring lease. Unrelated 4392 remains untouched.

## Historical PLAN006 release

Updated September 12, 2026. [PLAN006](plans/completed/006-playtest-polish-and-besties.md) is complete for the private playtest. Application [PR33](https://github.com/thaynes43/haynes-quest/pull/33) merged as `d932b484a32d80e4cf3ad2ece1e99d3620d4c55c`. All 294 tests, including ten real PostgreSQL cases, documentation and container checks passed. Main publication, provenance/SBOM and signing passed; an anonymous registry fetch independently matched the published digest. Operations [PR2860](https://github.com/thaynes43/haynes-ops/pull/2860) passed all nine checks and independent rendered-diff review, then merged as `eed48853ae6d96c30f3f75515d7e81d20a0005f2`. Flux applied that exact revision. The new private image is running. All 19 rollout/isolation checks, the full hosted catalog audit and live v2/v3 touch save/progression checks passed.

## Delivered behavior

The corrected loop is gear → forgiving obby and goofy period enemies → boss → released pictures → deliberate memory consumption → age and abilities → next period. Two synthetic chapters cover age 0→4→7. Falling preserves equipment, memories and victories.

This release adds repaired touch wand targeting, a visible spell and attack feedback, prompt dragon retaliation at the arena edge, four gesture-unlocked sounds with mute/volume controls, more trees/grass/flowers, and six healing friendly characters. Harming a friend requires explicit confirmation, costs up to two player hearts and suspends its help; making amends restores the friendship. Friendly interactions remain optional and never gate progression.

Operation Besties is implemented using Tom’s approved joint pink/black look. The duo alternate obstacle tricks, miss their high-five and share a five-second dizzy attack window. **Start a new Demo Adventurer journey to encounter them in the age-four chapter.** V1/v2 saves retain their original cast, including the dragon. The nullable friendly sidecar preserves old saves. The old image cannot understand newly written v3 journeys, so prefer a forward fix over rollback after v3 writes.

## Test and review scope

[WO055](work-orders/055-plan006-browser-results.md) and [WO057](work-orders/057-plan006-integration.md) preserve actual browser evidence. The initial full touch journey passed both chapters and age 0→4→7 on an earlier candidate. Final focused touch checks passed friendly rewards/penalties/amends/reload, native Web Audio controls, held-stick wand damage and nearby dragon retaliation, and Besties guarded/dizzy behavior. The exact final client is `index-D3lvcZ1s.js`, 1,028,608 bytes, SHA256 `718cc412a27bb79d768238f6326f154a0cccb52da555a69ed3ec4ce31173cebe`. All three final scenarios had zero page/HTTP errors.

Fable5.1 ran through `agent-run` at the requested xhigh effort; the actual model was verified. [WO056](work-orders/056-fable-plan006-review-results.md) records its adversarial findings and [WO061](work-orders/061-plan006-review-resolution.md) resolves them. Corrections include airborne conversation handling, touch-release sound unlock, full Besties warnings after falls/backgrounding, actor-targeted spell visuals and exact versioned model resolution. Forgiving ranged attack positions remain a deliberate lead decision. Fable finished and its CLI task was reaped.

The catalog has **36 entries**: 26 models (25 complete, Nap partial), five reference entries, Diva’s concept and four sound entries. It contains 53 thumbnail files and 27 review pages. Local desktop/phone checks passed all thumbnail/model hashes, media and links, both eight-clip Besties viewers and actual high-five select/play/pause, with no browser/console/HTTP errors. The runtime manifest contains 23 GLBs and four cues. These are candidate previews: the shared Besties concept is approved, while exact final models/audio still await Tom’s review.

The [hosted v2 check](../docs/assets/media/release/v002/live-v2-resume.json) preserved the pre-rollout save and original catalog through touch menus, sound controls, save/leave and reload. The [new v3 phone-touch journey](../docs/assets/media/release/v002/live-v3-journey.json) collected equipment, beat the first boss, revealed pictures, advanced to age four, entered Besties and reopened that chapter with identical saved progress; both duo models were delivered. Besties combat was covered by the final exact-build local test and was not replayed live. Harness-only assumption errors and one unrecoverable synthetic trial journey are recorded without claiming uninterrupted success across every probe. No human data was involved.

## Open these from the home network

- [Private playtest](https://haynes-quest-playtest.haynesops.com/): choose **Demo Adventurer**, keep all three fictional pictures and begin a new journey for Besties.
- [Visual asset catalog](https://haynes-quest-playtest.haynesops.com/studio/assets/catalog.html): thumbnails, inspiration, 3D animation viewers and audio auditions.
- [Playtest guide](https://haynes-quest-playtest.haynesops.com/studio/assets/playtest.html): controls, actual game captures and included/deferred features.

The normal `haynes-quest.haynesops.com` address retains the earlier prototype. DESIGN007 and [WO044](work-orders/044-isolated-playtest-release.md) permit the isolated candidate review before final-art approval.

## Release ownership and recovery

Root completed the checked GitOps rollout. Closing records are retained in `/home/dev/work/quest-plan006-records`, branch `agent/quest-plan006-records`. Implementation/evidence remain in `/home/dev/work/quest-playtest-feedback`; the image-only release is `/home/dev/work/quest-plan006-release`. Source PR33 is complete. Ops PR2860 is merged and live verification is complete. Activity `act-235605-241355` ended. Owned fixtures4395/4396 are stopped; unrelated4392 remains untouched. All browser and authoring leases are released.

Published image:

```text
ghcr.io/thaynes43/haynes-quest:sha-d932b484a32d80e4cf3ad2ece1e99d3620d4c55c@sha256:582737215e73ab34dc22445feac16f1773c20b91c27b4f82f3fdcec3ec077a27
```

Application main run 34659017677 and Documentation run 34659017660 passed. Independent cryptographic attestation retrieval could not complete because dev-env could not resolve GitHub’s attestation-storage host. CI provenance/signing and independently matched registry bytes are recorded; do not claim an independent signature verification.

The new playtest pod is `haynes-quest-playtest-547b7f95b7-cdpbr`, UID `9292abea-d1f2-4ba5-8610-b7b88eb321ec`, Ready with zero restarts on the exact published digest. Flux and HelmRelease generations are observed at 3/3. Both hosts’ health/readiness routes returned HTTP200 with valid TLS. Normal app UID remains `d3e0117d-9dc5-4716-9343-2a740147171b` on 3502ac7/digest743bca. Dev-env UID is `c3a94756-af35-405e-93bc-eb05c2979d3a`, all three containers Ready with zero restarts. Normal and dev-env retained their identities, images and zero restart counts. Routing, Services, selectors and secret references remain unchanged. The before-snapshot omitted Cilium policies; their pre-existing generation-1 identities and validity plus the image-only render establish the documented policy non-mutation evidence. [Rollout evidence](../docs/assets/media/release/v002/rollout-verification.json) contains all 19 checks. Old release details are retained in [WO048](work-orders/048-release-verification.md).

## Remaining owner review and future work

Physical iPad/iPhone Safari controls, device frame times, listening, child playtesting and exact final-art approval remain open. Browser emulation and audio-node checks do not replace those. Concept v002 corrected the keepsake’s missing rear wedge; its existing v001 model already had the support.

Real family photos, full-name/birthday Immich lookup, per-level photo and encounter curation, parent/admin roles, favorites/exclusions and era overrides belong to [DESIGN012](../docs/designs/012-player-journey-curation.md). OAuth/admission remain deferred. Fictional access cannot read Immich; no private photo import is authorized by the offer of a later 37-year archive test. Lifetime difficulty, abilities and returning years later are [BL06](../docs/BACKLOG.md#bl-06-a-lifetime-campaign-that-grows-with-the-player).

Discuss short enemy pitches and the children’s interests with Tom before further expensive production. FNAF is a later interest for his son; no new Nap/Diva/FNAF work is active. Nap’s partial model and editable checkpoint remain preserved in WO032 and `scripts/assets/parody-remix-trio/resume-notes.json`; Diva is concept-only. Do not regenerate completed assets or resume paused modeling automatically.

Follow [TEAM](TEAM.md): Astra max owns architecture, UI/copy, art direction and integration; native Sol xhigh handles bounded ordinary tasks; each Blender task uses a fresh Astra max agent and an exclusive lease. [AGENTS.md](../AGENTS.md) and the [catalog maintenance rule](../docs/PROCESS.md#asset-catalog-must-stay-current) require every asset change to include matching reviews, inventory, inspiration and thumbnail navigation in the same PR, with verified publication.

WO051 released the Besties scene at `/workspace/haynes-quest/bickering-besties/v001/live-scene-release.blend`, SHA256 `927ee5a27a13707798ed0e1a98060f9eeda999de6fe485cf4bda410055a74e2f`. The older Nap scene remains `/workspace/haynes-quest/parody/remix-trio/v001/live-scene-release.blend`, SHA256 `9a84bd4c72e70292512bd605f4da44f6fcccdca290816d230aa0bc053c972afe`. All 68 Besties delivery hashes passed. No pending generation, Blender lease, OAuth work or dev-env restart is part of this release.

These closing records change documentation only. The playtest remains pinned to the reviewed d932b484 image, whose game, catalog and guide already contain this release. Historical authoring/release records remain in git; private browser cookies and raw test captures remain on the PVC outside static-site input.
