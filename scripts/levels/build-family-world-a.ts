/**
 * Generates World A, "Clubhouse to Casino" (`family-world-a@v1`, PLAN-019).
 *
 * Usage: tsx scripts/levels/build-family-world-a.ts [--write]
 *
 * The older child's four-chapter family world template. This generator owns
 * the whole world: the chapter list, the fictional birth date, the contiguous
 * represented dates and recovered ages, the preview memories and every
 * chapter's cast. Each chapter's level comes whole from its own pure chapter
 * generator under `scripts/levels/family/`:
 *
 *   1. The Toon Clubhouse       `family-a1-clubhouse`  clubhouse  ages 0 -> 2
 *   2. Harbor Rescue            `family-a2-harbor`     harbor     ages 2 -> 5
 *   3. Hero City                `family-a3-rooftop`    rooftop    ages 5 -> 9
 *   4. Rat Casino After Hours   `family-a4-casino`     casino     ages 9 -> 11
 *
 * Casts (WORLD-SPEC): a catalog reference where the newest parody catalog has
 * the landed model (the Captain Bully Cat boss and the whole Rat Casino
 * cast), otherwise a project enemy candidate with neutral placeholder art. A
 * chapter with one ordinary identity puts it in all four ordinary slots with
 * one kind (R11); Hero City has two (putty grunt and lab robot). The Radio
 * Showman takes the casino's optional bonus slot, so Golden is scenic only.
 * The friendly characters need no command: each level's three friendly
 * anchors take the chapter's friendly creatures from the frozen friendly
 * catalog.
 *
 * All copy and dates here are fictional template data. A family journey
 * rebases the dates onto the child's private birthday at publish time
 * (DESIGN-024 D-03) and replaces the preview memories with real photos.
 *
 * Without `--write` it prints the command batch. With it, it rewrites the
 * checked-in command history (`scripts/levels/family-world-a.commands.json`)
 * and the template project (`src/shared/levels/family-world-a-v1.json`) that
 * `pnpm levels:validate` replays byte-identically and the family template
 * registry serves.
 */
import { writeFile } from "node:fs/promises";
import {
  applyLevelEditorCommands,
  createWorldEditorProject,
  serializeLevelEditorProject,
  validateLevelEditorProject,
  type LevelEditorCatalogVersion,
  type LevelEditorCommand,
  type LevelEditorCommandBatch,
  type LevelEditorEncounterReference,
  type LevelEditorProjectV2,
  type WorldEditorLevelDocument,
} from "../../src/shared/editor-project.js";
import {
  chapterCommands,
  worldShellCommands,
  type WorldShellChapter,
} from "./lib/growth-kit.js";
import {
  FAMILY_A1_CAST,
  FAMILY_WORLD_A_FICTIONAL_BIRTH_DATE,
  familyA1Level,
  familyA1ShellChapter,
} from "./family/a1.js";
import {
  FAMILY_A2_AGES,
  FAMILY_A2_CAST,
  FAMILY_A2_ROUTE_ID,
  FAMILY_A2_THEME,
  familyA2Level,
} from "./family/a2.js";
import {
  FAMILY_A3_AGES,
  FAMILY_A3_ROUTE_ID,
  FAMILY_A3_THEME,
  familyA3CastCommands,
  familyA3Level,
} from "./family/a3.js";
import {
  FAMILY_A4_CAST,
  FAMILY_A4_ROUTE_ID,
  FAMILY_A4_THEME,
  familyA4Level,
} from "./family/a4.js";

export const FAMILY_WORLD_A_TEMPLATE_ID = "family-world-a";
export const FAMILY_WORLD_A_TEMPLATE_VERSION = "v1";
/** The name administrators see when they choose a template (WORLD-SPEC). */
export const FAMILY_WORLD_A_NAME = "Clubhouse to Casino";
export const FAMILY_WORLD_A_BIRTH_DATE = FAMILY_WORLD_A_FICTIONAL_BIRTH_DATE;
/**
 * The newest parody catalog when v1 was generated. It is pinned, not derived:
 * a published template is frozen by fingerprint, so a later catalog version
 * belongs in a new template version.
 */
