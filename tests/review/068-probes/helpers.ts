import { createApp } from '../../../src/server/app.js';
import { InMemoryQuestStore } from '../../../src/server/db/memory-store.js';
import type { SafeDiagnostic } from '../../../src/server/app.js';
import type { SaveRecord } from '../../../src/server/domain.js';

export const ORIGIN = 'https://quest.test';
export const SECRET = 'fixture-session-secret-that-is-at-least-32-characters';

export function makeApp(store: InMemoryQuestStore = new InMemoryQuestStore(), now?: () => Date) {
  const diagnostics: SafeDiagnostic[] = [];
  return {
    store,
    diagnostics,
    app: createApp({
      store,
      fixtureMode: true,
      sessionSecret: SECRET,
      appOrigin: ORIGIN,
      clientDir: '/tmp/quest-client-not-present',
      studioDir: '/tmp/quest-studio-not-present',
      diagnosticSink: (entry) => diagnostics.push(entry),
      now,
    }),
  };
}

export function makeEphemeralApp(
  store: InMemoryQuestStore = InMemoryQuestStore.ephemeral(),
  now?: () => Date,
) {
  const diagnostics: SafeDiagnostic[] = [];
  return {
    store,
    diagnostics,
    app: createApp({
      store,
      fixtureMode: true,
      ephemeralPlaytest: true,
      sessionSecret: SECRET,
      appOrigin: ORIGIN,
      clientDir: '/tmp/quest-client-not-present',
      studioDir: '/tmp/quest-studio-not-present',
      diagnosticSink: (entry) => diagnostics.push(entry),
      now,
    }),
  };
}

export type TestApp = ReturnType<typeof makeApp>['app'];

export async function startSession(app: TestApp) {
  const response = await app.request('/api/session');
  const cookie = response.headers.get('set-cookie')!.split(';', 1)[0]!;
  return { cookie, status: response.status, body: await response.json() };
}

export function mutation(cookie: string, body: unknown, extra: Record<string, string> = {}): RequestInit {
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

export async function preview(app: TestApp, cookie: string) {
  const response = await app.request(
    '/api/setup/preview',
    mutation(cookie, { name: 'Demo Adventurer', birthDate: '2020-01-01' }),
  );
  return { status: response.status, body: await response.json() };
}

export async function startPlaytest(app: TestApp, cookie: string, chapter: 1 | 2) {
  const response = await app.request('/api/playtest/start', mutation(cookie, { chapter }));
  return { status: response.status, body: await response.json() };
}

export type { SaveRecord };
