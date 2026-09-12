# Work order: iPhone audio reliability

- **Status:** Ready for review
- **Model / dispatch:** Native Sol (`gpt-5.6-sol`, `xhigh`) bounded coding/research lane, coordinated by the Astra lead
- **Context:** Fresh native subagent with a self-contained physical-device failure report
- **Required reading:** `AGENTS.md`, `.agents/TEAM.md`, `.agents/HANDOFF.md`, `docs/prds/001-project-brief.md`, `docs/designs/015-fresh-playtest-controls.md`, `src/client/audio.ts`, and `tests/game/audio.test.ts`
- **Worktree / branch / base commit:** `/home/dev/work/quest-audio-reliability`; `agent/quest-audio-reliability`; `d461cda8e6fe7aecdb37933c21fd53e934ffabeb`
- **Depends on / stable contracts:** Four unchanged v001 WAV cues; `QuestAudio.start()` and `QuestAudio.audition()` resolve to a playback-attempt boolean; the lead owns `GameScreen.tsx`, visible copy/layout, integration, release, and physical-device acceptance
- **Owned paths and remote resources:** `src/client/audio.ts`, `tests/game/audio.test.ts`, and this work order only; no authoring service, asset, cluster, OAuth, or dev-env ownership

## Outcome and scope

Investigate the physical iPhone report that Help's pale **Play a test sound** control appears unclickable and produces no audible output at volume 0.8. Correct reproducible audio-owner lifecycle defects without treating Chromium analyser samples as speaker evidence. Return a bounded result for every start/audition attempt so the lead can present pending, success, and retry states in the UI.

Source inspection establishes that the button has no `disabled` attribute; its pale appearance is presentation owned by the lead. The audio owner is responsible for two relevant failure paths:

1. A hidden page suspends and later resumes the same `AudioContext`. WebKit bug [291892](https://bugs.webkit.org/show_bug.cgi?id=291892) records iPhone/iPad contexts that report `running` but remain silent after returning from the background, as well as affected iOS web-app `resume()` promises that never settle even inside a click handler.
2. One physical tap can reach the document's capture listeners as pointer/touch/click events. Each call enters `startContext`; while the context is still suspended, the current implementation can issue overlapping `resume()` calls and has no deadline.

WebKit bug [247614](https://bugs.webkit.org/show_bug.cgi?id=247614) confirms Safari's requirement that starting Web Audio rendering remain tied to a transient user activation. Apple also documents that iOS media/Web Audio playback must begin from a user action and that WAV is supported. The current implementation calls `resume()` before its first asynchronous wait, so the investigation does not claim the later cue fetch alone proves an activation defect.

Silent-switch handling is already attempted correctly on Safari 16.4 and newer by assigning `navigator.audioSession.type = "playback"`; WebKit bug [251532](https://bugs.webkit.org/show_bug.cgi?id=251532) records that workaround. Its absence or a physical output route still cannot be inferred from an analyser.

## Inputs and implementation contract

- Coalesce concurrent resume attempts for one context.
- Bound a stalled resume attempt and resolve callers with `false`; abandon the suspect context so a later direct gesture creates a fresh one.
- Treat backgrounding, browser suspension, and interruption as context-invalidating lifecycle events. The next direct gesture creates a new context instead of trusting a stale `running` state.
- Preserve mute, volume, same-origin fetch, source limits, pause-modal audition, Audio Session `playback`, and disposal behavior.
- Keep the four v001 WAV files and measured mix unchanged.

## Deliverables and verification

- `QuestAudio` shares one resume attempt per context, resolves a stalled resume after 1.5 seconds, aborts/resolves a stalled cue load after 5 seconds, and lets the next direct gesture retry with a fresh context.
- A context that has suspended, backgrounded, or entered WebKit's nonstandard `interrupted` state is replaced before the next unlock. Decoded buffers are fetched again for the fresh context; four short same-origin WAVs make that bounded reload preferable to trusting a context whose state can misreport physical output.
- Regression tests simulate a never-settling `resume()`, one tap's overlapping confirmation/audition starts, a never-settling fetch, page hiding during a pending resume, background recovery, and spontaneous interruption recovery.
- Focused `pnpm exec vitest run tests/game/audio.test.ts`: 19 passed after follow-up review.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with zero warnings.
- `pnpm exec prettier --check src/client/audio.ts tests/game/audio.test.ts .agents/work-orders/071-audio-reliability.md`: passed.
- Full `pnpm test`: 345 passed, 10 skipped across 42 files (41 passed, one skipped) after follow-up review.
- `pnpm build`: client and server builds passed; Vite retained the repository's existing large-chunk advisory.
- `pnpm docs:build`: its reference/media preparation checked 170 Markdown files and 981 prepared files, then stopped because `/usr/bin/python3` has no `mkdocs` module. The task forbids adding host dependencies; no documentation site claim follows.
- Physical Safari speaker output remains an owner device check; automated Web Audio state/analyser evidence does not establish it.

## Handoff and recovery

The lead can retain the existing `Promise<boolean>` contract. The Help click handler should set a visible pending state synchronously, `await sound.audition()`, show success only when it resolves `true`, show its retry state when it resolves `false`, and clear pending in `finally`. The production deadlines mean that UI attempt now settles within about 6.5 seconds even if both resume and cue loading fail sequentially; ordinary failures settle sooner. Defensive caller `catch` remains reasonable even though `QuestAudio` contains browser API errors.

The implementation does not add an `HTMLAudioElement` fallback. WebKit 251532 indicates that media elements helped one older silent-switch case, but WebKit 291892 also records silent media elements in an affected iOS 26 web app. Choosing a second engine by user agent would bypass the existing gain/limiter contract without proving this device's route. `navigator.audioSession.type = "playback"` remains the standards-track silent-switch mitigation where Safari exposes it.

Branch: `agent/quest-audio-reliability`. No asset catalog change is required because no cue or asset changes. Physical Safari must verify first-load audition, background/return/retry, silent-switch expectations, device volume, and audible gameplay after closing Help.

## Follow-up review

The lead identified a remaining unbounded path after the first handoff: if mute, pause, background, or disposal invalidated a start after `resume()` succeeded, the owner could await `context.suspend()` forever. The invalidation path now detaches and closes the context without awaiting either browser operation. A regression supplies a never-settling `suspend()` and proves the start still resolves `false`.

A second regression dispatches an initial `statechange` while a new context is still `suspended` and its first resume is pending. That notification is no longer treated as a stale-context signal before the context has unlocked. A later suspended event after unlock, plus `interrupted` or `closed` at any time, still invalidates the context.

The existing Playwright MCP service was inspected read-only under an exclusive browser lease, then closed and released. No Deployment, Pod, or Service name containing Playwright/browser exists; the MCP is the local stdio `playwright-mcp` 0.0.80 command configured with `--browser chromium --headless`. Its live browser is Chromium 153. The available MCP calls expose no browser-type switch, and the unsafe evaluator sandbox exposes neither dynamic imports nor `process`, so it cannot acquire a separate WebKit `BrowserType`. Although the local browser cache contains `webkit-2359`, that is the already-known build that cannot launch without missing GStreamer libraries. The existing service therefore offers no usable WebKit procedure without a configuration restart or dependency change, both outside this task. The probe navigated no Quest page and provides no physical-iPhone evidence.
