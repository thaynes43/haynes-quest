/**
 * Kid-model helpers for the family-world chapters (PLAN-019 rulings R2, R6,
 * R10; the critique's shared helper list).
 *
 * `growth-traversal-lib.ts` proves an edge can be crossed. These helpers ask
 * what a small child actually does: walk onto a bounce pad at a partial
 * stick without pressing Jump (`bounceWalkOn`), walk toward a lift at a
 * random moment (`liftWalkIn`), and run the whole required route while
 * waiting for, and walking around, the sweepers
 * (`runGrowthRouteWithWaits`, the R10 pacing measurement). Every frame still
 * advances only through the real `stepObby`.
 */
import type { AbilitySet } from "../../src/shared/abilities";
import { abilitiesForAge } from "../../src/shared/abilities";
import { AUTHORED_LEVEL_LIMITS } from "../../src/shared/authored-level";
import type { AuthoredConnection, ResolvedAuthoredLevel } from "../../src/shared/authored-level";
import { getAvatarProportions } from "../../src/game/controller";
import type { ObbyCourse, ObbyHazard, ObbyPlatform } from "../../src/game/obby";
import {
  connectionAim,
  edgeEntry,
  FRAME_SECONDS,
  sampledPlatform,
  type AppearanceStage,
  type DropStyle,
  type EdgeResult,
} from "./authored-traversal-lib";
import {
  createGrowthSimulation,
  growthStep,
  motionCycleSeconds,
  routeRunResult,
  runRouteLeg,
  startRouteSimulation,
  type GrowthSimulation,
  type RouteLegPlan,
  type RouteRun,
} from "./growth-traversal-lib";

type Point = Readonly<{ x: number; z: number }>;

/** R2: every required bounce must succeed at analog stick 0.4–1.0. */
export const R2_STICKS = Object.freeze([0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] as const);

function platformOf(course: ObbyCourse, id: string): ObbyPlatform {
  const platform = course.platforms.find((candidate) => candidate.id === id);
  if (!platform) throw new Error(`Course platform ${id} is missing`);
  return platform;
}

function towards(
  simulation: GrowthSimulation,
  target: Point,
  stick: number,
): { moveX: number; moveY: number } {
  const deltaX = target.x - simulation.state.position.x;
  const deltaZ = target.z - simulation.state.position.z;
  const distance = Math.hypot(deltaX, deltaZ) || 1;
  return { moveX: (stick * deltaX) / distance, moveY: (-stick * deltaZ) / distance };
}

// ---------------------------------------------------------------------------
// R2: walking onto a bounce pad.
// ---------------------------------------------------------------------------

export interface BounceWalkOnOptions {
  /** Analog stick magnitude, 0–1. */
  readonly stick: number;
  readonly stage: AppearanceStage;
  /** Sideways start offset on the deck, as `edgeEntry`'s lateral. */
  readonly lateral?: number;
  /** Metres from the deck's pad-side edge where the walk starts (default 1.5). */
  readonly runUp?: number;
  /** Defaults to the age-0 set: a pad needs no growth move. */
  readonly abilities?: AbilitySet;
  /** Frame budget (default 10 s). */
  readonly maxFrames?: number;
}

/**
 * A child on `deckId` holds the stick at `stick` toward the pad, never
 * pressing Jump, and keeps pushing toward the landing once the pad has
 * launched them. Reached means grounded on `destId` without a recovery;
 * bouncing again after meeting the landing's wall is allowed.
 */
export function bounceWalkOn(
  level: ResolvedAuthoredLevel,
  deckId: string,
  padId: string,
  destId: string,
  options: BounceWalkOnOptions,
): EdgeResult & { readonly bounces: number } {
  const course = level.course;
  const approach = { from: deckId, to: padId, mode: "walk" as const };
  const landing = { from: padId, to: destId, mode: "bounce" as const };
  const start = edgeEntry(course, approach, 0, options.runUp ?? 1.5, options.lateral ?? 0);
  const simulation = createGrowthSimulation(
    level,
    options.stage,
    options.abilities ?? abilitiesForAge(0),
    start,
  );
  growthStep(simulation, { move: { moveX: 0, moveY: 0 } });
  const startedOnSource =
    simulation.state.grounded && simulation.state.supportId === deckId;
  let airborne = false;
  let launched = false;
  const maxFrames = options.maxFrames ?? 600;
  for (let frame = 0; startedOnSource && frame < maxFrames; frame += 1) {
    const time = simulation.timeSeconds + FRAME_SECONDS;
    const target = launched
      ? connectionAim(course, landing, time)
      : sampledPlatform(course, padId, time).center;
    const result = growthStep(simulation, { move: towards(simulation, target, options.stick) });
    launched ||= result.bouncePadId === padId;
    airborne ||= !simulation.state.grounded;
    if (simulation.recoveries > 0) break;
    if (launched && simulation.state.grounded && simulation.state.supportId === destId) break;
  }
  return {
    reached:
      startedOnSource &&
      simulation.recoveries === 0 &&
      simulation.state.grounded &&
      simulation.state.supportId === destId,
    recovered: simulation.recoveries > 0,
    airborne,
    startedOnSource,
    supportId: simulation.state.supportId,
    position: { ...simulation.state.position },
    bounces: simulation.bounces.filter((id) => id === padId).length,
  };
}

