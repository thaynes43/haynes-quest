import { randomUUID } from 'node:crypto';
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

  it('keeps only an ephemeral owner\'s two newest runs and removes superseded previews', async () => {
    const store = InMemoryQuestStore.ephemeral({ maxSessions: 1, maxPreviews: 4, maxSaves: 3 });
    const expiresAt = new Date('2030-01-02T00:00:00.000Z');
    const player = await store.createFixtureSession('11111111-1111-4111-8111-111111111111', expiresAt);
    const first = await createRun(store, player.id, expiresAt, 'first');
    const second = await createRun(store, player.id, expiresAt, 'second');
    const third = await createRun(store, player.id, expiresAt, 'third');

    expect(await store.getSave(player.id, first.save.id)).toBeNull();
    expect(new Set((await store.listSaves(player.id)).map((save) => save.id)))
      .toEqual(new Set([second.save.id, third.save.id]));
    await expect(store.createSave({
      ownerId: player.id,
      previewId: first.preview.previewId,
      selectedIds: first.preview.selectedIds,
    })).rejects.toMatchObject({ status: 404, code: 'PREVIEW_NOT_FOUND' });
  });

  it('expires an ephemeral owner\'s whole playtest and reclaims every bounded slot', async () => {
    const store = InMemoryQuestStore.ephemeral({ maxSessions: 1, maxPreviews: 2, maxSaves: 1 });
    const expiresAt = new Date('2030-01-01T00:00:00.000Z');
    const player = await store.createFixtureSession('11111111-1111-4111-8111-111111111111', expiresAt);
    const run = await createRun(store, player.id, expiresAt, 'expired');

    expect(await store.maintainFixtureRecords(expiresAt)).toEqual({
      sessionsDeleted: 1,
      previewsDeleted: 0,
    });
    expect(await store.getSave(player.id, run.save.id)).toBeNull();
    await expect(store.createSave({
      ownerId: player.id,
      previewId: run.preview.previewId,
      selectedIds: run.preview.selectedIds,
    })).rejects.toMatchObject({ status: 404, code: 'PREVIEW_NOT_FOUND' });
    await expect(store.createFixtureSession(
      '22222222-2222-4222-8222-222222222222',
      new Date('2030-01-02T00:00:00.000Z'),
    )).resolves.toMatchObject({ label: 'Preview player' });
  });

  it('evicts globally least-recently-used runs and preserves retained action receipts', async () => {
    const store = InMemoryQuestStore.ephemeral({ maxSessions: 4, maxPreviews: 3, maxSaves: 2 });
    const expiresAt = new Date('2030-01-02T00:00:00.000Z');
    const firstOwner = await store.createFixtureSession('11111111-1111-4111-8111-111111111111', expiresAt);
    const secondOwner = await store.createFixtureSession('22222222-2222-4222-8222-222222222222', expiresAt);
    const thirdOwner = await store.createFixtureSession('33333333-3333-4333-8333-333333333333', expiresAt);
    const fourthOwner = await store.createFixtureSession('44444444-4444-4444-8444-444444444444', expiresAt);
    const first = await createRun(store, firstOwner.id, expiresAt, 'first');
    const second = await createRun(store, secondOwner.id, expiresAt, 'second');

    expect(await store.getSave(firstOwner.id, first.save.id)).not.toBeNull();
    const third = await createRun(store, thirdOwner.id, expiresAt, 'third');
    expect(await store.getSave(secondOwner.id, second.save.id)).toBeNull();
    await expect(store.applyGameplayAction(
      secondOwner.id,
      second.save.id,
      equipmentAction(second.save),
      new Date('2029-01-01T00:00:00.000Z'),
    )).rejects.toMatchObject({ status: 404, code: 'SAVE_NOT_FOUND' });

    const action = equipmentAction(first.save);
    const applied = await store.applyGameplayAction(
      firstOwner.id,
      first.save.id,
      action,
      new Date('2029-01-01T00:00:00.000Z'),
    );
    expect(applied.revision).toBe(1);
    const fourth = await createRun(store, fourthOwner.id, expiresAt, 'fourth');
    expect(await store.getSave(thirdOwner.id, third.save.id)).toBeNull();
    expect(await store.getSave(fourthOwner.id, first.save.id)).toBeNull();
    await expect(store.applyGameplayAction(
      fourthOwner.id,
      first.save.id,
      action,
      new Date('2029-01-01T00:00:01.000Z'),
    )).rejects.toMatchObject({ status: 404, code: 'SAVE_NOT_FOUND' });
    const replay = await store.applyGameplayAction(
      firstOwner.id,
      first.save.id,
      action,
      new Date('2029-01-01T00:00:01.000Z'),
    );
    expect(replay).toMatchObject({ id: first.save.id, revision: 1 });
    expect(replay.adventureState?.actionReceipts).toContainEqual(expect.objectContaining({
      actionId: action.actionId,
      appliedRevision: 1,
    }));
    expect(await store.getSave(fourthOwner.id, fourth.save.id)).not.toBeNull();
  });

  it('evicts the least-recently-used ephemeral session and only its orphaned records', async () => {
    const store = InMemoryQuestStore.ephemeral({ maxSessions: 2, maxPreviews: 3, maxSaves: 2 });
    const expiresAt = new Date('2030-01-02T00:00:00.000Z');
    const first = await store.createFixtureSession('11111111-1111-4111-8111-111111111111', expiresAt);
    const second = await store.createFixtureSession('22222222-2222-4222-8222-222222222222', expiresAt);
    const firstRun = await createRun(store, first.id, expiresAt, 'first');
    const secondRun = await createRun(store, second.id, expiresAt, 'second');
    expect(await store.getSession('11111111-1111-4111-8111-111111111111', new Date())).toEqual(first);

    const third = await store.createFixtureSession('33333333-3333-4333-8333-333333333333', expiresAt);
    const thirdRun = await createRun(store, third.id, expiresAt, 'third');
    expect(await store.getSession('22222222-2222-4222-8222-222222222222', new Date())).toBeNull();
    expect(await store.getSave(second.id, secondRun.save.id)).toBeNull();
    await expect(store.createSave({
      ownerId: second.id,
      previewId: secondRun.preview.previewId,
      selectedIds: secondRun.preview.selectedIds,
    })).rejects.toMatchObject({ status: 404, code: 'PREVIEW_NOT_FOUND' });
    expect(await store.getSave(first.id, firstRun.save.id)).not.toBeNull();
    expect(await store.getSave(third.id, thirdRun.save.id)).not.toBeNull();
  });

  it('evicts only the oldest unreferenced preview and validates ephemeral limits', async () => {
    expect(() => InMemoryQuestStore.ephemeral({ maxSessions: 0 })).toThrow('positive integer');
    expect(() => InMemoryQuestStore.ephemeral({ maxPreviews: -1 })).toThrow('positive integer');
    expect(() => InMemoryQuestStore.ephemeral({ maxSaves: 1.5 })).toThrow('positive integer');
    expect(() => InMemoryQuestStore.ephemeral({ maxPreviews: 2, maxSaves: 2 }))
      .toThrow('maxPreviews must be greater than maxSaves');

    const store = InMemoryQuestStore.ephemeral({ maxSessions: 1, maxPreviews: 2, maxSaves: 1 });
    const expiresAt = new Date('2030-01-02T00:00:00.000Z');
    const owner = await store.createFixtureSession('11111111-1111-4111-8111-111111111111', expiresAt);
    const first = await store.putPreview(previewInput(owner.id, expiresAt, 'first'));
    const second = await store.putPreview(previewInput(owner.id, expiresAt, 'second'));
    const third = await store.putPreview(previewInput(owner.id, expiresAt, 'third'));
    await expect(store.createSave({
      ownerId: owner.id,
      previewId: first.previewId,
      selectedIds: first.selectedIds,
    })).rejects.toMatchObject({ status: 404, code: 'PREVIEW_NOT_FOUND' });
    const retained = await store.createSave({
      ownerId: owner.id,
      previewId: second.previewId,
      selectedIds: second.selectedIds,
    });
    const fourth = await store.putPreview(previewInput(owner.id, expiresAt, 'fourth'));
    await expect(store.createSave({
      ownerId: owner.id,
      previewId: second.previewId,
      selectedIds: second.selectedIds,
    })).resolves.toMatchObject({ id: retained.id });
    await expect(store.createSave({
      ownerId: owner.id,
      previewId: third.previewId,
      selectedIds: third.selectedIds,
    })).rejects.toMatchObject({ status: 404, code: 'PREVIEW_NOT_FOUND' });
    const newest = await store.createSave({
      ownerId: owner.id,
      previewId: fourth.previewId,
      selectedIds: fourth.selectedIds,
    });
    expect(await store.getSave(owner.id, retained.id)).toBeNull();
    expect(await store.getSave(owner.id, newest.id)).not.toBeNull();
  });
});

async function createRun(
  store: InMemoryQuestStore,
  ownerId: string,
  expiresAt: Date,
  key: string,
) {
  const preview = await store.putPreview(previewInput(ownerId, expiresAt, key));
  const save = await store.createSave({
    ownerId,
    previewId: preview.previewId,
    selectedIds: preview.selectedIds,
  });
  return { preview, save };
}

function equipmentAction(save: Awaited<ReturnType<typeof createRun>>['save']) {
  const level = save.adventurePlan!.levels[0]!;
  return {
    actionId: randomUUID(),
    expectedRevision: save.revision,
    action: {
      type: 'collect-equipment' as const,
      levelId: level.id,
      pickupId: level.pickups[0]!.pickupId,
    },
  };
}

function previewInput(ownerId: string, expiresAt: Date, key = 'memory'): NewPreviewRecord {
  const birthDate = '2020-01-01';
  const date = '2024-01-01';
  const memories = [
    {
      id: `memory-${ownerId}-${key}`,
      date,
      label: 'Memory',
      ageYears: wholeYearsAt(birthDate, date),
      source: { kind: 'fixture' as const, key },
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
