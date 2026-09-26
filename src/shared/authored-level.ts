import { z } from "zod";

import type { ObbyCourse } from "../game/obby";
import { decorWorldBounds, SHARED_THEME_KIT, themeKitProp } from "./theme-kits";
import {
  BOUNCE_PAD_VELOCITY,
  REQUIRABLE_GROWTH_MOVES,
  type BouncePadStrength,
  type RequirableGrowthMove,
} from "./abilities";

export const AUTHORED_LEVEL_SCHEMA_VERSION = "authored-level-v1" as const;
export const AUTHORED_LEVEL_SCHEMA_VERSION_V2 = "authored-level-v2" as const;
export const AUTHORED_LEVEL_SCHEMA_VERSION_V3 = "authored-level-v3" as const;
/**
 * World-project-only documents with growth-move connections and vertical
 * pieces (DESIGN-025 D-03/D-04). Published routes never use it.
 */
export const AUTHORED_LEVEL_SCHEMA_VERSION_V4 = "authored-level-v4" as const;
export const AUTHORED_LEVEL_SCHEMA_VERSIONS = [
  AUTHORED_LEVEL_SCHEMA_VERSION,
  AUTHORED_LEVEL_SCHEMA_VERSION_V2,
  AUTHORED_LEVEL_SCHEMA_VERSION_V3,
  AUTHORED_LEVEL_SCHEMA_VERSION_V4,
] as const;
export const AUTHORED_LEVEL_V1_IDS = [
  "garden-playground-v1",
  "besties-playground-v1",
] as const;
export const AUTHORED_LEVEL_V2_IDS = [
  "garden-playground-v2",
  "besties-playground-v2",
] as const;
export const AUTHORED_LEVEL_IDS = [
  ...AUTHORED_LEVEL_V1_IDS,
  ...AUTHORED_LEVEL_V2_IDS,
] as const;

export type AuthoredLevelSchemaVersion =
  (typeof AUTHORED_LEVEL_SCHEMA_VERSIONS)[number];
/**
 * V1/V2 documents use one of the immutable published ids above. V3 documents
 * use a project-local identifier, so consumers must treat the resolved id as
 * an opaque string rather than infer gameplay or art from its spelling.
 */
export type AuthoredLevelId = (typeof AUTHORED_LEVEL_IDS)[number] | string;
/** Themes every world document (v3 and v4) may use. */
export const AUTHORED_LEVEL_WORLD_THEMES = [
  "garden",
  "party",
  "arcade",
  "toybox",
  "casino",
] as const;
/**
 * Family-world era themes (DESIGN-025 D-05, DESIGN-026). Only
 * authored-level-v4 documents may use them, so v3 documents and published
 * routes keep exactly the themes they had.
 */
export const AUTHORED_LEVEL_V4_ONLY_THEMES = [
  "clubhouse",
  "harbor",
  "rooftop",
  "playroom",
  "casita",
] as const;
export const AUTHORED_LEVEL_V4_THEMES = [
  ...AUTHORED_LEVEL_WORLD_THEMES,
  ...AUTHORED_LEVEL_V4_ONLY_THEMES,
] as const;
export type AuthoredLevelTheme = (typeof AUTHORED_LEVEL_V4_THEMES)[number];
/** `bounce` and `drop` exist only in authored-level-v4 documents. */
export type AuthoredConnectionMode = "walk" | "jump" | "ride" | "bounce" | "drop";
export const AUTHORED_REQUIRED_ENCOUNTER_SLOTS = [
  "ordinary-1",
  "ordinary-2",
  "ordinary-3",
  "ordinary-4",
  "boss",
] as const;
export const AUTHORED_BONUS_ENCOUNTER_SLOTS = ["bonus-1"] as const;
export const AUTHORED_ENCOUNTER_SLOTS = [
  ...AUTHORED_REQUIRED_ENCOUNTER_SLOTS,
  ...AUTHORED_BONUS_ENCOUNTER_SLOTS,
] as const;
export type AuthoredRequiredEncounterSlot =
  (typeof AUTHORED_REQUIRED_ENCOUNTER_SLOTS)[number];
export type AuthoredBonusEncounterSlot =
  (typeof AUTHORED_BONUS_ENCOUNTER_SLOTS)[number];
export type AuthoredEncounterSlot = (typeof AUTHORED_ENCOUNTER_SLOTS)[number];

export interface AuthoredPosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface AuthoredMotion {
  readonly axis: "x" | "z";
  readonly distance: number;
  readonly period: number;
  readonly phase?: number;
}

export interface AuthoredRotation {
  readonly period: number;
  readonly phase?: number;
}

export interface AuthoredPlatformPiece {
  readonly type: "platform";
  readonly id: string;
  readonly center: AuthoredPosition;
  readonly size: AuthoredPosition;
}

export interface AuthoredMovingPlatformPiece {
  readonly type: "moving-platform";
  readonly id: string;
  readonly center: AuthoredPosition;
  readonly size: AuthoredPosition;
  readonly motion: AuthoredMotion;
}

export interface AuthoredSweeperPiece {
  readonly type: "sweeper";
  readonly id: string;
  readonly center: AuthoredPosition;
  readonly halfLength: number;
  readonly radius: number;
  readonly motion?: AuthoredMotion;
  readonly rotation?: AuthoredRotation;
}

export type AuthoredCheckpointActivation =
  | { readonly type: "radius"; readonly radius: number }
  | {
      readonly type: "box";
      readonly halfExtents: Readonly<{ x: number; z: number }>;
    }
  | { readonly type: "platform" };

export interface AuthoredCheckpointPiece {
  readonly type: "checkpoint";
  readonly id: string;
  readonly position: AuthoredPosition;
  readonly platformId: string;
  readonly activation: AuthoredCheckpointActivation;
}

/**
 * A v4 lift: a platform that moves straight up and down with sine motion.
 * `center` is the bottom stop; the top stop is `distance` metres higher. The
 * lift starts at the bottom stop at t=0 when `phase` is 0 and needs
 * `period` seconds of travel for a full up-and-down cycle.
 *
 * `dwell` (0–3 s, default 0) pauses the lift at each stop, so a full cycle
 * takes `period + 2 × dwell` seconds: it waits at the bottom, rises for
 * `period / 2`, waits at the top and descends for `period / 2`. The travel
 * itself keeps the same eased speed profile, and a zero or absent dwell is
 * exactly the original motion.
 */
export interface AuthoredLiftTravel {
  readonly distance: number;
  readonly period: number;
  readonly phase?: number;
  readonly dwell?: number;
}

export interface AuthoredLiftPiece {
  readonly type: "lift";
  readonly id: string;
  readonly center: AuthoredPosition;
  readonly size: AuthoredPosition;
  readonly travel: AuthoredLiftTravel;
}

/** A v4 bounce pad: landing on it launches the player straight up. */
export interface AuthoredBouncePadPiece {
  readonly type: "bounce-pad";
  readonly id: string;
  readonly center: AuthoredPosition;
  readonly size: AuthoredPosition;
  readonly strength: BouncePadStrength;
}

/**
 * A v4 crumbling platform: it shakes for 0.8 s after the first touch, drops
 * away, and returns 3 s later. Branch routes only.
 */
export interface AuthoredCrumblePiece {
  readonly type: "crumble";
  readonly id: string;
  readonly center: AuthoredPosition;
  readonly size: AuthoredPosition;
}

export type AuthoredLevelPiece =
  | AuthoredPlatformPiece
  | AuthoredMovingPlatformPiece
  | AuthoredSweeperPiece
  | AuthoredCheckpointPiece
  | AuthoredLiftPiece
  | AuthoredBouncePadPiece
  | AuthoredCrumblePiece;

/** Every piece that is a solid, standable box. */
export type AuthoredSurfacePiece =
  | AuthoredPlatformPiece
  | AuthoredMovingPlatformPiece
  | AuthoredLiftPiece
  | AuthoredBouncePadPiece
  | AuthoredCrumblePiece;

/**
 * A v4 non-colliding prop instance from the theme-kit registry
 * (DESIGN-025 D-04/D-05). `position` is the prop's floor centre.
 */
export interface AuthoredDecor {
  readonly id: string;
  readonly kitPropId: string;
  readonly position: AuthoredPosition;
  readonly rotationY: number;
  readonly scale: number;
}

export interface AuthoredConnection {
  readonly from: string;
  readonly to: string;
  readonly mode: AuthoredConnectionMode;
  readonly safeMissPlatformId?: string;
  /** V4 only: the growth move this jump needs (DESIGN-025 D-03). */
  readonly requires?: RequirableGrowthMove;
}

export interface AuthoredAnchor {
  readonly position: AuthoredPosition;
  readonly platformId: string;
}

