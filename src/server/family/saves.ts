/**
 * Family saves (DESIGN-024 D-02, D-07): a household run that freezes one
 * publication. A new publication never alters a started run; an administrator
 * may start a fresh run on the latest one.
 */
import { randomUUID } from 'node:crypto';
import { createInitialAdventureState, type AdventurePlan } from '../../shared/adventure.js';
import type { FamilyJourneyCard, FamilyWorldView } from '../../shared/family-api.js';
import type { FamilyWorldAdventurePlanV1, FrozenFamilyWorldLevelPlanV1 } from '../../shared/family-plan.js';
import type { WorldEditorLevelDocument } from '../../shared/editor-project.js';
import { createInitialFriendlyState } from '../../shared/friendly.js';
import { validateSaveRecord, type SaveRecord } from '../domain.js';
import { AppError } from '../errors.js';
import type { ChildRecord, PublicationRecord } from './store.js';

export function newFamilySave(input: {
  publication: PublicationRecord;
  child: ChildRecord;
  startedBy: string;
  now: Date;
}): SaveRecord {
  const { publication, child, now } = input;
  if (publication.childId !== child.id) throw new AppError(409, 'PUBLICATION_MISMATCH', 'Journey unavailable');
  const plan = structuredClone(publication.plan) as unknown as AdventurePlan;
  const state = createInitialAdventureState(plan);
  return validateSaveRecord({
    id: randomUUID(),
    ownerId: input.startedBy,
    previewId: null,
    publicationId: publication.id,
    childId: child.id,
    title: child.displayName,
    subject: { id: child.id, label: child.displayName },
    birthDate: publication.birthDate,
    memories: structuredClone([...publication.memories]),
    recoveredIds: [],
    ageYears: state.ageYears,
    abilities: [...state.abilities],
    appearanceStage: state.appearanceStage,
    completed: false,
    saveFormat: 'era-combat-v2',
    adventurePlan: plan,
    adventureState: state,
    friendlyState: createInitialFriendlyState(plan),
    revision: 0,
    createdAt: now,
    updatedAt: now,
    versions: structuredClone(publication.versions),
  });
}

export function familyPlanOf(save: SaveRecord): FamilyWorldAdventurePlanV1 {
  const plan = save.adventurePlan;
  if (!save.publicationId || plan?.version !== 'family-world-plan-v1') {
    throw new AppError(404, 'SAVE_NOT_FOUND', 'Save not found');
  }
  return plan;
}

/** The frozen geometry and public chapter text; no dates, names or photo ids. */
export function familyWorldView(save: SaveRecord): FamilyWorldView {
  const plan = familyPlanOf(save);
  return {
    saveId: save.id,
    templateId: plan.template.id,
    templateVersion: plan.template.version,
    chapters: plan.levels.map((level: FrozenFamilyWorldLevelPlanV1) => ({
      routeId: level.routeId,
      chapterId: level.chapterId,
      name: level.chapterName,
      subtitle: level.chapterSubtitle,
      description: level.chapterDescription,
      level: structuredClone(level.authoredLevel) as WorldEditorLevelDocument,
    })),
  };
}

export function familyJourneyCards(input: {
  children: readonly ChildRecord[];
  /** Each child's latest publication. */
  publications: readonly PublicationRecord[];
  saves: readonly SaveRecord[];
  /** Revisions of the (possibly older) publications the runs froze. */
  runRevisions?: ReadonlyMap<string, number>;
}): FamilyJourneyCard[] {
  const children = new Map(input.children.map((child) => [child.id, child]));
  const revisions = new Map([
    ...(input.runRevisions ?? new Map<string, number>()),
    ...input.publications.map((publication) => [publication.id, publication.revision] as const),
  ]);
  return input.publications.flatMap((publication) => {
    const child = children.get(publication.childId);
    if (!child) return [];
    const save = input.saves.find((candidate) => candidate.childId === child.id);
    const plan = save?.adventurePlan?.version === 'family-world-plan-v1' ? save.adventurePlan : null;
    const chapterIndex = save?.adventureState?.activeLevelIndex ?? 0;
    // A run whose publication is not the latest froze older photos.
    const runRevision = save?.publicationId ? revisions.get(save.publicationId) ?? null : null;
    return [{
      childId: child.id,
      displayName: child.displayName,
      publicationRevision: publication.revision,
      chapterCount: publication.plan.levels.length,
      run: save && plan
        ? {
            saveId: save.id,
            publicationRevision: runRevision ?? 0,
            ageYears: save.ageYears,
            chapterIndex,
            chapterName: plan.levels[chapterIndex]?.chapterName ?? null,
            completed: save.completed,
          }
        : null,
      newerPublication: Boolean(save && save.publicationId !== publication.id),
    }];
  });
}
