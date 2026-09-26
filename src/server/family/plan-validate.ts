/**
 * `family-world-plan-v1` validation (DESIGN-024 D-07): every invariant the
 * builder establishes, re-derived from the frozen plan and the private save
 * manifest. Loaded by save validation, so it depends on nothing that imports
 * the server domain at runtime.
 */
import { createHash } from 'node:crypto';
import {
  LEVEL_EDITOR_CATALOG_VERSIONS,
  levelEditorPreparedBonusEnemies,
  levelEditorPreparedEnemies,
  type LevelEditorCatalogVersion,
} from '../../shared/editor-project.js';
import {
  FAMILY_ABILITIES,
  FAMILY_AGE_RULE,
  FAMILY_MEMORY_SLOTS,
  FAMILY_WORLD_PLAN_VERSION,
  abilitiesAtAge,
  familyAnniversary,
  familyMemoryId,
  familyWholeYearsAt,
  isDateOnly,
  normalizeCaption,
  type FamilyWorldAdventurePlanV1,
  type FrozenAbilityLadder,
  type FrozenFamilyWorldLevelPlanV1,
} from '../../shared/family-plan.js';
import type { RuleVersions } from '../../shared/contracts.js';
import type { FrozenMemory } from '../domain.js';

export const FAMILY_PROGRESSION_RULE = 'family-world-route-memory-v1';

export const FAMILY_RULE_VERSIONS = (catalogVersion: string): RuleVersions => ({
  journey: FAMILY_WORLD_PLAN_VERSION,
  age: FAMILY_AGE_RULE,
  progression: FAMILY_PROGRESSION_RULE,
  appearance: 'synthetic-traveler-v1',
  catalog: catalogVersion,
  combat: 'discrete-combat-v1',
});

/** SHA-256 over the canonical frozen authored levels: geometry only, never dates. */
export function familyGeometryFingerprint(
  levels: readonly Pick<FrozenFamilyWorldLevelPlanV1, 'authoredLevel'>[],
): string {
  return createHash('sha256')
    .update(canonicalJson(levels.map((level) => level.authoredLevel)), 'utf8')
    .digest('hex');
}

export interface FamilyPlanContext {
  readonly birthDate: string;
  /** When present, the private save manifest must match the plan slot by slot. */
  readonly memories?: readonly FrozenMemory[];
}

const HEX_64 = /^[a-f0-9]{64}$/;
const OPAQUE = /^[A-Za-z0-9_-]{8,128}$/;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;

/**
 * Re-derive every plan invariant. Returns fixed issue codes only (no dates,
 * names or ids), so the result is safe to report anywhere.
 */
export function validateFamilyWorldPlan(
  plan: FamilyWorldAdventurePlanV1,
  context: FamilyPlanContext,
): string[] {
  const issues: string[] = [];
  const fail = (code: string): void => {
    if (!issues.includes(code)) issues.push(code);
  };
  if (!isDateOnly(context.birthDate)) return ['birth-date.invalid'];
  if (
    plan.version !== FAMILY_WORLD_PLAN_VERSION ||
    plan.ageRule !== FAMILY_AGE_RULE ||
    !(LEVEL_EDITOR_CATALOG_VERSIONS as readonly string[]).includes(plan.catalogVersion)
  ) fail('plan.version');
  if (
    !HEX_64.test(plan.projectFingerprint) ||
    !HEX_64.test(plan.template.fingerprint) ||
    !/^[a-z0-9][a-z0-9-]{0,63}$/.test(plan.template.id) ||
    !/^v[0-9]{1,4}$/.test(plan.template.version)
  ) fail('plan.identity');
  if (!Array.isArray(plan.levels) || plan.levels.length < 1 || plan.levels.length > 8) {
    return [...issues, 'plan.levels'];
  }
  if (!validLadder(plan.abilityLadder)) fail('plan.ability-ladder');
  if (HEX_64.test(plan.projectFingerprint) && familyGeometryFingerprint(plan.levels) !== plan.projectFingerprint) {
    fail('plan.geometry-fingerprint');
  }

  const levelIds = new Set<string>();
  const chapterIds = new Set<string>();
  const encounterIds = new Set<string>();
  let priorTarget = plan.levels[0]!.startAgeYears;
  let priorMajorDate = '';
  for (const [index, level] of plan.levels.entries()) {
    try {
      validateLevel(plan, level, index, priorTarget, priorMajorDate, context.birthDate, fail);
    } catch {
      fail('level.invalid');
    }
    if (levelIds.has(level.id) || chapterIds.has(level.chapterId)) fail('level.duplicate-id');
    levelIds.add(level.id);
    chapterIds.add(level.chapterId);
    for (const encounter of level.encounters ?? []) {
      if (encounterIds.has(encounter.id)) fail('level.duplicate-encounter');
      encounterIds.add(encounter.id);
    }
    priorTarget = level.targetAgeYears;
    priorMajorDate = level.memorySlots?.[2]?.date ?? priorMajorDate;
  }
  if (context.memories) validateManifest(plan, context.memories, fail);
  return issues;
}

