import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
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
  for (const [fixture, commandFile] of [
    ["rat-casino-world-v1.json", "rat-casino-world.commands.json"],
    ["rat-casino-world-v2.json", "rat-casino-world-v2.commands.json"],
  ] as const) {
    const path = fileURLToPath(
      new URL(`../../src/shared/levels/${fixture}`, import.meta.url),
    );
    try {
      const source = await readFile(path);
      const { project, levels } = resolveLevelEditorProject(
        JSON.parse(source.toString("utf8")),
      );
      const commands = JSON.parse(
        await readFile(new URL(`./${commandFile}`, import.meta.url), "utf8"),
      );
      const base = createWorldEditorProject({ projectId: "rat-casino-adventure" });
      const pinned = parseLevelEditorProject({
        ...base,
        catalogVersion: "parody-catalog-v6",
      });
      const rebuilt = applyLevelEditorCommands(pinned, commands);
      if (!rebuilt.ok) throw new Error("Rat Casino command history no longer builds");
      if (serializeLevelEditorProject(rebuilt.project) !== source.toString("utf8"))
        throw new Error("Rat Casino fixture differs from its shared editor commands");
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

  // Generated example worlds (DESIGN-025): every `examples/<name>.project.json`
  // with a sibling `<name>.commands.json` must replay byte-identically. The
  // replay starts from `createWorldEditorProject` with the project's own id
  // and catalog version (a family world pins parody-catalog-v7), and the
  // command file holds one batch or an array of batches applied in order, so
  // a whole world can stay under the per-batch size limit.
  const examplesDirectory = fileURLToPath(new URL("./examples/", import.meta.url));
  const examples = (await readdir(examplesDirectory))
    .filter((file) => file.endsWith(".project.json"))
    .sort();
  for (const file of examples) {
    const projectPath = join(examplesDirectory, file);
    const commandsPath = join(examplesDirectory, file.replace(/\.project\.json$/, ".commands.json"));
    try {
      const source = await readFile(projectPath, "utf8");
      const { project, levels } = resolveLevelEditorProject(JSON.parse(source));
      const history = JSON.parse(await readFile(commandsPath, "utf8")) as unknown;
      const batches = (Array.isArray(history) ? history : [history]) as Parameters<
        typeof applyLevelEditorCommands
      >[1][];
      let rebuilt = createWorldEditorProject({
        projectId: project.projectId,
        catalogVersion: project.catalogVersion,
      });
      for (const [index, batch] of batches.entries()) {
        const result = applyLevelEditorCommands(rebuilt, batch);
        if (!result.ok)
          throw new Error(
            `Command batch ${index} no longer builds: ${result.issues.map((entry) => entry.code).join(", ")}`,
          );
        rebuilt = result.project as typeof rebuilt;
      }
      if (serializeLevelEditorProject(rebuilt) !== source)
        throw new Error(`${file} differs from its shared editor commands`);
      console.log(
        `${projectPath}: valid ${project.projectId}; ${project.chapters.length} chapters, ${Object.keys(levels).length} resolved routes; command history matches`,
      );
    } catch (error) {
      console.error(
        `${projectPath}: ${error instanceof Error ? error.message : "Validation failed"}`,
      );
      process.exitCode = 1;
    }
  }
}
