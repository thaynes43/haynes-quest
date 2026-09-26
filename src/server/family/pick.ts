/**
 * Bounded automatic photo picks (DESIGN-024 D-04).
 *
 * Every slot search is bounded: at most 8 search pages, 250 ms between Immich
 * calls and a 20 s deadline. Picks are deterministic for a given draft seed and
 * library state: the seed rotates the little-memory queries and breaks score
 * ties through a SHA-256 of the seed, slot and asset. Nothing here logs;
 * reasons hold scores and generic query text, never names, dates or ids.
 */
import { createHash } from 'node:crypto';
import {
  addDays,
  daysBetween,
  familyAnniversary,
  type FamilyMemorySlot,
} from '../../shared/family-plan.js';
import { AppError } from '../errors.js';
import type { FamilyAsset, FamilyFace, FamilyPhotoLibrary } from '../photos/source.js';
import type { RebasedChapter } from './rebase.js';

export const BIG_MEMORY_QUERIES = Object.freeze([
  'birthday cake',
  'birthday party',
  'blowing out candles',
] as const);

export const LITTLE_MEMORY_QUERIES = Object.freeze([
  'child playing outside',
  'holiday',
  'halloween costume',
  'christmas morning',
  'beach',
  'first day of school',
  'playground',
  'swimming',
] as const);

export interface PickLimits {
  readonly pagesPerSlot: number;
  readonly spacingMs: number;
  readonly slotDeadlineMs: number;
  readonly smartPageSize: number;
  readonly metadataPageSize: number;
  readonly smartQueriesPerSlot: number;
  /** Pages the preferred pass leaves for the single widened pass. */
  readonly widenReservePages: number;
  /** Confirmed candidates scored with face boxes per slot. */
  readonly facesPerSlot: number;
  readonly enoughCandidates: number;
  readonly bigWindowDays: number;
  readonly bigWidenedDays: number;
  readonly littleWindowFraction: number;
}

export const DEFAULT_PICK_LIMITS: PickLimits = Object.freeze({
  pagesPerSlot: 8,
  spacingMs: 250,
  slotDeadlineMs: 20_000,
  smartPageSize: 50,
  metadataPageSize: 100,
  smartQueriesPerSlot: 3,
  widenReservePages: 3,
  facesPerSlot: 10,
  enoughCandidates: 24,
  bigWindowDays: 30,
  bigWidenedDays: 90,
  littleWindowFraction: 0.2,
});

export interface PickClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const SYSTEM_PICK_CLOCK: PickClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export interface PickEnvironment {
  readonly library: FamilyPhotoLibrary;
  readonly clock?: PickClock;
  readonly limits?: Partial<PickLimits>;
}

export interface DateWindow {
  /** Inclusive local calendar dates. */
  readonly from: string;
  readonly to: string;
}

export interface SlotWindows {
  readonly target: string;
  readonly preferred: DateWindow | null;
  /** The one widening D-04 allows, still inside the chapter bounds. */
  readonly widened: DateWindow | null;
}

export interface PickReason {
  readonly source: 'auto';
  readonly window: 'preferred' | 'widened';
  /** The generic smart-search query that ranked the photo, if any. */
  readonly query: string | null;
  readonly score: number;
  readonly faces: number | null;
}

export interface PickedPhoto {
  readonly assetId: string;
  readonly localDate: string;
  readonly reason: PickReason;
}

export interface SlotOutcome {
  readonly chapterId: string;
  readonly slot: FamilyMemorySlot;
  /** Null marks the slot `needs-photo`. */
  readonly photo: PickedPhoto | null;
  readonly searchedPages: number;
  readonly timedOut: boolean;
  /** Smart search failed and the slot fell back to metadata search. */
  readonly degraded: boolean;
}

export interface JourneyPickInput {
  readonly chapters: readonly RebasedChapter[];
  readonly birthDate: string;
  readonly today: string;
  readonly personId: string;
  readonly seed: string;
}

