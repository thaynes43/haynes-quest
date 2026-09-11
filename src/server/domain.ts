import type {
  Ability,
  AppearanceStage,
  MemoryPreview,
  PreviewResponse,
  RuleVersions,
  SaveSummary,
  SaveView,
  SubjectOption,
} from '../shared/contracts.js';

export const FIXTURE_SUBJECT: SubjectOption = {
  id: 'demo-adventurer-v1',
  label: 'Demo Adventurer',
};

export const RULE_VERSIONS: RuleVersions = {
  journey: 'garden-path-v1',
  age: 'birth-date-whole-years-v1',
  progression: 'memory-abilities-v1',
  appearance: 'synthetic-traveler-v1',
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
  recoverMemory(ownerId: string, saveId: string, memoryId: string): Promise<SaveRecord>;
  finishSave(ownerId: string, saveId: string): Promise<SaveRecord>;
  maintainFixtureRecords(now: Date): Promise<FixtureMaintenanceResult>;
  close?(): Promise<void>;
}

export function abilitiesForAge(ageYears: number): Ability[] {
  return ageYears >= 4 ? ['move', 'interact', 'jump'] : ['move', 'interact'];
}

export function appearanceForAge(ageYears: number): AppearanceStage {
  return ageYears >= 4 ? 'child' : 'infant';
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

export function toSaveView(save: SaveRecord): SaveView {
  return {
    id: save.id,
    title: save.title,
    subject: save.subject,
    memories: save.memories.map(({ id, date, ageYears, label }) => ({
      id,
      date,
      ageYears,
      label,
      mediaUrl: `/api/saves/${encodeURIComponent(save.id)}/media/${encodeURIComponent(id)}`,
    })),
    recoveredIds: [...save.recoveredIds],
    ageYears: save.ageYears,
    abilities: [...save.abilities],
    appearance: {
      contractVersion: save.versions.appearance,
      subjectAppearanceId: 'synthetic-traveler-v1',
      stage: save.appearanceStage,
    },
    completed: save.completed,
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
    createdAt: save.createdAt.toISOString(),
    updatedAt: save.updatedAt.toISOString(),
  };
}
