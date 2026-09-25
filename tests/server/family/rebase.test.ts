import { describe, expect, it } from 'vitest';
import ratCasinoWorldV2 from '../../../src/shared/levels/rat-casino-world-v2.json';
import {
  parseLevelEditorProject,
  validateLevelEditorProject,
  type LevelEditorProjectV2,
} from '../../../src/shared/editor-project.js';
import {
  FamilyRebaseError,
  familyWorldIssues,
  rebaseWorldForChild,
  templateAgeBands,
} from '../../../src/server/family/rebase.js';
import { FamilyTemplateRegistry } from '../../../src/server/family/templates.js';
import { TEST_CHILD_A, TEST_CHILD_B } from './fake-immich.js';

const TODAY = '2026-09-25';
const template = parseLevelEditorProject(ratCasinoWorldV2) as LevelEditorProjectV2;

describe('age-band rebase (DESIGN-024 D-03)', () => {
  it('derives template age bands from the fictional dates', () => {
    expect(templateAgeBands(template)).toEqual([
      { startAge: 0, recoveredAge: 4 },
      { startAge: 4, recoveredAge: 5 },
      { startAge: 5, recoveredAge: 6 },
    ]);
  });

  it('rebases Rat Casino v2 onto a February 29 birthday', () => {
    const world = rebaseWorldForChild(template, TEST_CHILD_B.birthDate, TODAY);
    expect(world.currentAge).toBe(6);
    expect(world.chapters.map(({ chapterId, startAge, recoveredAge, startDate, targetDate }) => ({
      chapterId, startAge, recoveredAge, startDate, targetDate,
    }))).toEqual([
      { chapterId: 'chapter-1', startAge: 0, recoveredAge: 4, startDate: '2020-02-29', targetDate: '2024-02-29' },
      { chapterId: 'chapter-2', startAge: 4, recoveredAge: 5, startDate: '2024-02-29', targetDate: '2025-02-28' },
      { chapterId: 'rat-casino', startAge: 5, recoveredAge: 6, startDate: '2025-02-28', targetDate: '2026-02-28' },
    ]);
    const chapters = world.project.chapters;
    expect(world.project.fictionalBirthDate).toBe(TEST_CHILD_B.birthDate);
    expect(chapters[1]!.representedDateRange).toEqual({ startDate: '2024-02-29', endDate: '2025-02-28' });
    expect(chapters[2]!.previewMemories[2].date).toBe('2026-02-28');
    for (const chapter of chapters) {
      const [one, two, major] = chapter.previewMemories;
      expect(one.date > chapter.representedDateRange.startDate).toBe(true);
      expect(two.date >= one.date && major.date >= two.date).toBe(true);
    }
    // Geometry, casts and names are the template's, untouched.
    expect(chapters.map((chapter) => chapter.level)).toEqual(template.chapters.map((chapter) => chapter.level));
    expect(chapters.map((chapter) => chapter.encounterSlots))
      .toEqual(template.chapters.map((chapter) => chapter.encounterSlots));
  });

  it('passes the full world validator once the leap-day age checks use the family rule', () => {
    const world = rebaseWorldForChild(template, TEST_CHILD_B.birthDate, TODAY);
    expect(familyWorldIssues(world.project)).toEqual([]);
    // The v1 whole-years rule alone would wait for March 1 in 2025 and 2026.
    expect(validateLevelEditorProject(world.project).map((issue) => `${issue.path}:${issue.code}`)).toEqual([
      '$.chapters[1].recoveredAge.toYears:age.major-date',
      '$.chapters[2].recoveredAge.fromYears:age.start-date',
      '$.chapters[2].recoveredAge.toYears:age.major-date',
    ]);
  });

  it('closes the final chapter on the most recent birthday', () => {
    const world = rebaseWorldForChild(template, '2020-01-15', '2027-03-01');
    expect(world.currentAge).toBe(7);
    expect(world.chapters.at(-1)).toMatchObject({
      startAge: 5,
      recoveredAge: 7,
      startDate: '2025-01-15',
      targetDate: '2027-01-15',
    });
    expect(world.project.chapters.at(-1)!.recoveredAge).toEqual({ fromYears: 5, toYears: 7 });
  });

  it('does not offer a template whose last age exceeds the child\'s age', () => {
    expect(() => rebaseWorldForChild(template, '2021-06-01', TODAY))
      .toThrow(expect.objectContaining({ code: 'TEMPLATE_AGE_UNAVAILABLE' }));
  });

  it('rejects a rebase whose casts are not eligible on the real chapter dates', () => {
    let failure: unknown;
    try {
      rebaseWorldForChild(template, TEST_CHILD_A.birthDate, TODAY);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(FamilyRebaseError);
    const rebaseError = failure as FamilyRebaseError;
    expect(rebaseError.code).toBe('WORLD_INVALID');
    expect(new Set(rebaseError.issues.map((issue) => issue.code))).toEqual(new Set(['encounter.date-eligibility']));
  });

  it('rejects invalid or future birthdays', () => {
    for (const birthDate of ['2020-02-30', '2027-01-01', 'yesterday']) {
      expect(() => rebaseWorldForChild(template, birthDate, TODAY))
        .toThrow(expect.objectContaining({ code: 'BIRTH_DATE_INVALID' }));
    }
  });
});

describe('family template registry', () => {
  const registry = new FamilyTemplateRegistry();

  it('resolves checked-in worlds by id and version', () => {
    const v1 = registry.require('rat-casino-world', 'v1');
    const v2 = registry.require('rat-casino-world', 'v2');
    expect(v1.project.chapters).toHaveLength(3);
    expect(v2.project.chapters[2]!.encounterSlots['bonus-1']).toBeDefined();
    expect(v1.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(v1.fingerprint).not.toBe(v2.fingerprint);
    expect(v2.finalAge).toBe(6);
    expect(registry.get('rat-casino-world', 'v9')).toBeNull();
    expect(() => registry.require('world-a', 'v1')).toThrow(expect.objectContaining({ code: 'TEMPLATE_UNKNOWN' }));
  });

  it('offers only templates that fit the child', () => {
    expect(registry.offeredFor(TEST_CHILD_B.birthDate, TODAY).map((entry) => entry.version)).toEqual(['v1', 'v2']);
    expect(registry.offeredFor(TEST_CHILD_A.birthDate, TODAY)).toEqual([]);
    expect(registry.offeredFor('2021-06-01', TODAY)).toEqual([]);
  });

  it('refuses duplicate keys and non-world projects', () => {
    expect(() => new FamilyTemplateRegistry([
      { id: 'rat-casino-world', version: 'v2', project: ratCasinoWorldV2 },
      { id: 'rat-casino-world', version: 'v2', project: ratCasinoWorldV2 },
    ])).toThrow('Duplicate');
    expect(() => new FamilyTemplateRegistry([{ id: 'Bad Id', version: 'v1', project: ratCasinoWorldV2 }]))
      .toThrow('Invalid family template key');
  });
});
