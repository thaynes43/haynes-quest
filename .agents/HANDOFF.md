# Current handoff

**[PLAN013](plans/completed/013-vertical-level-authoring.md) is complete: floating platforms and reusable vertical sections are deployed and verified.** [App PR54](https://github.com/thaynes43/haynes-quest/pull/54), source `c7f034af16ff39f0007d76697569db382a83d562`, supplies the private release. [WO092](work-orders/092-vertical-authoring.md) and the [release index](evidence/vertical-authoring-release.json) preserve source, checks, image/assets, report hashes and cleanup. Sol Ultra and authorized Opus 5 handled bounded implementation, review, testing and release; Astra retained architecture, UX and final review.

## Editor and building tools

- [Level editor](https://haynes-quest-playtest.haynesops.com/editor): editable copies of The Block Party and Besties Obby.
- [Building guide](https://haynes-quest-playtest.haynesops.com/studio/level-editor.html): visual workflow, vertical examples, portable JSON and shared agent commands.
- [Private playtest](https://haynes-quest-playtest.haynesops.com/): ordinary game entry.
- [Asset catalog](https://haynes-quest-playtest.haynesops.com/studio/assets/catalog.html): unchanged artwork and review status.

Optional v2 platforms can float outside named routes and still appear as solid geometry. Required objectives and explicit jump checks remain enforced. **Add → Build a section** creates a raised arch or zigzag ridge with platforms, connections, checkpoints and a side branch in one undo step. Climbing steps range from 2 to 12; the guide's welcome-to-woodland-rest left arch reaches 3.6 units with 12 steps at 0.3 rise. The shared `section.add` command and spatial `inspect` output give agents the same capability without generating runtime code. Existing main routes, anchors, shipped level documents and movement physics remain unchanged.

[PLAN012](plans/completed/012-level-editor-mvp.md) and [WO091](work-orders/091-level-editor-mvp.md) retain the original editor MVP/parity evidence. The versioned project supports course pieces, fixed gameplay anchors, arenas, connections and routes; undo/redo, attached-object movement, guarded imports, deterministic exports and browser-local autosave are implemented. Frozen draft snapshots use the real game runtime. Desktop remains the primary authoring surface; narrow screens use panel tabs.

Drafts are **saved in this browser**, not synced. Export JSON to back up or share work. The private fixture retains two recent playtest runs per browser session; a newer run can expire an older game tab. Draft persistence is separate. This release adds no personal-photo queries, artwork or shared publishing. PRD002, accepted ADR003 and DESIGN019 govern the editor boundary.

## Verification and deployed release

[Ops PR2992](https://github.com/thaynes43/haynes-ops/pull/2992), merge `275b0f8d087a87cd3d11b12e019c21bce6470071`, deployed the exact app image through Flux/Helm generation 13. Image digest `sha256:798d34aed190766547b2bc19e3cd8f398b45bf2bc35e1c0ed09888013fb48569`, served JS `index-D0_JVj6_.js` and CSS `index-Bs8n_p7X.css` match the tested candidate; full measurements are in the release index. Editor, guide and health endpoints respond successfully. Normal Quest and dev-env identities, generations, images and pod state are unchanged.

All 757 CI tests pass, including 12 real PostgreSQL cases, plus typecheck, lint, immutable-course validation, production/container builds and strict documentation/media checks. Controller tests cover both avatar stages, tall and uneven routes, rotated courses, original routes and fall recovery. Independent review corrected local obstacle placement, descent fitting and UI feedback/state problems.

Local Chromium passes the new vertical flow, all 18 editor workflow scenarios and all three authoring groups. The tall example's visible UI creates 23 platforms/checkpoints and previews their exact geometry. Hosted Chromium repeats floating-platform save/reload/runtime resolution, section undo/redo, all eight generated edges with normal keyboard input, deliberate crest recovery, and phone/tablet authoring controls. Final page/console/HTTP error arrays are empty. Prior two-chapter normal-input adventure acceptance remains recorded in WO091; it was not redundantly rerun for this placement-only change.

Chromium emulation does not establish physical Safari acceptance or hardware performance. The app-wide zoom policy from [WO090](work-orders/090-app-wide-zoom-lock.md) remains in force; browser/system accessibility overrides remain outside webpage control. Earlier control/progression repairs remain recorded in PLAN011 and WO085/086/090.

## Resources and next work

Release activity `act-045405-291465` is ended. Local fixture `quest-vertical-candidate` is stopped; port4430 is closed on IPv4/IPv6 and browser contexts are closed. Raw evidence is archived at `/home/dev/artifacts/haynes-quest/vertical-authoring-20260920-c7f034a`; `tall-section-editor.png` and `tall-garden-project.json` provide a screenshot and portable example. Completed separate CLI worktrees are reaped. Repository-only closeout records do not require another game image promotion. No Blender scene or audio job is owned; do not restart dev-env.

Tom can test vertical authoring now. Discuss a few new encounter concepts before expensive modeling; exact final visual/audio versions still need his review before promotion. Astra owns concepts/art direction; Blender uses fresh native Astra max agents with exclusive scene ownership under [TEAM.md](TEAM.md). Keep catalog/review/thumbnail updates in every asset PR.

[PLAN010](plans/010-parent-prepared-memories.md), [WO080](work-orders/080-identity-curation-readiness.md), DESIGN012/016 and the backlog remain inputs for personal-photo admission, curation and future platform decisions. Define those contracts before querying family photos. Current pictures and chronology are fictional. Assets remain 23 GLBs, four source WAVs and six fictional pictures; the joint Besties look is approved, with exact final-art review separate.

Preserve Besties master `/workspace/haynes-quest/bickering-besties/v001/live-scene-release.blend` (SHA256 `927ee5a27a13707798ed0e1a98060f9eeda999de6fe485cf4bda410055a74e2f`) and Nap partial master `/workspace/haynes-quest/parody/remix-trio/v001/live-scene-release.blend` (SHA256 `9a84bd4c72e70292512bd605f4da44f6fcccdca290816d230aa0bc053c972afe`). Preserve Diva's concept and keepsake rear-wedge work. No authoring scene or audio job is owned; do not restart dev-env.
