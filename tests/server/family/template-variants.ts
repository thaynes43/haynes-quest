/**
 * Synthetic later versions of World B for DESIGN-024 D-11 tests. Each is the
 * checked-in, name-free `family-world-b-v2` project with one authored change;
 * none is registered outside tests.
 */
import familyWorldAV1 from '../../../src/shared/levels/family-world-a-v1.json';
import familyWorldBV1 from '../../../src/shared/levels/family-world-b-v1.json';
import familyWorldBV2 from '../../../src/shared/levels/family-world-b-v2.json';
import ratCasinoWorldV2 from '../../../src/shared/levels/rat-casino-world-v2.json';
import { FamilyTemplateRegistry, type FamilyTemplateSource } from '../../../src/server/family/templates.js';

type Project = typeof familyWorldBV2;
type Chapter = Project['chapters'][number];

function withDates(chapter: Chapter, startDate: string, endDate: string, fromYears: number, toYears: number, dates: [string, string, string]): Chapter {
  return {
    ...chapter,
    representedDateRange: { startDate, endDate },
    recoveredAge: { fromYears, toYears },
    previewMemories: chapter.previewMemories.map((memory, index) => ({ ...memory, date: dates[index]! })),
  };
}

/** Chapter two now runs from age 2 to 5 and chapter three from 5 to 6; chapter one is unchanged. */
export function worldBWithMovedBands(): Project {
  const project = structuredClone(familyWorldBV2);
  const [first, second, third] = project.chapters;
  return {
    ...project,
    chapters: [
      first!,
      withDates(second!, '2022-06-01', '2025-06-01', 2, 5, ['2023-06-01', '2024-06-01', '2025-06-01']),
      withDates(third!, '2025-06-01', '2026-06-01', 5, 6, ['2025-09-01', '2026-01-01', '2026-06-01']),
    ],
  };
}

/** The third chapter is replaced by a new one with the same ages. */
export function worldBWithNewFinale(): Project {
  const project = structuredClone(familyWorldBV2);
  project.chapters[2] = { ...project.chapters[2]!, chapterId: 'family-b3-encore' };
  return project;
}

/** The first chapter is replaced by a new one with the same ages. */
export function worldBWithNewOpening(): Project {
  const project = structuredClone(familyWorldBV2);
  project.chapters[0] = { ...project.chapters[0]!, chapterId: 'family-b1-remix' };
  return project;
}

export const UPGRADE_TEMPLATES: readonly FamilyTemplateSource[] = Object.freeze([
  { id: 'rat-casino-world', version: 'v2', project: ratCasinoWorldV2 },
  { id: 'family-world-b', version: 'v1', project: familyWorldBV1 },
  { id: 'family-world-b', version: 'v2', project: familyWorldBV2 },
  { id: 'family-world-b', version: 'v3', project: worldBWithMovedBands() },
  { id: 'family-world-b', version: 'v4', project: worldBWithNewFinale() },
  { id: 'family-world-b', version: 'v5', project: worldBWithNewOpening() },
  // A newer version no six-year-old is offered: its last chapter ends at 11.
  { id: 'family-world-b', version: 'v12', project: familyWorldAV1 },
]);

export function upgradeRegistry(): FamilyTemplateRegistry {
  return new FamilyTemplateRegistry(UPGRADE_TEMPLATES);
}
