/**
 * DESIGN-027 D-06 scary-moment cues: the runtime manifest pins each cue to its
 * exact inventoried file and measurements, keeps the intended mix at the
 * default master, and lets the audio owner play the one-shots and the loop.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  familyWorldCues,
  playtestCues,
  questCues,
  scareCues,
  type QuestAudioCue,
} from "../../src/client/audio";

interface InventoryEntry {
  id: string;
  category: string;
  version: string;
  review: string;
  audio: string[];
  thumbnail: string;
  gameplay_use?: string;
  checksums: Record<string, string>;
}

const repository = new URL("../../", import.meta.url);
const inventory = JSON.parse(
  readFileSync(new URL("scripts/assets/catalog-inventory.json", repository), "utf8"),
) as { assets: InventoryEntry[] };

const SCARE_CUE_IDS = [
  "jump-scare-sting",
  "servo-creak",
  "light-buzz",
  "distant-laugh",
  "radio-static",
  "casino-hum",
] as const;

/** DESIGN-027 D-06 target lengths, in seconds. */
const TARGET_SECONDS: Record<(typeof SCARE_CUE_IDS)[number], number> = {
  "jump-scare-sting": 1,
  "servo-creak": 0.8,
  "light-buzz": 2,
  "distant-laugh": 1.5,
  "radio-static": 0.8,
  "casino-hum": 8,
};

const MASTER_DB = 20 * Math.log10(0.8);

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(new URL(path, repository), "utf8")) as Record<string, unknown>;
}

function processed(id: string): { sha256: string; duration_seconds: number; peak_dbfs: number } {
  return readJson(`docs/assets/media/${id}/v001/verification.json`).processed as {
    sha256: string;
    duration_seconds: number;
    peak_dbfs: number;
  };
}

function peakAtMaster(id: string, cue: QuestAudioCue): number {
  return processed(id).peak_dbfs + 20 * Math.log10(cue.gain) + MASTER_DB;
}

describe("scary-moment cue manifest", () => {
  it("registers exactly the six D-06 cues in the game's cue set", () => {
    expect(Object.keys(scareCues).sort()).toEqual([...SCARE_CUE_IDS].sort());
    for (const id of SCARE_CUE_IDS) expect(questCues[id]).toBe(scareCues[id]);
    for (const id of SCARE_CUE_IDS) {
      expect(Object.hasOwn(playtestCues, id)).toBe(false);
      expect(Object.hasOwn(familyWorldCues, id)).toBe(false);
    }
  });

  it.each(SCARE_CUE_IDS)("pins %s to its exact inventoried file and measurements", (id) => {
    const cue: QuestAudioCue = scareCues[id];
    expect(cue.assetId).toBe(id);
    expect(cue.version).toBe("v001");
    expect(cue.path).toBe(`/studio/assets/media/${id}/v001/cue.wav`);
    const path = `docs/assets/media/${id}/v001/cue.wav`;

    const bytes = readFileSync(new URL(path, repository));
    expect(createHash("sha256").update(bytes).digest("hex"), `${id}: file SHA-256`).toBe(cue.sha256);

    const owners = inventory.assets.filter((entry) => entry.audio.includes(path));
    expect(owners.map((entry) => entry.id)).toEqual([id]);
    const entry = owners[0]!;
    expect(entry.category).toBe("sound-auditions");
    expect(entry.version).toBe(cue.version);
    expect(entry.review).toBe(`docs/assets/reviews/${id}/v001.md#audition`);
    expect(entry.thumbnail).toBe(`docs/assets/media/${id}/v001/waveform.svg`);
    expect(entry.gameplay_use).toBe("private-candidate");
    for (const file of entry.audio) {
      const fileBytes = readFileSync(new URL(file, repository));
      expect(createHash("sha256").update(fileBytes).digest("hex"), file).toBe(entry.checksums[file]);
    }

    const measured = processed(id);
    expect(measured.sha256).toBe(cue.sha256);
    expect(measured.duration_seconds).toBe(cue.durationSeconds);
    expect(cue.durationSeconds).toBe(TARGET_SECONDS[id]);
    expect(readJson(`docs/assets/media/${id}/v001/processing.json`).loop).toBe(cue.loop);

    const checks = readJson(`docs/assets/media/${id}/v001/verification.json`).checks as Record<
      string,
      boolean
    >;
    expect(Object.values(checks).every(Boolean), `${id}: every verification check`).toBe(true);
    expect(cue.maxInstances).toBe(1);
  });

  it("only the casino hum loops, and its seam checks pass", () => {
    expect(SCARE_CUE_IDS.filter((id) => scareCues[id].loop)).toEqual(["casino-hum"]);
    const verification = readJson("docs/assets/media/casino-hum/v001/verification.json");
    expect(verification.loop_seam).toMatchObject({
      wrap_step_within_p99: true,
      seam_window_level_within_3db: true,
    });
  });

  it("makes the sting the loudest cue and keeps the rest in their mix bands", () => {
    const sting = peakAtMaster("jump-scare-sting", scareCues["jump-scare-sting"]);
    expect(sting).toBeGreaterThanOrEqual(-6.5);
    expect(sting).toBeLessThanOrEqual(-5.5);
    // The limiter starts at -3 dBFS; the sting stays clear of it on its own.
    expect(sting).toBeLessThan(-3);
    for (const [id, cue] of Object.entries({ ...playtestCues, ...familyWorldCues }))
      expect(peakAtMaster(id, cue), `${id} stays under the sting`).toBeLessThan(sting - 3);

    for (const id of ["servo-creak", "light-buzz", "radio-static"] as const) {
      const peak = peakAtMaster(id, scareCues[id]);
      expect(peak, `${id}: one-shot range`).toBeGreaterThanOrEqual(-12.5);
      expect(peak, `${id}: one-shot range`).toBeLessThanOrEqual(-9.9);
    }

    const laugh = peakAtMaster("distant-laugh", scareCues["distant-laugh"]);
    expect(laugh).toBeGreaterThanOrEqual(-17);
    expect(laugh).toBeLessThanOrEqual(-15);

    const hum = peakAtMaster("casino-hum", scareCues["casino-hum"]);
    const wind = peakAtMaster("glide-wind", familyWorldCues["glide-wind"]);
    expect(hum).toBeGreaterThanOrEqual(-21);
    expect(hum).toBeLessThanOrEqual(-19);
    expect(hum).toBeLessThan(wind - 3);
  });

  it("ranks the sting above every sound and keeps ordinary one-shots from evicting the hum", () => {
    const others = Object.values(questCues).filter((cue) => cue.assetId !== "jump-scare-sting");
    for (const cue of others) expect(cue.priority).toBeLessThan(scareCues["jump-scare-sting"].priority);
    const hum = scareCues["casino-hum"].priority;
    const outranking = Object.values(questCues)
      .filter((cue) => cue.assetId !== "casino-hum" && cue.priority >= hum)
      .map((cue) => cue.assetId)
      .sort();
    expect(outranking).toEqual(["ability-unlocked", "jump-scare-sting"]);
  });
});
