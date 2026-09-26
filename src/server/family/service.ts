/**
 * Family journey setup (DESIGN-024): the service calls behind the admin screen
 * and the operator CLI. Routes and the CLI are thin wrappers (Phase 2); every
 * rule lives here so neither can bypass validation.
 *
 * Privacy: views returned from this service carry opaque ids, dates, ages and
 * captions for an administrator, never upstream Immich ids. Errors are
 * `AppError`s with fixed codes.
 */
import { randomUUID } from 'node:crypto';
import {
  FAMILY_MEMORY_SLOTS,
  FAMILY_ABILITY_LADDER,
  defaultCaption,
  familyWholeYearsAt,
  isDateOnly,
  normalizeCaption,
  type AbilityLadderSource,
  type FamilyMemorySlot,
} from '../../shared/family-plan.js';
import { AppError } from '../errors.js';
import type { FamilyPhotoLibrary } from '../photos/source.js';
import {
  autoPickJourney,
  manualSlotWindow,
  slotTargetDate,
  suggestForSlot,
  type PickClock,
  type PickLimits,
} from './pick.js';
import { buildFamilyWorldPlan, FamilyPlanError } from './plan.js';
import { FamilyRebaseError, rebaseWorldForChild, type RebasedChapter, type RebasedWorld } from './rebase.js';
import {
  FAMILY_LIMITS,
  type ChildRecord,
  type DraftRecord,
  type DraftSlot,
  type FamilyStore,
  type PublicationRecord,
} from './store.js';
import type { FamilyTemplate, FamilyTemplateRegistry } from './templates.js';
import type { CandidateTokens } from './tokens.js';
import type {
  ChildView,
  CreateChildInput,
  DraftView,
  PersonChoice,
  PublicationSummary,
  SuggestionPageView,
  TemplateOffer,
} from '../../shared/family-api.js';

export type {
  ChildView,
  CreateChildInput,
  DraftChapterView,
  DraftSlotView,
  DraftView,
  PersonChoice,
  PublicationSummary,
  SuggestionPageView,
  SuggestionView,
  TemplateOffer,
} from '../../shared/family-api.js';

export interface FamilyServiceOptions {
  readonly store: FamilyStore;
  readonly library: FamilyPhotoLibrary;
  readonly templates: FamilyTemplateRegistry;
  readonly tokens: CandidateTokens;
  /** Until WO107 lands, the provisional DESIGN-025 table. */
  readonly ladder?: AbilityLadderSource;
  readonly clock?: PickClock;
  readonly limits?: Partial<PickLimits>;
  /** The household's calendar date (YYYY-MM-DD). */
  readonly today?: () => string;
  readonly newSeed?: () => string;
}

export class FamilyJourneyService {
  private readonly ladder: AbilityLadderSource;
  private readonly today: () => string;
  private readonly newSeed: () => string;

  constructor(private readonly options: FamilyServiceOptions) {
    this.ladder = options.ladder ?? FAMILY_ABILITY_LADDER;
    this.today = options.today ?? (() => new Date().toISOString().slice(0, 10));
    this.newSeed = options.newSeed ?? (() => randomUUID());
  }

  /** D-08 `/api/admin/immich/people?name=`: exact matches as opaque choices. */
  async lookupPeople(name: string): Promise<PersonChoice[]> {
    const wanted = requireText(name, FAMILY_LIMITS.immichNameMax, 'INVALID_NAME');
    const people = await this.options.library.findPeople(wanted, { deadline: this.deadline() });
    return people.map((person) => ({ id: person.option.id, label: person.option.label, birthDate: person.birthDate }));
  }

  /** Templates whose final age fits the child and whose rebased world validates. */
  offeredTemplates(birthDate: string): TemplateOffer[] {
    const date = requireDate(birthDate, this.today());
    return this.options.templates.offeredFor(date, this.today()).map(templateOffer);
  }

