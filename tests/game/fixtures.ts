import type { Ability, AppearanceStage, SaveView } from '../../src/shared/contracts';

export function makeSave(
  ages: number[],
  options: {
    recoveredCount?: number;
    abilities?: Ability[];
    stage?: AppearanceStage;
    completed?: boolean;
    id?: string;
  } = {},
): SaveView {
  const memories = ages.map((ageYears, index) => ({
    id: `memory-${index + 1}`,
    date: `${2020 + ageYears}-01-01`,
    ageYears,
    label: `Synthetic ${index + 1}`,
    mediaUrl: `/fixture/${index + 1}.svg`,
  }));
  const recoveredCount = options.recoveredCount ?? 0;
  return {
    id: options.id ?? 'save-fixture',
    title: 'Synthetic route',
    subject: { id: 'demo-adventurer', label: 'Demo Adventurer' },
    memories,
    recoveredIds: memories.slice(0, recoveredCount).map((memory) => memory.id),
    ageYears: recoveredCount > 0 ? (memories[recoveredCount - 1]?.ageYears ?? 0) : 0,
    abilities: options.abilities ?? ['move', 'interact'],
    appearance: {
      contractVersion: 'synthetic-traveler-v1',
      subjectAppearanceId: 'demo-adventurer',
      stage: options.stage ?? 'infant',
    },
    completed: options.completed ?? false,
    revision: recoveredCount,
    createdAt: '2026-09-11T00:00:00.000Z',
    updatedAt: '2026-09-11T00:00:00.000Z',
    versions: {
      journey: 'journey-v1',
      age: 'age-v1',
      progression: 'progression-v1',
      appearance: 'synthetic-traveler-v1',
    },
  };
}
