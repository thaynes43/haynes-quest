/**
 * WO079 adversarial probe: drive the real obby controller along every authored
 * main-path and branch edge of both shipped documents with a naive auto-pilot
 * (walk toward the next platform, jump only when the ground ahead runs out).
 * This checks the validator's "connected supported routes" claim against the
 * physics the game actually runs, including the moving ferry.
 */
import { describe, expect, it } from "vitest";
import garden from "../../../src/shared/levels/garden-playground-v1.json";
import party from "../../../src/shared/levels/besties-playground-v1.json";
import {
  resolveAuthoredLevelDocument,
  type AuthoredLevelDocument,
} from "../../../src/shared/authored-level";
import {
  createObbyState,
  sampleObby,
  stepObby,
  type ObbyCourse,
  type ObbyState,
} from "../../../src/game/obby";

const DOCS: Array<[string, AuthoredLevelDocument]> = [
  ["garden-playground-v1", garden as unknown as AuthoredLevelDocument],
  ["besties-playground-v1", party as unknown as AuthoredLevelDocument],
];

const STEP = 1 / 60;
// Route-memory adventures override the shared tuning; see createGame.ts:996.
const TUNING = { moveSpeed: 4 };
const RADIUS = 0.25;
const HEIGHT = 0.88;

interface Point {
  x: number;
  y: number;
  z: number;
}

/** Highest sampled platform top under (x,z) that the feet could stand on. */
function supportedTop(
  course: ObbyCourse,
  time: number,
  x: number,
  z: number,
  feetY: number,
): number | null {
  let best: number | null = null;
  for (const platform of sampleObby(course, time).platforms) {
    if (
      Math.abs(x - platform.center.x) > platform.size.x / 2 ||
      Math.abs(z - platform.center.z) > platform.size.z / 2
    )
      continue;
    const top = platform.center.y + platform.size.y / 2;
    if (top > feetY + 0.4 || top < feetY - 1.2) continue;
    if (best === null || top > best) best = top;
  }
  return best;
}

interface Leg {
  arrived: boolean;
  time: number;
  distance: number;
  recoveries: number;
  jumps: number;
}

function driveTo(
  state: ObbyState,
  course: ObbyCourse,
  target: Point,
  startTime: number,
  budgetSeconds = 40,
  arriveOnSupport?: string,
): Leg {
  let time = startTime;
  let distance = 0;
  let recoveries = 0;
  let jumps = 0;
  let jumpHeld = false;
  const frames = Math.ceil(budgetSeconds / STEP);
  for (let frame = 0; frame < frames; frame++) {
    const dx = target.x - state.position.x;
    const dz = target.z - state.position.z;
    const planar = Math.hypot(dx, dz);
    if (
      state.grounded &&
      (arriveOnSupport
        ? state.supportId === arriveOnSupport
        : planar <= 0.45)
    )
      return { arrived: true, time, distance, recoveries, jumps };
    let unitX = dx / (planar || 1);
    let unitZ = dz / (planar || 1);
    // Naive dodge: steer away from any sampled sweeper capsule within reach.
    for (const hazard of sampleObby(course, time).hazards) {
      const ax = hazard.end.x - hazard.start.x;
      const az = hazard.end.z - hazard.start.z;
      const length = ax * ax + az * az;
      const t = length
        ? Math.max(
            0,
            Math.min(
              1,
              ((state.position.x - hazard.start.x) * ax +
                (state.position.z - hazard.start.z) * az) /
                length,
            ),
          )
        : 0;
      const nx = state.position.x - (hazard.start.x + ax * t);
      const nz = state.position.z - (hazard.start.z + az * t);
      const gap = Math.hypot(nx, nz);
      if (gap > hazard.radius + RADIUS + 1.1 || gap < 1e-6) continue;
      const weight = 1.6;
      unitX += (nx / gap) * weight;
      unitZ += (nz / gap) * weight;
      const norm = Math.hypot(unitX, unitZ) || 1;
      unitX /= norm;
      unitZ /= norm;
    }
    let jump = false;
    if (state.grounded && !jumpHeld) {
      const ahead = supportedTop(
        course,
        time,
        state.position.x + unitX * 0.4,
        state.position.z + unitZ * 0.4,
        state.position.y,
      );
      if (ahead === null) {
        // Ground runs out: look for a landing inside the honest jump arc.
        for (let reach = 0.6; reach <= 2.2 && !jump; reach += 0.1) {
          const landing = supportedTop(
            course,
            time + 0.34,
            state.position.x + unitX * reach,
            state.position.z + unitZ * reach,
            state.position.y,
          );
          if (landing !== null) jump = true;
        }
      }
    }
    const before = { ...state.position };
    time += STEP;
    const result = stepObby(
      state,
      { moveX: unitX, moveY: -unitZ },
      course,
      {
        deltaSeconds: STEP,
        timeSeconds: time,
        cameraYaw: 0,
        canJump: true,
        jumpPressed: jump,
        radius: RADIUS,
        height: HEIGHT,
        tuning: TUNING,
      },
    );
    if (jump) jumps++;
    jumpHeld = jump;
    if (result.recovered) recoveries++;
    distance += Math.hypot(
      state.position.x - before.x,
      state.position.z - before.z,
    );
  }
  return { arrived: false, time, distance, recoveries, jumps };
}

