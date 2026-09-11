import { randomUUID } from 'node:crypto';
import {
  abilitiesForAge,
  appearanceForAge,
  isValidFrozenManifest,
  RULE_VERSIONS,
  type CreateSaveCommand,
  type FixtureMaintenanceResult,
  type NewPreviewRecord,
  type PlayerRecord,
  type PreviewRecord,
  type QuestStore,
  type SaveRecord,
} from '../domain.js';
import { AppError } from '../errors.js';

export class InMemoryQuestStore implements QuestStore {
  private readonly sessions = new Map<string, { player: PlayerRecord; expiresAt: Date }>();
  private readonly previews = new Map<string, PreviewRecord>();
  private readonly saves = new Map<string, SaveRecord>();
  private locked: Promise<void> = Promise.resolve();

  async ready(): Promise<boolean> {
    return true;
  }

  async getSession(sessionId: string, now: Date): Promise<PlayerRecord | null> {
    const session = this.sessions.get(sessionId);
    return session && session.expiresAt > now ? { ...session.player } : null;
  }

  async createFixtureSession(sessionId: string, expiresAt: Date): Promise<PlayerRecord> {
    const player = { id: randomUUID(), label: 'Preview player' };
    this.sessions.set(sessionId, { player, expiresAt });
    return { ...player };
  }

  async putPreview(input: NewPreviewRecord): Promise<PreviewRecord> {
    if (!isValidFrozenManifest(input.birthDate, input.memories)) {
      throw new AppError(422, 'INVALID_MANIFEST', 'Invalid memory manifest');
    }
    const now = new Date();
    const preview: PreviewRecord = {
      ...structuredClone(input),
      previewId: randomUUID(),
      candidates: input.memories.map(({ source: _source, ...memory }) => memory),
      createdAt: now,
      expiresAt: new Date(input.expiresAt),
    };
    this.previews.set(preview.previewId, preview);
    return clonePreview(preview);
  }

  async createSave(command: CreateSaveCommand): Promise<SaveRecord> {
    return this.exclusive(() => {
      const preview = this.previews.get(command.previewId);
      if (!preview || preview.ownerId !== command.ownerId || preview.expiresAt <= new Date()) {
        throw new AppError(404, 'PREVIEW_NOT_FOUND', 'Preview not found');
      }
      const existing = [...this.saves.values()].find(
        (save) => save.ownerId === command.ownerId && save.previewId === command.previewId,
      );
      if (existing) {
        if (!sameSelection(existing.memories, command.selectedIds)) {
          throw new AppError(409, 'PREVIEW_ALREADY_USED', 'Preview already used');
        }
        return cloneSave(existing);
      }
      if (!preview.chosenSubject) throw new AppError(422, 'SUBJECT_UNRESOLVED', 'Subject unresolved');
      if (!isValidFrozenManifest(preview.birthDate, preview.memories)) {
        throw new AppError(422, 'INVALID_MANIFEST', 'Invalid memory manifest');
      }
      const issued = new Set(preview.memories.map((memory) => memory.id));
      if (command.selectedIds.some((id) => !issued.has(id))) {
        throw new AppError(422, 'INVALID_SELECTION', 'Invalid selection');
      }
      const selectedIds = new Set(command.selectedIds);
      const memories = preview.memories.filter((memory) => selectedIds.has(memory.id));
      if (memories.length < 1 || memories.length > 24) {
        throw new AppError(422, 'INVALID_SELECTION', 'Invalid selection');
      }
      const now = new Date();
      const save: SaveRecord = {
        id: randomUUID(),
        ownerId: command.ownerId,
        previewId: command.previewId,
        title: command.title ?? 'The first clearing',
        subject: structuredClone(preview.chosenSubject),
        birthDate: preview.birthDate,
        memories: structuredClone(memories),
        recoveredIds: [],
        ageYears: 0,
        abilities: abilitiesForAge(0),
        appearanceStage: appearanceForAge(0),
        completed: false,
        revision: 0,
        createdAt: now,
        updatedAt: now,
        versions: RULE_VERSIONS,
      };
      this.saves.set(save.id, save);
      return cloneSave(save);
    });
  }

