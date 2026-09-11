# Work order: first-pass browser audio cues

- **Status:** Complete; ready for Astra lead intake and listening review
- **Model / dispatch:** Native GPT-5.6 Sol, `xhigh`, fresh context
- **Required reading:** `AGENTS.md`, `.agents/TEAM.md`, PLAN-004, DESIGN-008, and the asset-review template
- **Worktree / branch / base commit:** `/home/dev/work/quest-audio`; `agent/quest-audio`; `e261a41`
- **Owned paths:** `scripts/assets/audio/**`, `docs/assets/media/{memory-collected,ability-unlocked,movement-landed,ui-confirmed}/v001/**`, and this work order

## Outcome and scope

Generate four synthetic Stable Audio 3 Small-SFX candidates through the private CPU service, retain each five-second source, and prepare short browser WAV auditions with reproducible trimming, fades, level control, checksums, waveforms, and measurements. No candidate is integrated into the game. The Astra lead owns listening, review pages, catalog copy, audio direction, and final judgment.

## Inputs and authoring contract

Use eight inference steps and fixed seeds 101–104. Submit one generation at a time and verify completion through the native audio service. Source and model revisions, service responses, processing decisions, and measurements must remain with each candidate. Public provenance follows DESIGN-008: Stable Audio 3 optimized Small-SFX, source revision `779434a908193105335fd8d833418603625b2859`, weights revision `da6edc54ddba10bfd79a077102ded687f80e882b`, Stability model license, Gemma terms for the redistributed text component, and MIT source code. This record does not extend or reinterpret those terms.

| Cue | Seed | Source | Target processed duration |
| --- | ---: | ---: | ---: |
| `memory-collected` | 101 | 5.0 s | 1.20 s |
| `ability-unlocked` | 102 | 5.0 s | 1.80 s |
| `movement-landed` | 103 | 5.0 s | 0.25 s |
| `ui-confirmed` | 104 | 5.0 s | 0.30 s |

## Durable generation checkpoint

| Cue | Job ID | State |
| --- | --- | --- |
| `memory-collected` | `0d102d675f3c4d58a8762b0909ad174b` | Completed; downloaded SHA matches service |
| `ability-unlocked` | `55aceccfb6ba407ca6bd84ab227c0d93` | Completed; downloaded SHA matches service |
| `movement-landed` | `cdd9618646d94788a65eeb4fcf8b84a9` | Completed; downloaded SHA matches service |
| `ui-confirmed` | `b8bf67044e094f4c956397d78ec8391d` | Completed; downloaded SHA matches service. Attempt `e3767bc777284577b9466a6018f793e9` is retained after measuring effectively silent. |

## Deliverables and verification

Each media directory contains `source.wav`, `cue.wav`, `source-response.json`, `processing.json`, `verification.json`, `provenance.json`, and an SVG waveform. `scripts/assets/audio/process_cues.py` reproduces processed WAVs and evidence using the Python standard library because FFmpeg/ffprobe were absent in this worktree environment. All WAVs are PCM signed 16-bit, stereo, 44.1 kHz.

| Cue | Processed SHA-256 | Duration | Peak / RMS |
| --- | --- | ---: | ---: |
| `memory-collected` | `86ed72b341775dbb6f60414994912ec0d0292140e6408c20de54e5eb7ba0d358` | 1.20 s | -9.000 / -26.436 dBFS |
| `ability-unlocked` | `46318afe6c77579a6b063fa704e887cd6112601b4cc4144351fa9085845115c0` | 1.80 s | -8.000 / -19.654 dBFS |
| `movement-landed` | `2c869c641b29e5df0ede83ad5dfab63f26a4d41c9b7258b56d3acb4dd71bf127` | 0.25 s | -16.001 / -37.184 dBFS |
| `ui-confirmed` | `e9a0541c87b518de9b7d989ae4b6ef99d3ee03e40bfc1e65855bfe9069597608` | 0.30 s | -14.000 / -36.501 dBFS |

All four selected segments are numerically non-silent. They meet the requested durations, have zero clipped samples, and passed source checksum, PCM decode, sample-rate, channel-count, and deterministic reprocessing checks. Native `audio.list_generations` returned all selected jobs as completed; `scripts/assets/audio/service-list-verification.json` records that audit.

The available audio-content helper reported that this model surface does not support audio input, so no listening review occurred. Numerical inspection cannot confirm the requested note count, timbre, prompt fidelity, or gameplay mix. The Astra lead must audition `cue.wav` for each candidate and record the coordinator and owner judgments separately.

## Handoff and recovery

Current branch has no game integration. Run `python3 scripts/assets/audio/process_cues.py` from the repository root to reproduce all processed files and their evidence. The UI directory also retains the silent first attempt and its response/verification, so the failed take is not lost. The next action is Astra listening and review-page/catalog intake; Tom approval remains pending.
