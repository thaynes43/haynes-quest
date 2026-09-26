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
  AuthoredAnchor,
  AuthoredBouncePadPiece,
  AuthoredCheckpointPiece,
  AuthoredConnection,
  AuthoredCrumblePiece,
  AuthoredDecor,
  AuthoredEncounterAnchor,
  AuthoredEncounterSlot,
  AuthoredLevelPiece,
  AuthoredLevelTheme,
  AuthoredLiftPiece,
  AuthoredPlatformPiece,
} from "../../../src/shared/authored-level.js";
import type {
  BouncePadStrength,
  RequirableGrowthMove,
} from "../../../src/shared/abilities.js";
import {
  LEVEL_EDITOR_CHAPTER_IDS,
  type LevelEditorAnchorSlot,
  type LevelEditorChapterV2,
  type LevelEditorCommand,
  type LevelEditorEncounterReference,
  type LevelEditorEnemyCandidate,
  type WorldEditorLevelDocument,
} from "../../../src/shared/editor-project.js";

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
  /** Seconds of travel per full up-and-down cycle (4–20). */
  readonly period: number;
  readonly thickness?: number;
  readonly phase?: number;
  /**
   * Seconds the lift waits at each stop (0–3). A full cycle then lasts
   * `period + 2 × dwell`. Zero or absent emits no field: the original motion.
   */
  readonly dwell?: number;
}

/** A lift that starts at its bottom stop at t=0 (phase 0), dwell first. */
export function lift(id: string, spec: LiftSpec): AuthoredLiftPiece {
  return {
    type: "lift",
    id,
    ...boxOf({ ...spec, top: spec.bottomTop }),
    travel: {
      distance: mm(spec.distance),
      period: mm(spec.period),
      ...(spec.phase === undefined ? {} : { phase: spec.phase }),
      ...(spec.dwell === undefined || spec.dwell === 0
        ? {}
        : { dwell: mm(spec.dwell) }),
    },
  };
}

/** Seconds per full lift cycle, pauses included. */
export function liftCycleSeconds(piece: AuthoredLiftPiece): number {
  return piece.travel.period + 2 * (piece.travel.dwell ?? 0);
}

export interface BouncePadSpec extends SurfaceSpec {
  readonly strength: BouncePadStrength;
}

/** A bounce pad; its footprint must be at least 1.2 × 1.2 m. */
export function bouncePad(id: string, spec: BouncePadSpec): AuthoredBouncePadPiece {
  return { type: "bounce-pad", id, ...boxOf(spec), strength: spec.strength };
}

/** A crumbling platform (branch routes only). */
export function crumble(id: string, spec: SurfaceSpec): AuthoredCrumblePiece {
  return { type: "crumble", id, ...boxOf(spec) };
}

