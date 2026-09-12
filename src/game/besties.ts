import type { PositionSnapshot } from "./types";

export type BestieActorId = "bestie-pink" | "bestie-black";
export type BestiesLaneSide = "left" | "right";
export type BestiesRoutinePhase =
  | "pink-warning"
  | "pink-trick"
  | "black-warning"
  | "black-trick"
  | "high-five"
  | "dizzy";
export type BestiesPhase = "inactive" | BestiesRoutinePhase | "defeated";

export type BestiesClipName =
  | "idle"
  | "move"
  | "attack"
  | "hit"
  | "defeat"
  | "cheer"
  | "high-five"
  | "dizzy";

export const bestiesRequiredClipNames = [
  "idle",
  "move",
  "attack",
  "hit",
  "defeat",
  "cheer",
  "high-five",
  "dizzy",
] as const satisfies readonly BestiesClipName[];

export const BESTIES_PHASE_SECONDS = Object.freeze({
  "pink-warning": 1.2,
  "pink-trick": 2,
  "black-warning": 1.2,
  "black-trick": 2,
  "high-five": 1.6,
  dizzy: 5,
} satisfies Record<BestiesRoutinePhase, number>);

export const BESTIES_CYCLE_SECONDS = 13;
export const BESTIES_PLAYER_RADIUS = 0.3;
export const BESTIES_MAX_STEP_SECONDS = 0.1;
export const BESTIES_ARENA_CENTER = Object.freeze({ x: 0, y: 0, z: -22 });

export interface BestiesActorFrame {
  id: BestieActorId;
  /** Local to the resolved arena origin. The scene owns translation and facing. */
  offset: PositionSnapshot;
  clip: BestiesClipName;
}

interface BestiesHazardBase {
  id: "besties-pink-foam-bar" | "besties-black-floor-lane";
  center: PositionSnapshot;
  halfExtents: PositionSnapshot;
  /** Warnings use the same geometry with damage disabled. */
  damaging: boolean;
}

export interface BestiesFoamBarFrame extends BestiesHazardBase {
  id: "besties-pink-foam-bar";
  kind: "foam-bar";
  sweep: {
    from: PositionSnapshot;
    to: PositionSnapshot;
  };
}

export interface BestiesFloorLaneFrame extends BestiesHazardBase {
  id: "besties-black-floor-lane";
  kind: "floor-lane";
  side: BestiesLaneSide;
}

export type BestiesHazardFrame = BestiesFoamBarFrame | BestiesFloorLaneFrame;

export interface BestiesFrame {
  /** World origin for an authored encounter; absent for the archived arena. */
  arenaOrigin?: PositionSnapshot;
  phase: BestiesPhase;
  activeActor: BestieActorId | null;
  vulnerable: boolean;
  phaseProgress: number;
  cycleIndex: number;
  /** The lane Black will use later in this cycle. */
  blackLaneSide: BestiesLaneSide;
  actors: readonly [BestiesActorFrame, BestiesActorFrame];
  hazards: readonly BestiesHazardFrame[];
}

/** Rendering, aiming and hit range resolve the same moving actor anchors. */
export function bestiesActorOffset(
  frame: BestiesFrame,
  actor: BestiesActorFrame,
): PositionSnapshot {
  const result = { ...actor.offset };
  const side = actor.id === "bestie-pink" ? 1 : -1;
  if (frame.phase === "high-five") {
    const amount =
      frame.phaseProgress <= 0.625
        ? frame.phaseProgress / 0.625
        : (1 - frame.phaseProgress) / 0.375;
    result.x -= side * Math.sin((Math.PI / 2) * amount) * 0.8;
  } else if (frame.activeActor === actor.id) {
    // Step into the trick, then return before the shared high-five.
    result.z +=
      0.45 *
      (frame.phase.endsWith("warning")
        ? frame.phaseProgress
        : 1 - frame.phaseProgress);
  }
  return result;
}

export function nearestBestiesActor(
  frame: BestiesFrame,
  player: PositionSnapshot,
): {
  id: BestieActorId;
  position: PositionSnapshot;
} {
  const origin = frame.arenaOrigin ?? BESTIES_ARENA_CENTER;
  return frame.actors
    .map((actor) => {
      const offset = bestiesActorOffset(frame, actor);
      return {
        id: actor.id,
        position: {
          x: origin.x + offset.x,
          y: origin.y + offset.y,
          z: origin.z + offset.z,
        },
      };
    })
    .sort((a, b) => {
      const difference =
        Math.hypot(a.position.x - player.x, a.position.z - player.z) -
        Math.hypot(b.position.x - player.x, b.position.z - player.z);
      // Keep center-line ties stable when an authored origin changes rounding.
      return Math.abs(difference) < 0.000001 ? 0 : difference;
    })[0]!;
}

