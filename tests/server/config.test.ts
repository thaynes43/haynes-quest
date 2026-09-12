import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/server/config.js';
import { InMemoryQuestStore } from '../../src/server/db/memory-store.js';
import { createConfiguredStore } from '../../src/server/index.js';

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

  it('requires a dedicated strong session secret and exact origin', () => {
    expect(() => loadConfig({ ...base, BETTER_AUTH_SECRET: 'short' })).toThrow('at least 32');
    expect(() => loadConfig({ ...base, QUEST_APP_ORIGIN: 'https://user:pass@quest.test/path' })).toThrow(
      'HTTP(S) origin',
    );
  });
});
