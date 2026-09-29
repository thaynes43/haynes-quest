/**
 * Frozen parody-catalog-v10 (DESIGN-026, PLAN-019 cast integration): v9 plus
 * the six family-era Blender models merged after v8, registered as prepared
 * gameplay enemies with the coordinator's WORLD-SPEC names, periods, roles and
 * windows. The worlds here are synthetic one-chapter fixtures with fictional
 * template dates.
 */
import { describe, expect, it } from "vitest";
import { eraStory } from "../../src/client/era";
import { parodyArtwork } from "../../src/game/scene-catalog";
import type { ActiveLevelView } from "../../src/shared/contracts";
import {
  applyLevelEditorCommand,
  applyLevelEditorCommands,
  createWorldEditorProject,
  LEVEL_EDITOR_CATALOG_VERSIONS,
  levelEditorPreparedBonusEnemies,
  levelEditorPreparedEnemies,
  validateLevelEditorProject,
  type LevelEditorCatalogVersion,
  type LevelEditorCommand,
  type LevelEditorProjectV2,
} from "../../src/shared/editor-project";
import {
  PARODY_CATALOG_VERSIONS,
  PARODY_CATALOGS,
  type ParodyCatalogEntry,
} from "../../src/shared/parody-catalog";
import { chapterCommands, worldShellCommands, type WorldShellChapter } from "../../scripts/levels/lib/growth-kit";
import { fixtureCandidate, gardenOrdinaryAs } from "../family-world-fixtures";

/** The exact v10 additions: WORLD-SPEC rows in WO111 delivery-log order. */
const V10_ADDITIONS: readonly ParodyCatalogEntry[] = [
  {
    id: "gadget-helper",
    version: "v001",
    title: "Runaway Gadget",
    reference: "clubhouse toolbox helper gone haywire",
    role: "ordinary",
    kind: "ordinary-a",
    periodId: "toon-clubhouse-v1",
    eligibleFrom: "2006-05-05",
    eligibleThrough: "2016-11-06",
    referenceAvailableBy: "2006-05-05",
    requiredAbilities: ["move"],
    assetId: "gadget-helper",
    assetVersion: "v001",
  },
  {
    id: "rival-mayor",
    version: "v001",
    title: "Mayor Humdrum",
    reference: "scheming rival-town mayor from rescue-pup cartoons",
    role: "boss",
    kind: "boss",
    periodId: "rescue-harbor-v1",
    eligibleFrom: "2013-08-12",
    eligibleThrough: "2026-12-31",
    referenceAvailableBy: "2013-08-12",
    requiredAbilities: ["move"],
    assetId: "rival-mayor",
    assetVersion: "v001",
  },
  {
    id: "yes-yes-veggie",
    version: "v001",
    title: "Yes-Yes Veggie",
    reference: 'the veggies from the "yes yes" eating song',
    role: "ordinary",
    kind: "ordinary-a",
    periodId: "sing-along-playroom-v1",
    eligibleFrom: "2018-01-01",
    eligibleThrough: "2026-12-31",
    referenceAvailableBy: "2018-01-01",
    requiredAbilities: ["move"],
    assetId: "yes-yes-veggie",
    assetVersion: "v001",
  },
  {
    id: "magic-house",
    version: "v001",
    title: "The Dancing House",
    reference: "a magical family house that dances",
    role: "boss",
    kind: "boss",
    periodId: "magic-house-v1",
    eligibleFrom: "2019-09-01",
    eligibleThrough: "2026-12-31",
    referenceAvailableBy: "2019-09-01",
    requiredAbilities: ["move"],
    assetId: "magic-house",
    assetVersion: "v001",
  },
  {
    id: "mischief-kitten",
    version: "v001",
    title: "Mischief Kitten",
    reference: "the mayor's naughty kitten crew",
    role: "ordinary",
    kind: "ordinary-a",
    periodId: "rescue-harbor-v1",
    eligibleFrom: "2013-08-12",
    eligibleThrough: "2026-12-31",
    referenceAvailableBy: "2013-08-12",
    requiredAbilities: ["move"],
    assetId: "mischief-kitten",
    assetVersion: "v001",
  },
  {
    id: "bin-chicken",
    version: "v001",
    title: "Bin Chicken",
    reference: "the cheeky bin-raiding ibis from a backyard cartoon dog family",
    role: "ordinary",
    kind: "ordinary-a",
    periodId: "magic-house-v1",
    eligibleFrom: "2019-09-01",
    eligibleThrough: "2026-12-31",
    referenceAvailableBy: "2019-09-01",
    requiredAbilities: ["move"],
    assetId: "bin-chicken",
    assetVersion: "v001",
  },
];

