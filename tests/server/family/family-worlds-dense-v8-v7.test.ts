import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildFamilyWorldAV8, familyWorldAV8Commands, FAMILY_WORLD_A_V8_COMMANDS_URL, FAMILY_WORLD_A_V8_PROJECT_URL } from "../../../scripts/levels/build-family-world-a-v8.js";
import { buildFamilyWorldBV7, familyWorldBV7Commands, FAMILY_WORLD_B_V7_COMMANDS_URL, FAMILY_WORLD_B_V7_PROJECT_URL } from "../../../scripts/levels/build-family-world-b-v7.js";
import { validateAuthoredLevelDocument } from "../../../src/shared/authored-level.js";
import { createInitialAdventureState } from "../../../src/shared/adventure.js";
import { applyLevelEditorCommand, serializeLevelEditorProject, validateLevelEditorProject } from "../../../src/shared/editor-project.js";
import { prepareEditorWorld } from "../../../src/server/editor-preview.js";
import { FamilyTemplateRegistry } from "../../../src/server/family/templates.js";
import { parseStoredAdventure } from "../../../src/server/adventure-schema.js";

const worlds = [
  { id: "family-world-a", version: "v8", build: buildFamilyWorldAV8, commands: familyWorldAV8Commands, commandsUrl: FAMILY_WORLD_A_V8_COMMANDS_URL, projectUrl: FAMILY_WORLD_A_V8_PROJECT_URL },
  { id: "family-world-b", version: "v7", build: buildFamilyWorldBV7, commands: familyWorldBV7Commands, commandsUrl: FAMILY_WORLD_B_V7_COMMANDS_URL, projectUrl: FAMILY_WORLD_B_V7_PROJECT_URL },
] as const;
const pairSlots = [
  ["ordinary-9", "ordinary-10"], ["ordinary-1", "ordinary-5"],
  ["ordinary-2", "ordinary-6"], ["ordinary-3", "ordinary-7"],
  ["ordinary-4", "ordinary-8"], ["ordinary-11", "ordinary-12"],
] as const;

describe.each(worlds)("$id@$version dense route", (world) => {
  it("replays immutable editor commands and registers the new version", () => {
    const project = world.build();
    expect(readFileSync(world.commandsUrl, "utf8")).toBe(`${JSON.stringify(world.commands(), null, 2)}\n`);
    expect(readFileSync(world.projectUrl, "utf8")).toBe(serializeLevelEditorProject(project));
    expect(validateLevelEditorProject(project)).toEqual([]);
    expect(new FamilyTemplateRegistry().require(world.id, world.version).project).toEqual(project);
  });

  it("keeps six reachable paired regions, four optional fights, and near-route planting", () => {
    for (const chapter of world.build().chapters) {
      const level = chapter.level;
      expect(chapter.bossPrerequisiteDefeats).toBe(4);
      expect(Object.keys(chapter.encounterSlots).filter((slot) => slot.startsWith("ordinary-"))).toHaveLength(12);
      expect(Object.keys(chapter.encounterSlots).filter((slot) => slot.startsWith("bonus-"))).toHaveLength(4);
      expect(validateAuthoredLevelDocument(level)).toEqual([]);
      expect(level.decor?.filter((entry) => entry.kitPropId === "storybook-planter-island")).toHaveLength(4);
      expect(level.decor?.filter((entry) => entry.kitPropId === "storybook-flower-bed").length).toBeGreaterThanOrEqual(6);
      const pieces = new Map(level.pieces.map((piece) => [piece.id, piece]));
      let routeDistance = 0;
      const distanceByPlatform = new Map<string, number>();
      level.mainPath.forEach((id, index) => {
        const piece = pieces.get(id)!;
        if (index) {
          const previous = pieces.get(level.mainPath[index - 1]!)!;
          if (!("center" in piece) || !("center" in previous)) throw new Error("Route surface has no center");
          routeDistance += Math.hypot(piece.center.x - previous.center.x, piece.center.z - previous.center.z);
        }
        distanceByPlatform.set(id, routeDistance);
      });
      const regions = pairSlots.map(([first, second]) => {
        const a = level.anchors.encounters[first]!;
        const b = level.anchors.encounters[second]!;
        expect(a.platformId).toBe(b.platformId);
        expect(pieces.get(a.platformId)?.type).toBe("platform");
        const separation = Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
        expect(separation).toBeGreaterThanOrEqual(2.2);
        expect(separation).toBeLessThanOrEqual(8.1);
        return distanceByPlatform.get(a.platformId)!;
      }).sort((a, b) => a - b);
      expect(regions[0]).toBeLessThanOrEqual(37.5);
      for (let index = 1; index < regions.length; index++)
        expect(regions[index]! - regions[index - 1]!).toBeLessThanOrEqual(51);
    }
  });
});

it("accepts every partial five-to-eleven core state in editor preview", () => {
  let current = buildFamilyWorldAV8();
  for (let count = 11; count >= 5; count--) {
    const result = applyLevelEditorCommand(current, {
      type: "encounter.core.remove", chapterId: current.chapters[0]!.chapterId,
      slot: `ordinary-${count + 1}` as "ordinary-5",
    });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    if (!result.ok) break;
    current = result.project as typeof current;
    expect(validateLevelEditorProject(current)).toEqual([]);
    const plan = prepareEditorWorld(current, "a".repeat(64)).plan;
    expect(plan.levels[0]!.encounters.filter((entry) => entry.role === "ordinary" && !entry.id.includes("bonus-"))).toHaveLength(count);
    expect(parseStoredAdventure(plan, createInitialAdventureState(plan), { allowEditorPreviewPlan: true }).plan).toEqual(plan);
  }
});

it("only low planting can occupy a static deck corner", () => {
  const level = structuredClone(buildFamilyWorldAV8().chapters[0]!.level);
  expect(validateAuthoredLevelDocument(level)).toEqual([]);
  const bed = level.decor!.find((entry) => entry.id === "dense-bed-1")!;
  const enemy = level.anchors.encounters["ordinary-9"]!;
  const atFight = structuredClone(level);
  (atFight.decor as unknown as Array<{ id: string; position: typeof bed.position }>).find((entry) => entry.id === bed.id)!.position = enemy.position;
  expect(validateAuthoredLevelDocument(atFight).map((issue) => issue.code)).toContain("decor.clearance");
  const tall = structuredClone(level);
  (tall.decor as unknown as Array<{ id: string; kitPropId: string }>).find((entry) => entry.id === bed.id)!.kitPropId = "slim-cypress";
  expect(validateAuthoredLevelDocument(tall).map((issue) => issue.code)).toContain("decor.clearance");
});
