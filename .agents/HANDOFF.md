# Current handoff

**[PLAN012](plans/completed/012-level-editor-mvp.md) is complete: the human/agent level editor is deployed and verified.** [App PR52](https://github.com/thaynes43/haynes-quest/pull/52), source `e017c58fa79d3fd63fd899124ec7a8929ba067d7`, supplies the private release. [WO091](work-orders/091-level-editor-mvp.md) and [the release index](evidence/level-editor-release.json) record source, checks, live assets, browser evidence and cleanup. Native Sol Ultra and authorized Opus 5 handled bounded implementation, testing and release; Astra retained architecture, UX and final review.

## Editor MVP

- [Level editor](https://haynes-quest-playtest.haynesops.com/editor): editable copies of The Block Party and Besties Obby.
- [Building guide](https://haynes-quest-playtest.haynesops.com/studio/level-editor.html): human workflow, portable project JSON and agent CLI examples.
- [Private playtest](https://haynes-quest-playtest.haynesops.com/): the existing game entry remains available.
- [Asset catalog](https://haynes-quest-playtest.haynesops.com/studio/assets/catalog.html): unchanged artwork and review status.

The visual workspace and CLI share the versioned project, atomic revision-checked commands and validation. Course pieces, fixed gameplay anchors, arenas, connections and routes are editable. Undo/redo, attached-object movement, guarded imports, deterministic exports and browser-local autosave are implemented. A frozen draft snapshot uses the real game runtime through actions, retries and chapter transitions. Published level documents stay immutable. Desktop is the primary authoring surface; phone and portrait tablet layouts use panel tabs with reachable controls.

Drafts are **saved in this browser**, not synced. Export JSON to back up or share work. The private fixture keeps two recent playtest runs per browser session; another run can expire an older game tab. Draft persistence is separate. The MVP keeps the current two-chapter roster, assets and mechanics; no personal-photo queries, new artwork or shared publishing were added. PRD002, accepted ADR003 and DESIGN019 record the platform boundary.

## Verification and release

[Operations PR2988](https://github.com/thaynes43/haynes-ops/pull/2988) merged as `445ab293aa30e0e7b8a187c92ba1db8aa399b352`. Flux and Helm applied the exact private image:

`ghcr.io/thaynes43/haynes-quest:sha-e017c58fa79d3fd63fd899124ec7a8929ba067d7@sha256:6c6b12f6f7c776ab361c131af24770e0c746874d4cb091d6ec261c0135d9940c`

Hosted JS `index-6s8dBlhu.js` is 1,305,195 bytes, SHA256 `af327cb9e1de233a01924c64c9935f7298a3334876d6675ae1627257246f1078`. CSS `index-Bq4qRH_A.css` is 54,055 bytes, SHA256 `d3f267a3a7372b5409d89e35f198ced924235441d28936f1b2ce45e5d8bb0622`. `/editor`, the guide and health endpoints respond successfully. Normal Quest and dev-env identities, generations, images and pod state are unchanged.

All 675 CI tests pass, including 12 disposable PostgreSQL cases, along with typecheck, lint, immutable-course validation, production build, strict documentation/media checks and the container build. Independent review corrected snapshot lifetime, hidden editor shortcuts, import races, autosave, responsive layout and route-form adaptation. Exact duplicate connections remain repairable through guarded row indices.

The candidate completes both chapters through normal editor-entry gameplay, including equipment, minor memories, ordinary and boss fights, safe landings, checkpoint recovery, moving platforms, major memories, transition and final completion. Actual authoring checks cover all four Add types, duplicate/delete/undo, route forms, and completed/interrupted gizmo transactions. The final responsive correction passes phone, tablet and desktop control hit-testing and tablet panel switching. The exact hosted build passes all 18 editor workflow scenarios and all three authoring groups, including edited geometry through an ordinary pickup action, import-specific undo/redo, invalid-draft handling, reachable phone/tablet/desktop controls and zoom lock. HTTP/page/console errors are empty. The hosted normal-input adventure also passes both chapters through the editor snapshot, including both bosses, final memories, transition and completion, with no HTTP/page/console errors.

Chromium desktop/touch emulation does not establish physical Safari or hardware performance. The app-wide zoom policy from [WO090](work-orders/090-app-wide-zoom-lock.md) remains in force; browser/system accessibility overrides remain outside webpage control. Earlier control/progression repairs remain recorded in PLAN011 and WO085/086/090.

## Resources and next work

The scoped release activity `act-023946-191874` is ended. Root’s local fixture `quest-editor-candidate` is stopped and port4430 is closed on IPv4/IPv6. Hosted browser runs are complete and their contexts are closed. No Blender scene or audio job is owned. Do not restart dev-env. Raw evidence is archived under `/home/dev/artifacts/haynes-quest/level-editor-mvp-20260920-e017c58`; the committed release index preserves essential measurements and hashes. Completed separate agent worktrees are reaped. Repository-only closeout records do not require another game image promotion.

Tom can test this editor before the next expansion. Discuss a few new encounter concepts before expensive model production; exact final visual/audio versions still need Tom’s review before promotion. Root Astra owns concepts/art direction and Blender uses fresh native Astra max agents with exclusive scene ownership under [TEAM.md](TEAM.md). Keep catalog/review/thumbnail updates in every asset PR.

[PLAN010](plans/010-parent-prepared-memories.md), [WO080](work-orders/080-identity-curation-readiness.md), DESIGN012/016 and the backlog remain inputs for personal-photo admission, curation and future platform decisions. Define those contracts before querying family photos. Current pictures and chronology are fictional. Assets remain 23 GLBs, four source WAVs and six fictional pictures; the joint Besties look is approved, with exact final-art review separate.

Preserve Besties master `/workspace/haynes-quest/bickering-besties/v001/live-scene-release.blend` (SHA256 `927ee5a27a13707798ed0e1a98060f9eeda999de6fe485cf4bda410055a74e2f`) and Nap partial master `/workspace/haynes-quest/parody/remix-trio/v001/live-scene-release.blend` (SHA256 `9a84bd4c72e70292512bd605f4da44f6fcccdca290816d230aa0bc053c972afe`). Preserve Diva's concept and keepsake rear-wedge work. No authoring scene or audio job is owned; do not restart dev-env.
