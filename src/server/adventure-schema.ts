import { z } from 'zod';
import {
  abilitiesForAge,
  appearanceForAge,
  type AdventurePlan,
  type AdventurePlanV2,
  type AdventureState,
} from '../shared/adventure.js';
import {
  PARODY_CATALOGS,
  PARODY_CATALOG_VERSIONS,
} from '../shared/parody-catalog.js';
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
const abilitySchema = z.enum(['move', 'interact', 'jump']);
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
const levelShape = {
  id: identifier,
  index: z.number().int().min(0).max(23),
  startAgeYears: z.number().int().min(0).max(150),
  targetAgeYears: z.number().int().min(0).max(150),
  startDate: dateOnly,
  eraYear: z.number().int().min(1_000).max(9_999),
  memoryIds: z.array(identifier).min(1).max(24),
  pickups: z.array(equipmentSchema).min(1).max(8),
  bossId: identifier,
};
const levelV1Schema = z.object({
  ...levelShape,
  encounters: z.array(encounterDefinitionV1Schema).min(1).max(16),
}).strict();
const levelV2Schema = z.object({
  ...levelShape,
  periodId: z.enum(['block-party-v1', 'remix-runway-v1', 'remix-runway-v2']),
  routeId: z.enum(['gentle-intro-v1', 'gentle-jump-v1']),
  encounters: z.array(encounterDefinitionV2Schema).min(1).max(16),
}).strict();
const planSchema = z.discriminatedUnion('version', [
  z.object({
    version: z.literal('era-level-plan-v1'),
    levels: z.array(levelV1Schema).min(1).max(24),
  }).strict(),
  z.object({
    version: z.literal('era-level-plan-v2'),
    catalogVersion: z.enum(PARODY_CATALOG_VERSIONS),
    levels: z.array(levelV2Schema).min(1).max(24),
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
  abilities: z.array(z.enum(['move', 'interact', 'jump'])).min(2).max(3),
  appearanceStage: z.enum(['infant', 'child']),
  attackReadyAtMs: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  guardActiveUntilMs: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  guardReadyAtMs: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  actionReceipts: z.array(receiptSchema).max(128),
}).strict();

const storedSaveJsonSchema = z.object({
  subject: subjectSchema,
  memories: z.array(frozenMemorySchema).min(1).max(240),
  recoveredIds: z.array(z.string().min(1).max(128)).max(240),
  abilities: z.array(abilitySchema).min(1).max(3),
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
): { plan: AdventurePlan; state: AdventureState } {
  const parsedPlan = planSchema.safeParse(rawPlan);
  const parsedState = stateSchema.safeParse(rawState);
  if (!parsedPlan.success || !parsedState.success) invalid();
  const plan = parsedPlan.data as AdventurePlan;
  const state = parsedState.data as AdventureState;
  if (!validPlan(plan) || !validState(plan, state)) invalid();
  return { plan, state };
}

function validPlan(plan: AdventurePlan): boolean {
  if (plan.version === 'era-level-plan-v2' && !validParodyPlan(plan)) return false;
  const levelIds = new Set<string>();
  const memoryIds = new Set<string>();
  const pickupIds = new Set<string>();
  const equipmentIds = new Set<string>();
  const encounterIds = new Set<string>();
  let priorTargetAge = 0;
  for (const [index, level] of plan.levels.entries()) {
    const levelPickupIds = level.pickups.map((equipment) => equipment.pickupId);
    const levelEquipmentIds = level.pickups.map((equipment) => equipment.id);
    const levelEncounterIds = level.encounters.map((encounter) => encounter.id);
    if (
      level.index !== index ||
      level.startAgeYears !== priorTargetAge ||
      level.targetAgeYears < level.startAgeYears ||
      level.eraYear !== Number(level.startDate.slice(0, 4)) ||
      levelIds.has(level.id) ||
      hasDuplicates(level.memoryIds) ||
      hasDuplicates(levelPickupIds) ||
      hasDuplicates(levelEquipmentIds) ||
      hasDuplicates(levelEncounterIds) ||
      level.memoryIds.some((id) => memoryIds.has(id)) ||
      level.pickups.some(
        (equipment) => pickupIds.has(equipment.pickupId) || equipmentIds.has(equipment.id),
      ) ||
      level.encounters.some((encounter) => encounterIds.has(encounter.id)) ||
      level.encounters.filter((encounter) => encounter.role === 'ordinary').length !== 2 ||
      level.encounters.filter((encounter) => encounter.role === 'boss').length !== 1 ||
      level.encounters.find((encounter) => encounter.id === level.bossId)?.role !== 'boss'
    ) return false;
    levelIds.add(level.id);
    level.memoryIds.forEach((id) => memoryIds.add(id));
    level.pickups.forEach((equipment) => {
      pickupIds.add(equipment.pickupId);
      equipmentIds.add(equipment.id);
    });
    level.encounters.forEach((encounter) => encounterIds.add(encounter.id));
    priorTargetAge = level.targetAgeYears;
  }
  return true;
}

function validParodyPlan(plan: AdventurePlanV2): boolean {
  const catalog = PARODY_CATALOGS[plan.catalogVersion];
  if (!catalog) return false;
  for (const level of plan.levels) {
    const abilities = new Set(abilitiesForAge(level.startAgeYears));
    const expectedRoute = abilities.has('jump') ? 'gentle-jump-v1' : 'gentle-intro-v1';
    if (
      level.routeId !== expectedRoute ||
      new Set(level.encounters.map((encounter) => encounter.content.catalogEntryId)).size !== level.encounters.length ||
      level.encounters.filter((encounter) => encounter.kind === 'ordinary-a' && encounter.role === 'ordinary').length !== 1 ||
      level.encounters.filter((encounter) => encounter.kind === 'ordinary-b' && encounter.role === 'ordinary').length !== 1 ||
      level.encounters.filter((encounter) => encounter.kind === 'boss' && encounter.role === 'boss').length !== 1
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
  const memories = new Set(levels.flatMap((level) => level.memoryIds));
  const levelIds = new Set(levels.map((level) => level.id));
  const definitions = new Map(
    levels.flatMap((level) => level.encounters).map((encounter) => [encounter.id, encounter]),
  );
  const stateEncounterIds = Object.keys(state.encounters);
  const completedPrefix = levels.slice(0, state.completedLevelIds.length).map((level) => level.id);
  const completedMemoryIds = new Set(
    levels.slice(0, state.completedLevelIds.length).flatMap((level) => level.memoryIds),
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
  const revealableMemoryIds = new Set([
    ...completedMemoryIds,
    ...(activeLevel && state.phase === 'memory-released' ? activeLevel.memoryIds : []),
  ]);
  const equipped = equipment.find((item) => item.id === state.equippedId);
  const expectedAge = state.completedLevelIds.length > 0
    ? levels[state.completedLevelIds.length - 1]!.targetAgeYears
    : 0;
  const expectedAbilities = abilitiesForAge(expectedAge);
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
    if (
      level.index < state.activeLevelIndex &&
      progresses.some(({ progress }) => !progress.defeated)
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
  if (!ordinaryDefeated && (bossProgress.defeated || bossProgress.hp !== bossDefinition.maxHp)) return false;
  if (state.phase === 'memory-released' && !bossDefeated) return false;
  if (
    state.phase === 'memory-released' &&
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
