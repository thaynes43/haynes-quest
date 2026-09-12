# Current handoff

**[PLAN008](plans/008-mobile-reliability-and-builder-direction.md) is active, September 12, 2026.** Tom's next physical iPhone test reports inaudible sound/unresponsive audition, retained collected keepsakes, an attack-triggered popup and stationary/non-threatening Besties. Prior automated passes did not establish these paths worked on his phone. Lead `/home/dev/work/quest-mobile-reliability`, branch `agent/quest-mobile-reliability`, base `d461cda`; WO071–073 cover bounded native Sol investigations. Fix basics and remove the persistent jump hint before expanding obby content. [DESIGN016](../docs/designs/016-authored-levels.md) records his human/agent builder pivot, freely placed integrated/uploaded memories and period suggestions with Show more. No new assets, OAuth or dev-env restart.

PLAN007's release below remains the current deployed baseline, not acceptance of this new feedback.

## Open the updated test

- [Fresh private playtest](https://haynes-quest-playtest.haynesops.com/?playtest=plan007): **Play from the beginning** or **Try the Besties chapter**. The query opens the current shell rather than reusing an old tab.
- [Visual catalog](https://haynes-quest-playtest.haynesops.com/studio/assets/catalog.html): thumbnail navigation, inspiration, models, animations and sound previews.
- [Playtest guide](https://haynes-quest-playtest.haynesops.com/studio/assets/playtest.html): current controls, three-memory loop, actual game captures and included/deferred scope.

Every test starts fresh; Leave/reload resets the run. World taps/Space jump from age zero. Contact collects gear and memories; Attack is the large action and Bash the smaller secondary after finding a shield. Two minor memories keep the current age; the major after each boss advances it. Visible grass and stronger gesture-unlocked sound are present; Help has a test-sound button and volume control.

## Release and ownership

Application [PR35](https://github.com/thaynes43/haynes-quest/pull/35) merged as `b66b8ee2723480c6c1e0226af9018109489a1817` after all 350 tests, application/docs/container checks passed. Main Application 34670404335 and Documentation 34670404348 passed, including provenance/SBOM and signing. Anonymous registry response and independently hashed bytes matched the published digest. Operations [PR2862](https://github.com/thaynes43/haynes-ops/pull/2862) passed all nine checks and reviewed main diffs, then merged as `6b39ea6cb74880be0e274a5501ad5c067bab8d93`. [WO070](work-orders/070-plan007-live-release.md) and [release evidence](../docs/assets/media/release/v003/rollout-verification.json) record exact scope and limitations.

The exact tested and hosted client is `index-Bn3nnDAn.js`, 1,041,657 bytes, SHA256 `0e795d99f5fd820bc5388c8ae24c350f4214c3ac5a6fbcbdc444b9ae5db43702`. Hosted real-touch smoke, direct Besties/held wand, exact missing-Pink retry, six fictional image bytes and the desktop/phone catalog all pass. The full age 0 → 4 → 7 boss route is local exact-client evidence; it was not replayed in full on the hosted image.

Implementation/evidence: `/home/dev/work/quest-playtest-reset`; scoped ops release: `/home/dev/work/quest-private-release-prep`; closing records: `/home/dev/work/quest-plan007-records`, branch `agent/quest-plan007-records`. These records document the completed release without changing game source or the private image pin. Raw evidence and review tools remain in ignored `test-results/` directories on the PVC. Original release baseline identities are preserved; unrelated Plex PR2861 only advanced the source revision during the usage pause.

Activity `act-033848-289886` ended after hosted checks. Owned fixture 4397 stopped; unrelated 4392 remains untouched. All browser and authoring leases are released. No pending generation, OAuth, real-photo import, rollout or dev-env restart remains. Next work is Tom's physical playtest and creative direction; do not reopen completed authoring or release tasks automatically.

## What is verified

[WO066](work-orders/066-fresh-playtest-browser.md), [WO069](work-orders/069-plan007-integration.md) and the [sanitized acceptance record](../docs/assets/media/playtest/v003/local-acceptance.json) preserve exact scope. The final client completed an uninterrupted age 0 → 4 → 7 route with keyboard movement/jumps and visible touch combat, all six memories, both bosses, missing-Pink fallback/retry and a fresh Besties shortcut. Five local obstacle recoveries and zero health-zero combat retries occurred. A real defect that cleared a held stick after a fall is fixed and independently regression-tested.

Separate clean real-touch checks prove held-stick jumping, held wand damage (enemy HP 6 → 3 while movement stays held), real touch cancellation, fresh Leave/reload, sound output/mute/volume restoration and portrait/landscape controls. Earlier invalid synthetic pointer capture and slow sequential CDP driver failures remain diagnostic records, superseded by the clean final smoke. Chromium's partial-contact release is an observed extension outside the portable CDP contract; no physical Safari claim follows from it.

The [local catalog audit](../docs/assets/media/playtest/v003/catalog-local.json) passed desktop 1440 × 1000 and phone 390 × 844: 37 entries, 54 thumbnails, 28 review pages, 26 exact GLBs and both eight-clip Besties viewers, with zero unexpected errors. Runtime uses 23 GLBs and four unchanged source WAVs, with revised sound mixing. Six original fictional illustrations and actual final-client screenshots are included in the current guide. The mandatory same-PR catalog rule remains in AGENTS.md and docs/PROCESS.md.

Fable5.1 mobile research (WO062) and source review (WO068) completed at the requested xhigh effort; root resolved findings in DESIGN015/WO069. Tasks were reaped after pushing reports/probes; remote branches retain 16c5d4f/bfadcd1 and 04eb71d, and raw evidence remains in the implementation worktree's `test-results/fable-reviews/`. Native Sol lanes completed their scoped work. On resumption the collaboration tool could not reopen a completed agent because its thread limit was reached; root is completing the remaining release locally rather than starting unrelated provider sessions.

## Hosted release and isolation

The private playtest runs `ghcr.io/thaynes43/haynes-quest:sha-b66b8ee2723480c6c1e0226af9018109489a1817@sha256:eb685f46f8682e2b73505e02e0a52e738879d4c142b42c6af83fe7d2ec858cdc`. Flux applied exact operations merge `6b39ea6cb74880be0e274a5501ad5c067bab8d93`; private Deployment and HelmRelease are observed at generation 4/4. Pod `haynes-quest-playtest-5fd6bf5558-4mtxj`, UID `0f42455e-4dc1-4354-a605-923446132889`, is Ready with zero restarts on that digest and the ephemeral flag.

All 23 rollout/isolation checks passed. Normal Quest remains on 3502ac7/digest743bca, pod UID `d3e0117d-9dc5-4716-9343-2a740147171b`. Dev-env pod UID remains `c3a94756-af35-405e-93bc-eb05c2979d3a`, all three containers Ready with zero restarts. Services, routing and policy identities remain unchanged. The combined Secret and PostgreSQL egress remain present but unused by the new in-memory application path; existing database records were not deleted. PLAN006 history remains in its completed plan and WO057/061.

## Remaining owner inspection and future work

Physical iPhone/iPad Safari feel, frame times, speaker listening, child response and exact final model/audio review remain open. Headless SwiftShader measured 9–10 fps and does not meet the device frame target; it does not establish physical-device performance. Cached WebKit cannot launch because required GStreamer libraries are absent. No host dependency or dev-env change was made.

The approved Besties joint pink/black look is delivered as two candidate models. Six existing creatures are friendly residents who offer optional healing; deliberate harm has a recoverable penalty. Final-art approval remains distinct from permission to use the private candidate playtest. The earlier keepsake rear-wedge concept correction is preserved; its model already had the support.

Real family photos, full-name/birthday Immich setup, curated minor/major memories, child interests/exclusions, era enemy/boss overrides and parent/admin roles remain [DESIGN012](../docs/designs/012-player-journey-curation.md). OAuth is deferred. Lifetime difficulty/abilities and returning years later are [BL06](../docs/BACKLOG.md#bl-06-a-lifetime-campaign-that-grows-with-the-player). Tom's offer of 37 years of photos is future test direction, not permission to import private media now. Discuss brief enemy pitches before further expensive modeling; FNAF is a later interest for his son.

Nap's partial checkpoint and Diva's concept remain preserved; do not resume them automatically. Besties scene master: `/workspace/haynes-quest/bickering-besties/v001/live-scene-release.blend`, SHA256 `927ee5a27a13707798ed0e1a98060f9eeda999de6fe485cf4bda410055a74e2f`. Older Nap master: `/workspace/haynes-quest/parody/remix-trio/v001/live-scene-release.blend`, SHA256 `9a84bd4c72e70292512bd605f4da44f6fcccdca290816d230aa0bc053c972afe`. No pending authoring job or scene lease exists. Follow TEAM: Astra lead owns UX/copy/art/integration; fresh Sol xhigh handles ordinary bounded work; every Blender task uses fresh Astra max.
