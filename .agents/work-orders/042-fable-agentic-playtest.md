# WO-042: Fable hands-on playtest and polish

- Status: dispatch prepared September 11, 2026, 19:22 UTC.
- Owner request: Tom explicitly asked the lead to drive Fable 5.1 through `agent-run` for agentic playtesting: click every button, find and polish failures, then bring him in for deeper inspection and creative direction. He subsequently reported resetting the usage limit.
- Dispatch: separate `claude-fable-5-1`, `xhigh`, through `agent-run`, based on the lead's `agent/quest-parody-obby` branch. Verify the actual model/session before claiming work started. This is a new owner-requested attempt after the prior WO033 quota failure; do not loop on quota failures.

## Objective and scope

Exercise the actual two-chapter candidate as an inquisitive player on desktop and portrait touch. Cover every reachable menu, setup step, back/cancel, validation, preview, selection, start/resume, equipment, attack/guard/jump, deliberate failure/retry, boss release, picture loading/retry, memory consumption, chapter transition, save/leave and completion. Probe awkward but plausible combinations: repeated clicks, leaving/reloading mid-flow, movement interrupted by UI, failed media, narrow viewport and touch held while another action occurs. Fix confirmed technical defects, preserve a concise button/flow coverage table and reproducible evidence, and recheck affected flows. Do not merely run existing happy-path tests and declare success.

Read AGENTS.md, TEAM.md, DESIGN010/011 and docs/assets/playtest.md. Root Astra retains creative direction, UI writing/layout decisions, integration, PR/merge and deployment. Recommend UX/copy changes with exact evidence; coordinate through this work order/result file on the PVC. You may fix technical input/state/media/accessibility issues. Own your task worktree only. Do not merge or deploy from the child session.

No new modeling, images, audio, expanded parent/admin setup, Besties production, OAuth, real family photos, external messages or dev-env changes/restarts. No Blender owner/jobs exist. Physical Safari/child testing remains unperformed. Four temporary completed v001 characters across two chapters; artwork is candidate-only pending owner review. Normal private URL still serves the old prototype; test the local corrected candidate.

## Verified starting point

Lead WT `/home/dev/work/quest-parody-obby`, head `236d221` before this work order. PR28 is draft; all Application verification/container and Documentation checks are green at that head. Local 218 tests passed, 9 PostgreSQL cases skipped locally but run in CI. The first-pass catalog, four-model artifact contracts and combined model/media browser audit passed. Existing saved v1 plans are preserved; new v2 plans select only four completed models with returning Peel/Dragon.

The lead fixture is already running at `http://127.0.0.1:4391` in `main:quest-parody-fixture`. It serves the lead `dist/client` and `site` with synthetic in-memory saves. Client `index-DcnSUtWQ.js`, 999061 bytes, SHA256 `aca24da69a17e811385fa7e15d94abcdf0a3a1f316762ba5088fefcbceba1b22`. You have the exclusive browser lease during this work order. Root will not rebuild/restart this fixture while you test. For source fixes, create an owned fixture/port from your worktree, tell the lead through your result checkpoint, and avoid conflicting ports. Dependencies may be installed with the existing lockfile; share no mutable build output. Stop only your own browser/server processes when finished.

Complete keyboard course passed at 18:59 UTC on `index-C6hLU3Dp.js`, SHA256 `80eca3323c7ab9164d00723789e1b5bfe612231468efa9bb234bc813f8a039ac`. Dcn differs only by the small-screen Save & leave accessible label. Keyboard evidence/screens are committed in `docs/assets/media/playtest/v001/`. Both bosses, decoded fictional pictures, age0→4→7, save/resume, deliberate hazard/gap recovery, both jumps and ferry passed. No physical-device performance claim follows from the pod's SwiftShader ~8–9fps renderer.

## Interrupted touch work to recover first

The native Sol controls session reached quota after a partial touch run. Its two modified files remain in `/home/dev/work/quest-playtest-controls/tests/e2e/{journey,obby-helpers}.mjs`; inspect and preserve them before editing. Root will checkpoint them in that branch. They contain the passed keyboard driver plus touch and evidence improvements. You may copy/cherry-pick the checkpoint into your own branch. Do not discard it or blindly replace it with the older committed harness.

Touch has passed chapter one, actual memory decode/age4, gap recovery, both gaps, the revised runway and ordinary fights, then boarded the ferry. The final run failed its rider-offset assertion while the screenshot showed the player still on the ferry. The previous agent's hypothesis: `boarded` is sampled before a slow retained-touch release finishes; continued input shifts the relative offset before the carry measurement. Verify this from the helper. If confirmed, inspect after release, require ferry support and unchanged recovery count, then establish the carry baseline. This is an incomplete run, not a touch pass. Latest failure image and partial captures are in that controls WT `test-results/`.

Earlier actual UX fixes are already in the candidate: checkpoints arm anywhere on the safely landed island; runway bar moved/shortened to leave safe waiting space; Save & leave keeps its accessible name when mobile hides the text. Harness fixes distinguish absent conditional buttons, server/DOM update races, grounded landing, safe ferry-bank routing and stable touch IDs. Preserve real input: use actual keys/taps/joystick, no teleports or direct gameplay API mutation to claim route completion. Read-only state inspection is allowed. Fault injection for error recovery is allowed if explicitly labeled. Do not tune the script to conceal a real child-playability issue.

## Deliverables and checkpoints

1. Write `.agents/work-orders/042-fable-playtest-results.md` immediately with actual session/model, branch, base, browser lease and intended coverage. Update it after significant findings. Record observed facts separately from hypotheses.
2. Recover and commit the inherited harness before further edits. Complete touch and a short final desktop accessible-label smoke, or record a precise reproducible blocker. Use bounded diagnostics after failures; avoid repeatedly replaying an unchanged entire course just to debug one assertion.
3. Perform the exploratory button/flow pass beyond the scripted route. Save synthetic-only screenshots and concise structured evidence in your worktree; commit reusable tests and curated evidence, never browser profiles, credentials or private data.
4. Return concrete bugs, fixes, controls/flows actually exercised, checks and exact client hashes. Separate game failures, harness defects, emulator limitations and creative suggestions. Run checks appropriate to actual edits; all required app checks are needed for a runtime change. The lead runs combined final checks and carries checked PRs through merge.
5. Commit all useful work and release owned browsers/servers. Preserve any unfinished state in the result file before quota/compaction. No user approval is needed for this bounded test and polish pass.
