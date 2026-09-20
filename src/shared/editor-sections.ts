/**
 * Deterministic climbing-section geometry for the shared level editor.
 *
 * DESIGN019's *Section builder contract* asks one atomic command to place a
 * side route beside the main course: broad static steps that rise away from a
 * start platform, crest, and come back down onto a later rejoin platform, with
 * forward connections, a platform checkpoint on every step and one branch from
 * start to rejoin. The human **Build a section** rail and the agent CLI both
 * issue that single command, so every rule lives here rather than in either
 * caller.
 *
 * This module only *plans* a section: it derives the geometry from the two
 * chosen supports and reports why a request cannot be built. `editor-project`
 * owns applying the plan, the revision guard and rollback, and re-runs the
 * published validators afterwards so a section that would introduce a new
 * semantic issue is rejected rather than reported as a success.
 *
 * Nothing here clamps a request into a different shape. A run that cannot hold
 * the requested steps, an occupied lane or an exceeded budget comes back as an
 * issue naming the control to change.
 */
import { z } from "zod";

import {
  AUTHORED_LEVEL_LIMITS,
  type AuthoredConnection,
  type AuthoredEncounterAnchor,
  type AuthoredLevelDocument,
  type AuthoredLevelIssue,
  type AuthoredLevelPiece,
  type AuthoredMovingPlatformPiece,
  type AuthoredPlatformPiece,
  type AuthoredPosition,
  type AuthoredSweeperPiece,
} from "./authored-level";

export const LEVEL_EDITOR_SECTION_PATTERNS = ["arch", "zigzag"] as const;
export const LEVEL_EDITOR_SECTION_SIDES = ["left", "right"] as const;

export type LevelEditorSectionPattern =
  (typeof LEVEL_EDITOR_SECTION_PATTERNS)[number];
export type LevelEditorSectionSide =
  (typeof LEVEL_EDITOR_SECTION_SIDES)[number];

const EPSILON = 1e-6;

/**
 * `gatewayClearanceFailure` in `authored-level.ts` requires a jump's source and
 * destination to hold a 0.75m entry strip after the 0.3m avatar-radius inset on
 * the axis of travel, so a step shallower than their sum can never carry a
 * legal jump. The constant is mirrored rather than imported because the
 * published validator keeps it module-private.
 */
const GATEWAY_CLEARANCE_LENGTH = 0.75;

export const LEVEL_EDITOR_SECTION_LIMITS = Object.freeze({
  minSteps: 2,
  maxSteps: 12,
  defaultSteps: 4,
  minRise: 0.1,
  maxRise: AUTHORED_LEVEL_LIMITS.maxConnectionRise,
  defaultRise: 0.3,
  /** Lateral footprint of every step; wide enough to land on from either end. */
  stepWidth: 2.4,
  /** Edge-to-edge gap the shipped courses use, well inside the 1.4m limit. */
  stepGap: 0.6,
  minStepDepth:
    AUTHORED_LEVEL_LIMITS.supportEdgeClearance + GATEWAY_CLEARANCE_LENGTH,
  /** A step stays smaller than the decks it connects rather than a long ramp. */
  maxStepDepth: 6,
  /** The zigzag weave, kept under the width so the hop length does not grow. */
  zigzagOffset: 0.9,
  /**
   * Two surfaces closer than this in height are indistinguishable to the
   * runtime's support search (its step tolerance is 0.015m) once their
   * footprints are within an avatar radius, so the player can be left standing
   * on the wrong one.
   */
  flushTolerance: 0.05,
} as const);

export const levelEditorSectionIdPrefixSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{0,47}$/);
export const levelEditorSectionPatternSchema = z.enum(
  LEVEL_EDITOR_SECTION_PATTERNS,
);
export const levelEditorSectionSideSchema = z.enum(LEVEL_EDITOR_SECTION_SIDES);
export const levelEditorSectionStepsSchema = z
  .number()
  .int()
  .min(LEVEL_EDITOR_SECTION_LIMITS.minSteps)
  .max(LEVEL_EDITOR_SECTION_LIMITS.maxSteps);
export const levelEditorSectionRiseSchema = z
  .number()
  .min(LEVEL_EDITOR_SECTION_LIMITS.minRise)
  .max(LEVEL_EDITOR_SECTION_LIMITS.maxRise);

