import { describe, expect, it } from "vitest";
import {
  MAX_FOREGROUND_FRAME_SECONDS,
  MAX_SIMULATION_STEP_SECONDS,
  foregroundSimulationSteps,
} from "../../src/game/frame-step";

describe("foreground frame stepping", () => {
  it("preserves a 10 fps foreground frame through bounded physics slices", () => {
    const steps = foregroundSimulationSteps(0.1, true);
    expect(steps).toEqual([0.05, 0.05]);
    expect(steps.reduce((total, step) => total + step, 0)).toBeCloseTo(0.1, 9);
    expect(steps.every((step) => step <= MAX_SIMULATION_STEP_SECONDS)).toBe(true);
  });

  it("discards stall excess and never catches up an inactive frame", () => {
    const bounded = foregroundSimulationSteps(2, true);
    expect(bounded.reduce((total, step) => total + step, 0))
      .toBeCloseTo(MAX_FOREGROUND_FRAME_SECONDS, 9);
    expect(foregroundSimulationSteps(2, false)).toEqual([]);
  });
});