export interface BestiesStepOptions {
  player: PositionSnapshot;
  deltaSeconds: number;
  active: boolean;
  paused?: boolean;
  /** One authoritative encounter flag defeats both visible actors. */
  defeated: boolean;
  /** New route playtests aim each warning once; archived encounters retain their geometry. */
  aimAtPlayer?: boolean;
}

export interface BestiesStepResult {
  frame: BestiesFrame;
  /** A one-step contact edge; at most one is emitted during either trick. */
  hit: boolean;
  hitBy: BestieActorId | null;
  /** A one-step phase edge, including activation, deactivation and defeat. */
  phaseEntered: BestiesPhase | null;
}

interface BestiesState {
  phase: BestiesPhase;
  phaseSeconds: number;
  cycleIndex: number;
  blackLaneSide: BestiesLaneSide;
  contactedDuringTrick: boolean;
  aimed: boolean;
  pinkZ: number;
  blackX: number;
}

const pinkActorOffset = Object.freeze({ x: 1.25, y: 0, z: 0 });
const blackActorOffset = Object.freeze({ x: -1.25, y: 0, z: 0 });
const pinkSweepFrom = Object.freeze({ x: -2.7, y: 0.2, z: -20.4 });
const pinkSweepTo = Object.freeze({ x: 2.7, y: 0.2, z: -20.4 });
const foamHalfExtents = Object.freeze({ x: 0.3, y: 0.2, z: 1.35 });
const laneHalfExtents = Object.freeze({ x: 2.25, y: 0.03, z: 3.75 });
const phaseEpsilon = 0.000000001;
const minimumFightHeight = -0.000001;
const maximumContactFeetHeight = 0.35;

function inactiveState(): BestiesState {
  return {
    phase: "inactive",
    phaseSeconds: 0,
    cycleIndex: 0,
    blackLaneSide: "left",
    aimed: false,
    pinkZ: -20.4,
    blackX: -3.75,
    contactedDuringTrick: false,
  };
}

function openingState(): BestiesState {
  return {
    ...inactiveState(),
    phase: "pink-warning",
  };
}

function copyPosition(position: PositionSnapshot): PositionSnapshot {
  return { x: position.x, y: position.y, z: position.z };
}

function phaseDuration(phase: BestiesPhase): number | null {
  return phase === "inactive" || phase === "defeated"
    ? null
    : BESTIES_PHASE_SECONDS[phase];
}

function phaseActor(phase: BestiesPhase): BestieActorId | null {
  if (phase === "pink-warning" || phase === "pink-trick") {
    return "bestie-pink";
  }
  if (phase === "black-warning" || phase === "black-trick") {
    return "bestie-black";
  }
  return null;
}

