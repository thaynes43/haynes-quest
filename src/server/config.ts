import { resolve } from 'node:path';

export interface ServerConfig {
  fixtureMode: boolean;
  ephemeralPlaytest: boolean;
  nodeEnv: string;
  databaseUrl: string | null;
  sessionSecret: string;
  appOrigin: string;
  port: number;
  clientDir: string;
  studioDir: string;
  /** Family sign-in (ADR-005). Always null in fixture mode, always set otherwise. */
  familyAuth: FamilyAuthConfig | null;
}

/** Authentik OIDC and admission settings for the family release (ADR-005 D-01, D-03, D-06). */
export interface FamilyAuthConfig {
  discoveryUrl: string;
  clientId: string;
  /** Null for the public PKCE client; set only once the provider becomes confidential. */
  clientSecret: string | null;
  admittedGroups: string[];
  adminGroups: string[];
  /** Authentik end-session URL for "sign out of Haynes Network too"; null offers local sign-out only. */
  endSessionUrl: string | null;
}

export const DEFAULT_OIDC_CLIENT_ID = 'haynes-quest';
export const DEFAULT_ADMITTED_GROUPS = ['family', 'authentik Admins'];
export const DEFAULT_ADMIN_GROUPS = ['authentik Admins'];

function requireValue(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const fixtureMode = env.QUEST_FIXTURE_MODE === 'true';
  const ephemeralPlaytest = env.QUEST_EPHEMERAL_PLAYTEST === 'true';
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (fixtureMode && nodeEnv === 'production') {
    throw new Error('Fixture mode is disabled in production');
  }
  if (fixtureMode && (env.IMMICH_URL || env.IMMICH_API_KEY)) {
    throw new Error('Fixture mode cannot receive Immich credentials');
  }
  if (ephemeralPlaytest && (!fixtureMode || nodeEnv !== 'development')) {
    throw new Error('Ephemeral playtest requires fixture development mode');
  }
  if (fixtureMode && (env.QUEST_OIDC_DISCOVERY_URL?.trim() || env.QUEST_OIDC_CLIENT_SECRET?.trim())) {
    throw new Error('Fixture mode cannot receive OIDC configuration');
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
    ephemeralPlaytest,
    nodeEnv,
    databaseUrl: ephemeralPlaytest ? null : requireValue(env, 'DATABASE_URL'),
    sessionSecret,
    appOrigin: origin.origin,
    port,
    clientDir: resolve(env.QUEST_CLIENT_DIR ?? 'dist/client'),
    studioDir: resolve(env.QUEST_STUDIO_DIR ?? 'site'),
    familyAuth: fixtureMode ? null : loadFamilyAuthConfig(env, nodeEnv),
  };
}

function loadFamilyAuthConfig(env: NodeJS.ProcessEnv, nodeEnv: string): FamilyAuthConfig {
  const allowPlainHttp = nodeEnv !== 'production';
  const discoveryUrl = parseEndpoint(
    requireValue(env, 'QUEST_OIDC_DISCOVERY_URL'),
    'QUEST_OIDC_DISCOVERY_URL',
    allowPlainHttp,
  );
  const clientId = env.QUEST_OIDC_CLIENT_ID?.trim() || DEFAULT_OIDC_CLIENT_ID;
  if (!/^[\x21-\x7e]{1,255}$/.test(clientId)) throw new Error('QUEST_OIDC_CLIENT_ID is invalid');
  const admittedGroups = parseGroups(env.QUEST_ADMITTED_GROUPS, DEFAULT_ADMITTED_GROUPS, 'QUEST_ADMITTED_GROUPS');
  const adminGroups = parseGroups(env.QUEST_ADMIN_GROUPS, DEFAULT_ADMIN_GROUPS, 'QUEST_ADMIN_GROUPS');
  const endSession = env.QUEST_AUTH_END_SESSION?.trim();
  return {
    discoveryUrl,
    clientId,
    clientSecret: env.QUEST_OIDC_CLIENT_SECRET?.trim() || null,
    admittedGroups,
    adminGroups,
    endSessionUrl: endSession
      ? parseEndpoint(endSession, 'QUEST_AUTH_END_SESSION', allowPlainHttp)
      : null,
  };
}

function parseEndpoint(value: string, name: string, allowPlainHttp: boolean): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL`);
  }
  const allowed = allowPlainHttp ? ['https:', 'http:'] : ['https:'];
  if (!allowed.includes(url.protocol) || url.username || url.password || url.hash) {
    throw new Error(`${name} must be an ${allowPlainHttp ? 'HTTP(S)' : 'HTTPS'} URL`);
  }
  return url.href;
}

function parseGroups(value: string | undefined, fallback: string[], name: string): string[] {
  if (value === undefined || !value.trim()) return [...fallback];
  const groups = [...new Set(value.split(',').map((group) => group.trim()).filter(Boolean))];
  if (!groups.length) throw new Error(`${name} must name at least one group`);
  return groups;
}
