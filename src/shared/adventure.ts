import type {
  Ability,
  ActiveLevelView,
  AdventurePhase,
  AdventureView,
  AppearanceStage,
  EncounterKind,
  EncounterRole,
  EquipmentKind,
  EquipmentView,
  GameplayAction,
} from './contracts.js';

export const AGE_THRESHOLDS = [4, 8, 13, 18, 25, 35, 50, 65] as const;
export const ATTACK_COOLDOWN_MS = 600;
export const ENEMY_HIT_COOLDOWN_MS = 900;
export const GUARD_ACTIVE_MS = 800;
export const GUARD_COOLDOWN_MS = 1_500;
export const MAX_ACTION_RECEIPTS = 128;
export const DEFAULT_PLAYER_HP = 10;

export interface AdventureMemory {
  id: string;
  date: string;
  ageYears: number;
}

export interface FrozenEquipmentDefinition {
  id: string;
  pickupId: string;
  kind: EquipmentKind;
  tier: number;
  damage: number;
  guardReduction: number;
}

export interface FrozenEncounterDefinition {
  id: string;
  role: EncounterRole;
  kind: EncounterKind;
  maxHp: number;
  attackDamage: number;
}

export interface FrozenLevelPlan {
  id: string;
  index: number;
  startAgeYears: number;
  targetAgeYears: number;
  startDate: string;
  eraYear: number;
  memoryIds: string[];
  pickups: FrozenEquipmentDefinition[];
  encounters: FrozenEncounterDefinition[];
  bossId: string;
}

export interface AdventurePlan {
  version: 'era-level-plan-v1';
  levels: FrozenLevelPlan[];
}

export interface EncounterProgress {
  hp: number;
  defeated: boolean;
  nextReportedHitAtMs: number;
}

export interface ActionReceipt {
  actionId: string;
  payloadHash: string;
  appliedRevision: number;
}

export interface AdventureState {
  version: 'era-combat-state-v2';
  activeLevelIndex: number;
  phase: AdventurePhase;
  inventoryIds: string[];
  equippedId: string | null;
  collectedPickupIds: string[];
  playerHp: number;
  maxPlayerHp: number;
  encounters: Record<string, EncounterProgress>;
  revealedMemoryIds: string[];
  consumedMemoryIds: string[];
  completedLevelIds: string[];
  ageYears: number;
  abilities: Ability[];
  appearanceStage: AppearanceStage;
  attackReadyAtMs: number;
  guardActiveUntilMs: number;
  guardReadyAtMs: number;
  actionReceipts: ActionReceipt[];
}

export type AdventureRuleCode =
  | 'LEVEL_NOT_ACTIVE'
  | 'ACTION_NOT_AVAILABLE'
  | 'PICKUP_NOT_FOUND'
  | 'PICKUP_ALREADY_COLLECTED'
  | 'ATTACK_TOOL_REQUIRED'
  | 'GUARD_TOOL_REQUIRED'
  | 'ENCOUNTER_NOT_FOUND'
  | 'ENCOUNTER_NOT_ACTIVE'
  | 'ATTACK_COOLDOWN'
  | 'ENEMY_HIT_COOLDOWN'
  | 'GUARD_COOLDOWN'
  | 'MEMORY_NOT_FOUND'
  | 'MEMORY_ALREADY_REVEALED'
  | 'MEMORY_BUNDLE_INCOMPLETE';

export class AdventureRuleError extends Error {
  constructor(readonly code: AdventureRuleCode) {
    super(code);
  }
}

export function abilitiesForAge(ageYears: number): Ability[] {
  return ageYears >= 4 ? ['move', 'interact', 'jump'] : ['move', 'interact'];
}

export function appearanceForAge(ageYears: number): AppearanceStage {
  return ageYears >= 4 ? 'child' : 'infant';
}

