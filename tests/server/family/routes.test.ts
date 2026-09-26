import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { GameplayAction, SaveView } from '../../../src/shared/contracts.js';
import type {
  AdminChildSummary,
  AdminDraftResponse,
  DraftView,
  FamilyJourneysResponse,
  FamilyPlayResponse,
  PersonChoice,
  SuggestionPageView,
} from '../../../src/shared/family-api.js';
import { createApp } from '../../../src/server/app.js';
import { InMemoryQuestStore } from '../../../src/server/db/memory-store.js';
import { InMemoryFamilyStore } from '../../../src/server/family/memory-store.js';
import { FamilyTemplateRegistry } from '../../../src/server/family/templates.js';
import { ADMIN, familyHarness, fakeFamilyAuth, type FamilyHarness } from './harness.js';
import { TEST_CHILD_A, TEST_CHILD_B, type FakeAsset } from './fake-immich.js';

const bodies: string[] = [];

async function json<T>(response: Response | Promise<Response>, status?: number): Promise<T> {
  const resolved = await response;
  const text = await resolved.text();
  bodies.push(text);
  if (status !== undefined && resolved.status !== status) {
    throw new Error(`Expected ${status}, got ${resolved.status}: ${text}`);
  }
  return JSON.parse(text) as T;
}

async function waitForPick(harness: FamilyHarness, childId: string): Promise<AdminDraftResponse> {
  await harness.jobs.settled(childId);
  return json<AdminDraftResponse>(harness.request(`/api/admin/children/${childId}/draft`), 200);
}

/** Admin creates Test Child B, auto-picks and publishes. */
async function publishChildB(harness: FamilyHarness) {
  const { people } = await json<{ people: PersonChoice[] }>(
    harness.request(`/api/admin/immich/people?name=${encodeURIComponent(TEST_CHILD_B.name)}`), 200);
  const child = await json<{ id: string }>(harness.request('/api/admin/children', {
    body: {
      immichName: TEST_CHILD_B.name,
      personChoiceId: people[0]!.id,
      displayName: 'Test Child B',
      birthDate: people[0]!.birthDate,
      templateId: 'rat-casino-world',
      templateVersion: 'v2',
    },
  }), 201);
  await json(harness.request(`/api/admin/children/${child.id}/draft`, {
    method: 'PUT',
    body: { op: 'auto-pick', expectedRevision: null },
  }), 202);
  const { draft } = await waitForPick(harness, child.id);
  const publication = await json<{ revision: number }>(harness.request(`/api/admin/children/${child.id}/publish`, {
    body: { expectedRevision: draft!.revision, requestId: randomUUID() },
  }), 201);
  return { childId: child.id, draft: draft!, publication };
}

function expectPrivate(assets: FakeAsset[]) {
  const all = bodies.join('\n');
  expect(all).not.toContain(TEST_CHILD_B.personId);
  expect(all).not.toContain(TEST_CHILD_A.personId);
  for (const asset of assets) expect(all).not.toContain(asset.id);
}

