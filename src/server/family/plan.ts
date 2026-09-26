/**
 * `family-world-plan-v1` builder and validator (DESIGN-024 D-07).
 *
 * Levels come from the frozen editor-world construction (`prepareEditorWorld`),
 * so encounters, pickups, stats, the bonus slot and route ordering are exactly
 * what the editor runtime already plays. The family plan adds the frozen
 * authored geometry, the ability ladder and one private photo per memory slot.
 */
import {
  FAMILY_AGE_RULE,
  FAMILY_MEMORY_SLOTS,
  FAMILY_WORLD_PLAN_VERSION,
  abilitiesAtAge,
  familyMemoryId,
  familyWholeYearsAt,
  freezeAbilityLadder,
  normalizeCaption,
  type AbilityLadderSource,
  type FamilyMemorySlot,
  type FamilyMemorySlotPlan,
  type FamilyWorldAdventurePlanV1,
  type FrozenFamilyWorldLevelPlanV1,
} from '../../shared/family-plan.js';
import type { RuleVersions } from '../../shared/contracts.js';
import type { FrozenMemory } from '../domain.js';
import { prepareEditorWorld } from '../editor-preview.js';
import {
  FAMILY_RULE_VERSIONS,
  familyGeometryFingerprint,
  validateFamilyWorldPlan,
} from './plan-validate.js';
import type { RebasedWorld } from './rebase.js';
import type { FamilyTemplate } from './templates.js';

export {
  FAMILY_PROGRESSION_RULE,
  FAMILY_RULE_VERSIONS,
  familyGeometryFingerprint,
  validateFamilyWorldPlan,
  type FamilyPlanContext,
} from './plan-validate.js';

/** One chosen photo. `assetId`/`personId` are upstream ids and stay server-side. */
export interface FamilySlotSelection {
  readonly chapterId: string;
  readonly slot: FamilyMemorySlot;
  readonly assetId: string;
  readonly personId: string;
  readonly localDate: string;
  readonly caption: string;
  /** HMAC-derived asset reference that is safe to freeze into the plan. */
  readonly opaque: string;
}

export interface BuildFamilyPlanInput {
  readonly template: FamilyTemplate;
  readonly world: RebasedWorld;
  readonly selections: readonly FamilySlotSelection[];
  readonly ladder: AbilityLadderSource;
}

export interface BuiltFamilyPlan {
  readonly plan: FamilyWorldAdventurePlanV1;
  /** The private save manifest: one Immich-backed memory per slot, in play order. */
  readonly memories: FrozenMemory[];
  readonly versions: RuleVersions;
}

export class FamilyPlanError extends Error {
  constructor(readonly code: 'SLOTS_INCOMPLETE' | 'PLAN_INVALID', readonly issues: readonly string[] = []) {
    super(code);
    this.name = 'FamilyPlanError';
  }
}

export function buildFamilyWorldPlan(input: BuildFamilyPlanInput): BuiltFamilyPlan {
  const { template, world } = input;
  const birthDate = world.birthDate;
  const editor = prepareEditorWorld(world.project, template.fingerprint);
  const finalAge = world.chapters.at(-1)!.recoveredAge;
  const abilityLadder = freezeAbilityLadder(input.ladder, finalAge);
  const selections = new Map(input.selections.map((selection) => [
    `${selection.chapterId}:${selection.slot}`,
    selection,
  ]));
  if (selections.size !== input.selections.length || selections.size !== world.chapters.length * 3) {
    throw new FamilyPlanError('SLOTS_INCOMPLETE');
  }
  const memories: FrozenMemory[] = [];
  const levels = editor.plan.levels.map((level, index): FrozenFamilyWorldLevelPlanV1 => {
    const chapter = world.project.chapters[index]!;
    const slots = FAMILY_MEMORY_SLOTS.map((slot): FamilyMemorySlotPlan => {
      const selection = selections.get(`${chapter.chapterId}:${slot}`);
      if (!selection) throw new FamilyPlanError('SLOTS_INCOMPLETE');
      const caption = normalizeCaption(selection.caption);
      if (!caption.ok) throw new FamilyPlanError('PLAN_INVALID', [caption.code]);
      const memoryId = familyMemoryId(level.routeId, slot);
      const ageYears = familyWholeYearsAt(birthDate, selection.localDate);
      memories.push({
        id: memoryId,
        date: selection.localDate,
        ageYears,
        label: caption.caption,
        source: { kind: 'immich', assetId: selection.assetId, personId: selection.personId },
      });
      return {
        slot,
        memoryId,
        date: selection.localDate,
        ageYears,
        caption: caption.caption,
        source: { kind: 'immich', opaque: selection.opaque },
      };
    }) as unknown as FrozenFamilyWorldLevelPlanV1['memorySlots'];
    return {
      ...structuredClone(level),
      optionalEncounterIds: 'optionalEncounterIds' in level
        ? [...level.optionalEncounterIds] as [] | [string]
        : [],
      representedEndDate: slots[2].date,
      chapterId: chapter.chapterId,
      chapterName: chapter.name,
      chapterSubtitle: chapter.subtitle,
      chapterDescription: chapter.description,
      abilities: abilitiesAtAge(abilityLadder, level.startAgeYears),
      memorySlots: slots,
      authoredLevel: structuredClone(chapter.level),
    };
  });
  const plan: FamilyWorldAdventurePlanV1 = {
    version: FAMILY_WORLD_PLAN_VERSION,
    catalogVersion: world.project.catalogVersion,
    projectFingerprint: familyGeometryFingerprint(levels),
    template: { id: template.id, version: template.version, fingerprint: template.fingerprint },
    ageRule: FAMILY_AGE_RULE,
    abilityLadder,
    levels,
  };
  const issues = validateFamilyWorldPlan(plan, { birthDate, memories });
  if (issues.length > 0) throw new FamilyPlanError('PLAN_INVALID', issues);
  return { plan, memories, versions: FAMILY_RULE_VERSIONS(plan.catalogVersion) };
}

