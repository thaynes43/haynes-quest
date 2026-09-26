/**
 * Generates World B, "Playroom to Big Stage" (`family-world-b@v2`, PLAN-019).
 *
 * Usage: tsx scripts/levels/build-family-world-b.ts [--write]
 *
 * The younger child's three-chapter family world template. This generator
 * owns the whole world: the chapter list, the fictional birth date, the
 * contiguous represented dates and recovered ages, the preview memories and
 * every chapter's cast. Each chapter's level comes whole from its own pure
 * chapter generator under `scripts/levels/family/`:
 *
 *   1. The Sing-Along Playroom  `family-b1-playroom`  playroom  ages 0 -> 2
 *   2. The Magic House          `family-b2-casita`    casita    ages 2 -> 4
 *   3. Besties' Big Stage       `family-b3-stage`     party     ages 4 -> 6
 *
 * Casts (WORLD-SPEC): a catalog reference where the newest parody catalog has
 * the landed model, otherwise a project enemy candidate with neutral
 * placeholder art. Each chapter has one ordinary identity, so all four
 * ordinary slots share it and its kind (R11). The friendly characters need no
 * command: the three friendly anchors in each level take the chapter's
 * friendly creatures from the frozen friendly catalog.
 *
 * All copy and dates here are fictional template data. A family journey
 * rebases the dates onto the child's private birthday at publish time
 * (DESIGN-024 D-03) and replaces the preview memories with real photos.
 *
 * Without `--write` it prints the command batch. With it, it rewrites the
 * checked-in command history (`scripts/levels/family-world-b-v2.commands.json`)
 * and the template project (`src/shared/levels/family-world-b-v2.json`) that
 * `pnpm levels:validate` replays byte-identically and the family template
 * registry serves.
 *
 * Versions. A published journey freezes its template's exact fingerprint, so a
 * content change is a new template version and the older one stays registered
 * and loadable, byte for byte. `family-world-b@v1` (`family-world-b.commands.json`
 * and `family-world-b-v1.json`) is frozen as it merged in PR #92. v2 is the
 * adversarial-review fix: the Besties chapter's cast opens on 2022-07-31 under
 * parody-catalog-v9's parent lock, so every six-year-old validates (v1 dropped
 * birthdays from 2019-09-27 to 2019-12-31), and the toy elevator (B1) and the
 * stage lift (B3) have deep cars that close the shaft at walking height.
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
  type LevelEditorEnemyCandidate,
  type LevelEditorProjectV2,
  type WorldEditorLevelDocument,
} from "../../src/shared/editor-project.js";
import {
  chapterCommands,
  worldShellCommands,
  type WorldShellChapter,
} from "./lib/growth-kit.js";
import {
  FAMILY_B1_BOSS,
  FAMILY_B1_CAST,
  FAMILY_B1_SHELL_CHAPTER,
  FAMILY_WORLD_B_FICTIONAL_BIRTH_DATE,
  familyB1Level,
} from "./family/b1.js";
import { B2_CAST, B2_SHELL_CHAPTER, buildB2Level } from "./family/b2.js";
import {
  FAMILY_B3_AGES,
  FAMILY_B3_BOSS,
  FAMILY_B3_COPY,
  FAMILY_B3_ORDINARY,
  FAMILY_B3_ROUTE_ID,
  familyB3Level,
} from "./family/b3.js";

export const FAMILY_WORLD_B_TEMPLATE_ID = "family-world-b";
export const FAMILY_WORLD_B_TEMPLATE_VERSION = "v2";
/** The name administrators see when they choose a template (WORLD-SPEC). */
export const FAMILY_WORLD_B_NAME = "Playroom to Big Stage";
export const FAMILY_WORLD_B_BIRTH_DATE = FAMILY_WORLD_B_FICTIONAL_BIRTH_DATE;
/**
 * The parody catalog v2 pins: v9 carries the Besties' parent lock. It is
 * pinned, not derived: a published template is frozen by fingerprint, so a
 * later catalog version belongs in a new template version (v1 pins v8).
 */
export const FAMILY_WORLD_B_CATALOG_VERSION: LevelEditorCatalogVersion = "parody-catalog-v9";

/** One chapter of the world: its shell entry, level and cast. */
interface WorldBChapter {
  readonly shell: WorldShellChapter;
  readonly level: () => WorldEditorLevelDocument;
  /** The chapter's one ordinary identity, in all four ordinary slots (R11). */
  readonly ordinary: LevelEditorEnemyCandidate;
  /** A catalog reference, or a project candidate the chapter adds. */
  readonly boss: LevelEditorEncounterReference | LevelEditorEnemyCandidate;
}

/**
 * The three chapters in play order. The represented ranges are contiguous:
 * each runs from the fictional birthday plus its start age to the birthday
 * of its recovered age (WORLD-SPEC).
 */
