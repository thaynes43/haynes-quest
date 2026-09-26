/**
 * Family-world authoring lints (PLAN-019 rulings R1–R6).
 *
 * `validateAuthoredLevelDocument` decides whether a level is *safe*. These
 * pure checks decide whether a family chapter is *kind to a small child*:
 * bounce pads a partial stick can reach, a route that never runs toward the
 * fixed camera, fights that leave exits clear, short boss retries, a chapter
 * that ends on its major memory, and lifts that wait for you. The chapter
 * generators run them in their tests; nothing in the game or the validator
 * calls them, so published routes and saved projects are unaffected.
 *
 * Every check takes a validator-clean `authored-level-v4` document and
 * returns structured findings. Thresholds are options, with presets for the
 * two family worlds.
 */
import {
  AUTHORED_LEVEL_LIMITS,
  AUTHORED_REQUIRED_ENCOUNTER_SLOTS,
  authoredStrikeEnvelope,
  authoredSurfaceBounds,
  authoredSurfaceGap,
  authoredSurfaceTopRange,
  isAuthoredSurfacePiece,
  type AuthoredArena,
  type AuthoredConnection,
  type AuthoredEncounterAnchor,
  type AuthoredEncounterSlot,
  type AuthoredLevelDocument,
  type AuthoredLiftPiece,
  type AuthoredPosition,
  type AuthoredSurfacePiece,
} from "./authored-level";

export type FamilyLintRule =
  | "pad-gap"
  | "camera-heading"
  | "strike-envelope"
  | "boss-retry-distance"
  | "chapter-ending"
  | "lift";

export interface FamilyLintFinding {
  readonly rule: FamilyLintRule;
  /** Stable machine code, for example `family.pad-gap`. */
  readonly code: string;
  /** `error` breaks a ruling; `warning` is advice a builder may accept. */
  readonly severity: "error" | "warning";
  /** JSON path into the level document. */
  readonly path: string;
  /** The piece id, `from->to` connection or anchor slot concerned. */
  readonly subject: string;
  readonly message: string;
  /** The measured value and the limit it was compared with, in metres, degrees or seconds. */
  readonly measured?: number;
  readonly limit?: number;
}

export interface FamilyLintOptions {
  /** (a) Largest horizontal gap from a bounce pad to its landing or approach deck. */
  readonly maxPadGap: number;
  /** (b) Largest angle, in degrees, a main-path connection may turn from the lateral axis toward the camera (+z). */
  readonly maxCameraHeadingDegrees: number;
  /** (c) Margin each strike envelope keeps inside its deck. */
  readonly strikeDeckMargin: number;
  /** (d) Longest route distance from the minor-two memory to the boss arena. */
  readonly maxBossRetryDistance: number;
  /** (f) Shortest dwell a lift may use at its stops. */
  readonly minLiftDwell: number;
  /** (f) Largest horizontal gap between a lift and a landing it serves. */
  readonly maxLiftLandingGap: number;
  /** (f) Largest height difference between a landing and the lift stop it serves. */
  readonly maxLiftLandingOffset: number;
  /**
   * (f) How a boarding landing without a checkpoint is reported. Dwell alone
   * does not make a lift safe: a child who walks toward it while it is away
   * falls into the open shaft about two times in three, so every landing
   * that boards a lift should hold a checkpoint that makes the fall cheap.
   */
  readonly liftBoardingCheckpoint: "error" | "warning";
}

/**
 * Coordinator rulings for the two family worlds: World A (the older child)
 * and World B (the younger child, wider fight margins and longer dwells).
 */
export const FAMILY_WORLD_LINT_PRESETS: Readonly<
  Record<"a" | "b", Readonly<FamilyLintOptions>>
> = Object.freeze({
  a: Object.freeze({
    maxPadGap: 0.35,
    maxCameraHeadingDegrees: 30,
    strikeDeckMargin: 0.5,
    maxBossRetryDistance: 25,
    minLiftDwell: 1.5,
    maxLiftLandingGap: 0.15,
    maxLiftLandingOffset: 0.15,
    liftBoardingCheckpoint: "warning",
  }),
  b: Object.freeze({
    maxPadGap: 0.35,
    maxCameraHeadingDegrees: 30,
    strikeDeckMargin: 1,
    maxBossRetryDistance: 25,
    minLiftDwell: 2,
    maxLiftLandingGap: 0.15,
    maxLiftLandingOffset: 0.15,
    liftBoardingCheckpoint: "error",
  }),
});

