import { randomUUID } from 'node:crypto';
import { and, desc, eq, gt, isNotNull, isNull, sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
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
  type StartFamilySaveCommand,
  validateSaveRecord,
} from '../domain.js';
import { AppError } from '../errors.js';
import { fixtureSessions, players, questSchema, saves, setupPreviews } from './schema.js';
import { migrateQuestDatabase } from './migrate.js';

type Database = NodePgDatabase<typeof questSchema>;
type PreviewRow = typeof setupPreviews.$inferSelect;
type SaveRow = typeof saves.$inferSelect;
const MAINTENANCE_BATCH_SIZE = 1_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class PostgresQuestStore implements QuestStore {
  readonly db: Database;

  /** Shared with family sign-in so one pool serves the whole process. */
  constructor(readonly pool: Pool) {
    this.db = drizzle(pool, { schema: questSchema });
  }

  static connect(databaseUrl: string): PostgresQuestStore {
    return new PostgresQuestStore(
      new Pool({
        connectionString: databaseUrl,
        max: 10,
        connectionTimeoutMillis: 5_000,
        idleTimeoutMillis: 30_000,
      }),
    );
  }

  async migrate(directory = 'migrations'): Promise<number> {
    return migrateQuestDatabase(this.pool, directory);
  }

  async ready(): Promise<boolean> {
    try {
      const result = await this.pool.query<{ ready: boolean }>(
        `select to_regclass('quest_saves') is not null and to_regclass('quest_fixture_sessions') is not null as ready`,
      );
      return result.rows[0]?.ready === true;
    } catch {
      return false;
    }
  }

  async getSession(sessionId: string, now: Date): Promise<PlayerRecord | null> {
    const [row] = await this.db
      .select({ id: players.id, label: players.label })
      .from(fixtureSessions)
      .innerJoin(players, eq(players.id, fixtureSessions.playerId))
      .where(and(eq(fixtureSessions.id, sessionId), gt(fixtureSessions.expiresAt, now)))
      .limit(1);
    return row ?? null;
  }

  async createFixtureSession(sessionId: string, expiresAt: Date): Promise<PlayerRecord> {
    return this.db.transaction(async (transaction) => {
      const player: PlayerRecord = { id: randomUUID(), label: 'Preview player' };
      await transaction.insert(players).values(player);
      await transaction.insert(fixtureSessions).values({ id: sessionId, playerId: player.id, expiresAt });
      return player;
    });
  }

  async putPreview(input: NewPreviewRecord): Promise<PreviewRecord> {
    if (!isValidFrozenManifest(input.birthDate, input.memories)) {
      throw new AppError(422, 'INVALID_MANIFEST', 'Invalid memory manifest');
    }
    const id = randomUUID();
    const [row] = await this.db
      .insert(setupPreviews)
      .values({
        id,
        ownerId: input.ownerId,
        birthDate: input.birthDate,
        subjects: input.subjects,
        chosenSubject: input.chosenSubject,
        memories: input.memories,
        selectedIds: input.selectedIds,
        coverage: input.coverage,
        expiresAt: input.expiresAt,
      })
      .returning();
    if (!row) throw new AppError(503, 'STORE_WRITE_FAILED', 'Save failed');
    return mapPreview(row);
  }

  async createSave(command: CreateSaveCommand): Promise<SaveRecord> {
    return this.db.transaction(async (transaction) => {
      const [preview] = await transaction
        .select()
        .from(setupPreviews)
        .where(and(eq(setupPreviews.id, command.previewId), eq(setupPreviews.ownerId, command.ownerId)))
        .for('update')
        .limit(1);
      if (!preview || preview.expiresAt <= new Date()) {
        throw new AppError(404, 'PREVIEW_NOT_FOUND', 'Preview not found');
      }

      const [existing] = await transaction
        .select()
        .from(saves)
        .where(and(eq(saves.previewId, command.previewId), eq(saves.ownerId, command.ownerId)))
        .limit(1);
      if (existing) {
        if (!sameSelection(existing.memories, command.selectedIds)) {
          throw new AppError(409, 'PREVIEW_ALREADY_USED', 'Preview already used');
        }
        return mapSave(existing);
      }

      if (!preview.chosenSubject) throw new AppError(422, 'SUBJECT_UNRESOLVED', 'Subject unresolved');
      if (!isValidFrozenManifest(preview.birthDate, preview.memories)) {
        throw new AppError(422, 'INVALID_MANIFEST', 'Invalid memory manifest');
      }
      const issued = new Set(preview.memories.map((memory) => memory.id));
      if (command.selectedIds.some((id) => !issued.has(id))) {
        throw new AppError(422, 'INVALID_SELECTION', 'Invalid selection');
      }
      const selected = new Set(command.selectedIds);
      const memories = preview.memories.filter((memory) => selected.has(memory.id));
      if (memories.length < 1 || memories.length > 24) {
        throw new AppError(422, 'INVALID_SELECTION', 'Invalid selection');
      }
      const { plan: adventurePlan, state: adventureState, versions } = createAdventureForSave(
        preview.birthDate,
        memories,
        command.planMode,
      );

      const [created] = await transaction
        .insert(saves)
        .values({
          id: randomUUID(),
          ownerId: command.ownerId,
          previewId: command.previewId,
          title: command.title ?? 'The first clearing',
          subject: preview.chosenSubject,
          birthDate: preview.birthDate,
          memories,
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
          versions,
        })
        .returning();
      if (!created) throw new AppError(503, 'STORE_WRITE_FAILED', 'Save failed');
      return mapSave(created);
    });
  }

  async listSaves(ownerId: string): Promise<SaveRecord[]> {
    const rows = await this.db
      .select()
      .from(saves)
      .where(and(eq(saves.ownerId, ownerId), isNull(saves.publicationId)))
      .orderBy(desc(saves.updatedAt));
    return rows.map(mapSave);
  }

  async getSave(ownerId: string, saveId: string): Promise<SaveRecord | null> {
    const [row] = await this.db
      .select()
      .from(saves)
      .where(and(eq(saves.id, saveId), eq(saves.ownerId, ownerId), isNull(saves.publicationId)))
      .limit(1);
    return row ? mapSave(row) : null;
  }

  async applyGameplayAction(
    ownerId: string,
    saveId: string,
    request: GameplayActionRequest,
    now: Date,
  ): Promise<SaveRecord> {
    return this.db.transaction(async (transaction) => {
      const [row] = await transaction
        .select()
        .from(saves)
        .where(and(eq(saves.id, saveId), eq(saves.ownerId, ownerId), isNull(saves.publicationId)))
        .for('update')
        .limit(1);
      if (!row) throw new AppError(404, 'SAVE_NOT_FOUND', 'Save not found');
      return this.writeAction(transaction, row, request, now);
    });
  }

  async startFamilySave(command: StartFamilySaveCommand): Promise<{ save: SaveRecord; created: boolean }> {
    const candidate = validateSaveRecord(command.save);
    if (candidate.childId !== command.childId || !candidate.publicationId) {
      throw new AppError(422, 'INVALID_SAVE', 'Invalid save');
    }
    return this.db.transaction(async (transaction) => {
      // The child row lock serialises "play" taps from several devices.
      const locked = await transaction.execute(
        sql`SELECT id FROM quest_children WHERE id = ${command.childId} FOR UPDATE`,
      );
      if (locked.rows.length === 0) throw new AppError(404, 'CHILD_NOT_FOUND', 'Child not found');
      if (!command.fresh) {
        const [current] = await transaction
          .select()
          .from(saves)
          .where(eq(saves.childId, command.childId))
          .orderBy(desc(saves.createdAt), desc(saves.id))
          .limit(1);
        if (current) return { save: mapSave(current), created: false };
      }
      const [created] = await transaction
        .insert(saves)
        .values({
          id: candidate.id,
          ownerId: candidate.ownerId,
          previewId: null,
          publicationId: candidate.publicationId,
          childId: candidate.childId,
          title: candidate.title,
          subject: candidate.subject,
          birthDate: candidate.birthDate,
          memories: candidate.memories,
          recoveredIds: candidate.recoveredIds,
          ageYears: candidate.ageYears,
          abilities: candidate.abilities,
          appearanceStage: candidate.appearanceStage,
          completed: candidate.completed,
          saveFormat: candidate.saveFormat,
          adventurePlan: candidate.adventurePlan,
          adventureState: candidate.adventureState,
          friendlyState: candidate.friendlyState ?? null,
          revision: candidate.revision,
          versions: candidate.versions,
          createdAt: candidate.createdAt,
          updatedAt: candidate.updatedAt,
        })
        .returning();
      if (!created) throw new AppError(503, 'STORE_WRITE_FAILED', 'Save failed');
      return { save: mapSave(created), created: true };
    });
  }

  async getHouseholdSave(saveId: string): Promise<SaveRecord | null> {
    if (!UUID.test(saveId)) return null;
    const [row] = await this.db
      .select()
      .from(saves)
      .where(and(eq(saves.id, saveId), isNotNull(saves.publicationId)))
      .limit(1);
    return row ? mapSave(row) : null;
  }

  async currentFamilySaves(): Promise<SaveRecord[]> {
    const rows = await this.db
      .selectDistinctOn([saves.childId])
      .from(saves)
      .where(isNotNull(saves.childId))
      .orderBy(saves.childId, desc(saves.createdAt), desc(saves.id));
    return rows.map(mapSave);
  }

  async applyHouseholdGameplayAction(
    saveId: string,
    request: GameplayActionRequest,
    now: Date,
  ): Promise<SaveRecord> {
    if (!UUID.test(saveId)) throw new AppError(404, 'SAVE_NOT_FOUND', 'Save not found');
    return this.db.transaction(async (transaction) => {
      const [row] = await transaction
        .select()
        .from(saves)
        .where(and(eq(saves.id, saveId), isNotNull(saves.publicationId)))
        .for('update')
        .limit(1);
      if (!row) throw new AppError(404, 'SAVE_NOT_FOUND', 'Save not found');
      return this.writeAction(transaction, row, request, now);
    });
  }

  private async writeAction(
    transaction: Parameters<Parameters<Database['transaction']>[0]>[0],
    row: SaveRow,
    request: GameplayActionRequest,
    now: Date,
  ): Promise<SaveRecord> {
    const current = mapSave(row);
    const result = applyGameplayActionToSave(current, request, now);
    if (result.replay) return result.save;
    const next = result.save;
    const [updated] = await transaction
      .update(saves)
      .set({
        recoveredIds: next.recoveredIds,
        ageYears: next.ageYears,
        abilities: next.abilities,
        appearanceStage: next.appearanceStage,
        completed: next.completed,
        adventureState: next.adventureState,
        friendlyState: next.friendlyState,
        revision: next.revision,
        updatedAt: next.updatedAt,
      })
      .where(and(eq(saves.id, row.id), eq(saves.ownerId, row.ownerId), eq(saves.revision, row.revision)))
      .returning();
    if (!updated) throw new AppError(409, 'SAVE_CONFLICT', 'Save changed');
    return mapSave(updated);
  }

  async maintainFixtureRecords(now: Date): Promise<FixtureMaintenanceResult> {
    const expiredSessions = await this.pool.query<{ id: string }>(
      `
        WITH candidates AS (
          SELECT id
          FROM quest_fixture_sessions
          WHERE expires_at <= $1
          ORDER BY expires_at, id
          LIMIT $2
          FOR UPDATE SKIP LOCKED
        )
        DELETE FROM quest_fixture_sessions AS fixture_session
        USING candidates
        WHERE fixture_session.id = candidates.id
        RETURNING fixture_session.id
      `,
      [now, MAINTENANCE_BATCH_SIZE],
    );
    const expiredPreviews = await this.pool.query<{ id: string }>(
      `
        WITH candidates AS (
          SELECT setup_preview.id
          FROM quest_setup_previews AS setup_preview
          WHERE setup_preview.expires_at <= $1
            AND NOT EXISTS (
              SELECT 1
              FROM quest_saves AS quest_save
              WHERE quest_save.preview_id = setup_preview.id
            )
          ORDER BY setup_preview.expires_at, setup_preview.id
          LIMIT $2
          FOR UPDATE OF setup_preview SKIP LOCKED
        )
        DELETE FROM quest_setup_previews AS setup_preview
        USING candidates
        WHERE setup_preview.id = candidates.id
        RETURNING setup_preview.id
      `,
      [now, MAINTENANCE_BATCH_SIZE],
    );
    return {
      sessionsDeleted: expiredSessions.rowCount ?? expiredSessions.rows.length,
      previewsDeleted: expiredPreviews.rowCount ?? expiredPreviews.rows.length,
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

function sameSelection(memories: { id: string }[], selectedIds: string[]): boolean {
  const selected = new Set(selectedIds);
  return memories.length === selected.size && memories.every((memory) => selected.has(memory.id));
}

function mapPreview(row: PreviewRow): PreviewRecord {
  return {
    previewId: row.id,
    ownerId: row.ownerId,
    birthDate: row.birthDate,
    subjects: row.subjects,
    chosenSubject: row.chosenSubject,
    candidates: row.memories.map(({ source: _source, ...memory }) => memory),
    memories: row.memories,
    selectedIds: row.selectedIds,
    coverage: row.coverage,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}

function mapSave(row: SaveRow): SaveRecord {
  return validateSaveRecord({
    id: row.id,
    ownerId: row.ownerId,
    previewId: row.previewId,
    publicationId: row.publicationId,
    childId: row.childId,
    title: row.title,
    subject: row.subject,
    birthDate: row.birthDate,
    memories: row.memories,
    recoveredIds: row.recoveredIds,
    ageYears: row.ageYears,
    abilities: row.abilities,
    appearanceStage: row.appearanceStage,
    completed: row.completed,
    saveFormat: row.saveFormat,
    adventurePlan: row.adventurePlan,
    adventureState: row.adventureState,
    friendlyState: row.friendlyState,
    revision: row.revision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    versions: row.versions,
  });
}
