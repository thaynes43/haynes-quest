// Lockstep control for browser journeys.
//
// The page clock is installed before navigation and paused once a level is
// ready. From then on the harness renders one frame at a time: it reads the
// game, chooses keyboard input, and advances page time by one frame. The game
// therefore sees the same frame intervals however slowly the renderer draws,
// so software WebGL at a few frames a second can still follow a route closely.
//
// Lockstep proves logic and layout: reachability, collisions, combat rules and
// UI state under ordinary keyboard input. It does not measure frame time or how
// play feels on a device; real-time runs on real hardware still own that.
import assert from "node:assert/strict";

import {
  livePlatform,
  planarDistance,
  platformGateway,
} from "./authored-navigation.mjs";

/** One 60 Hz frame, the step casino-rewards.mjs proved on the ticket loft. */
export const LOCKSTEP_FRAME_MS = 16;
/** One longer rendered frame used while cruising in the open or waiting. */
export const LOCKSTEP_CRUISE_FRAME_MS = 48;

/**
 * Runtime values the planner and hazard predictor rely on. The unit tests
 * compare them with src/game so a tuning change cannot drift silently.
 */
export const LOCKSTEP_PHYSICS = Object.freeze({
  // Route-memory adventures (Rat Casino and the playgrounds) walk at 4 m/s.
  moveSpeed: 4,
  jumpVelocity: 5,
  gravity: -15,
  stepTolerance: 0.015,
  supportOverhang: 0.6,
  travelers: Object.freeze({
    infant: Object.freeze({ radius: 0.25, height: 0.88 }),
    child: Object.freeze({ radius: 0.24, height: 1.22 }),
  }),
});

const ACTIVE_PHASES = new Set(["exploring", "memory-released"]);

/** Reads QUEST_E2E_LOCKSTEP. Only an explicit 1/true enables lockstep. */
export function lockstepRequested(env = process.env) {
  const value = String(env.QUEST_E2E_LOCKSTEP ?? "")
    .trim()
    .toLowerCase();
  if (["", "0", "false", "no", "off"].includes(value)) return false;
  if (["1", "true", "yes", "on"].includes(value)) return true;
  throw new Error(`QUEST_E2E_LOCKSTEP must be 1 or 0, not "${value}"`);
}

/** Reads the optional QUEST_E2E_LOCKSTEP_CRUISE_MS override. */
export function lockstepCruiseFrameMs(env = process.env) {
  const raw = env.QUEST_E2E_LOCKSTEP_CRUISE_MS;
  if (raw === undefined || raw === "") return LOCKSTEP_CRUISE_FRAME_MS;
  const value = Number(raw);
  assert.ok(
    Number.isInteger(value) &&
      value >= LOCKSTEP_FRAME_MS &&
      value <= 192 &&
      value % LOCKSTEP_FRAME_MS === 0,
    "QUEST_E2E_LOCKSTEP_CRUISE_MS must be a multiple of 16 from 16 to 192",
  );
  return value;
}

/**
 * Reads the optional QUEST_E2E_LOCKSTEP_SCALE device scale factor. Below 1 the
 * page keeps its CSS layout while the game draws fewer pixels per frame.
 */
export function lockstepDeviceScale(env = process.env) {
  const raw = env.QUEST_E2E_LOCKSTEP_SCALE;
  if (raw === undefined || raw === "") return 1;
  const value = Number(raw);
  assert.ok(
    Number.isFinite(value) && value >= 0.25 && value <= 1,
    "QUEST_E2E_LOCKSTEP_SCALE must be a number from 0.25 to 1",
  );
  return value;
}

export function travelerFor(stage) {
  return LOCKSTEP_PHYSICS.travelers[stage] ?? LOCKSTEP_PHYSICS.travelers.child;
}

// ---------------------------------------------------------------------------
// Page clock and keyboard
// ---------------------------------------------------------------------------

/**
 * Runs in the page after each stepped frame. The clock returns once a frame's
 * WebGL commands are queued, and a software renderer can fall many frames
 * behind; a screenshot then waits for the whole backlog. Reading one pixel
 * waits until the GPU has drawn the frame (WebGL `finish()` does not).
 */
function awaitDrawnFrame() {
  const canvas = document.querySelector("canvas[data-quest-canvas=true]");
  const gl = canvas?.getContext("webgl2");
  if (gl)
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
}

/**
 * Owns the page clock and the held keyboard keys for one page. Call
 * `install()` before the first navigation and `pause()` once the level is
 * ready; page time flows normally until then.
 */
