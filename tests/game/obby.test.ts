import { describe, expect, it } from "vitest";
import {
  createObbyState,
  OBBY_TUNING,
  sampleObby,
  stepObby,
  type ObbyCourse,
  type ObbyMotion,
  type ObbyPlatform,
  type ObbyState,
  type ObbyStepOptions,
  type ObbyStepResult,
} from "../../src/game/obby";
import type { PositionSnapshot } from "../../src/game/types";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

type Input = { moveX: number; moveY: number };

const RADIUS = 0.25;
const HEIGHT = 0.9;
const idle: Input = { moveX: 0, moveY: 0 };
const forward: Input = { moveX: 0, moveY: 1 }; // camera yaw 0 → travels toward -z
const backward: Input = { moveX: 0, moveY: -1 };
const right: Input = { moveX: 1, moveY: 0 };

/** A slab whose TOP is at `top`; `center` is derived so tests can think in surfaces. */
function slab(
  id: string,
  x: number,
  z: number,
  width: number,
  depth: number,
  top = 0,
  thickness = 0.4,
  motion?: ObbyMotion,
): ObbyPlatform {
  const platform: ObbyPlatform = {
    id,
    center: { x, y: top - thickness / 2, z },
    size: { x: width, y: thickness, z: depth },
  };
  if (motion) platform.motion = motion;
  return platform;
}

function course(partial: Partial<ObbyCourse>): ObbyCourse {
  return { platforms: [], hazards: [], checkpoints: [], ...partial };
}

/** 4 m × 4 m floor centred at the origin, z from 2 to -2. */
const floor = () => course({ platforms: [slab("floor", 0, 0, 4, 4)] });

interface Sim {
  state: ObbyState;
  time: number;
  hz: number;
  course: ObbyCourse;
}

function createSim(layout: ObbyCourse, position: PositionSnapshot, hz = 60): Sim {
  return { state: createObbyState(position), time: 0, hz, course: layout };
}

function tick(sim: Sim, input: Input = idle, overrides: Partial<ObbyStepOptions> = {}): ObbyStepResult {
  const dt = 1 / sim.hz;
  sim.time += dt;
  return stepObby(sim.state, input, sim.course, {
    deltaSeconds: dt,
    timeSeconds: sim.time,
    cameraYaw: 0,
    canJump: true,
    jumpPressed: false,
    radius: RADIUS,
    height: HEIGHT,
    ...overrides,
  });
}

function runFor(
  sim: Sim,
  seconds: number,
  input: Input = idle,
  overrides: Partial<ObbyStepOptions> = {},
  onFrame?: (result: ObbyStepResult, frame: number) => void,
): void {
  const frames = Math.round(seconds * sim.hz);
  for (let frame = 0; frame < frames; frame += 1) {
    const result = tick(sim, input, overrides);
    onFrame?.(result, frame);
  }
}

/** Run until the predicate holds; returns the seconds elapsed or fails the test. */
function runUntil(
  sim: Sim,
  predicate: (state: ObbyState, result: ObbyStepResult) => boolean,
  input: Input = idle,
  overrides: Partial<ObbyStepOptions> = {},
  maxSeconds = 10,
): number {
  const start = sim.time;
  const frames = Math.round(maxSeconds * sim.hz);
  for (let frame = 0; frame < frames; frame += 1) {
    const result = tick(sim, input, overrides);
    if (predicate(sim.state, result)) return sim.time - start;
  }
  throw new Error(`condition not reached within ${maxSeconds}s`);
}

function expectFinite(state: ObbyState): void {
  for (const value of [
    state.position.x,
    state.position.y,
    state.position.z,
    state.velocityY,
    state.facing,
    state.checkpoint.x,
    state.checkpoint.y,
    state.checkpoint.z,
    state.coyoteRemaining,
    state.jumpBufferRemaining,
    state.recoveryRemaining,
  ]) {
    expect(Number.isFinite(value)).toBe(true);
  }
}

function segmentDistanceXZ(x: number, z: number, a: PositionSnapshot, b: PositionSnapshot): number {
  const sx = b.x - a.x;
  const sz = b.z - a.z;
  const lengthSq = sx * sx + sz * sz;
  const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((x - a.x) * sx + (z - a.z) * sz) / lengthSq)) : 0;
  return Math.hypot(x - (a.x + sx * t), z - (a.z + sz * t));
}

const JUMP_APEX = (OBBY_TUNING.jumpVelocity * OBBY_TUNING.jumpVelocity) / (2 * -OBBY_TUNING.gravity); // 0.8333
const JUMP_AIRTIME = (2 * OBBY_TUNING.jumpVelocity) / -OBBY_TUNING.gravity; // 0.6667

// ---------------------------------------------------------------------------
// Sampling
// ---------------------------------------------------------------------------

