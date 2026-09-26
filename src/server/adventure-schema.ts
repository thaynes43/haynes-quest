import { z } from 'zod';
import {
  abilitiesForPlanAge,
  appearanceForAge,
  isAuthoredWorldPlan,
  memoryIdsForLevel,
  type AdventurePlan,
  type AdventurePlanV2,
  type AdventurePlanV3,
  type AdventureState,
  type EditorWorldAdventurePlan,
} from '../shared/adventure.js';
import type { FamilyWorldAdventurePlanV1 } from '../shared/family-plan.js';
import {
  FAMILY_ERA_PERIOD_IDS,
  PARODY_CATALOGS,
  PARODY_CATALOG_VERSIONS,
} from '../shared/parody-catalog.js';
import { FAMILY_ABILITIES, FAMILY_AGE_RULE, FAMILY_MEMORY_SLOTS } from '../shared/family-plan.js';
import {
  levelEditorPreparedBonusEnemies,
  levelEditorPreparedEnemies,
} from '../shared/editor-project.js';
import {
  FRIENDLY_CATALOG_VERSIONS,
  friendlyDefinitionsForPlan,
  type FriendlyState,
} from '../shared/friendly.js';
import { bossRequiresOrdinaryDefeats } from '../shared/encounter-availability.js';
import type { Ability, RuleVersions, SubjectOption } from '../shared/contracts.js';
import type { FrozenMemory } from './domain.js';
import { AppError } from './errors.js';

