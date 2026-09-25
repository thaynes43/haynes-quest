import { memoryAdapter } from 'better-auth/adapters/memory';
import { Hono } from 'hono';
import { createServer, type Socket } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
import {
  FAMILY_CALLBACK_PATH,
  FAMILY_SESSION_LIFETIME_SECONDS,
  FamilyAuth,
  InMemoryFamilyPlayerStore,
  PostgresFamilyPlayerStore,
  requireAdmin,
  requireFamilySession,
  type AuthLogEntry,
  type FamilyPlayerStore,
} from '../../src/server/auth/index.js';
import type { FamilyAuthConfig } from '../../src/server/config.js';
import { InMemoryQuestStore } from '../../src/server/db/memory-store.js';
import { PostgresQuestStore } from '../../src/server/db/postgres-store.js';
import type { QuestStore } from '../../src/server/domain.js';
import type { SessionView } from '../../src/shared/contracts.js';
import { startFakeIdp, createFakeIdp, type FakeIdentity, type FakeIdp } from './fake-oidc-provider.js';

// Synthetic identities only. This repository is public.
const ORIGIN = 'https://quest.test';
const SECRET = 'family-session-secret-that-is-at-least-32-characters';
const CLIENT_ID = 'haynes-quest';
const CALLBACK = `${ORIGIN}${FAMILY_CALLBACK_PATH}`;
const SESSION_COOKIE = '__Secure-quest-family.session_token';

const FAMILY_MEMBER: FakeIdentity = {
  sub: 'synthetic-member-0001',
  groups: ['family', 'unrelated group'],
  name: 'Synthetic Member',
  email: 'member@example.test',
};
const ADMIN: FakeIdentity = {
  sub: 'synthetic-admin-0001',
  groups: ['authentik Admins'],
  preferred_username: 'synthetic-admin',
  email: 'admin@example.test',
};
const OUTSIDER: FakeIdentity = {
  sub: 'synthetic-outsider-0001',
  groups: ['portal users'],
  name: 'Synthetic Outsider',
  email: 'outsider@example.test',
};

interface AuthTables {
  users: number;
  sessions: number;
  accounts: number;
  players: number;
}

interface Backend {
  name: string;
  store: () => QuestStore;
  players: () => FamilyPlayerStore;
  database: () => ConstructorParameters<typeof FamilyAuth>[0]['database'];
  counts: () => Promise<AuthTables>;
  expireSessions: () => Promise<void>;
  storedTokens: () => Promise<unknown[]>;
  sessionRows: () => Promise<Array<{ expiresAt: Date; ipAddress: unknown; userAgent: unknown }>>;
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

function memoryBackend(): Backend {
  let tables = emptyTables();
  let players = new InMemoryFamilyPlayerStore();
  let store = new InMemoryQuestStore();
  return {
    name: 'memory',
    store: () => store,
    players: () => players,
    database: () => memoryAdapter(tables),
    counts: async () => ({
      users: tables.quest_auth_users.length,
      sessions: tables.quest_auth_sessions.length,
      accounts: tables.quest_auth_accounts.length,
      players: players.count(),
    }),
    expireSessions: async () => {
      for (const session of tables.quest_auth_sessions) session.expires_at = new Date(Date.now() - 1_000);
    },
    // Better Auth's memory adapter stores rows under the mapped column names.
    storedTokens: async () =>
      tables.quest_auth_accounts.flatMap((account) => [account.access_token, account.refresh_token, account.id_token]),
    sessionRows: async () =>
      tables.quest_auth_sessions.map((session) => ({
        expiresAt: new Date(session.expires_at as Date),
        ipAddress: session.ip_address,
        userAgent: session.user_agent,
      })),
    reset: async () => {
      tables = emptyTables();
      players = new InMemoryFamilyPlayerStore();
      store = new InMemoryQuestStore();
    },
    close: async () => undefined,
  };
}

function emptyTables(): Record<string, Array<Record<string, unknown>>> & {
  quest_auth_users: Array<Record<string, unknown>>;
  quest_auth_sessions: Array<Record<string, unknown>>;
  quest_auth_accounts: Array<Record<string, unknown>>;
  quest_auth_verifications: Array<Record<string, unknown>>;
} {
  return {
    quest_auth_users: [],
    quest_auth_sessions: [],
    quest_auth_accounts: [],
    quest_auth_verifications: [],
  };
}

const testDatabaseUrl = process.env.QUEST_TEST_DATABASE_URL;

function postgresBackend(url: string): Backend {
  const store = PostgresQuestStore.connect(url);
  const players = new PostgresFamilyPlayerStore(store.pool);
  const count = async (table: string) =>
    Number((await store.pool.query<{ count: string }>(`SELECT count(*) FROM ${table}`)).rows[0]!.count);
  return {
    name: 'Postgres',
    store: () => store,
    players: () => players,
    database: () => store.pool,
    counts: async () => ({
      users: await count('quest_auth_users'),
      sessions: await count('quest_auth_sessions'),
      accounts: await count('quest_auth_accounts'),
      players: Number(
        (
          await store.pool.query<{ count: string }>(
            'SELECT count(*) FROM quest_players WHERE oidc_subject IS NOT NULL',
          )
        ).rows[0]!.count,
      ),
    }),
    expireSessions: async () => {
      await store.pool.query(`UPDATE quest_auth_sessions SET expires_at = now() - interval '1 second'`);
    },
    storedTokens: async () =>
      (
        await store.pool.query<{ access_token: unknown; refresh_token: unknown; id_token: unknown }>(
          'SELECT access_token, refresh_token, id_token FROM quest_auth_accounts',
        )
      ).rows.flatMap((row) => [row.access_token, row.refresh_token, row.id_token]),
    sessionRows: async () =>
      (
        await store.pool.query<{ expires_at: Date; ip_address: unknown; user_agent: unknown }>(
          'SELECT expires_at, ip_address, user_agent FROM quest_auth_sessions',
        )
      ).rows.map((row) => ({ expiresAt: row.expires_at, ipAddress: row.ip_address, userAgent: row.user_agent })),
    reset: async () => {
      await store.migrate();
      await store.pool.query(`
        TRUNCATE quest_auth_sessions, quest_auth_accounts, quest_auth_verifications, quest_auth_users,
          quest_saves, quest_setup_previews, quest_fixture_sessions, quest_players
        RESTART IDENTITY CASCADE
      `);
    },
    close: async () => store.close(),
  };
}

function authConfig(idp: FakeIdp, overrides: Partial<FamilyAuthConfig> = {}): FamilyAuthConfig {
  return {
    discoveryUrl: idp.discoveryUrl,
    clientId: CLIENT_ID,
    clientSecret: null,
    admittedGroups: ['family', 'authentik Admins'],
    adminGroups: ['authentik Admins'],
    endSessionUrl: null,
    ...overrides,
  };
}

function cookiePairs(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';', 1)[0]!)
    .join('; ');
}

