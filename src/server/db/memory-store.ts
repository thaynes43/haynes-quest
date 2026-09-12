import { randomUUID } from 'node:crypto';
import type { GameplayActionRequest } from '../../shared/contracts.js';
import { createInitialFriendlyState } from '../../shared/friendly.js';
import {
  applyGameplayActionToSave,
  appearanceForAge,
  createAdventureForSave,
  isValidFrozenManifest,
  type CreateSaveCommand,
  type FixtureMaintenanceResult,
  type NewPreviewRecord,
  type PlayerRecord,
  type PreviewRecord,
  type QuestStore,
  type SaveRecord,
  validateSaveRecord,
} from '../domain.js';
import { AppError } from '../errors.js';

interface EphemeralStoreLimits {
  maxSessions: number;
  maxPreviews: number;
  maxSaves: number;
}

const DEFAULT_EPHEMERAL_LIMITS: EphemeralStoreLimits = {
  maxSessions: 1_000,
  maxPreviews: 2_000,
  maxSaves: 1_000,
};

const MAX_EPHEMERAL_RUNS_PER_OWNER = 2;

export class InMemoryQuestStore implements QuestStore {
  private readonly sessions = new Map<string, { player: PlayerRecord; expiresAt: Date }>();
  private readonly previews = new Map<string, PreviewRecord>();
  private readonly saves = new Map<string, SaveRecord>();
  private readonly sessionRecency = new Map<string, number>();
  private readonly saveRecency = new Map<string, number>();
  private recencySequence = 0;
  private locked: Promise<void> = Promise.resolve();

  constructor(
    initialSaves: SaveRecord[] = [],
    initialSessions: Array<{ sessionId: string; player: PlayerRecord; expiresAt: Date }> = [],
    private readonly ephemeralLimits: EphemeralStoreLimits | null = null,
  ) {
    if (ephemeralLimits) validateEphemeralLimits(ephemeralLimits);
    for (const save of initialSaves) this.saves.set(save.id, cloneSave(validateSaveRecord(save)));
    for (const session of initialSessions) {
      this.sessions.set(session.sessionId, {
        player: { ...session.player },
        expiresAt: new Date(session.expiresAt),
      });
    }
  }

  static ephemeral(limits: Partial<EphemeralStoreLimits> = {}): InMemoryQuestStore {
    return new InMemoryQuestStore([], [], { ...DEFAULT_EPHEMERAL_LIMITS, ...limits });
  }

  async ready(): Promise<boolean> {
    return true;
  }

