import { describe, expect, it } from "vitest";

import {
  AUTHORED_LEVEL_IDS,
  type AuthoredConnection,
  type ResolvedAuthoredLevel,
} from "../../src/shared/authored-level";
import { authoredRoute } from "../../src/game/authored-layout";
import { getAvatarProportions } from "../../src/game/controller";
import {
  createObbyState,
  OBBY_TUNING,
  sampleObby,
  stepObby,
  type ObbyCourse,
  type ObbyState,
  type ObbyStepResult,
} from "../../src/game/obby";

type AppearanceStage = "infant" | "child";
type MoveInput = { moveX: number; moveY: number };

const FRAME_SECONDS = 1 / 60;
const ROUTE_MEMORY_TUNING = { moveSpeed: 4 } as const;
const LEVEL_FILES = AUTHORED_LEVEL_IDS;
const STAGES = ["infant", "child"] as const;

interface Simulation {
  readonly course: ObbyCourse;
  readonly stage: AppearanceStage;
  readonly state: ObbyState;
  timeSeconds: number;
}

interface EdgeResult {
  readonly reached: boolean;
  readonly recovered: boolean;
  readonly airborne: boolean;
  readonly startedOnSource: boolean;
  readonly supportId: string | null;
  readonly position: Readonly<{ x: number; y: number; z: number }>;
}

function loadLevel(id: (typeof LEVEL_FILES)[number]): ResolvedAuthoredLevel {
  const level = authoredRoute(id);
  if (!level) throw new Error(`Registered authored route ${id} is missing`);
  return level;
}

const LEVELS = LEVEL_FILES.map(loadLevel);
const V2_LEVELS = LEVELS.filter(
  (level) => level.document.schemaVersion === "authored-level-v2",
);

function sampledPlatform(course: ObbyCourse, id: string, timeSeconds: number) {
  const platform = sampleObby(course, timeSeconds).platforms.find(
    (candidate) => candidate.id === id,
  );
  if (!platform) throw new Error(`Course platform ${id} is missing`);
  return platform;
}

