import { describe, expect, it } from 'vitest';
import { InMemoryQuestStore } from '../../src/server/db/memory-store.js';
import { FIXTURE_SUBJECT, wholeYearsAt, type NewPreviewRecord } from '../../src/server/domain.js';

describe('fixture record maintenance', () => {
  it('removes only expired sessions and unused previews', async () => {
    const store = new InMemoryQuestStore();
    const now = new Date('2030-01-01T00:00:00.000Z');
    const expiredPlayer = await store.createFixtureSession(
      '11111111-1111-4111-8111-111111111111',
      new Date('2029-12-31T23:59:59.000Z'),
    );
    const activePlayer = await store.createFixtureSession(
      '22222222-2222-4222-8222-222222222222',
      new Date('2030-01-01T01:00:00.000Z'),
    );
    const referenced = await store.putPreview(previewInput(expiredPlayer.id, new Date('2029-12-31T23:59:59.000Z')));
    const unused = await store.putPreview(previewInput(expiredPlayer.id, new Date('2029-12-31T23:59:59.000Z')));
    const active = await store.putPreview(previewInput(activePlayer.id, new Date('2030-01-01T01:00:00.000Z')));
    const save = await store.createSave({
      ownerId: expiredPlayer.id,
      previewId: referenced.previewId,
      selectedIds: referenced.selectedIds,
    });

    const result = await store.maintainFixtureRecords(now);
    expect(result).toEqual({ sessionsDeleted: 1, previewsDeleted: 1 });
    expect(await store.getSession('11111111-1111-4111-8111-111111111111', now)).toBeNull();
    expect(await store.getSession('22222222-2222-4222-8222-222222222222', now)).toEqual(activePlayer);
    expect(await store.getSave(expiredPlayer.id, save.id)).toMatchObject({
      id: save.id,
    });

    await expect(
      store.createSave({
        ownerId: expiredPlayer.id,
        previewId: unused.previewId,
        selectedIds: unused.selectedIds,
      }),
    ).rejects.toMatchObject({ code: 'PREVIEW_NOT_FOUND' });
    await expect(
      store.createSave({
        ownerId: activePlayer.id,
        previewId: active.previewId,
        selectedIds: active.selectedIds,
      }),
    ).resolves.toMatchObject({ previewId: active.previewId });
    expect(await store.maintainFixtureRecords(now)).toEqual({
      sessionsDeleted: 0,
      previewsDeleted: 0,
    });
  });

  it('expires an ephemeral owner\'s whole playtest and reclaims bounded capacity', async () => {
    const store = InMemoryQuestStore.ephemeral({ maxSessions: 1, maxPreviews: 2, maxSaves: 1 });
    const expiresAt = new Date('2030-01-01T00:00:00.000Z');
    const player = await store.createFixtureSession(
      '11111111-1111-4111-8111-111111111111',
      expiresAt,
    );
    const preview = await store.putPreview(previewInput(player.id, expiresAt));
    const save = await store.createSave({
      ownerId: player.id,
      previewId: preview.previewId,
      selectedIds: preview.selectedIds,
    });

    await expect(store.createFixtureSession(
      '22222222-2222-4222-8222-222222222222',
      new Date('2030-01-02T00:00:00.000Z'),
    )).rejects.toMatchObject({ code: 'STORE_CAPACITY' });

    expect(await store.maintainFixtureRecords(expiresAt)).toEqual({
      sessionsDeleted: 1,
      previewsDeleted: 0,
    });
    expect(await store.getSave(player.id, save.id)).toBeNull();
    expect(await store.listSaves(player.id)).toEqual([]);
    await expect(store.createSave({
      ownerId: player.id,
      previewId: preview.previewId,
      selectedIds: preview.selectedIds,
    })).rejects.toMatchObject({ code: 'PREVIEW_NOT_FOUND' });
    await expect(store.createFixtureSession(
      '22222222-2222-4222-8222-222222222222',
      new Date('2030-01-02T00:00:00.000Z'),
    )).resolves.toMatchObject({ label: 'Preview player' });
  });
});

function previewInput(ownerId: string, expiresAt: Date): NewPreviewRecord {
  const birthDate = '2020-01-01';
  const date = '2024-01-01';
  const memories = [
    {
      id: `memory-${ownerId}-${expiresAt.valueOf()}`,
      date,
      label: 'Memory',
      ageYears: wholeYearsAt(birthDate, date),
      source: { kind: 'fixture' as const, key: 'memory' },
    },
  ];
  return {
    ownerId,
    birthDate,
    subjects: [FIXTURE_SUBJECT],
    chosenSubject: FIXTURE_SUBJECT,
    memories,
    selectedIds: memories.map((memory) => memory.id),
    coverage: { fromDate: date, toDate: date, incomplete: false, scanned: 1 },
    expiresAt,
  };
}
