# DESIGN-008: Audio authoring and browser playback

- **Status:** Proposed
- **Last updated:** 2026-09-11
- **Source:** Tom's request for audio tooling and an Astra asset-development workflow
- **Satisfies:** [PRD-001 R-08, R-09, R-16, R-35–R-39](../prds/001-project-brief.md)
- **Related:** [PoC development loop](007-poc-development-loop.md), [visual assets](002-asset-pipeline.md), [asset review template](../assets/000-review-template.md)

## Recommendation

Tom asked about free and self-hosted options before dependency setup. **Trial self-hosted Stable Audio 3 Small-SFX for authored effects/ambience**, keeping ElevenLabs as an optional hosted alternative. Run any selected model in a dedicated service or Job with its own environment and persistent cache, independently of dev-env and Blender. The earlier CPU-only recommendation is broadened by Tom's offer of a server capable of dual RTX 3090s plus smaller cluster GPUs. CPU remains a possible trial baseline; select CPU/GPU placement after inventory and a measured trial. The offered hardware does not settle provider choice, model access, or terms acceptance. FFmpeg/ffprobe processing, exact-version owner review, and native Web Audio playback remain common to either route. The game plays prepared files without a runtime generation service.

| Candidate | Fit | Current setup limit |
| --- | --- | --- |
| Stable Audio 3 Small-SFX | Recommended self-hosted trial; open weights with CPU inference and local output files. Small-Music is a later instrumental-music option. | Gated model access and terms acceptance, isolated Python dependencies, roughly 3.5GB of SFX weights/tokenizer files before dependencies, selected CPU/GPU resources, and an actual quality/speed trial. |
| ElevenLabs API/SDK | Optional hosted SFX/loopable-ambience trial; free tier available. | Account/key and shared monthly credits; free output is noncommercial, with attribution conditions when shared. Music/API terms differ. |
| Kenney audio packs | Simple prepared placeholder/fallback for UI/interaction cues; reviewed pack pages identify CC0. | Less bespoke; final choices still follow Tom's review. |

