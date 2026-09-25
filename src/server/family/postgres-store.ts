import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { AppError } from '../errors.js';
import { children, familySchema, journeyDrafts, journeyPublications } from './schema.js';
import type {
  ChildProfile,
  ChildRecord,
  DraftContent,
  DraftRecord,
  FamilyStore,
  PublicationRecord,
  PublishCommand,
} from './store.js';

type Database = NodePgDatabase<typeof familySchema>;
type ChildRow = typeof children.$inferSelect;
type DraftRow = typeof journeyDrafts.$inferSelect;
type PublicationRow = typeof journeyPublications.$inferSelect;

/**
 * Postgres family store. It shares the quest database and its migrations
 * (`migrations/0005_family_journeys.sql`); construct it on the same pool as
 * the quest store or with {@link PostgresFamilyStore.connect}.
 */
export class PostgresFamilyStore implements FamilyStore {
  readonly db: Database;

  constructor(private readonly pool: Pool, private readonly ownsPool = false) {
    this.db = drizzle(pool, { schema: familySchema });
  }

  static connect(databaseUrl: string): PostgresFamilyStore {
    return new PostgresFamilyStore(
      new Pool({ connectionString: databaseUrl, max: 5, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 30_000 }),
      true,
    );
  }

  async createChild(profile: ChildProfile, actorId: string | null): Promise<ChildRecord> {
    try {
      const [row] = await this.db
        .insert(children)
        .values({ id: randomUUID(), ...profile, revision: 0, createdBy: actorId, updatedBy: actorId })
        .returning();
      if (!row) throw new AppError(503, 'STORE_WRITE_FAILED', 'Save failed');
      return mapChild(row);
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError(409, 'CHILD_EXISTS', 'Child already configured');
      throw error;
    }
  }

  async getChild(childId: string): Promise<ChildRecord | null> {
    const [row] = await this.db.select().from(children).where(eq(children.id, childId)).limit(1);
    return row ? mapChild(row) : null;
  }

  async listChildren(): Promise<ChildRecord[]> {
    const rows = await this.db.select().from(children).orderBy(asc(children.createdAt), asc(children.id));
    return rows.map(mapChild);
  }

  async updateChild(
    childId: string,
    expectedRevision: number,
    patch: Partial<ChildProfile>,
    actorId: string | null,
  ): Promise<ChildRecord> {
    try {
      const [row] = await this.db
        .update(children)
        .set({
          ...definedOnly(patch),
          revision: expectedRevision + 1,
          updatedBy: actorId,
          updatedAt: new Date(),
        })
        .where(and(eq(children.id, childId), eq(children.revision, expectedRevision)))
        .returning();
      if (row) return mapChild(row);
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError(409, 'CHILD_EXISTS', 'Child already configured');
      throw error;
    }
    const exists = await this.getChild(childId);
    if (!exists) throw new AppError(404, 'CHILD_NOT_FOUND', 'Child not found');
    throw new AppError(409, 'CHILD_CONFLICT', 'Child changed');
  }

  async getDraft(childId: string): Promise<DraftRecord | null> {
    const [row] = await this.db.select().from(journeyDrafts).where(eq(journeyDrafts.childId, childId)).limit(1);
    return row ? mapDraft(row) : null;
  }

  async saveDraft(
    childId: string,
    expectedRevision: number | null,
    content: DraftContent,
    actorId: string | null,
  ): Promise<DraftRecord> {
    const values = {
      templateId: content.templateId,
      templateVersion: content.templateVersion,
      seed: content.seed,
      birthDate: content.birthDate,
      rebasedOn: content.rebasedOn,
      chapters: structuredClone([...content.chapters]),
      slots: structuredClone([...content.slots]),
      updatedBy: actorId,
    };
    if (expectedRevision === null) {
      try {
        const [row] = await this.db
          .insert(journeyDrafts)
          .values({ id: randomUUID(), childId, ...values, revision: 0 })
          .returning();
        if (!row) throw new AppError(503, 'STORE_WRITE_FAILED', 'Save failed');
        return mapDraft(row);
      } catch (error) {
        if (isUniqueViolation(error)) throw new AppError(409, 'DRAFT_CONFLICT', 'Draft changed');
        if (isForeignKeyViolation(error) && !(await this.getChild(childId))) {
          throw new AppError(404, 'CHILD_NOT_FOUND', 'Child not found');
        }
        throw error;
      }
    }
    const [row] = await this.db
      .update(journeyDrafts)
      .set({ ...values, revision: expectedRevision + 1, updatedAt: new Date() })
      .where(and(eq(journeyDrafts.childId, childId), eq(journeyDrafts.revision, expectedRevision)))
      .returning();
    if (row) return mapDraft(row);
    if (!(await this.getChild(childId))) throw new AppError(404, 'CHILD_NOT_FOUND', 'Child not found');
    throw new AppError(409, 'DRAFT_CONFLICT', 'Draft changed');
  }

