import { readFile } from "node:fs/promises";
import {
  applyLevelEditorCommands,
  createWorldEditorProject,
  parseLevelEditorProject,
  serializeLevelEditorProject,
  validateLevelEditorProject,
} from "../../src/shared/editor-project.js";

const commands = JSON.parse(
  await readFile(new URL("./rat-casino-world.commands.json", import.meta.url), "utf8"),
);
const base = createWorldEditorProject({ projectId: "rat-casino-adventure" });
const project = parseLevelEditorProject({
  ...base,
  catalogVersion: "parody-catalog-v6",
});
const result = applyLevelEditorCommands(project, commands);
if (!result.ok) {
  throw new Error(
    `Rat Casino commands failed: ${result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`,
  );
}
const issues = validateLevelEditorProject(result.project);
if (issues.length > 0) {
  throw new Error(
    `Rat Casino project is invalid: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`,
  );
}
process.stdout.write(serializeLevelEditorProject(result.project));