function sessionCookieFrom(response: Response): string | null {
  const cookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith(`${SESSION_COOKIE}=`) && !/max-age=0/i.test(value));
  return cookie ? cookie.split(';', 1)[0]! : null;
}

type App = ReturnType<typeof createApp>;

async function startSignIn(app: App): Promise<{ url: URL; cookies: string }> {
  const response = await app.request('/api/auth/sign-in/social', {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as { url: string; redirect: boolean };
  return { url: new URL(body.url), cookies: cookiePairs(response) };
}

async function callback(app: App, back: URL, cookies: string): Promise<Response> {
  return app.request(`${back.pathname}${back.search}`, { headers: { cookie: cookies } });
}

/** A full browser round trip: start, Authentik, callback. */
async function signIn(app: App, idp: FakeIdp, identity: FakeIdentity) {
  idp.identity = identity;
  const started = await startSignIn(app);
  const back = await idp.authorize(started.url.toString());
  const response = await callback(app, back, started.cookies);
  return { response, cookie: sessionCookieFrom(response) };
}

async function session(app: App, cookie: string | null): Promise<Response> {
  return app.request('/api/session', { headers: cookie ? { cookie } : {} });
}

function write(cookie: string, path: string, body: unknown, extra: Record<string, string> = {}) {
  return {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      cookie,
      origin: ORIGIN,
      'content-type': 'application/json',
      'x-quest-request': '1',
      ...extra,
    },
  };
}

const backends: Backend[] = [memoryBackend(), ...(testDatabaseUrl ? [postgresBackend(testDatabaseUrl)] : [])];

describe.each(backends)('family sign-in ($name)', (backend) => {
  let idp: FakeIdp;
  let logs: AuthLogEntry[];

  beforeAll(async () => {
    idp = await startFakeIdp({ clientId: CLIENT_ID, redirectUri: CALLBACK });
  });
  afterAll(async () => {
    await idp.stop();
    await backend.close();
  });
  beforeEach(async () => {
    await backend.reset();
    idp.tampering = {};
    logs = [];
  });

  function makeFamilyApp(overrides: Partial<FamilyAuthConfig> = {}) {
    const familyAuth = new FamilyAuth({
      config: authConfig(idp, overrides),
      appOrigin: ORIGIN,
      secret: SECRET,
      database: backend.database(),
      players: backend.players(),
      logSink: (entry) => logs.push(entry),
    });
    const app = createApp({
      store: backend.store(),
      fixtureMode: false,
      sessionSecret: SECRET,
      appOrigin: ORIGIN,
      clientDir: '/tmp/quest-client-not-present',
      studioDir: '/tmp/quest-studio-not-present',
      familyAuth,
    });
    return { app, familyAuth };
  }

  it('starts a public PKCE authorization request for the haynes-quest client and exact callback', async () => {
    const { app } = makeFamilyApp();
    const { url } = await startSignIn(app);
    expect(url.origin + url.pathname).toBe(`${idp.origin}/application/o/authorize/`);
    expect(url.searchParams.get('client_id')).toBe('haynes-quest');
    expect(url.searchParams.get('redirect_uri')).toBe('https://quest.test/api/auth/callback/authentik');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get('nonce')).toBeTruthy();
    expect(url.searchParams.get('scope')?.split(' ')).toEqual(expect.arrayContaining(['openid', 'profile', 'email']));
    expect(url.searchParams.has('client_secret')).toBe(false);
  });

  it('admits a family member with a player session, a secure seven-day cookie and no stored tokens', async () => {
    const { app } = makeFamilyApp();
    const { response, cookie } = await signIn(app, idp, FAMILY_MEMBER);
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/');
    expect(cookie).toBeTruthy();
    const setCookie = response.headers.getSetCookie().find((value) => value.startsWith(`${SESSION_COOKIE}=`))!;
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Secure/i);
    expect(setCookie).toMatch(new RegExp(`Max-Age=${FAMILY_SESSION_LIFETIME_SECONDS}`, 'i'));

    const token = idp.tokenRequests.at(-1)!;
    expect(token.get('client_id')).toBe('haynes-quest');
    expect(token.has('client_secret')).toBe(false);
    expect(token.get('code_verifier')).toBeTruthy();

    const current = await session(app, cookie);
    expect(current.status).toBe(200);
    const view = (await current.json()) as SessionView;
    expect(view).toMatchObject({
      mode: 'family',
      role: 'player',
      player: { label: 'Synthetic Member' },
      endSessionAvailable: false,
      csrfHeader: 'X-Quest-Request',
    });
    expect(JSON.stringify(view)).not.toContain('member@example.test');
    expect(await backend.counts()).toEqual({ users: 1, sessions: 1, accounts: 1, players: 1 });
    expect(await backend.storedTokens()).toEqual([null, null, null]);
    const [row] = await backend.sessionRows();
    expect(row!.ipAddress ?? null).toBeNull();
    expect(row!.userAgent ?? null).toBeNull();

    // Family sessions reach the ordinary owner-scoped routes.
    const saves = await app.request('/api/saves', { headers: { cookie: cookie! } });
    expect(saves.status).toBe(200);
    expect(await saves.json()).toEqual({ saves: [] });
  });

  it('grants the administrator role only to authentik Admins', async () => {
    const { app } = makeFamilyApp();
    const admin = await signIn(app, idp, ADMIN);
    const member = await signIn(app, idp, FAMILY_MEMBER);
    const adminView = (await (await session(app, admin.cookie)).json()) as SessionView;
    const memberView = (await (await session(app, member.cookie)).json()) as SessionView;
    expect(adminView).toMatchObject({ mode: 'family', role: 'admin', player: { label: 'synthetic-admin' } });
    expect(memberView).toMatchObject({ mode: 'family', role: 'player' });
    expect(adminView.player.id).not.toBe(memberView.player.id);
  });

  it('rejects a valid login without an admitted group and creates no session, user or player', async () => {
    const { app } = makeFamilyApp();
    const { response, cookie } = await signIn(app, idp, OUTSIDER);
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/?error=not_admitted&error_description=not_admitted');
    expect(cookie).toBeNull();
    expect(await backend.counts()).toEqual({ users: 0, sessions: 0, accounts: 0, players: 0 });

    for (const groups of [undefined, 'family', [], [42]]) {
      const attempt = await signIn(app, idp, { ...OUTSIDER, groups });
      expect(attempt.cookie).toBeNull();
      expect(attempt.response.headers.get('location')).toContain('error=not_admitted');
    }
    expect(await backend.counts()).toEqual({ users: 0, sessions: 0, accounts: 0, players: 0 });
  });

  it('rejects a tampered state, a tampered or replayed code and a callback without its state cookie', async () => {
    const { app } = makeFamilyApp();
    idp.identity = FAMILY_MEMBER;

    const forgedState = await startSignIn(app);
    const forgedBack = await idp.authorize(forgedState.url.toString());
    forgedBack.searchParams.set('state', `${forgedBack.searchParams.get('state')}x`);
    const forged = await callback(app, forgedBack, forgedState.cookies);
    expect(forged.status).toBe(302);
    expect(forged.headers.get('location')).toMatch(/^\/\?error=/);
    expect(sessionCookieFrom(forged)).toBeNull();

    const forgedCode = await startSignIn(app);
    const codeBack = await idp.authorize(forgedCode.url.toString());
    codeBack.searchParams.set('code', 'not-a-code-the-provider-issued');
    const badCode = await callback(app, codeBack, forgedCode.cookies);
    expect(badCode.headers.get('location')).toMatch(/^\/\?error=invalid_code/);
    expect(sessionCookieFrom(badCode)).toBeNull();

    const noCookie = await startSignIn(app);
    const noCookieBack = await idp.authorize(noCookie.url.toString());
    const withoutStateCookie = await callback(app, noCookieBack, '');
    expect(withoutStateCookie.headers.get('location')).toMatch(/^\/\?error=/);
    expect(sessionCookieFrom(withoutStateCookie)).toBeNull();

    expect(await backend.counts()).toMatchObject({ sessions: 0, players: 0 });

    // A successful callback cannot be replayed.
    const good = await startSignIn(app);
    const goodBack = await idp.authorize(good.url.toString());
    const first = await callback(app, goodBack, good.cookies);
    expect(sessionCookieFrom(first)).toBeTruthy();
    const replay = await callback(app, goodBack, good.cookies);
    expect(replay.headers.get('location')).toMatch(/^\/\?error=/);
    expect(sessionCookieFrom(replay)).toBeNull();
    expect(await backend.counts()).toMatchObject({ sessions: 1, players: 1 });
  });

  it('rejects an ID token that is forged, bound to another nonce or missing', async () => {
    const { app } = makeFamilyApp();
    for (const tampering of [{ foreignSignature: true }, { wrongNonce: true }, { omitIdToken: true }]) {
      idp.tampering = tampering;
      const { response, cookie } = await signIn(app, idp, ADMIN);
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toMatch(/^\/\?error=/);
      expect(cookie).toBeNull();
    }
    expect(await backend.counts()).toEqual({ users: 0, sessions: 0, accounts: 0, players: 0 });
  });

  it('keeps the seven-day expiry fixed and returns 401 once a session expires', async () => {
    const { app } = makeFamilyApp();
    const { cookie } = await signIn(app, idp, FAMILY_MEMBER);
    const [created] = await backend.sessionRows();
    const lifetime = created!.expiresAt.valueOf() - Date.now();
    expect(lifetime).toBeGreaterThan(FAMILY_SESSION_LIFETIME_SECONDS * 1_000 - 60_000);
    expect(lifetime).toBeLessThanOrEqual(FAMILY_SESSION_LIFETIME_SECONDS * 1_000);

    for (let request = 0; request < 3; request += 1) {
      const current = await session(app, cookie);
      expect(current.status).toBe(200);
      expect(current.headers.getSetCookie()).toEqual([]);
    }
    const [afterUse] = await backend.sessionRows();
    expect(afterUse!.expiresAt.valueOf()).toBe(created!.expiresAt.valueOf());

    await backend.expireSessions();
    const expired = await session(app, cookie);
    expect(expired.status).toBe(401);
    expect(((await expired.json()) as { error: { code: string } }).error.code).toBe('AUTH_REQUIRED');
    expect((await app.request('/api/saves', { headers: { cookie: cookie! } })).status).toBe(401);
  });

  it('signs out locally behind the write guard and offers Authentik end-session only on request', async () => {
    const { app } = makeFamilyApp({ endSessionUrl: idp.endSessionUrl });
    const { cookie } = await signIn(app, idp, FAMILY_MEMBER);
    const view = (await (await session(app, cookie)).json()) as SessionView;
    expect(view).toMatchObject({ mode: 'family', endSessionAvailable: true });

    expect((await app.request('/api/sign-out', write(cookie!, '/api/sign-out', {}, { origin: 'https://evil.test' }))).status).toBe(403);
    expect((await app.request('/api/sign-out', write(cookie!, '/api/sign-out', {}, { 'x-quest-request': '0' }))).status).toBe(403);
    expect((await session(app, cookie)).status).toBe(200);

    const signedOut = await app.request('/api/sign-out', write(cookie!, '/api/sign-out', {}));
    expect(signedOut.status).toBe(200);
    expect(await signedOut.json()).toEqual({ signedOut: true, endSessionUrl: null });
    const cleared = signedOut.headers.getSetCookie().find((value) => value.startsWith(`${SESSION_COOKIE}=`));
    expect(cleared).toMatch(/Max-Age=0/i);
    expect((await session(app, cookie)).status).toBe(401);
    expect(await backend.counts()).toMatchObject({ sessions: 0 });

    const again = await signIn(app, idp, FAMILY_MEMBER);
    const everywhere = await app.request('/api/sign-out', write(again.cookie!, '/api/sign-out', { endSession: true }));
    expect(await everywhere.json()).toEqual({ signedOut: true, endSessionUrl: idp.endSessionUrl });
    expect((await session(app, again.cookie)).status).toBe(401);

    const withoutEndSession = makeFamilyApp().app;
    const third = await signIn(withoutEndSession, idp, FAMILY_MEMBER);
    const local = await withoutEndSession.request('/api/sign-out', write(third.cookie!, '/api/sign-out', { endSession: true }));
    expect(await local.json()).toEqual({ signedOut: true, endSessionUrl: null });
  });

  it('keys players by issuer and subject, never by email or display name', async () => {
    const { app } = makeFamilyApp();
    const first = await signIn(app, idp, FAMILY_MEMBER);
    const second = await signIn(app, idp, { ...FAMILY_MEMBER, name: 'Renamed Member', email: 'new@example.test' });
    const sameEmail = await signIn(app, idp, { ...OUTSIDER, groups: ['family'], email: FAMILY_MEMBER.email });
    const firstView = (await (await session(app, first.cookie)).json()) as SessionView;
    const secondView = (await (await session(app, second.cookie)).json()) as SessionView;
    const sameEmailView = (await (await session(app, sameEmail.cookie)).json()) as SessionView;
    expect(secondView.player.id).toBe(firstView.player.id);
    expect(firstView.player.label).toBe('Renamed Member');
    expect(sameEmailView.player.id).not.toBe(firstView.player.id);
    expect(await backend.counts()).toEqual({ users: 2, sessions: 3, accounts: 2, players: 2 });
  });

  it('re-checks groups at every sign-in: a downgrade applies at once and removal ends every session', async () => {
    const { app } = makeFamilyApp();
    const adminDevice = await signIn(app, idp, ADMIN);
    expect(await (await session(app, adminDevice.cookie)).json()).toMatchObject({ role: 'admin' });

    const downgraded = await signIn(app, idp, { ...ADMIN, groups: ['family'] });
    expect(await (await session(app, downgraded.cookie)).json()).toMatchObject({ role: 'player' });
    expect(await (await session(app, adminDevice.cookie)).json()).toMatchObject({ role: 'player' });

    const removed = await signIn(app, idp, { ...ADMIN, groups: [] });
    expect(removed.cookie).toBeNull();
    expect(removed.response.headers.get('location')).toContain('error=not_admitted');
    expect((await session(app, adminDevice.cookie)).status).toBe(401);
    expect((await session(app, downgraded.cookie)).status).toBe(401);
  });

  it('keeps the exact-origin and X-Quest-Request guard on app writes for family sessions', async () => {
    const { app } = makeFamilyApp();
    const { cookie } = await signIn(app, idp, FAMILY_MEMBER);
    const body = { previewId: '11111111-1111-4111-8111-111111111111', selectedIds: ['m'] };
    const noHeader = await app.request('/api/saves', write(cookie!, '/api/saves', body, { 'x-quest-request': '' }));
    expect(noHeader.status).toBe(403);
    const wrongOrigin = await app.request('/api/saves', write(cookie!, '/api/saves', body, { origin: 'https://quest.test.evil' }));
    expect(wrongOrigin.status).toBe(403);
    const guarded = await app.request('/api/saves', write(cookie!, '/api/saves', body));
    expect(guarded.status).toBe(404);
    expect(((await guarded.json()) as { error: { code: string } }).error.code).toBe('PREVIEW_NOT_FOUND');
  });

  it('exposes only sign-in start and the callback, with a fixed provider, return path and no ID-token sign-in', async () => {
    const { app } = makeFamilyApp();
    for (const [method, path] of [
      ['GET', '/api/auth/get-session'],
      ['POST', '/api/auth/sign-out'],
      ['POST', '/api/auth/sign-in/email'],
      ['POST', '/api/auth/sign-up/email'],
      ['POST', '/api/auth/update-user'],
      ['POST', '/api/auth/link-social'],
      ['GET', '/api/auth/error'],
      ['GET', '/api/auth/callback/other'],
      ['GET', '/api/auth/sign-in/social'],
    ] as const) {
      const response = await app.request(path, { method, headers: { origin: ORIGIN } });
      expect(response.status, `${method} ${path}`).toBe(404);
    }

    idp.identity = FAMILY_MEMBER;
    const hostile = await app.request('/api/auth/sign-in/social', {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'other',
        callbackURL: 'https://evil.test/steal',
        errorCallbackURL: 'https://evil.test/error',
        idToken: { token: 'header.payload.signature' },
      }),
    });
    expect(hostile.status).toBe(200);
    const { url } = (await hostile.json()) as { url: string };
    const back = await idp.authorize(url);
    const landed = await callback(app, back, cookiePairs(hostile));
    expect(landed.headers.get('location')).toBe('/');
    expect(sessionCookieFrom(landed)).toBeTruthy();
  });

  it('refuses to start sign-in from a foreign origin', async () => {
    const { app } = makeFamilyApp();
    const response = await app.request('/api/auth/sign-in/social', {
      method: 'POST',
      headers: { origin: 'https://evil.test', 'content-type': 'application/json' },
      body: '{}',
    });
    expect(response.status).toBe(403);
  });

  it('authenticates as a confidential client when a client secret is configured', async () => {
    const confidential = await startFakeIdp({
      clientId: CLIENT_ID,
      clientSecret: 'synthetic-client-secret',
      redirectUri: CALLBACK,
    });
    try {
      const familyAuth = new FamilyAuth({
        config: authConfig(confidential, { clientSecret: 'synthetic-client-secret' }),
        appOrigin: ORIGIN,
        secret: SECRET,
        database: backend.database(),
        players: backend.players(),
        logSink: (entry) => logs.push(entry),
      });
      const app = createApp({
        store: backend.store(),
        fixtureMode: false,
        sessionSecret: SECRET,
        appOrigin: ORIGIN,
        clientDir: '/tmp/none',
        studioDir: '/tmp/none',
        familyAuth,
      });
      const { cookie } = await signIn(app, confidential, FAMILY_MEMBER);
      expect(cookie).toBeTruthy();
      expect(confidential.tokenRequests.at(-1)!.get('client_secret')).toBe('synthetic-client-secret');
    } finally {
      await confidential.stop();
    }
  });

  it('logs only fixed messages, never claims or identifiers', async () => {
    const { app } = makeFamilyApp();
    idp.tampering = { foreignSignature: true };
    await signIn(app, idp, FAMILY_MEMBER);
    idp.tampering = {};
    await signIn(app, idp, OUTSIDER);
    await signIn(app, idp, FAMILY_MEMBER);
    const text = JSON.stringify(logs);
    for (const secret of [FAMILY_MEMBER.sub, FAMILY_MEMBER.email!, FAMILY_MEMBER.name!, OUTSIDER.sub, 'eyJ']) {
      expect(text).not.toContain(secret);
    }
    expect(logs.every((entry) => entry.event === 'auth_log' && Object.keys(entry).length === 3)).toBe(true);
  });

  it('supports family-lane route guards for admins and admitted players', async () => {
    const { app, familyAuth } = makeFamilyApp();
    const admin = await signIn(app, idp, ADMIN);
    const member = await signIn(app, idp, FAMILY_MEMBER);
    const guarded = new Hono();
    guarded.get('/member', async (context) => context.json(await requireFamilySession(context, familyAuth)));
    guarded.get('/admin', async (context) => context.json(await requireAdmin(context, familyAuth)));
    guarded.onError((error, context) =>
      context.json({ code: (error as { code?: string }).code }, (error as { status?: 401 | 403 }).status ?? 500),
    );

    expect((await guarded.request('/member')).status).toBe(401);
    expect((await guarded.request('/admin')).status).toBe(401);
    const memberAsAdmin = await guarded.request('/admin', { headers: { cookie: member.cookie! } });
    expect(memberAsAdmin.status).toBe(403);
    expect(await memberAsAdmin.json()).toEqual({ code: 'ADMIN_REQUIRED' });
    const memberView = await guarded.request('/member', { headers: { cookie: member.cookie! } });
    expect(await memberView.json()).toMatchObject({ role: 'player' });
    const adminView = await guarded.request('/admin', { headers: { cookie: admin.cookie! } });
    expect(await adminView.json()).toMatchObject({ role: 'admin', label: 'synthetic-admin' });
  });
});

