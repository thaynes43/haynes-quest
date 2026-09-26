/**
 * Ability-aware auto-pilot for DESIGN-025 courses.
 *
 * Like `authored-traversal-lib.ts`, this drives the real `stepObby` at 60 Hz
 * over a resolved authored level. It adds what growth courses need: a frozen
 * ability set per run, the double-jump press near the apex, a held Jump for
 * gliding, waiting for a lift at the right stop, and bounce-pad launches.
 * After initial placement every frame advances only through `stepObby`.
 */
import type { AbilitySet } from "../../src/shared/abilities";
import { growthMoveTuning } from "../../src/shared/abilities";
import type {
  AuthoredConnection,
  ResolvedAuthoredLevel,
} from "../../src/shared/authored-level";
import { getAvatarProportions } from "../../src/game/controller";
import {
  createObbyState,
  sampleObby,
  stepObby,
  type ObbyCourse,
  type ObbyPlatform,
  type ObbyState,
  type ObbyStepResult,
} from "../../src/game/obby";
import {
  edgeEntry,
  ferryPhase,
  FRAME_SECONDS,
  inputToward,
  jumpsAcross,
  ROUTE_MEMORY_TUNING,
  sampledPlatform,
  type AppearanceStage,
  type EdgeResult,
  type MoveInput,
  type TraverseEdgeOptions,
} from "./authored-traversal-lib";

export interface GrowthSimulation {
  readonly course: ObbyCourse;
  readonly stage: AppearanceStage;
  readonly abilities: AbilitySet;
  readonly state: ObbyState;
  timeSeconds: number;
  bounces: string[];
  recoveries: number;
  maxFeetY: number;
}

export interface GrowthControl {
  readonly move: MoveInput;
  readonly jumpPressed?: boolean;
  readonly jumpHeld?: boolean;
}

export function growthStep(
  simulation: GrowthSimulation,
  control: GrowthControl,
): ObbyStepResult {
  simulation.timeSeconds += FRAME_SECONDS;
  const proportions = getAvatarProportions(simulation.stage);
  const result = stepObby(simulation.state, control.move, simulation.course, {
    deltaSeconds: FRAME_SECONDS,
    timeSeconds: simulation.timeSeconds,
    cameraYaw: 0,
    canJump: true,
    jumpPressed: control.jumpPressed === true,
    jumpHeld: control.jumpHeld === true,
    abilities: growthMoveTuning(simulation.abilities),
    radius: proportions.colliderRadius,
    height: proportions.height,
    tuning: ROUTE_MEMORY_TUNING,
  });
  if (result.bouncePadId) simulation.bounces.push(result.bouncePadId);
  if (result.recovered) simulation.recoveries += 1;
  simulation.maxFeetY = Math.max(simulation.maxFeetY, simulation.state.position.y);
  return result;
}

export function createGrowthSimulation(
  level: ResolvedAuthoredLevel,
  stage: AppearanceStage,
  abilities: AbilitySet,
  position: Readonly<{ x: number; y: number; z: number }>,
  timeSeconds = 0,
): GrowthSimulation {
  return {
    course: level.course,
    stage,
    abilities,
    state: createObbyState({ ...position }),
    timeSeconds,
    bounces: [],
    recoveries: 0,
    maxFeetY: position.y,
  };
}

function coursePlatform(course: ObbyCourse, id: string): ObbyPlatform {
  const platform = course.platforms.find((candidate) => candidate.id === id);
  if (!platform) throw new Error(`Course platform ${id} is missing`);
  return platform;
}

function sampledTop(course: ObbyCourse, id: string, time: number): number {
  const platform = sampledPlatform(course, id, time);
  return platform.center.y + platform.size.y / 2;
}

function isLift(platform: ObbyPlatform): boolean {
  return platform.motion?.axis === "y";
}

/** Seconds per full cycle of a moving platform, including any stop dwell. */
export function motionCycleSeconds(platform: ObbyPlatform): number {
  const motion = platform.motion;
  if (!motion) return 0;
  return motion.period + 2 * Math.max(0, motion.dwell ?? 0);
}

/**
 * The first time at or after `from` when a lift's top is closest to `top`,
 * searched over two full cycles (dwell included) at the frame rate. With a
 * dwell this is the start of the pause at that stop.
 */
