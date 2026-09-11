# Work order 050: playtest audio module and cue inventory

- **Status:** Ready for coordinator integration
- **Model / dispatch:** Native Codex GPT-5.6 Sol, `xhigh`, fresh context
- **Required reading completed:** `AGENTS.md`, `.agents/TEAM.md`, `.agents/HANDOFF.md`, DESIGN-008 and PLAN-006 audio scope
- **Worktree / branch / starting HEAD:** `/home/dev/work/quest-playtest-feedback`, `agent/quest-playtest-feedback`, `7d51a44a2b8e27faa0be319568ccbdfa5a299ba7`
- **Owned paths:** `src/client/audio.ts`, `tests/game/audio.test.ts`, this result record
- **Dependencies communicated before edits:** Root retained sound direction, event/UI wiring, listening judgment and integration. This lane did not edit `GameScreen`, combat/runtime code or player-facing text.

## Outcome and module API

`src/client/audio.ts` remains the single browser-audio owner and preserves the existing `QuestAudio` API. The deliberate empty `approvedCues` map is replaced with a candidly named `playtestCues` manifest containing the four existing v001 candidate files authorized for this isolated playtest. It does not describe them as final or owner-approved.

New sessions with no explicit stored preference begin unmuted at a conservative `0.35` master volume after a user gesture calls `start()`. Existing stored `{ muted, volume }` values under `quest-audio` remain authoritative. The constructor performs no audio creation or fetch, and `cue()` cannot unlock audio. `start()` creates/resumes the context before its first await so the caller can invoke it directly from Play, Continue, pointer or keyboard activation for Safari.

Public surface:

- `new QuestAudio(options?)` accepts an optional cue manifest, storage key/store, page visibility source, context/fetch factories, default preference and source cap. Defaults use the four playtest candidates, browser storage/document, sound on, volume `0.35`, and four simultaneous sources.
- `preferences()` returns the effective `{ muted, volume }`.
- `setPreferences(muted, volume?)` clamps volume to `0..1`, applies/persists it, and immediately stops transients when muted.
- `start(): Promise<boolean>` is the explicit user-gesture unlock/resume attempt. Unsupported, blocked or failed audio returns `false` without blocking gameplay.
- `cue(id, { gain?, playbackRate? }): Promise<boolean>` plays an unlocked cue and reports whether a source actually started. Relative gain clamps to `0..2`; playback rate clamps to `0.75..1.5` for restrained candidate variants.
- `suspend()` stops current transients, marks the context locked and suspends it without creating a deliberate game pause.
- `setPaused(true)` stops/suspends and keeps playback blocked until `setPaused(false)` plus a subsequent successful `start()` from a user gesture. This is distinct from document visibility.
- `dispose()` removes the visibility listener, stops/disconnects sources, clears decoded/pending caches, closes the context and permanently blocks future unlock/playback.

Loading is same-origin only, uses `credentials: same-origin` and rejects redirects. Missing, corrupt, failed and unsupported files stay silent and can be retried. Decodes share one pending request and successful buffers are cached. Per-cue instance limits plus a four-source global cap bound overlap; higher-priority memory/unlock feedback can evict repeated movement feedback, while low-priority movement cannot evict an active higher-priority cue. Backgrounding immediately stops transients and requires another successful `start()` after return. The module never contacts the authoring service or any external media origin.

## Verified WAV inventory

All nine repository WAVs were parsed directly from their RIFF headers and hashed from current bytes on 2026-09-11. Audio format code `1` means uncompressed integer PCM. Every file is stereo, 44,100 Hz, 16-bit PCM. The four processed `cue.wav` hashes and durations also match their checked-in verification records.

| Role                    | Repository path                                            |   Bytes | Frames / duration | SHA-256                                                            |
| ----------------------- | ---------------------------------------------------------- | ------: | ----------------: | ------------------------------------------------------------------ |
| Playtest cue            | `docs/assets/media/ui-confirmed/v001/cue.wav`              |  52,964 |  13,230 / 0.300 s | `e9a0541c87b518de9b7d989ae4b6ef99d3ee03e40bfc1e65855bfe9069597608` |
| Selected source         | `docs/assets/media/ui-confirmed/v001/source.wav`           | 882,044 | 220,500 / 5.000 s | `416cdbb0fbb82da0b701f7fdac2fb4176b1f5933c4e1a236fab246e130ac941b` |
| Retained earlier source | `docs/assets/media/ui-confirmed/v001/source-attempt-1.wav` | 882,044 | 220,500 / 5.000 s | `177abf2e67e0578be44ed13609ca97b3464b7548bae57ee11e5a32bded68bfa7` |
| Playtest cue            | `docs/assets/media/memory-collected/v001/cue.wav`          | 211,724 |  52,920 / 1.200 s | `86ed72b341775dbb6f60414994912ec0d0292140e6408c20de54e5eb7ba0d358` |
| Source                  | `docs/assets/media/memory-collected/v001/source.wav`       | 882,044 | 220,500 / 5.000 s | `90dfbc573fbf5923508c025b4e7c33438a166449fbd4c2e3cfb988c164ac526b` |
| Playtest cue            | `docs/assets/media/ability-unlocked/v001/cue.wav`          | 317,564 |  79,380 / 1.800 s | `46318afe6c77579a6b063fa704e887cd6112601b4cc4144351fa9085845115c0` |
| Source                  | `docs/assets/media/ability-unlocked/v001/source.wav`       | 882,044 | 220,500 / 5.000 s | `c6d084ce680ab407b20c351cb49509ade12290efb291453fdfc350ce3ef7a904` |
| Playtest cue            | `docs/assets/media/movement-landed/v001/cue.wav`           |  44,144 |  11,025 / 0.250 s | `2c869c641b29e5df0ede83ad5dfab63f26a4d41c9b7258b56d3acb4dd71bf127` |
| Source                  | `docs/assets/media/movement-landed/v001/source.wav`        | 882,044 | 220,500 / 5.000 s | `59661a9bf7f48019d114ce39ba344b5ecf7d69bc4bceb09493ef056cf8aee995` |

