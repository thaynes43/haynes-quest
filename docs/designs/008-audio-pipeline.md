# DESIGN-008: Audio authoring and browser playback

- **Status:** Proposed
- **Last updated:** 2026-09-10
- **Source:** Tom's request for audio tooling and an Astra asset-development workflow
- **Satisfies:** [PRD-001 R-08, R-09, R-16, R-35–R-39](../prds/001-project-brief.md)
- **Related:** [PoC development loop](007-poc-development-loop.md), [visual assets](002-asset-pipeline.md), [asset review template](../assets/000-review-template.md)

## Recommendation

Use **ElevenLabs through its direct API or official SDK for authored sound effects and ambience**, followed by **FFmpeg/ffprobe** for repeatable cleanup, inspection, and delivery exports. Tom reviews the candidate audio before its approved version enters gameplay. The browser plays prepared files; it does not call a generation service during play.

This is a researched tool recommendation, not an installed or purchased integration. Begin code experiments with simple, clearly identified synthetic cues or licensed placeholders. The audio account/plan, key, generation budget, permitted distribution, storage, and tool versions need setup before producing service-generated candidates.

| Candidate | Fit | Limitation |
| --- | --- | --- |
| ElevenLabs API/SDK | Recommended authoring trial for bespoke SFX and loopable ambience; optional prepared speech later. | Requires an account, key, and credits. Output/usage conditions vary by service and plan; music needs its own check. |
| Stable Audio 3 | Credible alternative if self-hosted authoring becomes important; official inference code/API/CLI and downloadable SFX/music models. | Model access, license acceptance, dependencies, compute, and measured pod performance add setup work. Not selected for the first loop. |
| Kenney audio packs | Simple prepared placeholder/fallback option for UI and interaction cues. Individual reviewed pack pages identify CC0. | Less bespoke; choosing a final sound still follows Tom's asset review. |

