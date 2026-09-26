/**
 * World A, "Clubhouse to Casino" (family-world-a@v2), assembled from its four
 * chapter generators by `scripts/levels/build-family-world-a.ts`. These checks
 * run against the checked-in v2 template project: the whole-world validator, the
 * WORLD-SPEC shell (copy, themes, dates and ages), every chapter's cast, the
 * family lints and the kid-model route on the assembled levels, and the World
 * A difficulty curve (R8). The world is fictional template data.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { abilitiesForAge } from "../../src/shared/abilities";
import { validateGrowthRequirements } from "../../src/shared/authored-level-growth";
import {
  AUTHORED_REQUIRED_ENCOUNTER_SLOTS,
  type AuthoredSurfacePiece,
} from "../../src/shared/authored-level";
import {
  resolveLevelEditorProject,
  serializeLevelEditorProject,
  validateLevelEditorProject,
  type LevelEditorChapterV2,
  type LevelEditorProjectV2,
} from "../../src/shared/editor-project";
import { lintFamilyChapter } from "../../src/shared/family-world-lint";
import { placeableThemeKitProps, themeKitProp } from "../../src/shared/theme-kits";
import {
  buildFamilyWorldA,
  FAMILY_WORLD_A_CHAPTERS,
  FAMILY_WORLD_A_TEMPLATE_VERSION,
  familyWorldACommands,
} from "../../scripts/levels/build-family-world-a";
import { familyA1Level } from "../../scripts/levels/family/a1";
import { familyA2Level } from "../../scripts/levels/family/a2";
import { familyA3Level } from "../../scripts/levels/family/a3";
import { familyA4Level } from "../../scripts/levels/family/a4";
import { runGrowthRouteWithWaits } from "../game/family-kid-lib";

const PROJECT_SOURCE = readFileSync(
  new URL("../../src/shared/levels/family-world-a-v2.json", import.meta.url),
  "utf8",
);
const COMMANDS_SOURCE = readFileSync(
  new URL("../../scripts/levels/family-world-a-v2.commands.json", import.meta.url),
  "utf8",
);
/** v1 is frozen history for journeys published on it; no generator rewrites it. */
const V1_PROJECT_SOURCE = readFileSync(
  new URL("../../src/shared/levels/family-world-a-v1.json", import.meta.url),
  "utf8",
);
const { project: resolvedProject, levels } = resolveLevelEditorProject(JSON.parse(PROJECT_SOURCE));
const project = resolvedProject as LevelEditorProjectV2;
const chapters = project.chapters as readonly LevelEditorChapterV2[];

/** WORLD-SPEC, verbatim: the final user-facing chapter copy. */
const WORLD_SPEC = [
  {
    theme: "clubhouse",
    name: "The Toon Clubhouse",
    subtitle: "Gadgets on the loose",
    description:
      "Bounce up the hill, ride the cliff lift and climb the clubhouse tower to face the bully cat.",
    period: "toon-clubhouse-v1",
  },
  {
    theme: "harbor",
    name: "Harbor Rescue",
    subtitle: "Boats, rooftops and a lookout",
    description:
      "Ride the boats, hop the town rooftops and climb the lookout to stop the rival mayor.",
    period: "rescue-harbor-v1",
  },
  {
    theme: "rooftop",
    name: "Hero City",
    subtitle: "Rooftops above the city",
    description: "Leap between rooftops, bounce off the vents and stop the monster-inator.",
    period: "hero-city-v1",
  },
  {
    theme: "casino",
    name: "Rat Casino After Hours",
    subtitle: "The mascots are still awake",
    description:
      "Climb the old casino's stages, outlast the mascots and face the Rat Pit Boss.",
    period: "rat-casino-v1",
  },
] as const;

const GENERATORS = [familyA1Level, familyA2Level, familyA3Level, familyA4Level];

function surfaceTop(chapter: LevelEditorChapterV2, id: string): number {
  const piece = chapter.level.pieces.find((entry) => entry.id === id) as AuthoredSurfacePiece;
  return piece.center.y + piece.size.y / 2;
}

