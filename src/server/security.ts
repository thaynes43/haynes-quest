import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { PlayerRecord, QuestStore } from './domain.js';
import { AppError } from './errors.js';

const SESSION_COOKIE = 'quest_fixture_session';
const SESSION_LIFETIME_SECONDS = 7 * 24 * 60 * 60;

export class FixtureSessions {
  constructor(
    private readonly store: QuestStore,
    private readonly secret: string,
    private readonly secureCookie: boolean,
  ) {}

  async current(context: Context): Promise<PlayerRecord | null> {
    const sessionId = verifyToken(getCookie(context, SESSION_COOKIE), this.secret);
    return sessionId ? this.store.getSession(sessionId, new Date()) : null;
  }

  async establish(context: Context): Promise<PlayerRecord> {
    const current = await this.current(context);
    if (current) return current;
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_LIFETIME_SECONDS * 1_000);
    const player = await this.store.createFixtureSession(sessionId, expiresAt);
    setCookie(context, SESSION_COOKIE, signToken(sessionId, this.secret), {
      httpOnly: true,
      sameSite: 'Lax',
      secure: this.secureCookie,
      path: '/',
      maxAge: SESSION_LIFETIME_SECONDS,
    });
    return player;
  }
}

export function enforceMutationSecurity(context: Context, appOrigin: string): void {
  if (context.req.header('origin') !== appOrigin) {
    throw new AppError(403, 'ORIGIN_REJECTED', 'Origin rejected');
  }
  if (context.req.header('x-quest-request') !== '1') {
    throw new AppError(403, 'CSRF_REJECTED', 'Request rejected');
  }
}

export function signToken(sessionId: string, secret: string): string {
  return `${sessionId}.${signature(sessionId, secret)}`;
}

export function verifyToken(value: string | undefined, secret: string): string | null {
  if (!value) return null;
  const match = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/i.exec(value);
  if (!match) return null;
  const expected = Buffer.from(signature(match[1]!, secret));
  const actual = Buffer.from(match[2]!);
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? match[1]! : null;
}

function signature(sessionId: string, secret: string): string {
  return createHmac('sha256', secret).update(sessionId).digest('base64url');
}

export class RequestLimiter {
  private readonly windows = new Map<string, { startedAt: number; count: number }>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {}

  take(key: string, now = Date.now()): void {
    const current = this.windows.get(key);
    if (!current || now - current.startedAt >= this.windowMs) {
      this.windows.set(key, { startedAt: now, count: 1 });
      return;
    }
    current.count += 1;
    if (current.count > this.maxRequests) throw new AppError(429, 'RATE_LIMITED', 'Too many requests');
    if (this.windows.size > 2_000) {
      for (const [keyToCheck, value] of this.windows) {
        if (now - value.startedAt >= this.windowMs) this.windows.delete(keyToCheck);
      }
    }
  }
}
