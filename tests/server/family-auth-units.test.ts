import { describe, expect, it } from 'vitest';
import {
  decideAdmission,
  deriveSessionSubkey,
  deriveSubjectIdSecret,
  readGroupsClaim,
  SUBJECT_ID_SECRET_LABEL,
} from '../../src/server/auth/index.js';
import { ImmichPhotoSource } from '../../src/server/photos/immich.js';

const SECRET = 'family-session-secret-that-is-at-least-32-characters';
const policy = { admittedGroups: ['family', 'authentik Admins'], adminGroups: ['authentik Admins'] };

describe('family admission', () => {
  it('admits family and administrators, and grants admin only to administrators', () => {
    expect(decideAdmission(['family'], policy)).toEqual({ admitted: true, role: 'player' });
    expect(decideAdmission(['authentik Admins'], policy)).toEqual({ admitted: true, role: 'admin' });
    expect(decideAdmission(['family', 'authentik Admins'], policy)).toEqual({ admitted: true, role: 'admin' });
    // An administrator group admits even when it is not listed as an admitted group.
    expect(decideAdmission(['operators'], { admittedGroups: ['family'], adminGroups: ['operators'] }))
      .toEqual({ admitted: true, role: 'admin' });
  });

  it('admits nobody for a missing, malformed or unrelated groups claim', () => {
    for (const claim of [undefined, null, 'family', {}, [], ['Family'], [' family'], ['portal users'], [1, 'family']]) {
      expect(decideAdmission(claim, policy)).toEqual({ admitted: false });
    }
    expect(readGroupsClaim(Array.from({ length: 257 }, () => 'family'))).toBeNull();
  });
});

describe('session subkeys', () => {
  it('derives a stable, independent subject-id key from the session secret', () => {
    const key = deriveSubjectIdSecret(SECRET);
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(deriveSubjectIdSecret(SECRET)).toBe(key);
    expect(key).toBe(deriveSessionSubkey(SECRET, SUBJECT_ID_SECRET_LABEL));
    expect(key).not.toContain(SECRET);
    expect(deriveSubjectIdSecret(`${SECRET}-rotated`)).not.toBe(key);
    expect(deriveSessionSubkey(SECRET, 'haynes-quest/candidate-token/v1')).not.toBe(key);
    // It satisfies the Immich adapter's subject-id secret contract.
    expect(() => new ImmichPhotoSource({} as never, key, 'family-household')).not.toThrow();
  });

  it('refuses a weak session secret or an empty label', () => {
    expect(() => deriveSubjectIdSecret('short')).toThrow('at least 32');
    expect(() => deriveSessionSubkey(SECRET, ' ')).toThrow('label');
  });
});
