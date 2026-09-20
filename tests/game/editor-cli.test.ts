import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parseLevelEditorProjectJson } from "../../src/shared/editor-project";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const exampleCommands = join(
  repositoryRoot,
  "scripts/levels/examples/editor-commands-v1.json",
);

function runEditor(...args: string[]) {
  const result = spawnSync(
    "pnpm",
    ["exec", "tsx", "scripts/levels/editor.ts", ...args],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
    },
  );
  if (result.error) throw result.error;
  return result;
}

describe("level editor CLI", () => {
  it("templates, describes, edits, validates and exports one portable project", async () => {
    const directory = await mkdtemp(join(tmpdir(), "quest-editor-cli-"));
    try {
      const projectPath = join(directory, "project.json");
      const editedPath = join(directory, "edited.json");
      const invalidPath = join(directory, "invalid.json");

      const template = runEditor(
        "template",
        "cli-project",
        "CLI adventure",
      );
      expect(template.status).toBe(0);
      expect(template.stderr).toBe("");
      const originalProject = parseLevelEditorProjectJson(template.stdout);
      expect(originalProject).toMatchObject({
        projectId: "cli-project",
        name: "CLI adventure",
        revision: 0,
      });
      await writeFile(projectPath, template.stdout, "utf8");

      const projectSchema = runEditor("schema", "project");
      expect(projectSchema.status).toBe(0);
      expect(projectSchema.stderr).toBe("");
      expect(JSON.parse(projectSchema.stdout)).toEqual(
        expect.objectContaining({ type: "object" }),
      );
      expect(projectSchema.stdout).toContain("chapters");

      const commandSchema = runEditor("schema");
      expect(commandSchema.status).toBe(0);
      expect(commandSchema.stderr).toBe("");
      expect(JSON.parse(commandSchema.stdout)).toEqual(
        expect.objectContaining({ type: "object" }),
      );
      expect(commandSchema.stdout).toContain("expectedRevision");

      const inspection = runEditor("inspect", projectPath);
      expect(inspection.status).toBe(0);
      expect(inspection.stderr).toBe("");
      expect(JSON.parse(inspection.stdout)).toMatchObject({
        projectId: "cli-project",
        name: "CLI adventure",
        revision: 0,
        chapters: [
          {
            chapterId: "chapter-1",
            templateRouteId: "garden-playground-v2",
          },
          {
            chapterId: "chapter-2",
            templateRouteId: "besties-playground-v2",
          },
        ],
        issues: [],
      });

      const apply = runEditor(
        "apply",
        projectPath,
        exampleCommands,
      );
      expect(apply.status).toBe(0);
      expect(apply.stderr).toBe("");
      const application = JSON.parse(apply.stdout) as {
        ok: boolean;
        project: unknown;
        issues: unknown[];
      };
      expect(application).toMatchObject({ ok: true, issues: [] });
      const editedProject = parseLevelEditorProjectJson(
        JSON.stringify(application.project),
      );
      expect(editedProject).toMatchObject({
        name: "Agent garden remix",
        revision: 1,
      });
      await writeFile(editedPath, JSON.stringify(application.project), "utf8");
      expect(await readFile(projectPath, "utf8")).toBe(template.stdout);

      const validation = runEditor("validate", editedPath);
      expect(validation.status).toBe(0);
      expect(validation.stderr).toBe("");
      expect(JSON.parse(validation.stdout)).toEqual({ ok: true, issues: [] });

      const exported = runEditor("export", editedPath);
      expect(exported.status).toBe(0);
      expect(exported.stderr).toBe("");
      expect(parseLevelEditorProjectJson(exported.stdout)).toEqual(
        editedProject,
      );

      const conflict = runEditor("apply", editedPath, exampleCommands);
      expect(conflict.status).toBe(1);
      expect(conflict.stderr).toBe("");
      expect(JSON.parse(conflict.stdout)).toMatchObject({
        ok: false,
        project: { revision: 1 },
        issues: [{ source: "command", code: "revision.conflict" }],
      });

      await writeFile(invalidPath, "{", "utf8");
      const malformed = runEditor("validate", invalidPath);
      expect(malformed.status).toBe(1);
      expect(malformed.stdout).toBe("");
      expect(JSON.parse(malformed.stderr)).toMatchObject({
        ok: false,
        issues: [{ source: "structure", code: "json.syntax" }],
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 30_000);
});
