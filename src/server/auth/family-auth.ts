import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { APIError } from 'better-auth/api';
import { genericOAuth, type GenericOAuthUserInfo } from 'better-auth/plugins/generic-oauth';
import type { Context } from 'hono';
import type { FamilyAuthConfig } from '../config.js';
import { AppError } from '../errors.js';
import { decideAdmission, type AdmissionPolicy } from './admission.js';
import type { FamilyIdentity, FamilyPlayer, FamilyPlayerStore } from './player-store.js';

/** Better Auth's provider id; it fixes the callback path below. */
export const AUTHENTIK_PROVIDER_ID = 'authentik';
export const FAMILY_AUTH_BASE_PATH = '/api/auth';
/** The only redirect URI registered in Authentik: `${QUEST_APP_ORIGIN}${FAMILY_CALLBACK_PATH}`. */
export const FAMILY_CALLBACK_PATH = `${FAMILY_AUTH_BASE_PATH}/callback/${AUTHENTIK_PROVIDER_ID}`;
export const FAMILY_SIGN_IN_PATH = `${FAMILY_AUTH_BASE_PATH}/sign-in/social`;
/** ADR-005 D-05: seven days, absolute. Sessions are never extended. */
export const FAMILY_SESSION_LIFETIME_SECONDS = 7 * 24 * 60 * 60;
/** The redirect error code for a valid login without an admitted group. */
export const NOT_ADMITTED_ERROR = 'not_admitted';

const COOKIE_PREFIX = 'quest-family';
const OIDC_SCOPES = ['openid', 'profile', 'email'];
/** Re-read discovery at most this often while the provider is unavailable. */
const PROVIDER_RETRY_MS = 30_000;
const MAX_LABEL_LENGTH = 80;
// Display name when Authentik supplies neither name nor username.
const FALLBACK_LABEL = 'Family member';

export interface AuthLogEntry {
  event: 'auth_log';
  level: 'debug' | 'info' | 'warn' | 'error';
  /** Better Auth's fixed message text only; arguments (which may carry claims or tokens) are dropped. */
  message: string;
}

export type AuthLogSink = (entry: AuthLogEntry) => void;

export interface FamilyAuthOptions {
  config: FamilyAuthConfig;
  /** QUEST_APP_ORIGIN: Better Auth's base URL and its only trusted origin. */
  appOrigin: string;
  /** BETTER_AUTH_SECRET: signs the session cookie. */
  secret: string;
  /** A `pg` Pool in production; a Better Auth memory adapter in tests. */
  database: BetterAuthOptions['database'];
  players: FamilyPlayerStore;
  logSink?: AuthLogSink;
  /** Milliseconds clock used only for the discovery retry interval. */
  clock?: () => number;
}

export interface FamilySignOutResult {
  /** Set-Cookie values that clear the session cookie. */
  setCookies: string[];
  endSessionUrl: string | null;
}

interface AdmissionSlot {
  admission?: FamilyIdentity;
}

/**
 * One admission decision per Better Auth request. `validateUserInfo` records it
 * and the session hook consumes it, so a session can only follow a fresh group
 * check made in the same callback.
 */
const admissionScope = new AsyncLocalStorage<AdmissionSlot>();

type Auth = ReturnType<typeof createFamilyBetterAuth>;

/**
 * Family sign-in (ADR-005): Authentik OIDC through Better Auth `genericOAuth`,
 * group admission at every sign-in, and Postgres sessions with a seven-day
 * absolute lifetime. Never constructed in fixture mode.
 */
export class FamilyAuth {
  readonly callbackUrl: string;
  /** Signs people in; depends on Authentik discovery. */
  private signInAuth: Auth;
  /** Reads and ends sessions; never waits on Authentik, so play continues through an outage. */
  private readonly sessionAuth: Auth;
  private builtAt: number;
  private readonly clock: () => number;

  constructor(private readonly options: FamilyAuthOptions) {
    this.clock = options.clock ?? Date.now;
    this.callbackUrl = `${options.appOrigin}${FAMILY_CALLBACK_PATH}`;
    this.signInAuth = createFamilyBetterAuth(options, true);
    this.sessionAuth = createFamilyBetterAuth(options, false);
    this.builtAt = this.clock();
  }

  get endSessionAvailable(): boolean {
    return this.options.config.endSessionUrl !== null;
  }

  /**
   * Serves the Better Auth routes this app exposes: starting sign-in and the
   * Authentik callback. Returns null for every other path, which the app answers 404.
   */
  async handle(request: Request): Promise<Response | null> {
    const path = new URL(request.url).pathname;
    if (request.method === 'POST' && path === FAMILY_SIGN_IN_PATH) {
      return this.run(signInRequest(request));
    }
    if (request.method === 'GET' && path === FAMILY_CALLBACK_PATH) {
      return this.run(request);
    }
    return null;
  }

