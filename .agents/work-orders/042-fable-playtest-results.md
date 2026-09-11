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

- H2 (mine, **refuted in Chromium**): a touch button that becomes disabled while held (Take gear → collected → relabelled Remember and disabled) might never see its release, leaving `external.interact` latched so later taps have no rising edge. Probe `game-touch-held-pickup`: while held the button read "Remember"/disabled and `input.interact` was `true`; 300 ms after release it was `false`; the next pickup was collected with a normal tap. No latch. (`onLostPointerCapture`/`pointerup` still reach a disabled button here; Safari unverified.)
- H1 (inherited): **confirmed and closed** as a harness defect, see below. Evidence: `stepObby` applies horizontal velocity only while input is held and carries the rider by the exact support delta (`src/game/obby.ts`), so the offset can only change while input is held; the touch driver releases the stick in `jumpForwardUntil`'s `finally` after the boarded sample; CDP touch dispatch costs 232-345 ms (WO031 diagnostic) which is 2-3 capped 0.05 s frames at 3.1 m/s, i.e. 0.3-0.5 m against a 0.035 m tolerance. The first fixed run measured 0.293 m of pre-release drift and 0 m of carry drift.

## Findings: game bugs (confirmed)

- **G1 (fixed, `cd2f6eb`) — every `onClick` control is dead while another finger touches the screen (Chromium-verified).** Observed in the touch probe: with a thumb held on the joystick, a second-finger tap on **How to play** never opened the dialog (`test-results/explore/game-touch-controls-failure.png`, first run). A focused CDP experiment (`test-results/explore/multitouch-click.mjs`, ignored scratch) reproduced it on a plain page with no game code: a single tap yields `pointerdown, pointerup, click`; the same tap with another finger held anywhere yields `pointerdown, pointerup` and **no click**, whether the other finger goes down first or second, and even after the other finger lifts. On the real home screen a finger resting on the page made **Start a journey** dead; a single-finger tap afterwards worked. Chromium's gesture recogniser only produces a tap for a single-contact sequence. Affected: the header buttons (Save & leave, sound, album, help), **Reclaim your memories**, every dialog button (Try this level again, Save & leave, Enter the next era, Remember this moment, Absorb memories, Keep exploring, Back to the adventure, Close, Reload journey, Back to your journeys) and the home/setup buttons. Unaffected: the joystick and the Jump/Attack/Guard/Remember buttons, which use pointer events, which is why the scripted route never hit it. Child-facing scenario: the thumb stays parked on the stick while the other hand taps a menu button, or the hand is still on the glass when the fallen dialog appears and the retry tap does nothing until every finger lifts. Fix: `src/client/touch-activation.ts` installed once from `main.tsx`; a document-level activator clicks an unmoved touch press on `button`, `a[href]`, `label` or `[role=button]` when the press was part of a multi-touch sequence, skips disabled controls and controls holding pointer capture, and swallows a late native `click` for the same press. Unit tests: `tests/game/touch-activation.test.ts` (6). Regression probes: `game-touch-controls` (help opens and closes with the stick held; a resting finger while tapping a dialog button; a single-finger tap toggles the sound label exactly once). **Safari is unverified**: WebKit's behaviour for a second-finger tap was not testable here; the dedupe path makes the fix safe if Safari already dispatches the click.

## Findings: harness / test defects

- **T2 (fixed)** `explore.mjs` used `getByLabel("From")`, which also matched the birth-date hint "Age comes from this date…"; three setup probes failed for that reason alone. Now exact.
- **T3 (fixed)** The keyboard-input probe measured each key over a fixed 350 ms window right after the canvas appeared; the deltas were `w -0.878, s +1.034, a -0.258, d 0, ArrowUp -0.206, ArrowLeft 0`, a shrinking series consistent with a main-thread stall from model/shader loading on the software renderer, not with dead keys (the journey drivers move with the same key events). The probe now holds each key until the traveler has moved 0.1 m or 4 s pass, and the hidden-tab check polls for the clock to resume.
- **T4 (fixed)** The fallen check tried to walk to the first second-chapter guest with the straight-line approach loop, which walks off the first gap and recovers forever (60 steps ending back at the start). The fallen probe now runs in the first chapter after both tools, where no jump is needed.
- **T5 (note)** Same-task synthetic double clicks (`button.click(); button.click()`) bypass React 18's microtask flush and are not a user-reachable input: three same-task preview clicks sent three preview requests and two same-task begin clicks sent two POSTs (still one save created; the coordinator/server absorbed it). The double-tap probes now use two separate tasks, the fastest a person can tap.
- **T1 (fixed, `de71c5e`)** `rideFerry` measured the carry baseline from the pre-release boarded sample. Now it waits for a post-release sample whose ferry-relative offset held still across consecutive reads, requires ferry support and an unchanged recovery count, and reports `boardingDrift` separately from `riderOffsetDrift`. Not a game bug: the game carried the rider exactly (0 m drift) once input stopped.

## Setup and flow observations (not defects unless marked)

- Whitespace-only traveler name passes native validation and returns the generic INVALID_REQUEST copy "Check the name, birth date and date range. Choose a photo limit from 1 to 24." (copy suggestion for Astra: a name-specific line, or trim and mark the field invalid client-side).
- A birth date after every memory (2031) returns the fixture message about January 1, 2020, which is correct for this fixture.
- Limit 1 keeps the earliest memory and starts a one-chapter journey (age 0, 2020, `totalLevels` 1). Keeping only the age-7 (2027) memory also starts a journey (details recorded in the second probe run); whether a journey whose only memory is dated at age 7 should begin at age zero is a design question for Astra, not a defect.
- Deselecting every memory disables Begin; reselecting one re-enables it. Editing any field after a preview clears the preview.
- The victory dialog reopens after Close/Escape through **Reclaim your memories**; a released keepsake can be remembered in the world with E/Remember and opens the photo dialog with **Keep exploring**; a same-task double click on **Remember this moment** and on **Absorb** produced one action each with no notice; reload during the released bundle reopens the dialog on resume; the chapter dialog reads "Age 4. A new chapter begins in 2024. You can now jump. Your equipment and earlier abilities stay with you."; Jump and the SPACE hint appear only after growth; album reads 2 OF 3 after chapter one.
- Focus: after Enter on **Start a journey** or when the game opens, `document.activeElement` is `body` (minor accessibility note; Escape from the help dialog correctly returns focus to **How to play**; Tab and Shift+Tab stay inside dialogs).
- In-game HUD at 320x568, 375x667, 844x390 and 768x1024: no control leaves the viewport, no HUD/objective/controls overlap, **Save & leave** keeps its accessible name where its text is hidden (≤600 px).

## Emulator limitations

- Pod renderer is SwiftShader (software WebGL, ~8-9 fps per prior evidence); no physical-device performance claim follows from anything in this file.

## Creative / UX suggestions for root Astra

(none yet)

## Checks and hashes

(appended when run)
