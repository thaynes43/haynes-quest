import type { GameInputSnapshot, PositionSnapshot } from "./types";

/**
 * Pure obstacle-course movement core (WO-024, DESIGN-011).
 *
 * This module owns nothing but numbers: it samples authored course geometry at
 * a caller-supplied game clock, moves a foot-positioned player capsule through
 * it, and reports local recoveries and checkpoint changes. It never touches
 * saves, network, DOM or rendering. The caller owns the clock, the course
 * layout, the avatar radius/height and the decision to create a fresh state on
 * level change.
 */

// ---------------------------------------------------------------------------
// Course definition
// ---------------------------------------------------------------------------

/** Sinusoidal translation along one horizontal axis: offset = distance * sin(2π t / period + phase). */
export interface ObbyMotion {
  axis: "x" | "z";
  /** Amplitude in metres. */
  distance: number;
  /** Seconds per full cycle. Non-positive or non-finite disables the motion. */
  period: number;
  /** Radians. */
  phase?: number;
}

/** Constant rotation around the vertical axis: angle = phase + 2π t / period. */
export interface ObbyRotation {
  /** Seconds per full turn. Non-positive or non-finite freezes the hazard at `phase`. */
  period: number;
  /** Radians. */
  phase?: number;
}

/** A finite solid axis-aligned box. `center` is the box centre, `size` the full extents. */
export interface ObbyPlatform {
  id: string;
  center: PositionSnapshot;
  size: PositionSnapshot;
  motion?: ObbyMotion;
}

/**
 * A horizontal capsule (a soft sweeping bar) lying along local X through
 * `center`, rotated around Y by the sampled rotation angle.
 */
export interface ObbyHazard {
  id: string;
  center: PositionSnapshot;
  halfLength: number;
  radius: number;
  rotation?: ObbyRotation;
  motion?: ObbyMotion;
}

/** A local safe point. `position` is a feet position; the trigger is a short vertical cylinder around it. */
export interface ObbyCheckpoint {
  id: string;
  position: PositionSnapshot;
  triggerRadius: number;
}

export interface ObbyCourse {
  platforms: readonly ObbyPlatform[];
  hazards: readonly ObbyHazard[];
  checkpoints: readonly ObbyCheckpoint[];
}

// ---------------------------------------------------------------------------
// Sampled geometry (the public source for rendering)
// ---------------------------------------------------------------------------

export interface SampledObbyPlatform {
  readonly id: string;
  readonly center: Readonly<PositionSnapshot>;
  readonly size: Readonly<PositionSnapshot>;
}

export interface SampledObbyHazard {
  readonly id: string;
  readonly center: Readonly<PositionSnapshot>;
  /** Capsule segment end points at the hazard's centre height. */
  readonly start: Readonly<PositionSnapshot>;
  readonly end: Readonly<PositionSnapshot>;
  readonly radius: number;
  /** Rotation around Y in radians; equals the Three.js `rotation.y` that maps local +X onto start→end. */
  readonly angle: number;
}

export interface ObbySample {
  readonly timeSeconds: number;
  readonly platforms: readonly SampledObbyPlatform[];
  readonly hazards: readonly SampledObbyHazard[];
}

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------

export interface ObbyTuning {
  /** Horizontal speed in m/s at full stick. */
  moveSpeed: number;
  /** Vertical acceleration in m/s² (negative is down). */
  gravity: number;
  /** Initial upward speed of a jump in m/s. */
  jumpVelocity: number;
  /** Seconds after walking off an edge during which a jump is still honoured. */
  coyoteSeconds: number;
  /** Seconds a jump press stays queued while airborne so a slightly early press still jumps on landing. */
  jumpBufferSeconds: number;
  /** A surface at most this far above the feet is stepped onto instead of treated as a wall. */
  stepTolerance: number;
  /** Seconds of hazard protection after a recovery. */
  recoverySeconds: number;
  /** An airborne body with feet below this world Y is a fall; no spawn is placed on a top below it. */
  fallThresholdY: number;
  /** Largest delta accepted per step; larger values are clamped, invalid values are 0. */
  maxDeltaSeconds: number;
  /** Largest integration substep; a step is split so no substep exceeds it. */
  maxSubstepSeconds: number;
  /**
   * Upper bound on substeps per step. Beyond it the thin-feature guarantee
   * degrades: at the 0.05 s delta the floor is 1/640 s, so features thinner
   * than the fastest relative motion covers in that time may be skipped.
   */
  maxSubsteps: number;
  /** Fraction of the player radius by which the foot-circle centre may hang past a platform edge and still stand. */
  supportOverhang: number;
  /** Feet must be within this vertical distance of a checkpoint to trigger it. */
  checkpointHeightTolerance: number;
  /** How far below a checkpoint's declared feet position a supporting platform may be found at recovery. */
  spawnSearchDepth: number;
}

