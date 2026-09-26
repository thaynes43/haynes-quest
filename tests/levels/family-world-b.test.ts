/**
 * World B, "Playroom to Big Stage" (`family-world-b@v1`, PLAN-019), as
 * assembled by `scripts/levels/build-family-world-b.ts` from the three
 * chapter generators.
 *
 * The chapter tests (`family-b1`, `family-b2`, `family-b3`) own each course's
 * traversal evidence; this file proves the assembled world: the checked-in
 * command history and template replay byte-identically, the whole world
 * validates, the WORLD-SPEC copy, dates and casts are exact, and every
 * chapter inside the world still equals its generator's level and passes the
 * World B family lints. Only the fictional template birth date appears here.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  levelEditorPreparedEnemies,
  resolveLevelEditorProject,
  serializeLevelEditorProject,
  validateLevelEditorProject,
  type LevelEditorProjectV2,
} from "../../src/shared/editor-project";
import { lintFamilyChapter } from "../../src/shared/family-world-lint";
import { familyWorldIssues, templateAgeBands } from "../../src/server/family/rebase";
import {
  CHECKED_IN_FAMILY_TEMPLATES,
  FamilyTemplateRegistry,
} from "../../src/server/family/templates";
import {
  buildFamilyWorldB,
  FAMILY_WORLD_B_CHAPTERS,
  FAMILY_WORLD_B_COMMANDS_URL,
  FAMILY_WORLD_B_PROJECT_URL,
  familyWorldBCommands,
} from "../../scripts/levels/build-family-world-b";
import { familyB1Level } from "../../scripts/levels/family/b1";
import { buildB2Level } from "../../scripts/levels/family/b2";
import { familyB3Level } from "../../scripts/levels/family/b3";

const checkedIn = readFileSync(FAMILY_WORLD_B_PROJECT_URL, "utf8");
const project = resolveLevelEditorProject(JSON.parse(checkedIn)).project as LevelEditorProjectV2;

/** WORLD-SPEC, verbatim: the final user-facing copy and the chapter data. */
const WORLD_SPEC = [
  {
    theme: "playroom",
    name: "The Sing-Along Playroom",
    subtitle: "Block towers and bouncy beds",
    description: "Climb the playroom towers, bounce on the beds and cheer up the grumpy bus.",
    period: "sing-along-playroom-v1",
    ages: [0, 2],
    dates: ["2020-06-01", "2022-06-01"],
  },
  {
    theme: "casita",
    name: "The Magic House",
    subtitle: "Garden terraces and dancing tiles",
    description: "Climb the garden terraces and calm the dancing house at the top.",
    period: "magic-house-v1",
    ages: [2, 4],
    dates: ["2022-06-01", "2024-06-01"],
  },
  {
    theme: "party",
    name: "Besties' Big Stage",
    subtitle: "Sparkles, stages and a missed high-five",
    description: "Dance past the demon idols and help the Besties finally land their high-five.",
    period: "besties-obby-v1",
    ages: [4, 6],
    dates: ["2024-06-01", "2026-06-01"],
  },
] as const;

const ORDINARY_SLOTS = ["ordinary-1", "ordinary-2", "ordinary-3", "ordinary-4"] as const;

