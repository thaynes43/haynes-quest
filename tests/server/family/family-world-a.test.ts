/**
 * World A, "Clubhouse to Casino" (family-world-a@v2, and v1 kept for the
 * journeys already published on it), as a family template: the registry
 * offers both to a synthetic eleven-year-old, the rebase validates, and a
 * published family-world-plan-v1 starts and plays its first chapter as a
 * household save in the in-memory stores. Every child, date and photo here is
 * synthetic.
 */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { GameplayAction, SaveView } from '../../../src/shared/contracts.js';
import type {
  AdminDraftResponse,
  FamilyPlayResponse,
  PersonChoice,
} from '../../../src/shared/family-api.js';
import { runAdminCommand } from '../../../src/server/admin.js';
import { validateFamilyWorldPlan } from '../../../src/server/family/plan.js';
import { rebaseWorldForChild } from '../../../src/server/family/rebase.js';
import { FamilyTemplateRegistry } from '../../../src/server/family/templates.js';
import { familyHarness, HARNESS_TODAY, type FamilyHarness } from './harness.js';
import {
  TEST_CHILD_A,
  TEST_CHILD_B,
  TEST_CHILD_C,
  syntheticLibrary,
} from './fake-immich.js';

const registry = new FamilyTemplateRegistry();
const CHAPTER_NAMES = [
  'The Toon Clubhouse',
  'Harbor Rescue',
  'Hero City',
  'Rat Casino After Hours',
];
const ROUTE_IDS = [
  'family-a1-clubhouse',
  'family-a2-harbor',
  'family-a3-rooftop',
  'family-a4-casino',
];

async function json<T>(response: Response | Promise<Response>, status: number): Promise<T> {
  const resolved = await response;
  const text = await resolved.text();
  if (resolved.status !== status) throw new Error(`Expected ${status}, got ${resolved.status}: ${text}`);
  return JSON.parse(text) as T;
}

function worldAHarness(): FamilyHarness {
  return familyHarness({
    people: [{ id: TEST_CHILD_C.personId, name: TEST_CHILD_C.name, birthDate: TEST_CHILD_C.birthDate }],
    assets: syntheticLibrary(TEST_CHILD_C),
  });
}

/** Admin creates Test Child C on World A, auto-picks and publishes. */
async function publishChildC(harness: FamilyHarness, templateVersion: string) {
  const { people } = await json<{ people: PersonChoice[] }>(
    harness.request(`/api/admin/immich/people?name=${encodeURIComponent(TEST_CHILD_C.name)}`), 200);
  expect(people).toEqual([expect.objectContaining({ label: TEST_CHILD_C.name, birthDate: TEST_CHILD_C.birthDate })]);
  const child = await json<{ id: string }>(harness.request('/api/admin/children', {
    body: {
      immichName: TEST_CHILD_C.name,
      personChoiceId: people[0]!.id,
      displayName: 'Test Child C',
      birthDate: TEST_CHILD_C.birthDate,
      templateId: 'family-world-a',
      templateVersion,
    },
  }), 201);
  await json(harness.request(`/api/admin/children/${child.id}/draft`, {
    method: 'PUT',
    body: { op: 'auto-pick', expectedRevision: null },
  }), 202);
  await harness.jobs.settled(child.id);
  const { draft } = await json<AdminDraftResponse>(harness.request(`/api/admin/children/${child.id}/draft`), 200);
  expect(draft).toMatchObject({ publishable: true });
  const publication = await json<{ publicationId: string; revision: number; chapterCount: number; memoryCount: number }>(
    harness.request(`/api/admin/children/${child.id}/publish`, {
      body: { expectedRevision: draft!.revision, requestId: randomUUID() },
    }), 201);
  return { childId: child.id, publication };
}

/**
 * v1's fingerprint when it was published (PR #94). A journey published on v1
 * froze this value, so v1 must never change.
 */
const V1_FINGERPRINT = 'b0bf1dc783d077b69765604cc6e933b779404c84686d076504cb52b844d53008';

