/**
 * Fixtures shared by the section-command tests.
 *
 * The shipped chapters both run along -z, so a course laid out on the other
 * horizontal axis is the only way to tell a genuinely axis-derived section from
 * one that happens to agree with the templates. `rotatedGardenProject` turns
 * chapter one a quarter turn and moves it, which leaves every published rule
 * satisfied because all of them are written in distances rather than absolute
 * coordinates.
 */
import {
  applyLevelEditorCommand,
  createLevelEditorProject,
  parseLevelEditorProject,
  type LevelEditorChapterId,
  type LevelEditorProject,
} from "../../src/shared/editor-project";
import type {
  AuthoredLevelDocument,
  AuthoredPlatformPiece,
  AuthoredPosition,
} from "../../src/shared/authored-level";

/** Quarter turn about the vertical axis, then a translation. */
export const ROTATION_OFFSET = Object.freeze({ x: -40, z: 15 });

interface JsonRecord {
  [key: string]: unknown;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** (x, z) -> (-z, x), then the fixture offset. */
export function rotatePoint(point: AuthoredPosition): AuthoredPosition {
  return {
    x: -point.z + ROTATION_OFFSET.x,
    y: point.y,
    z: point.x + ROTATION_OFFSET.z,
  };
}

function rotateInPlace(value: unknown): void {
  if (Array.isArray(value)) {
    for (const entry of value) rotateInPlace(entry);
    return;
  }
  if (!isRecord(value)) return;

  const { center, position, size, arena, motion } = value;
  if (isRecord(center)) value.center = rotatePoint(center as unknown as AuthoredPosition);
  if (isRecord(position))
    value.position = rotatePoint(position as unknown as AuthoredPosition);
  if (isRecord(size))
    value.size = { x: size.z, y: size.y, z: size.x } as JsonRecord;
  if (isRecord(arena)) {
    const { minX, maxX, minZ, maxZ } = arena as Record<string, number>;
    value.arena = {
      minX: -maxZ + ROTATION_OFFSET.x,
      maxX: -minZ + ROTATION_OFFSET.x,
      minZ: minX + ROTATION_OFFSET.z,
      maxZ: maxX + ROTATION_OFFSET.z,
    };
  }
  if (isRecord(motion) && (motion.axis === "x" || motion.axis === "z"))
    motion.axis = motion.axis === "x" ? "z" : "x";

  for (const entry of Object.values(value))
    if (entry !== center && entry !== position && entry !== size && entry !== arena)
      rotateInPlace(entry);
}

/**
 * Chapter one turned a quarter turn and moved. Sweepers are dropped: their bar
 * is authored along x with no axis field, so they are the one piece a rotation
 * cannot express, and they only ever remove options from a section.
 */
export function rotatedGardenProject(): LevelEditorProject {
  const template = createLevelEditorProject({
    projectId: "rotated-garden",
    name: "Rotated garden",
  });
  const raw = JSON.parse(JSON.stringify(template)) as {
    chapters: Array<{ level: { pieces: Array<{ type: string }> } }>;
  };
  const level = raw.chapters[0]!.level;
  level.pieces = level.pieces.filter((piece) => piece.type !== "sweeper");
  rotateInPlace(level);
  return parseLevelEditorProject(raw);
}

/** A valid uneven-height long span that needs one extra descent landing. */
export function raisedGardenPicnicProject(): LevelEditorProject {
  const template = createLevelEditorProject({
    projectId: "raised-garden-picnic",
    name: "Raised garden picnic",
  });
  const moved = applyLevelEditorCommand(template, {
    type: "piece.move",
    chapterId: "chapter-1",
    pieceId: "picnic",
    position: { x: 0, y: 0, z: -33.8 },
  });
  if (!moved.ok)
    throw new Error(
      `Could not raise the garden picnic fixture: ${JSON.stringify(moved.issues)}`,
    );
  return moved.project;
}

export function chapterLevel(
  project: LevelEditorProject,
  chapterId: LevelEditorChapterId,
): AuthoredLevelDocument {
  const chapter = project.chapters.find((entry) => entry.chapterId === chapterId);
  if (!chapter) throw new Error(`Missing ${chapterId}`);
  return chapter.level;
}

/** Every step platform a section built with `idPrefix` created, in climb order. */
export function sectionSteps(
  level: AuthoredLevelDocument,
  idPrefix: string,
): AuthoredPlatformPiece[] {
  return level.pieces.filter(
    (piece): piece is AuthoredPlatformPiece =>
      piece.type === "platform" && piece.id.startsWith(`${idPrefix}-step-`),
  );
}

export function platformTop(platform: AuthoredPlatformPiece): number {
  return platform.center.y + platform.size.y / 2;
}