  /** The signed-in family player, or null. Never extends the session. */
  async currentPlayer(headers: Headers, now = new Date()): Promise<FamilyPlayer | null> {
    const result = await this.sessionAuth.api.getSession({
      headers,
      query: { disableCookieCache: true, disableRefresh: true },
    });
    if (!result || result.session.expiresAt <= now) return null;
    const playerId = (result.session as { playerId?: unknown }).playerId;
    if (typeof playerId !== 'string') return null;
    const player = await this.options.players.getFamilyPlayer(playerId);
    if (!player) return null;
    // Defense in depth: group membership is re-checked at least weekly.
    if (now.valueOf() - player.groupsCheckedAt.valueOf() > FAMILY_SESSION_LIFETIME_SECONDS * 1_000) {
      return null;
    }
    return { id: player.id, label: player.label, role: player.role };
  }

  /** Deletes the game session (ADR-005 D-06). Authentik's session stays unless `endSession` is asked for. */
  async signOut(headers: Headers, endSession: boolean): Promise<FamilySignOutResult> {
    const response = await this.sessionAuth.api.signOut({ headers, asResponse: true });
    return {
      setCookies: response.headers.getSetCookie(),
      endSessionUrl: endSession ? this.options.config.endSessionUrl : null,
    };
  }

  async deleteExpiredRecords(now: Date): Promise<number> {
    return this.options.players.deleteExpiredAuthRecords(now);
  }

  private async run(request: Request): Promise<Response> {
    const auth = await this.readyAuth();
    return admissionScope.run({}, () => auth.handler(request));
  }

  /**
   * Better Auth reads OIDC discovery once, at construction. If Authentik was
   * unreachable then, the provider is missing; rebuild (at most every 30 s)
   * so an Authentik outage at startup heals without a pod restart.
   */
  private async readyAuth(): Promise<Auth> {
    if (await hasAuthentikProvider(this.signInAuth)) return this.signInAuth;
    if (this.clock() - this.builtAt >= PROVIDER_RETRY_MS) {
      this.signInAuth = createFamilyBetterAuth(this.options, true);
      this.builtAt = this.clock();
      await hasAuthentikProvider(this.signInAuth);
    }
    return this.signInAuth;
  }
}

/** Requires an admitted family session; 401 otherwise. */
export async function requireFamilySession(
  context: Context,
  familyAuth: FamilyAuth | null | undefined,
): Promise<FamilyPlayer> {
  const player = familyAuth ? await familyAuth.currentPlayer(context.req.raw.headers) : null;
  if (!player) throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required');
  return player;
}

/** Requires an administrator (`authentik Admins`); 401 when signed out, 403 for other members. */
export async function requireAdmin(
  context: Context,
  familyAuth: FamilyAuth | null | undefined,
): Promise<FamilyPlayer> {
  const player = await requireFamilySession(context, familyAuth);
  if (player.role !== 'admin') throw new AppError(403, 'ADMIN_REQUIRED', 'Administrator required');
  return player;
}

