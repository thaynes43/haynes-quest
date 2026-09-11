# Current handoff

- **Updated:** September 11, 2026 at 19:24 UTC. PLAN005 remains active; PLAN004 is historical/completed.
- **Lead:** `/home/dev/work/quest-parody-obby`, `agent/quest-parody-obby`, application PR28. Base includes checked main `0ef6214` (future-backlog PR29). Runtime head `236d221`; WO042 dispatch recorded in `f9e2b49`.
- **Routing:** AGENTS/TEAM govern: root Astra max owns architecture, UI/copy, art direction and integration; ordinary native Sol xhigh; every Blender task fresh Astra max. Separate Fable5.1 xhigh is explicitly authorized. No Blender jobs/owner and no new authoring.
- **Limits:** No dev-env restart; OAuth/admission deferred; fictional fixtures only. Exact owner asset review precedes normal private gameplay promotion. Ordinary checked application PRs merge autonomously. Audio is silent/unmapped; physical Safari and child playtests remain open.

## Active owner request and next action

Tom asked whether the game was ready and wanted clarity through playing. Root verified that the private URL still serves the old prototype and is finishing the corrected **two-chapter, four-model candidate** under [WO037](work-orders/037-playtest-release.md). Expanded setup, new models and lifetime content do not gate this first test.

Tom then explicitly requested **Fable5.1 through agent-run for agentic playtesting and polish**, clicking every button and finding failures before bringing him in for deeper inspection and creative direction. He reported resetting the usage limit after native sessions stopped. [WO042](work-orders/042-fable-agentic-playtest.md) is the self-contained work order.

**Fable task `haynes-quest-0911-152226` is running**, WT `/home/dev/work/haynes-quest-0911-152226`, branch `agent/haynes-quest-0911-152226`, based on root `f9e2b49`. Dispatched exact `claude-fable-5-1`, effort `xhigh`; actual transcript assistant model verified as `claude-fable-5-1`. tmux `task-haynes-quest-0911-152226`; log `/home/dev/work/haynes-quest-0911-152226.log`; transcript under `/home/dev/.claude/projects/-home-dev-work-haynes-quest-0911-152226/`. Its owned results checkpoint is `.agents/work-orders/042-fable-playtest-results.md` in that WT. Coordinate through work orders/PVC; it is a separate CLI session, not a native child.

**Browser/build lease belongs to WO042.** Root port4391 is running in `main:quest-parody-fixture`, log `/tmp/quest-parody-fixture.log`, synthetic in-memory backend, root `dist/client` and `site/`. Do not rebuild/restart while Fable tests. Current client `index-DcnSUtWQ.js`, 999061 B, SHA256 `aca24da69a17e811385fa7e15d94abcdf0a3a1f316762ba5088fefcbceba1b22`. No surviving live WO040 browser was found when handing over; unrelated MCP/browser processes must not be killed. Old4392 lighting fixture is not current acceptance evidence. No physical-device performance claim follows from SwiftShader's measured ~8–9fps.

Fable owns exploratory controls/flow testing and confirmed technical fixes; root retains creative decisions and final integration/release. Check actual progress and findings, intake reviewed commits, run appropriate final checks, rewrite PR28 around final results, squash-merge checked app, verify immutable image publication, then prepare the exact operations PR. Do not call the new build live before verification. Complete reviewable preparation before any final asset-promotion question.

## What has actually passed

**Complete keyboard journey passed 18:59 UTC** on `index-C6hLU3Dp.js`, 999033 B, SHA256 `80eca3323c7ab9164d00723789e1b5bfe612231468efa9bb234bc813f8a039ac`. The current Dcn bundle differs only by the mobile Save & leave accessible label. Both chapters, equipment, guard and fights, both bosses, media failure/retry, three decoded fictional images per bundle, age0→4→7, save/leave/resume, deliberate hazard/gap recovery, two gaps, runway jump and ferry all passed. Recorded recovery preserved authoritative HP/inventory/victories. Ferry carry offset drift was zero; page errors empty. Durable report and selected real-game screenshots: `docs/assets/media/playtest/v001/`. Local in-memory fixture does not establish database restart durability.

