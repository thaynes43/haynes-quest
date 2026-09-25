import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { planCasinoCollectibles } from "../../src/game/casino-tokens";
import { getAvatarProportions } from "../../src/game/controller";
import { foregroundSimulationSteps } from "../../src/game/frame-step";
import {
  OBBY_TUNING,
  createObbyState,
  sampleObby,
  stepObby,
} from "../../src/game/obby";
import { resolveAuthoredLevelDocument } from "../../src/shared/authored-level";
import type { AppearanceStage } from "../../src/shared/contracts";
// @ts-expect-error The browser helper is executable JavaScript by design.
import * as browserDriver from "./authored-browser-driver.mjs";
// @ts-expect-error The navigation helper is executable JavaScript by design.
import * as navigation from "./authored-navigation.mjs";
// @ts-expect-error The lockstep helper is executable JavaScript by design.
import * as lockstepControl from "./lockstep-control.mjs";

const { createAuthoredRouteDriver } = browserDriver;
const { buildTraversalPlan, planarDistance } = navigation;
const {
  LOCKSTEP_PHYSICS,
  createLockstep,
  createLockstepControls,
  followSegmentKeys,
  jumpAim,
  keysToward,
  lockstepCruiseFrameMs,
  lockstepDeviceScale,
  lockstepRequested,
  planWalk,
  sampleSweeper,
  sweeperFootprint,
  sweeperTouches,
} = lockstepControl;

type Point = { x: number; y: number; z: number };
type Mark = { stage: string; details: unknown };

