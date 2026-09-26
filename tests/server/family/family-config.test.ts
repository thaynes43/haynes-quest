import { describe, expect, it } from 'vitest';
import { calendarDate, loadConfig } from '../../../src/server/config.js';
import { InMemoryQuestStore } from '../../../src/server/db/memory-store.js';
import { createConfiguredFamily, createConfiguredImmich } from '../../../src/server/family/wiring.js';

const family = {
  DATABASE_URL: 'postgres://quest:local@example.invalid/quest',
  BETTER_AUTH_SECRET: 'a-safe-session-secret-with-more-than-32-characters',
  QUEST_APP_ORIGIN: 'https://quest.test',
  QUEST_OIDC_DISCOVERY_URL: 'https://idp.example.test/application/o/haynes-quest/.well-known/openid-configuration',
};

describe('family journey configuration', () => {
  it('keeps Immich optional and pins it to its own origin', () => {
    expect(loadConfig(family).immich).toBeNull();
    expect(loadConfig({ ...family, IMMICH_URL: 'http://immich.test:2283', IMMICH_API_KEY: 'synthetic-key' }).immich)
      .toEqual({ url: 'http://immich.test:2283', apiKey: 'synthetic-key', allowedOrigins: ['http://immich.test:2283'] });
    expect(() => loadConfig({ ...family, IMMICH_URL: 'http://immich.test:2283' })).toThrow('set together');
    expect(() => loadConfig({ ...family, IMMICH_URL: 'http://immich.test/api', IMMICH_API_KEY: 'k' })).toThrow('origin');
    expect(() => loadConfig({ ...family, IMMICH_URL: 'ftp://immich.test', IMMICH_API_KEY: 'k' })).toThrow('origin');
  });

  it('builds the adapter only outside fixture mode and only with Immich', () => {
    const withImmich = loadConfig({ ...family, IMMICH_URL: 'http://immich.test:2283', IMMICH_API_KEY: 'synthetic-key' });
    expect(createConfiguredImmich(withImmich)).not.toBeNull();
    expect(createConfiguredImmich(loadConfig(family))).toBeNull();
    // Family journeys need Postgres; the in-memory fixture store never gets them.
    expect(createConfiguredFamily(withImmich, new InMemoryQuestStore(), null)).toBeNull();
  });

  it('reads the household calendar date in its time zone', () => {
    expect(loadConfig(family).householdTimeZone).toBe('UTC');
    expect(loadConfig({ ...family, QUEST_HOUSEHOLD_TIME_ZONE: 'America/New_York' }).householdTimeZone)
      .toBe('America/New_York');
    expect(() => loadConfig({ ...family, QUEST_HOUSEHOLD_TIME_ZONE: 'Mars/Olympus' })).toThrow('IANA');
    const lateEvening = new Date('2026-02-28T03:30:00.000Z');
    expect(calendarDate(lateEvening, 'UTC')).toBe('2026-02-28');
    expect(calendarDate(lateEvening, 'America/New_York')).toBe('2026-02-27');
  });
});