export interface LevelEditorSectionRequest {
  readonly idPrefix: string;
  readonly fromPlatformId: string;
  readonly toPlatformId: string;
  readonly pattern: LevelEditorSectionPattern;
  readonly side: LevelEditorSectionSide;
  /** Climbing steps above the start platform. Defaults to 4. */
  readonly steps?: number;
  /** Height gained per climbing step in metres. Defaults to 0.3. */
  readonly rise?: number;
}

export interface LevelEditorSectionMeasurements {
  readonly travelAxis: "x" | "z";
  readonly crossAxis: "x" | "z";
  readonly run: number;
  readonly spacing: number;
  readonly stepDepth: number;
  readonly stepWidth: number;
  readonly stepThickness: number;
  readonly steps: number;
  readonly rise: number;
  readonly descentSteps: number;
  readonly descentRise: number;
  readonly startTop: number;
  readonly apexTop: number;
  readonly rejoinTop: number;
}

export interface LevelEditorSectionPlan {
  readonly stepIds: readonly string[];
  readonly checkpointIds: readonly string[];
  /** Every step platform in climb order, then its checkpoint in the same order. */
  readonly pieces: readonly AuthoredLevelPiece[];
  readonly connections: readonly AuthoredConnection[];
  readonly branch: readonly string[];
  readonly measurements: LevelEditorSectionMeasurements;
}

export type LevelEditorSectionResult =
  | { readonly ok: true; readonly plan: LevelEditorSectionPlan }
  | { readonly ok: false; readonly issues: readonly AuthoredLevelIssue[] };

type HorizontalAxis = "x" | "z";
type PlatformPiece = AuthoredPlatformPiece | AuthoredMovingPlatformPiece;

interface HorizontalBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

function issue(path: string, code: string, message: string): AuthoredLevelIssue {
  return { path, code, message };
}

function round(value: number): number {
  return Number.parseFloat(value.toFixed(6));
}

function metres(value: number): string {
  return `${round(value)}m`;
}

function platformTop(platform: PlatformPiece): number {
  return platform.center.y + platform.size.y / 2;
}

function platformBottom(platform: PlatformPiece): number {
  return platform.center.y - platform.size.y / 2;
}

/** Plan-view footprint, widened to the full travel envelope of a rider. */
function platformFootprint(platform: PlatformPiece): HorizontalBounds {
  const travelX =
    platform.type === "moving-platform" && platform.motion.axis === "x"
      ? platform.motion.distance
      : 0;
  const travelZ =
    platform.type === "moving-platform" && platform.motion.axis === "z"
      ? platform.motion.distance
      : 0;
  return {
    minX: platform.center.x - platform.size.x / 2 - travelX,
    maxX: platform.center.x + platform.size.x / 2 + travelX,
    minZ: platform.center.z - platform.size.z / 2 - travelZ,
    maxZ: platform.center.z + platform.size.z / 2 + travelZ,
  };
}

function sweeperFootprint(hazard: AuthoredSweeperPiece): HorizontalBounds {
  const travelX = hazard.motion?.axis === "x" ? hazard.motion.distance : 0;
  const travelZ = hazard.motion?.axis === "z" ? hazard.motion.distance : 0;
  const reachX = hazard.halfLength + hazard.radius;
  const reachZ = hazard.rotation
    ? hazard.halfLength + hazard.radius
    : hazard.radius;
  return {
    minX: hazard.center.x - travelX - reachX,
    maxX: hazard.center.x + travelX + reachX,
    minZ: hazard.center.z - travelZ - reachZ,
    maxZ: hazard.center.z + travelZ + reachZ,
  };
}

function expanded(bounds: HorizontalBounds, amount: number): HorizontalBounds {
  return {
    minX: bounds.minX - amount,
    maxX: bounds.maxX + amount,
    minZ: bounds.minZ - amount,
    maxZ: bounds.maxZ + amount,
  };
}

function encounterFootprint(encounter: AuthoredEncounterAnchor): HorizontalBounds {
  const reach =
    encounter.kind === "boss"
      ? AUTHORED_LEVEL_LIMITS.bossAttackReach
      : AUTHORED_LEVEL_LIMITS.ordinaryAttackReach;
  return expanded(encounter.arena, reach);
}