describe('family journey routes (DESIGN-024 D-08)', () => {
  it('requires a family session everywhere and the administrator role for setup', async () => {
    const harness = familyHarness();
    for (const path of ['/api/children', '/api/admin/children', '/api/admin/templates?birthDate=2020-02-29']) {
      expect((await harness.request(path, { as: null })).status).toBe(401);
    }
    expect((await harness.request(`/api/children/${randomUUID()}/play`, { as: null, body: {} })).status).toBe(401);
    for (const path of ['/api/admin/children', `/api/admin/immich/people?name=x`, `/api/admin/children/${randomUUID()}/draft`]) {
      const response = await harness.request(path, { as: 'member' });
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: { code: 'ADMIN_REQUIRED', message: 'Administrator required' } });
    }
    const forged = await harness.app.request('/api/admin/children', {
      method: 'POST',
      headers: { cookie: 'quest_test_session=admin', 'content-type': 'application/json' },
      body: '{}',
    });
    expect(forged.status).toBe(403);
    expect(await json<FamilyJourneysResponse>(harness.request('/api/children', { as: 'member' }), 200))
      .toEqual({ journeys: [] });
  });

  it('runs setup: lookup, create, background auto-pick, caption, swap and publish', async () => {
    const harness = familyHarness();
    const { templates } = await json<{ templates: Array<{ id: string; version: string }> }>(
      harness.request('/api/admin/templates?birthDate=2020-02-29'), 200);
    expect(templates.map((entry) => `${entry.id}@${entry.version}`)).toEqual([
      'rat-casino-world@v1',
      'rat-casino-world@v2',
      'family-world-b@v1',
      'family-world-b@v2',
    ]);
    expect((await json<{ templates: unknown[] }>(harness.request('/api/admin/templates?birthDate=2016-02-29'), 200)).templates)
      .toEqual([]);
    const { people } = await json<{ people: PersonChoice[] }>(
      harness.request('/api/admin/immich/people?name=Test%20Child%20B'), 200);
    expect(people).toEqual([{ id: expect.stringMatching(/^person-/), label: 'Test Child B', birthDate: '2020-02-29' }]);
    const child = await json<{ id: string }>(harness.request('/api/admin/children', {
      body: {
        immichName: 'Test Child B',
        personChoiceId: people[0]!.id,
        displayName: 'Test Child B',
        birthDate: '2020-02-29',
        templateId: 'rat-casino-world',
        templateVersion: 'v2',
      },
    }), 201);
    expect(await json<AdminDraftResponse>(harness.request(`/api/admin/children/${child.id}/draft`), 200))
      .toEqual({ draft: null, picking: false, lastPickError: null });
    expect(await json<AdminDraftResponse>(harness.request(`/api/admin/children/${child.id}/draft`, {
      method: 'PUT',
      body: { op: 'auto-pick', expectedRevision: null },
    }), 202)).toEqual({ draft: null, picking: true, lastPickError: null });
    const picked = await waitForPick(harness, child.id);
    expect(picked).toMatchObject({ picking: false, lastPickError: null, draft: { revision: 0, publishable: true } });
    const draft = picked.draft!;

    const captioned = await json<AdminDraftResponse>(harness.request(`/api/admin/children/${child.id}/draft`, {
      method: 'PUT',
      body: { op: 'caption', expectedRevision: draft.revision, chapterId: 'chapter-1', slot: 'minor-one', caption: 'Pumpkin patch' },
    }), 200);
    expect(captioned.draft!.chapters[0]!.slots[0]!.caption).toBe('Pumpkin patch');
    const stale = await harness.request(`/api/admin/children/${child.id}/draft`, {
      method: 'PUT',
      body: { op: 'caption', expectedRevision: draft.revision, chapterId: 'chapter-1', slot: 'minor-one', caption: 'x' },
    });
    expect(stale.status).toBe(409);

    const page = await json<SuggestionPageView>(harness.request(
      `/api/admin/children/${child.id}/draft/slots/chapter-2/minor-two/suggestions?cursor=1`), 200);
    expect(page.suggestions.length).toBeGreaterThan(0);
    const swapped = await json<AdminDraftResponse>(harness.request(`/api/admin/children/${child.id}/draft`, {
      method: 'PUT',
      body: {
        op: 'swap',
        expectedRevision: captioned.draft!.revision,
        chapterId: 'chapter-2',
        slot: 'minor-two',
        token: page.suggestions[0]!.token,
      },
    }), 200);
    expect(swapped.draft!.chapters[1]!.slots[1]).toMatchObject({ source: 'admin', localDate: page.suggestions[0]!.localDate });

    const thumbnail = await harness.request(
      `/api/admin/candidates/${encodeURIComponent(swapped.draft!.chapters[1]!.slots[1]!.thumbnailToken!)}/image`);
    expect(thumbnail.status).toBe(200);
    expect(thumbnail.headers.get('content-type')).toBe('image/webp');
    expect(thumbnail.headers.get('cache-control')).toMatch(/^no-store/);
    expect(thumbnail.headers.get('x-content-type-options')).toBe('nosniff');
    expect(harness.immich.thumbnailCalls().at(-1)!.path).toContain('size=thumbnail');
    expect((await harness.request('/api/admin/candidates/ct1.forged/image')).status).toBe(404);
    expect((await harness.request(
      `/api/admin/candidates/${encodeURIComponent(swapped.draft!.chapters[1]!.slots[1]!.thumbnailToken!)}/image`,
      { as: 'member' })).status).toBe(403);

    const requestId = randomUUID();
    const published = await json<{ revision: number; chapterCount: number }>(
      harness.request(`/api/admin/children/${child.id}/publish`, {
        body: { expectedRevision: swapped.draft!.revision, requestId },
      }), 201);
    expect(published).toMatchObject({ revision: 1, chapterCount: 3, memoryCount: 9 });
    expect(await json(harness.request(`/api/admin/children/${child.id}/publish`, {
      body: { expectedRevision: swapped.draft!.revision, requestId },
    }), 201)).toEqual(published);
    const { children } = await json<{ children: AdminChildSummary[] }>(harness.request('/api/admin/children'), 200);
    expect(children).toEqual([expect.objectContaining({
      draft: { revision: 2, publishable: true, filled: 9, needsPhoto: 0 },
      publication: { revision: 1, publishedAt: expect.any(String) },
      picking: false,
    })]);
    expectPrivate(harness.assets);
  });

  it('plays a published journey as a household save that newer publications never alter', async () => {
    const harness = familyHarness();
    const { childId, draft } = await publishChildB(harness);
    const { journeys } = await json<FamilyJourneysResponse>(harness.request('/api/children', { as: 'member' }), 200);
    expect(journeys).toEqual([{
      childId,
      displayName: 'Test Child B',
      publicationRevision: 1,
      chapterCount: 3,
      run: null,
      newerPublication: false,
    }]);

    const started = await json<FamilyPlayResponse>(harness.request(`/api/children/${childId}/play`, { as: 'member', body: {} }), 201);
    expect(started.created).toBe(true);
    expect(started.save).toMatchObject({
      title: 'Test Child B',
      subject: { id: childId, label: 'Test Child B' },
      ageYears: 0,
      abilities: ['move', 'interact', 'jump'],
      versions: { journey: 'family-world-plan-v1', age: 'birth-date-whole-years-feb28-v1' },
      adventure: { planVersion: 'family-world-plan-v1', activeLevelIndex: 0 },
    });
    expect(started.save.memories.map((memory) => memory.label)).toContain('Turning 4!');
    expect(started.world.chapters.map((chapter) => chapter.name)).toEqual([
      'The Block Party', 'Besties Obby', 'Haynesnightmares: Rat Casino',
    ]);
    expect(started.world.chapters[2]!.level.id).toBe('rat-casino-v2');
    expect(JSON.stringify(started.world)).not.toMatch(/\d{4}-\d{2}-\d{2}/);

    // Any admitted member resumes the same household run on any device.
    const resumed = await json<FamilyPlayResponse>(harness.request(`/api/children/${childId}/play`, { as: 'admin', body: {} }), 200);
    expect(resumed).toMatchObject({ created: false, save: { id: started.save.id } });
    expect((await json<SaveView>(harness.request(`/api/saves/${started.save.id}`, { as: 'admin' }), 200)).id)
      .toBe(started.save.id);
    expect((await json<{ saveId: string }>(harness.request(`/api/saves/${started.save.id}/world`, { as: 'member' }), 200)).saveId)
      .toBe(started.save.id);

    // Play the first chapter through the ordinary action route, alternating players.
    let save = started.save;
    const level = save.adventure!.activeLevel!;
    let turn = 0;
    const act = async (action: GameplayAction) => {
      harness.clock.time += 1_000;
      turn += 1;
      save = await json<SaveView>(harness.request(`/api/saves/${save.id}/actions`, {
        as: turn % 2 ? 'member' : 'admin',
        body: { actionId: randomUUID(), expectedRevision: save.revision, action },
      }), 200);
    };
    await act({ type: 'collect-equipment', levelId: level.id, pickupId: level.pickups[0]!.pickupId });
    for (const memoryId of level.minorMemoryIds!) await act({ type: 'recover-memory', levelId: level.id, memoryId });
    const minor = save.memories.find((memory) => memory.id === level.minorMemoryIds![0])!;
    const media = await harness.request(minor.mediaUrl!, { as: 'member' });
    expect(media.status).toBe(200);
    expect(media.headers.get('content-type')).toBe('image/webp');
    expect(media.headers.get('cache-control')).toMatch(/^no-store/);
    const major = save.memories.find((memory) => memory.id === level.majorMemoryId)!;
    expect(major.mediaUrl).toBeUndefined();
    expect((await harness.request(`/api/saves/${save.id}/media/${level.majorMemoryId}`, { as: 'member' })).status).toBe(409);
    while (!save.adventure!.activeLevel!.encounters.find((encounter) => encounter.id === level.bossId)!.defeated) {
      await act({ type: 'attack', levelId: level.id, encounterId: level.bossId });
    }
    await act({ type: 'recover-memory', levelId: level.id, memoryId: level.majorMemoryId! });
    expect(save).toMatchObject({
      ageYears: 4,
      abilities: ['move', 'interact', 'jump', 'high-jump', 'double-jump'],
      adventure: { activeLevelIndex: 1 },
    });

    // A second publication does not alter the started run.
    await json(harness.request(`/api/admin/children/${childId}/draft`, {
      method: 'PUT',
      body: { op: 'caption', expectedRevision: draft.revision, chapterId: 'chapter-2', slot: 'major', caption: 'Five candles' },
    }), 200);
    await json(harness.request(`/api/admin/children/${childId}/publish`, {
      body: { expectedRevision: draft.revision + 1, requestId: randomUUID() },
    }), 201);
    const again = await json<FamilyPlayResponse>(harness.request(`/api/children/${childId}/play`, { as: 'member', body: {} }), 200);
    expect(again.save).toMatchObject({ id: save.id, ageYears: 4 });
    expect(again.save.memories.map((memory) => memory.label)).not.toContain('Five candles');
    const cards = await json<FamilyJourneysResponse>(harness.request('/api/children', { as: 'member' }), 200);
    expect(cards.journeys[0]).toMatchObject({
      publicationRevision: 2,
      newerPublication: true,
      run: { saveId: save.id, publicationRevision: 1, ageYears: 4, chapterIndex: 1, chapterName: 'Besties Obby' },
    });

    // Only an administrator may start fresh with the new photos.
    expect((await harness.request(`/api/children/${childId}/play`, { as: 'member', body: { fresh: true } })).status).toBe(403);
    const fresh = await json<FamilyPlayResponse>(harness.request(`/api/children/${childId}/play`, { body: { fresh: true } }), 201);
    expect(fresh.save.id).not.toBe(save.id);
    expect(fresh.save.ageYears).toBe(0);
    expect(fresh.save.memories.map((memory) => memory.label)).toContain('Five candles');
    expect((await json<FamilyJourneysResponse>(harness.request('/api/children'), 200)).journeys[0])
      .toMatchObject({ newerPublication: false, run: { saveId: fresh.save.id, publicationRevision: 2 } });
    expectPrivate(harness.assets);
  });

  it('keeps journeys readable but setup unavailable without Immich', async () => {
    const harness = familyHarness({ withImmich: false });
    expect(await json(harness.request('/api/admin/children'), 200)).toEqual({ children: [] });
    const setup = await harness.request('/api/admin/immich/people?name=Test%20Child%20B');
    expect(setup.status).toBe(503);
    expect(await setup.json()).toEqual({ error: { code: 'FAMILY_SETUP_UNAVAILABLE', message: 'Photo setup unavailable' } });
    expect((await harness.request(`/api/admin/children/${randomUUID()}/publish`, {
      body: { expectedRevision: 0, requestId: randomUUID() },
    })).status).toBe(503);
    expect(await json(harness.request('/api/children', { as: 'member' }), 200)).toEqual({ journeys: [] });
  });

  it('reports the missing journey and an unknown child plainly', async () => {
    const harness = familyHarness();
    expect((await harness.request(`/api/children/${randomUUID()}/play`, { as: 'member', body: {} })).status).toBe(404);
    expect((await harness.request('/api/children/not-a-uuid/play', { as: 'member', body: {} })).status).toBe(404);
    const [person] = await harness.service.lookupPeople(TEST_CHILD_B.name);
    const child = await harness.service.createChild({
      immichName: TEST_CHILD_B.name,
      personChoiceId: person!.id,
      displayName: 'Test Child B',
      birthDate: TEST_CHILD_B.birthDate,
      templateId: 'rat-casino-world',
      templateVersion: 'v2',
    }, ADMIN.id);
    const unpublished = await harness.request(`/api/children/${child.id}/play`, { as: 'member', body: {} });
    expect(unpublished.status).toBe(404);
    expect((await unpublished.json() as { error: { code: string } }).error.code).toBe('JOURNEY_NOT_PUBLISHED');
  });

  it('never registers family routes or household saves in fixture mode', async () => {
    const fixture = createApp({
      store: new InMemoryQuestStore(),
      fixtureMode: true,
      sessionSecret: 'synthetic-session-secret-with-32-plus-chars',
      appOrigin: 'http://localhost:3000',
      clientDir: 'public',
      studioDir: 'public',
    });
    expect((await fixture.request('/api/children')).status).toBe(404);
    expect((await fixture.request('/api/admin/children')).status).toBe(404);
    expect(() => createApp({
      store: new InMemoryQuestStore(),
      fixtureMode: true,
      sessionSecret: 'synthetic-session-secret-with-32-plus-chars',
      appOrigin: 'http://localhost:3000',
      clientDir: 'public',
      studioDir: 'public',
      family: { store: new InMemoryFamilyStore(), templates: new FamilyTemplateRegistry(), service: null },
    })).toThrow();
    expect(() => createApp({
      store: new InMemoryQuestStore(),
      fixtureMode: false,
      sessionSecret: 'synthetic-session-secret-with-32-plus-chars',
      appOrigin: 'http://localhost:3000',
      clientDir: 'public',
      studioDir: 'public',
      family: { store: new InMemoryFamilyStore(), templates: new FamilyTemplateRegistry(), service: null },
    })).toThrow('Family journeys require family sign-in');
    // A family save is invisible to owner-scoped (fixture) access.
    const harness = familyHarness();
    const { childId } = await publishChildB(harness);
    const started = await json<FamilyPlayResponse>(harness.request(`/api/children/${childId}/play`, { as: 'member', body: {} }), 201);
    expect(await harness.questStore.getSave('40000000-0000-4000-8000-00000000000b', started.save.id)).toBeNull();
    expect(await harness.questStore.listSaves('40000000-0000-4000-8000-00000000000b')).toEqual([]);
    const auth = fakeFamilyAuth({});
    expect(auth.endSessionAvailable).toBe(false);
  });
});

export type { DraftView };
