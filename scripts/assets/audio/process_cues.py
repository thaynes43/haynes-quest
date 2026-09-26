#!/usr/bin/env python3
"""Prepare and verify the audio candidates using only stdlib PCM tools.

Each recipe names a cue, its candidate version and the segment of the retained
source take to use. One-shot cues are trimmed, faded and peak-normalized. A loop
recipe instead folds the source audio that follows the segment back over its
start with an equal-power crossfade, so the last frame runs straight into the
first without a gap or a fade. Other generated takes of the same cue can be kept
beside the source with a recorded reason; they are verified but never processed.
"""

from __future__ import annotations

import argparse
import array
import hashlib
import json
import math
import sys
import wave
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
MEDIA = ROOT / "docs" / "assets" / "media"
PCM_MAX = 32767


SILENT_TAKE = "Full-file RMS is at or below the script's 0.0001 full-scale non-silence threshold."


@dataclass(frozen=True)
class OtherAttempt:
    """A retained take stored as source-attempt-<number>.wav that was not selected."""

    number: int
    reason: str


@dataclass(frozen=True)
class Recipe:
    cue_id: str
    start_seconds: float
    duration_seconds: float
    fade_in_seconds: float
    fade_out_seconds: float
    target_peak_dbfs: float
    version: str = "v001"
    loop_crossfade_seconds: float = 0.0
    selected_attempt: int = 1
    other_attempts: tuple[OtherAttempt, ...] = ()

    @property
    def loop(self) -> bool:
        return self.loop_crossfade_seconds > 0


