/**
 * One behavioural contract for every FamilyStore implementation. Test names
 * carry a prefix so `pnpm test:db` (`--testNamePattern Postgres`) selects the
 * Postgres run.
 */
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import type {
  BuiltPublication,
  ChildProfile,
  DraftContent,
  FamilyStore,
} from '../../../src/server/family/store.js';
import { TEST_CHILD_A, TEST_CHILD_B } from './fake-immich.js';

export interface StoreContractContext {
  store: FamilyStore;
  /** Actor ids that satisfy the implementation's audit references. */
  actors: [string, string];
}

export function profile(child: { personId: string; birthDate: string } = TEST_CHILD_B): ChildProfile {
  return {
    displayName: child === TEST_CHILD_B ? 'Test Child B' : 'Test Child A',
    immichName: child === TEST_CHILD_B ? 'Test Child B' : 'Test Child A',
    immichPersonId: child.personId,
    birthDate: child.birthDate,
    templateId: 'rat-casino-world',
    templateVersion: 'v2',
  };
}

export function draftContent(marker = 'first'): DraftContent {
  return {
    templateId: 'rat-casino-world',
    templateVersion: 'v2',
    seed: `synthetic-seed-${marker}`,
    birthDate: TEST_CHILD_B.birthDate,
    rebasedOn: '2026-09-25',
    chapters: [{
      index: 0,
      chapterId: 'chapter-1',
      routeId: 'chapter-1-route',
      startAge: 0,
      recoveredAge: 4,
      startDate: '2020-02-29',
      targetDate: '2024-02-29',
    }],
    slots: [{
      chapterId: 'chapter-1',
      slot: 'major',
      status: 'filled',
      assetId: `asset-${marker}`,
      localDate: '2024-02-29',
      caption: 'Turning 4!',
      captionEdited: false,
      reason: { source: 'auto', window: 'preferred', query: 'birthday cake', score: 9.1, faces: 1 },
    }],
  };
}

/** A structurally plausible publication body; the store treats it as opaque JSON. */
export function built(marker: string): BuiltPublication {
  return {
    plan: { version: 'family-world-plan-v1', marker } as unknown as BuiltPublication['plan'],
    memories: [{
      id: 'chapter-1-route-memory-major',
      date: '2024-02-29',
      ageYears: 4,
      label: 'Turning 4!',
      source: { kind: 'immich', assetId: `asset-${marker}`, personId: TEST_CHILD_B.personId },
    }],
    versions: { journey: 'family-world-plan-v1', age: 'birth-date-whole-years-feb28-v1', progression: 'p', appearance: 'a' },
  };
}

