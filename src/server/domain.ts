import { createHash } from 'node:crypto';
import {
  AdventureRuleError,
  MAX_ACTION_RECEIPTS,
  abilitiesForAge,
  appearanceForAge,
  createAdventurePlan,
  createInitialAdventureState,
  memoryIsReleased,
  reduceAdventureAction,
  toAdventureView,
  type AdventurePlan,
  type AdventureState,
} from '../shared/adventure.js';
import { PARODY_CATALOG_VERSION } from '../shared/parody-catalog.js';
import { ParodyCatalogUnavailableError } from '../shared/parody-selection.js';
import {
  createInitialFriendlyState,
  friendlyViewsForLevel,
  reduceFriendlyAction,
  type FriendlyAction,
  type FriendlyState,
} from '../shared/friendly.js';
import type {
  Ability,
  AppearanceStage,
  GameplayActionRequest,
  MemoryPreview,
  PreviewResponse,
  RuleVersions,
  SaveFormat,
  SaveSummary,
  SaveView,
  SubjectOption,
} from '../shared/contracts.js';
import { AppError } from './errors.js';
import {
  parseStoredAdventure,
  parseStoredFriendlyState,
  parseStoredSaveJson,
} from './adventure-schema.js';

export const FIXTURE_SUBJECT: SubjectOption = {
  id: 'demo-adventurer-v1',
  label: 'Demo Adventurer',
};

export const RULE_VERSIONS: RuleVersions = {
  journey: 'era-level-plan-v2',
  age: 'birth-date-whole-years-v1',
  progression: 'boss-memory-consume-v2',
  appearance: 'synthetic-traveler-v1',
  catalog: PARODY_CATALOG_VERSION,
  combat: 'discrete-combat-v1',
};

export interface PlayerRecord {
  id: string;
  label: string;
}

export type MemorySource =
  | { kind: 'fixture'; key: string }
  | { kind: 'immich'; assetId: string; personId: string };

export interface FrozenMemory extends MemoryPreview {
  source: MemorySource;
}

export interface PreviewRecord extends PreviewResponse {
  ownerId: string;
  birthDate: string;
  chosenSubject: SubjectOption | null;
  memories: FrozenMemory[];
  createdAt: Date;
  expiresAt: Date;
}

export interface SaveRecord {
  id: string;
  ownerId: string;
  previewId: string;
  title: string;
  subject: SubjectOption;
  birthDate: string;
  memories: FrozenMemory[];
  recoveredIds: string[];
  ageYears: number;
  abilities: Ability[];
  appearanceStage: AppearanceStage;
  completed: boolean;
  saveFormat: SaveFormat;
  adventurePlan: AdventurePlan | null;
  adventureState: AdventureState | null;
  /** Null or absent on saves created before the friendly sidecar was introduced. */
  friendlyState?: FriendlyState | null;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  versions: RuleVersions;
}

export interface NewPreviewRecord {
  ownerId: string;
  birthDate: string;
  subjects: SubjectOption[];
  chosenSubject: SubjectOption | null;
  memories: FrozenMemory[];
  selectedIds: string[];
  coverage: PreviewResponse['coverage'];
  expiresAt: Date;
}

export interface CreateSaveCommand {
  ownerId: string;
  previewId: string;
  selectedIds: string[];
  title?: string;
}

export interface FixtureMaintenanceResult {
  sessionsDeleted: number;
  previewsDeleted: number;
}

export interface QuestStore {
  ready(): Promise<boolean>;
  getSession(sessionId: string, now: Date): Promise<PlayerRecord | null>;
  createFixtureSession(sessionId: string, expiresAt: Date): Promise<PlayerRecord>;
  putPreview(preview: NewPreviewRecord): Promise<PreviewRecord>;
  createSave(command: CreateSaveCommand): Promise<SaveRecord>;
  listSaves(ownerId: string): Promise<SaveRecord[]>;
  getSave(ownerId: string, saveId: string): Promise<SaveRecord | null>;
  applyGameplayAction(
    ownerId: string,
    saveId: string,
    request: GameplayActionRequest,
    now: Date,
  ): Promise<SaveRecord>;
  maintainFixtureRecords(now: Date): Promise<FixtureMaintenanceResult>;
  close?(): Promise<void>;
}