/** Big memories first (they bound the next chapter's little ones), then little memories. */
export async function autoPickJourney(
  input: JourneyPickInput,
  environment: PickEnvironment,
): Promise<SlotOutcome[]> {
  return autoPickChapters({
    ...input,
    pickChapterIds: new Set(input.chapters.map((chapter) => chapter.chapterId)),
    fixed: new Map(),
  }, environment);
}

/** A photo kept from an earlier draft. */
export interface FixedSelection {
  readonly assetId: string;
  readonly localDate: string;
}

export interface PartialPickInput extends JourneyPickInput {
  /** The chapters to pick; every other chapter keeps its {@link fixed} photos. */
  readonly pickChapterIds: ReadonlySet<string>;
  /**
   * Kept photos keyed `${chapterId}:${slot}` (DESIGN-024 D-11). New picks never
   * reuse them and stay chronological around them.
   */
  readonly fixed: ReadonlyMap<string, FixedSelection>;
}

export function slotKey(chapterId: string, slot: FamilyMemorySlot): string {
  return `${chapterId}:${slot}`;
}

/**
 * Pick only the chapters in `pickChapterIds`, around the kept photos of the
 * others: a picked big memory stays before the next chapter's kept little
 * memories, and picked little memories follow the previous chapter's big
 * memory, kept or picked. With every chapter picked and nothing kept this is
 * exactly {@link autoPickJourney}.
 */
export async function autoPickChapters(
  input: PartialPickInput,
  environment: PickEnvironment,
): Promise<SlotOutcome[]> {
  const limits = { ...DEFAULT_PICK_LIMITS, ...environment.limits };
  const pacer: Pacer = { lastCallAt: Number.NEGATIVE_INFINITY };
  const used = new Set([...input.fixed.values()].map((selection) => selection.assetId));
  const picked = (chapterId: string) => input.pickChapterIds.has(chapterId);
  const bigs = new Map<string, SlotOutcome>();
  for (const [index, chapter] of input.chapters.entries()) {
    if (!picked(chapter.chapterId)) continue;
    let windows = bigMemoryWindows(input.chapters, index, input.birthDate, input.today, limits);
    const next = input.chapters[index + 1];
    const nextKept = next && !picked(next.chapterId)
      ? (['minor-one', 'minor-two'] as const)
          .map((slot) => input.fixed.get(slotKey(next.chapterId, slot))?.localDate)
          .filter((date): date is string => date !== undefined)
      : [];
    if (nextKept.length > 0) windows = capWindows(windows, addDays(minDate(...nextKept), -1));
    const outcome = await pickSlot({
      ...input,
      chapterId: chapter.chapterId,
      slot: 'major',
      windows,
      excludeAssetIds: used,
      excludeDates: new Set(),
      avoidMonth: null,
    }, environment, limits, pacer);
    if (outcome.photo) used.add(outcome.photo.assetId);
    bigs.set(chapter.chapterId, outcome);
  }
  const outcomes: SlotOutcome[] = [];
  for (const [index, chapter] of input.chapters.entries()) {
    if (!picked(chapter.chapterId)) continue;
    const previous = index > 0 ? input.chapters[index - 1] : undefined;
    const previousBig = previous
      ? (picked(previous.chapterId)
          ? bigs.get(previous.chapterId)?.photo?.localDate
          : input.fixed.get(slotKey(previous.chapterId, 'major'))?.localDate) ?? null
      : null;
    const minorOne = await pickSlot({
      ...input,
      chapterId: chapter.chapterId,
      slot: 'minor-one',
      windows: littleMemoryWindows(chapter, 'minor-one', previousBig, null, limits),
      excludeAssetIds: used,
      excludeDates: new Set(),
      avoidMonth: null,
    }, environment, limits, pacer);
    if (minorOne.photo) used.add(minorOne.photo.assetId);
    const minorOneDate = minorOne.photo?.localDate ?? null;
    const minorTwo = await pickSlot({
      ...input,
      chapterId: chapter.chapterId,
      slot: 'minor-two',
      windows: littleMemoryWindows(chapter, 'minor-two', previousBig, minorOneDate, limits),
      excludeAssetIds: used,
      excludeDates: new Set(minorOneDate ? [minorOneDate] : []),
      avoidMonth: minorOneDate?.slice(0, 7) ?? null,
    }, environment, limits, pacer);
    if (minorTwo.photo) used.add(minorTwo.photo.assetId);
    outcomes.push(minorOne, minorTwo, bigs.get(chapter.chapterId)!);
  }
  return outcomes;
}

