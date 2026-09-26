import { describe, expect, it } from "vitest";
import {
  abilitiesForAge,
  abilitySetSchema,
  BOUNCE_PAD_VELOCITY,
  GROWTH_MOVE_PHYSICS,
  growthCameraScale,
  growthMoveCards,
  growthMoveTuning,
  growthVisualScale,
  newlyUnlockedMoves,
} from "../../src/shared/abilities";
import {
  createObbyState,
  stepObby,
  type ObbyAbilities,
  type ObbyCourse,
  type ObbyState,
  type ObbyStepOptions,
} from "../../src/game/obby";
import { levelGrowth } from "../../src/game/growth";
import { authoredRoute } from "../../src/game/authored-layout";

const DT = 1 / 60;
const floor = {
  id: "floor",
  center: { x: 0, y: -0.5, z: 0 },
  size: { x: 40, y: 1, z: 40 },
};
const flat: ObbyCourse = { platforms: [floor], hazards: [], checkpoints: [] };

interface Driver {
  state: ObbyState;
  time: number;
  step(options?: Partial<ObbyStepOptions> & { moveX?: number; moveY?: number }): ReturnType<typeof stepObby>;
}

function driver(
  course: ObbyCourse,
  position = { x: 0, y: 0, z: 0 },
  abilities?: ObbyAbilities,
): Driver {
  const state = createObbyState(position);
  const result: Driver = {
    state,
    time: 0,
    step(options = {}) {
      result.time += DT;
      const { moveX = 0, moveY = 0, ...rest } = options;
      return stepObby(state, { moveX, moveY }, course, {
        deltaSeconds: DT,
        timeSeconds: result.time,
        cameraYaw: 0,
        canJump: true,
        jumpPressed: false,
        radius: 0.25,
        height: 0.9,
        ...(abilities ? { abilities } : {}),
        ...rest,
      });
    },
  };
  // Settle on the ground first.
  result.step();
  return result;
}

function apexOfJump(abilities?: ObbyAbilities): number {
  const run = driver(flat, { x: 0, y: 0, z: 0 }, abilities);
  run.step({ jumpPressed: true });
  let apex = run.state.position.y;
  for (let frame = 0; frame < 120; frame += 1) {
    run.step();
    apex = Math.max(apex, run.state.position.y);
    if (run.state.grounded) break;
  }
  return apex;
}

