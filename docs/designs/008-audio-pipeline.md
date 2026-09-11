# DESIGN-008: Audio authoring and browser playback

- **Status:** Self-hosted CPU authoring verified; native registration staged; browser contract proposed
- **Last updated:** 2026-09-11
- **Source:** Tom's request for audio tooling and an Astra asset-development workflow
- **Satisfies:** [PRD-001 R-08, R-09, R-16, R-35–R-39](../prds/001-project-brief.md)
- **Related:** [PoC development loop](007-poc-development-loop.md), [visual assets](002-asset-pipeline.md), [asset review template](../assets/000-review-template.md)

## Selected authoring route

Tom selected self-hosted audio setup before the one planned dev-env restart. Use **Stable Audio 3 Small-SFX through its official optimized TFLite CPU implementation** in a dedicated cluster service. Its independent image, model cache, output workspace, and lifecycle let us upgrade audio without restarting Blender or dev-env. The game plays prepared, reviewed files; it does not call the generation service during gameplay.

The [official optimized implementation](https://github.com/Stability-AI/stable-audio-3/blob/779434a908193105335fd8d833418603625b2859/optimized/tflite/README.md) uses LiteRT on CPU, without PyTorch or CUDA. Its [optimized model distribution](https://huggingface.co/stabilityai/stable-audio-3-optimized/tree/da6edc54ddba10bfd79a077102ded687f80e882b) supports anonymous downloads, including the text encoder. The gated PyTorch checkpoint is a different distribution; its account/contact-sharing gate is not a setup prerequisite for this route. The model's published license terms still apply.

| Option | Role | Setup boundary |
| --- | --- | --- |
| Stable Audio 3 optimized Small-SFX | Selected self-hosted effects/ambience authoring route. | Pinned CPU runtime, persistent model files, private job API, and live generation evidence. |
| ElevenLabs API/SDK | Optional hosted alternative retained for reference. | No account, key, subscription, or integration is required for the selected setup. |
| Kenney audio packs | Optional prepared placeholder/fallback. | Retain the selected pack's license and exact-version review record. |

GPU audio and Small-Music can be evaluated later. Existing cluster GPU consumers make scheduler availability insufficient evidence of free VRAM; no GPU is reserved for this CPU service. [Kenney UI Audio](https://kenney.nl/assets/ui-audio) is also available for simple placeholders.

### ElevenLabs free tier

[Official pricing](https://elevenlabs.io/pricing), checked 2026-09-10, lists $0 for 10,000 shared monthly credits; Starter is $6/month. [API billing](https://help.elevenlabs.io/hc/en-us/articles/28184926326033-How-much-does-it-cost-to-use-the-API) includes SFX API access in the free plan. [SFX costs](https://help.elevenlabs.io/hc/en-us/articles/25735337678481-How-much-does-it-cost-to-generate-sound-effects) distinguish API calls from the website: one auto-duration API clip costs 100 credits, or an explicitly timed clip costs 20 credits/second. Spending the entire free allowance on auto-duration SFX therefore allows 100 API clips; the website's four-variation requests use a different rate. These limits may change and do not include other audio use from the same credit pool.

Free output is for noncommercial use, with attribution when shared/published under the [publishing guidance](https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform). A later subscription does not retroactively convert free-generated files into paid-plan output. ElevenLabs is a hosted service, not the self-hosted choice in this proposal.

### Reproducible service setup

- Pin source to `Stability-AI/stable-audio-3@779434a908193105335fd8d833418603625b2859` and weights to `stabilityai/stable-audio-3-optimized@da6edc54ddba10bfd79a077102ded687f80e882b`.
- Provision only the text encoder, Small-SFX diffusion model, and SAME-S decoder, approximately 2.5GB total. Keep downloads in a separate provisioning job with permitted Hugging Face/CDN egress. Runtime mounts the model volume read-only and runs offline.
- Expose a private streamable HTTP MCP job interface at `http://audio-authoring.dev.svc.cluster.local:8000/mcp`. Submission returns a job ID; status, cancellation, history, and confined artifact downloads avoid keeping one agent request open throughout inference. One generation runs at a time.
- Keep generated WAVs and job/provenance metadata on the audio service's own persistent workspace. Remote paths are not dev-env paths. Use FFmpeg/ffprobe in the dedicated authoring workloads for processing and inspection.
- Validate a real synthetic cue on the deployed CPU workload, recording duration/format, elapsed time, peak memory, artifact checksum, and the limits of any listening review. Infrastructure smoke output does not count as an approved game sound.
- Stage audio/Blender MCP registrations and startup delegation rules under a temporary Reloader exclusion after service validation. Verify both ConfigMaps and mounted files, then use held dev-env PR #2833 for one explicit pod-template activation and restoration of normal reload behavior at Tom's session break. Later service upgrades do not require that restart.

The selected CLI configuration fixes `sm-sfx`, `same-s`, FP32 diffusion, quantized decoder, four CPU threads, and eight steps by default. Generate enough context and trim the desired event for short cues; the upstream guide recommends longer clips for coherence. Source is MIT; model artifacts retain the publisher's [Stability license](https://stability.ai/license) and redistributed text component's [Gemma terms](https://ai.google.dev/gemma/terms). Preserve provenance and applicable terms with each candidate.

## Authoring workflow

1. Define a cue ID, triggering event, mood, duration/loop intent, and priority. The brief uses original sound descriptions and identifies any needed source rights.
2. The audio authoring agent produces a small set of candidates using the selected pinned local CLI or hosted script/SDK. For the hosted alternative, ElevenLabs' [SFX endpoint](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert) accepts text and generation settings, including looping for its supported model. Match duration and export settings to the current endpoint/plan rather than assuming every format is available.
3. Retain the original generated/downloaded file and metadata. Inspect, trim, fade, check clipping/loop seams, and create browser delivery versions. [FFmpeg filters](https://ffmpeg.org/ffmpeg-filters.html) support these processing steps; [ffprobe](https://ffmpeg.org/ffprobe.html) supplies machine-readable stream metadata. Do not claim a lossy provider download becomes a lossless master by converting it to WAV.
4. Audition candidates in isolation and in a short labeled review preview. Keep a reproducible processing recipe, level/loop notes, checksums, and source/terms information. [Audacity macros](https://manual.audacityteam.org/man/macros.html) are an optional workstation editing aid; an interactive editor is not required for the agent pipeline.
5. Present the concrete review package to Tom. Record approval against the exact version under DESIGN-007, then promote that version into the cue manifest. Keep the previous approved sound when a replacement is pending or rejected.

Our private MCP service wraps the pinned local CLI for asynchronous authoring. It is separate from provider-hosted MCP offerings. ElevenLabs' [former local MCP repository](https://github.com/elevenlabs/elevenlabs-mcp) is archived/deprecated; its replacement [hosted MCP](https://elevenlabs.io/docs/eleven-agents/operate/hosted-mcp) documents speech and agent-management capabilities, without establishing SFX/music parity for this workflow. We have not connected either server.

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

The dedicated Blender service provides FFmpeg/ffprobe and verified artifact transfer. The separate audio service has downloaded its pinned 2.49GB model bundle anonymously and passed real CPU generation, asynchronous status/cancellation, and confined WAV downloads. The first 10-second stereo test took 7.3 seconds with about 3.9 GiB peak subprocess memory. PLAN-003 records deployment, cache-fix, and persistence evidence. No GPU is assigned, the samples have not been auditioned, and no game audio candidate is approved. Both native registrations and startup rules are staged and verified without restarting dev-env; discovery waits for the single held activation.

Validate first interaction, mute, missing files, repeated scene entry, effect spam, backgrounding, screen lock, interruption, and resume on actual iPad/iPhone Safari and PC. Listen for clipped peaks, abrupt cuts, and loop seams; retain the measured export settings and Tom's exact-version review. The infrastructure generation checks above do not establish listening quality or browser behavior.