const identifier = z.string().min(1).max(160);
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const subjectSchema = z.object({
  id: identifier,
  label: z.string().min(1).max(160),
}).strict();
const memorySourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fixture'), key: identifier }).strict(),
  z.object({ kind: z.literal('immich'), assetId: identifier, personId: identifier }).strict(),
]);
const frozenMemorySchema = z.object({
  id: z.string().min(1).max(128),
  date: dateOnly,
  ageYears: z.number().int().min(0).max(150),
  label: z.string().min(1).max(160),
  mediaUrl: z.string().min(1).max(2_048).optional(),
  source: memorySourceSchema,
}).strict();
const abilitySchema = z.enum(FAMILY_ABILITIES);
const ruleVersionsSchema = z.object({
  journey: identifier,
  age: identifier,
  progression: identifier,
  appearance: identifier,
  catalog: identifier.optional(),
  combat: identifier.optional(),
}).strict();
const equipmentSchema = z.object({
  id: identifier,
  pickupId: identifier,
  kind: z.enum(['attack-tool', 'guard-tool']),
  tier: z.number().int().min(1).max(100),
  damage: z.number().int().min(0).max(1_000),
  guardReduction: z.number().int().min(0).max(1_000),
}).strict();
const encounterDefinitionShape = {
  id: identifier,
  role: z.enum(['ordinary', 'boss']),
  kind: z.enum(['ordinary-a', 'ordinary-b', 'boss']),
  maxHp: z.number().int().min(1).max(100_000),
  attackDamage: z.number().int().min(0).max(10_000),
};
const encounterDefinitionV1Schema = z.object(encounterDefinitionShape).strict();
const encounterDefinitionV2Schema = z.object({
  ...encounterDefinitionShape,
  content: z.object({
    catalogEntryId: identifier,
    catalogEntryVersion: identifier,
    assetId: identifier,
    assetVersion: identifier,
  }).strict(),
}).strict();
const editorCandidateContentSchema = z.object({
  catalogEntryId: identifier,
  catalogEntryVersion: z.literal('draft-v1'),
  assetId: z.literal('neutral-enemy-placeholder'),
  assetVersion: z.literal('v001'),
  displayName: z.string().min(1).max(80),
  placeholder: z.literal('neutral-candidate-v1'),
}).strict();
const editorEncounterDefinitionSchema = z.object({
  ...encounterDefinitionShape,
  content: z.union([
    encounterDefinitionV2Schema.shape.content,
    editorCandidateContentSchema,
  ]),
}).strict();
const levelShape = {
  id: identifier,
  index: z.number().int().min(0).max(23),
  startAgeYears: z.number().int().min(0).max(150),
  targetAgeYears: z.number().int().min(0).max(150),
  startDate: dateOnly,
  eraYear: z.number().int().min(1_000).max(9_999),
  pickups: z.array(equipmentSchema).min(1).max(8),
  bossId: identifier,
};
const levelV1Schema = z.object({
  ...levelShape,
  memoryIds: z.array(identifier).min(1).max(24),
  encounters: z.array(encounterDefinitionV1Schema).min(1).max(16),
}).strict();
const levelV2Schema = z.object({
  ...levelShape,
  memoryIds: z.array(identifier).min(1).max(24),
  periodId: z.enum([
    'block-party-v1',
    'remix-runway-v1',
    'remix-runway-v2',
    'besties-obby-v1',
    'rat-casino-v1',
  ]),
  routeId: z.enum([
    'gentle-intro-v1',
    'gentle-jump-v1',
    'garden-playground-v1',
    'besties-playground-v1',
  ]),
  encounters: z.array(encounterDefinitionV2Schema).min(1).max(16),
}).strict();
const levelV3Schema = z.object({
  ...levelShape,
  minorMemoryIds: z.tuple([identifier, identifier]),
  majorMemoryId: identifier,
  periodId: z.enum([
    'block-party-v1',
    'remix-runway-v1',
    'remix-runway-v2',
    'besties-obby-v1',
    'rat-casino-v1',
  ]),
  routeId: z.enum([
    'gentle-intro-v1',
    'gentle-jump-v1',
    'garden-playground-v1',
    'besties-playground-v1',
    'garden-playground-v2',
    'besties-playground-v2',
  ]),
  encounters: z.array(encounterDefinitionV2Schema).min(1).max(16),
}).strict();
const editorWorldLevelShape = {
  ...levelShape,
  minorMemoryIds: z.tuple([identifier, identifier]),
  majorMemoryId: identifier,
  // World projects may also cast the family-world era periods (DESIGN-026).
  periodId: z.enum([
    'block-party-v1',
    'remix-runway-v1',
    'remix-runway-v2',
    'besties-obby-v1',
    'rat-casino-v1',
    ...FAMILY_ERA_PERIOD_IDS,
  ]),
  routeId: identifier,
  representedEndDate: dateOnly,
  bossGate: z.literal('independent'),
};
const editorWorldLevelV1Schema = z.object({
  ...editorWorldLevelShape,
  encounters: z.array(editorEncounterDefinitionSchema).length(5),
}).strict();
const editorWorldLevelV2Schema = z.object({
  ...editorWorldLevelShape,
  optionalEncounterIds: z.union([z.tuple([]), z.tuple([identifier])]),
  encounters: z.array(editorEncounterDefinitionSchema).min(5).max(6),
}).strict();
const familyMemorySlotSchema = z.object({
  slot: z.enum(FAMILY_MEMORY_SLOTS),
  memoryId: identifier,
  date: dateOnly,
  ageYears: z.number().int().min(0).max(150),
  caption: z.string().min(1).max(160),
  source: z.object({
    kind: z.literal('immich'),
    opaque: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
  }).strict(),
}).strict();
const familyWorldLevelSchema = z.object({
  ...editorWorldLevelShape,
  optionalEncounterIds: z.union([z.tuple([]), z.tuple([identifier])]),
  encounters: z.array(editorEncounterDefinitionSchema).min(5).max(6),
  chapterId: identifier,
  chapterName: z.string().min(1).max(120),
  chapterSubtitle: z.string().max(240),
  chapterDescription: z.string().max(600),
  abilities: z.array(abilitySchema).min(1).max(FAMILY_ABILITIES.length),
  memorySlots: z.tuple([familyMemorySlotSchema, familyMemorySlotSchema, familyMemorySlotSchema]),
  // Geometry is verified against the plan's fingerprint by the family validator.
  authoredLevel: z.record(z.string(), z.unknown()),
}).strict();
const familyWorldPlanSchema = z.object({
  version: z.literal('family-world-plan-v1'),
  catalogVersion: z.enum(PARODY_CATALOG_VERSIONS),
  projectFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  template: z.object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
    version: z.string().regex(/^v[0-9]{1,4}$/),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict(),
  ageRule: z.literal(FAMILY_AGE_RULE),
  abilityLadder: z.object({
    version: z.string().min(1).max(80),
    grants: z.array(z.object({
      fromAge: z.number().int().min(0).max(30),
      abilities: z.array(abilitySchema).min(1).max(FAMILY_ABILITIES.length),
    }).strict()).min(1).max(FAMILY_ABILITIES.length),
  }).strict(),
  levels: z.array(familyWorldLevelSchema).min(1).max(8),
}).strict();
const planSchema = z.discriminatedUnion('version', [
  familyWorldPlanSchema,
  z.object({
    version: z.literal('era-level-plan-v1'),
    levels: z.array(levelV1Schema).min(1).max(24),
  }).strict(),
  z.object({
    version: z.literal('era-level-plan-v2'),
    catalogVersion: z.enum(PARODY_CATALOG_VERSIONS),
    levels: z.array(levelV2Schema).min(1).max(24),
  }).strict(),
  z.object({
    version: z.literal('era-level-plan-v3'),
    catalogVersion: z.enum(PARODY_CATALOG_VERSIONS),
    levels: z.array(levelV3Schema).length(2),
  }).strict(),
  z.object({
    version: z.literal('editor-world-plan-v1'),
    catalogVersion: z.enum(PARODY_CATALOG_VERSIONS),
    projectFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    levels: z.array(editorWorldLevelV1Schema).min(1).max(8),
  }).strict(),
  z.object({
    version: z.literal('editor-world-plan-v2'),
    catalogVersion: z.enum(PARODY_CATALOG_VERSIONS),
    projectFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    levels: z.array(editorWorldLevelV2Schema).min(1).max(8),
  }).strict(),
]);
const encounterProgressSchema = z.object({
  hp: z.number().int().min(0).max(100_000),
  defeated: z.boolean(),
  nextReportedHitAtMs: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
}).strict();
const receiptSchema = z.object({
  actionId: z.string().uuid(),
  payloadHash: z.string().regex(/^[a-f0-9]{64}$/),
  appliedRevision: z.number().int().min(1),
}).strict();
const stateSchema = z.object({
  version: z.literal('era-combat-state-v2'),
  activeLevelIndex: z.number().int().min(0).max(24),
  phase: z.enum(['exploring', 'memory-released', 'fallen', 'complete']),
  inventoryIds: z.array(identifier).max(192),
  equippedId: identifier.nullable(),
  collectedPickupIds: z.array(identifier).max(192),
  playerHp: z.number().int().min(0).max(100_000),
  maxPlayerHp: z.number().int().min(1).max(100_000),
  encounters: z.record(identifier, encounterProgressSchema),
  revealedMemoryIds: z.array(identifier).max(24),
  consumedMemoryIds: z.array(identifier).max(24),
  completedLevelIds: z.array(identifier).max(24),
  ageYears: z.number().int().min(0).max(150),
  abilities: z.array(abilitySchema).min(2).max(FAMILY_ABILITIES.length),
  appearanceStage: z.enum(['infant', 'child']),
  attackReadyAtMs: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  guardActiveUntilMs: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  guardReadyAtMs: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  actionReceipts: z.array(receiptSchema).max(128),
}).strict();
const friendlyProgressSchema = z.object({
  hp: z.number().int().min(0).max(100_000),
  defeated: z.boolean(),
  boonClaimed: z.boolean(),
  penaltyActive: z.boolean(),
}).strict();
const friendlyStateSchema = z.object({
  version: z.literal('friendly-state-v1'),
  catalogVersion: z.enum(FRIENDLY_CATALOG_VERSIONS),
  friendlies: z.record(z.string().min(1).max(360), friendlyProgressSchema),
}).strict();

