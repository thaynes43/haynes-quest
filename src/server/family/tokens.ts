/**
 * Candidate tokens (DESIGN-024 D-06): short-lived, opaque references to a
 * swap suggestion, bound to one draft.
 *
 * The key is derived with HKDF-SHA256 from the private subject-id key (ADR-005
 * D-08, supplied by the sign-in lane). A plain HMAC would authenticate the
 * draft id, asset id and expiry but leave the upstream asset id readable in the
 * client payload, which D-01 forbids; AES-256-GCM authenticates the same
 * fields and also keeps them confidential. Verification fails closed: any
 * malformed, tampered, expired or foreign token is simply `null`.
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { isDateOnly } from '../../shared/family-plan.js';

export const CANDIDATE_TOKEN_TTL_MS = 15 * 60_000;
const PREFIX = 'ct1.';
const AAD = Buffer.from('haynes-quest:candidate-token:v1', 'utf8');
const MAX_TOKEN_LENGTH = 1_024;

const payloadSchema = z.object({
  d: z.string().min(1).max(128),
  a: z.string().min(1).max(128),
  t: z.string().refine(isDateOnly),
  e: z.number().int().positive(),
}).strict();

export interface CandidateClaim {
  readonly draftId: string;
  readonly assetId: string;
  /** Local calendar date of the photo, fixed when the suggestion was issued. */
  readonly localDate: string;
  readonly expiresAt: number;
}

export class CandidateTokens {
  private readonly key: Buffer;

  constructor(
    secret: string | Uint8Array,
    private readonly options: { ttlMs?: number; now?: () => number } = {},
  ) {
    const material = typeof secret === 'string' ? Buffer.from(secret, 'utf8') : Buffer.from(secret);
    if (material.byteLength < 32) throw new Error('Candidate token key must be at least 32 bytes');
    this.key = Buffer.from(hkdfSync('sha256', material, 'haynes-quest', 'candidate-token-v1', 32));
    const ttl = options.ttlMs ?? CANDIDATE_TOKEN_TTL_MS;
    if (!Number.isSafeInteger(ttl) || ttl < 1_000 || ttl > 60 * 60_000) throw new Error('Invalid token lifetime');
  }

  issue(claim: { draftId: string; assetId: string; localDate: string }): string {
    const expiresAt = this.now() + (this.options.ttlMs ?? CANDIDATE_TOKEN_TTL_MS);
    const payload = payloadSchema.parse({
      d: claim.draftId,
      a: claim.assetId,
      t: claim.localDate,
      e: Math.ceil(expiresAt / 1_000),
    });
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(AAD);
    const body = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    return `${PREFIX}${Buffer.concat([iv, body, cipher.getAuthTag()]).toString('base64url')}`;
  }

  /** `expectedDraftId` rejects a valid token issued for another draft. */
  verify(token: unknown, expectedDraftId?: string): CandidateClaim | null {
    if (typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH || !token.startsWith(PREFIX)) return null;
    const encoded = token.slice(PREFIX.length);
    if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
    const raw = Buffer.from(encoded, 'base64url');
    if (raw.byteLength < 12 + 16 + 2) return null;
    let payload: z.infer<typeof payloadSchema>;
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, raw.subarray(0, 12));
      decipher.setAAD(AAD);
      decipher.setAuthTag(raw.subarray(raw.byteLength - 16));
      const plain = Buffer.concat([
        decipher.update(raw.subarray(12, raw.byteLength - 16)),
        decipher.final(),
      ]).toString('utf8');
      const parsed = payloadSchema.safeParse(JSON.parse(plain));
      if (!parsed.success) return null;
      payload = parsed.data;
    } catch {
      return null;
    }
    const expiresAt = payload.e * 1_000;
    const now = this.now();
    const ttl = this.options.ttlMs ?? CANDIDATE_TOKEN_TTL_MS;
    if (expiresAt <= now || expiresAt > now + ttl + 1_000) return null;
    if (expectedDraftId !== undefined && payload.d !== expectedDraftId) return null;
    return { draftId: payload.d, assetId: payload.a, localDate: payload.t, expiresAt };
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }
}
