import { z } from "zod";

/**
 * The growth move ladder (DESIGN-025 D-01/D-02).
 *
 * Moves are derived only from a recovered age and are frozen into a plan by
 * the caller. Nothing here reads a save, a clock or a photo: the same age
 * always yields the same ability set, so a plan that stores the result replays
 * identically. Older plans that never stored an ability set keep jump-only
 * movement with today's constants; the runtime treats an absent set exactly
 * like `abilitiesForAge(0)`.
 *
 * This module is shared by the game runtime, the level validator and the plan
 * builders, so it must not import from `src/game` or `src/server`.
 */

/** Every lasting move, in unlock order. */
export const GROWTH_MOVE_IDS = [
  "jump",
  "high-jump",
  "double-jump",
  "glide",
] as const;

export type GrowthMoveId = (typeof GROWTH_MOVE_IDS)[number];

/** The moves a connection may declare in `requires`; plain jump is implied. */
export const REQUIRABLE_GROWTH_MOVES = [
  "high-jump",
  "double-jump",
  "glide",
] as const satisfies readonly GrowthMoveId[];

export type RequirableGrowthMove = (typeof REQUIRABLE_GROWTH_MOVES)[number];

/**
 * Identifies this ladder table when a plan freezes samples of it (the family
 * plan's `AbilityLadderSource.version`). Bump it if an unlock age ever moves.
 */
export const GROWTH_MOVE_LADDER_VERSION = "design-025-ladder-v1";

/** Whole-year recovered age at which each move unlocks. */
export const GROWTH_MOVE_UNLOCK_AGES: Readonly<Record<GrowthMoveId, number>> =
  Object.freeze({
    jump: 0,
    "high-jump": 2,
    "double-jump": 4,
    glide: 8,
  });

/**
 * A frozen, canonical ability set: always a prefix of `GROWTH_MOVE_IDS`
 * starting with `jump`, because the ladder is cumulative. Plans store it as
 * plain JSON (for example `["jump", "high-jump"]`).
 */
export type AbilitySet = readonly GrowthMoveId[];

export const growthMoveIdSchema = z.enum(GROWTH_MOVE_IDS);
export const requirableGrowthMoveSchema = z.enum(REQUIRABLE_GROWTH_MOVES);

/** Validates a stored ability set: a non-empty canonical prefix of the ladder. */
export const abilitySetSchema = z
  .array(growthMoveIdSchema)
  .min(1)
  .max(GROWTH_MOVE_IDS.length)
  .refine(
    (moves) => moves.every((move, index) => move === GROWTH_MOVE_IDS[index]),
    "An ability set must be a prefix of the growth move ladder starting with jump",
  );

/**
 * Physics constants for each move (60 Hz `stepObby`, gravity -15 m/s²). Jump
 * alone keeps the pre-ladder 5 m/s launch, so a jump-only set is exactly the
 * physics every published route already uses.
 */
export const GROWTH_MOVE_PHYSICS = Object.freeze({
  /** Plain jump launch in m/s (apex ~0.83 m). */
  jumpVelocity: 5,
  /** High jump launch in m/s (apex ~1.16 m). */
  highJumpVelocity: 5.9,
  /** The single mid-air launch in m/s, reset on landing. */
  airJumpVelocity: 4.6,
  /** Maximum fall speed in m/s while Jump is held and falling. */
  glideFallSpeed: 1.6,
});

/** Bounce pad launch speeds in m/s. Pads work at any age. */
export const BOUNCE_PAD_VELOCITY = Object.freeze({
  /** Apex ~1.9 m. */
  small: 7.5,
  /** Apex ~2.7 m. */
  big: 9,
});

export type BouncePadStrength = keyof typeof BOUNCE_PAD_VELOCITY;

function wholeAge(age: number): number {
  return Number.isFinite(age) && age > 0 ? Math.floor(age) : 0;
}

/**
 * The frozen ability set for a recovered age. Non-finite or negative ages are
 * treated as age zero (jump only).
 */
