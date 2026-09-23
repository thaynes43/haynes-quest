import { randomUUID } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { routePath } from 'hono/route';
import { secureHeaders } from 'hono/secure-headers';
import { serveStatic } from '@hono/node-server/serve-static';
import { ROUTE_ATTACK_COOLDOWN_MS } from '../shared/adventure.js';
import type { ApiError, GameplayAction, SessionView } from '../shared/contracts.js';
import {
  canAccessSaveMemory,
  toSaveSummary,
  toSaveView,
  type PlayerRecord,
  type QuestStore,
  type SaveRecord,
} from './domain.js';
import { asAppError, AppError } from './errors.js';
import { InMemoryQuestStore } from './db/memory-store.js';
import { fixtureSvg, type PrivateMediaProvider } from './media.js';
import { FixturePhotoSource } from './photos/fixture.js';
import { createPreview } from './photos/setup.js';
import type { JourneyPhotoSource } from './photos/source.js';
import {
  EDITOR_PLAYTEST_MAX_BODY_BYTES,
  editorChapterIndex,
  editorChapterNumber,
  prepareEditorPreview,
} from './editor-preview.js';
import { enforceMutationSecurity, FixtureSessions, RequestLimiter } from './security.js';
import {
  createSaveSchema,
  editorPlaytestSchema,
  finishSchema,
  gameplayActionRequestSchema,
  parseJson,
  playtestStartSchema,
  previewRequestSchema,
  recoverSchema,
} from './validation.js';

export interface AppOptions {
  store: QuestStore;
  fixtureMode: boolean;
  ephemeralPlaytest?: boolean;
  sessionSecret: string;
  appOrigin: string;
  clientDir: string;
  studioDir: string;
  photoSource?: JourneyPhotoSource;
  privateMedia?: PrivateMediaProvider;
  diagnosticSink?: DiagnosticSink;
  now?: () => Date;
}

export type SafeErrorClass =
  | 'app-error'
  | 'aggregate-error'
  | 'eval-error'
  | 'range-error'
  | 'reference-error'
  | 'syntax-error'
  | 'type-error'
  | 'uri-error'
  | 'error'
  | 'non-error';

export interface SafeDiagnostic {
  event: 'api_request_failed' | 'maintenance_failed' | 'shutdown_failed' | 'startup_failed';
  errorClass: SafeErrorClass;
  method?: string;
  route?: string;
  phase?: 'scheduled' | 'startup';
  /** Fixed application error code (never request-derived), for server-side AppError failures. */
  code?: string;
  status?: number;
}

export type DiagnosticSink = (diagnostic: SafeDiagnostic) => void;

const DIAGNOSTIC_ROUTES = new Set([
  '/healthz',
  '/readyz',
  '/api/session',
  '/api/playtest/start',
  '/api/editor/playtests',
  '/api/fixture-media/:memoryId',
  '/api/saves',
  '/api/setup/preview',
  '/api/saves/:id',
  '/api/saves/:id/recover',
  '/api/saves/:id/finish',
  '/api/saves/:id/actions',
  '/api/saves/:id/media/:memoryId',
]);