export interface AuthoredArena {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface AuthoredEncounterAnchor extends AuthoredAnchor {
  readonly kind: "ordinary-a" | "ordinary-b" | "boss";
  readonly arena: AuthoredArena;
  readonly checkpointId: string;
}

export interface AuthoredLevelAnchors {
  readonly spawn: AuthoredAnchor;
  readonly finish: AuthoredAnchor;
  readonly rewardRespawn: AuthoredAnchor;
  readonly pickups: Readonly<
    Record<"attack-tool" | "guard-tool", AuthoredAnchor>
  >;
  readonly memories: Readonly<
    Record<"minor-one" | "minor-two" | "major", AuthoredAnchor>
  >;
  readonly encounters: Readonly<
    Record<AuthoredRequiredEncounterSlot, AuthoredEncounterAnchor> &
      Partial<Record<AuthoredBonusEncounterSlot, AuthoredEncounterAnchor>>
  >;
  readonly friendlies: Readonly<
    Record<"friendly-1" | "friendly-2" | "friendly-3", AuthoredAnchor>
  >;
}

export interface AuthoredLevelDocument {
  readonly schemaVersion: AuthoredLevelSchemaVersion;
  readonly id: AuthoredLevelId;
  readonly theme: AuthoredLevelTheme;
  readonly pieces: readonly AuthoredLevelPiece[];
  readonly connections: readonly AuthoredConnection[];
  readonly mainPath: readonly string[];
  readonly branches: readonly (readonly string[])[];
  readonly anchors: AuthoredLevelAnchors;
  /** V4 only; absent means no placed props. */
  readonly decor?: readonly AuthoredDecor[];
}

export interface AuthoredLevelGraph {
  readonly connections: readonly AuthoredConnection[];
  readonly mainPath: readonly string[];
  readonly branches: readonly (readonly string[])[];
}

export interface ResolvedAuthoredLevel {
  readonly document: AuthoredLevelDocument;
  readonly course: ObbyCourse;
  readonly graph: AuthoredLevelGraph;
  readonly anchors: AuthoredLevelAnchors;
}

export interface AuthoredLevelIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export const AUTHORED_LEVEL_LIMITS = Object.freeze({
  coordinateMagnitude: 256,
  verticalCoordinateMagnitude: 32,
  maxPlatformSize: 80,
  maxPieces: 168,
  maxPlatforms: 96,
  maxHazards: 24,
  maxCheckpoints: 48,
  maxConnections: 192,
  maxPathNodes: 96,
  maxBranches: 12,
  maxBranchNodes: 48,
  maxMotionDistance: 16,
  minMotionPeriod: 1,
  maxMotionPeriod: 120,
  maxSweeperHalfLength: 12,
  maxSweeperRadius: 2,
  maxSceneSpan: 180,
  maxStaticPlatformArea: 4_000,
  maxConnectionGap: 1.4,
  maxConnectionRise: 0.35,
  maxWalkGap: 0.05,
  maxWalkRise: 0.015,
  supportEdgeClearance: 0.3,
  actorHeight: 1.22,
  ordinaryAttackReach: 1.35,
  bossAttackReach: 2.25,
  fallThresholdY: -2,
} as const);

/**
 * DESIGN-025 limits for authored-level-v4. Kept apart from
 * `AUTHORED_LEVEL_LIMITS` so published documents, their validation results
 * and the editor CLI's reported limits stay exactly as they were.
 *
 * Each growth move's rise/gap is roughly 60–75% of its physical reach.
 * `glide` has no rise allowance: it must descend by at least `minDescent`.
 * Bounce limits are per pad strength; `big` is the design table's 2.6 m, and
 * `small` keeps the same forgiveness against its lower apex.
 */
export const AUTHORED_LEVEL_V4_LIMITS = Object.freeze({
  requires: Object.freeze({
    "high-jump": Object.freeze({ maxRise: 0.7, maxGap: 1.7 }),
    "double-jump": Object.freeze({ maxRise: 1.3, maxGap: 2.4 }),
    glide: Object.freeze({ maxRise: 0, minDescent: 0.8, maxGap: 4 }),
  }),
  bounce: Object.freeze({
    small: Object.freeze({ maxRise: 1.3, maxGap: 2.2 }),
    big: Object.freeze({ maxRise: 2.6, maxGap: 2.2 }),
  }),
  minBouncePadSize: 1.2,
  minLiftDistance: 0.5,
  maxLiftDistance: 8,
  minLiftPeriod: 4,
  maxLiftPeriod: 20,
  /** Seconds a lift may pause at each stop. */
  maxLiftDwell: 3,
  /**
   * `drop` connections step or hop down to a lower static surface at any
   * age: they must descend more than a plain jump's rise allowance and no
   * more than 3 m, across at most a plain jump's gap.
   */
  drop: Object.freeze({ minDescent: 0.36, maxDescent: 3, maxGap: 1.4 }),
  crumbleShakeSeconds: 0.8,
  crumbleDownSeconds: 3,
  maxDecor: 200,
  minDecorScale: 0.25,
  maxDecorScale: 4,
  /** Walkable volume above a standing top, and the overhead-trim clearance. */
  walkableHeight: 2.4,
  overheadClearance: 3,
} as const);

const ID_PATTERN = /^[a-z][a-z0-9-]{0,79}$/;
const EPSILON = 1e-6;
const GATEWAY_CLEARANCE_LENGTH = 0.75;

const identifierSchema = z.string().regex(ID_PATTERN);
export const authoredLevelProjectRouteIdSchema = identifierSchema.refine(
  (value) => !(AUTHORED_LEVEL_IDS as readonly string[]).includes(value),
  "Project-local route ids cannot reuse an immutable published route id",
);
const horizontalNumberSchema = z
  .number()
  .min(-AUTHORED_LEVEL_LIMITS.coordinateMagnitude)
  .max(AUTHORED_LEVEL_LIMITS.coordinateMagnitude);
const verticalNumberSchema = z
  .number()
  .min(-AUTHORED_LEVEL_LIMITS.verticalCoordinateMagnitude)
  .max(AUTHORED_LEVEL_LIMITS.verticalCoordinateMagnitude);
const positionSchema = z
  .object({
    x: horizontalNumberSchema,
    y: verticalNumberSchema,
    z: horizontalNumberSchema,
  })
  .strict();
const positiveSizeSchema = z
  .object({
    x: z.number().positive().max(AUTHORED_LEVEL_LIMITS.maxPlatformSize),
    y: z.number().positive().max(AUTHORED_LEVEL_LIMITS.maxPlatformSize),
    z: z.number().positive().max(AUTHORED_LEVEL_LIMITS.maxPlatformSize),
  })
  .strict();
const motionSchema = z
  .object({
    axis: z.enum(["x", "z"]),
    distance: z
      .number()
      .positive()
      .max(AUTHORED_LEVEL_LIMITS.maxMotionDistance),
    period: z
      .number()
      .min(AUTHORED_LEVEL_LIMITS.minMotionPeriod)
      .max(AUTHORED_LEVEL_LIMITS.maxMotionPeriod),
    phase: z.number().min(-Math.PI * 2).max(Math.PI * 2).optional(),
  })
  .strict();
const rotationSchema = z
  .object({
    period: z
      .number()
      .min(AUTHORED_LEVEL_LIMITS.minMotionPeriod)
      .max(AUTHORED_LEVEL_LIMITS.maxMotionPeriod),
    phase: z.number().min(-Math.PI * 2).max(Math.PI * 2).optional(),
  })
  .strict();
const platformPieceSchema = z
  .object({
    type: z.literal("platform"),
    id: identifierSchema,
    center: positionSchema,
    size: positiveSizeSchema,
  })
  .strict();
const movingPlatformPieceSchema = z
  .object({
    type: z.literal("moving-platform"),
    id: identifierSchema,
    center: positionSchema,
    size: positiveSizeSchema,
    motion: motionSchema,
  })
  .strict();
const sweeperPieceSchema = z
  .object({
    type: z.literal("sweeper"),
    id: identifierSchema,
    center: positionSchema,
    halfLength: z
      .number()
      .positive()
      .max(AUTHORED_LEVEL_LIMITS.maxSweeperHalfLength),
    radius: z
      .number()
      .positive()
      .max(AUTHORED_LEVEL_LIMITS.maxSweeperRadius),
    motion: motionSchema.optional(),
    rotation: rotationSchema.optional(),
  })
  .strict();
const checkpointActivationSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("radius"),
      radius: z.number().positive().max(12),
    })
    .strict(),
  z
    .object({
      type: z.literal("box"),
      halfExtents: z
        .object({
          x: z.number().positive().max(12),
          z: z.number().positive().max(12),
        })
        .strict(),
    })
    .strict(),
  z.object({ type: z.literal("platform") }).strict(),
]);
const checkpointPieceSchema = z
  .object({
    type: z.literal("checkpoint"),
    id: identifierSchema,
    position: positionSchema,
    platformId: identifierSchema,
    activation: checkpointActivationSchema,
  })
  .strict();
const pieceSchema = z.discriminatedUnion("type", [
  platformPieceSchema,
  movingPlatformPieceSchema,
  sweeperPieceSchema,
  checkpointPieceSchema,
]);
const liftPieceSchema = z
  .object({
    type: z.literal("lift"),
    id: identifierSchema,
    center: positionSchema,
    size: positiveSizeSchema,
    travel: z
      .object({
        distance: z
          .number()
          .min(AUTHORED_LEVEL_V4_LIMITS.minLiftDistance)
          .max(AUTHORED_LEVEL_V4_LIMITS.maxLiftDistance),
        period: z
          .number()
          .min(AUTHORED_LEVEL_V4_LIMITS.minLiftPeriod)
          .max(AUTHORED_LEVEL_V4_LIMITS.maxLiftPeriod),
        phase: z.number().min(-Math.PI * 2).max(Math.PI * 2).optional(),
        dwell: z
          .number()
          .min(0)
          .max(AUTHORED_LEVEL_V4_LIMITS.maxLiftDwell)
          .optional(),
      })
      .strict(),
  })
  .strict();
const bouncePadPieceSchema = z
  .object({
    type: z.literal("bounce-pad"),
    id: identifierSchema,
    center: positionSchema,
    size: z
      .object({
        x: z
          .number()
          .min(AUTHORED_LEVEL_V4_LIMITS.minBouncePadSize)
          .max(AUTHORED_LEVEL_LIMITS.maxPlatformSize),
        y: z.number().positive().max(AUTHORED_LEVEL_LIMITS.maxPlatformSize),
        z: z
          .number()
          .min(AUTHORED_LEVEL_V4_LIMITS.minBouncePadSize)
          .max(AUTHORED_LEVEL_LIMITS.maxPlatformSize),
      })
      .strict(),
    strength: z.enum(["small", "big"]),
  })
  .strict();
const crumblePieceSchema = z
  .object({
    type: z.literal("crumble"),
    id: identifierSchema,
    center: positionSchema,
    size: positiveSizeSchema,
  })
  .strict();
/** V4 accepts every published piece plus the growth-course pieces. */
export const authoredLevelV4PieceSchema = z.discriminatedUnion("type", [
  platformPieceSchema,
  movingPlatformPieceSchema,
  sweeperPieceSchema,
  checkpointPieceSchema,
  liftPieceSchema,
  bouncePadPieceSchema,
  crumblePieceSchema,
]);
export const authoredDecorSchema = z
  .object({
    id: identifierSchema,
    kitPropId: identifierSchema,
    position: positionSchema,
    rotationY: z.number().min(-Math.PI * 2).max(Math.PI * 2),
    scale: z
      .number()
      .min(AUTHORED_LEVEL_V4_LIMITS.minDecorScale)
      .max(AUTHORED_LEVEL_V4_LIMITS.maxDecorScale),
  })
  .strict();
const connectionV1Schema = z
  .object({
    from: identifierSchema,
    to: identifierSchema,
    mode: z.enum(["walk", "jump", "ride"]),
  })
  .strict();
const connectionV2Schema = connectionV1Schema
  .extend({ safeMissPlatformId: identifierSchema.optional() })
  .strict();
/** V4 adds bounce and drop connections and ability-aware `requires`. */
export const authoredLevelV4ConnectionSchema = z
  .object({
    from: identifierSchema,
    to: identifierSchema,
    mode: z.enum(["walk", "jump", "ride", "bounce", "drop"]),
    safeMissPlatformId: identifierSchema.optional(),
    requires: z.enum(REQUIRABLE_GROWTH_MOVES).optional(),
  })
  .strict();
const anchorSchema = z
  .object({ position: positionSchema, platformId: identifierSchema })
  .strict();
const arenaSchema = z
  .object({
    minX: horizontalNumberSchema,
    maxX: horizontalNumberSchema,
    minZ: horizontalNumberSchema,
    maxZ: horizontalNumberSchema,
  })
  .strict();
const encounterAnchorSchema = anchorSchema.extend({
  kind: z.enum(["ordinary-a", "ordinary-b", "boss"]),
  arena: arenaSchema,
  checkpointId: identifierSchema,
}).strict();

const authoredLevelAnchorsSchema = z
  .object({
    spawn: anchorSchema,
    finish: anchorSchema,
    rewardRespawn: anchorSchema,
    pickups: z
      .object({
        "attack-tool": anchorSchema,
        "guard-tool": anchorSchema,
      })
      .strict(),
    memories: z
      .object({
        "minor-one": anchorSchema,
        "minor-two": anchorSchema,
        major: anchorSchema,
      })
      .strict(),
    encounters: z
      .object({
        "ordinary-1": encounterAnchorSchema,
        "ordinary-2": encounterAnchorSchema,
        "ordinary-3": encounterAnchorSchema,
        "ordinary-4": encounterAnchorSchema,
        boss: encounterAnchorSchema,
      })
      .strict(),
    friendlies: z
      .object({
        "friendly-1": anchorSchema,
        "friendly-2": anchorSchema,
        "friendly-3": anchorSchema,
      })
      .strict(),
  })
  .strict();

const authoredLevelV3AnchorsSchema = authoredLevelAnchorsSchema
  .extend({
    encounters: authoredLevelAnchorsSchema.shape.encounters
      .extend({ "bonus-1": encounterAnchorSchema.optional() })
      .strict(),
  })
  .strict();

const authoredLevelDocumentFields = {
  pieces: z.array(pieceSchema).min(1).max(AUTHORED_LEVEL_LIMITS.maxPieces),
  mainPath: z
    .array(identifierSchema)
    .min(2)
    .max(AUTHORED_LEVEL_LIMITS.maxPathNodes),
  branches: z
    .array(
      z
        .array(identifierSchema)
        .min(3)
        .max(AUTHORED_LEVEL_LIMITS.maxBranchNodes),
    )
    .max(AUTHORED_LEVEL_LIMITS.maxBranches),
  anchors: authoredLevelAnchorsSchema,
} as const;

const authoredLevelV1DocumentSchema = z
  .object({
    schemaVersion: z.literal(AUTHORED_LEVEL_SCHEMA_VERSION),
    id: z.enum(AUTHORED_LEVEL_V1_IDS),
    theme: z.enum(["garden", "party"]),
    ...authoredLevelDocumentFields,
    connections: z
      .array(connectionV1Schema)
      .max(AUTHORED_LEVEL_LIMITS.maxConnections),
  })
  .strict();

const authoredLevelV2DocumentSchema = z
  .object({
    schemaVersion: z.literal(AUTHORED_LEVEL_SCHEMA_VERSION_V2),
    id: z.enum(AUTHORED_LEVEL_V2_IDS),
    theme: z.enum(["garden", "party"]),
    ...authoredLevelDocumentFields,
    connections: z
      .array(connectionV2Schema)
      .max(AUTHORED_LEVEL_LIMITS.maxConnections),
  })
  .strict();

