import { describe, expect, it } from 'vitest';
import {
  FAMILY_ABILITY_LADDER,
  abilitiesAtAge,
  addDays,
  daysBetween,
  defaultCaption,
  familyAnniversary,
  familyWholeYearsAt,
  freezeAbilityLadder,
  normalizeCaption,
  type AbilityLadderSource,
} from '../../../src/shared/family-plan.js';
import { wholeYearsAt } from '../../../src/server/domain.js';

describe('family age rule (DESIGN-024 D-03)', () => {
  it('celebrates a February 29 birthday on February 28 in common years', () => {
    expect(familyAnniversary('2016-02-29', 0)).toBe('2016-02-29');
    expect(familyAnniversary('2016-02-29', 1)).toBe('2017-02-28');
    expect(familyAnniversary('2016-02-29', 4)).toBe('2020-02-29');
    expect(familyAnniversary('2016-02-29', 5)).toBe('2021-02-28');
    expect(familyAnniversary('2020-06-15', 3)).toBe('2023-06-15');
  });

  it('counts whole years with the February 28 anniversary', () => {
    expect(familyWholeYearsAt('2016-02-29', '2017-02-27')).toBe(0);
    expect(familyWholeYearsAt('2016-02-29', '2017-02-28')).toBe(1);
    expect(familyWholeYearsAt('2016-02-29', '2020-02-28')).toBe(3);
    expect(familyWholeYearsAt('2016-02-29', '2020-02-29')).toBe(4);
    expect(familyWholeYearsAt('2016-02-29', '2026-09-25')).toBe(10);
    expect(() => familyWholeYearsAt('2016-02-29', '2016-02-28')).toThrow(RangeError);
  });

  it('matches the v1 rule for every birthday except a common-year leap anniversary', () => {
    for (const [birth, date] of [
      ['2020-01-01', '2024-01-01'],
      ['2020-06-15', '2025-06-14'],
      ['2016-02-29', '2020-02-29'],
      ['2016-02-29', '2021-03-01'],
    ] as const) {
      expect(familyWholeYearsAt(birth, date)).toBe(wholeYearsAt(birth, date));
    }
    // The only divergence, by design: the v1 rule waits for March 1.
    expect(wholeYearsAt('2016-02-29', '2021-02-28')).toBe(4);
    expect(familyWholeYearsAt('2016-02-29', '2021-02-28')).toBe(5);
  });

  it('does day arithmetic across leap days', () => {
    expect(addDays('2020-02-28', 1)).toBe('2020-02-29');
    expect(addDays('2021-02-28', 1)).toBe('2021-03-01');
    expect(daysBetween('2020-02-29', '2021-02-28')).toBe(365);
    expect(() => addDays('2021-02-29', 1)).toThrow(RangeError);
  });
});

describe('ability ladder interface (DESIGN-025 D-01)', () => {
  it('freezes the provisional ladder into lasting grants', () => {
    const ladder = freezeAbilityLadder(FAMILY_ABILITY_LADDER, 10);
    expect(ladder.grants.map((grant) => grant.fromAge)).toEqual([0, 2, 4, 8]);
    expect(abilitiesAtAge(ladder, 0)).toEqual(['move', 'interact', 'jump']);
    expect(abilitiesAtAge(ladder, 3)).toEqual(['move', 'interact', 'jump', 'high-jump']);
    expect(abilitiesAtAge(ladder, 5)).toEqual(['move', 'interact', 'jump', 'high-jump', 'double-jump']);
    expect(abilitiesAtAge(ladder, 10)).toEqual(['move', 'interact', 'jump', 'high-jump', 'double-jump', 'glide']);
  });

  it('samples only up to the journey age', () => {
    expect(freezeAbilityLadder(FAMILY_ABILITY_LADDER, 6).grants.map((grant) => grant.fromAge))
      .toEqual([0, 2, 4]);
  });

  it('rejects a ladder that takes a move away or invents one', () => {
    const shrinking: AbilityLadderSource = {
      version: 'shrinking',
      abilitiesForAge: (age) => (age < 3 ? ['move', 'jump', 'glide'] : ['move', 'jump']),
    };
    const unknown = {
      version: 'unknown',
      abilitiesForAge: () => ['move', 'teleport'],
    } as unknown as AbilityLadderSource;
    expect(() => freezeAbilityLadder(shrinking, 5)).toThrow('lasting');
    expect(() => freezeAbilityLadder(unknown, 5)).toThrow('Unknown ability');
  });
});

describe('captions (DESIGN-024 D-05)', () => {
  it('formats the default little and big captions without any name', () => {
    expect(defaultCaption('minor-one', '2022-07-04', 2)).toBe('Summer 2022 · age 2');
    expect(defaultCaption('minor-two', '2021-12-25', 1)).toBe('Winter 2021 · age 1');
    expect(defaultCaption('minor-one', '2023-10-31', 3)).toBe('Fall 2023 · age 3');
    expect(defaultCaption('minor-two', '2024-04-01', 4)).toBe('Spring 2024 · age 4');
    expect(defaultCaption('major', '2025-02-28', 5)).toBe('Turning 5!');
  });

  it('accepts 1–60 characters of plain text and normalizes whitespace', () => {
    expect(normalizeCaption('  Pumpkin   patch\tday  ')).toEqual({ ok: true, caption: 'Pumpkin patch day' });
    expect(normalizeCaption('a'.repeat(60))).toEqual({ ok: true, caption: 'a'.repeat(60) });
    expect(normalizeCaption('🎂'.repeat(60))).toMatchObject({ ok: true });
    expect(normalizeCaption('<b>Cake</b>')).toEqual({ ok: true, caption: '<b>Cake</b>' });
  });

  it('rejects empty, too long and control-character captions', () => {
    expect(normalizeCaption('   ')).toEqual({ ok: false, code: 'CAPTION_EMPTY' });
    expect(normalizeCaption('a'.repeat(61))).toEqual({ ok: false, code: 'CAPTION_TOO_LONG' });
    expect(normalizeCaption('x'.repeat(161))).toEqual({ ok: false, code: 'CAPTION_TOO_LONG' });
    expect(normalizeCaption('Cake\u0000day')).toEqual({ ok: false, code: 'CAPTION_INVALID' });
    expect(normalizeCaption('Cake‮day')).toEqual({ ok: false, code: 'CAPTION_INVALID' });
    expect(normalizeCaption(42)).toEqual({ ok: false, code: 'CAPTION_INVALID' });
  });
});
