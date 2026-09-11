import { describe, expect, it } from "vitest";
import {
  BESTIES_CYCLE_SECONDS,
  BESTIES_PHASE_SECONDS,
  BestiesSimulation,
  bestiesRequiredClipNames,
  type BestiesFrame,
  type BestiesPhase,
  type BestiesStepResult,
} from "../../src/game/besties";

const safePlayer = { x: 4.5, y: 0, z: -26 };

function advance(
  simulation: BestiesSimulation,
  seconds: number,
  player = safePlayer,
): BestiesStepResult {
  let result = simulation.step({
    player,
    deltaSeconds: 0,
    active: true,
    defeated: false,
  });
  let remaining = seconds;
  while (remaining > 0.0000001) {
    const deltaSeconds = Math.min(0.1, remaining);
    result = simulation.step({
      player,
      deltaSeconds,
      active: true,
      defeated: false,
    });
    remaining -= deltaSeconds;
  }
  return result;
}

function advanceTo(
  simulation: BestiesSimulation,
  phase: BestiesPhase,
): BestiesFrame {
  for (let frame = 0; frame < 300; frame += 1) {
    const result = advance(simulation, 0.05);
    if (result.frame.phase === phase) return result.frame;
  }
  throw new Error(`Besties routine did not reach ${phase}`);
}

function hitsWhileAdvancing(
  simulation: BestiesSimulation,
  seconds: number,
  player: { x: number; y: number; z: number },
): BestiesStepResult[] {
  const hits: BestiesStepResult[] = [];
  let remaining = seconds;
  while (remaining > 0.0000001) {
    const result = simulation.step({
      player,
      deltaSeconds: Math.min(0.1, remaining),
      active: true,
      defeated: false,
    });
    if (result.hit) hits.push(result);
    remaining -= Math.min(0.1, remaining);
  }
  return hits;
}