/** Both windows, ending no later than `to`. */
function capWindows(windows: SlotWindows, to: string): SlotWindows {
  const cap = (range: DateWindow | null) => range && window(range.from, minDate(range.to, to));
  const preferred = cap(windows.preferred);
  const widened = cap(windows.widened);
  return { target: windows.target, preferred, widened: sameWindow(preferred, widened) ? null : widened };
}

/**
 * Big memory: `[birthday turning N, +30 days]`, widened once to +90 days; never
 * past today, the next birthday or the next chapter's big memory.
 */
export function bigMemoryWindows(
  chapters: readonly RebasedChapter[],
  index: number,
  birthDate: string,
  today: string,
  limits: Pick<PickLimits, 'bigWindowDays' | 'bigWidenedDays'> = DEFAULT_PICK_LIMITS,
): SlotWindows {
  const chapter = chapters[index]!;
  const next = chapters[index + 1];
  const target = chapter.targetDate;
  const hardTo = minDate(
    today,
    addDays(familyAnniversary(birthDate, chapter.recoveredAge + 1), -1),
    ...(next ? [addDays(next.targetDate, -1)] : []),
  );
  const preferred = window(target, minDate(addDays(target, limits.bigWindowDays), hardTo));
  const widened = window(target, minDate(addDays(target, limits.bigWidenedDays), hardTo));
  return {
    target,
    preferred,
    widened: sameWindow(preferred, widened) ? null : widened,
  };
}

/**
 * Little memories: strictly inside the chapter and after the previous big
 * memory, aimed at the ⅓ and ⅔ points ± 20% of the chapter; widened once to the
 * whole chapter. The second little memory also follows the first.
 */
export function littleMemoryWindows(
  chapter: Pick<RebasedChapter, 'startDate' | 'targetDate'>,
  slot: 'minor-one' | 'minor-two',
  previousBigDate: string | null,
  minorOneDate: string | null,
  limits: Pick<PickLimits, 'littleWindowFraction'> = DEFAULT_PICK_LIMITS,
): SlotWindows {
  const length = daysBetween(chapter.startDate, chapter.targetDate);
  const target = addDays(chapter.startDate, Math.round(length * (slot === 'minor-one' ? 1 / 3 : 2 / 3)));
  const half = Math.max(1, Math.round(length * limits.littleWindowFraction));
  const lowerExclusive = maxDate(
    chapter.startDate,
    ...(previousBigDate ? [previousBigDate] : []),
    ...(slot === 'minor-two' && minorOneDate ? [minorOneDate] : []),
  );
  const low = addDays(lowerExclusive, 1);
  const high = addDays(chapter.targetDate, -1);
  const preferred = window(maxDate(addDays(target, -half), low), minDate(addDays(target, half), high));
  const widened = window(low, high);
  return { target, preferred, widened: sameWindow(preferred, widened) ? null : widened };
}

interface SlotRequest extends JourneyPickInput {
  readonly chapterId: string;
  readonly slot: FamilyMemorySlot;
  readonly windows: SlotWindows;
  readonly excludeAssetIds: ReadonlySet<string>;
  readonly excludeDates: ReadonlySet<string>;
  readonly avoidMonth: string | null;
}

