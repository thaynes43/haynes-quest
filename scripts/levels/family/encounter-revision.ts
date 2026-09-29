/** Additional checkpointed fights on existing standing decks. */
import type { AuthoredBonusEncounterSlot, AuthoredEncounterAnchor, AuthoredEncounterSlot } from "../../../src/shared/authored-level.js";
import {
  applyLevelEditorCommands,
  serializeLevelEditorProject,
  validateLevelEditorProject,
  type LevelEditorCommandBatch,
  type LevelEditorCommand,
  type LevelEditorProjectV2,
} from "../../../src/shared/editor-project.js";
import { chapterCommands } from "../lib/growth-kit.js";

export interface BonusPlacement {
  readonly chapterId: string;
  readonly slot: AuthoredBonusEncounterSlot;
  readonly castFrom: AuthoredEncounterSlot;
  readonly platformId: string;
  readonly checkpointId: string;
  readonly position: AuthoredEncounterAnchor["position"];
  readonly arena: AuthoredEncounterAnchor["arena"];
}

/** The cast comes from an existing ordinary in that chapter, preserving its exact media. */
export function encounterRevisionCommands(base: LevelEditorProjectV2, placements: readonly BonusPlacement[], prelude: readonly LevelEditorCommand[] = []): LevelEditorCommandBatch {
  const commands: LevelEditorCommand[] = [...prelude];
  for (const chapter of base.chapters) {
    const author = chapterCommands(chapter.chapterId);
    for (const placement of placements.filter((entry) => entry.chapterId === chapter.chapterId)) {
      const source = chapter.level.anchors.encounters[placement.castFrom];
      const cast = chapter.encounterSlots[placement.castFrom];
      if (!source || !cast || source.kind === "boss")
        throw new Error(`${chapter.chapterId}: missing ordinary cast ${placement.castFrom}`);
      commands.push(author.addBonus({
        kind: source.kind,
        platformId: placement.platformId,
        checkpointId: placement.checkpointId,
        position: placement.position,
        arena: placement.arena,
      }, cast, placement.slot));
    }
    commands.push(author.bossPrerequisite(2));
  }
  return { expectedRevision: base.revision, commands };
}

export function buildEncounterRevision(base: LevelEditorProjectV2, placements: readonly BonusPlacement[], prelude: readonly LevelEditorCommand[] = []): LevelEditorProjectV2 {
  const result = applyLevelEditorCommands(base, encounterRevisionCommands(base, placements, prelude));
  if (!result.ok) throw new Error(`Encounter commands failed: ${result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  const issues = validateLevelEditorProject(result.project);
  if (issues.length) throw new Error(`Encounter revision invalid: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
  return result.project as LevelEditorProjectV2;
}

export function serializeEncounterRevision(project: LevelEditorProjectV2): string {
  return serializeLevelEditorProject(project);
}
