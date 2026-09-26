/**
 * Family journey routes (DESIGN-024 D-08). Registered only in family mode:
 * every route needs an admitted family session, and `/api/admin/*` needs the
 * administrator role (ADR-005 D-03). Responses never carry upstream Immich ids.
 */
import type { Context, Hono } from 'hono';
import { z } from 'zod';
import type {
  AdminChildSummary,
  AdminDraftResponse,
  FamilyJourneysResponse,
  FamilyPlayResponse,
} from '../../shared/family-api.js';
import { FAMILY_MEMORY_SLOTS, isDateOnly, type FamilyMemorySlot } from '../../shared/family-plan.js';
import { requireAdmin, requireFamilySession, type FamilyAuth } from '../auth/family-auth.js';
import { toSaveView, type QuestStore } from '../domain.js';
import { AppError } from '../errors.js';
import type { PrivateMediaProvider } from '../media.js';
import { enforceMutationSecurity, RequestLimiter } from '../security.js';
import { parseJson } from '../validation.js';
import type { AutoPickJobs } from './jobs.js';
import { familyJourneyCards, familyWorldView, newFamilySave } from './saves.js';
import type { FamilyJourneyService } from './service.js';
import type { FamilyStore } from './store.js';
import type { FamilyTemplateRegistry } from './templates.js';

export interface FamilyRouteDependencies {
  readonly familyAuth: FamilyAuth;
  readonly questStore: QuestStore;
  readonly familyStore: FamilyStore;
  readonly templates: FamilyTemplateRegistry;
  /** Null when Immich is not configured; setup routes then answer 503. */
  readonly service: FamilyJourneyService | null;
  readonly privateMedia: PrivateMediaProvider | null;
  readonly jobs: AutoPickJobs;
  readonly appOrigin: string;
  readonly now: () => Date;
  /** The household's calendar date, for template offers. */
  readonly today: () => string;
}

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const slot = z.enum(FAMILY_MEMORY_SLOTS);
const identifier = z.string().min(1).max(160);
const revision = z.number().int().min(0).max(1_000_000);

const createChildSchema = z.object({
  immichName: z.string().min(1).max(200),
  personChoiceId: z.string().min(1).max(128),
  displayName: z.string().min(1).max(200),
  birthDate: z.string().refine(isDateOnly),
  templateId: z.string().min(1).max(64),
  templateVersion: z.string().min(1).max(8),
}).strict();

const draftEditSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('auto-pick'), expectedRevision: revision.nullable(), reseed: z.boolean().optional() }).strict(),
  z.object({
    op: z.literal('caption'),
    expectedRevision: revision,
    chapterId: identifier,
    slot,
    caption: z.string().max(400),
  }).strict(),
  z.object({
    op: z.literal('swap'),
    expectedRevision: revision,
    chapterId: identifier,
    slot,
    token: z.string().min(1).max(1_024),
  }).strict(),
]);

const publishSchema = z.object({ expectedRevision: revision, requestId: uuid }).strict();
const playSchema = z.object({ fresh: z.boolean().optional() }).strict();

