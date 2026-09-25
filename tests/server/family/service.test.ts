import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { ImmichPhotoSource } from '../../../src/server/photos/immich.js';
import { InMemoryFamilyStore } from '../../../src/server/family/memory-store.js';
import { validateFamilyWorldPlan } from '../../../src/server/family/plan.js';
import { FamilyJourneyService, type DraftView } from '../../../src/server/family/service.js';
import { FamilyTemplateRegistry } from '../../../src/server/family/templates.js';
import { CandidateTokens } from '../../../src/server/family/tokens.js';
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

const SECRET = 'synthetic-subject-id-key-with-at-least-32-bytes';
const TODAY = '2026-09-25';
const ACTOR = '30000000-0000-4000-8000-000000000001';
const registry = new FamilyTemplateRegistry();

function setup(assets: FakeAsset[] = syntheticLibrary()) {
  const clock = new FakeClock();
  const immich = new FakeImmich([
    { id: TEST_CHILD_B.personId, name: TEST_CHILD_B.name, birthDate: TEST_CHILD_B.birthDate },
    { id: TEST_CHILD_A.personId, name: TEST_CHILD_A.name, birthDate: TEST_CHILD_A.birthDate },
    { id: '00000000-0000-4000-8000-0000000000c1', name: 'Test Twin' },
    { id: '00000000-0000-4000-8000-0000000000c2', name: 'test twin' },
  ], assets, clock);
  const library = new ImmichPhotoSource(immich, SECRET, 'test-connection');
  const store = new InMemoryFamilyStore();
  const tokens = new CandidateTokens(SECRET, { now: () => clock.now() });
  const service = new FamilyJourneyService({
    store,
    library,
    templates: registry,
    tokens,
    clock,
    today: () => TODAY,
    newSeed: () => 'synthetic-seed-fixed-0001',
  });
  return { clock, immich, library, store, tokens, service, assets };
}

type Context = ReturnType<typeof setup>;

async function createChildB(context: Context) {
  const [person] = await context.service.lookupPeople(TEST_CHILD_B.name);
  return context.service.createChild({
    immichName: TEST_CHILD_B.name,
    personChoiceId: person!.id,
    displayName: 'Test Child B',
    birthDate: TEST_CHILD_B.birthDate,
    templateId: 'rat-casino-world',
    templateVersion: 'v2',
  }, ACTOR);
}

function slot(view: DraftView, chapterId: string, name: string) {
  return view.chapters.find((chapter) => chapter.chapterId === chapterId)!.slots.find((entry) => entry.slot === name)!;
}

function expectNoUpstreamIds(value: unknown, assets: FakeAsset[]) {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain(TEST_CHILD_B.personId);
  expect(serialized).not.toContain(TEST_CHILD_A.personId);
  for (const asset of assets) expect(serialized).not.toContain(asset.id);
}