const storedSaveJsonSchema = z.object({
  subject: subjectSchema,
  memories: z.array(frozenMemorySchema).min(1).max(240),
  recoveredIds: z.array(z.string().min(1).max(128)).max(240),
  abilities: z.array(abilitySchema).min(1).max(FAMILY_ABILITIES.length),
  versions: ruleVersionsSchema,
}).strict();

export function parseStoredSaveJson(raw: unknown): {
  subject: SubjectOption;
  memories: FrozenMemory[];
  recoveredIds: string[];
  abilities: Ability[];
  versions: RuleVersions;
} {
  const parsed = storedSaveJsonSchema.safeParse(raw);
  if (!parsed.success) invalid();
  return parsed.data as {
    subject: SubjectOption;
    memories: FrozenMemory[];
    recoveredIds: string[];
    abilities: Ability[];
    versions: RuleVersions;
  };
}

export function parseStoredAdventure(
  rawPlan: unknown,
  rawState: unknown,
  options: { allowEditorPreviewPlan?: boolean } = {},
): { plan: AdventurePlan; state: AdventureState } {
  const parsedPlan = planSchema.safeParse(rawPlan);
  const parsedState = stateSchema.safeParse(rawState);
  if (!parsedPlan.success || !parsedState.success) invalid();
  const plan = parsedPlan.data as AdventurePlan;
  const state = parsedState.data as AdventureState;
  if (isEditorWorldPlan(plan) && options.allowEditorPreviewPlan !== true) {
    invalid();
  }
  if (!validPlan(plan) || !validState(plan, state)) invalid();
  return { plan, state };
}

