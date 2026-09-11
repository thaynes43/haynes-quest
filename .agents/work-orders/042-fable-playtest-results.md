# WO-042 results: Fable hands-on playtest and polish

- Status: started September 11, 2026 (session opened ~19:30 UTC). Living checkpoint; observed facts and hypotheses are kept apart.
- Session: `agent-run` task `haynes-quest-0911-152226`, tmux `task-haynes-quest-0911-152226`, pod `dev-env-dfdd8c894-l724p`. Model as reported by the running system prompt: `claude-fable-5-1` (Fable 5.1), effort `xhigh`.
- Worktree/branch: `/home/dev/work/haynes-quest-0911-152226` on `agent/haynes-quest-0911-152226`.
- Base: lead head `f9e2b49` (`agent/quest-parody-obby`, "Assign the requested Fable exploratory playtest and polish pass").
- Browser lease: exclusive lease on the lead fixture `http://127.0.0.1:4391` (tmux `main:quest-parody-fixture`). Verified at start: index serves `index-DcnSUtWQ.js`, 999061 bytes, SHA256 `aca24da69a17e811385fa7e15d94abcdf0a3a1f316762ba5088fefcbceba1b22` (matches the work order).
- Dependencies: `pnpm install --frozen-lockfile --offline --ignore-scripts` in this worktree (0.9 s, own `node_modules`, no shared build output).

## Recovery of the interrupted Sol harness (done)

- Observed: `agent/quest-playtest-controls` head `6821dda` ("Checkpoint passed keyboard driver and interrupted touch diagnostics") is one commit on `35c6c62`; it touches only `tests/e2e/journey.mjs` (+351/-?) and `tests/e2e/obby-helpers.mjs`. The lead branch did not modify either file after `35c6c62` (only `tests/e2e/parody-catalog.mjs`), so the checkpoint is strictly newer than the committed harness.
- Action: `git cherry-pick -x 6821dda` applied cleanly with no conflicts as `5d745c3` on this branch. Nothing from the checkpoint was discarded.

## Intended coverage

1. Verify the ferry rider-offset hypothesis from the helper code and the failure image, fix the harness if it is a test defect, then finish the touch run and a short desktop accessible-label smoke.
2. Exploratory pass on desktop (1024x768) and portrait touch (390x844): every menu, setup step, back/cancel, validation, preview, selection, start/resume, equipment, attack/guard/jump, deliberate failure/retry, boss release, picture loading/retry, memory consumption, chapter transition, save/leave, completion. Awkward combinations: repeated clicks, reload mid-flow, movement interrupted by UI, failed media (labelled fault injection), narrow viewport, touch held while another action occurs.
3. Fix confirmed technical defects (input/state/media/accessibility) in this worktree; recommend UX/copy changes with evidence for root Astra.
4. Keep a button/flow coverage table and curated synthetic-only evidence under `docs/assets/media/playtest/v001/` or `test-results/` as appropriate; commit reusable tests and curated evidence only.

## Observed facts

- 19:29 UTC: **touch-only journey passed end to end** (`QUEST_E2E_MODE=touch`, exit 0) against the leased fixture, client `index-DcnSUtWQ.js` SHA256 `aca24da6…bb22`, Chromium 153.0.8010.12, 390x844 DPR1 with CDP touch, zero page errors. Stages: modal pause, both tools, deliberate hazard recovery (revision/HP/gear unchanged), safe sweeper pass, both first-era fights with guard, save/leave/resume twice, first boss, three decoded fictional pictures, age 0→4, missed-gap recovery, both gaps with landing-armed checkpoints (`first-clearing`, `second-clearing`), runway sweeper jump, second-era fights, ferry ride to `boss-landing`, second boss, age 4→7, completion dialog with three pictures. Evidence: `test-results/journey-touch-evidence.json` (ignored) and the curated copy under `docs/assets/media/playtest/v001/`.
- Ferry numbers from that run: boarded at ferry z -16.660, carried to -16.743, far dock -17.286; settled rider offset -0.570 m; **pre-release boarding drift +0.293 m; post-release carry drift 0.000 m**.
- Wall time for the touch chapter pair: about 3 minutes (15:26:22 to 15:29:10 pod local).
- 19:40 UTC: **keyboard-only journey passed** (exit 0, zero page errors, same client hash) on the split harness (`journey-lib.mjs` extracted from `journey.mjs`, commit `5507a8e`), including the labelled same-origin media fetch failure and retry. Keyboard ferry boarding drift 0.000 m (keyboard release is a single fast event), carry drift 0.000 m.
- 19:38 UTC: exploratory `home` and `viewport` probes passed (`tests/e2e/explore.mjs`, uncommitted at this point): badge/CTA/empty state/asset-studio link 200; keyboard reaches Start a journey in three Tab stops and Enter opens setup; home, setup and the preview grid have no horizontal overflow and the CTA stays inside the viewport at 320x568, 375x667, 390x844, 844x390, 768x1024, 1024x768 and 1366x768. Screenshots under `test-results/explore/` (ignored).
- Accessibility observation (minor, not a defect claim): after Enter on **Start a journey** the focused button unmounts and focus falls to `body`; the next Tab lands on **← Your journeys**. Same pattern likely after **Begin your journey** (being checked in the game probes).

## Hypotheses

- H1 (inherited): **confirmed and closed** as a harness defect, see below. Evidence: `stepObby` applies horizontal velocity only while input is held and carries the rider by the exact support delta (`src/game/obby.ts`), so the offset can only change while input is held; the touch driver releases the stick in `jumpForwardUntil`'s `finally` after the boarded sample; CDP touch dispatch costs 232-345 ms (WO031 diagnostic) which is 2-3 capped 0.05 s frames at 3.1 m/s, i.e. 0.3-0.5 m against a 0.035 m tolerance. The first fixed run measured 0.293 m of pre-release drift and 0 m of carry drift.

## Findings: game bugs (confirmed)

(none yet)

## Findings: harness / test defects

- **T1 (fixed, `de71c5e`)** `rideFerry` measured the carry baseline from the pre-release boarded sample. Now it waits for a post-release sample whose ferry-relative offset held still across consecutive reads, requires ferry support and an unchanged recovery count, and reports `boardingDrift` separately from `riderOffsetDrift`. Not a game bug: the game carried the rider exactly (0 m drift) once input stopped.

## Emulator limitations

- Pod renderer is SwiftShader (software WebGL, ~8-9 fps per prior evidence); no physical-device performance claim follows from anything in this file.

## Creative / UX suggestions for root Astra

(none yet)

## Checks and hashes

(appended when run)