The [official Stable Audio repository](https://github.com/Stability-AI/stable-audio-3) supports CPU inference for Small-SFX/Small-Music; its published optimized-device timings are not a Linux pod benchmark. [Kenney UI Audio](https://kenney.nl/assets/ui-audio) remains an inexpensive way to keep code moving. No output quality or runtime performance has been measured here.

### ElevenLabs free tier

[Official pricing](https://elevenlabs.io/pricing), checked 2026-09-10, lists $0 for 10,000 shared monthly credits; Starter is $6/month. [API billing](https://help.elevenlabs.io/hc/en-us/articles/28184926326033-How-much-does-it-cost-to-use-the-API) includes SFX API access in the free plan. [SFX costs](https://help.elevenlabs.io/hc/en-us/articles/25735337678481-How-much-does-it-cost-to-generate-sound-effects) distinguish API calls from the website: one auto-duration API clip costs 100 credits, or an explicitly timed clip costs 20 credits/second. Spending the entire free allowance on auto-duration SFX therefore allows 100 API clips; the website's four-variation requests use a different rate. These limits may change and do not include other audio use from the same credit pool.

Free output is for noncommercial use, with attribution when shared/published under the [publishing guidance](https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform). A later subscription does not retroactively convert free-generated files into paid-plan output. ElevenLabs is a hosted service, not the self-hosted choice in this proposal.

### Self-hosted trial prerequisites

1. Tom obtains access to [Small-SFX](https://huggingface.co/stabilityai/stable-audio-3-small-sfx) through Hugging Face, including the displayed contact-sharing consent, Stability model terms, and Gemma terms. Small-Music has its own model access. No terms or account actions have been performed on his behalf.
2. Store an authorized download token through the existing secret workflow, outside git and chat. Model downloads need explicitly allowed Hugging Face/CDN destinations in the authoring environment; determine exact hosts before the GitOps egress change. No proxy or allowlist bypass is part of setup.
3. Pin the upstream revision and create an isolated Python environment in the dedicated audio service/Job image. Upstream's [dependency manifest](https://github.com/Stability-AI/stable-audio-3/blob/main/pyproject.toml) requires Python 3.10+ and Torch/Torchaudio 2.7.1; explicitly choose CPU wheels for a CPU trial because its default Linux x86_64 uv configuration selects CUDA wheels. For a GPU trial, verify driver/runtime compatibility and scheduling before selecting CUDA dependencies. Gradio is optional. Keep model caches on persistent storage and dependencies separate from Blender and dev-env so audio upgrades do not restart either.
4. The [SFX audio checkpoint](https://huggingface.co/stabilityai/stable-audio-3-small-sfx/tree/main) is about 2.27GB; its text model/tokenizer adds about 1.22GB. Allow more disk for dependencies/caches. Disk footprint is not peak RAM. The dev-env pod's lack of a GPU does not constrain a separate authoring service. Inventory Tom's offered dual-3090-capable server and smaller cluster GPUs before reserving resources; confirm available VRAM and measured peak memory. Do not assume two GPUs pool their memory or that the selected inference implementation uses both.
5. Generate one short synthetic cue, inspect it with ffprobe, listen, and record hardware, generation time, peak host/device memory, and listening results before committing to the self-hosted route. The [source-verified CLI](https://github.com/Stability-AI/stable-audio-3/blob/main/stable_audio_3/cli.py) CPU baseline example is below; it has not been executed here. A GPU trial needs its own verified command and hardware results.

```bash
python -m stable_audio_3.cli --model small-sfx --device cpu --no-half \
  -p "gentle forest wind and birds" --duration 10 -o forest.wav
```

The inference code is MIT; model weights use the [Stability Community License and associated terms](https://huggingface.co/stabilityai/stable-audio-3-small-sfx/blob/main/LICENSE.md), including Gemma conditions for the text component. Personal hobby use has no model license fee; local compute/storage still cost resources. Do not describe the weights as unrestricted open source. Small-Music can be evaluated later without making a soundtrack a PoC dependency.

## Authoring workflow

1. Define a cue ID, triggering event, mood, duration/loop intent, and priority. The brief uses original sound descriptions and identifies any needed source rights.
2. The Audio Astra produces a small set of candidates using the selected pinned local CLI or hosted script/SDK. For the hosted alternative, ElevenLabs' [SFX endpoint](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert) accepts text and generation settings, including looping for its supported model. Match duration and export settings to the current endpoint/plan rather than assuming every format is available.
3. Retain the original generated/downloaded file and metadata. Inspect, trim, fade, check clipping/loop seams, and create browser delivery versions. [FFmpeg filters](https://ffmpeg.org/ffmpeg-filters.html) support these processing steps; [ffprobe](https://ffmpeg.org/ffprobe.html) supplies machine-readable stream metadata. Do not claim a lossy provider download becomes a lossless master by converting it to WAV.
4. Audition candidates in isolation and in a short labeled review preview. Keep a reproducible processing recipe, level/loop notes, checksums, and source/terms information. [Audacity macros](https://manual.audacityteam.org/man/macros.html) are an optional workstation editing aid; an interactive editor is not required for the agent pipeline.
5. Present the concrete review package to Tom. Record approval against the exact version under DESIGN-007, then promote that version into the cue manifest. Keep the previous approved sound when a replacement is pending or rejected.

A local CLI or direct API script is sufficient; an audio MCP server is not a prerequisite. ElevenLabs' [former local MCP repository](https://github.com/elevenlabs/elevenlabs-mcp) is archived/deprecated; its replacement [hosted MCP](https://elevenlabs.io/docs/eleven-agents/operate/hosted-mcp) documents speech and agent-management capabilities, without establishing SFX/music parity for this workflow. We have not connected either server.

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

On 2026-09-10 the pod has Node, pnpm, Python, and uvx, but `ffmpeg`, `ffprobe`, SoX, Audacity, and Blender are not available on PATH. No connected audio-generation tool is exposed in this session. ElevenLabs account/auth, generation credits, output quality, and export eligibility have not been tested. No audio was generated, downloaded, or approved for the game by this research. Stable Audio model access/terms acceptance and local performance are likewise unverified. No weights have been installed, no model/provider terms have been accepted, and no GPU has been assigned to this audio trial.

Later setup pins the selected self-hosted service/Job image or hosted script/SDK, arranges the required access/key and resource or credit budget, configures permitted egress and secrets through `haynes-ops`, and provides FFmpeg/ffprobe plus suitable artifact storage. PLAN-003 tracks the dedicated Blender/FFmpeg authoring service separately from pending audio-provider access. Audio model dependencies belong in their own workload, upgradeable without rolling dev-env; GPU availability is an option, not completed setup. Any initial agent registration that changes dev-env's mounted configuration still follows that repo's held-draft workflow. Do not install a deprecated MCP bridge to satisfy a capability already available by direct API.

Validate first interaction, mute, missing files, repeated scene entry, effect spam, backgrounding, screen lock, interruption, and resume on actual iPad/iPhone Safari and PC. Listen for clipped peaks, abrupt cuts, and loop seams; retain the measured export settings and Tom's exact-version review. The findings above are documentation evidence, not a completed generation, listening, or browser test.
