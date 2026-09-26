/**
 * A family-mode test harness: fake Immich, in-memory stores, a fake family
 * session source and the real routes. Everything is synthetic.
 */
import type { Hono } from 'hono';
import { createApp } from '../../../src/server/app.js';
import type { FamilyAuth } from '../../../src/server/auth/family-auth.js';
import type { FamilyPlayer } from '../../../src/server/auth/player-store.js';
import { InMemoryQuestStore } from '../../../src/server/db/memory-store.js';
import { AutoPickJobs } from '../../../src/server/family/jobs.js';
import { InMemoryFamilyStore } from '../../../src/server/family/memory-store.js';
import { FamilyJourneyService } from '../../../src/server/family/service.js';
import { FamilyTemplateRegistry } from '../../../src/server/family/templates.js';
import { CandidateTokens } from '../../../src/server/family/tokens.js';
import { ImmichPhotoSource } from '../../../src/server/photos/immich.js';
import { SharpImageSanitizer } from '../../../src/server/photos/sanitizer.js';
import {
  FakeClock,
  FakeImmich,
  TEST_CHILD_A,
  TEST_CHILD_B,
  syntheticLibrary,
  type FakeAsset,
} from './fake-immich.js';

export const HARNESS_SECRET = 'synthetic-subject-id-key-with-at-least-32-bytes';
export const HARNESS_TODAY = '2026-09-25';
export const HARNESS_ORIGIN = 'https://quest.test';
export const ADMIN: FamilyPlayer = { id: '40000000-0000-4000-8000-00000000000a', label: 'Synthetic Admin', role: 'admin' };
export const MEMBER: FamilyPlayer = { id: '40000000-0000-4000-8000-00000000000b', label: 'Synthetic Member', role: 'player' };
const registry = new FamilyTemplateRegistry();

export function fakeFamilyAuth(players: Record<string, FamilyPlayer>): FamilyAuth {
  return {
    endSessionAvailable: false,
    async currentPlayer(headers: Headers) {
      const token = /quest_test_session=([^;]+)/.exec(headers.get('cookie') ?? '')?.[1];
      return token ? players[token] ?? null : null;
    },
    async handle() {
      return null;
    },
    async signOut() {
      return { setCookies: [], endSessionUrl: null };
    },
    async deleteExpiredRecords() {
      return 0;
    },
  } as unknown as FamilyAuth;
}

export interface FamilyHarness {
  app: Hono;
  clock: FakeClock;
  immich: FakeImmich;
  library: ImmichPhotoSource;
  questStore: InMemoryQuestStore;
  familyStore: InMemoryFamilyStore;
  service: FamilyJourneyService;
  tokens: CandidateTokens;
  jobs: AutoPickJobs;
  assets: FakeAsset[];
  request(path: string, options?: { as?: 'admin' | 'member' | null; method?: string; body?: unknown }): Promise<Response>;
}

export function familyHarness(options: {
  assets?: FakeAsset[];
  withImmich?: boolean;
  questStore?: InMemoryQuestStore;
} = {}): FamilyHarness {
  const clock = new FakeClock();
  const assets = options.assets ?? syntheticLibrary();
  const immich = new FakeImmich([
    { id: TEST_CHILD_B.personId, name: TEST_CHILD_B.name, birthDate: TEST_CHILD_B.birthDate },
    { id: TEST_CHILD_A.personId, name: TEST_CHILD_A.name, birthDate: TEST_CHILD_A.birthDate },
  ], assets, clock);
  const library = new ImmichPhotoSource(immich, HARNESS_SECRET, 'test-connection', {}, new SharpImageSanitizer());
  const questStore = options.questStore ?? new InMemoryQuestStore();
  const familyStore = new InMemoryFamilyStore(() => new Date(clock.now()));
  const tokens = new CandidateTokens(HARNESS_SECRET, { now: () => clock.now() });
  const service = new FamilyJourneyService({
    store: familyStore,
    library,
    templates: registry,
    tokens,
    clock,
    today: () => HARNESS_TODAY,
    newSeed: () => 'synthetic-seed-fixed-0001',
  });
  const jobs = new AutoPickJobs();
  const withImmich = options.withImmich ?? true;
  const app = createApp({
    store: questStore,
    fixtureMode: false,
    sessionSecret: 'synthetic-session-secret-with-32-plus-chars',
    appOrigin: HARNESS_ORIGIN,
    clientDir: 'public',
    studioDir: 'public',
    familyAuth: fakeFamilyAuth({ admin: ADMIN, member: MEMBER }),
    family: {
      store: familyStore,
      templates: registry,
      service: withImmich ? service : null,
      jobs,
      today: () => HARNESS_TODAY,
    },
    ...(withImmich ? { privateMedia: library } : {}),
    now: () => new Date(clock.now()),
  });
  return {
    app,
    clock,
    immich,
    library,
    questStore,
    familyStore,
    service,
    tokens,
    jobs,
    assets,
    request(path, request = {}) {
      const as = request.as === undefined ? 'admin' : request.as;
      const method = request.method ?? (request.body === undefined ? 'GET' : 'POST');
      const headers: Record<string, string> = {};
      if (as) headers.cookie = `quest_test_session=${as}`;
      if (method !== 'GET') {
        headers.origin = HARNESS_ORIGIN;
        headers['x-quest-request'] = '1';
        headers['content-type'] = 'application/json';
      }
      return Promise.resolve(app.request(path, {
        method,
        headers,
        ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
      }));
    },
  };
}