export function createAdventurePlan(
  birthDate: string,
  memories: AdventureMemory[],
): AdventurePlan {
  if (memories.length < 1 || memories.length > 24) {
    throw new RangeError('An adventure requires between 1 and 24 memories');
  }
  const levels: FrozenLevelPlan[] = [];
  let memoryIndex = 0;
  let startAgeYears = 0;
  let startDate = birthDate;

  while (memoryIndex < memories.length) {
    const threshold = AGE_THRESHOLDS.find((candidate) => candidate > startAgeYears);
    let endIndex = memories.length - 1;
    if (threshold !== undefined) {
      const thresholdOffset = memories
        .slice(memoryIndex)
        .findIndex((memory) => memory.ageYears >= threshold);
      if (thresholdOffset >= 0) endIndex = memoryIndex + thresholdOffset;
    }

    const bundle = memories.slice(memoryIndex, endIndex + 1);
    const finalMemory = bundle.at(-1);
    if (!finalMemory) throw new RangeError('Adventure level has no memories');
    const index = levels.length;
    const eraYear = Number(startDate.slice(0, 4));
    if (!Number.isInteger(eraYear)) throw new RangeError('Adventure start date is invalid');
    const prefix = `level-${index + 1}-${eraYear}`;
    const pickups = createEquipment(prefix, index);
    const encounters = createEncounters(prefix, index);
    levels.push({
      id: prefix,
      index,
      startAgeYears,
      targetAgeYears: finalMemory.ageYears,
      startDate,
      eraYear,
      memoryIds: bundle.map((memory) => memory.id),
      pickups,
      encounters,
      bossId: encounters.at(-1)!.id,
    });

    memoryIndex = endIndex + 1;
    startAgeYears = finalMemory.ageYears;
    startDate = finalMemory.date;
  }

  return { version: 'era-level-plan-v1', levels };
}

export function createInitialAdventureState(plan: AdventurePlan): AdventureState {
  const encounters = Object.fromEntries(
    plan.levels.flatMap((level) => level.encounters).map((encounter) => [
      encounter.id,
      { hp: encounter.maxHp, defeated: false, nextReportedHitAtMs: 0 },
    ]),
  );
  return {
    version: 'era-combat-state-v2',
    activeLevelIndex: 0,
    phase: 'exploring',
    inventoryIds: [],
    equippedId: null,
    collectedPickupIds: [],
    playerHp: DEFAULT_PLAYER_HP,
    maxPlayerHp: DEFAULT_PLAYER_HP,
    encounters,
    revealedMemoryIds: [],
    consumedMemoryIds: [],
    completedLevelIds: [],
    ageYears: 0,
    abilities: abilitiesForAge(0),
    appearanceStage: appearanceForAge(0),
    attackReadyAtMs: 0,
    guardActiveUntilMs: 0,
    guardReadyAtMs: 0,
    actionReceipts: [],
  };
}

