import { hkdfSync } from 'node:crypto';

/**
 * Fixed HKDF labels (ADR-005 D-08). Changing a label rotates every value
 * derived from it, so treat each one as a versioned contract.
 */
export const SUBJECT_ID_SECRET_LABEL = 'haynes-quest/subject-id-hmac/v1';
const HKDF_SALT = 'haynes-quest/session-subkeys';
const MIN_SESSION_SECRET_LENGTH = 32;

/**
 * Derives an independent 256-bit subkey from the session secret with
 * HKDF-SHA256 and a fixed label, returned as base64url (43 characters).
 * Different labels give unrelated keys, and none reveals the session secret.
 */
export function deriveSessionSubkey(sessionSecret: string, label: string): string {
  if (sessionSecret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error('Session secret must be at least 32 characters');
  }
  if (!label.trim()) throw new Error('A subkey label is required');
  return Buffer.from(hkdfSync('sha256', sessionSecret, HKDF_SALT, label, 32)).toString('base64url');
}

/**
 * The private subject-id HMAC key for Immich person and asset identifiers
 * (`ImmichPhotoSource`'s `subjectIdSecret`). No owner-entered secret is needed.
 */
export function deriveSubjectIdSecret(sessionSecret: string): string {
  return deriveSessionSubkey(sessionSecret, SUBJECT_ID_SECRET_LABEL);
}
