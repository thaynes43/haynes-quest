/**
 * Frozen parody-catalog-v8 (DESIGN-026, PLAN-019 cast integration): v7 plus
 * the family-era Blender models that have landed, registered as prepared
 * gameplay enemies with the coordinator's names, periods and windows. The
 * worlds are synthetic one-chapter fixtures with fictional template dates.
 */
import { describe, expect, it } from "vitest";
import { eraStory } from "../../src/client/era";
import { parodyArtwork } from "../../src/game/scene-catalog";
import type { ActiveLevelView } from "../../src/shared/contracts";
import {
  applyLevelEditorCommands,
  createWorldEditorProject,
  LEVEL_EDITOR_CATALOG_VERSIONS,
  levelEditorPreparedBonusEnemies,
  levelEditorPreparedEnemies,
  validateLevelEditorProject,
} from "../../src/shared/editor-project";
import {
  PARODY_CATALOG_VERSIONS,
  PARODY_CATALOGS,
  type ParodyCatalogEntry,
} from "../../src/shared/parody-catalog";
import {
  buildFamilyCatalogBossWorld,
  FAMILY_CATALOG_BOSS_WORLDS,
  familyCatalogBossWorldCommands,
  type FamilyCatalogBossWorldSpec,
} from "../family-world-fixtures";

/** The exact v8 additions, from WORLD-SPEC and the WO111 delivery log. */
const V8_ADDITIONS: readonly ParodyCatalogEntry[] = [
  {
    id: "clubhouse-bully-cat",
    version: "v001",
    title: "Captain Bully Cat",
    reference: "classic toon-clubhouse bully cat captain",
    role: "boss",
    kind: "boss",
    periodId: "toon-clubhouse-v1",
    eligibleFrom: "2006-05-05",
    eligibleThrough: "2016-11-06",
    referenceAvailableBy: "2006-05-05",
    requiredAbilities: ["move"],
    assetId: "clubhouse-bully-cat",
    assetVersion: "v001",
  },
  {
    id: "honk-bus",
    version: "v001",
    title: "Big Honk Bus",
    reference: "a toddler sing-along show's school bus",
    role: "boss",
    kind: "boss",
    periodId: "sing-along-playroom-v1",
    eligibleFrom: "2018-01-01",
    eligibleThrough: "2026-12-31",
    referenceAvailableBy: "2018-01-01",
    requiredAbilities: ["move"],
    assetId: "honk-bus",
    assetVersion: "v001",
  },
];

const HEIGHTS: Record<string, number> = { "clubhouse-bully-cat": 2.5, "honk-bus": 2.3 };

function withBirth(spec: FamilyCatalogBossWorldSpec, birth: string): FamilyCatalogBossWorldSpec {
  const years = (date: string, offset: number) => `${Number(date.slice(0, 4)) + offset}${date.slice(4)}`;
  return {
    ...spec,
    fictionalBirthDate: birth,
    chapter: {
      ...spec.chapter,
      representedDateRange: { startDate: birth, endDate: years(birth, 2) },
      previewMemories: [
        { slotId: "minor-one", date: `${birth.slice(0, 4)}-09-01`, label: "Summer picnic" },
        { slotId: "minor-two", date: `${Number(birth.slice(0, 4)) + 1}-07-01`, label: "A sunny afternoon" },
        { slotId: "major", date: years(birth, 2), label: "Turning 2!" },
      ],
    },
  };
}

