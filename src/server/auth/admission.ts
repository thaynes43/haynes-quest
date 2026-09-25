import type { PlayerRole } from '../../shared/contracts.js';

/** Group names come from Authentik's `groups` claim and match exactly. */
export interface AdmissionPolicy {
  admittedGroups: readonly string[];
  adminGroups: readonly string[];
}

export type AdmissionDecision =
  | { admitted: false }
  | { admitted: true; role: PlayerRole };

const MAX_GROUPS = 256;

/** Returns the claim's group names, or null when the claim is missing or malformed. */
export function readGroupsClaim(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_GROUPS) return null;
  if (!value.every((group) => typeof group === 'string')) return null;
  return value;
}

/**
 * ADR-005 D-03: an admitted group or an administrator group admits the person;
 * only an administrator group grants the administrator role. A missing or
 * malformed claim admits nobody.
 */
export function decideAdmission(groupsClaim: unknown, policy: AdmissionPolicy): AdmissionDecision {
  const groups = readGroupsClaim(groupsClaim);
  if (!groups) return { admitted: false };
  const held = new Set(groups);
  if (policy.adminGroups.some((group) => held.has(group))) return { admitted: true, role: 'admin' };
  if (policy.admittedGroups.some((group) => held.has(group))) return { admitted: true, role: 'player' };
  return { admitted: false };
}