const project = JSON.parse(
  fs.readFileSync(
    new URL(
      "../../src/shared/levels/rat-casino-world-v1.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const casinoLevel = project.chapters.find(
  (chapter: { chapterId: string }) => chapter.chapterId === "rat-casino",
).level;

/**
 * A page whose only game is the real obby movement core running the checked-in
 * Rat Casino course. Keyboard events and clock steps behave like the browser
 * surfaces the lockstep driver uses: presses latch until the next frame, and
 * one runFor(16) is one frame.
 */
function simulatedCasino(stage: AppearanceStage = "child") {
  const resolved = resolveAuthoredLevelDocument(casinoLevel);
  const course = resolved.course;
  const document = {
    ...resolved.document,
    schemaVersion: "authored-level-v2",
  };
  const state = createObbyState(resolved.anchors.spawn.position);
  const dimensions = getAvatarProportions(stage);
  const keys = new Set<string>();
  let pendingJump = false;
  let courseTime = 0;
  let recoveries = 0;
  let jumpSequence = 0;
  let frames = 0;
  const axis = (positive: string, negative: string) =>
    Number(keys.has(positive)) - Number(keys.has(negative));
  const input = () => {
    let moveX = axis("KeyD", "KeyA");
    let moveY = axis("KeyW", "KeyS");
    const magnitude = Math.hypot(moveX, moveY);
    if (magnitude > 1) {
      moveX /= magnitude;
      moveY /= magnitude;
    }
    return { moveX, moveY };
  };
  const frame = (milliseconds: number) => {
    frames += 1;
    const move = input();
    const jumpPressed = pendingJump;
    pendingJump = false;
    const steps = foregroundSimulationSteps(milliseconds / 1_000, true);
    for (const [index, step] of steps.entries()) {
      courseTime += step;
      const velocityBefore = state.velocityY;
      const result = stepObby(state, move, course, {
        deltaSeconds: step,
        timeSeconds: courseTime,
        cameraYaw: 0,
        canJump: true,
        jumpPressed: jumpPressed && index === 0,
        radius: dimensions.colliderRadius,
        height: dimensions.height,
        tuning: { moveSpeed: 4 },
      });
      if (velocityBefore <= 0 && state.velocityY > 0) jumpSequence += 1;
      if (result.recovered) recoveries += 1;
    }
  };
  const inspect = () => ({
    status: {
      position: { ...state.position },
      grounded: state.grounded,
      jumpSequence,
      phase: "exploring",
      appearanceStage: stage,
    },
    input: { ...input(), lookX: 0, lookY: 0 },
    checkpoint: { ...state.checkpoint },
    level: { authored: document, encounterPositions: [], pickupPositions: [] },
    obby: {
      ...sampleObby(course, courseTime),
      routeId: document.id,
      checkpointId: state.checkpointId,
      supportId: state.supportId,
      recoveryRemaining: state.recoveryRemaining,
      recoveries,
    },
    collectibles: null,
  });
  const page = {
    isClosed: () => false,
    evaluate: async (callback: unknown) => {
      const source = String(callback);
      if (source.includes("__reactFiber")) return inspect();
      if (source.includes("Date.now")) return Math.round(courseTime * 1_000);
      return [];
    },
    keyboard: {
      down: async (key: string) => {
        if (key === "Space" && !keys.has(key)) pendingJump = true;
        keys.add(key);
      },
      up: async (key: string) => {
        keys.delete(key);
      },
      press: async (key: string) => {
        if (key === "Space") pendingJump = true;
      },
    },
    clock: {
      install: async () => undefined,
      pauseAt: async () => undefined,
      runFor: async (milliseconds: number) => {
        for (let elapsed = 0; elapsed < milliseconds; elapsed += 16) frame(16);
      },
      fastForward: async (milliseconds: number) => frame(milliseconds),
    },
  };
  /** Drops the traveler onto whatever is below `position` (test setup only). */
  const place = (position: Point) => {
    Object.assign(state.position, position);
    state.velocityY = 0;
    state.grounded = false;
    state.supportId = null;
    state.supportAnchor = null;
    for (let index = 0; index < 60 && !state.grounded; index += 1) frame(16);
    expect(state.grounded).toBe(true);
  };
  return {
    page,
    document,
    resolved,
    place,
    frames: () => frames,
    heldKeys: () => [...keys],
    recoveries: () => recoveries,
  };
}

async function lockstepDriver(world: ReturnType<typeof simulatedCasino>) {
  const lockstep = createLockstep(world.page);
  await lockstep.pause();
  const marks: Mark[] = [];
  const driver = createAuthoredRouteDriver({
    page: world.page,
    controls: createLockstepControls(lockstep),
    screenshot: async () => undefined,
    mark: (stage: string, details: unknown) => marks.push({ stage, details }),
    maxRecoveries: 0,
    lockstep,
  });
  return { lockstep, driver, marks };
}

describe("lockstep route control", () => {
  it("mirrors the runtime tuning it plans and predicts with", () => {
    expect(LOCKSTEP_PHYSICS.jumpVelocity).toBe(OBBY_TUNING.jumpVelocity);
    expect(LOCKSTEP_PHYSICS.gravity).toBe(OBBY_TUNING.gravity);
    expect(LOCKSTEP_PHYSICS.stepTolerance).toBe(OBBY_TUNING.stepTolerance);
    expect(LOCKSTEP_PHYSICS.supportOverhang).toBe(OBBY_TUNING.supportOverhang);
    for (const stage of ["infant", "child"] as const) {
      const proportions = getAvatarProportions(stage);
      expect(LOCKSTEP_PHYSICS.travelers[stage]).toEqual({
        radius: proportions.colliderRadius,
        height: proportions.height,
      });
    }
  });

  it("enables lockstep only when asked and bounds the cruise frame", () => {
    expect(lockstepRequested({})).toBe(false);
    expect(lockstepRequested({ QUEST_E2E_LOCKSTEP: "0" })).toBe(false);
    expect(lockstepRequested({ QUEST_E2E_LOCKSTEP: "1" })).toBe(true);
    expect(() => lockstepRequested({ QUEST_E2E_LOCKSTEP: "fast" })).toThrow(
      "QUEST_E2E_LOCKSTEP must be 1 or 0",
    );
    expect(lockstepCruiseFrameMs({})).toBe(48);
    expect(lockstepCruiseFrameMs({ QUEST_E2E_LOCKSTEP_CRUISE_MS: "16" })).toBe(
      16,
    );
    expect(() =>
      lockstepCruiseFrameMs({ QUEST_E2E_LOCKSTEP_CRUISE_MS: "50" }),
    ).toThrow("multiple of 16");
    expect(lockstepDeviceScale({})).toBe(1);
    expect(lockstepDeviceScale({ QUEST_E2E_LOCKSTEP_SCALE: "0.5" })).toBe(0.5);
    expect(() =>
      lockstepDeviceScale({ QUEST_E2E_LOCKSTEP_SCALE: "2" }),
    ).toThrow("from 0.25 to 1");
  });

  it("samples sweepers exactly as the course does", () => {
    const resolved = resolveAuthoredLevelDocument(casinoLevel);
    const sweepers = resolved.document.pieces.filter(
      (piece) => piece.type === "sweeper",
    );
    expect(sweepers.map((piece) => piece.id).sort()).toEqual([
      "party-turnstile",
      "ribbon-padded-bar",
    ]);
    for (const time of [0, 1.3, 4.9, 7.25, 12.6]) {
      const sampled = sampleObby(resolved.course, time);
      for (const piece of sweepers) {
        const expected = sampled.hazards.find(
          (entry) => entry.id === piece.id,
        )!;
        const actual = sampleSweeper(piece, time);
        for (const key of ["center", "start", "end"] as const)
          for (const axis of ["x", "y", "z"] as const)
            expect(actual[key][axis]).toBeCloseTo(expected[key][axis], 9);
        const footprint = sweeperFootprint(piece);
        for (const point of [expected.start, expected.end]) {
          expect(point.x).toBeGreaterThanOrEqual(footprint.minX);
          expect(point.x).toBeLessThanOrEqual(footprint.maxX);
          expect(point.z).toBeGreaterThanOrEqual(footprint.minZ);
          expect(point.z).toBeLessThanOrEqual(footprint.maxZ);
        }
      }
    }
  });

  it("detects a sweeper only when it reaches the body", () => {
    const traveler = LOCKSTEP_PHYSICS.travelers.child;
    const capsule = {
      center: { x: 0, y: 0.22, z: 0 },
      start: { x: -1, y: 0.22, z: 0 },
      end: { x: 1, y: 0.22, z: 0 },
      radius: 0.18,
    };
    expect(sweeperTouches(capsule, { x: 0, y: 0, z: 0.4 }, traveler)).toBe(
      true,
    );
    expect(sweeperTouches(capsule, { x: 0, y: 0, z: 0.45 }, traveler)).toBe(
      false,
    );
    // Airborne feet above the bar clear it.
    expect(sweeperTouches(capsule, { x: 0, y: 0.41, z: 0 }, traveler)).toBe(
      false,
    );
  });

  it("holds a keyboard axis only past its deadband", () => {
    expect(keysToward(0.02, -0.5)).toEqual(["KeyW"]);
    expect(keysToward(-0.5, 0.5)).toEqual(["KeyA", "KeyS"]);
    expect(keysToward(0.01, 0.01)).toEqual([]);
  });

  it("follows an off-axis segment within one frame of sideways travel", () => {
    const from = { x: 0, y: 0, z: 0 };
    const to = { x: 4.92, y: 0, z: 0.87 };
    const step = 0.064;
    const vectors: Record<string, [number, number]> = {
      KeyD: [1, 0],
      KeyA: [-1, 0],
      KeyS: [0, 1],
      KeyW: [0, -1],
    };
    const position = { ...from };
    let worst = 0;
    for (let frame = 0; frame < 200; frame += 1) {
      if (planarDistance(position, to) < step) break;
      const keys = followSegmentKeys(position, from, to, step);
      let dx = 0;
      let dz = 0;
      for (const key of keys) {
        dx += vectors[key][0];
        dz += vectors[key][1];
      }
      const length = Math.hypot(dx, dz);
      position.x += (dx / length) * step;
      position.z += (dz / length) * step;
      const length2 = Math.hypot(to.x, to.z);
      const offset = Math.abs(
        (to.x * position.z - to.z * position.x) / length2,
      );
      worst = Math.max(worst, offset);
    }
    expect(planarDistance(position, to)).toBeLessThan(0.1);
    expect(worst).toBeLessThan(step * 0.75);
  });

  it("walks straight when the floor is open and detours around a raised block", () => {
    const floor = {
      id: "floor",
      center: { x: 0, y: -0.3, z: 0 },
      size: { x: 12, y: 0.6, z: 12 },
    };
    const block = {
      id: "block",
      center: { x: 0, y: 0, z: 0 },
      size: { x: 6, y: 0.6, z: 2 },
    };
    const start = { x: 0, y: 0, z: 4 };
    const goal = { x: 0, y: 0, z: -4 };
    const open = planWalk({ platforms: [floor], start, goal });
    expect(open).toEqual({ waypoints: [goal], direct: true });

    const detour = planWalk({ platforms: [floor, block], start, goal });
    expect(detour.direct).toBe(false);
    expect(detour.waypoints.at(-1)).toEqual(goal);
    const reach = LOCKSTEP_PHYSICS.travelers.child.radius;
    let from = start;
    for (const waypoint of detour.waypoints) {
      for (let t = 0; t <= 1; t += 0.02) {
        const x = from.x + (waypoint.x - from.x) * t;
        const z = from.z + (waypoint.z - from.z) * t;
        const inside = Math.abs(x) < 3 + reach && Math.abs(z) < 1 + reach;
        expect(inside).toBe(false);
      }
      from = waypoint;
    }

    const wall = {
      id: "wall",
      center: { x: 0, y: 0, z: 0 },
      size: { x: 12, y: 0.6, z: 2 },
    };
    expect(planWalk({ platforms: [floor, wall], start, goal })).toBeNull();
  });

  it("aims a jump past the far edge and within reach", () => {
    const source = {
      id: "a",
      center: { x: 0, y: -0.3, z: 0 },
      size: { x: 4, y: 0.6, z: 4 },
    };
    const target = {
      id: "b",
      center: { x: 0, y: 0, z: -5 },
      size: { x: 4, y: 0.6, z: 4 },
    };
    const { takeoff, landing, aim } = jumpAim(source, target);
    expect(takeoff.z).toBeCloseTo(-1.68);
    expect(landing.z).toBeCloseTo(-3.32);
    expect(aim.z).toBeLessThan(landing.z);
    expect(aim.z).toBeGreaterThanOrEqual(-6.55);
    expect(planarDistance(takeoff, aim)).toBeLessThan(2.4 * 0.8 + 1e-9);
  });

  it("follows the Rat Casino explorer route one frame at a time", async () => {
    const world = simulatedCasino();
    const { driver, lockstep, marks } = await lockstepDriver(world);
    const ticket = planCasinoCollectibles({
      authored: world.resolved.document,
      course: world.resolved.course,
    })!.tickets.find((item) => item.platformId === "golden-view-balcony")!;
    const branch = world.document.branches.findIndex((path) =>
      path.includes("golden-view-balcony"),
    );
    const plan = buildTraversalPlan(world.document, { branchIndex: branch });
    let reachedTicket = null;
    for (const edge of plan.edges) {
      const after = await driver.crossEdge(edge, `route-edge-${edge.index}`);
      expect(after.obby.supportId).toBe(edge.to);
      if (edge.to === "golden-view-balcony")
        reachedTicket = await driver.moveToPoint(() => ticket.position, {
          label: "golden-ticket",
          tolerance: 0.3,
          supportId: "golden-view-balcony",
        });
    }
    expect(reachedTicket?.obby.supportId).toBe("golden-view-balcony");
    expect(world.recoveries()).toBe(0);
    expect(driver.evidence.edgeEvidence).toHaveLength(plan.edges.length);
    expect(driver.evidence.ferryEvidence).toHaveLength(1);
    expect(world.heldKeys()).toEqual([]);
    const detours = marks.filter((entry) => entry.stage === "movement:detour");
    expect(detours.length).toBeGreaterThan(0);
    expect(lockstep.stats.frames).toBe(world.frames());
    expect(lockstep.stats.cruiseFrames).toBeGreaterThan(0);
  }, 120_000);

  it("misses a practice jump onto its declared catch and walks back", async () => {
    const world = simulatedCasino();
    const { driver } = await lockstepDriver(world);
    const edge = world.document.connections.find(
      (connection) =>
        connection.from === "casino-foyer" &&
        connection.to === "token-step-one",
    )!;
    expect(edge.safeMissPlatformId).toBe("casino-padded-floor");
    const { caught, retryEdge } = await driver.missToSafePlatform(
      edge,
      "practice-miss",
    );
    expect(caught.obby.supportId).toBe("casino-padded-floor");
    expect(world.recoveries()).toBe(0);
    const back = await driver.crossEdge(retryEdge, "practice-retry");
    expect(back.obby.supportId).toBe("casino-foyer");
    expect(driver.evidence.safeMissEvidence).toHaveLength(1);
  }, 60_000);

  it("walks back from the padded floor around the raised token steps", async () => {
    const world = simulatedCasino();
    const { driver, marks } = await lockstepDriver(world);
    // Where a short first jump drops the traveler: south of token-step-one.
    world.place({ x: 0.8, y: 0.05, z: -8.6 });
    const after = await driver.crossEdge(
      { from: "casino-padded-floor", to: "casino-foyer", mode: "walk" },
      "safe-catch-walk",
    );
    expect(after.obby.supportId).toBe("casino-foyer");
    expect(world.recoveries()).toBe(0);
    expect(marks.some((entry) => entry.stage === "movement:detour")).toBe(true);
  }, 60_000);
});