const authoredLevelV3DocumentSchema = z
  .object({
    schemaVersion: z.literal(AUTHORED_LEVEL_SCHEMA_VERSION_V3),
    id: authoredLevelProjectRouteIdSchema,
    theme: z.enum(AUTHORED_LEVEL_WORLD_THEMES),
    ...authoredLevelDocumentFields,
    anchors: authoredLevelV3AnchorsSchema,
    connections: z
      .array(connectionV2Schema)
      .max(AUTHORED_LEVEL_LIMITS.maxConnections),
  })
  .strict();

const authoredLevelV4DocumentSchema = z
  .object({
    schemaVersion: z.literal(AUTHORED_LEVEL_SCHEMA_VERSION_V4),
    id: authoredLevelProjectRouteIdSchema,
    theme: z.enum(AUTHORED_LEVEL_V4_THEMES),
    ...authoredLevelDocumentFields,
    pieces: z
      .array(authoredLevelV4PieceSchema)
      .min(1)
      .max(AUTHORED_LEVEL_LIMITS.maxPieces),
    anchors: authoredLevelV3AnchorsSchema,
    connections: z
      .array(authoredLevelV4ConnectionSchema)
      .max(AUTHORED_LEVEL_LIMITS.maxConnections),
    decor: z
      .array(authoredDecorSchema)
      .max(AUTHORED_LEVEL_V4_LIMITS.maxDecor)
      .optional(),
  })
  .strict();

export const authoredLevelDocumentSchema = z.discriminatedUnion(
  "schemaVersion",
  [
    authoredLevelV1DocumentSchema,
    authoredLevelV2DocumentSchema,
    authoredLevelV3DocumentSchema,
    authoredLevelV4DocumentSchema,
  ],
);

type PlatformPiece = AuthoredSurfacePiece;

export function isAuthoredSurfacePiece(
  piece: AuthoredLevelPiece,
): piece is AuthoredSurfacePiece {
  return (
    piece.type === "platform" ||
    piece.type === "moving-platform" ||
    piece.type === "lift" ||
    piece.type === "bounce-pad" ||
    piece.type === "crumble"
  );
}

/** Surfaces a rider must `ride`: horizontal movers and lifts. */
function isMovingSurface(platform: PlatformPiece): boolean {
  return platform.type === "moving-platform" || platform.type === "lift";
}

/** The standing-top range a surface occupies: a lift spans both stops. */
export function authoredSurfaceTopRange(platform: AuthoredSurfacePiece): {
  readonly min: number;
  readonly max: number;
} {
  const top = platform.center.y + platform.size.y / 2;
  return platform.type === "lift"
    ? { min: top, max: top + platform.travel.distance }
    : { min: top, max: top };
}

/** Full vertical extent of a surface's solid box across its motion. */
function platformVerticalExtent(platform: PlatformPiece): NumericInterval {
  const bottom = platform.center.y - platform.size.y / 2;
  const top = platformTop(platform);
  return platform.type === "lift"
    ? { min: bottom, max: top + platform.travel.distance }
    : { min: bottom, max: top };
}

/**
 * The height a connection must climb or drop between two surfaces. A lift
 * offers every top between its stops, so only the nearer stop counts.
 */
function connectionRise(from: PlatformPiece, to: PlatformPiece): number {
  const source = authoredSurfaceTopRange(from);
  const destination = authoredSurfaceTopRange(to);
  if (from.type !== "lift" && to.type !== "lift")
    return Math.abs(platformTop(from) - platformTop(to));
  if (destination.min > source.max) return destination.min - source.max;
  if (source.min > destination.max) return source.min - destination.max;
  return 0;
}

function bounceApex(strength: BouncePadStrength): number {
  const velocity = BOUNCE_PAD_VELOCITY[strength];
  return (velocity * velocity) / (2 * 15);
}

interface HorizontalBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

type HorizontalAxis = "x" | "z";

interface NumericInterval {
  min: number;
  max: number;
}

interface ParsedValidation {
  document?: AuthoredLevelDocument;
  issues: AuthoredLevelIssue[];
}

export class AuthoredLevelValidationError extends Error {
  readonly issues: readonly AuthoredLevelIssue[];

  constructor(issues: readonly AuthoredLevelIssue[]) {
    super(
      `Authored level is invalid: ${issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ")}`,
    );
    this.name = "AuthoredLevelValidationError";
    this.issues = Object.freeze(issues.map((issue) => Object.freeze({ ...issue })));
  }
}

function issue(
  issues: AuthoredLevelIssue[],
  path: string,
  code: string,
  message: string,
): void {
  issues.push({ path, code, message });
}

function zodPath(path: PropertyKey[]): string {
  let result = "$";
  for (const segment of path) {
    if (typeof segment === "number") result += `[${segment}]`;
    else if (/^[A-Za-z_$][\w$-]*$/.test(String(segment)))
      result += `.${String(segment)}`;
    else result += `[${JSON.stringify(String(segment))}]`;
  }
  return result;
}

function sortedIssues(issues: AuthoredLevelIssue[]): AuthoredLevelIssue[] {
  return issues.toSorted(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message),
  );
}

function parseDocument(input: unknown): ParsedValidation {
  const parsed = authoredLevelDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      issues: sortedIssues(
        parsed.error.issues.map((entry) => ({
          path: zodPath(entry.path),
          code: `schema.${entry.code}`,
          message: entry.message,
        })),
      ),
    };
  }
  return {
    document: parsed.data as AuthoredLevelDocument,
    issues: [],
  };
}

function platformBounds(platform: PlatformPiece): HorizontalBounds {
  const motionX = platform.type === "moving-platform" && platform.motion.axis === "x"
    ? platform.motion.distance
    : 0;
  const motionZ = platform.type === "moving-platform" && platform.motion.axis === "z"
    ? platform.motion.distance
    : 0;
  return {
    minX: platform.center.x - platform.size.x / 2 - motionX,
    maxX: platform.center.x + platform.size.x / 2 + motionX,
    minZ: platform.center.z - platform.size.z / 2 - motionZ,
    maxZ: platform.center.z + platform.size.z / 2 + motionZ,
  };
}

function staticPlatformBounds(platform: AuthoredPlatformPiece): HorizontalBounds {
  return {
    minX: platform.center.x - platform.size.x / 2,
    maxX: platform.center.x + platform.size.x / 2,
    minZ: platform.center.z - platform.size.z / 2,
    maxZ: platform.center.z + platform.size.z / 2,
  };
}

function platformTop(platform: PlatformPiece): number {
  return platform.center.y + platform.size.y / 2;
}

function horizontalGap(first: PlatformPiece, second: PlatformPiece): number {
  const firstMotionX =
    first.type === "moving-platform" && first.motion.axis === "x"
      ? first.motion.distance
      : 0;
  const firstMotionZ =
    first.type === "moving-platform" && first.motion.axis === "z"
      ? first.motion.distance
      : 0;
  const secondMotionX =
    second.type === "moving-platform" && second.motion.axis === "x"
      ? second.motion.distance
      : 0;
  const secondMotionZ =
    second.type === "moving-platform" && second.motion.axis === "z"
      ? second.motion.distance
      : 0;
  const gapX = Math.max(
    0,
    Math.abs(first.center.x - second.center.x) + firstMotionX + secondMotionX -
      first.size.x / 2 -
      second.size.x / 2,
  );
  const gapZ = Math.max(
    0,
    Math.abs(first.center.z - second.center.z) + firstMotionZ + secondMotionZ -
      first.size.z / 2 -
      second.size.z / 2,
  );
  return Math.hypot(gapX, gapZ);
}

function pointSupported(
  position: AuthoredPosition,
  platform: AuthoredPlatformPiece,
  clearance = AUTHORED_LEVEL_LIMITS.supportEdgeClearance,
): boolean {
  const bounds = staticPlatformBounds(platform);
  return (
    Math.abs(position.y - platformTop(platform)) <= EPSILON &&
    position.x >= bounds.minX + clearance - EPSILON &&
    position.x <= bounds.maxX - clearance + EPSILON &&
    position.z >= bounds.minZ + clearance - EPSILON &&
    position.z <= bounds.maxZ - clearance + EPSILON
  );
}

function rectangleContains(
  outer: HorizontalBounds,
  inner: HorizontalBounds,
  clearance = 0,
): boolean {
  return (
    inner.minX >= outer.minX + clearance - EPSILON &&
    inner.maxX <= outer.maxX - clearance + EPSILON &&
    inner.minZ >= outer.minZ + clearance - EPSILON &&
    inner.maxZ <= outer.maxZ - clearance + EPSILON
  );
}

function rectanglesOverlap(first: HorizontalBounds, second: HorizontalBounds): boolean {
  return (
    first.minX <= second.maxX + EPSILON &&
    first.maxX >= second.minX - EPSILON &&
    first.minZ <= second.maxZ + EPSILON &&
    first.maxZ >= second.minZ - EPSILON
  );
}

function rectanglesHaveInteriorOverlap(
  first: HorizontalBounds,
  second: HorizontalBounds,
): boolean {
  return (
    Math.min(first.maxX, second.maxX) - Math.max(first.minX, second.minX) >
      EPSILON &&
    Math.min(first.maxZ, second.maxZ) - Math.max(first.minZ, second.minZ) >
      EPSILON
  );
}

function expandedBounds(bounds: HorizontalBounds, amount: number): HorizontalBounds {
  return {
    minX: bounds.minX - amount,
    maxX: bounds.maxX + amount,
    minZ: bounds.minZ - amount,
    maxZ: bounds.maxZ + amount,
  };
}

function encounterStrikeEnvelope(
  encounter: AuthoredEncounterAnchor,
): HorizontalBounds {
  const attackReach = encounter.kind === "boss"
    ? AUTHORED_LEVEL_LIMITS.bossAttackReach
    : AUTHORED_LEVEL_LIMITS.ordinaryAttackReach;
  return expandedBounds(encounter.arena, attackReach);
}

function pointEnvelope(
  position: AuthoredPosition,
  radius: number = AUTHORED_LEVEL_LIMITS.supportEdgeClearance,
): HorizontalBounds {
  return {
    minX: position.x - radius,
    maxX: position.x + radius,
    minZ: position.z - radius,
    maxZ: position.z + radius,
  };
}

function hazardEnvelope(hazard: AuthoredSweeperPiece): HorizontalBounds {
  const translationX = hazard.motion?.axis === "x" ? hazard.motion.distance : 0;
  const translationZ = hazard.motion?.axis === "z" ? hazard.motion.distance : 0;
  const reachX = hazard.halfLength + hazard.radius;
  const reachZ = hazard.rotation ? hazard.halfLength + hazard.radius : hazard.radius;
  return {
    minX: hazard.center.x - translationX - reachX,
    maxX: hazard.center.x + translationX + reachX,
    minZ: hazard.center.z - translationZ - reachZ,
    maxZ: hazard.center.z + translationZ + reachZ,
  };
}

function intervalForBounds(
  bounds: HorizontalBounds,
  axis: HorizontalAxis,
): NumericInterval {
  return axis === "x"
    ? { min: bounds.minX, max: bounds.maxX }
    : { min: bounds.minZ, max: bounds.maxZ };
}

function intervalsHaveInteriorOverlap(
  first: NumericInterval,
  second: NumericInterval,
): boolean {
  return Math.min(first.max, second.max) - Math.max(first.min, second.min) > EPSILON;
}

function platformCenterInterval(
  platform: PlatformPiece,
  axis: HorizontalAxis,
): NumericInterval {
  const radius = AUTHORED_LEVEL_LIMITS.supportEdgeClearance;
  const motionInset =
    platform.type === "moving-platform" && platform.motion.axis === axis
      ? platform.motion.distance
      : 0;
  const halfSize = platform.size[axis] / 2;
  return {
    min: platform.center[axis] - halfSize + radius + motionInset,
    max: platform.center[axis] + halfSize - radius - motionInset,
  };
}