export function parseStoredFriendlyState(
  raw: unknown,
  plan: AdventurePlan,
  adventureState: AdventureState,
): FriendlyState {
  const parsed = friendlyStateSchema.safeParse(raw);
  if (!parsed.success) invalid();
  const state = parsed.data as FriendlyState;
  const definitions = friendlyDefinitionsForPlan(plan, state.catalogVersion);
  const expected = new Map(definitions.map((definition) => [definition.id, definition]));
  const levelIndexes = new Map(plan.levels.map((level) => [level.id, level.index]));
  const ids = Object.keys(state.friendlies);
  if (
    ids.length !== expected.size ||
    ids.some((id) => !expected.has(id))
  ) invalid();
  for (const definition of definitions) {
    const progress = state.friendlies[definition.id];
    if (
      !progress ||
      progress.hp > definition.maxHp ||
      progress.defeated !== (progress.hp === 0) ||
      progress.penaltyActive !== (progress.hp < definition.maxHp) ||
      ((levelIndexes.get(definition.levelId) ?? Number.MAX_SAFE_INTEGER) >
        adventureState.activeLevelIndex &&
        (progress.hp !== definition.maxHp ||
          progress.defeated ||
          progress.boonClaimed ||
          progress.penaltyActive))
    ) invalid();
  }
  return state;
}

function isEditorWorldPlan(plan: AdventurePlan): plan is EditorWorldAdventurePlan {
  return plan.version === 'editor-world-plan-v1' || plan.version === 'editor-world-plan-v2';
}

function validPlan(plan: AdventurePlan): boolean {
  // Family plans share the authored-world construction; their birthday-derived
  // invariants are re-checked by save validation, which knows the birthday.
  const editorWorldPlan = isAuthoredWorldPlan(plan);
  if (
    plan.version !== 'era-level-plan-v1' &&
    !editorWorldPlan &&
    !validParodyPlan(plan)
  ) return false;
  if (editorWorldPlan && !validEditorWorldPlan(plan)) return false;
  const levelIds = new Set<string>();
  const memoryIds = new Set<string>();
  const pickupIds = new Set<string>();
  const equipmentIds = new Set<string>();
  const encounterIds = new Set<string>();
  let priorTargetAge = 0;
  for (const [index, level] of plan.levels.entries()) {
    const levelMemoryIds = memoryIdsForLevel(level);
    const levelPickupIds = level.pickups.map((equipment) => equipment.pickupId);
    const levelEquipmentIds = level.pickups.map((equipment) => equipment.id);
    const levelEncounterIds = level.encounters.map((encounter) => encounter.id);
    const playgroundPlan = editorWorldPlan || (
      plan.version === 'era-level-plan-v3' &&
      (plan.catalogVersion === 'parody-catalog-v4' || plan.catalogVersion === 'parody-catalog-v5')
    );
    const expectedOrdinaryCount = playgroundPlan
      ? 4 + ('optionalEncounterIds' in level
        ? (level as { optionalEncounterIds: string[] }).optionalEncounterIds.length
        : 0)
      : 2;
    if (
      level.index !== index ||
      level.startAgeYears !== priorTargetAge ||
      level.targetAgeYears < level.startAgeYears ||
      level.eraYear !== Number(level.startDate.slice(0, 4)) ||
      levelIds.has(level.id) ||
      hasDuplicates(levelMemoryIds) ||
      hasDuplicates(levelPickupIds) ||
      hasDuplicates(levelEquipmentIds) ||
      hasDuplicates(levelEncounterIds) ||
      levelMemoryIds.some((id) => memoryIds.has(id)) ||
      level.pickups.some(
        (equipment) => pickupIds.has(equipment.pickupId) || equipmentIds.has(equipment.id),
      ) ||
      level.encounters.some((encounter) => encounterIds.has(encounter.id)) ||
      level.encounters.filter((encounter) => encounter.role === 'ordinary').length !==
        expectedOrdinaryCount ||
      level.encounters.filter((encounter) => encounter.role === 'boss').length !== 1 ||
      level.encounters.find((encounter) => encounter.id === level.bossId)?.role !== 'boss'
    ) return false;
    levelIds.add(level.id);
    levelMemoryIds.forEach((id) => memoryIds.add(id));
    level.pickups.forEach((equipment) => {
      pickupIds.add(equipment.pickupId);
      equipmentIds.add(equipment.id);
    });
    level.encounters.forEach((encounter) => encounterIds.add(encounter.id));
    priorTargetAge = level.targetAgeYears;
  }
  return true;
}

