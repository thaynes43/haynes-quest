/**
 * Age-aware checks for DESIGN-025 D-03 growth-move connections.
 *
 * `validateAuthoredLevelDocument` judges a document against itself and cannot
 * know how old the player is when a chapter starts. Growth moves depend on
 * that age, so the rules that need it live here and are called by the world
 * project validator (and by family plan builders) with the chapter's frozen
 * start age:
 *
 * - every `requires` must name a move unlocked at the chapter's start age
 *   (this covers both the required route and optional branches);
 * - the first main-path use of each newly unlocked move must be a practice
 *   stretch: that connection declares a `safeMissPlatformId`, so the player
 *   can retry the move over a catch floor before the route depends on it.
 *
 * Only authored-level-v4 documents can declare `requires`; for every other
 * version this returns no issues.
 */
import {
  abilitiesForAge,
  newlyUnlockedMoves,
  type GrowthMoveId,
} from "./abilities";
import {
  AUTHORED_LEVEL_SCHEMA_VERSION_V4,
  type AuthoredLevelDocument,
  type AuthoredLevelIssue,
} from "./authored-level";

export interface GrowthRequirementContext {
  /** The chapter's frozen recovered start age. */
  readonly startAgeYears: number;
  /**
   * The previous chapter's start age, or undefined for the first chapter. A
   * move unlocked at or before it is not new, so it needs no practice here.
   */
  readonly previousStartAgeYears?: number;
}

export function validateGrowthRequirements(
  document: Pick<
    AuthoredLevelDocument,
    "schemaVersion" | "connections" | "mainPath"
  >,
  context: GrowthRequirementContext,
): readonly AuthoredLevelIssue[] {
  if (document.schemaVersion !== AUTHORED_LEVEL_SCHEMA_VERSION_V4) return [];
  const issues: AuthoredLevelIssue[] = [];
  const available = new Set<GrowthMoveId>(abilitiesForAge(context.startAgeYears));

  document.connections.forEach((connection, index) => {
    if (connection.requires === undefined) return;
    if (!available.has(connection.requires))
      issues.push({
        path: `$.connections[${index}].requires`,
        code: "requires.locked",
        message: `${connection.requires} is not unlocked at the chapter's start age of ${context.startAgeYears}`,
      });
  });

  const mainIndex = new Map(document.mainPath.map((id, index) => [id, index]));
  const mainPathStep = (from: string, to: string): number | undefined => {
    const fromIndex = mainIndex.get(from);
    const toIndex = mainIndex.get(to);
    return fromIndex !== undefined && toIndex === fromIndex + 1
      ? fromIndex
      : undefined;
  };
  for (const move of newlyUnlockedMoves(
    context.previousStartAgeYears,
    context.startAgeYears,
  )) {
    if (move === "jump") continue;
    let firstStep: number | undefined;
    const firstUses: number[] = [];
    document.connections.forEach((connection, index) => {
      if (connection.requires !== move) return;
      const step = mainPathStep(connection.from, connection.to);
      if (step === undefined) return;
      if (firstStep === undefined || step < firstStep) {
        firstStep = step;
        firstUses.length = 0;
      }
      if (step === firstStep) firstUses.push(index);
    });
    if (firstUses.length === 0) continue;
    const practiced = firstUses.some(
      (index) => document.connections[index]!.safeMissPlatformId !== undefined,
    );
    if (!practiced)
      issues.push({
        path: `$.connections[${firstUses[0]}].safeMissPlatformId`,
        code: "requires.practice-missing",
        message: `The first required ${move} is newly unlocked in this chapter and needs a practice stretch: declare a safeMissPlatformId catch floor with a retry route`,
      });
  }
  return issues;
}