describe('family journey service', () => {
  let context: Context;
  beforeEach(() => {
    context = setup();
  });

  it('looks people up as opaque choices with the entered birthday', async () => {
    const people = await context.service.lookupPeople('  test child b ');
    expect(people).toEqual([{ id: expect.stringMatching(/^person-[a-f0-9]{32}$/), label: 'Test Child B', birthDate: '2020-02-29' }]);
    expect(await context.service.lookupPeople('Test Twin')).toHaveLength(2);
    expect(await context.service.lookupPeople('Nobody Synthetic')).toEqual([]);
    expectNoUpstreamIds(people, []);
  });

  it('offers only templates that fit the birthday', () => {
    expect(context.service.offeredTemplates(TEST_CHILD_B.birthDate).map((offer) => offer.version)).toEqual(['v1', 'v2']);
    expect(context.service.offeredTemplates(TEST_CHILD_A.birthDate)).toEqual([]);
  });

  it('creates a child only from a resolved choice, a valid birthday and an offered template', async () => {
    const child = await createChildB(context);
    expect(child).toMatchObject({ displayName: 'Test Child B', birthDate: '2020-02-29', templateVersion: 'v2', revision: 0 });
    expectNoUpstreamIds(child, []);
    await expect(createChildB(context)).rejects.toMatchObject({ code: 'CHILD_EXISTS' });
    const [personA] = await context.service.lookupPeople(TEST_CHILD_A.name);
    const base = {
      immichName: TEST_CHILD_A.name,
      personChoiceId: personA!.id,
      displayName: 'Test Child A',
      birthDate: TEST_CHILD_A.birthDate,
      templateId: 'rat-casino-world',
      templateVersion: 'v2',
    };
    await expect(context.service.createChild(base, ACTOR)).rejects.toMatchObject({ code: 'TEMPLATE_NOT_OFFERED' });
    await expect(context.service.createChild({ ...base, birthDate: '2020-03-01', personChoiceId: 'person-forged' }, ACTOR))
      .rejects.toMatchObject({ code: 'SUBJECT_UNRESOLVED' });
    await expect(context.service.createChild({ ...base, birthDate: '2030-01-01' }, ACTOR))
      .rejects.toMatchObject({ code: 'INVALID_BIRTH_DATE' });
    await expect(context.service.createChild({ ...base, birthDate: '2020-03-01', displayName: ' ' }, ACTOR))
      .rejects.toMatchObject({ code: 'INVALID_DISPLAY_NAME' });
  });

  it('rebases and auto-picks every memory into an admin-safe draft view', async () => {
    const child = await createChildB(context);
    const draft = await context.service.autoPick(child.id, ACTOR);
    expect(draft).toMatchObject({ revision: 0, publishable: true, templateId: 'rat-casino-world' });
    expect(draft.chapters.map((chapter) => [chapter.name, chapter.startAge, chapter.recoveredAge, chapter.targetDate])).toEqual([
      ['The Block Party', 0, 4, '2024-02-29'],
      ['Besties Obby', 4, 5, '2025-02-28'],
      ['Haynesnightmares: Rat Casino', 5, 6, '2026-02-28'],
    ]);
    expect(slot(draft, 'chapter-2', 'major')).toMatchObject({
      status: 'filled', localDate: '2025-02-28', ageYears: 5, caption: 'Turning 5!', source: 'auto',
    });
    expect(slot(draft, 'chapter-1', 'minor-one').caption).toMatch(/^(Winter|Spring|Summer|Fall) 20\d\d · age \d$/);
    for (const chapter of draft.chapters) {
      for (const entry of chapter.slots) {
        expect(context.tokens.verify(entry.thumbnailToken, draft.draftId)).toMatchObject({ localDate: entry.localDate });
      }
    }
    expectNoUpstreamIds(draft, context.assets);
    // Re-running keeps the seed, so the picks are stable.
    const again = await context.service.autoPick(child.id, ACTOR);
    const picks = (view: DraftView) => view.chapters.flatMap((chapter) =>
      chapter.slots.map((entry) => context.tokens.verify(entry.thumbnailToken)!.assetId));
    expect(again.revision).toBe(1);
    expect(picks(again)).toEqual(picks(draft));
  });

  it('edits captions with compare-and-set', async () => {
    const child = await createChildB(context);
    const draft = await context.service.autoPick(child.id, ACTOR);
    const edited = await context.service.setCaption(child.id, draft.revision, 'chapter-1', 'minor-two', '  First   snow  ', ACTOR);
    expect(slot(edited, 'chapter-1', 'minor-two')).toMatchObject({ caption: 'First snow', captionEdited: true });
    await expect(context.service.setCaption(child.id, draft.revision, 'chapter-1', 'minor-two', 'Stale', ACTOR))
      .rejects.toMatchObject({ code: 'DRAFT_CONFLICT' });
    await expect(context.service.setCaption(child.id, edited.revision, 'chapter-1', 'minor-two', 'x'.repeat(61), ACTOR))
      .rejects.toMatchObject({ code: 'CAPTION_TOO_LONG' });
    await expect(context.service.setCaption(child.id, edited.revision, 'chapter-9', 'major', 'Hi', ACTOR))
      .rejects.toMatchObject({ code: 'SLOT_NOT_FOUND' });
  });

  it('swaps a slot through a Show more suggestion and rejects foreign or stale tokens', async () => {
    const child = await createChildB(context);
    const draft = await context.service.autoPick(child.id, ACTOR);
    const page = await context.service.suggestions(child.id, 'chapter-2', 'minor-one');
    expect(page.suggestions.length).toBeGreaterThan(1);
    expect(page.nextCursor).toBe(2);
    expectNoUpstreamIds(page, context.assets);
    const choice = page.suggestions[1]!;
    const swapped = await context.service.swap(child.id, draft.revision, 'chapter-2', 'minor-one', choice.token, ACTOR);
    expect(slot(swapped, 'chapter-2', 'minor-one')).toMatchObject({
      localDate: choice.localDate,
      ageYears: choice.ageYears,
      source: 'admin',
      captionEdited: false,
    });
    const earlier = await context.service.suggestions(child.id, 'chapter-1', 'minor-one');
    await expect(context.service.swap(child.id, swapped.revision, 'chapter-2', 'minor-one', earlier.suggestions[0]!.token, ACTOR))
      .rejects.toMatchObject({ code: 'CANDIDATE_OUT_OF_RANGE' });
    const foreign = context.tokens.issue({ draftId: randomUUID(), assetId: context.assets[0]!.id, localDate: choice.localDate });
    await expect(context.service.swap(child.id, swapped.revision, 'chapter-2', 'minor-one', foreign, ACTOR))
      .rejects.toMatchObject({ code: 'CANDIDATE_INVALID' });
    const later = await context.service.suggestions(child.id, 'chapter-2', 'minor-one');
    context.clock.time += 16 * 60_000;
    await expect(context.service.swap(child.id, swapped.revision, 'chapter-2', 'minor-one', later.suggestions[0]!.token, ACTOR))
      .rejects.toMatchObject({ code: 'CANDIDATE_INVALID' });
  });

  it('resolves thumbnail tokens to the private asset server-side only', async () => {
    const child = await createChildB(context);
    const draft = await context.service.autoPick(child.id, ACTOR);
    const token = slot(draft, 'rat-casino', 'major').thumbnailToken;
    const resolved = await context.service.resolveCandidate(token);
    expect(resolved).toMatchObject({ childId: child.id, personId: TEST_CHILD_B.personId, localDate: '2026-02-28' });
    expect(context.assets.some((asset) => asset.id === resolved.assetId)).toBe(true);
    await expect(context.service.resolveCandidate('ct1.bogus')).rejects.toMatchObject({ code: 'MEDIA_NOT_FOUND' });
  });

  it('blocks publishing on a needs-photo slot until an administrator fills it', async () => {
    context = setup(syntheticLibrary(TEST_CHILD_B, { gaps: [['2024-03-01', '2025-02-27']] }));
    const child = await createChildB(context);
    const draft = await context.service.autoPick(child.id, ACTOR);
    expect(draft.publishable).toBe(false);
    expect(slot(draft, 'chapter-2', 'minor-one')).toMatchObject({ status: 'needs-photo', thumbnailToken: null });
    await expect(context.service.publish(child.id, draft.revision, randomUUID(), ACTOR))
      .rejects.toMatchObject({ code: 'SLOTS_INCOMPLETE', message: 'Photos needed: chapter-2' });
    await expect(context.service.setCaption(child.id, draft.revision, 'chapter-2', 'minor-one', 'Hi', ACTOR))
      .rejects.toMatchObject({ code: 'SLOT_EMPTY' });
    // New photos arrive in Immich; the administrator fills both slots by hand.
    for (const date of ['2024-06-01', '2024-11-01']) {
      context.immich.assets.push({
        id: syntheticAssetId(),
        localDateTime: localNoon(date),
        people: [TEST_CHILD_B.personId],
        faces: [{ personId: TEST_CHILD_B.personId, box: [300, 150, 800, 700] }],
      });
    }
    let current = draft;
    const one = await context.service.suggestions(child.id, 'chapter-2', 'minor-one');
    current = await context.service.swap(child.id, current.revision, 'chapter-2', 'minor-one',
      one.suggestions.find((entry) => entry.localDate === '2024-06-01')!.token, ACTOR);
    const two = await context.service.suggestions(child.id, 'chapter-2', 'minor-two');
    expect(two.suggestions.map((entry) => entry.localDate)).toEqual(['2024-11-01']);
    current = await context.service.swap(child.id, current.revision, 'chapter-2', 'minor-two', two.suggestions[0]!.token, ACTOR);
    expect(current.publishable).toBe(true);
    const published = await context.service.publish(child.id, current.revision, randomUUID(), ACTOR);
    expect(published).toMatchObject({ revision: 1, chapterCount: 3, memoryCount: 9 });
  });

  it('publishes a valid frozen plan idempotently and revises it later', async () => {
    const child = await createChildB(context);
    const draft = await context.service.autoPick(child.id, ACTOR);
    const requestId = randomUUID();
    const first = await context.service.publish(child.id, draft.revision, requestId, ACTOR);
    expect(first).toMatchObject({ childId: child.id, revision: 1, chapterCount: 3, memoryCount: 9 });
    expect(await context.service.publish(child.id, draft.revision, requestId.toUpperCase(), ACTOR)).toEqual(first);
    const stored = (await context.store.getPublication(first.publicationId))!;
    expect(validateFamilyWorldPlan(stored.plan, { birthDate: stored.birthDate, memories: stored.memories })).toEqual([]);
    expectNoUpstreamIds(stored.plan, context.assets);
    expectNoUpstreamIds(first, context.assets);
    expect(stored.plan.levels[1]!.memorySlots[2]).toMatchObject({ date: '2025-02-28', ageYears: 5, caption: 'Turning 5!' });

    const edited = await context.service.setCaption(child.id, draft.revision, 'rat-casino', 'major', 'Six and brave!', ACTOR);
    const second = await context.service.publish(child.id, edited.revision, randomUUID(), ACTOR);
    expect(second.revision).toBe(2);
    expect((await context.service.latestPublications()).map((entry) => entry.publicationId)).toEqual([second.publicationId]);
    // The first revision stays frozen for any run that started on it.
    expect((await context.store.getPublication(first.publicationId))!.plan).toEqual(stored.plan);
    await expect(context.service.publish(child.id, edited.revision, 'not-a-uuid', ACTOR))
      .rejects.toMatchObject({ code: 'INVALID_REQUEST_ID' });
  });

  it('refuses to publish a draft made for a different birthday', async () => {
    const child = await createChildB(context);
    const draft = await context.service.autoPick(child.id, ACTOR);
    await context.store.updateChild(child.id, child.revision, { birthDate: '2020-03-01' }, ACTOR);
    await expect(context.service.publish(child.id, draft.revision, randomUUID(), ACTOR))
      .rejects.toMatchObject({ code: 'DRAFT_STALE' });
  });

  it('reports an unavailable Immich without saving a draft', async () => {
    const child = await createChildB(context);
    context.immich.unavailable = true;
    await expect(context.service.autoPick(child.id, ACTOR)).rejects.toMatchObject({ code: 'IMMICH_UNAVAILABLE' });
    expect(await context.store.getDraft(child.id)).toBeNull();
  });
});