describe("World B: Playroom to Big Stage (family-world-b@v1)", () => {
  it("replays byte-identically from the checked-in command history", () => {
    const commands = readFileSync(FAMILY_WORLD_B_COMMANDS_URL, "utf8");
    expect(commands).toBe(`${JSON.stringify(familyWorldBCommands(), null, 2)}\n`);
    expect(serializeLevelEditorProject(buildFamilyWorldB())).toBe(checkedIn);
    // The generator is pure: a second build is identical.
    expect(JSON.stringify(familyWorldBCommands())).toBe(JSON.stringify(familyWorldBCommands()));
  });

  it("validates as a whole world, including under the family age rule", () => {
    expect(validateLevelEditorProject(project)).toEqual([]);
    expect(familyWorldIssues(project)).toEqual([]);
  });

  it("carries the WORLD-SPEC name, birth date, copy, themes, contiguous dates and ages", () => {
    expect(project).toMatchObject({
      projectId: "family-world-b",
      name: "Playroom to Big Stage",
      fictionalBirthDate: "2020-06-01",
      catalogVersion: "parody-catalog-v8",
    });
    expect(project.chapters.map((chapter) => chapter.routeId)).toEqual([
      "family-b1-playroom",
      "family-b2-casita",
      "family-b3-stage",
    ]);
    project.chapters.forEach((chapter, index) => {
      const spec = WORLD_SPEC[index]!;
      expect(chapter).toMatchObject({
        name: spec.name,
        subtitle: spec.subtitle,
        description: spec.description,
        representedDateRange: { startDate: spec.dates[0], endDate: spec.dates[1] },
        recoveredAge: { fromYears: spec.ages[0], toYears: spec.ages[1] },
      });
      expect(chapter.level.theme).toBe(spec.theme);
      expect(chapter.previewMemories[2]).toMatchObject({ slotId: "major", date: spec.dates[1] });
      expect(chapter.previewMemories[2].label).toBe(`Turning ${spec.ages[1]}!`);
    });
    // Preview captions are fictional and never repeat within the world.
    const labels = project.chapters.flatMap((chapter) => chapter.previewMemories.map((memory) => memory.label));
    expect(new Set(labels).size).toBe(labels.length);
    expect(templateAgeBands(project)).toEqual([
      { startAge: 0, recoveredAge: 2 },
      { startAge: 2, recoveredAge: 4 },
      { startAge: 4, recoveredAge: 6 },
    ]);
  });

  it("assigns one ordinary identity per chapter and the newest catalog's landed bosses", () => {
    const prepared = levelEditorPreparedEnemies(project.catalogVersion);
    const identity = (chapterIndex: number, slot: string) => {
      const chapter = project.chapters[chapterIndex]!;
      const reference = chapter.encounterSlots[slot as keyof typeof chapter.encounterSlots]!;
      if (reference.source === "catalog")
        return prepared.find(
          (entry) =>
            entry.id === reference.catalogEntryId && entry.version === reference.catalogEntryVersion,
        )!;
      return project.enemyCandidates.find((candidate) => candidate.id === reference.candidateId)!;
    };
    const cast = project.chapters.map((chapter, index) => ({
      ordinaries: ORDINARY_SLOTS.map((slot) => identity(index, slot).id),
      ordinaryKinds: ORDINARY_SLOTS.map((slot) => chapter.level.anchors.encounters[slot].kind),
      boss: chapter.encounterSlots.boss,
      periods: [...new Set([...ORDINARY_SLOTS, "boss"].map((slot) => identity(index, slot).periodId))],
      bonus: "bonus-1" in chapter.encounterSlots,
    }));
    expect(cast).toEqual([
      {
        ordinaries: Array(4).fill("yes-yes-veggie"),
        ordinaryKinds: Array(4).fill("ordinary-a"),
        boss: { source: "catalog", catalogEntryId: "honk-bus", catalogEntryVersion: "v001" },
        periods: ["sing-along-playroom-v1"],
        bonus: false,
      },
      {
        ordinaries: Array(4).fill("bin-chicken"),
        ordinaryKinds: Array(4).fill("ordinary-a"),
        boss: { source: "candidate", candidateId: "magic-house" },
        periods: ["magic-house-v1"],
        bonus: false,
      },
      {
        ordinaries: Array(4).fill("demon-band-idol"),
        ordinaryKinds: Array(4).fill("ordinary-a"),
        boss: { source: "catalog", catalogEntryId: "bickering-besties", catalogEntryVersion: "v001" },
        periods: ["besties-obby-v1"],
        bonus: false,
      },
    ]);
    expect(cast.map((entry) => entry.periods[0])).toEqual(WORLD_SPEC.map((spec) => spec.period));
    // Candidates carry the WORLD-SPEC display names, kinds and windows.
    expect(
      project.enemyCandidates.map((candidate) => [
        candidate.id,
        candidate.name,
        candidate.role,
        candidate.kind,
        candidate.eligibility.startDate,
        candidate.eligibility.endDate,
      ]),
    ).toEqual([
      ["yes-yes-veggie", "Yes-Yes Veggie", "ordinary", "ordinary-a", "2018-01-01", "2026-12-31"],
      ["bin-chicken", "Bin Chicken", "ordinary", "ordinary-a", "2019-09-01", "2026-12-31"],
      ["magic-house", "The Dancing House", "boss", "boss", "2019-09-01", "2026-12-31"],
      ["demon-band-idol", "Demon Idol", "ordinary", "ordinary-a", "2024-01-01", "2026-12-31"],
    ]);
    // Big Honk Bus is a landed model in v8, so it is not a placeholder candidate.
    expect(identity(0, "boss")).toMatchObject({ id: "honk-bus", periodId: "sing-along-playroom-v1" });
  });

  it("keeps each chapter's generated level exactly and passes the World B family lints", () => {
    const generators = [familyB1Level, buildB2Level, familyB3Level];
    project.chapters.forEach((chapter, index) => {
      expect(chapter.level).toEqual(generators[index]!());
      expect(chapter.level).toEqual(FAMILY_WORLD_B_CHAPTERS[index]!.level());
      expect(lintFamilyChapter(chapter.level, { world: "b" })).toEqual([]);
    });
  });

  it("is registered as family-world-b@v1 with its admin-facing name and age bands", () => {
    expect(
      CHECKED_IN_FAMILY_TEMPLATES.filter((entry) => entry.id === "family-world-b").map(
        (entry) => entry.version,
      ),
    ).toEqual(["v1"]);
    const template = new FamilyTemplateRegistry().require("family-world-b", "v1");
    expect(template.project.name).toBe("Playroom to Big Stage");
    expect(template.ageBands).toEqual([
      { startAge: 0, recoveredAge: 2 },
      { startAge: 2, recoveredAge: 4 },
      { startAge: 4, recoveredAge: 6 },
    ]);
    expect(template.finalAge).toBe(6);
    expect(template.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });
});