  async listSaves(ownerId: string): Promise<SaveRecord[]> {
    return [...this.saves.values()]
      .filter((save) => save.ownerId === ownerId)
      .sort((left, right) => right.updatedAt.valueOf() - left.updatedAt.valueOf())
      .map(cloneSave);
  }

  async getSave(ownerId: string, saveId: string): Promise<SaveRecord | null> {
    const save = this.saves.get(saveId);
    return save?.ownerId === ownerId ? cloneSave(save) : null;
  }

  async recoverMemory(ownerId: string, saveId: string, memoryId: string): Promise<SaveRecord> {
    return this.exclusive(() => {
      const save = this.saves.get(saveId);
      if (!save || save.ownerId !== ownerId) throw new AppError(404, 'SAVE_NOT_FOUND', 'Save not found');
      if (save.recoveredIds.includes(memoryId)) return cloneSave(save);
      const index = save.memories.findIndex((memory) => memory.id === memoryId);
      if (index < 0) throw new AppError(404, 'MEMORY_NOT_FOUND', 'Memory not found');
      if (index !== save.recoveredIds.length) {
        throw new AppError(409, 'MEMORY_OUT_OF_ORDER', 'Memory is out of order');
      }
      const ageYears = Math.max(save.ageYears, save.memories[index]!.ageYears);
      save.recoveredIds.push(memoryId);
      save.ageYears = ageYears;
      save.abilities = abilitiesForAge(ageYears);
      save.appearanceStage = appearanceForAge(ageYears);
      save.revision += 1;
      save.updatedAt = new Date();
      return cloneSave(save);
    });
  }

  async finishSave(ownerId: string, saveId: string): Promise<SaveRecord> {
    return this.exclusive(() => {
      const save = this.saves.get(saveId);
      if (!save || save.ownerId !== ownerId) throw new AppError(404, 'SAVE_NOT_FOUND', 'Save not found');
      if (save.completed) return cloneSave(save);
      if (save.recoveredIds.length !== save.memories.length) {
        throw new AppError(409, 'JOURNEY_INCOMPLETE', 'Journey incomplete');
      }
      save.completed = true;
      save.revision += 1;
      save.updatedAt = new Date();
      return cloneSave(save);
    });
  }

  async maintainFixtureRecords(now: Date): Promise<FixtureMaintenanceResult> {
    return this.exclusive(() => {
      let sessionsDeleted = 0;
      for (const [sessionId, session] of this.sessions) {
        if (sessionsDeleted >= 1_000) break;
        if (session.expiresAt <= now) {
          this.sessions.delete(sessionId);
          sessionsDeleted += 1;
        }
      }

      const referencedPreviews = new Set([...this.saves.values()].map((save) => save.previewId));
      let previewsDeleted = 0;
      for (const [previewId, preview] of this.previews) {
        if (previewsDeleted >= 1_000) break;
        if (preview.expiresAt <= now && !referencedPreviews.has(previewId)) {
          this.previews.delete(previewId);
          previewsDeleted += 1;
        }
      }
      return { sessionsDeleted, previewsDeleted };
    });
  }

  private async exclusive<T>(callback: () => T | Promise<T>): Promise<T> {
    const previous = this.locked;
    let release!: () => void;
    this.locked = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await callback();
    } finally {
      release();
    }
  }
}

function sameSelection(memories: { id: string }[], selectedIds: string[]): boolean {
  const selected = new Set(selectedIds);
  return memories.length === selected.size && memories.every((memory) => selected.has(memory.id));
}

function cloneSave(save: SaveRecord): SaveRecord {
  return { ...structuredClone(save), createdAt: new Date(save.createdAt), updatedAt: new Date(save.updatedAt) };
}

function clonePreview(preview: PreviewRecord): PreviewRecord {
  return {
    ...structuredClone(preview),
    createdAt: new Date(preview.createdAt),
    expiresAt: new Date(preview.expiresAt),
  };
}