  async getSession(sessionId: string, now: Date): Promise<PlayerRecord | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.expiresAt <= now) return null;
    if (this.ephemeralLimits) this.touchSession(sessionId);
    return { ...session.player };
  }

  async createFixtureSession(sessionId: string, expiresAt: Date): Promise<PlayerRecord> {
    return this.exclusive(() => {
      this.pruneExpiredEphemeralRecords(new Date());
      const prior = this.sessions.get(sessionId);
      if (this.ephemeralLimits && !prior) this.makeEphemeralSessionSpace();
      const player = { id: randomUUID(), label: 'Preview player' };
      this.sessions.set(sessionId, { player, expiresAt });
      if (this.ephemeralLimits) {
        this.touchSession(sessionId);
        if (prior && prior.player.id !== player.id) this.pruneOrphanedEphemeralRecords();
      }
      return { ...player };
    });
  }

  async putPreview(input: NewPreviewRecord): Promise<PreviewRecord> {
    if (!isValidFrozenManifest(input.birthDate, input.memories)) {
      throw new AppError(422, 'INVALID_MANIFEST', 'Invalid memory manifest');
    }
    return this.exclusive(() => {
      this.pruneExpiredEphemeralRecords(new Date());
      if (this.ephemeralLimits) this.makeEphemeralPreviewSpace();
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
    });
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
      const { plan: adventurePlan, state: adventureState, versions } = createAdventureForSave(
        preview.birthDate,
        memories,
        command.planMode,
      );
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
        abilities: adventureState.abilities,
        appearanceStage: appearanceForAge(0),
        completed: false,
        saveFormat: 'era-combat-v2',
        adventurePlan,
        adventureState,
        friendlyState: createInitialFriendlyState(adventurePlan),
        revision: 0,
        createdAt: now,
        updatedAt: now,
        versions,
      };
      if (this.ephemeralLimits) this.makeEphemeralSaveSpace(command.ownerId);
      this.saves.set(save.id, save);
      if (this.ephemeralLimits) this.touchSave(save.id);
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
    if (!save || save.ownerId !== ownerId) return null;
    if (this.ephemeralLimits) this.touchSave(saveId);
    return cloneSave(save);
  }

  async applyGameplayAction(
    ownerId: string,
    saveId: string,
    request: GameplayActionRequest,
    now: Date,
  ): Promise<SaveRecord> {
    return this.exclusive(() => {
      const save = this.saves.get(saveId);
      if (!save || save.ownerId !== ownerId) throw new AppError(404, 'SAVE_NOT_FOUND', 'Save not found');
      if (this.ephemeralLimits) this.touchSave(saveId);
      const result = applyGameplayActionToSave(validateSaveRecord(save), request, now);
      if (!result.replay) this.saves.set(saveId, result.save);
      return cloneSave(result.save);
    });
  }

  async maintainFixtureRecords(now: Date): Promise<FixtureMaintenanceResult> {
    return this.exclusive(() => {
      let sessionsDeleted = 0;
      for (const [sessionId, session] of this.sessions) {
        if (sessionsDeleted >= 1_000) break;
        if (session.expiresAt <= now) {
          this.sessions.delete(sessionId);
          this.sessionRecency.delete(sessionId);
          sessionsDeleted += 1;
        }
      }

      if (this.ephemeralLimits) this.pruneOrphanedEphemeralRecords();

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

  private pruneExpiredEphemeralRecords(now: Date): void {
    if (!this.ephemeralLimits) return;
    for (const [sessionId, session] of this.sessions) {
      if (session.expiresAt <= now) {
        this.sessions.delete(sessionId);
        this.sessionRecency.delete(sessionId);
      }
    }
    this.pruneOrphanedEphemeralRecords();
  }

  private pruneOrphanedEphemeralRecords(): void {
    const activeOwnerIds = new Set([...this.sessions.values()].map(({ player }) => player.id));
    for (const [saveId, save] of this.saves) {
      if (!activeOwnerIds.has(save.ownerId)) this.deleteSaveAndPreview(saveId);
    }
    for (const [previewId, preview] of this.previews) {
      if (!activeOwnerIds.has(preview.ownerId)) this.previews.delete(previewId);
    }
  }

  private makeEphemeralSessionSpace(): void {
    const limit = this.ephemeralLimits!.maxSessions;
    while (this.sessions.size >= limit) {
      const sessionId = leastRecentlyUsedId(this.sessions.keys(), this.sessionRecency);
      if (!sessionId) throw new AppError(503, 'STORE_CAPACITY', 'Playtest is busy');
      this.sessions.delete(sessionId);
      this.sessionRecency.delete(sessionId);
      this.pruneOrphanedEphemeralRecords();
    }
  }

  private makeEphemeralPreviewSpace(): void {
    const limit = this.ephemeralLimits!.maxPreviews;
    while (this.previews.size >= limit) {
      const referenced = new Set([...this.saves.values()].map((save) => save.previewId));
      let previewId: string | null = null;
      for (const candidate of this.previews.keys()) {
        if (!referenced.has(candidate)) {
          previewId = candidate;
          break;
        }
      }
      if (!previewId) throw new AppError(503, 'STORE_CAPACITY', 'Playtest is busy');
      this.previews.delete(previewId);
    }
  }

  private makeEphemeralSaveSpace(ownerId: string): void {
    while ([...this.saves.values()].filter((save) => save.ownerId === ownerId).length
      >= MAX_EPHEMERAL_RUNS_PER_OWNER) {
      const oldest = [...this.saves].find(([, save]) => save.ownerId === ownerId)?.[0];
      if (!oldest) break;
      this.deleteSaveAndPreview(oldest);
    }
    const limit = this.ephemeralLimits!.maxSaves;
    while (this.saves.size >= limit) {
      const saveId = leastRecentlyUsedId(this.saves.keys(), this.saveRecency);
      if (!saveId) throw new AppError(503, 'STORE_CAPACITY', 'Playtest is busy');
      this.deleteSaveAndPreview(saveId);
    }
  }

  private deleteSaveAndPreview(saveId: string): void {
    const save = this.saves.get(saveId);
    if (!save) return;
    this.saves.delete(saveId);
    this.saveRecency.delete(saveId);
    if (![...this.saves.values()].some((candidate) => candidate.previewId === save.previewId)) {
      this.previews.delete(save.previewId);
    }
  }

  private touchSession(sessionId: string): void {
    this.sessionRecency.set(sessionId, this.nextRecency());
  }

  private touchSave(saveId: string): void {
    this.saveRecency.set(saveId, this.nextRecency());
  }

  private nextRecency(): number {
    this.recencySequence += 1;
    return this.recencySequence;
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

function validateEphemeralLimits(limits: EphemeralStoreLimits): void {
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new RangeError(`${name} must be a positive integer`);
    }
  }
  if (limits.maxPreviews <= limits.maxSaves) {
    throw new RangeError('maxPreviews must be greater than maxSaves');
  }
}

function leastRecentlyUsedId(
  ids: IterableIterator<string>,
  recency: ReadonlyMap<string, number>,
): string | null {
  let oldestId: string | null = null;
  let oldestRecency = Number.POSITIVE_INFINITY;
  for (const id of ids) {
    const accessedAt = recency.get(id) ?? Number.NEGATIVE_INFINITY;
    if (accessedAt < oldestRecency) {
      oldestId = id;
      oldestRecency = accessedAt;
    }
  }
  return oldestId;
}

function sameSelection(memories: { id: string }[], selectedIds: string[]): boolean {
  const selected = new Set(selectedIds);
  return memories.length === selected.size && memories.every((memory) => selected.has(memory.id));
}

function cloneSave(save: SaveRecord): SaveRecord {
  return validateSaveRecord({
    ...structuredClone(save),
    createdAt: new Date(save.createdAt),
    updatedAt: new Date(save.updatedAt),
  });
}

function clonePreview(preview: PreviewRecord): PreviewRecord {
  return {
    ...structuredClone(preview),
    createdAt: new Date(preview.createdAt),
    expiresAt: new Date(preview.expiresAt),
  };
}