// ---------------------------------------------------------------------------
// R6: walking toward a lift at a random moment.
// ---------------------------------------------------------------------------

export interface LiftWalkInOptions {
  /** Start times spread evenly across one lift cycle. */
  readonly phases: number;
  readonly stage: AppearanceStage;
  /** Analog stick magnitude, 0–1 (default 1). */
  readonly stick?: number;
  /** Metres from the landing's lift-side edge where each walk starts (default 1.5). */
  readonly runUp?: number;
  readonly abilities?: AbilitySet;
}

export interface LiftWalkInResult {
  /** Arrivals that boarded, rode and walked off onto `toId`. */
  readonly ok: number;
  /** Arrivals that ended in a recovery (the open shaft, usually). */
  readonly fell: number;
  /** Arrivals that timed out without either. */
  readonly other: number;
}

/**
 * A child walks from `fromId` straight at the lift without waiting for it,
 * at `phases` evenly spaced moments of its cycle. On board they stand still
 * until the lift reaches `toId`'s height, then walk off. Counts how many
 * arrivals ride through and how many fall into the open shaft: dwell alone
 * does not make a lift safe, so a boarding landing needs a checkpoint.
 */
export function liftWalkIn(
  level: ResolvedAuthoredLevel,
  liftId: string,
  fromId: string,
  toId: string,
  options: LiftWalkInOptions,
): LiftWalkInResult {
  const course = level.course;
  const lift = platformOf(course, liftId);
  const cycle = motionCycleSeconds(lift);
  const stick = options.stick ?? 1;
  const topOf = (id: string, time: number) => {
    const sampled = sampledPlatform(course, id, time);
    return sampled.center.y + sampled.size.y / 2;
  };
  const toTop = topOf(toId, 0);
  let ok = 0;
  let fell = 0;
  let other = 0;
  for (let index = 0; index < options.phases; index += 1) {
    const startTime = (cycle * index) / options.phases;
    const start = edgeEntry(
      course,
      { from: fromId, to: liftId, mode: "ride" },
      startTime,
      options.runUp ?? 1.5,
      0,
    );
    const simulation = createGrowthSimulation(
      level,
      options.stage,
      options.abilities ?? abilitiesForAge(0),
      start,
      startTime,
    );
    let outcome: "ok" | "fell" | "other" = "other";
    let phase: "approach" | "ride" | "exit" = "approach";
    const budget = Math.ceil((cycle * 2 + 10) / FRAME_SECONDS);
    for (let frame = 0; frame < budget; frame += 1) {
      const time = simulation.timeSeconds + FRAME_SECONDS;
      let move = { moveX: 0, moveY: 0 };
      if (phase === "approach") move = towards(simulation, sampledPlatform(course, liftId, time).center, stick);
      else if (phase === "exit") move = towards(simulation, sampledPlatform(course, toId, time).center, stick);
      growthStep(simulation, { move });
      if (simulation.recoveries > 0) {
        outcome = "fell";
        break;
      }
      const on = simulation.state.grounded ? simulation.state.supportId : null;
      if (on === toId && phase !== "approach") {
        outcome = "ok";
        break;
      }
      if (phase === "approach" && on === liftId) phase = "ride";
      if (phase === "ride" && Math.abs(topOf(liftId, simulation.timeSeconds) - toTop) <= 0.05)
        phase = "exit";
    }
    if (outcome === "ok") ok += 1;
    else if (outcome === "fell") fell += 1;
    else other += 1;
  }
  return { ok, fell, other };
}

