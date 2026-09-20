import { readFile, stat } from "node:fs/promises";
import { z } from "zod";

import {
  LEVEL_EDITOR_COMMAND_BATCH_MAX_BYTES,
  LEVEL_EDITOR_PROJECT_MAX_BYTES,
  applyLevelEditorCommands,
  createLevelEditorProject,
  levelEditorCommandBatchSchema,
  levelEditorProjectSchema,
  parseLevelEditorProjectJson,
  serializeLevelEditorProject,
  validateLevelEditorProject,
} from "../../src/shared/editor-project.js";

const usage = `Usage:
  tsx scripts/levels/editor.ts template <project-id> [name]
  tsx scripts/levels/editor.ts inspect <project.json>
  tsx scripts/levels/editor.ts validate <project.json>
  tsx scripts/levels/editor.ts apply <project.json> <commands.json>
  tsx scripts/levels/editor.ts export <project.json>
  tsx scripts/levels/editor.ts schema [project|commands]`;

interface CliIssue {
  readonly source: "structure";
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

class CliInputError extends Error {
  readonly issues: readonly CliIssue[];

  constructor(message: string, issue: Omit<CliIssue, "source">) {
    super(message);
    this.name = "CliInputError";
    this.issues = [{ source: "structure", ...issue }];
  }
}

async function readBoundedText(
  path: string,
  maximumBytes: number,
): Promise<string> {
  const details = await stat(path);
  if (!details.isFile()) throw new Error(`${path} is not a file`);
  if (details.size > maximumBytes)
    throw new CliInputError(
      `${path} exceeds the ${maximumBytes}-byte input limit`,
      {
        path: "$",
        code: "size.limit",
        message: `JSON data must be no larger than ${maximumBytes} bytes`,
      },
    );
  return readFile(path, "utf8");
}

async function readProject(path: string) {
  return parseLevelEditorProjectJson(
    await readBoundedText(path, LEVEL_EDITOR_PROJECT_MAX_BYTES),
  );
}

function parseCommandsJson(source: string): unknown {
  try {
    return JSON.parse(source) as unknown;
  } catch {
    throw new CliInputError("Command batch is not valid JSON", {
      path: "$",
      code: "json.syntax",
      message: "Command batch is not valid JSON",
    });
  }
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function requireArgument(
  value: string | undefined,
  label: string,
): asserts value is string {
  if (!value) throw new Error(`Missing ${label}\n${usage}`);
}

function requireArgumentCount(
  values: readonly string[],
  minimum: number,
  maximum = minimum,
): void {
  if (values.length < minimum || values.length > maximum)
    throw new Error(usage);
}

async function run(args: readonly string[]): Promise<void> {
  const [command, ...values] = args;
  if (!command) throw new Error(usage);

  switch (command) {
    case "template": {
      requireArgumentCount(values, 1, 2);
      const [projectId, name] = values;
      requireArgument(projectId, "project id");
      process.stdout.write(
        serializeLevelEditorProject(
          createLevelEditorProject({
            projectId,
            ...(name === undefined ? {} : { name }),
          }),
        ),
      );
      return;
    }

    case "inspect": {
      requireArgumentCount(values, 1);
      const [path] = values;
      requireArgument(path, "project path");
      const project = await readProject(path);
      writeJson({
        projectId: project.projectId,
        name: project.name,
        revision: project.revision,
        chapters: project.chapters.map((chapter) => ({
          chapterId: chapter.chapterId,
          name: chapter.name,
          templateRouteId: chapter.templateRouteId,
          pieces: chapter.level.pieces.length,
          platforms: chapter.level.pieces.filter(
            (piece) =>
              piece.type === "platform" || piece.type === "moving-platform",
          ).length,
          hazards: chapter.level.pieces.filter(
            (piece) => piece.type === "sweeper",
          ).length,
          checkpoints: chapter.level.pieces.filter(
            (piece) => piece.type === "checkpoint",
          ).length,
          connections: chapter.level.connections.length,
          branches: chapter.level.branches.length,
        })),
        issues: validateLevelEditorProject(project),
      });
      return;
    }

    case "validate": {
      requireArgumentCount(values, 1);
      const [path] = values;
      requireArgument(path, "project path");
      const issues = validateLevelEditorProject(await readProject(path));
      writeJson({ ok: issues.length === 0, issues });
      if (issues.length > 0) process.exitCode = 1;
      return;
    }

    case "apply": {
      requireArgumentCount(values, 2);
      const [projectPath, commandsPath] = values;
      requireArgument(projectPath, "project path");
      requireArgument(commandsPath, "command path");
      const [project, commandsText] = await Promise.all([
        readProject(projectPath),
        readBoundedText(commandsPath, LEVEL_EDITOR_COMMAND_BATCH_MAX_BYTES),
      ]);
      const result = applyLevelEditorCommands(
        project,
        parseCommandsJson(commandsText) as Parameters<
          typeof applyLevelEditorCommands
        >[1],
      );
      writeJson(result);
      if (!result.ok) process.exitCode = 1;
      return;
    }

    case "export": {
      requireArgumentCount(values, 1);
      const [path] = values;
      requireArgument(path, "project path");
      process.stdout.write(serializeLevelEditorProject(await readProject(path)));
      return;
    }

    case "schema": {
      requireArgumentCount(values, 0, 1);
      const target = values[0] ?? "commands";
      if (target !== "project" && target !== "commands")
        throw new Error(`Unknown schema ${JSON.stringify(target)}\n${usage}`);
      writeJson(
        z.toJSONSchema(
          target === "project"
            ? levelEditorProjectSchema
            : levelEditorCommandBatchSchema,
        ),
      );
      return;
    }

    default:
      throw new Error(`Unknown command ${JSON.stringify(command)}\n${usage}`);
  }
}

try {
  await run(process.argv.slice(2));
} catch (error) {
  const detail =
    error instanceof Error ? error.message : "The level editor command failed";
  const issues =
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray(error.issues)
      ? error.issues
      : undefined;
  process.stderr.write(
    `${JSON.stringify(
      { ok: false, error: detail, ...(issues ? { issues } : {}) },
      null,
      2,
    )}\n`,
  );
  process.exitCode = 1;
}
