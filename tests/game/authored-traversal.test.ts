import { describe, expect, it } from "vitest";

import {
  createObbyState,
  OBBY_TUNING,
  type ObbyStepResult,
} from "../../src/game/obby";
import {
  edgeLabel,
  FRAME_SECONDS,
  LEVEL_FILES,
  loadLevel,
  missOntoSafeFloor,
  runtimeStep,
  sampledPlatform,
  settledState,
  STAGES,
  traverseEdge,
  type Simulation,
} from "./authored-traversal-lib";

const LEVELS = LEVEL_FILES.map(loadLevel);
const V2_LEVELS = LEVELS.filter(
  (level) => level.document.schemaVersion === "authored-level-v2",
);

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
        const expectedHeights = [0, 0.3, 0.6, 0.9, 0.6, 0.3, 0.1, 0];
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
