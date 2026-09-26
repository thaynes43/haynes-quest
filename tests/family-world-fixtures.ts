/**
 * A synthetic three-chapter family world built only from shared editor
 * commands (PLAN-019 foundations): the world shell owns the chapter list,
 * one chapter's level is replaced whole, and every cast is a project
 * candidate in a family-world era period. Chapter one uses one ordinary
 * identity in all four slots (ruling R11). No real names, dates or photos.
 */
import gardenV2 from "../src/shared/levels/garden-playground-v2.json";
import type {
  AuthoredEncounterAnchor,
  AuthoredLevelDocument,
} from "../src/shared/authored-level";
import {
  applyLevelEditorCommands,
  createWorldEditorProject,
  type LevelEditorCatalogVersion,
  type LevelEditorCommand,
  type LevelEditorCommandBatch,
  type LevelEditorEnemyCandidate,
  type LevelEditorProjectV2,
  type WorldEditorLevelDocument,
} from "../src/shared/editor-project";
import type { ParodyPeriodId } from "../src/shared/parody-catalog";
import type { EncounterKind } from "../src/shared/contracts";
import {
  chapterCommands,
  decor,
  platform,
  worldShellCommands,
  type WorldShellChapter,
} from "../scripts/levels/lib/growth-kit";

export const FAMILY_FIXTURE_PROJECT_ID = "family-fixture-world";

export function fixtureCandidate(
  id: string,
  name: string,
  periodId: ParodyPeriodId,
  kind: EncounterKind,
  eligibility: { readonly startDate: string; readonly endDate: string },
): LevelEditorEnemyCandidate {
  return {
    id,
    name,
    periodId,
    recognizableReference: "A synthetic test parody for the family world foundations",
    visualJoke: "A cheerful placeholder silhouette",
    obstacleOrAttack: "A slow, well-telegraphed swing",
    eligibility,
    role: kind === "boss" ? "boss" : "ordinary",
    kind,
    behaviorPreset: kind,
  };
}

const garden = gardenV2 as unknown as AuthoredLevelDocument;

/** The garden template's ordinary anchor with its kind replaced. */
export function gardenOrdinaryAs(
  slot: "ordinary-1" | "ordinary-2" | "ordinary-3" | "ordinary-4",
  kind: "ordinary-a" | "ordinary-b",
): AuthoredEncounterAnchor {
  return { ...structuredClone(garden.anchors.encounters[slot]), kind };
}

export const FAMILY_FIXTURE_CHAPTERS: readonly WorldShellChapter[] = [
  {
    chapterId: "a1-clubhouse",
    routeId: "a1-clubhouse-route",
    name: "Clubhouse Capers",
    subtitle: "Runaway gadgets and a very grumpy cat captain",
    description: "A synthetic first chapter for the family world foundations.",
    theme: "clubhouse",
    representedDateRange: { startDate: "2015-03-01", endDate: "2017-03-01" },
    recoveredAge: { fromYears: 0, toYears: 2 },
    previewMemories: [
      { slotId: "minor-one", date: "2015-11-01", label: "A first wobbly step" },
      { slotId: "minor-two", date: "2016-07-01", label: "A sunny afternoon" },
      { slotId: "major", date: "2017-03-01", label: "Turning two" },
    ],
  },
  {
    chapterId: "a2-harbor",
    routeId: "a2-harbor-route",
    name: "Harbor Rescue",
    subtitle: "Mischief kittens and a mayor with a plan",
    description: "A synthetic second chapter whose level is replaced whole.",
    theme: "harbor",
    representedDateRange: { startDate: "2017-03-01", endDate: "2020-03-01" },
    recoveredAge: { fromYears: 2, toYears: 5 },
    previewMemories: [
      { slotId: "minor-one", date: "2018-01-01", label: "A day at the docks" },
      { slotId: "minor-two", date: "2019-01-01", label: "A brave rescue" },
      { slotId: "major", date: "2020-03-01", label: "Turning five" },
    ],
  },
  {
    chapterId: "a3-rooftop",
    routeId: "a3-rooftop-route",
    name: "Hero City",
    subtitle: "Putty grunts, runaway robots and a monster-inator",
    description: "A synthetic third chapter with two ordinary identities.",
    theme: "rooftop",
    representedDateRange: { startDate: "2020-03-01", endDate: "2024-03-01" },
    recoveredAge: { fromYears: 5, toYears: 9 },
    previewMemories: [
      { slotId: "minor-one", date: "2021-06-01", label: "A rooftop view" },
      { slotId: "minor-two", date: "2023-01-01", label: "A city adventure" },
      { slotId: "major", date: "2024-03-01", label: "Turning nine" },
    ],
  },
];