describe('fixture and family session isolation', () => {
  let idp: FakeIdp;
  beforeAll(async () => {
    idp = await startFakeIdp({ clientId: CLIENT_ID, redirectUri: CALLBACK });
  });
  afterAll(async () => {
    await idp.stop();
  });

  function apps() {
    const store = new InMemoryQuestStore();
    const familyAuth = new FamilyAuth({
      config: authConfig(idp),
      appOrigin: ORIGIN,
      secret: SECRET,
      database: memoryAdapter(emptyTables()),
      players: new InMemoryFamilyPlayerStore(),
      logSink: () => undefined,
    });
    const common = {
      store,
      sessionSecret: SECRET,
      appOrigin: ORIGIN,
      clientDir: '/tmp/none',
      studioDir: '/tmp/none',
    };
    return {
      family: createApp({ ...common, fixtureMode: false, familyAuth }),
      fixture: createApp({ ...common, fixtureMode: true }),
      familyAuth,
    };
  }

  it('rejects a fixture session in family mode', async () => {
    const { family, fixture } = apps();
    const fixtureSession = await fixture.request('/api/session');
    expect(((await fixtureSession.json()) as SessionView).mode).toBe('fixture');
    const fixtureCookie = cookiePairs(fixtureSession);
    expect(fixtureCookie).toContain('quest_fixture_session=');
    expect((await family.request('/api/session', { headers: { cookie: fixtureCookie } })).status).toBe(401);
    expect((await family.request('/api/saves', { headers: { cookie: fixtureCookie } })).status).toBe(401);
    expect((await family.request('/api/fixture-media/memory-1', { headers: { cookie: fixtureCookie } })).status).toBe(404);
  });

  it('rejects a family cookie in fixture mode and never serves Better Auth there', async () => {
    const { family, fixture } = apps();
    const { cookie } = await signIn(family, idp, FAMILY_MEMBER);
    expect(cookie).toBeTruthy();
    expect((await fixture.request('/api/saves', { headers: { cookie: cookie! } })).status).toBe(401);
    const fixtureSession = await fixture.request('/api/session', { headers: { cookie: cookie! } });
    const view = (await fixtureSession.json()) as SessionView;
    expect(view.mode).toBe('fixture');
    expect(view).not.toHaveProperty('role');
    for (const [method, path] of [
      ['POST', '/api/auth/sign-in/social'],
      ['GET', `${FAMILY_CALLBACK_PATH}?code=x&state=y`],
      ['POST', '/api/sign-out'],
    ] as const) {
      expect((await fixture.request(path, { method, headers: { origin: ORIGIN } })).status).toBe(404);
    }
  });

  it('refuses family sign-in inside a fixture app', () => {
    const { familyAuth } = apps();
    expect(() => createApp({
      store: new InMemoryQuestStore(),
      fixtureMode: true,
      sessionSecret: SECRET,
      appOrigin: ORIGIN,
      clientDir: '/tmp/none',
      studioDir: '/tmp/none',
      familyAuth,
    })).toThrow('cannot use family sign-in');
  });
});