export function createLockstep(
  page,
  {
    frameMs = LOCKSTEP_FRAME_MS,
    cruiseFrameMs = LOCKSTEP_CRUISE_FRAME_MS,
    trace = null,
  } = {},
) {
  assert.ok(
    Number.isInteger(cruiseFrameMs) &&
      cruiseFrameMs >= frameMs &&
      cruiseFrameMs % frameMs === 0,
    "cruise frames must be whole multiples of the lockstep frame",
  );
  let paused = false;
  let held = [];
  const stats = {
    frames: 0,
    cruiseFrames: 0,
    gameMs: 0,
    wallMs: 0,
    pauses: 0,
  };

  const step = async (milliseconds = frameMs) => {
    assert.ok(paused, "the lockstep page clock is still running");
    assert.ok(
      Number.isInteger(milliseconds) &&
        milliseconds >= frameMs &&
        milliseconds % frameMs === 0,
      `lockstep frames advance whole ${frameMs} ms steps`,
    );
    const started = Date.now();
    // runFor delivers exactly one animation frame per 16 ms. fastForward
    // delivers a longer interval as a single rendered frame.
    if (milliseconds === frameMs) await page.clock.runFor(milliseconds);
    else await page.clock.fastForward(milliseconds);
    await page.evaluate(awaitDrawnFrame);
    stats.frames += 1;
    if (milliseconds !== frameMs) stats.cruiseFrames += 1;
    stats.gameMs += milliseconds;
    stats.wallMs += Date.now() - started;
  };

  const hold = async (keys) => {
    for (const key of held)
      if (!keys.includes(key)) await page.keyboard.up(key);
    for (const key of keys)
      if (!held.includes(key)) await page.keyboard.down(key);
    held = [...keys];
  };

  return {
    kind: "lockstep",
    page,
    frameMs,
    cruiseFrameMs,
    stats,
    /** Optional per-frame decision log, for diagnosing a route. */
    trace,
    get paused() {
      return paused;
    },
    /** Installs the fake page clock; call before navigating. */
    install: () => page.clock.install(),
    /** Stops page time. The first stepped frame then aligns to 16 ms. */
    async pause() {
      for (let attempt = 1; ; attempt += 1) {
        const now = await page.evaluate(() => Date.now());
        try {
          await page.clock.pauseAt(now + 2_000 * attempt);
          break;
        } catch (error) {
          // A slow frame can outlast the margin before pauseAt arrives.
          if (attempt >= 3 || !/past/i.test(String(error?.message)))
            throw error;
        }
      }
      paused = true;
      stats.pauses += 1;
      await step(frameMs);
    },
    step,
    /**
     * Lets about `milliseconds` of page time pass in cruise frames, at least
     * one. Polling loops call this between checks, so each poll renders once.
     */
    async advance(milliseconds) {
      const count = Math.max(1, Math.round(milliseconds / cruiseFrameMs));
      for (let index = 0; index < count; index += 1) await step(cruiseFrameMs);
    },
    /** A bound measured in page time, which only lockstep frames advance. */
    budget(milliseconds) {
      const started = stats.gameMs;
      return {
        expired: () => stats.gameMs - started >= milliseconds,
        elapsed: () => stats.gameMs - started,
      };
    },
    /** Steps frames until `check()` is truthy or the page-time bound ends. */
    async until(check, { timeout = 15_000, frame = cruiseFrameMs } = {}) {
      const bound = this.budget(timeout);
      for (;;) {
        const result = await check();
        if (result) return result;
        if (bound.expired()) return null;
        await step(frame);
      }
    },
    keys: {
      held: () => [...held],
      hold,
      release: () => hold([]),
      press: (key) => page.keyboard.press(key),
      /** Presses the keys again after the game cleared its input. */
      async resync(keys) {
        for (const key of [...held].reverse()) await page.keyboard.up(key);
        held = [];
        await hold(keys);
      },
    },
    summary() {
      return {
        mode: "lockstep",
        frameMs,
        cruiseFrameMs,
        frames: stats.frames,
        cruiseFrames: stats.cruiseFrames,
        pageSeconds: Number((stats.gameMs / 1_000).toFixed(2)),
        wallSeconds: Number((stats.wallMs / 1_000).toFixed(1)),
        pauses: stats.pauses,
      };
    },
  };
}

/**
 * The createHybridControls surface for lockstep pages. Timed gestures advance
 * page time instead of waiting on the wall clock.
 */
export function createLockstepControls(lockstep) {
  const { keys, page } = lockstep;
  const beginToward = (deltaX, deltaZ) => {
    const toward = keysToward(deltaX, deltaZ, 0.08);
    assert.ok(toward.length, "zero-length keyboard movement requested");
    return keys.hold(toward);
  };
  const beginJumpToward = async (deltaX, deltaZ) => {
    await beginToward(deltaX, deltaZ);
    await keys.press("Space");
  };
  return {
    kind: "keyboard-lockstep",
    beginToward,
    beginJumpToward,
    release: () => keys.release(),
    async jumpToward(deltaX, deltaZ, { milliseconds = 600 } = {}) {
      await beginJumpToward(deltaX, deltaZ);
      try {
        await lockstep.advance(milliseconds);
      } finally {
        await keys.release();
      }
    },
    async pulseToward(
      deltaX,
      deltaZ,
      { jump = false, milliseconds = 150 } = {},
    ) {
      await beginToward(deltaX, deltaZ);
      try {
        if (jump) await keys.press("Space");
        await lockstep.advance(milliseconds);
      } finally {
        await keys.release();
      }
    },
    async tapButton(name) {
      return page
        .getByRole("button", { name, exact: true })
        .tap({ timeout: 1_000 })
        .then(() => true)
        .catch(() => false);
    },
  };
}

// ---------------------------------------------------------------------------
// Keyboard steering
// ---------------------------------------------------------------------------

// The fixed game camera maps D to +X, S to +Z, A to -X and W to -Z. Index i
// points along atan2(z, x) = i * 45 degrees.
const DIRECTIONS = Object.freeze(
  [
    ["KeyD"],
    ["KeyD", "KeyS"],
    ["KeyS"],
    ["KeyA", "KeyS"],
    ["KeyA"],
    ["KeyA", "KeyW"],
    ["KeyW"],
    ["KeyD", "KeyW"],
  ].map((keys, index) => {
    const angle = (index * Math.PI) / 4;
    return Object.freeze({
      keys: Object.freeze(keys),
      x: Math.round(Math.cos(angle) * 1e9) / 1e9,
      z: Math.round(Math.sin(angle) * 1e9) / 1e9,
    });
  }),
);

/**
 * Holds each axis whose remaining distance exceeds the deadband. A deadband a
 * little over half of one frame's travel cannot oscillate.
 */
export function keysToward(deltaX, deltaZ, deadband = 0.035) {
  return [
    ...(Math.abs(deltaX) > deadband ? [deltaX < 0 ? "KeyA" : "KeyD"] : []),
    ...(Math.abs(deltaZ) > deadband ? [deltaZ < 0 ? "KeyW" : "KeyS"] : []),
  ];
}

/**
 * Chooses the eight-way keyboard direction that follows the segment
 * `from -> to`. Of the directions nearest the segment heading, it takes the
 * one that leaves the traveler closest to the line, so the path stays within
 * one frame's sideways travel of the planned segment.
 */