describe("growth move ladder (DESIGN-025 D-01)", () => {
  it("derives the frozen ability set from whole recovered years", () => {
    expect(abilitiesForAge(Number.NaN)).toEqual(["jump"]);
    expect(abilitiesForAge(-3)).toEqual(["jump"]);
    expect(abilitiesForAge(0)).toEqual(["jump"]);
    expect(abilitiesForAge(1.99)).toEqual(["jump"]);
    expect(abilitiesForAge(2)).toEqual(["jump", "high-jump"]);
    expect(abilitiesForAge(3)).toEqual(["jump", "high-jump"]);
    expect(abilitiesForAge(4)).toEqual(["jump", "high-jump", "double-jump"]);
    expect(abilitiesForAge(7.9)).toEqual(["jump", "high-jump", "double-jump"]);
    expect(abilitiesForAge(8)).toEqual(["jump", "high-jump", "double-jump", "glide"]);
    expect(abilitiesForAge(40)).toEqual(["jump", "high-jump", "double-jump", "glide"]);
    expect(Object.isFrozen(abilitiesForAge(4))).toBe(true);
  });

  it("accepts only canonical ladder prefixes as stored ability sets", () => {
    for (const age of [0, 2, 4, 8]) expect(abilitySetSchema.safeParse(abilitiesForAge(age)).success).toBe(true);
    for (const invalid of [[], ["high-jump"], ["jump", "double-jump"], ["jump", "jump"], ["jump", "fly"]])
      expect(abilitySetSchema.safeParse(invalid).success).toBe(false);
  });

  it("reports newly unlocked moves and their placeholder cards", () => {
    expect(newlyUnlockedMoves(undefined, 4)).toEqual(["jump", "high-jump", "double-jump"]);
    expect(newlyUnlockedMoves(3, 4)).toEqual(["double-jump"]);
    expect(newlyUnlockedMoves(4, 7)).toEqual([]);
    expect(growthMoveCards(7, 8).map((card) => card.move)).toEqual(["glide"]);
    expect(growthMoveCards(0, 5).map((card) => card.move)).toEqual(["high-jump", "double-jump"]);
  });

  it("maps each ladder boundary to its stepObby tuning", () => {
    expect(growthMoveTuning(abilitiesForAge(0))).toEqual({ jumpVelocity: 5 });
    expect(growthMoveTuning(abilitiesForAge(2))).toEqual({ jumpVelocity: 5.9 });
    expect(growthMoveTuning(abilitiesForAge(4))).toEqual({ jumpVelocity: 5.9, airJumpVelocity: 4.6 });
    expect(growthMoveTuning(abilitiesForAge(8))).toEqual({
      jumpVelocity: 5.9,
      airJumpVelocity: 4.6,
      glideFallSpeed: 1.6,
    });
  });

  it("reaches the designed apex at every boundary", () => {
    expect(apexOfJump()).toBeCloseTo(25 / 30, 2);
    expect(apexOfJump(growthMoveTuning(abilitiesForAge(0)))).toBeCloseTo(25 / 30, 2);
    expect(apexOfJump(growthMoveTuning(abilitiesForAge(2)))).toBeCloseTo(5.9 ** 2 / 30, 2);
    expect(apexOfJump(growthMoveTuning(abilitiesForAge(4)))).toBeCloseTo(5.9 ** 2 / 30, 2);
  });

  it("keeps jump-only physics byte-identical without an ability set", () => {
    const published = authoredRoute("besties-playground-v2")!;
    const spawn = published.anchors.spawn.position;
    const scripted = (index: number) => ({
      moveX: Math.sin(index / 17),
      moveY: Math.cos(index / 29),
      jumpPressed: index % 45 === 0,
    });
    const runs = [
      undefined,
      {},
      growthMoveTuning(abilitiesForAge(0)),
    ].map((abilities) => {
      const state = createObbyState(spawn);
      const trace: string[] = [];
      for (let index = 1; index <= 600; index += 1) {
        const { moveX, moveY, jumpPressed } = scripted(index);
        const result = stepObby(state, { moveX, moveY }, published.course, {
          deltaSeconds: DT,
          timeSeconds: index * DT,
          cameraYaw: 0.3,
          canJump: true,
          jumpPressed,
          // A held Jump means nothing without the glide move.
          jumpHeld: abilities !== undefined,
          radius: 0.25,
          height: 0.9,
          tuning: { moveSpeed: 4 },
          ...(abilities ? { abilities } : {}),
        });
        trace.push(JSON.stringify([state, result]));
      }
      return trace;
    });
    expect(runs[1]).toEqual(runs[0]);
    expect(runs[2]).toEqual(runs[0]);
    expect(runs[0]!.some((entry) => entry.includes("airJumpUsed"))).toBe(false);
  });
});

describe("double jump", () => {
  const doubleJump = growthMoveTuning(abilitiesForAge(4));

  it("adds one mid-air launch per airtime and resets on landing", () => {
    const run = driver(flat, { x: 0, y: 0, z: 0 }, doubleJump);
    run.step({ jumpPressed: true });
    while (run.state.velocityY > 0) run.step();
    run.step({ jumpPressed: true });
    expect(run.state.velocityY).toBeCloseTo(GROWTH_MOVE_PHYSICS.airJumpVelocity - 15 * DT, 5);
    expect(run.state.airJumpUsed).toBe(true);
    let apex = run.state.position.y;
    // A third press in the same airtime does nothing.
    run.step();
    run.step({ jumpPressed: true });
    while (!run.state.grounded) {
      run.step();
      apex = Math.max(apex, run.state.position.y);
    }
    expect(apex).toBeCloseTo(5.9 ** 2 / 30 + 4.6 ** 2 / 30, 1);
    expect(run.state.airJumpUsed).toBe(false);
    // Landing restored it: the next airtime can double jump again.
    run.step();
    run.step({ jumpPressed: true });
    run.step();
    run.step({ jumpPressed: true });
    expect(run.state.airJumpUsed).toBe(true);
  });

  it("gives a walk-off its ordinary coyote jump first", () => {
    const ledge: ObbyCourse = {
      platforms: [{ id: "ledge", center: { x: 0, y: -0.5, z: 0 }, size: { x: 2, y: 1, z: 2 } }],
      hazards: [],
      checkpoints: [],
    };
    const run = driver(ledge, { x: 0.7, y: 0, z: 0 }, doubleJump);
    while (run.state.grounded) run.step({ moveX: 1 });
    run.step({ jumpPressed: true, moveX: 1 });
    // A coyote press is the ordinary jump; the air jump stays available.
    expect(run.state.velocityY).toBeCloseTo(5.9 - 15 * DT, 5);
    expect(run.state.airJumpUsed).not.toBe(true);
  });

  it("does nothing mid-air without the move", () => {
    const run = driver(flat, { x: 0, y: 0, z: 0 }, growthMoveTuning(abilitiesForAge(2)));
    run.step({ jumpPressed: true });
    while (run.state.velocityY > 0) run.step();
    const falling = run.state.velocityY;
    run.step({ jumpPressed: true });
    expect(run.state.velocityY).toBeLessThan(falling);
    expect(run.state.airJumpUsed).toBeUndefined();
  });
});