export function abilitiesForAge(age: number): AbilitySet {
  const years = wholeAge(age);
  return Object.freeze(
    GROWTH_MOVE_IDS.filter((move) => GROWTH_MOVE_UNLOCK_AGES[move] <= years),
  );
}

/**
 * The growth moves in a frozen list that may also hold other ability names
 * (the family plan freezes `move` and `interact` alongside them). Unknown
 * names are ignored, jump is always present, and the result is in ladder
 * order.
 */
export function growthMovesFrom(moves: readonly string[]): AbilitySet {
  return Object.freeze(
    GROWTH_MOVE_IDS.filter((move) => move === "jump" || moves.includes(move)),
  );
}

export function hasGrowthMove(
  abilities: AbilitySet | undefined,
  move: GrowthMoveId,
): boolean {
  if (move === "jump") return true;
  return abilities?.includes(move) ?? false;
}

/** Moves unlocked at `toAge` that were not available at `fromAge`, in ladder order. */
export function newlyUnlockedMoves(
  fromAge: number | undefined,
  toAge: number,
): readonly GrowthMoveId[] {
  const before = new Set(fromAge === undefined ? [] : abilitiesForAge(fromAge));
  return abilitiesForAge(toAge).filter((move) => !before.has(move));
}

/** The numbers `stepObby` needs for an ability set. */
export interface GrowthMoveTuning {
  readonly jumpVelocity: number;
  readonly airJumpVelocity?: number;
  readonly glideFallSpeed?: number;
}

export function growthMoveTuning(abilities: AbilitySet): GrowthMoveTuning {
  return Object.freeze({
    jumpVelocity: hasGrowthMove(abilities, "high-jump")
      ? GROWTH_MOVE_PHYSICS.highJumpVelocity
      : GROWTH_MOVE_PHYSICS.jumpVelocity,
    ...(hasGrowthMove(abilities, "double-jump")
      ? { airJumpVelocity: GROWTH_MOVE_PHYSICS.airJumpVelocity }
      : {}),
    ...(hasGrowthMove(abilities, "glide")
      ? { glideFallSpeed: GROWTH_MOVE_PHYSICS.glideFallSpeed }
      : {}),
  });
}

/**
 * D-02 visible growth: the avatar's visual scale for a recovered age. The
 * collider never changes with it, so gameplay does not depend on scale.
 */
export function growthVisualScale(age: number): number {
  return Math.min(1.16, 0.72 + 0.04 * wholeAge(age));
}

/** D-02 follow-camera distance multiplier for a visual scale. */
export function growthCameraScale(visualScale: number): number {
  return 0.9 + 0.1 * visualScale;
}

export interface GrowthMoveCard {
  readonly move: RequirableGrowthMove;
  readonly title: string;
  readonly body: string;
}

/**
 * Short "new move" cards shown after a boss when the next chapter unlocks a
 * move. The coordinator owns the final wording.
 */
export const GROWTH_MOVE_CARDS: Readonly<
  Record<RequirableGrowthMove, GrowthMoveCard>
> = Object.freeze({
  "high-jump": {
    move: "high-jump",
    // COPY: placeholder title for the high-jump move card.
    title: "New move: High Jump",
    // COPY: placeholder body for the high-jump move card.
    body: "Your jumps go higher now.",
  },
  "double-jump": {
    move: "double-jump",
    // COPY: placeholder title for the double-jump move card.
    title: "New move: Double Jump",
    // COPY: placeholder body for the double-jump move card.
    body: "Press Jump again in the air.",
  },
  glide: {
    move: "glide",
    // COPY: placeholder title for the glide move card.
    title: "New move: Glide",
    // COPY: placeholder body for the glide move card.
    body: "Hold Jump while falling to float.",
  },
});

/** Cards for the moves unlocked between two ages, in ladder order. */
export function growthMoveCards(
  fromAge: number,
  toAge: number,
): readonly GrowthMoveCard[] {
  return newlyUnlockedMoves(fromAge, toAge).flatMap((move) =>
    move === "jump" ? [] : [GROWTH_MOVE_CARDS[move]],
  );
}