function runtimeStep(
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

function ferryPhase(
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

function inputToward(
  state: ObbyState,
  target: Readonly<{ x: number; z: number }>,
): MoveInput {
  const deltaX = target.x - state.position.x;
  const deltaZ = target.z - state.position.z;
  const distance = Math.hypot(deltaX, deltaZ) || 1;
  return { moveX: deltaX / distance, moveY: -deltaZ / distance };
}

function moveTo(
  simulation: Simulation,
  target: Readonly<{ x: number; z: number }>,
  maxFrames: number,
): { reached: boolean; recovered: boolean; airborne: boolean } {
  let recovered = false;
  let airborne = false;
  for (let frame = 0; frame < maxFrames; frame += 1) {
    if (Math.hypot(
      target.x - simulation.state.position.x,
      target.z - simulation.state.position.z,
    ) <= 0.08) return { reached: true, recovered, airborne };
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
function traverseSafeRetry(
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
  const direction = Math.sign(
    travelAxis === "x" ? deltaX : deltaZ,
  ) || 1;
  const crossAxis = travelAxis === "x" ? "z" : "x";
  const sourceCrossHalf = source.size[crossAxis] / 2;
  const targetCrossHalf = target.size[crossAxis] / 2;
  const side = source.center[crossAxis] + sourceCrossHalf -
    proportions.colliderRadius - 0.2;
  const targetSide = Math.min(
    target.center[crossAxis] + targetCrossHalf - 0.5,
    side,
  );
  const approachTravel =
    target.center[travelAxis] - direction * (target.size[travelAxis] / 2 + 0.5);
  const finishTravel =
    source.center[travelAxis] + direction * (source.size[travelAxis] / 2 + 0.5);
  const point = (cross: number, travel: number) =>
    travelAxis === "x"
      ? { x: travel, z: cross }
      : { x: cross, z: travel };
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
  const approach = moveTo(
    simulation,
    point(side, approachTravel),
    360,
  );
  const finish = approach.reached && !approach.recovered
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
function edgeEntry(
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
function traverseEdge(
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
  ) return traverseSafeRetry(level, connection, stage);
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

function missOntoSafeFloor(
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
    ) break;
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

function settledState(
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

function edgeLabel(
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

describe("authored playground traversal physics", () => {
  it("retains the jump physics used with the route-memory speed override", () => {
    expect(OBBY_TUNING).toMatchObject({ gravity: -15, jumpVelocity: 5 });
  });

  for (const level of LEVELS) {
    for (const stage of STAGES) {
      it(`${level.document.id} traverses every declared edge as ${stage}`, () => {
        for (const connection of level.graph.connections) {
          const result = traverseEdge(level, connection, stage);
          const label = edgeLabel(level, connection, stage, 0);
          expect(result.startedOnSource, `${label} must start supported`).toBe(
            true,
          );
          expect(result.recovered, `${label} recovered before landing`).toBe(
            false,
          );
          expect(result.reached, `${label} did not reach its target`).toBe(
            true,
          );
          expect(
            result.airborne,
            `${label} declared ${connection.mode} with unexpected airborne state`,
          ).toBe(connection.mode !== "walk");
        }
      });
    }

    it(`${level.document.id} keeps a broad child takeoff lane for every jump and ride`, () => {
      for (const connection of level.graph.connections) {
        if (connection.mode === "walk") continue;
        for (const lateral of [-0.75, 0, 0.75]) {
          const result = traverseEdge(level, connection, "child", lateral);
          const label = edgeLabel(level, connection, "child", lateral);
          expect(result.startedOnSource, `${label} must start supported`).toBe(
            true,
          );
          expect(result.recovered, `${label} recovered before landing`).toBe(
            false,
          );
          expect(result.reached, `${label} did not reach its target`).toBe(
            true,
          );
          expect(result.airborne, `${label} never left its source`).toBe(true);
        }
      }
    });

    for (const stage of STAGES) {
      it(`${level.document.id} moving platform carries a standing ${stage}`, () => {
        const moving = level.course.platforms.find(
          (platform) => platform.motion,
        );
        if (!moving?.motion)
          throw new Error("Authored course has no moving platform");
        const initial = sampledPlatform(level.course, moving.id, 0);
        const state = createObbyState({
          x: initial.center.x,
          y: initial.center.y + initial.size.y / 2,
          z: initial.center.z,
        });
        const simulation: Simulation = {
          course: level.course,
          stage,
          state,
          timeSeconds: 0,
        };
        runtimeStep(simulation, { moveX: 0, moveY: 0 });
        expect(state).toMatchObject({ grounded: true, supportId: moving.id });
        const first = sampledPlatform(
          level.course,
          moving.id,
          simulation.timeSeconds,
        );
        const offset = {
          x: state.position.x - first.center.x,
          z: state.position.z - first.center.z,
        };
        let minAxis = first.center[moving.motion.axis];
        let maxAxis = minAxis;
        let recovered = false;

        for (
          let frame = 0;
          frame < Math.ceil(moving.motion.period / FRAME_SECONDS);
          frame += 1
        ) {
          recovered ||= runtimeStep(simulation, {
            moveX: 0,
            moveY: 0,
          }).recovered;
          const sampled = sampledPlatform(
            level.course,
            moving.id,
            simulation.timeSeconds,
          );
          minAxis = Math.min(minAxis, sampled.center[moving.motion.axis]);
          maxAxis = Math.max(maxAxis, sampled.center[moving.motion.axis]);
          expect(state.grounded).toBe(true);
          expect(state.supportId).toBe(moving.id);
          expect(state.position.x - sampled.center.x).toBeCloseTo(offset.x, 6);
          expect(state.position.z - sampled.center.z).toBeCloseTo(offset.z, 6);
        }

        expect(recovered).toBe(false);
        expect(maxAxis - minAxis).toBeCloseTo(moving.motion.distance * 2, 3);
      });
    }

    for (const stage of STAGES) {
      it(`${level.document.id} recovers ${stage} at every authored checkpoint`, () => {
        for (const checkpoint of level.course.checkpoints) {
          const state = createObbyState({ ...checkpoint.position });
          const simulation: Simulation = {
            course: level.course,
            stage,
            state,
            timeSeconds: 0,
          };
          runtimeStep(simulation, { moveX: 0, moveY: 0 });
          expect(state.checkpointId, `${checkpoint.id} did not arm`).toBe(
            checkpoint.id,
          );
          expect(
            state.grounded,
            `${checkpoint.id} has no initial support`,
          ).toBe(true);
          let minimumY = state.position.y;
          let recovery: ObbyStepResult | null = null;

          for (let frame = 0; frame < 360; frame += 1) {
            const result = runtimeStep(simulation, { moveX: 1, moveY: 0 });
            minimumY = Math.min(minimumY, state.position.y);
            if (result.recovered) {
              recovery = result;
              break;
            }
          }

          expect(
            recovery,
            `${checkpoint.id} did not recover within six seconds`,
          ).not.toBeNull();
          expect(
            minimumY,
            `${checkpoint.id} recovered from a hazard instead of a fall`,
          ).toBeLessThan(OBBY_TUNING.fallThresholdY + 0.25);
          expect(state).toMatchObject({
            grounded: true,
            checkpointId: checkpoint.id,
            supportId: checkpoint.triggerPlatformId,
          });
          expect(state.position.x).toBeCloseTo(checkpoint.position.x, 9);
          expect(state.position.y).toBeCloseTo(checkpoint.position.y, 9);
          expect(state.position.z).toBeCloseTo(checkpoint.position.z, 9);
          expect(state.recoveryRemaining).toBeCloseTo(
            OBBY_TUNING.recoverySeconds,
            6,
          );
        }
      });
    }
  }

  for (const level of V2_LEVELS) {
    for (const stage of STAGES) {
      it(`${level.document.id} traverses every step in its 0.9m practice profile as ${stage}`, () => {
        const practice = level.graph.connections.filter(
          (connection) => connection.safeMissPlatformId,
        );
        expect(practice).toHaveLength(7);
        const landedHeights = [
          sampledPlatform(level.course, practice[0]!.from, 0).center.y +
            sampledPlatform(level.course, practice[0]!.from, 0).size.y / 2,
        ];
        for (const connection of practice) {
          const result = traverseEdge(level, connection, stage);
          expect(result.startedOnSource).toBe(true);
          expect(result.recovered).toBe(false);
          expect(result.reached).toBe(true);
          landedHeights.push(result.position.y);
        }
        const expectedHeights = [
          0,
          0.3,
          0.6,
          0.9,
          0.6,
          0.3,
          0.1,
          0,
        ];
        expect(landedHeights).toHaveLength(expectedHeights.length);
        landedHeights.forEach((height, index) => {
          expect(height).toBeCloseTo(expectedHeights[index]!, 9);
        });
      });

      it(`${level.document.id} catches a missed crest jump without recovery as ${stage}`, () => {
        const crestMiss = level.graph.connections.find(
          (connection) =>
            connection.safeMissPlatformId &&
            Math.abs(
              sampledPlatform(level.course, connection.from, 0).center.y +
                sampledPlatform(level.course, connection.from, 0).size.y / 2 -
                0.9,
            ) < 1e-9,
        );
        if (!crestMiss) throw new Error("Practice crest connection is missing");
        const result = missOntoSafeFloor(level, crestMiss, stage);
        expect(result.startedOnSource).toBe(true);
        expect(result.airborne).toBe(true);
        expect(result.recovered).toBe(false);
        expect(result.reached).toBe(true);
        expect(result.supportId).toBe(crestMiss.safeMissPlatformId);
        expect(result.position.y).toBe(0);
      });

      it(`${level.document.id} supports elevated memories and boss recovery as ${stage}`, () => {
        const elevatedMemories = Object.values(level.anchors.memories).filter(
          (anchor) => anchor.position.y > 0,
        );
        expect(elevatedMemories.length).toBeGreaterThan(0);
        for (const memory of elevatedMemories) {
          const state = settledState(level, stage, memory.position);
          expect(state).toMatchObject({
            grounded: true,
            supportId: memory.platformId,
          });
          expect(state.position.y).toBeCloseTo(memory.position.y, 9);
        }

        const boss = level.anchors.encounters.boss;
        const bossState = settledState(level, stage, boss.position);
        expect(bossState).toMatchObject({
          grounded: true,
          supportId: boss.platformId,
        });
        expect(bossState.position.y).toBeCloseTo(boss.position.y, 9);

        const checkpoint = level.course.checkpoints.find(
          (candidate) => candidate.id === boss.checkpointId,
        );
        if (!checkpoint) throw new Error("Boss checkpoint is missing");
        const checkpointState = settledState(level, stage, checkpoint.position);
        expect(checkpointState).toMatchObject({
          grounded: true,
          checkpointId: checkpoint.id,
          supportId: checkpoint.triggerPlatformId,
        });
        expect(checkpointState.position.y).toBeCloseTo(
          checkpoint.position.y,
          9,
        );
      });
    }
  }

  const raisedFerryLevel = V2_LEVELS.find(
    (level) => level.document.id === "garden-playground-v2",
  );
  if (!raisedFerryLevel) throw new Error("Raised Garden course is missing");
  for (const stage of STAGES) {
    it(`garden-playground-v2 lands from its moving ferry at 0.3m as ${stage}`, () => {
      const landing = raisedFerryLevel.graph.connections.find(
        (connection) =>
          connection.mode === "ride" && connection.from === "garden-ferry",
      );
      if (!landing) throw new Error("Raised ferry landing is missing");
      const result = traverseEdge(raisedFerryLevel, landing, stage);
      expect(result).toMatchObject({
        startedOnSource: true,
        recovered: false,
        reached: true,
        supportId: "dragon-clearing",
      });
      expect(result.position.y).toBeCloseTo(0.3, 9);
    });

    it(`garden-playground-v2 lets a ${stage} backtrack from the dragon to the second memory`, () => {
      const backtrackIds = new Set([
        "memory-grove",
        "little-rise",
        "little-landing",
        "pond-dock",
        "garden-ferry",
        "dragon-clearing",
      ]);
      const reverseConnections = raisedFerryLevel.graph.connections
        .filter(
          (connection) =>
            backtrackIds.has(connection.from) &&
            backtrackIds.has(connection.to),
        )
        .reverse()
        .map((connection) => ({
          ...connection,
          from: connection.to,
          to: connection.from,
        }));
      expect(reverseConnections).toHaveLength(5);
      for (const connection of reverseConnections) {
        const result = traverseEdge(raisedFerryLevel, connection, stage);
        const label = edgeLabel(raisedFerryLevel, connection, stage, 0);
        expect(result.startedOnSource, `${label} must start supported`).toBe(
          true,
        );
        expect(result.recovered, `${label} recovered before landing`).toBe(
          false,
        );
        expect(result.reached, `${label} did not reach its target`).toBe(true);
      }
    });
  }
});
