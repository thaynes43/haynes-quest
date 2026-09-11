# WO-045 results: final combined runtime browser acceptance

Coordinator completion and corrected final-check contract: [WO046](046-coordinator-final-playtest.md). This file preserves the earlier native run boundaries.

- **Status:** Keyboard journey and targeted probes passed; touch reached authoritative completion once, but no touch process exited zero because two obsolete/narrow harness checks stopped after late successful gameplay. Completed-card resume on this exact client remains for the coordinator's final tightened harness run.
- **Model / dispatch:** Native GPT-5.6 Sol, `xhigh`, fresh context
- **Worktree / branch:** `/home/dev/work/quest-touch-menu-regression`; `agent/quest-touch-menu-regression`
- **Frozen runtime source:** `ff3ad873113efa9d65076fb49fc31131f24d0c11`
- **Harness commits:** `fc8f40c2f8c5bed5ab2bb902b21b198039a99b23` and `ffc17c69a39f9cdd50b193a6b9b69ff0f94e7bfc`; the coordinator integrated these and owns the final tightened transition fallback.

## Frozen client identity

Every run used the unchanged root fixture at `http://127.0.0.1:4391` with Chromium `153.0.8010.12` and SwiftShader. Fetching the client before the run and every generated report agreed on:

- `/assets/index-BPeATrrp.js`
- 1,001,106 bytes
- SHA-256 `15487f825f0f7d8125144d3a1eb49c37e5212bf6c7d0bb8de8f368f141bc6051`

No server start, restart, source rebuild, direct gameplay API mutation or runtime/UI edit occurred. Browser setup and play used visible controls; save assertions used authenticated read-only GETs.

## Full keyboard journey

Attempt 3 exited zero and wrote `/home/dev/work/quest-touch-menu-regression/test-results/journey-keyboard-evidence.json` (5,381 bytes; SHA-256 `9a94f54755c00f09967221c3ac2c2cc357e4717574c5d29b9464e1c057ac9cf8`). It passed both chapters with zero page errors:

- modal pause and resume;
- both equipment pickups and guard use;
- deliberate first-sweeper recovery with unchanged server revision, HP, inventory, victories and encounters, followed by a safe pass;
- first boss, fictional media failure/retry, first memory release and age 0→4;
- deliberate missed-gap recovery, both natural jump/landing checkpoints, runway sweeper and second-era fights;
- ferry boarding, stable carry with `0` rider-offset drift, and natural `boss-landing` checkpoint at `z=-20.0420`;
- second boss, all three fictional memories, age 4→7 and completed journey.

The ferry waits used 2.4166/0.8000/0.9499 simulated seconds and 5,223/1,771/1,723 wall milliseconds for near dock/carry/far dock. The complete run log is `/home/dev/work/quest-touch-menu-regression/test-results/wo045/journey-keyboard-attempt-3.log`.

Two preserved non-passing attempts informed harness fixes rather than runtime findings:

1. Attempt 1 exited 1 at the fixed 2-second `.target-hint` wait. Its screenshot visibly contains the full-health Drama Dragon and rendered target hint, so it established a software-renderer label timing miss rather than an unreachable boss. Evidence: `journey-keyboard-attempt-1.{log,png}` under the WO045 ignored results directory.
2. Attempt 2 exited 1 after proving the ferry and `boss-landing`; the player had entered the fallen dialog before checkpoint Save & leave. The old global same-name locator did not leave. This led to selecting the active dialog action when present. Evidence: `journey-keyboard-attempt-2.{log,png}`.

## Full touch journey

Touch ran at 390×844, DPR 1 with stable CDP contact IDs and the retained joystick/jump recipe. Attempt 1 reached both bosses and all authoritative completion assertions: `completed=true`, `phase=complete`, two completed levels, all three pictures decoded, and age 4→7. The completion dialog is preserved in `/home/dev/work/quest-touch-menu-regression/test-results/wo045/journey-touch-attempt-1-failure.png`. The process exited 1 only because the former final assertion required the post-combat player position to remain below `z=-20`. Ferry evidence had already proved natural landing and the `boss-landing` checkpoint; combat/recovery may move the player afterward. Commit `fc8f40c2f8c5bed5ab2bb902b21b198039a99b23` replaces that unstable assertion with the retained checkpoint contract.

