/**
 * DESIGN-024 D-03: rebase a name-free template world onto a real birthday.
 *
 * Template chapter age bands come from the template's fictional dates. For a
 * child born on `B`, chapter k starts on `B + startAge` and its big memory is
 * due on `B + recoveredAge` (the birthday on which the child turns that age);
 * chapter k+1 starts on that date. The final chapter closes on the child's most
 * recent birthday. The rebased project must pass the full world validator with
 * the real dates.
 */
import {
  parseLevelEditorProject,
  validateLevelEditorProject,
  type LevelEditorChapterV2,
  type LevelEditorIssue,
  type LevelEditorProjectV2,
} from '../../shared/editor-project.js';
import {
  addDays,
  daysBetween,
  familyAnniversary,
  familyWholeYearsAt,
  isDateOnly,
} from '../../shared/family-plan.js';

export interface ChapterAgeBand {
  readonly startAge: number;
  readonly recoveredAge: number;
}

export interface RebasedChapter extends ChapterAgeBand {
  readonly index: number;
  readonly chapterId: string;
  readonly routeId: string;
  /** `B + startAge`: the chapter start and the cast-eligibility date. */
  readonly startDate: string;
  /** `B + recoveredAge`: the birthday the big memory celebrates. */
  readonly targetDate: string;
}

export interface RebasedWorld {
  /** The template with real dates. Private: it carries the birthday. */
  readonly project: LevelEditorProjectV2;
  readonly chapters: readonly RebasedChapter[];
  readonly birthDate: string;
  readonly currentAge: number;
}

export type FamilyRebaseErrorCode =
  | 'BIRTH_DATE_INVALID'
  | 'TEMPLATE_AGE_UNAVAILABLE'
  | 'WORLD_INVALID';

/** Issues may quote real dates: return them to an administrator, never log them. */
export class FamilyRebaseError extends Error {
  constructor(
    readonly code: FamilyRebaseErrorCode,
    readonly issues: readonly LevelEditorIssue[] = [],
  ) {
    super(code);
    this.name = 'FamilyRebaseError';
  }
}

/** Age bands derived from a template's fictional dates (D-03). */
export function templateAgeBands(template: LevelEditorProjectV2): ChapterAgeBand[] {
  return template.chapters.map((chapter) => ({
    startAge: familyWholeYearsAt(template.fictionalBirthDate, chapter.representedDateRange.startDate),
    recoveredAge: familyWholeYearsAt(template.fictionalBirthDate, chapter.representedDateRange.endDate),
  }));
}

export function rebaseWorldForChild(
  template: LevelEditorProjectV2,
  birthDate: string,
  today: string,
): RebasedWorld {
  if (!isDateOnly(birthDate) || !isDateOnly(today) || birthDate > today) {
    throw new FamilyRebaseError('BIRTH_DATE_INVALID');
  }
  const currentAge = familyWholeYearsAt(birthDate, today);
  const bands = templateAgeBands(template);
  const finalBand = bands.at(-1);
  if (!finalBand || finalBand.recoveredAge > currentAge) {
    throw new FamilyRebaseError('TEMPLATE_AGE_UNAVAILABLE');
  }
  const chapters: RebasedChapter[] = template.chapters.map((chapter, index) => {
    const band = bands[index]!;
    // The final chapter closes on the child's most recent birthday (D-04).
    const recoveredAge = index === bands.length - 1 ? currentAge : band.recoveredAge;
    return {
      index,
      chapterId: chapter.chapterId,
      routeId: chapter.routeId,
      startAge: band.startAge,
      recoveredAge,
      startDate: familyAnniversary(birthDate, band.startAge),
      targetDate: familyAnniversary(birthDate, recoveredAge),
    };
  });
  const project = parseLevelEditorProject({
    ...template,
    fictionalBirthDate: birthDate,
    chapters: template.chapters.map((chapter, index) => rebaseChapter(chapter, chapters[index]!)),
  }) as LevelEditorProjectV2;
  const issues = familyWorldIssues(project);
  if (issues.length > 0) throw new FamilyRebaseError('WORLD_INVALID', issues);
  return { project, chapters, birthDate, currentAge };
}

function rebaseChapter(chapter: LevelEditorChapterV2, rebased: RebasedChapter): LevelEditorChapterV2 {
  const { startDate: templateStart, endDate: templateEnd } = chapter.representedDateRange;
  const templateSpan = Math.max(1, daysBetween(templateStart, templateEnd));
  const span = daysBetween(rebased.startDate, rebased.targetDate);
  let prior = rebased.startDate;
  const previewMemories = chapter.previewMemories.map((memory) => {
    if (memory.slotId === 'major') return { ...memory, date: rebased.targetDate };
    // Keep each fictional preview at the same fraction of its chapter.
    const fraction = daysBetween(templateStart, memory.date) / templateSpan;
    const offset = Math.min(span, Math.max(0, Math.round(fraction * span)));
    const date = addDays(rebased.startDate, offset);
    prior = date < prior ? prior : date;
    return { ...memory, date: prior };
  }) as unknown as LevelEditorChapterV2['previewMemories'];
  return {
    ...chapter,
    representedDateRange: { startDate: rebased.startDate, endDate: rebased.targetDate },
    recoveredAge: { fromYears: rebased.startAge, toYears: rebased.recoveredAge },
    previewMemories,
  };
}

/** Codes whose v1 whole-years check the family age rule replaces. */
const FAMILY_AGE_CODES = new Set(['age.start-date', 'age.major-date']);

/**
 * The full world validator, with its two whole-years checks re-run under the
 * family age rule. They differ only for a February 29 birthday in a common
 * year, where the v1 rule would wait until March 1.
 */
export function familyWorldIssues(project: LevelEditorProjectV2): LevelEditorIssue[] {
  const issues = validateLevelEditorProject(project).filter(
    (issue) => !FAMILY_AGE_CODES.has(issue.code),
  );
  project.chapters.forEach((chapter, index) => {
    const prefix = `$.chapters[${index}]`;
    const major = chapter.previewMemories[2];
    if (ageAt(project.fictionalBirthDate, chapter.representedDateRange.startDate) !== chapter.recoveredAge.fromYears) {
      issues.push({
        source: 'semantic',
        path: `${prefix}.recoveredAge.fromYears`,
        code: 'age.start-date',
        message: 'Recovered starting age must match the birth and represented start dates',
      });
    }
    if (ageAt(project.fictionalBirthDate, major.date) !== chapter.recoveredAge.toYears) {
      issues.push({
        source: 'semantic',
        path: `${prefix}.recoveredAge.toYears`,
        code: 'age.major-date',
        message: 'Recovered target age must match the birth and major memory dates',
      });
    }
  });
  return issues;
}

function ageAt(birthDate: string, date: string): number | null {
  try {
    return familyWholeYearsAt(birthDate, date);
  } catch {
    return null;
  }
}
