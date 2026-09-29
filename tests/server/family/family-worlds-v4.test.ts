/**
 * `family-world-a@v4` and `family-world-b@v4` (DESIGN-027 D-08): the v3 worlds
 * with the scare levels as template content. A4 (Rat Casino After Hours) is
 * scary (2), A3 (Hero City) and B3 (Besties' Big Stage) are spooky (1), and
 * every other chapter stays at 0 with no field. v1 to v3 stay registered with
 * their published fingerprints; v4 is offered to exactly the children v3 is,
 * rebases onto the same chapters, and **Update world** (DESIGN-024 D-11) moves
 * a child from v3 to v4 carrying every photo and caption into a plan that
 * freezes each chapter's scare level with its geometry. Every child, birthday
 * and photo here is synthetic.
 */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { addDays } from '../../../src/shared/family-plan.js';
import { validateFamilyWorldPlan } from '../../../src/server/family/plan.js';
import { rebaseWorldForChild } from '../../../src/server/family/rebase.js';
import { FamilyTemplateRegistry } from '../../../src/server/family/templates.js';
import { familyHarness, HARNESS_TODAY } from './harness.js';
import { TEST_CHILD_B, TEST_CHILD_C, syntheticLibrary } from './fake-immich.js';

const registry = new FamilyTemplateRegistry();
const ACTOR = '30000000-0000-4000-8000-000000000001';

/** Fingerprints the published journeys froze; these versions never change. */
const FROZEN_FINGERPRINTS: Record<string, string> = {
  'family-world-a@v1': 'b0bf1dc783d077b69765604cc6e933b779404c84686d076504cb52b844d53008',
  'family-world-a@v2': 'ceb086efa885920168b5227e52de24b805ebabdc47d1894f1d92a0b14500a3c5',
  'family-world-a@v3': '1725587923dce4cfe7e28d2bc04b85e1aea13cf7185c0e6eaec525d0a633c8ca',
  'family-world-b@v1': '57bf3173a9951cf9987d503a47406a268f00b7eb970f038cfd7ac7394f730a69',
  'family-world-b@v2': 'aa8c85a2fc59c4d6cbc0c626f66403fc8cfd4d5b6f29c36d1daeb66e4ef48d27',
  'family-world-b@v3': 'a89c401dc79f58dc6ba738a38a831bc9b1253a130ac7a6dad7aee278a96caae1',
};

/** Per world: the synthetic child, the photo count and each chapter's scare level. */
const WORLDS = {
  'family-world-a': {
    child: TEST_CHILD_C,
    memories: 12,
    // Birthdays around World A's window (see family-worlds-v3.test.ts).
    edges: ['2013-12-13', '2013-12-14', '2015-09-25', '2015-09-26'],
    sweep: ['2013-06-01', '2016-03-01'] as const,
    scare: [undefined, undefined, 1, 2],
  },
  'family-world-b': {
    child: TEST_CHILD_B,
    memories: 9,
    edges: ['2018-07-30', '2018-07-31', '2020-09-25', '2020-09-26'],
    sweep: ['2017-09-01', '2021-01-01'] as const,
    scare: [undefined, undefined, 1],
  },
} as const;

type WorldId = keyof typeof WORLDS;

function birthdays(world: WorldId): string[] {
  const { sweep, edges } = WORLDS[world];
  const out: string[] = [...edges];
  for (let date: string = sweep[0]; date < sweep[1]; date = addDays(date, 23)) out.push(date);
  return out;
}