  async createChild(input: CreateChildInput, actorId: string | null): Promise<ChildView> {
    const immichName = requireText(input.immichName, FAMILY_LIMITS.immichNameMax, 'INVALID_NAME');
    const displayName = requireText(input.displayName, FAMILY_LIMITS.displayNameMax, 'INVALID_DISPLAY_NAME');
    const birthDate = requireDate(input.birthDate, this.today());
    const template = this.options.templates.require(input.templateId, input.templateVersion);
    this.rebase(template, birthDate);
    if ((await this.options.store.listChildren()).length >= FAMILY_LIMITS.maxChildren) {
      throw new AppError(409, 'CHILD_LIMIT', 'Too many children');
    }
    // The choice id is opaque; resolve it again server-side so a client can
    // never name an arbitrary upstream person.
    const people = await this.options.library.findPeople(immichName, { deadline: this.deadline() });
    const person = people.find((candidate) => candidate.option.id === input.personChoiceId);
    if (!person) throw new AppError(422, 'SUBJECT_UNRESOLVED', 'Person unresolved');
    const child = await this.options.store.createChild({
      displayName,
      immichName,
      immichPersonId: person.sourceId,
      birthDate,
      templateId: template.id,
      templateVersion: template.version,
    }, actorId);
    return childView(child);
  }

  async listChildren(): Promise<ChildView[]> {
    return (await this.options.store.listChildren()).map(childView);
  }

  /**
   * Rebase the chapters and auto-pick every memory photo (D-03, D-04). A new
   * draft gets a fresh seed; re-running keeps the draft's seed unless `reseed`
   * asks for different picks.
   */
  async autoPick(
    childId: string,
    actorId: string | null,
    options: { expectedRevision?: number | null; reseed?: boolean } = {},
  ): Promise<DraftView> {
    const child = await this.requireChild(childId);
    const current = await this.options.store.getDraft(childId);
    const expectedRevision = options.expectedRevision === undefined
      ? current?.revision ?? null
      : options.expectedRevision;
    const template = this.options.templates.require(child.templateId, child.templateVersion);
    const today = this.today();
    const world = this.rebase(template, child.birthDate, today);
    const seed = current && !options.reseed ? current.seed : this.newSeed();
    const outcomes = await autoPickJourney({
      chapters: world.chapters,
      birthDate: child.birthDate,
      today,
      personId: child.immichPersonId,
      seed,
    }, this.pickEnvironment());
    const byKey = new Map(outcomes.map((outcome) => [`${outcome.chapterId}:${outcome.slot}`, outcome]));
    const slots: DraftSlot[] = world.chapters.flatMap((chapter) => FAMILY_MEMORY_SLOTS.map((slot) => {
      const outcome = byKey.get(`${chapter.chapterId}:${slot}`)!;
      const photo = outcome.photo;
      return {
        chapterId: chapter.chapterId,
        slot,
        status: photo ? 'filled' as const : 'needs-photo' as const,
        assetId: photo?.assetId ?? null,
        localDate: photo?.localDate ?? null,
        caption: photo
          ? defaultCaption(slot, photo.localDate, familyWholeYearsAt(child.birthDate, photo.localDate))
          : null,
        captionEdited: false,
        reason: photo
          ? { ...photo.reason, timedOut: outcome.timedOut, degraded: outcome.degraded }
          : { source: 'auto' as const, timedOut: outcome.timedOut, degraded: outcome.degraded },
      };
    }));
    const draft = await this.options.store.saveDraft(childId, expectedRevision, {
      templateId: template.id,
      templateVersion: template.version,
      seed,
      birthDate: child.birthDate,
      rebasedOn: today,
      chapters: world.chapters,
      slots,
    }, actorId);
    return this.draftView(child, draft);
  }

  async getDraft(childId: string): Promise<DraftView> {
    const child = await this.requireChild(childId);
    return this.draftView(child, await this.requireDraft(childId));
  }