function platformTarget(course: ObbyCourse, id: string): Point {
  const platform = course.platforms.find((entry) => entry.id === id)!;
  return {
    x: platform.center.x,
    y: platform.center.y + platform.size.y / 2,
    z: platform.center.z,
  };
}

describe("WO079 probe: authored routes under the real obby controller", () => {
  for (const [id, document] of DOCS) {
    it(`walks ${id} from spawn to finish`, () => {
      const { course, anchors } = resolveAuthoredLevelDocument(document);
      const state = createObbyState({ ...anchors.spawn.position });
      state.grounded = true;
      let time = 0;
      let distance = 0;
      let recoveries = 0;
      let jumps = 0;
      const stalled: string[] = [];
      const waypoints: Array<[string, Point]> = [
        ...document.mainPath
          .slice(1)
          .map(
            (platformId) =>
              [platformId, platformTarget(course, platformId)] as [string, Point],
          ),
        ["finish", anchors.finish.position],
      ];
      for (const [label, point] of waypoints) {
        const leg = driveTo(
          state,
          course,
          point,
          time,
          40,
          label === "finish" ? undefined : label,
        );
        time = leg.time;
        distance += leg.distance;
        recoveries += leg.recoveries;
        jumps += leg.jumps;
        if (!leg.arrived) stalled.push(label);
        if (leg.recoveries > 0)
           
          console.log(`  ${id} leg ${label}: ${leg.recoveries} recoveries`);
      }
       
      console.log(
        JSON.stringify({
          route: id,
          stalled,
          recoveries,
          jumps,
          walkedMetres: Number(distance.toFixed(1)),
          simulatedSeconds: Number(time.toFixed(1)),
          finalSupport: state.supportId,
          finalCheckpoint: state.checkpointId,
        }),
      );
      expect(stalled).toEqual([]);
      expect(state.supportId).toBe(anchors.finish.platformId);
    });

    it(`walks the declared side branch of ${id} and rejoins`, () => {
      const { course, anchors } = resolveAuthoredLevelDocument(document);
      const branch = document.branches[0]!;
      const entryIndex = document.mainPath.indexOf(branch[0]!);
      const state = createObbyState({ ...anchors.spawn.position });
      state.grounded = true;
      let time = 0;
      let recoveries = 0;
      const stalled: string[] = [];
      for (const platformId of [
        ...document.mainPath.slice(1, entryIndex + 1),
        ...branch.slice(1),
      ]) {
        const leg = driveTo(
          state,
          course,
          platformTarget(course, platformId),
          time,
          40,
          platformId,
        );
        time = leg.time;
        recoveries += leg.recoveries;
        if (!leg.arrived) stalled.push(platformId);
      }
       
      console.log(
        JSON.stringify({
          route: id,
          branch,
          stalled,
          recoveries,
          support: state.supportId,
        }),
      );
      expect(stalled).toEqual([]);
      expect(state.supportId).toBe(branch.at(-1));
    });
  }
});