export function followSegmentKeys(position, from, to, stepLength = 0.064) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) return keysToward(to.x - position.x, to.z - position.z);
  const ux = dx / length;
  const uz = dz / length;
  const offset = ux * (position.z - from.z) - uz * (position.x - from.x);
  const nearest = Math.round(Math.atan2(uz, ux) / (Math.PI / 4));
  let best = null;
  for (const shift of [-1, 0, 1]) {
    const direction = DIRECTIONS[(((nearest + shift) % 8) + 8) % 8];
    const progress = ux * direction.x + uz * direction.z;
    if (progress <= 0.1) continue;
    const drift = ux * direction.z - uz * direction.x;
    const cost =
      Math.abs(offset + stepLength * drift) - 0.1 * stepLength * progress;
    if (!best || cost < best.cost) best = { cost, direction };
  }
  return [...best.direction.keys];
}

// ---------------------------------------------------------------------------
// Walk planning around raised platforms and sweepers
// ---------------------------------------------------------------------------

function boxOf(platform) {
  const halfX = Math.abs(platform.size.x) / 2;
  const halfY = Math.abs(platform.size.y) / 2;
  const halfZ = Math.abs(platform.size.z) / 2;
  return {
    id: platform.id,
    minX: platform.center.x - halfX,
    maxX: platform.center.x + halfX,
    minZ: platform.center.z - halfZ,
    maxZ: platform.center.z + halfZ,
    top: platform.center.y + halfY,
    bottom: platform.center.y - halfY,
  };
}

function expand(box, amountX, amountZ = amountX) {
  return {
    ...box,
    minX: box.minX - amountX,
    maxX: box.maxX + amountX,
    minZ: box.minZ - amountZ,
    maxZ: box.maxZ + amountZ,
  };
}

const hasArea = (box) => box.minX < box.maxX && box.minZ < box.maxZ;
const contains = (box, point) =>
  point.x >= box.minX &&
  point.x <= box.maxX &&
  point.z >= box.minZ &&
  point.z <= box.maxZ;
const strictlyContains = (box, point) =>
  point.x > box.minX &&
  point.x < box.maxX &&
  point.z > box.minZ &&
  point.z < box.maxZ;
const overlaps = (first, second) =>
  first.minX < second.maxX &&
  first.maxX > second.minX &&
  first.minZ < second.maxZ &&
  first.maxZ > second.minZ;
const cornersOf = (box) => [
  { x: box.minX, z: box.minZ },
  { x: box.maxX, z: box.minZ },
  { x: box.minX, z: box.maxZ },
  { x: box.maxX, z: box.maxZ },
];

/**
 * Every point a sweeper's capsule can cover over its motion and rotation
 * cycles, as an axis-aligned footprint with its vertical extent.
 */
export function sweeperFootprint(piece) {
  const halfLength = Math.abs(piece.halfLength ?? 0);
  const radius = Math.abs(piece.radius ?? 0);
  let reachX = halfLength;
  let reachZ = halfLength;
  const rotationPeriod = Number(piece.rotation?.period ?? 0);
  if (!(Number.isFinite(rotationPeriod) && rotationPeriod > 0)) {
    const angle = Number(piece.rotation?.phase ?? 0) || 0;
    reachX = Math.abs(Math.cos(angle)) * halfLength;
    reachZ = Math.abs(Math.sin(angle)) * halfLength;
  }
  const travel = Math.abs(piece.motion?.distance ?? 0);
  const motionPeriod = Number(piece.motion?.period ?? 0);
  const moves = travel > 0 && Number.isFinite(motionPeriod) && motionPeriod > 0;
  if (moves && piece.motion.axis === "z") reachZ += travel;
  else if (moves) reachX += travel;
  return {
    id: piece.id,
    minX: piece.center.x - reachX - radius,
    maxX: piece.center.x + reachX + radius,
    minZ: piece.center.z - reachZ - radius,
    maxZ: piece.center.z + reachZ + radius,
    bottom: piece.center.y - radius,
    top: piece.center.y + radius,
  };
}

function boxDistance(box, point) {
  return Math.hypot(
    Math.max(box.minX - point.x, 0, point.x - box.maxX),
    Math.max(box.minZ - point.z, 0, point.z - box.maxZ),
  );
}

/**
 * Plans a walk on the traveler's current floor height. Raised platforms that
 * would stop the body are walls; `sweeps` are hazard footprints to route
 * around. Returns the waypoints after `start`, ending at `goal`, or null.
 *
 * A takeoff often sits closer to a raised neighbour than the preferred
 * clearance, and a traveler can land near an edge. A wall therefore keeps no
 * more clearance than `start` or `goal` already has from it, and floor edges
 * are relaxed only within a step of either end.
 */
