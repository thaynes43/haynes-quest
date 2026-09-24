import { describe, expect, it } from "vitest";

import type { SaveView } from "../../src/shared/contracts";
import { validateLevelEditorProject } from "../../src/shared/editor-project";
import {
  RAT_CASINO_CHAPTER_ID,
  RAT_CASINO_PLAYTEST_REQUEST,
  RAT_CASINO_ROUTE_ID,
  RAT_CASINO_WORLD_PROJECT,
  resolveEditorPlaytestResponse,
} from "../../src/client/rat-casino-project";

describe("checked-in Rat Casino world", () => {
  it("is a valid v2 fixture with a project-local playable route", () => {
    expect(RAT_CASINO_WORLD_PROJECT.schemaVersion).toBe(
      "level-editor-project-v2",
    );
    expect(validateLevelEditorProject(RAT_CASINO_WORLD_PROJECT)).toEqual([]);
    expect(
      RAT_CASINO_WORLD_PROJECT.chapters.find(
        (chapter) => chapter.chapterId === RAT_CASINO_CHAPTER_ID,
      ),
    ).toMatchObject({
      routeId: RAT_CASINO_ROUTE_ID,
      level: { id: RAT_CASINO_ROUTE_ID },
    });
    expect(RAT_CASINO_PLAYTEST_REQUEST).toMatchObject({
      chapterId: RAT_CASINO_CHAPTER_ID,
      scope: "chapter",
      project: RAT_CASINO_WORLD_PROJECT,
    });
  });

  it("resolves the server snapshot into route-keyed game presentation", () => {
    const preview = resolveEditorPlaytestResponse({
      save: { id: "rat-casino-save" } as SaveView,
      project: RAT_CASINO_WORLD_PROJECT,
      fingerprint: "rat-casino-fingerprint",
    });

    expect(preview.resolver(RAT_CASINO_ROUTE_ID)?.document.id).toBe(
      RAT_CASINO_ROUTE_ID,
    );
    expect(preview.chapterTitles[RAT_CASINO_ROUTE_ID]).toBeTruthy();
    expect(preview.chapterSubtitles[RAT_CASINO_ROUTE_ID]).toBeTruthy();
    expect(preview.chapterDescriptions[RAT_CASINO_ROUTE_ID]).toBeTruthy();
  });
});