export function reduceAdventureAction(
  plan: AdventurePlan,
  current: AdventureState,
  action: GameplayAction,
  nowMs: number,
): AdventureState {
  const state = structuredClone(current);
  const level = activeLevel(plan, state);
  if (!level || action.levelId !== level.id) throw new AdventureRuleError('LEVEL_NOT_ACTIVE');

  if (action.type === 'retry-level') {
    if (state.phase !== 'fallen') throw new AdventureRuleError('ACTION_NOT_AVAILABLE');
    state.phase = 'exploring';
    state.playerHp = state.maxPlayerHp;
    state.attackReadyAtMs = 0;
    state.guardActiveUntilMs = 0;
    state.guardReadyAtMs = 0;
    for (const encounter of level.encounters) {
      state.encounters[encounter.id] = {
        hp: encounter.maxHp,
        defeated: false,
        nextReportedHitAtMs: 0,
      };
    }
    return state;
  }

  if (state.phase === 'fallen' || state.phase === 'complete') {
    throw new AdventureRuleError('ACTION_NOT_AVAILABLE');
  }

  if (action.type === 'collect-equipment') {
    requirePhase(state, 'exploring');
    const equipment = level.pickups.find((candidate) => candidate.pickupId === action.pickupId);
    if (!equipment) throw new AdventureRuleError('PICKUP_NOT_FOUND');
    if (state.collectedPickupIds.includes(action.pickupId)) {
      throw new AdventureRuleError('PICKUP_ALREADY_COLLECTED');
    }
    state.collectedPickupIds.push(action.pickupId);
    state.inventoryIds.push(equipment.id);
    if (equipment.kind === 'attack-tool') {
      const equipped = findEquipment(plan, state.equippedId);
      if (!equipped || equipment.damage > equipped.damage) state.equippedId = equipment.id;
    }
    return state;
  }

  if (action.type === 'attack') {
    requirePhase(state, 'exploring');
    const encounter = requireCurrentEncounter(level, state, action.encounterId);
    if (nowMs < state.attackReadyAtMs) throw new AdventureRuleError('ATTACK_COOLDOWN');
    const equipment = findEquipment(plan, state.equippedId);
    if (!equipment || equipment.kind !== 'attack-tool' || !state.inventoryIds.includes(equipment.id)) {
      throw new AdventureRuleError('ATTACK_TOOL_REQUIRED');
    }
    const progress = state.encounters[encounter.id]!;
    progress.hp = Math.max(0, progress.hp - equipment.damage);
    progress.defeated = progress.hp === 0;
    state.attackReadyAtMs = nowMs + ATTACK_COOLDOWN_MS;
    if (progress.defeated && encounter.role === 'boss') state.phase = 'memory-released';
    return state;
  }

  if (action.type === 'take-hit') {
    requirePhase(state, 'exploring');
    const encounter = requireCurrentEncounter(level, state, action.encounterId);
    const progress = state.encounters[encounter.id]!;
    if (nowMs < progress.nextReportedHitAtMs) throw new AdventureRuleError('ENEMY_HIT_COOLDOWN');
    const guard = strongestGuard(plan, state.inventoryIds);
    const reduction = guard && nowMs < state.guardActiveUntilMs ? guard.guardReduction : 0;
    state.playerHp = Math.max(0, state.playerHp - Math.max(0, encounter.attackDamage - reduction));
    progress.nextReportedHitAtMs = nowMs + ENEMY_HIT_COOLDOWN_MS;
    if (state.playerHp === 0) state.phase = 'fallen';
    return state;
  }

  if (action.type === 'guard') {
    requirePhase(state, 'exploring');
    if (!strongestGuard(plan, state.inventoryIds)) throw new AdventureRuleError('GUARD_TOOL_REQUIRED');
    if (!level.encounters.some((encounter) => !state.encounters[encounter.id]?.defeated)) {
      throw new AdventureRuleError('ENCOUNTER_NOT_ACTIVE');
    }
    if (nowMs < state.guardReadyAtMs) throw new AdventureRuleError('GUARD_COOLDOWN');
    state.guardActiveUntilMs = nowMs + GUARD_ACTIVE_MS;
    state.guardReadyAtMs = nowMs + GUARD_COOLDOWN_MS;
    return state;
  }

  if (action.type === 'recover-memory') {
    requirePhase(state, 'memory-released');
    if (!level.memoryIds.includes(action.memoryId)) throw new AdventureRuleError('MEMORY_NOT_FOUND');
    if (state.revealedMemoryIds.includes(action.memoryId)) {
      throw new AdventureRuleError('MEMORY_ALREADY_REVEALED');
    }
    state.revealedMemoryIds.push(action.memoryId);
    return state;
  }

  requirePhase(state, 'memory-released');
  if (level.memoryIds.some((memoryId) => !state.revealedMemoryIds.includes(memoryId))) {
    throw new AdventureRuleError('MEMORY_BUNDLE_INCOMPLETE');
  }
  for (const memoryId of level.memoryIds) {
    if (!state.consumedMemoryIds.includes(memoryId)) state.consumedMemoryIds.push(memoryId);
  }
  state.completedLevelIds.push(level.id);
  state.ageYears = level.targetAgeYears;
  state.abilities = abilitiesForAge(state.ageYears);
  state.appearanceStage = appearanceForAge(state.ageYears);
  state.playerHp = state.maxPlayerHp;
  state.attackReadyAtMs = 0;
  state.guardActiveUntilMs = 0;
  state.guardReadyAtMs = 0;

  if (level.index === plan.levels.length - 1) {
    state.activeLevelIndex = plan.levels.length;
    state.phase = 'complete';
  } else {
    state.activeLevelIndex += 1;
    state.phase = 'exploring';
  }
  return state;
}

export function toAdventureView(
  plan: AdventurePlan,
  state: AdventureState,
  nowMs: number,
): AdventureView {
  const level = activeLevel(plan, state);
  const allEquipment = plan.levels.flatMap((candidate) => candidate.pickups);
  const inventory = allEquipment
    .filter((equipment) => state.inventoryIds.includes(equipment.id))
    .map((equipment) => equipmentView(equipment, state));
  return {
    phase: state.phase,
    activeLevelIndex: state.activeLevelIndex,
    currentLevelId: level?.id ?? null,
    activeLevel: level ? levelView(plan, level, state) : null,
    completedLevelIds: [...state.completedLevelIds],
    consumedMemoryIds: [...state.consumedMemoryIds],
    inventory,
    equippedId: state.equippedId,
    playerHp: state.playerHp,
    maxPlayerHp: state.maxPlayerHp,
    attackCooldownRemainingMs: remaining(state.attackReadyAtMs, nowMs),
    guardActiveRemainingMs: remaining(state.guardActiveUntilMs, nowMs),
    guardCooldownRemainingMs: remaining(state.guardReadyAtMs, nowMs),
  };
}

export function activeLevel(
  plan: AdventurePlan,
  state: Pick<AdventureState, 'activeLevelIndex'>,
): FrozenLevelPlan | null {
  return plan.levels[state.activeLevelIndex] ?? null;
}

