import { Hono, type Context } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { serveStatic } from '@hono/node-server/serve-static';
import type { ApiError, SessionView } from '../shared/contracts.js';
import {
  toSaveSummary,
  toSaveView,
  type PlayerRecord,
  type QuestStore,
} from './domain.js';
import { asAppError, AppError } from './errors.js';
import { fixtureSvg, type PrivateMediaProvider } from './media.js';
import { FixturePhotoSource } from './photos/fixture.js';
import { createPreview } from './photos/setup.js';
import type { JourneyPhotoSource } from './photos/source.js';
import { enforceMutationSecurity, FixtureSessions, RequestLimiter } from './security.js';
import {
  createSaveSchema,
  finishSchema,
  parseJson,
  previewRequestSchema,
  recoverSchema,
} from './validation.js';

export interface AppOptions {
  store: QuestStore;
  fixtureMode: boolean;
  sessionSecret: string;
  appOrigin: string;
  clientDir: string;
  studioDir: string;
  photoSource?: JourneyPhotoSource;
  privateMedia?: PrivateMediaProvider;
}

export function createApp(options: AppOptions): Hono {
  if (options.fixtureMode && options.photoSource && !(options.photoSource instanceof FixturePhotoSource)) {
    throw new Error('Fixture app cannot use a private photo source');
  }
  if (options.fixtureMode && options.privateMedia) {
    throw new Error('Fixture app cannot use private media');
  }

  const app = new Hono();
  const sessions = options.fixtureMode
    ? new FixtureSessions(options.store, options.sessionSecret, options.appOrigin.startsWith('https://'))
    : null;
  const photoSource = options.fixtureMode ? (options.photoSource ?? new FixturePhotoSource()) : options.photoSource;
  const limiter = new RequestLimiter(120, 60_000);

  app.use('*', secureHeaders({
    crossOriginResourcePolicy: 'same-origin',
    referrerPolicy: 'no-referrer',
    xFrameOptions: 'DENY',
  }));
  app.use('/api/*', async (context, next) => {
    await next();
    context.header('Cache-Control', 'no-store');
  });

  app.get('/healthz', (context) => context.json({ status: 'ok' }));
  app.get('/readyz', async (context) => {
    const ready = await options.store.ready();
    return context.json({ status: ready ? 'ready' : 'unavailable' }, ready ? 200 : 503);
  });

  if (sessions) {
    app.get('/api/session', async (context) => {
      limiter.take(`session:${context.req.header('user-agent') ?? 'unknown'}`);
      const player = await sessions.establish(context);
      const response: SessionView = { player, mode: 'fixture', csrfHeader: 'X-Quest-Request' };
      return context.json(response);
    });

    app.get('/api/fixture-media/:memoryId', (context) => {
      const svg = fixtureSvg(context.req.param('memoryId'));
      if (!svg) throw new AppError(404, 'MEDIA_NOT_FOUND', 'Media not found');
      return context.body(svg, 200, fixtureMediaHeaders());
    });
  }

  app.get('/api/saves', async (context) => {
    const player = await requirePlayer(context, sessions);
    limiter.take(`read:${player.id}`);
    const saves = (await options.store.listSaves(player.id)).map(toSaveSummary);
    return context.json({ saves });
  });

  app.post('/api/setup/preview', async (context) => {
    enforceMutationSecurity(context, options.appOrigin);
    const player = await requirePlayer(context, sessions);
    limiter.take(`write:${player.id}`);
    if (!photoSource) throw new AppError(503, 'PHOTO_SETUP_UNAVAILABLE', 'Photo setup unavailable');
    const request = await parseJson(context, previewRequestSchema);
    return context.json(await createPreview(options.store, photoSource, player.id, request));
  });

  app.post('/api/saves', async (context) => {
    enforceMutationSecurity(context, options.appOrigin);
    const player = await requirePlayer(context, sessions);
    limiter.take(`write:${player.id}`);
    const command = await parseJson(context, createSaveSchema);
    const save = await options.store.createSave({ ownerId: player.id, ...command });
    return context.json(toSaveView(save), 201);
  });

  app.get('/api/saves/:id', async (context) => {
    const player = await requirePlayer(context, sessions);
    limiter.take(`read:${player.id}`);
    const save = await options.store.getSave(player.id, context.req.param('id'));
    if (!save) throw new AppError(404, 'SAVE_NOT_FOUND', 'Save not found');
    return context.json(toSaveView(save));
  });

  app.post('/api/saves/:id/recover', async (context) => {
    enforceMutationSecurity(context, options.appOrigin);
    const player = await requirePlayer(context, sessions);
    limiter.take(`write:${player.id}`);
    const { memoryId } = await parseJson(context, recoverSchema);
    const save = await options.store.recoverMemory(player.id, context.req.param('id'), memoryId);
    return context.json(toSaveView(save));
  });

  app.post('/api/saves/:id/finish', async (context) => {
    enforceMutationSecurity(context, options.appOrigin);
    const player = await requirePlayer(context, sessions);
    limiter.take(`write:${player.id}`);
    await parseJson(context, finishSchema);
    const save = await options.store.finishSave(player.id, context.req.param('id'));
    return context.json(toSaveView(save));
  });

  app.get('/api/saves/:id/media/:memoryId', async (context) => {
    const player = await requirePlayer(context, sessions);
    limiter.take(`media:${player.id}`);
    const save = await options.store.getSave(player.id, context.req.param('id'));
    const memory = save?.memories.find((candidate) => candidate.id === context.req.param('memoryId'));
    if (!save || !memory) throw new AppError(404, 'MEDIA_NOT_FOUND', 'Media not found');
    if (memory.source.kind === 'fixture') {
      if (!options.fixtureMode) throw new AppError(404, 'MEDIA_NOT_FOUND', 'Media not found');
      const svg = fixtureSvg(memory.source.key);
      if (!svg) throw new AppError(404, 'MEDIA_NOT_FOUND', 'Media not found');
      return context.body(svg, 200, fixtureMediaHeaders());
    }
    if (!options.privateMedia) throw new AppError(503, 'MEDIA_UNAVAILABLE', 'Media unavailable');
    const media = await options.privateMedia.fetchMedia(memory);
    return context.body(new Uint8Array(media.bytes), 200, privateMediaHeaders(media.contentType));
  });

  app.get('/studio', (context) => context.redirect('/studio/', 308));
  app.get('/studio/', serveStatic({ root: options.studioDir, path: 'index.html' }));
  app.use('/studio/*', serveStatic({
    root: options.studioDir,
    rewriteRequestPath: (path) => path.replace(/^\/studio/, ''),
  }));
  app.get('/', serveStatic({ root: options.clientDir, path: 'index.html' }));
  app.use('/assets/*', serveStatic({ root: options.clientDir }));

  app.notFound((context) => {
    if (context.req.path.startsWith('/api/')) return errorResponse(context, 404, 'NOT_FOUND', 'Not found');
    return errorResponse(context, 404, 'NOT_FOUND', 'Not found');
  });
  app.onError((error, context) => {
    const failure = asAppError(error);
    return errorResponse(context, failure.status, failure.code, failure.message);
  });
  return app;
}

async function requirePlayer(context: Context, sessions: FixtureSessions | null): Promise<PlayerRecord> {
  const player = await sessions?.current(context);
  if (!player) throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required');
  return player;
}

function errorResponse(context: Context, status: AppError['status'], code: string, message: string) {
  const body: ApiError = { error: { code, message } };
  return context.json(body, status);
}

function fixtureMediaHeaders(): Record<string, string> {
  return {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    'X-Content-Type-Options': 'nosniff',
  };
}

function privateMediaHeaders(contentType: string): Record<string, string> {
  return {
    'Content-Type': contentType,
    'Cache-Control': 'no-store, private',
    'Content-Disposition': 'inline',
    'X-Content-Type-Options': 'nosniff',
  };
}