function createFamilyBetterAuth(options: FamilyAuthOptions, withProvider: boolean) {
  const { config } = options;
  const policy: AdmissionPolicy = {
    admittedGroups: config.admittedGroups,
    adminGroups: config.adminGroups,
  };
  const logSink = options.logSink ?? writeAuthLog;
  const stripTokens = async () => ({
    // Tokens are never needed after sign-in; keep none at rest.
    data: { accessToken: null, refreshToken: null, idToken: null },
  });

  return betterAuth({
    appName: 'Haynes Quest',
    baseURL: options.appOrigin,
    basePath: FAMILY_AUTH_BASE_PATH,
    secret: options.secret,
    trustedOrigins: [options.appOrigin],
    database: options.database,
    telemetry: { enabled: false },
    logger: {
      level: 'warn',
      log: (level, message) => {
        try {
          logSink({ event: 'auth_log', level, message: String(message).slice(0, 300) });
        } catch {
          // Logging never changes an authentication outcome.
        }
      },
    },
    onAPIError: { errorURL: '/' },
    // Behind the tunnel the whole household can share one client address, so
    // allow more than Better Auth's default three sign-in starts per 10 s.
    rateLimit: { customRules: { '/sign-in/social': { window: 60, max: 30 } } },
    advanced: {
      cookiePrefix: COOKIE_PREFIX,
      useSecureCookies: options.appOrigin.startsWith('https://'),
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' },
    },
    user: {
      modelName: 'quest_auth_users',
      fields: {
        emailVerified: 'email_verified',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
      validateUserInfo: async (data, context) => {
        const { source } = data;
        if (
          source.method !== 'oauth' ||
          source.oauth?.providerId !== AUTHENTIK_PROVIDER_ID ||
          source.action === 'link-account'
        ) {
          return { error: NOT_ADMITTED_ERROR };
        }
        const profile = source.oauth.profile ?? {};
        const identity = identityFromProfile(profile);
        const decision = decideAdmission(profile.groups, policy);
        if (!identity || !decision.admitted) {
          // Someone removed from the admitted groups loses their other sessions too.
          const userId = data.user.id;
          if (source.action === 'sign-in' && typeof userId === 'string') {
            await context.context.internalAdapter.deleteUserSessions(userId);
          }
          return { error: NOT_ADMITTED_ERROR };
        }
        const slot = admissionScope.getStore();
        if (!slot) return { error: NOT_ADMITTED_ERROR };
        slot.admission = { ...identity, role: decision.role };
      },
    },
    session: {
      modelName: 'quest_auth_sessions',
      fields: {
        userId: 'user_id',
        expiresAt: 'expires_at',
        ipAddress: 'ip_address',
        userAgent: 'user_agent',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
      additionalFields: {
        playerId: { type: 'string', required: false, input: false, fieldName: 'player_id' },
      },
      expiresIn: FAMILY_SESSION_LIFETIME_SECONDS,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
    },
    account: {
      modelName: 'quest_auth_accounts',
      fields: {
        userId: 'user_id',
        accountId: 'account_id',
        providerId: 'provider_id',
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        idToken: 'id_token',
        accessTokenExpiresAt: 'access_token_expires_at',
        refreshTokenExpiresAt: 'refresh_token_expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
      // Identity is (issuer, subject); nothing is ever linked by email.
      accountLinking: { enabled: false },
    },
    verification: {
      modelName: 'quest_auth_verifications',
      fields: {
        expiresAt: 'expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    databaseHooks: {
      account: {
        create: { before: stripTokens },
        update: { before: stripTokens },
      },
      session: {
        create: {
          before: async () => {
            const admission = admissionScope.getStore()?.admission;
            if (!admission) {
              throw new APIError('FORBIDDEN', { code: NOT_ADMITTED_ERROR, message: 'Not admitted' });
            }
            const player = await options.players.upsertFamilyPlayer(admission, new Date());
            return { data: { playerId: player.id, ipAddress: null, userAgent: null } };
          },
        },
      },
    },
    plugins: withProvider ? [
      genericOAuth({
        config: [
          {
            providerId: AUTHENTIK_PROVIDER_ID,
            name: 'Authentik',
            discoveryUrl: config.discoveryUrl,
            // Identity and groups come from ID-token claims, so never accept an unverifiable token.
            requireIdTokenVerification: true,
            clientId: config.clientId,
            clientSecret: config.clientSecret ?? undefined,
            scopes: OIDC_SCOPES,
            pkce: true,
            disableProviderLogout: true,
            overrideUserInfo: true,
            accountSubject: ({ profile }) => String(profile.sub ?? ''),
            // Better Auth verifies the ID token (JWKS, issuer, audience, nonce)
            // before calling this; only its claims are trusted.
            getUserInfo: async (tokens) => profileFromIdToken(tokens.idToken),
          },
        ],
      }),
    ] : [],
  });
}

async function hasAuthentikProvider(auth: Auth): Promise<boolean> {
  try {
    const context = await auth.$context;
    const providers = context.socialProviders as unknown;
    return Array.isArray(providers) && providers.some((provider) => provider?.id === AUTHENTIK_PROVIDER_ID);
  } catch {
    return false;
  }
}

/**
 * Starts sign-in with a fixed body: provider, return path and error path are
 * never client-chosen, and Better Auth's direct ID-token sign-in is unreachable.
 */
function signInRequest(request: Request): Request {
  const headers = new Headers(request.headers);
  headers.delete('content-length');
  headers.set('content-type', 'application/json');
  return new Request(request.url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      provider: AUTHENTIK_PROVIDER_ID,
      callbackURL: '/',
      errorCallbackURL: '/',
      disableRedirect: true,
    }),
  });
}

function profileFromIdToken(idToken: string | undefined): GenericOAuthUserInfo | null {
  if (!idToken) return null;
  const claims = decodeJwtPayload(idToken);
  if (!claims) return null;
  const identity = identityFromProfile(claims);
  if (!identity) return null;
  return {
    iss: identity.issuer,
    sub: identity.subject,
    id: identity.subject,
    groups: claims.groups,
    name: identity.label,
    // Better Auth requires a unique email. Use a synthetic one derived from
    // (issuer, subject) so email can never join two identities.
    email: syntheticEmail(identity.issuer, identity.subject),
    emailVerified: false,
  };
}

function identityFromProfile(profile: Record<string, unknown>): Omit<FamilyIdentity, 'role'> | null {
  const { iss, sub } = profile;
  if (typeof iss !== 'string' || iss.length < 1 || iss.length > 2048) return null;
  if (typeof sub !== 'string' || sub.length < 1 || sub.length > 255) return null;
  return { issuer: iss, subject: sub, label: displayLabel(profile) };
}

function displayLabel(profile: Record<string, unknown>): string {
  for (const candidate of [profile.name, profile.preferred_username]) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim().slice(0, MAX_LABEL_LENGTH);
    }
  }
  return FALLBACK_LABEL;
}

function syntheticEmail(issuer: string, subject: string): string {
  const digest = createHash('sha256').update(`${issuer}\n${subject}`).digest('hex').slice(0, 40);
  return `${digest}@identity.haynes-quest.invalid`;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const payload: unknown = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function writeAuthLog(entry: AuthLogEntry): void {
  process.stderr.write(`${JSON.stringify(entry)}\n`);
}
