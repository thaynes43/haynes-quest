import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildFamilyWorldAV8, familyWorldAV8Commands,
  FAMILY_WORLD_A_V8_COMMANDS_URL, FAMILY_WORLD_A_V8_PROJECT_URL,
} from "../../../scripts/levels/build-family-world-a-v8.js";
import {
  buildFamilyWorldAV9, familyWorldAV9Commands,
  FAMILY_WORLD_A_V9_COMMANDS_URL, FAMILY_WORLD_A_V9_PROJECT_URL,
} from "../../../scripts/levels/build-family-world-a-v9.js";
import {
  buildFamilyWorldBV7, familyWorldBV7Commands,
  FAMILY_WORLD_B_V7_COMMANDS_URL, FAMILY_WORLD_B_V7_PROJECT_URL,
} from "../../../scripts/levels/build-family-world-b-v7.js";
import {
  buildFamilyWorldBV8, familyWorldBV8Commands,
  FAMILY_WORLD_B_V8_COMMANDS_URL, FAMILY_WORLD_B_V8_PROJECT_URL,
} from "../../../scripts/levels/build-family-world-b-v8.js";
import { validateAuthoredLevelDocument } from "../../../src/shared/authored-level.js";
import { serializeLevelEditorProject, validateLevelEditorProject } from "../../../src/shared/editor-project.js";
import { FamilyTemplateRegistry } from "../../../src/server/family/templates.js";

const PAIRS = [
  ["ordinary-9", "ordinary-10"], ["ordinary-1", "ordinary-5"],
  ["ordinary-2", "ordinary-6"], ["ordinary-3", "ordinary-7"],
  ["ordinary-4", "ordinary-8"], ["ordinary-11", "ordinary-12"],
] as const;

const worlds = [
  {
    id: "family-world-a", version: "v9", previousVersion: "v8",
    build: buildFamilyWorldAV9, previous: buildFamilyWorldAV8,
    commands: familyWorldAV9Commands, previousCommands: familyWorldAV8Commands,
    commandsUrl: FAMILY_WORLD_A_V9_COMMANDS_URL, projectUrl: FAMILY_WORLD_A_V9_PROJECT_URL,
    previousCommandsUrl: FAMILY_WORLD_A_V8_COMMANDS_URL, previousProjectUrl: FAMILY_WORLD_A_V8_PROJECT_URL,
    previousCommandsHash: "7569776e1eef46c8b6dd8f6321fce880273357ab2433c140ec8a631c5b45377f",
    previousProjectHash: "5279b6e3c92b8a8ebf590414094fc6014523d61428e6b8a7b9017a309794f8b0",
  },
  {
    id: "family-world-b", version: "v8", previousVersion: "v7",
    build: buildFamilyWorldBV8, previous: buildFamilyWorldBV7,
    commands: familyWorldBV8Commands, previousCommands: familyWorldBV7Commands,
    commandsUrl: FAMILY_WORLD_B_V8_COMMANDS_URL, projectUrl: FAMILY_WORLD_B_V8_PROJECT_URL,
    previousCommandsUrl: FAMILY_WORLD_B_V7_COMMANDS_URL, previousProjectUrl: FAMILY_WORLD_B_V7_PROJECT_URL,
    previousCommandsHash: "1a4dfc06a36b6f26ac9b03f061c39c6ba1e786bfdcd6a419e76336e5a7ca8cc1",
    previousProjectHash: "7bd4cee88eaf678b098abcd2c39a8d198065405d93aebfaa7b24f051ae6d8abf",
  },
] as const;

function sha256(url: URL): string {
  return createHash("sha256").update(readFileSync(url)).digest("hex");
}

function routeStations(level: ReturnType<typeof buildFamilyWorldAV9>["chapters"][number]["level"]) {
  const pieces = new Map(level.pieces.map((piece) => [piece.id, piece]));
  const distanceById = new Map<string, number>();
  let distance = 0;
  level.mainPath.forEach((id, index) => {
    const piece = pieces.get(id)!;
    if (index) {
      const previous = pieces.get(level.mainPath[index - 1]!)!;
      if (!("center" in piece) || !("center" in previous)) throw new Error("Route piece without centre");
      distance += Math.hypot(piece.center.x - previous.center.x, piece.center.z - previous.center.z);
    }
    distanceById.set(id, distance);
  });
  return PAIRS.map(([a, b]) => {
    const first = level.anchors.encounters[a]!;
    const second = level.anchors.encounters[b]!;
    expect(first.platformId).toBe(second.platformId);
    expect(pieces.get(first.platformId)?.type).toBe("platform");
    const separation = Math.hypot(
      first.position.x - second.position.x, first.position.z - second.position.z,
    );
    expect(separation).toBeGreaterThanOrEqual(2.2);
    expect(separation).toBeLessThanOrEqual(8.1);
    return distanceById.get(first.platformId)!;
  }).sort((a, b) => a - b);
}

function role(chapterId: string, assetId: string): "melee" | "charge" | "bolt" | "agile" {
  if (chapterId === "family-a4")
    return assetId === "radio-host-showman" ? "bolt" : "melee";
  if (["gadget-hammer-hopper", "broccoli-bouncer"].includes(assetId)) return "charge";
  if (["lab-robot-sentry", "lab-robot", "demon-idol-drummer"].includes(assetId)) return "bolt";
  if (["mischief-kitten-skater", "bin-chicken-flower-thief"].includes(assetId)) return "agile";
  return "melee";
}