interface Candidate {
  readonly asset: FamilyAsset;
  relevance: number;
  query: string | null;
}

class SlotTimeout extends Error {}

/** One pacer per journey, so consecutive slots never burst Immich either. */
interface Pacer {
  lastCallAt: number;
}

class SlotSearch {
  pages = 0;
  timedOut = false;
  degraded = false;
  readonly deadline: number;

  constructor(
    private readonly clock: PickClock,
    private readonly limits: PickLimits,
    private readonly pacer: Pacer,
  ) {
    this.deadline = clock.now() + limits.slotDeadlineMs;
  }

  /** Pace every Immich call and stop at the slot deadline. */
  async paced<T>(call: () => Promise<T>): Promise<T> {
    const now = this.clock.now();
    const due = this.pacer.lastCallAt + this.limits.spacingMs;
    if (now >= this.deadline || due >= this.deadline) throw new SlotTimeout();
    if (due > now) await this.clock.sleep(due - now);
    this.pacer.lastCallAt = this.clock.now();
    try {
      return await call();
    } catch (error) {
      // A call cut off by the slot deadline is a bounded, partial search.
      if (this.clock.now() >= this.deadline) throw new SlotTimeout();
      throw error;
    }
  }
}

async function pickSlot(
  request: SlotRequest,
  environment: PickEnvironment,
  limits: PickLimits,
  pacer: Pacer,
): Promise<SlotOutcome> {
  const clock = environment.clock ?? SYSTEM_PICK_CLOCK;
  const search = new SlotSearch(clock, limits, pacer);
  let photo: PickedPhoto | null = null;
  const passes: Array<{ name: 'preferred' | 'widened'; window: DateWindow | null; smart: boolean }> = [
    { name: 'preferred', window: request.windows.preferred, smart: true },
    { name: 'widened', window: request.windows.widened, smart: false },
  ];
  for (const pass of passes) {
    if (photo || !pass.window || search.timedOut) continue;
    const allowance = pass.name === 'preferred'
      ? limits.pagesPerSlot - (request.windows.widened ? limits.widenReservePages : 0)
      : limits.pagesPerSlot - search.pages;
    try {
      const candidates = await collect(request, pass.window, pass.smart, allowance, environment.library, search, limits);
      photo = await choose(request, candidates, pass.name, environment.library, search, limits);
    } catch (error) {
      if (!(error instanceof SlotTimeout)) throw error;
      search.timedOut = true;
    }
  }
  return {
    chapterId: request.chapterId,
    slot: request.slot,
    photo,
    searchedPages: search.pages,
    timedOut: search.timedOut,
    degraded: search.degraded,
  };
}

async function collect(
  request: SlotRequest,
  range: DateWindow,
  smart: boolean,
  allowance: number,
  library: FamilyPhotoLibrary,
  search: SlotSearch,
  limits: PickLimits,
): Promise<Candidate[]> {
  const candidates = new Map<string, Candidate>();
  let pagesLeft = Math.min(allowance, limits.pagesPerSlot - search.pages);
  const accept = (asset: FamilyAsset, relevance: number, query: string | null): void => {
    if (
      request.excludeAssetIds.has(asset.assetId) ||
      request.excludeDates.has(asset.localDate) ||
      asset.localDate < range.from ||
      asset.localDate > range.to
    ) return;
    const existing = candidates.get(asset.assetId);
    if (!existing) {
      candidates.set(asset.assetId, { asset, relevance, query });
    } else if (relevance > existing.relevance) {
      existing.relevance = relevance;
      existing.query = query;
    }
  };
  if (smart) {
    for (const query of queriesFor(request, limits)) {
      if (pagesLeft <= 1 || candidates.size >= limits.enoughCandidates) break;
      let page;
      try {
        page = await search.paced(() => library.search({
          personId: request.personId,
          query,
          fromDate: range.from,
          toDate: range.to,
          page: 1,
          size: limits.smartPageSize,
        }, { deadline: search.deadline }));
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
        // Smart search depends on Immich machine learning; degrade to metadata.
        search.pages += 1;
        pagesLeft -= 1;
        search.degraded = true;
        break;
      }
      search.pages += 1;
      pagesLeft -= 1;
      page.assets.forEach((asset, rank) => accept(asset, 1 - rank / limits.smartPageSize, query));
    }
  }
  let nextPage: number | null = 1;
  while (nextPage !== null && pagesLeft > 0 && candidates.size < limits.enoughCandidates) {
    const pageNumber: number = nextPage;
    const page = await search.paced(() => library.search({
      personId: request.personId,
      fromDate: range.from,
      toDate: range.to,
      page: pageNumber,
      size: limits.metadataPageSize,
    }, { deadline: search.deadline }));
    search.pages += 1;
    pagesLeft -= 1;
    page.assets.forEach((asset) => accept(asset, 0, null));
    nextPage = page.nextPage;
  }
  return [...candidates.values()];
}

