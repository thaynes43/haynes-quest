/** World A v8: six paired main-route fights and four side-route discoveries. */
import { writeFile } from "node:fs/promises";
import { buildFamilyWorldAV7, familyWorldAV7Commands } from "./build-family-world-a-v7.js";
import { buildDenseWorld, denseCatalogUpgrade, denseCatalogUpgradeCommands, denseWorldCommands, serializeDenseWorld, type DenseChapterRevision } from "./family/dense-world-revision.js";

export const FAMILY_WORLD_A_V8_REVISIONS: readonly DenseChapterRevision[] = [
  { chapterId: "family-a1", variantId: "gadget-hammer-hopper", guardTool: { platformId: "hop-2" }, relocateRequired: {
    "ordinary-2": { platformId: "picnic-plateau", castFrom: "ordinary-2", dx: 2 },
  }, core: [
    { platformId: "hill-terrace", castFrom: "ordinary-1", dx: 4 },
    { platformId: "picnic-plateau", castFrom: "ordinary-2", dx: -3 },
    { platformId: "porch-lawn", castFrom: "ordinary-3", dx: 4 },
    { platformId: "tower-balcony", castFrom: "ordinary-4", dx: 4, dz: -3 },
  ], extraCore: [
    { platformId: "toolshed-green", castFrom: "ordinary-1", dx: -2 },
    { platformId: "toolshed-green", castFrom: "ordinary-2", dx: 2 },
    { platformId: "clubhouse-porch", castFrom: "ordinary-3", dx: -3, dz: -2 },
    { platformId: "clubhouse-porch", castFrom: "ordinary-4", dx: 3, dz: -2 },
  ], optional: [
    { platformId: "b1-golden-perch", castFrom: "ordinary-1" },
    { platformId: "b3-stump", castFrom: "ordinary-2", minWidth: 8, minDepth: 8 },
    { platformId: "b1-perch-1", castFrom: "ordinary-3" },
    { platformId: "b3-hop-3", castFrom: "ordinary-4", minWidth: 8, minDepth: 8 },
  ] },
  { chapterId: "family-a2", variantId: "mischief-kitten-skater", guardTool: { platformId: "hq-dock", dx: 2, dz: -2 }, core: [
    { platformId: "sea-wall", castFrom: "ordinary-1", dx: -3, dz: 3 },
    { platformId: "fish-market", castFrom: "ordinary-2", dz: 3 },
    { platformId: "laundry-roof", castFrom: "ordinary-3", dx: 3 },
    { platformId: "town-hall", castFrom: "ordinary-4", dz: -3 },
  ], extraCore: [
    { platformId: "beach", castFrom: "ordinary-1", dx: -3 },
    { platformId: "beach", castFrom: "ordinary-2", dx: 2 },
    { platformId: "tower-plaza", castFrom: "ordinary-3", dx: -3 },
    { platformId: "tower-plaza", castFrom: "ordinary-4", dx: 3 },
  ], optional: [
    { platformId: "laundry-annex", castFrom: "ordinary-1" },
    { platformId: "water-tower", castFrom: "ordinary-2", minWidth: 8, minDepth: 8 },
    { platformId: "crows-nest", castFrom: "ordinary-3", minWidth: 8, minDepth: 8 },
    { platformId: "sign-hop-2", castFrom: "ordinary-4", minWidth: 8, minDepth: 8 },
  ] },
  { chapterId: "family-a3", variantId: "lab-robot-sentry", variantSlots: ["ordinary-5", "ordinary-7", "ordinary-10", "ordinary-12"], guardTool: { platformId: "elevator-roof" }, relocateRequired: {
    "ordinary-1": { platformId: "water-tower-roof", castFrom: "ordinary-1", dx: -2 },
    "ordinary-2": { platformId: "billboard-balcony", castFrom: "ordinary-2", dx: -2 },
  }, core: [
    { platformId: "water-tower-roof", castFrom: "ordinary-1", dx: 3 },
    { platformId: "billboard-balcony", castFrom: "ordinary-1", dx: 3 },
    { platformId: "putty-plaza", castFrom: "ordinary-3", dx: 4 },
    { platformId: "scaffold-deck", castFrom: "ordinary-1", dx: 4.2, dz: 3 },
  ], extraCore: [
    { platformId: "pigeon-roof", castFrom: "ordinary-1", dx: -3 },
    { platformId: "pigeon-roof", castFrom: "ordinary-2", dx: 3 },
    { platformId: "crane-walk", castFrom: "ordinary-3", dx: -3 },
    { platformId: "crane-walk", castFrom: "ordinary-4", dx: 3 },
  ], optional: [
    { platformId: "tank-catwalk", castFrom: "ordinary-1" },
    { platformId: "billboard-walkway", castFrom: "ordinary-2", dz: 3 },
    { platformId: "crane-jib", castFrom: "ordinary-3", minWidth: 8, minDepth: 8 },
    { platformId: "tank-top", castFrom: "ordinary-4", minWidth: 8, minDepth: 8 },
  ] },
  { chapterId: "family-a4", guardTool: { platformId: "token-step-two" }, relocateRequired: {
    "ordinary-2": { platformId: "fox-card-room", castFrom: "ordinary-2", dx: -2 },
    "ordinary-3": { platformId: "backstage-turn", castFrom: "ordinary-3", dx: -2 },
    "ordinary-4": { platformId: "marquee-ledge", castFrom: "ordinary-4", dx: -1.5 },
  }, core: [
    { platformId: "ticket-counter", castFrom: "ordinary-1", dx: -4 },
    { platformId: "fox-card-room", castFrom: "ordinary-2", dx: 3 },
    { platformId: "backstage-turn", castFrom: "ordinary-3", dx: 3 },
    { platformId: "marquee-ledge", castFrom: "ordinary-4", dx: 1.5 },
  ], extraCore: [
    { platformId: "drum-break", castFrom: "ordinary-1", dx: -2 },
    { platformId: "drum-break", castFrom: "ordinary-2", dx: 2 },
    { platformId: "high-board", castFrom: "ordinary-3", dx: -2, minWidth: 10, minDepth: 8, widen: true },
    { platformId: "high-board", castFrom: "ordinary-4", dx: 2 },
  ], optional: [
    { platformId: "on-air-stage", castFrom: "ordinary-1", dx: -2 },
    { platformId: "chip-stack-three", castFrom: "ordinary-2", minWidth: 8, minDepth: 8 },
    { platformId: "chip-stack-one", castFrom: "ordinary-3", minWidth: 8, minDepth: 8 },
    { platformId: "on-air-stage", castFrom: "ordinary-4", dx: 2 },
  ] },
];

export function familyWorldAV8Commands() {
  const base = buildFamilyWorldAV7();
  return [...familyWorldAV7Commands(), denseCatalogUpgradeCommands(base), denseWorldCommands(denseCatalogUpgrade(base), FAMILY_WORLD_A_V8_REVISIONS)];
}

export function buildFamilyWorldAV8() {
  return buildDenseWorld(buildFamilyWorldAV7(), FAMILY_WORLD_A_V8_REVISIONS);
}

export const FAMILY_WORLD_A_V8_COMMANDS_URL = new URL("./family-world-a-v8.commands.json", import.meta.url);
export const FAMILY_WORLD_A_V8_PROJECT_URL = new URL("../../src/shared/levels/family-world-a-v8.json", import.meta.url);

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes("--write")) {
    await writeFile(FAMILY_WORLD_A_V8_COMMANDS_URL, `${JSON.stringify(familyWorldAV8Commands(), null, 2)}\n`);
    await writeFile(FAMILY_WORLD_A_V8_PROJECT_URL, serializeDenseWorld(buildFamilyWorldAV8()));
    process.stdout.write("Wrote family-world-a v8 commands and project\n");
  } else process.stdout.write(`${JSON.stringify(familyWorldAV8Commands(), null, 2)}\n`);
}