function overlaps(first: HorizontalBounds, second: HorizontalBounds): boolean {
  return (
    Math.min(first.maxX, second.maxX) - Math.max(first.minX, second.minX) >
      EPSILON &&
    Math.min(first.maxZ, second.maxZ) - Math.max(first.minZ, second.minZ) >
      EPSILON
  );
}

function describe(bounds: HorizontalBounds): string {
  return `x[${round(bounds.minX)}, ${round(bounds.maxX)}] z[${round(bounds.minZ)}, ${round(bounds.maxZ)}]`;
}

function position(
  axis: HorizontalAxis,
  travel: number,
  cross: number,
  y: number,
): AuthoredPosition {
  return axis === "x" ? { x: travel, y, z: cross } : { x: cross, y, z: travel };
}

function size(
  axis: HorizontalAxis,
  depth: number,
  thickness: number,
  width: number,
): AuthoredPosition {
  return axis === "x"
    ? { x: depth, y: thickness, z: width }
    : { x: width, y: thickness, z: depth };
}

function isPlatform(piece: AuthoredLevelPiece): piece is PlatformPiece {
  return piece.type === "platform" || piece.type === "moving-platform";
}

/**
 * The cross-axis unit that "right" means for a player walking `direction` along
 * `axis`: right is forward crossed with up, so travelling -z faces +x.
 */
function rightHandSign(axis: HorizontalAxis, direction: number): number {
  return axis === "z" ? -direction : direction;
}

function stepId(prefix: string, index: number): string {
  return `${prefix}-step-${index + 1}`;
}

function checkpointId(prefix: string, index: number): string {
  return `${prefix}-checkpoint-${index + 1}`;
}

/**
 * Issues present after an edit that were not present before it. Paths are
 * index-based, and a section only ever appends, so existing entries keep their
 * identity; repeated messages are matched by multiplicity rather than presence
 * so a second copy of an existing problem still counts as new.
 */
export function newAuthoredLevelIssues(
  before: readonly AuthoredLevelIssue[],
  after: readonly AuthoredLevelIssue[],
): readonly AuthoredLevelIssue[] {
  const key = (entry: AuthoredLevelIssue): string =>
    JSON.stringify([entry.code, entry.path, entry.message]);
  const remaining = new Map<string, number>();
  for (const entry of before) {
    const identity = key(entry);
    remaining.set(identity, (remaining.get(identity) ?? 0) + 1);
  }
  return after.filter((entry) => {
    const identity = key(entry);
    const count = remaining.get(identity) ?? 0;
    if (count === 0) return true;
    remaining.set(identity, count - 1);
    return false;
  });
}

interface Endpoints {
  readonly from: AuthoredPlatformPiece;
  readonly to: AuthoredPlatformPiece;
}

function resolveEndpoints(
  level: AuthoredLevelDocument,
  request: LevelEditorSectionRequest,
  issues: AuthoredLevelIssue[],
): Endpoints | undefined {
  const pieces = new Map(level.pieces.map((piece) => [piece.id, piece]));
  const resolve = (
    id: string,
    path: string,
    label: string,
  ): AuthoredPlatformPiece | undefined => {
    const piece = pieces.get(id);
    if (!piece || !isPlatform(piece)) {
      issues.push(
        issue(
          path,
          "section.endpoint-missing",
          `${label} ${JSON.stringify(id)} is not a platform in this chapter.`,
        ),
      );
      return undefined;
    }
    if (piece.type !== "platform") {
      issues.push(
        issue(
          path,
          "section.endpoint-static",
          `${label} ${JSON.stringify(id)} is a moving platform; a section starts and rejoins on static ground.`,
        ),
      );
      return undefined;
    }
    if (!level.mainPath.includes(id)) {
      issues.push(
        issue(
          path,
          "section.endpoint-route",
          `${label} ${JSON.stringify(id)} is not on the main route.`,
        ),
      );
      return undefined;
    }
    return piece;
  };

  if (request.fromPlatformId === request.toPlatformId) {
    issues.push(
      issue(
        "$.toPlatformId",
        "section.endpoint-distinct",
        "Start and rejoin platforms must be different.",
      ),
    );
    return undefined;
  }
  const from = resolve(
    request.fromPlatformId,
    "$.fromPlatformId",
    "Start platform",
  );
  const to = resolve(request.toPlatformId, "$.toPlatformId", "Rejoin platform");
  if (!from || !to) return undefined;
  if (level.mainPath.indexOf(from.id) >= level.mainPath.indexOf(to.id)) {
    issues.push(
      issue(
        "$.toPlatformId",
        "section.endpoint-order",
        `Rejoin platform ${JSON.stringify(to.id)} comes before ${JSON.stringify(from.id)} on the main route; a section must rejoin later.`,
      ),
    );
    return undefined;
  }
  return { from, to };
}