interface Scored {
  readonly candidate: Candidate;
  readonly score: number;
  readonly jitter: number;
  readonly faces: number | null;
}

async function choose(
  request: SlotRequest,
  candidates: readonly Candidate[],
  windowName: 'preferred' | 'widened',
  library: FamilyPhotoLibrary,
  search: SlotSearch,
  limits: PickLimits,
): Promise<PickedPhoto | null> {
  if (candidates.length === 0) return null;
  const range = windowName === 'preferred' ? request.windows.preferred! : request.windows.widened!;
  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: preScore(request, candidate, range),
      jitter: jitter(request, candidate.asset.assetId),
      faces: null,
    }))
    .sort(compareScored);
  const confirmed: Scored[] = [];
  let calls = 0;
  for (const entry of ranked) {
    if (confirmed.length >= limits.facesPerSlot || calls >= limits.facesPerSlot * 2) break;
    calls += 1;
    let faces: FamilyFace[] | null = null;
    try {
      faces = await search.paced(() => library.faces(entry.candidate.asset.assetId, { deadline: search.deadline }));
    } catch (error) {
      if (error instanceof SlotTimeout) {
        search.timedOut = true;
        break;
      }
      if (!(error instanceof AppError)) throw error;
    }
    const scored = withFaces(request, entry, faces);
    if (scored) confirmed.push(scored);
  }
  // If the deadline cut face scoring short, a metadata-confirmed photo still counts.
  const pool = confirmed.length > 0
    ? confirmed
    : ranked.filter((entry) => entry.candidate.asset.personIds?.includes(request.personId));
  const differentMonth = request.avoidMonth
    ? pool.filter((entry) => entry.candidate.asset.localDate.slice(0, 7) !== request.avoidMonth)
    : pool;
  const best = [...(differentMonth.length > 0 ? differentMonth : pool)].sort(compareScored)[0];
  if (!best) return null;
  return {
    assetId: best.candidate.asset.assetId,
    localDate: best.candidate.asset.localDate,
    reason: {
      source: 'auto',
      window: windowName,
      query: best.candidate.query,
      score: Math.round(best.score * 100) / 100,
      faces: best.faces,
    },
  };
}

function preScore(request: SlotRequest, candidate: Candidate, range: DateWindow): number {
  const { asset } = candidate;
  const major = request.slot === 'major';
  let score = candidate.relevance * (major ? 3 : 2);
  const offset = Math.abs(daysBetween(request.windows.target, asset.localDate));
  if (major) {
    // Prefer the birthday itself, then the days just after it.
    score += offset === 0 ? 3 : 1.5 * Math.max(0, 1 - offset / 30);
  } else {
    const half = Math.max(1, Math.round(daysBetween(range.from, range.to) / 2));
    score += 1.5 * Math.max(0, 1 - offset / half);
  }
  score += framingScore(asset.width, asset.height);
  score += peopleScore(asset.personIds?.length ?? null);
  if (asset.likelyScreenshot) score -= 5;
  if (request.avoidMonth && asset.localDate.slice(0, 7) === request.avoidMonth) score -= 4;
  return score;
}

