import { createHash } from 'node:crypto';
import {
  canonicalLevelEditorProjectJson,
  LEVEL_EDITOR_CHAPTER_ROUTES,
  LEVEL_EDITOR_PROJECT_MAX_BYTES,
  LevelEditorProjectValidationError,
  isLevelEditorProjectV2,
  levelEditorPreparedEnemies,
  resolveLevelEditorProject,
  type LevelEditorChapterV2,
  type LevelEditorChapterId,
  type LevelEditorCatalogVersion,
  type LevelEditorEnemyCandidate,
  type LevelEditorEncounterReference,
  type LevelEditorIssue,
  type LevelEditorProject,
  type LevelEditorProjectV2,
} from '../shared/editor-project.js';
import type { AuthoredEncounterSlot } from '../shared/authored-level.js';
import type {
  EditorWorldAdventurePlan,
  FrozenEditorWorldLevelPlan,
  FrozenEncounterDefinitionV2,
  FrozenEquipmentDefinition,
} from '../shared/adventure.js';
import type { ParodyCatalogEntry } from '../shared/parody-catalog.js';
import { wholeYearsAt, type FrozenMemory } from './domain.js';

/**
 * Transport ceiling for the whole request envelope. The shared parser owns the
 * precise project verdict (320KiB canonical, 128KiB per authored document); this
 * only stops a body large enough to be worth buffering, leaving enough slack for
 * the envelope so a project at exactly the shared limit still reaches the
 * validator and gets an actionable size issue instead of a bare 413.
 */
export const EDITOR_PLAYTEST_MAX_BODY_BYTES =
  LEVEL_EDITOR_PROJECT_MAX_BYTES + 8_192;

/** Enough detail for an author to find the offending object, never a stack. */
export const EDITOR_PREVIEW_MAX_ISSUES = 50;

export const EDITOR_PROJECT_INVALID = 'EDITOR_PROJECT_INVALID';

export interface EditorProjectIssueResponse {
  error: {
    code: typeof EDITOR_PROJECT_INVALID;
    message: string;
    issues: LevelEditorIssue[];
    truncated?: true;
  };
}

export interface EditorPreviewBundle {
  /** Frozen, canonicalised copy of the validated project. */
  readonly project: LevelEditorProject;
  /** SHA-256 of the project's canonical serialisation. */
  readonly fingerprint: string;
  /** Present only for the variable-world contract; v1 retains its established path. */
  readonly world?: EditorWorldPreview;
}

export interface EditorWorldPreview {
  readonly birthDate: string;
  readonly memories: readonly FrozenMemory[];
  readonly plan: EditorWorldAdventurePlan;
}

export type EditorPreviewOutcome =
  | { readonly ok: true; readonly bundle: EditorPreviewBundle }
  | { readonly ok: false; readonly body: EditorProjectIssueResponse };

/** The chapter index the existing playtest service already understands. */
export function editorChapterNumber(chapterId: LevelEditorChapterId): 1 | 2 {
  if (chapterId === 'chapter-1') return 1;
  if (chapterId === 'chapter-2') return 2;
  throw new RangeError('Editor chapter is unavailable');
}

export function editorChapterRouteId(chapterId: LevelEditorChapterId): string {
  if (chapterId !== 'chapter-1' && chapterId !== 'chapter-2') {
    throw new RangeError('Editor chapter is unavailable');
  }
  return LEVEL_EDITOR_CHAPTER_ROUTES[chapterId];
}

export function editorChapterIndex(
  project: LevelEditorProject,
  chapterId: string,
): number | null {
  const index = project.chapters.findIndex((chapter) => chapter.chapterId === chapterId);
  return index < 0 ? null : index;
}

/**
 * Structurally parse, semantically validate and freeze a submitted project.
 * Returning an outcome rather than throwing keeps the caller honest: an invalid
 * project cannot reach the store, so no save is ever created for one.
 */
export function prepareEditorPreview(project: unknown): EditorPreviewOutcome {
  let resolved: LevelEditorProject;
  try {
    resolved = resolveLevelEditorProject(project).project;
  } catch (error) {
    if (!(error instanceof LevelEditorProjectValidationError)) throw error;
    const issues = error.issues.slice(0, EDITOR_PREVIEW_MAX_ISSUES);
    return {
      ok: false,
      body: {
        error: {
          code: EDITOR_PROJECT_INVALID,
          message: 'Editor project is invalid',
          issues: issues.map((issue) => ({ ...issue })),
          ...(error.issues.length > issues.length ? { truncated: true as const } : {}),
        },
      },
    };
  }
  const canonical = canonicalLevelEditorProjectJson(resolved);
  const fingerprint = createHash('sha256').update(canonical, 'utf8').digest('hex');
  return {
    ok: true,
    bundle: {
      project: resolved,
      fingerprint,
      ...(isLevelEditorProjectV2(resolved)
        ? { world: prepareEditorWorld(resolved, fingerprint) }
        : {}),
    },
  };
}

const EDITOR_ENCOUNTER_SLOTS = [
  'ordinary-1',
  'ordinary-2',
  'ordinary-3',
  'ordinary-4',
  'boss',
] as const satisfies readonly AuthoredEncounterSlot[];

const FIXTURE_MEDIA_KEYS = [
  'demo-memory-2020-07',
  'demo-memory-2022-01',
  'demo-memory-2024-01',
  'demo-memory-2025-01',
  'demo-memory-2026-01',
  'demo-memory-2027-01',
] as const;

