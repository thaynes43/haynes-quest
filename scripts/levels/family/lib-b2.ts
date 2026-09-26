/**
 * Small geometry helpers for the B2 family chapter generator (PLAN-019).
 *
 * They only shape JSON: every piece is a plain authored-level-v4 value, and
 * the shared validator and family lints stay the authority on whether the
 * course is safe. Rectangles are horizontal footprints in metres; `minZ` is
 * the far (north, away from the default camera) edge.
 *
 * Namespaced `-b2` so the other chapter builders can add their own helpers
 * without merge conflicts; the World assembler may consolidate them later.
 */
import type {
  AuthoredAnchor,
  AuthoredArena,
  AuthoredCheckpointPiece,
  AuthoredEncounterAnchor,
  AuthoredMovingPlatformPiece,
  AuthoredPlatformPiece,
  AuthoredSweeperPiece,
} from "../../../src/shared/authored-level.js";
import { mm, platformCheckpoint } from "../lib/growth-kit.js";

/** The visual ground plane (scene.ts); grounded blocks stand on it. */
export const GROUND = -1.4;

export interface Rect {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export function rect(minX: number, maxX: number, minZ: number, maxZ: number): Rect {
  if (minX >= maxX || minZ >= maxZ) throw new Error(`Empty rectangle ${minX},${maxX},${minZ},${maxZ}`);
  return { minX, maxX, minZ, maxZ };
}

/** A rectangle of the given size centred on (x, z). */
export function centred(x: number, z: number, sizeX: number, sizeZ: number): Rect {
  return rect(x - sizeX / 2, x + sizeX / 2, z - sizeZ / 2, z + sizeZ / 2);
}

export function grow(area: Rect, amount: number): Rect {
  return rect(area.minX - amount, area.maxX + amount, area.minZ - amount, area.maxZ + amount);
}

function box(area: Rect, top: number, base: number) {
  if (base >= top) throw new Error(`Block base ${base} must sit below its top ${top}`);
  return {
    center: {
      x: mm((area.minX + area.maxX) / 2),
      y: mm((top + base) / 2),
      z: mm((area.minZ + area.maxZ) / 2),
    },
    size: { x: mm(area.maxX - area.minX), y: mm(top - base), z: mm(area.maxZ - area.minZ) },
  };
}

/**
 * A static block whose top face is `top`. It stands on the ground plane by
 * default, so a tall terrace reads as solid garden wall, and a bounce landing
 * always reaches down to its pad (no underhang).
 */
export function block(id: string, area: Rect, top: number, base = GROUND): AuthoredPlatformPiece {
  return { type: "platform", id, ...box(area, top, base) };
}

/**
 * A sliding "dancing tile": a 0.4 m slab that sways `distance` metres either
 * way along `axis` over `period` seconds. Its footprint `area` is the rest
 * position.
 */
export function tile(
  id: string,
  area: Rect,
  top: number,
  motion: { readonly axis: "x" | "z"; readonly distance: number; readonly period: number; readonly phase?: number },
): AuthoredMovingPlatformPiece {
  return {
    type: "moving-platform",
    id,
    ...box(area, top, top - 0.4),
    motion: {
      axis: motion.axis,
      distance: mm(motion.distance),
      period: mm(motion.period),
      ...(motion.phase === undefined ? {} : { phase: mm(motion.phase) }),
    },
  };
}

/** A low spinning bar (a sprinkler or weathervane) just above a deck. */
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
    halfLength: mm(halfLength),
    radius: 0.2,
    rotation: { period: mm(period), ...(phase === undefined ? {} : { phase: mm(phase) }) },
  };
}

export function topOf(piece: { readonly center: { readonly y: number }; readonly size: { readonly y: number } }): number {
  return mm(piece.center.y + piece.size.y / 2);
}

/** A checkpoint armed anywhere on its platform, standing on the platform top. */
export function checkpointOn(
  id: string,
  platform: AuthoredPlatformPiece,
  x: number,
  z: number,
): AuthoredCheckpointPiece {
  return platformCheckpoint(id, platform.id, { x, y: topOf(platform), z });
}

export function anchorOn(platform: AuthoredPlatformPiece, x: number, z: number): AuthoredAnchor {
  return { platformId: platform.id, position: { x: mm(x), y: topOf(platform), z: mm(z) } };
}

/** An encounter standing at its arena's centre. */
export function encounterOn(
  platform: AuthoredPlatformPiece,
  kind: AuthoredEncounterAnchor["kind"],
  arena: Rect,
  checkpointId: string,
): AuthoredEncounterAnchor {
  const bounds: AuthoredArena = {
    minX: mm(arena.minX),
    maxX: mm(arena.maxX),
    minZ: mm(arena.minZ),
    maxZ: mm(arena.maxZ),
  };
  return {
    ...anchorOn(platform, (arena.minX + arena.maxX) / 2, (arena.minZ + arena.maxZ) / 2),
    kind,
    arena: bounds,
    checkpointId,
  };
}
