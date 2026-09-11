import type { PreviewRequest, PreviewResponse, SubjectOption } from '../../shared/contracts.js';
import type { QuestStore } from '../domain.js';
import { AppError } from '../errors.js';
import type { JourneyPhotoSource, ResolvedSubject } from './source.js';

const PREVIEW_TTL_MS = 30 * 60 * 1_000;

export async function createPreview(
  store: QuestStore,
  source: JourneyPhotoSource,
  ownerId: string,
  request: PreviewRequest,
  now = new Date(),
): Promise<PreviewResponse> {
  const resolution = await source.resolveName(request.name);
  if (resolution.kind === 'missing') throw new AppError(422, 'PERSON_NOT_FOUND', 'Person not found');

  let resolvedSubject: ResolvedSubject | null = null;
  if (request.subjectId) {
    resolvedSubject = resolution.subjects.find((subject) => subject.option.id === request.subjectId) ?? null;
    if (!resolvedSubject) throw new AppError(422, 'SUBJECT_UNRESOLVED', 'Subject unresolved');
  } else if (resolution.kind === 'exact') {
    resolvedSubject = resolution.subjects[0];
  }
  const chosenSubject: SubjectOption | null = resolvedSubject?.option ?? null;

  const result = resolvedSubject
    ? await source.discover(resolvedSubject, request)
    : { memories: [], scanned: 0, incomplete: false };
  if (chosenSubject && result.memories.length === 0) {
    throw new AppError(422, 'NO_USABLE_PHOTOS', 'No usable photos');
  }

  const ordered = [...result.memories].sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
  const selectionLimit = Math.min(request.limit ?? 24, ordered.length);
  const selectedIds = chronologicallySpaced(ordered.map((memory) => memory.id), selectionLimit);
  const dates = ordered.map((memory) => memory.date);
  const stored = await store.putPreview({
    ownerId,
    birthDate: request.birthDate,
    subjects: resolution.subjects.map((subject) => subject.option),
    chosenSubject,
    memories: ordered,
    selectedIds,
    coverage: {
      fromDate: dates[0] ?? null,
      toDate: dates.at(-1) ?? null,
      incomplete: result.incomplete,
      scanned: result.scanned,
    },
    expiresAt: new Date(now.valueOf() + PREVIEW_TTL_MS),
  });
  return {
    previewId: stored.previewId,
    subjects: stored.subjects,
    candidates: stored.candidates,
    coverage: stored.coverage,
    selectedIds: stored.selectedIds,
  };
}

export function chronologicallySpaced(ids: string[], limit: number): string[] {
  if (limit >= ids.length) return [...ids];
  if (limit <= 0) return [];
  if (limit === 1) return [ids[0]!];
  const selected = new Set<number>();
  for (let index = 0; index < limit; index += 1) {
    selected.add(Math.round((index * (ids.length - 1)) / (limit - 1)));
  }
  return [...selected].sort((left, right) => left - right).map((index) => ids[index]!);
}