Evidence: [ElevenLabs SFX guide](https://elevenlabs.io/docs/eleven-api/guides/cookbooks/sound-effects), [official TypeScript SDK](https://github.com/elevenlabs/elevenlabs-js), [Stable Audio 3](https://github.com/Stability-AI/stable-audio-3), [Stability model licensing](https://stability.ai/license), and [Kenney UI Audio](https://kenney.nl/assets/ui-audio), reviewed 2026-09-10. Inference-code licensing does not replace a model's terms. No output quality or runtime performance has been measured here.

## Authoring workflow

1. Define a cue ID, triggering event, mood, duration/loop intent, and priority. The brief uses original sound descriptions and identifies any needed source rights.
2. The Audio Astra produces a small set of candidates using a pinned script/SDK. ElevenLabs' [SFX endpoint](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert) accepts text and generation settings, including looping for its supported model. Match duration and export settings to the current endpoint/plan rather than assuming every format is available.
3. Retain the original downloaded file and metadata. Inspect, trim, fade, check clipping/loop seams, and create browser delivery versions. [FFmpeg filters](https://ffmpeg.org/ffmpeg-filters.html) support these processing steps; [ffprobe](https://ffmpeg.org/ffprobe.html) supplies machine-readable stream metadata. Do not claim a lossy provider download becomes a lossless master by converting it to WAV.
4. Audition candidates in isolation and in a short labeled review preview. Keep a reproducible processing recipe, level/loop notes, checksums, and source/terms information. [Audacity macros](https://manual.audacityteam.org/man/macros.html) are an optional workstation editing aid; an interactive editor is not required for the agent pipeline.
5. Present the concrete review package to Tom. Record approval against the exact version under DESIGN-007, then promote that version into the cue manifest. Keep the previous approved sound when a replacement is pending or rejected.

Direct API scripts are preferred over making an audio MCP server a prerequisite. ElevenLabs' [former local MCP repository](https://github.com/elevenlabs/elevenlabs-mcp) is archived/deprecated; its replacement [hosted MCP](https://elevenlabs.io/docs/eleven-agents/operate/hosted-mcp) documents speech and agent-management capabilities, without establishing SFX/music parity for this workflow. We have not connected either server.

## Small initial cue set

| Cue ID | Trigger | PoC role |
| --- | --- | --- |
| memory-collected | A memory recovery succeeds | Short feedback paired with the visible recovered-photo state. |
| ability-unlocked | A new action becomes available | Distinct feedback paired with the new-action prompt. |
| movement-contact | Appropriate movement/landing event | Bounded, low-priority feedback; avoid a sound on every rendered frame. |
| ui-confirm | Accepted menu/interaction action | Short confirmation that does not mask memory feedback. |
| ambience-loop | Active level, after user-started audio | Optional atmosphere; only one intended instance per scene. |

Cue IDs are proposed starting identifiers, independent of filenames and revisions. Final music, voiced story, enemy voices, combat sounds, and a full soundtrack remain [backlog](../BACKLOG.md) work. The PoC does not need dialogue or music to demonstrate its loop.

## Music, voice, and distribution

ElevenLabs has separate [music generation](https://elevenlabs.io/docs/api-reference/music/compose) and [speech generation](https://elevenlabs.io/docs/api-reference/text-to-speech/convert) APIs. Those are later candidates, not a requirement to buy one service for every audio category. Use original/stock fictional narration if later selected; this workflow needs no family voice recordings.

Verify the selected plan's use/export terms before producing build assets. ElevenLabs' [publishing guidance](https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform) distinguishes free and paid use, subject to service-specific restrictions. A paid account is not blanket permission for every audio use.

Music needs a separate check: the [API licensing FAQ](https://elevenlabs.io/api) flags additional licensing for games, while the [music model terms](https://elevenlabs.io/eleven-music-model-specific-terms) define plan restrictions, including a particular monetized multi-platform game category and export limits. Those pages do not establish that this private noncommercial family PoC needs Enterprise. Confirm the intended game use, API access, and exports for the actual plan before selecting generated music for the build. Music remains optional while that is resolved.

The [Use Policy's SFX section](https://elevenlabs.io/use-policy) restricts standalone distribution of generated effects. Do not automatically commit raw generated sounds to this public repository as a reusable asset pack or apply the code license to them. Store restricted masters/exports privately and deliver approved files for permitted embedded game use, retaining provenance and required attribution. CC0 placeholder packs have their own source records. Public metadata must not expose credentials or private artifact links.

## Browser playback contract

Start with one small game-owned audio service using native Web Audio. A Three.js wrapper or Howler may be used if concrete integration needs justify it; do not add competing audio owners. [MDN best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) supports user-started playback and accessible controls. [Howler](https://github.com/goldfire/howler.js#documentation) supplies useful loading/playback behavior but does not replace the game's lifecycle and concurrency rules.

| ID | Rule |
| --- | --- |
| D-01 | Start/resume audio from an explicit Play/Continue user action, without awaiting unrelated network work before attempting unlock. Handle blocked playback without blocking the game. |
| D-02 | Provide accessible mute/volume controls and retain the preference across scene transitions. Every required audio cue has visible feedback; the PoC is completable muted. |
| D-03 | Pause/stop appropriate sounds when gameplay loses activity. Discard obsolete transient cues rather than replaying a burst on return. Handle suspended/interrupted contexts and present a resume action when needed. |
| D-04 | One audio owner manages context, sources, loops, listeners, and scene cleanup. Re-entering a scene must not create duplicate ambience or accumulating playback objects. |
| D-05 | Bound simultaneous effects and assign priorities so repeated movement cues cannot drown out collection/unlock feedback. Choose the actual cap during device testing. Howler's inactive-object pool is not this cap. |
| D-06 | Cue manifests reference approved asset IDs/versions, duration, loop settings, level defaults, delivery formats, and checksums. Replacing an approved sound does not migrate memory/ability progress or retrigger old unlocks. |
| D-07 | Load only the small required cue set and handle missing/corrupt files with visual feedback intact. Select codecs/encoding after decode tests on the actual target browsers; do not assume one export works everywhere. |
| D-08 | Authoring credentials and scripts stay out of browser code. Runtime playback uses prepared files from the game deployment; generation outages do not affect already-published cues. |

MDN specifically documents Safari audio interruption after switching away or turning off the screen. [Audio-context state guidance](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state) informs the lifecycle tests; desktop automation alone cannot prove iPhone/iPad behavior.

## Readiness and validation

On 2026-09-10 the pod has Node, pnpm, Python, and uvx, but `ffmpeg`, `ffprobe`, SoX, Audacity, and Blender are not available on PATH. No connected audio-generation tool is exposed in this session. ElevenLabs account/auth, generation credits, output quality, and export eligibility have not been tested. No audio was generated, downloaded, or approved for the game by this research.

Later setup pins the authoring scripts/SDK, arranges the account/key and bounded generation budget, configures permitted egress and secrets through `haynes-ops`, and provides FFmpeg/ffprobe plus suitable artifact storage. A pod-restarting dev-env change follows that repo's held-draft workflow. Do not install a deprecated MCP bridge to satisfy a capability already available by direct API.

Validate first interaction, mute, missing files, repeated scene entry, effect spam, backgrounding, screen lock, interruption, and resume on actual iPad/iPhone Safari and PC. Listen for clipped peaks, abrupt cuts, and loop seams; retain the measured export settings and Tom's exact-version review. The findings above are documentation evidence, not a completed generation, listening, or browser test.