/** Logged `heightM` per model (WO111 delivery log); contact 1.25 s of 2.0 s. */
const HEIGHTS: Record<string, number> = {
  "gadget-helper": 1.118245,
  "rival-mayor": 2.4745,
  "yes-yes-veggie": 0.997798,
  "magic-house": 2.898,
  "mischief-kitten": 0.9186895485603485,
  "bin-chicken": 1.2570000538098558,
};

/** One-chapter synthetic worlds that cast a new ordinary and boss per era. */
const ERAS = [
  { key: "clubhouse", ordinary: "gadget-helper", boss: "clubhouse-bully-cat", theme: "clubhouse" },
  { key: "harbor", ordinary: "mischief-kitten", boss: "rival-mayor", theme: "harbor" },
  { key: "playroom", ordinary: "yes-yes-veggie", boss: "honk-bus", theme: "playroom" },
  { key: "casita", ordinary: "bin-chicken", boss: "magic-house", theme: "casita" },
] as const;

const ids = (entries: readonly ParodyCatalogEntry[]) => entries.map((entry) => `${entry.id}@${entry.version}`);
const years = (date: string, offset: number) => `${Number(date.slice(0, 4)) + offset}${date.slice(4)}`;
const catalog = (catalogEntryId: string) => ({
  source: "catalog" as const,
  catalogEntryId,
  catalogEntryVersion: "v001" as const,
});

function eraChapter(era: (typeof ERAS)[number], birth: string): WorldShellChapter {
  return {
    chapterId: `${era.key}-chapter`,
    routeId: `${era.key}-route`,
    name: "A synthetic era chapter",
    subtitle: "Fictional template data",
    description: "A synthetic one-chapter world for the v10 catalog checks.",
    theme: era.theme,
    representedDateRange: { startDate: birth, endDate: years(birth, 2) },
    recoveredAge: { fromYears: 0, toYears: 2 },
    previewMemories: [
      { slotId: "minor-one", date: `${birth.slice(0, 4)}-09-01`, label: "Summer picnic" },
      { slotId: "minor-two", date: `${Number(birth.slice(0, 4)) + 1}-07-01`, label: "A sunny afternoon" },
      { slotId: "major", date: years(birth, 2), label: "Turning 2!" },
    ],
  };
}

function eraCommands(era: (typeof ERAS)[number], birth: string): LevelEditorCommand[] {
  const chapter = chapterCommands(`${era.key}-chapter`);
  return [
    ...worldShellCommands({ fictionalBirthDate: birth, chapters: [eraChapter(era, birth)] }),
    // The garden anchors with one ordinary kind (R11).
    chapter.setAnchor("encounter.ordinary-2", gardenOrdinaryAs("ordinary-2", "ordinary-a")),
    chapter.setAnchor("encounter.ordinary-4", gardenOrdinaryAs("ordinary-4", "ordinary-a")),
    ...(["ordinary-1", "ordinary-2", "ordinary-3", "ordinary-4"] as const).map((slot) =>
      chapter.assign(slot, catalog(era.ordinary)),
    ),
    chapter.assign("boss", catalog(era.boss)),
  ];
}

function eraWorld(era: (typeof ERAS)[number], birth: string, catalogVersion: LevelEditorCatalogVersion = "parody-catalog-v10") {
  return applyLevelEditorCommands(
    createWorldEditorProject({ projectId: `family-v10-${era.key}`, catalogVersion }),
    { expectedRevision: 0, commands: eraCommands(era, birth) },
  );
}

