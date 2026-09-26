/**
 * Edge-based geometry helpers for the World B chapter 1 generator
 * (`scripts/levels/family/b1.ts`, PLAN-019).
 *
 * The blueprints describe every surface by its edges (`x0..x1`, `z0..z1`),
 * its standing `top` and a thickness, so these helpers take the same
 * numbers and emit ordinary authored-level-v4 pieces through the shared
 * growth kit. They compute geometry only; the shared validator and the
 * family lints stay the authority on whether the course is safe.
 *
 * Namespaced `-b1` so parallel chapter builders never collide on a shared
 * `lib.ts`.
 */
import type {
  AuthoredDecor,
  AuthoredLiftPiece,
  AuthoredMovingPlatformPiece,
  AuthoredPlatformPiece,
  AuthoredBouncePadPiece,
  AuthoredSweeperPiece,
} from "../../../src/shared/authored-level.js";
import type { BouncePadStrength } from "../../../src/shared/abilities.js";
import { bouncePad, decor, lift, mm, platform } from "../lib/growth-kit.js";

/** The visual carpet plane (scene.ts): "floor" boxes reach down to it. */
export const B1_CARPET_Y = -1.4;

export interface EdgeBox {
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  /** Standing height of the top face. */
  readonly top: number;
  /** Box height below the top, or `floor` to reach the carpet plane. */
  readonly thick: number | "floor";
}

function thicknessOf(box: EdgeBox): number {
  return box.thick === "floor" ? mm(box.top - B1_CARPET_Y) : box.thick;
}

function footprint(box: EdgeBox) {
  if (!(box.x0 < box.x1 && box.z0 < box.z1))
    throw new Error(`Edge box must have x0 < x1 and z0 < z1: ${JSON.stringify(box)}`);
  return {
    x: mm((box.x0 + box.x1) / 2),
    z: mm((box.z0 + box.z1) / 2),
    sizeX: mm(box.x1 - box.x0),
    sizeZ: mm(box.z1 - box.z0),
  };
}

/** A static platform from its edges. */
export function slab(id: string, box: EdgeBox): AuthoredPlatformPiece {
  return platform(id, { ...footprint(box), top: box.top, thickness: thicknessOf(box) });
}

/** A bounce pad from its edges. */
export function padAt(
  id: string,
  box: EdgeBox,
  strength: BouncePadStrength,
): AuthoredBouncePadPiece {
  return bouncePad(id, { ...footprint(box), top: box.top, thickness: thicknessOf(box), strength });
}

/** A horizontal mover centred on its edges, sliding ±`distance` along `axis`. */
export function moverAt(
  id: string,
  box: EdgeBox,
  motion: { readonly axis: "x" | "z"; readonly distance: number; readonly period: number },
): AuthoredMovingPlatformPiece {
  const base = slab(id, box);
  return {
    type: "moving-platform",
    id,
    center: base.center,
    size: base.size,
    motion: { axis: motion.axis, distance: mm(motion.distance), period: mm(motion.period) },
  };
}

/** A lift whose bottom stop stands at `box.top`, rising `distance` metres. */
export function liftAt(
  id: string,
  box: EdgeBox,
  travel: { readonly distance: number; readonly period: number; readonly dwell: number },
): AuthoredLiftPiece {
  return lift(id, {
    ...footprint(box),
    bottomTop: box.top,
    thickness: thicknessOf(box),
    distance: travel.distance,
    period: travel.period,
    dwell: travel.dwell,
  });
}

/** Sweeper bars ride just above the deck: an ankle bar to hop or walk around. */
export const B1_SWEEPER_LIFT = 0.22;

/** A slowly spinning ankle bar centred at (x, z) above a deck. */
export function spinner(
  id: string,
  at: { readonly x: number; readonly z: number; readonly deckTop: number },
  bar: { readonly halfLength: number; readonly radius: number; readonly period: number },
): AuthoredSweeperPiece {
  return {
    type: "sweeper",
    id,
    center: { x: mm(at.x), y: mm(at.deckTop + B1_SWEEPER_LIFT), z: mm(at.z) },
    halfLength: bar.halfLength,
    radius: bar.radius,
    rotation: { period: bar.period },
  };
}