function withFaces(request: SlotRequest, entry: Scored, faces: FamilyFace[] | null): Scored | null {
  const { asset } = entry.candidate;
  const childFace = faces?.find((face) => face.personId === request.personId) ?? null;
  // The child must be on the asset: in its people list or in its faces.
  if (!childFace && !asset.personIds?.includes(request.personId)) return null;
  let score = entry.score - peopleScore(asset.personIds?.length ?? null);
  score += peopleScore(faces ? faces.length : asset.personIds?.length ?? null);
  if (childFace) {
    const fraction = ((childFace.x2 - childFace.x1) * (childFace.y2 - childFace.y1)) /
      (childFace.imageWidth * childFace.imageHeight);
    score += 2 * Math.min(1, fraction / 0.06);
    if (asset.width === null || asset.height === null) {
      score += framingScore(childFace.imageWidth, childFace.imageHeight) - framingScore(null, null);
    }
  }
  return { ...entry, score, faces: faces ? faces.length : null };
}

/** Fewer people first; unknown counts sit in the middle. */
function peopleScore(count: number | null): number {
  if (count === null) return 0.6;
  if (count <= 1) return 2;
  if (count === 2) return 1.2;
  if (count === 3) return 0.6;
  return 0;
}

/** Landscape or square framing first. */
function framingScore(width: number | null, height: number | null): number {
  if (width === null || height === null) return 0.5;
  return width >= height * 0.95 ? 1 : 0;
}

function compareScored(left: Scored, right: Scored): number {
  return right.score - left.score ||
    left.jitter - right.jitter ||
    (left.candidate.asset.assetId < right.candidate.asset.assetId ? -1 : 1);
}

function queriesFor(request: SlotRequest, limits: PickLimits): string[] {
  if (request.slot === 'major') return BIG_MEMORY_QUERIES.slice(0, limits.smartQueriesPerSlot);
  // Rotate the eight moments per seed and slot so a journey samples all of them.
  const offset = seedHash(`${request.seed}|${request.chapterId}|${request.slot}|queries`) %
    LITTLE_MEMORY_QUERIES.length;
  return Array.from(
    { length: Math.min(limits.smartQueriesPerSlot, LITTLE_MEMORY_QUERIES.length) },
    (_, index) => LITTLE_MEMORY_QUERIES[(offset + index) % LITTLE_MEMORY_QUERIES.length]!,
  );
}

function jitter(request: SlotRequest, assetId: string): number {
  return seedHash(`${request.seed}|${request.chapterId}|${request.slot}|${assetId}`);
}

function seedHash(value: string): number {
  return createHash('sha256').update(value, 'utf8').digest().readUInt32BE(0);
}

function window(from: string, to: string): DateWindow | null {
  return from <= to ? { from, to } : null;
}

function sameWindow(left: DateWindow | null, right: DateWindow | null): boolean {
  return left?.from === right?.from && left?.to === right?.to;
}

function minDate(...dates: string[]): string {
  return dates.reduce((left, right) => (right < left ? right : left));
}

function maxDate(...dates: string[]): string {
  return dates.reduce((left, right) => (right > left ? right : left));
}

/**
 * The dates an administrator may choose for a slot (**Show more** and swaps):
 * the slot's widened window, further bounded by the photos already chosen for
 * its neighbours so the journey stays chronological.
 */
