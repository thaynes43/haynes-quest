/** World B v7: six paired main-route fights and four side-route discoveries. */
import { writeFile } from "node:fs/promises";
import { buildFamilyWorldBV6, familyWorldBV6Commands } from "./build-family-world-b-v6.js";
import { buildDenseWorld, denseCatalogUpgrade, denseCatalogUpgradeCommands, denseWorldCommands, serializeDenseWorld, type DenseChapterRevision } from "./family/dense-world-revision.js";

export const FAMILY_WORLD_B_V7_REVISIONS: readonly DenseChapterRevision[] = [
  { chapterId: "family-b1", variantId: "broccoli-bouncer", guardTool: { platformId: "rug-runner", dz: 6 }, relocateRequired: {
    "ordinary-3": { platformId: "book-shelf", castFrom: "ordinary-3", dx: -3 },
    "ordinary-4": { platformId: "music-box", castFrom: "ordinary-4", dx: -3 },
  }, core: [
    { platformId: "play-mat", castFrom: "ordinary-1", dx: 4 },
    { platformId: "snack-table", castFrom: "ordinary-2", dx: -4 },
    { platformId: "book-shelf", castFrom: "ordinary-3", dx: 3 },
    { platformId: "music-box", castFrom: "ordinary-4", dx: 4 },
  ], extraCore: [
    { platformId: "rug-runner", castFrom: "ordinary-1", dz: -2 },
    { platformId: "rug-runner", castFrom: "ordinary-2", dz: -7 },
    { platformId: "toy-piano", castFrom: "ordinary-3", dx: -3 },
    { platformId: "toy-piano", castFrom: "ordinary-4", dx: 3 },
  ], optional: [
    { platformId: "pillow-fort", castFrom: "ordinary-1", dx: -2.3 },
    { platformId: "tower-block-2", castFrom: "ordinary-2", minWidth: 8, minDepth: 8 },
    { platformId: "tower-block-1", castFrom: "ordinary-3", minWidth: 8, minDepth: 8 },
    { platformId: "pillow-fort", castFrom: "ordinary-4", dx: 2.3 },
  ] },
  { chapterId: "family-b2", variantId: "bin-chicken-flower-thief", guardTool: { platformId: "garden-path" },
    removeDecorIds: ["rest-candle-west", "rest-candle-east", "stair-candle-west-3", "stair-candle-east-3", "stair-candle-west-4", "stair-candle-east-4", "bend-bed-south-1", "bend-bed-south-2"], core: [
    { platformId: "flower-terrace", castFrom: "ordinary-1", dx: 4 },
    { platformId: "veranda-south", castFrom: "ordinary-2", dx: -4 },
    { platformId: "roof-west", castFrom: "ordinary-3", dx: 4 },
    { platformId: "chimney-garden", castFrom: "ordinary-4", dx: -4 },
  ], extraCore: [
    { platformId: "flagstone-bend", castFrom: "ordinary-1", dx: -3 },
    { platformId: "flagstone-bend", castFrom: "ordinary-2", dx: 3 },
    { platformId: "tile-rest", castFrom: "ordinary-3", dx: -3, dz: 3, minWidth: 16, minDepth: 10, widen: true },
    { platformId: "tile-rest", castFrom: "ordinary-4", dx: 3, dz: 3 },
  ], optional: [
    { platformId: "golden-perch", castFrom: "ordinary-1", dx: -2.5, minWidth: 10, minDepth: 10, widen: true },
    { platformId: "arch-step-1", castFrom: "ordinary-2", minWidth: 8, minDepth: 8 },
    { platformId: "golden-perch", castFrom: "ordinary-3", dz: 3 },
    { platformId: "golden-perch", castFrom: "ordinary-4", dx: 2.5, minWidth: 10, minDepth: 10 },
  ] },
  { chapterId: "family-b3", variantId: "demon-idol-drummer", guardTool: { platformId: "fan-walk", dz: 8 }, relocateRequired: {
    "ordinary-1": { platformId: "ribbon-bandstand", castFrom: "ordinary-1", dx: -3 },
    "ordinary-2": { platformId: "raft-dock", castFrom: "ordinary-2", dx: -2 },
    "ordinary-4": { platformId: "sky-bleachers", castFrom: "ordinary-4", dx: -2 },
  }, core: [
    { platformId: "ribbon-bandstand", castFrom: "ordinary-1", dx: 3 },
    { platformId: "raft-dock", castFrom: "ordinary-2", dx: 2 },
    { platformId: "glitter-grove", castFrom: "ordinary-3", dx: -4 },
    { platformId: "sky-bleachers", castFrom: "ordinary-4", dx: 2 },
  ], extraCore: [
    { platformId: "fan-walk", castFrom: "ordinary-1", dz: -3 },
    { platformId: "fan-walk", castFrom: "ordinary-2", dz: -8 },
    { platformId: "crowd-bridge", castFrom: "ordinary-3", dz: -3 },
    { platformId: "crowd-bridge", castFrom: "ordinary-4", dz: 3 },
  ], optional: [
    { platformId: "wide-side-bridge", castFrom: "ordinary-1", dx: -1.5 },
    { platformId: "golden-perch", castFrom: "ordinary-2", dx: -2, minWidth: 10, minDepth: 10 },
    { platformId: "wide-side-bridge", castFrom: "ordinary-3", dx: 1.5 },
    { platformId: "rig-truss-1", castFrom: "ordinary-4" },
  ] },
];

export function familyWorldBV7Commands() {
  const base = buildFamilyWorldBV6();
  return [...familyWorldBV6Commands(), denseCatalogUpgradeCommands(base), denseWorldCommands(denseCatalogUpgrade(base), FAMILY_WORLD_B_V7_REVISIONS)];
}

export function buildFamilyWorldBV7() {
  return buildDenseWorld(buildFamilyWorldBV6(), FAMILY_WORLD_B_V7_REVISIONS);
}

export const FAMILY_WORLD_B_V7_COMMANDS_URL = new URL("./family-world-b-v7.commands.json", import.meta.url);
export const FAMILY_WORLD_B_V7_PROJECT_URL = new URL("../../src/shared/levels/family-world-b-v7.json", import.meta.url);

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes("--write")) {
    await writeFile(FAMILY_WORLD_B_V7_COMMANDS_URL, `${JSON.stringify(familyWorldBV7Commands(), null, 2)}\n`);
    await writeFile(FAMILY_WORLD_B_V7_PROJECT_URL, serializeDenseWorld(buildFamilyWorldBV7()));
    process.stdout.write("Wrote family-world-b v7 commands and project\n");
  } else process.stdout.write(`${JSON.stringify(familyWorldBV7Commands(), null, 2)}\n`);
}