function budgetIssues(
  level: AuthoredLevelDocument,
  stepCount: number,
  stepArea: number,
): AuthoredLevelIssue[] {
  const issues: AuthoredLevelIssue[] = [];
  const platforms = level.pieces.filter(isPlatform).length;
  const checkpoints = level.pieces.filter(
    (piece) => piece.type === "checkpoint",
  ).length;
  const staticArea = level.pieces.reduce(
    (total, piece) =>
      piece.type === "platform" ? total + piece.size.x * piece.size.z : total,
    0,
  );
  const over = (label: string, used: number, added: number, limit: number): void => {
    if (used + added <= limit) return;
    issues.push(
      issue(
        "$.steps",
        "section.budget",
        `${stepCount} steps would take this chapter to ${used + added} ${label}, over the ${limit} limit. Use fewer climbing steps or remove unused pieces.`,
      ),
    );
  };
  over("pieces", level.pieces.length, stepCount * 2, AUTHORED_LEVEL_LIMITS.maxPieces);
  over("platforms", platforms, stepCount, AUTHORED_LEVEL_LIMITS.maxPlatforms);
  over("checkpoints", checkpoints, stepCount, AUTHORED_LEVEL_LIMITS.maxCheckpoints);
  over(
    "connections",
    level.connections.length,
    stepCount + 1,
    AUTHORED_LEVEL_LIMITS.maxConnections,
  );
  over("branches", level.branches.length, 1, AUTHORED_LEVEL_LIMITS.maxBranches);
  over("branch platforms", 0, stepCount + 2, AUTHORED_LEVEL_LIMITS.maxBranchNodes);
  if (staticArea + stepArea > AUTHORED_LEVEL_LIMITS.maxStaticPlatformArea + EPSILON)
    issues.push(
      issue(
        "$.steps",
        "section.budget",
        `${stepCount} steps would add ${round(stepArea)} square metres of static platform, taking this chapter to ${round(staticArea + stepArea)} over the ${AUTHORED_LEVEL_LIMITS.maxStaticPlatformArea} limit. Use fewer climbing steps or closer platforms.`,
      ),
    );
  return issues;
}

function sceneSpanIssue(
  level: AuthoredLevelDocument,
  steps: readonly AuthoredPlatformPiece[],
): AuthoredLevelIssue | undefined {
  const footprints = [
    ...level.pieces.filter(isPlatform).map(platformFootprint),
    ...level.pieces
      .filter((piece): piece is AuthoredSweeperPiece => piece.type === "sweeper")
      .map(sweeperFootprint),
    ...steps.map(platformFootprint),
  ];
  if (footprints.length === 0) return undefined;
  const span = Math.max(
    Math.max(...footprints.map((bounds) => bounds.maxX)) -
      Math.min(...footprints.map((bounds) => bounds.minX)),
    Math.max(...footprints.map((bounds) => bounds.maxZ)) -
      Math.min(...footprints.map((bounds) => bounds.minZ)),
  );
  if (span <= AUTHORED_LEVEL_LIMITS.maxSceneSpan + EPSILON) return undefined;
  return issue(
    "$.side",
    "section.budget",
    `The section would stretch the course to ${metres(span)} across, over the ${AUTHORED_LEVEL_LIMITS.maxSceneSpan}m limit. Build it on the other side or between closer platforms.`,
  );
}

/**
 * Clearance rules the published validator cannot express. It constrains anchors
 * and checkpoints but lets two platforms interpenetrate, and the runtime
 * resolves a foot position to the *highest* surface within 0.015m -- so a step
 * flush with a wider deck silently hands the player to the deck. A step may
 * therefore rise over lower ground, but never intersect it, never sit at its
 * height, and never lose its own headroom.
 */