export function registerFamilyStoreContract(
  prefix: string,
  context: () => StoreContractContext,
): void {
  it(`${prefix} creates, lists and revises child profiles with compare-and-set`, async () => {
    const { store, actors } = context();
    const created = await store.createChild(profile(), actors[0]);
    expect(created).toMatchObject({ ...profile(), revision: 0, createdBy: actors[0], updatedBy: actors[0] });
    expect(await store.getChild(created.id)).toEqual(created);
    const second = await store.createChild(profile(TEST_CHILD_A), null);
    expect(second.createdBy).toBeNull();
    expect((await store.listChildren()).map((child) => child.id)).toEqual([created.id, second.id]);

    const renamed = await store.updateChild(created.id, 0, { displayName: 'Test Child B2' }, actors[1]);
    expect(renamed).toMatchObject({ displayName: 'Test Child B2', revision: 1, updatedBy: actors[1], createdBy: actors[0] });
    await expect(store.updateChild(created.id, 0, { displayName: 'Stale' }, actors[1]))
      .rejects.toMatchObject({ code: 'CHILD_CONFLICT' });
    await expect(store.updateChild(randomUUID(), 0, {}, actors[1])).rejects.toMatchObject({ code: 'CHILD_NOT_FOUND' });
    await expect(store.updateChild(second.id, 0, { immichPersonId: TEST_CHILD_B.personId }, null))
      .rejects.toMatchObject({ code: 'CHILD_EXISTS' });
  });

  it(`${prefix} refuses a second profile for the same Immich person`, async () => {
    const { store, actors } = context();
    await store.createChild(profile(), actors[0]);
    await expect(store.createChild(profile(), actors[0])).rejects.toMatchObject({ code: 'CHILD_EXISTS' });
  });

  it(`${prefix} creates a draft once and then only by compare-and-set`, async () => {
    const { store, actors } = context();
    const child = await store.createChild(profile(), actors[0]);
    expect(await store.getDraft(child.id)).toBeNull();
    const first = await store.saveDraft(child.id, null, draftContent('first'), actors[0]);
    expect(first).toMatchObject({ ...draftContent('first'), childId: child.id, revision: 0, updatedBy: actors[0] });
    await expect(store.saveDraft(child.id, null, draftContent('again'), actors[0]))
      .rejects.toMatchObject({ code: 'DRAFT_CONFLICT' });
    const second = await store.saveDraft(child.id, 0, draftContent('second'), actors[1]);
    expect(second).toMatchObject({ id: first.id, revision: 1, seed: 'synthetic-seed-second', updatedBy: actors[1] });
    await expect(store.saveDraft(child.id, 0, draftContent('stale'), actors[1]))
      .rejects.toMatchObject({ code: 'DRAFT_CONFLICT' });
    await expect(store.saveDraft(randomUUID(), null, draftContent(), null))
      .rejects.toMatchObject({ code: 'CHILD_NOT_FOUND' });
    expect(await store.getDraft(child.id)).toEqual(second);
  });

  it(`${prefix} lets exactly one of two racing draft edits win`, async () => {
    const { store, actors } = context();
    const child = await store.createChild(profile(), actors[0]);
    await store.saveDraft(child.id, null, draftContent('base'), actors[0]);
    const results = await Promise.allSettled([
      store.saveDraft(child.id, 0, draftContent('left'), actors[0]),
      store.saveDraft(child.id, 0, draftContent('right'), actors[1]),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: 'DRAFT_CONFLICT' });
    expect((await store.getDraft(child.id))!.revision).toBe(1);
  });

  it(`${prefix} publishes idempotently per request id with monotonic revisions`, async () => {
    const { store, actors } = context();
    const child = await store.createChild(profile(), actors[0]);
    await store.saveDraft(child.id, null, draftContent('one'), actors[0]);
    const requestId = randomUUID();
    let builds = 0;
    const publish = (id: string, expectedDraftRevision: number, marker: string) => store.publish({
      childId: child.id,
      requestId: id,
      expectedDraftRevision,
      actorId: actors[0],
      build: (record, draft) => {
        builds += 1;
        expect(record.id).toBe(child.id);
        expect(draft.revision).toBe(expectedDraftRevision);
        return built(marker);
      },
    });
    const first = await publish(requestId, 0, 'one');
    expect(first).toMatchObject({
      childId: child.id,
      revision: 1,
      requestId,
      draftRevision: 0,
      birthDate: TEST_CHILD_B.birthDate,
      publishedBy: actors[0],
    });
    expect(first.plan).toEqual(built('one').plan);
    // Replaying the request returns the same publication, even after later edits.
    await store.saveDraft(child.id, 0, draftContent('two'), actors[1]);
    expect(await publish(requestId, 0, 'ignored')).toEqual(first);
    expect(builds).toBe(1);
    await expect(publish(requestId, 1, 'two')).rejects.toMatchObject({ code: 'REQUEST_ID_REUSED' });
    await expect(publish(randomUUID(), 0, 'stale')).rejects.toMatchObject({ code: 'DRAFT_CONFLICT' });
    const second = await publish(randomUUID(), 1, 'two');
    expect(second.revision).toBe(2);
    expect(await store.latestPublication(child.id)).toEqual(second);
    expect(await store.getPublication(first.id)).toEqual(first);
    expect(await store.listLatestPublications()).toEqual([second]);
  });

  it(`${prefix} serialises racing publishes without duplicate revisions`, async () => {
    const { store, actors } = context();
    const child = await store.createChild(profile(), actors[0]);
    await store.saveDraft(child.id, null, draftContent('race'), actors[0]);
    const sameRequest = randomUUID();
    const command = (requestId: string) => ({
      childId: child.id,
      requestId,
      expectedDraftRevision: 0,
      actorId: actors[1],
      build: () => built('race'),
    });
    const [left, right] = await Promise.all([store.publish(command(sameRequest)), store.publish(command(sameRequest))]);
    expect(left.id).toBe(right.id);
    const distinct = await Promise.all([store.publish(command(randomUUID())), store.publish(command(randomUUID()))]);
    expect(distinct.map((entry) => entry.revision).sort()).toEqual([2, 3]);
  });

  it(`${prefix} persists nothing when the plan build fails`, async () => {
    const { store, actors } = context();
    const child = await store.createChild(profile(), actors[0]);
    await store.saveDraft(child.id, null, draftContent(), actors[0]);
    await expect(store.publish({
      childId: child.id,
      requestId: randomUUID(),
      expectedDraftRevision: 0,
      actorId: actors[0],
      build: () => {
        throw new Error('build failed');
      },
    })).rejects.toThrow('build failed');
    expect(await store.latestPublication(child.id)).toBeNull();
    await expect(store.publish({
      childId: randomUUID(),
      requestId: randomUUID(),
      expectedDraftRevision: 0,
      actorId: null,
      build: () => built('none'),
    })).rejects.toMatchObject({ code: 'CHILD_NOT_FOUND' });
  });

  it(`${prefix} lists each child's latest publication in household order`, async () => {
    const { store, actors } = context();
    const older = await store.createChild(profile(TEST_CHILD_A), actors[0]);
    const younger = await store.createChild(profile(), actors[0]);
    for (const child of [younger, older]) {
      await store.saveDraft(child.id, null, draftContent(child.id.slice(0, 8)), actors[0]);
      for (let index = 0; index < 2; index += 1) {
        await store.publish({
          childId: child.id,
          requestId: randomUUID(),
          expectedDraftRevision: 0,
          actorId: actors[0],
          build: () => built(`${child.id}-${index}`),
        });
      }
    }
    const latest = await store.listLatestPublications();
    expect(latest.map((entry) => [entry.childId, entry.revision])).toEqual([[older.id, 2], [younger.id, 2]]);
  });
}
