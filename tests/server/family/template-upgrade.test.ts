/**
 * DESIGN-024 D-11 **Update world** against the in-memory store: carry-over,
 * the window check, auto-picks for changed chapters, refusals and races.
 * Everything here is synthetic.
 */
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryFamilyStore } from '../../../src/server/family/memory-store.js';
import { FamilyJourneyService, type DraftView } from '../../../src/server/family/service.js';
import { FamilyTemplateRegistry } from '../../../src/server/family/templates.js';
import { CandidateTokens } from '../../../src/server/family/tokens.js';
import { ImmichPhotoSource } from '../../../src/server/photos/immich.js';
import {
  FakeClock,
  FakeImmich,
  TEST_CHILD_A,
  TEST_CHILD_B,
  localNoon,
  syntheticAssetId,
  syntheticLibrary,
  type FakeAsset,
} from './fake-immich.js';
import { upgradeRegistry } from './template-variants.js';

const SECRET = 'synthetic-subject-id-key-with-at-least-32-bytes';
const TODAY = '2026-09-25';
const ACTOR = '30000000-0000-4000-8000-000000000001';
const OTHER = '30000000-0000-4000-8000-000000000002';

function setup(assets: FakeAsset[] = syntheticLibrary()) {
  const clock = new FakeClock();
  const immich = new FakeImmich([
    { id: TEST_CHILD_B.personId, name: TEST_CHILD_B.name, birthDate: TEST_CHILD_B.birthDate },
  ], assets, clock);
  const library = new ImmichPhotoSource(immich, SECRET, 'test-connection');
  const store = new InMemoryFamilyStore();
  const tokens = new CandidateTokens(SECRET, { now: () => clock.now() });
  const day = { today: TODAY };
  const service = new FamilyJourneyService({
    store,
    library,
    templates: upgradeRegistry(),
    tokens,
    clock,
    today: () => day.today,
    newSeed: () => 'synthetic-seed-fixed-0001',
  });
  return { clock, immich, library, store, tokens, service, assets, day };
}

type Context = ReturnType<typeof setup>;

async function childOnV1(context: Context) {
  const [person] = await context.service.lookupPeople(TEST_CHILD_B.name);
  return context.service.createChild({
    immichName: TEST_CHILD_B.name,
    personChoiceId: person!.id,
    displayName: 'Test Child B',
    birthDate: TEST_CHILD_B.birthDate,
    templateId: 'family-world-b',
    templateVersion: 'v1',
  }, ACTOR);
}

function slot(view: DraftView, chapterId: string, name: string) {
  return view.chapters.find((chapter) => chapter.chapterId === chapterId)!.slots.find((entry) => entry.slot === name)!;
}

/** Private asset ids behind the view's thumbnail tokens, keyed `chapter:slot`. */
function assetsOf(context: Context, view: DraftView): Record<string, string | null> {
  return Object.fromEntries(view.chapters.flatMap((chapter) => chapter.slots.map((entry) => [
    `${chapter.chapterId}:${entry.slot}`,
    entry.thumbnailToken ? context.tokens.verify(entry.thumbnailToken)!.assetId : null,
  ])));
}

/** Every filled photo is later than the one before it, in journey order. */
function expectChronological(view: DraftView) {
  const dates = view.chapters.flatMap((chapter) => chapter.slots.flatMap((entry) => entry.localDate ? [entry.localDate] : []));
  expect(dates).toEqual([...dates].sort());
  expect(new Set(dates).size).toBe(dates.length);
}

function expectNoUpstreamIds(value: unknown, assets: FakeAsset[]) {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain(TEST_CHILD_B.personId);
  for (const asset of assets) expect(serialized).not.toContain(asset.id);
}

