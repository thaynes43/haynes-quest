/** World A v5: the v4 course and scare levels with five exact WO111 models. */
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
import { familyWorldACommands } from "./build-family-world-a.js";
import { chapterCommands } from "./lib/growth-kit.js";

export const FAMILY_WORLD_A_V5_CATALOG_VERSION = "parody-catalog-v11" as const;
const A3_IDS = new Set(["putty-grunt", "lab-robot", "inator-monster"]);

const catalog = (catalogEntryId: string) => ({
  source: "catalog" as const,
  catalogEntryId,
  catalogEntryVersion: "v001" as const,
});

function castModel(command: LevelEditorCommand): LevelEditorCommand {
  if (!("chapterId" in command)) return command;
  if (command.type !== "enemy.add" && command.type !== "encounter.assign") return command;
  const id = command.type === "enemy.add"
    ? command.candidate.id
    : command.encounter.source === "candidate" ? command.encounter.candidateId : null;
  if ((command.chapterId === "family-a3" && id !== null && A3_IDS.has(id)) ||
      (command.chapterId === "family-a4" && id === "radio-host-showman"))
    return chapterCommands(command.chapterId).assign(command.slot, catalog(id));
  return command;
}

export function familyWorldAV5Commands(): LevelEditorCommandBatch {
  const v4 = familyWorldACommands();
  return { ...v4, commands: v4.commands.map(castModel) };
}

export function buildFamilyWorldAV5(): LevelEditorProjectV2 {
  const base = createWorldEditorProject({ projectId: "family-world-a", catalogVersion: FAMILY_WORLD_A_V5_CATALOG_VERSION });
  const result = applyLevelEditorCommands(base, familyWorldAV5Commands());
  if (!result.ok) throw new Error(`World A v5 commands failed: ${result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  const issues = validateLevelEditorProject(result.project);
  if (issues.length) throw new Error(`World A v5 is invalid: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  return result.project as LevelEditorProjectV2;
}

export const FAMILY_WORLD_A_V5_COMMANDS_URL = new URL("./family-world-a-v5.commands.json", import.meta.url);
export const FAMILY_WORLD_A_V5_PROJECT_URL = new URL("../../src/shared/levels/family-world-a-v5.json", import.meta.url);

if (import.meta.url === `file://${process.argv[1]}`) {
  const commands = `${JSON.stringify(familyWorldAV5Commands(), null, 2)}\n`;
  if (process.argv.includes("--write")) {
    await writeFile(FAMILY_WORLD_A_V5_COMMANDS_URL, commands);
    await writeFile(FAMILY_WORLD_A_V5_PROJECT_URL, serializeLevelEditorProject(buildFamilyWorldAV5()));
    process.stdout.write("Wrote family-world-a v5 commands and project\n");
  } else process.stdout.write(commands);
}
