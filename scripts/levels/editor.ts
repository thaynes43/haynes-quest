import { readFile, stat } from "node:fs/promises";
import { z } from "zod";
import { LEVEL_EDITOR_SECTION_LIMITS } from "../../src/shared/editor-sections.js";

import {
  AUTHORED_LEVEL_LIMITS,
  AUTHORED_LEVEL_V4_LIMITS,
  authoredSurfaceTopRange,
  isAuthoredSurfacePiece,
  type AuthoredAnchor,
  type AuthoredEncounterAnchor,
  type AuthoredLevelAnchors,
  type AuthoredLevelPiece,
  type AuthoredSurfacePiece,
} from "../../src/shared/authored-level.js";
import {
  decorWorldBounds,
  placeableThemeKitProps,
  themeKitProp,
} from "../../src/shared/theme-kits.js";
import {
  abilitiesForAge,
  GROWTH_MOVE_PHYSICS,
  GROWTH_MOVE_UNLOCK_AGES,
  BOUNCE_PAD_VELOCITY,
} from "../../src/shared/abilities.js";
import {
  LEVEL_EDITOR_ANCHOR_SLOTS,
  LEVEL_EDITOR_CATALOG_VERSIONS,
  type LevelEditorCatalogVersion,
  LEVEL_EDITOR_COMMAND_BATCH_MAX_BYTES,
  LEVEL_EDITOR_PROJECT_MAX_BYTES,
  type LevelEditorAnchorSlot,
  type LevelEditorLevelDocument,
  applyLevelEditorCommands,
  createLevelEditorProject,
  createWorldEditorProject,
  levelEditorCommandBatchSchema,
  levelEditorProjectSchema,
  parseLevelEditorProjectJson,
  serializeLevelEditorProject,
  validateLevelEditorProject,
} from "../../src/shared/editor-project.js";