export function createApp(options: AppOptions): Hono {
  if (options.ephemeralPlaytest && !options.fixtureMode) {
    throw new Error('Ephemeral playtest requires fixture mode');
  }
  if (options.ephemeralPlaytest && !(options.store instanceof InMemoryQuestStore)) {
    throw new Error('Ephemeral playtest requires in-memory storage');
  }
  if (options.fixtureMode && options.photoSource && !(options.photoSource instanceof FixturePhotoSource)) {
    throw new Error('Fixture app cannot use a private photo source');
  }
  if (options.fixtureMode && options.privateMedia) {
    throw new Error('Fixture app cannot use private media');
  }

  const app = new Hono();
  const editorPlaytestStore = options.ephemeralPlaytest
    ? options.store as InMemoryQuestStore
    : null;
  const sessions = options.fixtureMode
    ? new FixtureSessions(options.store, options.sessionSecret, options.appOrigin.startsWith('https://'))
    : null;
  const photoSource = options.fixtureMode
    ? (options.photoSource ?? new FixturePhotoSource(options.ephemeralPlaytest === true))
    : options.photoSource;
  const limiter = new RequestLimiter(120, 60_000);
  const actionLimiter = new RequestLimiter(360, 60_000);
  const diagnosticSink = options.diagnosticSink ?? writeSafeDiagnostic;
  // One application clock for action authority and every save view it renders.
  const now = (): Date => options.now?.() ?? new Date();

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
      const response: SessionView = {
        player,
        mode: 'fixture',
        progressMode: options.ephemeralPlaytest ? 'ephemeral' : 'persistent',
        csrfHeader: 'X-Quest-Request',
      };
      return context.json(response);
    });

    app.get('/api/fixture-media/:memoryId', (context) => {
      limiter.take(`fixture-media:${context.req.header('user-agent') ?? 'unknown'}`);
      const svg = fixtureSvg(context.req.param('memoryId'));
      if (!svg) throw new AppError(404, 'MEDIA_NOT_FOUND', 'Media not found');
      return context.body(svg, 200, fixtureMediaHeaders());
    });

    if (options.ephemeralPlaytest) {
      // One ordinary ephemeral playtest save, used by both the plain private
      // playtest and the editor preview so neither hand-edits save state.
      const startFictionalChapter = async (
        playerId: string,
        chapter: 1 | 2,
      ): Promise<SaveRecord> => {
        const startedAt = now();
        const preview = await createPreview(options.store, photoSource!, playerId, {
          name: 'Demo Adventurer',
          birthDate: '2020-01-01',
        }, startedAt);
        const created = await options.store.createSave({
          ownerId: playerId,
          previewId: preview.previewId,
          selectedIds: preview.selectedIds,
          planMode: 'route-memories',
        });
        return prepareRouteMemoryChapter(
          options.store,
          playerId,
          created,
          chapter,
          startedAt,
        );
      };

      app.post('/api/playtest/start', async (context) => {
        enforceMutationSecurity(context, options.appOrigin);
        const player = await requirePlayer(context, sessions);
        limiter.take(`write:${player.id}`);
        const request = await parseJson(context, playtestStartSchema);
        const save = await startFictionalChapter(player.id, request.chapter);
        return context.json(toSaveView(save, save.updatedAt), 201);
      });

      // Level editor preview. V2 freezes a validated, editor-only adventure plan
      // in the ephemeral store; gameplay then uses the ordinary action routes.
      app.post('/api/editor/playtests', async (context) => {
        enforceMutationSecurity(context, options.appOrigin);
        const player = await requirePlayer(context, sessions);
        limiter.take(`write:${player.id}`);
        const request = await parseJson(
          context,
          editorPlaytestSchema,
          EDITOR_PLAYTEST_MAX_BODY_BYTES,
        );
        // Validate and freeze before touching the store: an invalid project must
        // never leave a save behind.
        const prepared = prepareEditorPreview(request.project);
        if (!prepared.ok) return context.json(prepared.body, 422);
        const requestedIndex = editorChapterIndex(prepared.bundle.project, request.chapterId);
        if (requestedIndex === null) {
          throw new AppError(422, 'INVALID_REQUEST', 'Invalid request');
        }
        const save = prepared.bundle.world
          ? await editorPlaytestStore!.createEditorPlaytest({
              ownerId: player.id,
              title: prepared.bundle.project.name,
              birthDate: prepared.bundle.world.birthDate,
              memories: prepared.bundle.world.memories.map((memory) => structuredClone(memory)),
              plan: prepared.bundle.world.plan,
              startLevelIndex: request.scope === 'adventure' ? 0 : requestedIndex,
              startedAt: now(),
            })
          : await startFictionalChapter(
              player.id,
              request.scope === 'adventure' ? 1 : editorChapterNumber(request.chapterId),
            );
        return context.json(
          {
            save: toSaveView(save, save.updatedAt),
            project: prepared.bundle.project,
            fingerprint: prepared.bundle.fingerprint,
          },
          201,
        );
      });
    }
  }

  app.get('/api/saves', async (context) => {
    const player = await requirePlayer(context, sessions);
    limiter.take(`read:${player.id}`);
    if (options.ephemeralPlaytest) return context.json({ saves: [] });
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
    if (options.ephemeralPlaytest && command.selectedIds.length !== 6) {
      throw new AppError(422, 'INVALID_SELECTION', 'Invalid selection');
    }
    const save = await options.store.createSave({
      ownerId: player.id,
      ...command,
      ...(options.ephemeralPlaytest ? { planMode: 'route-memories' as const } : {}),
    });
    return context.json(toSaveView(save, now()), 201);
  });

  app.get('/api/saves/:id', async (context) => {
    const player = await requirePlayer(context, sessions);
    limiter.take(`read:${player.id}`);
    const save = await options.store.getSave(player.id, context.req.param('id'));
    if (!save) throw new AppError(404, 'SAVE_NOT_FOUND', 'Save not found');
    return context.json(toSaveView(save, now()));
  });

  app.post('/api/saves/:id/recover', async (context) => {
    enforceMutationSecurity(context, options.appOrigin);
    const player = await requirePlayer(context, sessions);
    limiter.take(`write:${player.id}`);
    await parseJson(context, recoverSchema);
    await rejectRetiredSaveMutation(options.store, player.id, context.req.param('id'));
  });

  app.post('/api/saves/:id/finish', async (context) => {
    enforceMutationSecurity(context, options.appOrigin);
    const player = await requirePlayer(context, sessions);
    limiter.take(`write:${player.id}`);
    await parseJson(context, finishSchema);
    await rejectRetiredSaveMutation(options.store, player.id, context.req.param('id'));
  });

  app.post('/api/saves/:id/actions', async (context) => {
    enforceMutationSecurity(context, options.appOrigin);
    const player = await requirePlayer(context, sessions);
    actionLimiter.take(`action:${player.id}`);
    const request = await parseJson(context, gameplayActionRequestSchema);
    const actionTime = now();
    const save = await options.store.applyGameplayAction(
      player.id,
      context.req.param('id'),
      request,
      actionTime,
    );
    return context.json(toSaveView(save, actionTime));
  });

  app.get('/api/saves/:id/media/:memoryId', async (context) => {
    const player = await requirePlayer(context, sessions);
    limiter.take(`media:${player.id}`);
    const save = await options.store.getSave(player.id, context.req.param('id'));
    const memory = save?.memories.find((candidate) => candidate.id === context.req.param('memoryId'));
    if (!save || !memory) throw new AppError(404, 'MEDIA_NOT_FOUND', 'Media not found');
    if (!canAccessSaveMemory(save, memory.id)) {
      throw new AppError(409, 'MEDIA_LOCKED', 'Memory is locked');
    }
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

  const studioHeaders = async (context: Context, next: () => Promise<void>): Promise<void> => {
    await next();
    context.header('Cache-Control', 'no-cache');
    if (
      (context.res.status === 200 || context.res.status === 206) &&
      context.req.path.toLowerCase().endsWith('.wav')
    ) {
      context.header('Content-Type', 'audio/wav');
    }
  };
  app.use('/studio', studioHeaders);
  app.use('/studio/*', studioHeaders);
  app.get('/studio', (context) => context.redirect('/studio/', 308));
  app.get('/studio/', serveStatic({ root: options.studioDir, path: 'index.html' }));
  app.use('/studio/*', serveStatic({
    root: options.studioDir,
    rewriteRequestPath: (path) => path.replace(/^\/studio/, ''),
  }));
  // The SPA answers '/' and '/editor' alike; a direct or deep editor link has to
  // boot the same bundle, which then decides what the surface can offer.
  const spaShell = ['/', '/editor', '/editor/*'];
  for (const path of spaShell) {
    app.use(path, async (context, next) => {
      await next();
      context.header('Cache-Control', 'no-store');
    });
  }
  for (const path of spaShell) {
    app.get(path, serveStatic({ root: options.clientDir, path: 'index.html' }));
  }
  app.use('/assets/*', async (context, next) => {
    await next();
    if (context.res.status === 200 || context.res.status === 206) {
      context.header(
        'Cache-Control',
        isHashedClientAsset(context.req.path) ? 'public, max-age=31536000, immutable' : 'no-cache',
      );
    }
  });
  app.use('/assets/*', serveStatic({ root: options.clientDir }));

  app.notFound((context) => {
    if (context.req.path.startsWith('/api/')) return errorResponse(context, 404, 'NOT_FOUND', 'Not found');
    return errorResponse(context, 404, 'NOT_FOUND', 'Not found');
  });
  app.onError((error, context) => {
    const failure = asAppError(error);
    // Every server-side failure (5xx) is diagnosable, including AppError ones
    // such as SAVE_DATA_INVALID. Client errors (4xx) stay quiet as before. The
    // record carries only fixed identifiers: no body, ids, dates or exception text.
    if (failure.status >= 500) {
      emitSafeDiagnostic(diagnosticSink, {
        event: 'api_request_failed',
        errorClass: classifyError(error),
        method: context.req.method,
        route: diagnosticRoute(context),
        ...(error instanceof AppError ? { code: error.code, status: error.status } : {}),
      });
    }
    return errorResponse(context, failure.status, failure.code, failure.message);
  });
  return app;
}

export function classifyError(error: unknown): SafeErrorClass {
  if (error instanceof AppError) return 'app-error';
  if (error instanceof AggregateError) return 'aggregate-error';
  if (error instanceof EvalError) return 'eval-error';
  if (error instanceof RangeError) return 'range-error';
  if (error instanceof ReferenceError) return 'reference-error';
  if (error instanceof SyntaxError) return 'syntax-error';
  if (error instanceof TypeError) return 'type-error';
  if (error instanceof URIError) return 'uri-error';
  if (error instanceof Error) return 'error';
  return 'non-error';
}

export function writeSafeDiagnostic(diagnostic: SafeDiagnostic): void {
  process.stderr.write(`${JSON.stringify(diagnostic)}\n`);
}

export function emitSafeDiagnostic(sink: DiagnosticSink, diagnostic: SafeDiagnostic): void {
  try {
    sink(diagnostic);
  } catch {
    // Diagnostics must not change the response or expose the original failure.
  }
}

function diagnosticRoute(context: Context): string {
  const matched = routePath(context, -1);
  if (DIAGNOSTIC_ROUTES.has(matched)) return matched;
  return context.req.path.startsWith('/api/') ? '/api/*' : '/*';
}

async function requirePlayer(context: Context, sessions: FixtureSessions | null): Promise<PlayerRecord> {
  const player = await sessions?.current(context);
  if (!player) throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required');
  return player;
}

async function rejectRetiredSaveMutation(
  store: QuestStore,
  ownerId: string,
  saveId: string,
): Promise<never> {
  const save = await store.getSave(ownerId, saveId);
  if (!save) throw new AppError(404, 'SAVE_NOT_FOUND', 'Save not found');
  if (save.saveFormat === 'legacy-v1') {
    throw new AppError(409, 'LEGACY_SAVE_READ_ONLY', 'Legacy save is read only');
  }
  throw new AppError(409, 'ACTION_ROUTE_RETIRED', 'Use gameplay actions');
}

function errorResponse(context: Context, status: AppError['status'], code: string, message: string) {
  const body: ApiError = { error: { code, message } };
  return context.json(body, status);
}

function fixtureMediaHeaders(): Record<string, string> {
  return {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': 'no-store',
    // WebGL can only upload an SVG that remains origin-clean after sandboxing.
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox allow-same-origin",
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

function isHashedClientAsset(path: string): boolean {
  return /(?:^|\/)[^/]+-[A-Za-z0-9_-]{8}\.(?:js|css)$/.test(path);
}

async function prepareRouteMemoryChapter(
  store: QuestStore,
  ownerId: string,
  save: SaveRecord,
  chapter: 1 | 2,
  startedAt: Date,
): Promise<SaveRecord> {
  let current = save;
  if (current.adventurePlan?.version !== 'era-level-plan-v3' || !current.adventureState) {
    throw new AppError(409, 'PLAYTEST_CHAPTER_UNAVAILABLE', 'Playtest chapter unavailable');
  }
  if (chapter === 1) return current;

  let actionTimeMs = startedAt.valueOf();
  const apply = async (action: GameplayAction): Promise<void> => {
    current = await store.applyGameplayAction(ownerId, current.id, {
      actionId: randomUUID(),
      expectedRevision: current.revision,
      action,
    }, new Date(actionTimeMs));
  };
  const level = current.adventurePlan.levels[0]!;
  const attackTool = level.pickups.find((pickup) => pickup.kind === 'attack-tool');
  if (!attackTool) {
    throw new AppError(409, 'PLAYTEST_CHAPTER_UNAVAILABLE', 'Playtest chapter unavailable');
  }
  await apply({ type: 'collect-equipment', levelId: level.id, pickupId: attackTool.pickupId });
  for (const memoryId of level.minorMemoryIds) {
    await apply({ type: 'recover-memory', levelId: level.id, memoryId });
  }
  for (const encounter of level.encounters) {
    while (!current.adventureState!.encounters[encounter.id]!.defeated) {
      await apply({ type: 'attack', levelId: level.id, encounterId: encounter.id });
      actionTimeMs += ROUTE_ATTACK_COOLDOWN_MS;
    }
  }
  await apply({ type: 'recover-memory', levelId: level.id, memoryId: level.majorMemoryId });
  if (current.adventureState.activeLevelIndex !== 1 || current.adventureState.phase !== 'exploring') {
    throw new AppError(503, 'SAVE_DATA_INVALID', 'Save unavailable');
  }
  return current;
}
