# Current handoff

Updated September 11, 2026. [PLAN006](plans/006-playtest-polish-and-besties.md) is in final verification/release. Application [PR33](https://github.com/thaynes43/haynes-quest/pull/33) is open from `/home/dev/work/quest-playtest-feedback`, branch `agent/quest-playtest-feedback`, source checkpoint `5df49dc` (base `698c9c7`). The deployed private image is still the old b15bc98 baseline below; do not claim the new release is live yet.

The reviewed source adds repaired touch wand targeting/beam/feedback, prompt dragon retaliation at the arena edge, four gesture-unlocked sounds with controls, more planting, six healing friends with deliberate harm/amends and persistent penalties, and the approved-look Besties duo for new compatible journeys. V1/v2 saves retain their cast. Final build: `index-D3lvcZ1s.js`, 1028608 bytes, SHA256 `718cc412a27bb79d768238f6326f154a0cccb52da555a69ed3ec4ce31173cebe`. Typecheck, lint, build and strict docs/link/media build pass. Local suite: 284 passing tests, ten dedicated PostgreSQL tests skipped; The first CI run executed all 294 tests and found one outdated legacy-test fixture; it now clears the new friendly sidecar when constructing a legacy row. Production validation is unchanged; CI must rerun all ten PostgreSQL cases.

The first full touch journey passed both chapters and age 0→4→7; its earlier bundle/art scope is preserved in `playtest/v002/first-touch-evidence.json`. A later complete focused touch run proved friendly rewards/penalties/amends/reload, native Web Audio controls, held-stick wand damage, nearby dragon retaliation within 2.038 seconds and Besties guarded/dizzy behavior. That exact earlier build is preserved in `focused-touch-baseline.json`. Fable5.1 completed WO056 on source3ba5a0c; WO061 resolves its findings. Root/Sol fixed airborne conversation opening, touch-release audio unlock, fall warnings, actor-targeted spell visuals and versioned model URLs. Native Sol `friendly_contract` completed the final focused touch run against source5df49dc with all three scenarios passing and zero page/HTTP errors; `focused-touch-final.json` records the exact hash. Its browser and fixture4396 are closed. All product authoring is otherwise finished.

WO058 static and WO059 desktop/phone catalog checks pass: 36 entries/cards, 26 models (25 complete, Nap partial), five shared references, Diva’s concept, four cues, 53 exact thumbnails, 27 review pages, both eight-clip Besties viewers and actual high-five select/play/pause. No browser/console/HTTP errors. `playtest/v002/catalog-local.json` preserves the report. The v002 runtime manifest contains exactly 23 GLBs/four cues. Root inspected the game/camera/catalog captures. Physical Safari, device frame time, listening and exact final-art approval remain open.

Current release ownership: root integrates evidence and carries PR33 through checks/merge/publication; Sol `besties_routine` audits application CI and the image-only operations release in `/home/dev/work/quest-plan006-release`. Its read-only audit found no isolation/additive-schema blocker and documents the non-transparent rollback boundary for newly written v3 saves. No pin or deployment activity is active. Root fixture4395 is running; fixture4396 is stopped; unrelated4392 must remain untouched. Fable task `haynes-quest-0911-190446` finished and was reaped after its report/probes/logs were retained in `test-results/fable-056/`.

WO051 Besties authoring and all resources are released. Final Pink SHA256 `0f7020f53ed257dd88e6a8cb9e8fb0011c70e84bf33bc2e55fb671473aea96ae`; final Black `0819c67a17d38f340ace0ebdaff6bd316a800286af7f7a0da91273e898d80f05`; both have eight clips and approach to 0.90m centre spacing for the high-five miss. Joint pose/reel, editable sources and 68-file delivery manifest are complete. One whitespace-only authoring-source cleanup refreshed its intake hashes without changing artwork. No new modeling, OAuth/family-photo access or dev-env restart is authorized in this release.

## Open these from the home network

- [Private playtest](https://haynes-quest-playtest.haynesops.com/): choose **Demo Adventurer** and retain all three fictional pictures for both chapters.
- [Visual asset catalog](https://haynes-quest-playtest.haynesops.com/studio/assets/catalog.html): 33 entries with thumbnail navigation, inspiration images, model viewers and clear readiness labels.
- [Included and unfinished features](https://haynes-quest-playtest.haynesops.com/studio/assets/playtest.html): controls, actual game captures, temporary cast and review scope.

The normal `haynes-quest.haynesops.com` address deliberately retains the earlier prototype. Use the separate playtest address for the corrected game and new catalog. DESIGN007 and [WO044](work-orders/044-isolated-playtest-release.md) permit this clearly labeled candidate review before final-art approval. No asset is marked owner-approved.

## Delivered and verified

The loop is gear → forgiving obby and goofy period enemies → boss → released pictures → deliberate memory consumption → age and abilities → next period. Server-owned commands and saves retain equipment, victories and progress. Age zero begins without jumping; age four unlocks it; the second bundle reaches age seven. Falling returns to a nearby checkpoint without removing victories or equipment.

Fable5.1 ran through `agent-run` at the requested `xhigh` effort. Its actual model was verified. It completed the original keyboard/touch journeys and found a held-finger menu defect among 27 exploratory cases. Root corrected implicit pointer capture and duplicate activation; [WO043](work-orders/043-touch-menu-regression-results.md) proves Help, album, sound and Save while holding the stick, plus subsequent keyboard, touch and mouse input.

[WO046](work-orders/046-coordinator-final-playtest.md) records final gameplay acceptance. Keyboard completed both chapters in one successful run. The same touch save completed across a browser restart after documented harness timing/assertion failures, then reopened twice with all three pictures visible. Do not describe that interrupted touch route as one uninterrupted successful process. Physical Safari and child playtests remain open.

The live game verification at 21:29 UTC passed held-joystick menus, exactly one saved journey, actual-controls boss victory, visible fictional memories, reload, absorption to age four/jumping, entry into 2024 and saved-resume of that chapter. The catalog-only release then retained the exact game bundle and original artwork. [WO048](work-orders/048-release-verification.md) records final live delivery and runtime evidence.

[WO047](work-orders/047-visual-asset-catalog.md) covers the catalog: 23 completed models, Nap's partial model, Diva's concept, four reference-sheet entries and four sound auditions. All 24 GLBs, nine retained WAVs and 23 source images are inventoried. All 26 review pages and 15 fragments passed checks. Fifty small thumbnail files total 942,748 bytes. Fifteen cards identify models used in the playtest. Every model has its inspiration and available 3D review; each path piece and tool has its own card.

Final hosted checks at 21:41 UTC passed all 50 thumbnail hashes/MIME/lengths, all 24 model hashes/MIME, all review pages/fragments, 33 cards and 57 image elements on desktop and phone, plus an actual phone tap into Nap's partial viewer with five clips. No page, console, HTTP, request or external errors were recorded. The separate earlier local audit retained 11 MP4 metadata cancellations without claiming video playback verification. Existing full motion audits remain in their versioned reports.

## Exact release

Application [PR28](https://github.com/thaynes43/haynes-quest/pull/28) merged as `9ccc7a8d89210f6da9ba12e031e124eade52ba6b`; catalog [PR30](https://github.com/thaynes43/haynes-quest/pull/30) merged as `b15bc98f1a6bec1108815bdea75794f86e1323db`. Final PR and main checks passed, including 236 tests with nine real PostgreSQL tests, builds, docs/media and containers. Main publication, provenance attestation and signing passed; anonymous registry lookup matched the exact digest.

Deployed image:

```text
ghcr.io/thaynes43/haynes-quest:sha-b15bc98f1a6bec1108815bdea75794f86e1323db@sha256:d7eddba8db5ccf60ea03bdcb7ba921e7486106b1ab34e7380c53929a355d4599
```

Game bundle: `index-BPeATrrp.js`, 1,001,106 bytes, SHA256 `15487f825f0f7d8125144d3a1eb49c37e5212bf6c7d0bb8de8f368f141bc6051`. Gameplay source has not changed since root `ff3ad87`. The final release-record update changes documentation only and does not advance this deployed image.

Ops [PR2857](https://github.com/thaynes43/haynes-ops/pull/2857) created the isolated review; [PR2858](https://github.com/thaynes43/haynes-ops/pull/2858), merge `f1e5133ada07014c225fdff32129ab320cd5ecd5`, updated only its image after all nine checks and an independent rendered-diff review. Flux applied that revision. Review pod `haynes-quest-playtest-9bd87959-gbk5v`, UID `96a8569c-5397-41df-b85e-36f3e4cc6ecc`, is Ready with zero restarts on the exact digest.

The normal app retains UID `d3e0117d-9dc5-4716-9343-2a740147171b` and old3502/digest743bca. Dev-env retains UID `c3a94756-af35-405e-93bc-eb05c2979d3a`; all three containers are Ready with zero restarts. Both activity declarations (`act-205400-187494`, `act-213939-197262`) ended. Initial DNS negative caching cleared across all three replicas without configuration changes or restarts. TLS is valid.

## Decisions and work still open

Real family photos, full-name/birthday Immich lookup, per-level photo and encounter curation, parent/admin roles, favorites/exclusions and era overrides belong to [DESIGN012](../docs/designs/012-player-journey-curation.md). OAuth/admission remain deferred; fictional access cannot read Immich. No private photo import is authorized by the offer of a future 37-year archive test.

Tom wants recognizable, funny period parodies and an approachable obby for his daughter, age six. His son, age eleven, prefers FNAF over Skibidi. The current four-model cast is temporary review content, not a permanent child-specific roster. The six creature assets now have an owner-directed friendly role: optional bonuses for the player and recoverable penalties for harming them. PLAN006 replaces the earlier provisional role descriptions.

**The Besties duo is the next collaborative design**, with alternating obstacle tricks and a shared recovery window agreed. Operation Besties is now authorized under PLAN006; the existing agreed duo routine remains the starting point. The approved joint concept is `docs/assets/media/bickering-besties/v001/concept.png` (SHA256 `1fb8f525b23c811dd1c3946faca219224bb10800c2517ae87ffdb40beaa0aee1`). WO051 owns production of bestie-pink and bestie-black v001. No FNAF asset is in production. Read [WO036](work-orders/036-besties-design-brief.md) before discussing the look. Do not resume expensive modeling without an agreed brief. Lifetime difficulty, abilities and returning years later are future [BL06](../docs/BACKLOG.md#bl-06-a-lifetime-campaign-that-grows-with-the-player), not missing work in this bounded playtest.

All final artwork still awaits Tom's exact-version review. The deployed baseline is silent. PLAN006 wires four existing cues with gesture unlock, preferences and bounded playback; local listening/browser checks and publication remain outstanding. Physical iPhone/iPad Safari, device performance and child playtests remain open. Concept v002 corrected the keepsake's missing rear wedge; its existing v001 model already had that support.

## Resources and recovery

Tom's standing catalog rule is now in [AGENTS.md](../AGENTS.md) and the [catalog maintenance procedure](../docs/PROCESS.md#asset-catalog-must-stay-current): every asset change includes matching reviews, inventory and thumbnail navigation in the same PR, with verified publication before asset delivery is complete. TEAM and the work-order/review templates carry this acceptance requirement into future dispatches. This instruction update does not change the deployed game or generate assets.

Follow [TEAM](TEAM.md): Astra max owns architecture, UI/copy, art direction and integration; native Sol xhigh handles bounded ordinary tasks; every Blender task uses a fresh Astra max agent and an exclusive scene lease. Fable5.1 sessions through `agent-run` are explicitly authorized when useful. WO051 released the Blender scene at `/workspace/haynes-quest/bickering-besties/v001/live-scene-release.blend` (SHA256 `927ee5a27a13707798ed0e1a98060f9eeda999de6fe485cf4bda410055a74e2f`). Preserve the old released Nap scene and its hash. No new authoring is authorized. Browser ownership and active fixtures are recorded at the top of this handoff; no audio generation or deployment activity is active.

Nap remains the first partial v001 export, SHA256 `e1cf47bf78e5edb53287e20e0b27ccb7886872bcefe2782a9e1fb31a91a8c7c7`. Cap bands, arm attachment, seated height and a small weight discrepancy still need correction; proposed fixes were never built. Diva is unbuilt. [WO032](work-orders/032-blender-remix-trio-evidence.md) and `scripts/assets/parody-remix-trio/resume-notes.json` preserve sources. The released scene is `/workspace/haynes-quest/parody/remix-trio/v001/live-scene-release.blend`, SHA256 `9a84bd4c72e70292512bd605f4da44f6fcccdca290816d230aa0bc053c972afe`. Do not regenerate completed assets or resume that scene automatically.

Durable worktrees: `/home/dev/work/quest-parody-obby` (game and live game evidence), `/home/dev/work/quest-visual-catalog` (catalog and publication/live evidence), `/home/dev/work/quest-catalog-promotion` (checked ops pin), `/home/dev/work/quest-release-records` (final records). Fable's CLI task was reaped; its retained branch and full source bundle/log/results are under the game worktree's `test-results/fable-042/`. The owned local fixtures on ports 4391 and 4394 have stopped; the unrelated lighting fixture was left alone. Temporary synthetic cookies were not committed. Runtime releases continue through checked GitOps PRs; no dev-env restart or startup-resource change is part of this work.
