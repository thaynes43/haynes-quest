export const MAX_FOREGROUND_FRAME_SECONDS = 0.2;
export const MAX_SIMULATION_STEP_SECONDS = 0.05;

/**
 * Keep short low-frame-rate gaps faithful to wall time while bounding physics
 * work after a stall. Callers pass `active=false` on pause/background/resume so
 * those gaps never become catch-up movement.
 */
export function foregroundSimulationSteps(
  rawDeltaSeconds: number,
  active: boolean,
): number[] {
  if (!active || !Number.isFinite(rawDeltaSeconds) || rawDeltaSeconds <= 0) {
    return [];
  }
  let remaining = Math.min(rawDeltaSeconds, MAX_FOREGROUND_FRAME_SECONDS);
  const steps: number[] = [];
  while (remaining > 0.000_000_1) {
    const step = Math.min(remaining, MAX_SIMULATION_STEP_SECONDS);
    steps.push(step);
    remaining -= step;
  }
  return steps;
}