function clearanceIssues(
  level: AuthoredLevelDocument,
  steps: readonly AuthoredPlatformPiece[],
): AuthoredLevelIssue[] {
  const issues: AuthoredLevelIssue[] = [];
  const reach = AUTHORED_LEVEL_LIMITS.supportEdgeClearance;
  const { flushTolerance } = LEVEL_EDITOR_SECTION_LIMITS;
  // The start and rejoin platforms are deliberately included: a step level with
  // either of its own endpoints is the same support conflict.
  const existing = level.pieces.filter(isPlatform);
  const hazards = level.pieces.filter(
    (piece): piece is AuthoredSweeperPiece => piece.type === "sweeper",
  );
  const encounters = Object.values(level.anchors.encounters);

  steps.forEach((step, index) => {
    const label = `Step ${index + 1}`;
    const stepBounds = platformFootprint(step);
    const stepTop = platformTop(step);
    const stepBottom = platformBottom(step);
    for (const other of [...existing, ...steps]) {
      if (other.id === step.id) continue;
      const otherBounds = platformFootprint(other);
      const otherTop = platformTop(other);
      const difference = stepTop - otherTop;
      if (
        Math.abs(difference) <= flushTolerance &&
        overlaps(expanded(stepBounds, reach), expanded(otherBounds, reach))
      ) {
        issues.push(
          issue(
            "$.side",
            "section.support-conflict",
            `${label} stands level with ${JSON.stringify(other.id)} at ${metres(stepTop)}; the player would be left standing on ${JSON.stringify(other.id)}. Build on the other side, or change the rise.`,
          ),
        );
        continue;
      }
      if (!overlaps(stepBounds, otherBounds)) continue;
      if (difference > 0 && stepBottom < otherTop - EPSILON)
        issues.push(
          issue(
            "$.side",
            "section.overlap",
            `${label} cuts through ${JSON.stringify(other.id)} at ${describe(otherBounds)}. Build on the other side, or between different platforms.`,
          ),
        );
      if (
        difference < 0 &&
        platformBottom(other) < stepTop + AUTHORED_LEVEL_LIMITS.actorHeight - EPSILON
      )
        issues.push(
          issue(
            "$.side",
            "section.clearance",
            `${label} has less than ${AUTHORED_LEVEL_LIMITS.actorHeight}m of headroom under ${JSON.stringify(other.id)}. Build on the other side, or between different platforms.`,
          ),
        );
    }
    for (const hazard of hazards) {
      if (!overlaps(stepBounds, sweeperFootprint(hazard))) continue;
      if (
        hazard.center.y + hazard.radius <= stepTop + EPSILON ||
        hazard.center.y - hazard.radius >=
          stepTop + AUTHORED_LEVEL_LIMITS.actorHeight - EPSILON
      )
        continue;
      issues.push(
        issue(
          "$.side",
          "section.hazard",
          `${label} stands in the path of sweeper ${JSON.stringify(hazard.id)}. Build on the other side, or between different platforms.`,
        ),
      );
    }
    for (const encounter of encounters) {
      if (!overlaps(stepBounds, encounterFootprint(encounter))) continue;
      issues.push(
        issue(
          "$.side",
          "section.encounter",
          `${label} reaches into the fight area on ${JSON.stringify(encounter.platformId)}. Build on the other side, or between different platforms.`,
        ),
      );
    }
  });
  return issues;
}

/**
 * Derives the pieces, connections and branch for one section, or the reasons it
 * cannot be built. Pure: `level` is only read.
 */