describe("World A template (family-world-a@v2)", () => {
  it("is the byte-identical output of its generator", () => {
    expect(FAMILY_WORLD_A_TEMPLATE_VERSION).toBe("v2");
    expect(COMMANDS_SOURCE).toBe(`${JSON.stringify(familyWorldACommands(), null, 2)}\n`);
    expect(PROJECT_SOURCE).toBe(serializeLevelEditorProject(buildFamilyWorldA()));
  });

  it("keeps v1 valid and differs from it only in the verified fixes", () => {
    const { project: v1 } = resolveLevelEditorProject(JSON.parse(V1_PROJECT_SOURCE));
    expect(validateLevelEditorProject(v1)).toEqual([]);
    const v1Chapters = (v1 as LevelEditorProjectV2).chapters as readonly LevelEditorChapterV2[];
    type Piece = LevelEditorChapterV2["level"]["pieces"][number];
    /** Every piece id whose JSON differs between the versions, with the differing fields. */
    const changes = (before: LevelEditorChapterV2, after: LevelEditorChapterV2) => {
      const byId = (pieces: readonly Piece[]) => new Map(pieces.map((piece) => [piece.id, piece]));
      const [old, next] = [byId(before.level.pieces), byId(after.level.pieces)];
      const out: Record<string, string[] | "removed" | "added"> = {};
      for (const [id, piece] of old) {
        const other = next.get(id);
        if (!other) out[id] = "removed";
        else {
          const fields = (["center", "size", "travel"] as const).flatMap((key) =>
            (["x", "y", "z", "distance", "period", "dwell", "phase"] as const)
              .filter((axis) => {
                const a = (piece as unknown as Record<string, Record<string, number> | undefined>)[key]?.[axis];
                const b = (other as unknown as Record<string, Record<string, number> | undefined>)[key]?.[axis];
                return a !== b;
              })
              .map((axis) => `${key}.${axis}`),
          );
          if (fields.length > 0) out[id] = fields;
        }
      }
      for (const id of next.keys()) if (!old.has(id)) out[id] = "added";
      // Nothing but pieces changes: same connections, paths, anchors and decor.
      expect({ ...before.level, pieces: [] }).toEqual({ ...after.level, pieces: [] });
      expect({ ...before, level: null }).toEqual({ ...after, level: null });
      return out;
    };
    const deepCar = ["center.y", "size.y"];
    expect(v1Chapters.map((chapter, index) => changes(chapter, chapters[index]!))).toEqual([
      // A1: the mop sweeper across the boss pad's run-up is gone; deep cars.
      { "cliff-lift": deepCar, "tower-lift": deepCar, "mop-sweeper": "removed" },
      { "cargo-lift": deepCar },
      { "freight-elevator": deepCar },
      // A4: the optional On-Air pad is 0.8 m wider, toward the west; deep cars.
      { "service-lift": deepCar, "on-air-pad": ["center.x", "size.x"], "marquee-hoist": deepCar },
    ]);
    // Every deep car keeps its standing top and travel, and hangs 0.6 m above
    // its boarding landing at the top stop.
    for (const [index, chapter] of chapters.entries())
      for (const piece of chapter.level.pieces) {
        if (piece.type !== "lift") continue;
        const before = v1Chapters[index]!.level.pieces.find((entry) => entry.id === piece.id) as typeof piece;
        const top = (entry: typeof piece) => entry.center.y + entry.size.y / 2;
        expect(top(piece)).toBeCloseTo(top(before), 6);
        expect(piece.size.y).toBeCloseTo(piece.travel.distance - 0.6, 6);
      }
    const pad = (chapter: LevelEditorChapterV2) => {
      const piece = chapter.level.pieces.find((entry) => entry.id === "on-air-pad") as AuthoredSurfacePiece;
      return [piece.center.x - piece.size.x / 2, piece.center.x + piece.size.x / 2].map((x) => Math.round(x * 10) / 10);
    };
    expect(pad(v1Chapters[3]!)).toEqual([-27.6, -25.2]);
    expect(pad(chapters[3]!)).toEqual([-28.4, -25.2]);
    expect({ ...v1, chapters: [] }).toEqual({ ...project, chapters: [] });
  });

  it("validates as a whole world with zero issues", () => {
    expect(validateLevelEditorProject(project)).toEqual([]);
    expect(Object.keys(levels)).toHaveLength(4);
  });

  it("carries the WORLD-SPEC name, copy, themes, dates and ages", () => {
    expect(project).toMatchObject({
      projectId: "family-world-a",
      name: "Clubhouse to Casino",
      catalogVersion: "parody-catalog-v8",
      fictionalBirthDate: "2015-01-15",
    });
    expect(chapters.map((chapter) => chapter.chapterId)).toEqual([
      "family-a1",
      "family-a2",
      "family-a3",
      "family-a4",
    ]);
    for (const [index, chapter] of chapters.entries()) {
      const spec = WORLD_SPEC[index]!;
      expect(chapter).toMatchObject({
        name: spec.name,
        subtitle: spec.subtitle,
        description: spec.description,
      });
      expect(chapter.level.theme).toBe(spec.theme);
      expect(chapter.level.schemaVersion).toBe("authored-level-v4");
      // Assembly never alters a chapter generator's level.
      expect(chapter.level).toEqual(GENERATORS[index]!());
      expect(chapter.level.id).toBe(chapter.routeId);
      // The major memory closes the represented range on the recovered birthday.
      expect(chapter.previewMemories.find((memory) => memory.slotId === "major")!.date).toBe(
        chapter.representedDateRange.endDate,
      );
    }
    // Contiguous ranges from the fictional birthday: 0 -> 2 -> 5 -> 9 -> 11.
    expect(chapters.map((chapter) => [chapter.recoveredAge.fromYears, chapter.recoveredAge.toYears])).toEqual([
      [0, 2],
      [2, 5],
      [5, 9],
      [9, 11],
    ]);
    expect(chapters.map((chapter) => chapter.representedDateRange)).toEqual([
      { startDate: "2015-01-15", endDate: "2017-01-15" },
      { startDate: "2017-01-15", endDate: "2020-01-15" },
      { startDate: "2020-01-15", endDate: "2024-01-15" },
      { startDate: "2024-01-15", endDate: "2026-01-15" },
    ]);
  });

  it("casts every chapter from WORLD-SPEC: catalog models where they landed, candidates otherwise", () => {
    const reference = (chapter: LevelEditorChapterV2, slot: string) =>
      (chapter.encounterSlots as Record<string, unknown>)[slot];
    const catalog = (catalogEntryId: string) => ({ source: "catalog", catalogEntryId, catalogEntryVersion: "v001" });
    const candidate = (candidateId: string) => ({ source: "candidate", candidateId });
    const [a1, a2, a3, a4] = chapters as [LevelEditorChapterV2, LevelEditorChapterV2, LevelEditorChapterV2, LevelEditorChapterV2];
    const slots = (chapter: LevelEditorChapterV2) =>
      Object.fromEntries(
        [...AUTHORED_REQUIRED_ENCOUNTER_SLOTS, "bonus-1"]
          .filter((slot) => reference(chapter, slot) !== undefined)
          .map((slot) => [slot, reference(chapter, slot)]),
      );
    expect(slots(a1)).toEqual({
      "ordinary-1": candidate("gadget-helper"),
      "ordinary-2": candidate("gadget-helper"),
      "ordinary-3": candidate("gadget-helper"),
      "ordinary-4": candidate("gadget-helper"),
      boss: catalog("clubhouse-bully-cat"),
    });
    expect(slots(a2)).toEqual({
      "ordinary-1": candidate("mischief-kitten"),
      "ordinary-2": candidate("mischief-kitten"),
      "ordinary-3": candidate("mischief-kitten"),
      "ordinary-4": candidate("mischief-kitten"),
      boss: candidate("rival-mayor"),
      "bonus-1": candidate("mischief-kitten"),
    });
    expect(slots(a3)).toEqual({
      "ordinary-1": candidate("putty-grunt"),
      "ordinary-2": candidate("lab-robot"),
      "ordinary-3": candidate("putty-grunt"),
      "ordinary-4": candidate("lab-robot"),
      boss: candidate("inator-monster"),
      "bonus-1": candidate("lab-robot"),
    });
    // Golden is scenic only; the Radio Showman takes the optional fight.
    expect(slots(a4)).toEqual({
      "ordinary-1": catalog("chick-flia"),
      "ordinary-2": catalog("jackrabbit-drummer"),
      "ordinary-3": catalog("fox-card-shark"),
      "ordinary-4": catalog("moth-projectionist"),
      boss: catalog("rat-pit-boss"),
      "bonus-1": candidate("radio-host-showman"),
    });
    // Every project candidate is a WORLD-SPEC identity in its chapter's period,
    // and each anchor's kind is its identity's kind (R11).
    const candidates = new Map(project.enemyCandidates.map((entry) => [entry.id, entry]));
    expect([...candidates.keys()]).toEqual([
      "gadget-helper",
      "mischief-kitten",
      "rival-mayor",
      "putty-grunt",
      "lab-robot",
      "inator-monster",
      "radio-host-showman",
    ]);
    for (const [index, chapter] of chapters.entries()) {
      for (const [slot, assigned] of Object.entries(slots(chapter))) {
        const id = (assigned as { candidateId?: string }).candidateId;
        if (!id) continue;
        const entry = candidates.get(id)!;
        expect(entry.periodId, `${chapter.chapterId} ${id}`).toBe(WORLD_SPEC[index]!.period);
        expect(
          chapter.level.anchors.encounters[slot as keyof typeof chapter.level.anchors.encounters]!.kind,
          `${chapter.chapterId} ${slot}`,
        ).toBe(entry.kind);
      }
    }
  });

  it("passes every World A family lint and the growth rules in world order", () => {
    for (const [index, chapter] of chapters.entries()) {
      expect(lintFamilyChapter(chapter.level, { world: "a" }), chapter.chapterId).toEqual([]);
      expect(
        validateGrowthRequirements(chapter.level, {
          startAgeYears: chapter.recoveredAge.fromYears,
          ...(index > 0 ? { previousStartAgeYears: chapters[index - 1]!.recoveredAge.fromYears } : {}),
        }),
        chapter.chapterId,
      ).toEqual([]);
      // R12: only the chapter's own theme kit and the shared kit, at most 200.
      const placeable = new Set(placeableThemeKitProps(chapter.level.theme).map((prop) => prop.id));
      expect(chapter.level.decor!.length).toBeLessThanOrEqual(200);
      for (const entry of chapter.level.decor!) expect(placeable.has(entry.kitPropId), entry.id).toBe(true);
    }
  });

  it("records the shared props World A puts in play", () => {
    const shared = [
      ...new Set(
        chapters.flatMap((chapter) =>
          chapter.level.decor!.map((entry) => entry.kitPropId).filter((id) => themeKitProp(id)?.theme === "shared"),
        ),
      ),
    ].sort();
    expect(shared).toEqual([
      "arrival-landmark",
      "clearing-stone",
      "clearing-tree",
      "midnight-arcade-cabinet",
      "midnight-joystick-bollard",
      "toybox-block-tower",
      "toybox-safety-rail",
      "toybox-windup-lantern",
    ]);
    // DESIGN-025 D-05: the first level that places a shared prop records that
    // gameplay use in the asset catalog.
    const inventory = JSON.parse(
      readFileSync(new URL("../../scripts/assets/catalog-inventory.json", import.meta.url), "utf8"),
    ) as { assets: Array<{ id: string; gameplay_use?: string; state: string }> };
    for (const id of shared) {
      const entry = inventory.assets.find((asset) => asset.id === id);
      expect(entry?.gameplay_use, id).toBe("private-candidate");
      expect(entry?.state, id).toMatch(/family world/i);
    }
  });
});