function validateLevel(
  plan: FamilyWorldAdventurePlanV1,
  level: FrozenFamilyWorldLevelPlanV1,
  index: number,
  priorTarget: number,
  priorMajorDate: string,
  birthDate: string,
  fail: (code: string) => void,
): void {
  if (
    level.index !== index ||
    level.id !== level.routeId ||
    !IDENTIFIER.test(level.id) ||
    !IDENTIFIER.test(level.chapterId) ||
    level.authoredLevel?.id !== level.routeId ||
    level.bossGate !== 'independent'
  ) fail('level.identity');
  if (
    !chapterText(level.chapterName, 120, false) ||
    !chapterText(level.chapterSubtitle, 240, true) ||
    !chapterText(level.chapterDescription, 600, true)
  ) fail('level.chapter-text');
  if (
    !Number.isInteger(level.startAgeYears) ||
    !Number.isInteger(level.targetAgeYears) ||
    level.startAgeYears !== priorTarget ||
    level.targetAgeYears <= level.startAgeYears ||
    (index === 0 && level.startAgeYears !== 0)
  ) fail('level.age-band');
  // Chapters start on the rebased birthday (D-03); that date also governs the cast.
  if (level.startDate !== familyAnniversary(birthDate, level.startAgeYears)) fail('level.start-date');
  if (level.eraYear !== Number(level.startDate.slice(0, 4))) fail('level.era-year');
  if (
    JSON.stringify(level.abilities) !==
      JSON.stringify(abilitiesAtAge(plan.abilityLadder, level.startAgeYears))
  ) fail('level.abilities');

  const expectedIds = FAMILY_MEMORY_SLOTS.map((slot) => familyMemoryId(level.routeId, slot));
  if (
    level.minorMemoryIds?.[0] !== expectedIds[0] ||
    level.minorMemoryIds?.[1] !== expectedIds[1] ||
    level.majorMemoryId !== expectedIds[2] ||
    level.memorySlots?.length !== 3
  ) {
    fail('level.memory-ids');
    return;
  }
  const [minorOne, minorTwo, major] = level.memorySlots;
  const targetDate = familyAnniversary(birthDate, level.targetAgeYears);
  level.memorySlots.forEach((slot, slotIndex) => {
    if (slot.slot !== FAMILY_MEMORY_SLOTS[slotIndex] || slot.memoryId !== expectedIds[slotIndex]) {
      fail('memory.slot');
    }
    if (!isDateOnly(slot.date) || slot.ageYears !== familyWholeYearsAt(birthDate, slot.date)) {
      fail('memory.age');
    }
    const caption = normalizeCaption(slot.caption);
    if (!caption.ok || caption.caption !== slot.caption) fail('memory.caption');
    if (slot.source?.kind !== 'immich' || !OPAQUE.test(slot.source.opaque ?? '')) fail('memory.source');
  });
  // Little memories: strictly inside the chapter, on different days, after the
  // previous big memory. The big memory: on or after the birthday it celebrates
  // and before the next one, closing the represented range.
  if (
    !(minorOne.date > level.startDate) ||
    !(minorTwo.date > minorOne.date) ||
    !(minorTwo.date < targetDate) ||
    (priorMajorDate !== '' && !(minorOne.date > priorMajorDate))
  ) fail('memory.minor-window');
  if (major.date < targetDate || major.ageYears !== level.targetAgeYears) fail('memory.major-window');
  if (level.representedEndDate !== major.date) fail('level.represented-end');
  validateCast(plan.catalogVersion as LevelEditorCatalogVersion, level, fail);
}