  /** D-05: administrators edit captions; plain text, 1–60 characters. */
  async setCaption(
    childId: string,
    expectedRevision: number,
    chapterId: string,
    slot: FamilyMemorySlot,
    caption: unknown,
    actorId: string | null,
  ): Promise<DraftView> {
    const child = await this.requireChild(childId);
    const draft = await this.requireDraft(childId);
    const normalized = normalizeCaption(caption);
    if (!normalized.ok) throw new AppError(422, normalized.code, 'Invalid caption');
    const index = slotIndex(draft, chapterId, slot);
    if (draft.slots[index]!.status !== 'filled') throw new AppError(409, 'SLOT_EMPTY', 'Choose a photo first');
    const slots = draft.slots.map((entry, position) => position === index
      ? { ...entry, caption: normalized.caption, captionEdited: true }
      : entry);
    const saved = await this.options.store.saveDraft(childId, expectedRevision, { ...draft, slots }, actorId);
    return this.draftView(child, saved);
  }

  /** **Show more**: suggestions inside the slot's allowed dates, as candidate tokens. */
  async suggestions(
    childId: string,
    chapterId: string,
    slot: FamilyMemorySlot,
    cursor = 1,
  ): Promise<SuggestionPageView> {
    const child = await this.requireChild(childId);
    const draft = await this.requireDraft(childId);
    const chapterIndex = draft.chapters.findIndex((chapter) => chapter.chapterId === chapterId);
    slotIndex(draft, chapterId, slot);
    const range = this.manualWindow(draft, chapterIndex, slot);
    if (!range) return { suggestions: [], nextCursor: null };
    const page = await suggestForSlot({
      personId: child.immichPersonId,
      slot,
      window: range,
      target: slotTargetDate(draft.chapters[chapterIndex]!, slot),
      excludeAssetIds: new Set(draft.slots.flatMap((entry) => entry.assetId ? [entry.assetId] : [])),
      cursor,
    }, this.pickEnvironment());
    return {
      suggestions: page.assets.map((asset) => ({
        token: this.options.tokens.issue({ draftId: draft.id, assetId: asset.assetId, localDate: asset.localDate }),
        localDate: asset.localDate,
        ageYears: familyWholeYearsAt(child.birthDate, asset.localDate),
      })),
      nextCursor: page.nextCursor,
    };
  }

  /** Swap a slot's photo for a suggestion. The caption returns to its default. */
  async swap(
    childId: string,
    expectedRevision: number,
    chapterId: string,
    slot: FamilyMemorySlot,
    token: unknown,
    actorId: string | null,
  ): Promise<DraftView> {
    const child = await this.requireChild(childId);
    const draft = await this.requireDraft(childId);
    const claim = this.options.tokens.verify(token, draft.id);
    if (!claim) throw new AppError(422, 'CANDIDATE_INVALID', 'Suggestion expired');
    const index = slotIndex(draft, chapterId, slot);
    const chapterIndex = draft.chapters.findIndex((chapter) => chapter.chapterId === chapterId);
    const range = this.manualWindow(draft, chapterIndex, slot);
    if (!range || claim.localDate < range.from || claim.localDate > range.to) {
      throw new AppError(422, 'CANDIDATE_OUT_OF_RANGE', 'Photo date does not fit this memory');
    }
    if (draft.slots.some((entry, position) => position !== index && entry.assetId === claim.assetId)) {
      throw new AppError(409, 'PHOTO_ALREADY_USED', 'Photo already used');
    }
    const slots = draft.slots.map((entry, position): DraftSlot => position === index
      ? {
          ...entry,
          status: 'filled',
          assetId: claim.assetId,
          localDate: claim.localDate,
          caption: defaultCaption(slot, claim.localDate, familyWholeYearsAt(child.birthDate, claim.localDate)),
          captionEdited: false,
          reason: { source: 'admin' },
        }
      : entry);
    const saved = await this.options.store.saveDraft(childId, expectedRevision, { ...draft, slots }, actorId);
    return this.draftView(child, saved);
  }

  /** Resolve a candidate or slot thumbnail token to its private asset (admin media route). */
  async resolveCandidate(token: unknown): Promise<{ childId: string; assetId: string; personId: string; localDate: string }> {
    const claim = this.options.tokens.verify(token);
    if (!claim) throw new AppError(404, 'MEDIA_NOT_FOUND', 'Media not found');
    const children = await this.options.store.listChildren();
    for (const child of children) {
      const draft = await this.options.store.getDraft(child.id);
      if (draft?.id === claim.draftId) {
        return { childId: child.id, assetId: claim.assetId, personId: child.immichPersonId, localDate: claim.localDate };
      }
    }
    throw new AppError(404, 'MEDIA_NOT_FOUND', 'Media not found');
  }