describe("BestiesSimulation", () => {
  it("opens with a harmless pink telegraph and assigns one attacking actor", () => {
    const simulation = new BestiesSimulation();
    expect(simulation.frame()).toMatchObject({
      phase: "inactive",
      activeActor: null,
      vulnerable: false,
      hazards: [],
    });

    const opening = simulation.step({
      player: { x: -2.7, y: 0, z: -20.4 },
      deltaSeconds: 0,
      active: true,
      defeated: false,
    });
    expect(opening).toMatchObject({
      hit: false,
      hitBy: null,
      phaseEntered: "pink-warning",
      frame: {
        phase: "pink-warning",
        activeActor: "bestie-pink",
        vulnerable: false,
        phaseProgress: 0,
      },
    });
    expect(opening.frame.hazards[0]).toMatchObject({
      kind: "foam-bar",
      damaging: false,
      center: { x: -2.7, y: 0.2, z: -20.4 },
    });
    expect(opening.frame.actors.map(({ id, clip }) => ({ id, clip }))).toEqual([
      { id: "bestie-pink", clip: "attack" },
      { id: "bestie-black", clip: "cheer" },
    ]);
    expect(
      simulation.step({
        player: { x: -2.7, y: 0, z: -20.4 },
        deltaSeconds: 0.1,
        active: true,
        defeated: false,
      }),
    ).toMatchObject({ hit: false, phaseEntered: null });
  });

  it("emits one contact edge per damaging trick", () => {
    const pink = new BestiesSimulation();
    advanceTo(pink, "pink-trick");
    const pinkContact = { x: -2.65, y: 0, z: -20.4 };
    expect(advance(pink, 0.05, pinkContact)).toMatchObject({
      hit: true,
      hitBy: "bestie-pink",
    });
    expect(advance(pink, 0.5, pinkContact)).toMatchObject({
      hit: false,
      hitBy: null,
    });

    const black = new BestiesSimulation();
    const warning = advanceTo(black, "black-warning");
    expect(warning.hazards[0]).toMatchObject({
      kind: "floor-lane",
      side: "left",
      damaging: false,
    });
    expect(advance(black, 0.1, { x: -3.75, y: 0, z: -22.75 }).hit).toBe(false);
    advanceTo(black, "black-trick");
    const first = advance(black, 0.05, { x: -3.75, y: 0, z: -22.75 });
    expect(first).toMatchObject({ hit: true, hitBy: "bestie-black" });
    expect(advance(black, 0.5, { x: -3.75, y: 0, z: -22.75 }).hit).toBe(false);
  });

  it("leaves a broad lane clear and lets jumps or island falls avoid contact", () => {
    const safeLane = new BestiesSimulation();
    advanceTo(safeLane, "black-trick");
    expect(advance(safeLane, 0.5, { x: 3, y: 0, z: -22.75 }).hit).toBe(false);

    for (const y of [0.351, -0.01]) {
      const jumping = new BestiesSimulation();
      advanceTo(jumping, "pink-trick");
      expect(advance(jumping, 0.1, { x: -2.55, y, z: -20.4 }).hit).toBe(false);
    }
  });

  it("runs the 13-second cycle, exposes only dizzy, and alternates Black's lane", () => {
    expect(
      Object.values(BESTIES_PHASE_SECONDS).reduce((a, b) => a + b, 0),
    ).toBe(BESTIES_CYCLE_SECONDS);
    const simulation = new BestiesSimulation();
    simulation.step({
      player: safePlayer,
      deltaSeconds: 0,
      active: true,
      defeated: false,
    });

    expect(advance(simulation, 1.2).frame.phase).toBe("pink-trick");
    expect(advance(simulation, 2).frame.phase).toBe("black-warning");
    expect(advance(simulation, 1.2).frame).toMatchObject({
      phase: "black-trick",
      activeActor: "bestie-black",
      vulnerable: false,
    });
    expect(advance(simulation, 2).frame).toMatchObject({
      phase: "high-five",
      activeActor: null,
      actors: [{ clip: "high-five" }, { clip: "high-five" }],
      hazards: [],
    });
    expect(advance(simulation, 1.6).frame).toMatchObject({
      phase: "dizzy",
      vulnerable: true,
      actors: [{ clip: "dizzy" }, { clip: "dizzy" }],
      hazards: [],
    });
    expect(advance(simulation, 5).frame).toMatchObject({
      phase: "pink-warning",
      vulnerable: false,
      cycleIndex: 1,
      blackLaneSide: "right",
    });
    const nextBlackWarning = advance(simulation, 3.2).frame;
    expect(nextBlackWarning.hazards[0]).toMatchObject({
      kind: "floor-lane",
      side: "right",
      damaging: false,
    });
  });

  it("freezes while paused and resets to a full warning after deactivation", () => {
    const simulation = new BestiesSimulation();
    advance(simulation, 0.45);
    const beforePause = simulation.frame();
    const paused = simulation.step({
      player: safePlayer,
      deltaSeconds: 99,
      active: true,
      paused: true,
      defeated: false,
    });
    expect(paused).toEqual({
      frame: beforePause,
      hit: false,
      hitBy: null,
      phaseEntered: null,
    });

    expect(
      simulation.step({
        player: safePlayer,
        deltaSeconds: 0.1,
        active: false,
        defeated: false,
      }),
    ).toMatchObject({
      hit: false,
      phaseEntered: "inactive",
      frame: { phase: "inactive", hazards: [] },
    });
    const restarted = simulation.step({
      player: safePlayer,
      deltaSeconds: 0,
      active: true,
      defeated: false,
    });
    expect(restarted).toMatchObject({
      phaseEntered: "pink-warning",
      frame: { phase: "pink-warning", phaseProgress: 0, cycleIndex: 0 },
    });
  });

  it.each([
    {
      sourcePhase: "pink-warning" as const,
      trick: "pink-trick" as const,
      warning: "pink-warning" as const,
      warningSeconds: BESTIES_PHASE_SECONDS["pink-warning"],
      priorCycles: 0,
    },
    {
      sourcePhase: "pink-trick" as const,
      trick: "pink-trick" as const,
      warning: "pink-warning" as const,
      warningSeconds: BESTIES_PHASE_SECONDS["pink-warning"],
      priorCycles: 0,
    },
    {
      sourcePhase: "black-warning" as const,
      trick: "black-trick" as const,
      warning: "black-warning" as const,
      warningSeconds: BESTIES_PHASE_SECONDS["black-warning"],
      priorCycles: 1,
    },
    {
      sourcePhase: "black-trick" as const,
      trick: "black-trick" as const,
      warning: "black-warning" as const,
      warningSeconds: BESTIES_PHASE_SECONDS["black-warning"],
      priorCycles: 1,
    },
  ])(
    "restarts $sourcePhase at a full warning and preserves its cycle and lane",
    ({ sourcePhase, trick, warning, warningSeconds, priorCycles }) => {
      const simulation = new BestiesSimulation();
      if (priorCycles > 0) advance(simulation, BESTIES_CYCLE_SECONDS);
      advanceTo(simulation, sourcePhase);
      advance(simulation, 0.35);
      const beforeRestart = simulation.frame();

      simulation.restartThreatenedTrick();
      expect(simulation.frame()).toMatchObject({
        phase: warning,
        phaseProgress: 0,
        cycleIndex: beforeRestart.cycleIndex,
        blackLaneSide: beforeRestart.blackLaneSide,
        hazards: [{ damaging: false }],
      });

      const paused = simulation.step({
        player: safePlayer,
        deltaSeconds: 99,
        active: true,
        paused: true,
        defeated: false,
      });
      expect(paused).toMatchObject({
        hit: false,
        phaseEntered: null,
        frame: { phase: warning, phaseProgress: 0 },
      });

      expect(advance(simulation, warningSeconds - 0.05).frame.phase).toBe(
        warning,
      );
      expect(advance(simulation, 0.05)).toMatchObject({
        hit: false,
        phaseEntered: trick,
        frame: { phase: trick, phaseProgress: 0 },
      });
    },
  );

  it.each([
    {
      trick: "pink-trick" as const,
      actor: "bestie-pink" as const,
      contact: { x: -2.65, y: 0, z: -20.4 },
      retrySeconds:
        BESTIES_PHASE_SECONDS["pink-warning"] +
        BESTIES_PHASE_SECONDS["pink-trick"],
    },
    {
      trick: "black-trick" as const,
      actor: "bestie-black" as const,
      contact: { x: -3.75, y: 0, z: -22.75 },
      retrySeconds:
        BESTIES_PHASE_SECONDS["black-warning"] +
        BESTIES_PHASE_SECONDS["black-trick"],
    },
  ])(
    "does not emit a second $actor hit when its contacted $trick is retried",
    ({ trick, actor, contact, retrySeconds }) => {
      const simulation = new BestiesSimulation();
      advanceTo(simulation, trick);
      expect(advance(simulation, 0.05, contact)).toMatchObject({
        hit: true,
        hitBy: actor,
      });

      simulation.restartThreatenedTrick();
      expect(hitsWhileAdvancing(simulation, retrySeconds, contact)).toEqual([]);
    },
  );

  it.each(["inactive", "high-five", "dizzy", "defeated"] as const)(
    "leaves the %s phase unchanged when no trick is threatening",
    (phase) => {
      const simulation = new BestiesSimulation();
      if (phase === "defeated") {
        simulation.step({
          player: safePlayer,
          deltaSeconds: 0,
          active: true,
          defeated: true,
        });
      } else if (phase !== "inactive") {
        advanceTo(simulation, phase);
        advance(simulation, 0.25);
      }
      const beforeRestart = simulation.frame();

      simulation.restartThreatenedTrick();

      expect(simulation.frame()).toEqual(beforeRestart);
    },
  );

  it("uses one defeat flag for both actors and emits no repeat edge", () => {
    const simulation = new BestiesSimulation();
    advanceTo(simulation, "dizzy");
    const defeated = simulation.step({
      player: safePlayer,
      deltaSeconds: 0.1,
      active: true,
      defeated: true,
    });
    expect(defeated).toMatchObject({
      hit: false,
      hitBy: null,
      phaseEntered: "defeated",
      frame: {
        phase: "defeated",
        vulnerable: false,
        activeActor: null,
        actors: [{ clip: "defeat" }, { clip: "defeat" }],
        hazards: [],
      },
    });
    expect(
      simulation.step({
        player: safePlayer,
        deltaSeconds: 1,
        active: true,
        defeated: true,
      }).phaseEntered,
    ).toBeNull();
  });

  it("bounds elapsed time and keeps all public geometry finite", () => {
    const simulation = new BestiesSimulation();
    const activated = simulation.step({
      player: safePlayer,
      deltaSeconds: Number.POSITIVE_INFINITY,
      active: true,
      defeated: false,
    });
    expect(activated.frame.phaseProgress).toBe(0);
    expect(
      simulation.step({
        player: { x: Number.NaN, y: Number.NaN, z: Number.NaN },
        deltaSeconds: 1e100,
        active: true,
        defeated: false,
      }),
    ).toMatchObject({ hit: false, frame: { phaseProgress: 0.1 / 1.2 } });

    const frame = simulation.frame();
    for (const actor of frame.actors) {
      expect(Object.values(actor.offset).every(Number.isFinite)).toBe(true);
    }
    for (const hazard of frame.hazards) {
      expect(Object.values(hazard.center).every(Number.isFinite)).toBe(true);
      expect(Object.values(hazard.halfExtents).every(Number.isFinite)).toBe(
        true,
      );
    }
    expect(new Set(bestiesRequiredClipNames)).toEqual(
      new Set([
        "idle",
        "move",
        "attack",
        "hit",
        "defeat",
        "cheer",
        "high-five",
        "dizzy",
      ]),
    );
  });
});
