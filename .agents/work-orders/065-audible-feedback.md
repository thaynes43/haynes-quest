# Work order 065: audible gameplay feedback on mobile

- **Status:** Ready for coordinator integration and physical-device listening
- **Model / dispatch:** Native Codex GPT-5.6 Sol, `xhigh`, fresh context
- **Required reading completed:** `AGENTS.md`, `.agents/TEAM.md`, PLAN007, WO008 and WO050
- **Worktree / branch / starting HEAD:** `/home/dev/work/quest-playtest-reset`, `agent/quest-playtest-reset`, `ed7ae72963d9d9902cb42f1fec545d15e659fe25`
- **Owned paths:** `src/client/audio.ts`, `tests/game/audio.test.ts`, `scripts/assets/fixture-memory-review.ts`, `scripts/assets/catalog-inventory.json`, generated fixture-review and catalog-thumbnail media, `tests/e2e/visual-catalog.mjs`, this work order
- **Dependencies:** Root owns `GameScreen` event/UI wiring, visible copy, final sound direction, review/catalog prose, browser/device validation, integration, documentation and delivery. After the audio review, root expanded this lane with the mechanical catalog intake for the six code-native fixture pictures.

## Problem and bounded outcome

Tom heard no sound during actual iPad/iPhone play even though the prior mocked AudioContext checks passed. Establish whether the four checked-in WAVs contain useful signal, quantify the gain applied by the browser module, inspect persistence and lifecycle failure paths, and make the audio service resilient enough for a fresh PLAN007 playtest. Provide root with one semantic event API for jump, attack, pickup, impact and landing feedback plus an explicit gesture-time audible confirmation.

No new audio generation, source-WAV processing, browser lease, deployment or claim of physical-device audibility belongs to this lane. The later supporting catalog task only exports the exact code-native fixture SVGs and a deterministic contact sheet.

## Decisions before implementation

1. Keep the four v001 WAV bytes and manifest identity unchanged. Their numerical evidence is valid, but the existing runtime mix attenuates already-quiet transients too far for a phone speaker.
2. Reset the isolated playtest preference namespace so an earlier stored mute or `0.35` volume cannot silently carry into this fresh test. Preserve the old key untouched.
3. Start fresh at a clearly audible master level and rebalance the per-file trims from measured peaks/RMS, keeping the resulting single-cue peaks below clipping. Preserve a user-controlled mute and volume thereafter.
4. Ask supported browsers for the Audio Session `playback` type before creating/resuming Web Audio. WebKit documents that default Web Audio can follow the iOS ring/silent switch; WebKit recommends `playback` on iOS 17+ for media the user intentionally enables. Feature-detect the draft API and keep unsupported browsers unchanged.
5. Keep `start()` gesture-bound, expose an opt-in one-time confirmation, track spontaneous context state changes, and protect a pending resume from a simultaneous page-hide suspend.
6. A gameplay modal pauses cue admission and stops current transients without suspending the hardware context. Visibility loss still suspends it. This prevents a modal-close gesture from racing a suspended context while preserving background silence.

## Acceptance

- Measured input and effective runtime levels are recorded, including silence distribution for short transients.
- Fresh defaults are unmuted and audible; stale PLAN006 preferences remain stored but do not apply to PLAN007.
- An explicit user gesture can request exactly one confirmation sound and can retry if loading/decoding fails.
- The explicit test-sound control can audition a requested cue repeatedly while a gameplay modal remains paused.
- `interrupted`, hidden, closed, concurrent resume/suspend and modal pause states never report playable audio incorrectly.
- Semantic feedback presets provide stable mappings for jump, attack, pickup, impact and landing without creating new assets.
- Focused unit tests, lint and diff checks pass; typecheck is rerun after unrelated shared-tree work settles. Root receives the exact integration calls and sourced iOS limits.

## Findings

