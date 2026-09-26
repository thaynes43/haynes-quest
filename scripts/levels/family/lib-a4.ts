/**
 * Small geometry helpers for the A4 chapter generator (`a4.ts`).
 *
 * Namespaced to A4 so parallel chapter builders never collide on a shared
 * file. Every helper only shapes JSON for the shared piece vocabulary in
 * `scripts/levels/lib/growth-kit.ts`; the shared validators remain the only
 * authority on whether the result is safe.
 *
 * Coordinates are metres, +x to the right of a player facing forward, y up,
 * forward is -z. Rectangles are horizontal footprints.
 */
import type {
  AuthoredAnchor,
  AuthoredArena,
  AuthoredBouncePadPiece,
  AuthoredCheckpointPiece,
  AuthoredEncounterAnchor,
  AuthoredMotion,
  AuthoredMovingPlatformPiece,
  AuthoredPlatformPiece,
  AuthoredRotation,
  AuthoredSweeperPiece,
} from "../../../src/shared/authored-level.js";
import type { BouncePadStrength } from "../../../src/shared/abilities.js";
import { bouncePad, mm, platform, platformCheckpoint } from "../lib/growth-kit.js";

/** The casino hall floor every room block rests on (CasinoScene's ground plane). */
export const A4_HALL_FLOOR = -1.4;

/** Avatar radius the validator insets anchors and checkpoints by. */
const EDGE_INSET = 0.3;

export interface A4Rect {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export function a4Rect(minX: number, maxX: number, minZ: number, maxZ: number): A4Rect {
  if (!(minX < maxX && minZ < maxZ)) throw new Error(`Degenerate rectangle ${minX},${maxX},${minZ},${maxZ}`);
  return { minX, maxX, minZ, maxZ };
}

function footprint(rect: A4Rect) {
  return {
    x: (rect.minX + rect.maxX) / 2,
    z: (rect.minZ + rect.maxZ) / 2,
    sizeX: rect.maxX - rect.minX,
    sizeZ: rect.maxZ - rect.minZ,
  };
}

/** Standing height of a surface's top face. */
export function a4Top(piece: { readonly center: { readonly y: number }; readonly size: { readonly y: number } }): number {
  return mm(piece.center.y + piece.size.y / 2);
}

/** The horizontal footprint of a static surface. */
export function a4Bounds(piece: AuthoredPlatformPiece): A4Rect {
  return {
    minX: mm(piece.center.x - piece.size.x / 2),
    maxX: mm(piece.center.x + piece.size.x / 2),
    minZ: mm(piece.center.z - piece.size.z / 2),
    maxZ: mm(piece.center.z + piece.size.z / 2),
  };
}

/** A solid room or tower standing on `base` (the hall floor by default). */
export function a4Block(id: string, rect: A4Rect, top: number, base = A4_HALL_FLOOR): AuthoredPlatformPiece {
  if (top <= base) throw new Error(`Block ${id} must stand above its base`);
  return platform(id, { ...footprint(rect), top, thickness: top - base });
}

/** A thin deck (0.6 m by default), like the published terraces and token steps. */
export function a4Slab(id: string, rect: A4Rect, top: number, thickness = 0.6): AuthoredPlatformPiece {
  return platform(id, { ...footprint(rect), top, thickness });
}

export function a4Pad(
  id: string,
  rect: A4Rect,
  top: number,
  strength: BouncePadStrength,
  thickness = 0.6,
): AuthoredBouncePadPiece {
  return bouncePad(id, { ...footprint(rect), top, thickness, strength });
}

/**
 * A horizontal mover. Its motion must run across the footprint's travel axis
 * with at least an avatar of standing room left at either extreme.
 */
export function a4Mover(
  id: string,
  rect: A4Rect,
  top: number,
  motion: AuthoredMotion,
  thickness = 0.6,
): AuthoredMovingPlatformPiece {
  const spec = footprint(rect);
  const half = (motion.axis === "x" ? spec.sizeX : spec.sizeZ) / 2;
  if (half <= EDGE_INSET + motion.distance)
    throw new Error(`Mover ${id} is too narrow for its ${motion.distance}m ${motion.axis} motion`);
  return {
    type: "moving-platform",
    id,
    center: { x: mm(spec.x), y: mm(top - thickness / 2), z: mm(spec.z) },
    size: { x: mm(spec.sizeX), y: mm(thickness), z: mm(spec.sizeZ) },
    motion,
  };
}

/** A padded bar at knee height over a deck (0.22 m above its top, like the published sweepers). */
export function a4Sweeper(
  id: string,
  at: { readonly x: number; readonly z: number },
  deckTop: number,
  halfLength: number,
  movement: { readonly rotation: AuthoredRotation } | { readonly motion: AuthoredMotion },
  radius = 0.2,
): AuthoredSweeperPiece {
  return {
    type: "sweeper",
    id,
    center: { x: mm(at.x), y: mm(deckTop + 0.22), z: mm(at.z) },
    halfLength,
    radius,
    ...movement,
  };
}

function assertSupported(support: AuthoredPlatformPiece, x: number, z: number, what: string): void {
  const bounds = a4Bounds(support);
  if (
    x < bounds.minX + EDGE_INSET - 1e-9 ||
    x > bounds.maxX - EDGE_INSET + 1e-9 ||
    z < bounds.minZ + EDGE_INSET - 1e-9 ||
    z > bounds.maxZ - EDGE_INSET + 1e-9
  )
    throw new Error(`${what} at (${x}, ${z}) is not inset 0.3 m on ${support.id}`);
}

/** A checkpoint armed anywhere on its static platform, standing on its top. */
export function a4Checkpoint(id: string, support: AuthoredPlatformPiece, x: number, z: number): AuthoredCheckpointPiece {
  assertSupported(support, x, z, `Checkpoint ${id}`);
  return platformCheckpoint(id, support.id, { x, y: a4Top(support), z });
}

/** A gameplay anchor standing on a static platform. */
export function a4Anchor(support: AuthoredPlatformPiece, x: number, z: number): AuthoredAnchor {
  assertSupported(support, x, z, "Anchor");
  return { platformId: support.id, position: { x: mm(x), y: a4Top(support), z: mm(z) } };
}

/** An encounter anchor: position inside its arena, arena on its deck. */
export function a4Encounter(
  kind: AuthoredEncounterAnchor["kind"],
  support: AuthoredPlatformPiece,
  arena: A4Rect,
  at: { readonly x: number; readonly z: number },
  checkpointId: string,
): AuthoredEncounterAnchor {
  if (at.x < arena.minX || at.x > arena.maxX || at.z < arena.minZ || at.z > arena.maxZ)
    throw new Error(`Encounter on ${support.id} must stand inside its arena`);
  const arenaRecord: AuthoredArena = {
    minX: mm(arena.minX),
    maxX: mm(arena.maxX),
    minZ: mm(arena.minZ),
    maxZ: mm(arena.maxZ),
  };
  return { ...a4Anchor(support, at.x, at.z), kind, arena: arenaRecord, checkpointId };
}