export function planWalk({
  platforms,
  sweeps = [],
  start,
  goal,
  traveler = LOCKSTEP_PHYSICS.travelers.child,
  movement = {},
  clearance = 0.15,
  edgeInset = 0.25,
  spacing = 0.1,
  margin = 4,
}) {
  const level = start.y;
  const bodyTop = level + traveler.height;
  const reach = traveler.radius + clearance;
  const area = {
    minX: Math.min(start.x, goal.x) - margin,
    maxX: Math.max(start.x, goal.x) + margin,
    minZ: Math.min(start.z, goal.z) - margin,
    maxZ: Math.max(start.z, goal.z) + margin,
  };
  const floors = [];
  const solids = [];
  for (const platform of platforms) {
    const box = boxOf(platform);
    if (Math.abs(box.top - level) <= LOCKSTEP_PHYSICS.stepTolerance) {
      if (overlaps(box, area)) floors.push(box);
    } else if (
      box.top > level + LOCKSTEP_PHYSICS.stepTolerance &&
      box.bottom < bodyTop
    ) {
      const sweep = movement[platform.id] ?? { x: 0, z: 0 };
      solids.push(expand(box, sweep.x, sweep.z));
    }
  }
  if (!floors.length) return null;
  const floorArea = floors.reduce(
    (union, box) => ({
      minX: Math.min(union.minX, box.minX),
      maxX: Math.max(union.maxX, box.maxX),
      minZ: Math.min(union.minZ, box.minZ),
      maxZ: Math.max(union.maxZ, box.maxZ),
    }),
    { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
  );
  const hazards = sweeps.filter(
    (sweep) =>
      sweep.top > level &&
      sweep.bottom < bodyTop &&
      // Standing inside a sweep already; prediction handles the crossing.
      !contains(sweep, start) &&
      !contains(sweep, goal),
  );
  const blockers = [...solids, ...hazards]
    .map((box) => {
      const allowed =
        Math.min(boxDistance(box, start), boxDistance(box, goal)) - 0.01;
      return expand(box, Math.max(0, Math.min(reach, allowed)));
    })
    .filter((box) => overlaps(box, floorArea));
  // A point is safely on the floor when a disc around it is: this treats
  // neighbouring tops at the same height as one surface.
  const diagonal = edgeInset * Math.SQRT1_2;
  const probes = [
    [0, 0],
    [edgeInset, 0],
    [-edgeInset, 0],
    [0, edgeInset],
    [0, -edgeInset],
    [diagonal, diagonal],
    [diagonal, -diagonal],
    [-diagonal, diagonal],
    [-diagonal, -diagonal],
  ];
  const onFloor = (point) =>
    probes.every(([dx, dz]) =>
      floors.some((box) => contains(box, { x: point.x + dx, z: point.z + dz })),
    );
  // The foot circle may hang a little past an edge and still stand.
  const looseFloors = floors.map((box) => expand(box, 0.1));
  const onLooseFloor = (point) =>
    looseFloors.some((box) => contains(box, point));
  const startLoose = !onFloor(start);
  const goalLoose = !onFloor(goal);
  const relaxDistance = edgeInset + 0.1;
  const pointClear = (point, loose = false) =>
    (loose ? onLooseFloor(point) : onFloor(point)) &&
    !blockers.some((box) => strictlyContains(box, point));
  const segmentClear = (from, to, fromLoose, toLoose) => {
    const length = planarDistance(from, to);
    const count = Math.max(1, Math.ceil(length / spacing));
    for (let index = 0; index <= count; index += 1) {
      const t = index / count;
      const point = {
        x: from.x + (to.x - from.x) * t,
        z: from.z + (to.z - from.z) * t,
      };
      const loose =
        (fromLoose && t * length <= relaxDistance) ||
        (toLoose && (1 - t) * length <= relaxDistance);
      if (!pointClear(point, loose)) return false;
    }
    return true;
  };
  const withLevel = (point) => ({ x: point.x, y: level, z: point.z });

  if (segmentClear(start, goal, startLoose, goalLoose))
    return { waypoints: [withLevel(goal)], direct: true };

  const nodes = [start, goal];
  for (const box of blockers)
    for (const corner of cornersOf(expand(box, 0.03)))
      if (pointClear(corner)) nodes.push(corner);
  for (const box of floors) {
    const inner = expand(box, -(edgeInset + 0.03));
    if (!hasArea(inner)) continue;
    for (const corner of cornersOf(inner))
      if (pointClear(corner)) nodes.push(corner);
  }
  const distance = nodes.map(() => Infinity);
  const previous = nodes.map(() => -1);
  const settled = nodes.map(() => false);
  distance[0] = 0;
  for (;;) {
    let current = -1;
    for (let index = 0; index < nodes.length; index += 1)
      if (
        !settled[index] &&
        distance[index] < Infinity &&
        (current < 0 || distance[index] < distance[current])
      )
        current = index;
    if (current < 0 || current === 1) break;
    settled[current] = true;
    for (let next = 1; next < nodes.length; next += 1) {
      if (settled[next]) continue;
      const cost =
        distance[current] + planarDistance(nodes[current], nodes[next]);
      if (cost >= distance[next]) continue;
      if (
        !segmentClear(
          nodes[current],
          nodes[next],
          current === 0 && startLoose,
          next === 1 && goalLoose,
        )
      )
        continue;
      distance[next] = cost;
      previous[next] = current;
    }
  }
  if (distance[1] === Infinity) return null;
  const waypoints = [];
  for (let index = 1; index > 0; index = previous[index])
    waypoints.unshift(withLevel(nodes[index]));
  return { waypoints, direct: false };
}

// ---------------------------------------------------------------------------
// Sweeper prediction (mirrors src/game/obby.ts sampling and contact)
// ---------------------------------------------------------------------------

function cycleAngle(period, phase, time) {
  const seconds = Number(period);
  const offset = Number(phase ?? 0) || 0;
  if (!(Number.isFinite(seconds) && seconds > 0)) return offset;
  const wrapped = ((time % seconds) + seconds) % seconds;
  return offset + (2 * Math.PI * wrapped) / seconds;
}

/** The sweeper capsule at a course time, as the game samples it. */
export function sampleSweeper(piece, timeSeconds) {
  const center = { ...piece.center };
  const distance = Number(piece.motion?.distance ?? 0);
  const period = Number(piece.motion?.period ?? 0);
  if (distance && Number.isFinite(period) && period > 0) {
    const offset =
      distance * Math.sin(cycleAngle(period, piece.motion.phase, timeSeconds));
    if (piece.motion.axis === "z") center.z += offset;
    else center.x += offset;
  }
  const angle = piece.rotation
    ? cycleAngle(piece.rotation.period, piece.rotation.phase, timeSeconds)
    : 0;
  const halfLength = Math.abs(piece.halfLength ?? 0);
  const dx = Math.cos(angle) * halfLength;
  const dz = -Math.sin(angle) * halfLength;
  return {
    id: piece.id,
    center,
    start: { x: center.x - dx, y: center.y, z: center.z - dz },
    end: { x: center.x + dx, y: center.y, z: center.z + dz },
    radius: Math.abs(piece.radius ?? 0),
    angle,
  };
}

function segmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  const t =
    lengthSquared > 1e-12
      ? Math.max(
          0,
          Math.min(
            1,
            ((point.x - start.x) * dx + (point.z - start.z) * dz) /
              lengthSquared,
          ),
        )
      : 0;
  return Math.hypot(point.x - (start.x + dx * t), point.z - (start.z + dz * t));
}