// ---------------------------------------------------------------------------
// R10: the required route, waiting for and walking around sweepers.
// ---------------------------------------------------------------------------

export interface PatientRouteOptions {
  /** Longest single wait tried per crossing, in seconds (default: the longest sweeper cycle + 1 s, at least 4 s). */
  readonly maxWaitSeconds?: number;
  /** Step between the waits tried, in seconds (default 0.25). */
  readonly waitStepSeconds?: number;
  /** Sideways takeoff offsets tried, in order (default 0, ±0.6, ±1.2 m). */
  readonly laterals?: readonly number[];
  readonly dropStyle?: DropStyle;
}

export interface PatientRouteRun extends RouteRun {
  /** Seconds spent standing still for a sweeper window (lift and ferry waits excluded). */
  readonly hazardWaitSeconds: number;
  /** Connections whose approach walked around a sweeper. */
  readonly detours: readonly string[];
}

interface Rect {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

function hazardCycleSeconds(hazard: ObbyHazard): number {
  const rotation = hazard.rotation?.period ?? 0;
  const motion = hazard.motion
    ? hazard.motion.period + 2 * Math.max(0, hazard.motion.dwell ?? 0)
    : 0;
  return Math.max(
    Number.isFinite(rotation) && rotation > 0 ? rotation : 0,
    Number.isFinite(motion) && motion > 0 ? motion : 0,
  );
}

/**
 * Every place a sweeper's bar can be at standing height above `top`, as a
 * rectangle expanded by the avatar radius and a small margin.
 */
function hazardZones(course: ObbyCourse, top: number, radius: number, height: number): Rect[] {
  const zones: Rect[] = [];
  for (const hazard of course.hazards ?? []) {
    const motion = hazard.motion;
    const vertical = motion?.axis === "y" ? Math.abs(motion.distance) : 0;
    if (
      hazard.center.y - hazard.radius - vertical >= top + height ||
      hazard.center.y + hazard.radius + vertical <= top
    )
      continue;
    const spinning =
      hazard.rotation !== undefined &&
      Number.isFinite(hazard.rotation.period) &&
      hazard.rotation.period > 0;
    const angle = hazard.rotation && !spinning ? (hazard.rotation.phase ?? 0) : 0;
    const reachX = spinning
      ? hazard.halfLength
      : Math.abs(Math.cos(angle)) * hazard.halfLength;
    const reachZ = spinning
      ? hazard.halfLength
      : Math.abs(Math.sin(angle)) * hazard.halfLength;
    const pad = hazard.radius + radius + 0.12;
    const slideX = motion?.axis === "x" ? Math.abs(motion.distance) : 0;
    const slideZ = motion?.axis === "z" ? Math.abs(motion.distance) : 0;
    zones.push({
      minX: hazard.center.x - reachX - slideX - pad,
      maxX: hazard.center.x + reachX + slideX + pad,
      minZ: hazard.center.z - reachZ - slideZ - pad,
      maxZ: hazard.center.z + reachZ + slideZ + pad,
    });
  }
  return zones;
}

function inside(rect: Rect, point: Point): boolean {
  return (
    point.x > rect.minX + 1e-9 &&
    point.x < rect.maxX - 1e-9 &&
    point.z > rect.minZ + 1e-9 &&
    point.z < rect.maxZ - 1e-9
  );
}

/** Whether the segment passes through the rectangle's interior (Liang–Barsky). */
function crosses(rect: Rect, a: Point, b: Point): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  let enter = 0;
  let leave = 1;
  for (const [p, q] of [
    [-dx, a.x - rect.minX],
    [dx, rect.maxX - a.x],
    [-dz, a.z - rect.minZ],
    [dz, rect.maxZ - a.z],
  ] as const) {
    if (Math.abs(p) < 1e-12) {
      if (q <= 1e-9) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) enter = Math.max(enter, t);
    else leave = Math.min(leave, t);
    if (enter >= leave) return false;
  }
  return (leave - enter) * Math.hypot(dx, dz) > 1e-6;
}

/**
 * The shortest walk on a static support from `start` to `goal` that keeps
 * out of every sweeper zone, through the zones' corners. Returns the points
 * between the two (empty when the straight line is clear), or null when no
 * such walk stays on the support. Zones that already hold the start or goal
 * are left to the wait search.
 */
