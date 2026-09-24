import ratCasinoProjectSource from "../shared/levels/rat-casino-world-v1.json";
import {
  authoredLevelResolverFor,
  type AuthoredLevelResolver,
} from "../game/authored-layout";
import type { SaveView } from "../shared/contracts";
import {
  isLevelEditorProjectV2,
  resolveLevelEditorProject,
  type LevelEditorProject,
  type LevelEditorProjectV2,
} from "../shared/editor-project";

export const RAT_CASINO_CHAPTER_ID = "rat-casino" as const;
export const RAT_CASINO_ROUTE_ID = "rat-casino-v1" as const;

export interface EditorPlaytestResponse {
  readonly save: SaveView;
  readonly project: LevelEditorProject;
  readonly fingerprint: string;
}

export interface ResolvedEditorPlaytest extends EditorPlaytestResponse {
  readonly resolver: AuthoredLevelResolver;
  readonly chapterTitles: Readonly<Record<string, string>>;
  readonly chapterSubtitles: Readonly<Record<string, string>>;
  readonly chapterDescriptions: Readonly<Record<string, string>>;
}

function resolveRatCasinoProject(source: unknown): LevelEditorProjectV2 {
  const resolved = resolveLevelEditorProject(source);
  if (!isLevelEditorProjectV2(resolved.project)) {
    throw new Error(
      "The Rat Casino sample must use the complete-world project format",
    );
  }
  const chapter = resolved.project.chapters.find(
    (candidate) => candidate.chapterId === RAT_CASINO_CHAPTER_ID,
  );
  if (!chapter || chapter.routeId !== RAT_CASINO_ROUTE_ID) {
    throw new Error("The Rat Casino sample chapter identity is unavailable");
  }
  return resolved.project;
}

/** Checked-in fictional fixture used by both the private home and editor. */
export const RAT_CASINO_WORLD_PROJECT = resolveRatCasinoProject(
  ratCasinoProjectSource,
);

export const RAT_CASINO_PLAYTEST_REQUEST = Object.freeze({
  project: RAT_CASINO_WORLD_PROJECT,
  chapterId: RAT_CASINO_CHAPTER_ID,
  scope: "chapter" as const,
});

/** Resolve the server-returned snapshot rather than trusting the submitted draft. */
export function resolveEditorPlaytestResponse(
  response: EditorPlaytestResponse,
): ResolvedEditorPlaytest {
  const resolved = resolveLevelEditorProject(response.project);
  return {
    ...response,
    project: resolved.project,
    resolver: authoredLevelResolverFor(resolved.levels),
    chapterTitles: Object.fromEntries(
      resolved.project.chapters.map((chapter) => [
        "routeId" in chapter ? chapter.routeId : chapter.templateRouteId,
        chapter.name,
      ]),
    ),
    chapterSubtitles: Object.fromEntries(
      resolved.project.chapters.flatMap((chapter) =>
        "routeId" in chapter && chapter.subtitle
          ? [[chapter.routeId, chapter.subtitle]]
          : [],
      ),
    ),
    chapterDescriptions: Object.fromEntries(
      resolved.project.chapters.flatMap((chapter) =>
        "routeId" in chapter
          ? [
              [
                chapter.routeId,
                chapter.description ??
                  "Find the memories, cross the course and face this world's boss.",
              ],
            ]
          : [],
      ),
    ),
  };
}