export function memoryIsReleased(
  plan: AdventurePlan,
  state: AdventureState,
  memoryId: string,
): boolean {
  if (state.revealedMemoryIds.includes(memoryId) || state.consumedMemoryIds.includes(memoryId)) return true;
  const level = activeLevel(plan, state);
  return Boolean(level?.memoryIds.includes(memoryId) && state.phase === 'memory-released');
}

function createEquipment(prefix: string, levelIndex: number): FrozenEquipmentDefinition[] {
  const tier = levelIndex + 1;
  return [
    {
      id: `${prefix}-equipment-attack`,
      pickupId: `${prefix}-pickup-attack`,
      kind: 'attack-tool',
      tier,
      damage: 2 + levelIndex,
      guardReduction: 0,
    },
    {
      id: `${prefix}-equipment-guard`,
      pickupId: `${prefix}-pickup-guard`,
      kind: 'guard-tool',
      tier,
      damage: 0,
      guardReduction: 2 + levelIndex,
    },
  ];
}

function createEncounters(prefix: string, levelIndex: number): FrozenEncounterDefinition[] {
  return [
    {
      id: `${prefix}-encounter-1`,
      role: 'ordinary',
      kind: 'ordinary-a',
      maxHp: 4 + levelIndex * 2,
      attackDamage: 2 + levelIndex,
    },
    {
      id: `${prefix}-encounter-2`,
      role: 'ordinary',
      kind: 'ordinary-b',
      maxHp: 5 + levelIndex * 2,
      attackDamage: 2 + levelIndex,
    },
    {
      id: `${prefix}-boss`,
      role: 'boss',
      kind: 'boss',
      maxHp: 8 + levelIndex * 3,
      attackDamage: 3 + levelIndex,
    },
  ];
}

function requirePhase(state: AdventureState, phase: AdventurePhase): void {
  if (state.phase !== phase) throw new AdventureRuleError('ACTION_NOT_AVAILABLE');
}

function requireCurrentEncounter(
  level: FrozenLevelPlan,
  state: AdventureState,
  encounterId: string,
): FrozenEncounterDefinition {
  const requested = level.encounters.find((encounter) => encounter.id === encounterId);
  if (!requested) throw new AdventureRuleError('ENCOUNTER_NOT_FOUND');
  if (state.encounters[requested.id]?.defeated) {
    throw new AdventureRuleError('ENCOUNTER_NOT_ACTIVE');
  }
  if (
    requested.role === 'boss' &&
    level.encounters.some(
      (encounter) => encounter.role === 'ordinary' && !state.encounters[encounter.id]?.defeated,
    )
  ) throw new AdventureRuleError('ENCOUNTER_NOT_ACTIVE');
  return requested;
}

function findEquipment(
  plan: AdventurePlan,
  equipmentId: string | null,
): FrozenEquipmentDefinition | null {
  if (!equipmentId) return null;
  return plan.levels.flatMap((level) => level.pickups).find((equipment) => equipment.id === equipmentId) ?? null;
}

function strongestGuard(
  plan: AdventurePlan,
  inventoryIds: string[],
): FrozenEquipmentDefinition | null {
  return plan.levels
    .flatMap((level) => level.pickups)
    .filter((equipment) => equipment.kind === 'guard-tool' && inventoryIds.includes(equipment.id))
    .sort((left, right) => right.guardReduction - left.guardReduction)[0] ?? null;
}

function equipmentView(
  equipment: FrozenEquipmentDefinition,
  state: AdventureState,
): EquipmentView {
  return {
    ...equipment,
    collected: state.collectedPickupIds.includes(equipment.pickupId),
  };
}

function levelView(
  plan: AdventurePlan,
  level: FrozenLevelPlan,
  state: AdventureState,
): ActiveLevelView {
  const ordinaryDefeated = level.encounters
    .filter((encounter) => encounter.role === 'ordinary')
    .every((encounter) => state.encounters[encounter.id]?.defeated);
  return {
    id: level.id,
    index: level.index,
    totalLevels: plan.levels.length,
    startAgeYears: level.startAgeYears,
    targetAgeYears: level.targetAgeYears,
    startDate: level.startDate,
    eraYear: level.eraYear,
    memoryIds: [...level.memoryIds],
    pickups: level.pickups.map((equipment) => equipmentView(equipment, state)),
    encounters: level.encounters.map((encounter) => {
      const defeated = state.encounters[encounter.id]?.defeated ?? false;
      return {
        ...encounter,
        hp: state.encounters[encounter.id]?.hp ?? encounter.maxHp,
        defeated,
        available: !defeated && (encounter.role === 'ordinary' || ordinaryDefeated),
      };
    }),
    bossId: level.bossId,
  };
}

function remaining(deadlineMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil(deadlineMs - nowMs));
}