/** A sliding ankle bar (along x, lying along x at rest) centred at (x, z). */
export function slider(
  id: string,
  at: { readonly x: number; readonly z: number; readonly deckTop: number },
  bar: {
    readonly halfLength: number;
    readonly radius: number;
    readonly axis: "x" | "z";
    readonly distance: number;
    readonly period: number;
  },
): AuthoredSweeperPiece {
  return {
    type: "sweeper",
    id,
    center: { x: mm(at.x), y: mm(at.deckTop + B1_SWEEPER_LIFT), z: mm(at.z) },
    halfLength: bar.halfLength,
    radius: bar.radius,
    motion: { axis: bar.axis, distance: mm(bar.distance), period: mm(bar.period) },
  };
}

/** Standing top of a platform piece. */
export function topOf(piece: { readonly center: { y: number }; readonly size: { y: number } }): number {
  return mm(piece.center.y + piece.size.y / 2);
}

/** A ring of `count` props around a centre, each turned to face outward. */
export function ring(
  prefix: string,
  kitPropId: string,
  center: { readonly x: number; readonly y: number; readonly z: number },
  radius: number,
  count: number,
  scale: number,
): AuthoredDecor[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (2 * Math.PI * index) / count;
    return decor(
      `${prefix}-${index + 1}`,
      kitPropId,
      { x: center.x + radius * Math.cos(angle), y: center.y, z: center.z + radius * Math.sin(angle) },
      // `+ 0` keeps a zero turn from serialising differently as -0.
      { rotationY: mm(-angle) + 0, scale },
    );
  });
}

/**
 * Stacked prop columns under a floating board, so height reads from below:
 * `count` stacks spaced along the board's long axis, each built from as many
 * `propHeight`-tall props as reach the board's underside without touching it
 * (`gap` metres left clear). Every stack stays at least `inset` metres inside
 * the board's footprint on each side, so none pokes out beside the route.
 */
export function stiltsUnder(
  prefix: string,
  board: AuthoredPlatformPiece,
  prop: {
    readonly kitPropId: string;
    /** Prop height at scale 1. */
    readonly height: number;
    /** Half the prop's footprint at scale 1 (the larger of x and z). */
    readonly halfWidth: number;
  },
  options: {
    readonly count?: number;
    readonly inset?: number;
    readonly gap?: number;
    readonly scale?: number;
    /** Height the stacks stand on (default: the carpet plane). */
    readonly base?: number;
  } = {},
): AuthoredDecor[] {
  const count = options.count ?? 1;
  const inset = options.inset ?? 0.3;
  const gap = options.gap ?? 0.3;
  const base = options.base ?? B1_CARPET_Y;
  const underside = board.center.y - board.size.y / 2;
  const reach = underside - gap - base;
  if (reach <= 0) return [];
  const longX = board.size.x >= board.size.z;
  const shortSide = longX ? board.size.z : board.size.x;
  const maxScale = (shortSide / 2 - inset) / prop.halfWidth;
  const scale = mm(Math.min(options.scale ?? 1.4, maxScale, 4));
  if (scale < 0.25) return [];
  const pieceHeight = prop.height * scale;
  // Enough levels to reach the board, each shrunk so the whole stack ends
  // exactly `gap` below it.
  const levels = Math.max(1, Math.ceil(reach / pieceHeight - 1e-9));
  const fitted = mm(Math.min(scale, reach / (levels * prop.height)));
  if (fitted < 0.25) return [];
  const longSize = longX ? board.size.x : board.size.z;
  const span = longSize - 2 * (inset + prop.halfWidth * fitted);
  const entries: AuthoredDecor[] = [];
  for (let stack = 0; stack < count; stack += 1) {
    const offset = count === 1 ? 0 : -span / 2 + (span * stack) / (count - 1);
    const x = longX ? board.center.x + offset : board.center.x;
    const z = longX ? board.center.z : board.center.z + offset;
    for (let level = 0; level < levels; level += 1)
      entries.push(
        decor(
          `${prefix}-${stack + 1}-${level + 1}`,
          prop.kitPropId,
          { x, y: base + level * prop.height * fitted, z },
          { scale: fitted },
        ),
      );
  }
  return entries;
}