describe('Authentik unavailable at startup', () => {
  it('heals once discovery answers, without a restart', async () => {
    const reserved = await startFakeIdp({ clientId: CLIENT_ID, redirectUri: CALLBACK });
    const port = Number(new URL(reserved.origin).port);
    await reserved.stop();
    const idp = createFakeIdp({ clientId: CLIENT_ID, redirectUri: CALLBACK, port });
    let now = 1_000_000;
    const familyAuth = new FamilyAuth({
      config: authConfig(idp),
      appOrigin: ORIGIN,
      secret: SECRET,
      database: memoryAdapter(emptyTables()),
      players: new InMemoryFamilyPlayerStore(),
      logSink: () => undefined,
      clock: () => now,
    });
    const app = createApp({
      store: new InMemoryQuestStore(),
      fixtureMode: false,
      sessionSecret: SECRET,
      appOrigin: ORIGIN,
      clientDir: '/tmp/none',
      studioDir: '/tmp/none',
      familyAuth,
    });
    try {
      const unavailable = await app.request('/api/auth/sign-in/social', {
        method: 'POST',
        headers: { origin: ORIGIN, 'content-type': 'application/json' },
        body: '{}',
      });
      expect(unavailable.status).toBeGreaterThanOrEqual(400);

      await idp.start();
      now += 29_000;
      const stillCoolingDown = await app.request('/api/auth/sign-in/social', {
        method: 'POST',
        headers: { origin: ORIGIN, 'content-type': 'application/json' },
        body: '{}',
      });
      expect(stillCoolingDown.status).toBeGreaterThanOrEqual(400);

      now += 1_000;
      const { cookie } = await signIn(app, idp, FAMILY_MEMBER);
      expect(cookie).toBeTruthy();
      expect((await session(app, cookie)).status).toBe(200);
    } finally {
      await idp.stop();
    }
  });
});