The runtime paths in `playtestCues` are the same-origin MkDocs assets already packaged and served by this application:

| Cue ID             | Runtime path                                         | Peak from checked-in numerical verification | Per-cue gain / priority / instances |
| ------------------ | ---------------------------------------------------- | ------------------------------------------: | ----------------------------------- |
| `ui-confirmed`     | `/studio/assets/media/ui-confirmed/v001/cue.wav`     |                                -14.000 dBFS | `0.70 / 1 / 2`                      |
| `memory-collected` | `/studio/assets/media/memory-collected/v001/cue.wav` |                                 -9.000 dBFS | `0.85 / 3 / 2`                      |
| `ability-unlocked` | `/studio/assets/media/ability-unlocked/v001/cue.wav` |                                 -8.000 dBFS | `0.80 / 4 / 1`                      |
| `movement-landed`  | `/studio/assets/media/movement-landed/v001/cue.wav`  |                                -16.001 dBFS | `0.55 / 0 / 2`                      |

## Proposed mapping for root review

The direct mappings follow the authored candidates and DESIGN-008:

| Game event                                       | Cue call                  | Notes                                                                      |
| ------------------------------------------------ | ------------------------- | -------------------------------------------------------------------------- |
| Accepted, meaningful UI confirmation             | `cue("ui-confirmed")`     | Keep below memory/unlock priority and avoid firing on continuous controls. |
| One memory successfully reclaimed                | `cue("memory-collected")` | Fire after the accepted server action, once per memory.                    |
| Memory bundle advances age or unlocks an ability | `cue("ability-unlocked")` | Fire only when progression actually changes; do not replay on resume.      |
| Player lands after a real airborne transition    | `cue("movement-landed")`  | Use the runtime's grounded transition, never a frame-level grounded check. |

The four candidates can cover missing playtest feedback provisionally without implying that they were authored for those roles. Technically plausible variants for root to audition are `movement-landed` at `{ playbackRate: 1.35, gain: 0.8 }` for a light attack release, `movement-landed` at `{ playbackRate: 0.85, gain: 1.15 }` for contact, and `ui-confirmed` at `{ playbackRate: 1.25, gain: 0.9 }` for a bonus. These suggestions are based on duration, peak and authored descriptions only. Purpose-built attack, hit and bonus effects can replace them later after listening review; no new asset was generated in this lane.

Root should connect `setPaused(modalOpenOrGameplayPaused)` to the same effective pause state used by the game, clear it when play resumes, and call `start()` from the corresponding user gesture. Existing visibility handling may be removed from `GameScreen` because the service owns it; leaving the old hidden-page `suspend()` call is harmless but redundant. Root owns final event choice and UI copy.

## Verification and limits

- `pnpm exec vitest run tests/game/audio.test.ts`: 1 file and 5 tests passed. The tests cover no-autoplay unlock, persisted mute/volume, gain/rate clamps, silent and retryable fetch failure, external-origin rejection, pause/background behavior, disposal, caching and priority-based overlap bounds with mocked Web Audio nodes.
- A concurrent full-suite run reported 236 passed, 9 skipped and one failure in the audio retry case while this lane was still editing it. The failure was in the test fixture: its mock returned the same `Response` object after a decode rejection, so the following retry attempted to read an already-consumed body. The mock now creates a fresh response for every request, matching actual fetch behavior. There was no product-code timing failure or unhandled rejection. A subsequent `pnpm test` run against the current shared tree passed 31 files with one skipped: **237 passed, 9 skipped, 0 failed** in 8.15 seconds.
- `pnpm exec eslint src/client/audio.ts tests/game/audio.test.ts --max-warnings 0`: passed.
- `pnpm exec tsc --noEmit`: passed with the concurrent task changes present.
- `git diff --check`: passed before this record was added; rerun after integration.

No browser, server, deployment, physical-device or human listening test ran in this lane. Mocked Web Audio tests establish control flow and cleanup, not Safari decode/unlock behavior or sound quality. Numerical file inspection establishes format, duration, hashes and levels, not prompt fidelity, mix suitability or owner approval. No asset, source, catalog entry, UI text, runtime trigger or external service changed; no commit was made.
