#!/usr/bin/env python3
"""Prepare and verify the PLAN-004 audio candidates using only stdlib PCM tools."""

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


@dataclass(frozen=True)
class Recipe:
    cue_id: str
    start_seconds: float
    duration_seconds: float
    fade_in_seconds: float
    fade_out_seconds: float
    target_peak_dbfs: float


RECIPES = (
    Recipe("memory-collected", 0.0, 1.20, 0.008, 0.120, -9.0),
    Recipe("ability-unlocked", 0.0, 1.80, 0.008, 0.160, -8.0),
    Recipe("movement-landed", 0.12, 0.25, 0.005, 0.035, -16.0),
    Recipe("ui-confirmed", 0.415, 0.30, 0.005, 0.050, -14.0),
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


def waveform_svg(cue_id: str, params: wave._wave_params, samples: array.array) -> str:
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
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 220" role="img" '
        f'aria-labelledby="title desc"><title id="title">{cue_id} v001 waveform</title>'
        f'<desc id="desc">Peak waveform of the {duration:.2f} second processed stereo WAV.</desc>'
        '<rect width="960" height="220" fill="#17211d"/>'
        '<line x1="0" y1="110" x2="960" y2="110" stroke="#486055" stroke-width="1"/>'
        f'<polygon points="{top} {bottom}" fill="#e8b86d"/>'
        '</svg>\n'
    )


def provenance(response: dict[str, object], cue_id: str) -> dict[str, object]:
    model = response["model"]
    return {
        "schema_version": 1,
        "cue_id": cue_id,
        "candidate_version": "v001",
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


def run(recipe: Recipe) -> None:
    directory = MEDIA / recipe.cue_id / "v001"
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
    (directory / "verification.json").write_text(json.dumps(verification, indent=2) + "\n", encoding="utf-8")
    (directory / "provenance.json").write_text(
        json.dumps(provenance(response, recipe.cue_id), indent=2) + "\n", encoding="utf-8"
    )
    (directory / "waveform.svg").write_text(
        waveform_svg(recipe.cue_id, output_params, output_samples), encoding="utf-8"
    )

    rejected_path = directory / "source-attempt-1.wav"
    rejected_response_path = directory / "source-attempt-1-response.json"
    if rejected_path.exists() and rejected_response_path.exists():
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
            "reason": "Full-file RMS is at or below the script's 0.0001 full-scale non-silence threshold.",
            "limits": "This numerical rejection does not constitute a listening review.",
        }
        (directory / "source-attempt-1-verification.json").write_text(
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
