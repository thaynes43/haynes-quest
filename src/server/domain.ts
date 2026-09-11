import { createHash } from 'node:crypto';
import {
  AdventureRuleError,
  MAX_ACTION_RECEIPTS,
  abilitiesForAge,
  appearanceForAge,
  memoryIsReleased,
  reduceAdventureAction,
  toAdventureView,
  type AdventurePlan,
  type AdventureState,
} from '../shared/adventure.js';
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
import { parseStoredAdventure } from './adventure-schema.js';

export const FIXTURE_SUBJECT: SubjectOption = {
  id: 'demo-adventurer-v1',
  label: 'Demo Adventurer',
};

export const RULE_VERSIONS: RuleVersions = {
  journey: 'era-level-plan-v1',
  age: 'birth-date-whole-years-v1',
  progression: 'boss-memory-consume-v2',
  appearance: 'synthetic-traveler-v1',
  catalog: 'generic-era-catalog-v1',
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
  try {
    adventureState = reduceAdventureAction(
      save.adventurePlan,
      save.adventureState,
      request.action,
      now.valueOf(),
    );
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
  return {
    replay: false,
    save: {
      ...save,
      recoveredIds: [...adventureState.revealedMemoryIds],
      ageYears: adventureState.ageYears,
      abilities: [...adventureState.abilities],
      appearanceStage: adventureState.appearanceStage,
      completed: adventureState.phase === 'complete',
      adventureState,
      revision,
      updatedAt: now,
    },
  };
}

export function toSaveView(save: SaveRecord, now = new Date()): SaveView {
  const legacy = save.saveFormat === 'legacy-v1';
  const adventure = !legacy && save.adventurePlan && save.adventureState
    ? toAdventureView(save.adventurePlan, save.adventureState, now.valueOf())
    : null;
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
  if (save.saveFormat === 'legacy-v1') {
    if (save.adventurePlan !== null || save.adventureState !== null) invalidSave();
    return save;
  }
  if (save.saveFormat !== 'era-combat-v2') invalidSave();
  const { plan, state } = parseStoredAdventure(save.adventurePlan, save.adventureState);
  const plannedMemoryIds = plan.levels.flatMap((level) => level.memoryIds);
  const savedMemoryIds = save.memories.map((memory) => memory.id);
  if (
    plannedMemoryIds.length !== savedMemoryIds.length ||
    plannedMemoryIds.some((id, index) => id !== savedMemoryIds[index]) ||
    plan.levels[0]?.startDate !== save.birthDate ||
    plan.levels.some((level, index) => {
      const lastMemoryId = level.memoryIds.at(-1);
      const lastMemory = save.memories.find((memory) => memory.id === lastMemoryId);
      const priorLevel = plan.levels[index - 1];
      const priorLastId = priorLevel?.memoryIds.at(-1);
      const priorLast = save.memories.find((memory) => memory.id === priorLastId);
      return !lastMemory ||
        lastMemory.ageYears !== level.targetAgeYears ||
        (index > 0 && level.startDate !== priorLast?.date);
    }) ||
    save.recoveredIds.length !== state.revealedMemoryIds.length ||
    save.recoveredIds.some((id, index) => id !== state.revealedMemoryIds[index]) ||
    save.ageYears !== state.ageYears ||
    save.appearanceStage !== state.appearanceStage ||
    save.completed !== (state.phase === 'complete') ||
    save.abilities.length !== state.abilities.length ||
    save.abilities.some((ability, index) => ability !== state.abilities[index]) ||
    state.actionReceipts.some((receipt) => receipt.appliedRevision > save.revision)
  ) invalidSave();
  return { ...save, adventurePlan: plan, adventureState: state };
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