export function planLevelEditorSection(
  level: AuthoredLevelDocument,
  request: LevelEditorSectionRequest,
): LevelEditorSectionResult {
  const limits = LEVEL_EDITOR_SECTION_LIMITS;
  const issues: AuthoredLevelIssue[] = [];
  const steps = request.steps ?? limits.defaultSteps;
  const rise = request.rise ?? limits.defaultRise;

  if (!levelEditorSectionIdPrefixSchema.safeParse(request.idPrefix).success)
    issues.push(
      issue(
        "$.idPrefix",
        "section.prefix",
        "ID prefix must be 1-48 characters of lowercase letters, digits or hyphens, starting with a letter.",
      ),
    );
  if (!levelEditorSectionStepsSchema.safeParse(steps).success)
    issues.push(
      issue(
        "$.steps",
        "section.steps",
        `Climbing steps must be a whole number from ${limits.minSteps} to ${limits.maxSteps}.`,
      ),
    );
  if (!levelEditorSectionRiseSchema.safeParse(rise).success)
    issues.push(
      issue(
        "$.rise",
        "section.rise",
        `Rise per step must be between ${limits.minRise}m and ${limits.maxRise}m.`,
      ),
    );
  if (issues.length > 0) return { ok: false, issues };

  const endpoints = resolveEndpoints(level, request, issues);
  if (!endpoints) return { ok: false, issues };
  const { from, to } = endpoints;

  const deltaX = to.center.x - from.center.x;
  const deltaZ = to.center.z - from.center.z;
  const travelAxis: HorizontalAxis =
    Math.abs(deltaX) >= Math.abs(deltaZ) ? "x" : "z";
  const crossAxis: HorizontalAxis = travelAxis === "x" ? "z" : "x";
  const travelDelta = travelAxis === "x" ? deltaX : deltaZ;
  const run = Math.abs(travelDelta);
  const direction = travelDelta < 0 ? -1 : 1;
  const sideSign =
    (request.side === "right" ? 1 : -1) * rightHandSign(travelAxis, direction);

  const startTop = round(platformTop(from));
  const rejoinTop = round(platformTop(to));
  const apexTop = round(startTop + steps * rise);
  const descentHeight = apexTop - rejoinTop;
  if (descentHeight <= EPSILON)
    return {
      ok: false,
      issues: [
        issue(
          "$.steps",
          "section.height",
          `${JSON.stringify(to.id)} sits at ${metres(rejoinTop)}, at or above the crest of a ${steps}-step climb from ${metres(startTop)}. Use more climbing steps, or a larger rise.`,
        ),
      ],
    };
  const verticalDescentIntervals = Math.max(
    1,
    Math.ceil(descentHeight / rise - EPSILON),
  );
  // `steps` describes the requested climb. The descent is derived, so it may
  // use additional landings when the height-derived profile would make each
  // landing deeper than the section contract permits. This preserves every
  // requested riser while still fitting a long, uneven span.
  const minimumSpacingIntervals = Math.ceil(
    run / (limits.maxStepDepth + limits.stepGap) - EPSILON,
  );
  const fittingDescentIntervals =
    Math.abs(startTop - rejoinTop) > EPSILON
      ? minimumSpacingIntervals - steps + 2
      : verticalDescentIntervals;
  const descentIntervals = Math.max(
    verticalDescentIntervals,
    fittingDescentIntervals,
  );
  const descentRise = round(descentHeight / descentIntervals);
  const stepCount = steps + descentIntervals - 1;
  // Never thicker than the smallest riser, so no step dips below the height of
  // the endpoint it leaves or lands on.
  const thickness = round(Math.min(rise, descentRise));

  const spacing = run / (stepCount - 1);
  const depth = round(spacing - limits.stepGap);
  if (depth < limits.minStepDepth - EPSILON)
    return {
      ok: false,
      issues: [
        issue(
          "$.steps",
          "section.span",
          `A ${steps}-step section needs ${stepCount} landings, which need ${metres((stepCount - 1) * (limits.minStepDepth + limits.stepGap))} between ${JSON.stringify(from.id)} and ${JSON.stringify(to.id)}; they are ${metres(run)} apart. Use fewer climbing steps, or platforms further apart.`,
        ),
      ],
    };
  if (depth > limits.maxStepDepth + EPSILON)
    return {
      ok: false,
      issues: [
        issue(
          "$.steps",
          "section.span",
          `A ${steps}-step section across ${metres(run)} would need ${metres(depth)} deep landings, over the ${limits.maxStepDepth}m a step may be. Use more climbing steps, or platforms closer together.`,
        ),
      ],
    };

  const budget = budgetIssues(
    level,
    stepCount,
    stepCount * depth * limits.stepWidth,
  );
  if (budget.length > 0) return { ok: false, issues: budget };

  // Lane placement works in outward coordinates: `sideSign * cross`, so a
  // larger number is always further from the main course whichever way the
  // route runs.
  const outward = (value: number): number => sideSign * value;
  const crossSpread = (platform: PlatformPiece): number =>
    platform.size[crossAxis] / 2 +
    (platform.type === "moving-platform" && platform.motion.axis === crossAxis
      ? platform.motion.distance
      : 0);
  const outerEdge = (platform: PlatformPiece): number =>
    outward(platform.center[crossAxis]) + crossSpread(platform);
  const innerEdge = (platform: PlatformPiece): number =>
    outward(platform.center[crossAxis]) - crossSpread(platform);
  const weave = request.pattern === "zigzag" ? limits.zigzagOffset : 0;

  const topFor = (index: number): number =>
    index < steps
      ? round(startTop + (index + 1) * rise)
      : round(apexTop - (index - steps + 1) * descentRise);
  const tops = Array.from({ length: stepCount }, (_, index) => topFor(index));

  // Ground is considered at each landing's actual travel coordinate and
  // height. A route can therefore rise over a deck, then bend around a later
  // obstruction, without moving both endpoint hops out of reach.
  const travelSpread = (platform: PlatformPiece): number =>
    platform.size[travelAxis] / 2 +
    (platform.type === "moving-platform" && platform.motion.axis === travelAxis
      ? platform.motion.distance
      : 0);
  const laneFrom = outerEdge(from) + limits.stepGap + limits.stepWidth / 2;
  const laneTo = outerEdge(to) + limits.stepGap + limits.stepWidth / 2;
  const baseLaneFor = (index: number): number => {
    const progress = index / (stepCount - 1);
    const interior = index > 0 && index < stepCount - 1;
    return (
      laneFrom +
      (laneTo - laneFrom) * progress +
      (interior && index % 2 === 1 ? weave : 0)
    );
  };
  const lanes = Array.from({ length: stepCount }, (_, index) =>
    baseLaneFor(index),
  );
  const maxLateral = Math.min(
    limits.stepWidth - 2 * AUTHORED_LEVEL_LIMITS.supportEdgeClearance,
    spacing,
  );
  // Leave room for six-decimal coordinate rounding below.
  const lateralLimit = maxLateral - 0.001;
  const blockers = level.pieces.filter(isPlatform);
  let blocked: AuthoredPlatformPiece | AuthoredMovingPlatformPiece | undefined;
  const clearanceFor = (
    index: number,
    platform: PlatformPiece,
  ): number | undefined => {
    const stepTop = tops[index]!;
    const stepBottom = stepTop - thickness;
    const otherTop = platformTop(platform);
    const difference = stepTop - otherTop;
    let clearance: number;
    let travelClearance: number;
    if (Math.abs(difference) <= limits.flushTolerance) {
      // `clearanceIssues` expands both supports by the avatar radius.
      clearance = AUTHORED_LEVEL_LIMITS.supportEdgeClearance * 2;
      travelClearance = clearance;
    } else if (
      otherTop > stepBottom - AUTHORED_LEVEL_LIMITS.actorHeight + EPSILON &&
      platformBottom(platform) <
        stepTop + AUTHORED_LEVEL_LIMITS.actorHeight - EPSILON
    ) {
      clearance = AUTHORED_LEVEL_LIMITS.supportEdgeClearance;
      travelClearance = 0;
    } else {
      return undefined;
    }

    const travel = from.center[travelAxis] + direction * spacing * index;
    const travelDistance = Math.abs(travel - platform.center[travelAxis]);
    if (
      travelDistance >=
      depth / 2 + travelSpread(platform) + travelClearance - EPSILON
    )
      return undefined;

    const lane = lanes[index]!;
    const halfWidth = limits.stepWidth / 2;
    if (
      lane - halfWidth >= outerEdge(platform) + clearance - EPSILON ||
      lane + halfWidth <= innerEdge(platform) - clearance + EPSILON
    )
      return undefined;
    return outerEdge(platform) + clearance + halfWidth;
  };

  // Pushing one local landing outward can require a gradual approach on its
  // neighbours. Both operations only increase outward distance, so this
  // converges after crossing each finite blocker band.
  const passLimit = (blockers.length + 1) * (stepCount + 1);
  for (let pass = 0; pass < passLimit; pass += 1) {
    let changed = false;
    for (let index = 0; index < stepCount; index += 1) {
      for (const platform of blockers) {
        const required = clearanceFor(index, platform);
        if (required === undefined || required <= lanes[index]! + EPSILON)
          continue;
        lanes[index] = required;
        blocked = platform;
        changed = true;
      }
    }
    for (let index = 1; index < stepCount; index += 1) {
      const required = lanes[index - 1]! - lateralLimit;
      if (required <= lanes[index]! + EPSILON) continue;
      lanes[index] = required;
      changed = true;
    }
    for (let index = stepCount - 2; index >= 0; index -= 1) {
      const required = lanes[index + 1]! - lateralLimit;
      if (required <= lanes[index]! + EPSILON) continue;
      lanes[index] = required;
      changed = true;
    }
    if (!changed) break;
  }

  const hop = (lane: number, platform: AuthoredPlatformPiece): number =>
    lane - limits.stepWidth / 2 - outerEdge(platform);
  const longestHop = Math.max(hop(lanes[0]!, from), hop(lanes.at(-1)!, to));
  if (longestHop > AUTHORED_LEVEL_LIMITS.maxConnectionGap + EPSILON)
    return {
      ok: false,
      issues: [
        issue(
          "$.side",
          "section.lane",
          `${JSON.stringify(blocked?.id ?? from.id)} fills the ground beside this route, so the section would sit ${metres(longestHop)} out from ${JSON.stringify(from.id)} or ${JSON.stringify(to.id)}, past the ${AUTHORED_LEVEL_LIMITS.maxConnectionGap}m a hop may cross. Build on the other side, or between different platforms.`,
        ),
      ],
    };

  const crossFor = (index: number): number => round(outward(lanes[index]!));

  // Two landings offset sideways by more than the step width less the avatar
  // inset share no centre lane, and one offset further than the forward spacing
  // turns the hop sideways onto the shallow face.
  for (let index = 0; index + 1 < stepCount; index += 1) {
    const lateral = Math.abs(crossFor(index + 1) - crossFor(index));
    if (lateral < maxLateral - EPSILON) continue;
    return {
      ok: false,
      issues: [
        issue(
          "$.side",
          "section.lateral",
          `Steps ${index + 1} and ${index + 2} would sit ${metres(lateral)} apart sideways, more than one landing can bridge. ${
            request.pattern === "zigzag"
              ? "Use the raised arch shape, or platforms"
              : "Use platforms"
          } that line up more closely.`,
        ),
      ],
    };
  }

  const stepIds = Array.from({ length: stepCount }, (_, index) =>
    stepId(request.idPrefix, index),
  );
  const checkpointIds = Array.from({ length: stepCount }, (_, index) =>
    checkpointId(request.idPrefix, index),
  );
  const taken = new Set(level.pieces.map((piece) => piece.id));
  const conflict = [...stepIds, ...checkpointIds].find((id) => taken.has(id));
  if (conflict !== undefined)
    return {
      ok: false,
      issues: [
        issue(
          "$.idPrefix",
          "section.id-conflict",
          `${JSON.stringify(conflict)} already exists in this chapter. Choose a different ID prefix.`,
        ),
      ],
    };

  const platforms: AuthoredPlatformPiece[] = stepIds.map((id, index) => ({
    type: "platform",
    id,
    center: position(
      travelAxis,
      round(from.center[travelAxis] + direction * spacing * index),
      crossFor(index),
      round(topFor(index) - thickness / 2),
    ),
    size: size(travelAxis, depth, thickness, limits.stepWidth),
  }));

  const span = sceneSpanIssue(level, platforms);
  if (span) return { ok: false, issues: [span] };

  const clearance = clearanceIssues(level, platforms);
  if (clearance.length > 0) return { ok: false, issues: clearance };

  const checkpoints = platforms.map((platform, index) => ({
    type: "checkpoint" as const,
    id: checkpointIds[index]!,
    position: {
      x: platform.center.x,
      y: round(platform.center.y + platform.size.y / 2),
      z: platform.center.z,
    },
    platformId: platform.id,
    activation: { type: "platform" as const },
  }));

  const route = [from.id, ...stepIds, to.id];
  const connections: AuthoredConnection[] = route
    .slice(0, -1)
    .map((source, index) => ({
      from: source,
      to: route[index + 1]!,
      mode: "jump" as const,
    }));

  return {
    ok: true,
    plan: {
      stepIds,
      checkpointIds,
      pieces: [...platforms, ...checkpoints],
      connections,
      branch: route,
      measurements: {
        travelAxis,
        crossAxis,
        run: round(run),
        spacing: round(spacing),
        stepDepth: depth,
        stepWidth: limits.stepWidth,
        stepThickness: thickness,
        steps,
        rise,
        descentSteps: descentIntervals - 1,
        descentRise,
        startTop,
        apexTop,
        rejoinTop,
      },
    },
  };
}