/** A placed theme-kit prop; `position` is the prop's floor centre. */
export function decor(
  id: string,
  kitPropId: string,
  position: { readonly x: number; readonly y: number; readonly z: number },
  options: { readonly rotationY?: number; readonly scale?: number } = {},
): AuthoredDecor {
  return {
    id,
    kitPropId,
    position: { x: mm(position.x), y: mm(position.y), z: mm(position.z) },
    rotationY: options.rotationY ?? 0,
    scale: options.scale ?? 1,
  };
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

/**
 * A bounce from a pad. A `safeMissPlatformId` makes it a practice bounce over
 * a catch floor (v4), which needs a retry connection like a practice jump.
 */
export function bounce(
  from: string,
  to: string,
  options: { readonly safeMissPlatformId?: string } = {},
): AuthoredConnection {
  return {
    from,
    to,
    mode: "bounce",
    ...(options.safeMissPlatformId
      ? { safeMissPlatformId: options.safeMissPlatformId }
      : {}),
  };
}

/**
 * A step or hop down to a lower static surface at any age (v4): it descends
 * 0.36–3 m across at most a 1.4 m gap, with a jump's gateway strips.
 */
export function drop(from: string, to: string): AuthoredConnection {
  return { from, to, mode: "drop" };
}

// ---------------------------------------------------------------------------
// Command wrappers: one chapter at a time.
// ---------------------------------------------------------------------------

export interface ChapterCommands {
  readonly upgrade: () => LevelEditorCommand;
  /** Replaces the whole (already v4) level; its id must be the route id. */
  readonly replaceLevel: (level: WorldEditorLevelDocument) => LevelEditorCommand;
  readonly setAnchor: (
    slot: LevelEditorAnchorSlot,
    value: AuthoredAnchor | AuthoredEncounterAnchor,
  ) => LevelEditorCommand;
  readonly assign: (
    slot: AuthoredEncounterSlot,
    encounter: LevelEditorEncounterReference,
  ) => LevelEditorCommand;
  /** Adds a project candidate and assigns it to the slot (its anchor must exist). */
  readonly addCandidate: (
    slot: AuthoredEncounterSlot,
    candidate: LevelEditorEnemyCandidate,
  ) => LevelEditorCommand;
  readonly addBonus: (
    anchor: AuthoredEncounterAnchor,
    encounter: LevelEditorEncounterReference,
  ) => LevelEditorCommand;
  readonly removeBonus: () => LevelEditorCommand;
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
  readonly addDecor: (entry: AuthoredDecor) => LevelEditorCommand;
  readonly removeDecor: (decorId: string) => LevelEditorCommand;
}

export function chapterCommands(chapterId: string): ChapterCommands {
  return {
    upgrade: () => ({
      type: "chapter.level.upgrade",
      chapterId,
      schemaVersion: "authored-level-v4",
    }),
    replaceLevel: (level) => ({ type: "chapter.level.replace", chapterId, level }),
    setAnchor: (slot, value) => ({ type: "anchor.set", chapterId, slot, value }),
    assign: (slot, encounter) => ({
      type: "encounter.assign",
      chapterId,
      slot,
      encounter,
    }),
    addCandidate: (slot, candidate) => ({
      type: "enemy.add",
      chapterId,
      slot,
      candidate,
    }),
    addBonus: (anchor, encounter) => ({
      type: "encounter.bonus.add",
      chapterId,
      anchor,
      encounter,
    }),
    removeBonus: () => ({ type: "encounter.bonus.remove", chapterId }),
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
    addDecor: (entry) => ({ type: "decor.add", chapterId, decor: entry }),
    removeDecor: (decorId) => ({ type: "decor.remove", chapterId, decorId }),
  };
}

// ---------------------------------------------------------------------------
// World shell: one generator owns the whole chapter list.
// ---------------------------------------------------------------------------

export interface WorldShellChapter {
  readonly chapterId: string;
  readonly routeId: string;
  readonly name: string;
  readonly subtitle: string;
  readonly description: string;
  readonly theme: AuthoredLevelTheme;
  readonly representedDateRange: LevelEditorChapterV2["representedDateRange"];
  readonly recoveredAge: LevelEditorChapterV2["recoveredAge"];
  readonly previewMemories: LevelEditorChapterV2["previewMemories"];
}

export interface WorldShellSpec {
  /** Renames the project when present. */
  readonly name?: string;
  readonly fictionalBirthDate: string;
  /** In play order; ids must differ from the seeded `chapter-1` and `chapter-2`. */
  readonly chapters: readonly WorldShellChapter[];
}

/**
 * Commands that turn `createWorldEditorProject`'s two seeded chapters into
 * exactly `spec.chapters`, in order, each upgraded to authored-level-v4 with
 * its theme, dates, ages and preview memories. The seeds are removed; every
 * new chapter starts from the garden template until the generator replaces
 * its level (`chapterCommands(id).replaceLevel`) and assigns its cast. The
 * output depends only on `spec`, so a generator replays byte-identically.
 */
export function worldShellCommands(spec: WorldShellSpec): LevelEditorCommand[] {
  if (spec.chapters.length === 0)
    throw new Error("A world shell needs at least one chapter");
  const seeds = new Set<string>(LEVEL_EDITOR_CHAPTER_IDS);
  for (const chapter of spec.chapters)
    if (seeds.has(chapter.chapterId))
      throw new Error(
        `World shell chapter id ${chapter.chapterId} would collide with a seeded chapter`,
      );
  const commands: LevelEditorCommand[] = [];
  if (spec.name !== undefined) commands.push({ type: "project.rename", name: spec.name });
  commands.push({
    type: "project.birthdate.set",
    fictionalBirthDate: spec.fictionalBirthDate,
  });
  const add = (chapter: WorldShellChapter): LevelEditorCommand => ({
    type: "chapter.add",
    newChapterId: chapter.chapterId,
    newRouteId: chapter.routeId,
    sourceTemplateId: "garden-playground-v2",
    name: chapter.name,
    subtitle: chapter.subtitle,
    description: chapter.description,
  });
  // Add the first chapter, drop both seeds, then add the rest, so a world can
  // use the full chapter limit.
  commands.push(add(spec.chapters[0]!));
  for (const seed of LEVEL_EDITOR_CHAPTER_IDS)
    commands.push({ type: "chapter.remove", chapterId: seed });
  for (const chapter of spec.chapters.slice(1)) commands.push(add(chapter));
  for (const chapter of spec.chapters)
    commands.push(
      {
        type: "chapter.level.upgrade",
        chapterId: chapter.chapterId,
        schemaVersion: "authored-level-v4",
      },
      {
        type: "chapter.details.set",
        chapterId: chapter.chapterId,
        subtitle: chapter.subtitle,
        description: chapter.description,
        theme: chapter.theme,
        representedDateRange: chapter.representedDateRange,
        recoveredAge: chapter.recoveredAge,
        previewMemories: chapter.previewMemories,
      },
    );
  return commands;
}