The WAVs are structurally valid, stereo 44.1 kHz 16-bit PCM with no clipped samples. The problem was the combination of conservatively normalized sources and two more gain stages. At the prior `0.35` master, the normal landing cue reached only -30.3 dBFS peak / -51.5 dBFS RMS. The accepted-attack cue reached -28.2 / -50.7 dBFS and the damage-impact cue reached -26.8 / -48.0 dBFS. Those figures explain why observing `AudioContext.state === "running"` did not establish useful phone-speaker output.

| Checked-in cue     |  Source peak / RMS | 10 ms windows above -50 dBFS | Main spectral energy | Prior normal output peak / RMS |
| ------------------ | -----------------: | ---------------------------: | -------------------- | -----------------------------: |
| `ui-confirmed`     | -14.0 / -36.5 dBFS |                        80.0% | 97.9% at 0.8–3 kHz   |             -26.2 / -48.7 dBFS |
| `memory-collected` |  -9.0 / -26.4 dBFS |                        96.7% | 99.1% at 0.8–3 kHz   |             -19.5 / -37.0 dBFS |
| `ability-unlocked` |  -8.0 / -19.7 dBFS |                        96.7% | 92.1% at 0.2–0.8 kHz |             -19.1 / -30.7 dBFS |
| `movement-landed`  | -16.0 / -37.2 dBFS |          16.0% (about 40 ms) | 70.8% below 200 Hz   |             -30.3 / -51.5 dBFS |

The channels are highly correlated (`0.96–1.00`) and mono downmix RMS differs by at most 0.1 dB, so phase cancellation is not the failure. The landing asset is both extremely brief and bass-heavy, making it a poor critical hit sound on small speakers even after gain. The new attack/impact presets therefore pitch the midrange `ui-confirmed` cue into distinct variants; `movement-landed` remains restrained non-critical landing texture.

The prior browser wiring had five global unlock listeners (`pointerdown`, `pointerup`, `touchend`, `click`, `keydown`) but no audible unlock confirmation. One physical touch can generate several of those events. Jump had no takeoff cue, only one cue on an airborne-to-grounded transition. A successful attack could produce one quiet UI cue when accepted and one quiet landing cue when the server revision showed damage. Equipment, memory and ability cues fired only on an accepted revision. Help/album/fallen/artwork/friend modals called `suspend()` directly; that could stop a gesture-time confirmation, and a modal-close state update happens after the gesture that would be needed to resume it.

The module default was already unmuted, but `quest-audio` made any earlier stored `{ muted: true }` or zero/low volume authoritative across later playtests. `GameScreen` also painted its local mute state as `true` until its mount effect copied the module preference. The new preference namespace addresses the persistent module state; root owns the transient UI state.

FFmpeg/ffprobe are absent from this pod. I inspected the checked-in `verification.json` records produced by `scripts/assets/audio/process_cues.py`, then independently parsed the current RIFF sample bytes read-only to calculate 10 ms activity, frequency-band energy, channel correlation and mono RMS. The byte hashes and baseline peak/RMS values match WO050.

## Implemented module behavior