function validEditorWorldPlan(plan: EditorWorldAdventurePlan | FamilyWorldAdventurePlanV1): boolean {
  if (
    (plan.catalogVersion !== 'parody-catalog-v5' &&
      plan.catalogVersion !== 'parody-catalog-v6' &&
      plan.catalogVersion !== 'parody-catalog-v7' &&
      plan.catalogVersion !== 'parody-catalog-v8' &&
      plan.catalogVersion !== 'parody-catalog-v9')
  ) return false;
  const preparedCatalog = levelEditorPreparedEnemies(plan.catalogVersion);
  const bonusCatalog = levelEditorPreparedBonusEnemies(plan.catalogVersion);
  let hasOptionalEncounter = false;
  for (const level of plan.levels) {
    const optionalEncounterIds = 'optionalEncounterIds' in level
      ? level.optionalEncounterIds
      : [];
    const expectedOptionalId = `${level.id}-encounter-bonus-1`;
    if (
      plan.version !== 'editor-world-plan-v1' &&
      optionalEncounterIds.length === 1 &&
      optionalEncounterIds[0] !== expectedOptionalId
    ) return false;
    hasOptionalEncounter ||= optionalEncounterIds.length === 1;
    const expectedEncounters: Array<{
      id: string;
      role: 'ordinary' | 'boss';
      kind: 'ordinary-a' | 'ordinary-b' | 'boss' | null;
      optional: boolean;
    }> = [
      // Each ordinary slot takes either ordinary kind: the editor validator
      // lets an author set every ordinary anchor's kind (for example one
      // identity's kind in all four slots, DESIGN-026), and the frozen stats
      // below follow the encounter's actual kind.
      { id: `${level.id}-encounter-1`, role: 'ordinary', kind: null, optional: false },
      { id: `${level.id}-encounter-2`, role: 'ordinary', kind: null, optional: false },
      { id: `${level.id}-encounter-3`, role: 'ordinary', kind: null, optional: false },
      { id: `${level.id}-encounter-4`, role: 'ordinary', kind: null, optional: false },
      { id: `${level.id}-boss`, role: 'boss', kind: 'boss', optional: false },
    ];
    if (optionalEncounterIds.length === 1) {
      expectedEncounters.push({
        id: expectedOptionalId,
        role: 'ordinary',
        kind: null,
        optional: true,
      });
    }
    const expectedPickups = [
      {
        id: `${level.id}-equipment-attack`,
        pickupId: `${level.id}-pickup-attack`,
        kind: 'attack-tool',
        tier: level.index + 1,
        damage: 2 + level.index,
        guardReduction: 0,
      },
      {
        id: `${level.id}-equipment-guard`,
        pickupId: `${level.id}-pickup-guard`,
        kind: 'guard-tool',
        tier: level.index + 1,
        damage: 0,
        guardReduction: 2 + level.index,
      },
    ];
    if (
      level.routeId !== level.id ||
      level.representedEndDate < level.startDate ||
      level.bossGate !== 'independent' ||
      JSON.stringify(level.pickups) !== JSON.stringify(expectedPickups) ||
      level.encounters.length !== expectedEncounters.length
    ) return false;
    for (const [index, encounter] of level.encounters.entries()) {
      const expected = expectedEncounters[index];
      if (!expected) return false;
      const expectedMaxHp = expected.role === 'boss'
        ? 8 + level.index * 3
        : (encounter.kind === 'ordinary-b' ? 5 : 4) + level.index * 2;
      const expectedAttackDamage = expected.role === 'boss' ? 3 + level.index : 2 + level.index;
      if (
        encounter.id !== expected.id ||
        (expected.kind === null ? encounter.kind === 'boss' : encounter.kind !== expected.kind) ||
        encounter.role !== expected.role ||
        encounter.maxHp !== expectedMaxHp ||
        encounter.attackDamage !== expectedAttackDamage
      ) return false;
      const content = encounter.content;
      if (content.placeholder === 'neutral-candidate-v1') {
        if (
          !content.catalogEntryId.startsWith('editor-candidate-') ||
          content.catalogEntryId.length <= 'editor-candidate-'.length ||
          content.catalogEntryVersion !== 'draft-v1' ||
          content.assetId !== 'neutral-enemy-placeholder' ||
          content.assetVersion !== 'v001' ||
          !content.displayName ||
          content.displayName.trim().length === 0
        ) return false;
        continue;
      }
      if (content.displayName !== undefined || content.placeholder !== undefined) return false;
      const catalog = expected.optional ? bonusCatalog : preparedCatalog;
      const entry = catalog.find((candidate) =>
        candidate.id === content.catalogEntryId &&
        candidate.version === content.catalogEntryVersion,
      );
      if (
        !entry ||
        entry.assetId !== content.assetId ||
        entry.assetVersion !== content.assetVersion ||
        entry.periodId !== level.periodId ||
        entry.role !== encounter.role ||
        entry.kind !== encounter.kind ||
        level.startDate < entry.eligibleFrom ||
        level.startDate > entry.eligibleThrough ||
        level.startDate < entry.referenceAvailableBy ||
        entry.requiredAbilities.some((ability) =>
          !abilitiesForPlanAge(plan, level.startAgeYears).includes(ability)
        )
      ) return false;
    }
  }
  // An editor v2 plan exists only to carry an optional encounter; a family
  // plan freezes whatever its template has.
  return plan.version !== 'editor-world-plan-v2' || hasOptionalEncounter;
}