export const FAMILY_FIXTURE_CANDIDATES = {
  gadget: fixtureCandidate("fixture-gadget-helper", "Gadget Helper", "toon-clubhouse-v1", "ordinary-a", { startDate: "2006-05-05", endDate: "2019-12-31" }),
  captain: fixtureCandidate("fixture-cat-captain", "Cat Captain", "toon-clubhouse-v1", "boss", { startDate: "2006-05-05", endDate: "2019-12-31" }),
  kitten: fixtureCandidate("fixture-mischief-kitten", "Mischief Kitten", "rescue-harbor-v1", "ordinary-a", { startDate: "2013-08-12", endDate: "2022-12-31" }),
  mayor: fixtureCandidate("fixture-rival-mayor", "Rival Mayor", "rescue-harbor-v1", "boss", { startDate: "2013-08-12", endDate: "2022-12-31" }),
  putty: fixtureCandidate("fixture-putty-grunt", "Putty Grunt", "hero-city-v1", "ordinary-a", { startDate: "2018-12-14", endDate: "2026-12-31" }),
  robot: fixtureCandidate("fixture-lab-robot", "Lab Robot", "hero-city-v1", "ordinary-b", { startDate: "2018-12-14", endDate: "2026-12-31" }),
  monster: fixtureCandidate("fixture-inator-monster", "Inator Monster", "hero-city-v1", "boss", { startDate: "2018-12-14", endDate: "2026-12-31" }),
} as const;

/** The replacement level for chapter two: the garden course, one kind of ordinary, an extra ledge and a shared prop. */
export function familyFixtureHarborLevel(): WorldEditorLevelDocument {
  const level = structuredClone(garden) as unknown as {
    -readonly [Key in keyof WorldEditorLevelDocument]: WorldEditorLevelDocument[Key];
  };
  level.schemaVersion = "authored-level-v4";
  level.id = "a2-harbor-route";
  level.theme = "harbor";
  level.pieces = [
    ...level.pieces,
    platform("harbor-lookout-ledge", { x: 40, z: -20, sizeX: 4, sizeZ: 4, top: 1 }),
  ];
  level.decor = [decor("harbor-tree", "clearing-tree", { x: 48, y: 0, z: -20 })];
  level.anchors = {
    ...level.anchors,
    encounters: {
      ...level.anchors.encounters,
      "ordinary-2": gardenOrdinaryAs("ordinary-2", "ordinary-a"),
      "ordinary-4": gardenOrdinaryAs("ordinary-4", "ordinary-a"),
    },
  };
  return level as WorldEditorLevelDocument;
}

export function familyFixtureWorldCommands(): LevelEditorCommandBatch {
  const [a1, a2, a3] = FAMILY_FIXTURE_CHAPTERS.map((chapter) => chapterCommands(chapter.chapterId));
  const cast = FAMILY_FIXTURE_CANDIDATES;
  const candidate = (id: string) => ({ source: "candidate" as const, candidateId: id });
  const commands: LevelEditorCommand[] = [
    ...worldShellCommands({
      name: "Family Fixture World",
      fictionalBirthDate: "2015-03-01",
      chapters: FAMILY_FIXTURE_CHAPTERS,
    }),
    // Chapter one: one ordinary identity in all four slots.
    a1!.setAnchor("encounter.ordinary-2", gardenOrdinaryAs("ordinary-2", "ordinary-a")),
    a1!.setAnchor("encounter.ordinary-4", gardenOrdinaryAs("ordinary-4", "ordinary-a")),
    a1!.addCandidate("ordinary-1", cast.gadget),
    a1!.assign("ordinary-2", candidate(cast.gadget.id)),
    a1!.assign("ordinary-3", candidate(cast.gadget.id)),
    a1!.assign("ordinary-4", candidate(cast.gadget.id)),
    a1!.addCandidate("boss", cast.captain),
    // Chapter two: the whole level replaced, then its cast.
    a2!.replaceLevel(familyFixtureHarborLevel()),
    a2!.addCandidate("ordinary-1", cast.kitten),
    a2!.assign("ordinary-2", candidate(cast.kitten.id)),
    a2!.assign("ordinary-3", candidate(cast.kitten.id)),
    a2!.assign("ordinary-4", candidate(cast.kitten.id)),
    a2!.addCandidate("boss", cast.mayor),
    // Chapter three: two ordinary identities, a and b.
    a3!.addCandidate("ordinary-1", cast.putty),
    a3!.addCandidate("ordinary-2", cast.robot),
    a3!.assign("ordinary-3", candidate(cast.putty.id)),
    a3!.assign("ordinary-4", candidate(cast.robot.id)),
    a3!.addCandidate("boss", cast.monster),
  ];
  return { expectedRevision: 0, commands };
}

export function buildFamilyFixtureWorld(): LevelEditorProjectV2 {
  const base = createWorldEditorProject({
    projectId: FAMILY_FIXTURE_PROJECT_ID,
    catalogVersion: "parody-catalog-v7",
  });
  const result = applyLevelEditorCommands(base, familyFixtureWorldCommands());
  if (!result.ok)
    throw new Error(
      `Family fixture world failed: ${result.issues.map((entry) => `${entry.path}: ${entry.message}`).join("; ")}`,
    );
  return result.project as LevelEditorProjectV2;
}

