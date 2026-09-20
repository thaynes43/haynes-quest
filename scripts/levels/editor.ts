import { readFile, stat } from "node:fs/promises";
import { z } from "zod";
import { LEVEL_EDITOR_SECTION_LIMITS } from "../../src/shared/editor-sections.js";

import {
  AUTHORED_LEVEL_LIMITS,
  type AuthoredAnchor,
  type AuthoredEncounterAnchor,
  type AuthoredLevelAnchors,
  type AuthoredLevelPiece,
  type AuthoredMovingPlatformPiece,
  type AuthoredPlatformPiece,
} from "../../src/shared/authored-level.js";
import {
  LEVEL_EDITOR_ANCHOR_SLOTS,
  LEVEL_EDITOR_COMMAND_BATCH_MAX_BYTES,
  LEVEL_EDITOR_PROJECT_MAX_BYTES,
  type LevelEditorAnchorSlot,
  type LevelEditorLevelDocument,
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

// Spatial digest for building agents. Everything below reads the same parsed
// project the editor validates and reports authored facts only: no reachability,
// physics or rule evaluation is repeated here, so `validate` stays the single
// authority on whether geometry is playable.

type EditorPlatformPiece = AuthoredPlatformPiece | AuthoredMovingPlatformPiece;

interface HorizontalExtent {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

const ANCHOR_SLOT_READERS: Readonly<
  Record<
    LevelEditorAnchorSlot,
    (anchors: AuthoredLevelAnchors) => AuthoredAnchor | AuthoredEncounterAnchor
  >
> = {
  spawn: (anchors) => anchors.spawn,
  finish: (anchors) => anchors.finish,
  "reward-respawn": (anchors) => anchors.rewardRespawn,
  "pickup.attack-tool": (anchors) => anchors.pickups["attack-tool"],
  "pickup.guard-tool": (anchors) => anchors.pickups["guard-tool"],
  "memory.minor-one": (anchors) => anchors.memories["minor-one"],
  "memory.minor-two": (anchors) => anchors.memories["minor-two"],
  "memory.major": (anchors) => anchors.memories.major,
  "encounter.ordinary-1": (anchors) => anchors.encounters["ordinary-1"],
  "encounter.ordinary-2": (anchors) => anchors.encounters["ordinary-2"],
  "encounter.ordinary-3": (anchors) => anchors.encounters["ordinary-3"],
  "encounter.ordinary-4": (anchors) => anchors.encounters["ordinary-4"],
  "encounter.boss": (anchors) => anchors.encounters.boss,
  "friendly.friendly-1": (anchors) => anchors.friendlies["friendly-1"],
  "friendly.friendly-2": (anchors) => anchors.friendlies["friendly-2"],
  "friendly.friendly-3": (anchors) => anchors.friendlies["friendly-3"],
};

/** Trims float noise from derived metres; authored values are never rewritten. */
function derivedMetres(value: number): number {
  return Number.parseFloat(value.toFixed(6));
}

function isPlatformPiece(
  piece: AuthoredLevelPiece,
): piece is EditorPlatformPiece {
  return piece.type === "platform" || piece.type === "moving-platform";
}

function platformTopY(platform: EditorPlatformPiece): number {
  return derivedMetres(platform.center.y + platform.size.y / 2);
}

function platformExtent(platform: EditorPlatformPiece): HorizontalExtent {
  // A moving platform occupies its whole travel, so grow the authored box
  // along the motion axis the way the shared course bounds do.
  const travelX =
    platform.type === "moving-platform" && platform.motion.axis === "x"
      ? platform.motion.distance
      : 0;
  const travelZ =
    platform.type === "moving-platform" && platform.motion.axis === "z"
      ? platform.motion.distance
      : 0;
  return {
    minX: derivedMetres(platform.center.x - platform.size.x / 2 - travelX),
    maxX: derivedMetres(platform.center.x + platform.size.x / 2 + travelX),
    minZ: derivedMetres(platform.center.z - platform.size.z / 2 - travelZ),
    maxZ: derivedMetres(platform.center.z + platform.size.z / 2 + travelZ),
  };
}

function describeBounds(platforms: readonly EditorPlatformPiece[]) {
  if (platforms.length === 0) return null;
  const extents = platforms.map(platformExtent);
  const tops = platforms.map(platformTopY);
  const minX = Math.min(...extents.map((extent) => extent.minX));
  const maxX = Math.max(...extents.map((extent) => extent.maxX));
  const minZ = Math.min(...extents.map((extent) => extent.minZ));
  const maxZ = Math.max(...extents.map((extent) => extent.maxZ));
  return {
    horizontal: {
      minX,
      maxX,
      minZ,
      maxZ,
      spanX: derivedMetres(maxX - minX),
      spanZ: derivedMetres(maxZ - minZ),
    },
    platformTop: { min: Math.min(...tops), max: Math.max(...tops) },
  };
}

function describeAnchor(
  slot: LevelEditorAnchorSlot,
  anchor: AuthoredAnchor | AuthoredEncounterAnchor,
) {
  const encounter = "kind" in anchor ? anchor : undefined;
  return {
    slot,
    platformId: anchor.platformId,
    position: anchor.position,
    ...(encounter
      ? {
          kind: encounter.kind,
          checkpointId: encounter.checkpointId,
          arena: encounter.arena,
        }
      : {}),
  };
}

function describeChapterSpace(level: LevelEditorLevelDocument) {
  const platforms = level.pieces.filter(isPlatformPiece);

  const mainPathIndices = new Map<string, number>();
  level.mainPath.forEach((id, index) => {
    if (!mainPathIndices.has(id)) mainPathIndices.set(id, index);
  });

  const branchIndices = new Map<string, number[]>();
  level.branches.forEach((branch, index) => {
    for (const id of new Set(branch)) {
      const existing = branchIndices.get(id);
      if (existing) existing.push(index);
      else branchIndices.set(id, [index]);
    }
  });

  const checkpointIds = new Map<string, string[]>();
  for (const piece of level.pieces) {
    if (piece.type !== "checkpoint") continue;
    const existing = checkpointIds.get(piece.platformId);
    if (existing) existing.push(piece.id);
    else checkpointIds.set(piece.platformId, [piece.id]);
  }

  return {
    bounds: describeBounds(platforms),
    platforms: platforms.map((platform) => {
      const mainPathIndex = mainPathIndices.get(platform.id);
      const branches = branchIndices.get(platform.id) ?? [];
      return {
        id: platform.id,
        type: platform.type,
        center: platform.center,
        size: platform.size,
        topY: platformTopY(platform),
        mainPathIndex: mainPathIndex ?? null,
        branchIndices: branches,
        // Optional v2 geometry is simply a platform no authored route names.
        optional: mainPathIndex === undefined && branches.length === 0,
        checkpointIds: checkpointIds.get(platform.id) ?? [],
        safeMissFor: level.connections.flatMap((connection, index) =>
          connection.safeMissPlatformId === platform.id ? [index] : [],
        ),
        ...(platform.type === "moving-platform"
          ? { motion: platform.motion }
          : {}),
      };
    }),
    routes: { mainPath: level.mainPath, branches: level.branches },
    connections: level.connections.map((connection, index) => ({
      index,
      ...connection,
    })),
    anchors: LEVEL_EDITOR_ANCHOR_SLOTS.map((slot) =>
      describeAnchor(slot, ANCHOR_SLOT_READERS[slot](level.anchors)),
    ),
  };
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
        limits: AUTHORED_LEVEL_LIMITS,
        sectionLimits: LEVEL_EDITOR_SECTION_LIMITS,
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
          spatial: describeChapterSpace(chapter.level),
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