const usage = `Usage:
  tsx scripts/levels/editor.ts template <project-id> [name]
  tsx scripts/levels/editor.ts world-template <project-id> [name] [--catalog <version>]
  tsx scripts/levels/editor.ts inspect <project.json>
  tsx scripts/levels/editor.ts level <project.json> <chapter-id>
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

type EditorPlatformPiece = AuthoredSurfacePiece;

interface HorizontalExtent {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

const ANCHOR_SLOT_READERS: Readonly<
  Record<
    LevelEditorAnchorSlot,
    (
      anchors: AuthoredLevelAnchors,
    ) => AuthoredAnchor | AuthoredEncounterAnchor | undefined
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
  "encounter.bonus-1": (anchors) => anchors.encounters["bonus-1"],
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
  return isAuthoredSurfacePiece(piece);
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
        // V4 growth pieces (DESIGN-025): a lift reports both stop tops and
        // its travel; a pad reports its launch strength and apex.
        ...(platform.type === "lift"
          ? {
              travel: platform.travel,
              stopTops: {
                bottom: derivedMetres(authoredSurfaceTopRange(platform).min),
                top: derivedMetres(authoredSurfaceTopRange(platform).max),
              },
              // A dwell pauses the lift at each stop: one full cycle lasts
              // the travel period plus both pauses.
              dwellSeconds: platform.travel.dwell ?? 0,
              cycleSeconds: derivedMetres(
                platform.travel.period + 2 * (platform.travel.dwell ?? 0),
              ),
            }
          : {}),
        ...(platform.type === "bounce-pad"
          ? {
              strength: platform.strength,
              launchApex: derivedMetres(
                BOUNCE_PAD_VELOCITY[platform.strength] ** 2 / 30,
              ),
            }
          : {}),
      };
    }),
    routes: { mainPath: level.mainPath, branches: level.branches },
    connections: level.connections.map((connection, index) => ({
      index,
      ...connection,
    })),
    anchors: LEVEL_EDITOR_ANCHOR_SLOTS.flatMap((slot) => {
      const anchor = ANCHOR_SLOT_READERS[slot](level.anchors);
      return anchor ? [describeAnchor(slot, anchor)] : [];
    }),
    // V4 only (DESIGN-025 D-05): placed props with their world boxes, and the
    // props this level's theme kit offers.
    ...(level.schemaVersion === "authored-level-v4"
      ? {
          decor: (level.decor ?? []).map((entry) => {
            const prop = themeKitProp(entry.kitPropId);
            return {
              ...entry,
              worldBounds: prop ? decorWorldBounds(prop.bounds, entry) : null,
            };
          }),
          // The theme's own kit, then the shared kit every v4 theme may use.
          themeKitProps: placeableThemeKitProps(level.theme).map((prop) => ({
            id: prop.id,
            kit: prop.theme,
            bounds: prop.bounds,
            model: prop.glb?.url ?? null,
          })),
        }
      : {}),
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

    case "world-template": {
      // `--catalog <version>` pins the parody catalog, for example
      // parody-catalog-v8 for the family worlds; the default is current.
      const flag = values.indexOf("--catalog");
      const catalogVersion = flag >= 0 ? values[flag + 1] : undefined;
      if (flag >= 0 && catalogVersion === undefined) throw new Error(usage);
      const positional = flag >= 0 ? values.filter((_, index) => index !== flag && index !== flag + 1) : values;
      requireArgumentCount(positional, 1, 2);
      const [projectId, name] = positional;
      requireArgument(projectId, "project id");
      if (
        catalogVersion !== undefined &&
        !(LEVEL_EDITOR_CATALOG_VERSIONS as readonly string[]).includes(catalogVersion)
      )
        throw new Error(
          `Unknown catalog ${JSON.stringify(catalogVersion)}; use one of ${LEVEL_EDITOR_CATALOG_VERSIONS.join(", ")}\n${usage}`,
        );
      process.stdout.write(
        serializeLevelEditorProject(
          createWorldEditorProject({
            projectId,
            ...(name === undefined ? {} : { name }),
            ...(catalogVersion === undefined
              ? {}
              : { catalogVersion: catalogVersion as LevelEditorCatalogVersion }),
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
        growth: {
          limits: AUTHORED_LEVEL_V4_LIMITS,
          unlockAges: GROWTH_MOVE_UNLOCK_AGES,
          physics: GROWTH_MOVE_PHYSICS,
          bouncePadVelocity: BOUNCE_PAD_VELOCITY,
        },
        chapters: project.chapters.map((chapter) => ({
          chapterId: chapter.chapterId,
          name: chapter.name,
          ...(project.schemaVersion === "level-editor-project-v2" &&
          "routeId" in chapter
            ? {
                routeId: chapter.routeId,
                sourceTemplateId: chapter.sourceTemplateId,
                levelSchemaVersion: chapter.level.schemaVersion,
                representedDateRange: chapter.representedDateRange,
                recoveredAge: chapter.recoveredAge,
                // The moves a required route may use in this chapter.
                growthMoves: abilitiesForAge(chapter.recoveredAge.fromYears),
                previewMemories: chapter.previewMemories,
                encounterSlots: chapter.encounterSlots,
              }
            : {
                templateRouteId: "templateRouteId" in chapter
                  ? chapter.templateRouteId
                  : undefined,
              }),
          pieces: chapter.level.pieces.length,
          platforms: chapter.level.pieces.filter(isPlatformPiece).length,
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

    case "level": {
      // One chapter's level document, ready to edit and send back with
      // chapter.level.replace.
      requireArgumentCount(values, 2);
      const [path, chapterId] = values;
      requireArgument(path, "project path");
      requireArgument(chapterId, "chapter id");
      const project = await readProject(path);
      const chapter = project.chapters.find(
        (entry) => entry.chapterId === chapterId,
      );
      if (!chapter)
        throw new CliInputError(`Chapter ${chapterId} does not exist`, {
          path: "$.chapterId",
          code: "chapter.missing",
          message: `Chapter ${chapterId} does not exist`,
        });
      writeJson(chapter.level);
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
      const schema = z.toJSONSchema(
        target === "project"
          ? levelEditorProjectSchema
          : levelEditorCommandBatchSchema,
      );
      writeJson(target === "project" ? { ...schema, type: "object" } : schema);
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