describe("parody-catalog-v10", () => {
  const v9 = PARODY_CATALOGS["parody-catalog-v9"];
  const v10 = PARODY_CATALOGS["parody-catalog-v10"];

  it("remains a registered editor catalog", () => {
    expect(PARODY_CATALOG_VERSIONS).toContain("parody-catalog-v10");
    expect(LEVEL_EDITOR_CATALOG_VERSIONS).toEqual([
      "parody-catalog-v5",
      "parody-catalog-v6",
      "parody-catalog-v7",
      "parody-catalog-v8",
      "parody-catalog-v9",
      "parody-catalog-v10",
      "parody-catalog-v11",
    ]);
  });

  it("is v9 unchanged plus the six landed family-era models, and v1-v9 stay frozen", () => {
    expect(Object.isFrozen(v10)).toBe(true);
    expect(v10.slice(0, v9.length)).toEqual(v9);
    expect(v10.slice(v9.length)).toEqual(V10_ADDITIONS);
    for (const entry of v10) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.requiredAbilities)).toBe(true);
    }
    // Both parent locks (Rat Casino, Besties) carry over; nothing new is locked.
    expect(v10.filter((entry) => entry.relevanceLock).map((entry) => entry.id)).toEqual(
      v9.filter((entry) => entry.relevanceLock).map((entry) => entry.id),
    );
    for (const addition of V10_ADDITIONS) {
      expect(addition.relevanceLock).toBeUndefined();
      expect(addition.referenceAvailableBy).toBe(addition.eligibleFrom);
      expect(addition.assetId).toBe(addition.id);
      for (const version of PARODY_CATALOG_VERSIONS.slice(0, PARODY_CATALOG_VERSIONS.indexOf("parody-catalog-v10")))
        expect(PARODY_CATALOGS[version].some((entry) => entry.id === addition.id), version).toBe(false);
    }
  });

  it("gives each ordinary the kind its chapter's anchors use", () => {
    const kinds = Object.fromEntries(V10_ADDITIONS.map((entry) => [entry.id, [entry.role, entry.kind]]));
    expect(kinds).toEqual({
      "gadget-helper": ["ordinary", "ordinary-a"],
      "rival-mayor": ["boss", "boss"],
      "yes-yes-veggie": ["ordinary", "ordinary-a"],
      "magic-house": ["boss", "boss"],
      "mischief-kitten": ["ordinary", "ordinary-a"],
      "bin-chicken": ["ordinary", "ordinary-a"],
    });
  });

  it("resolves each new identity to its exact GLB, logged height and contact fraction", () => {
    for (const entry of V10_ADDITIONS) {
      const content = {
        catalogEntryId: entry.id,
        catalogEntryVersion: entry.version,
        assetId: entry.assetId,
        assetVersion: entry.assetVersion,
      };
      expect(parodyArtwork(content)).toEqual({
        id: entry.assetId,
        kind: "single",
        contactFraction: 0.625,
        height: HEIGHTS[entry.assetId],
        url: `/studio/assets/media/${entry.assetId}/v001/${entry.assetId}.glb`,
      });
      expect(parodyArtwork({ ...content, assetVersion: "v002" })).toBeNull();
      // A frozen placeholder candidate of the same name never resolves to the model.
      expect(
        parodyArtwork({
          catalogEntryId: `editor-candidate-${entry.id}`,
          catalogEntryVersion: "draft-v1",
          assetId: "neutral-enemy-placeholder",
          assetVersion: "v001",
        }),
      ).toBeNull();
    }
  });

  it("prepares the new models for editor combat slots, and the ordinaries for the optional slot, in v10 only", () => {
    const entryIds = (entries: readonly ParodyCatalogEntry[]) => entries.map((entry) => entry.id);
    expect(entryIds(levelEditorPreparedEnemies("parody-catalog-v10"))).toEqual([
      ...entryIds(levelEditorPreparedEnemies("parody-catalog-v9")),
      ...V10_ADDITIONS.map((entry) => entry.id),
    ]);
    // Prepared ordinaries in catalog order, then the bonus-only Golden cameo.
    const v9Bonus = entryIds(levelEditorPreparedBonusEnemies("parody-catalog-v9"));
    expect(v9Bonus.at(-1)).toBe("golden-after-hours-rat");
    expect(entryIds(levelEditorPreparedBonusEnemies("parody-catalog-v10"))).toEqual([
      ...v9Bonus.slice(0, -1),
      "gadget-helper",
      "yes-yes-veggie",
      "mischief-kitten",
      "bin-chicken",
      "golden-after-hours-rat",
    ]);
    expect(entryIds(levelEditorPreparedBonusEnemies("parody-catalog-v10"))).not.toContain("rival-mayor");
    expect(entryIds(levelEditorPreparedBonusEnemies("parody-catalog-v10"))).not.toContain("magic-house");
    for (const version of LEVEL_EDITOR_CATALOG_VERSIONS.slice(0, LEVEL_EDITOR_CATALOG_VERSIONS.indexOf("parody-catalog-v10")))
      for (const entry of V10_ADDITIONS)
        expect(ids(levelEditorPreparedEnemies(version)), version).not.toContain(`${entry.id}@v001`);
  });

  it("validates a v10 chapter cast entirely from catalog models and rejects it under v9", () => {
    const births = { clubhouse: "2015-01-15", harbor: "2017-01-15", playroom: "2020-06-01", casita: "2022-06-01" };
    for (const era of ERAS) {
      const result = eraWorld(era, births[era.key]);
      expect(result.issues, era.key).toEqual([]);
      const project = result.project as LevelEditorProjectV2;
      expect(validateLevelEditorProject(project)).toEqual([]);
      expect(project.enemyCandidates).toEqual([]);
      expect(project.chapters[0]!.encounterSlots["ordinary-1"]).toEqual(catalog(era.ordinary));
      expect(project.chapters[0]!.encounterSlots.boss).toEqual(catalog(era.boss));
      const codes = validateLevelEditorProject({ ...project, catalogVersion: "parody-catalog-v9" }).map(
        (entry) => entry.code,
      );
      expect(codes, era.key).toContain("encounter.catalog-missing");
    }
  });

  it("judges each new model's window at the chapter start", () => {
    const codes = (era: (typeof ERAS)[number], birth: string, slot: "ordinary-1" | "boss") =>
      eraWorld(era, birth)
        .issues.filter((entry) => entry.path.endsWith(`encounterSlots["${slot}"]`))
        .map((entry) => entry.code);
    const [clubhouse, harbor, playroom, casita] = ERAS;
    expect(codes(clubhouse, "2006-05-05", "ordinary-1")).toEqual([]);
    expect(codes(clubhouse, "2016-11-06", "ordinary-1")).toEqual([]);
    expect(codes(clubhouse, "2006-05-04", "ordinary-1")).toEqual(["encounter.date-eligibility"]);
    expect(codes(clubhouse, "2016-11-07", "ordinary-1")).toEqual(["encounter.date-eligibility"]);
    for (const slot of ["ordinary-1", "boss"] as const) {
      expect(codes(harbor, "2013-08-12", slot)).toEqual([]);
      expect(codes(harbor, "2013-08-11", slot)).toEqual(["encounter.date-eligibility"]);
      expect(codes(casita, "2019-09-01", slot)).toEqual([]);
      expect(codes(casita, "2019-08-31", slot)).toEqual(["encounter.date-eligibility"]);
    }
    expect(codes(playroom, "2018-01-01", "ordinary-1")).toEqual([]);
    expect(codes(playroom, "2017-12-31", "ordinary-1")).toEqual(["encounter.date-eligibility"]);
  });

  it("names each new model by its frozen title in the chapter story", () => {
    for (const entry of V10_ADDITIONS) {
      const level = {
        periodId: entry.periodId,
        encounters: [
          {
            id: "encounter",
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
      expect(eraStory(2020, level).enemies[entry.kind]).toBe(entry.title);
    }
  });
});

describe("candidate ids and the catalog a project pins", () => {
  const kitten = fixtureCandidate("mischief-kitten", "Mischief Kitten", "rescue-harbor-v1", "ordinary-a", {
    startDate: "2013-08-12",
    endDate: "2026-12-31",
  });
  const addCandidate = (catalogVersion: LevelEditorCatalogVersion, candidate = kitten) => {
    const era = ERAS[1];
    // The harbor shell and anchors, with no cast assigned yet.
    const base = applyLevelEditorCommands(
      createWorldEditorProject({ projectId: "family-v10-ids", catalogVersion }),
      { expectedRevision: 0, commands: eraCommands(era, "2017-01-15").slice(0, -5) },
    );
    if (!base.ok) throw new Error("Expected the synthetic harbor shell to build");
    return applyLevelEditorCommand(base.project, {
      type: "enemy.add",
      chapterId: `${era.key}-chapter`,
      slot: "ordinary-1",
      candidate,
    });
  };
  const addKitten = (catalogVersion: LevelEditorCatalogVersion) => addCandidate(catalogVersion);

  it("lets a project pinned before v10 keep a candidate named like a later catalog entry", () => {
    // family-world-a@v2 (on v8) froze the mischief-kitten candidate before
    // parody-catalog-v10 registered the model under the same id.
    for (const version of ["parody-catalog-v8", "parody-catalog-v9"] as const) {
      const result = addKitten(version);
      expect(result.ok, version).toBe(true);
      // The rest of the cast is still unassigned; no candidate issue is raised.
      expect(
        validateLevelEditorProject(result.project).filter((entry) => entry.path.startsWith("$.enemyCandidates")),
        version,
      ).toEqual([]);
    }
  });

  it("refuses that candidate id on v10, where it names a catalog entry", () => {
    expect(addKitten("parody-catalog-v10")).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: "candidate.duplicate-id" })],
    });
    const onV9 = addKitten("parody-catalog-v9").project as LevelEditorProjectV2;
    expect(
      validateLevelEditorProject({ ...onV9, catalogVersion: "parody-catalog-v10" })
        .filter((entry) => entry.path.startsWith("$.enemyCandidates"))
        .map((entry) => entry.code),
    ).toEqual(["candidate.catalog-id"]);
  });

  it("keeps retired and paused catalog ids reserved for later catalogs", () => {
    // Nap Captain left the catalog after v1; its id stays reserved.
    for (const version of ["parody-catalog-v9", "parody-catalog-v10"] as const)
      expect(addCandidate(version, { ...kitten, id: "nap-captain" }).ok, version).toBe(false);
    expect(addCandidate("parody-catalog-v10", { ...kitten, id: "harbor-stand-in" }).ok).toBe(true);
  });
});