- Fresh PLAN007 sessions use `quest-audio-v2`, unmuted at `0.8`. The old key stays untouched. A preference written under the new key remains authoritative on subsequent loads.
- Measured per-cue trims now put each unvaried single cue between -12.5 and -9.9 dBFS peak at the default master. A -3 dB, 20:1 Web Audio limiter controls coincident transients; it does not affect ordinary single-cue peaks.
- `start({ confirmation: true })` still creates/resumes the context synchronously from the caller's gesture, then schedules the midrange confirmation cue. It plays once per audio enable, shares concurrent attempts from the multiple touch/pointer events, and retries after a fetch/decode failure. The boolean reports whether the confirmation source was actually scheduled. `status()` separately reports the effective preference, context state and gameplay readiness.
- `audition(id = "memory-collected")` is the explicit test-sound path. It creates or resumes the context synchronously inside the button gesture, admits only the requested audition while a gameplay modal is paused, remains subject to mute/background/disposal checks, and returns whether the source was scheduled. Repeated button taps replay the selected cue without temporarily unpausing gameplay or adding the one-time unlock confirmation.
- `feedback("jump" | "attack" | "secondary" | "pickup" | "impact" | "landed")` owns the measured cue/rate/gain presets. The critical phone-feedback presets use the speaker-friendly midrange cue; root no longer needs to scatter raw gain guesses through `GameScreen`.
- A supported `navigator.audioSession` is temporarily set to `playback` and restored on disposal. This is the WebKit-provided way to keep intentional Web Audio playback from following the iPhone ring/silent switch. Unsupported browsers retain their default behavior.
- Context `statechange` marks audio unready and stops transients on `suspended` or `interrupted`. A sequence guard ensures a pending `resume()` cannot win after the page becomes hidden. Closed contexts discard their old graph/cache before replacement.
- `setPaused(true)` now blocks gameplay cues and stops active transients while leaving the hardware context running. `setPaused(false)` makes the already unlocked context usable immediately. `suspend()` remains the explicit hardware/background operation and document visibility already invokes it.

At the `0.8` fresh master, the semantic variants have these calculated pre-limiter levels. Playback rate changes pitch/duration and can shift measured RMS slightly; these values apply the gain factors to the original PCM measurements.

| Feedback  | Cue / rate / option gain | Calculated peak / RMS |
| --------- | ------------------------ | --------------------: |
| jump      | UI / 1.45 / 1.1          |    -11.6 / -34.1 dBFS |
| attack    | UI / 0.90 / 1.2          |    -10.8 / -33.3 dBFS |
| secondary | UI / 1.10 / 0.9          |    -13.3 / -35.8 dBFS |
| pickup    | UI / 1.20 / 1.1          |    -11.6 / -34.1 dBFS |
| impact    | UI / 0.75 / 1.3          |    -10.1 / -32.6 dBFS |
| landed    | landing / 1.00 / 0.65    |    -15.7 / -36.8 dBFS |

## Coordinator integration contract

1. Call `sound.start({ confirmation: true })` from the first direct game gesture and from the unmute control. It is safe to call for all existing gesture families because the module deduplicates successful confirmation.
2. Replace raw jump/accepted attack/secondary/equipment-or-minor-memory/damage/landing cue variants with the matching `sound.feedback(...)` call. Keep `memory-collected` for the major memory and `ability-unlocked` for actual chapter progression.
3. Call `sound.setPaused(modalOpen)` from the modal effect. Remove modal calls to `sound.suspend()`; visibility suspension is already internal. This avoids requiring a second gesture after closing a modal.
4. Use `await sound.start({ confirmation: true })` when an explicit sound control enables audio. `false` means the confirmation source did not start and a later gesture may retry; `sound.status()` distinguishes muted, unavailable, suspended/interrupted and ready states if the UI needs them.
5. Use `await sound.audition()` for the Help modal's explicit **Play a test sound** action. It remains usable while `setPaused(true)` is in force. Surface the failed-audio message only when the returned boolean is `false`.

## Supporting fixture-picture catalog intake

Root authorized one catalog entry for the six distinct fixture route pictures after finishing their code-native renderer in `src/server/media.ts#fixtureSvg`. `scripts/assets/fixture-memory-review.ts` calls that exact export for the six `FixturePhotoSource` keys, writes each returned SVG string byte-for-byte without external or private input, and makes a two-column contact sheet with Sharp. Its checked-in manifest records the source-module hash, export name, generator, recipe, file dimensions, byte counts and checksums.

