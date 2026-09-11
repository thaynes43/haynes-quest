import { resolve } from 'node:path';

export interface ServerConfig {
  fixtureMode: boolean;
  nodeEnv: string;
  databaseUrl: string;
  sessionSecret: string;
  appOrigin: string;
  port: number;
  clientDir: string;
  studioDir: string;
}

function requireValue(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const fixtureMode = env.QUEST_FIXTURE_MODE === 'true';
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (fixtureMode && nodeEnv === 'production') {
    throw new Error('Fixture mode is disabled in production');
  }
  if (fixtureMode && (env.IMMICH_URL || env.IMMICH_API_KEY)) {
    throw new Error('Fixture mode cannot receive Immich credentials');
  }

  const sessionSecret = (env.BETTER_AUTH_SECRET ?? env.QUEST_SESSION_SECRET)?.trim();
  if (!sessionSecret) throw new Error('BETTER_AUTH_SECRET is required');
  if (sessionSecret.length < 32) throw new Error('BETTER_AUTH_SECRET must be at least 32 characters');

  const origin = new URL(requireValue(env, 'QUEST_APP_ORIGIN'));
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/') {
    throw new Error('QUEST_APP_ORIGIN must be an HTTP(S) origin');
  }

  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT is invalid');

  return {
    fixtureMode,
    nodeEnv,
    databaseUrl: requireValue(env, 'DATABASE_URL'),
    sessionSecret,
    appOrigin: origin.origin,
    port,
    clientDir: resolve(env.QUEST_CLIENT_DIR ?? 'dist/client'),
    studioDir: resolve(env.QUEST_STUDIO_DIR ?? 'site'),
  };
}