describe("sampleObby", () => {
  const layout = course({
    platforms: [
      slab("static", 1, 2, 3, 3, 0.5),
      slab("ferry", 0, 0, 2, 2, 0, 0.4, { axis: "x", distance: 2, period: 8 }),
      slab("sled", 0, 0, 2, 2, 0, 0.4, { axis: "z", distance: 1, period: 4, phase: Math.PI / 2 }),
    ],
    hazards: [
      { id: "bar", center: { x: 0, y: 0.3, z: -2 }, halfLength: 1.5, radius: 0.2, rotation: { period: 4 } },
      {
        id: "slider",
        center: { x: 0, y: 0.3, z: 5 },
        halfLength: 1,
        radius: 0.2,
        motion: { axis: "z", distance: 1, period: 2 },
      },
    ],
  });

  it("returns box centres, sinusoidal offsets and rotated capsule end points", () => {
    const at0 = sampleObby(layout, 0);
    expect(at0.platforms[0]).toEqual({ id: "static", center: { x: 1, y: 0.3, z: 2 }, size: { x: 3, y: 0.4, z: 3 } });
    expect(at0.platforms[1]?.center.x).toBeCloseTo(0, 9);
    expect(at0.platforms[2]?.center.z).toBeCloseTo(1, 9); // phase π/2 starts at +distance
    expect(at0.hazards[0]?.start).toEqual({ x: -1.5, y: 0.3, z: -2 });
    expect(at0.hazards[0]?.end).toEqual({ x: 1.5, y: 0.3, z: -2 });

    const at2 = sampleObby(layout, 2);
    expect(at2.platforms[1]?.center.x).toBeCloseTo(2, 9);
    expect(at2.platforms[0]).toEqual(at0.platforms[0]);
    const at6 = sampleObby(layout, 6);
    expect(at6.platforms[1]?.center.x).toBeCloseTo(-2, 9);

    // A quarter turn about +Y sends local +X to -Z (Three.js rotation.y).
    const quarter = sampleObby(layout, 1);
    expect(quarter.hazards[0]?.angle).toBeCloseTo(Math.PI / 2, 9);
    expect(quarter.hazards[0]?.start.z).toBeCloseTo(-2 + 1.5, 9);
    expect(quarter.hazards[0]?.end.z).toBeCloseTo(-2 - 1.5, 9);
    expect(quarter.hazards[0]?.end.x).toBeCloseTo(0, 9);
    expect(quarter.hazards[0]?.radius).toBe(0.2);
    expect(sampleObby(layout, 0.5).hazards[1]?.center.z).toBeCloseTo(6, 9);
  });

  it("is deterministic, deeply frozen and stable for huge, negative or invalid clocks", () => {
    const a = sampleObby(layout, 2.5);
    const b = sampleObby(layout, 2.5);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(Object.isFrozen(a)).toBe(true);
    expect(Object.isFrozen(a.platforms)).toBe(true);
    expect(Object.isFrozen(a.platforms[1]?.center)).toBe(true);
    expect(Object.isFrozen(a.hazards[0]?.start)).toBe(true);
    expect(() => {
      (a.platforms[1] as { center: { x: number } }).center.x = 99;
    }).toThrow();

    // 8e9 is an exact multiple of every period here, so the phase must match t = 2.5.
    const huge = sampleObby(layout, 8e9 + 2.5);
    expect(huge.platforms[1]?.center.x).toBeCloseTo(a.platforms[1]?.center.x ?? NaN, 6);
    expect(huge.hazards[0]?.end.z).toBeCloseTo(a.hazards[0]?.end.z ?? NaN, 6);
    expect(sampleObby(layout, -6).platforms[1]?.center.x).toBeCloseTo(2, 9);
    expect(sampleObby(layout, Number.NaN)).toEqual(sampleObby(layout, 0));
    expect(sampleObby(layout, Number.POSITIVE_INFINITY)).toEqual(sampleObby(layout, 0));
  });

  it("treats invalid periods, distances and coordinates as static, finite geometry", () => {
    const odd = course({
      platforms: [
        slab("zero-period", 0, 0, 2, 2, 0, 0.4, { axis: "x", distance: 3, period: 0 }),
        slab("nan-period", 0, 0, 2, 2, 0, 0.4, { axis: "x", distance: 3, period: Number.NaN }),
        { id: "nan-center", center: { x: Number.NaN, y: 0, z: 1 }, size: { x: -2, y: 0.4, z: 2 } },
      ],
      hazards: [{ id: "still", center: { x: 0, y: 0.3, z: 0 }, halfLength: 1, radius: 0.2, rotation: { period: -1, phase: 1 } }],
    });
    const sample = sampleObby(odd, 123.4);
    expect(sample.platforms[0]?.center.x).toBe(0);
    expect(sample.platforms[1]?.center.x).toBe(0);
    expect(sample.platforms[2]?.center).toEqual({ x: 0, y: 0, z: 1 });
    expect(sample.platforms[2]?.size).toEqual({ x: 2, y: 0.4, z: 2 });
    expect(sample.hazards[0]?.angle).toBe(1);
    for (const hazard of sample.hazards) {
      for (const point of [hazard.start, hazard.end, hazard.center]) {
        expect(Number.isFinite(point.x + point.y + point.z)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Supported movement
// ---------------------------------------------------------------------------

describe("supported movement", () => {
  it("settles onto the platform and walks camera-relative at the tuned speed", () => {
    const sim = createSim(floor(), { x: 0, y: 0, z: 1.5 });
    tick(sim);
    expect(sim.state.grounded).toBe(true);
    expect(sim.state.supportId).toBe("floor");
    expect(sim.state.position.y).toBe(0);

    runFor(sim, 1, forward);
    expect(sim.state.position.z).toBeCloseTo(1.5 - OBBY_TUNING.moveSpeed, 6);
    expect(sim.state.position.x).toBeCloseTo(0, 9);
    expect(sim.state.position.y).toBe(0);
    expect(sim.state.grounded).toBe(true);
    expect(sim.state.facing).toBeCloseTo(0, 9);

    // Camera yaw rotates the travel direction: with the camera turned a quarter
    // turn, "forward" runs along -x, exactly like the existing controller.
    const turned = createSim(floor(), { x: 1.5, y: 0, z: 0 });
    runFor(turned, 0.5, forward, { cameraYaw: Math.PI / 2 });
    expect(turned.state.position.x).toBeCloseTo(1.5 - OBBY_TUNING.moveSpeed * 0.5, 6);
    expect(turned.state.position.z).toBeCloseTo(0, 6);
    expect(turned.state.facing).toBeCloseTo(Math.PI / 2, 6);
  });

  it("normalises diagonal input and scales partial stick input", () => {
    const diagonal = createSim(floor(), { x: -1, y: 0, z: 1 });
    runFor(diagonal, 0.5, { moveX: 1, moveY: 1 });
    const travelled = Math.hypot(diagonal.state.position.x + 1, diagonal.state.position.z - 1);
    expect(travelled).toBeCloseTo(OBBY_TUNING.moveSpeed * 0.5, 6);
    expect(diagonal.state.position.x).toBeCloseTo(-1 + travelled / Math.SQRT2, 6);

    const half = createSim(floor(), { x: 0, y: 0, z: 1 });
    runFor(half, 0.5, { moveX: 0, moveY: 0.5 });
    expect(half.state.position.z).toBeCloseTo(1 - OBBY_TUNING.moveSpeed * 0.25, 6);

    const garbage = createSim(floor(), { x: 0, y: 0, z: 1 });
    runFor(garbage, 0.5, { moveX: Number.NaN, moveY: 7 });
    expect(garbage.state.position.z).toBeCloseTo(1 - OBBY_TUNING.moveSpeed * 0.5, 6);
    expectFinite(garbage.state);
  });

  it("steps onto a surface within the step tolerance but is blocked by a taller lip", () => {
    const low = course({ platforms: [slab("floor", 0, 1, 4, 2), slab("lip", 0, -1, 4, 2, 0.01)] });
    const sim = createSim(low, { x: 0, y: 0, z: 0.5 });
    runFor(sim, 0.5, forward);
    expect(sim.state.position.z).toBeLessThan(-0.5);
    expect(sim.state.position.y).toBeCloseTo(0.01, 9);
    expect(sim.state.supportId).toBe("lip");
    expect(sim.state.grounded).toBe(true);

    const tall = course({ platforms: [slab("floor", 0, 1, 4, 2), slab("lip", 0, -1, 4, 2, 0.05)] });
    const blocked = createSim(tall, { x: 0, y: 0, z: 0.5 });
    runFor(blocked, 0.5, forward);
    expect(blocked.state.position.z).toBeCloseTo(RADIUS, 6);
    expect(blocked.state.position.y).toBe(0);
    expect(blocked.state.supportId).toBe("floor");
  });
});

// ---------------------------------------------------------------------------
// Walking off, falling, recovery
// ---------------------------------------------------------------------------

describe("unsupported movement and falls", () => {
  it("loses support past the overhang allowance, falls, and recovers once at the origin", () => {
    const sim = createSim(floor(), { x: 0, y: 0, z: 1.5 });
    const reach = RADIUS * OBBY_TUNING.supportOverhang;
    let leftAt: number | null = null;
    let lowest = Infinity;
    const elapsed = runUntil(
      sim,
      (state, result) => {
        if (leftAt === null && !state.grounded) leftAt = state.position.z;
        lowest = Math.min(lowest, state.position.y);
        return result.recovered;
      },
      backward,
      {},
      3,
    );
    expect(leftAt).not.toBeNull();
    expect(leftAt!).toBeGreaterThan(2 + reach - 0.01);
    expect(leftAt!).toBeLessThan(2 + reach + 0.06);
    expect(lowest).toBeLessThan(OBBY_TUNING.fallThresholdY + 0.5);
    expect(elapsed).toBeLessThan(1.2);
    expect(sim.state.checkpointId).toBeNull();
    expect(sim.state.recoveryRemaining).toBeCloseTo(OBBY_TUNING.recoverySeconds, 6);
    expect(sim.state.position).toEqual({ x: 0, y: 0, z: 1.5 });
    expect(sim.state.velocityY).toBe(0);
    expect(sim.state.grounded).toBe(true);
    expect(sim.state.supportId).toBe("floor");
    let again = 0;
    runFor(sim, 0.15, backward, {}, (result) => {
      if (result.recovered) again += 1;
    });
    expect(again).toBe(0);
    expect(sim.state.grounded).toBe(true);
  });

  it("has no hidden world bounds: sideways edges are also real edges", () => {
    const sim = createSim(floor(), { x: 0, y: 0, z: 0 });
    const elapsed = runUntil(sim, (state) => !state.grounded, right);
    expect(sim.state.position.x).toBeGreaterThan(2);
    expect(elapsed).toBeLessThan(1);
    runUntil(sim, (_state, result) => result.recovered, right, {}, 3);
    expect(sim.state.position.y).toBe(0);
    expect(sim.state.velocityY).toBe(0);
  });

  it("resets velocity and jump timers coherently on a fall and keeps state finite", () => {
    const sim = createSim(floor(), { x: 0, y: 0, z: 1.5 });
    runUntil(sim, (state) => !state.grounded, backward);
    runFor(sim, 0.05, backward, { jumpPressed: true }); // buffer a press while falling
    runUntil(sim, (_state, result) => result.recovered, idle, { canJump: false }, 3);
    expect(sim.state.velocityY).toBe(0);
    expect(sim.state.jumpBufferRemaining).toBe(0);
    expect(sim.state.coyoteRemaining).toBe(0);
    expect(sim.state.recoveryRemaining).toBeCloseTo(OBBY_TUNING.recoverySeconds, 6);
    expect(sim.state.grounded).toBe(true);
    expectFinite(sim.state);
    // A buffered press from before the fall must not fire after the reset.
    runFor(sim, 0.3, idle, { canJump: true });
    expect(sim.state.grounded).toBe(true);
    expect(sim.state.position.y).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Landing, side and underside collision
// ---------------------------------------------------------------------------

describe("box collision", () => {
  it("lands on a top only while descending with foot support and never sinks into it", () => {
    const sim = createSim(floor(), { x: 0, y: 1.5, z: 0 });
    let minY = Infinity;
    const elapsed = runUntil(
      sim,
      (state) => {
        minY = Math.min(minY, state.position.y);
        return state.grounded;
      },
      idle,
    );
    expect(sim.state.position.y).toBe(0);
    expect(minY).toBe(0);
    expect(sim.state.velocityY).toBe(0);
    expect(sim.state.supportId).toBe("floor");
    expect(elapsed).toBeCloseTo(Math.sqrt((2 * 1.5) / -OBBY_TUNING.gravity), 1);
  });

  it("falls past a top when the foot circle hangs too far over the edge", () => {
    const sim = createSim(floor(), { x: 2.3, y: 1.5, z: 0 });
    runFor(sim, 0.5);
    expect(sim.state.grounded).toBe(false);
    expect(sim.state.position.y).toBeLessThan(-0.2);
    expect(sim.state.position.x).toBeCloseTo(2.3, 9);
  });

  it("blocks walking into a box side and does not lift onto it, then reaches it only by jumping", () => {
    const layout = course({ platforms: [slab("floor", 0, 0, 4, 4), slab("block", 0, -1, 2, 1, 0.5, 0.5)] });
    const sim = createSim(layout, { x: 0, y: 0, z: 0.5 });
    runFor(sim, 1, forward);
    expect(sim.state.position.z).toBeCloseTo(-0.5 + RADIUS, 6);
    expect(sim.state.position.y).toBe(0);
    expect(sim.state.grounded).toBe(true);
    expect(sim.state.supportId).toBe("floor");

    // Sliding: pushing diagonally along the face keeps moving sideways.
    runFor(sim, 0.3, { moveX: 1, moveY: 1 });
    expect(sim.state.position.z).toBeCloseTo(-0.5 + RADIUS, 6);
    expect(sim.state.position.x).toBeCloseTo((OBBY_TUNING.moveSpeed * 0.3) / Math.SQRT2, 6);
    expect(sim.state.position.y).toBe(0);

    const climber = createSim(layout, { x: 0, y: 0, z: 0.5 });
    runFor(climber, 1, forward);
    tick(climber, forward, { jumpPressed: true });
    runUntil(climber, (state) => state.grounded, forward);
    expect(climber.state.position.y).toBe(0.5);
    expect(climber.state.supportId).toBe("block");
  });

  it("stops upward motion under a ceiling and never lands on top of it from below", () => {
    const layout = course({
      platforms: [
        slab("floor", 0, 0, 4, 4),
        { id: "ceiling", center: { x: 0, y: 1.6, z: 0 }, size: { x: 2, y: 0.2, z: 2 } }, // bottom at 1.5
      ],
    });
    const sim = createSim(layout, { x: 0, y: 0, z: 0 });
    tick(sim);
    tick(sim, idle, { jumpPressed: true });
    let maxY = 0;
    let bounced = false;
    const supports = new Set<string | null>();
    runUntil(
      sim,
      (state) => {
        maxY = Math.max(maxY, state.position.y);
        supports.add(state.supportId);
        if (state.velocityY <= 0 && state.position.y > 0.55) bounced = true;
        return state.grounded;
      },
      idle,
    );
    expect(maxY).toBeCloseTo(1.5 - HEIGHT, 2);
    expect(maxY).toBeLessThanOrEqual(1.5 - HEIGHT + 1e-9);
    expect(maxY).toBeLessThan(JUMP_APEX);
    expect(bounced).toBe(true);
    expect(supports.has("ceiling")).toBe(false);
    expect(sim.state.position.y).toBe(0);
  });

  it("cannot tunnel through a thin floor or a thin wall at the largest delta", () => {
    const thinFloor = course({ platforms: [slab("sheet", 0, 0, 4, 4, 0, 0.02)] });
    const dropper = createSim(thinFloor, { x: 0, y: 3, z: 0 }, 20); // dt = 0.05
    let minY = Infinity;
    runUntil(
      dropper,
      (state) => {
        minY = Math.min(minY, state.position.y);
        return state.grounded;
      },
      idle,
    );
    expect(minY).toBe(0);
    expect(dropper.state.position.y).toBe(0);

    const thinWall = course({
      platforms: [slab("floor", 0, 0, 4, 4), { id: "pane", center: { x: 0, y: 0.5, z: -1 }, size: { x: 2, y: 1, z: 0.03 } }],
    });
    const walker = createSim(thinWall, { x: 0, y: 0, z: 0.5 }, 20);
    runFor(walker, 3, forward);
    expect(walker.state.position.z).toBeCloseTo(-1 + 0.015 + RADIUS, 6);
  });
});

// ---------------------------------------------------------------------------
// Jump timing
// ---------------------------------------------------------------------------

describe("jump timing", () => {
  it("jumps once per press to the analytical apex and does not jump again in the air", () => {
    const sim = createSim(floor(), { x: 0, y: 0, z: 0 });
    tick(sim);
    let takeoffs = 0;
    let wasGrounded = true;
    let maxY = 0;
    let pressedAtApex = false;
    const landed = runUntil(
      sim,
      (state) => {
        if (wasGrounded && !state.grounded) takeoffs += 1;
        wasGrounded = state.grounded;
        maxY = Math.max(maxY, state.position.y);
        return state.grounded && maxY > 0.5;
      },
      idle,
      { jumpPressed: true }, // held every frame
      3,
    );
    expect(takeoffs).toBe(1);
    expect(maxY).toBeCloseTo(JUMP_APEX, 1);
    expect(landed).toBeCloseTo(JUMP_AIRTIME, 1);

    const apexPress = createSim(floor(), { x: 0, y: 0, z: 0 });
    tick(apexPress);
    tick(apexPress, idle, { jumpPressed: true });
    runUntil(apexPress, (state) => state.velocityY <= 0);
    maxY = apexPress.state.position.y;
    runUntil(
      apexPress,
      (state) => {
        maxY = Math.max(maxY, state.position.y);
        pressedAtApex = true;
        return state.grounded;
      },
      idle,
      { jumpPressed: true },
    );
    expect(pressedAtApex).toBe(true);
    expect(maxY).toBeLessThan(JUMP_APEX + 0.02);
  });

  it("honours a coyote press just after the edge and refuses one after the grace expires", () => {
    const grace = createSim(floor(), { x: 0, y: 0, z: 1.5 });
    runUntil(grace, (state) => !state.grounded, backward);
    runFor(grace, 0.08, backward);
    expect(grace.state.velocityY).toBeLessThan(0);
    tick(grace, backward, { jumpPressed: true });
    expect(grace.state.velocityY).toBeGreaterThan(4);
    let maxY = -Infinity;
    runFor(grace, 0.4, backward, {}, () => {
      maxY = Math.max(maxY, grace.state.position.y);
    });
    expect(maxY).toBeGreaterThan(0.5);

    const late = createSim(floor(), { x: 0, y: 0, z: 1.5 });
    runUntil(late, (state) => !state.grounded, backward);
    runFor(late, OBBY_TUNING.coyoteSeconds + 0.05, backward);
    const before = late.state.velocityY;
    tick(late, backward, { jumpPressed: true });
    expect(late.state.velocityY).toBeLessThan(before);
    expect(late.state.velocityY).toBeLessThan(0);
  });

  it("uses a buffered press on landing and drops a press that is too early", () => {
    const buffered = createSim(floor(), { x: 0, y: 1, z: 0 });
    runUntil(buffered, (state) => state.position.y < 0.3);
    tick(buffered, idle, { jumpPressed: true });
    expect(buffered.state.grounded).toBe(false);
    runUntil(buffered, (state) => state.grounded);
    runFor(buffered, 0.1);
    expect(buffered.state.grounded).toBe(false);
    expect(buffered.state.position.y).toBeGreaterThan(0.2);

    const early = createSim(floor(), { x: 0, y: 2, z: 0 });
    runUntil(early, (state) => state.position.y < 1.5);
    tick(early, idle, { jumpPressed: true });
    runUntil(early, (state) => state.grounded);
    runFor(early, 0.5);
    expect(early.state.grounded).toBe(true);
    expect(early.state.position.y).toBe(0);
  });

  it("with canJump=false ignores grounded, buffered and coyote presses", () => {
    const grounded = createSim(floor(), { x: 0, y: 0, z: 0 });
    tick(grounded);
    runFor(grounded, 0.1, idle, { canJump: false, jumpPressed: true });
    expect(grounded.state.grounded).toBe(true);
    expect(grounded.state.position.y).toBe(0);
    runFor(grounded, 0.5, idle, { canJump: true }); // ability arrives later; no queued press may fire
    expect(grounded.state.grounded).toBe(true);
    expect(grounded.state.jumpBufferRemaining).toBe(0);

    const buffered = createSim(floor(), { x: 0, y: 1, z: 0 });
    runUntil(buffered, (state) => state.position.y < 0.3);
    tick(buffered, idle, { jumpPressed: true, canJump: true });
    runUntil(buffered, (state) => state.grounded, idle, { canJump: false });
    runFor(buffered, 0.3, idle, { canJump: true });
    expect(buffered.state.grounded).toBe(true);

    const coyote = createSim(floor(), { x: 0, y: 0, z: 1.5 });
    runUntil(coyote, (state) => !state.grounded, backward);
    runFor(coyote, 0.05, backward);
    tick(coyote, backward, { jumpPressed: true, canJump: false });
    expect(coyote.state.velocityY).toBeLessThan(0);
    runFor(coyote, 0.3, backward, {}, () => {
      expect(coyote.state.velocityY).toBeLessThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Moving platforms
// ---------------------------------------------------------------------------

describe("moving platforms", () => {
  const ferryMotion: ObbyMotion = { axis: "x", distance: 2, period: 8 };
  const ferryCourse = () => course({ platforms: [slab("ferry", 0, 0, 2, 2, 0, 0.4, ferryMotion)] });

  it("carries a standing player by the sampled delta without drift across three periods", () => {
    for (const hz of [60, 30]) {
      const sim = createSim(ferryCourse(), { x: 0, y: 0, z: 0 }, hz);
      tick(sim);
      expect(sim.state.supportId).toBe("ferry");
      const offset = sim.state.position.x - sampleObby(sim.course, sim.time).platforms[0]!.center.x;
      expect(Math.abs(offset)).toBeLessThan(0.02); // the platform moved a little before the first landing
      let maxDrift = 0;
      runFor(sim, 24, idle, {}, () => {
        const ferry = sampleObby(sim.course, sim.time).platforms[0]!;
        maxDrift = Math.max(maxDrift, Math.abs(sim.state.position.x - ferry.center.x - offset));
        expect(sim.state.grounded).toBe(true);
      });
      expect(maxDrift).toBeLessThan(1e-6);
      expect(sim.state.position.y).toBe(0);

      const quarter = createSim(ferryCourse(), { x: 0, y: 0, z: 0 }, hz);
      runFor(quarter, 2);
      expect(quarter.state.position.x).toBeCloseTo(2, 1);
      expect(quarter.state.position.x).toBeGreaterThan(1.97);
    }
  });

  it("lands on a moving platform mid-motion without a teleport and then rides it", () => {
    const sim = createSim(ferryCourse(), { x: 1, y: 1.2, z: 0 });
    const dt = 1 / sim.hz;
    const maxPlatformSpeed = (2 * Math.PI * 2) / 8;
    let previousX = sim.state.position.x;
    let landedAt: number | null = null;
    runFor(sim, 1.5, idle, {}, () => {
      const jump = Math.abs(sim.state.position.x - previousX);
      expect(jump).toBeLessThanOrEqual(maxPlatformSpeed * dt + 1e-6);
      previousX = sim.state.position.x;
      if (landedAt === null && sim.state.grounded) landedAt = sim.time;
    });
    expect(landedAt).not.toBeNull();
    expect(sim.state.supportId).toBe("ferry");
    const ferry = sampleObby(sim.course, sim.time).platforms[0]!;
    const offset = sim.state.position.x - ferry.center.x;
    runFor(sim, 2);
    const later = sampleObby(sim.course, sim.time).platforms[0]!;
    expect(sim.state.position.x - later.center.x).toBeCloseTo(offset, 6);
  });

  it("inherits the take-off position but not the platform motion after jumping off", () => {
    const sim = createSim(ferryCourse(), { x: 0, y: 0, z: 0 });
    runFor(sim, 1); // platform moving briskly toward +x
    const beforeJump = sim.state.position.x;
    tick(sim, idle, { jumpPressed: true });
    const takeoffX = sim.state.position.x;
    expect(Math.abs(takeoffX - beforeJump)).toBeLessThan(0.05);
    expect(sim.state.supportId).toBeNull();
    runFor(sim, 0.4, idle, {}, () => {
      expect(sim.state.position.x).toBe(takeoffX);
      expect(sim.state.grounded).toBe(false);
    });
    const ferry = sampleObby(sim.course, sim.time).platforms[0]!;
    expect(Math.abs(ferry.center.x - takeoffX)).toBeGreaterThan(0.3);
  });

  it("boards a ferry from a static island when it is adjacent and is pushed by its side otherwise", () => {
    const layout = course({
      platforms: [
        slab("island", 0, 0, 4, 4),
        slab("ferry", 0, -3.1, 2, 2, 0, 0.4, { axis: "z", distance: 1, period: 6, phase: Math.PI / 2 }), // near edge -1.1 at t=0
      ],
    });
    const sim = createSim(layout, { x: 0, y: 0, z: -1 });
    runUntil(sim, (state) => state.supportId === "ferry", forward, {}, 1);
    expect(sim.state.grounded).toBe(true);
    runUntil(sim, (state) => state.position.z < -2.8, forward, {}, 1);
    const offset = sim.state.position.z - sampleObby(sim.course, sim.time).platforms[1]!.center.z;
    runFor(sim, 3);
    expect(sim.state.position.z - sampleObby(sim.course, sim.time).platforms[1]!.center.z).toBeCloseTo(offset, 6);

    // A tall moving block sweeping through a standing player shoves it along.
    const shover = course({
      platforms: [slab("island", 0, 0, 6, 6), slab("wall", 2.5, 0, 1, 2, 1, 1, { axis: "x", distance: 3, period: 8, phase: Math.PI })],
    });
    const shoved = createSim(shover, { x: 0, y: 0, z: 0 });
    runFor(shoved, 2);
    expect(shoved.state.position.x).toBeLessThan(-0.5);
    expect(shoved.state.grounded).toBe(true);
    expect(shoved.state.supportId).toBe("island");
  });
});

// ---------------------------------------------------------------------------
// Hazards and recovery
// ---------------------------------------------------------------------------

describe("hazards", () => {
  const sweeper = (period = 6) =>
    course({
      platforms: [slab("floor", 0, -2, 8, 8)],
      hazards: [{ id: "bar", center: { x: 0, y: 0.3, z: -2 }, halfLength: 1.5, radius: 0.2, rotation: { period } }],
      checkpoints: [{ id: "safe", position: { x: 3.2, y: 0, z: -2 }, triggerRadius: 0.5 }],
    });

  it("resets a struck player to the latest checkpoint and reports it once per contact", () => {
    const sim = createSim(sweeper(), { x: 3.2, y: 0, z: -2 });
    tick(sim);
    expect(sim.state.checkpointId).toBe("safe");
    runUntil(sim, (state) => state.position.x < 1.0, { moveX: -1, moveY: 0 }, {}, 2);
    let recoveries = 0;
    runFor(sim, 3, idle, {}, (result) => {
      if (result.recovered) recoveries += 1;
    });
    expect(recoveries).toBeGreaterThanOrEqual(1);
    expect(sim.state.position.x).toBe(3.2);
    expect(sim.state.position.z).toBe(-2);
    expect(sim.state.grounded).toBe(true);
    expect(sim.state.checkpointId).toBe("safe");
  });

  it("does not re-trigger during the recovery window and bounds a hopeless spawn to one reset per window", () => {
    const trapped = course({
      platforms: [slab("floor", 0, 0, 4, 4)],
      hazards: [{ id: "still", center: { x: 0, y: 0.3, z: 0 }, halfLength: 1, radius: 0.2 }],
    });
    const sim = createSim(trapped, { x: 0, y: 0, z: 0 });
    const times: number[] = [];
    runFor(sim, 2.05, idle, {}, (result) => {
      if (result.recovered) times.push(sim.time);
    });
    expect(times.length).toBe(3);
    for (let i = 1; i < times.length; i += 1) {
      expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(OBBY_TUNING.recoverySeconds - 1e-9);
    }
    expectFinite(sim.state);
  });

  it("uses the real body volume: misses beyond reach, hits inside the radii sum, clears above and below", () => {
    // Bar tip at |x| = 1.5; contact needs |x| - RADIUS < 1.5 + 0.2 → |x| < 1.95.
    const beyond = createSim(sweeper(), { x: 2.0, y: 0, z: -2 });
    runFor(beyond, 6.5, idle, {}, (result) => expect(result.recovered).toBe(false));

    const inside = createSim(sweeper(), { x: 1.9, y: 0, z: -2 });
    let hit = false;
    runFor(inside, 6.5, idle, {}, (result) => {
      if (result.recovered) hit = true;
    });
    expect(hit).toBe(true);

    // A point test would miss at 1.9 but a whole body clears only when it is above the bar.
    const raised = course({
      platforms: [slab("floor", 0, -2, 8, 8), slab("stage", 1, -2, 1, 1, 0.55)],
      hazards: sweeper().hazards,
    });
    const above = createSim(raised, { x: 1, y: 0.55, z: -2 });
    runFor(above, 6.5, idle, {}, (result) => expect(result.recovered).toBe(false));
    expect(above.state.supportId).toBe("stage");

    const belowBar = course({
      platforms: [slab("floor", 0, -2, 8, 8)],
      hazards: [{ id: "high", center: { x: 0, y: 1.3, z: -2 }, halfLength: 1.5, radius: 0.2, rotation: { period: 6 } }],
    });
    const under = createSim(belowBar, { x: 1, y: 0, z: -2 });
    runFor(under, 6.5, idle, {}, (result) => expect(result.recovered).toBe(false));

    const lowBar = course({
      platforms: [slab("floor", 0, -2, 8, 8)],
      hazards: [{ id: "low", center: { x: 0, y: 1.05, z: -2 }, halfLength: 1.5, radius: 0.2, rotation: { period: 6 } }],
    });
    const clipped = createSim(lowBar, { x: 1, y: 0, z: -2 });
    hit = false;
    runFor(clipped, 6.5, idle, {}, (result) => {
      if (result.recovered) hit = true;
    });
    expect(hit).toBe(true);
  });

  it("lets a well-timed jump clear a low sweeping bar that always hits a standing player", () => {
    const layout = course({
      platforms: [slab("floor", 0, -2, 8, 8)],
      hazards: [{ id: "bar", center: { x: 0, y: 0.15, z: -2 }, halfLength: 1.5, radius: 0.15, rotation: { period: 4 } }],
    });
    const start = { x: 0, y: 0, z: -0.8 }; // 1.2 m from the pivot, off the bar's initial line

    const standing = createSim(layout, start);
    let standingHit = false;
    runFor(standing, 4.2, idle, {}, (result) => {
      if (result.recovered) standingHit = true;
    });
    expect(standingHit).toBe(true);

    // The symmetric bar returns every half period (2 s); each attempt is
    // scored on the first pass only, before the bar comes back around.
    const clearTimes: number[] = [];
    for (let jumpAt = 0; jumpAt < 2; jumpAt += 0.02) {
      const sim = createSim(layout, start);
      let hit = false;
      let passedUnder = false;
      let pressed = false;
      runFor(sim, jumpAt + 1.3, idle, {}, (result) => {
        if (result.recovered) hit = true;
        if (!pressed && sim.time >= jumpAt) {
          pressed = true;
          if (tick(sim, idle, { jumpPressed: true }).recovered) hit = true;
        }
        if (!sim.state.grounded && sim.time > jumpAt && sim.time < jumpAt + JUMP_AIRTIME) {
          const bar = sampleObby(layout, sim.time).hazards[0]!;
          if (segmentDistanceXZ(sim.state.position.x, sim.state.position.z, bar.start, bar.end) < RADIUS + 0.15) {
            passedUnder = true;
          }
        }
      });
      if (!hit && passedUnder) clearTimes.push(jumpAt);
    }
    expect(clearTimes.length).toBeGreaterThan(3);
    expect(clearTimes.length).toBeLessThan(12); // it takes timing: most starts still get hit
    expect(Math.max(...clearTimes) - Math.min(...clearTimes)).toBeLessThan(0.25);
  });

  it("does not tunnel through a fast thin bar at the largest delta", () => {
    const fast = course({
      platforms: [slab("floor", 0, -2, 8, 8)],
      hazards: [{ id: "whip", center: { x: 0, y: 0.3, z: -2 }, halfLength: 2, radius: 0.08, rotation: { period: 1.5 } }],
    });
    const sim = createSim(fast, { x: 1.8, y: 0, z: -2 }, 20);
    const elapsed = runUntil(sim, (_state, result) => result.recovered, idle, {}, 2);
    expect(elapsed).toBeLessThan(1.6);
  });
});

// ---------------------------------------------------------------------------
// Checkpoints
// ---------------------------------------------------------------------------

describe("checkpoints", () => {
  it("arms a broad landing strip across its safe width without reaching the preceding shore", () => {
    const layout = course({
      platforms: [
        slab("approach", 0, 0, 10, 4),
        slab("landing", 0, -5, 10, 4),
      ],
      checkpoints: [
        {
          id: "landing",
          position: { x: 0, y: 0, z: -3.5 },
          triggerRadius: 0.65,
          triggerHalfExtents: { x: 4.5, z: 0.35 },
        },
      ],
    });
    const precedingShore = createSim(layout, { x: 4, y: 0, z: -2 });
    const wideLanding = createSim(layout, { x: 4, y: 0, z: -3.4 });

    tick(precedingShore);
    expect(precedingShore.state.checkpointId).toBeNull();

    expect(tick(wideLanding).checkpointChanged).toBe(true);
    expect(wideLanding.state.position.x).toBe(4);
    expect(wideLanding.state.checkpointId).toBe("landing");
    expect(wideLanding.state.checkpoint).toEqual({ x: 0, y: 0, z: -3.5 });
  });

  it("activates only from a grounded player inside the trigger and records the declared position", () => {
    const layout = course({
      platforms: [slab("floor", 0, 0, 4, 8)],
      checkpoints: [{ id: "mid", position: { x: 0.2, y: 0, z: -1.5 }, triggerRadius: 0.6 }],
    });
    const sim = createSim(layout, { x: 0, y: 0, z: 2 });
    let changes = 0;
    runFor(sim, 1.5, forward, {}, (result) => {
      if (result.checkpointChanged) changes += 1;
    });
    expect(changes).toBe(1);
    expect(sim.state.checkpointId).toBe("mid");
    expect(sim.state.checkpoint).toEqual({ x: 0.2, y: 0, z: -1.5 });

    runUntil(sim, (_state, result) => result.recovered, forward, {}, 4);
    expect(sim.state.position.x).toBe(0.2);
    expect(sim.state.position.z).toBe(-1.5);
    expect(sim.state.grounded).toBe(true);
  });

  it("ignores a trigger passed underneath or flown through", () => {
    const layout = course({
      platforms: [slab("floor", 0, 0, 4, 8), slab("shelf", 0, -1.5, 2, 2, 1.5, 0.3)], // shelf bottom 1.2 > head
      checkpoints: [
        { id: "shelf-cp", position: { x: 0, y: 1.5, z: -1.5 }, triggerRadius: 0.8 },
        { id: "ground-cp", position: { x: 0, y: 0, z: 1 }, triggerRadius: 0.3 },
      ],
    });
    const walker = createSim(layout, { x: 0, y: 0, z: 2.5 });
    runFor(walker, 2, forward);
    expect(walker.state.position.z).toBeLessThan(-2.6);
    expect(walker.state.position.y).toBe(0);
    expect(walker.state.checkpointId).toBe("ground-cp"); // walked through the low one on the way

    const jumper = createSim(layout, { x: 0, y: 0, z: 2.5 });
    runUntil(jumper, (state) => state.position.z <= 1.9, forward);
    expect(jumper.state.checkpointId).toBeNull();
    tick(jumper, forward, { jumpPressed: true });
    const wasAirborneThrough = { value: false };
    runUntil(
      jumper,
      (state) => {
        if (!state.grounded && Math.abs(state.position.z - 1) < 0.3) wasAirborneThrough.value = true;
        return state.grounded;
      },
      forward,
    );
    expect(wasAirborneThrough.value).toBe(true);
    expect(jumper.state.position.z).toBeLessThan(0.5);
    expect(jumper.state.checkpointId).toBeNull();

    // Jumping under the shelf bumps the head; still no activation.
    runUntil(jumper, (state) => state.position.z <= -1.5, forward);
    tick(jumper, idle, { jumpPressed: true });
    runUntil(jumper, (state) => state.grounded);
    expect(jumper.state.checkpointId).toBeNull();

    // Walking back through the ground trigger grounded activates it.
    runUntil(jumper, (_state, result) => result.checkpointChanged, backward, {}, 3);
    expect(jumper.state.checkpointId).toBe("ground-cp");
  });

  it("recovers to an earlier static checkpoint when the latest one's ferry has moved away", () => {
    const layout = course({
      platforms: [
        slab("island", 0, 0, 4, 4),
        slab("ferry", 0, -5.1, 2, 2, 0, 0.4, { axis: "z", distance: 2, period: 16, phase: Math.PI / 2 }), // z = -3.1 at t = 0, adjacent; drifts to -7.1
      ],
      checkpoints: [
        { id: "island-cp", position: { x: 0, y: 0, z: 0 }, triggerRadius: 0.5 },
        { id: "ferry-cp", position: { x: 0, y: 0, z: -3.1 }, triggerRadius: 0.5 },
      ],
    });
    const sim = createSim(layout, { x: 0, y: 0, z: 0 });
    tick(sim);
    expect(sim.state.checkpointId).toBe("island-cp");
    runUntil(sim, (state) => state.checkpointId === "ferry-cp", forward, {}, 2);
    expect(sim.state.supportId).toBe("ferry");
    runFor(sim, 3); // ride away from the island
    expect(sampleObby(layout, sim.time).platforms[1]!.center.z).toBeLessThan(-4.5);
    let adopted = false;
    const result = runUntil(
      sim,
      (_state, result) => {
        adopted = result.checkpointChanged;
        return result.recovered;
      },
      forward,
      {},
      3,
    ); // walk off the far end
    expect(result).toBeGreaterThan(0);
    expect(adopted).toBe(true);
    expect(sim.state.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(sim.state.grounded).toBe(true);
    expect(sim.state.supportId).toBe("island");
    expect(sim.state.checkpointId).toBe("island-cp");
    expect(sim.state.checkpoint).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("keeps state finite for invalid checkpoints and creation positions", () => {
    const layout = course({
      platforms: [slab("floor", 0, 0, 4, 4)],
      checkpoints: [
        { id: "nan", position: { x: Number.NaN, y: Number.POSITIVE_INFINITY, z: -1 }, triggerRadius: 0.5 },
        { id: "no-radius", position: { x: 0, y: 0, z: 1 }, triggerRadius: Number.NaN },
      ],
    });
    const sim = createSim(layout, { x: Number.NaN, y: 0, z: 1 });
    runFor(sim, 1, forward);
    expectFinite(sim.state);
    expect(sim.state.checkpointId).toBe("nan");
    expect(sim.state.checkpoint).toEqual({ x: 0, y: 0, z: -1 });
    runUntil(sim, (_state, result) => result.recovered, forward, {}, 4);
    expectFinite(sim.state);
    expect(sim.state.position).toEqual({ x: 0, y: 0, z: -1 });

    const midair = createSim(course({ platforms: [] }), { x: 0, y: 0, z: 0 });
    let recoveries = 0;
    runFor(midair, 3, forward, {}, (result) => {
      if (result.recovered) recoveries += 1;
    });
    expectFinite(midair.state);
    expect(recoveries).toBeGreaterThan(1);
    expect(recoveries).toBeLessThan(8);
  });
});

// ---------------------------------------------------------------------------
// Pause and delta handling
// ---------------------------------------------------------------------------

describe("pause and delta handling", () => {
  it("treats dt 0 as a complete no-op that also swallows presses", () => {
    const sim = createSim(floor(), { x: 0, y: 0, z: 0 });
    tick(sim);
    const before = structuredClone(sim.state);
    for (let frame = 0; frame < 30; frame += 1) {
      const result = stepObby(sim.state, forward, sim.course, {
        deltaSeconds: 0,
        timeSeconds: sim.time,
        cameraYaw: 1,
        canJump: true,
        jumpPressed: true,
        radius: RADIUS,
        height: HEIGHT,
      });
      expect(result).toEqual({ recovered: false, checkpointChanged: false });
    }
    expect(sim.state).toEqual(before);
    runFor(sim, 0.5);
    expect(sim.state.grounded).toBe(true);
    expect(sim.state.position.y).toBe(0);
  });

  it("zeros invalid or negative deltas and clamps large ones", () => {
    const sim = createSim(floor(), { x: 0, y: 0, z: 1.5 });
    tick(sim);
    const before = structuredClone(sim.state);
    for (const deltaSeconds of [Number.NaN, -1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]) {
      stepObby(sim.state, forward, sim.course, {
        deltaSeconds,
        timeSeconds: sim.time,
        cameraYaw: 0,
        canJump: true,
        jumpPressed: true,
        radius: RADIUS,
        height: HEIGHT,
      });
    }
    expect(sim.state).toEqual(before);

    stepObby(sim.state, forward, sim.course, {
      deltaSeconds: 1,
      timeSeconds: sim.time + 1,
      cameraYaw: 0,
      canJump: true,
      jumpPressed: false,
      radius: RADIUS,
      height: HEIGHT,
    });
    expect(sim.state.position.z).toBeCloseTo(1.5 - OBBY_TUNING.moveSpeed * OBBY_TUNING.maxDeltaSeconds, 6);

    const odd = createSim(floor(), { x: 0, y: 0, z: 1.5 });
    stepObby(odd.state, forward, odd.course, {
      deltaSeconds: 1 / 60,
      timeSeconds: Number.NaN,
      cameraYaw: Number.NaN,
      canJump: true,
      jumpPressed: false,
      radius: Number.NaN,
      height: -1,
    });
    expectFinite(odd.state);
    expect(odd.state.grounded).toBe(true);
  });

  it("does not advance hazards while paused so a resumed player is not dropped into a moved bar", () => {
    const layout = course({
      platforms: [slab("floor", 0, -2, 8, 8)],
      hazards: [{ id: "bar", center: { x: 0, y: 0.3, z: -2 }, halfLength: 1.5, radius: 0.2, rotation: { period: 6 } }],
    });
    const sim = createSim(layout, { x: 0, y: 0, z: -0.6 }); // bar points along x; player just outside its reach
    tick(sim);
    const parkedTime = sim.time;
    for (let frame = 0; frame < 600; frame += 1) {
      stepObby(sim.state, idle, layout, {
        deltaSeconds: 0,
        timeSeconds: parkedTime,
        cameraYaw: 0,
        canJump: true,
        jumpPressed: false,
        radius: RADIUS,
        height: HEIGHT,
      });
    }
    expect(sampleObby(layout, sim.time).hazards[0]?.angle).toBeCloseTo(sampleObby(layout, parkedTime).hazards[0]?.angle ?? NaN, 9);
    const result = tick(sim);
    expect(result.recovered).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Frame-rate consistency and the generous route
// ---------------------------------------------------------------------------

interface JumpProfile {
  apex: number;
  airtime: number;
  landingZ: number;
}

function measureJump(hz: number): JumpProfile {
  const sim = createSim(floor(), { x: 0, y: 0, z: 1.8 }, hz);
  tick(sim);
  const start = sim.time;
  tick(sim, forward, { jumpPressed: true });
  let apex = 0;
  runUntil(
    sim,
    (state) => {
      apex = Math.max(apex, state.position.y);
      return state.grounded;
    },
    forward,
  );
  return { apex, airtime: sim.time - start, landingZ: sim.state.position.z };
}

describe("frame-rate consistency", () => {
  it("produces the same jump within tight bounds at 30 and 60 Hz", () => {
    const at60 = measureJump(60);
    const at30 = measureJump(30);
    for (const profile of [at60, at30]) {
      expect(profile.apex).toBeGreaterThan(JUMP_APEX - 0.02);
      expect(profile.apex).toBeLessThanOrEqual(JUMP_APEX + 0.001);
      expect(profile.airtime).toBeGreaterThan(JUMP_AIRTIME - 0.001);
      expect(profile.airtime).toBeLessThan(JUMP_AIRTIME + 1 / 30 + 0.001);
    }
    expect(Math.abs(at60.apex - at30.apex)).toBeLessThan(0.01);
    expect(Math.abs(at60.landingZ - at30.landingZ)).toBeLessThan(0.06);
    expect(at60.landingZ).toBeLessThan(1.8 - 1.9);
  });
});

/**
 * Representative level-2 layout: broad 4 m islands with 0.7 m gaps, a slow
 * sweeper beside the path on the second island, a ferry that docks at both
 * banks with a 0.1 m gap, and a checkpoint on every island.
 */
const SWEEPER_PIVOT = { x: 1.3, z: -5.6 }; // the bar tip reaches x = 0.1, so it crosses the x = 0 path

function buildRoute(): ObbyCourse {
  return course({
    platforms: [
      slab("island-a", 0, 0, 4, 4), // z 2 … -2
      slab("island-b", 0, -4.7, 4, 4), // z -2.7 … -6.7
      slab("island-c", 0, -9.4, 4, 4), // z -7.4 … -11.4
      slab("ferry", 0, -14.5, 2, 2, 0, 0.4, { axis: "z", distance: 2, period: 10, phase: Math.PI / 2 }), // z -12.5 … -16.5
      slab("island-d", 0, -19.6, 4, 4), // z -17.6 … -21.6
    ],
    hazards: [
      {
        id: "sweeper",
        center: { x: SWEEPER_PIVOT.x, y: 0.3, z: SWEEPER_PIVOT.z },
        halfLength: 1.2,
        radius: 0.2,
        rotation: { period: 8 },
      },
    ],
    checkpoints: [
      { id: "cp-a", position: { x: 0, y: 0, z: 1 }, triggerRadius: 1 },
      { id: "cp-b", position: { x: 0, y: 0, z: -3.5 }, triggerRadius: 0.8 },
      { id: "cp-c", position: { x: 0, y: 0, z: -9.4 }, triggerRadius: 1 },
      { id: "cp-d", position: { x: 0, y: 0, z: -19.6 }, triggerRadius: 1 },
    ],
  });
}

/**
 * Look before crossing: walking on at full speed from `z`, the player's
 * predicted position must stay clear of the bar until it is past the bar's
 * reach (z < -7.4), with a 0.15 m margin over the exact contact distance.
 */
function sweeperPathClear(layout: ObbyCourse, time: number, z: number): boolean {
  const seconds = (z + 7.4) / OBBY_TUNING.moveSpeed;
  for (let ahead = 0; ahead <= seconds; ahead += 0.02) {
    const bar = sampleObby(layout, time + ahead).hazards[0]!;
    const predictedZ = z - OBBY_TUNING.moveSpeed * ahead;
    if (segmentDistanceXZ(0, predictedZ, bar.start, bar.end) < RADIUS + bar.radius + 0.15) return false;
  }
  return true;
}

interface RouteOptions {
  hz: number;
  skipJumpOn?: string;
  ignoreSweeper?: boolean;
}

interface RouteReport {
  recoveries: number;
  checkpoints: string[];
  seconds: number;
  finalSupport: string | null;
  recoveredTo: PositionSnapshot[];
}

function playRoute(options: RouteOptions): RouteReport {
  const layout = buildRoute();
  const sim = createSim(layout, { x: 0, y: 0, z: 1 }, options.hz);
  const jumped = new Set<string>();
  const report: RouteReport = { recoveries: 0, checkpoints: [], seconds: 0, finalSupport: null, recoveredTo: [] };
  const maxFrames = 60 * options.hz;
  for (let frame = 0; frame < maxFrames; frame += 1) {
    const { state } = sim;
    const z = state.position.z;
    const support = state.supportId;
    const sample = sampleObby(layout, sim.time);
    const ferry = sample.platforms[3]!;
    let input = forward;
    let jump = false;

    if (support === "island-a" && z <= -1.7 && !jumped.has("a")) {
      jump = true;
      jumped.add("a");
    } else if (support === "island-b") {
      if (z > -3.9 && !options.ignoreSweeper && !sweeperPathClear(layout, sim.time, z)) input = idle;
      else if (z <= -6.4 && !jumped.has("b")) {
        if (options.skipJumpOn !== "b" || report.recoveries > 0) {
          jump = true;
          jumped.add("b");
        }
      }
    } else if (support === "island-c") {
      const ferryNearEdge = ferry.center.z + 1;
      if (z <= -11.15 && -11.4 - ferryNearEdge > 0.2) input = idle;
    } else if (support === "ferry") {
      const ferryFarEdge = ferry.center.z - 1;
      if (ferryFarEdge - -17.6 > 0.3) input = idle;
    } else if (support === "island-d") {
      if (z <= -19.6) {
        report.seconds = sim.time;
        report.finalSupport = support;
        return report;
      }
    }

    const result = tick(sim, input, { jumpPressed: jump });
    if (result.recovered) {
      report.recoveries += 1;
      report.recoveredTo.push({ ...state.position });
    }
    if (result.checkpointChanged && state.checkpointId) report.checkpoints.push(state.checkpointId);
  }
  report.seconds = sim.time;
  report.finalSupport = sim.state.supportId;
  return report;
}

describe("generous route", () => {
  it("is completed without a single recovery at 60 Hz and 30 Hz", () => {
    for (const hz of [60, 30]) {
      const report = playRoute({ hz });
      expect(report.finalSupport).toBe("island-d");
      expect(report.recoveries).toBe(0);
      expect(report.checkpoints).toEqual(["cp-a", "cp-b", "cp-c", "cp-d"]);
      expect(report.seconds).toBeLessThan(40);
    }
  });

  it("returns a missed jump to the island's checkpoint and still finishes", () => {
    const report = playRoute({ hz: 60, skipJumpOn: "b" });
    expect(report.recoveries).toBe(1);
    expect(report.recoveredTo[0]).toEqual({ x: 0, y: 0, z: -3.5 });
    expect(report.finalSupport).toBe("island-d");
    expect(report.checkpoints).toEqual(["cp-a", "cp-b", "cp-c", "cp-d"]);
  });

  it("punishes walking straight into the sweeper only with a local reset", () => {
    const report = playRoute({ hz: 60, ignoreSweeper: true });
    expect(report.finalSupport).toBe("island-d");
    expect(report.recoveries).toBeGreaterThanOrEqual(0);
    for (const spot of report.recoveredTo) {
      expect(spot.y).toBe(0);
      expect([1, -3.5, -9.4]).toContain(spot.z);
    }
  });
});

// ---------------------------------------------------------------------------
// Regressions from the WO-024 adversarial review of 6f6fbc5
// ---------------------------------------------------------------------------

describe("review regressions", () => {
  it("D1: duplicate platform ids never carry the rider toward the other box", () => {
    const layout = course({
      platforms: [
        slab("dup", 0, 0, 4, 4),
        slab("dup", 8, 0, 2, 2, 0, 0.4, { axis: "x", distance: 2, period: 8 }),
      ],
    });
    const sim = createSim(layout, { x: 8, y: 0.5, z: 0 });
    const dt = 1 / sim.hz;
    const maxPlatformSpeed = (2 * Math.PI * 2) / 8;
    let previousX = sim.state.position.x;
    let largestJump = 0;
    let landed = false;
    let offset = 0;
    let maxDrift = 0;
    runFor(sim, 3, idle, {}, () => {
      largestJump = Math.max(largestJump, Math.abs(sim.state.position.x - previousX));
      previousX = sim.state.position.x;
      const slab = sampleObby(layout, sim.time).platforms[1]!;
      if (sim.state.grounded && !landed) {
        landed = true;
        offset = sim.state.position.x - slab.center.x;
      } else if (landed) {
        maxDrift = Math.max(maxDrift, Math.abs(sim.state.position.x - slab.center.x - offset));
      }
    });
    expect(landed).toBe(true);
    expect(largestJump).toBeLessThanOrEqual(maxPlatformSpeed * dt + 1e-6);
    expect(maxDrift).toBeLessThan(1e-6);
    expect(sim.state.position.x).toBeGreaterThan(5);
    expect(sim.state.grounded).toBe(true);
    expect(sim.state.supportId).toBe("dup");
  });

  it("D2: standing on a floor below the fall line is not a fall, and an unsupported spawn recovers at the cooldown cadence", () => {
    const pit = course({ platforms: [slab("pit-floor", 0, 0, 4, 4, -2.5)] });
    const standing = createSim(pit, { x: 0, y: -2.5, z: 0 });
    let recoveries = 0;
    runFor(standing, 10, idle, {}, (result) => {
      if (result.recovered) recoveries += 1;
    });
    expect(recoveries).toBe(0);
    expect(standing.state.grounded).toBe(true);
    expect(standing.state.position.y).toBe(-2.5);
    expectFinite(standing.state);

    // Walking off that floor is airborne below the line: one recovery, not one per frame.
    const times: number[] = [];
    runFor(standing, 1, backward, {}, (result) => {
      if (result.recovered) times.push(standing.time);
    });
    expect(times.length).toBeGreaterThanOrEqual(1);
    expect(times.length).toBeLessThanOrEqual(2);

    const nothing = course({ platforms: [] });
    const hopeless = createSim(nothing, { x: 0, y: -1.9, z: 0 }); // reaches the fall line in one frame
    const stamps: number[] = [];
    runFor(hopeless, 4, idle, {}, (result) => {
      if (result.recovered) stamps.push(hopeless.time);
    });
    expect(stamps.length).toBeGreaterThanOrEqual(4);
    expect(stamps.length).toBeLessThanOrEqual(6);
    for (let i = 1; i < stamps.length; i += 1) {
      expect(stamps[i]! - stamps[i - 1]!).toBeGreaterThanOrEqual(OBBY_TUNING.recoverySeconds - 1e-9);
    }
    expectFinite(hopeless.state);
  });

  it("D3: a jump release during paused frames is observed so the next press jumps", () => {
    const sim = createSim(floor(), { x: 0, y: 0, z: 0 });
    tick(sim);
    tick(sim, idle, { jumpPressed: true });
    runUntil(sim, (state) => state.grounded, idle, { jumpPressed: true }); // held through the whole jump
    for (let frame = 0; frame < 10; frame += 1) {
      const result = stepObby(sim.state, idle, sim.course, {
        deltaSeconds: 0,
        timeSeconds: sim.time,
        cameraYaw: 0,
        canJump: true,
        jumpPressed: false, // released while paused
        radius: RADIUS,
        height: HEIGHT,
      });
      expect(result).toEqual({ recovered: false, checkpointChanged: false });
      expect(sim.state.grounded).toBe(true);
    }
    let maxY = 0;
    runFor(sim, 0.3, idle, { jumpPressed: true }, () => {
      maxY = Math.max(maxY, sim.state.position.y);
    });
    expect(maxY).toBeGreaterThan(0.5);
  });

  it("D4: a clock rewind re-anchors the rider instead of carrying it by the whole sample delta", () => {
    const layout = course({ platforms: [slab("ferry", 0, 0, 2, 2, 0, 0.4, { axis: "x", distance: 2, period: 8 })] });
    const sim = createSim(layout, { x: 0, y: 0, z: 0 });
    runFor(sim, 2);
    const before = sim.state.position.x;
    const dt = 1 / sim.hz;
    const maxPlatformSpeed = (2 * Math.PI * 2) / 8;
    stepObby(sim.state, idle, layout, {
      deltaSeconds: dt,
      timeSeconds: sim.time - 2,
      cameraYaw: 0,
      canJump: true,
      jumpPressed: false,
      radius: RADIUS,
      height: HEIGHT,
    });
    expect(Math.abs(sim.state.position.x - before)).toBeLessThanOrEqual(maxPlatformSpeed * dt + 1e-6);
    expectFinite(sim.state);
  });
});
