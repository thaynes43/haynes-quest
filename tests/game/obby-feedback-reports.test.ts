/**
 * DESIGN-008: `stepObby` reports the family world moments that play sounds.
 * The reports never change the physics, and a step without such a moment
 * returns only `recovered` and `checkpointChanged`, as before.
 */
import { describe, expect, it } from "vitest";
import {
  createObbyState,
  stepObby,
  type ObbyAbilities,
  type ObbyCourse,
  type ObbyPlatform,
  type ObbyState,
  type ObbyStepOptions,
  type ObbyStepResult,
} from "../../src/game/obby";
import { growthMoveTuning } from "../../src/shared/abilities";

const DT = 1 / 60;
const floor: ObbyPlatform = {
  id: "floor",
  center: { x: 0, y: -0.5, z: 0 },
  size: { x: 40, y: 1, z: 40 },
};
const flat: ObbyCourse = { platforms: [floor], hazards: [], checkpoints: [] };
const allMoves: ObbyAbilities = growthMoveTuning([
  "jump",
  "high-jump",
  "double-jump",
  "glide",
]);

interface Run {
  readonly state: ObbyState;
  readonly results: ObbyStepResult[];
  step(options?: Partial<ObbyStepOptions>): ObbyStepResult;
  time: number;
}

function run(
  course: ObbyCourse,
  position = { x: 0, y: 0, z: 0 },
  abilities?: ObbyAbilities,
): Run {
  const state = createObbyState(position);
  state.grounded = true;
  const handle: Run = {
    state,
    results: [],
    time: 0,
    step(options = {}) {
      handle.time += DT;
      const result = stepObby(state, { moveX: 0, moveY: 0 }, course, {
        deltaSeconds: DT,
        timeSeconds: handle.time,
        cameraYaw: 0,
        canJump: true,
        jumpPressed: false,
        radius: 0.25,
        height: 0.9,
        ...(abilities ? { abilities } : {}),
        ...options,
      });
      handle.results.push(result);
      return result;
    },
  };
  return handle;
}

function framesUntil(sim: Run, done: (state: ObbyState) => boolean, options: Partial<ObbyStepOptions> = {}, limit = 600): void {
  for (let frame = 0; frame < limit; frame += 1) {
    sim.step(options);
    if (done(sim.state)) return;
  }
  throw new Error("condition never reached");
}

const count = (results: ObbyStepResult[], key: keyof ObbyStepResult) =>
  results.filter((result) => result[key] !== undefined).length;