function validParodyPlan(plan: AdventurePlanV2 | AdventurePlanV3): boolean {
  const catalog = PARODY_CATALOGS[plan.catalogVersion];
  if (!catalog) return false;
  for (const level of plan.levels) {
    const abilities = new Set(abilitiesForPlanAge(plan, level.startAgeYears));
    const playgroundPlan =
      plan.version === 'era-level-plan-v3' &&
      (plan.catalogVersion === 'parody-catalog-v4' || plan.catalogVersion === 'parody-catalog-v5');
    const expectedRoute = playgroundPlan
      ? level.periodId === 'block-party-v1'
        ? (plan.catalogVersion === 'parody-catalog-v5' ? 'garden-playground-v2' : 'garden-playground-v1')
        : level.periodId === 'besties-obby-v1'
          ? (plan.catalogVersion === 'parody-catalog-v5' ? 'besties-playground-v2' : 'besties-playground-v1')
          : undefined
      : abilities.has('jump')
        ? 'gentle-jump-v1'
        : 'gentle-intro-v1';
    const expectedSlots = playgroundPlan
      ? [
          ['ordinary-a', 'ordinary'],
          ['ordinary-b', 'ordinary'],
          ['ordinary-a', 'ordinary'],
          ['ordinary-b', 'ordinary'],
          ['boss', 'boss'],
        ] as const
      : null;
    const contentIdentity = (index: number): string => {
      const content = level.encounters[index]?.content;
      return content
        ? [
            content.catalogEntryId,
            content.catalogEntryVersion,
            content.assetId,
            content.assetVersion,
          ].join('\0')
        : '';
    };
    if (
      !expectedRoute ||
      level.routeId !== expectedRoute ||
      (playgroundPlan
        ? level.encounters.length !== expectedSlots!.length ||
          level.encounters.some((encounter, index) => {
            const slot = expectedSlots![index];
            const expectedId = index === expectedSlots!.length - 1
              ? `${level.id}-boss`
              : `${level.id}-encounter-${index + 1}`;
            return !slot ||
              encounter.id !== expectedId ||
              encounter.kind !== slot[0] ||
              encounter.role !== slot[1];
          }) ||
          contentIdentity(0) !== contentIdentity(2) ||
          contentIdentity(1) !== contentIdentity(3) ||
          contentIdentity(0) === contentIdentity(1) ||
          contentIdentity(4) === contentIdentity(0) ||
          contentIdentity(4) === contentIdentity(1)
        : new Set(level.encounters.map((encounter) => encounter.content.catalogEntryId)).size !== level.encounters.length ||
          level.encounters.filter((encounter) => encounter.kind === 'ordinary-a' && encounter.role === 'ordinary').length !== 1 ||
          level.encounters.filter((encounter) => encounter.kind === 'ordinary-b' && encounter.role === 'ordinary').length !== 1 ||
          level.encounters.filter((encounter) => encounter.kind === 'boss' && encounter.role === 'boss').length !== 1)
    ) return false;
    for (const encounter of level.encounters) {
      const entry = catalog.find((candidate) =>
        candidate.id === encounter.content.catalogEntryId &&
        candidate.version === encounter.content.catalogEntryVersion,
      );
      if (
        !entry ||
        entry.assetId !== encounter.content.assetId ||
        entry.assetVersion !== encounter.content.assetVersion ||
        entry.periodId !== level.periodId ||
        entry.role !== encounter.role ||
        entry.kind !== encounter.kind ||
        level.startDate < entry.eligibleFrom ||
        level.startDate > entry.eligibleThrough ||
        level.startDate < entry.referenceAvailableBy ||
        entry.requiredAbilities.some((ability) => !abilities.has(ability))
      ) return false;
    }
  }
  return true;
}

