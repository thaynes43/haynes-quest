import { createHash, createSign, generateKeyPairSync, randomBytes, type KeyObject } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

/**
 * A stand-in Authentik OAuth2 provider for tests. It behaves like the real one
 * where it matters: discovery with a JWKS, a strict redirect URI, PKCE S256,
 * single-use codes, and an RS256 ID token carrying `groups`, bound to the
 * request's nonce. Every identity it issues is synthetic.
 */
export interface FakeIdentity {
  sub: string;
  groups?: unknown;
  name?: string;
  preferred_username?: string;
  email?: string;
}

export interface FakeIdpTampering {
  /** Sign the ID token with a key that is not in the JWKS. */
  foreignSignature?: boolean;
  /** Return an ID token whose nonce does not match the authorization request. */
  wrongNonce?: boolean;
  /** Return no ID token at all. */
  omitIdToken?: boolean;
}

export interface FakeIdp {
  readonly origin: string;
  readonly issuer: string;
  readonly discoveryUrl: string;
  readonly endSessionUrl: string;
  /** The person who authenticates on the next authorization request. */
  identity: FakeIdentity;
  tampering: FakeIdpTampering;
  /** Every authorization request received, in order. */
  readonly authorizeRequests: URLSearchParams[];
  /** Every token request body received, in order. */
  readonly tokenRequests: URLSearchParams[];
  /** Plays the browser's hop to Authentik: returns the redirect back to the app. */
  authorize(authorizationUrl: string): Promise<URL>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface FakeIdpOptions {
  clientId: string;
  clientSecret?: string | null;
  redirectUri: string;
  /** Bind to a fixed port (to restart the same provider). Defaults to an ephemeral port. */
  port?: number;
}

interface PendingCode {
  identity: FakeIdentity;
  codeChallenge: string;
  nonce: string;
  redirectUri: string;
}

export async function startFakeIdp(options: FakeIdpOptions): Promise<FakeIdp> {
  const idp = createFakeIdp(options);
  await idp.start();
  return idp;
}

/** Creates the provider without listening, e.g. to test an unreachable Authentik at startup. */
export function createFakeIdp(options: FakeIdpOptions & { port?: number }): FakeIdp {
  const signingKey = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const foreignKey = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = 'fake-authentik-key';
  const codes = new Map<string, PendingCode>();
  let server: Server | null = null;
  let port = options.port ?? 0;

  const idp: FakeIdp = {
    get origin() {
      return `http://127.0.0.1:${port}`;
    },
    get issuer() {
      return `http://127.0.0.1:${port}/application/o/haynes-quest/`;
    },
    get discoveryUrl() {
      return `${idp.issuer}.well-known/openid-configuration`;
    },
    get endSessionUrl() {
      return `${idp.issuer}end-session/`;
    },
    identity: { sub: 'synthetic-subject-0000', groups: ['family'] },
    tampering: {},
    authorizeRequests: [],
    tokenRequests: [],
    async authorize(authorizationUrl: string): Promise<URL> {
      const response = await fetch(authorizationUrl, { redirect: 'manual' });
      const location = response.headers.get('location');
      if (response.status !== 302 || !location) {
        throw new Error(`Fake IdP refused the authorization request (${response.status})`);
      }
      return new URL(location);
    },
    async start(): Promise<void> {
      server = createServer((request, response) => {
        void handle(request, response).catch(() => {
          response.writeHead(500).end();
        });
      });
      await new Promise<void>((resolve) => server!.listen(port, '127.0.0.1', resolve));
      const address = server.address();
      port = typeof address === 'object' && address ? address.port : port;
    },
    async stop(): Promise<void> {
      const current = server;
      server = null;
      if (!current) return;
      current.closeAllConnections();
      await new Promise<void>((resolve) => current.close(() => resolve()));
    },
  };

  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? '/', idp.origin);
    const json = (status: number, body: unknown) => {
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(body));
    };

    if (url.pathname === '/application/o/haynes-quest/.well-known/openid-configuration') {
      json(200, {
        issuer: idp.issuer,
        authorization_endpoint: `${idp.origin}/application/o/authorize/`,
        token_endpoint: `${idp.origin}/application/o/token/`,
        userinfo_endpoint: `${idp.origin}/application/o/userinfo/`,
        end_session_endpoint: idp.endSessionUrl,
        jwks_uri: `${idp.issuer}jwks/`,
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        code_challenge_methods_supported: ['S256'],
      });
      return;
    }
    if (url.pathname === '/application/o/haynes-quest/jwks/') {
      const jwk = signingKey.publicKey.export({ format: 'jwk' });
      json(200, { keys: [{ ...jwk, kid, alg: 'RS256', use: 'sig' }] });
      return;
    }
    if (url.pathname === '/application/o/authorize/' && request.method === 'GET') {
      const params = url.searchParams;
      idp.authorizeRequests.push(params);
      const valid =
        params.get('client_id') === options.clientId &&
        params.get('response_type') === 'code' &&
        params.get('redirect_uri') === options.redirectUri &&
        params.get('code_challenge_method') === 'S256' &&
        Boolean(params.get('code_challenge')) &&
        Boolean(params.get('state')) &&
        Boolean(params.get('nonce')) &&
        (params.get('scope') ?? '').split(' ').includes('openid');
      if (!valid) {
        json(400, { error: 'invalid_request' });
        return;
      }
      const code = randomBytes(24).toString('base64url');
      codes.set(code, {
        identity: structuredClone(idp.identity),
        codeChallenge: params.get('code_challenge')!,
        nonce: params.get('nonce')!,
        redirectUri: params.get('redirect_uri')!,
      });
      const back = new URL(options.redirectUri);
      back.searchParams.set('code', code);
      back.searchParams.set('state', params.get('state')!);
      response.writeHead(302, { location: back.toString() });
      response.end();
      return;
    }
    if (url.pathname === '/application/o/token/' && request.method === 'POST') {
      const body = new URLSearchParams(await readBody(request));
      idp.tokenRequests.push(body);
      const code = body.get('code') ?? '';
      const pending = codes.get(code);
      codes.delete(code);
      const verifier = body.get('code_verifier') ?? '';
      const secretOk = options.clientSecret
        ? body.get('client_secret') === options.clientSecret
        : !body.has('client_secret') && !request.headers.authorization;
      if (
        !pending ||
        body.get('grant_type') !== 'authorization_code' ||
        body.get('client_id') !== options.clientId ||
        body.get('redirect_uri') !== pending.redirectUri ||
        createHash('sha256').update(verifier).digest('base64url') !== pending.codeChallenge ||
        !secretOk
      ) {
        json(400, { error: 'invalid_grant' });
        return;
      }
      const now = Math.floor(Date.now() / 1000);
      const claims = {
        iss: idp.issuer,
        aud: options.clientId,
        sub: pending.identity.sub,
        iat: now,
        exp: now + 300,
        auth_time: now,
        nonce: idp.tampering.wrongNonce ? 'not-the-request-nonce' : pending.nonce,
        ...(pending.identity.groups === undefined ? {} : { groups: pending.identity.groups }),
        ...(pending.identity.name ? { name: pending.identity.name } : {}),
        ...(pending.identity.preferred_username
          ? { preferred_username: pending.identity.preferred_username }
          : {}),
        ...(pending.identity.email ? { email: pending.identity.email, email_verified: false } : {}),
      };
      const idToken = signJwt(
        claims,
        idp.tampering.foreignSignature ? foreignKey.privateKey : signingKey.privateKey,
        kid,
      );
      json(200, {
        access_token: randomBytes(16).toString('hex'),
        token_type: 'Bearer',
        expires_in: 300,
        scope: 'openid profile email',
        ...(idp.tampering.omitIdToken ? {} : { id_token: idToken }),
      });
      return;
    }
    response.writeHead(404).end();
  }

  return idp;
}

function signJwt(claims: Record<string, unknown>, key: KeyObject, kid: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(key).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}