function actorClips(
  phase: BestiesPhase,
): readonly [BestiesActorFrame, BestiesActorFrame] {
  let pink: BestiesClipName = "idle";
  let black: BestiesClipName = "idle";
  if (phase === "pink-warning" || phase === "pink-trick") {
    pink = "attack";
    black = "cheer";
  } else if (phase === "black-warning" || phase === "black-trick") {
    pink = "cheer";
    black = "attack";
  } else if (phase === "high-five") {
    pink = "high-five";
    black = "high-five";
  } else if (phase === "dizzy") {
    pink = "dizzy";
    black = "dizzy";
  } else if (phase === "defeated") {
    pink = "defeat";
    black = "defeat";
  }
  return [
    {
      id: "bestie-pink",
      offset: copyPosition(pinkActorOffset),
      clip: pink,
    },
    {
      id: "bestie-black",
      offset: copyPosition(blackActorOffset),
      clip: black,
    },
  ];
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function pinkBarAt(
  progress: number,
  damaging: boolean,
  state?: BestiesState,
): BestiesFoamBarFrame {
  const amount = clampUnit(progress);
  const from = state?.aimed
    ? { ...pinkSweepFrom, x: -5.4, z: state.pinkZ }
    : pinkSweepFrom;
  const to = state?.aimed
    ? { ...pinkSweepTo, x: 5.4, z: state.pinkZ }
    : pinkSweepTo;
  return {
    id: "besties-pink-foam-bar",
    kind: "foam-bar",
    center: {
      x: from.x + (to.x - from.x) * amount,
      y: from.y,
      z: from.z,
    },
    halfExtents: copyPosition(foamHalfExtents),
    sweep: {
      from: copyPosition(from),
      to: copyPosition(to),
    },
    damaging,
  };
}

function blackLaneAt(
  side: BestiesLaneSide,
  damaging: boolean,
  state?: BestiesState,
): BestiesFloorLaneFrame {
  return {
    id: "besties-black-floor-lane",
    kind: "floor-lane",
    side,
    center: {
      x: state?.aimed ? state.blackX : side === "left" ? -3.75 : 3.75,
      y: 0.03,
      z: -22.75,
    },
    halfExtents: copyPosition(laneHalfExtents),
    damaging,
  };
}

function hazardsFor(state: BestiesState): readonly BestiesHazardFrame[] {
  if (state.phase === "pink-warning") return [pinkBarAt(0, false, state)];
  if (state.phase === "pink-trick") {
    return [
      pinkBarAt(
        state.phaseSeconds / BESTIES_PHASE_SECONDS["pink-trick"],
        true,
        state,
      ),
    ];
  }
  if (state.phase === "black-warning") {
    return [blackLaneAt(state.blackLaneSide, false, state)];
  }
  if (state.phase === "black-trick") {
    return [blackLaneAt(state.blackLaneSide, true, state)];
  }
  return [];
}

function makeFrame(state: BestiesState): BestiesFrame {
  const duration = phaseDuration(state.phase);
  return {
    phase: state.phase,
    activeActor: phaseActor(state.phase),
    vulnerable: state.phase === "dizzy",
    phaseProgress:
      duration === null ? 0 : clampUnit(state.phaseSeconds / duration),
    cycleIndex: state.cycleIndex,
    blackLaneSide: state.blackLaneSide,
    actors: actorClips(state.phase),
    hazards: hazardsFor(state),
  };
}

function sanitizedDelta(deltaSeconds: number): number {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return 0;
  return Math.min(BESTIES_MAX_STEP_SECONDS, deltaSeconds);
}

function playerCanContact(player: PositionSnapshot): boolean {
  return (
    Number.isFinite(player.x) &&
    Number.isFinite(player.y) &&
    Number.isFinite(player.z) &&
    player.y >= minimumFightHeight &&
    player.y <= maximumContactFeetHeight
  );
}

function intersectsExpandedBox(
  player: PositionSnapshot,
  center: PositionSnapshot,
  halfExtents: PositionSnapshot,
): boolean {
  return (
    Math.abs(player.x - center.x) <= halfExtents.x + BESTIES_PLAYER_RADIUS &&
    Math.abs(player.z - center.z) <= halfExtents.z + BESTIES_PLAYER_RADIUS
  );
}

function contactsDuringSegment(
  state: BestiesState,
  player: PositionSnapshot,
  startSeconds: number,
  endSeconds: number,
): BestieActorId | null {
  if (state.contactedDuringTrick || !playerCanContact(player)) return null;
  if (state.phase === "black-trick") {
    const lane = blackLaneAt(state.blackLaneSide, true, state);
    return intersectsExpandedBox(player, lane.center, lane.halfExtents)
      ? "bestie-black"
      : null;
  }
  if (state.phase !== "pink-trick" || endSeconds <= startSeconds) return null;

  const duration = BESTIES_PHASE_SECONDS["pink-trick"];
  const start = pinkBarAt(startSeconds / duration, true, state);
  const end = pinkBarAt(endSeconds / duration, true, state);
  const sweptCenter = {
    x: (start.center.x + end.center.x) / 2,
    y: start.center.y,
    z: start.center.z,
  };
  const sweptHalfExtents = {
    x: Math.abs(end.center.x - start.center.x) / 2 + foamHalfExtents.x,
    y: foamHalfExtents.y,
    z: foamHalfExtents.z,
  };
  return intersectsExpandedBox(player, sweptCenter, sweptHalfExtents)
    ? "bestie-pink"
    : null;
}

function nextPhase(state: BestiesState): BestiesState {
  switch (state.phase) {
    case "pink-warning":
      return { ...state, phase: "pink-trick" };
    case "pink-trick":
      return {
        ...state,
        phase: "black-warning",
        contactedDuringTrick: false,
      };
    case "black-warning":
      return { ...state, phase: "black-trick" };
    case "black-trick":
      return { ...state, phase: "high-five", contactedDuringTrick: false };
    case "high-five":
      return { ...state, phase: "dizzy", contactedDuringTrick: false };
    case "dizzy":
      return {
        ...state,
        phase: "pink-warning",
        cycleIndex: state.cycleIndex + 1,
        blackLaneSide: state.blackLaneSide === "left" ? "right" : "left",
        contactedDuringTrick: false,
      };
    case "inactive":
    case "defeated":
      return state;
  }
}

/**
 * Deterministic, rendering-independent routine for the duo's single boss gate.
 * It reports contact edges but never changes health, rewards or victory state.
 */
export class BestiesSimulation {
  private state: BestiesState = inactiveState();
  private readonly origin?: PositionSnapshot;

  constructor(origin?: PositionSnapshot) {
    if (origin && !Object.values(origin).every(Number.isFinite)) {
      throw new RangeError("Besties origin must be finite");
    }
    this.origin = origin ? { ...origin } : undefined;
  }

  frame(): BestiesFrame {
    const frame = makeFrame(this.state);
    if (!this.origin) return frame;
    const origin = this.origin;
    const translate = (point: PositionSnapshot): PositionSnapshot => ({
      x: point.x + origin.x - BESTIES_ARENA_CENTER.x,
      y: point.y + origin.y - BESTIES_ARENA_CENTER.y,
      z: point.z + origin.z - BESTIES_ARENA_CENTER.z,
    });
    return {
      ...frame,
      arenaOrigin: { ...origin },
      hazards: frame.hazards.map((hazard) => ({
        ...hazard,
        center: translate(hazard.center),
        ...(hazard.kind === "foam-bar"
          ? {
              sweep: {
                from: translate(hazard.sweep.from),
                to: translate(hazard.sweep.to),
              },
            }
          : {}),
      })),
    };
  }

  /**
   * Restarts an in-progress obstacle with its full harmless warning.
   * A contact already charged by that obstacle remains consumed after recovery.
   */
  restartThreatenedTrick(): void {
    const warning =
      this.state.phase === "pink-warning" || this.state.phase === "pink-trick"
        ? "pink-warning"
        : this.state.phase === "black-warning" ||
            this.state.phase === "black-trick"
          ? "black-warning"
          : null;
    if (warning === null) return;
    this.state = { ...this.state, phase: warning, phaseSeconds: 0 };
  }

  step(options: BestiesStepOptions): BestiesStepResult {
    // Preserve the tested routine in its original local frame. Both observed
    // geometry and targeting translate through the same authored origin.
    if (this.origin) {
      options = {
        ...options,
        player: {
          x: options.player.x - this.origin.x + BESTIES_ARENA_CENTER.x,
          y: options.player.y - this.origin.y + BESTIES_ARENA_CENTER.y,
          z: options.player.z - this.origin.z + BESTIES_ARENA_CENTER.z,
        },
      };
    }
    // Victory disables combat in the same authoritative update. Defeat must
    // still reach the renderer instead of resetting both actors to idle.
    if (options.defeated) {
      const changed = this.state.phase !== "defeated";
      this.state = {
        ...this.state,
        phase: "defeated",
        phaseSeconds: 0,
        contactedDuringTrick: false,
      };
      return this.result(null, changed ? "defeated" : null);
    }

    if (!options.active) {
      const changed = this.state.phase !== "inactive";
      this.state = inactiveState();
      return this.result(null, changed ? "inactive" : null);
    }

    let phaseEntered: BestiesPhase | null = null;
    if (this.state.phase === "inactive" || this.state.phase === "defeated") {
      this.state = openingState();
      this.aimWarning(options);
      phaseEntered = "pink-warning";
    }
    if (options.paused) return this.result(null, phaseEntered);

    let remaining = sanitizedDelta(options.deltaSeconds);
    let hitBy: BestieActorId | null = null;
    while (remaining > phaseEpsilon) {
      const duration = phaseDuration(this.state.phase);
      if (duration === null) break;
      const available = Math.max(0, duration - this.state.phaseSeconds);
      const segment = Math.min(remaining, available);
      const segmentEnd = this.state.phaseSeconds + segment;
      const contact = contactsDuringSegment(
        this.state,
        options.player,
        this.state.phaseSeconds,
        segmentEnd,
      );
      if (contact) {
        hitBy = contact;
        this.state = { ...this.state, contactedDuringTrick: true };
      }
      this.state = { ...this.state, phaseSeconds: segmentEnd };
      remaining -= segment;

      if (duration - this.state.phaseSeconds > phaseEpsilon) break;
      this.state = { ...nextPhase(this.state), phaseSeconds: 0 };
      this.aimWarning(options);
      phaseEntered = this.state.phase;
    }

    return this.result(hitBy, phaseEntered);
  }

  private aimWarning(options: BestiesStepOptions): void {
    if (!options.aimAtPlayer) return;
    this.state.aimed = true;
    if (
      this.state.phase === "pink-warning" &&
      Number.isFinite(options.player.z)
    )
      this.state.pinkZ = Math.max(-23.5, Math.min(-19.5, options.player.z));
    if (
      this.state.phase === "black-warning" &&
      Number.isFinite(options.player.x)
    ) {
      this.state.blackX = Math.max(-3.75, Math.min(3.75, options.player.x));
      this.state.blackLaneSide = this.state.blackX < 0 ? "left" : "right";
    }
  }

  private result(
    hitBy: BestieActorId | null,
    phaseEntered: BestiesPhase | null,
  ): BestiesStepResult {
    return {
      frame: this.frame(),
      hit: hitBy !== null,
      hitBy,
      phaseEntered,
    };
  }
}
