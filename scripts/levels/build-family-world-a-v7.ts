/** World A v7: two more ordinary fights per chapter, with two wins opening each boss. */
import { writeFile } from "node:fs/promises";
import type { LevelEditorCommand, LevelEditorProjectV2 } from "../../src/shared/editor-project.js";
import { buildFamilyWorldAV5, familyWorldAV5Commands } from "./build-family-world-a-v5.js";
import { buildEncounterRevision, encounterRevisionCommands, serializeEncounterRevision, type BonusPlacement } from "./family/encounter-revision.js";
import { chapterCommands } from "./lib/growth-kit.js";

export const FAMILY_WORLD_A_V7_PLACEMENTS: readonly BonusPlacement[] = [
  { chapterId: "family-a1", slot: "bonus-1", castFrom: "ordinary-1", platformId: "picnic-plateau", checkpointId: "cp-picnic", position: { x: 3, y: 3.6, z: -84.5 }, arena: { minX: 1.5, maxX: 4.5, minZ: -86, maxZ: -83 } },
  { chapterId: "family-a1", slot: "bonus-2", castFrom: "ordinary-3", platformId: "clubhouse-porch", checkpointId: "cp-clubhouse", position: { x: -18.2, y: 8.8, z: -142.3 }, arena: { minX: -19.5, maxX: -17, minZ: -143.8, maxZ: -141.5 } },
  { chapterId: "family-a2", slot: "bonus-2", castFrom: "ordinary-2", platformId: "tower-plaza", checkpointId: "plaza-safe", position: { x: -39, y: 9.9, z: -129 }, arena: { minX: -41, maxX: -37, minZ: -130, maxZ: -127 } },
  { chapterId: "family-a3", slot: "bonus-2", castFrom: "ordinary-1", platformId: "billboard-balcony", checkpointId: "cp-billboard", position: { x: -56.5, y: 9.3, z: -64 }, arena: { minX: -58, maxX: -55, minZ: -65.3, maxZ: -62.5 } },
  { chapterId: "family-a4", slot: "bonus-2", castFrom: "ordinary-3", platformId: "backstage-turn", checkpointId: "backstage-safe", position: { x: -33, y: 7.7, z: -80 }, arena: { minX: -35, maxX: -31.2, minZ: -81.5, maxZ: -78.5 } },
];

function standingDeckPrelude(base: LevelEditorProjectV2): LevelEditorCommand[] {
  const a1 = base.chapters.find((chapter) => chapter.chapterId === "family-a1")!;
  const a3 = base.chapters.find((chapter) => chapter.chapterId === "family-a3")!;
  const picnic = a1.level.pieces.find((piece) => piece.id === "picnic-plateau");
  const billboard = a3.level.pieces.find((piece) => piece.id === "billboard-balcony");
  const billboardEdgeProps = (a3.level.decor ?? []).filter((entry) => entry.id.includes("billboard-balcony-nx"));
  if (picnic?.type !== "platform" || billboard?.type !== "platform")
    throw new Error("The A1 picnic or A3 billboard deck changed shape");
  return [
    chapterCommands("family-a1").update({ ...picnic, center: { ...picnic.center, x: -1.4 }, size: { ...picnic.size, x: 16 } }),
    chapterCommands("family-a3").update({ ...billboard, center: { ...billboard.center, x: -53 }, size: { ...billboard.size, x: 14 } }),
    ...billboardEdgeProps.flatMap((entry) => [
      chapterCommands("family-a3").removeDecor(entry.id),
      chapterCommands("family-a3").addDecor({ ...entry, position: { ...entry.position, x: entry.position.x - 2 } }),
    ]),
  ];
}

export function familyWorldAV7Commands() {
  const base = buildFamilyWorldAV5();
  return [familyWorldAV5Commands(), encounterRevisionCommands(base, FAMILY_WORLD_A_V7_PLACEMENTS, standingDeckPrelude(base))];
}

export function buildFamilyWorldAV7() {
  const base = buildFamilyWorldAV5();
  return buildEncounterRevision(base, FAMILY_WORLD_A_V7_PLACEMENTS, standingDeckPrelude(base));
}

export const FAMILY_WORLD_A_V7_COMMANDS_URL = new URL("./family-world-a-v7.commands.json", import.meta.url);
export const FAMILY_WORLD_A_V7_PROJECT_URL = new URL("../../src/shared/levels/family-world-a-v7.json", import.meta.url);

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes("--write")) {
    await writeFile(FAMILY_WORLD_A_V7_COMMANDS_URL, `${JSON.stringify(familyWorldAV7Commands(), null, 2)}\n`);
    await writeFile(FAMILY_WORLD_A_V7_PROJECT_URL, serializeEncounterRevision(buildFamilyWorldAV7()));
    process.stdout.write("Wrote family-world-a v7 commands and project\n");
  } else process.stdout.write(`${JSON.stringify(familyWorldAV7Commands(), null, 2)}\n`);
}