- Exact pictures: `demo-memory-2020-07.svg`, `demo-memory-2022-01.svg`, `demo-memory-2024-01.svg`, `demo-memory-2025-01.svg`, `demo-memory-2026-01.svg`, `demo-memory-2027-01.svg`
- Review sheet: `docs/assets/media/fixture-memories/v001/contact-sheet.png`, 984×842, SHA-256 `2950a9079b08d8be7ddc6fcedd94ae7215d2a738e7b3a3bccaa2966c98982afe`
- Inventory: one `fixture-route-memories` entry in `fixture-illustrations`, with the contact sheet as its only `model_images` preview and no concepts, models or audio. The state is `Fictional playtest illustrations; six pictures; no family photos`; all six SVGs and the sheet have exact checksums.
- Catalog derivative: `docs/assets/media/catalog-thumbnails/v001/ae1fa06303598ed7.webp`, generated from the contact-sheet source by the regular thumbnail script. The manifest now has 54 derivatives, and the inventory has 37 entries plus `fixture_illustration_sets: 1`; existing model, concept, audio and approval counts stay unchanged.

This is one supporting six-picture set, not six model candidates. Root owns its review prose and visible catalog card.

## Mobile audio evidence and limits

- Apple states that iOS requires Web Audio to be triggered by an explicit user action such as a tap: [Playing Sounds with the Web Audio API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/Using_HTML5_Audio_Video/PlayingandSynthesizingSounds/PlayingandSynthesizingSounds.html).
- The Web Audio specification allows a browser to hold the first context transition until the page has user activation and defines `suspended`, `running`, `interrupted` and `closed`: [Web Audio API 1.1](https://webaudio.github.io/web-audio-api/).
- MDN documents that an iOS Safari context can become `interrupted` after leaving the page and should be resumed: [BaseAudioContext state](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state).
- WebKit records that default Web Audio follows the iOS ring/silent switch and that `navigator.audioSession.type = "playback"` fixes that route on supported iOS versions: [WebKit bug 237322](https://bugs.webkit.org/show_bug.cgi?id=237322) and [WebKit bug 251532](https://bugs.webkit.org/show_bug.cgi?id=251532).
- The Audio Session draft classifies `playback` as exclusive, so it can pause other media while the game produces sound: [W3C Audio Session](https://w3c.github.io/audio-session/). That is the tradeoff for sound the player explicitly enables despite the silent switch.

`AudioContext.state`, successful source scheduling and numerical PCM checks still cannot prove that a person heard the device output. PLAN007 needs the hosted physical iPad/iPhone listening pass with the hardware volume above zero, including initial entry, unmute, a modal round trip, background/foreground, jump, attack, pickup, impact and landing. Older iOS versions without Audio Session support may still follow the ring/silent switch.

## Verification

- `pnpm exec vitest run tests/game/audio.test.ts tests/game/playtest-artwork-contract.test.ts`: 2 files, 14 tests passed.
- Focused ESLint across the audio module/tests, fixture exporter and catalog contract: passed with zero warnings.
- Focused Prettier check across new or substantially changed owned code, manifest and this work order: passed. The long-standing inventory/e2e files retain their existing formatting to avoid unrelated churn.
- `git diff --check`: passed.
- `pnpm exec tsx scripts/assets/fixture-memory-review.ts`: produced the six exact SVG exports, source manifest and 984×842 contact sheet; a second run reproduced the same bytes.
- `node scripts/assets/catalog-thumbnails.mjs`: produced 54 catalog derivatives including the new fixture contact-sheet preview.
- Static catalog verification confirmed 37 inventory entries, one fixture illustration set, seven exact inventory checksums, the six SVG bytes equal to current `fixtureSvg(key)` output and 54 manifest thumbnails.
- `pnpm run docs:build`: prepared 960 files and passed all 164 Markdown/local-media link checks, then stopped because this pod lacks the optional `mkdocs` Python module. Root owns the full docs/browser delivery pass.
- Repository-wide `pnpm exec tsc --noEmit`: passed after the concurrent game lane settled.

No source WAV, UI, browser, server, deployment or private data changed in this lane. No human listening or physical-device claim is made.
