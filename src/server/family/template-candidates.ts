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
import type { FriendlyCatalogVersion } from '../../shared/friendly.js';

export type FamilyTemplateCandidates = ReadonlyMap<string, LevelEditorEnemyCandidate>;

const known = new Map<string, FamilyTemplateCandidates>();
const identities = new Set<string>();
let checkedInLoaded = false;

/**
 * SHA-256 of the canonical project and, only when present, its friendly roster
 * pin. Historical sources have no pin and retain their exact fingerprint bytes.
 */
export function familyTemplateFingerprint(
  project: LevelEditorProjectV2,
  friendlyCatalogVersion?: FriendlyCatalogVersion,
): string {
  const canonical = canonicalLevelEditorProjectJson(project);
  return createHash('sha256')
    .update(friendlyCatalogVersion === undefined ? canonical : `${canonical}\n${friendlyCatalogVersion}`, 'utf8')
    .digest('hex');
}

/** Records a template the process loaded (the registry calls this for every entry). */
export function rememberFamilyTemplate(
  fingerprint: string,
  project: LevelEditorProjectV2,
  id: string,
  version: string,
  friendlyCatalogVersion?: FriendlyCatalogVersion,
): void {
  identities.add(identityKey(id, version, fingerprint, friendlyCatalogVersion));
  if (!known.has(fingerprint)) {
    known.set(fingerprint, new Map(project.enemyCandidates.map((candidate) => [candidate.id, candidate])));
  }
}

/** The candidate table of the template with this fingerprint, or null when unknown. */
export function familyTemplateCandidates(fingerprint: string): FamilyTemplateCandidates | null {
  loadCheckedIn();
  return known.get(fingerprint) ?? null;
}

/** A plan's template identity and friendly pin must match loaded source metadata. */
export function isKnownFamilyTemplate(
  id: string,
  version: string,
  fingerprint: string,
  friendlyCatalogVersion?: FriendlyCatalogVersion,
): boolean {
  loadCheckedIn();
  return identities.has(identityKey(id, version, fingerprint, friendlyCatalogVersion));
}

function identityKey(id: string, version: string, fingerprint: string, pin?: FriendlyCatalogVersion): string {
  return `${id}@${version}:${fingerprint}:${pin ?? ''}`;
}

function loadCheckedIn(): void {
  if (checkedInLoaded) return;
  // Save validation can run before any registry exists; the checked-in
  // templates are always resolvable.
  checkedInLoaded = true;
  for (const source of CHECKED_IN_FAMILY_TEMPLATES) {
    const { project } = resolveLevelEditorProject(source.project);
    if (isLevelEditorProjectV2(project)) {
      rememberFamilyTemplate(
        familyTemplateFingerprint(project, source.friendlyCatalogVersion),
        project,
        source.id,
        source.version,
        source.friendlyCatalogVersion,
      );
    }
  }
}