export { abilitiesForAge, appearanceForAge };

export function createAdventureForSave(
  birthDate: string,
  memories: FrozenMemory[],
): { plan: AdventurePlan; state: AdventureState } {
  try {
    const plan = createAdventurePlan(birthDate, memories);
    return { plan, state: createInitialAdventureState(plan) };
  } catch (error) {
    if (error instanceof ParodyCatalogUnavailableError) {
      throw new AppError(422, 'ERA_CATALOG_UNAVAILABLE', 'Adventure catalog unavailable');
    }
    throw error;
  }
}

export function wholeYearsAt(birthDate: string, eventDate: string): number {
  const birth = parseDateOnly(birthDate);
  const event = parseDateOnly(eventDate);
  let years = event.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    event.getUTCMonth() < birth.getUTCMonth() ||
    (event.getUTCMonth() === birth.getUTCMonth() && event.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) years -= 1;
  if (years < 0) throw new Error('Event precedes birth date');
  return years;
}

export function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid date');
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('Invalid date');
  }
  return parsed;
}

export function isValidFrozenManifest(birthDate: string, memories: FrozenMemory[]): boolean {
  if (memories.length > 240) return false;
  const ids = new Set<string>();
  let priorDate = '';
  let priorAge = -1;
  for (const memory of memories) {
    if (ids.has(memory.id) || memory.id.length < 1 || memory.id.length > 128 || memory.label.length > 160) return false;
    ids.add(memory.id);
    try {
      if (wholeYearsAt(birthDate, memory.date) !== memory.ageYears) return false;
    } catch {
      return false;
    }
    if (memory.date < priorDate || memory.ageYears < priorAge) return false;
    priorDate = memory.date;
    priorAge = memory.ageYears;
  }
  return true;
}

export function applyGameplayActionToSave(
  save: SaveRecord,
  request: GameplayActionRequest,
  now: Date,
): { save: SaveRecord; replay: boolean } {
  if (save.saveFormat !== 'era-combat-v2' || !save.adventurePlan || !save.adventureState) {
    throw new AppError(409, 'LEGACY_SAVE_READ_ONLY', 'Legacy save is read only');
  }
  const payloadHash = gameplayActionHash(request);
  const receipt = save.adventureState.actionReceipts.find(
    (candidate) => candidate.actionId === request.actionId,
  );
  if (receipt) {
    if (receipt.payloadHash !== payloadHash) {
      throw new AppError(409, 'ACTION_ID_REUSED', 'Action ID already used');
    }
    return { save, replay: true };
  }
  if (request.expectedRevision !== save.revision) {
    throw new AppError(409, 'SAVE_REVISION_STALE', 'Save changed');
  }

  let adventureState: AdventureState;
  let friendlyState = effectiveFriendlyState(
    save.adventurePlan,
    save.adventureState,
    save.friendlyState,
  );
  try {
    if (isFriendlyAction(request.action)) {
      ({ adventureState, friendlyState } = reduceFriendlyAction(
        save.adventurePlan,
        save.adventureState,
        friendlyState,
        request.action,
        now.valueOf(),
      ));
    } else {
      adventureState = reduceAdventureAction(
        save.adventurePlan,
        save.adventureState,
        request.action,
        now.valueOf(),
      );
    }
  } catch (error) {
    if (error instanceof AdventureRuleError) {
      throw new AppError(409, error.code, 'Action unavailable');
    }
    throw error;
  }
  const revision = save.revision + 1;
  adventureState.actionReceipts = [
    ...adventureState.actionReceipts,
    { actionId: request.actionId, payloadHash, appliedRevision: revision },
  ].slice(-MAX_ACTION_RECEIPTS);
  // Validate the reduced record before any store writes it: an impossible
  // reducer result must fail the transaction rather than persist a record the
  // read path can no longer load. This re-checks structure and invariants only;
  // the frozen plan stays the authority for its own combat numbers.
  const next = validateSaveRecord({
    ...save,
    recoveredIds: [...adventureState.revealedMemoryIds],
    ageYears: adventureState.ageYears,
    abilities: [...adventureState.abilities],
    appearanceStage: adventureState.appearanceStage,
    completed: adventureState.phase === 'complete',
    adventureState,
    friendlyState,
    revision,
    updatedAt: now,
  });
  return { replay: false, save: next };
}