export function liftTimeAtTop(
  course: ObbyCourse,
  liftId: string,
  top: number,
  from: number,
): number {
  const lift = coursePlatform(course, liftId);
  const period = motionCycleSeconds(lift);
  let best = from;
  let bestError = Number.POSITIVE_INFINITY;
  for (let time = from; time <= from + period * 2; time += FRAME_SECONDS) {
    const error = Math.abs(sampledTop(course, liftId, time) - top);
    if (error < bestError - 1e-9) {
      best = time;
      bestError = error;
    }
  }
  return best;
}

interface ManeuverResult {
  readonly reached: boolean;
  readonly airborne: boolean;
}

/** Whether `stepObby` now reports the destination as the support (or a pad launch from it). */
function arrived(simulation: GrowthSimulation, to: ObbyPlatform, launched: boolean): boolean {
  if (to.bounce) return launched;
  return simulation.state.grounded && simulation.state.supportId === to.id;
}

/**
 * Crosses one connection from the simulation's current state. The caller has
 * already put the player on the source. Returns when the destination supports
 * the player, a recovery happens, or the frame budget runs out.
 */
export function performConnection(
  simulation: GrowthSimulation,
  connection: AuthoredConnection,
  maxFrames = 240,
  options: TraverseEdgeOptions = {},
): ManeuverResult {
  const course = simulation.course;
  const to = coursePlatform(course, connection.to);
  const recoveriesBefore = simulation.recoveries;
  // A pad launches on its own; a drop hops unless asked to step off.
  const jumps = connection.mode !== "bounce" && jumpsAcross(connection, options);
  const doubleJump = connection.requires === "double-jump";
  const glide = connection.requires === "glide";
  let airborne = false;
  let secondPressDone = false;
  for (let frame = 0; frame < maxFrames; frame += 1) {
    const target = sampledPlatform(
      course,
      to.id,
      simulation.timeSeconds + FRAME_SECONDS,
    );
    const move = inputToward(simulation.state, target.center);
    // The second press of a double jump lands near the apex of the first.
    const secondPress =
      doubleJump &&
      !secondPressDone &&
      airborne &&
      !simulation.state.grounded &&
      simulation.state.velocityY <= 0.6;
    if (secondPress) secondPressDone = true;
    const result = growthStep(simulation, {
      move,
      jumpPressed: (jumps && frame === 0) || secondPress,
      jumpHeld: glide,
    });
    airborne ||= !simulation.state.grounded;
    if (simulation.recoveries > recoveriesBefore) return { reached: false, airborne };
    if (arrived(simulation, to, result.bouncePadId === to.id))
      return { reached: true, airborne };
  }
  return { reached: false, airborne };
}

/** Waits, standing still, until `until(simulation)` holds or the budget ends. */
export function waitUntil(
  simulation: GrowthSimulation,
  until: (simulation: GrowthSimulation) => boolean,
  maxFrames: number,
): boolean {
  for (let frame = 0; frame < maxFrames; frame += 1) {
    if (until(simulation)) return true;
    growthStep(simulation, { move: { moveX: 0, moveY: 0 } });
  }
  return until(simulation);
}

/**
 * Exercises one edge from one valid entry with the given ability set, the way
 * `traverseEdge` does for published routes: isolated, starting just inside
 * the source edge (or on a lift at the right stop), advancing only through
 * `stepObby`.
 */