describe.each(worlds)("$id@$version encounter pacing", (world) => {
  const previous = world.previous();
  const project = world.build();

  it("registers replayable new commands while preserving exact earlier template bytes", () => {
    expect(sha256(world.previousCommandsUrl)).toBe(world.previousCommandsHash);
    expect(sha256(world.previousProjectUrl)).toBe(world.previousProjectHash);
    expect(readFileSync(world.previousCommandsUrl, "utf8")).toBe(`${JSON.stringify(world.previousCommands(), null, 2)}\n`);
    expect(readFileSync(world.previousProjectUrl, "utf8")).toBe(serializeLevelEditorProject(previous));
    expect(readFileSync(world.commandsUrl, "utf8")).toBe(`${JSON.stringify(world.commands(), null, 2)}\n`);
    expect(readFileSync(world.projectUrl, "utf8")).toBe(serializeLevelEditorProject(project));
    expect(validateLevelEditorProject(project)).toEqual([]);
    const registry = new FamilyTemplateRegistry();
    expect(registry.require(world.id, world.version).project).toEqual(project);
    expect(registry.require(world.id, world.previousVersion).project).toEqual(previous);
  });

  it("keeps geometry, memory slots, equipment, and boss progression while varying safe fights", () => {
    for (const chapter of project.chapters) {
      const old = previous.chapters.find((entry) => entry.chapterId === chapter.chapterId)!;
      const level = chapter.level;
      expect(validateAuthoredLevelDocument(level)).toEqual([]);
      expect(level.pieces).toEqual(old.level.pieces);
      expect(level.connections).toEqual(old.level.connections);
      expect(level.mainPath).toEqual(old.level.mainPath);
      expect(level.branches).toEqual(old.level.branches);
      expect(level.decor).toEqual(old.level.decor);
      expect(level.anchors.pickups).toEqual(old.level.anchors.pickups);
      expect(level.anchors.memories).toEqual(old.level.anchors.memories);
      expect(chapter.previewMemories).toEqual(old.previewMemories);
      expect(chapter.bossPrerequisiteDefeats).toBe(4);
      expect(Object.keys(chapter.encounterSlots).filter((slot) => slot.startsWith("ordinary-"))).toHaveLength(12);
      expect(Object.keys(chapter.encounterSlots).filter((slot) => slot.startsWith("bonus-"))).toHaveLength(4);
      const stations = routeStations(level);
      const first = Math.min(...stations);
      let toTool = 0;
      const pieces = new Map(level.pieces.map((piece) => [piece.id, piece]));
      for (let index = 1; index <= level.mainPath.indexOf(level.anchors.pickups["guard-tool"].platformId); index++) {
        const a = pieces.get(level.mainPath[index - 1]!)!;
        const b = pieces.get(level.mainPath[index]!)!;
        if (!("center" in a) || !("center" in b)) throw new Error("Route piece without centre");
        toTool += Math.hypot(a.center.x - b.center.x, a.center.z - b.center.z);
      }
      expect(toTool).toBeLessThanOrEqual(first);
      const firstPair = PAIRS
        .map(([a, b]) => ({ a, b, index: level.mainPath.indexOf(level.anchors.encounters[a]!.platformId) }))
        .sort((a, b) => a.index - b.index)[0]!;
      const tool = level.anchors.pickups["guard-tool"].position;
      const toolClearance = Math.min(...[firstPair.a, firstPair.b].map((slot) => {
        const foe = level.anchors.encounters[slot]!.position;
        return Math.hypot(tool.x - foe.x, tool.z - foe.z);
      }));
      expect(toolClearance).toBeGreaterThanOrEqual(5);
      for (const [a, b] of PAIRS) {
        const firstCast = chapter.encounterSlots[a];
        const secondCast = chapter.encounterSlots[b];
        expect(firstCast?.source).toBe("catalog");
        expect(secondCast?.source).toBe("catalog");
        if (firstCast?.source !== "catalog" || secondCast?.source !== "catalog") continue;
        expect(firstCast.catalogEntryId).not.toBe(secondCast.catalogEntryId);
        if (chapter.chapterId !== "family-a4") {
          expect(new Set([
            role(chapter.chapterId, firstCast.catalogEntryId),
            role(chapter.chapterId, secondCast.catalogEntryId),
          ])).toContain("melee");
          expect(new Set([
            role(chapter.chapterId, firstCast.catalogEntryId),
            role(chapter.chapterId, secondCast.catalogEntryId),
          ]).size).toBe(2);
        }
      }
    }
  });
});

it("shortens measured open-route encounter intervals without crowding the obby sections", () => {
  const stationByChapter = new Map(
    [...buildFamilyWorldAV9().chapters, ...buildFamilyWorldBV8().chapters]
      .map((chapter) => [chapter.chapterId, routeStations(chapter.level)] as const),
  );
  const maxGap = (stations: number[]) => Math.max(...stations.slice(1).map((value, index) => value - stations[index]!));
  expect(maxGap(stationByChapter.get("family-a1")!)).toBeLessThan(37);
  expect(maxGap(stationByChapter.get("family-a2")!)).toBeLessThan(29);
  expect(maxGap(stationByChapter.get("family-b1")!)).toBeLessThan(44);
  expect(maxGap(stationByChapter.get("family-b2")!)).toBeLessThan(39);
  const stage = stationByChapter.get("family-b3")!;
  expect(stage[1]! - stage[0]!).toBeLessThan(31);
});
