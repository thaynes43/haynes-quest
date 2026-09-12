/**
 * WO079 adversarial probes: authored checkpoint/retry behaviour and the
 * rendered scenery budget the new layouts drive.
 */
import { describe, expect, it } from "vitest";
import garden from "../../../src/shared/levels/garden-playground-v1.json";
import party from "../../../src/shared/levels/besties-playground-v1.json";
import {
  resolveAuthoredLevelDocument,
  type AuthoredLevelDocument,
} from "../../../src/shared/authored-level";
import { createObbyState, stepObby } from "../../../src/game/obby";
import { grassPlacements } from "../../../src/game/foliage";
import { createObbyCourse } from "../../../src/game/obby-layout";
import { authoredLevelLayout } from "../../../src/game/authored-layout";
import { checkpointForSave } from "../../../src/game/level";
import {
  createInitialAdventureState,
  createRouteMemoryPlan,
  toAdventureView,
  type AdventureMemory,
  type AdventurePlanV3,
} from "../../../src/shared/adventure";
import type { ActiveLevelView, SaveView } from "../../../src/shared/contracts";

const MEMORIES: AdventureMemory[] = [
  { id: "memory-age-0", date: "2020-07-01", ageYears: 0 },
  { id: "memory-age-2", date: "2022-01-01", ageYears: 2 },
  { id: "memory-age-4", date: "2024-01-01", ageYears: 4 },
  { id: "memory-age-5", date: "2025-01-01", ageYears: 5 },
  { id: "memory-age-6", date: "2026-01-01", ageYears: 6 },
  { id: "memory-age-7", date: "2027-01-01", ageYears: 7 },
];

const DOCS: Array<[string, AuthoredLevelDocument]> = [
  ["garden-playground-v1", garden as unknown as AuthoredLevelDocument],
  ["besties-playground-v1", party as unknown as AuthoredLevelDocument],
];

function saveFor(plan: AdventurePlanV3, levelIndex: number, defeated = 0): SaveView {
  const base = createInitialAdventureState(plan);
  const level = plan.levels[levelIndex]!;
  const encounters = { ...base.encounters };
  for (const encounter of level.encounters.slice(0, defeated)) {
    encounters[encounter.id] = {
      ...encounters[encounter.id]!,
      hp: 0,
      defeated: true,
    };
  }
  const state = { ...base, activeLevelIndex: levelIndex, encounters };
  const adventure = toAdventureView(plan, state, Date.now());
  return {
    id: "save-probe",
    title: "probe",
    subject: { id: "fixture", label: "Fixture" },
    birthDate: "2020-01-01",
    memories: MEMORIES.map((memory) => ({
      ...memory,
      label: memory.id,
      state: "released" as const,
    })),
    recoveredIds: [],
    ageYears: 0,
    abilities: ["move", "interact", "jump"],
    appearance: { stage: "infant" },
    completed: false,
    format: "era-combat-v2",
    adventure,
    revision: 0,
  } as unknown as SaveView;
}

describe("WO079 probe: authored checkpoint arming and reload fallback", () => {
  for (const [id, document] of DOCS) {
    it(`re-arms every ${id} checkpoint within a frame of respawning on it`, () => {
      const { course } = resolveAuthoredLevelDocument(document);
      const armed: Array<[string, number | null]> = [];
      for (const checkpoint of course.checkpoints) {
        const state = createObbyState({ ...checkpoint.position });
        state.grounded = true;
        let frames: number | null = null;
        for (let frame = 1; frame <= 20 && frames === null; frame++) {
          stepObby(state, { moveX: 0, moveY: 0 }, course, {
            deltaSeconds: 1 / 60,
            timeSeconds: frame / 60,
            cameraYaw: 0,
            canJump: true,
            jumpPressed: false,
            radius: 0.25,
            height: 0.88,
          });
          if (state.checkpointId === checkpoint.id) frames = frame;
        }
        armed.push([checkpoint.id, frames]);
      }
       
      console.log(JSON.stringify({ route: id, armedAfterFrames: armed }));
      expect(armed.every(([, frames]) => frames !== null)).toBe(true);
    });
  }

  it("reload fallback only advances with defeated encounters, not with obstacle progress", () => {
    const plan = createRouteMemoryPlan("2020-01-01", MEMORIES);
    const rows: Array<[number, number]> = [];
    for (let defeated = 0; defeated <= 5; defeated++) {
      const save = saveFor(plan, 0, defeated);
      const level = authoredLevelLayout(
        save,
        save.adventure!.activeLevel as ActiveLevelView,
      )!;
      rows.push([defeated, checkpointForSave(save, level).z]);
    }
     
    console.log(JSON.stringify({ route: "garden", defeatedToRespawnZ: rows }));
    expect(rows).toEqual([
      [0, 1],
      [1, -16.8],
      [2, -39.8],
      [3, -59],
      [4, -78.3],
      [5, -90.5],
    ]);
    // Reaching the last checkpoint with nothing defeated still reloads at spawn,
    // 91.5 m back along the route.
    expect(rows[0]![1] - rows[5]![1]).toBeCloseTo(91.5, 3);
  });
});

describe("WO079 probe: authored scenery budget", () => {
  it("records the grass instance count each authored course produces", () => {
    const rows: Array<Record<string, number | string>> = [];
    for (const [id, document] of DOCS) {
      const { course, anchors } = resolveAuthoredLevelDocument(document);
      const clearZones = [
        ...Object.values(anchors.encounters).map((entry) => entry.arena),
        ...[
          ...Object.values(anchors.memories),
          ...Object.values(anchors.pickups),
          ...Object.values(anchors.friendlies),
        ].map(({ position }) => ({
          minX: position.x - 1,
          maxX: position.x + 1,
          minZ: position.z - 1,
          maxZ: position.z + 1,
        })),
      ];
      const raw = grassPlacements(course, {
        clearZones,
        maxInstances: Number.MAX_SAFE_INTEGER,
      });
      const capped = grassPlacements(course, { clearZones, maxInstances: 4400 });
      rows.push({
        route: id,
        staticPlatforms: course.platforms.filter((entry) => !entry.motion).length,
        rawCandidates: raw.length,
        rendered: capped.length,
        flowers: Math.ceil(capped.length / 13),
      });
    }
    const legacy = grassPlacements(createObbyCourse("gentle-jump-v1"));
    rows.push({
      route: "gentle-jump-v1 (archived)",
      staticPlatforms: createObbyCourse("gentle-jump-v1").platforms.filter(
        (entry) => !entry.motion,
      ).length,
      rawCandidates: legacy.length,
      rendered: legacy.length,
      flowers: Math.ceil(legacy.length / 13),
    });
     
    console.log(JSON.stringify(rows));
    expect(rows.every((row) => (row.rendered as number) <= 4400)).toBe(true);
  });
});