function gatewayStripInterval(
  platform: PlatformPiece,
  axis: HorizontalAxis,
  direction: -1 | 1,
  end: "source" | "destination",
): NumericInterval {
  const radius = AUTHORED_LEVEL_LIMITS.supportEdgeClearance;
  const halfSize = platform.size[axis] / 2;
  const edgeDirection = end === "source" ? direction : -direction;
  const inwardDirection = -edgeDirection;
  const edge = platform.center[axis] + edgeDirection * halfSize;
  const start = edge + inwardDirection * radius;
  const finish = start + inwardDirection * GATEWAY_CLEARANCE_LENGTH;
  const motionExpansion =
    platform.type === "moving-platform" && platform.motion.axis === axis
      ? platform.motion.distance
      : 0;
  return {
    min: Math.min(start, finish) - motionExpansion,
    max: Math.max(start, finish) + motionExpansion,
  };
}

function hazardIntersectsStandingHeight(
  hazard: AuthoredSweeperPiece,
  feet: number,
): boolean {
  const head = feet + AUTHORED_LEVEL_LIMITS.actorHeight;
  return hazard.center.y + hazard.radius > feet && hazard.center.y - hazard.radius < head;
}

function subtractInterval(
  available: readonly NumericInterval[],
  blocked: NumericInterval,
): NumericInterval[] {
  return available.flatMap((interval) => {
    if (!intervalsHaveInteriorOverlap(interval, blocked)) return [interval];
    const remaining: NumericInterval[] = [];
    if (blocked.min - interval.min > EPSILON)
      remaining.push({ min: interval.min, max: Math.min(interval.max, blocked.min) });
    if (interval.max - blocked.max > EPSILON)
      remaining.push({ min: Math.max(interval.min, blocked.max), max: interval.max });
    return remaining;
  });
}

/**
 * Checks only the local takeoff and landing geometry for one aligned center
 * lane. This deliberately does not claim that the connection is reachable.
 */
function gatewayClearanceFailure(
  from: PlatformPiece,
  to: PlatformPiece,
  hazards: readonly AuthoredSweeperPiece[],
): string | null {
  const deltaX = to.center.x - from.center.x;
  const deltaZ = to.center.z - from.center.z;
  const travelAxis: HorizontalAxis = Math.abs(deltaX) >= Math.abs(deltaZ) ? "x" : "z";
  const crossAxis: HorizontalAxis = travelAxis === "x" ? "z" : "x";
  const travelDelta = travelAxis === "x" ? deltaX : deltaZ;
  const direction: -1 | 1 = travelDelta < 0 ? -1 : 1;
  const requiredDepth =
    AUTHORED_LEVEL_LIMITS.supportEdgeClearance + GATEWAY_CLEARANCE_LENGTH;

  if (from.size[travelAxis] < requiredDepth - EPSILON)
    return `${JSON.stringify(from.id)} cannot contain a ${GATEWAY_CLEARANCE_LENGTH}m source-exit strip after the ${AUTHORED_LEVEL_LIMITS.supportEdgeClearance}m avatar-radius edge inset`;
  if (to.size[travelAxis] < requiredDepth - EPSILON)
    return `${JSON.stringify(to.id)} cannot contain a ${GATEWAY_CLEARANCE_LENGTH}m destination-entry strip after the ${AUTHORED_LEVEL_LIMITS.supportEdgeClearance}m avatar-radius edge inset`;

  const fromCross = platformCenterInterval(from, crossAxis);
  const toCross = platformCenterInterval(to, crossAxis);
  const commonCross: NumericInterval = {
    min: Math.max(fromCross.min, toCross.min),
    max: Math.min(fromCross.max, toCross.max),
  };
  if (commonCross.max - commonCross.min <= EPSILON)
    return `No common avatar-width ${crossAxis} center lane remains across the platform motion envelopes for ${JSON.stringify(from.id)} to ${JSON.stringify(to.id)}`;

  const sourceStrip = gatewayStripInterval(from, travelAxis, direction, "source");
  const destinationStrip = gatewayStripInterval(
    to,
    travelAxis,
    direction,
    "destination",
  );
  let available: NumericInterval[] = [commonCross];
  for (const hazard of hazards) {
    const swept = expandedBounds(
      hazardEnvelope(hazard),
      AUTHORED_LEVEL_LIMITS.supportEdgeClearance,
    );
    const along = intervalForBounds(swept, travelAxis);
    const blocksSource =
      hazardIntersectsStandingHeight(hazard, platformTop(from)) &&
      intervalsHaveInteriorOverlap(along, sourceStrip);
    const blocksDestination =
      hazardIntersectsStandingHeight(hazard, platformTop(to)) &&
      intervalsHaveInteriorOverlap(along, destinationStrip);
    if (!blocksSource && !blocksDestination) continue;
    available = subtractInterval(available, intervalForBounds(swept, crossAxis));
    if (available.length === 0) break;
  }
  if (available.length === 0)
    return `No common avatar-width ${crossAxis} center lane keeps ${GATEWAY_CLEARANCE_LENGTH}m source-exit and destination-entry strips clear of standing-height sweepers for ${JSON.stringify(from.id)} to ${JSON.stringify(to.id)}`;
  return null;
}

/** The narrow, avatar-width lane between the closest takeoff and landing edges. */
function jumpGatewayCorridor(
  from: PlatformPiece,
  to: PlatformPiece,
): HorizontalBounds | null {
  const deltaX = to.center.x - from.center.x;
  const deltaZ = to.center.z - from.center.z;
  const travelAxis: HorizontalAxis = Math.abs(deltaX) >= Math.abs(deltaZ) ? "x" : "z";
  const crossAxis: HorizontalAxis = travelAxis === "x" ? "z" : "x";
  const travelDelta = travelAxis === "x" ? deltaX : deltaZ;
  const direction: -1 | 1 = travelDelta < 0 ? -1 : 1;
  const fromCross = platformCenterInterval(from, crossAxis);
  const toCross = platformCenterInterval(to, crossAxis);
  const commonCross: NumericInterval = {
    min: Math.max(fromCross.min, toCross.min),
    max: Math.min(fromCross.max, toCross.max),
  };
  if (commonCross.max - commonCross.min <= EPSILON) return null;

  const laneCenter = (commonCross.min + commonCross.max) / 2;
  const fromEdge = from.center[travelAxis] + direction * from.size[travelAxis] / 2;
  const toEdge = to.center[travelAxis] - direction * to.size[travelAxis] / 2;
  const travel: NumericInterval = {
    min: Math.min(fromEdge, toEdge) - AUTHORED_LEVEL_LIMITS.supportEdgeClearance,
    max: Math.max(fromEdge, toEdge) + AUTHORED_LEVEL_LIMITS.supportEdgeClearance,
  };
  const cross: NumericInterval = {
    min: laneCenter - AUTHORED_LEVEL_LIMITS.supportEdgeClearance,
    max: laneCenter + AUTHORED_LEVEL_LIMITS.supportEdgeClearance,
  };
  return travelAxis === "x"
    ? { minX: travel.min, maxX: travel.max, minZ: cross.min, maxZ: cross.max }
    : { minX: cross.min, maxX: cross.max, minZ: travel.min, maxZ: travel.max };
}

function checkpointEnvelope(
  checkpoint: AuthoredCheckpointPiece,
  platform: AuthoredPlatformPiece,
): HorizontalBounds {
  if (checkpoint.activation.type === "platform") {
    return staticPlatformBounds(platform);
  }
  if (checkpoint.activation.type === "box") {
    return {
      minX: checkpoint.position.x - checkpoint.activation.halfExtents.x,
      maxX: checkpoint.position.x + checkpoint.activation.halfExtents.x,
      minZ: checkpoint.position.z - checkpoint.activation.halfExtents.z,
      maxZ: checkpoint.position.z + checkpoint.activation.halfExtents.z,
    };
  }
  return pointEnvelope(checkpoint.position, checkpoint.activation.radius);
}

function verticalCapsuleClear(
  position: AuthoredPosition,
  supportId: string,
  platforms: readonly PlatformPiece[],
): boolean {
  const radius = AUTHORED_LEVEL_LIMITS.supportEdgeClearance;
  const head = position.y + AUTHORED_LEVEL_LIMITS.actorHeight;
  return platforms.every((platform) => {
    if (platform.id === supportId) return true;
    const { min: bottom, max: top } = platformVerticalExtent(platform);
    if (bottom >= head - EPSILON || top <= position.y + EPSILON) return true;
    const bounds = platformBounds(platform);
    return !rectanglesOverlap(pointEnvelope(position, radius), bounds);
  });
}