export const FAMILY_WORLD_A_CATALOG_VERSION: LevelEditorCatalogVersion = "parody-catalog-v8";

/** One chapter of the world: its shell entry, level and cast commands. */
export interface WorldAChapter {
  readonly key: "a1" | "a2" | "a3" | "a4";
  readonly shell: WorldShellChapter;
  readonly level: () => WorldEditorLevelDocument;
  /** Cast commands, run after the level is in place. */
  readonly cast: (chapterId: string) => LevelEditorCommand[];
}

const candidate = (candidateId: string): LevelEditorEncounterReference => ({
  source: "candidate",
  candidateId,
});

/**
 * The four chapters in play order. Each represented range runs from the
 * fictional birthday plus its start age to the birthday of its recovered age,
 * so the ranges are contiguous and the last one ends at age 11 (WORLD-SPEC).
 */
export const FAMILY_WORLD_A_CHAPTERS: readonly WorldAChapter[] = Object.freeze([
  {
    key: "a1",
    shell: familyA1ShellChapter("family-a1"),
    level: familyA1Level,
    cast: (chapterId) => {
      const chapter = chapterCommands(chapterId);
      const ordinary = candidate(FAMILY_A1_CAST.ordinary.id);
      return [
        chapter.addCandidate("ordinary-1", FAMILY_A1_CAST.ordinary),
        chapter.assign("ordinary-2", ordinary),
        chapter.assign("ordinary-3", ordinary),
        chapter.assign("ordinary-4", ordinary),
        // Captain Bully Cat's model is registered in parody-catalog-v8.
        chapter.assign("boss", FAMILY_A1_CAST.boss),
      ];
    },
  },
  {
    key: "a2",
    shell: {
      chapterId: "family-a2",
      routeId: FAMILY_A2_ROUTE_ID,
      name: "Harbor Rescue",
      subtitle: "Boats, rooftops and a lookout",
      description:
        "Ride the boats, hop the town rooftops and climb the lookout to stop the rival mayor.",
      theme: FAMILY_A2_THEME,
      representedDateRange: { startDate: "2017-01-15", endDate: "2020-01-15" },
      recoveredAge: { ...FAMILY_A2_AGES },
      previewMemories: [
        { slotId: "minor-one", date: "2018-01-15", label: "Splashing at the harbor" },
        { slotId: "minor-two", date: "2019-01-15", label: "A brave rescue" },
        { slotId: "major", date: "2020-01-15", label: "Turning 5!" },
      ],
    },
    level: familyA2Level,
    cast: (chapterId) => {
      const chapter = chapterCommands(chapterId);
      const kitten = candidate(FAMILY_A2_CAST.ordinary.id);
      return [
        chapter.addCandidate("ordinary-1", FAMILY_A2_CAST.ordinary),
        chapter.assign("ordinary-2", kitten),
        chapter.assign("ordinary-3", kitten),
        chapter.assign("ordinary-4", kitten),
        // The laundry-annex branch holds the chapter's optional fight.
        chapter.assign("bonus-1", kitten),
        chapter.addCandidate("boss", FAMILY_A2_CAST.boss),
      ];
    },
  },
  {
    key: "a3",
    shell: {
      chapterId: "family-a3",
      routeId: FAMILY_A3_ROUTE_ID,
      name: "Hero City",
      subtitle: "Rooftops above the city",
      description:
        "Leap between rooftops, bounce off the vents and stop the monster-inator.",
      theme: FAMILY_A3_THEME,
      representedDateRange: { startDate: "2020-01-15", endDate: "2024-01-15" },
      recoveredAge: { ...FAMILY_A3_AGES },
      previewMemories: [
        { slotId: "minor-one", date: "2021-06-12", label: "Rooftop picnic" },
        { slotId: "minor-two", date: "2022-10-08", label: "City lights" },
        { slotId: "major", date: "2024-01-15", label: "Turning 9!" },
      ],
    },
    level: familyA3Level,
    // Putty grunts (a) and lab robots (b, and the bonus prototype); the
    // Monster-inator boss.
    cast: familyA3CastCommands,
  },
  {
    key: "a4",
    shell: {
      chapterId: "family-a4",
      routeId: FAMILY_A4_ROUTE_ID,
      name: "Rat Casino After Hours",
      subtitle: "The mascots are still awake",
      description:
        "Climb the old casino's stages, outlast the mascots and face the Rat Pit Boss.",
      theme: FAMILY_A4_THEME,
      representedDateRange: { startDate: "2024-01-15", endDate: "2026-01-15" },
      recoveredAge: { fromYears: 9, toYears: 11 },
      previewMemories: [
        { slotId: "minor-one", date: "2024-09-15", label: "A night at the arcade" },
        { slotId: "minor-two", date: "2025-05-15", label: "A backstage tour" },
        { slotId: "major", date: "2026-01-15", label: "Turning 11!" },
      ],
    },
    level: familyA4Level,
    cast: (chapterId) => {
      const chapter = chapterCommands(chapterId);
      return [
        ...(["ordinary-1", "ordinary-2", "ordinary-3", "ordinary-4", "boss"] as const).map(
          (slot) => chapter.assign(slot, FAMILY_A4_CAST.slots[slot]),
        ),
        // The Radio Showman replaces Golden in the optional bonus fight.
        chapter.addCandidate("bonus-1", FAMILY_A4_CAST.bonus),
      ];
    },
  },
]);