describe("World A kid model on the assembled chapters", () => {
  const runs = chapters.map((chapter) => {
    const start = chapter.recoveredAge.fromYears;
    return runGrowthRouteWithWaits(
      levels[chapter.routeId]!,
      chapter.level.mainPath,
      start < 4 ? "infant" : "child",
      abilitiesForAge(start),
    );
  });

  it("crosses every required route with the start age's moves and no recoveries in at least 70 s", () => {
    for (const [index, run] of runs.entries()) {
      const chapter = chapters[index]!;
      expect(run.failedAt, chapter.chapterId).toBeNull();
      expect(run.recoveries, chapter.chapterId).toBe(0);
      expect(run.completed, chapter.chapterId).toHaveLength(chapter.level.mainPath.length - 1);
      expect(run.seconds, chapter.chapterId).toBeGreaterThanOrEqual(70);
    }
  }, 60_000);

  it("escalates to the casino finale: the tallest climb (at least 16 m) and the longest traversal (R8)", () => {
    const climbs = chapters.map((chapter) => {
      const tops = chapter.level.mainPath.map((id) => surfaceTop(chapter, id));
      return Math.max(...tops) - tops[0]!;
    });
    expect(climbs.map((climb) => Math.round(climb * 10) / 10)).toEqual([14.8, 13.4, 15, 22.3]);
    expect(climbs[3]).toBeGreaterThanOrEqual(16);
    expect(Math.max(...climbs)).toBe(climbs[3]);
    const seconds = runs.map((run) => run.seconds);
    expect(Math.max(...seconds)).toBe(seconds[3]);
  });

  it("keeps every chapter's generator identity in the assembled chapter list", () => {
    expect(FAMILY_WORLD_A_CHAPTERS.map((chapter) => chapter.shell.chapterId)).toEqual(
      chapters.map((chapter) => chapter.chapterId),
    );
  });
});