/** Whether a sampled capsule touches a standing body at `feet`. */
export function sweeperTouches(capsule, feet, traveler) {
  if (capsule.radius <= 0) return false;
  const head = feet.y + traveler.height;
  const dy =
    capsule.center.y < feet.y
      ? feet.y - capsule.center.y
      : capsule.center.y > head
        ? capsule.center.y - head
        : 0;
  if (dy >= capsule.radius) return false;
  const reach = traveler.radius + Math.sqrt(capsule.radius ** 2 - dy * dy);
  return segmentDistance(feet, capsule.start, capsule.end) < reach;
}

/** Height above takeoff `seconds` into a jump, or null once it lands again. */
function jumpRise(seconds) {
  const { jumpVelocity, gravity } = LOCKSTEP_PHYSICS;
  const rise = jumpVelocity * seconds + 0.5 * gravity * seconds * seconds;
  return rise > 0 ? rise : null;
}

/** Seconds until a jump lands `rise` metres above its takeoff, or 0. */
export function jumpLandingSeconds(rise) {
  const { jumpVelocity, gravity } = LOCKSTEP_PHYSICS;
  const discriminant = jumpVelocity * jumpVelocity + 2 * gravity * rise;
  if (discriminant < 0) return 0;
  return (jumpVelocity + Math.sqrt(discriminant)) / -gravity;
}

/**
 * Aims a jump across two platform tops: take off from the shared gateway and
 * land a little past the far edge, as deep as the jump can carry.
 */
export function jumpAim(source, target, { depth = 0.6, inset = 0.45 } = {}) {
  const gateway = platformGateway(source, target);
  const dx = gateway.to.x - gateway.from.x;
  const dz = gateway.to.z - gateway.from.z;
  const length = Math.hypot(dx, dz);
  const ux = length > 1e-6 ? dx / length : 0;
  const uz = length > 1e-6 ? dz / length : 0;
  const carry =
    LOCKSTEP_PHYSICS.moveSpeed *
    jumpLandingSeconds(gateway.to.y - gateway.from.y) *
    0.8;
  const extra = Math.max(0, Math.min(depth, carry - length));
  const halfX = Math.max(0, target.size.x / 2 - inset);
  const halfZ = Math.max(0, target.size.z / 2 - inset);
  const clamp = (value, center, half) =>
    Math.max(center - half, Math.min(center + half, value));
  return {
    takeoff: gateway.from,
    landing: gateway.to,
    aim: {
      x: clamp(gateway.to.x + ux * extra, target.center.x, halfX),
      y: gateway.to.y,
      z: clamp(gateway.to.z + uz * extra, target.center.z, halfZ),
    },
  };
}

// ---------------------------------------------------------------------------
// Per-frame route motion
// ---------------------------------------------------------------------------

function isMovingPlatform(document, platformId) {
  return document.pieces.some(
    (piece) => piece.id === platformId && piece.type === "moving-platform",
  );
}

/** Position `distance` metres along a polyline that starts at `position`. */
function alongPath(position, waypoints, distance) {
  let from = position;
  let remaining = distance;
  for (const waypoint of waypoints) {
    const length = planarDistance(from, waypoint);
    if (remaining <= length && length > 1e-9) {
      const t = remaining / length;
      return {
        x: from.x + (waypoint.x - from.x) * t,
        z: from.z + (waypoint.z - from.z) * t,
      };
    }
    remaining -= length;
    from = waypoint;
  }
  return { x: from.x, z: from.z };
}

/**
 * Per-frame lockstep implementations of the authored route driver's motion.
 * `read` is the driver's accounted read; `inspect` is the raw inspection.
 */