describe("glide", () => {
  const glide = growthMoveTuning(abilitiesForAge(8));

  it("caps the fall at 1.6 m/s only while Jump is held and falling", () => {
    const high = driver(flat, { x: 0, y: 0, z: 0 }, glide);
    high.step({ jumpPressed: true, jumpHeld: true });
    // Rising is unaffected.
    expect(high.state.velocityY).toBeGreaterThan(5);
    let minimum = 0;
    while (!high.state.grounded) {
      high.step({ jumpHeld: true });
      minimum = Math.min(minimum, high.state.velocityY);
    }
    expect(minimum).toBeGreaterThanOrEqual(-GROWTH_MOVE_PHYSICS.glideFallSpeed - 1e-9);

    const released = driver(flat, { x: 0, y: 0, z: 0 }, glide);
    released.step({ jumpPressed: true, jumpHeld: true });
    let fastest = 0;
    while (!released.state.grounded) {
      released.step();
      fastest = Math.min(fastest, released.state.velocityY);
    }
    expect(fastest).toBeLessThan(-GROWTH_MOVE_PHYSICS.glideFallSpeed * 2);
  });

  it("keeps full horizontal speed and floats further than a fall", () => {
    const tower: ObbyCourse = {
      platforms: [
        { id: "tower", center: { x: 0, y: 1.5, z: 0 }, size: { x: 2, y: 1, z: 2 } },
        floor,
      ],
      hazards: [],
      checkpoints: [],
    };
    const distance = (held: boolean) => {
      const run = driver(tower, { x: 0.8, y: 2, z: 0 }, glide);
      run.step({ jumpPressed: true, jumpHeld: held, moveX: 1 });
      while (!(run.state.grounded && run.state.supportId === "floor"))
        run.step({ jumpHeld: held, moveX: 1 });
      return run.state.position.x;
    };
    expect(distance(true)).toBeGreaterThan(distance(false) + 2);
  });

  it("ignores a held Jump without the move", () => {
    const run = driver(flat, { x: 0, y: 0, z: 0 }, growthMoveTuning(abilitiesForAge(4)));
    run.step({ jumpPressed: true, jumpHeld: true });
    let fastest = 0;
    while (!run.state.grounded) {
      run.step({ jumpHeld: true });
      fastest = Math.min(fastest, run.state.velocityY);
    }
    expect(fastest).toBeLessThan(-GROWTH_MOVE_PHYSICS.glideFallSpeed * 2);
  });
});

describe("lifts (vertical sine motion)", () => {
  const period = 8;
  const lift = {
    id: "lift",
    // Midpoint 2, amplitude 2: bottom stop top 0.2 at t=0, top stop 4.2 at t=4.
    center: { x: 0, y: 2, z: 0 },
    size: { x: 3, y: 0.4, z: 3 },
    motion: { axis: "y" as const, distance: 2, period, phase: -Math.PI / 2 },
  };
  const course: ObbyCourse = { platforms: [lift], hazards: [], checkpoints: [] };
  const liftTop = (time: number) =>
    2 + 2 * Math.sin((2 * Math.PI * time) / period - Math.PI / 2) + 0.2;

  it("carries a standing rider up and down without losing support", () => {
    const run = driver(course, { x: 0, y: 0.2, z: 0 });
    for (let frame = 0; frame < 60 * period; frame += 1) {
      run.step();
      expect(run.state.grounded).toBe(true);
      expect(run.state.supportId).toBe("lift");
      expect(run.state.position.y).toBeCloseTo(liftTop(run.time), 6);
    }
  });

  it("catches a player falling onto it while it rises", () => {
    // Drop from above as the lift climbs at full speed through mid-travel.
    const run = driver(course, { x: 0, y: 3.2, z: 0 });
    run.time = 2 - DT; // mid-travel, rising at pi m/s
    for (let frame = 0; frame < 120 && !run.state.grounded; frame += 1) run.step();
    expect(run.state.grounded).toBe(true);
    expect(run.state.supportId).toBe("lift");
    expect(run.state.position.y).toBeCloseTo(liftTop(run.time), 6);
  });
});

