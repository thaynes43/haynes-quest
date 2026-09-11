import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgresQuestStore } from '../../src/server/db/postgres-store.js';
import { FIXTURE_SUBJECT, wholeYearsAt, type NewPreviewRecord } from '../../src/server/domain.js';

const testDatabaseUrl = process.env.QUEST_TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)('Postgres quest store', () => {
  beforeAll(async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl, max: 1 });
    try {
      const migration = await readFile(resolve('migrations/0001_quest_server.sql'), 'utf8');
      await pool.query(migration);
    } finally {
      await pool.end();
    }
  });

  beforeEach(async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl, max: 1 });
    try {
      await pool.query(
        'TRUNCATE quest_saves, quest_setup_previews, quest_fixture_sessions, quest_players RESTART IDENTITY CASCADE',
      );
    } finally {
      await pool.end();
    }
  });

  it('Postgres persists a fixture session and save across store restart', async () => {
    const sessionId = '11111111-1111-4111-8111-111111111111';
    const firstStore = PostgresQuestStore.connect(testDatabaseUrl!);
    expect(await firstStore.ready()).toBe(true);
    const player = await firstStore.createFixtureSession(sessionId, new Date(Date.now() + 60_000));
    const preview = await firstStore.putPreview(previewInput(player.id));
    const created = await firstStore.createSave({
      ownerId: player.id,
      previewId: preview.previewId,
      selectedIds: preview.selectedIds,
    });
    await firstStore.close();

    const restartedStore = PostgresQuestStore.connect(testDatabaseUrl!);
    try {
      expect(await restartedStore.getSession(sessionId, new Date())).toEqual(player);
      const resumed = await restartedStore.getSave(player.id, created.id);
      expect(resumed).toMatchObject({ id: created.id, recoveredIds: [], revision: 0 });
    } finally {
      await restartedStore.close();
    }
  });

  it('Postgres serializes concurrent recovery and scopes every query by owner', async () => {
    const store = PostgresQuestStore.connect(testDatabaseUrl!);
    try {
      const owner = await store.createFixtureSession(
        '22222222-2222-4222-8222-222222222222',
        new Date(Date.now() + 60_000),
      );
      const stranger = await store.createFixtureSession(
        '33333333-3333-4333-8333-333333333333',
        new Date(Date.now() + 60_000),
      );
      const preview = await store.putPreview(previewInput(owner.id));
      const save = await store.createSave({
        ownerId: owner.id,
        previewId: preview.previewId,
        selectedIds: preview.selectedIds,
      });

      const [first, retried] = await Promise.all([
        store.recoverMemory(owner.id, save.id, save.memories[0]!.id),
        store.recoverMemory(owner.id, save.id, save.memories[0]!.id),
      ]);
      expect(first.revision).toBe(1);
      expect(retried.revision).toBe(1);
      expect(first.recoveredIds).toEqual([save.memories[0]!.id]);
      expect(await store.getSave(stranger.id, save.id)).toBeNull();
      await expect(store.recoverMemory(stranger.id, save.id, save.memories[1]!.id))
        .rejects.toMatchObject({ code: 'SAVE_NOT_FOUND' });
    } finally {
      await store.close();
    }
  });
});

function previewInput(ownerId: string): NewPreviewRecord {
  const birthDate = '2020-01-01';
  const memories = [
    { id: 'memory-one', date: '2020-07-01', label: 'Memory 1' },
    { id: 'memory-two', date: '2024-01-01', label: 'Memory 2' },
  ].map(({ id, date, label }) => ({
    id,
    date,
    label,
    ageYears: wholeYearsAt(birthDate, date),
    source: { kind: 'fixture' as const, key: id },
  }));
  return {
    ownerId,
    birthDate,
    subjects: [FIXTURE_SUBJECT],
    chosenSubject: FIXTURE_SUBJECT,
    memories,
    selectedIds: memories.map((memory) => memory.id),
    coverage: { fromDate: memories[0]!.date, toDate: memories.at(-1)!.date, incomplete: false, scanned: 2 },
    expiresAt: new Date(Date.now() + 60_000),
  };
}