function detourAround(
  support: ObbyPlatform,
  zones: readonly Rect[],
  start: Point,
  goal: Point,
  radius: number,
): Point[] | null {
  const blocking = zones.filter((zone) => !inside(zone, start) && !inside(zone, goal));
  const clear = (a: Point, b: Point) => blocking.every((zone) => !crosses(zone, a, b));
  if (clear(start, goal)) return [];
  const inset = radius + 0.05;
  const walkable = (point: Point) =>
    point.x >= support.center.x - support.size.x / 2 + inset &&
    point.x <= support.center.x + support.size.x / 2 - inset &&
    point.z >= support.center.z - support.size.z / 2 + inset &&
    point.z <= support.center.z + support.size.z / 2 - inset &&
    blocking.every((zone) => !inside(zone, point));
  const corners: Point[] = [];
  for (const zone of blocking)
    for (const x of [zone.minX - 0.05, zone.maxX + 0.05])
      for (const z of [zone.minZ - 0.05, zone.maxZ + 0.05])
        if (walkable({ x, z })) corners.push({ x, z });
  const nodes: Point[] = [start, ...corners, goal];
  const goalIndex = nodes.length - 1;
  const cost = nodes.map(() => Number.POSITIVE_INFINITY);
  const previous = nodes.map(() => -1);
  const done = nodes.map(() => false);
  cost[0] = 0;
  for (;;) {
    let current = -1;
    for (let index = 0; index < nodes.length; index += 1)
      if (!done[index] && (current < 0 || cost[index]! < cost[current]!)) current = index;
    if (current < 0 || cost[current] === Number.POSITIVE_INFINITY) return null;
    if (current === goalIndex) break;
    done[current] = true;
    for (let next = 0; next < nodes.length; next += 1) {
      if (done[next] || !clear(nodes[current]!, nodes[next]!)) continue;
      const total =
        cost[current]! +
        Math.hypot(nodes[next]!.x - nodes[current]!.x, nodes[next]!.z - nodes[current]!.z);
      if (total < cost[next]!) {
        cost[next] = total;
        previous[next] = current;
      }
    }
  }
  const path: Point[] = [];
  for (let index = previous[goalIndex]!; index > 0; index = previous[index]!)
    path.unshift(nodes[index]!);
  return path;
}

function fork(simulation: GrowthSimulation): GrowthSimulation {
  return {
    ...simulation,
    state: structuredClone(simulation.state),
    bounces: [...simulation.bounces],
    ...(simulation.trace ? { trace: [...simulation.trace] } : {}),
  };
}

interface Candidate {
  readonly plan: RouteLegPlan;
  readonly waitFrames: number;
  readonly detoured: boolean;
}

/** One leg's committed plan from `planPatientLeg`. */
export interface PatientLegPlan {
  readonly plan: RouteLegPlan;
  /** Frames spent standing for a sweeper window before or at the takeoff. */
  readonly waitFrames: number;
  /** Whether the approach walks around a sweeper zone on the current deck. */
  readonly detoured: boolean;
  /** The simulation after the leg, when the plan crosses without a recovery. */
  readonly result: GrowthSimulation;
}

/**
 * The patient kid's choice for one leg, from the simulation's current state
 * (which it never mutates). It looks ahead on copies: first the plain
 * approach, then a walk around the sweeper zones on the current deck, then
 * waits (before walking or at the takeoff) in `waitStepSeconds` steps up to
 * `maxWaitSeconds`, at each sideways offset. It returns the first plan that
 * crosses without a recovery, preferring the shortest wait, or null.
 *
 * The browser lockstep pilots (`tests/e2e/family-world-lockstep.ts` and
 * `tests/e2e/family-world.ts`) call this from the live game state before each
 * leg, so the scripted kid and the browser run share one planner. A
 * simulation with `frameSeconds` plans in that frame length, and one with a
 * `trace` records every planned frame in `result.trace`.
 */