export function traverseGrowthEdge(
  level: ResolvedAuthoredLevel,
  connection: AuthoredConnection,
  stage: AppearanceStage,
  abilities: AbilitySet,
  lateral = 0,
  options: TraverseEdgeOptions = {},
): EdgeResult & { readonly bounces: readonly string[] } {
  const course = level.course;
  const from = coursePlatform(course, connection.from);
  const to = coursePlatform(course, connection.to);
  let startTime = 0;
  if (connection.mode === "ride" && isLift(to)) {
    // Board just before the lift reaches the source's height.
    const fromTop = sampledTop(course, from.id, 0);
    startTime = Math.max(0, liftTimeAtTop(course, to.id, fromTop, 0) - 0.2);
  } else if (connection.mode === "ride" && isLift(from)) {
    const toTop = sampledTop(course, to.id, 0);
    startTime = Math.max(0, liftTimeAtTop(course, from.id, toTop, 0) - 0.2);
  } else if (connection.mode === "ride") {
    startTime = ferryPhase(course, connection);
  }
  const inset =
    connection.mode === "walk" ? 2 : connection.mode === "bounce" ? 0.6 : 0.75;
  const entry = edgeEntry(course, connection, startTime, inset, lateral);
  const simulation = createGrowthSimulation(level, stage, abilities, entry, startTime);
  let startedOnSource: boolean;
  if (from.bounce) {
    // A pad launches on contact, so its journey starts with the landing.
    startedOnSource = true;
  } else {
    growthStep(simulation, { move: { moveX: 0, moveY: 0 } });
    startedOnSource =
      simulation.state.grounded && simulation.state.supportId === from.id;
  }
  const outcome = startedOnSource
    ? performConnection(simulation, connection, 240, options)
    : { reached: false, airborne: false };
  const launchedFromSource = !from.bounce || simulation.bounces.includes(from.id);
  return {
    reached: outcome.reached && launchedFromSource && simulation.recoveries === 0,
    recovered: simulation.recoveries > 0,
    airborne: outcome.airborne,
    startedOnSource,
    supportId: simulation.state.supportId,
    position: { ...simulation.state.position },
    bounces: [...simulation.bounces],
  };
}

/**
 * A deliberate miss of a practice jump: take off toward a point just beside
 * the destination and confirm the catch floor, not a recovery, receives the
 * player.
 */
export function missGrowthPractice(
  level: ResolvedAuthoredLevel,
  connection: AuthoredConnection,
  stage: AppearanceStage,
  abilities: AbilitySet,
): EdgeResult {
  if (!connection.safeMissPlatformId)
    throw new Error("A deliberate safe miss requires a catch platform");
  const course = level.course;
  // A practice bounce starts with the pad's launch, like traverseGrowthEdge.
  const bounce = connection.mode === "bounce";
  const simulation = createGrowthSimulation(
    level,
    stage,
    abilities,
    edgeEntry(course, connection, 0, bounce ? 0.6 : 0.75, 0),
  );
  growthStep(simulation, { move: { moveX: 0, moveY: 0 } });
  const startedOnSource = bounce
    ? simulation.bounces.includes(connection.from)
    : simulation.state.grounded && simulation.state.supportId === connection.from;
  const destination = sampledPlatform(course, connection.to, 0);
  const proportions = getAvatarProportions(stage);
  const missTarget = {
    x: destination.center.x + destination.size.x / 2 + proportions.colliderRadius + 0.25,
    z: destination.center.z,
  };
  let airborne = false;
  let reachedTarget = false;
  for (let frame = 0; frame < 240; frame += 1) {
    reachedTarget ||=
      Math.hypot(
        missTarget.x - simulation.state.position.x,
        missTarget.z - simulation.state.position.z,
      ) <= 0.08;
    growthStep(simulation, {
      move: reachedTarget ? { moveX: 0, moveY: 0 } : inputToward(simulation.state, missTarget),
      jumpPressed: frame === 0 && !bounce,
    });
    airborne ||= !simulation.state.grounded;
    if (simulation.recoveries > 0) break;
    if (
      airborne &&
      simulation.state.grounded &&
      simulation.state.supportId === connection.safeMissPlatformId
    )
      break;
  }
  return {
    reached:
      simulation.state.grounded &&
      simulation.state.supportId === connection.safeMissPlatformId &&
      simulation.recoveries === 0,
    recovered: simulation.recoveries > 0,
    airborne,
    startedOnSource,
    supportId: simulation.state.supportId,
    position: { ...simulation.state.position },
  };
}

/** Walks on the current support toward a point, stopping within 8 cm. */
export function walkTo(
  simulation: GrowthSimulation,
  target: Readonly<{ x: number; z: number }>,
  maxFrames: number,
): boolean {
  for (let frame = 0; frame < maxFrames; frame += 1) {
    if (
      Math.hypot(
        target.x - simulation.state.position.x,
        target.z - simulation.state.position.z,
      ) <= 0.08
    )
      return true;
    const recoveries = simulation.recoveries;
    growthStep(simulation, { move: inputToward(simulation.state, target) });
    if (simulation.recoveries > recoveries) return false;
  }
  return false;
}

/**
 * Frames to wait for a lift: the original 25 s budget, or one full cycle
 * (dwell included) plus a second when that is longer.
 */
