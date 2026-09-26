/**
 * Small geometry helpers for the World A chapter-three generator
 * (`scripts/levels/family/a3.ts`). They only shape JSON on top of
 * `scripts/levels/lib/growth-kit.ts`: nothing here applies, validates or
 * bypasses a shared rule. The shared validators and family lints stay the
 * authority, and the chapter test runs them.
 *
 * Coordinates are metres; +y is up and the player faces −z at yaw 0. A
 * `Rect` is a horizontal footprint. A *building* is a static platform whose
 * box rests on the visual street plane (y = −1.4), so it reads as a solid
 * block from below; a *slab* is a thin deck.
 */
import type {
  AuthoredAnchor,
  AuthoredArena,
  AuthoredBouncePadPiece,
  AuthoredCheckpointPiece,
  AuthoredDecor,
  AuthoredEncounterAnchor,
  AuthoredLevelDocument,
  AuthoredLevelPiece,
  AuthoredLiftPiece,
  AuthoredMotion,
  AuthoredMovingPlatformPiece,
  AuthoredPlatformPiece,
  AuthoredSweeperPiece,
} from "../../../src/shared/authored-level.js";
import {
  AUTHORED_LEVEL_LIMITS,
  AUTHORED_LEVEL_V4_LIMITS,
} from "../../../src/shared/authored-level.js";
import { BOUNCE_PAD_VELOCITY, type BouncePadStrength } from "../../../src/shared/abilities.js";
import {
  decorWorldBounds,
  themeKitProp,
  type ThemeKitBounds,
} from "../../../src/shared/theme-kits.js";
import {
  bouncePad,
  decor,
  lift,
  mm,
  platform,
  platformCheckpoint,
} from "../lib/growth-kit.js";

/** The course's visual street plane; it is not collision. */
export const A3_STREET_Y = -1.4;