describe('family-world-a@v2 template (World A)', () => {
  it('keeps v1 registered and byte-for-byte unchanged beside v2', () => {
    const v1 = registry.require('family-world-a', 'v1');
    const v2 = registry.require('family-world-a', 'v2');
    expect(v1.fingerprint).toBe(V1_FINGERPRINT);
    expect(v2.fingerprint).not.toBe(v1.fingerprint);
    expect(v2.project.name).toBe(v1.project.name);
    expect(v2.ageBands).toEqual(v1.ageBands);
    // v2 keeps every chapter's shell, cast, route and decor; only pieces change
    // (the full diff is pinned in tests/levels/family-world-a.test.ts).
    expect(v2.project.chapters.map((chapter) => ({ ...chapter, level: { ...chapter.level, pieces: [] } })))
      .toEqual(v1.project.chapters.map((chapter) => ({ ...chapter, level: { ...chapter.level, pieces: [] } })));
    const ids = (chapter: (typeof v1.project.chapters)[number]) => chapter.level.pieces.map((piece) => piece.id);
    expect(v1.project.chapters.map(ids).map((list, index) => list.filter((id) => !ids(v2.project.chapters[index]!).includes(id))))
      .toEqual([['mop-sweeper'], [], [], []]);
  });

  it.each(['v1', 'v2'])('%s is registered under its WORLD-SPEC name with four age bands ending at 11', (version) => {
    const template = registry.require('family-world-a', version);
    expect(template.project.name).toBe('Clubhouse to Casino');
    expect(template.project.catalogVersion).toBe('parody-catalog-v8');
    expect(template.project.fictionalBirthDate).toBe('2015-01-15');
    expect(template.project.chapters.map((chapter) => chapter.name)).toEqual(CHAPTER_NAMES);
    expect(template.ageBands.map((band) => [band.startAge, band.recoveredAge])).toEqual([
      [0, 2], [2, 5], [5, 9], [9, 11],
    ]);
    expect(template.finalAge).toBe(11);
    expect(template.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is offered to a synthetic eleven-year-old and rebases onto that birthday', () => {
    const offered = registry.offeredFor(TEST_CHILD_C.birthDate, HARNESS_TODAY).map((entry) => `${entry.id}@${entry.version}`);
    expect(offered).toContain('family-world-a@v1');
    expect(offered).toContain('family-world-a@v2');
    // Younger children cannot recover age 11 yet.
    for (const younger of [TEST_CHILD_A, TEST_CHILD_B])
      expect(registry.offeredFor(younger.birthDate, HARNESS_TODAY).map((entry) => entry.id)).not.toContain('family-world-a');

    const world = rebaseWorldForChild(registry.require('family-world-a', 'v2').project, TEST_CHILD_C.birthDate, HARNESS_TODAY);
    expect(world.chapters.map((chapter) => [chapter.chapterId, chapter.startDate, chapter.targetDate, chapter.recoveredAge])).toEqual([
      ['family-a1', '2015-03-10', '2017-03-10', 2],
      ['family-a2', '2017-03-10', '2020-03-10', 5],
      ['family-a3', '2020-03-10', '2024-03-10', 9],
      ['family-a4', '2024-03-10', '2026-03-10', 11],
    ]);
  });

  it.each(['v1', 'v2'])('%s publishes a valid family-world-plan-v1 and plays the first chapter in the memory stores', async (version) => {
    const harness = worldAHarness();
    const { templates } = await json<{ templates: Array<{ id: string; version: string; name: string; chapterCount: number }> }>(
      harness.request(`/api/admin/templates?birthDate=${TEST_CHILD_C.birthDate}`), 200);
    expect(templates).toContainEqual({ id: 'family-world-a', version, name: 'Clubhouse to Casino', chapterCount: 4 });

    const { childId, publication } = await publishChildC(harness, version);
    expect(publication).toMatchObject({ revision: 1, chapterCount: 4, memoryCount: 12 });
    const stored = (await harness.familyStore.getPublication(publication.publicationId))!;
    expect(validateFamilyWorldPlan(stored.plan, { birthDate: stored.birthDate, memories: stored.memories })).toEqual([]);
    expect(stored.plan).toMatchObject({
      catalogVersion: 'parody-catalog-v8',
      template: { id: 'family-world-a', version },
    });
    const levels = stored.plan.levels;
    expect(levels.map((level) => level.routeId)).toEqual(ROUTE_IDS);
    // The landed Blender boss is frozen by catalog identity; the gadget helper
    // stays a neutral candidate in all four ordinary slots.
    const clubhouse = levels[0]!;
    expect(clubhouse.encounters.at(-1)!.content).toEqual({
      catalogEntryId: 'clubhouse-bully-cat',
      catalogEntryVersion: 'v001',
      assetId: 'clubhouse-bully-cat',
      assetVersion: 'v001',
    });
    expect(clubhouse.encounters.slice(0, 4).map((encounter) => [encounter.kind, encounter.content.placeholder])).toEqual(
      Array.from({ length: 4 }, () => ['ordinary-a', 'neutral-candidate-v1']),
    );
    // The casino keeps its catalog cast; the Radio Showman is the optional fight.
    const casino = levels[3]!;
    expect(casino.encounters.map((encounter) => [encounter.content.catalogEntryId, encounter.content.placeholder ?? null])).toEqual([
      ['chick-flia', null],
      ['jackrabbit-drummer', null],
      ['fox-card-shark', null],
      ['moth-projectionist', null],
      ['rat-pit-boss', null],
      ['editor-candidate-radio-host-showman', 'neutral-candidate-v1'],
    ]);

    // Start the household run and play chapter one through the action route.
    const started = await json<FamilyPlayResponse>(harness.request(`/api/children/${childId}/play`, { as: 'member', body: {} }), 201);
    expect(started.save).toMatchObject({
      ageYears: 0,
      abilities: ['move', 'interact', 'jump'],
      versions: { journey: 'family-world-plan-v1' },
      adventure: { planVersion: 'family-world-plan-v1', activeLevelIndex: 0 },
    });
    expect(started.world).toMatchObject({ templateId: 'family-world-a', templateVersion: version });
    expect(started.world.chapters.map((chapter) => chapter.name)).toEqual(CHAPTER_NAMES);
    expect(started.world.chapters.map((chapter) => chapter.level.theme)).toEqual(['clubhouse', 'harbor', 'rooftop', 'casino']);

    let save = started.save;
    const level = save.adventure!.activeLevel!;
    expect(level.id).toBe('family-a1-clubhouse');
    const act = async (action: GameplayAction) => {
      harness.clock.time += 1_000;
      save = await json<SaveView>(harness.request(`/api/saves/${save.id}/actions`, {
        as: 'member',
        body: { actionId: randomUUID(), expectedRevision: save.revision, action },
      }), 200);
    };
    for (const pickup of level.pickups) await act({ type: 'collect-equipment', levelId: level.id, pickupId: pickup.pickupId });
    for (const memoryId of level.minorMemoryIds!) await act({ type: 'recover-memory', levelId: level.id, memoryId });
    const boss = () => save.adventure!.activeLevel!.encounters.find((encounter) => encounter.id === level.bossId)!;
    while (!boss().defeated) await act({ type: 'attack', levelId: level.id, encounterId: level.bossId });
    await act({ type: 'recover-memory', levelId: level.id, memoryId: level.majorMemoryId! });
    // Recovering "Turning 2!" unlocks the high jump for Harbor Rescue.
    expect(save).toMatchObject({
      ageYears: 2,
      abilities: ['move', 'interact', 'jump', 'high-jump'],
      adventure: { activeLevelIndex: 1 },
    });
    expect(save.adventure!.activeLevel!.id).toBe('family-a2-harbor');
    const persisted = await harness.questStore.getHouseholdSave(save.id);
    expect(persisted).toMatchObject({ id: save.id, ageYears: 2, publicationId: publication.publicationId });
    // No upstream person or asset id reaches the plan or the save.
    const serialized = JSON.stringify([stored.plan, save, started.world]);
    expect(serialized).not.toContain(TEST_CHILD_C.personId);
    for (const asset of harness.assets) expect(serialized).not.toContain(asset.id);
  });
  it('moves a child published on v1 onto v2: the draft carries over, the started run keeps v1 and a fresh run plays v2', async () => {
    const harness = worldAHarness();
    const { childId, publication } = await publishChildC(harness, 'v1');
    const started = await json<FamilyPlayResponse>(harness.request(`/api/children/${childId}/play`, { as: 'member', body: {} }), 201);
    expect(started.world).toMatchObject({ templateId: 'family-world-a', templateVersion: 'v1' });

    const lines: string[] = [];
    const run = (...argv: string[]) => runAdminCommand(argv, {
      service: harness.service,
      store: harness.familyStore,
      media: harness.library,
    }, (line) => lines.push(line));
    expect(await run('set-template', '--child', childId, '--template', 'family-world-a@v2')).toBe(0);
    expect(await run('publish', '--child', childId)).toBe(0);
    expect(await run('status')).toBe(0);
    expect(lines[0]).toBe('draft r1 carried 12/12 needs-photo 0');
    expect(lines[1]).toMatch(/^publication [0-9a-f-]{36} r2 chapters 4 memories 12$/);
    expect(lines.slice(2)).toEqual(['children 1', `child ${childId} template family-world-a@v2 draft r1 filled 12/12 publication r2`]);
    // v2 is now the child's version, so there is nothing newer to move to (D-11).
    await expect(run('set-template', '--child', childId, '--template', 'family-world-a@v2'))
      .rejects.toMatchObject({ code: 'TEMPLATE_UPGRADE_UNAVAILABLE' });
    await expect(run('set-template', '--child', childId, '--template', 'family-world-a@v1'))
      .rejects.toMatchObject({ code: 'TEMPLATE_UPGRADE_UNAVAILABLE' });

    const first = (await harness.familyStore.getPublication(publication.publicationId))!;
    const latest = (await harness.familyStore.latestPublication(childId))!;
    expect(latest.plan.template).toEqual({
      id: 'family-world-a',
      version: 'v2',
      fingerprint: registry.require('family-world-a', 'v2').fingerprint,
    });
    expect(validateFamilyWorldPlan(latest.plan, { birthDate: latest.birthDate, memories: latest.memories })).toEqual([]);
    // The same photos and captions carry over to v2.
    expect(latest.memories).toEqual(first.memories);

    // The started run keeps its frozen v1 publication until an administrator
    // starts a fresh run on the newer one.
    const resumed = await json<FamilyPlayResponse>(harness.request(`/api/children/${childId}/play`, { as: 'member', body: {} }), 200);
    expect(resumed.world).toMatchObject({ templateVersion: 'v1' });
    const fresh = await json<FamilyPlayResponse>(
      harness.request(`/api/children/${childId}/play`, { as: 'admin', body: { fresh: true } }), 201);
    expect(fresh.world).toMatchObject({ templateId: 'family-world-a', templateVersion: 'v2' });
    expect(fresh.save).toMatchObject({ ageYears: 0, adventure: { activeLevelIndex: 0 } });
    // The operator output never names the child or an upstream id.
    const everything = lines.join('\n');
    expect(everything).not.toContain(TEST_CHILD_C.personId);
    expect(everything).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('refuses a template the child cannot move to and leaves the child unchanged', async () => {
    const harness = worldAHarness();
    const { childId } = await publishChildC(harness, 'v1');
    const expectedRevision = (await harness.familyStore.getDraft(childId))!.revision;
    for (const [templateId, templateVersion] of [['family-world-a', 'v9'], ['family-world-b', 'v2'], ['family-world-a', 'v1']]) {
      await expect(harness.service.upgradeTemplate(childId, { templateId: templateId!, templateVersion: templateVersion!, expectedRevision }, null))
        .rejects.toMatchObject({ code: 'TEMPLATE_UPGRADE_UNAVAILABLE' });
    }
    expect(await harness.familyStore.getChild(childId)).toMatchObject({ templateVersion: 'v1', revision: 0 });
  });
});