/** Root-reviewed defaults. Override per call through `ObbyStepOptions.tuning`. */
export const OBBY_TUNING: Readonly<ObbyTuning> = Object.freeze({
  moveSpeed: 3.1,
  gravity: -15,
  jumpVelocity: 5,
  coyoteSeconds: 0.12,
  jumpBufferSeconds: 0.14,
  stepTolerance: 0.015,
  recoverySeconds: 0.8,
  fallThresholdY: -2,
  maxDeltaSeconds: 0.05,
  maxSubstepSeconds: 1 / 120,
  maxSubsteps: 32,
  supportOverhang: 0.6,
  checkpointHeightTolerance: 0.35,
  spawnSearchDepth: 1,
});

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface ObbyState {
  /** Feet position. Mutated in place so callers may hold the reference. */
  position: PositionSnapshot;
  velocityY: number;
  grounded: boolean;
  /** Yaw in radians, same convention as the existing controller. */
  facing: number;
  /** Id of the platform currently carrying the player, or null while airborne. */
  supportId: string | null;
  /** Sampled centre of the support platform at the last substep; used to ride its motion by delta. */
  supportAnchor: PositionSnapshot | null;
  /** Most recently activated checkpoint id; null until one triggers. */
  checkpointId: string | null;
  /** Declared feet position of the latest checkpoint (initially the creation position). Mutated in place. */
  checkpoint: PositionSnapshot;
  /** Creation position; the final recovery fallback. */
  origin: PositionSnapshot;
  coyoteRemaining: number;
  jumpBufferRemaining: number;
  recoveryRemaining: number;
  /** Whether `jumpPressed` was true on the previous step; enforces one jump per press. */
  jumpHeld: boolean;
  /**
   * Whether the player has stood on a platform since the last recovery. A
   * fall recovers immediately when true; when false (the spawn found no
   * support) a fall waits for the recovery cooldown so a hopeless spawn
   * cannot re-fire every frame.
   */
  settled: boolean;
}

export interface ObbyStepOptions {
  /** Frame delta. Clamped to [0, maxDeltaSeconds]; non-finite or negative is 0, and 0 is a complete no-op. */
  deltaSeconds: number;
  /**
   * The caller's paused game clock after advancing by `deltaSeconds`. The
   * geometry in force at the end of this step is `sampleObby(course, timeSeconds)`.
   */
  timeSeconds: number;
  cameraYaw: number;
  /** False forbids every jump this step, including buffered and coyote jumps. */
  canJump: boolean;
  /** Press edge for this frame. A held value is tolerated and still yields one jump per press. */
  jumpPressed: boolean;
  /** Player collider radius in metres. */
  radius: number;
  /** Player collider height in metres (feet to head). */
  height: number;
  tuning?: Partial<ObbyTuning>;
}

export interface ObbyStepResult {
  recovered: boolean;
  checkpointChanged: boolean;
}

export type ObbyMoveInput = Pick<GameInputSnapshot, "moveX" | "moveY">;