export function manualSlotWindow(
  chapters: readonly RebasedChapter[],
  index: number,
  slot: FamilyMemorySlot,
  chosenDate: (chapterId: string, slot: FamilyMemorySlot) => string | null,
  birthDate: string,
  today: string,
  limits: Partial<PickLimits> = {},
): DateWindow | null {
  const settings = { ...DEFAULT_PICK_LIMITS, ...limits };
  const chapter = chapters[index];
  if (!chapter) return null;
  if (slot === 'major') {
    const windows = bigMemoryWindows(chapters, index, birthDate, today, settings);
    const range = windows.widened ?? windows.preferred;
    const next = chapters[index + 1];
    const nextMinor = next ? chosenDate(next.chapterId, 'minor-one') : null;
    return range && nextMinor ? window(range.from, minDate(range.to, addDays(nextMinor, -1))) : range;
  }
  const previous = chapters[index - 1];
  const previousBig = previous ? chosenDate(previous.chapterId, 'major') : null;
  const minorOne = chosenDate(chapter.chapterId, 'minor-one');
  const windows = littleMemoryWindows(chapter, slot, previousBig, minorOne, settings);
  const range = windows.widened ?? windows.preferred;
  if (!range || slot === 'minor-two') return range;
  const minorTwo = chosenDate(chapter.chapterId, 'minor-two');
  return minorTwo ? window(range.from, minDate(range.to, addDays(minorTwo, -1))) : range;
}

/** The date a slot's ranking aims at: the birthday, or the ⅓ / ⅔ chapter point. */
export function slotTargetDate(chapter: RebasedChapter, slot: FamilyMemorySlot): string {
  if (slot === 'major') return chapter.targetDate;
  const length = daysBetween(chapter.startDate, chapter.targetDate);
  return addDays(chapter.startDate, Math.round(length * (slot === 'minor-one' ? 1 / 3 : 2 / 3)));
}

export interface SuggestionRequest {
  readonly personId: string;
  readonly slot: FamilyMemorySlot;
  readonly window: DateWindow;
  readonly target: string;
  readonly excludeAssetIds: ReadonlySet<string>;
  /** 1-based metadata page; **Show more** passes the returned `nextCursor`. */
  readonly cursor: number;
}

export interface SuggestionPage {
  readonly assets: FamilyAsset[];
  readonly nextCursor: number | null;
}

/**
 * One bounded page of swap suggestions, confirmed on the child and ordered by
 * the same framing, people and date preferences as the automatic pick.
 */
export async function suggestForSlot(
  request: SuggestionRequest,
  environment: PickEnvironment,
): Promise<SuggestionPage> {
  const limits = { ...DEFAULT_PICK_LIMITS, ...environment.limits };
  const clock = environment.clock ?? SYSTEM_PICK_CLOCK;
  if (!Number.isSafeInteger(request.cursor) || request.cursor < 1 || request.cursor > limits.pagesPerSlot) {
    throw new AppError(422, 'INVALID_CURSOR', 'Invalid cursor');
  }
  const page = await environment.library.search({
    personId: request.personId,
    fromDate: request.window.from,
    toDate: request.window.to,
    page: request.cursor,
    size: 24,
  }, { deadline: clock.now() + limits.slotDeadlineMs });
  const ranking: SlotRequest = {
    chapters: [],
    birthDate: request.window.from,
    today: request.window.to,
    personId: request.personId,
    seed: '',
    chapterId: '',
    slot: request.slot,
    windows: { target: request.target, preferred: request.window, widened: null },
    excludeAssetIds: request.excludeAssetIds,
    excludeDates: new Set(),
    avoidMonth: null,
  };
  const assets = page.assets
    .filter((asset) =>
      !request.excludeAssetIds.has(asset.assetId) &&
      asset.personIds?.includes(request.personId) === true,
    )
    .map((asset) => ({ asset, score: preScore(ranking, { asset, relevance: 0, query: null }, request.window) }))
    .sort((left, right) => right.score - left.score ||
      (left.asset.assetId < right.asset.assetId ? -1 : 1))
    .map((entry) => entry.asset);
  return {
    assets,
    nextCursor: page.nextPage !== null && page.nextPage <= limits.pagesPerSlot ? page.nextPage : null,
  };
}