export function registerFamilyRoutes(app: Hono, deps: FamilyRouteDependencies): void {
  const reads = new RequestLimiter(240, 60_000);
  const writes = new RequestLimiter(60, 60_000);
  const thumbnails = new RequestLimiter(600, 60_000);
  const setup = (): FamilyJourneyService => {
    if (!deps.service) throw new AppError(503, 'FAMILY_SETUP_UNAVAILABLE', 'Photo setup unavailable');
    return deps.service;
  };
  const childId = (context: Context): string => {
    const parsed = uuid.safeParse(context.req.param('id'));
    if (!parsed.success) throw new AppError(404, 'CHILD_NOT_FOUND', 'Child not found');
    return parsed.data.toLowerCase();
  };

  // --- Household ---------------------------------------------------------

  app.get('/api/children', async (context) => {
    const player = await requireFamilySession(context, deps.familyAuth);
    reads.take(`children:${player.id}`);
    const [children, publications, saves] = await Promise.all([
      deps.familyStore.listChildren(),
      deps.familyStore.listLatestPublications(),
      deps.questStore.currentFamilySaves(),
    ]);
    const latest = new Set(publications.map((publication) => publication.id));
    const older = [...new Set(saves.flatMap((save) =>
      save.publicationId && !latest.has(save.publicationId) ? [save.publicationId] : []))];
    const runRevisions = new Map((await Promise.all(older.map((id) => deps.familyStore.getPublication(id))))
      .flatMap((publication) => publication ? [[publication.id, publication.revision] as const] : []));
    const response: FamilyJourneysResponse = {
      journeys: familyJourneyCards({ children, publications, saves, runRevisions }),
    };
    return context.json(response);
  });

  // Resume the child's run, or start one on the latest publication. A newer
  // publication never alters a started run unless an administrator asks.
  app.post('/api/children/:id/play', async (context) => {
    enforceMutationSecurity(context, deps.appOrigin);
    const player = await requireFamilySession(context, deps.familyAuth);
    writes.take(`play:${player.id}`);
    const request = await parseJson(context, playSchema);
    if (request.fresh && player.role !== 'admin') {
      throw new AppError(403, 'ADMIN_REQUIRED', 'Administrator required');
    }
    const id = childId(context);
    const [child, publication] = await Promise.all([
      deps.familyStore.getChild(id),
      deps.familyStore.latestPublication(id),
    ]);
    if (!child) throw new AppError(404, 'CHILD_NOT_FOUND', 'Child not found');
    if (!publication) throw new AppError(404, 'JOURNEY_NOT_PUBLISHED', 'Journey not published');
    const now = deps.now();
    const result = await deps.questStore.startFamilySave({
      childId: id,
      fresh: request.fresh === true,
      save: newFamilySave({ publication, child, startedBy: player.id, now }),
    });
    const response: FamilyPlayResponse = {
      save: toSaveView(result.save, now),
      world: familyWorldView(result.save),
      created: result.created,
    };
    return context.json(response, result.created ? 201 : 200);
  });

  app.get('/api/saves/:id/world', async (context) => {
    const player = await requireFamilySession(context, deps.familyAuth);
    reads.take(`world:${player.id}`);
    const save = await deps.questStore.getHouseholdSave(context.req.param('id'));
    if (!save) throw new AppError(404, 'SAVE_NOT_FOUND', 'Save not found');
    context.header('Cache-Control', 'no-store');
    return context.json(familyWorldView(save));
  });

  // --- Administrator setup -----------------------------------------------

  app.get('/api/admin/children', async (context) => {
    const player = await requireAdmin(context, deps.familyAuth);
    reads.take(`admin:${player.id}`);
    const children = await deps.familyStore.listChildren();
    const summaries: AdminChildSummary[] = await Promise.all(children.map(async (child) => {
      const [draft, publication] = await Promise.all([
        deps.familyStore.getDraft(child.id),
        deps.familyStore.latestPublication(child.id),
      ]);
      const status = deps.jobs.status(child.id);
      return {
        child: {
          id: child.id,
          displayName: child.displayName,
          birthDate: child.birthDate,
          templateId: child.templateId,
          templateVersion: child.templateVersion,
          revision: child.revision,
        },
        draft: draft
          ? {
              revision: draft.revision,
              publishable: draft.slots.every((entry) => entry.status === 'filled'),
              filled: draft.slots.filter((entry) => entry.status === 'filled').length,
              needsPhoto: draft.slots.filter((entry) => entry.status !== 'filled').length,
            }
          : null,
        publication: publication
          ? { revision: publication.revision, publishedAt: publication.publishedAt.toISOString() }
          : null,
        picking: status.picking,
        lastPickError: status.lastError,
      };
    }));
    return context.json({ children: summaries });
  });

  app.post('/api/admin/children', async (context) => {
    enforceMutationSecurity(context, deps.appOrigin);
    const player = await requireAdmin(context, deps.familyAuth);
    writes.take(`admin:${player.id}`);
    const request = await parseJson(context, createChildSchema);
    return context.json(await setup().createChild(request, player.id), 201);
  });

  app.get('/api/admin/templates', async (context) => {
    const player = await requireAdmin(context, deps.familyAuth);
    reads.take(`admin:${player.id}`);
    const birthDate = context.req.query('birthDate') ?? '';
    const today = deps.today();
    if (!isDateOnly(birthDate) || birthDate > today) {
      throw new AppError(422, 'INVALID_BIRTH_DATE', 'Invalid birthday');
    }
    return context.json({
      templates: deps.templates.offeredFor(birthDate, today).map((template) => ({
        id: template.id,
        version: template.version,
        name: template.project.name,
        chapterCount: template.project.chapters.length,
      })),
    });
  });

  app.get('/api/admin/immich/people', async (context) => {
    const player = await requireAdmin(context, deps.familyAuth);
    writes.take(`people:${player.id}`);
    return context.json({ people: await setup().lookupPeople(context.req.query('name') ?? '') });
  });

  app.get('/api/admin/children/:id/draft', async (context) => {
    const player = await requireAdmin(context, deps.familyAuth);
    reads.take(`admin:${player.id}`);
    const id = childId(context);
    if (!(await deps.familyStore.getChild(id))) throw new AppError(404, 'CHILD_NOT_FOUND', 'Child not found');
    const status = deps.jobs.status(id);
    const response: AdminDraftResponse = {
      draft: (await deps.familyStore.getDraft(id)) ? await setup().getDraft(id) : null,
      picking: status.picking,
      lastPickError: status.lastError,
    };
    return context.json(response);
  });

  app.put('/api/admin/children/:id/draft', async (context) => {
    enforceMutationSecurity(context, deps.appOrigin);
    const player = await requireAdmin(context, deps.familyAuth);
    writes.take(`admin:${player.id}`);
    const id = childId(context);
    const request = await parseJson(context, draftEditSchema);
    const service = setup();
    if (request.op === 'auto-pick') {
      if (!(await deps.familyStore.getChild(id))) throw new AppError(404, 'CHILD_NOT_FOUND', 'Child not found');
      deps.jobs.start(id, () => service.autoPick(id, player.id, {
        expectedRevision: request.expectedRevision,
        reseed: request.reseed === true,
      }));
      const response: AdminDraftResponse = { draft: null, picking: true, lastPickError: null };
      return context.json(response, 202);
    }
    if (deps.jobs.status(id).picking) throw new AppError(409, 'AUTO_PICK_RUNNING', 'Photos are being picked');
    const draft = request.op === 'caption'
      ? await service.setCaption(id, request.expectedRevision, request.chapterId, request.slot, request.caption, player.id)
      : await service.swap(id, request.expectedRevision, request.chapterId, request.slot, request.token, player.id);
    const response: AdminDraftResponse = { draft, picking: false, lastPickError: null };
    return context.json(response);
  });

  app.get('/api/admin/children/:id/draft/slots/:chapter/:slot/suggestions', async (context) => {
    const player = await requireAdmin(context, deps.familyAuth);
    writes.take(`suggest:${player.id}`);
    const id = childId(context);
    const memorySlot = slot.safeParse(context.req.param('slot'));
    if (!memorySlot.success) throw new AppError(404, 'SLOT_NOT_FOUND', 'Memory slot not found');
    const cursor = Number(context.req.query('cursor') ?? '1');
    return context.json(await setup().suggestions(
      id,
      context.req.param('chapter'),
      memorySlot.data as FamilyMemorySlot,
      Number.isSafeInteger(cursor) ? cursor : 0,
    ));
  });

  app.get('/api/admin/candidates/:token/image', async (context) => {
    const player = await requireAdmin(context, deps.familyAuth);
    thumbnails.take(`thumb:${player.id}`);
    if (!deps.privateMedia) throw new AppError(503, 'MEDIA_UNAVAILABLE', 'Media unavailable');
    const candidate = await setup().resolveCandidate(context.req.param('token'));
    const media = await deps.privateMedia.fetchMedia({
      id: 'candidate',
      date: candidate.localDate,
      ageYears: 0,
      label: 'Candidate',
      source: { kind: 'immich', assetId: candidate.assetId, personId: candidate.personId },
    }, { size: 'thumbnail' });
    return context.body(new Uint8Array(media.bytes), 200, {
      'Content-Type': media.contentType,
      'Cache-Control': 'no-store, private',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    });
  });

  app.post('/api/admin/children/:id/publish', async (context) => {
    enforceMutationSecurity(context, deps.appOrigin);
    const player = await requireAdmin(context, deps.familyAuth);
    writes.take(`admin:${player.id}`);
    const id = childId(context);
    const request = await parseJson(context, publishSchema);
    if (deps.jobs.status(id).picking) throw new AppError(409, 'AUTO_PICK_RUNNING', 'Photos are being picked');
    return context.json(await setup().publish(id, request.expectedRevision, request.requestId, player.id), 201);
  });
}