function validateSemantic(document: AuthoredLevelDocument): AuthoredLevelIssue[] {
  const issues: AuthoredLevelIssue[] = [];
  const ids = new Map<string, number>();
  const platforms = new Map<string, PlatformPiece>();
  const staticPlatforms = new Map<string, AuthoredPlatformPiece>();
  const checkpoints = new Map<string, AuthoredCheckpointPiece>();
  const hazards: AuthoredSweeperPiece[] = [];

  document.pieces.forEach((piece, index) => {
    const prior = ids.get(piece.id);
    if (prior !== undefined) {
      issue(
        issues,
        `$.pieces[${index}].id`,
        "id.duplicate",
        `Piece id ${JSON.stringify(piece.id)} duplicates $.pieces[${prior}].id`,
      );
    } else ids.set(piece.id, index);
    if (isAuthoredSurfacePiece(piece)) {
      platforms.set(piece.id, piece);
      if (piece.type === "platform") staticPlatforms.set(piece.id, piece);
    } else if (piece.type === "checkpoint") checkpoints.set(piece.id, piece);
    else hazards.push(piece);
  });

  if (platforms.size > AUTHORED_LEVEL_LIMITS.maxPlatforms)
    issue(
      issues,
      "$.pieces",
      "limit.platforms",
      `At most ${AUTHORED_LEVEL_LIMITS.maxPlatforms} platforms are supported`,
    );
  if (hazards.length > AUTHORED_LEVEL_LIMITS.maxHazards)
    issue(
      issues,
      "$.pieces",
      "limit.hazards",
      `At most ${AUTHORED_LEVEL_LIMITS.maxHazards} sweepers are supported`,
    );
  if (checkpoints.size > AUTHORED_LEVEL_LIMITS.maxCheckpoints)
    issue(
      issues,
      "$.pieces",
      "limit.checkpoints",
      `At most ${AUTHORED_LEVEL_LIMITS.maxCheckpoints} checkpoints are supported`,
    );

  if (
    document.schemaVersion !== AUTHORED_LEVEL_SCHEMA_VERSION_V3 &&
    document.schemaVersion !== AUTHORED_LEVEL_SCHEMA_VERSION_V4
  ) {
    const expectedTheme = document.id.startsWith("garden-") ? "garden" : "party";
    if (document.theme !== expectedTheme)
      issue(
        issues,
        "$.theme",
        "identity.theme",
        `${document.id} requires theme ${expectedTheme}`,
      );
  }

  const allGeometryBounds: HorizontalBounds[] = [
    ...[...platforms.values()].map(platformBounds),
    ...hazards.map(hazardEnvelope),
  ];
  if (allGeometryBounds.length > 0) {
    const minX = Math.min(...allGeometryBounds.map((bounds) => bounds.minX));
    const maxX = Math.max(...allGeometryBounds.map((bounds) => bounds.maxX));
    const minZ = Math.min(...allGeometryBounds.map((bounds) => bounds.minZ));
    const maxZ = Math.max(...allGeometryBounds.map((bounds) => bounds.maxZ));
    if (
      maxX - minX > AUTHORED_LEVEL_LIMITS.maxSceneSpan + EPSILON ||
      maxZ - minZ > AUTHORED_LEVEL_LIMITS.maxSceneSpan + EPSILON
    )
      issue(
        issues,
        "$.pieces",
        "limit.scene-span",
        `Course span must not exceed ${AUTHORED_LEVEL_LIMITS.maxSceneSpan} metres on either horizontal axis`,
      );
  }
  const staticArea = [...staticPlatforms.values()].reduce(
    (total, platform) => total + platform.size.x * platform.size.z,
    0,
  );
  if (staticArea > AUTHORED_LEVEL_LIMITS.maxStaticPlatformArea + EPSILON)
    issue(
      issues,
      "$.pieces",
      "limit.static-area",
      `Static platform area must not exceed ${AUTHORED_LEVEL_LIMITS.maxStaticPlatformArea} square metres`,
    );

  document.pieces.forEach((piece, index) => {
    if (piece.type !== "checkpoint") return;
    const support = staticPlatforms.get(piece.platformId);
    if (!support) {
      issue(
        issues,
        `$.pieces[${index}].platformId`,
        "reference.static-platform",
        `Checkpoint support ${JSON.stringify(piece.platformId)} must name a static platform`,
      );
      return;
    }
    if (!pointSupported(piece.position, support))
      issue(
        issues,
        `$.pieces[${index}].position`,
        "support.unsafe",
        `Checkpoint must be at the supported top of ${JSON.stringify(piece.platformId)} with ${AUTHORED_LEVEL_LIMITS.supportEdgeClearance}m edge clearance`,
      );
    if (
      document.schemaVersion === AUTHORED_LEVEL_SCHEMA_VERSION &&
      Math.abs(piece.position.y) > EPSILON
    )
      issue(
        issues,
        `$.pieces[${index}].position.y`,
        "checkpoint.ground-height",
        "Checkpoint recovery positions must remain at y=0 in authored-level-v1",
      );
    if (!verticalCapsuleClear(piece.position, piece.platformId, [...platforms.values()]))
      issue(
        issues,
        `$.pieces[${index}].position`,
        "clearance.blocked",
        "Checkpoint does not have full avatar capsule clearance",
      );
    const envelope = checkpointEnvelope(piece, support);
    if (!rectangleContains(staticPlatformBounds(support), envelope))
      issue(
        issues,
        `$.pieces[${index}].activation`,
        "checkpoint.outside-support",
        "Checkpoint activation envelope must fit its supporting platform",
      );
  });

  const connectionKeys = new Map<string, number>();
  document.connections.forEach((connection, index) => {
    const from = platforms.get(connection.from);
    const to = platforms.get(connection.to);
    if (!from)
      issue(
        issues,
        `$.connections[${index}].from`,
        "reference.platform",
        `Connection source ${JSON.stringify(connection.from)} must name a platform`,
      );
    if (!to)
      issue(
        issues,
        `$.connections[${index}].to`,
        "reference.platform",
        `Connection destination ${JSON.stringify(connection.to)} must name a platform`,
      );
    if (connection.from === connection.to)
      issue(
        issues,
        `$.connections[${index}]`,
        "graph.self-connection",
        "Connection endpoints must be different platforms",
      );
    const key = `${connection.from}\0${connection.to}\0${connection.mode}`;
    const prior = connectionKeys.get(key);
    if (prior !== undefined)
      issue(
        issues,
        `$.connections[${index}]`,
        "graph.duplicate-connection",
        `Connection duplicates $.connections[${prior}]`,
      );
    else connectionKeys.set(key, index);
    if (connection.safeMissPlatformId) {
      const catchPlatform = staticPlatforms.get(connection.safeMissPlatformId);
      const safeMissPath = `$.connections[${index}].safeMissPlatformId`;
      // V4 bounce practice may also declare a catch floor (DESIGN-025).
      const v4 = document.schemaVersion === AUTHORED_LEVEL_SCHEMA_VERSION_V4;
      if (connection.mode !== "jump" && !(v4 && connection.mode === "bounce"))
        issue(
          issues,
          safeMissPath,
          "safe-miss.mode",
          v4
            ? "A safe miss platform may only be declared for a jump or bounce connection"
            : "A safe miss platform may only be declared for a jump connection",
        );
      if (!catchPlatform)
        issue(
          issues,
          safeMissPath,
          "reference.static-platform",
          `Safe miss support ${JSON.stringify(connection.safeMissPlatformId)} must name a static platform`,
        );
      if (
        connection.safeMissPlatformId === connection.from ||
        connection.safeMissPlatformId === connection.to
      )
        issue(
          issues,
          safeMissPath,
          "safe-miss.endpoint",
          "A safe miss platform must be distinct from both jump endpoints",
        );
      if (from && to && catchPlatform) {
        const lowerEndpointTop = Math.min(platformTop(from), platformTop(to));
        const catchTop = platformTop(catchPlatform);
        if (catchTop > lowerEndpointTop + EPSILON)
          issue(
            issues,
            safeMissPath,
            "safe-miss.height",
            "A safe miss platform must be at or below the lower jump endpoint",
          );
        if (catchTop <= AUTHORED_LEVEL_LIMITS.fallThresholdY + EPSILON)
          issue(
            issues,
            safeMissPath,
            "safe-miss.fall-threshold",
            `A safe miss platform top must remain above y=${AUTHORED_LEVEL_LIMITS.fallThresholdY}`,
          );
        const corridor = jumpGatewayCorridor(from, to);
        if (
          corridor &&
          !rectangleContains(staticPlatformBounds(catchPlatform), corridor)
        )
          issue(
            issues,
            safeMissPath,
            "safe-miss.partial",
            "A safe miss platform must contain the avatar-expanded jump gateway corridor",
          );
        if (
          hazards.some((hazard) =>
            rectanglesOverlap(staticPlatformBounds(catchPlatform), hazardEnvelope(hazard)),
          )
        )
          issue(
            issues,
            safeMissPath,
            "safe-miss.hazard",
            "A safe miss platform must remain clear of sweeper motion envelopes",
          );
        if (
          Object.values(document.anchors.encounters).some((encounter) =>
            rectanglesOverlap(
              staticPlatformBounds(catchPlatform),
              encounterStrikeEnvelope(encounter),
            ),
          )
        )
          issue(
            issues,
            safeMissPath,
            "safe-miss.encounter",
            "A safe miss platform must remain clear of encounter strike envelopes",
          );
        const sourceMainIndex = document.mainPath.indexOf(connection.from);
        const hasRetryRoute = document.connections.some((retry) => {
          if (retry.from !== connection.safeMissPlatformId) return false;
          if (retry.to === connection.from) return true;
          // A catch floor under a pad's launch sits well below the pad, so a
          // bounce practice may retry via any deck that leads onto the pad.
          if (
            connection.mode === "bounce" &&
            document.connections.some(
              (approach) =>
                approach.from === retry.to && approach.to === connection.from,
            )
          )
            return true;
          const retryMainIndex = document.mainPath.indexOf(retry.to);
          return (
            sourceMainIndex >= 0 &&
            retryMainIndex >= 0 &&
            retryMainIndex <= sourceMainIndex
          );
        });
        if (!hasRetryRoute)
          issue(
            issues,
            safeMissPath,
            "safe-miss.retry-route",
            "A safe miss platform must declare an outgoing connection back toward the practice start",
          );
      }
    }
    if (!from || !to) return;
    const moving = isMovingSurface(from) || isMovingSurface(to);
    if (connection.mode === "bounce") {
      if (from.type !== "bounce-pad")
        issue(
          issues,
          `$.connections[${index}].mode`,
          "bounce.source",
          "A bounce connection must start on a bounce pad",
        );
      if (isMovingSurface(to))
        issue(
          issues,
          `$.connections[${index}].mode`,
          "bounce.destination",
          "A bounce connection must land on a surface that does not move",
        );
    } else if ((connection.mode === "ride") !== moving)
      issue(
        issues,
        `$.connections[${index}].mode`,
        "connection.mode",
        moving
          ? "A connection involving a moving platform must use ride"
          : "A ride connection must involve a moving platform",
      );
    if (from.type === "bounce-pad" && connection.mode !== "bounce")
      issue(
        issues,
        `$.connections[${index}].mode`,
        "bounce.source-mode",
        "A bounce pad launches on contact, so every connection leaving it must use bounce",
      );
    if (connection.requires !== undefined && connection.mode !== "jump")
      issue(
        issues,
        `$.connections[${index}].requires`,
        "requires.mode",
        "Only a jump connection may require a growth move",
      );
    const gap = horizontalGap(from, to);
    const rise = connectionRise(from, to);
    if (connection.mode === "drop") {
      // DESIGN-025 drop: step or hop down to a lower surface at any age. The
      // mode check above already rejects moving surfaces.
      const limits = AUTHORED_LEVEL_V4_LIMITS.drop;
      const descent = platformTop(from) - platformTop(to);
      if (
        descent < limits.minDescent - EPSILON ||
        descent > limits.maxDescent + EPSILON
      )
        issue(
          issues,
          `$.connections[${index}]`,
          "connection.rise",
          `drop must descend between ${limits.minDescent}m and ${limits.maxDescent}m; this one descends ${descent.toFixed(3)}m`,
        );
      if (gap > limits.maxGap + EPSILON)
        issue(
          issues,
          `$.connections[${index}]`,
          "connection.gap",
          `drop gap ${gap.toFixed(3)}m exceeds ${limits.maxGap}m across the motion envelope`,
        );
      const clearanceFailure = gatewayClearanceFailure(from, to, hazards);
      if (clearanceFailure)
        issue(
          issues,
          `$.connections[${index}]`,
          "connection.gateway-clearance",
          clearanceFailure,
        );
      return;
    }
    const requiredMove =
      connection.mode === "jump" ? connection.requires : undefined;
    const growthLimit = requiredMove
      ? AUTHORED_LEVEL_V4_LIMITS.requires[requiredMove]
      : connection.mode === "bounce" && from.type === "bounce-pad"
        ? AUTHORED_LEVEL_V4_LIMITS.bounce[from.strength]
        : undefined;
    const gapLimit = growthLimit
      ? growthLimit.maxGap
      : connection.mode === "walk"
        ? AUTHORED_LEVEL_LIMITS.maxWalkGap
        : AUTHORED_LEVEL_LIMITS.maxConnectionGap;
    const riseLimit = requiredMove === "glide"
      ? Number.POSITIVE_INFINITY
      : growthLimit
        ? growthLimit.maxRise
        : connection.mode === "walk"
          ? AUTHORED_LEVEL_LIMITS.maxWalkRise
          : AUTHORED_LEVEL_LIMITS.maxConnectionRise;
    const modeLabel = requiredMove ?? connection.mode;
    if (requiredMove === "glide") {
      const descent = platformTop(from) - platformTop(to);
      const minDescent = AUTHORED_LEVEL_V4_LIMITS.requires.glide.minDescent;
      if (descent < minDescent - EPSILON)
        issue(
          issues,
          `$.connections[${index}]`,
          "connection.rise",
          `glide must descend at least ${minDescent}m; this one descends ${descent.toFixed(3)}m`,
        );
    }
    if (growthLimit && gap > gapLimit + EPSILON)
      issue(
        issues,
        `$.connections[${index}]`,
        "connection.gap",
        `${modeLabel} gap ${gap.toFixed(3)}m exceeds ${gapLimit}m across the motion envelope`,
      );
    if (growthLimit && rise > riseLimit + EPSILON)
      issue(
        issues,
        `$.connections[${index}]`,
        "connection.rise",
        `${modeLabel} height difference ${rise.toFixed(3)}m exceeds ${riseLimit}m`,
      );
    if (!growthLimit && gap > gapLimit + EPSILON)
      issue(
        issues,
        `$.connections[${index}]`,
        "connection.gap",
        `${connection.mode} gap ${gap.toFixed(3)}m exceeds ${gapLimit}m across the motion envelope`,
      );
    if (!growthLimit && rise > riseLimit + EPSILON)
      issue(
        issues,
        `$.connections[${index}]`,
        "connection.rise",
        `${connection.mode} height difference ${rise.toFixed(3)}m exceeds ${riseLimit}m`,
      );
    if (
      connection.mode === "jump" ||
      connection.mode === "ride" ||
      connection.mode === "bounce"
    ) {
      const clearanceFailure = gatewayClearanceFailure(from, to, hazards);
      if (clearanceFailure)
        issue(
          issues,
          `$.connections[${index}]`,
          "connection.gateway-clearance",
          clearanceFailure,
        );
    }
  });

  const platformPathSet = new Set<string>();
  const checkPath = (path: readonly string[], pathName: string): void => {
    const seen = new Set<string>();
    path.forEach((id, index) => {
      platformPathSet.add(id);
      if (!platforms.has(id))
        issue(
          issues,
          `${pathName}[${index}]`,
          "reference.platform",
          `Path entry ${JSON.stringify(id)} must name a platform`,
        );
      if (seen.has(id))
        issue(
          issues,
          `${pathName}[${index}]`,
          "graph.repeated-node",
          `Path repeats platform ${JSON.stringify(id)}`,
        );
      seen.add(id);
      const next = path[index + 1];
      if (
        next !== undefined &&
        !document.connections.some(
          (connection) => connection.from === id && connection.to === next,
        )
      )
        issue(
          issues,
          `${pathName}[${index + 1}]`,
          "graph.missing-connection",
          `No directed connection declares ${JSON.stringify(id)} to ${JSON.stringify(next)}`,
        );
    });
  };
  checkPath(document.mainPath, "$.mainPath");
  document.branches.forEach((branch, branchIndex) => {
    checkPath(branch, `$.branches[${branchIndex}]`);
    const first = branch[0]!;
    const last = branch.at(-1)!;
    const firstIndex = document.mainPath.indexOf(first);
    const lastIndex = document.mainPath.indexOf(last);
    if (firstIndex < 0)
      issue(
        issues,
        `$.branches[${branchIndex}][0]`,
        "branch.start",
        "Branch must start on the main path",
      );
    if (lastIndex < 0)
      issue(
        issues,
        `$.branches[${branchIndex}][${branch.length - 1}]`,
        "branch.rejoin",
        "Branch must rejoin the main path",
      );
    if (firstIndex >= 0 && lastIndex >= 0 && firstIndex >= lastIndex)
      issue(
        issues,
        `$.branches[${branchIndex}]`,
        "branch.direction",
        "Branch must rejoin later than it starts on the main path",
      );
    branch.slice(1, -1).forEach((id, offset) => {
      if (document.mainPath.includes(id))
        issue(
          issues,
          `$.branches[${branchIndex}][${offset + 1}]`,
          "branch.interior-main-node",
          "Only branch endpoints may be main-path platforms",
        );
    });
  });
  for (const id of platforms.keys()) {
    // V2 editor platforms may be optional collision geometry. Its authored
    // paths remain explicit safety assertions rather than an exhaustive list.
    if (
      document.schemaVersion === AUTHORED_LEVEL_SCHEMA_VERSION &&
      !platformPathSet.has(id)
    )
      issue(
        issues,
        `$.pieces[${ids.get(id)}].id`,
        "graph.unused-platform",
        `Platform ${JSON.stringify(id)} is not present in mainPath or branches`,
      );
  }

  const mainIndex = new Map(document.mainPath.map((id, index) => [id, index]));
  const anchorEntries: Array<readonly [string, AuthoredAnchor]> = [
    ["$.anchors.spawn", document.anchors.spawn],
    ["$.anchors.finish", document.anchors.finish],
    ["$.anchors.rewardRespawn", document.anchors.rewardRespawn],
    ...Object.entries(document.anchors.pickups).map(
      ([key, anchor]) => [`$.anchors.pickups[${JSON.stringify(key)}]`, anchor] as const,
    ),
    ...Object.entries(document.anchors.memories).map(
      ([key, anchor]) => [`$.anchors.memories[${JSON.stringify(key)}]`, anchor] as const,
    ),
    ...Object.entries(document.anchors.friendlies).map(
      ([key, anchor]) => [`$.anchors.friendlies[${JSON.stringify(key)}]`, anchor] as const,
    ),
    ...Object.entries(document.anchors.encounters).map(
      ([key, anchor]) => [`$.anchors.encounters[${JSON.stringify(key)}]`, anchor] as const,
    ),
  ];
  for (const [path, anchor] of anchorEntries) {
    const support = staticPlatforms.get(anchor.platformId);
    if (!support) {
      issue(
        issues,
        `${path}.platformId`,
        "reference.static-platform",
        `Anchor support ${JSON.stringify(anchor.platformId)} must name a static platform`,
      );
      continue;
    }
    if (
      document.schemaVersion === AUTHORED_LEVEL_SCHEMA_VERSION &&
      Math.abs(anchor.position.y) > EPSILON
    )
      issue(
        issues,
        `${path}.position.y`,
        "anchor.ground-height",
        "Gameplay anchors must remain at y=0 in authored-level-v1",
      );
    if (!pointSupported(anchor.position, support))
      issue(
        issues,
        `${path}.position`,
        "support.unsafe",
        `Anchor must be at the supported top of ${JSON.stringify(anchor.platformId)} with ${AUTHORED_LEVEL_LIMITS.supportEdgeClearance}m edge clearance`,
      );
    if (!verticalCapsuleClear(anchor.position, anchor.platformId, [...platforms.values()]))
      issue(
        issues,
        `${path}.position`,
        "clearance.blocked",
        "Anchor does not have full avatar capsule clearance",
      );
    if (!platformPathSet.has(anchor.platformId))
      issue(
        issues,
        `${path}.platformId`,
        "graph.unreachable-anchor",
        "Anchor support is not reachable from an authored path",
      );
    if (
      hazards.some((hazard) =>
        rectanglesOverlap(pointEnvelope(anchor.position), hazardEnvelope(hazard)),
      )
    )
      issue(
        issues,
        `${path}.position`,
        "clearance.hazard",
        "Anchor overlaps a sweeper motion envelope",
      );
  }

  for (const slot of ["minor-one", "minor-two"] as const) {
    const platformId = document.anchors.memories[slot].platformId;
    const platformCheckpoints = document.pieces.filter(
      (piece): piece is AuthoredCheckpointPiece =>
        piece.type === "checkpoint" && piece.platformId === platformId,
    );
    if (platformCheckpoints.length !== 1)
      issue(
        issues,
        `$.anchors.memories[${JSON.stringify(slot)}].platformId`,
        "checkpoint.minor-platform-count",
        `Minor memory platform ${JSON.stringify(platformId)} must have exactly one safe checkpoint`,
      );
  }

  const encounterEntries = Object.entries(document.anchors.encounters) as Array<
    [AuthoredEncounterSlot, AuthoredEncounterAnchor]
  >;
  const arenas: Array<
    readonly [AuthoredEncounterSlot, AuthoredEncounterAnchor]
  > = [];
  for (const [slot, encounter] of encounterEntries) {
    const path = `$.anchors.encounters[${JSON.stringify(slot)}]`;
    if ((slot === "boss") !== (encounter.kind === "boss"))
      issue(
        issues,
        `${path}.kind`,
        "encounter.kind",
        slot === "boss"
          ? "The boss slot requires kind boss"
          : "An ordinary slot requires kind ordinary-a or ordinary-b",
      );
    if (
      encounter.arena.minX >= encounter.arena.maxX ||
      encounter.arena.minZ >= encounter.arena.maxZ
    ) {
      issue(
        issues,
        `${path}.arena`,
        "arena.order",
        "Arena minima must be less than maxima",
      );
      continue;
    }
    for (const [priorSlot, prior] of arenas) {
      if (rectanglesHaveInteriorOverlap(encounter.arena, prior.arena))
        issue(
          issues,
          `${path}.arena`,
          "arena.overlap",
          `Encounter arena overlaps $.anchors.encounters[${JSON.stringify(priorSlot)}].arena`,
        );
    }
    arenas.push([slot, encounter]);
    const support = staticPlatforms.get(encounter.platformId);
    if (
      support &&
      !rectangleContains(
        staticPlatformBounds(support),
        encounter.arena,
        AUTHORED_LEVEL_LIMITS.supportEdgeClearance,
      )
    )
      issue(
        issues,
        `${path}.arena`,
        "arena.outside-support",
        `Arena must fit ${JSON.stringify(encounter.platformId)} with ${AUTHORED_LEVEL_LIMITS.supportEdgeClearance}m edge clearance`,
      );
    if (
      encounter.position.x < encounter.arena.minX - EPSILON ||
      encounter.position.x > encounter.arena.maxX + EPSILON ||
      encounter.position.z < encounter.arena.minZ - EPSILON ||
      encounter.position.z > encounter.arena.maxZ + EPSILON
    )
      issue(
        issues,
        `${path}.position`,
        "arena.spawn-outside",
        "Encounter position must lie inside its arena",
      );
    const retry = checkpoints.get(encounter.checkpointId);
    if (!retry)
      issue(
        issues,
        `${path}.checkpointId`,
        "reference.checkpoint",
        `Encounter retry ${JSON.stringify(encounter.checkpointId)} must name a checkpoint`,
      );
    else {
      const retrySupport = staticPlatforms.get(retry.platformId);
      if (
        retrySupport &&
        rectanglesOverlap(
          pointEnvelope(retry.position),
          encounterStrikeEnvelope(encounter),
        )
      )
        issue(
          issues,
          `${path}.checkpointId`,
          "clearance.encounter",
          "Encounter retry checkpoint must be outside its arena",
        );
      const retryIndex = mainIndex.get(retry.platformId);
      const encounterIndex = mainIndex.get(encounter.platformId);
      if (
        retryIndex !== undefined &&
        encounterIndex !== undefined &&
        retryIndex > encounterIndex
      )
        issue(
          issues,
          `${path}.checkpointId`,
          "ordering.retry",
          "Encounter retry checkpoint must not follow the encounter on the main path",
        );
    }
    if (
      hazards.some((hazard) =>
        rectanglesOverlap(encounter.arena, hazardEnvelope(hazard)),
      )
    )
      issue(
        issues,
        `${path}.arena`,
        "clearance.hazard",
        "Encounter arena overlaps a sweeper motion envelope",
      );
  }

  document.pieces.forEach((piece, index) => {
    if (piece.type !== "checkpoint") return;
    const support = staticPlatforms.get(piece.platformId);
    if (!support) return;
    const recoveryEnvelope = pointEnvelope(piece.position);
    if (
      hazards.some((hazard) =>
        rectanglesOverlap(recoveryEnvelope, hazardEnvelope(hazard)),
      )
    )
      issue(
        issues,
        `$.pieces[${index}].activation`,
        "clearance.hazard",
        "Checkpoint recovery position overlaps a sweeper motion envelope",
      );
    if (
      arenas.some(([, encounter]) =>
        rectanglesOverlap(recoveryEnvelope, encounterStrikeEnvelope(encounter)),
      )
    )
      issue(
        issues,
        `$.pieces[${index}].activation`,
        "clearance.encounter",
        "Checkpoint recovery position is within an encounter strike envelope",
      );
  });

  const requiredEncounterEntries = AUTHORED_REQUIRED_ENCOUNTER_SLOTS.map(
    (slot) => [slot, document.anchors.encounters[slot]] as const,
  );
  const requiredMainAnchors: Array<readonly [string, AuthoredAnchor]> = [
    ["$.anchors.spawn", document.anchors.spawn],
    ["$.anchors.pickups[\"attack-tool\"]", document.anchors.pickups["attack-tool"]],
    ["$.anchors.pickups[\"guard-tool\"]", document.anchors.pickups["guard-tool"]],
    ["$.anchors.memories[\"minor-one\"]", document.anchors.memories["minor-one"]],
    ["$.anchors.memories[\"minor-two\"]", document.anchors.memories["minor-two"]],
    ...requiredEncounterEntries.map(
      ([slot, anchor]) =>
        [`$.anchors.encounters[${JSON.stringify(slot)}]`, anchor] as const,
    ),
    ["$.anchors.memories.major", document.anchors.memories.major],
    ["$.anchors.rewardRespawn", document.anchors.rewardRespawn],
    ["$.anchors.finish", document.anchors.finish],
  ];
  for (const [path, anchor] of requiredMainAnchors) {
    if (!mainIndex.has(anchor.platformId))
      issue(
        issues,
        `${path}.platformId`,
        "ordering.main-path",
        "Required progression anchor must be on the main path",
      );
  }
  if (document.mainPath[0] !== document.anchors.spawn.platformId)
    issue(
      issues,
      "$.anchors.spawn.platformId",
      "ordering.spawn",
      "Spawn platform must be the first mainPath platform",
    );
  if (document.mainPath.at(-1) !== document.anchors.finish.platformId)
    issue(
      issues,
      "$.anchors.finish.platformId",
      "ordering.finish",
      "Finish platform must be the final mainPath platform",
    );

  const indexOf = (anchor: AuthoredAnchor): number =>
    mainIndex.get(anchor.platformId) ?? Number.MAX_SAFE_INTEGER;
  const ordinaryAnchors = ([
    "ordinary-1",
    "ordinary-2",
    "ordinary-3",
    "ordinary-4",
  ] as const).map((slot) => document.anchors.encounters[slot]);
  const ordinaryIndexes = ordinaryAnchors.map(indexOf);
  const firstFight = Math.min(...ordinaryIndexes);
  const boss = document.anchors.encounters.boss;
  const bossIndex = indexOf(boss);
  const bonus = document.anchors.encounters["bonus-1"];
  if (bonus) {
    const path = '$.anchors.encounters["bonus-1"]';
    const bonusMainIndex = mainIndex.get(bonus.platformId);
    if (bonusMainIndex !== undefined && bonusMainIndex > bossIndex)
      issue(
        issues,
        `${path}.platformId`,
        "ordering.bonus-before-boss",
        "The bonus encounter must not follow the boss on the main path because combat ends after boss defeat",
      );
    else if (bonusMainIndex === bossIndex) {
      const incomingPlatformId = document.mainPath[bossIndex - 1];
      const incomingPlatform = incomingPlatformId === undefined
        ? undefined
        : platforms.get(incomingPlatformId);
      const bossPlatform = platforms.get(boss.platformId);
      if (incomingPlatform && bossPlatform) {
        const incomingX = bossPlatform.center.x - incomingPlatform.center.x;
        const incomingZ = bossPlatform.center.z - incomingPlatform.center.z;
        const incomingLengthSquared = incomingX ** 2 + incomingZ ** 2;
        const bonusFromBossX = bonus.position.x - boss.position.x;
        const bonusFromBossZ = bonus.position.z - boss.position.z;
        const projectedOffset =
          bonusFromBossX * incomingX + bonusFromBossZ * incomingZ;
        if (
          incomingLengthSquared <= EPSILON ||
          projectedOffset >= -EPSILON
        )
          issue(
            issues,
            `${path}.position`,
            "ordering.bonus-before-boss",
            "A bonus encounter on the boss platform must be positioned before the boss along the incoming main-path direction",
          );
      }
    } else if (bonusMainIndex === undefined) {
      const lateBranchIndex = document.branches.findIndex((branch) => {
        if (!branch.includes(bonus.platformId)) return false;
        const rejoin = branch.at(-1);
        const rejoinIndex = rejoin === undefined ? undefined : mainIndex.get(rejoin);
        return rejoinIndex !== undefined && rejoinIndex > bossIndex;
      });
      if (lateBranchIndex >= 0)
        issue(
          issues,
          `${path}.platformId`,
          "ordering.bonus-before-boss",
          `The bonus encounter's branch ${lateBranchIndex} rejoins after the boss, when combat is no longer available`,
        );
    }
  }
  const pickupIndexes = [
    indexOf(document.anchors.pickups["attack-tool"]),
    indexOf(document.anchors.pickups["guard-tool"]),
  ];
  pickupIndexes.forEach((index, offset) => {
    if (index > firstFight)
      issue(
        issues,
        offset === 0
          ? "$.anchors.pickups[\"attack-tool\"].platformId"
          : "$.anchors.pickups[\"guard-tool\"].platformId",
        "ordering.pickup",
        "Required equipment must be placed before the first ordinary encounter",
      );
  });
  ordinaryIndexes.forEach((index, offset) => {
    if (offset > 0 && index < ordinaryIndexes[offset - 1]!)
      issue(
        issues,
        `$.anchors.encounters["ordinary-${offset + 1}"].platformId`,
        "ordering.encounter",
        "Ordinary encounter slots must follow their stable ordinal on the main path",
      );
    if (index >= bossIndex)
      issue(
        issues,
        `$.anchors.encounters["ordinary-${offset + 1}"].platformId`,
        "ordering.boss",
        "Ordinary encounters must precede the boss",
      );
  });
  const minorOneIndex = indexOf(document.anchors.memories["minor-one"]);
  const minorTwoIndex = indexOf(document.anchors.memories["minor-two"]);
  if (minorOneIndex > minorTwoIndex)
    issue(
      issues,
      "$.anchors.memories[\"minor-two\"].platformId",
      "ordering.memory",
      "minor-two must not precede minor-one",
    );
  for (const [slot, index] of [
    ["minor-one", minorOneIndex],
    ["minor-two", minorTwoIndex],
  ] as const) {
    if (index >= bossIndex)
      issue(
        issues,
        `$.anchors.memories[${JSON.stringify(slot)}].platformId`,
        "ordering.memory",
        "Minor memories must precede the boss",
      );
  }
  for (const [path, anchor] of [
    ["$.anchors.memories.major.platformId", document.anchors.memories.major],
    ["$.anchors.rewardRespawn.platformId", document.anchors.rewardRespawn],
    ["$.anchors.finish.platformId", document.anchors.finish],
  ] as const) {
    if (indexOf(anchor) <= bossIndex)
      issue(
        issues,
        path,
        "ordering.reward",
        "Major memory, reward respawn and finish must not precede the boss",
      );
  }

  const protectedBeforeBoss: Array<readonly [string, AuthoredAnchor]> = [
    ["$.anchors.spawn", document.anchors.spawn],
    ["$.anchors.pickups[\"attack-tool\"]", document.anchors.pickups["attack-tool"]],
    ["$.anchors.pickups[\"guard-tool\"]", document.anchors.pickups["guard-tool"]],
    ["$.anchors.memories[\"minor-one\"]", document.anchors.memories["minor-one"]],
    ["$.anchors.memories[\"minor-two\"]", document.anchors.memories["minor-two"]],
    ...Object.entries(document.anchors.friendlies).map(
      ([slot, anchor]) => [`$.anchors.friendlies[${JSON.stringify(slot)}]`, anchor] as const,
    ),
  ];
  for (const [path, anchor] of protectedBeforeBoss) {
    if (
      arenas.some(([, encounter]) =>
        rectanglesOverlap(
          pointEnvelope(anchor.position),
          encounterStrikeEnvelope(encounter),
        ),
      )
    )
      issue(
        issues,
        `${path}.position`,
        "clearance.encounter",
        "Safe content anchor is within an encounter strike envelope",
      );
  }

  if (document.schemaVersion === AUTHORED_LEVEL_SCHEMA_VERSION_V4) {
    validateGrowthPieces(document, platforms, hazards, issues);
    validateDecor(document, platforms, staticPlatforms, issues);
  }

  return sortedIssues(issues);
}