describe("parody-catalog-v8", () => {
  it("is v7 unchanged plus the landed family-era bosses, and v1-v7 stay frozen", () => {
    // v9 (the Besties parent lock) follows it; parody-catalog-v9.test.ts.
    expect(PARODY_CATALOG_VERSIONS.indexOf("parody-catalog-v8")).toBe(PARODY_CATALOG_VERSIONS.length - 2);
    const v7 = PARODY_CATALOGS["parody-catalog-v7"];
    const v8 = PARODY_CATALOGS["parody-catalog-v8"];
    expect(Object.isFrozen(v8)).toBe(true);
    expect(v8.slice(0, v7.length)).toEqual(v7);
    expect(v8.slice(v7.length)).toEqual(V8_ADDITIONS);
    for (const entry of v8) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.requiredAbilities)).toBe(true);
    }
    // The Rat Casino parent lock carries over exactly.
    expect(v8.filter((entry) => entry.relevanceLock).map((entry) => entry.id)).toEqual(
      v7.filter((entry) => entry.relevanceLock).map((entry) => entry.id),
    );
    for (const addition of V8_ADDITIONS) {
      expect(addition.relevanceLock).toBeUndefined();
      expect(addition.referenceAvailableBy).toBe(addition.eligibleFrom);
      for (const version of PARODY_CATALOG_VERSIONS.slice(0, PARODY_CATALOG_VERSIONS.indexOf("parody-catalog-v8")))
        expect(PARODY_CATALOGS[version].some((entry) => entry.id === addition.id)).toBe(false);
    }
  });

  it("resolves each new identity to its exact GLB, measured height and contact fraction", () => {
    for (const entry of V8_ADDITIONS) {
      expect(
        parodyArtwork({
          catalogEntryId: entry.id,
          catalogEntryVersion: entry.version,
          assetId: entry.assetId,
          assetVersion: entry.assetVersion,
        }),
      ).toEqual({
        id: entry.assetId,
        kind: "single",
        contactFraction: 0.625,
        height: HEIGHTS[entry.assetId],
        url: `/studio/assets/media/${entry.assetId}/v001/${entry.assetId}.glb`,
      });
      expect(
        parodyArtwork({
          catalogEntryId: entry.id,
          catalogEntryVersion: entry.version,
          assetId: entry.assetId,
          assetVersion: "v002",
        }),
      ).toBeNull();
    }
  });

  it("prepares the new bosses for editor combat slots in v8 only", () => {
    expect(LEVEL_EDITOR_CATALOG_VERSIONS).toEqual([
      "parody-catalog-v5",
      "parody-catalog-v6",
      "parody-catalog-v7",
      "parody-catalog-v8",
      "parody-catalog-v9",
    ]);
    const ids = (entries: readonly ParodyCatalogEntry[]) => entries.map((entry) => entry.id);
    expect(ids(levelEditorPreparedEnemies("parody-catalog-v8"))).toEqual([
      ...ids(levelEditorPreparedEnemies("parody-catalog-v7")),
      "clubhouse-bully-cat",
      "honk-bus",
    ]);
    // A boss never fills the optional bonus slot.
    expect(ids(levelEditorPreparedBonusEnemies("parody-catalog-v8"))).toEqual(
      ids(levelEditorPreparedBonusEnemies("parody-catalog-v7")),
    );
  });

  it("validates a v8 chapter with a catalog boss and rejects it under v7", () => {
    for (const spec of Object.values(FAMILY_CATALOG_BOSS_WORLDS)) {
      const project = buildFamilyCatalogBossWorld(spec);
      expect(validateLevelEditorProject(project)).toEqual([]);
      expect(project.chapters[0]!.encounterSlots.boss).toEqual({
        source: "catalog",
        catalogEntryId: spec.bossEntryId,
        catalogEntryVersion: "v001",
      });
      expect(
        validateLevelEditorProject({ ...project, catalogVersion: "parody-catalog-v7" }).map((entry) => entry.code),
      ).toContain("encounter.catalog-missing");
    }
  });

  it("judges each boss's window at the chapter start", () => {
    const bossCodes = (spec: FamilyCatalogBossWorldSpec, birth: string) => {
      const dated = withBirth(spec, birth);
      const result = applyLevelEditorCommands(
        createWorldEditorProject({ projectId: dated.projectId, catalogVersion: "parody-catalog-v8" }),
        familyCatalogBossWorldCommands(dated),
      );
      return result.issues
        .filter((entry) => entry.path.endsWith('encounterSlots["boss"]'))
        .map((entry) => entry.code);
    };
    const { clubhouse, playroom } = FAMILY_CATALOG_BOSS_WORLDS;
    expect(bossCodes(clubhouse, "2006-05-05")).toEqual([]);
    expect(bossCodes(clubhouse, "2016-11-06")).toEqual([]);
    expect(bossCodes(clubhouse, "2006-05-04")).toEqual(["encounter.date-eligibility"]);
    expect(bossCodes(clubhouse, "2016-11-07")).toEqual(["encounter.date-eligibility"]);
    expect(bossCodes(playroom, "2018-01-01")).toEqual([]);
    expect(bossCodes(playroom, "2024-06-01")).toEqual([]);
    expect(bossCodes(playroom, "2017-12-31")).toEqual(["encounter.date-eligibility"]);
  });

  it("names the catalog boss by its frozen title in the chapter story", () => {
    for (const entry of V8_ADDITIONS) {
      const level = {
        periodId: entry.periodId,
        encounters: [
          {
            id: "boss",
            role: entry.role,
            kind: entry.kind,
            maxHp: 1,
            hp: 1,
            attackDamage: 1,
            defeated: false,
            content: {
              catalogEntryId: entry.id,
              catalogEntryVersion: entry.version,
              assetId: entry.assetId,
              assetVersion: entry.assetVersion,
            },
          },
        ],
      } as unknown as ActiveLevelView;
      expect(eraStory(2020, level).enemies.boss).toBe(entry.title);
    }
  });
});
