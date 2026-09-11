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

(appended as the run proceeds)

## Hypotheses

- H1 (inherited from the Sol session, unverified at this point): the ferry `boarded` sample is taken while the touch joystick is still held; the release finishes after the sample and the continued input shifts the rider offset before the carry measurement.

## Findings: game bugs (confirmed)

(none yet)

## Findings: harness / test defects

(none yet)

## Emulator limitations

- Pod renderer is SwiftShader (software WebGL, ~8-9 fps per prior evidence); no physical-device performance claim follows from anything in this file.

## Creative / UX suggestions for root Astra

(none yet)

## Checks and hashes

(appended when run)