describe.each(Object.keys(WORLDS) as WorldId[])('%s@v4', (world) => {
  const spec = WORLDS[world];
  const v3 = registry.require(world, 'v3');
  const v4 = registry.require(world, 'v4');

  it('is registered beside the frozen v1 to v3, whose fingerprints are unchanged', () => {
    expect(registry.list().filter((entry) => entry.id === world).map((entry) => entry.version)).toEqual(
      world === 'family-world-a' ? ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7'] : ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'],
    );
    for (const version of ['v1', 'v2', 'v3']) expect(registry.require(world, version).fingerprint).toBe(FROZEN_FINGERPRINTS[`${world}@${version}`]);
    expect(v4.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.values(FROZEN_FINGERPRINTS)).not.toContain(v4.fingerprint);
    // Same catalog, name, chapter ids and age bands, so Update world keeps every chapter (D-11).
    expect(v4.project.catalogVersion).toBe('parody-catalog-v10');
    expect(v4.project.name).toBe(v3.project.name);
    expect(v4.project.chapters.map((chapter) => chapter.chapterId)).toEqual(v3.project.chapters.map((chapter) => chapter.chapterId));
    expect(v4.ageBands).toEqual(v3.ageBands);
  });

  it('declares the DESIGN-027 scare levels and changes nothing else', () => {
    expect(v4.project.chapters.map((chapter) => chapter.level.scare)).toEqual(spec.scare);
    expect(v3.project.chapters.every((chapter) => !('scare' in chapter.level))).toBe(true);
    const withoutScare = v4.project.chapters.map((chapter) => {
      const { scare: _scare, ...level } = chapter.level;
      return { ...chapter, level };
    });
    expect(withoutScare).toEqual(v3.project.chapters);
    expect({ ...v4.project, chapters: [] }).toEqual({ ...v3.project, chapters: [] });
  });

  it('is offered to exactly the children v3 is offered to', () => {
    const pair = new FamilyTemplateRegistry([
      { id: world, version: 'v3', project: v3.project },
      { id: world, version: 'v4', project: v4.project },
    ]);
    let offered = 0;
    for (const birthDate of birthdays(world)) {
      const versions = pair.offeredFor(birthDate, HARNESS_TODAY).map((entry) => entry.version);
      expect(versions.includes('v4'), birthDate).toBe(versions.includes('v3'));
      if (versions.includes('v4')) offered += 1;
    }
    expect(offered).toBeGreaterThan(10);
    const [before, first, last, after] = spec.edges;
    expect(pair.offeredFor(before, HARNESS_TODAY)).toEqual([]);
    expect(pair.offeredFor(first, HARNESS_TODAY).map((entry) => entry.version)).toEqual(['v3', 'v4']);
    expect(pair.offeredFor(last, HARNESS_TODAY).map((entry) => entry.version)).toEqual(['v3', 'v4']);
    expect(pair.offeredFor(after, HARNESS_TODAY)).toEqual([]);
    // Newest offered version supersedes v4; historical v4 content stays frozen.
    const newest = world === 'family-world-a' ? 'v7' : 'v6';
    for (const version of ['v1', 'v2', 'v3'])
      expect(registry.newestUpgrade(world, version, spec.child.birthDate, HARNESS_TODAY)?.version, version).toBe(newest);
    expect(registry.newestUpgrade(world, 'v4', spec.child.birthDate, HARNESS_TODAY)?.version).toBe(newest);
  });

  it('rebases onto the synthetic birthday exactly as v3 does', () => {
    const rebased = (project: typeof v3.project) =>
      rebaseWorldForChild(project, spec.child.birthDate, HARNESS_TODAY).chapters.map((chapter) =>
        [chapter.chapterId, chapter.startAge, chapter.recoveredAge, chapter.startDate, chapter.targetDate]);
    expect(rebased(v4.project)).toEqual(rebased(v3.project));
  });

  it('moves a child from v3 to v4 with Update world, carrying every photo, and freezes the scare levels', async () => {
    const harness = familyHarness({
      people: world === 'family-world-a'
        ? [{ id: TEST_CHILD_C.personId, name: TEST_CHILD_C.name, birthDate: TEST_CHILD_C.birthDate }]
        : [],
      assets: syntheticLibrary(spec.child),
    });
    const [person] = await harness.service.lookupPeople(spec.child.name);
    const child = await harness.service.createChild({
      immichName: spec.child.name,
      personChoiceId: person!.id,
      displayName: 'Synthetic Child',
      birthDate: spec.child.birthDate,
      templateId: world,
      templateVersion: 'v3',
    }, ACTOR);
    const picked = await harness.service.autoPick(child.id, ACTOR);
    expect(picked).toMatchObject({ publishable: true, templateVersion: 'v3' });
    const first = await harness.service.publish(child.id, picked.revision, randomUUID(), ACTOR);
    const firstPublication = (await harness.familyStore.getPublication(first.publicationId))!;
    // The v3 plan has no scare level anywhere.
    expect(firstPublication.plan.levels.every((level) => !('scare' in level.authoredLevel))).toBe(true);

    const result = await harness.service.upgradeTemplate(child.id, {
      templateId: world,
      templateVersion: 'v4',
      expectedRevision: picked.revision,
    }, ACTOR);
    expect(result).toMatchObject({ carried: spec.memories, total: spec.memories, needsPhoto: 0 });
    expect(result.draft).toMatchObject({ templateVersion: 'v4', publishable: true });
    await harness.service.publish(child.id, result.draft.revision, randomUUID(), ACTOR);
    const latest = (await harness.familyStore.latestPublication(child.id))!;
    expect(latest.plan.template).toEqual({ id: world, version: 'v4', fingerprint: v4.fingerprint });
    expect(latest.plan.catalogVersion).toBe('parody-catalog-v10');
    // The same photos and captions, and no upstream id in the plan.
    expect(latest.memories).toEqual(firstPublication.memories);
    expect(validateFamilyWorldPlan(latest.plan, { birthDate: latest.birthDate, memories: latest.memories })).toEqual([]);
    const serialized = JSON.stringify(latest.plan);
    expect(serialized).not.toContain(spec.child.personId);
    for (const asset of harness.assets) expect(serialized).not.toContain(asset.id);

    // The plan freezes each chapter's scare level with its geometry; the cast,
    // encounters and every other field are exactly v3's.
    expect(latest.plan.levels.map((level) => level.authoredLevel.scare)).toEqual(spec.scare);
    expect(latest.plan.levels.map((level) => {
      const { scare: _scare, ...authoredLevel } = level.authoredLevel;
      return { ...level, authoredLevel };
    })).toEqual(firstPublication.plan.levels);
    expect(latest.plan.projectFingerprint).not.toBe(firstPublication.plan.projectFingerprint);

    // The scare level is covered by the geometry fingerprint: dropping or
    // raising it in a stored plan fails validation.
    const tampered = (scare: 0 | 2) => ({
      ...latest.plan,
      levels: latest.plan.levels.map((level, index) => {
        if (index !== 2) return level;
        const { scare: _scare, ...authoredLevel } = level.authoredLevel;
        return { ...level, authoredLevel: scare === 0 ? authoredLevel : { ...authoredLevel, scare } };
      }),
    });
    for (const scare of [0, 2] as const)
      expect(validateFamilyWorldPlan(tampered(scare), { birthDate: latest.birthDate, memories: latest.memories }))
        .toContain('plan.geometry-fingerprint');
  });
});
