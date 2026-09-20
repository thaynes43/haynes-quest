/**
 * Reusable auto-pilot helpers for authored courses.
 *
 * These drive the real `stepObby` at 60 Hz over a resolved authored level and
 * were extracted verbatim from `authored-traversal.test.ts` so the level
 * editor's parity suite can prove an exported-and-reimported project is
 * *playable* the same way, not merely structurally equal. The extraction is
 * behaviour preserving: `authored-traversal.test.ts` imports them from here.
 */
import {
  AUTHORED_LEVEL_IDS,
  type AuthoredConnection,
  type ResolvedAuthoredLevel,
} from "../../src/shared/authored-level";
import { authoredRoute } from "../../src/game/authored-layout";
import { getAvatarProportions } from "../../src/game/controller";
import {
  createObbyState,
  sampleObby,
  stepObby,
  type ObbyCourse,
  type ObbyState,
  type ObbyStepResult,
} from "../../src/game/obby";

export type AppearanceStage = "infant" | "child";
export type MoveInput = { moveX: number; moveY: number };

export const FRAME_SECONDS = 1 / 60;
export const ROUTE_MEMORY_TUNING = { moveSpeed: 4 } as const;
export const LEVEL_FILES = AUTHORED_LEVEL_IDS;
export const STAGES = ["infant", "child"] as const;

export interface Simulation {
  readonly course: ObbyCourse;
  readonly stage: AppearanceStage;
  readonly state: ObbyState;
  timeSeconds: number;
}

export interface EdgeResult {
  readonly reached: boolean;
  readonly recovered: boolean;
  readonly airborne: boolean;
  readonly startedOnSource: boolean;
  readonly supportId: string | null;
  readonly position: Readonly<{ x: number; y: number; z: number }>;
}

export function loadLevel(
  id: (typeof LEVEL_FILES)[number],
): ResolvedAuthoredLevel {
  const level = authoredRoute(id);
  if (!level) throw new Error(`Registered authored route ${id} is missing`);
  return level;
}

export function sampledPlatform(
  course: ObbyCourse,
  id: string,
  timeSeconds: number,
) {
  const platform = sampleObby(course, timeSeconds).platforms.find(
    (candidate) => candidate.id === id,
  );
  if (!platform) throw new Error(`Course platform ${id} is missing`);
  return platform;
}

export function runtimeStep(
  simulation: Simulation,
  input: MoveInput,
  jumpPressed = false,
): ObbyStepResult {
  simulation.timeSeconds += FRAME_SECONDS;
  const proportions = getAvatarProportions(simulation.stage);
  return stepObby(simulation.state, input, simulation.course, {
    deltaSeconds: FRAME_SECONDS,
    timeSeconds: simulation.timeSeconds,
    cameraYaw: 0,
    canJump: true,
    jumpPressed,
    radius: proportions.colliderRadius,
    height: proportions.height,
    tuning: ROUTE_MEMORY_TUNING,
  });
}

export function ferryPhase(
  course: ObbyCourse,
  connection: AuthoredConnection,
): number {
  const moving = course.platforms.find(
    (platform) =>
      platform.motion &&
      (platform.id === connection.from || platform.id === connection.to),
  );
  if (!moving?.motion) return 0;
  const from = course.platforms.find(
    (platform) => platform.id === connection.from,
  );
  const to = course.platforms.find((platform) => platform.id === connection.to);
  if (!from || !to) throw new Error("Ride connection platform is missing");
  const axis = moving.motion.axis;
  const destination = moving.id === connection.to ? from : to;
  const direction = Math.sign(destination.center[axis] - moving.center[axis]);
  return direction >= 0
    ? moving.motion.period / 4
    : (moving.motion.period * 3) / 4;
}

export function inputToward(
  state: ObbyState,
  target: Readonly<{ x: number; z: number }>,
): MoveInput {
  const deltaX = target.x - state.position.x;
  const deltaZ = target.z - state.position.z;
  const distance = Math.hypot(deltaX, deltaZ) || 1;
  return { moveX: deltaX / distance, moveY: -deltaZ / distance };
}

export function moveTo(
  simulation: Simulation,
  target: Readonly<{ x: number; z: number }>,
  maxFrames: number,
): { reached: boolean; recovered: boolean; airborne: boolean } {
  let recovered = false;
  let airborne = false;
  for (let frame = 0; frame < maxFrames; frame += 1) {
    if (
      Math.hypot(
        target.x - simulation.state.position.x,
        target.z - simulation.state.position.z,
      ) <= 0.08
    )
      return { reached: true, recovered, airborne };
    const result = runtimeStep(
      simulation,
      inputToward(simulation.state, target),
    );
    recovered ||= result.recovered;
    airborne ||= !simulation.state.grounded;
    if (recovered) break;
  }
  return { reached: false, recovered, airborne };
}

