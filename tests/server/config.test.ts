import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/server/config.js';
import { InMemoryQuestStore } from '../../src/server/db/memory-store.js';
import { createConfiguredFamilyAuth, createConfiguredStore } from '../../src/server/index.js';

const base = {
  DATABASE_URL: 'postgres://quest:local@example.invalid/quest',
  BETTER_AUTH_SECRET: 'a-safe-session-secret-with-more-than-32-characters',
  QUEST_APP_ORIGIN: 'https://quest.test',
};

describe('server configuration', () => {
  it('rejects fixture mode in production', () => {
    expect(() => loadConfig({ ...base, QUEST_FIXTURE_MODE: 'true', NODE_ENV: 'production' })).toThrow(
      'Fixture mode is disabled',
    );
  });

  it('rejects Immich credentials in the fixture process', () => {
    expect(() => loadConfig({ ...base, QUEST_FIXTURE_MODE: 'true', IMMICH_API_KEY: 'private' })).toThrow(
      'cannot receive Immich credentials',
    );
  });

  it('allows an explicit fixture-development playtest to start without a database', () => {
    const { DATABASE_URL: _databaseUrl, ...withoutDatabase } = base;
    const config = loadConfig({
      ...withoutDatabase,
      NODE_ENV: 'development',
      QUEST_FIXTURE_MODE: 'true',
      QUEST_EPHEMERAL_PLAYTEST: 'true',
    });

    expect(config).toMatchObject({
      fixtureMode: true,
      ephemeralPlaytest: true,
      databaseUrl: null,
    });
    expect(createConfiguredStore(config)).toBeInstanceOf(InMemoryQuestStore);
  });

  it('rejects ephemeral progress outside the isolated fixture deployment', () => {
    expect(() => loadConfig({ ...base, QUEST_EPHEMERAL_PLAYTEST: 'true' })).toThrow(
      'Ephemeral playtest requires fixture development mode',
    );
    expect(() => loadConfig({
      ...base,
      NODE_ENV: 'test',
      QUEST_FIXTURE_MODE: 'true',
      QUEST_EPHEMERAL_PLAYTEST: 'true',
    })).toThrow('Ephemeral playtest requires fixture development mode');
  });

  it('continues to require Postgres configuration for normal persistent mode', () => {
    const { DATABASE_URL: _databaseUrl, ...withoutDatabase } = base;
    expect(() => loadConfig({ ...withoutDatabase, QUEST_FIXTURE_MODE: 'true' })).toThrow(
      'DATABASE_URL is required',
    );
  });

  it('requires the Authentik discovery URL outside fixture mode and applies ADR-005 defaults', () => {
    expect(() => loadConfig(base)).toThrow('QUEST_OIDC_DISCOVERY_URL is required');
    const config = loadConfig({
      ...base,
      QUEST_OIDC_DISCOVERY_URL: 'https://idp.example.test/application/o/haynes-quest/.well-known/openid-configuration',
    });
    expect(config.familyAuth).toEqual({
      discoveryUrl: 'https://idp.example.test/application/o/haynes-quest/.well-known/openid-configuration',
      clientId: 'haynes-quest',
      clientSecret: null,
      admittedGroups: ['family', 'authentik Admins'],
      adminGroups: ['authentik Admins'],
      endSessionUrl: null,
    });
  });

  it('reads the optional client secret, group lists and end-session URL', () => {
    const config = loadConfig({
      ...base,
      NODE_ENV: 'production',
      QUEST_OIDC_DISCOVERY_URL: 'https://idp.example.test/.well-known/openid-configuration',
      QUEST_OIDC_CLIENT_ID: 'quest-client',
      QUEST_OIDC_CLIENT_SECRET: ' synthetic-secret ',
      QUEST_ADMITTED_GROUPS: ' family , household ,family',
      QUEST_ADMIN_GROUPS: 'operators',
      QUEST_AUTH_END_SESSION: 'https://idp.example.test/application/o/haynes-quest/end-session/',
    });
    expect(config.familyAuth).toEqual({
      discoveryUrl: 'https://idp.example.test/.well-known/openid-configuration',
      clientId: 'quest-client',
      clientSecret: 'synthetic-secret',
      admittedGroups: ['family', 'household'],
      adminGroups: ['operators'],
      endSessionUrl: 'https://idp.example.test/application/o/haynes-quest/end-session/',
    });
    expect(() => loadConfig({ ...base, QUEST_OIDC_DISCOVERY_URL: 'https://idp.test/x', QUEST_ADMITTED_GROUPS: ' , ' }))
      .toThrow('QUEST_ADMITTED_GROUPS must name at least one group');
  });

  it('requires HTTPS identity endpoints in production', () => {
    const production = { ...base, NODE_ENV: 'production' };
    expect(() => loadConfig({ ...production, QUEST_OIDC_DISCOVERY_URL: 'http://idp.test/.well-known/openid-configuration' }))
      .toThrow('QUEST_OIDC_DISCOVERY_URL must be an HTTPS URL');
    expect(() => loadConfig({
      ...production,
      QUEST_OIDC_DISCOVERY_URL: 'https://idp.test/.well-known/openid-configuration',
      QUEST_AUTH_END_SESSION: 'http://idp.test/end-session/',
    })).toThrow('QUEST_AUTH_END_SESSION must be an HTTPS URL');
    expect(() => loadConfig({ ...production, QUEST_OIDC_DISCOVERY_URL: 'not a url' }))
      .toThrow('QUEST_OIDC_DISCOVERY_URL must be an absolute URL');
    expect(loadConfig({ ...base, QUEST_OIDC_DISCOVERY_URL: 'http://127.0.0.1:9000/.well-known/openid-configuration' })
      .familyAuth?.discoveryUrl).toBe('http://127.0.0.1:9000/.well-known/openid-configuration');
  });

  it('keeps fixture mode free of family sign-in configuration', () => {
    expect(loadConfig({ ...base, QUEST_FIXTURE_MODE: 'true' }).familyAuth).toBeNull();
    for (const name of ['QUEST_OIDC_DISCOVERY_URL', 'QUEST_OIDC_CLIENT_SECRET']) {
      expect(() => loadConfig({ ...base, QUEST_FIXTURE_MODE: 'true', [name]: 'https://idp.test/x' }))
        .toThrow('Fixture mode cannot receive OIDC configuration');
    }
  });

  it('constructs family sign-in only for the Postgres-backed non-fixture release', () => {
    const fixture = loadConfig({ ...base, QUEST_FIXTURE_MODE: 'true' });
    expect(createConfiguredFamilyAuth(fixture, new InMemoryQuestStore())).toBeNull();
    const family = loadConfig({ ...base, QUEST_OIDC_DISCOVERY_URL: 'https://idp.test/.well-known/openid-configuration' });
    expect(() => createConfiguredFamilyAuth(family, new InMemoryQuestStore())).toThrow('requires Postgres');
  });

  it('requires a dedicated strong session secret and exact origin', () => {
    expect(() => loadConfig({ ...base, BETTER_AUTH_SECRET: 'short' })).toThrow('at least 32');
    expect(() => loadConfig({ ...base, QUEST_APP_ORIGIN: 'https://user:pass@quest.test/path' })).toThrow(
      'HTTP(S) origin',
    );
  });
});