RECIPES = (
    Recipe("memory-collected", 0.0, 1.20, 0.008, 0.120, -9.0),
    Recipe("ability-unlocked", 0.0, 1.80, 0.008, 0.160, -8.0),
    Recipe("movement-landed", 0.12, 0.25, 0.005, 0.035, -16.0),
    Recipe(
        "ui-confirmed",
        0.415,
        0.30,
        0.005,
        0.050,
        -14.0,
        selected_attempt=2,
        other_attempts=(OtherAttempt(1, SILENT_TAKE),),
    ),
    # Family world mechanics (first pass, 2026-09-26). Start times follow the
    # listen-proxy envelope review recorded on each cue's review page.
    Recipe("bounce-pad-boing", 0.08, 0.60, 0.020, 0.120, -10.0),
    Recipe(
        "lift-arrival-chime",
        0.10,
        0.80,
        0.010,
        0.250,
        -11.0,
        selected_attempt=2,
        other_attempts=(
            OtherAttempt(1, "Wrong character: one sustained bell note (about 612 Hz) with no second note."),
        ),
    ),
    Recipe("crumble-crack", 2.06, 0.70, 0.010, 0.120, -11.0),
    Recipe("double-jump-whoosh", 0.78, 0.45, 0.050, 0.150, -12.0),
    Recipe(
        "glide-wind",
        3.00,
        1.60,
        0.0,
        0.0,
        -18.0,
        loop_crossfade_seconds=0.25,
        selected_attempt=3,
        other_attempts=(
            OtherAttempt(
                1,
                "Wrong character: about two thirds of the energy sits below 300 Hz, a low rumble rather "
                "than an airy whoosh, likely to vanish on tablet and phone speakers.",
            ),
            OtherAttempt(
                2,
                "Wrong character: about 81% of the energy sits below 300 Hz and the level swells "
                "rather than holding steady.",
            ),
        ),
    ),
    Recipe("golden-ticket-sparkle", 0.10, 1.00, 0.010, 0.300, -10.0),
    Recipe(
        "honk-bus-honk",
        3.45,
        0.80,
        0.010,
        0.120,
        -12.0,
        selected_attempt=2,
        other_attempts=(
            OtherAttempt(
                1,
                "Wrong character: two sustained horn blasts of about 1.1 seconds each, one second apart; "
                "no double honk fits the 0.8-second cue.",
            ),
        ),
    ),
    Recipe(
        "enemy-poof",
        0.08,
        0.60,
        0.010,
        0.100,
        -11.0,
        other_attempts=(
            OtherAttempt(
                2,
                "Not selected: a slow hiss swell ending in an abrupt thump, followed by warbling noise; "
                "no clean 0.6-second poof.",
            ),
            OtherAttempt(
                3,
                "Not selected: a run of short low pillow thumps that reads as repeated pops rather "
                "than one poof, starting at the first frame.",
            ),
        ),
    ),
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_pcm16(path: Path) -> tuple[wave._wave_params, array.array]:
    with wave.open(str(path), "rb") as source:
        params = source.getparams()
        if params.comptype != "NONE" or params.sampwidth != 2:
            raise ValueError(f"{path}: expected uncompressed 16-bit PCM")
        samples = array.array("h", source.readframes(params.nframes))
    if sys.byteorder != "little":
        samples.byteswap()
    expected = params.nframes * params.nchannels
    if len(samples) != expected:
        raise ValueError(f"{path}: decoded {len(samples)} samples, expected {expected}")
    return params, samples


def write_pcm16(path: Path, params: wave._wave_params, samples: array.array) -> None:
    payload = array.array("h", samples)
    if sys.byteorder != "little":
        payload.byteswap()
    with wave.open(str(path), "wb") as target:
        target.setnchannels(params.nchannels)
        target.setsampwidth(2)
        target.setframerate(params.framerate)
        target.setcomptype("NONE", "not compressed")
        target.writeframes(payload.tobytes())


def dbfs(value: float) -> float | None:
    return round(20.0 * math.log10(value), 3) if value > 0 else None


def measurements(path: Path, params: wave._wave_params, samples: array.array) -> dict[str, object]:
    absolute_peak = max((abs(value) for value in samples), default=0)
    rms = math.sqrt(sum(value * value for value in samples) / len(samples)) if samples else 0.0
    dc = sum(samples) / len(samples) if samples else 0.0
    frames = len(samples) // params.nchannels
    return {
        "path": path.relative_to(ROOT).as_posix(),
        "sha256": sha256(path),
        "size_bytes": path.stat().st_size,
        "codec": "pcm_s16le",
        "sample_width_bits": params.sampwidth * 8,
        "sample_rate_hz": params.framerate,
        "channels": params.nchannels,
        "frames": frames,
        "duration_seconds": round(frames / params.framerate, 6),
        "peak_amplitude": round(absolute_peak / 32768.0, 8),
        "peak_dbfs": dbfs(absolute_peak / 32768.0),
        "rms_amplitude": round(rms / 32768.0, 8),
        "rms_dbfs": dbfs(rms / 32768.0),
        "dc_offset": round(dc / 32768.0, 8),
        "clipped_sample_count": sum(abs(value) >= PCM_MAX for value in samples),
        "non_silent": rms / 32768.0 > 0.0001,
    }


def trim_fade_level(
    params: wave._wave_params, samples: array.array, recipe: Recipe
) -> tuple[array.array, dict[str, object]]:
    channels = params.nchannels
    rate = params.framerate
    start_frame = round(recipe.start_seconds * rate)
    frame_count = round(recipe.duration_seconds * rate)
    end_frame = start_frame + frame_count
    if recipe.loop:
        return loop_crossfade_level(params, samples, recipe, start_frame, frame_count)
    if end_frame > params.nframes:
        raise ValueError(f"{recipe.cue_id}: requested segment extends past source")
    segment = array.array("h", samples[start_frame * channels : end_frame * channels])
    segment_peak = max((abs(value) for value in segment), default=0)
    segment_rms = math.sqrt(sum(value * value for value in segment) / len(segment)) if segment else 0.0

    fade_in_frames = round(recipe.fade_in_seconds * rate)
    fade_out_frames = round(recipe.fade_out_seconds * rate)
    faded: list[float] = []
    for frame in range(frame_count):
        envelope = 1.0
        if fade_in_frames and frame < fade_in_frames:
            envelope *= frame / fade_in_frames
        tail_frame = frame_count - 1 - frame
        if fade_out_frames and tail_frame < fade_out_frames:
            envelope *= tail_frame / fade_out_frames
        base = frame * channels
        faded.extend(segment[base + channel] * envelope for channel in range(channels))

    peak_before_level = max((abs(value) for value in faded), default=0.0)
    if peak_before_level <= 0:
        raise ValueError(f"{recipe.cue_id}: selected segment is silent")
    target_peak = 32768.0 * (10.0 ** (recipe.target_peak_dbfs / 20.0))
    gain = target_peak / peak_before_level
    processed = array.array("h", (round(max(-32768, min(32767, value * gain))) for value in faded))
    return processed, {
        "schema_version": 1,
        "operation": "frame-accurate trim, linear fade-in/out, peak normalization",
        "source_start_seconds": recipe.start_seconds,
        "source_start_frame": start_frame,
        "duration_seconds": recipe.duration_seconds,
        "output_frames": frame_count,
        "fade_in_seconds": recipe.fade_in_seconds,
        "fade_in_frames": fade_in_frames,
        "fade_out_seconds": recipe.fade_out_seconds,
        "fade_out_frames": fade_out_frames,
        "selected_segment_peak_dbfs_before_fades": dbfs(segment_peak / 32768.0),
        "selected_segment_rms_dbfs_before_fades": dbfs(segment_rms / 32768.0),
        "selected_segment_is_non_silent": segment_rms / 32768.0 > 0.0001,
        "faded_peak_dbfs_before_level": dbfs(peak_before_level / 32768.0),
        "target_peak_dbfs": recipe.target_peak_dbfs,
        "applied_gain": round(gain, 8),
        "applied_gain_db": round(20.0 * math.log10(gain), 3),
        "resampling": False,
        "channel_conversion": False,
        "loop": False,
    }


def loop_crossfade_level(
    params: wave._wave_params, samples: array.array, recipe: Recipe, start_frame: int, frame_count: int
) -> tuple[array.array, dict[str, object]]:
    """Fold the audio after the segment over its start so the clip repeats without a seam.

    Output frame i < crossfade mixes source[start + i] (fading in) with
    source[start + length + i] (fading out). The final output frame is
    source[start + length - 1], so wrapping to frame 0 continues into
    source[start + length] exactly as the original take did.
    """
    channels = params.nchannels
    rate = params.framerate
    crossfade_frames = round(recipe.loop_crossfade_seconds * rate)
    if not 0 < crossfade_frames < frame_count:
        raise ValueError(f"{recipe.cue_id}: loop crossfade must be shorter than the loop")
    used_end = start_frame + frame_count + crossfade_frames
    if used_end > params.nframes:
        raise ValueError(f"{recipe.cue_id}: loop segment plus crossfade extends past source")
    segment = array.array("h", samples[start_frame * channels : start_frame * channels + frame_count * channels])
    segment_peak = max((abs(value) for value in segment), default=0)
    segment_rms = math.sqrt(sum(value * value for value in segment) / len(segment)) if segment else 0.0

    looped: list[float] = []
    for frame in range(frame_count):
        base = (start_frame + frame) * channels
        if frame < crossfade_frames:
            position = (frame + 0.5) / crossfade_frames
            incoming = math.sin(0.5 * math.pi * position)
            outgoing = math.cos(0.5 * math.pi * position)
            tail = base + frame_count * channels
            looped.extend(
                samples[base + channel] * incoming + samples[tail + channel] * outgoing
                for channel in range(channels)
            )
        else:
            looped.extend(float(samples[base + channel]) for channel in range(channels))

    peak_before_level = max((abs(value) for value in looped), default=0.0)
    if peak_before_level <= 0:
        raise ValueError(f"{recipe.cue_id}: selected loop segment is silent")
    target_peak = 32768.0 * (10.0 ** (recipe.target_peak_dbfs / 20.0))
    gain = target_peak / peak_before_level
    processed = array.array("h", (round(max(-32768, min(32767, value * gain))) for value in looped))
    return processed, {
        "schema_version": 1,
        "operation": "frame-accurate trim, equal-power loop crossfade, peak normalization",
        "source_start_seconds": recipe.start_seconds,
        "source_start_frame": start_frame,
        "duration_seconds": recipe.duration_seconds,
        "output_frames": frame_count,
        "fade_in_seconds": 0.0,
        "fade_in_frames": 0,
        "fade_out_seconds": 0.0,
        "fade_out_frames": 0,
        "loop_crossfade_seconds": recipe.loop_crossfade_seconds,
        "loop_crossfade_frames": crossfade_frames,
        "loop_crossfade_curve": "equal-power sine/cosine; source audio after the loop fades out over the loop start",
        "source_frames_used": frame_count + crossfade_frames,
        "selected_segment_peak_dbfs_before_fades": dbfs(segment_peak / 32768.0),
        "selected_segment_rms_dbfs_before_fades": dbfs(segment_rms / 32768.0),
        "selected_segment_is_non_silent": segment_rms / 32768.0 > 0.0001,
        "faded_peak_dbfs_before_level": dbfs(peak_before_level / 32768.0),
        "target_peak_dbfs": recipe.target_peak_dbfs,
        "applied_gain": round(gain, 8),
        "applied_gain_db": round(20.0 * math.log10(gain), 3),
        "resampling": False,
        "channel_conversion": False,
        "loop": True,
    }


def loop_seam_checks(params: wave._wave_params, samples: array.array) -> dict[str, object]:
    """Compare the wrap from the last frame to the first with the clip's own sample steps and level."""
    channels = params.nchannels
    frames = len(samples) // channels
    steps = sorted(
        abs(samples[frame * channels + channel] - samples[(frame - 1) * channels + channel])
        for frame in range(1, frames)
        for channel in range(channels)
    )
    p99_step = steps[min(len(steps) - 1, int(0.99 * len(steps)))]
    seam_step = max(
        abs(samples[channel] - samples[(frames - 1) * channels + channel]) for channel in range(channels)
    )
    window = round(0.025 * params.framerate)
    around = list(samples[(frames - window) * channels :]) + list(samples[: window * channels])

    def rms(values: list[int] | array.array) -> float:
        return math.sqrt(sum(value * value for value in values) / len(values))

    seam_ratio_db = 20.0 * math.log10(rms(around) / rms(samples))
    return {
        "wrap_sample_step": seam_step,
        "p99_sample_step": p99_step,
        "wrap_step_within_p99": seam_step <= p99_step,
        "seam_window_seconds": round(2 * window / params.framerate, 6),
        "seam_window_rms_vs_clip_db": round(seam_ratio_db, 3),
        "seam_window_level_within_3db": abs(seam_ratio_db) <= 3.0,
    }


def waveform_svg(cue_id: str, version: str, params: wave._wave_params, samples: array.array, loop: bool = False) -> str:
    width, height, buckets = 960, 220, 480
    channels = params.nchannels
    frames = len(samples) // channels
    peaks: list[float] = []
    for bucket in range(buckets):
        first = bucket * frames // buckets
        last = max(first + 1, (bucket + 1) * frames // buckets)
        peak = 0
        for frame in range(first, min(last, frames)):
            base = frame * channels
            peak = max(peak, *(abs(samples[base + channel]) for channel in range(channels)))
        peaks.append(peak / 32768.0)
    middle = height / 2
    scale = height * 0.45
    top = " ".join(f"{i * width / (buckets - 1):.2f},{middle - peak * scale:.2f}" for i, peak in enumerate(peaks))
    bottom = " ".join(
        f"{i * width / (buckets - 1):.2f},{middle + peak * scale:.2f}"
        for i, peak in reversed(list(enumerate(peaks)))
    )
    duration = frames / params.framerate
    kind = "seamless loop WAV" if loop else "WAV"
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 220" role="img" '
        f'aria-labelledby="title desc"><title id="title">{cue_id} {version} waveform</title>'
        f'<desc id="desc">Peak waveform of the {duration:.2f} second processed stereo {kind}.</desc>'
        '<rect width="960" height="220" fill="#17211d"/>'
        '<line x1="0" y1="110" x2="960" y2="110" stroke="#486055" stroke-width="1"/>'
        f'<polygon points="{top} {bottom}" fill="#e8b86d"/>'
        '</svg>\n'
    )


def provenance(response: dict[str, object], recipe: Recipe, directory: Path) -> dict[str, object]:
    model = response["model"]
    record: dict[str, object] = {
        "schema_version": 1,
        "cue_id": recipe.cue_id,
        "candidate_version": recipe.version,
        "generation_kind": "synthetic text-to-sound effect",
        "generation_date": response["created_at"],
        "service_version": response["service_version"],
        "job_id": response["id"],
        "prompt": response["prompt"],
        "seconds": response["seconds"],
        "steps": response["steps"],
        "seed": response["seed"],
        "model": model,
        "terms_record": {
            "design_record": "docs/designs/008-audio-pipeline.md",
            "source_code": "MIT, as recorded by DESIGN-008",
            "model_artifacts": "Stability license, as recorded by DESIGN-008",
            "redistributed_text_component": "Gemma terms, as recorded by DESIGN-008",
            "stability_license": "https://stability.ai/license",
            "gemma_terms": "https://ai.google.dev/gemma/terms",
        },
        "approval": "Candidate only; Tom approval pending",
        "listening_review": "Not performed by the processing script",
    }
    if recipe.other_attempts:
        record["selected_attempt"] = recipe.selected_attempt
        attempts = []
        for attempt in recipe.other_attempts:
            other = json.loads(
                (directory / f"source-attempt-{attempt.number}-response.json").read_text(encoding="utf-8")
            )
            attempts.append(
                {
                    "attempt": attempt.number,
                    "job_id": other["id"],
                    "generation_date": other["created_at"],
                    "service_version": other["service_version"],
                    "prompt": other["prompt"],
                    "seconds": other["seconds"],
                    "steps": other["steps"],
                    "seed": other["seed"],
                    "source": (directory / f"source-attempt-{attempt.number}.wav").relative_to(ROOT).as_posix(),
                    "source_sha256": other["audio"]["sha256"],
                    "selection": "not selected",
                    "reason": attempt.reason,
                }
            )
        record["other_attempts"] = attempts
    return record


def run(recipe: Recipe) -> None:
    directory = MEDIA / recipe.cue_id / recipe.version
    source_path = directory / "source.wav"
    response_path = directory / "source-response.json"
    response = json.loads(response_path.read_text(encoding="utf-8"))
    expected_sha = response["audio"]["sha256"]
    actual_sha = sha256(source_path)
    if actual_sha != expected_sha:
        raise ValueError(f"{recipe.cue_id}: source SHA differs from service response")

    source_params, source_samples = read_pcm16(source_path)
    processed, processing = trim_fade_level(source_params, source_samples, recipe)
    output_path = directory / "cue.wav"
    write_pcm16(output_path, source_params, processed)
    output_params, output_samples = read_pcm16(output_path)

    processing.update(
        {
            "source": source_path.relative_to(ROOT).as_posix(),
            "output": output_path.relative_to(ROOT).as_posix(),
            "implementation": "scripts/assets/audio/process_cues.py",
            "python": sys.version.split()[0],
        }
    )
    (directory / "processing.json").write_text(json.dumps(processing, indent=2) + "\n", encoding="utf-8")
    processed_measurements = measurements(output_path, output_params, output_samples)
    verification = {
        "schema_version": 1,
        "service_checksum_matches_download": True,
        "source": measurements(source_path, source_params, source_samples),
        "processed": processed_measurements,
        "checks": {
            "processed_duration_matches_recipe": len(output_samples) // output_params.nchannels
            == processing["output_frames"],
            "processed_has_no_clipped_samples": not any(abs(value) >= PCM_MAX for value in output_samples),
            "processed_is_non_silent": processed_measurements["non_silent"],
            "format_is_browser_wav_pcm16": output_params.sampwidth == 2
            and output_params.comptype == "NONE",
        },
        "limits": [
            "Numerical analysis does not establish sound quality or prompt fidelity.",
            "No browser, physical-device, or human listening test is performed by this script.",
        ],
    }
    if recipe.loop:
        seam = loop_seam_checks(output_params, output_samples)
        verification["loop_seam"] = seam
        verification["checks"]["loop_wrap_step_within_p99"] = seam["wrap_step_within_p99"]
        verification["checks"]["loop_seam_level_within_3db"] = seam["seam_window_level_within_3db"]
        verification["limits"] = verification["limits"] + [
            "The seam checks compare sample steps and short-window level only; they do not prove an inaudible loop."
        ]
    (directory / "verification.json").write_text(json.dumps(verification, indent=2) + "\n", encoding="utf-8")
    (directory / "provenance.json").write_text(
        json.dumps(provenance(response, recipe, directory), indent=2) + "\n", encoding="utf-8"
    )
    (directory / "waveform.svg").write_text(
        waveform_svg(recipe.cue_id, recipe.version, output_params, output_samples, recipe.loop), encoding="utf-8"
    )

    for attempt in recipe.other_attempts:
        rejected_path = directory / f"source-attempt-{attempt.number}.wav"
        rejected_response_path = directory / f"source-attempt-{attempt.number}-response.json"
        rejected_response = json.loads(rejected_response_path.read_text(encoding="utf-8"))
        rejected_expected_sha = rejected_response["audio"]["sha256"]
        rejected_actual_sha = sha256(rejected_path)
        if rejected_actual_sha != rejected_expected_sha:
            raise ValueError(f"{recipe.cue_id}: rejected source SHA differs from service response")
        rejected_params, rejected_samples = read_pcm16(rejected_path)
        rejected_measurements = measurements(rejected_path, rejected_params, rejected_samples)
        rejected_verification = {
            "schema_version": 1,
            "service_checksum_matches_download": True,
            "source": rejected_measurements,
            "selection": "rejected before processing",
            "reason": attempt.reason,
            "limits": "This numerical rejection does not constitute a listening review.",
        }
        (directory / f"source-attempt-{attempt.number}-verification.json").write_text(
            json.dumps(rejected_verification, indent=2) + "\n", encoding="utf-8"
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("cue_ids", nargs="*", help="process only named cue IDs")
    args = parser.parse_args()
    selected = set(args.cue_ids)
    known = {recipe.cue_id for recipe in RECIPES}
    unknown = selected - known
    if unknown:
        parser.error(f"unknown cue IDs: {', '.join(sorted(unknown))}")
    for recipe in RECIPES:
        if not selected or recipe.cue_id in selected:
            run(recipe)
            print(f"processed {recipe.cue_id}")


if __name__ == "__main__":
    main()