/**
 * Geometry the validator uses, for authoring lints (family-world-lint.ts):
 * a surface's horizontal bounds across its motion, the closest horizontal
 * gap between two surfaces across their motion envelopes, and an
 * encounter's strike envelope (its arena expanded by its role's reach).
 */
export function authoredSurfaceBounds(platform: AuthoredSurfacePiece): AuthoredArena {
  return platformBounds(platform);
}

export function authoredSurfaceGap(
  first: AuthoredSurfacePiece,
  second: AuthoredSurfacePiece,
): number {
  return horizontalGap(first, second);
}

export function authoredStrikeEnvelope(
  encounter: AuthoredEncounterAnchor,
): AuthoredArena {
  return encounterStrikeEnvelope(encounter);
}

function boxesHaveInteriorOverlap(
  firstBounds: HorizontalBounds,
  firstVertical: NumericInterval,
  secondBounds: HorizontalBounds,
  secondVertical: NumericInterval,
): boolean {
  return (
    rectanglesHaveInteriorOverlap(firstBounds, secondBounds) &&
    intervalsHaveInteriorOverlap(firstVertical, secondVertical)
  );
}

/**
 * DESIGN-025 D-04 checks for lifts and bounce pads. Only authored-level-v4
 * documents can hold these pieces, so published validation is untouched.
 */
