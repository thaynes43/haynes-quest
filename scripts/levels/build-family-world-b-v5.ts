/** World B v5: the v4 course and scare level with the exact Demon Idol model. */
import { writeFile } from "node:fs/promises";
import {
  applyLevelEditorCommands,
  createWorldEditorProject,
  serializeLevelEditorProject,
  validateLevelEditorProject,
  type LevelEditorCommand,
  type LevelEditorCommandBatch,
  type LevelEditorProjectV2,
} from "../../src/shared/editor-project.js";
import { familyWorldBCommands } from "./build-family-world-b.js";
import { chapterCommands } from "./lib/growth-kit.js";

export const FAMILY_WORLD_B_V5_CATALOG_VERSION = "parody-catalog-v11" as const;
const idol = { source: "catalog" as const, catalogEntryId: "demon-band-idol", catalogEntryVersion: "v001" as const };

function castIdol(command: LevelEditorCommand): LevelEditorCommand {
  if (!("chapterId" in command) || command.chapterId !== "family-b3") return command;
  if (command.type === "enemy.add" && command.candidate.id === "demon-band-idol")
    return chapterCommands("family-b3").assign(command.slot, idol);
  if (command.type === "encounter.assign" && command.encounter.source === "candidate" && command.encounter.candidateId === "demon-band-idol")
    return chapterCommands("family-b3").assign(command.slot, idol);
  return command;
}

export function familyWorldBV5Commands(): LevelEditorCommandBatch {
  const v4 = familyWorldBCommands();
  return { ...v4, commands: v4.commands.map(castIdol) };
}

export function buildFamilyWorldBV5(): LevelEditorProjectV2 {
  const base = createWorldEditorProject({ projectId: "family-world-b", catalogVersion: FAMILY_WORLD_B_V5_CATALOG_VERSION });
  const result = applyLevelEditorCommands(base, familyWorldBV5Commands());
  if (!result.ok) throw new Error(`World B v5 commands failed: ${result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  const issues = validateLevelEditorProject(result.project);
  if (issues.length) throw new Error(`World B v5 is invalid: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  return result.project as LevelEditorProjectV2;
}

export const FAMILY_WORLD_B_V5_COMMANDS_URL = new URL("./family-world-b-v5.commands.json", import.meta.url);
export const FAMILY_WORLD_B_V5_PROJECT_URL = new URL("../../src/shared/levels/family-world-b-v5.json", import.meta.url);

if (import.meta.url === `file://${process.argv[1]}`) {
  const commands = `${JSON.stringify(familyWorldBV5Commands(), null, 2)}\n`;
  if (process.argv.includes("--write")) {
    await writeFile(FAMILY_WORLD_B_V5_COMMANDS_URL, commands);
    await writeFile(FAMILY_WORLD_B_V5_PROJECT_URL, serializeLevelEditorProject(buildFamilyWorldBV5()));
    process.stdout.write("Wrote family-world-b v5 commands and project\n");
  } else process.stdout.write(commands);
}
