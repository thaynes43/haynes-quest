/** World B v6: six ordinary fights per chapter, with two wins opening each boss. */
import { writeFile } from "node:fs/promises";
import { buildFamilyWorldBV5, familyWorldBV5Commands } from "./build-family-world-b-v5.js";
import type { LevelEditorCommand, LevelEditorProjectV2 } from "../../src/shared/editor-project.js";
import { chapterCommands } from "./lib/growth-kit.js";
import { buildEncounterRevision, encounterRevisionCommands, serializeEncounterRevision, type BonusPlacement } from "./family/encounter-revision.js";

export const FAMILY_WORLD_B_V6_PLACEMENTS: readonly BonusPlacement[] = [
  { chapterId: "family-b1", slot: "bonus-1", castFrom: "ordinary-1", platformId: "book-shelf", checkpointId: "cp-shelf", position: { x: -23, y: 2.7, z: -90.5 }, arena: { minX: -25, maxX: -21, minZ: -92.3, maxZ: -88.7 } },
  { chapterId: "family-b1", slot: "bonus-2", castFrom: "ordinary-3", platformId: "train-station", checkpointId: "cp-station", position: { x: 1, y: 2.7, z: -90 }, arena: { minX: -1, maxX: 3, minZ: -92, maxZ: -88 } },
  { chapterId: "family-b2", slot: "bonus-1", castFrom: "ordinary-2", platformId: "veranda-north", checkpointId: "cp-veranda-north", position: { x: 31, y: 2.7, z: -48.5 }, arena: { minX: 29, maxX: 33, minZ: -49.4, maxZ: -47.6 } },
  { chapterId: "family-b2", slot: "bonus-2", castFrom: "ordinary-3", platformId: "roof-walk", checkpointId: "cp-roof-walk", position: { x: 28.35, y: 6.5, z: -61.5 }, arena: { minX: 26.5, maxX: 30, minZ: -63, maxZ: -60 } },
  { chapterId: "family-b3", slot: "bonus-1", castFrom: "ordinary-4", platformId: "turnstile-deck", checkpointId: "turnstile-safe", position: { x: 46.1, y: 5.6, z: -89.2 }, arena: { minX: 45, maxX: 47.2, minZ: -90.5, maxZ: -87.9 } },
  { chapterId: "family-b3", slot: "bonus-2", castFrom: "ordinary-4", platformId: "sky-bleachers", checkpointId: "sky-bleachers-safe", position: { x: 71.5, y: 6.8, z: -89.2 }, arena: { minX: 70, maxX: 72.65, minZ: -91, maxZ: -87.5 } },
];

/** Extend two clear deck sides so the sweeper/route strips remain outside each new arena. */
function standingDeckPrelude(base: LevelEditorProjectV2): LevelEditorCommand[] {
  const b2 = base.chapters.find((chapter) => chapter.chapterId === "family-b2")!;
  const b3 = base.chapters.find((chapter) => chapter.chapterId === "family-b3")!;
  const roof = b2.level.pieces.find((piece) => piece.id === "roof-walk");
  const turnstile = b3.level.pieces.find((piece) => piece.id === "turnstile-deck");
  const bleachers = b3.level.pieces.find((piece) => piece.id === "sky-bleachers");
  const bleacherCheckpoint = b3.level.pieces.find((piece) => piece.id === "sky-bleachers-safe");
  const candles = (b2.level.decor ?? []).filter((entry) => entry.id.startsWith("roof-walk-candle-"));
  if (roof?.type !== "platform" || turnstile?.type !== "platform" || bleachers?.type !== "platform" || bleacherCheckpoint?.type !== "checkpoint")
    throw new Error("The B2 roof or B3 turnstile deck changed shape");
  return [
    chapterCommands("family-b2").update({ ...roof, center: { ...roof.center, z: -59.45 }, size: { ...roof.size, z: 12 } }),
    ...candles.flatMap((candle) => [
      chapterCommands("family-b2").removeDecor(candle.id),
      chapterCommands("family-b2").addDecor({ ...candle, position: { ...candle.position, z: -66.5 } }),
    ]),
    chapterCommands("family-b3").update({ ...turnstile, center: { ...turnstile.center, x: 43.3 }, size: { ...turnstile.size, x: 13 } }),
    chapterCommands("family-b3").add({ type: "checkpoint", id: "turnstile-safe", platformId: "turnstile-deck", position: { x: 38, y: 5.6, z: -89.2 }, activation: { type: "platform" } }),
    chapterCommands("family-b3").update({ ...bleachers, size: { ...bleachers.size, z: 10 } }),
    chapterCommands("family-b3").update({ ...bleacherCheckpoint, position: { ...bleacherCheckpoint.position, x: 68.2 } }),
  ];
}

export function familyWorldBV6Commands() {
  const base = buildFamilyWorldBV5();
  return [familyWorldBV5Commands(), encounterRevisionCommands(base, FAMILY_WORLD_B_V6_PLACEMENTS, standingDeckPrelude(base))];
}

export function buildFamilyWorldBV6() {
  const base = buildFamilyWorldBV5();
  return buildEncounterRevision(base, FAMILY_WORLD_B_V6_PLACEMENTS, standingDeckPrelude(base));
}

export const FAMILY_WORLD_B_V6_COMMANDS_URL = new URL("./family-world-b-v6.commands.json", import.meta.url);
export const FAMILY_WORLD_B_V6_PROJECT_URL = new URL("../../src/shared/levels/family-world-b-v6.json", import.meta.url);

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes("--write")) {
    await writeFile(FAMILY_WORLD_B_V6_COMMANDS_URL, `${JSON.stringify(familyWorldBV6Commands(), null, 2)}\n`);
    await writeFile(FAMILY_WORLD_B_V6_PROJECT_URL, serializeEncounterRevision(buildFamilyWorldBV6()));
    process.stdout.write("Wrote family-world-b v6 commands and project\n");
  } else process.stdout.write(`${JSON.stringify(familyWorldBV6Commands(), null, 2)}\n`);
}