function validateGrowthPieces(
  document: AuthoredLevelDocument,
  platforms: ReadonlyMap<string, PlatformPiece>,
  hazards: readonly AuthoredSweeperPiece[],
  issues: AuthoredLevelIssue[],
): void {
  document.pieces.forEach((piece, index) => {
    const path = `$.pieces[${index}]`;
    if (piece.type === "lift") {
      const footprint = staticPlatformBounds({ ...piece, type: "platform" });
      const swept = platformVerticalExtent(piece);
      const topStop = authoredSurfaceTopRange(piece).max;
      if (topStop > AUTHORED_LEVEL_LIMITS.verticalCoordinateMagnitude + EPSILON)
        issue(
          issues,
          `${path}.travel.distance`,
          "lift.height",
          `The lift's top stop must stay at or below y=${AUTHORED_LEVEL_LIMITS.verticalCoordinateMagnitude}`,
        );
      for (const other of platforms.values()) {
        if (other.id === piece.id) continue;
        if (
          boxesHaveInteriorOverlap(
            footprint,
            { min: swept.min, max: swept.max + AUTHORED_LEVEL_LIMITS.actorHeight },
            platformBounds(other),
            platformVerticalExtent(other),
          )
        )
          issue(
            issues,
            path,
            "lift.swept-volume",
            `The lift's travel and rider headroom overlap ${JSON.stringify(other.id)}`,
          );
      }
      for (const hazard of hazards) {
        if (
          boxesHaveInteriorOverlap(
            footprint,
            { min: swept.min, max: swept.max + AUTHORED_LEVEL_LIMITS.actorHeight },
            hazardEnvelope(hazard),
            { min: hazard.center.y - hazard.radius, max: hazard.center.y + hazard.radius },
          )
        )
          issue(
            issues,
            path,
            "lift.hazard",
            `The lift's travel crosses sweeper ${JSON.stringify(hazard.id)}`,
          );
      }
      const stops = authoredSurfaceTopRange(piece);
      const touching = document.connections.filter(
        (connection) =>
          connection.mode === "ride" &&
          (connection.from === piece.id || connection.to === piece.id),
      );
      const reaches = (stopTop: number) =>
        touching.some((connection) => {
          const otherId = connection.from === piece.id ? connection.to : connection.from;
          const other = platforms.get(otherId);
          if (!other || other.type === "lift") return false;
          const otherRange = authoredSurfaceTopRange(other);
          return (
            Math.abs(otherRange.min - stopTop) <=
            AUTHORED_LEVEL_LIMITS.maxConnectionRise + EPSILON
          );
        });
      if (!reaches(stops.min))
        issue(
          issues,
          path,
          "lift.bottom-landing",
          "The lift's bottom stop needs a ride connection to a landing within jump height",
        );
      if (!reaches(stops.max))
        issue(
          issues,
          path,
          "lift.top-landing",
          "The lift's top stop needs a ride connection to a landing within jump height",
        );
    } else if (piece.type === "crumble") {
      if (document.mainPath.includes(piece.id))
        issue(
          issues,
          `${path}.id`,
          "crumble.main-path",
          "A crumbling platform may only be used on an optional branch route",
        );
      const footprint = staticPlatformBounds({ ...piece, type: "platform" });
      const anchorEnvelopes: Array<readonly [string, HorizontalBounds]> = [
        ["spawn", pointEnvelope(document.anchors.spawn.position)],
        ["finish", pointEnvelope(document.anchors.finish.position)],
        ["reward respawn", pointEnvelope(document.anchors.rewardRespawn.position)],
        ...Object.entries(document.anchors.pickups).map(
          ([slot, anchor]) => [`pickup ${slot}`, pointEnvelope(anchor.position)] as const,
        ),
        ...Object.entries(document.anchors.memories).map(
          ([slot, anchor]) => [`memory ${slot}`, pointEnvelope(anchor.position)] as const,
        ),
        ...Object.entries(document.anchors.friendlies).map(
          ([slot, anchor]) => [`friendly ${slot}`, pointEnvelope(anchor.position)] as const,
        ),
        ...Object.entries(document.anchors.encounters).map(
          ([slot, anchor]) => [`encounter ${slot}`, encounterStrikeEnvelope(anchor)] as const,
        ),
        ...document.pieces.flatMap((candidate) => {
          if (candidate.type !== "checkpoint") return [];
          const support = platforms.get(candidate.platformId);
          return support?.type === "platform"
            ? [[`checkpoint ${candidate.id}`, checkpointEnvelope(candidate, support)] as const]
            : [];
        }),
      ];
      for (const [label, envelope] of anchorEnvelopes) {
        if (rectanglesHaveInteriorOverlap(footprint, envelope))
          issue(
            issues,
            path,
            "crumble.objective",
            `A crumbling platform must not lie under or over the ${label}`,
          );
      }
    } else if (piece.type === "bounce-pad") {
      const footprint = staticPlatformBounds({ ...piece, type: "platform" });
      const top = platformTop(piece);
      const clearance: NumericInterval = {
        min: top,
        max: top + bounceApex(piece.strength) + AUTHORED_LEVEL_LIMITS.actorHeight,
      };
      for (const other of platforms.values()) {
        if (other.id === piece.id) continue;
        const otherBounds = platformBounds(other);
        const otherVertical = platformVerticalExtent(other);
        if (
          boxesHaveInteriorOverlap(
            expandedBounds(footprint, AUTHORED_LEVEL_LIMITS.supportEdgeClearance),
            clearance,
            otherBounds,
            otherVertical,
          )
        )
          issue(
            issues,
            path,
            "bounce-pad.headroom",
            `${JSON.stringify(other.id)} blocks the pad's launch column`,
          );
        else if (
          rectanglesHaveInteriorOverlap(footprint, otherBounds) &&
          Math.abs(authoredSurfaceTopRange(other).max - top) <=
            AUTHORED_LEVEL_LIMITS.maxConnectionRise + EPSILON
        )
          issue(
            issues,
            path,
            "bounce-pad.overlap",
            `The pad overlaps ${JSON.stringify(other.id)} near its own height, so landings could miss the pad`,
          );
      }
    }
  });
}