describe("stepObby presentation reports", () => {
  it("reports exactly the mid-air launch as a double jump", () => {
    const sim = run(flat, undefined, allMoves);
    sim.step({ jumpPressed: true });
    expect(sim.results[0]).toEqual({ recovered: false, checkpointChanged: false });
    framesUntil(sim, (state) => state.velocityY < 0);
    sim.step({ jumpPressed: false });
    const launch = sim.step({ jumpPressed: true });
    expect(launch.airJumped).toBe(true);
    framesUntil(sim, (state) => state.grounded, { jumpPressed: true });
    expect(count(sim.results, "airJumped")).toBe(1);

    // Jump-only physics never reports one.
    const plain = run(flat);
    plain.step({ jumpPressed: true });
    framesUntil(plain, (state) => state.velocityY < 0);
    plain.step({ jumpPressed: false });
    plain.step({ jumpPressed: true });
    framesUntil(plain, (state) => state.grounded);
    expect(count(plain.results, "airJumped")).toBe(0);
  });

  it("reports the glide only while held Jump caps the fall", () => {
    const sim = run(flat, { x: 0, y: 6, z: 0 }, allMoves);
    sim.state.grounded = false;
    // Rising or not yet at the cap: no glide.
    sim.step({ jumpHeld: true });
    expect(sim.results.at(-1)!.gliding).toBeUndefined();
    framesUntil(sim, () => sim.results.at(-1)!.gliding === true, { jumpHeld: true });
    expect(sim.state.velocityY).toBe(-allMoves.glideFallSpeed!);
    // Releasing Jump ends it at once.
    expect(sim.step({ jumpHeld: false }).gliding).toBeUndefined();
    expect(sim.step({ jumpHeld: true }).gliding).toBe(true);
    // Landing ends it.
    framesUntil(sim, (state) => state.grounded, { jumpHeld: true });
    expect(sim.results.at(-1)!.gliding).toBeUndefined();

    // Without the glide move a held Jump is only a jump.
    const young = run(flat, { x: 0, y: 6, z: 0 }, growthMoveTuning(["jump", "high-jump", "double-jump"]));
    young.state.grounded = false;
    framesUntil(young, (state) => state.grounded, { jumpHeld: true });
    expect(count(young.results, "gliding")).toBe(0);
  });

  it("reports a crumbling platform once per first touch", () => {
    const crumble: ObbyPlatform = {
      id: "crumble",
      center: { x: 0, y: -0.25, z: 0 },
      size: { x: 2, y: 0.5, z: 2 },
      crumble: { shakeSeconds: 0.8, downSeconds: 3 },
    };
    const sim = run({ platforms: [crumble], hazards: [], checkpoints: [] });
    expect(sim.step().crumbleId).toBe("crumble");
    for (let frame = 0; frame < 30; frame += 1) sim.step();
    expect(count(sim.results, "crumbleId")).toBe(1);
  });

  it("reports each stop of a dwelling lift the player rides", () => {
    // Phase 3π/2 starts at the bottom stop, at the start of its dwell.
    const lift: ObbyPlatform = {
      id: "lift",
      center: { x: 0, y: 0.75, z: 0 },
      size: { x: 2, y: 0.5, z: 2 },
      motion: { axis: "y", distance: 1, period: 4, phase: (3 * Math.PI) / 2, dwell: 1 },
    };
    const sim = run({ platforms: [lift], hazards: [], checkpoints: [] });
    const stops: number[] = [];
    for (let frame = 0; frame < 7.2 * 60; frame += 1)
      if (sim.step().liftStopId === "lift") stops.push(sim.time);
    expect(sim.state.supportId).toBe("lift");
    // Top after 1 s of dwell and 2 s of travel; bottom 3 s later.
    expect(stops).toHaveLength(2);
    expect(stops[0]).toBeCloseTo(3, 1);
    expect(stops[1]).toBeCloseTo(6, 1);
  });

  it("reports an undwelled lift's turnarounds, and nothing to a player off the lift", () => {
    const lift: ObbyPlatform = {
      id: "lift",
      center: { x: 0, y: 0.75, z: 0 },
      size: { x: 2, y: 0.5, z: 2 },
      motion: { axis: "y", distance: 1, period: 4, phase: (3 * Math.PI) / 2 },
    };
    const riding = run({ platforms: [lift], hazards: [], checkpoints: [] });
    const turns: number[] = [];
    for (let frame = 0; frame < 4.5 * 60; frame += 1)
      if (riding.step().liftStopId) turns.push(riding.time);
    expect(turns.map((time) => Math.round(time))).toEqual([2, 4]);

    const beside: ObbyPlatform = { ...floor, center: { x: 10, y: -0.5, z: 0 }, size: { x: 4, y: 1, z: 4 } };
    const watching = run({ platforms: [lift, beside], hazards: [], checkpoints: [] }, { x: 10, y: 0, z: 0 });
    for (let frame = 0; frame < 4.5 * 60; frame += 1) watching.step();
    expect(count(watching.results, "liftStopId")).toBe(0);
  });

  it("never reports a stop for a sideways moving platform", () => {
    const mover: ObbyPlatform = {
      id: "mover",
      center: { x: 0, y: -0.25, z: 0 },
      size: { x: 3, y: 0.5, z: 3 },
      motion: { axis: "x", distance: 1, period: 4 },
    };
    const sim = run({ platforms: [mover], hazards: [], checkpoints: [] });
    for (let frame = 0; frame < 5 * 60; frame += 1) sim.step();
    expect(sim.state.supportId).toBe("mover");
    expect(count(sim.results, "liftStopId")).toBe(0);
  });
});