describe("bounce pads", () => {
  const pad = (velocity: number): ObbyCourse => ({
    platforms: [
      floor,
      { id: "pad", center: { x: 3, y: 0.1, z: 0 }, size: { x: 1.4, y: 0.2, z: 1.4 }, bounce: { velocity } },
    ],
    hazards: [],
    checkpoints: [],
  });

  it.each([
    ["small", BOUNCE_PAD_VELOCITY.small],
    ["big", BOUNCE_PAD_VELOCITY.big],
  ] as const)("launches a %s pad straight up to its apex", (_name, velocity) => {
    const run = driver(pad(velocity), { x: 3, y: 1, z: 0 });
    let launched: string | undefined;
    for (let frame = 0; frame < 60 && !launched; frame += 1) launched = run.step().bouncePadId;
    expect(launched).toBe("pad");
    expect(run.state.grounded).toBe(false);
    let apex = run.state.position.y;
    while (run.state.velocityY > 0) {
      run.step();
      apex = Math.max(apex, run.state.position.y);
    }
    expect(apex - 0.2).toBeCloseTo((velocity * velocity) / 30, 1);
    // Straight up: no horizontal drift without input.
    expect(run.state.position.x).toBeCloseTo(3, 9);
  });

  it("is a fresh airtime: no coyote or buffered jump replaces the launch, a double jump remains", () => {
    const run = driver(pad(BOUNCE_PAD_VELOCITY.small), { x: 3, y: 0.6, z: 0 }, growthMoveTuning(abilitiesForAge(4)));
    let launched = false;
    for (let frame = 0; frame < 60 && !launched; frame += 1)
      launched = Boolean(run.step({ jumpPressed: frame === 8 }).bouncePadId);
    expect(launched).toBe(true);
    expect(run.state.velocityY).toBeGreaterThan(BOUNCE_PAD_VELOCITY.small - 1);
    expect(run.state.airJumpUsed).toBe(false);
  });

  it("launches a player walking onto a flush pad", () => {
    const flush: ObbyCourse = {
      platforms: [
        { id: "deck", center: { x: 0, y: -0.5, z: 0 }, size: { x: 4, y: 1, z: 4 } },
        { id: "pad", center: { x: 2.7, y: -0.5, z: 0 }, size: { x: 1.4, y: 1, z: 1.4 }, bounce: { velocity: 7.5 } },
      ],
      hazards: [],
      checkpoints: [],
    };
    const run = driver(flush, { x: 1, y: 0, z: 0 });
    let launched: string | undefined;
    for (let frame = 0; frame < 120 && !launched; frame += 1) launched = run.step({ moveX: 1 }).bouncePadId;
    expect(launched).toBe("pad");
  });
});

describe("runtime growth hook and visual growth (D-02)", () => {
  const active = (overrides: Record<string, unknown> = {}) => ({
    adventure: { activeLevel: { id: "level", startAgeYears: 4, ...overrides } },
  }) as never;

  it("keeps older routes jump-only and derives v4 moves from the start age", () => {
    expect(levelGrowth(active(), { authored: { schemaVersion: "authored-level-v3" } } as never)).toBeNull();
    expect(levelGrowth(active(), { authored: undefined } as never)).toBeNull();
    expect(
      levelGrowth(active(), { authored: { schemaVersion: "authored-level-v4" } } as never)?.abilities,
    ).toEqual(["jump", "high-jump", "double-jump"]);
  });

  it("reads a family plan's frozen ability list, ignoring non-move names", () => {
    const growth = levelGrowth(
      active({ growthMoves: ["move", "interact", "jump", "high-jump", "double-jump"] }),
      { authored: { schemaVersion: "authored-level-v4" } } as never,
    );
    expect(growth?.abilities).toEqual(["jump", "high-jump", "double-jump"]);
    expect(levelGrowth(active({ growthMoves: [] }), { authored: undefined } as never)?.abilities).toEqual(["jump"]);
  });

  it("prefers a plan's frozen growthMoves on any route", () => {
    const growth = levelGrowth(active({ growthMoves: ["jump", "high-jump"] }), {
      authored: { schemaVersion: "authored-level-v3" },
    } as never);
    expect(growth?.abilities).toEqual(["jump", "high-jump"]);
    expect(growth?.tuning).toEqual({ jumpVelocity: 5.9 });
  });

  it("scales the avatar visual and camera by age", () => {
    expect(growthVisualScale(0)).toBeCloseTo(0.72, 10);
    expect(growthVisualScale(4)).toBeCloseTo(0.88, 10);
    expect(growthVisualScale(11)).toBeCloseTo(1.16, 10);
    expect(growthVisualScale(30)).toBeCloseTo(1.16, 10);
    expect(growthCameraScale(growthVisualScale(0))).toBeCloseTo(0.972, 10);
  });
});
