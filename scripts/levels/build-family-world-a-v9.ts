/** World A v9: closer paired fights and a varied Rat Casino cast. */
import { writeFile } from "node:fs/promises";
import { buildFamilyWorldAV8, familyWorldAV8Commands } from "./build-family-world-a-v8.js";
import {
  buildPacedWorld, pacingWorldCommands, serializePacedWorld,
  type PacingChapterRevision,
} from "./family/encounter-pacing-revision.js";

export const FAMILY_WORLD_A_V9_REVISIONS: readonly PacingChapterRevision[] = [
  { chapterId: "family-a1", moves: [
    { slots: ["ordinary-3", "ordinary-7"], support: "gear-garden", offsets: [{ dx: -3 }, { dx: 3 }] },
    { slots: ["ordinary-4", "ordinary-8"], support: "porch-lawn", offsets: [{ dx: -3 }, { dx: 3 }] },
  ] },
  { chapterId: "family-a2", moves: [
    { slots: ["ordinary-3", "ordinary-7"], support: "vane-roof", offsets: [{ dx: -2.5 }, { dx: 2.5 }] },
    { slots: ["ordinary-4", "ordinary-8"], support: "clock-roof", offsets: [{ dx: -2 }, { dx: 2 }] },
    { slots: ["ordinary-11", "ordinary-12"], support: "town-hall", offsets: [{ dx: -3 }, { dx: 3 }] },
  ] },
  { chapterId: "family-a3", moves: [] },
  { chapterId: "family-a4", moves: [], recasts: {
    "ordinary-5": "radio-host-showman",
    "ordinary-6": "moth-projectionist",
    "ordinary-7": "radio-host-showman",
    "ordinary-8": "jackrabbit-drummer",
  } },
];

export function familyWorldAV9Commands() {
  const base = buildFamilyWorldAV8();
  return [...familyWorldAV8Commands(), pacingWorldCommands(base, FAMILY_WORLD_A_V9_REVISIONS)];
}

export function buildFamilyWorldAV9() {
  return buildPacedWorld(buildFamilyWorldAV8(), FAMILY_WORLD_A_V9_REVISIONS);
}

export const FAMILY_WORLD_A_V9_COMMANDS_URL = new URL("./family-world-a-v9.commands.json", import.meta.url);
export const FAMILY_WORLD_A_V9_PROJECT_URL = new URL("../../src/shared/levels/family-world-a-v9.json", import.meta.url);

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes("--write")) {
    await writeFile(FAMILY_WORLD_A_V9_COMMANDS_URL, `${JSON.stringify(familyWorldAV9Commands(), null, 2)}\n`);
    await writeFile(FAMILY_WORLD_A_V9_PROJECT_URL, serializePacedWorld(buildFamilyWorldAV9()));
    process.stdout.write("Wrote family-world-a v9 commands and project\n");
  } else process.stdout.write(`${JSON.stringify(familyWorldAV9Commands(), null, 2)}\n`);
}
