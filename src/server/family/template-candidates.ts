/**
 * Candidate tables of known family templates, keyed by template fingerprint.
 *
 * A frozen family plan names each neutral candidate only by id; the period,
 * role, kind and eligibility window live in its template. Templates are never
 * edited in place, so the plan's frozen template fingerprint finds exactly the
 * table the builder used, and load validation re-checks the cast against it
 * (DESIGN-024 D-07). Unknown fingerprints resolve to null: fail closed.
 */
import { createHash } from 'node:crypto';
import {
  canonicalLevelEditorProjectJson,
  isLevelEditorProjectV2,
  resolveLevelEditorProject,
  type LevelEditorEnemyCandidate,
  type LevelEditorProjectV2,
} from '../../shared/editor-project.js';
import { CHECKED_IN_FAMILY_TEMPLATES } from './checked-in-templates.js';

export type FamilyTemplateCandidates = ReadonlyMap<string, LevelEditorEnemyCandidate>;

const known = new Map<string, FamilyTemplateCandidates>();
let checkedInLoaded = false;

/** SHA-256 of the canonical template project: the fingerprint plans freeze. */
export function familyTemplateFingerprint(project: LevelEditorProjectV2): string {
  return createHash('sha256').update(canonicalLevelEditorProjectJson(project), 'utf8').digest('hex');
}

/** Records a template the process loaded (the registry calls this for every entry). */
export function rememberFamilyTemplate(fingerprint: string, project: LevelEditorProjectV2): void {
  if (known.has(fingerprint)) return;
  known.set(fingerprint, new Map(project.enemyCandidates.map((candidate) => [candidate.id, candidate])));
}

/** The candidate table of the template with this fingerprint, or null when unknown. */
export function familyTemplateCandidates(fingerprint: string): FamilyTemplateCandidates | null {
  const hit = known.get(fingerprint);
  if (hit || checkedInLoaded) return hit ?? null;
  // Save validation can run before any registry exists; the checked-in
  // templates are always resolvable.
  checkedInLoaded = true;
  for (const source of CHECKED_IN_FAMILY_TEMPLATES) {
    const { project } = resolveLevelEditorProject(source.project);
    if (isLevelEditorProjectV2(project)) rememberFamilyTemplate(familyTemplateFingerprint(project), project);
  }
  return known.get(fingerprint) ?? null;
}
