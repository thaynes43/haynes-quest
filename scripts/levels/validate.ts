import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolveAuthoredLevelDocument } from "../../src/shared/authored-level.js";
import {
  applyLevelEditorCommands,
  createWorldEditorProject,
  parseLevelEditorProject,
  resolveLevelEditorProject,
  serializeLevelEditorProject,
} from "../../src/shared/editor-project.js";

const requested = process.argv.slice(2);
const paths = requested.length
  ? requested
  : ["garden-playground-v1", "besties-playground-v1", "garden-playground-v2", "besties-playground-v2"].map(
      (id) => fileURLToPath(new URL(`../../src/shared/levels/${id}.json`, import.meta.url)),
    );
for (const path of paths) {
  try {
    const source = await readFile(path);
    if (source.byteLength > 128 * 1024)
      throw new Error("Level documents must be smaller than 128 KiB");
    const { document, course } = resolveAuthoredLevelDocument(
      JSON.parse(source.toString("utf8")),
    );
    console.log(
      `${path}: valid ${document.id}; ${course.platforms.length} platforms, ${course.hazards.length} sweepers, ${course.checkpoints.length} checkpoints, ${document.branches.length} branch`,
    );
  } catch (error) {
    console.error(
      `${path}: ${error instanceof Error ? error.message : "Validation failed"}`,
    );
    process.exitCode = 1;
  }
}

if (requested.length === 0) {
  const path = fileURLToPath(
    new URL("../../src/shared/levels/rat-casino-world-v1.json", import.meta.url),
  );
  try {
    const source = await readFile(path);
    const { project, levels } = resolveLevelEditorProject(
      JSON.parse(source.toString("utf8")),
    );
    const commands = JSON.parse(
      await readFile(
        new URL("./rat-casino-world.commands.json", import.meta.url),
        "utf8",
      ),
    );
    const base = createWorldEditorProject({ projectId: "rat-casino-adventure" });
    const pinned = parseLevelEditorProject({
      ...base,
      catalogVersion: "parody-catalog-v6",
    });
    const rebuilt = applyLevelEditorCommands(pinned, commands);
    if (!rebuilt.ok) {
      throw new Error("Rat Casino command history no longer builds");
    }
    if (serializeLevelEditorProject(rebuilt.project) !== source.toString("utf8")) {
      throw new Error("Rat Casino fixture differs from its shared editor commands");
    }
    console.log(
      `${path}: valid ${project.projectId}; ${project.chapters.length} chapters, ${Object.keys(levels).length} resolved routes; command history matches`,
    );
  } catch (error) {
    console.error(
      `${path}: ${error instanceof Error ? error.message : "Validation failed"}`,
    );
    process.exitCode = 1;
  }
}