/** Follows the clear side of a broad catch floor back onto its start pad. */
export function traverseSafeRetry(
  level: ResolvedAuthoredLevel,
  connection: AuthoredConnection,
  stage: AppearanceStage,
): EdgeResult {
  const source = sampledPlatform(level.course, connection.from, 0);
  const target = sampledPlatform(level.course, connection.to, 0);
  const proportions = getAvatarProportions(stage);
  const deltaX = target.center.x - source.center.x;
  const deltaZ = target.center.z - source.center.z;
  const travelAxis = Math.abs(deltaX) >= Math.abs(deltaZ) ? "x" : "z";
  const direction = Math.sign(travelAxis === "x" ? deltaX : deltaZ) || 1;
  const crossAxis = travelAxis === "x" ? "z" : "x";
  const sourceCrossHalf = source.size[crossAxis] / 2;
  const targetCrossHalf = target.size[crossAxis] / 2;
  const side =
    source.center[crossAxis] +
    sourceCrossHalf -
    proportions.colliderRadius -
    0.2;
  const targetSide = Math.min(
    target.center[crossAxis] + targetCrossHalf - 0.5,
    side,
  );
  const approachTravel =
    target.center[travelAxis] - direction * (target.size[travelAxis] / 2 + 0.5);
  const finishTravel =
    source.center[travelAxis] + direction * (source.size[travelAxis] / 2 + 0.5);
  const point = (cross: number, travel: number) =>
    travelAxis === "x" ? { x: travel, z: cross } : { x: cross, z: travel };
  const state = createObbyState({
    ...point(side, source.center[travelAxis]),
    y: source.center.y + source.size.y / 2,
  });
  const simulation: Simulation = {
    course: level.course,
    stage,
    state,
    timeSeconds: 0,
  };
  runtimeStep(simulation, { moveX: 0, moveY: 0 });
  const startedOnSource = state.grounded && state.supportId === connection.from;
  const approach = moveTo(simulation, point(side, approachTravel), 360);
  const finish =
    approach.reached && !approach.recovered
      ? moveTo(simulation, point(targetSide, finishTravel), 180)
      : { reached: false, recovered: approach.recovered, airborne: false };
  runtimeStep(simulation, { moveX: 0, moveY: 0 });
  return {
    reached:
      finish.reached && state.grounded && state.supportId === connection.to,
    recovered: approach.recovered || finish.recovered,
    airborne: approach.airborne || finish.airborne,
    startedOnSource,
    supportId: state.supportId,
    position: { ...state.position },
  };
}

/** A supported feet position inside the source edge, aimed at the target centre. */
export function edgeEntry(
  course: ObbyCourse,
  connection: AuthoredConnection,
  timeSeconds: number,
  inset: number,
  lateral: number,
) {
  const from = sampledPlatform(course, connection.from, timeSeconds);
  const to = sampledPlatform(course, connection.to, timeSeconds);
  const deltaX = to.center.x - from.center.x;
  const deltaZ = to.center.z - from.center.z;
  const distance = Math.hypot(deltaX, deltaZ);
  if (distance === 0) throw new Error("Connection platform centres coincide");
  const directionX = deltaX / distance;
  const directionZ = deltaZ / distance;
  const edgeX =
    Math.abs(directionX) < 1e-9
      ? Number.POSITIVE_INFINITY
      : from.size.x / 2 / Math.abs(directionX);
  const edgeZ =
    Math.abs(directionZ) < 1e-9
      ? Number.POSITIVE_INFINITY
      : from.size.z / 2 / Math.abs(directionZ);
  const forward = Math.max(0, Math.min(edgeX, edgeZ) - inset);
  return {
    x: from.center.x + directionX * forward - directionZ * lateral,
    y: from.center.y + from.size.y / 2,
    z: from.center.z + directionZ * forward + directionX * lateral,
  };
}

/**
 * Exercises one edge from one valid entry. This is deliberately an isolated
 * edge check: after initial placement it advances only through `stepObby` and
 * does not claim that an automated player completed the uninterrupted route.
 */