function validateCast(
  catalogVersion: LevelEditorCatalogVersion,
  level: FrozenFamilyWorldLevelPlanV1,
  fail: (code: string) => void,
): void {
  const optionalIds = level.optionalEncounterIds ?? [];
  const bonusId = `${level.id}-encounter-bonus-1`;
  if (optionalIds.length > 1 || (optionalIds.length === 1 && optionalIds[0] !== bonusId)) {
    fail('level.optional-encounter');
  }
  // Ordinary slots take either ordinary kind (a chapter with one ordinary
  // identity uses its kind in all four, DESIGN-026); stats follow the
  // encounter's actual kind.
  const expected: Array<{ id: string; role: 'ordinary' | 'boss'; kind: string | null; optional: boolean }> = [
    { id: `${level.id}-encounter-1`, role: 'ordinary', kind: null, optional: false },
    { id: `${level.id}-encounter-2`, role: 'ordinary', kind: null, optional: false },
    { id: `${level.id}-encounter-3`, role: 'ordinary', kind: null, optional: false },
    { id: `${level.id}-encounter-4`, role: 'ordinary', kind: null, optional: false },
    { id: `${level.id}-boss`, role: 'boss', kind: 'boss', optional: false },
    ...(optionalIds.length === 1
      ? [{ id: bonusId, role: 'ordinary' as const, kind: null, optional: true }]
      : []),
  ];
  const expectedPickups = [
    {
      id: `${level.id}-equipment-attack`,
      pickupId: `${level.id}-pickup-attack`,
      kind: 'attack-tool',
      tier: level.index + 1,
      damage: 2 + level.index,
      guardReduction: 0,
    },
    {
      id: `${level.id}-equipment-guard`,
      pickupId: `${level.id}-pickup-guard`,
      kind: 'guard-tool',
      tier: level.index + 1,
      damage: 0,
      guardReduction: 2 + level.index,
    },
  ];
  if (canonicalJson(level.pickups) !== canonicalJson(expectedPickups)) fail('level.pickups');
  if (level.bossId !== `${level.id}-boss` || level.encounters?.length !== expected.length) {
    fail('level.encounters');
    return;
  }
  const prepared = levelEditorPreparedEnemies(catalogVersion);
  const bonus = levelEditorPreparedBonusEnemies(catalogVersion);
  level.encounters.forEach((encounter, index) => {
    const want = expected[index]!;
    const maxHp = want.role === 'boss'
      ? 8 + level.index * 3
      : (encounter.kind === 'ordinary-b' ? 5 : 4) + level.index * 2;
    const attackDamage = want.role === 'boss' ? 3 + level.index : 2 + level.index;
    if (
      encounter.id !== want.id ||
      encounter.role !== want.role ||
      (want.kind === null ? encounter.kind === 'boss' : encounter.kind !== want.kind) ||
      encounter.maxHp !== maxHp ||
      encounter.attackDamage !== attackDamage
    ) {
      fail('level.encounters');
      return;
    }
    const content = encounter.content;
    if (content.placeholder === 'neutral-candidate-v1') {
      if (
        !content.catalogEntryId.startsWith('editor-candidate-') ||
        content.catalogEntryVersion !== 'draft-v1' ||
        content.assetId !== 'neutral-enemy-placeholder' ||
        !content.displayName?.trim()
      ) fail('level.cast');
      return;
    }
    const entry = (want.optional ? bonus : prepared).find((candidate) =>
      candidate.id === content.catalogEntryId && candidate.version === content.catalogEntryVersion,
    );
    if (
      !entry ||
      entry.assetId !== content.assetId ||
      entry.assetVersion !== content.assetVersion ||
      entry.periodId !== level.periodId ||
      entry.role !== encounter.role ||
      entry.kind !== encounter.kind
    ) {
      fail('level.cast');
      return;
    }
    // Cast relevance is judged at the rebased chapter start (D-03).
    if (
      level.startDate < entry.eligibleFrom ||
      level.startDate > entry.eligibleThrough ||
      level.startDate < entry.referenceAvailableBy
    ) fail('level.cast-date');
  });
}

function validateManifest(
  plan: FamilyWorldAdventurePlanV1,
  memories: readonly FrozenMemory[],
  fail: (code: string) => void,
): void {
  const slots = plan.levels.flatMap((level) => level.memorySlots ?? []);
  if (memories.length !== slots.length) {
    fail('manifest.length');
    return;
  }
  const assetIds = new Set<string>();
  const personIds = new Set<string>();
  memories.forEach((memory, index) => {
    const slot = slots[index]!;
    if (
      memory.id !== slot.memoryId ||
      memory.date !== slot.date ||
      memory.ageYears !== slot.ageYears ||
      memory.label !== slot.caption ||
      memory.source.kind !== 'immich'
    ) {
      fail('manifest.slot');
      return;
    }
    if (assetIds.has(memory.source.assetId)) fail('manifest.duplicate-photo');
    assetIds.add(memory.source.assetId);
    personIds.add(memory.source.personId);
  });
  if (personIds.size > 1) fail('manifest.person');
}

function validLadder(ladder: FrozenAbilityLadder): boolean {
  if (!ladder || !/^[a-z0-9][a-z0-9._-]{0,79}$/.test(ladder.version ?? '')) return false;
  if (!Array.isArray(ladder.grants) || ladder.grants.length < 1 || ladder.grants[0]?.fromAge !== 0) {
    return false;
  }
  let priorAge = -1;
  let prior: readonly string[] = [];
  for (const grant of ladder.grants) {
    if (!Number.isInteger(grant.fromAge) || grant.fromAge <= priorAge || grant.fromAge > 30) return false;
    const ordered = FAMILY_ABILITIES.filter((ability) => grant.abilities.includes(ability));
    if (
      ordered.length !== grant.abilities.length ||
      JSON.stringify(ordered) !== JSON.stringify(grant.abilities) ||
      !grant.abilities.includes('move') ||
      prior.some((ability) => !grant.abilities.includes(ability as never)) ||
      grant.abilities.length === prior.length
    ) return false;
    priorAge = grant.fromAge;
    prior = grant.abilities;
  }
  return true;
}

function chapterText(value: unknown, max: number, allowEmpty: boolean): boolean {
  return typeof value === 'string' && value.length <= max && (allowEmpty || value.trim().length > 0);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, nested]) => nested !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
