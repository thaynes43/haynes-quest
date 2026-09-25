import { describe, expect, it } from 'vitest';
import { CANDIDATE_TOKEN_TTL_MS, CandidateTokens } from '../../../src/server/family/tokens.js';

const KEY = 'synthetic-subject-id-key-with-at-least-32-bytes';
const DRAFT = '20000000-0000-4000-8000-000000000001';
const ASSET = '10000000-0000-4000-8000-00000000abcd';

function tokens(now: { value: number }, key = KEY) {
  return new CandidateTokens(key, { now: () => now.value });
}

describe('candidate tokens (DESIGN-024 D-06)', () => {
  it('round-trips a claim for its draft', () => {
    const clock = { value: 1_750_000_000_000 };
    const issuer = tokens(clock);
    const token = issuer.issue({ draftId: DRAFT, assetId: ASSET, localDate: '2024-02-29' });
    expect(token).toMatch(/^ct1\.[A-Za-z0-9_-]+$/);
    expect(issuer.verify(token, DRAFT)).toMatchObject({ draftId: DRAFT, assetId: ASSET, localDate: '2024-02-29' });
    expect(issuer.verify(token)).toMatchObject({ assetId: ASSET });
  });

  it('keeps the upstream asset id out of the token', () => {
    const token = tokens({ value: 1_750_000_000_000 }).issue({ draftId: DRAFT, assetId: ASSET, localDate: '2024-02-29' });
    expect(token).not.toContain(ASSET);
    expect(token).not.toContain(Buffer.from(ASSET).toString('base64url').slice(0, 16));
    expect(Buffer.from(token.slice(4), 'base64url').toString('latin1')).not.toContain('abcd');
  });

  it('expires', () => {
    const clock = { value: 1_750_000_000_000 };
    const issuer = tokens(clock);
    const token = issuer.issue({ draftId: DRAFT, assetId: ASSET, localDate: '2024-02-29' });
    clock.value += CANDIDATE_TOKEN_TTL_MS - 2_000;
    expect(issuer.verify(token, DRAFT)).not.toBeNull();
    clock.value += 3_000;
    expect(issuer.verify(token, DRAFT)).toBeNull();
  });

  it('rejects tampering, another draft, another key and garbage', () => {
    const clock = { value: 1_750_000_000_000 };
    const issuer = tokens(clock);
    const token = issuer.issue({ draftId: DRAFT, assetId: ASSET, localDate: '2024-02-29' });
    const body = Buffer.from(token.slice(4), 'base64url');
    for (const index of [0, 13, body.byteLength - 1]) {
      const tampered = Buffer.from(body);
      tampered[index] = tampered[index]! ^ 0x01;
      expect(issuer.verify(`ct1.${tampered.toString('base64url')}`, DRAFT)).toBeNull();
    }
    expect(issuer.verify(token, '20000000-0000-4000-8000-000000000002')).toBeNull();
    expect(tokens(clock, `${KEY}-rotated`).verify(token, DRAFT)).toBeNull();
    for (const garbage of [undefined, 42, '', 'ct1.', 'ct2.' + token.slice(4), 'ct1.%%%', `ct1.${'A'.repeat(2_000)}`]) {
      expect(issuer.verify(garbage, DRAFT)).toBeNull();
    }
  });

  it('refuses a short key', () => {
    expect(() => new CandidateTokens('too-short')).toThrow('at least 32 bytes');
  });
});