/** `now` must be the application clock that also governs gameplay actions. */
export function toSaveView(save: SaveRecord, now: Date): SaveView {
  const legacy = save.saveFormat === 'legacy-v1';
  let adventure = !legacy && save.adventurePlan && save.adventureState
    ? toAdventureView(save.adventurePlan, save.adventureState, now.valueOf())
    : null;
  if (adventure?.activeLevel && save.adventurePlan) {
    const friendlyState = effectiveFriendlyState(
      save.adventurePlan,
      save.adventureState!,
      save.friendlyState,
    );
    adventure = {
      ...adventure,
      activeLevel: {
        ...adventure.activeLevel,
        friendlies: friendlyViewsForLevel(
          adventure.activeLevel.id,
          adventure.activeLevel.index,
          friendlyState,
        ),
      },
    };
  }
  return {
    id: save.id,
    title: save.title,
    subject: save.subject,
    memories: save.memories.map(({ id, date, ageYears, label }) => {
      const recovered = save.recoveredIds.includes(id);
      const consumed = save.adventureState?.consumedMemoryIds.includes(id) ?? false;
      const released = legacy || (
        save.adventurePlan !== null &&
        save.adventureState !== null &&
        memoryIsReleased(save.adventurePlan, save.adventureState, id)
      );
      const state = consumed ? 'consumed' : recovered ? 'revealed' : released ? 'released' : 'locked';
      return {
        id,
        date,
        ageYears,
        label,
        state,
        ...(released ? {
          mediaUrl: `/api/saves/${encodeURIComponent(save.id)}/media/${encodeURIComponent(id)}`,
        } : {}),
      };
    }),
    recoveredIds: [...save.recoveredIds],
    ageYears: save.ageYears,
    abilities: [...save.abilities],
    appearance: {
      contractVersion: save.versions.appearance,
      subjectAppearanceId: 'synthetic-traveler-v1',
      stage: save.appearanceStage,
    },
    completed: save.completed,
    format: save.saveFormat,
    adventure,
    revision: save.revision,
    createdAt: save.createdAt.toISOString(),
    updatedAt: save.updatedAt.toISOString(),
    versions: save.versions,
  };
}

export function toSaveSummary(save: SaveRecord): SaveSummary {
  return {
    id: save.id,
    title: save.title,
    subject: save.subject,
    ageYears: save.ageYears,
    recoveredCount: save.recoveredIds.length,
    memoryCount: save.memories.length,
    completed: save.completed,
    format: save.saveFormat,
    createdAt: save.createdAt.toISOString(),
    updatedAt: save.updatedAt.toISOString(),
  };
}

export function canAccessSaveMemory(save: SaveRecord, memoryId: string): boolean {
  if (!save.memories.some((memory) => memory.id === memoryId)) return false;
  if (save.saveFormat === 'legacy-v1') return true;
  return Boolean(
    save.adventurePlan &&
    save.adventureState &&
    memoryIsReleased(save.adventurePlan, save.adventureState, memoryId)
  );
}

