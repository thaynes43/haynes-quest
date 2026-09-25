import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgresQuestStore } from '../../../src/server/db/postgres-store.js';
import { PostgresFamilyStore } from '../../../src/server/family/postgres-store.js';
import { registerFamilyStoreContract, type StoreContractContext } from './store-contract.js';

const testDatabaseUrl = process.env.QUEST_TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)('Postgres family store', () => {
  let pool: Pool;
  let context: StoreContractContext;

  beforeAll(async () => {
    const questStore = PostgresQuestStore.connect(testDatabaseUrl!);
    try {
      await questStore.migrate();
    } finally {
      await questStore.close();
    }
    pool = new Pool({ connectionString: testDatabaseUrl, max: 4 });
  });

  afterAll(async () => {
    await pool?.end();
  });

  beforeEach(async () => {
    await pool.query(
      'TRUNCATE quest_journey_publications, quest_journey_drafts, quest_children, quest_saves, quest_setup_previews, quest_fixture_sessions, quest_players RESTART IDENTITY CASCADE',
    );
    const actors: [string, string] = [randomUUID(), randomUUID()];
    for (const [index, id] of actors.entries()) {
      await pool.query('INSERT INTO quest_players (id, label) VALUES ($1, $2)', [id, `Synthetic admin ${index + 1}`]);
    }
    context = { store: new PostgresFamilyStore(pool), actors };
  });

  registerFamilyStoreContract('Postgres', () => context);

  it('Postgres keeps the family tables behind their constraints', async () => {
    const child = await context.store.createChild({
      displayName: 'Test Child B',
      immichName: 'Test Child B',
      immichPersonId: randomUUID(),
      birthDate: '2020-02-29',
      templateId: 'rat-casino-world',
      templateVersion: 'v2',
    }, context.actors[0]);
    await expect(pool.query(
      `INSERT INTO quest_journey_publications
        (id, child_id, revision, request_id, draft_revision, birth_date, plan, memories, versions)
       VALUES ($1, $2, 1, $3, 0, '2020-02-29', '{"version":"editor-world-plan-v2"}', '[]', '{}')`,
      [randomUUID(), child.id, randomUUID()],
    )).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query(
      `UPDATE quest_children SET template_version = 'latest' WHERE id = $1`,
      [child.id],
    )).rejects.toMatchObject({ code: '23514' });
    // A child with publications cannot be deleted out from under a save.
    await context.store.saveDraft(child.id, null, {
      templateId: 'rat-casino-world',
      templateVersion: 'v2',
      seed: 'synthetic-seed-constraints',
      birthDate: '2020-02-29',
      rebasedOn: '2026-09-25',
      chapters: [],
      slots: [],
    }, null);
    await context.store.publish({
      childId: child.id,
      requestId: randomUUID(),
      expectedDraftRevision: 0,
      actorId: context.actors[0],
      build: () => ({
        plan: { version: 'family-world-plan-v1' } as never,
        memories: [],
        versions: { journey: 'family-world-plan-v1', age: 'a', progression: 'p', appearance: 'x' },
      }),
    });
    // Postgres 16 reports the RESTRICT refusal as 23503; some builds use 23001.
    const refusal = await pool.query('DELETE FROM quest_children WHERE id = $1', [child.id])
      .then(() => null, (error: { code?: string }) => error.code);
    expect(['23503', '23001']).toContain(refusal);
    expect(await context.store.getChild(child.id)).not.toBeNull();
  });

  it('Postgres reapplies migrations idempotently', async () => {
    const questStore = PostgresQuestStore.connect(testDatabaseUrl!);
    try {
      await questStore.migrate();
      await questStore.migrate();
    } finally {
      await questStore.close();
    }
    const tables = await pool.query<{ name: string }>(
      `SELECT to_regclass('quest_children')::text AS name
       UNION ALL SELECT to_regclass('quest_journey_drafts')::text
       UNION ALL SELECT to_regclass('quest_journey_publications')::text`,
    );
    expect(tables.rows.map((row) => row.name)).toEqual([
      'quest_children',
      'quest_journey_drafts',
      'quest_journey_publications',
    ]);
  });
});
