import type { PreviewRequest } from '../../shared/contracts.js';
import { FIXTURE_SUBJECT, wholeYearsAt, type FrozenMemory } from '../domain.js';
import { AppError } from '../errors.js';
import type { DiscoveryResult, JourneyPhotoSource, ResolvedSubject, SubjectResolution } from './source.js';

const FIXTURE_BIRTH_DATE = '2020-01-01';
const FIXTURE_MEMORIES = [
  { id: 'demo-memory-2020-07', date: '2020-07-01', label: 'The first glow' },
  { id: 'demo-memory-2024-01', date: '2024-01-01', label: 'A taller path' },
  { id: 'demo-memory-2027-01', date: '2027-01-01', label: 'The lantern gate' },
] as const;

export class FixturePhotoSource implements JourneyPhotoSource {
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
    const memories: FrozenMemory[] = FIXTURE_MEMORIES.filter(
      ({ date }) => (!request.fromDate || date >= request.fromDate) && (!request.toDate || date <= request.toDate),
    ).map(({ id, date, label }) => ({
      id,
      date,
      label,
      ageYears: wholeYearsAt(request.birthDate, date),
      mediaUrl: `/api/fixture-media/${encodeURIComponent(id)}`,
      source: { kind: 'fixture', key: id },
    }));
    return { memories, scanned: FIXTURE_MEMORIES.length, incomplete: false };
  }
}