  async publish(command: PublishCommand): Promise<PublicationRecord> {
    return this.db.transaction(async (transaction) => {
      // The child row lock serialises publishes, so revisions and request ids
      // never race.
      const [child] = await transaction
        .select()
        .from(children)
        .where(eq(children.id, command.childId))
        .for('update')
        .limit(1);
      if (!child) throw new AppError(404, 'CHILD_NOT_FOUND', 'Child not found');
      const [replay] = await transaction
        .select()
        .from(journeyPublications)
        .where(and(
          eq(journeyPublications.childId, command.childId),
          eq(journeyPublications.requestId, command.requestId),
        ))
        .limit(1);
      if (replay) {
        if (replay.draftRevision !== command.expectedDraftRevision) {
          throw new AppError(409, 'REQUEST_ID_REUSED', 'Request already used');
        }
        return mapPublication(replay);
      }
      const [draft] = await transaction
        .select()
        .from(journeyDrafts)
        .where(eq(journeyDrafts.childId, command.childId))
        .for('update')
        .limit(1);
      if (!draft) throw new AppError(404, 'DRAFT_NOT_FOUND', 'Draft not found');
      if (draft.revision !== command.expectedDraftRevision) {
        throw new AppError(409, 'DRAFT_CONFLICT', 'Draft changed');
      }
      const built = command.build(mapChild(child), mapDraft(draft));
      const [latest] = await transaction
        .select({ revision: sql<number>`coalesce(max(${journeyPublications.revision}), 0)::int` })
        .from(journeyPublications)
        .where(eq(journeyPublications.childId, command.childId));
      const [row] = await transaction
        .insert(journeyPublications)
        .values({
          id: randomUUID(),
          childId: command.childId,
          revision: (latest?.revision ?? 0) + 1,
          requestId: command.requestId,
          draftRevision: draft.revision,
          birthDate: draft.birthDate,
          plan: structuredClone(built.plan),
          memories: structuredClone([...built.memories]),
          versions: structuredClone(built.versions),
          publishedBy: command.actorId,
        })
        .returning();
      if (!row) throw new AppError(503, 'STORE_WRITE_FAILED', 'Save failed');
      return mapPublication(row);
    });
  }

  async getPublication(publicationId: string): Promise<PublicationRecord | null> {
    const [row] = await this.db
      .select()
      .from(journeyPublications)
      .where(eq(journeyPublications.id, publicationId))
      .limit(1);
    return row ? mapPublication(row) : null;
  }

  async latestPublication(childId: string): Promise<PublicationRecord | null> {
    const [row] = await this.db
      .select()
      .from(journeyPublications)
      .where(eq(journeyPublications.childId, childId))
      .orderBy(desc(journeyPublications.revision))
      .limit(1);
    return row ? mapPublication(row) : null;
  }

  async listLatestPublications(): Promise<PublicationRecord[]> {
    const rows = await this.db
      .selectDistinctOn([journeyPublications.childId], {
        publication: journeyPublications,
        childCreatedAt: children.createdAt,
      })
      .from(journeyPublications)
      .innerJoin(children, eq(children.id, journeyPublications.childId))
      .orderBy(journeyPublications.childId, desc(journeyPublications.revision));
    return rows
      .sort((left, right) =>
        left.childCreatedAt.valueOf() - right.childCreatedAt.valueOf() ||
        left.publication.childId.localeCompare(right.publication.childId))
      .map((row) => mapPublication(row.publication));
  }

  async close(): Promise<void> {
    if (this.ownsPool) await this.pool.end();
  }
}

function mapChild(row: ChildRow): ChildRecord {
  return {
    id: row.id,
    displayName: row.displayName,
    immichName: row.immichName,
    immichPersonId: row.immichPersonId,
    birthDate: row.birthDate,
    templateId: row.templateId,
    templateVersion: row.templateVersion,
    revision: row.revision,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapDraft(row: DraftRow): DraftRecord {
  return {
    id: row.id,
    childId: row.childId,
    templateId: row.templateId,
    templateVersion: row.templateVersion,
    seed: row.seed,
    birthDate: row.birthDate,
    rebasedOn: row.rebasedOn,
    chapters: row.chapters,
    slots: row.slots,
    revision: row.revision,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapPublication(row: PublicationRow): PublicationRecord {
  return {
    id: row.id,
    childId: row.childId,
    revision: row.revision,
    requestId: row.requestId,
    draftRevision: row.draftRevision,
    birthDate: row.birthDate,
    plan: row.plan,
    memories: row.memories,
    versions: row.versions,
    publishedBy: row.publishedBy,
    publishedAt: row.publishedAt,
  };
}

function definedOnly<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

function pgCode(error: unknown): string | undefined {
  const candidate = error as { code?: unknown; cause?: { code?: unknown } };
  const code = candidate?.code ?? candidate?.cause?.code;
  return typeof code === 'string' ? code : undefined;
}

function isUniqueViolation(error: unknown): boolean {
  return pgCode(error) === '23505';
}

function isForeignKeyViolation(error: unknown): boolean {
  return pgCode(error) === '23503';
}
