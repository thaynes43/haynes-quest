# Current handoff

Updated September 11, 2026 after Tom's first family playtest. [PLAN006](plans/006-playtest-polish-and-besties.md) is active in `/home/dev/work/quest-playtest-feedback`, branch `agent/quest-playtest-feedback`, base `698c9c7`. The touch wand/second-boss progression report is the first priority, followed by sound, foliage, friendly bonuses/penalties using the six existing creature assets, and Operation Besties. Combat, audio, friendly persistence and the pure Besties routine have passed their focused checks. Root is integrating scene/UI and catalog; catalog v3 compatibility and server audit lanes run independently. Tom confirmed iPad/iPhone touch and approved the pink-and-black joint concept for modeling. No new release has been made yet. The earlier PLAN004/005 delivery evidence below is historical and does not establish that real iPad touch play was satisfactory.

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

Follow [TEAM](TEAM.md): Astra max owns architecture, UI/copy, art direction and integration; native Sol xhigh handles bounded ordinary tasks; every Blender task uses a fresh Astra max agent and an exclusive scene lease. Fable5.1 sessions through `agent-run` are explicitly authorized when useful. Current exclusive Blender lease: native Astra `besties_models`, WO051, `/workspace/haynes-quest/bickering-besties/v001`; preserve the old released Nap scene and its hash. No other Blender writer is permitted until this lease is released. No root browser lease, audio generation or deployment activity is active.

Nap remains the first partial v001 export, SHA256 `e1cf47bf78e5edb53287e20e0b27ccb7886872bcefe2782a9e1fb31a91a8c7c7`. Cap bands, arm attachment, seated height and a small weight discrepancy still need correction; proposed fixes were never built. Diva is unbuilt. [WO032](work-orders/032-blender-remix-trio-evidence.md) and `scripts/assets/parody-remix-trio/resume-notes.json` preserve sources. The released scene is `/workspace/haynes-quest/parody/remix-trio/v001/live-scene-release.blend`, SHA256 `9a84bd4c72e70292512bd605f4da44f6fcccdca290816d230aa0bc053c972afe`. Do not regenerate completed assets or resume that scene automatically.

Durable worktrees: `/home/dev/work/quest-parody-obby` (game and live game evidence), `/home/dev/work/quest-visual-catalog` (catalog and publication/live evidence), `/home/dev/work/quest-catalog-promotion` (checked ops pin), `/home/dev/work/quest-release-records` (final records). Fable's CLI task was reaped; its retained branch and full source bundle/log/results are under the game worktree's `test-results/fable-042/`. The owned local fixtures on ports 4391 and 4394 have stopped; the unrelated lighting fixture was left alone. Temporary synthetic cookies were not committed. Runtime releases continue through checked GitOps PRs; no dev-env restart or startup-resource change is part of this work.
