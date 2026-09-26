import { authoredLevelResolverFor, type AuthoredLevelResolver } from "../../game/authored-layout";
import { resolveAuthoredLevelDocument } from "../../shared/authored-level";
import type { FamilyWorldView } from "../../shared/family-api";

export interface ResolvedFamilyWorld {
  readonly resolver: AuthoredLevelResolver;
  readonly chapterTitles: Readonly<Record<string, string>>;
  readonly chapterSubtitles: Readonly<Record<string, string>>;
  readonly chapterDescriptions: Readonly<Record<string, string>>;
}

/**
 * Validates and resolves the frozen geometry a family save plays, so the game
 * uses the same authored-route runtime as the editor preview.
 */
export function resolveFamilyWorld(world: FamilyWorldView): ResolvedFamilyWorld {
  const levels = Object.fromEntries(
    world.chapters.map((chapter) => [chapter.routeId, resolveAuthoredLevelDocument(chapter.level)]),
  );
  return {
    resolver: authoredLevelResolverFor(levels),
    chapterTitles: Object.fromEntries(world.chapters.map((chapter) => [chapter.routeId, chapter.name])),
    chapterSubtitles: Object.fromEntries(
      world.chapters.flatMap((chapter) => (chapter.subtitle ? [[chapter.routeId, chapter.subtitle]] : [])),
    ),
    chapterDescriptions: Object.fromEntries(
      world.chapters.flatMap((chapter) => (chapter.description ? [[chapter.routeId, chapter.description]] : [])),
    ),
  };
}
