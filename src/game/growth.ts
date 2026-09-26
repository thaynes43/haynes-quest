import {
  abilitiesForAge,
  GROWTH_MOVE_CARDS,
  growthMovesFrom,
  growthMoveTuning,
  growthVisualScale,
  type AbilitySet,
  type GrowthMoveCard,
  type GrowthMoveTuning,
} from "../shared/abilities";
import { AUTHORED_LEVEL_SCHEMA_VERSION_V4 } from "../shared/authored-level";
import type { SaveView } from "../shared/contracts";
import { authoredRoute, type AuthoredLevelResolver } from "./authored-layout";
import type { LevelLayout } from "./level";

/**
 * The runtime hook for DESIGN-025 growth moves. It decides, per active level,
 * which frozen ability set drives `stepObby`:
 *
 * 1. a plan that froze `growthMoves` for the level uses exactly that set;
 * 2. otherwise an authored-level-v4 route (only new world projects can hold
 *    one) derives the set from the level's frozen start age, which is how the
 *    fixture editor playtest grants moves before a family plan exists;
 * 3. everything else — published routes, v1–v3 documents, frozen plans without
 *    a set — returns `null` and keeps today's jump-only physics untouched.
 */
export interface LevelGrowth {
  readonly abilities: AbilitySet;
  readonly tuning: GrowthMoveTuning;
}

export function levelGrowth(
  save: Pick<SaveView, "adventure">,
  level: Pick<LevelLayout, "authored">,
): LevelGrowth | null {
  const active = save.adventure?.activeLevel;
  if (!active) return null;
  let abilities: AbilitySet | null = null;
  if (Array.isArray(active.growthMoves)) {
    abilities = growthMovesFrom(
      active.growthMoves.filter((move): move is string => typeof move === "string"),
    );
  } else if (level.authored?.schemaVersion === AUTHORED_LEVEL_SCHEMA_VERSION_V4) {
    abilities = abilitiesForAge(active.startAgeYears);
  }
  if (!abilities) return null;
  return Object.freeze({ abilities, tuning: growthMoveTuning(abilities) });
}

/**
 * D-02 visual scale for the current recovered age, or `null` when the level
 * does not use growth moves (older routes keep their exact presentation).
 */
export function growthScaleFor(
  save: Pick<SaveView, "ageYears">,
  growth: LevelGrowth | null,
): number | null {
  return growth ? growthVisualScale(save.ageYears) : null;
}

/**
 * The "new move" cards to show when a save advances to its next level: moves
 * the new level grants that the previous level did not. Levels without growth
 * moves never produce a card.
 */
export function growthMoveCardsForAdvance(
  before: Pick<SaveView, "adventure">,
  after: Pick<SaveView, "adventure">,
  resolver: AuthoredLevelResolver = authoredRoute,
): readonly GrowthMoveCard[] {
  const growthOf = (save: Pick<SaveView, "adventure">) =>
    levelGrowth(save, {
      authored: resolver(save.adventure?.activeLevel?.routeId)?.document,
    });
  const next = growthOf(after);
  if (!next) return [];
  const previous = new Set(growthOf(before)?.abilities ?? ["jump"]);
  return next.abilities.flatMap((move) =>
    move === "jump" || previous.has(move) ? [] : [GROWTH_MOVE_CARDS[move]],
  );
}