/**
 * One-chapter parody-catalog-v8 worlds whose boss is a landed family-era
 * Blender model (DESIGN-026). The chapter copy is the coordinator's final
 * family-world text; the ordinary cast stays a project candidate until its
 * model lands, in all four slots with one kind (ruling R11). Every date is
 * fictional template data.
 */
export interface FamilyCatalogBossWorldSpec {
  readonly projectId: string;
  readonly fictionalBirthDate: string;
  readonly chapter: WorldShellChapter;
  readonly bossEntryId: string;
  readonly ordinary: LevelEditorEnemyCandidate;
}

function shiftYears(date: string, years: number): string {
  return `${Number(date.slice(0, 4)) + years}${date.slice(4)}`;
}

function eraChapter(
  birth: string,
  chapter: Omit<WorldShellChapter, "representedDateRange" | "recoveredAge" | "previewMemories">,
): WorldShellChapter {
  return {
    ...chapter,
    representedDateRange: { startDate: birth, endDate: shiftYears(birth, 2) },
    recoveredAge: { fromYears: 0, toYears: 2 },
    previewMemories: [
      { slotId: "minor-one", date: `${birth.slice(0, 4)}-09-01`, label: "Summer picnic" },
      { slotId: "minor-two", date: `${Number(birth.slice(0, 4)) + 1}-07-01`, label: "A sunny afternoon" },
      { slotId: "major", date: shiftYears(birth, 2), label: "Turning 2!" },
    ],
  };
}

export const FAMILY_CATALOG_BOSS_WORLDS = {
  clubhouse: {
    projectId: "family-v8-clubhouse",
    fictionalBirthDate: "2015-01-15",
    chapter: eraChapter("2015-01-15", {
      chapterId: "a1-clubhouse",
      routeId: "a1-clubhouse-route",
      name: "The Toon Clubhouse",
      subtitle: "Gadgets on the loose",
      description:
        "Bounce up the hill, ride the cliff lift and climb the clubhouse tower to face the bully cat.",
      theme: "clubhouse",
    }),
    bossEntryId: "clubhouse-bully-cat",
    ordinary: fixtureCandidate("gadget-helper", "Runaway Gadget", "toon-clubhouse-v1", "ordinary-a", {
      startDate: "2006-05-05",
      endDate: "2016-11-06",
    }),
  },
  playroom: {
    projectId: "family-v8-playroom",
    fictionalBirthDate: "2020-06-01",
    chapter: eraChapter("2020-06-01", {
      chapterId: "b1-playroom",
      routeId: "b1-playroom-route",
      name: "The Sing-Along Playroom",
      subtitle: "Block towers and bouncy beds",
      description:
        "Climb the playroom towers, bounce on the beds and cheer up the grumpy bus.",
      theme: "playroom",
    }),
    bossEntryId: "honk-bus",
    ordinary: fixtureCandidate("yes-yes-veggie", "Yes-Yes Veggie", "sing-along-playroom-v1", "ordinary-a", {
      startDate: "2018-01-01",
      endDate: "2026-12-31",
    }),
  },
} as const satisfies Record<string, FamilyCatalogBossWorldSpec>;

export function familyCatalogBossWorldCommands(
  spec: FamilyCatalogBossWorldSpec,
): LevelEditorCommandBatch {
  const chapter = chapterCommands(spec.chapter.chapterId);
  const ordinary = { source: "candidate" as const, candidateId: spec.ordinary.id };
  return {
    expectedRevision: 0,
    commands: [
      ...worldShellCommands({ fictionalBirthDate: spec.fictionalBirthDate, chapters: [spec.chapter] }),
      chapter.setAnchor("encounter.ordinary-2", gardenOrdinaryAs("ordinary-2", "ordinary-a")),
      chapter.setAnchor("encounter.ordinary-4", gardenOrdinaryAs("ordinary-4", "ordinary-a")),
      chapter.addCandidate("ordinary-1", spec.ordinary),
      chapter.assign("ordinary-2", ordinary),
      chapter.assign("ordinary-3", ordinary),
      chapter.assign("ordinary-4", ordinary),
      chapter.assign("boss", {
        source: "catalog",
        catalogEntryId: spec.bossEntryId,
        catalogEntryVersion: "v001",
      }),
    ],
  };
}

export function buildFamilyCatalogBossWorld(
  spec: FamilyCatalogBossWorldSpec,
  catalogVersion: LevelEditorCatalogVersion = "parody-catalog-v8",
): LevelEditorProjectV2 {
  const result = applyLevelEditorCommands(
    createWorldEditorProject({ projectId: spec.projectId, catalogVersion }),
    familyCatalogBossWorldCommands(spec),
  );
  if (!result.ok)
    throw new Error(
      `Family catalog boss world failed: ${result.issues.map((entry) => `${entry.path}: ${entry.code}`).join("; ")}`,
    );
  return result.project as LevelEditorProjectV2;
}
