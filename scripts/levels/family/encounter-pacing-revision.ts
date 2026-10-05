/** A9/B8: move existing encounter pairs onto safe route supports. */
import {
  applyLevelEditorCommands,
  serializeLevelEditorProject,
  validateLevelEditorProject,
  type LevelEditorCommand,
  type LevelEditorCommandBatch,
  type LevelEditorProjectV2,
} from "../../../src/shared/editor-project.js";
import type {
  AuthoredEncounterAnchor,
  AuthoredExtendedCoreEncounterSlot,
  AuthoredLevelDocument,
} from "../../../src/shared/authored-level.js";
import { validateAuthoredLevelDocument } from "../../../src/shared/authored-level.js";
import { PARODY_CATALOGS } from "../../../src/shared/parody-catalog.js";
import { chapterCommands } from "../lib/growth-kit.js";
import { anchorFor, type DenseFightPlacement } from "./dense-world-revision.js";

type CoreSlot = "ordinary-1" | "ordinary-2" | "ordinary-3" | "ordinary-4" |
  AuthoredExtendedCoreEncounterSlot;

export interface PacingPairMove {
  readonly slots: readonly [CoreSlot, CoreSlot];
  readonly support: string;
  readonly offsets: readonly [Pick<DenseFightPlacement, "dx" | "dz">, Pick<DenseFightPlacement, "dx" | "dz">];
}

export interface PacingChapterRevision {
  readonly chapterId: string;
  readonly moves: readonly PacingPairMove[];
  /** Cast changes preserve an existing slot's role, kind, and era. */
  readonly recasts?: Partial<Record<CoreSlot, string>>;
}

function movedAnchor(
  level: AuthoredLevelDocument,
  slot: CoreSlot,
  support: string,
  offset: Pick<DenseFightPlacement, "dx" | "dz">,
): AuthoredEncounterAnchor {
  const previous = level.anchors.encounters[slot];
  if (!previous) throw new Error(`${level.id}: missing ${slot}`);
  // The placement helper uses an ordinary source slot to seed its kind. Keep
  // the existing slot kind so frozen catalog references remain compatible.
  const placement: DenseFightPlacement = {
    platformId: support, castFrom: "ordinary-1", ...offset,
  };
  return { ...anchorFor(level, placement, slot), kind: previous.kind };
}

export function pacingWorldCommands(
  base: LevelEditorProjectV2,
  revisions: readonly PacingChapterRevision[],
): LevelEditorCommandBatch {
  const commands: LevelEditorCommand[] = [];
  for (const revision of revisions) {
    const chapter = base.chapters.find((entry) => entry.chapterId === revision.chapterId);
    if (!chapter) throw new Error(`Unknown chapter ${revision.chapterId}`);
    const level = structuredClone(chapter.level) as AuthoredLevelDocument;
    const author = chapterCommands(revision.chapterId);
    for (const move of revision.moves) {
      if (!level.mainPath.includes(move.support))
        throw new Error(`${level.id}: pair support ${move.support} is not on the main route`);
      const old = move.slots.map((slot) => level.anchors.encounters[slot]?.platformId);
      if (old[0] !== old[1]) throw new Error(`${level.id}: ${move.slots.join("/")} is not a pair`);
      for (const [index, slot] of move.slots.entries()) {
        const anchor = movedAnchor(level, slot, move.support, move.offsets[index]!);
        (level.anchors.encounters as Record<string, AuthoredEncounterAnchor>)[slot] = anchor;
        commands.push(author.setAnchor(`encounter.${slot}`, anchor));
      }
      const [first, second] = move.slots.map((slot) => level.anchors.encounters[slot]!);
      const separation = Math.hypot(
        first!.position.x - second!.position.x,
        first!.position.z - second!.position.z,
      );
      if (separation < 2.2 || separation > 8.1)
        throw new Error(`${level.id}: pair ${move.slots.join("/")} separation ${separation.toFixed(2)} m`);
    }
    for (const [slot, catalogEntryId] of Object.entries(revision.recasts ?? {})) {
      const anchor = level.anchors.encounters[slot as CoreSlot];
      const entry = PARODY_CATALOGS["parody-catalog-v12"].find((candidate) => candidate.id === catalogEntryId);
      if (!entry || entry.role !== "ordinary" || entry.kind !== anchor?.kind)
        throw new Error(`${level.id}: invalid recast ${slot} → ${catalogEntryId}`);
      commands.push(author.assign(slot as CoreSlot, {
        source: "catalog", catalogEntryId: entry.id, catalogEntryVersion: entry.version,
      }));
    }
    const issues = validateAuthoredLevelDocument(level);
    if (issues.length)
      throw new Error(`${level.id}: pacing invalid: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  }
  return { expectedRevision: base.revision, commands };
}

export function buildPacedWorld(
  base: LevelEditorProjectV2,
  revisions: readonly PacingChapterRevision[],
): LevelEditorProjectV2 {
  const result = applyLevelEditorCommands(base, pacingWorldCommands(base, revisions));
  if (!result.ok)
    throw new Error(`Paced-world commands failed: ${result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  const issues = validateLevelEditorProject(result.project);
  if (issues.length)
    throw new Error(`Paced world invalid: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  return result.project as LevelEditorProjectV2;
}

export const serializePacedWorld = serializeLevelEditorProject;