export function validateSaveRecord(save: SaveRecord): SaveRecord {
  const stored = parseStoredSaveJson({
    subject: save.subject,
    memories: save.memories,
    recoveredIds: save.recoveredIds,
    abilities: save.abilities,
    versions: save.versions,
  });
  const normalized = { ...save, ...stored };
  if (
    !isValidFrozenManifest(normalized.birthDate, normalized.memories) ||
    new Set(normalized.recoveredIds).size !== normalized.recoveredIds.length ||
    normalized.recoveredIds.some(
      (id) => !normalized.memories.some((memory) => memory.id === id),
    ) ||
    new Set(normalized.abilities).size !== normalized.abilities.length ||
    normalized.ageYears < 0 || normalized.ageYears > 150 ||
    !Number.isInteger(normalized.ageYears) ||
    normalized.revision < 0 || !Number.isInteger(normalized.revision)
  ) invalidSave();
  if (normalized.saveFormat === 'legacy-v1') {
    if (
      normalized.adventurePlan !== null ||
      normalized.adventureState !== null ||
      normalized.friendlyState != null
    ) invalidSave();
    return { ...normalized, friendlyState: null };
  }
  if (normalized.saveFormat !== 'era-combat-v2') invalidSave();
  const { plan, state } = parseStoredAdventure(normalized.adventurePlan, normalized.adventureState);
  const friendlyState = normalized.friendlyState == null
    ? null
    : parseStoredFriendlyState(normalized.friendlyState, plan, state);
  const plannedMemoryIds = plan.levels.flatMap((level) => level.memoryIds);
  const savedMemoryIds = normalized.memories.map((memory) => memory.id);
  if (
    plannedMemoryIds.length !== savedMemoryIds.length ||
    plannedMemoryIds.some((id, index) => id !== savedMemoryIds[index]) ||
    normalized.versions.journey !== plan.version ||
    (plan.version === 'era-level-plan-v2' && normalized.versions.catalog !== plan.catalogVersion) ||
    plan.levels[0]?.startDate !== normalized.birthDate ||
    plan.levels.some((level, index) => {
      const lastMemoryId = level.memoryIds.at(-1);
      const lastMemory = normalized.memories.find((memory) => memory.id === lastMemoryId);
      const priorLevel = plan.levels[index - 1];
      const priorLastId = priorLevel?.memoryIds.at(-1);
      const priorLast = normalized.memories.find((memory) => memory.id === priorLastId);
      return !lastMemory ||
        lastMemory.ageYears !== level.targetAgeYears ||
        (index > 0 && level.startDate !== priorLast?.date);
    }) ||
    normalized.recoveredIds.length !== state.revealedMemoryIds.length ||
    normalized.recoveredIds.some((id, index) => id !== state.revealedMemoryIds[index]) ||
    normalized.ageYears !== state.ageYears ||
    normalized.appearanceStage !== state.appearanceStage ||
    normalized.completed !== (state.phase === 'complete') ||
    normalized.abilities.length !== state.abilities.length ||
    normalized.abilities.some((ability, index) => ability !== state.abilities[index]) ||
    (normalized.revision === 0) !== (state.actionReceipts.length === 0) ||
    (normalized.revision > 0 && state.actionReceipts.at(-1)?.appliedRevision !== normalized.revision)
  ) invalidSave();
  return { ...normalized, adventurePlan: plan, adventureState: state, friendlyState };
}

function effectiveFriendlyState(
  plan: AdventurePlan,
  adventureState: AdventureState,
  stored: FriendlyState | null | undefined,
): FriendlyState {
  return stored == null
    ? createInitialFriendlyState(plan)
    : parseStoredFriendlyState(stored, plan, adventureState);
}

function isFriendlyAction(action: GameplayActionRequest['action']): action is FriendlyAction {
  return action.type === 'interact-friendly' || action.type === 'attack-friendly';
}

function gameplayActionHash(request: GameplayActionRequest): string {
  return createHash('sha256').update(stableJson(request)).digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function invalidSave(): never {
  throw new AppError(503, 'SAVE_DATA_INVALID', 'Save unavailable');
}
