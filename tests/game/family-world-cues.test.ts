/**
 * DESIGN-008 family world cues: the runtime manifest pins each cue to its
 * exact inventoried file, and every family world gameplay event maps to the
 * intended cue while older routes keep their exact playtest sounds.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  familyWorldCues,
  gameplayFeedback,
  playtestCues,
  questCues,
  type QuestAudioCue,
} from "../../src/client/audio";
import {
  enemyAttackSounds,
  feedbackSounds,
  plainJumpSinceLastStatus,
  playFeedbackSounds,
  POOF_UNDER_DEFEAT,
  type FeedbackSound,
} from "../../src/client/feedback-sounds";
import type { GameFeedbackEvent } from "../../src/game/types";
import { ALL_PARODY_CANDIDATES } from "../../src/shared/parody-catalog";

interface InventoryEntry {
  id: string;
  category: string;
  version: string;
  audio: string[];
  gameplay_use?: string;
  checksums: Record<string, string>;
}

const repository = new URL("../../", import.meta.url);
const inventory = JSON.parse(
  readFileSync(new URL("scripts/assets/catalog-inventory.json", repository), "utf8"),
) as { assets: InventoryEntry[] };

const FAMILY_CUE_IDS = [
  "bounce-pad-boing",
  "lift-arrival-chime",
  "crumble-crack",
  "double-jump-whoosh",
  "glide-wind",
  "golden-ticket-sparkle",
  "honk-bus-honk",
  "enemy-poof",
] as const;

function repositoryPath(cue: QuestAudioCue): string {
  const prefix = "/studio/assets/media/";
  expect(cue.path.startsWith(prefix), `${cue.assetId}: studio media URL`).toBe(true);
  return `docs/assets/media/${cue.path.slice(prefix.length)}`;
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(new URL(path, repository), "utf8")) as Record<string, unknown>;
}

describe("family world cue manifest", () => {
  it("registers exactly the eight family world cues beside the unchanged playtest four", () => {
    expect(Object.keys(familyWorldCues).sort()).toEqual([...FAMILY_CUE_IDS].sort());
    expect(Object.keys(questCues).sort()).toEqual(
      [...Object.keys(playtestCues), ...FAMILY_CUE_IDS].sort(),
    );
    for (const [id, cue] of Object.entries(playtestCues))
      expect(questCues[id as keyof typeof questCues]).toBe(cue);
  });

  it.each(FAMILY_CUE_IDS)("pins %s to its exact inventoried file and measurements", (id) => {
    const cue: QuestAudioCue = familyWorldCues[id];
    expect(cue.assetId).toBe(id);
    expect(cue.version).toBe("v001");
    const path = repositoryPath(cue);
    expect(path).toBe(`docs/assets/media/${id}/v001/cue.wav`);

    const bytes = readFileSync(new URL(path, repository));
    expect(createHash("sha256").update(bytes).digest("hex"), `${id}: file SHA-256`).toBe(cue.sha256);

    const owners = inventory.assets.filter((entry) => entry.audio.includes(path));
    expect(owners.map((entry) => entry.id)).toEqual([id]);
    const entry = owners[0]!;
    expect(entry.category).toBe("sound-auditions");
    expect(entry.version).toBe(cue.version);
    expect(entry.checksums[path]).toBe(cue.sha256);
    expect(entry.gameplay_use).toBe("private-candidate");

    const processed = readJson(`docs/assets/media/${id}/v001/verification.json`).processed as {
      sha256: string;
      duration_seconds: number;
    };
    expect(processed.sha256).toBe(cue.sha256);
    expect(processed.duration_seconds).toBe(cue.durationSeconds);
    expect(readJson(`docs/assets/media/${id}/v001/processing.json`).loop).toBe(cue.loop);

    expect(cue.maxInstances).toBeGreaterThanOrEqual(1);
    expect(cue.maxInstances).toBeLessThanOrEqual(2);
  });

  it("mixes each cue to the playtest peak range, with the glide loop underneath", () => {
    const masterDb = 20 * Math.log10(0.8);
    for (const id of FAMILY_CUE_IDS) {
      const cue: QuestAudioCue = familyWorldCues[id];
      const processed = readJson(`docs/assets/media/${id}/v001/verification.json`).processed as {
        peak_dbfs: number;
      };
      const peak = processed.peak_dbfs + 20 * Math.log10(cue.gain) + masterDb;
      if (cue.loop) {
        expect(peak, `${id}: loop peak at the 0.8 master`).toBeGreaterThanOrEqual(-17);
        expect(peak, `${id}: loop peak at the 0.8 master`).toBeLessThanOrEqual(-15);
      } else {
        expect(peak, `${id}: peak at the 0.8 master`).toBeGreaterThanOrEqual(-12.5);
        expect(peak, `${id}: peak at the 0.8 master`).toBeLessThanOrEqual(-9.9);
      }
    }
    // Only the glide wind loops.
    expect(FAMILY_CUE_IDS.filter((id) => familyWorldCues[id].loop)).toEqual(["glide-wind"]);
  });

  it("layers the poof under the defeat chime it accompanies", () => {
    const peakAtMaster = (id: string, gain: number) => {
      const processed = readJson(`docs/assets/media/${id}/v001/verification.json`).processed as {
        peak_dbfs: number;
      };
      return processed.peak_dbfs + 20 * Math.log10(gain * 0.8);
    };
    const defeat = gameplayFeedback.defeat;
    const chime = peakAtMaster(defeat.cueId, playtestCues[defeat.cueId].gain * defeat.options.gain);
    const poof = peakAtMaster("enemy-poof", familyWorldCues["enemy-poof"].gain * POOF_UNDER_DEFEAT.gain!);
    expect(poof).toBeLessThan(chime);
  });
});

describe("gameplay event sounds", () => {
  const enemy = "level-1-ordinary-a";

  it("keeps every older-route event on its exact playtest variant", () => {
    const cases: Array<[GameFeedbackEvent, readonly FeedbackSound[]]> = [
      [{ type: "hit", encounterId: enemy, kind: "primary" }, [{ kind: "feedback", id: "impact" }]],
      [{ type: "hit", encounterId: enemy, kind: "secondary" }, [{ kind: "feedback", id: "impact" }]],
      [{ type: "defeat", encounterId: enemy, boss: false }, [{ kind: "feedback", id: "defeat" }]],
      [{ type: "defeat", encounterId: enemy, boss: true }, [{ kind: "feedback", id: "defeat" }]],
      [{ type: "ticket" }, [{ kind: "feedback", id: "ticket" }]],
      [{ type: "token", streak: 0 }, [{ kind: "feedback", id: "token", pitch: 1 }]],
      [{ type: "token", streak: 2 }, [{ kind: "feedback", id: "token", pitch: 1.08 }]],
      [{ type: "token", streak: 40 }, [{ kind: "feedback", id: "token", pitch: 1.2 }]],
      [{ type: "hurt" }, []],
    ];
    for (const [event, expected] of cases) expect(feedbackSounds(event), event.type).toEqual(expected);
  });

  it("plays the family world cues for the new pieces, moves and encounters", () => {
    const cases: Array<[GameFeedbackEvent, readonly FeedbackSound[]]> = [
      [{ type: "bounce" }, [{ kind: "cue", id: "bounce-pad-boing" }]],
      [{ type: "lift-stop", platformId: "lift" }, [{ kind: "cue", id: "lift-arrival-chime" }]],
      [{ type: "crumble", platformId: "crumble" }, [{ kind: "cue", id: "crumble-crack" }]],
      [{ type: "double-jump" }, [{ kind: "cue", id: "double-jump-whoosh" }]],
      [{ type: "glide", active: true }, [{ kind: "loop", id: "glide-wind", active: true }]],
      [{ type: "glide", active: false }, [{ kind: "loop", id: "glide-wind", active: false }]],
      [{ type: "ticket", theme: "clubhouse" }, [{ kind: "cue", id: "golden-ticket-sparkle" }]],
      [{ type: "ticket", theme: "casita" }, [{ kind: "cue", id: "golden-ticket-sparkle" }]],
      // A family world's casino chapter keeps the casino's own golden ticket.
      [{ type: "ticket", theme: "casino" }, [{ kind: "feedback", id: "ticket" }]],
      [
        { type: "windup", encounterId: "level-2-boss", assetId: "honk-bus" },
        [{ kind: "cue", id: "honk-bus-honk" }],
      ],
      [
        { type: "defeat", encounterId: enemy, boss: false, familyWorld: true },
        [
          { kind: "feedback", id: "defeat" },
          { kind: "cue", id: "enemy-poof", options: POOF_UNDER_DEFEAT },
        ],
      ],
      [
        { type: "defeat", encounterId: "level-2-boss", boss: true, familyWorld: true },
        [
          { kind: "feedback", id: "defeat" },
          { kind: "cue", id: "enemy-poof", options: POOF_UNDER_DEFEAT },
        ],
      ],
    ];
    for (const [event, expected] of cases) expect(feedbackSounds(event), JSON.stringify(event)).toEqual(expected);
  });

  it("keys attack sounds by rendered catalog model and stays silent for the rest", () => {
    expect(enemyAttackSounds).toEqual({ "honk-bus": "honk-bus-honk" });
    const catalogModels = new Set(ALL_PARODY_CANDIDATES.map((entry) => entry.assetId));
    for (const [assetId, cueId] of Object.entries(enemyAttackSounds)) {
      expect(catalogModels.has(assetId), `${assetId}: a catalog model`).toBe(true);
      expect(questCues[cueId].loop).toBe(false);
    }
    for (const assetId of ["clubhouse-bully-cat", "mister-hiss", "constructor", "toString", ""])
      expect(feedbackSounds({ type: "windup", encounterId: enemy, assetId }), assetId).toEqual([]);
  });

  it("references only registered cues, loops only the loop and reaches every family cue", () => {
    const events: GameFeedbackEvent[] = [
      { type: "hit", encounterId: enemy, kind: "primary" },
      { type: "defeat", encounterId: enemy, boss: false, familyWorld: true },
      { type: "token", streak: 1 },
      { type: "ticket", theme: "harbor" },
      { type: "ticket" },
      { type: "bounce" },
      { type: "hurt" },
      { type: "double-jump" },
      { type: "crumble", platformId: "c" },
      { type: "lift-stop", platformId: "l" },
      { type: "glide", active: true },
      ...Object.keys(enemyAttackSounds).map(
        (assetId): GameFeedbackEvent => ({ type: "windup", encounterId: enemy, assetId }),
      ),
    ];
    const reached = new Set<string>();
    for (const call of events.flatMap((event) => feedbackSounds(event))) {
      if (call.kind === "feedback") {
        expect(gameplayFeedback[call.id]).toBeDefined();
        reached.add(gameplayFeedback[call.id].cueId);
      } else {
        const cue: QuestAudioCue = questCues[call.id];
        expect(cue.loop, call.id).toBe(call.kind === "loop");
        reached.add(call.id);
      }
    }
    for (const id of FAMILY_CUE_IDS) expect(reached.has(id), `${id}: reachable`).toBe(true);
  });

  it("plays through the audio owner with the argument shapes the playtest used", () => {
    const sound = {
      feedback: vi.fn(async () => true),
      cue: vi.fn(async () => true),
      loop: vi.fn(async () => true),
    };
    playFeedbackSounds(sound, { type: "hit", encounterId: enemy, kind: "primary" });
    playFeedbackSounds(sound, { type: "token", streak: 2 });
    playFeedbackSounds(sound, { type: "defeat", encounterId: enemy, boss: false, familyWorld: true });
    playFeedbackSounds(sound, { type: "bounce" });
    playFeedbackSounds(sound, { type: "glide", active: true });
    playFeedbackSounds(sound, { type: "glide", active: false });
    expect(sound.feedback.mock.calls).toEqual([["impact"], ["token", 1.08], ["defeat"]]);
    expect(sound.cue.mock.calls).toEqual([
      ["enemy-poof", POOF_UNDER_DEFEAT],
      ["bounce-pad-boing"],
    ]);
    expect(sound.loop.mock.calls).toEqual([
      ["glide-wind", true],
      ["glide-wind", false],
    ]);
  });

  it("plays the jump cue only for jumps that did not already sound as a launch", () => {
    // Older routes report no launches: any new jump sounds, as before.
    expect(plainJumpSinceLastStatus(0, 0)).toBe(false);
    expect(plainJumpSinceLastStatus(1, 0)).toBe(true);
    expect(plainJumpSinceLastStatus(3, 0)).toBe(true);
    // A bounce or falling double jump already played its own cue.
    expect(plainJumpSinceLastStatus(1, 1)).toBe(false);
    expect(plainJumpSinceLastStatus(2, 1)).toBe(true);
  });
});
