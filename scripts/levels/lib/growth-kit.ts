/**
 * Small, typed builders for DESIGN-025 D-06 world generators.
 *
 * A generator is ordinary TypeScript that emits editor command batches through
 * the shared editor/CLI vocabulary. These helpers only compute geometry and
 * shape JSON: they never apply, validate or bypass anything. The emitted
 * commands replay byte-identically under `pnpm levels:validate`, and the
 * shared validators stay the single authority on whether a course is safe.
 *
 * Coordinates are metres. A box is described by its standing `top` and
 * horizontal footprint; thickness defaults to 0.6 m like the published
 * terraces.
 */
import type {
  AuthoredBouncePadPiece,
  AuthoredCheckpointPiece,
  AuthoredConnection,
  AuthoredLevelPiece,
  AuthoredLiftPiece,
  AuthoredPlatformPiece,
} from "../../../src/shared/authored-level.js";
import type {
  BouncePadStrength,
  RequirableGrowthMove,
} from "../../../src/shared/abilities.js";
import type { LevelEditorCommand } from "../../../src/shared/editor-project.js";

export interface Footprint {
  /** Centre of the footprint. */
  readonly x: number;
  readonly z: number;
  /** Full extents. */
  readonly sizeX: number;
  readonly sizeZ: number;
}

export interface SurfaceSpec extends Footprint {
  /** Standing height of the top face. */
  readonly top: number;
  /** Box height below the top; defaults to 0.6 m. */
  readonly thickness?: number;
}

const DEFAULT_THICKNESS = 0.6;

/** Rounds to the millimetre so generated JSON never carries float noise. */
export function mm(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function boxOf(spec: SurfaceSpec) {
  const thickness = spec.thickness ?? DEFAULT_THICKNESS;
  return {
    center: { x: mm(spec.x), y: mm(spec.top - thickness / 2), z: mm(spec.z) },
    size: { x: mm(spec.sizeX), y: mm(thickness), z: mm(spec.sizeZ) },
  };
}

/** A static platform whose top face sits at `spec.top`. */
export function platform(id: string, spec: SurfaceSpec): AuthoredPlatformPiece {
  return { type: "platform", id, ...boxOf(spec) };
}

export interface LiftSpec extends Footprint {
  /** Standing height at the bottom stop. */
  readonly bottomTop: number;
  /** Metres between the bottom and top stops (0.5–8). */
  readonly distance: number;
  /** Seconds per full up-and-down cycle (4–20). */
  readonly period: number;
  readonly thickness?: number;
  readonly phase?: number;
}

/** A lift that starts at its bottom stop at t=0 (phase 0). */
export function lift(id: string, spec: LiftSpec): AuthoredLiftPiece {
  return {
    type: "lift",
    id,
    ...boxOf({ ...spec, top: spec.bottomTop }),
    travel: {
      distance: mm(spec.distance),
      period: mm(spec.period),
      ...(spec.phase === undefined ? {} : { phase: spec.phase }),
    },
  };
}

export interface BouncePadSpec extends SurfaceSpec {
  readonly strength: BouncePadStrength;
}

/** A bounce pad; its footprint must be at least 1.2 × 1.2 m. */
export function bouncePad(id: string, spec: BouncePadSpec): AuthoredBouncePadPiece {
  return { type: "bounce-pad", id, ...boxOf(spec), strength: spec.strength };
}

/** A checkpoint armed anywhere on its (static) platform. */
export function platformCheckpoint(
  id: string,
  platformId: string,
  position: { readonly x: number; readonly y: number; readonly z: number },
): AuthoredCheckpointPiece {
  return {
    type: "checkpoint",
    id,
    platformId,
    position: { x: mm(position.x), y: mm(position.y), z: mm(position.z) },
    activation: { type: "platform" },
  };
}

export function walk(from: string, to: string): AuthoredConnection {
  return { from, to, mode: "walk" };
}

export function jump(
  from: string,
  to: string,
  options: {
    readonly requires?: RequirableGrowthMove;
    readonly safeMissPlatformId?: string;
  } = {},
): AuthoredConnection {
  return {
    from,
    to,
    mode: "jump",
    ...(options.safeMissPlatformId
      ? { safeMissPlatformId: options.safeMissPlatformId }
      : {}),
    ...(options.requires ? { requires: options.requires } : {}),
  };
}

export function ride(from: string, to: string): AuthoredConnection {
  return { from, to, mode: "ride" };
}

export function bounce(from: string, to: string): AuthoredConnection {
  return { from, to, mode: "bounce" };
}

// ---------------------------------------------------------------------------
// Command wrappers: one chapter at a time.
// ---------------------------------------------------------------------------

export interface ChapterCommands {
  readonly upgrade: () => LevelEditorCommand;
  readonly add: (piece: AuthoredLevelPiece) => LevelEditorCommand;
  readonly update: (piece: AuthoredLevelPiece) => LevelEditorCommand;
  readonly rename: (pieceId: string, newPieceId: string) => LevelEditorCommand;
  readonly remove: (pieceId: string) => LevelEditorCommand;
  readonly connect: (connection: AuthoredConnection) => LevelEditorCommand;
  readonly reconnect: (
    match: Pick<AuthoredConnection, "from" | "to" | "mode">,
    connection: AuthoredConnection,
  ) => LevelEditorCommand;
  readonly disconnect: (
    match: Pick<AuthoredConnection, "from" | "to" | "mode">,
  ) => LevelEditorCommand;
  readonly mainPath: (platformIds: readonly string[]) => LevelEditorCommand;
  readonly branch: (platformIds: readonly string[]) => LevelEditorCommand;
}

export function chapterCommands(chapterId: string): ChapterCommands {
  return {
    upgrade: () => ({
      type: "chapter.level.upgrade",
      chapterId,
      schemaVersion: "authored-level-v4",
    }),
    add: (piece) => ({ type: "piece.add", chapterId, piece }),
    // Growth pieces carry no anchors; attachments are never moved implicitly.
    update: (piece) => ({
      type: "piece.update",
      chapterId,
      pieceId: piece.id,
      piece,
      carryAttached: false,
    }),
    rename: (pieceId, newPieceId) => ({
      type: "piece.rename",
      chapterId,
      pieceId,
      newPieceId,
    }),
    remove: (pieceId) => ({ type: "piece.remove", chapterId, pieceId }),
    connect: (connection) => ({ type: "connection.add", chapterId, connection }),
    reconnect: (match, connection) => ({
      type: "connection.update",
      chapterId,
      match: { from: match.from, to: match.to, mode: match.mode },
      connection,
    }),
    disconnect: (match) => ({
      type: "connection.remove",
      chapterId,
      match: { from: match.from, to: match.to, mode: match.mode },
    }),
    mainPath: (platformIds) => ({
      type: "main-path.set",
      chapterId,
      platformIds: [...platformIds],
    }),
    branch: (platformIds) => ({
      type: "branch.add",
      chapterId,
      platformIds: [...platformIds],
    }),
  };
}