export function planPatientLeg(
  level: ResolvedAuthoredLevel,
  simulation: GrowthSimulation,
  connection: AuthoredConnection,
  options: PatientRouteOptions = {},
): PatientLegPlan | null {
  const course = level.course;
  const proportions = getAvatarProportions(simulation.stage);
  const longestCycle = Math.max(0, ...(course.hazards ?? []).map(hazardCycleSeconds));
  const maxWait = options.maxWaitSeconds ?? Math.max(4, longestCycle + 1);
  const step = options.waitStepSeconds ?? 0.25;
  const laterals = options.laterals ?? [0, -0.6, 0.6, -1.2, 1.2];
  const frameSeconds = simulation.frameSeconds ?? FRAME_SECONDS;
  const stepFrames = Math.max(1, Math.round(step / frameSeconds));
  const maxFrames = Math.round(maxWait / frameSeconds);
  const from = platformOf(course, connection.from);
  const staticSource = !from.motion && !from.bounce && !from.crumble;
  const top = from.center.y + from.size.y / 2;
  const zones = staticSource
    ? hazardZones(course, top, proportions.colliderRadius, AUTHORED_LEVEL_LIMITS.actorHeight)
    : [];
  const inset = connection.mode === "walk" ? 1.2 : 0.75;
  const routesFor = (lateral: number): Array<{ waypoints: Point[]; detoured: boolean }> => {
    const routes: Array<{ waypoints: Point[]; detoured: boolean }> = [
      { waypoints: [], detoured: false },
    ];
    if (zones.length === 0) return routes;
    const goal = edgeEntry(course, connection, simulation.timeSeconds, inset, lateral);
    const around = detourAround(from, zones, simulation.state.position, goal, proportions.colliderRadius);
    if (around && around.length > 0) routes.push({ waypoints: around, detoured: true });
    return routes;
  };
  const routeCache = new Map<number, Array<{ waypoints: Point[]; detoured: boolean }>>();
  const candidates = function* (): Generator<Candidate> {
    for (let wait = 0; wait <= maxFrames; wait += stepFrames)
      for (const lateral of laterals) {
        let routes = routeCache.get(lateral);
        if (!routes) {
          routes = routesFor(lateral);
          routeCache.set(lateral, routes);
        }
        for (const route of routes) {
          const base = {
            waypoints: route.waypoints,
            lateral,
            ...(options.dropStyle === undefined ? {} : { dropStyle: options.dropStyle }),
          };
          if (wait === 0) {
            yield { plan: base, waitFrames: 0, detoured: route.detoured };
            continue;
          }
          yield { plan: { ...base, waitBeforeFrames: wait }, waitFrames: wait, detoured: route.detoured };
          yield { plan: { ...base, waitAtTakeoffFrames: wait }, waitFrames: wait, detoured: route.detoured };
        }
      }
  };
  for (const candidate of candidates()) {
    const trial = fork(simulation);
    if (runRouteLeg(trial, connection, candidate.plan) && trial.recoveries === simulation.recoveries)
      return { ...candidate, result: trial };
  }
  return null;
}

/**
 * The patient scripted kid, for R10 pacing evidence. Like `runGrowthRoute`
 * it walks to each takeoff point, waits for lifts and ferries, and crosses,
 * one state and one clock through `stepObby`. Before each crossing it commits
 * the plan `planPatientLeg` chooses, so the run's `seconds` include the time
 * a careful child spends waiting for a sweeper to pass.
 */
export function runGrowthRouteWithWaits(
  level: ResolvedAuthoredLevel,
  path: readonly string[],
  stage: AppearanceStage,
  abilities: AbilitySet,
  options: PatientRouteOptions = {},
): PatientRouteRun {
  let simulation = startRouteSimulation(level, path, stage, abilities);
  const completed: string[] = [];
  const detours: string[] = [];
  let hazardWaitFrames = 0;

  for (let index = 0; index + 1 < path.length; index += 1) {
    const fromId = path[index]!;
    const toId = path[index + 1]!;
    const connection = level.graph.connections.find(
      (candidate) => candidate.from === fromId && candidate.to === toId,
    );
    const label = `${fromId}->${toId}`;
    if (!connection) return finish(label);
    const adopted = planPatientLeg(level, simulation, connection, options);
    if (!adopted) {
      // Report a real attempt: the plain approach, on the committed state.
      runRouteLeg(simulation, connection, options.dropStyle === undefined ? {} : { dropStyle: options.dropStyle });
      return finish(label);
    }
    simulation = adopted.result;
    hazardWaitFrames += adopted.waitFrames;
    if (adopted.detoured) detours.push(label);
    completed.push(label);
  }
  return finish(null);

  function finish(failedAt: string | null): PatientRouteRun {
    return {
      ...routeRunResult(simulation, completed, failedAt),
      hazardWaitSeconds: Math.round(hazardWaitFrames * FRAME_SECONDS * 1000) / 1000,
      detours: [...detours],
    };
  }
}