**Full touch is incomplete.** WO040 passed chapter one, actual decoded pictures/age4, deliberate gap recovery, both gaps, revised runway and ordinary fights, then boarded the ferry. Its last assertion failed while the screenshot showed the player still on the ferry. The prior agent's hypothesis is a pre-release rider-offset baseline: retained touch continues moving during the slow CDP release, invalidating comparison to that earlier sample. Fable must verify and fix the measurement if confirmed; do not call this a game defect or touch pass without evidence.

Interrupted harness is safely committed as **`6821dda` on `agent/quest-playtest-controls`**, WT `/home/dev/work/quest-playtest-controls`, clean. It owns the latest `tests/e2e/journey.mjs` and `obby-helpers.mjs`, with the passed keyboard driver and partial touch diagnostics, **not yet intaken to root**. Its synthetic captures/JSON remain in `test-results/`. Fable was instructed to inspect/recover this checkpoint before editing. Do not overwrite it with older root harness. Original WO031 retained-touch fixes are already in root `7ac8003`.

**Four-model catalog audit passed:** four pages and exact models, 20 interactive clips, 28 decoded MP4s, 20 stills/eight posters, four touch orbits and four exact editable masters; all error/failure/external counters zero. Evidence at `docs/assets/media/parody-playtest-audit/v001/`, WO038; root `5c55740`. Five actual-artifact tests are intaken `0112543`; default four-model browser selection `87d67ac`. WO039 archive parser/planner regressions are intaken `a6e4142`/`f37b81a`.

Latest local runtime checks at236d221: typecheck/lint/build pass; **218 tests passed, 9 PostgreSQL tests skipped locally (227 total)**. Application CI run34636777254 verify and container-check passed, Documentation34636777234 passed. PG runs against a dedicated real service in CI. After final intake run required checks and strict docs: `PATH=/home/dev/work/haynes-quest-overnight-mvp/.venv-docs/bin:$PATH pnpm docs:build`. Respect the browser freeze. Latest PR body and guide must be updated with final touch/exploratory findings.

## Corrected game and completed fixes

Loop: gear → forgiving obby and goofy period enemies → boss → released pictures → deliberate bundle consumption → age/abilities → next calendar period. Server owns commands, HP, equipment, victories, memory release/consumption, age and saved plans. Pre-boss collection cannot grow the traveler. Age0 starts without jumping; age4 unlocks it; earlier abilities/gear carry forward. Falling returns to a nearby checkpoint without loss of victories/equipment.

New plans use immutable **parody-catalog-v2**: first chapter Mister Hiss, Peel Patrol, Drama Dragon; second chapter Sir Flush-a-Lot plus returning Peel/Dragon. Six frozen encounter identities reference four completed v001 models. Original v1 plans/definitions stay archived and are validated against their own registry. Unsupported/missing saved artwork must remain an explicit recoverable condition, never silently swapped. Root fixed v2 period copy/palette and asset-id-based animation lookup. Nap/Diva are excluded from new test saves.

Actual playtesting found and fixed three UX defects: root6070cc1/30f2b02 makes jumped-to checkpoints arm anywhere on the safely landed supporting island; c6945d3/d745dd0 moves and shortens the runway bar to provide safe post-gap/pre-ferry waiting areas;236d221 retains the Save & leave accessible name on narrow screens. [WO041](work-orders/041-landing-checkpoint-results.md) proves landing/no premature checkpoint, complete bar rotation at both safe resting points, and actual child-collider jump crossing. Prior WO033 adversarial failures were recovered/fixed in2d44ec4/e4de17e/f7de6a8 and45425b9/06cf31f/9a6a962; original Fable hit quota before final report. Do not redispatch that old session or claim it completed its report.

## Scope and future vision to preserve

The current game uses **fictional illustrations**, not family photos. Immich adapter and initial global selection exist, but real preview thumbnails, per-level curation, roster alternatives/readiness, admin roles and admitted login remain open; see WO035 and DESIGN012. Keep full name/birthday private, derive periods from photo metadata and birthday, freeze curated identities, allow explicit relevance corrections/overrides. No private photo import is authorized by the offer to test later.

Tom wants recognizable funny pop-culture parodies. The six rejected generic creatures may become ambient/friendly candidates; none is an approved enemy. Daughter6 needs approachable obby timing/recovery; son11 likes FNAF more than Skibidi. Completed four-model cast is temporary playtest/library content, not their permanent roster.

