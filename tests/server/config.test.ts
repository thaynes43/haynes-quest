import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/server/config.js';

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

  it('requires a dedicated strong session secret and exact origin', () => {
    expect(() => loadConfig({ ...base, BETTER_AUTH_SECRET: 'short' })).toThrow('at least 32');
    expect(() => loadConfig({ ...base, QUEST_APP_ORIGIN: 'https://user:pass@quest.test/path' })).toThrow(
      'HTTP(S) origin',
    );
  });
});