function validState(plan: AdventurePlan, state: AdventureState): boolean {
  const levels = plan.levels;
  const equipment = levels.flatMap((level) => level.pickups);
  const equipmentIds = new Set(equipment.map((item) => item.id));
  const pickupIds = new Set(equipment.map((item) => item.pickupId));
  const memories = new Set(levels.flatMap(memoryIdsForLevel));
  const levelIds = new Set(levels.map((level) => level.id));
  const definitions = new Map(
    levels.flatMap((level) => level.encounters).map((encounter) => [encounter.id, encounter]),
  );
  const stateEncounterIds = Object.keys(state.encounters);
  const completedPrefix = levels.slice(0, state.completedLevelIds.length).map((level) => level.id);
  const completedMemoryIds = new Set(
    levels.slice(0, state.completedLevelIds.length).flatMap(memoryIdsForLevel),
  );
  const activeLevel = levels[state.activeLevelIndex];
  const availableEquipment = new Set(
    levels
      .slice(0, Math.min(state.activeLevelIndex + 1, levels.length))
      .flatMap((level) => level.pickups)
      .map((item) => item.id),
  );
  const availablePickups = new Set(
    levels
      .slice(0, Math.min(state.activeLevelIndex + 1, levels.length))
      .flatMap((level) => level.pickups)
      .map((item) => item.pickupId),
  );
  const revealableMemoryIds = new Set(completedMemoryIds);
  if (activeLevel) {
    if ('minorMemoryIds' in activeLevel) {
      activeLevel.minorMemoryIds.forEach((id) => revealableMemoryIds.add(id));
      if (state.phase === 'memory-released') revealableMemoryIds.add(activeLevel.majorMemoryId);
    } else if (state.phase === 'memory-released') {
      activeLevel.memoryIds.forEach((id) => revealableMemoryIds.add(id));
    }
  }
  const equipped = equipment.find((item) => item.id === state.equippedId);
  const expectedAge = state.completedLevelIds.length > 0
    ? levels[state.completedLevelIds.length - 1]!.targetAgeYears
    : (levels[0]?.startAgeYears ?? 0);
  const expectedAbilities = abilitiesForPlanAge(plan, expectedAge);
  const expectedAppearance = appearanceForAge(expectedAge);
  if (
    hasDuplicates(state.inventoryIds) ||
    hasDuplicates(state.collectedPickupIds) ||
    hasDuplicates(state.revealedMemoryIds) ||
    hasDuplicates(state.consumedMemoryIds) ||
    hasDuplicates(state.completedLevelIds) ||
    hasDuplicates(state.actionReceipts.map((receipt) => receipt.actionId)) ||
    state.playerHp > state.maxPlayerHp ||
    state.inventoryIds.some((id) => !equipmentIds.has(id)) ||
    state.inventoryIds.some((id) => !availableEquipment.has(id)) ||
    state.collectedPickupIds.some((id) => !pickupIds.has(id)) ||
    state.collectedPickupIds.some((id) => !availablePickups.has(id)) ||
    state.revealedMemoryIds.some((id) => !memories.has(id)) ||
    state.revealedMemoryIds.some((id) => !revealableMemoryIds.has(id)) ||
    (activeLevel && 'majorMemoryId' in activeLevel &&
      state.revealedMemoryIds.includes(activeLevel.majorMemoryId)) ||
    state.consumedMemoryIds.some(
      (id) => !memories.has(id) || !state.revealedMemoryIds.includes(id) || !completedMemoryIds.has(id),
    ) ||
    [...completedMemoryIds].some((id) => !state.consumedMemoryIds.includes(id)) ||
    state.completedLevelIds.some((id) => !levelIds.has(id)) ||
    completedPrefix.some((id, index) => state.completedLevelIds[index] !== id) ||
    state.activeLevelIndex !== state.completedLevelIds.length ||
    state.ageYears !== expectedAge ||
    state.appearanceStage !== expectedAppearance ||
    state.abilities.length !== expectedAbilities.length ||
    state.abilities.some((ability, index) => ability !== expectedAbilities[index]) ||
    state.inventoryIds.length !== state.collectedPickupIds.length ||
    state.inventoryIds.some((id) => {
      const item = equipment.find((candidate) => candidate.id === id);
      return !item || !state.collectedPickupIds.includes(item.pickupId);
    }) ||
    stateEncounterIds.length !== definitions.size ||
    stateEncounterIds.some((id) => !definitions.has(id)) ||
    state.equippedId !== null &&
      (!equipped || equipped.kind !== 'attack-tool' || !state.inventoryIds.includes(equipped.id)) ||
    state.actionReceipts.some(
      (receipt, index) => index > 0 &&
        receipt.appliedRevision !== state.actionReceipts[index - 1]!.appliedRevision + 1,
    )
  ) return false;
  for (const [id, definition] of definitions) {
    const progress = state.encounters[id];
    if (!progress || progress.hp > definition.maxHp || progress.defeated !== (progress.hp === 0)) return false;
  }
  for (const level of levels) {
    const progresses = level.encounters.map((encounter) => ({
      definition: encounter,
      progress: state.encounters[encounter.id]!,
    }));
    const completedEncountersValid = bossRequiresOrdinaryDefeats(
      'routeId' in level ? level.routeId : undefined,
      'bossGate' in level ? level.bossGate : undefined,
    )
      ? progresses.every(({ progress }) => progress.defeated)
      : state.encounters[level.bossId]?.defeated === true;
    if (
      level.index < state.activeLevelIndex &&
      !completedEncountersValid
    ) return false;
    if (
      level.index > state.activeLevelIndex &&
      progresses.some(
        ({ definition, progress }) =>
          progress.defeated || progress.hp !== definition.maxHp || progress.nextReportedHitAtMs !== 0,
      )
    ) return false;
  }
  if (state.phase === 'complete') {
    return state.activeLevelIndex === levels.length &&
      state.completedLevelIds.length === levels.length &&
      state.playerHp > 0;
  }
  if (state.activeLevelIndex >= levels.length) return false;
  const active = levels[state.activeLevelIndex]!;
  const ordinaryDefeated = active.encounters
    .filter((encounter) => encounter.role === 'ordinary')
    .every((encounter) => state.encounters[encounter.id]?.defeated);
  const bossDefinition = active.encounters.find((encounter) => encounter.id === active.bossId)!;
  const bossProgress = state.encounters[active.bossId]!;
  const bossDefeated = state.encounters[active.bossId]?.defeated === true;
  const requiresOrdinaryDefeats = bossRequiresOrdinaryDefeats(
    'routeId' in active ? active.routeId : undefined,
    'bossGate' in active ? active.bossGate : undefined,
  );
  if (
    requiresOrdinaryDefeats &&
    !ordinaryDefeated &&
    (bossProgress.defeated || bossProgress.hp !== bossDefinition.maxHp)
  ) return false;
  if (state.phase === 'memory-released' && !bossDefeated) return false;
  if (
    state.phase === 'memory-released' &&
    requiresOrdinaryDefeats &&
    active.encounters.some((encounter) => !state.encounters[encounter.id]?.defeated)
  ) return false;
  if ((state.phase === 'exploring' || state.phase === 'fallen') && bossDefeated) return false;
  if ((state.phase === 'fallen') !== (state.playerHp === 0)) return false;
  return true;
}

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

function invalid(): never {
  throw new AppError(503, 'SAVE_DATA_INVALID', 'Save unavailable');
}
