import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolveAuthoredLevelDocument } from "../../src/shared/authored-level.js";

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