function prepareEditorWorld(
  project: LevelEditorProjectV2,
  fingerprint: string,
): EditorWorldPreview {
  const candidates = new Map(project.enemyCandidates.map((candidate) => [candidate.id, candidate]));
  const memories: FrozenMemory[] = [];
  const levels = project.chapters.map((chapter, index) => {
    const level = editorWorldLevel(
      chapter,
      index,
      candidates,
      project.catalogVersion,
    );
    for (const memory of chapter.previewMemories) {
      const id = `${chapter.routeId}-memory-${memory.slotId}`;
      const fixtureKey = FIXTURE_MEDIA_KEYS[memories.length % FIXTURE_MEDIA_KEYS.length]!;
      memories.push({
        id,
        date: memory.date,
        ageYears: wholeYearsAt(project.fictionalBirthDate, memory.date),
        label: memory.label,
        source: { kind: 'fixture', key: fixtureKey },
      });
    }
    return level;
  });
  return deepFreeze({
    birthDate: project.fictionalBirthDate,
    memories,
    plan: {
      version: 'editor-world-plan-v1',
      catalogVersion: project.catalogVersion,
      projectFingerprint: fingerprint,
      levels,
    },
  });
}

function editorWorldLevel(
  chapter: LevelEditorChapterV2,
  index: number,
  candidates: ReadonlyMap<string, LevelEditorEnemyCandidate>,
  catalogVersion: LevelEditorCatalogVersion,
): FrozenEditorWorldLevelPlan {
  const resolved = EDITOR_ENCOUNTER_SLOTS.map((slot) => {
    const reference = chapter.encounterSlots[slot];
    const candidate = reference.source === 'candidate'
      ? candidates.get(reference.candidateId)
      : undefined;
    const catalogEntry = reference.source === 'catalog'
      ? preparedCatalogEntry(reference, catalogVersion)
      : undefined;
    const periodId = candidate?.periodId ?? catalogEntry?.periodId;
    if (!periodId) throw new Error('Validated editor encounter is unavailable');
    return { slot, reference, candidate, catalogEntry, periodId };
  });
  const periodId = resolved[0]?.periodId;
  if (!periodId || resolved.some((entry) => entry.periodId !== periodId)) {
    throw new Error('Validated editor chapter has no single period');
  }
  const encounters = resolved.map(({ slot, candidate, catalogEntry }, encounterIndex) => {
    const kind = chapter.level.anchors.encounters[slot].kind;
    const role = slot === 'boss' ? 'boss' : 'ordinary';
    const content = candidate
      ? {
          catalogEntryId: `editor-candidate-${candidate.id}`,
          catalogEntryVersion: 'draft-v1',
          assetId: 'neutral-enemy-placeholder',
          assetVersion: 'v001',
          displayName: candidate.name,
          placeholder: 'neutral-candidate-v1' as const,
        }
      : {
          catalogEntryId: catalogEntry!.id,
          catalogEntryVersion: catalogEntry!.version,
          assetId: catalogEntry!.assetId,
          assetVersion: catalogEntry!.assetVersion,
        };
    return {
      id: slot === 'boss'
        ? `${chapter.routeId}-boss`
        : `${chapter.routeId}-encounter-${encounterIndex + 1}`,
      role,
      kind,
      content,
      maxHp: role === 'boss'
        ? 8 + index * 3
        : (kind === 'ordinary-b' ? 5 : 4) + index * 2,
      attackDamage: role === 'boss' ? 3 + index : 2 + index,
    } satisfies FrozenEncounterDefinitionV2;
  });
  const pickups = editorEquipment(chapter.routeId, index);
  return {
    id: chapter.routeId,
    index,
    startAgeYears: chapter.recoveredAge.fromYears,
    targetAgeYears: chapter.recoveredAge.toYears,
    startDate: chapter.representedDateRange.startDate,
    representedEndDate: chapter.representedDateRange.endDate,
    eraYear: Number(chapter.representedDateRange.startDate.slice(0, 4)),
    minorMemoryIds: [
      `${chapter.routeId}-memory-minor-one`,
      `${chapter.routeId}-memory-minor-two`,
    ],
    majorMemoryId: `${chapter.routeId}-memory-major`,
    periodId,
    routeId: chapter.routeId,
    bossGate: 'independent',
    pickups,
    encounters,
    bossId: `${chapter.routeId}-boss`,
  };
}

function preparedCatalogEntry(
  reference: Extract<LevelEditorEncounterReference, { source: 'catalog' }>,
  catalogVersion: LevelEditorCatalogVersion,
):
  ParodyCatalogEntry | undefined {
  return levelEditorPreparedEnemies(catalogVersion).find((entry) =>
    entry.id === reference.catalogEntryId &&
    entry.version === reference.catalogEntryVersion,
  );
}

function editorEquipment(prefix: string, levelIndex: number): FrozenEquipmentDefinition[] {
  return [
    {
      id: `${prefix}-equipment-attack`,
      pickupId: `${prefix}-pickup-attack`,
      kind: 'attack-tool',
      tier: levelIndex + 1,
      damage: 2 + levelIndex,
      guardReduction: 0,
    },
    {
      id: `${prefix}-equipment-guard`,
      pickupId: `${prefix}-pickup-guard`,
      kind: 'guard-tool',
      tier: levelIndex + 1,
      damage: 0,
      guardReduction: 2 + levelIndex,
    },
  ];
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