export function traverseEdge(
  level: ResolvedAuthoredLevel,
  connection: AuthoredConnection,
  stage: AppearanceStage,
  lateral = 0,
): EdgeResult {
  if (
    connection.mode === "walk" &&
    level.graph.connections.some(
      (candidate) => candidate.safeMissPlatformId === connection.from,
    )
  )
    return traverseSafeRetry(level, connection, stage);
  const startTime =
    connection.mode === "ride" ? ferryPhase(level.course, connection) : 0;
  const state = createObbyState(
    edgeEntry(
      level.course,
      connection,
      startTime,
      connection.mode === "walk" ? 2 : 0.75,
      lateral,
    ),
  );
  const simulation: Simulation = {
    course: level.course,
    stage,
    state,
    timeSeconds: startTime,
  };
  runtimeStep(simulation, { moveX: 0, moveY: 0 });
  const startedOnSource = state.grounded && state.supportId === connection.from;
  let airborne = false;
  let recovered = false;
  // Ride gaps are crossed with the normal jump input; the separate carry
  // checks below then prove the landing stays attached to the moving surface.
  const jump = connection.mode !== "walk";

  for (let frame = 0; startedOnSource && frame < 180; frame += 1) {
    const target = sampledPlatform(
      level.course,
      connection.to,
      simulation.timeSeconds + FRAME_SECONDS,
    );
    const deltaX = target.center.x - state.position.x;
    const deltaZ = target.center.z - state.position.z;
    const distance = Math.hypot(deltaX, deltaZ) || 1;
    const result = runtimeStep(
      simulation,
      { moveX: deltaX / distance, moveY: -deltaZ / distance },
      jump && frame === 0,
    );
    airborne ||= !state.grounded;
    recovered ||= result.recovered;
    if (
      result.recovered ||
      (state.grounded && state.supportId === connection.to)
    )
      break;
  }

  return {
    reached: state.grounded && state.supportId === connection.to && !recovered,
    recovered,
    airborne,
    startedOnSource,
    supportId: state.supportId,
    position: { ...state.position },
  };
}

export function missOntoSafeFloor(
  level: ResolvedAuthoredLevel,
  connection: AuthoredConnection,
  stage: AppearanceStage,
): EdgeResult {
  if (!connection.safeMissPlatformId)
    throw new Error("A deliberate safe miss requires a catch platform");
  const state = createObbyState(
    edgeEntry(level.course, connection, 0, 0.75, 0),
  );
  const simulation: Simulation = {
    course: level.course,
    stage,
    state,
    timeSeconds: 0,
  };
  runtimeStep(simulation, { moveX: 0, moveY: 0 });
  const startedOnSource = state.grounded && state.supportId === connection.from;
  const destination = sampledPlatform(level.course, connection.to, 0);
  const proportions = getAvatarProportions(stage);
  const missTarget = {
    x:
      destination.center.x +
      destination.size.x / 2 +
      proportions.colliderRadius +
      0.25,
    z: destination.center.z,
  };
  let recovered = false;
  let airborne = false;
  let reachedTarget = false;
  for (let frame = 0; frame < 180; frame += 1) {
    reachedTarget ||=
      Math.hypot(
        missTarget.x - state.position.x,
        missTarget.z - state.position.z,
      ) <= 0.08;
    const result = runtimeStep(
      simulation,
      reachedTarget ? { moveX: 0, moveY: 0 } : inputToward(state, missTarget),
      frame === 0,
    );
    recovered ||= result.recovered;
    airborne ||= !state.grounded;
    if (
      airborne &&
      state.grounded &&
      state.supportId === connection.safeMissPlatformId
    )
      break;
  }
  return {
    reached:
      state.grounded && state.supportId === connection.safeMissPlatformId,
    recovered,
    airborne,
    startedOnSource,
    supportId: state.supportId,
    position: { ...state.position },
  };
}

export function settledState(
  level: ResolvedAuthoredLevel,
  stage: AppearanceStage,
  position: Readonly<{ x: number; y: number; z: number }>,
): ObbyState {
  const state = createObbyState({ ...position });
  const simulation: Simulation = {
    course: level.course,
    stage,
    state,
    timeSeconds: 0,
  };
  runtimeStep(simulation, { moveX: 0, moveY: 0 });
  return state;
}

export function edgeLabel(
  level: ResolvedAuthoredLevel,
  connection: AuthoredConnection,
  stage: AppearanceStage,
  lateral: number,
): string {
  return [
    level.document.id,
    stage,
    `${connection.from}->${connection.to}`,
    connection.mode,
    `lateral=${lateral}`,
  ].join(" ");
}