/** The whole common lane between two surfaces' closest edges, avatar-expanded. */
function connectionCorridor(
  from: PlatformPiece,
  to: PlatformPiece,
): HorizontalBounds | null {
  const deltaX = to.center.x - from.center.x;
  const deltaZ = to.center.z - from.center.z;
  const travelAxis: HorizontalAxis = Math.abs(deltaX) >= Math.abs(deltaZ) ? "x" : "z";
  const crossAxis: HorizontalAxis = travelAxis === "x" ? "z" : "x";
  const direction = (travelAxis === "x" ? deltaX : deltaZ) < 0 ? -1 : 1;
  const radius = AUTHORED_LEVEL_LIMITS.supportEdgeClearance;
  const fromCross = platformCenterInterval(from, crossAxis);
  const toCross = platformCenterInterval(to, crossAxis);
  const cross: NumericInterval = {
    min: Math.max(fromCross.min, toCross.min) - radius,
    max: Math.min(fromCross.max, toCross.max) + radius,
  };
  if (cross.max - cross.min <= EPSILON) return null;
  const fromEdge = from.center[travelAxis] + direction * from.size[travelAxis] / 2;
  const toEdge = to.center[travelAxis] - direction * to.size[travelAxis] / 2;
  const travel: NumericInterval = {
    min: Math.min(fromEdge, toEdge) - radius,
    max: Math.max(fromEdge, toEdge) + radius,
  };
  return travelAxis === "x"
    ? { minX: travel.min, maxX: travel.max, minZ: cross.min, maxZ: cross.max }
    : { minX: cross.min, maxX: cross.max, minZ: travel.min, maxZ: travel.max };
}

interface ProtectedVolume {
  readonly label: string;
  readonly bounds: HorizontalBounds;
  /** The lowest standing height inside the volume. */
  readonly floor: number;
  /** The highest standing (or launch apex) height inside the volume. */
  readonly highest: number;
}

/**
 * DESIGN-025 D-04 decor rules: known props from the level's theme kit, and
 * none inside a walkable volume, connection strip or fight area unless the
 * whole prop sits at least 3 m above the highest standing height there (the
 * trailing camera needs that much). Props below a surface are fine.
 */
function validateDecor(
  document: AuthoredLevelDocument,
  platforms: ReadonlyMap<string, PlatformPiece>,
  staticPlatforms: ReadonlyMap<string, AuthoredPlatformPiece>,
  issues: AuthoredLevelIssue[],
): void {
  const decor = document.decor ?? [];
  if (decor.length === 0) return;
  const volumes: ProtectedVolume[] = [];
  for (const platform of platforms.values()) {
    const range = authoredSurfaceTopRange(platform);
    volumes.push({
      label: `the walkable space above ${JSON.stringify(platform.id)}`,
      bounds: platformBounds(platform),
      floor: range.min,
      highest:
        platform.type === "bounce-pad"
          ? range.max + bounceApex(platform.strength)
          : range.max,
    });
  }
  document.connections.forEach((connection, index) => {
    const from = platforms.get(connection.from);
    const to = platforms.get(connection.to);
    if (!from || !to) return;
    const corridor = connectionCorridor(from, to);
    if (!corridor) return;
    const fromRange = authoredSurfaceTopRange(from);
    const toRange = authoredSurfaceTopRange(to);
    volumes.push({
      label: `connection ${index} (${connection.from} to ${connection.to})`,
      bounds: corridor,
      floor: Math.min(fromRange.min, toRange.min),
      highest: Math.max(
        fromRange.max,
        toRange.max,
        from.type === "bounce-pad" ? fromRange.max + bounceApex(from.strength) : 0,
      ),
    });
  });
  for (const [slot, encounter] of Object.entries(document.anchors.encounters)) {
    if (!encounter) continue;
    const support = staticPlatforms.get(encounter.platformId);
    if (!support) continue;
    volumes.push({
      label: `the ${slot} fight area`,
      bounds: encounterStrikeEnvelope(encounter),
      floor: platformTop(support),
      highest: platformTop(support),
    });
  }

  const seen = new Map<string, number>();
  decor.forEach((entry, index) => {
    const path = `$.decor[${index}]`;
    const prior = seen.get(entry.id);
    if (prior !== undefined)
      issue(
        issues,
        `${path}.id`,
        "decor.duplicate-id",
        `Decor id ${JSON.stringify(entry.id)} duplicates $.decor[${prior}].id`,
      );
    else seen.set(entry.id, index);
    const prop = themeKitProp(entry.kitPropId);
    if (!prop) {
      issue(
        issues,
        `${path}.kitPropId`,
        "decor.kit-prop",
        `Theme-kit prop ${JSON.stringify(entry.kitPropId)} is not registered`,
      );
      return;
    }
    if (prop.theme !== document.theme && prop.theme !== SHARED_THEME_KIT)
      issue(
        issues,
        `${path}.kitPropId`,
        "decor.theme",
        `Prop ${JSON.stringify(prop.id)} belongs to the ${prop.theme} kit, not ${document.theme} or the shared kit`,
      );
    const world = decorWorldBounds(prop.bounds, entry);
    const footprint: HorizontalBounds = {
      minX: world.min.x,
      maxX: world.max.x,
      minZ: world.min.z,
      maxZ: world.max.z,
    };
    const blocked = volumes.find(
      (volume) =>
        rectanglesHaveInteriorOverlap(footprint, volume.bounds) &&
        world.max.y > volume.floor + EPSILON &&
        world.min.y <
          volume.highest + AUTHORED_LEVEL_V4_LIMITS.overheadClearance - EPSILON,
    );
    if (blocked)
      issue(
        issues,
        `${path}.position`,
        "decor.clearance",
        `Prop ${JSON.stringify(entry.id)} intersects ${blocked.label}; place it beside the route, below it, or at least ${AUTHORED_LEVEL_V4_LIMITS.overheadClearance}m overhead`,
      );
  });
}

function validateParsed(input: unknown): ParsedValidation {
  const parsed = parseDocument(input);
  if (!parsed.document) return parsed;
  return { document: parsed.document, issues: validateSemantic(parsed.document) };
}

export function validateAuthoredLevelDocument(
  input: unknown,
): readonly AuthoredLevelIssue[] {
  return Object.freeze(
    validateParsed(input).issues.map((entry) => Object.freeze({ ...entry })),
  );
}

function cloneAndFreeze<T>(value: T): T {
  const cloned = JSON.parse(JSON.stringify(value)) as T;
  const freeze = (entry: unknown): void => {
    if (!entry || typeof entry !== "object" || Object.isFrozen(entry)) return;
    for (const child of Object.values(entry)) freeze(child);
    Object.freeze(entry);
  };
  freeze(cloned);
  return cloned;
}

function courseFor(document: AuthoredLevelDocument): ObbyCourse {
  return {
    platforms: document.pieces.flatMap((piece) => {
      if (piece.type === "platform") {
        return [{ id: piece.id, center: { ...piece.center }, size: { ...piece.size } }];
      }
      if (piece.type === "moving-platform") {
        return [
          {
            id: piece.id,
            center: { ...piece.center },
            size: { ...piece.size },
            motion: { ...piece.motion },
          },
        ];
      }
      if (piece.type === "lift") {
        // The course motion is centred on the midpoint of the travel and starts
        // a quarter-cycle early, so t=0 (phase 0) is the authored bottom stop.
        // A positive dwell pauses the sine at each stop; zero or absent keeps
        // the course byte-identical to the original lift.
        const half = piece.travel.distance / 2;
        const dwell = piece.travel.dwell ?? 0;
        return [
          {
            id: piece.id,
            center: { ...piece.center, y: piece.center.y + half },
            size: { ...piece.size },
            motion: {
              axis: "y" as const,
              distance: half,
              period: piece.travel.period,
              phase: (piece.travel.phase ?? 0) - Math.PI / 2,
              ...(dwell > 0 ? { dwell } : {}),
            },
          },
        ];
      }
      if (piece.type === "bounce-pad") {
        return [
          {
            id: piece.id,
            center: { ...piece.center },
            size: { ...piece.size },
            bounce: { velocity: BOUNCE_PAD_VELOCITY[piece.strength] },
          },
        ];
      }
      if (piece.type === "crumble") {
        return [
          {
            id: piece.id,
            center: { ...piece.center },
            size: { ...piece.size },
            crumble: {
              shakeSeconds: AUTHORED_LEVEL_V4_LIMITS.crumbleShakeSeconds,
              downSeconds: AUTHORED_LEVEL_V4_LIMITS.crumbleDownSeconds,
            },
          },
        ];
      }
      return [];
    }),
    hazards: document.pieces.flatMap((piece) =>
      piece.type === "sweeper"
        ? [
            {
              id: piece.id,
              center: { ...piece.center },
              halfLength: piece.halfLength,
              radius: piece.radius,
              ...(piece.motion ? { motion: { ...piece.motion } } : {}),
              ...(piece.rotation ? { rotation: { ...piece.rotation } } : {}),
            },
          ]
        : [],
    ),
    checkpoints: document.pieces.flatMap((piece) => {
      if (piece.type !== "checkpoint") return [];
      if (piece.activation.type === "platform") {
        return [
          {
            id: piece.id,
            position: { ...piece.position },
            triggerRadius: 1,
            triggerPlatformId: piece.platformId,
          },
        ];
      }
      if (piece.activation.type === "box") {
        return [
          {
            id: piece.id,
            position: { ...piece.position },
            triggerRadius: Math.min(
              piece.activation.halfExtents.x,
              piece.activation.halfExtents.z,
            ),
            triggerHalfExtents: { ...piece.activation.halfExtents },
          },
        ];
      }
      return [
        {
          id: piece.id,
          position: { ...piece.position },
          triggerRadius: piece.activation.radius,
        },
      ];
    }),
  };
}

export function resolveAuthoredLevelDocument(
  input: unknown,
): ResolvedAuthoredLevel {
  const validation = validateParsed(input);
  if (!validation.document || validation.issues.length > 0)
    throw new AuthoredLevelValidationError(validation.issues);
  const document = cloneAndFreeze(validation.document);
  const course = cloneAndFreeze(courseFor(document));
  const graph = cloneAndFreeze<AuthoredLevelGraph>({
    connections: document.connections,
    mainPath: document.mainPath,
    branches: document.branches,
  });
  return Object.freeze({
    document,
    course,
    graph,
    anchors: document.anchors,
  });
}