**The Besties duo is next for collaborative design**, with alternating obstacle tricks and a shared recovery window approved. Appearance remains unsettled; exact persona imagery was not visually verified after search/retrieval failures. Preserve [WO036](work-orders/036-besties-design-brief.md); do not invent approval or start expensive modeling. Parent setup, favorites/exclusions/surprises, era defaults/admin overrides belong to DESIGN012.

Lifetime difficulty/abilities, catching up to real lived memories and returning years later are **future BL06**, checked docs-only PR29 merged `0ef62144c8e324e24e51b213972adb8281c152b0`. Real time alone unlocks nothing; later journeys extend explicitly. Tom's offered37-year archive supports later private baby-to-adult testing, not an import now. No expanded lifetime implementation before this playtest.

## Exact asset state and authoring recovery

Review guide `docs/assets/playtest.md`; all **15 exact candidate GLBs** and SHA256 values in `docs/assets/media/playtest/v001/artwork.json`: two traveler stages, five environment/keepsake pieces, four tools, four characters. No owner approval recorded; no audio mapped. Completed four v001 character hashes:

| Model | SHA256 |
| --- | --- |
| Mister Hiss | `14bcfe2dcc060cbfd6908a281de0795f6b426144a63d322f89f1ec234e42572f` |
| Peel Patrol | `72962eb3a1cb2a08e13d9082dd506fbe7186798f48d0dee7af3cdd72b7891ed5` |
| Drama Dragon | `13c6cb5185385f85cda2e16027ad201a2ea1e2a4ad0f5eb7a13cba9d073fa933` |
| Sir Flush-a-Lot | `c4db8f231fcdb29d71ddc605df89b928ef0aeaa29b91af3b1e3041041f0cdf49` |

Five clips each and authored contact timing are preserved in exact manifests. Completed source/media/model intake: WO027 Mister Hiss d042faa→d167b41; WO028 Peel/Dragon f696f81→27880dd; Flush c351580; review pages6b9e57d. Editable sources and artifact manifests remain on PVC/authoring service.

WO032 paused authoring source9bac49f→bbd6aad; all14 owned jobs exited/reaped and lease released17:44:32.601411UTC. Final checkpoint `/workspace/haynes-quest/parody/remix-trio/v001/live-scene-release.blend`,7641662B, SHA256 `9a84bd4c72e70292512bd605f4da44f6fcccdca290816d230aa0bc053c972afe`. Nap's initial cap/arm/seated issues and unbuilt corrections remain in `scripts/assets/parody-remix-trio/resume-notes.json`; Diva never built. Do not resume without an agreed brief. Earlier Mister/Peel/Dragon final checkpoint references remain in their work orders/manifests. PLAN004 nine-model/four-audio historical first pass is retained. Keepsake conceptv002 fixed the rear wedge; actual modelv001 already contained it.

## Live baseline and release preparation

Private URL `https://haynes-quest.haynesops.com` still runs **old** tag `sha-3502ac7120f6d7741a1a209415f4c9eeb33f826b`, digest `sha256:743bca475c2e19d2534ecd3be7f952e52d0d5adb5724599f1285218f91e87e37`, pod `haynes-quest-7d9b698574-nds6g`. Do not present that as the corrected playtest. Root PR28 remains draft; app source merge does not itself deploy.

Ops WT `/home/dev/work/quest-parody-promotion`, branch `agent/quest-parody-promotion`, base d2acee8; preparation commits5e540b7/7e20ae7 only. Read its `.agents/work-orders/2026-09-11-quest-parody-promotion.md`. No image pin changed, no opsPR/declaration/reconcile. After checked app merge verify image publication/signing and anonymous immutable digest, change only the Haynes Quest app pin/evidence, run render/Flux Local checks and prepare a concrete opsPR. Exact owner asset decision is the final promotion gate. Prior general praise and readiness requests are not exact artifact approval.

Target Kustomization `frontend/haynes-quest`, source `flux-system/haynes-ops`; app path `kubernetes/main/apps/frontend/haynes-quest/app`. Fixture runtime mounts only app session/database Secret, never Immich. Before an authorized rollout declare activity for `frontend,haynes-quest`, merge checked GitOps PR and reconcile the target; verify new digest/health/catalog/game/save-resume, then end activity. Do not manually restart/delete pods. dev-env last verified UID `c3a94756-af35-405e-93bc-eb05c2979d3a`, pod `dev-env-dfdd8c894-l724p`, all restart counts0.