export interface Rect {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export function rect(minX: number, maxX: number, minZ: number, maxZ: number): Rect {
  if (!(minX < maxX && minZ < maxZ)) throw new Error(`Bad rect ${minX},${maxX},${minZ},${maxZ}`);
  return { minX: mm(minX), maxX: mm(maxX), minZ: mm(minZ), maxZ: mm(maxZ) };
}

function footprint(area: Rect) {
  return {
    x: (area.minX + area.maxX) / 2,
    z: (area.minZ + area.maxZ) / 2,
    sizeX: area.maxX - area.minX,
    sizeZ: area.maxZ - area.minZ,
  };
}

/** A static block from the street up to `top`. */
export function building(id: string, area: Rect, top: number): AuthoredPlatformPiece {
  return platform(id, { ...footprint(area), top, thickness: top - A3_STREET_Y });
}

/** A thin static deck (default 0.6 m). */
export function slab(id: string, area: Rect, top: number, thickness = 0.6): AuthoredPlatformPiece {
  return platform(id, { ...footprint(area), top, thickness });
}

/** A 0.6 m moving deck sliding along `motion.axis`. */
export function mover(
  id: string,
  area: Rect,
  top: number,
  motion: AuthoredMotion,
): AuthoredMovingPlatformPiece {
  const box = platform(id, { ...footprint(area), top, thickness: 0.6 });
  return { ...box, type: "moving-platform", motion };
}

/** A 0.4 m lift that starts at its bottom stop, dwell first. */
export function liftCar(
  id: string,
  area: Rect,
  bottomTop: number,
  distance: number,
  period: number,
  dwell: number,
): AuthoredLiftPiece {
  return lift(id, { ...footprint(area), bottomTop, distance, period, dwell, thickness: 0.4 });
}

/** A bounce pad whose box rests on the street, so nothing hangs under it. */
export function padBlock(
  id: string,
  area: Rect,
  top: number,
  strength: BouncePadStrength,
): AuthoredBouncePadPiece {
  return bouncePad(id, { ...footprint(area), top, strength, thickness: top - A3_STREET_Y });
}

export function topOf(piece: { readonly center: { y: number }; readonly size: { y: number } }): number {
  return mm(piece.center.y + piece.size.y / 2);
}

export function rectOf(piece: {
  readonly center: { x: number; z: number };
  readonly size: { x: number; z: number };
}): Rect {
  return {
    minX: mm(piece.center.x - piece.size.x / 2),
    maxX: mm(piece.center.x + piece.size.x / 2),
    minZ: mm(piece.center.z - piece.size.z / 2),
    maxZ: mm(piece.center.z + piece.size.z / 2),
  };
}

/** A checkpoint armed anywhere on its platform, at the platform top. */
export function checkpointOn(
  id: string,
  support: AuthoredPlatformPiece,
  x: number,
  z: number,
): AuthoredCheckpointPiece {
  return platformCheckpoint(id, support.id, { x, y: topOf(support), z });
}

export function anchorOn(support: AuthoredPlatformPiece, x: number, z: number): AuthoredAnchor {
  return { platformId: support.id, position: { x: mm(x), y: topOf(support), z: mm(z) } };
}

export function encounterOn(
  kind: AuthoredEncounterAnchor["kind"],
  support: AuthoredPlatformPiece,
  arena: Rect,
  checkpointId: string,
): AuthoredEncounterAnchor {
  const x = (arena.minX + arena.maxX) / 2;
  const z = (arena.minZ + arena.maxZ) / 2;
  return {
    kind,
    ...anchorOn(support, x, z),
    arena: { minX: arena.minX, maxX: arena.maxX, minZ: arena.minZ, maxZ: arena.maxZ } as AuthoredArena,
    checkpointId,
  };
}

/** A padded bar spinning about its centre, 0.25 m above a deck. */
export function spinner(
  id: string,
  at: { readonly x: number; readonly z: number },
  deckTop: number,
  halfLength: number,
  period: number,
  phase = 0,
  radius = 0.22,
): AuthoredSweeperPiece {
  return {
    type: "sweeper",
    id,
    center: { x: mm(at.x), y: mm(deckTop + 0.25), z: mm(at.z) },
    halfLength,
    radius,
    rotation: phase === 0 ? { period } : { period, phase },
  };
}

/** A padded bar lying along x that slides along `motion.axis`. */
export function slider(
  id: string,
  at: { readonly x: number; readonly z: number },
  deckTop: number,
  halfLength: number,
  motion: AuthoredMotion,
  radius = 0.2,
): AuthoredSweeperPiece {
  return {
    type: "sweeper",
    id,
    center: { x: mm(at.x), y: mm(deckTop + 0.22), z: mm(at.z) },
    halfLength,
    radius,
    motion,
  };
}

// ---------------------------------------------------------------------------
// Decor: placement rules and a local clearance check.
// ---------------------------------------------------------------------------

/** The four faces of a footprint: toward +x, −x, +z (the camera) and −z. */
export type Face = "px" | "nx" | "pz" | "nz";

/** Rotation that turns a prop's front (+z at rotation 0) outward from `face`. */
export function outwardRotation(face: Face): number {
  switch (face) {
    case "pz":
      return 0;
    case "px":
      return mm(Math.PI / 2);
    case "nz":
      return mm(Math.PI);
    case "nx":
      return mm(-Math.PI / 2);
  }
}

function propBounds(kitPropId: string): ThemeKitBounds {
  const prop = themeKitProp(kitPropId);
  if (!prop) throw new Error(`Theme-kit prop ${kitPropId} is not registered`);
  return prop.bounds;
}

/**
 * A prop hung just outside one face of `area` (0.05 m off the wall), shifted
 * `along` the face from its middle, its floor `yOffset` from `top`, facing
 * outward (or inward with `inward`).
 */
export function wallProp(
  id: string,
  kitPropId: string,
  area: Rect,
  top: number,
  face: Face,
  along: number,
  yOffset: number,
  options: { readonly scale?: number; readonly inward?: boolean } = {},
): AuthoredDecor {
  const scale = options.scale ?? 1;
  const bounds = propBounds(kitPropId);
  const depth = (bounds.max.z - bounds.min.z) * scale;
  const standOff = depth / 2 + 0.05;
  const midX = (area.minX + area.maxX) / 2;
  const midZ = (area.minZ + area.maxZ) / 2;
  const position =
    face === "px"
      ? { x: area.maxX + standOff, z: midZ + along }
      : face === "nx"
        ? { x: area.minX - standOff, z: midZ + along }
        : face === "pz"
          ? { x: midX + along, z: area.maxZ + standOff }
          : { x: midX + along, z: area.minZ - standOff };
  const rotationY = normalizedAngle(outwardRotation(face) + (options.inward ? Math.PI : 0));
  return decor(id, kitPropId, { ...position, y: top + yOffset }, { rotationY, scale });
}

/** An angle in (−π, π], rounded to the millimetre-radian. */
export function normalizedAngle(radians: number): number {
  let angle = radians % (2 * Math.PI);
  if (angle <= -Math.PI) angle += 2 * Math.PI;
  if (angle > Math.PI) angle -= 2 * Math.PI;
  return mm(angle);
}

/** A prop standing on the street, or on another prop's top when `baseY` is given. */
export function standingProp(
  id: string,
  kitPropId: string,
  at: { readonly x: number; readonly z: number },
  options: { readonly rotationY?: number; readonly scale?: number; readonly baseY?: number } = {},
): AuthoredDecor {
  return decor(
    id,
    kitPropId,
    { x: at.x, y: options.baseY ?? A3_STREET_Y, z: at.z },
    { rotationY: options.rotationY ?? 0, scale: options.scale ?? 1 },
  );
}

/** Height of a prop's top above its floor at `scale`. */
export function propHeight(kitPropId: string, scale: number): number {
  const bounds = propBounds(kitPropId);
  return (bounds.max.y - bounds.min.y) * scale;
}

interface Box3 {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export function decorBox(entry: AuthoredDecor): Box3 {
  const world = decorWorldBounds(propBounds(entry.kitPropId), entry);
  return {
    minX: world.min.x,
    maxX: world.max.x,
    minY: world.min.y,
    maxY: world.max.y,
    minZ: world.min.z,
    maxZ: world.max.z,
  };
}

const EPSILON = 1e-6;

function overlap2(a: Rect, b: Rect, margin = 0): boolean {
  return (
    Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > -margin + EPSILON &&
    Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ) > -margin + EPSILON
  );
}

interface KeepOut {
  readonly label: string;
  readonly area: Rect;
  readonly floor: number;
  readonly highest: number;
}

type Surface = Exclude<AuthoredLevelPiece, AuthoredSweeperPiece | AuthoredCheckpointPiece>;

function isSurface(piece: AuthoredLevelPiece): piece is Surface {
  return piece.type !== "sweeper" && piece.type !== "checkpoint";
}

function surfaceArea(piece: Surface): Rect {
  const base = rectOf(piece);
  if (piece.type !== "moving-platform") return base;
  const reach = piece.motion.distance;
  return piece.motion.axis === "x"
    ? { ...base, minX: base.minX - reach, maxX: base.maxX + reach }
    : { ...base, minZ: base.minZ - reach, maxZ: base.maxZ + reach };
}

function topRange(piece: Surface): { min: number; max: number } {
  const top = piece.center.y + piece.size.y / 2;
  return piece.type === "lift" ? { min: top, max: top + piece.travel.distance } : { min: top, max: top };
}

function apex(strength: BouncePadStrength): number {
  return BOUNCE_PAD_VELOCITY[strength] ** 2 / 30;
}

/** The validator's corridor: the whole avatar-expanded common lane between two surfaces' facing edges. */
function corridor(from: Surface, to: Surface): Rect | null {
  const deltaX = to.center.x - from.center.x;
  const deltaZ = to.center.z - from.center.z;
  const travel = Math.abs(deltaX) >= Math.abs(deltaZ) ? "x" : "z";
  const cross = travel === "x" ? "z" : "x";
  const direction = (travel === "x" ? deltaX : deltaZ) < 0 ? -1 : 1;
  const radius = AUTHORED_LEVEL_LIMITS.supportEdgeClearance;
  const lane = (piece: Surface) => {
    const inset =
      piece.type === "moving-platform" && piece.motion.axis === cross ? piece.motion.distance : 0;
    return {
      min: piece.center[cross] - piece.size[cross] / 2 + radius + inset,
      max: piece.center[cross] + piece.size[cross] / 2 - radius - inset,
    };
  };
  const a = lane(from);
  const b = lane(to);
  const crossMin = Math.max(a.min, b.min) - radius;
  const crossMax = Math.min(a.max, b.max) + radius;
  if (crossMax - crossMin <= EPSILON) return null;
  const fromEdge = from.center[travel] + (direction * from.size[travel]) / 2;
  const toEdge = to.center[travel] - (direction * to.size[travel]) / 2;
  const travelMin = Math.min(fromEdge, toEdge) - radius;
  const travelMax = Math.max(fromEdge, toEdge) + radius;
  return travel === "x"
    ? { minX: travelMin, maxX: travelMax, minZ: crossMin, maxZ: crossMax }
    : { minX: crossMin, maxX: crossMax, minZ: travelMin, maxZ: travelMax };
}

/**
 * Every volume a prop must keep out of, as DESIGN-025 D-04 and the validator
 * define them (walkable space above each surface, each connection corridor
 * and each fight's strike envelope), plus `extra` keep-outs a generator adds
 * for its own taste (for example a margin around every roof).
 */
export function decorKeepOuts(level: Pick<AuthoredLevelDocument, "pieces" | "connections" | "anchors">): KeepOut[] {
  const surfaces = new Map<string, Surface>();
  for (const piece of level.pieces) if (isSurface(piece)) surfaces.set(piece.id, piece);
  const keepOuts: KeepOut[] = [];
  for (const piece of surfaces.values()) {
    const range = topRange(piece);
    keepOuts.push({
      label: piece.id,
      area: surfaceArea(piece),
      floor: range.min,
      highest: piece.type === "bounce-pad" ? range.max + apex(piece.strength) : range.max,
    });
  }
  level.connections.forEach((connection, index) => {
    const from = surfaces.get(connection.from);
    const to = surfaces.get(connection.to);
    if (!from || !to) return;
    const lane = corridor(from, to);
    if (!lane) return;
    const a = topRange(from);
    const b = topRange(to);
    keepOuts.push({
      label: `connection ${index}`,
      area: lane,
      floor: Math.min(a.min, b.min),
      highest: Math.max(a.max, b.max, from.type === "bounce-pad" ? a.max + apex(from.strength) : 0),
    });
  });
  for (const [slot, encounter] of Object.entries(level.anchors.encounters)) {
    if (!encounter) continue;
    const support = surfaces.get(encounter.platformId);
    if (!support) continue;
    const reach =
      encounter.kind === "boss"
        ? AUTHORED_LEVEL_LIMITS.bossAttackReach
        : AUTHORED_LEVEL_LIMITS.ordinaryAttackReach;
    const top = topRange(support).min;
    keepOuts.push({
      label: `${slot} fight`,
      area: {
        minX: encounter.arena.minX - reach,
        maxX: encounter.arena.maxX + reach,
        minZ: encounter.arena.minZ - reach,
        maxZ: encounter.arena.maxZ + reach,
      },
      floor: top,
      highest: top,
    });
  }
  return keepOuts;
}

/** The first keep-out a prop intersects, mirroring the validator's decor.clearance test. */
export function decorBlockedBy(entry: AuthoredDecor, keepOuts: readonly KeepOut[]): string | null {
  const box = decorBox(entry);
  const area: Rect = { minX: box.minX, maxX: box.maxX, minZ: box.minZ, maxZ: box.maxZ };
  const hit = keepOuts.find(
    (keepOut) =>
      overlap2(area, keepOut.area) &&
      box.maxY > keepOut.floor + EPSILON &&
      box.minY < keepOut.highest + AUTHORED_LEVEL_V4_LIMITS.overheadClearance - EPSILON,
  );
  return hit ? hit.label : null;
}

/**
 * Accepts `candidates` in order, dropping any prop that the clearance rule
 * rejects, that overlaps an accepted prop (except the prop it stands on,
 * named by `stackedOn`), or that the optional `reject` test refuses. The
 * result depends only on the inputs, so a generator replays byte-identically.
 */
export function acceptDecor(
  candidates: readonly { readonly entry: AuthoredDecor; readonly stackedOn?: string }[],
  keepOuts: readonly KeepOut[],
  options: {
    readonly limit?: number;
    readonly spacing?: number;
    readonly reject?: (box: Box3) => boolean;
    /** Props already placed: new ones keep clear of them but they are not returned. */
    readonly existing?: readonly AuthoredDecor[];
  } = {},
): AuthoredDecor[] {
  const accepted: AuthoredDecor[] = [];
  const boxes = new Map<string, Box3>();
  for (const entry of options.existing ?? []) boxes.set(entry.id, decorBox(entry));
  const spacing = options.spacing ?? 0.1;
  for (const { entry, stackedOn } of candidates) {
    if (options.limit !== undefined && accepted.length >= options.limit) break;
    if (stackedOn !== undefined && !boxes.has(stackedOn)) continue;
    if (decorBlockedBy(entry, keepOuts)) continue;
    const box = decorBox(entry);
    if (box.minY < A3_STREET_Y - EPSILON) continue;
    if (options.reject?.(box)) continue;
    const clash = [...boxes.entries()].some(([id, other]) => {
      if (id === stackedOn) return false;
      return (
        Math.min(box.maxX, other.maxX) - Math.max(box.minX, other.minX) > -spacing &&
        Math.min(box.maxZ, other.maxZ) - Math.max(box.minZ, other.minZ) > -spacing &&
        Math.min(box.maxY, other.maxY) - Math.max(box.minY, other.minY) > EPSILON
      );
    });
    if (clash) continue;
    accepted.push(entry);
    boxes.set(entry.id, box);
  }
  return accepted;
}

/** Deterministic hash in [0, 1) for rule-based variation. */
export function unitHash(index: number): number {
  return ((Math.imul(index, 2654435761) >>> 0) % 2 ** 32) / 2 ** 32;
}