function liftWaitFrames(lift: ObbyPlatform): number {
  return Math.max(60 * 25, Math.ceil((motionCycleSeconds(lift) + 1) / FRAME_SECONDS));
}

export interface RouteRun {
  readonly completed: readonly string[];
  readonly failedAt: string | null;
  readonly recoveries: number;
  readonly bounces: readonly string[];
  readonly seconds: number;
  readonly maxFeetY: number;
}

/**
 * One uninterrupted run along `path` from the source's current position.
 * Before each connection the player walks to that connection's takeoff point
 * on the current support, waits for a lift when needed, then crosses. This is
 * the scripted-kid claim: one state, one clock, only `stepObby`.
 */
export function runGrowthRoute(
  level: ResolvedAuthoredLevel,
  path: readonly string[],
  stage: AppearanceStage,
  abilities: AbilitySet,
): RouteRun {
  const course = level.course;
  const start = sampledPlatform(course, path[0]!, 0);
  const simulation = createGrowthSimulation(level, stage, abilities, {
    x: start.center.x,
    y: start.center.y + start.size.y / 2,
    z: start.center.z,
  });
  growthStep(simulation, { move: { moveX: 0, moveY: 0 } });
  const completed: string[] = [];
  for (let index = 0; index + 1 < path.length; index += 1) {
    const fromId = path[index]!;
    const toId = path[index + 1]!;
    const connection = level.graph.connections.find(
      (candidate) => candidate.from === fromId && candidate.to === toId,
    );
    const label = `${fromId}->${toId}`;
    if (!connection) return result(label);
    const from = coursePlatform(course, fromId);
    const to = coursePlatform(course, toId);
    if (!from.bounce) {
      // Walk to the takeoff point for this edge on the source.
      const inset = connection.mode === "walk" ? 1.2 : 0.75;
      if (isLift(from)) {
        const toTop = sampledTop(course, toId, simulation.timeSeconds);
        waitUntil(
          simulation,
          (sim) =>
            Math.abs(sampledTop(course, fromId, sim.timeSeconds) - toTop) <= 0.05,
          liftWaitFrames(from),
        );
      } else {
        const entry = edgeEntry(course, connection, simulation.timeSeconds, inset, 0);
        if (!walkTo(simulation, entry, 60 * 12)) return result(label);
        if (isLift(to)) {
          const fromTop = sampledTop(course, fromId, simulation.timeSeconds);
          if (
            !waitUntil(
              simulation,
              (sim) =>
                Math.abs(sampledTop(course, toId, sim.timeSeconds + 0.2) - fromTop) <= 0.05,
              liftWaitFrames(to),
            )
          )
            return result(label);
        } else if (to.motion) {
          // A horizontal ferry: wait until it is at its nearest point.
          const fromCenter = sampledPlatform(course, fromId, simulation.timeSeconds).center;
          waitUntil(
            simulation,
            (sim) => {
              const now = sampledPlatform(course, toId, sim.timeSeconds).center;
              const next = sampledPlatform(course, toId, sim.timeSeconds + FRAME_SECONDS).center;
              return (
                Math.hypot(next.x - fromCenter.x, next.z - fromCenter.z) >
                  Math.hypot(now.x - fromCenter.x, now.z - fromCenter.z) - 1e-9 &&
                Math.hypot(now.x - fromCenter.x, now.z - fromCenter.z) <=
                  Math.hypot(to.center.x - fromCenter.x, to.center.z - fromCenter.z)
              );
            },
            60 * 20,
          );
        }
      }
    }
    const outcome = performConnection(simulation, connection);
    if (!outcome.reached) return result(label);
    completed.push(label);
    // Riding a lift: the next edge waits on the lift for its stop.
  }
  return result(null);

  function result(failedAt: string | null): RouteRun {
    return {
      completed,
      failedAt,
      recoveries: simulation.recoveries,
      bounces: [...simulation.bounces],
      seconds: simulation.timeSeconds,
      maxFeetY: simulation.maxFeetY,
    };
  }
}

export function sampleSupportTop(course: ObbyCourse, id: string, time: number): number {
  const platform = sampleObby(course, time).platforms.find((entry) => entry.id === id);
  if (!platform) throw new Error(`Course platform ${id} is missing`);
  return platform.center.y + platform.size.y / 2;
}
