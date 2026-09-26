import { describe, expect, it } from "vitest";
import ratCasinoWorldV2 from "../../src/shared/levels/rat-casino-world-v2.json";
import { resolveFamilyWorld } from "../../src/client/family/family-world";
import type { FamilyWorldView } from "../../src/shared/family-api";
import type { LevelEditorProjectV2 } from "../../src/shared/editor-project";

const project = ratCasinoWorldV2 as unknown as LevelEditorProjectV2;
const world: FamilyWorldView = {
  saveId: "s1",
  templateId: "rat-casino-world",
  templateVersion: "v2",
  chapters: project.chapters.map((chapter) => ({
    routeId: chapter.routeId,
    chapterId: chapter.chapterId,
    name: chapter.name,
    subtitle: chapter.subtitle,
    description: chapter.description,
    level: chapter.level,
  })),
};

describe("family world resolution", () => {
  it("resolves every frozen chapter route and its public text", () => {
    const resolved = resolveFamilyWorld(world);
    for (const chapter of project.chapters) {
      expect(resolved.resolver(chapter.routeId)?.document.id).toBe(chapter.routeId);
      expect(resolved.chapterTitles[chapter.routeId]).toBe(chapter.name);
    }
    expect(resolved.chapterSubtitles["rat-casino-v2"]).toBe(project.chapters[2]!.subtitle);
  });

  it("refuses invalid geometry", () => {
    const broken = structuredClone(world) as unknown as { chapters: Array<{ level: Record<string, unknown> }> };
    broken.chapters[0]!.level = { ...broken.chapters[0]!.level, pieces: [] };
    expect(() => resolveFamilyWorld(broken as unknown as FamilyWorldView)).toThrow();
  });
});
