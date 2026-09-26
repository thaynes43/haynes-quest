/**
 * Small geometry helpers for the World A chapter 1 generator (`a1.ts`).
 *
 * Namespaced to A1 so parallel chapter builders never collide on a shared
 * `lib.ts`. Every helper only shapes JSON on top of `growth-kit.ts`; the
 * shared validators stay the single authority on whether the course is safe.
 *
 * Conventions: x is east, y is up, the route runs toward −z (the default
 * camera looks −z). The visual course ground sits at y = −1.4, so an elevated
 * room is a solid block from the ground up to its standing top.
 */
import type {
  AuthoredAnchor,
  AuthoredArena,
  AuthoredCheckpointPiece,
  AuthoredDecor,
  AuthoredEncounterAnchor,
  AuthoredMovingPlatformPiece,
  AuthoredPlatformPiece,
  AuthoredSweeperPiece,
} from "../../../src/shared/authored-level.js";
import {
  crumble,
  decor,
  mm,
  platform,
  platformCheckpoint,
} from "../lib/growth-kit.js";

/** The course ground plane that era themes draw 1.4 m below y = 0. */
export const A1_GROUND = -1.4;

export interface A1Rect {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/** A footprint from its edges rather than its centre, for flush joins. */
export function edges(minX: number, maxX: number, minZ: number, maxZ: number): A1Rect {
  if (minX >= maxX || minZ >= maxZ) throw new Error("A1 rect edges are out of order");
  return { minX, maxX, minZ, maxZ };
}

/** A footprint from its centre and full size. */
export function sized(x: number, z: number, sizeX: number, sizeZ: number): A1Rect {
  return edges(x - sizeX / 2, x + sizeX / 2, z - sizeZ / 2, z + sizeZ / 2);
}

function footprint(rect: A1Rect) {
  return {
    x: mm((rect.minX + rect.maxX) / 2),
    z: mm((rect.minZ + rect.maxZ) / 2),
    sizeX: mm(rect.maxX - rect.minX),
    sizeZ: mm(rect.maxZ - rect.minZ),
  };
}

/** A solid block from the course ground up to `top`. */
export function block(id: string, rect: A1Rect, top: number): AuthoredPlatformPiece {
  return platform(id, { ...footprint(rect), top, thickness: mm(top - A1_GROUND) });
}

/** A toy block standing in the sandpit (its base sits at the sand's underside). */
export function sandBlock(
  id: string,
  rect: A1Rect,
  top: number,
  base: number,
): AuthoredPlatformPiece {
  return platform(id, { ...footprint(rect), top, thickness: mm(top - base) });
}

/** A slab of a given thickness (the sandpit catch floor). */
export function slab(
  id: string,
  rect: A1Rect,
  top: number,
  thickness: number,
): AuthoredPlatformPiece {
  return platform(id, { ...footprint(rect), top, thickness });
}

/** A crumbling column from the ground (branch routes only). */
export function crumbleColumn(id: string, rect: A1Rect, top: number) {
  return crumble(id, { ...footprint(rect), top, thickness: mm(top - A1_GROUND) });
}

/**
 * A 0.6 m tray that slides across the travel axis. Its half-width along the
 * motion axis must exceed the avatar inset plus the slide, so a centre lane
 * survives the whole motion.
 */
export function tray(
  id: string,
  rect: A1Rect,
  top: number,
  motion: { readonly axis: "x" | "z"; readonly distance: number; readonly period: number; readonly phase?: number },
): AuthoredMovingPlatformPiece {
  const half = motion.axis === "x" ? (rect.maxX - rect.minX) / 2 : (rect.maxZ - rect.minZ) / 2;
  if (half <= 0.3 + motion.distance)
    throw new Error(`Tray ${id} is too narrow for its ${motion.distance}m slide`);
  const box = footprint(rect);
  return {
    type: "moving-platform",
    id,
    center: { x: box.x, y: mm(top - 0.3), z: box.z },
    size: { x: box.sizeX, y: 0.6, z: box.sizeZ },
    motion: {
      axis: motion.axis,
      distance: motion.distance,
      period: motion.period,
      ...(motion.phase === undefined ? {} : { phase: motion.phase }),
    },
  };
}

/** A bar 0.22 m above a deck that rotates about its centre. */
export function spinner(
  id: string,
  at: { readonly x: number; readonly z: number },
  deckTop: number,
  halfLength: number,
  period: number,
  phase?: number,
): AuthoredSweeperPiece {
  return {
    type: "sweeper",
    id,
    center: { x: mm(at.x), y: mm(deckTop + 0.22), z: mm(at.z) },
    halfLength,
    radius: 0.2,
    rotation: { period, ...(phase === undefined ? {} : { phase }) },
  };
}

/** A bar 0.22 m above a deck that slides back and forth along an axis. */
export function slider(
  id: string,
  at: { readonly x: number; readonly z: number },
  deckTop: number,
  halfLength: number,
  motion: { readonly axis: "x" | "z"; readonly distance: number; readonly period: number; readonly phase?: number },
): AuthoredSweeperPiece {
  return {
    type: "sweeper",
    id,
    center: { x: mm(at.x), y: mm(deckTop + 0.22), z: mm(at.z) },
    halfLength,
    radius: 0.2,
    motion: {
      axis: motion.axis,
      distance: motion.distance,
      period: motion.period,
      ...(motion.phase === undefined ? {} : { phase: motion.phase }),
    },
  };
}

function topOf(piece: AuthoredPlatformPiece): number {
  return mm(piece.center.y + piece.size.y / 2);
}

/** A checkpoint armed anywhere on its platform, standing on its top. */
export function checkpointOn(
  id: string,
  support: AuthoredPlatformPiece,
  x: number,
  z: number,
): AuthoredCheckpointPiece {
  return platformCheckpoint(id, support.id, { x, y: topOf(support), z });
}

/** A gameplay anchor standing on a static platform's top. */
export function anchorOn(support: AuthoredPlatformPiece, x: number, z: number): AuthoredAnchor {
  return { platformId: support.id, position: { x: mm(x), y: topOf(support), z: mm(z) } };
}

/** An encounter anchor: its spawn point, arena and retry checkpoint. */
export function encounterOn(
  support: AuthoredPlatformPiece,
  kind: AuthoredEncounterAnchor["kind"],
  arena: AuthoredArena,
  checkpointId: string,
  at?: { readonly x: number; readonly z: number },
): AuthoredEncounterAnchor {
  const x = at?.x ?? (arena.minX + arena.maxX) / 2;
  const z = at?.z ?? (arena.minZ + arena.maxZ) / 2;
  return {
    ...anchorOn(support, x, z),
    kind,
    arena: { minX: mm(arena.minX), maxX: mm(arena.maxX), minZ: mm(arena.minZ), maxZ: mm(arena.maxZ) },
    checkpointId,
  };
}

/** A placed prop standing on the course ground. */
export function groundProp(
  id: string,
  kitPropId: string,
  x: number,
  z: number,
  options: { readonly rotationY?: number; readonly scale?: number } = {},
): AuthoredDecor {
  return decor(id, kitPropId, { x, y: A1_GROUND, z }, options);
}