  /** D-02 publish: idempotent per request id; blocked until every slot is filled. */
  async publish(
    childId: string,
    expectedRevision: number,
    requestId: string,
    actorId: string | null,
  ): Promise<PublicationSummary> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
      throw new AppError(422, 'INVALID_REQUEST_ID', 'Invalid request');
    }
    const publication = await this.options.store.publish({
      childId,
      requestId: requestId.toLowerCase(),
      expectedDraftRevision: expectedRevision,
      actorId,
      build: (child, draft) => this.buildPublication(child, draft),
    });
    return publicationSummary(publication);
  }

  async latestPublications(): Promise<PublicationSummary[]> {
    return (await this.options.store.listLatestPublications()).map(publicationSummary);
  }

  private buildPublication(child: ChildRecord, draft: DraftRecord) {
    if (
      draft.birthDate !== child.birthDate ||
      draft.templateId !== child.templateId ||
      draft.templateVersion !== child.templateVersion
    ) throw new AppError(409, 'DRAFT_STALE', 'Pick the photos again');
    const template = this.options.templates.require(draft.templateId, draft.templateVersion);
    const world = this.rebase(template, draft.birthDate, draft.rebasedOn);
    if (!sameChapters(world.chapters, draft.chapters)) {
      throw new AppError(409, 'DRAFT_STALE', 'Pick the photos again');
    }
    const missing = [...new Set(draft.slots
      .filter((slot) => slot.status !== 'filled' || !slot.assetId || !slot.localDate || !slot.caption)
      .map((slot) => slot.chapterId))];
    if (missing.length > 0) {
      throw new AppError(422, 'SLOTS_INCOMPLETE', `Photos needed: ${missing.join(', ')}`);
    }
    try {
      return buildFamilyWorldPlan({
        template,
        world,
        ladder: this.ladder,
        selections: draft.slots.map((slot) => ({
          chapterId: slot.chapterId,
          slot: slot.slot,
          assetId: slot.assetId!,
          personId: child.immichPersonId,
          localDate: slot.localDate!,
          caption: slot.caption!,
          opaque: this.options.library.opaqueAssetRef(slot.assetId!),
        })),
      });
    } catch (error) {
      if (error instanceof FamilyPlanError) {
        throw new AppError(422, error.code === 'SLOTS_INCOMPLETE' ? 'SLOTS_INCOMPLETE' : 'PLAN_INVALID', 'Journey cannot be published');
      }
      throw error;
    }
  }

  private draftView(child: ChildRecord, draft: DraftRecord): DraftView {
    const template = this.options.templates.get(draft.templateId, draft.templateVersion);
    return {
      childId: child.id,
      draftId: draft.id,
      revision: draft.revision,
      templateId: draft.templateId,
      templateVersion: draft.templateVersion,
      publishable: draft.slots.every((slot) => slot.status === 'filled'),
      chapters: draft.chapters.map((chapter, index) => {
        const source = template?.project.chapters[index];
        return {
          chapterId: chapter.chapterId,
          name: source?.name ?? chapter.chapterId,
          subtitle: source?.subtitle ?? '',
          startAge: chapter.startAge,
          recoveredAge: chapter.recoveredAge,
          startDate: chapter.startDate,
          targetDate: chapter.targetDate,
          slots: FAMILY_MEMORY_SLOTS.map((slot) => {
            const entry = draft.slots.find((candidate) =>
              candidate.chapterId === chapter.chapterId && candidate.slot === slot);
            return {
              slot,
              status: entry?.status ?? 'needs-photo',
              localDate: entry?.localDate ?? null,
              ageYears: entry?.localDate ? familyWholeYearsAt(draft.birthDate, entry.localDate) : null,
              caption: entry?.caption ?? null,
              captionEdited: entry?.captionEdited ?? false,
              thumbnailToken: entry?.assetId && entry.localDate
                ? this.options.tokens.issue({ draftId: draft.id, assetId: entry.assetId, localDate: entry.localDate })
                : null,
              source: entry?.reason?.source ?? null,
            };
          }),
        };
      }),
    };
  }

  private manualWindow(draft: DraftRecord, chapterIndex: number, slot: FamilyMemorySlot) {
    return manualSlotWindow(
      draft.chapters,
      chapterIndex,
      slot,
      (chapterId, neighbour) => draft.slots.find((entry) =>
        entry.chapterId === chapterId && entry.slot === neighbour && entry.status === 'filled')?.localDate ?? null,
      draft.birthDate,
      this.today() < draft.rebasedOn ? draft.rebasedOn : this.today(),
      this.options.limits,
    );
  }

  private rebase(template: FamilyTemplate, birthDate: string, today = this.today()): RebasedWorld {
    try {
      return rebaseWorldForChild(template.project, birthDate, today);
    } catch (error) {
      if (error instanceof FamilyRebaseError) {
        throw new AppError(422, 'TEMPLATE_NOT_OFFERED', 'World template does not fit this birthday');
      }
      throw error;
    }
  }

  private pickEnvironment() {
    return {
      library: this.options.library,
      ...(this.options.clock ? { clock: this.options.clock } : {}),
      ...(this.options.limits ? { limits: this.options.limits } : {}),
    };
  }

  private deadline(): number {
    return (this.options.clock?.now() ?? Date.now()) + 8_000;
  }

  private async requireChild(childId: string): Promise<ChildRecord> {
    const child = isUuid(childId) ? await this.options.store.getChild(childId) : null;
    if (!child) throw new AppError(404, 'CHILD_NOT_FOUND', 'Child not found');
    return child;
  }

  private async requireDraft(childId: string): Promise<DraftRecord> {
    const draft = await this.options.store.getDraft(childId);
    if (!draft) throw new AppError(404, 'DRAFT_NOT_FOUND', 'Draft not found');
    return draft;
  }
}