describe('template upgrade (DESIGN-024 D-11)', () => {
  let context: Context;
  beforeEach(() => {
    context = setup();
  });

  it('offers only newer versions of the same template that fit the birthday, newest last', () => {
    const registry = upgradeRegistry();
    expect(registry.newerOffered('family-world-b', 'v1', TEST_CHILD_B.birthDate, TODAY).map((entry) => entry.version))
      .toEqual(['v2', 'v3', 'v4', 'v5']);
    // v12 compares as twelve, not as text, and ends at eleven: too old for a six-year-old.
    expect(registry.newestUpgrade('family-world-b', 'v1', TEST_CHILD_B.birthDate, TODAY)?.version).toBe('v5');
    expect(registry.newestUpgrade('family-world-b', 'v5', TEST_CHILD_B.birthDate, TODAY)).toBeNull();
    expect(registry.newestUpgrade('family-world-b', 'v1', '2015-03-10', TODAY)?.version).toBe('v12');
    expect(registry.newestUpgrade('rat-casino-world', 'v2', TEST_CHILD_B.birthDate, TODAY)).toBeNull();
    expect(registry.newestUpgrade('family-world-b', 'latest', TEST_CHILD_B.birthDate, TODAY)).toBeNull();
    const checkedIn = new FamilyTemplateRegistry();
    expect(checkedIn.newestUpgrade('family-world-b', 'v1', TEST_CHILD_B.birthDate, TODAY)?.version).toBe('v2');
    expect(checkedIn.newestUpgrade('rat-casino-world', 'v1', TEST_CHILD_B.birthDate, TODAY)?.version).toBe('v2');
    // World B v2 exists, but its casts do not fit this older synthetic child's dates.
    expect(checkedIn.newestUpgrade('family-world-b', 'v1', TEST_CHILD_A.birthDate, TODAY)).toBeNull();
  });

  it('keeps every photo and caption when the chapters match, and leaves the publication alone', async () => {
    const child = await childOnV1(context);
    let draft = await context.service.autoPick(child.id, ACTOR);
    draft = await context.service.setCaption(child.id, draft.revision, 'family-b1', 'minor-one', 'Pumpkin patch', ACTOR);
    const page = await context.service.suggestions(child.id, 'family-b2', 'minor-two');
    draft = await context.service.swap(child.id, draft.revision, 'family-b2', 'minor-two', page.suggestions[0]!.token, ACTOR);
    const published = await context.service.publish(child.id, draft.revision, randomUUID(), ACTOR);
    const before = assetsOf(context, draft);

    const result = await context.service.upgradeTemplate(child.id, {
      templateId: 'family-world-b',
      templateVersion: 'v2',
      expectedRevision: draft.revision,
    }, OTHER);
    expect(result).toMatchObject({ carried: 9, total: 9, needsPhoto: 0 });
    expect(result.draft).toMatchObject({ revision: draft.revision + 1, templateVersion: 'v2', publishable: true });
    expect(assetsOf(context, result.draft)).toEqual(before);
    expect(slot(result.draft, 'family-b1', 'minor-one')).toMatchObject({ caption: 'Pumpkin patch', captionEdited: true });
    expect(slot(result.draft, 'family-b2', 'minor-two')).toMatchObject({
      source: 'admin',
      localDate: page.suggestions[0]!.localDate,
    });
    expectNoUpstreamIds(result, context.assets);

    // Audited like other admin actions: the acting player on both rows.
    expect(await context.store.getChild(child.id)).toMatchObject({
      templateId: 'family-world-b', templateVersion: 'v2', revision: 1, updatedBy: OTHER, createdBy: ACTOR,
    });
    const stored = (await context.store.getDraft(child.id))!;
    expect(stored).toMatchObject({ templateVersion: 'v2', updatedBy: OTHER, seed: 'synthetic-seed-fixed-0001', rebasedOn: TODAY });

    // Publishing stays a separate step; the old publication is untouched.
    const latest = (await context.store.latestPublication(child.id))!;
    expect(latest).toMatchObject({ id: published.publicationId, revision: 1 });
    expect(latest.plan.template).toMatchObject({ id: 'family-world-b', version: 'v1' });
    const next = await context.service.publish(child.id, result.draft.revision, randomUUID(), OTHER);
    expect(next.revision).toBe(2);
    expect((await context.store.getPublication(next.publicationId))!.plan.template).toMatchObject({ version: 'v2' });
    expect((await context.store.getPublication(published.publicationId))!.plan).toEqual(latest.plan);
  });

  it('marks a kept slot needs-photo when its date no longer fits the slot', async () => {
    const child = await childOnV1(context);
    const draft = await context.service.autoPick(child.id, ACTOR);
    const before = assetsOf(context, draft);
    // A birthday later the final chapter closes on the seventh birthday, so the
    // sixth-birthday photo no longer fits its big memory.
    context.day.today = '2027-03-05';
    const result = await context.service.upgradeTemplate(child.id, {
      templateId: 'family-world-b',
      templateVersion: 'v2',
      expectedRevision: draft.revision,
    }, ACTOR);
    expect(result).toMatchObject({ carried: 8, total: 9, needsPhoto: 1 });
    const finale = result.draft.chapters[2]!;
    expect(finale).toMatchObject({ chapterId: 'family-b3', startAge: 4, recoveredAge: 7, targetDate: '2027-02-28' });
    expect(slot(result.draft, 'family-b3', 'major')).toMatchObject({
      status: 'needs-photo', localDate: null, caption: null, thumbnailToken: null, source: null,
    });
    const after = assetsOf(context, result.draft);
    expect({ ...after, 'family-b3:major': before['family-b3:major'] }).toEqual(before);
    expect(result.draft.publishable).toBe(false);
    await expect(context.service.publish(child.id, result.draft.revision, randomUUID(), ACTOR))
      .rejects.toMatchObject({ code: 'SLOTS_INCOMPLETE' });
  });

  it('auto-picks chapters whose age band changed around the kept chapter', async () => {
    const child = await childOnV1(context);
    let draft = await context.service.autoPick(child.id, ACTOR);
    draft = await context.service.setCaption(child.id, draft.revision, 'family-b1', 'major', 'Two candles', ACTOR);
    const before = assetsOf(context, draft);
    const result = await context.service.upgradeTemplate(child.id, {
      templateId: 'family-world-b',
      templateVersion: 'v3',
      expectedRevision: draft.revision,
    }, ACTOR);
    expect(result).toMatchObject({ carried: 3, total: 9, needsPhoto: 0 });
    expect(result.draft.chapters.map((chapter) => [chapter.chapterId, chapter.startAge, chapter.recoveredAge])).toEqual([
      ['family-b1', 0, 2],
      ['family-b2', 2, 5],
      ['family-b3', 5, 6],
    ]);
    const after = assetsOf(context, result.draft);
    for (const name of ['minor-one', 'minor-two', 'major']) {
      expect(after[`family-b1:${name}`]).toBe(before[`family-b1:${name}`]);
    }
    expect(slot(result.draft, 'family-b1', 'major')).toMatchObject({ caption: 'Two candles', captionEdited: true });
    expect(slot(result.draft, 'family-b2', 'major')).toMatchObject({
      status: 'filled', localDate: '2025-02-28', caption: 'Turning 5!', source: 'auto', captionEdited: false,
    });
    expect(slot(result.draft, 'family-b3', 'major')).toMatchObject({ localDate: '2026-02-28', caption: 'Turning 6!' });
    expect(slot(result.draft, 'family-b2', 'minor-one').localDate! > slot(result.draft, 'family-b1', 'major').localDate!)
      .toBe(true);
    expectChronological(result.draft);
    expect(new Set(Object.values(after)).size).toBe(9);
  });

  it('auto-picks a new chapter and keeps the unchanged ones', async () => {
    const child = await childOnV1(context);
    const draft = await context.service.autoPick(child.id, ACTOR);
    const before = assetsOf(context, draft);
    const result = await context.service.upgradeTemplate(child.id, {
      templateId: 'family-world-b',
      templateVersion: 'v4',
      expectedRevision: draft.revision,
    }, ACTOR);
    expect(result).toMatchObject({ carried: 6, total: 9, needsPhoto: 0 });
    expect(result.draft.chapters.map((chapter) => chapter.chapterId)).toEqual(['family-b1', 'family-b2', 'family-b3-encore']);
    const after = assetsOf(context, result.draft);
    for (const chapter of ['family-b1', 'family-b2']) {
      for (const name of ['minor-one', 'minor-two', 'major']) {
        expect(after[`${chapter}:${name}`]).toBe(before[`${chapter}:${name}`]);
      }
    }
    expect(slot(result.draft, 'family-b3-encore', 'major')).toMatchObject({ localDate: '2026-02-28', source: 'auto' });
    expect(slot(result.draft, 'family-b3-encore', 'minor-one').localDate! > slot(result.draft, 'family-b2', 'major').localDate!)
      .toBe(true);
    expectChronological(result.draft);
  });

  it('keeps a new opening chapter before the next chapter\'s kept photos', async () => {
    // No photos around the second birthday at first, so the opening's big memory
    // needs a photo; then two arrive and the administrator puts the earlier one
    // in chapter two. The new opening may not take the later one: it would come
    // after a kept photo of the next chapter.
    context = setup(syntheticLibrary(TEST_CHILD_B, { gaps: [['2022-02-28', '2022-05-29']] }));
    const child = await childOnV1(context);
    let draft = await context.service.autoPick(child.id, ACTOR);
    expect(slot(draft, 'family-b1', 'major').status).toBe('needs-photo');
    for (const date of ['2022-03-10', '2022-03-21']) {
      context.immich.assets.push({
        id: syntheticAssetId(),
        localDateTime: localNoon(date),
        people: [TEST_CHILD_B.personId],
        faces: [{ personId: TEST_CHILD_B.personId, box: [300, 150, 800, 700] }],
      });
    }
    const page = await context.service.suggestions(child.id, 'family-b2', 'minor-one');
    const early = page.suggestions.find((entry) => entry.localDate === '2022-03-10')!;
    draft = await context.service.swap(child.id, draft.revision, 'family-b2', 'minor-one', early.token, ACTOR);
    const result = await context.service.upgradeTemplate(child.id, {
      templateId: 'family-world-b',
      templateVersion: 'v5',
      expectedRevision: draft.revision,
    }, ACTOR);
    expect(result).toMatchObject({ carried: 6, needsPhoto: 1 });
    expect(slot(result.draft, 'family-b2', 'minor-one')).toMatchObject({ localDate: '2022-03-10', source: 'admin' });
    expect(slot(result.draft, 'family-b1-remix', 'major')).toMatchObject({ status: 'needs-photo', source: 'auto' });
    expectChronological(result.draft);
  });

  it('refuses another template, an older or equal version, an unknown version and one not offered', async () => {
    const child = await childOnV1(context);
    const draft = await context.service.autoPick(child.id, ACTOR);
    const upgrade = (templateId: string, templateVersion: string) => context.service.upgradeTemplate(
      child.id, { templateId, templateVersion, expectedRevision: draft.revision }, ACTOR);
    for (const [id, version] of [
      ['rat-casino-world', 'v2'],
      ['family-world-b', 'v1'],
      ['family-world-b', 'v9'],
      ['family-world-b', 'v12'],
    ] as const) {
      await expect(upgrade(id, version)).rejects.toMatchObject({ code: 'TEMPLATE_UPGRADE_UNAVAILABLE', status: 422 });
    }
    await expect(context.service.checkTemplateUpgrade(child.id, {
      templateId: 'family-world-b', templateVersion: 'v12', expectedRevision: draft.revision,
    })).rejects.toMatchObject({ code: 'TEMPLATE_UPGRADE_UNAVAILABLE' });
    const moved = await upgrade('family-world-b', 'v3');
    for (const version of ['v1', 'v2', 'v3']) {
      await expect(context.service.upgradeTemplate(child.id, {
        templateId: 'family-world-b', templateVersion: version, expectedRevision: moved.draft.revision,
      }, ACTOR)).rejects.toMatchObject({ code: 'TEMPLATE_UPGRADE_UNAVAILABLE' });
    }
    expect(await context.store.getChild(child.id)).toMatchObject({ templateVersion: 'v3', revision: 1 });
    await expect(context.service.upgradeTemplate(randomUUID(), {
      templateId: 'family-world-b', templateVersion: 'v4', expectedRevision: null,
    }, ACTOR)).rejects.toMatchObject({ code: 'CHILD_NOT_FOUND' });
  });

  it('updates a child with no draft yet by picking every chapter', async () => {
    const child = await childOnV1(context);
    const result = await context.service.upgradeTemplate(child.id, {
      templateId: 'family-world-b', templateVersion: 'v2', expectedRevision: null,
    }, ACTOR);
    expect(result).toMatchObject({ carried: 0, total: 9, needsPhoto: 0, draft: { revision: 0, templateVersion: 'v2' } });
    await expect(context.service.upgradeTemplate(child.id, {
      templateId: 'family-world-b', templateVersion: 'v3', expectedRevision: null,
    }, ACTOR)).rejects.toMatchObject({ code: 'DRAFT_CONFLICT' });
  });

  it('refuses a stale revision and lets only one of two racing updates land', async () => {
    const child = await childOnV1(context);
    const draft = await context.service.autoPick(child.id, ACTOR);
    const edited = await context.service.setCaption(child.id, draft.revision, 'family-b1', 'major', 'Two candles', ACTOR);
    await expect(context.service.upgradeTemplate(child.id, {
      templateId: 'family-world-b', templateVersion: 'v2', expectedRevision: draft.revision,
    }, ACTOR)).rejects.toMatchObject({ code: 'DRAFT_CONFLICT', status: 409 });
    expect(await context.store.getChild(child.id)).toMatchObject({ templateVersion: 'v1', revision: 0 });

    const request = { templateId: 'family-world-b', templateVersion: 'v2', expectedRevision: edited.revision };
    const results = await Promise.allSettled([
      context.service.upgradeTemplate(child.id, request, ACTOR),
      context.service.upgradeTemplate(child.id, request, OTHER),
    ]);
    expect(results.filter((entry) => entry.status === 'fulfilled')).toHaveLength(1);
    const refused = results.find((entry) => entry.status === 'rejected') as PromiseRejectedResult;
    expect(['CHILD_CONFLICT', 'DRAFT_CONFLICT']).toContain((refused.reason as { code: string }).code);
    expect(await context.store.getChild(child.id)).toMatchObject({ templateVersion: 'v2', revision: 1 });
    expect((await context.store.getDraft(child.id))!.revision).toBe(edited.revision + 1);
  });

  it('keeps the child and draft unchanged when an edit lands while chapters are being picked', async () => {
    const child = await childOnV1(context);
    const draft = await context.service.autoPick(child.id, ACTOR);
    const original = context.immich.request.bind(context.immich);
    let edited = false;
    context.immich.request = async (path, init) => {
      if (!edited && path.startsWith('/api/search/')) {
        edited = true;
        await context.service.setCaption(child.id, draft.revision, 'family-b1', 'major', 'Mid-update', ACTOR);
      }
      return original(path, init);
    };
    await expect(context.service.upgradeTemplate(child.id, {
      templateId: 'family-world-b', templateVersion: 'v3', expectedRevision: draft.revision,
    }, ACTOR)).rejects.toMatchObject({ code: 'DRAFT_CONFLICT' });
    expect(edited).toBe(true);
    expect(await context.store.getChild(child.id)).toMatchObject({ templateVersion: 'v1', revision: 0 });
    const stored = (await context.store.getDraft(child.id))!;
    expect(stored).toMatchObject({ templateVersion: 'v1', revision: draft.revision + 1 });
    expect(stored.slots.find((entry) => entry.chapterId === 'family-b1' && entry.slot === 'major')!.caption).toBe('Mid-update');
  });
});