describe('Authentik unavailable for signed-in players', () => {
  it('keeps serving existing sessions while discovery hangs', async () => {
    const idp = await startFakeIdp({ clientId: CLIENT_ID, redirectUri: CALLBACK });
    const tables = emptyTables();
    const players = new InMemoryFamilyPlayerStore();
    const store = new InMemoryQuestStore();
    const build = (discoveryUrl: string) =>
      createApp({
        store,
        fixtureMode: false,
        sessionSecret: SECRET,
        appOrigin: ORIGIN,
        clientDir: '/tmp/none',
        studioDir: '/tmp/none',
        familyAuth: new FamilyAuth({
          config: { ...authConfig(idp), discoveryUrl },
          appOrigin: ORIGIN,
          secret: SECRET,
          database: memoryAdapter(tables),
          players,
          logSink: () => undefined,
        }),
      });
    const { cookie } = await signIn(build(idp.discoveryUrl), idp, FAMILY_MEMBER);
    await idp.stop();

    // Accepts connections and never answers: discovery would wait for its timeout.
    const sockets = new Set<Socket>();
    const silent = createServer((socket) => {
      sockets.add(socket);
    });
    await new Promise<void>((resolve) => silent.listen(0, '127.0.0.1', resolve));
    const port = (silent.address() as { port: number }).port;
    try {
      const restarted = build(`http://127.0.0.1:${port}/.well-known/openid-configuration`);
      const answer = await Promise.race([
        session(restarted, cookie),
        new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 3_000)),
      ]);
      expect(answer).not.toBe('timeout');
      expect((answer as Response).status).toBe(200);
      const signedOut = await Promise.race([
        restarted.request('/api/sign-out', write(cookie!, '/api/sign-out', {})),
        new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 3_000)),
      ]);
      expect(signedOut).not.toBe('timeout');
      expect((signedOut as Response).status).toBe(200);
      expect((await session(restarted, cookie)).status).toBe(401);
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => silent.close(() => resolve()));
    }
  });
});

