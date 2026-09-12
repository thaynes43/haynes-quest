import type { PreviewRequest } from '../../shared/contracts.js';
import { FIXTURE_SUBJECT, wholeYearsAt, type FrozenMemory } from '../domain.js';
import { AppError } from '../errors.js';
import type { DiscoveryResult, JourneyPhotoSource, ResolvedSubject, SubjectResolution } from './source.js';

const FIXTURE_BIRTH_DATE = '2020-01-01';
const FIXTURE_MEMORIES = [
  { id: 'demo-memory-2020-07', date: '2020-07-01', label: 'The first glow' },
  { id: 'demo-memory-2022-01', date: '2022-01-01', label: 'A small discovery' },
  { id: 'demo-memory-2024-01', date: '2024-01-01', label: 'A taller path' },
  { id: 'demo-memory-2025-01', date: '2025-01-01', label: 'A bright detour' },
  { id: 'demo-memory-2026-01', date: '2026-01-01', label: 'A brave crossing' },
  { id: 'demo-memory-2027-01', date: '2027-01-01', label: 'The lantern gate' },
] as const;
const LEGACY_FIXTURE_IDS = new Set([
  'demo-memory-2020-07',
  'demo-memory-2024-01',
  'demo-memory-2027-01',
]);

export class FixturePhotoSource implements JourneyPhotoSource {
  constructor(private readonly routeMemories = false) {}

  async resolveName(name: string): Promise<SubjectResolution> {
    return name.trim().localeCompare(FIXTURE_SUBJECT.label, undefined, { sensitivity: 'accent' }) === 0
      ? { kind: 'exact', subjects: [{ option: FIXTURE_SUBJECT, sourceId: FIXTURE_SUBJECT.id }] }
      : { kind: 'missing', subjects: [] };
  }

  async discover(subject: ResolvedSubject, request: PreviewRequest): Promise<DiscoveryResult> {
    if (subject.sourceId !== FIXTURE_SUBJECT.id) throw new AppError(422, 'SUBJECT_UNRESOLVED', 'Subject unresolved');
    if (request.birthDate !== FIXTURE_BIRTH_DATE) {
      throw new AppError(422, 'FIXTURE_BIRTH_DATE_INVALID', 'Invalid fixture birth date');
    }
    const available = this.routeMemories
      ? FIXTURE_MEMORIES
      : FIXTURE_MEMORIES.filter(({ id }) => LEGACY_FIXTURE_IDS.has(id));
    const memories: FrozenMemory[] = available.filter(
      ({ date }) => (!request.fromDate || date >= request.fromDate) && (!request.toDate || date <= request.toDate),
    ).map(({ id, date, label }) => ({
      id,
      date,
      label,
      ageYears: wholeYearsAt(request.birthDate, date),
      mediaUrl: `/api/fixture-media/${encodeURIComponent(id)}`,
      source: { kind: 'fixture', key: id },
    }));
    return { memories, scanned: available.length, incomplete: false };
  }
}
