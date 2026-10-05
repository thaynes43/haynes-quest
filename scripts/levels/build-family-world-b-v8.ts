/** World B v8: closer paired fights on existing broad route supports. */
import { writeFile } from "node:fs/promises";
import { buildFamilyWorldBV7, familyWorldBV7Commands } from "./build-family-world-b-v7.js";
import {
  buildPacedWorld, pacingWorldCommands, serializePacedWorld,
  type PacingChapterRevision,
} from "./family/encounter-pacing-revision.js";

export const FAMILY_WORLD_B_V8_REVISIONS: readonly PacingChapterRevision[] = [
  { chapterId: "family-b1", moves: [
    { slots: ["ordinary-2", "ordinary-6"], support: "crib-rail", offsets: [{ dx: -2.5 }, { dx: 2.5 }] },
    { slots: ["ordinary-4", "ordinary-8"], support: "dresser", offsets: [{ dx: -3 }, { dx: 3 }] },
  ] },
  { chapterId: "family-b2", moves: [
    { slots: ["ordinary-3", "ordinary-7"], support: "veranda-north", offsets: [{ dx: -3 }, { dx: 3 }] },
    { slots: ["ordinary-4", "ordinary-8"], support: "roof-walk", offsets: [{ dx: -3 }, { dx: 3 }] },
  ] },
  { chapterId: "family-b3", moves: [
    { slots: ["ordinary-1", "ordinary-5"], support: "fan-picnic", offsets: [{ dx: -3 }, { dx: 3 }] },
  ] },
];

export function familyWorldBV8Commands() {
  const base = buildFamilyWorldBV7();
  return [...familyWorldBV7Commands(), pacingWorldCommands(base, FAMILY_WORLD_B_V8_REVISIONS)];
}

export function buildFamilyWorldBV8() {
  return buildPacedWorld(buildFamilyWorldBV7(), FAMILY_WORLD_B_V8_REVISIONS);
}

export const FAMILY_WORLD_B_V8_COMMANDS_URL = new URL("./family-world-b-v8.commands.json", import.meta.url);
export const FAMILY_WORLD_B_V8_PROJECT_URL = new URL("../../src/shared/levels/family-world-b-v8.json", import.meta.url);

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes("--write")) {
    await writeFile(FAMILY_WORLD_B_V8_COMMANDS_URL, `${JSON.stringify(familyWorldBV8Commands(), null, 2)}\n`);
    await writeFile(FAMILY_WORLD_B_V8_PROJECT_URL, serializePacedWorld(buildFamilyWorldBV8()));
    process.stdout.write("Wrote family-world-b v8 commands and project\n");
  } else process.stdout.write(`${JSON.stringify(familyWorldBV8Commands(), null, 2)}\n`);
}