export function createLockstepMotion({
  lockstep,
  read,
  inspect,
  document,
  mark,
  screenshot,
  evidence,
}) {
  const { keys } = lockstep;
  const fine = lockstep.frameMs;
  const cruise = lockstep.cruiseFrameMs;
  // Jump arcs are exact at any frame size, so flight steers in 32 ms frames;
  // the aim sits well inside the landing top.
  const air = Math.min(cruise, 2 * fine);
  let lastHeld = [];

  const sweepers = () =>
    document().pieces.filter((piece) => piece.type === "sweeper");
  const movement = () =>
    Object.fromEntries(
      document()
        .pieces.filter((piece) => piece.type === "moving-platform")
        .map((piece) => {
          const travel = Math.abs(piece.motion?.distance ?? 0);
          return [
            piece.id,
            piece.motion?.axis === "z"
              ? { x: 0, z: travel }
              : { x: travel, z: 0 },
          ];
        }),
    );

  /**
   * Holds `wanted`, pressing again when the game cleared held keys, as it
   * does whenever the world pauses.
   */
  const apply = async (inspection, wanted) => {
    const heldX =
      Number(lastHeld.includes("KeyD")) - Number(lastHeld.includes("KeyA"));
    const heldY =
      Number(lastHeld.includes("KeyW")) - Number(lastHeld.includes("KeyS"));
    const input = inspection?.input ?? {};
    const cleared =
      (heldX || heldY) &&
      ACTIVE_PHASES.has(inspection?.status?.phase ?? "exploring") &&
      (Math.sign(input.moveX ?? 0) !== heldX ||
        Math.sign(input.moveY ?? 0) !== heldY);
    if (cleared && wanted.length) await keys.resync(wanted);
    else await keys.hold(wanted);
    lastHeld = [...wanted];
  };
  const release = async () => {
    await keys.release();
    lastHeld = [];
  };

  const waitFor = async ({
    label,
    predicate,
    timeout = 15_000,
    frame = cruise,
  }) => {
    const bound = lockstep.budget(timeout);
    let latest;
    for (;;) {
      latest = await inspect();
      if (latest && (await predicate(latest))) return latest;
      if (bound.expired()) break;
      await lockstep.step(frame);
    }
    await screenshot(`${label}-failure`).catch(() => undefined);
    throw new Error(
      `${label} did not reach its inspected state: ${JSON.stringify(latest)}`,
    );
  };

  /** Chooses walk/jump/wait/back near a sweeper from predicted contact. */
  const hazardAction = (inspection, pathAhead, allowJump) => {
    const pieces = sweepers();
    if (!pieces.length) return null;
    const position = inspection.status.position;
    const near = pieces.filter((piece) =>
      contains(expand(sweeperFootprint(piece), 2.5), position),
    );
    if (!near.length) return null;
    const traveler = travelerFor(inspection.status.appearanceStage);
    const time = inspection.obby.timeSeconds ?? 0;
    const speed = LOCKSTEP_PHYSICS.moveSpeed;
    const firstContact = (placeAt, riseAt, horizon) => {
      for (let t = 0; t <= horizon + 1e-9; t += 0.02) {
        const place = placeAt(t);
        const feet = { x: place.x, y: position.y + riseAt(t), z: place.z };
        const hit = near.find((piece) =>
          sweeperTouches(sampleSweeper(piece, time + t), feet, traveler),
        );
        if (hit) return { t, hit };
      }
      return null;
    };
    const walking = (t) => alongPath(position, pathAhead, speed * t);
    const standing = () => position;
    const first = pathAhead[0] ?? position;
    const away = { x: position.x - first.x, z: position.z - first.z };
    const awayLength = Math.hypot(away.x, away.z) || 1;
    const backing = (t) => ({
      x: position.x + (away.x / awayLength) * speed * t,
      z: position.z + (away.z / awayLength) * speed * t,
    });
    const ground = () => 0;
    const airborne = (t) => jumpRise(t) ?? 0;
    const walk = firstContact(walking, ground, 0.8);
    // With no contact ahead for 0.8 s, even a longer frame is safe.
    if (!walk) return { action: "walk", clear: true };
    if (walk.t > 0.35) return { action: "walk" };
    if (allowJump && !firstContact(walking, airborne, 0.75))
      return { action: "jump", hazard: walk.hit };
    if (!firstContact(standing, ground, 0.35))
      return { action: "wait", hazard: walk.hit };
    if (!firstContact(backing, ground, 0.35))
      return { action: "back", hazard: walk.hit };
    return { action: allowJump ? "jump" : "wait", hazard: walk.hit };
  };

  const moveToPoint = async (
    targetFor,
    {
      label,
      tolerance = 0.5,
      supportId = null,
      allowHazardJump = true,
      stopOnRecovery = false,
      done = null,
      allowDocumentExit = false,
    } = {},
  ) => {
    let best = Number.POSITIVE_INFINITY;
    const recoveryCount = (await read(`${label}-start`)).obby.recoveries;
    const bound = lockstep.budget(25_000);
    let route = null;
    let stall = { index: -1, best: Number.POSITIVE_INFINITY, since: 0 };
    const leave = async (inspection) => {
      await release();
      return inspection;
    };
    while (!bound.expired()) {
      const inspection = await read(label, { allowDocumentExit });
      if (inspection.level.authored?.id !== document().id) {
        assert.ok(
          done && (await done(inspection)),
          `${label}: left the authored document before reaching the target`,
        );
        return leave(inspection);
      }
      if (stopOnRecovery && inspection.obby.recoveries > recoveryCount)
        return leave(inspection);
      if (done && (await done(inspection))) return leave(inspection);
      const target = targetFor(inspection);
      assert.ok(target, `${label}: movement target unavailable`);
      const position = inspection.status.position;
      const distance = planarDistance(position, target);
      best = Math.min(best, distance);
      if (
        distance <= tolerance &&
        (!supportId || inspection.obby.supportId === supportId)
      )
        return leave(inspection);
      if (distance < 0.08 && inspection.obby.supportId !== supportId) {
        await release();
        if (!inspection.status.grounded) {
          const settled = await lockstep.until(
            async () => {
              const candidate = await read(`${label}-arrival-settle`, {
                allowDocumentExit,
              });
              if (candidate.level.authored?.id !== document().id) {
                assert.ok(
                  done && (await done(candidate)),
                  `${label}: left the authored document before reaching the target`,
                );
                return candidate;
              }
              if (candidate.obby.recoveries > recoveryCount) return candidate;
              return candidate.status.grounded ? candidate : null;
            },
            { timeout: 6_000, frame: fine },
          );
          if (!settled) {
            await screenshot(`${label}-arrival-unsettled`);
            throw new Error(
              `${label}: planar arrival stayed airborne without a supported landing`,
            );
          }
          if (
            settled.level.authored?.id === document().id &&
            settled.obby.recoveries <= recoveryCount &&
            settled.obby.supportId !== supportId
          )
            mark("movement:support-changed", {
              label,
              requestedSupportId: supportId,
              supportId: settled.obby.supportId,
              position: settled.status.position,
            });
          return settled;
        }
        mark("movement:support-changed", {
          label,
          requestedSupportId: supportId,
          supportId: inspection.obby.supportId,
          position,
        });
        return inspection;
      }

      // A paused or fallen world ignores input; wait for play to resume.
      if (!ACTIVE_PHASES.has(inspection.status.phase ?? "exploring")) {
        await release();
        route = null;
        await lockstep.step(cruise);
        continue;
      }

      const grounded = inspection.status.grounded;
      const traveler = travelerFor(inspection.status.appearanceStage);
      if (grounded) {
        const replan =
          !route ||
          route.supportId !== inspection.obby.supportId ||
          Math.abs(route.level - position.y) > 0.02 ||
          planarDistance(route.goal, target) > 0.25 ||
          route.stalled;
        if (replan) {
          // Prefer a wide berth; squeeze through narrow gaps (such as the
          // padded floor between two token steps) only when nothing else fits.
          // A sweeper is avoided at any clearance before it is crossed.
          const footprints = sweepers().map(sweeperFootprint);
          let planned = null;
          let clearance = 0;
          for (const sweeps of [footprints, []]) {
            for (const candidate of [0.15, 0.05, 0]) {
              planned = planWalk({
                platforms: inspection.obby.platforms,
                sweeps,
                start: position,
                goal: target,
                traveler,
                movement: movement(),
                clearance: candidate,
              });
              clearance = candidate;
              if (planned) break;
            }
            if (planned) break;
          }
          route = {
            supportId: inspection.obby.supportId,
            level: position.y,
            goal: { x: target.x, z: target.z },
            waypoints: planned?.waypoints ?? [
              { x: target.x, y: position.y, z: target.z },
            ],
            index: 0,
            from: { x: position.x, z: position.z },
            stalled: false,
            tight: !planned || clearance < 0.15,
          };
          if (!planned)
            mark("movement:no-path", { label, from: position, to: target });
          else if (!planned.direct)
            mark("movement:detour", {
              label,
              from: position,
              waypoints: planned.waypoints,
            });
          stall = { index: -1, best: Number.POSITIVE_INFINITY, since: 0 };
        }
      }

      // The final waypoint tracks a moving target such as a mascot or ferry.
      if (route) {
        route.waypoints[route.waypoints.length - 1] = {
          x: target.x,
          y: route.level,
          z: target.z,
        };
        while (route.index < route.waypoints.length - 1) {
          const waypoint = route.waypoints[route.index];
          const along =
            (position.x - route.from.x) * (waypoint.x - route.from.x) +
            (position.z - route.from.z) * (waypoint.z - route.from.z);
          const lengthSquared =
            (waypoint.x - route.from.x) ** 2 + (waypoint.z - route.from.z) ** 2;
          if (planarDistance(position, waypoint) > 0.1 && along < lengthSquared)
            break;
          route.from = { x: waypoint.x, z: waypoint.z };
          route.index += 1;
        }
      }
      const waypoint = route?.waypoints[route.index] ?? target;
      const finalLeg = !route || route.index === route.waypoints.length - 1;
      const toWaypoint = planarDistance(position, waypoint);

      const onMover = isMovingPlatform(
        document(),
        inspection.obby.supportId ?? "",
      );
      const ahead = route ? route.waypoints.slice(route.index) : [target];
      const hazard = grounded
        ? hazardAction(inspection, ahead, allowHazardJump)
        : null;
      const holding = hazard?.action === "wait" || hazard?.action === "back";

      // Stalls (a body in the way, an unmodelled wall) earn a fresh plan.
      if (route && grounded && !holding) {
        if (stall.index !== route.index || toWaypoint < stall.best - 0.02)
          stall = { index: route.index, best: toWaypoint, since: 0 };
        else stall.since += 1;
        if (stall.since >= 30) {
          mark("movement:stalled", { label, position, waypoint });
          route.stalled = true;
        }
      }

      // Open floor away from the goal takes longer frames. Anything close,
      // airborne, on a moving platform, squeezed or facing a sweeper takes
      // 16 ms frames.
      const cruising =
        grounded &&
        (!hazard || hazard.clear) &&
        !onMover &&
        !route?.tight &&
        cruise > fine &&
        distance > 0.6 &&
        toWaypoint > 0.4;
      const frame = cruising ? cruise : grounded ? fine : air;
      let wanted;
      if (finalLeg && distance < 0.3)
        wanted = keysToward(target.x - position.x, target.z - position.z);
      else if (!grounded || !route)
        wanted = keysToward(
          waypoint.x - position.x,
          waypoint.z - position.z,
          0.05,
        );
      else
        wanted = followSegmentKeys(
          position,
          route.from,
          waypoint,
          (LOCKSTEP_PHYSICS.moveSpeed * frame) / 1_000,
        );
      let jump = false;
      if (hazard?.action === "wait") wanted = [];
      else if (hazard?.action === "back")
        wanted = keysToward(
          position.x - waypoint.x,
          position.z - waypoint.z,
          0,
        );
      else if (hazard?.action === "jump") {
        jump = true;
        const live = inspection.obby.hazards?.find(
          (entry) => entry.id === hazard.hazard.id,
        );
        evidence.hazardJumps.push({
          id: hazard.hazard.id,
          at: position,
          angle: live?.angle ?? null,
        });
        mark("hazard:jump", evidence.hazardJumps.at(-1));
      }
      lockstep.trace?.({
        label,
        frame: lockstep.stats.frames,
        position,
        waypoint,
        keys: wanted,
        hazard: hazard?.action ?? null,
        jump,
        frameMs: frame,
      });
      await apply(inspection, wanted);
      if (jump) await keys.press("Space");
      await lockstep.step(frame);
    }
    await release();
    await screenshot(`${label}-unreachable`);
    throw new Error(
      `${label}: target unreachable; nearest distance ${best.toFixed(2)}`,
    );
  };

  /**
   * Jumps from the current support toward `aimFor(inspection)`, steering in
   * the air every frame until the traveler lands or recovers.
   */
  const jump = async ({
    from,
    label,
    aimFor,
    recoveries,
    jumpSequence,
    steer = true,
    heldKeys = null,
    timeout = 3_000,
  }) => {
    let state = await read(`${label}-lift`);
    const aim = aimFor(state);
    const toward = (candidate, point) =>
      keysToward(
        point.x - candidate.status.position.x,
        point.z - candidate.status.position.z,
        0.05,
      );
    await apply(state, heldKeys ?? toward(state, aim));
    await keys.press("Space");
    const bound = lockstep.budget(timeout);
    let launched = false;
    let waitedForLift = 0;
    let airborneFrames = 0;
    try {
      while (!bound.expired()) {
        await lockstep.step(launched ? air : fine);
        state = await read(`${label}-air`);
        if (state.obby.recoveries > recoveries) return state;
        if (!launched) {
          launched = state.status.jumpSequence > jumpSequence;
          if (!launched) {
            // The first frame after a pause can defer a press by one frame.
            // Never walk off an edge on a press that has not lifted anyone.
            waitedForLift += 1;
            if (waitedForLift >= 2) return state;
            await apply(state, []);
            continue;
          }
        }
        airborneFrames += 1;
        const landed = state.status.grounded && state.obby.supportId !== null;
        if (landed && (state.obby.supportId !== from || airborneFrames > 3))
          return state;
        // Fixed keys are held again after a deferred lift released them.
        if (heldKeys) await apply(state, heldKeys);
        else if (steer) await apply(state, toward(state, aimFor(state)));
      }
      return state;
    } finally {
      await release();
    }
  };

  const edgeAim = (edge) => (candidate) =>
    jumpAim(
      livePlatform(candidate, edge.from),
      livePlatform(candidate, edge.to),
    ).aim;

  /** Crosses a jump edge after the takeoff approach; returns the landing. */
  const jumpEdge = async (edge, label, current) =>
    jump({
      from: edge.from,
      label,
      aimFor: edgeAim(edge),
      recoveries: current.obby.recoveries,
      jumpSequence: current.status.jumpSequence,
    });

  const hop = async (edge, label, phase) => {
    const bound = lockstep.budget(30_000);
    while (!bound.expired()) {
      const state = await read(`${label}-${phase}-wait`);
      if (state.obby.supportId !== edge.from) return state;
      const gateway = platformGateway(
        livePlatform(state, edge.from),
        livePlatform(state, edge.to),
      );
      if (planarDistance(state.status.position, gateway.from) > 0.15) {
        const approached = await moveToPoint(
          (candidate) =>
            platformGateway(
              livePlatform(candidate, edge.from),
              livePlatform(candidate, edge.to),
            ).from,
          {
            label: `${label}-${phase}-approach`,
            tolerance: 0.12,
            supportId: edge.from,
            allowHazardJump: phase === "board",
            stopOnRecovery: true,
          },
        );
        if (approached.obby.supportId !== edge.from) return approached;
        continue;
      }
      // Step frames until the moving platform comes within reach.
      if (planarDistance(gateway.from, gateway.to) > 1.45) {
        await lockstep.step(cruise);
        continue;
      }
      const landed = await jump({
        from: edge.from,
        label: `${label}-${phase}`,
        aimFor: edgeAim(edge),
        recoveries: state.obby.recoveries,
        jumpSequence: state.status.jumpSequence,
      });
      if (landed.obby.recoveries > state.obby.recoveries) return landed;
      if (landed.obby.supportId === edge.to && landed.status.grounded)
        return landed;
    }
    throw new Error(
      `${label}: moving platform never came within reach to ${phase}`,
    );
  };

  const ride = async (edge, label) => {
    await read(`${label}-start`);
    const targetIsMoving = isMovingPlatform(document(), edge.to);
    const sourceIsMoving = isMovingPlatform(document(), edge.from);
    assert.ok(
      targetIsMoving || sourceIsMoving,
      `${label}: ride edge has no moving platform`,
    );
    if (!targetIsMoving) return hop(edge, label, "disembark");
    const boarded = await hop(edge, label, "board");
    if (boarded.obby.supportId !== edge.to) return boarded;
    const ferryAtBoard = livePlatform(boarded, edge.to);
    const riderOffset = {
      x: boarded.status.position.x - ferryAtBoard.center.x,
      z: boarded.status.position.z - ferryAtBoard.center.z,
    };
    const carryRecoveries = boarded.obby.recoveries;
    await release();
    const carried = await waitFor({
      label: `${label}-carried`,
      timeout: 20_000,
      predicate: (candidate) => {
        if (candidate.obby?.recoveries > carryRecoveries) return true;
        if (candidate.obby?.supportId !== edge.to) return false;
        const live = livePlatform(candidate, edge.to);
        return planarDistance(live.center, ferryAtBoard.center) >= 0.12;
      },
    });
    if (carried.obby.supportId !== edge.to) return carried;
    const ferryAfterCarry = livePlatform(carried, edge.to);
    const offsetAfter = {
      x: carried.status.position.x - ferryAfterCarry.center.x,
      z: carried.status.position.z - ferryAfterCarry.center.z,
    };
    const offsetDrift = planarDistance(riderOffset, offsetAfter);
    assert.ok(
      offsetDrift < 0.08,
      `${label}: player was not carried by the ferry`,
    );
    const record = {
      edge,
      supportId: carried.obby.supportId,
      platformTravel: planarDistance(
        ferryAtBoard.center,
        ferryAfterCarry.center,
      ),
      riderOffset,
      offsetDrift,
    };
    evidence.ferryEvidence.push(record);
    mark("ride:carried", record);
    return carried;
  };

  /** Deliberately misses along the travel axis onto the declared catch. */
  const missJump = async ({ before, edge, label, direction }) =>
    jump({
      from: edge.from,
      label,
      aimFor: () => before.status.position,
      recoveries: before.obby.recoveries,
      jumpSequence: before.status.jumpSequence,
      steer: false,
      heldKeys: keysToward(direction.x, direction.z, 0),
      timeout: 8_000,
    });

  return {
    moveToPoint,
    jumpEdge,
    ride,
    missJump,
    waitFor,
    release,
  };
}
