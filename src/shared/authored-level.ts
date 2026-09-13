import { z } from "zod";

import type { ObbyCourse } from "../game/obby";

export const AUTHORED_LEVEL_SCHEMA_VERSION = "authored-level-v1" as const;
export const AUTHORED_LEVEL_SCHEMA_VERSION_V2 = "authored-level-v2" as const;
export const AUTHORED_LEVEL_SCHEMA_VERSIONS = [
  AUTHORED_LEVEL_SCHEMA_VERSION,
  AUTHORED_LEVEL_SCHEMA_VERSION_V2,
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
export type AuthoredLevelId = (typeof AUTHORED_LEVEL_IDS)[number];
export type AuthoredLevelTheme = "garden" | "party";
export type AuthoredConnectionMode = "walk" | "jump" | "ride";
export type AuthoredEncounterSlot =
  | "ordinary-1"
  | "ordinary-2"
  | "ordinary-3"
  | "ordinary-4"
  | "boss";

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

export type AuthoredLevelPiece =
  | AuthoredPlatformPiece
  | AuthoredMovingPlatformPiece
  | AuthoredSweeperPiece
  | AuthoredCheckpointPiece;

export interface AuthoredConnection {
  readonly from: string;
  readonly to: string;
  readonly mode: AuthoredConnectionMode;
  readonly safeMissPlatformId?: string;
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
    Record<AuthoredEncounterSlot, AuthoredEncounterAnchor>
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

const ID_PATTERN = /^[a-z][a-z0-9-]{0,79}$/;
const EPSILON = 1e-6;
const GATEWAY_CLEARANCE_LENGTH = 0.75;

const identifierSchema = z.string().regex(ID_PATTERN);
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

const authoredLevelDocumentFields = {
  theme: z.enum(["garden", "party"]),
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
    ...authoredLevelDocumentFields,
    connections: z
      .array(connectionV2Schema)
      .max(AUTHORED_LEVEL_LIMITS.maxConnections),
  })
  .strict();

export const authoredLevelDocumentSchema = z.discriminatedUnion(
  "schemaVersion",
  [authoredLevelV1DocumentSchema, authoredLevelV2DocumentSchema],
);

type PlatformPiece = AuthoredPlatformPiece | AuthoredMovingPlatformPiece;

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
    const bottom = platform.center.y - platform.size.y / 2;
    const top = platformTop(platform);
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
    if (piece.type === "platform" || piece.type === "moving-platform") {
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

  const expectedTheme = document.id.startsWith("garden-") ? "garden" : "party";
  if (document.theme !== expectedTheme)
    issue(
      issues,
      "$.theme",
      "identity.theme",
      `${document.id} requires theme ${expectedTheme}`,
    );

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

  const safeMissPlatformIds = new Set(
    document.connections.flatMap((connection) =>
      connection.safeMissPlatformId && staticPlatforms.has(connection.safeMissPlatformId)
        ? [connection.safeMissPlatformId]
        : [],
    ),
  );
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
      if (connection.mode !== "jump")
        issue(
          issues,
          safeMissPath,
          "safe-miss.mode",
          "A safe miss platform may only be declared for a jump connection",
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
    const moving = from.type === "moving-platform" || to.type === "moving-platform";
    if ((connection.mode === "ride") !== moving)
      issue(
        issues,
        `$.connections[${index}].mode`,
        "connection.mode",
        moving
          ? "A connection involving a moving platform must use ride"
          : "A ride connection must involve a moving platform",
      );
    const gap = horizontalGap(from, to);
    const rise = Math.abs(platformTop(from) - platformTop(to));
    const gapLimit = connection.mode === "walk"
      ? AUTHORED_LEVEL_LIMITS.maxWalkGap
      : AUTHORED_LEVEL_LIMITS.maxConnectionGap;
    const riseLimit = connection.mode === "walk"
      ? AUTHORED_LEVEL_LIMITS.maxWalkRise
      : AUTHORED_LEVEL_LIMITS.maxConnectionRise;
    if (gap > gapLimit + EPSILON)
      issue(
        issues,
        `$.connections[${index}]`,
        "connection.gap",
        `${connection.mode} gap ${gap.toFixed(3)}m exceeds ${gapLimit}m across the motion envelope`,
      );
    if (rise > riseLimit + EPSILON)
      issue(
        issues,
        `$.connections[${index}]`,
        "connection.rise",
        `${connection.mode} height difference ${rise.toFixed(3)}m exceeds ${riseLimit}m`,
      );
    if (connection.mode === "jump" || connection.mode === "ride") {
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
    if (!platformPathSet.has(id) && !safeMissPlatformIds.has(id))
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

  const requiredMainAnchors: Array<readonly [string, AuthoredAnchor]> = [
    ["$.anchors.spawn", document.anchors.spawn],
    ["$.anchors.pickups[\"attack-tool\"]", document.anchors.pickups["attack-tool"]],
    ["$.anchors.pickups[\"guard-tool\"]", document.anchors.pickups["guard-tool"]],
    ["$.anchors.memories[\"minor-one\"]", document.anchors.memories["minor-one"]],
    ["$.anchors.memories[\"minor-two\"]", document.anchors.memories["minor-two"]],
    ...encounterEntries.map(
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
  const bossIndex = indexOf(document.anchors.encounters.boss);
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

  return sortedIssues(issues);
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