Attempt 2 again passed the touch course through the ferry and `boss-landing`, then entered the fallen dialog before checkpoint Save & leave. Even with a dialog-aware initial locator, the canvas remained. The failed action had no event trace, so a header-to-dialog race is plausible but **not proven**. This attempt exited 1 and is preserved as `journey-touch-attempt-2.{log,png}`. Per coordinator direction, no further full traversal was spent on this isolated transition.

The same frozen client already passed WO043's retained-touch header/menu regression, including secondary Save & leave while the joystick remained physically down. WO045 separately tested a stable fallen dialog through real touch:

- Save & leave was enabled at 390×844.
- Trusted primary touch `pointerdown`, `pointerup`, `focusin` and `click` all targeted the modal button; the click had `pointerType=touch`, `detail=1`.
- The canvas detached and exactly one save card appeared; zero page errors.
- JSON: `/home/dev/work/quest-touch-menu-regression/test-results/wo045/fallen-save-probe.json` (2,090 bytes; SHA-256 `af6c9dab8bce3d8b46edf10c015b327b796f7251966bbf51e946623bd70d53ff`).

This proves the stable modal action works and supports a harness transition accommodation, but it does not prove which element received the original failed long-run tap. The coordinator owns the final fallback: retry only when the initial action targeted the header and a new active fallen dialog subsequently appears; an initial modal-action failure must remain a failure.

## Targeted exploratory acceptance

The filtered command selected only `home-session-failure`, `game-desktop-shell`, and `game-attack-mash`; it exited zero with 3/3 passes and zero page errors. Report: `/home/dev/work/quest-touch-menu-regression/test-results/wo045/explore-targeted-report.json` (4,296 bytes; SHA-256 `7f70d0bb26c992878651690f8ff7c433cb09120534f3320ea26ada8126ffe87a`).

- Labelled session failure disabled Start, showed the recovery alert, and Try again restored the session and removed the alert.
- Desktop Help, Escape/Close/Back, focus trap, sound labels, album, modal pause, Save & leave, resume and reload all passed. Movement stayed zero behind Help.
- Six rapid touch Attack taps produced two accepted action posts, reduced the guest from 4 HP to 0, and left both the visible error banner and runtime request error null.

The completed-card resume assertions were added to `tests/e2e/journey.mjs`, checking the same save ID, completed status, age, completed-level count and recovered-memory count after a real card activation. They were not reached in an exit-zero browser process during WO045: the passing keyboard run preceded the extension, and the touch runs stopped at the late assertions above. The coordinator explicitly took ownership of that final exact-client verification rather than authorizing another full replay here.

## Commands and checks

- Keyboard: `QUEST_E2E_URL=http://127.0.0.1:4391 QUEST_E2E_MODE=keyboard QUEST_E2E_TIMEOUT_MS=600000 node tests/e2e/journey.mjs` — attempts exited 1, 1 and 0 as described above.
- Touch: `QUEST_E2E_URL=http://127.0.0.1:4391 QUEST_E2E_MODE=touch QUEST_E2E_TIMEOUT_MS=600000 node tests/e2e/journey.mjs` — attempts exited 1 and 1 after the late states described above.
- Targeted explorer: `QUEST_E2E_URL=http://127.0.0.1:4391 QUEST_PROBE_IDS=home-session-failure,game-desktop-shell,game-attack-mash timeout --signal=TERM --kill-after=10s 240s node /home/dev/work/quest-parody-obby/tests/e2e/explore.mjs` — exited 0.
- Narrow fallen-save probe: `timeout --signal=TERM --kill-after=10s 100s node test-results/wo045/fallen-save-probe.mjs` — exited 0.
- `node --check tests/e2e/journey.mjs`, `node --check tests/e2e/journey-lib.mjs`, and focused ESLint — passed.

The exclusive browser/build lease was released after cleanup. No WO045 browser, build or server process remains owned by this worktree.