// ---------------------------------------------------------------------------
// Numeric helpers
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;
const EPSILON = 1e-9;
const DEFAULT_RADIUS = 0.25;
const DEFAULT_HEIGHT = 0.9;

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function positiveOr(value: unknown, fallback: number): number {
  const finite = finiteOr(value, fallback);
  return finite > 0 ? finite : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sanitizePoint(point: Partial<PositionSnapshot> | undefined): PositionSnapshot {
  return { x: finiteOr(point?.x, 0), y: finiteOr(point?.y, 0), z: finiteOr(point?.z, 0) };
}

function assign(target: PositionSnapshot, x: number, y: number, z: number): void {
  target.x = x;
  target.y = y;
  target.z = z;
}

function wrapTime(time: number, period: number): number {
  const wrapped = time % period;
  return wrapped < 0 ? wrapped + period : wrapped;
}

function cycleAngle(period: unknown, phase: unknown, time: number): number {
  const seconds = finiteOr(period, 0);
  const offset = finiteOr(phase, 0);
  if (seconds <= 0) return offset;
  return offset + TAU * (wrapTime(time, seconds) / seconds);
}

function motionOffset(motion: ObbyMotion | undefined, time: number): { x: number; z: number } {
  if (!motion) return { x: 0, z: 0 };
  const distance = finiteOr(motion.distance, 0);
  const period = finiteOr(motion.period, 0);
  if (distance === 0 || period <= 0) return { x: 0, z: 0 };
  const offset = distance * Math.sin(cycleAngle(period, motion.phase, time));
  return motion.axis === "z" ? { x: 0, z: offset } : { x: offset, z: 0 };
}

function motionSpeed(motion: ObbyMotion | undefined): number {
  if (!motion) return 0;
  const distance = Math.abs(finiteOr(motion.distance, 0));
  const period = finiteOr(motion.period, 0);
  return distance === 0 || period <= 0 ? 0 : (TAU * distance) / period;
}

function isStaticMotion(motion: ObbyMotion | undefined): boolean {
  return motionSpeed(motion) === 0;
}

// ---------------------------------------------------------------------------
// Sampling
// ---------------------------------------------------------------------------

interface Box {
  id: string;
  center: PositionSnapshot;
  size: PositionSnapshot;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  bottom: number;
  top: number;
  isStatic: boolean;
  /** Upper bound on the platform's speed in m/s, from its motion definition. */
  speed: number;
}

interface Capsule {
  id: string;
  center: PositionSnapshot;
  start: PositionSnapshot;
  end: PositionSnapshot;
  radius: number;
  angle: number;
}

function sampleBox(platform: ObbyPlatform, time: number): Box {
  const center = sanitizePoint(platform.center);
  const raw = sanitizePoint(platform.size);
  const size = { x: Math.abs(raw.x), y: Math.abs(raw.y), z: Math.abs(raw.z) };
  const offset = motionOffset(platform.motion, time);
  center.x += offset.x;
  center.z += offset.z;
  return {
    id: String(platform.id),
    center,
    size,
    minX: center.x - size.x / 2,
    maxX: center.x + size.x / 2,
    minZ: center.z - size.z / 2,
    maxZ: center.z + size.z / 2,
    bottom: center.y - size.y / 2,
    top: center.y + size.y / 2,
    isStatic: isStaticMotion(platform.motion),
    speed: motionSpeed(platform.motion),
  };
}

function sampleCapsule(hazard: ObbyHazard, time: number): Capsule {
  const center = sanitizePoint(hazard.center);
  const offset = motionOffset(hazard.motion, time);
  center.x += offset.x;
  center.z += offset.z;
  const halfLength = Math.abs(finiteOr(hazard.halfLength, 0));
  const radius = Math.abs(finiteOr(hazard.radius, 0));
  const angle = hazard.rotation ? cycleAngle(hazard.rotation.period, hazard.rotation.phase, time) : 0;
  // Rotation about +Y maps local +X onto (cos θ, 0, -sin θ), matching Three.js rotation.y.
  const dx = Math.cos(angle) * halfLength;
  const dz = -Math.sin(angle) * halfLength;
  return {
    id: String(hazard.id),
    center,
    start: { x: center.x - dx, y: center.y, z: center.z - dz },
    end: { x: center.x + dx, y: center.y, z: center.z + dz },
    radius,
    angle,
  };
}

/**
 * Sample the course at a game-clock time. Deterministic, allocation-only,
 * deeply frozen. Non-finite time samples at 0; periodic motion is evaluated on
 * the wrapped time so large clocks keep full precision.
 */
export function sampleObby(course: ObbyCourse, timeSeconds: number): ObbySample {
  const time = finiteOr(timeSeconds, 0);
  const platforms = (course.platforms ?? []).map((platform) => {
    const box = sampleBox(platform, time);
    return Object.freeze({
      id: box.id,
      center: Object.freeze(box.center),
      size: Object.freeze(box.size),
    });
  });
  const hazards = (course.hazards ?? []).map((hazard) => {
    const capsule = sampleCapsule(hazard, time);
    return Object.freeze({
      id: capsule.id,
      center: Object.freeze(capsule.center),
      start: Object.freeze(capsule.start),
      end: Object.freeze(capsule.end),
      radius: capsule.radius,
      angle: capsule.angle,
    });
  });
  return Object.freeze({
    timeSeconds: time,
    platforms: Object.freeze(platforms),
    hazards: Object.freeze(hazards),
  });
}

// ---------------------------------------------------------------------------
// Geometry tests
// ---------------------------------------------------------------------------

/** Foot-circle support: the centre may hang `reach` past any edge. */
function supports(box: Box, x: number, z: number, reach: number): boolean {
  return (
    x >= box.minX - reach && x <= box.maxX + reach && z >= box.minZ - reach && z <= box.maxZ + reach
  );
}

function circleOverlapsBox(box: Box, x: number, z: number, radius: number): boolean {
  const dx = x - clamp(x, box.minX, box.maxX);
  const dz = z - clamp(z, box.minZ, box.maxZ);
  return dx * dx + dz * dz < radius * radius - EPSILON;
}

/** A box is a wall when its side spans the body above the step tolerance and below the head. */
function isWall(box: Box, feet: number, height: number, stepTolerance: number): boolean {
  return box.top > feet + stepTolerance && box.bottom < feet + height - EPSILON;
}

/**
 * Push a circle out of a box footprint. Returns whether it moved. A centre
 * that ended up inside leaves through the face it came from, so a single
 * substep cannot carry it out the far side of a thin wall.
 */
function pushOutOfBox(
  position: PositionSnapshot,
  prevX: number,
  prevZ: number,
  radius: number,
  box: Box,
): boolean {
  const closestX = clamp(position.x, box.minX, box.maxX);
  const closestZ = clamp(position.z, box.minZ, box.maxZ);
  const dx = position.x - closestX;
  const dz = position.z - closestZ;
  const distanceSq = dx * dx + dz * dz;
  if (distanceSq >= radius * radius - EPSILON) return false;
  if (distanceSq > 1e-12) {
    const distance = Math.sqrt(distanceSq);
    const push = radius - distance;
    position.x += (dx / distance) * push;
    position.z += (dz / distance) * push;
    return true;
  }
  if (prevX <= box.minX) position.x = box.minX - radius;
  else if (prevX >= box.maxX) position.x = box.maxX + radius;
  else if (prevZ <= box.minZ) position.z = box.minZ - radius;
  else if (prevZ >= box.maxZ) position.z = box.maxZ + radius;
  else {
    const exits: { axis: "x" | "z"; value: number; cost: number }[] = [
      { axis: "x", value: box.minX - radius, cost: position.x - box.minX },
      { axis: "x", value: box.maxX + radius, cost: box.maxX - position.x },
      { axis: "z", value: box.minZ - radius, cost: position.z - box.minZ },
      { axis: "z", value: box.maxZ + radius, cost: box.maxZ - position.z },
    ];
    let best = exits[0]!;
    for (const exit of exits) if (exit.cost < best.cost) best = exit;
    if (best.axis === "x") position.x = best.value;
    else position.z = best.value;
  }
  return true;
}

function distancePointSegmentXZ(
  x: number,
  z: number,
  start: PositionSnapshot,
  end: PositionSnapshot,
): number {
  const sx = end.x - start.x;
  const sz = end.z - start.z;
  const lengthSq = sx * sx + sz * sz;
  let t = 0;
  if (lengthSq > 1e-12) {
    t = clamp(((x - start.x) * sx + (z - start.z) * sz) / lengthSq, 0, 1);
  }
  return Math.hypot(x - (start.x + sx * t), z - (start.z + sz * t));
}

/**
 * Exact overlap between a horizontal capsule and the player's vertical
 * cylinder (feet to feet+height). The capsule's cross-section at the closest
 * body height shrinks with vertical offset, so a body entirely above or below
 * the bar clears it and a body beside it needs the sum of both radii.
 */
function capsuleHitsPlayer(
  capsule: Capsule,
  position: PositionSnapshot,
  radius: number,
  height: number,
): boolean {
  if (capsule.radius <= 0) return false;
  const feet = position.y;
  const head = feet + height;
  const dy = capsule.center.y < feet ? feet - capsule.center.y : capsule.center.y > head ? capsule.center.y - head : 0;
  if (dy >= capsule.radius) return false;
  const reach = radius + Math.sqrt(capsule.radius * capsule.radius - dy * dy);
  return distancePointSegmentXZ(position.x, position.z, capsule.start, capsule.end) < reach - EPSILON;
}

/** The box with this id whose centre is closest to `anchor`; tolerates duplicate ids. */
function nearestBox(boxes: readonly Box[], id: string, anchor: PositionSnapshot): Box | null {
  let best: Box | null = null;
  let bestDistance = Infinity;
  for (const box of boxes) {
    if (box.id !== id) continue;
    const distance = Math.hypot(box.center.x - anchor.x, box.center.z - anchor.z);
    if (distance < bestDistance) {
      best = box;
      bestDistance = distance;
    }
  }
  return best;
}

/** Highest platform whose top is within the step tolerance of the feet and which supports the foot circle. */
function findSupport(
  boxes: readonly Box[],
  x: number,
  z: number,
  feet: number,
  reach: number,
  stepTolerance: number,
  preferId: string | null,
): Box | null {
  let best: Box | null = null;
  for (const box of boxes) {
    if (box.top > feet + stepTolerance || box.top < feet - stepTolerance) continue;
    if (!supports(box, x, z, reach)) continue;
    if (
      best === null ||
      box.top > best.top + EPSILON ||
      (Math.abs(box.top - best.top) <= EPSILON && box.id === preferId)
    ) {
      best = box;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Recovery spawn resolution
// ---------------------------------------------------------------------------

function findSpawnSupport(
  boxes: readonly Box[],
  point: PositionSnapshot,
  tuning: ObbyTuning,
  staticOnly: boolean,
): Box | null {
  let best: Box | null = null;
  for (const box of boxes) {
    if (staticOnly && !box.isStatic) continue;
    if (point.x < box.minX || point.x > box.maxX || point.z < box.minZ || point.z > box.maxZ) continue;
    if (box.top > point.y + tuning.stepTolerance) continue;
    if (box.top < point.y - tuning.spawnSearchDepth) continue;
    if (box.top < tuning.fallThresholdY) continue; // standing below the fall line is not safe
    if (best === null || box.top > best.top) best = box;
  }
  return best;
}

interface SpawnCandidate {
  id: string | null;
  position: PositionSnapshot;
}

function spawnCandidates(state: ObbyState, checkpoints: readonly ObbyCheckpoint[]): SpawnCandidate[] {
  const candidates: SpawnCandidate[] = [
    { id: state.checkpointId, position: sanitizePoint(state.checkpoint) },
  ];
  const index =
    state.checkpointId === null
      ? -1
      : checkpoints.findIndex((checkpoint) => String(checkpoint.id) === state.checkpointId);
  for (let i = index - 1; i >= 0; i -= 1) {
    const checkpoint = checkpoints[i]!;
    candidates.push({ id: String(checkpoint.id), position: sanitizePoint(checkpoint.position) });
  }
  candidates.push({ id: null, position: sanitizePoint(state.origin) });
  return candidates;
}

/**
 * Pick where a recovery lands: the latest checkpoint if a platform currently
 * supports it (a static platform first, then a moving one), else earlier
 * declared checkpoints in reverse order, else the creation position. The
 * feet snap to the supporting top. If nothing supports any candidate, the
 * latest checkpoint's declared point is used in the air so state stays finite.
 */
function resolveSpawn(
  state: ObbyState,
  checkpoints: readonly ObbyCheckpoint[],
  boxes: readonly Box[],
  tuning: ObbyTuning,
): { candidate: SpawnCandidate; position: PositionSnapshot; support: Box | null } {
  const candidates = spawnCandidates(state, checkpoints);
  for (const candidate of candidates) {
    const support =
      findSpawnSupport(boxes, candidate.position, tuning, true) ??
      findSpawnSupport(boxes, candidate.position, tuning, false);
    if (support) {
      return {
        candidate,
        position: { x: candidate.position.x, y: support.top, z: candidate.position.z },
        support,
      };
    }
  }
  const first = candidates[0]!;
  return { candidate: first, position: { ...first.position }, support: null };
}

/** Reset to the resolved spawn. Returns whether a fallback checkpoint was adopted as the latest. */
function recover(
  state: ObbyState,
  checkpoints: readonly ObbyCheckpoint[],
  boxes: readonly Box[],
  tuning: ObbyTuning,
): boolean {
  const spawn = resolveSpawn(state, checkpoints, boxes, tuning);
  assign(state.position, spawn.position.x, spawn.position.y, spawn.position.z);
  state.velocityY = 0;
  state.grounded = spawn.support !== null;
  state.supportId = spawn.support?.id ?? null;
  state.supportAnchor = spawn.support ? { ...spawn.support.center } : null;
  state.coyoteRemaining = 0;
  state.jumpBufferRemaining = 0;
  state.recoveryRemaining = tuning.recoverySeconds;
  state.settled = spawn.support !== null;
  const adopted = spawn.support !== null && spawn.candidate.id !== state.checkpointId;
  if (adopted) {
    // The latest checkpoint was not safe right now; the one actually used
    // becomes the latest so the next recovery and the caller's UI agree.
    state.checkpointId = spawn.candidate.id;
    assign(state.checkpoint, spawn.candidate.position.x, spawn.candidate.position.y, spawn.candidate.position.z);
  }
  return adopted;
}

// ---------------------------------------------------------------------------
// Substep sizing
// ---------------------------------------------------------------------------

/**
 * Choose a substep small enough that neither the player nor any hazard moves
 * further than the thinnest relevant feature per substep, so contact tests on
 * discrete samples cannot skip a wall or a sweeping bar.
 */
function chooseSubsteps(
  dt: number,
  course: ObbyCourse,
  state: ObbyState,
  radius: number,
  tuning: ObbyTuning,
): number {
  let feature = 2 * radius;
  let relativeSpeed = tuning.moveSpeed + Math.abs(state.velocityY) + Math.abs(tuning.gravity) * dt;
  let fastest = 0;
  for (const hazard of course.hazards ?? []) {
    const hazardRadius = Math.abs(finiteOr(hazard.radius, 0));
    if (hazardRadius > 0) feature = Math.min(feature, hazardRadius);
    const period = finiteOr(hazard.rotation?.period, 0);
    const tipSpeed = period > 0 ? (TAU * Math.abs(finiteOr(hazard.halfLength, 0))) / period : 0;
    fastest = Math.max(fastest, tipSpeed + motionSpeed(hazard.motion));
  }
  for (const platform of course.platforms ?? []) {
    const size = sanitizePoint(platform.size);
    const thickness = Math.min(Math.abs(size.x), Math.abs(size.z)) / 2;
    if (thickness > 0) feature = Math.min(feature, thickness);
    fastest = Math.max(fastest, motionSpeed(platform.motion));
  }
  relativeSpeed += fastest;
  let substep = tuning.maxSubstepSeconds;
  if (relativeSpeed > 0) substep = Math.min(substep, feature / relativeSpeed);
  const count = Math.ceil(dt / Math.max(substep, EPSILON));
  return clamp(count, 1, Math.max(1, Math.floor(tuning.maxSubsteps)));
}

// ---------------------------------------------------------------------------
// Public state API
// ---------------------------------------------------------------------------

export function createObbyState(position: PositionSnapshot): ObbyState {
  const origin = sanitizePoint(position);
  return {
    position: { ...origin },
    velocityY: 0,
    grounded: false,
    facing: 0,
    supportId: null,
    supportAnchor: null,
    checkpointId: null,
    checkpoint: { ...origin },
    origin,
    coyoteRemaining: 0,
    jumpBufferRemaining: 0,
    recoveryRemaining: 0,
    jumpHeld: false,
    settled: true,
  };
}

/**
 * Advance the player by one frame. Mutates `state` in place and reports
 * whether a recovery happened and whether the latest checkpoint changed.
 */
export function stepObby(
  state: ObbyState,
  input: ObbyMoveInput,
  course: ObbyCourse,
  options: ObbyStepOptions,
): ObbyStepResult {
  const result: ObbyStepResult = { recovered: false, checkpointChanged: false };
  const tuning: ObbyTuning = options.tuning ? { ...OBBY_TUNING, ...options.tuning } : OBBY_TUNING;
  const dt = clamp(finiteOr(options.deltaSeconds, 0), 0, Math.max(0, finiteOr(tuning.maxDeltaSeconds, 0)));
  if (dt <= 0) {
    // A paused frame simulates nothing and swallows presses, but a release
    // must still be seen or the next real press after the pause is lost.
    if (options.jumpPressed !== true) state.jumpHeld = false;
    return result;
  }

  const radius = positiveOr(options.radius, DEFAULT_RADIUS);
  const height = positiveOr(options.height, DEFAULT_HEIGHT);
  const reach = radius * clamp(finiteOr(tuning.supportOverhang, 0), 0, 0.99);
  const timeEnd = finiteOr(options.timeSeconds, 0);
  const timeStart = timeEnd - dt;
  const cameraYaw = finiteOr(options.cameraYaw, 0);
  const platforms = course.platforms ?? [];
  const hazards = course.hazards ?? [];
  const checkpoints = course.checkpoints ?? [];

  // Camera-relative movement, identical to the existing controller: diagonal
  // input is normalised, partial stick scales speed, facing follows travel.
  const moveX = clamp(finiteOr(input.moveX, 0), -1, 1);
  const moveY = clamp(finiteOr(input.moveY, 0), -1, 1);
  const forwardX = -Math.sin(cameraYaw);
  const forwardZ = -Math.cos(cameraYaw);
  const rightX = Math.cos(cameraYaw);
  const rightZ = -Math.sin(cameraYaw);
  const directionX = rightX * moveX + forwardX * moveY;
  const directionZ = rightZ * moveX + forwardZ * moveY;
  const movementLength = Math.hypot(directionX, directionZ);
  const moving = movementLength > 0.001;
  const speedScale = moving ? tuning.moveSpeed / Math.max(1, movementLength) : 0;
  const velocityX = directionX * speedScale;
  const velocityZ = directionZ * speedScale;
  if (moving) state.facing = Math.atan2(-directionX, -directionZ);

  // One jump per press: only a rising edge arms the buffer, and canJump=false
  // clears anything queued so no buffered or coyote jump survives it.
  const pressed = options.jumpPressed === true;
  const pressEdge = pressed && !state.jumpHeld;
  state.jumpHeld = pressed;
  const canJump = options.canJump === true;
  if (!canJump) state.jumpBufferRemaining = 0;
  else if (pressEdge) state.jumpBufferRemaining = tuning.jumpBufferSeconds;

  const substeps = chooseSubsteps(dt, course, state, radius, tuning);
  const h = dt / substeps;

  for (let index = 1; index <= substeps; index += 1) {
    const time = timeStart + dt * (index / substeps);
    const boxes = platforms.map((platform) => sampleBox(platform, time));
    const position = state.position;

    state.recoveryRemaining = Math.max(0, state.recoveryRemaining - h);

    // Ride the support platform by the delta of its sampled centre. Landing
    // re-anchors, so re-entry never applies a stale delta.
    if (state.grounded && state.supportId !== null) {
      const support = state.supportAnchor ? nearestBox(boxes, state.supportId, state.supportAnchor) : null;
      if (support && state.supportAnchor) {
        const carryX = support.center.x - state.supportAnchor.x;
        const carryZ = support.center.z - state.supportAnchor.z;
        // A delta the platform could not have produced in one substep means a
        // clock discontinuity or an id collision: re-anchor without moving.
        if (Math.hypot(carryX, carryZ) <= support.speed * h + 1e-6) {
          position.x += carryX;
          position.z += carryZ;
        }
        state.supportAnchor = { ...support.center };
      } else {
        state.supportId = null;
        state.supportAnchor = null;
      }
    }

    // Jump: grounded or inside the coyote window, with a live buffer. The
    // take-off position is inherited; the platform's motion is not.
    if (
      canJump &&
      state.jumpBufferRemaining > 0 &&
      (state.grounded || state.coyoteRemaining > 0)
    ) {
      state.velocityY = tuning.jumpVelocity;
      state.grounded = false;
      state.supportId = null;
      state.supportAnchor = null;
      state.coyoteRemaining = 0;
      state.jumpBufferRemaining = 0;
    }
    state.jumpBufferRemaining = Math.max(0, state.jumpBufferRemaining - h);

    // Horizontal input, then side collision against every box whose side
    // spans the body. Iterate a few times so corners settle.
    const prevX = position.x;
    const prevZ = position.z;
    if (moving) {
      position.x += velocityX * h;
      position.z += velocityZ * h;
    }
    for (let pass = 0; pass < 3; pass += 1) {
      let moved = false;
      for (const box of boxes) {
        if (!isWall(box, position.y, height, tuning.stepTolerance)) continue;
        if (pushOutOfBox(position, prevX, prevZ, radius, box)) moved = true;
      }
      if (!moved) break;
    }

    // Vertical: a grounded player keeps or loses support; an airborne player
    // integrates gravity with swept top/bottom tests so thin surfaces hold.
    const prevFeet = position.y;
    if (state.grounded) {
      const support = findSupport(
        boxes,
        position.x,
        position.z,
        prevFeet,
        reach,
        tuning.stepTolerance,
        state.supportId,
      );
      if (support) {
        state.supportId = support.id;
        state.supportAnchor = { ...support.center };
        position.y = support.top;
        state.velocityY = 0;
        state.settled = true;
      } else {
        state.grounded = false;
        state.supportId = null;
        state.supportAnchor = null;
      }
    }
    if (!state.grounded) {
      // Exact ballistic update for constant gravity: the same trajectory at
      // any substep size, so 30 Hz and 60 Hz jumps reach the same apex.
      const rise = state.velocityY * h + 0.5 * tuning.gravity * h * h;
      state.velocityY += tuning.gravity * h;
      position.y += rise;
      if (rise > 0) {
        const prevHead = prevFeet + height;
        const head = position.y + height;
        let ceiling = Infinity;
        for (const box of boxes) {
          if (prevHead > box.bottom + tuning.stepTolerance || head <= box.bottom) continue;
          if (!circleOverlapsBox(box, position.x, position.z, radius)) continue;
          ceiling = Math.min(ceiling, box.bottom);
        }
        if (ceiling < Infinity) {
          position.y = ceiling - height;
          state.velocityY = 0;
        }
      } else {
        let landing: Box | null = null;
        for (const box of boxes) {
          if (prevFeet < box.top - tuning.stepTolerance || position.y > box.top) continue;
          if (!supports(box, position.x, position.z, reach)) continue;
          if (landing === null || box.top > landing.top) landing = box;
        }
        if (landing) {
          position.y = landing.top;
          state.velocityY = 0;
          state.grounded = true;
          state.supportId = landing.id;
          state.supportAnchor = { ...landing.center };
          state.settled = true;
        }
      }
    }
    state.coyoteRemaining = state.grounded
      ? tuning.coyoteSeconds
      : Math.max(0, state.coyoteRemaining - h);

    // A fall is an airborne body below the fall line. It recovers at once
    // after any landing; straight out of an unsupported spawn it waits for
    // the cooldown. Hazard contact only counts outside the protection window.
    let hit =
      !state.grounded &&
      position.y < tuning.fallThresholdY &&
      (state.settled || state.recoveryRemaining <= 0);
    if (!hit && state.recoveryRemaining <= 0) {
      for (const hazard of hazards) {
        if (capsuleHitsPlayer(sampleCapsule(hazard, time), position, radius, height)) {
          hit = true;
          break;
        }
      }
    }
    if (hit) {
      // The step ends at the checkpoint: the remainder of this frame is not
      // simulated, so callers observe the exact reset position.
      if (recover(state, checkpoints, boxes, tuning)) result.checkpointChanged = true;
      result.recovered = true;
      break;
    }

    // Checkpoints only arm from a standing player close to their height.
    if (state.grounded) {
      for (const checkpoint of checkpoints) {
        const id = String(checkpoint.id);
        if (id === state.checkpointId) continue;
        const triggerRadius = finiteOr(checkpoint.triggerRadius, 0);
        if (triggerRadius <= 0) continue;
        const target = sanitizePoint(checkpoint.position);
        if (Math.abs(position.y - target.y) > tuning.checkpointHeightTolerance) continue;
        if (Math.hypot(position.x - target.x, position.z - target.z) > triggerRadius) continue;
        state.checkpointId = id;
        assign(state.checkpoint, target.x, target.y, target.z);
        result.checkpointChanged = true;
        break;
      }
    }
  }

  return result;
}