/** The whole world as one command batch against a fresh world project. */
export function familyWorldACommands(): LevelEditorCommandBatch {
  return {
    expectedRevision: 0,
    commands: [
      ...worldShellCommands({
        name: FAMILY_WORLD_A_NAME,
        fictionalBirthDate: FAMILY_WORLD_A_BIRTH_DATE,
        chapters: FAMILY_WORLD_A_CHAPTERS.map((chapter) => chapter.shell),
      }),
      ...FAMILY_WORLD_A_CHAPTERS.flatMap((chapter) => [
        chapterCommands(chapter.shell.chapterId).replaceLevel(chapter.level()),
        ...chapter.cast(chapter.shell.chapterId),
      ]),
    ],
  };
}

/** The base project the command history replays against. */
export function familyWorldABase(): LevelEditorProjectV2 {
  return createWorldEditorProject({
    projectId: FAMILY_WORLD_A_TEMPLATE_ID,
    catalogVersion: FAMILY_WORLD_A_CATALOG_VERSION,
  });
}

export function buildFamilyWorldA(): LevelEditorProjectV2 {
  const result = applyLevelEditorCommands(familyWorldABase(), familyWorldACommands());
  if (!result.ok)
    throw new Error(
      `World A commands failed: ${result.issues.map((entry) => `${entry.path}: ${entry.message} (${entry.code})`).join("; ")}`,
    );
  const issues = validateLevelEditorProject(result.project);
  if (issues.length > 0)
    throw new Error(
      `World A is invalid: ${issues.map((entry) => `${entry.path}: ${entry.message} (${entry.code})`).join("; ")}`,
    );
  return result.project as LevelEditorProjectV2;
}

export const FAMILY_WORLD_A_COMMANDS_URL = new URL(
  "./family-world-a.commands.json",
  import.meta.url,
);
export const FAMILY_WORLD_A_PROJECT_URL = new URL(
  "../../src/shared/levels/family-world-a-v1.json",
  import.meta.url,
);

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const commands = `${JSON.stringify(familyWorldACommands(), null, 2)}\n`;
  const project = serializeLevelEditorProject(buildFamilyWorldA());
  if (process.argv.includes("--write")) {
    await writeFile(FAMILY_WORLD_A_COMMANDS_URL, commands);
    await writeFile(FAMILY_WORLD_A_PROJECT_URL, project);
    process.stdout.write("Wrote family-world-a commands and template project\n");
  } else {
    process.stdout.write(commands);
  }
}