describe.skipIf(!testDatabaseUrl)('Postgres family identity', () => {
  let store: PostgresQuestStore;
  let players: PostgresFamilyPlayerStore;
  const issuer = 'https://idp.example.test/application/o/haynes-quest/';

  beforeAll(async () => {
    store = PostgresQuestStore.connect(testDatabaseUrl!);
    await store.migrate();
    players = new PostgresFamilyPlayerStore(store.pool);
  });
  afterAll(async () => {
    await store.close();
  });
  beforeEach(async () => {
    await store.pool.query(`
      TRUNCATE quest_auth_sessions, quest_auth_accounts, quest_auth_verifications, quest_auth_users,
        quest_saves, quest_setup_previews, quest_fixture_sessions, quest_players
      RESTART IDENTITY CASCADE
    `);
  });

  async function violation(sql: string, params: unknown[]): Promise<string | undefined> {
    try {
      await store.pool.query(sql, params);
      return undefined;
    } catch (error) {
      return (error as { code?: string }).code;
    }
  }

  it('Postgres enforces one player per (issuer, subject)', async () => {
    const insert = `INSERT INTO quest_players (id, label, oidc_issuer, oidc_subject, is_admin, groups_checked_at)
      VALUES (gen_random_uuid(), 'Synthetic', $1, $2, false, now())`;
    await store.pool.query(insert, [issuer, 'synthetic-subject-a']);
    expect(await violation(insert, [issuer, 'synthetic-subject-a'])).toBe('23505');
    // The same subject under another issuer is a different identity.
    await store.pool.query(insert, ['https://other-idp.example.test/', 'synthetic-subject-a']);
    // Fixture players carry no identity and never collide.
    await store.createFixtureSession('11111111-1111-4111-8111-111111111111', new Date(Date.now() + 60_000));
    await store.createFixtureSession('22222222-2222-4222-8222-222222222222', new Date(Date.now() + 60_000));
    // Half an identity, a family row without a group check, or an admin fixture row are refused.
    expect(await violation(
      `INSERT INTO quest_players (id, label, oidc_issuer) VALUES (gen_random_uuid(), 'x', $1)`,
      [issuer],
    )).toBe('23514');
    expect(await violation(
      `INSERT INTO quest_players (id, label, oidc_issuer, oidc_subject) VALUES (gen_random_uuid(), 'x', $1, 'b')`,
      [issuer],
    )).toBe('23514');
    expect(await violation(
      `INSERT INTO quest_players (id, label, is_admin) VALUES (gen_random_uuid(), 'x', $1)`,
      [true],
    )).toBe('23514');
    const counts = await store.pool.query<{ family: string; fixture: string }>(`
      SELECT count(*) FILTER (WHERE oidc_subject IS NOT NULL) AS family,
             count(*) FILTER (WHERE oidc_subject IS NULL) AS fixture
      FROM quest_players
    `);
    expect(counts.rows[0]).toEqual({ family: '2', fixture: '2' });
  });

  it('Postgres upserts keep the player id and refresh role and group check', async () => {
    const first = await players.upsertFamilyPlayer(
      { issuer, subject: 'synthetic-subject-b', label: 'Synthetic B', role: 'admin' },
      new Date('2026-09-01T00:00:00Z'),
    );
    const again = await players.upsertFamilyPlayer(
      { issuer, subject: 'synthetic-subject-b', label: 'Renamed B', role: 'player' },
      new Date('2026-09-02T00:00:00Z'),
    );
    expect(again).toEqual({
      id: first.id,
      label: 'Renamed B',
      role: 'player',
      groupsCheckedAt: new Date('2026-09-02T00:00:00Z'),
    });
    expect(await players.getFamilyPlayer(first.id)).toEqual(again);
    const fixture = await store.createFixtureSession(
      '33333333-3333-4333-8333-333333333333',
      new Date(Date.now() + 60_000),
    );
    expect(await players.getFamilyPlayer(fixture.id)).toBeNull();
    expect(await players.getFamilyPlayer('not-a-uuid')).toBeNull();
  });

  it('Postgres maintenance removes only expired sign-in records', async () => {
    const player = await players.upsertFamilyPlayer(
      { issuer, subject: 'synthetic-subject-c', label: 'Synthetic C', role: 'player' },
      new Date(),
    );
    await store.pool.query(
      `INSERT INTO quest_auth_users (id, name, email) VALUES ('user-c', 'Synthetic C', 'c@identity.haynes-quest.invalid')`,
    );
    await store.pool.query(
      `INSERT INTO quest_auth_sessions (id, user_id, player_id, token, expires_at)
       VALUES ('expired', 'user-c', $1, 'token-expired', now() - interval '1 minute'),
              ('active', 'user-c', $1, 'token-active', now() + interval '1 day')`,
      [player.id],
    );
    await store.pool.query(
      `INSERT INTO quest_auth_verifications (id, identifier, value, expires_at)
       VALUES ('v-expired', 'state', 'x', now() - interval '1 minute'), ('v-active', 'state', 'y', now() + interval '5 minutes')`,
    );
    expect(await players.deleteExpiredAuthRecords(new Date())).toBe(2);
    const remaining = await store.pool.query<{ id: string }>(
      `SELECT id FROM quest_auth_sessions UNION ALL SELECT id FROM quest_auth_verifications ORDER BY id`,
    );
    expect(remaining.rows.map((row) => row.id)).toEqual(['active', 'v-active']);
    // Deleting a player ends its sessions.
    await store.pool.query('DELETE FROM quest_players WHERE id = $1', [player.id]);
    expect((await store.pool.query('SELECT 1 FROM quest_auth_sessions')).rowCount).toBe(0);
  });
});
