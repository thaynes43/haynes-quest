import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { InMemoryQuestStore } from '../../../src/server/db/memory-store.js';
import { createAdventurePlan, type AdventureMemory } from '../../../src/shared/adventure.js';
import { makeApp, makeEphemeralApp, mutation, preview, startPlaytest, startSession } from './helpers.js';

const MEMORIES: AdventureMemory[] = [
  { id: 'memory-age-0', date: '2020-07-01', ageYears: 0 },
  { id: 'memory-age-4', date: '2024-01-01', ageYears: 4 },
  { id: 'memory-age-7', date: '2027-01-01', ageYears: 7 },
];

describe('WO068 probe: v1/v2 preservation', () => {
  it('keeps the default plan factory on v2 with age-gated abilities', () => {
    const plan = createAdventurePlan('2020-01-01', MEMORIES);
    expect({
      version: plan.version,
      routeId: plan.levels[0]!.routeId,
      startAge: plan.levels[0]!.startAgeYears,
    }).toEqual({ version: 'era-level-plan-v2', routeId: 'gentle-intro-v1', startAge: 0 });
  });

  it('still validates a stored v2 save and refuses the v3-only secondary attack', async () => {
    const { app, store } = makeApp();
    const { cookie } = await startSession(app);
    const { body: previewBody } = await preview(app, cookie);
    const created = await app.request(
      '/api/saves',
      mutation(cookie, { previewId: previewBody.previewId, selectedIds: previewBody.selectedIds }),
    );
    const save = await created.json();
    expect(save.adventure.planVersion).toBe('era-level-plan-v2');
    expect(save.abilities).toEqual(['move', 'interact']);

    const record = [...(await store.listSaves(save.subjectOwnerId ?? (await ownerOf(store, save.id))))]
      .find((candidate) => candidate.id === save.id)!;
    const rehydrated = new InMemoryQuestStore([record]);
    await expect(rehydrated.getSave(record.ownerId, record.id)).resolves.toMatchObject({ id: record.id });

    const secondary = await app.request(`/api/saves/${save.id}/actions`, mutation(cookie, {
      actionId: randomUUID(),
      expectedRevision: save.revision,
      action: {
        type: 'secondary-attack',
        levelId: save.adventure.currentLevelId,
        encounterId: save.adventure.activeLevel.encounters[0].id,
      },
    }));
    const body = await secondary.json();
    expect({ status: secondary.status, code: body.error?.code })
      .toEqual({ status: 409, code: 'ACTION_NOT_AVAILABLE' });
  });
});

async function ownerOf(store: InMemoryQuestStore, saveId: string): Promise<string> {
  // listSaves needs an owner; recover it through the private map via a session scan.
  const anyStore = store as unknown as { saves: Map<string, { id: string; ownerId: string }> };
  return [...anyStore.saves.values()].find((save) => save.id === saveId)!.ownerId;
}

describe('WO068 probe: session renewal', () => {
  it('replaces an unknown signed cookie and never echoes the old value', async () => {
    const persistent = makeApp();
    const old = await startSession(persistent.app);
    const ephemeral = makeEphemeralApp();
    const response = await ephemeral.app.request('/api/session', { headers: { cookie: old.cookie } });
    const setCookie = response.headers.get('set-cookie')!;
    const body = await response.json();
    const headerDump = [...response.headers.entries()].map(([k, v]) => `${k}: ${v}`).join('\n');
    const oldValue = old.cookie.split('=')[1]!;
    expect({
      status: response.status,
      renewed: body.player.id !== old.body.player.id,
      echoesOldCookie: headerDump.includes(oldValue) || JSON.stringify(body).includes(oldValue),
      mode: body.progressMode,
    }).toEqual({ status: 200, renewed: true, echoesOldCookie: false, mode: 'ephemeral' });
    expect(setCookie).toContain('HttpOnly');
  });
});

describe('WO068 probe: store clock vs application clock', () => {
  it('honours the injected application clock for preview expiry', async () => {
    const clock = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const { app } = makeEphemeralApp(undefined, () => clock);
    const { cookie } = await startSession(app);
    const started = await startPlaytest(app, cookie, 1);
    console.log('OBSERVED skewed-clock start', started.status, JSON.stringify(started.body));
    expect(started.status).toBe(201);
  });
});
