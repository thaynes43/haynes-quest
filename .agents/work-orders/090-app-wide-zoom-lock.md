# WO090: Disable browser zoom throughout the game app

Status: In progress. Root Astra owns `/home/dev/work/quest-app-zoom-lock-20260919`, branch `agent/quest-app-zoom-lock-20260919`, from `d8044f7`; release lane `/home/dev/work/quest-app-zoom-release-20260919`. Native Sol owns the viewport harness and bounded review. No authoring jobs.

## Owner correction and contract

Tom clarified that his son was playing and browser zoom must never be available in the game app, regardless of screen or target. Supersede WO089's intentional non-game/start-page zoom exception. DESIGN018 records the app-wide policy and browser/system limits. Root owns UX, source integration, documentation, merge and release; native Sol owns `tests/e2e/phone-viewport-regression.mjs` and ignored browser evidence. Preserve all existing pointer ownership, native menu/dialog scrolling and gameplay behavior.

## Delivery

Add a document-wide CSS/viewport boundary and narrow Safari gesture, Ctrl-wheel and Ctrl/Cmd zoom-shortcut guards. Cover lifecycle cleanup and unrelated input preservation with meaningful unit tests; use actual touch trajectories for browser zoom proof. Reproduce the old start-page zoom, verify the new start/game/return flow plus page/Help scrolling and portrait input regression. Run required checks, merge the app PR, verify published image, promote only private playtest via checked GitOps PR, then verify hosted HTML/JS/CSS and browser results. Declare/end scoped activity and stop owned port 4422 after acceptance. Record exact release evidence here and in the handoff.

## Next stage

After this corrected zoom policy, discuss a few enemy concepts before model production, then lock requirements and ADRs for the level-building platform. No model or family-photo work belongs to this repair.

## Candidate verification

Typecheck, lint, production build and strict documentation/media checks pass. Local tests: 556 passed, with 12 database cases reserved for disposable-PostgreSQL CI. Six new unit cases cover Safari gesture default cancellation, Ctrl-wheel, keyboard zoom, unrelated input, independent event delivery and listener cleanup. The portrait candidate regression passes release/re-arm after failed capture, independent jump/movement contacts, resize geometry and rotation cleanup, with no HTTP/page/console errors.

The expanded viewport candidate keeps start/game pinch and double tap at scale 1, full 844×390 and zero viewport offsets. Native start-page scrolling reaches 295 CSS pixels and Help scrolls 215; app-received zoom shortcuts are cancelled. Entry and leaving retain the neutral viewport. The browser is Chromium 153 touch emulation; the old start-page reproduction and exact report hashes are retained in [the release index](../evidence/app-zoom-lock-release.json). Candidate fixture: port 4422, tmux `quest-app-zoom-fixture`. Publication and hosted release verification remain pending.