/** The avatar radius and gateway strip the validator uses beside every connection. */
const AVATAR_RADIUS = AUTHORED_LEVEL_LIMITS.supportEdgeClearance;
const GATEWAY_STRIP = 0.75;
const EPSILON = 1e-6;

interface Rect {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function surfacesOf(level: AuthoredLevelDocument): Map<string, AuthoredSurfacePiece> {
  const surfaces = new Map<string, AuthoredSurfacePiece>();
  for (const piece of level.pieces)
    if (isAuthoredSurfacePiece(piece)) surfaces.set(piece.id, piece);
  return surfaces;
}

function topOf(surface: AuthoredSurfacePiece): number {
  return surface.center.y + surface.size.y / 2;
}

function connectionIndex(
  level: AuthoredLevelDocument,
  from: string,
  to: string,
): number {
  return level.connections.findIndex(
    (connection) => connection.from === from && connection.to === to,
  );
}

function label(connection: Pick<AuthoredConnection, "from" | "to">): string {
  return `${connection.from}->${connection.to}`;
}

function interiorOverlap(first: Rect, second: Rect): boolean {
  return (
    Math.min(first.maxX, second.maxX) - Math.max(first.minX, second.minX) > EPSILON &&
    Math.min(first.maxZ, second.maxZ) - Math.max(first.minZ, second.minZ) > EPSILON
  );
}

function expand(rect: Rect, amount: number): Rect {
  return {
    minX: rect.minX - amount,
    maxX: rect.maxX + amount,
    minZ: rect.minZ - amount,
    maxZ: rect.maxZ + amount,
  };
}

/** The smallest distance from `inner`'s edges to `outer`'s edges; negative when it overhangs. */
function insetDistance(outer: Rect, inner: Rect): number {
  return Math.min(
    inner.minX - outer.minX,
    outer.maxX - inner.maxX,
    inner.minZ - outer.minZ,
    outer.maxZ - inner.maxZ,
  );
}

function encounterEntries(
  level: AuthoredLevelDocument,
): Array<readonly [AuthoredEncounterSlot, AuthoredEncounterAnchor]> {
  const entries: Array<readonly [AuthoredEncounterSlot, AuthoredEncounterAnchor]> =
    AUTHORED_REQUIRED_ENCOUNTER_SLOTS.map(
      (slot) => [slot, level.anchors.encounters[slot]] as const,
    );
  const bonus = level.anchors.encounters["bonus-1"];
  if (bonus) entries.push(["bonus-1", bonus]);
  return entries;
}

// ---------------------------------------------------------------------------
// (a) Bounce pads: landings and approaches within reach of a partial stick.
// ---------------------------------------------------------------------------

/**
 * R2: a walk-on player at partial stick falls through a pad gap wider than
 * about 0.35 m. Checks the gap from every bounce pad to each deck it launches
 * onto and to each deck that leads onto it.
 *
 * The small gap only helps when the landing's side reaches down to the pad:
 * a slow bounce then meets that wall, drops back onto the pad and bounces
 * again until it clears the edge. A landing whose underside sits above the
 * pad top leaves an opening a partial-stick bounce drifts through, under the
 * landing (`family.pad-gap.underhang`), however small the gap. Walk-on
 * success at stick 0.4–1.0 still needs the kinematic check in
 * `tests/game/family-kid-lib.ts` (`bounceWalkOn`).
 */
export function lintPadGaps(
  level: AuthoredLevelDocument,
  options: Pick<FamilyLintOptions, "maxPadGap"> = FAMILY_WORLD_LINT_PRESETS.a,
): FamilyLintFinding[] {
  const surfaces = surfacesOf(level);
  const findings: FamilyLintFinding[] = [];
  level.connections.forEach((connection, index) => {
    const from = surfaces.get(connection.from);
    const to = surfaces.get(connection.to);
    if (!from || !to) return;
    const role =
      from.type === "bounce-pad" && connection.mode === "bounce"
        ? "landing"
        : to.type === "bounce-pad"
          ? "approach"
          : undefined;
    if (!role) return;
    const gap = authoredSurfaceGap(from, to);
    if (gap > options.maxPadGap + EPSILON)
      findings.push({
        rule: "pad-gap",
        code: `family.pad-gap.${role}`,
        severity: "error",
        path: `$.connections[${index}]`,
        subject: label(connection),
        message: `The ${role} gap ${round(gap)}m for pad ${JSON.stringify(role === "landing" ? from.id : to.id)} exceeds ${options.maxPadGap}m; extend the deck toward the pad or make it flush`,
        measured: round(gap),
        limit: options.maxPadGap,
      });
    if (role !== "landing") return;
    const underhang = to.center.y - to.size.y / 2 - authoredSurfaceTopRange(from).max;
    if (underhang > EPSILON)
      findings.push({
        rule: "pad-gap",
        code: "family.pad-gap.underhang",
        severity: "error",
        path: `$.connections[${index}]`,
        subject: label(connection),
        message: `The underside of landing ${JSON.stringify(to.id)} sits ${round(underhang)}m above pad ${JSON.stringify(from.id)}'s top, so a partial-stick bounce can drift under it; extend the landing down to the pad top`,
        measured: round(underhang),
        limit: 0,
      });
  });
  return findings;
}

// ---------------------------------------------------------------------------
// (b) Camera: the required route never runs toward the default camera.
// ---------------------------------------------------------------------------

/**
 * R3: the camera yaw resets to 0 (looking toward −z) at chapter start and on
 * retry, so a main-path connection must not head toward the camera (+z) by
 * more than `maxCameraHeadingDegrees` from the lateral (x) axis. The heading
 * is the horizontal direction between the two surfaces' centres; steps whose
 * centres are under 0.5 m apart (a vertical lift ride) have no heading.
 */
export function lintCameraHeadings(
  level: AuthoredLevelDocument,
  options: Pick<FamilyLintOptions, "maxCameraHeadingDegrees"> = FAMILY_WORLD_LINT_PRESETS.a,
): FamilyLintFinding[] {
  const surfaces = surfacesOf(level);
  const findings: FamilyLintFinding[] = [];
  for (let step = 0; step + 1 < level.mainPath.length; step += 1) {
    const from = surfaces.get(level.mainPath[step]!);
    const to = surfaces.get(level.mainPath[step + 1]!);
    if (!from || !to) continue;
    const deltaX = to.center.x - from.center.x;
    const deltaZ = to.center.z - from.center.z;
    if (Math.hypot(deltaX, deltaZ) < 0.5 || deltaZ <= 0) continue;
    const degrees = (Math.atan2(deltaZ, Math.abs(deltaX)) * 180) / Math.PI;
    if (degrees > options.maxCameraHeadingDegrees + EPSILON) {
      const index = connectionIndex(level, from.id, to.id);
      findings.push({
        rule: "camera-heading",
        code: "family.camera-heading",
        severity: "error",
        path: index >= 0 ? `$.connections[${index}]` : `$.mainPath[${step + 1}]`,
        subject: `${from.id}->${to.id}`,
        message: `The required step ${from.id} -> ${to.id} heads toward the camera (+z) ${round(degrees)}° off the lateral axis (limit ${options.maxCameraHeadingDegrees}°); turn it sideways or away from the camera`,
        measured: round(degrees),
        limit: options.maxCameraHeadingDegrees,
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// (c) Fights: strike envelopes stay on their deck and off every exit.
// ---------------------------------------------------------------------------

type Axis = "x" | "z";

function motionReach(surface: AuthoredSurfacePiece, axis: Axis): number {
  return surface.type === "moving-platform" && surface.motion.axis === axis
    ? surface.motion.distance
    : 0;
}

/**
 * The strip a player crosses for one connection: the common avatar lane
 * between the two surfaces, from the 0.75 m take-off strip on the source to
 * the 0.75 m landing strip on the destination (both inset by the avatar
 * radius), plus the whole footprint of a pad or lift at either end (its
 * approach). Mirrors the validator's gateway strips.
 */
export function connectionStrips(
  from: AuthoredSurfacePiece,
  to: AuthoredSurfacePiece,
): Rect[] {
  const deltaX = to.center.x - from.center.x;
  const deltaZ = to.center.z - from.center.z;
  const travel: Axis = Math.abs(deltaX) >= Math.abs(deltaZ) ? "x" : "z";
  const cross: Axis = travel === "x" ? "z" : "x";
  const direction = (travel === "x" ? deltaX : deltaZ) < 0 ? -1 : 1;
  const lane = (surface: AuthoredSurfacePiece) => ({
    min: surface.center[cross] - surface.size[cross] / 2 + AVATAR_RADIUS + motionReach(surface, cross),
    max: surface.center[cross] + surface.size[cross] / 2 - AVATAR_RADIUS - motionReach(surface, cross),
  });
  const fromLane = lane(from);
  const toLane = lane(to);
  const crossMin = Math.max(fromLane.min, toLane.min) - AVATAR_RADIUS;
  const crossMax = Math.min(fromLane.max, toLane.max) + AVATAR_RADIUS;
  const strips: Rect[] = [];
  if (crossMax - crossMin > EPSILON) {
    const fromEdge = from.center[travel] + (direction * from.size[travel]) / 2;
    const toEdge = to.center[travel] - (direction * to.size[travel]) / 2;
    const reach = AVATAR_RADIUS + GATEWAY_STRIP;
    const start = fromEdge - direction * (reach + motionReach(from, travel));
    const finish = toEdge + direction * (reach + motionReach(to, travel));
    const travelMin = Math.min(start, finish);
    const travelMax = Math.max(start, finish);
    strips.push(
      travel === "x"
        ? { minX: travelMin, maxX: travelMax, minZ: crossMin, maxZ: crossMax }
        : { minX: crossMin, maxX: crossMax, minZ: travelMin, maxZ: travelMax },
    );
  }
  for (const surface of [from, to])
    if (surface.type === "bounce-pad" || surface.type === "lift")
      strips.push(expand(authoredSurfaceBounds(surface), AVATAR_RADIUS));
  return strips;
}

/**
 * R4: each encounter's strike envelope (its arena expanded by the role's
 * reach, as the validator and combat use) must keep `strikeDeckMargin`
 * inside its deck, and must not overlap any connection strip or pad/lift
 * approach at the deck's standing height. Ordinaries are skippable, so a
 * player may cross or wait there beside a live enemy.
 */
export function lintStrikeEnvelopes(
  level: AuthoredLevelDocument,
  options: Pick<FamilyLintOptions, "strikeDeckMargin"> = FAMILY_WORLD_LINT_PRESETS.a,
): FamilyLintFinding[] {
  const surfaces = surfacesOf(level);
  const findings: FamilyLintFinding[] = [];
  for (const [slot, encounter] of encounterEntries(level)) {
    const deck = surfaces.get(encounter.platformId);
    if (!deck) continue;
    const path = `$.anchors.encounters[${JSON.stringify(slot)}]`;
    const envelope = authoredStrikeEnvelope(encounter);
    const inset = insetDistance(authoredSurfaceBounds(deck), envelope);
    if (inset < options.strikeDeckMargin - EPSILON)
      findings.push({
        rule: "strike-envelope",
        code: "family.strike-envelope.deck-edge",
        severity: "error",
        path: `${path}.arena`,
        subject: slot,
        message: `The ${slot} strike envelope keeps ${round(inset)}m inside ${JSON.stringify(deck.id)}; it needs at least ${options.strikeDeckMargin}m`,
        measured: round(inset),
        limit: options.strikeDeckMargin,
      });
    const deckTop = topOf(deck);
    level.connections.forEach((connection, index) => {
      const from = surfaces.get(connection.from);
      const to = surfaces.get(connection.to);
      if (!from || !to) return;
      // Only strips at the fight's standing height can put a player in reach.
      const atDeckHeight = [from, to].some((surface) => {
        const range = authoredSurfaceTopRange(surface);
        return (
          surface.id === deck.id ||
          (range.max >= deckTop - AUTHORED_LEVEL_LIMITS.actorHeight - EPSILON &&
            range.min <= deckTop + AUTHORED_LEVEL_LIMITS.actorHeight + EPSILON)
        );
      });
      if (!atDeckHeight) return;
      if (connectionStrips(from, to).some((strip) => interiorOverlap(strip, envelope)))
        findings.push({
          rule: "strike-envelope",
          code: "family.strike-envelope.exit-strip",
          severity: "error",
          path: `${path}.arena`,
          subject: slot,
          message: `The ${slot} strike envelope overlaps the strip or approach of connection ${index} (${label(connection)}); move the arena so players can pass or wait out of reach`,
        });
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// (d) Short boss retries.
// ---------------------------------------------------------------------------

function clampToArena(point: AuthoredPosition, arena: AuthoredArena, y: number): AuthoredPosition {
  return {
    x: Math.max(arena.minX, Math.min(arena.maxX, point.x)),
    y,
    z: Math.max(arena.minZ, Math.min(arena.maxZ, point.z)),
  };
}

function distance(first: AuthoredPosition, second: AuthoredPosition): number {
  return Math.hypot(second.x - first.x, second.y - first.y, second.z - first.z);
}

export interface BossRetryRoute {
  /** Metres along the main path from the minor-two memory to the boss arena. */
  readonly meters: number;
  /** Lifts ridden on the way. */
  readonly lifts: number;
}

/**
 * The HP-defeat return route (DESIGN-018: the furthest minor memory's
 * checkpoint): from the minor-two anchor through the centre of each
 * main-path surface in between (a lift at its top stop) to the nearest point
 * of the boss arena, as 3D straight segments. Undefined when minor-two does
 * not precede the boss on the main path.
 */
export function bossRetryRoute(level: AuthoredLevelDocument): BossRetryRoute | undefined {
  const surfaces = surfacesOf(level);
  const minorTwo = level.anchors.memories["minor-two"];
  const boss = level.anchors.encounters.boss;
  const start = level.mainPath.indexOf(minorTwo.platformId);
  const end = level.mainPath.indexOf(boss.platformId);
  if (start < 0 || end < 0 || start > end) return undefined;
  let meters = 0;
  let lifts = 0;
  let previous: AuthoredPosition = minorTwo.position;
  for (const id of level.mainPath.slice(start + 1, end)) {
    const surface = surfaces.get(id);
    if (!surface) continue;
    if (surface.type === "lift") lifts += 1;
    const point = {
      x: surface.center.x,
      y: authoredSurfaceTopRange(surface).max,
      z: surface.center.z,
    };
    meters += distance(previous, point);
    previous = point;
  }
  meters += distance(previous, clampToArena(previous, boss.arena, boss.position.y));
  return { meters: round(meters), lifts };
}

/** R5: minor-two sits just before the boss approach, a short retry away. */
export function lintBossRetryDistance(
  level: AuthoredLevelDocument,
  options: Pick<FamilyLintOptions, "maxBossRetryDistance"> = FAMILY_WORLD_LINT_PRESETS.a,
): FamilyLintFinding[] {
  const route = bossRetryRoute(level);
  if (!route || route.meters <= options.maxBossRetryDistance + EPSILON) return [];
  return [
    {
      rule: "boss-retry-distance",
      code: "family.boss-retry-distance",
      severity: "error",
      path: '$.anchors.memories["minor-two"].platformId',
      subject: "minor-two",
      message: `An HP defeat returns to minor-two, ${route.meters}m of route (${route.lifts} lift${route.lifts === 1 ? "" : "s"}) from the boss arena; keep it within ${options.maxBossRetryDistance}m`,
      measured: route.meters,
      limit: options.maxBossRetryDistance,
    },
  ];
}

// ---------------------------------------------------------------------------
// (e) The major memory ends the chapter.
// ---------------------------------------------------------------------------

/**
 * R1: recovering the major memory completes the chapter at once, so the
 * major memory, the reward respawn and the finish share the final main-path
 * platform, and nothing leaves that platform.
 */
export function lintChapterEnding(level: AuthoredLevelDocument): FamilyLintFinding[] {
  const findings: FamilyLintFinding[] = [];
  const final = level.mainPath.at(-1);
  if (final === undefined) return findings;
  for (const [path, subject, anchor] of [
    ["$.anchors.memories.major.platformId", "memory.major", level.anchors.memories.major],
    ["$.anchors.rewardRespawn.platformId", "reward-respawn", level.anchors.rewardRespawn],
    ["$.anchors.finish.platformId", "finish", level.anchors.finish],
  ] as const) {
    if (anchor.platformId !== final)
      findings.push({
        rule: "chapter-ending",
        code: "family.chapter-ending.anchor",
        severity: "error",
        path,
        subject,
        message: `${subject} sits on ${JSON.stringify(anchor.platformId)}; it belongs on the final main-path platform ${JSON.stringify(final)}, since the major memory ends the chapter`,
      });
  }
  level.connections.forEach((connection, index) => {
    if (connection.from !== final) return;
    findings.push({
      rule: "chapter-ending",
      code: "family.chapter-ending.content-after",
      severity: "error",
      path: `$.connections[${index}]`,
      subject: label(connection),
      message: `Connection ${label(connection)} leaves the final platform; nothing after the major memory is reachable in play`,
    });
  });
  return findings;
}

// ---------------------------------------------------------------------------
// (f) Lifts wait at each stop, beside flush landings.
// ---------------------------------------------------------------------------

/** OBBY's step tolerance: a walking player climbs no higher than this without jumping. */
const WALK_STEP_UP = 0.015;

/**
 * R6: every lift dwells at least `minLiftDwell` seconds at both stops, and
 * each landing a ride connection serves sits within `maxLiftLandingGap`
 * horizontally and `maxLiftLandingOffset` vertically of its stop. A warning
 * notes a stop a walking child cannot step onto or off without a hop.
 *
 * Dwell does not close the shaft: while the lift is away, a child who walks
 * off the boarding landing falls in (about two arrivals in three, dwell or
 * not). So every landing that boards a lift needs a checkpoint
 * (`family.lift.boarding-checkpoint`, an error in World B), which makes that
 * fall a short retry. A static floor in the shaft is no guard: a descending
 * lift pushes a player standing on it through the floor, so any surface under
 * a lift must leave at least the actor height (1.22 m) below the lift's
 * bottom stop (`family.lift.shaft-floor`).
 */
export function lintLifts(
  level: AuthoredLevelDocument,
  options: Pick<
    FamilyLintOptions,
    "minLiftDwell" | "maxLiftLandingGap" | "maxLiftLandingOffset"
  > &
    Partial<Pick<FamilyLintOptions, "liftBoardingCheckpoint">> = FAMILY_WORLD_LINT_PRESETS.a,
): FamilyLintFinding[] {
  const surfaces = surfacesOf(level);
  const findings: FamilyLintFinding[] = [];
  const checkpointed = new Set<string>();
  for (const piece of level.pieces)
    if (piece.type === "checkpoint") checkpointed.add(piece.platformId);
  level.pieces.forEach((piece, pieceIndex) => {
    if (piece.type !== "lift") return;
    const lift = piece as AuthoredLiftPiece;
    const dwell = lift.travel.dwell ?? 0;
    if (dwell < options.minLiftDwell - EPSILON)
      findings.push({
        rule: "lift",
        code: "family.lift.dwell",
        severity: "error",
        path: `$.pieces[${pieceIndex}].travel.dwell`,
        subject: lift.id,
        message: `Lift ${JSON.stringify(lift.id)} dwells ${dwell}s at its stops; it needs at least ${options.minLiftDwell}s`,
        measured: dwell,
        limit: options.minLiftDwell,
      });
    const stops = authoredSurfaceTopRange(lift);
    const liftBounds = authoredSurfaceBounds(lift);
    const underside = lift.center.y - lift.size.y / 2;
    for (const other of surfaces.values()) {
      if (other.id === lift.id || other.type === "lift") continue;
      if (!interiorOverlap(liftBounds, authoredSurfaceBounds(other))) continue;
      const otherTop = authoredSurfaceTopRange(other).max;
      if (otherTop > underside + EPSILON) continue;
      const headroom = underside - otherTop;
      if (headroom < AUTHORED_LEVEL_LIMITS.actorHeight - EPSILON)
        findings.push({
          rule: "lift",
          code: "family.lift.shaft-floor",
          severity: "error",
          path: `$.pieces[${pieceIndex}]`,
          subject: `${lift.id}/${other.id}`,
          message: `${JSON.stringify(other.id)} lies under lift ${JSON.stringify(lift.id)} with ${round(headroom)}m below its bottom stop, so the descending lift pushes a player standing there through it; leave at least ${AUTHORED_LEVEL_LIMITS.actorHeight}m or open the shaft`,
          measured: round(headroom),
          limit: AUTHORED_LEVEL_LIMITS.actorHeight,
        });
    }
    level.connections.forEach((connection, index) => {
      if (connection.mode !== "ride") return;
      if (connection.from !== lift.id && connection.to !== lift.id) return;
      const landing = surfaces.get(connection.from === lift.id ? connection.to : connection.from);
      if (!landing || landing.type === "lift") return;
      const landingTop = topOf(landing);
      const stop =
        Math.abs(landingTop - stops.min) <= Math.abs(landingTop - stops.max) ? "bottom" : "top";
      const stopTop = stop === "bottom" ? stops.min : stops.max;
      const gap = authoredSurfaceGap(lift, landing);
      const offset = landingTop - stopTop;
      const path = `$.connections[${index}]`;
      if (connection.to === lift.id && !checkpointed.has(landing.id))
        findings.push({
          rule: "lift",
          code: "family.lift.boarding-checkpoint",
          severity: options.liftBoardingCheckpoint ?? "warning",
          path,
          subject: label(connection),
          message: `Landing ${JSON.stringify(landing.id)} boards lift ${JSON.stringify(lift.id)} but holds no checkpoint; a child who walks in while the lift is away falls into the shaft, so place a checkpoint on the landing`,
        });
      if (gap > options.maxLiftLandingGap + EPSILON)
        findings.push({
          rule: "lift",
          code: "family.lift.landing-gap",
          severity: "error",
          path,
          subject: label(connection),
          message: `Landing ${JSON.stringify(landing.id)} sits ${round(gap)}m from lift ${JSON.stringify(lift.id)} at its ${stop} stop; keep it within ${options.maxLiftLandingGap}m`,
          measured: round(gap),
          limit: options.maxLiftLandingGap,
        });
      if (Math.abs(offset) > options.maxLiftLandingOffset + EPSILON)
        findings.push({
          rule: "lift",
          code: "family.lift.landing-offset",
          severity: "error",
          path,
          subject: label(connection),
          message: `Landing ${JSON.stringify(landing.id)} is ${round(Math.abs(offset))}m ${offset > 0 ? "above" : "below"} lift ${JSON.stringify(lift.id)}'s ${stop} stop; keep it within ${options.maxLiftLandingOffset}m`,
          measured: round(Math.abs(offset)),
          limit: options.maxLiftLandingOffset,
        });
      // The connection's direction, not the stop, says which way a walking
      // child steps: boarding steps from the landing onto the lift, leaving
      // steps from the lift onto the landing, whether the ride goes up or
      // down. Either step up beyond the walk tolerance needs a hop.
      const boarding = connection.to === lift.id;
      const stepUp = boarding ? -offset : offset;
      if (stepUp > WALK_STEP_UP + EPSILON)
        findings.push({
          rule: "lift",
          code: "family.lift.step-up",
          severity: "warning",
          path,
          subject: label(connection),
          message: `At its ${stop} stop lift ${JSON.stringify(lift.id)} needs a ${round(stepUp)}m step up to ${boarding ? "board from" : "leave onto"} ${JSON.stringify(landing.id)}; a walking child must hop`,
          measured: round(stepUp),
          limit: WALK_STEP_UP,
        });
    });
  });
  return findings;
}

// ---------------------------------------------------------------------------

/** Runs every family lint; `options` defaults to the World A preset. */
export function lintFamilyChapter(
  level: AuthoredLevelDocument,
  options: Partial<FamilyLintOptions> & { readonly world?: "a" | "b" } = {},
): readonly FamilyLintFinding[] {
  const settings: FamilyLintOptions = {
    ...FAMILY_WORLD_LINT_PRESETS[options.world ?? "a"],
    ...Object.fromEntries(
      Object.entries(options).filter(([key, value]) => key !== "world" && value !== undefined),
    ),
  };
  return Object.freeze([
    ...lintPadGaps(level, settings),
    ...lintCameraHeadings(level, settings),
    ...lintStrikeEnvelopes(level, settings),
    ...lintBossRetryDistance(level, settings),
    ...lintChapterEnding(level),
    ...lintLifts(level, settings),
  ]);
}