export const FAMILY_WORLD_B_CHAPTERS: readonly WorldBChapter[] = Object.freeze([
  {
    shell: FAMILY_B1_SHELL_CHAPTER,
    level: familyB1Level,
    ordinary: FAMILY_B1_CAST.ordinary,
    boss: FAMILY_B1_BOSS,
  },
  {
    shell: {
      ...B2_SHELL_CHAPTER,
      // Chapter one already has a summer picnic.
      previewMemories: [
        { slotId: "minor-one", date: "2022-11-12", label: "Garden tea party" },
        { slotId: "minor-two", date: "2023-08-19", label: "Splash day" },
        { slotId: "major", date: "2024-06-01", label: "Turning 4!" },
      ],
    },
    level: buildB2Level,
    ordinary: B2_CAST.ordinary,
    boss: B2_CAST.boss,
  },
  {
    shell: {
      chapterId: "family-b3",
      routeId: FAMILY_B3_ROUTE_ID,
      name: FAMILY_B3_COPY.name,
      subtitle: FAMILY_B3_COPY.subtitle,
      description: FAMILY_B3_COPY.description,
      theme: FAMILY_B3_COPY.theme,
      representedDateRange: { startDate: "2024-06-01", endDate: "2026-06-01" },
      recoveredAge: FAMILY_B3_AGES,
      previewMemories: [
        { slotId: "minor-one", date: "2024-12-14", label: "Front-row seats" },
        { slotId: "minor-two", date: "2025-08-16", label: "Dance party" },
        { slotId: "major", date: "2026-06-01", label: "Turning 6!" },
      ],
    },
    level: familyB3Level,
    ordinary: FAMILY_B3_ORDINARY,
    boss: FAMILY_B3_BOSS,
  },
]);

function isCandidate(
  boss: LevelEditorEncounterReference | LevelEditorEnemyCandidate,
): boss is LevelEditorEnemyCandidate {
  return !("source" in boss);
}

/** One chapter's level and cast. */
function chapterCastCommands(chapter: WorldBChapter): LevelEditorCommand[] {
  const commands = chapterCommands(chapter.shell.chapterId);
  const ordinary: LevelEditorEncounterReference = {
    source: "candidate",
    candidateId: chapter.ordinary.id,
  };
  return [
    commands.replaceLevel(chapter.level()),
    commands.addCandidate("ordinary-1", chapter.ordinary),
    commands.assign("ordinary-2", ordinary),
    commands.assign("ordinary-3", ordinary),
    commands.assign("ordinary-4", ordinary),
    isCandidate(chapter.boss)
      ? commands.addCandidate("boss", chapter.boss)
      : commands.assign("boss", chapter.boss),
  ];
}

/** The whole world as one command batch against a fresh world project. */
export function familyWorldBCommands(): LevelEditorCommandBatch {
  return {
    expectedRevision: 0,
    commands: [
      ...worldShellCommands({
        name: FAMILY_WORLD_B_NAME,
        fictionalBirthDate: FAMILY_WORLD_B_BIRTH_DATE,
        chapters: FAMILY_WORLD_B_CHAPTERS.map((chapter) => chapter.shell),
      }),
      ...FAMILY_WORLD_B_CHAPTERS.flatMap(chapterCastCommands),
    ],
  };
}

/** The base project the command history replays against. */
export function familyWorldBBase(): LevelEditorProjectV2 {
  return createWorldEditorProject({
    projectId: FAMILY_WORLD_B_TEMPLATE_ID,
    catalogVersion: FAMILY_WORLD_B_CATALOG_VERSION,
  });
}

export function buildFamilyWorldB(): LevelEditorProjectV2 {
  const result = applyLevelEditorCommands(familyWorldBBase(), familyWorldBCommands());
  if (!result.ok)
    throw new Error(
      `World B commands failed: ${result.issues.map((entry) => `${entry.path}: ${entry.message} (${entry.code})`).join("; ")}`,
    );
  const issues = validateLevelEditorProject(result.project);
  if (issues.length > 0)
    throw new Error(
      `World B is invalid: ${issues.map((entry) => `${entry.path}: ${entry.message} (${entry.code})`).join("; ")}`,
    );
  return result.project as LevelEditorProjectV2;
}

export const FAMILY_WORLD_B_COMMANDS_URL = new URL(
  "./family-world-b-v2.commands.json",
  import.meta.url,
);
export const FAMILY_WORLD_B_PROJECT_URL = new URL(
  "../../src/shared/levels/family-world-b-v2.json",
  import.meta.url,
);
/** The frozen v1 files; nothing regenerates them. */
export const FAMILY_WORLD_B_V1_COMMANDS_URL = new URL(
  "./family-world-b.commands.json",
  import.meta.url,
);
export const FAMILY_WORLD_B_V1_PROJECT_URL = new URL(
  "../../src/shared/levels/family-world-b-v1.json",
  import.meta.url,
);

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const commands = `${JSON.stringify(familyWorldBCommands(), null, 2)}\n`;
  const project = serializeLevelEditorProject(buildFamilyWorldB());
  if (process.argv.includes("--write")) {
    await writeFile(FAMILY_WORLD_B_COMMANDS_URL, commands);
    await writeFile(FAMILY_WORLD_B_PROJECT_URL, project);
    process.stdout.write("Wrote family-world-b commands and template project\n");
  } else {
    process.stdout.write(commands);
  }
}