/** Field by field: Postgres `jsonb` does not keep object key order. */
function sameChapters(left: readonly RebasedChapter[], right: readonly RebasedChapter[]): boolean {
  const key = (chapter: RebasedChapter) => [
    chapter.index,
    chapter.chapterId,
    chapter.routeId,
    chapter.startAge,
    chapter.recoveredAge,
    chapter.startDate,
    chapter.targetDate,
  ].join('|');
  return left.length === right.length && left.every((chapter, index) => key(chapter) === key(right[index]!));
}

function slotIndex(draft: DraftRecord, chapterId: string, slot: FamilyMemorySlot): number {
  const index = draft.slots.findIndex((entry) => entry.chapterId === chapterId && entry.slot === slot);
  if (index < 0) throw new AppError(404, 'SLOT_NOT_FOUND', 'Memory slot not found');
  return index;
}

function childView(child: ChildRecord): ChildView {
  return {
    id: child.id,
    displayName: child.displayName,
    birthDate: child.birthDate,
    templateId: child.templateId,
    templateVersion: child.templateVersion,
    revision: child.revision,
  };
}

function templateOffer(template: FamilyTemplate): TemplateOffer {
  return {
    id: template.id,
    version: template.version,
    name: template.project.name,
    chapterCount: template.project.chapters.length,
  };
}

function publicationSummary(publication: PublicationRecord): PublicationSummary {
  return {
    publicationId: publication.id,
    childId: publication.childId,
    revision: publication.revision,
    chapterCount: publication.plan.levels.length,
    memoryCount: publication.memories.length,
  };
}

function requireText(value: unknown, max: number, code: string): string {
  if (typeof value !== 'string') throw new AppError(422, code, 'Invalid text');
  const text = value.normalize('NFC').replace(/\s+/gu, ' ').trim();
  if (text.length < 1 || [...text].length > max || /[\p{Cc}‪-‮⁦-⁩]/u.test(text)) {
    throw new AppError(422, code, 'Invalid text');
  }
  return text;
}

function requireDate(value: unknown, today: string): string {
  if (typeof value !== 'string' || !isDateOnly(value) || value > today || value < '1900-01-01') {
    throw new AppError(422, 'INVALID_BIRTH_DATE', 'Invalid birthday');
  }
  return value;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
