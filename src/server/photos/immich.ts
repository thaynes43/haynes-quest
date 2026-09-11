import { createHmac } from 'node:crypto';
import { z } from 'zod';
import type { PreviewRequest } from '../../shared/contracts.js';
import { wholeYearsAt, type FrozenMemory } from '../domain.js';
import { AppError } from '../errors.js';
import type {
  DiscoveryResult,
  JourneyPhotoSource,
  ResolvedSubject,
  SubjectResolution,
} from './source.js';

const personSchema = z
  .object({
    id: z.string().min(1).max(128),
    name: z.string().max(256),
    isHidden: z.boolean(),
  })
  .passthrough();

const peopleResponseSchema = z
  .object({
    people: z.array(personSchema),
    hasNextPage: z.boolean().optional(),
    total: z.number().int().nonnegative(),
  })
  .passthrough();

const assetSchema = z
  .object({
    id: z.string().min(1).max(128),
    type: z.literal('IMAGE'),
    fileCreatedAt: z.string().datetime({ offset: true }),
    isArchived: z.boolean(),
    isTrashed: z.boolean(),
    isOffline: z.boolean(),
    visibility: z.enum(['timeline', 'archive', 'hidden', 'locked']),
    people: z.array(z.object({ id: z.string().min(1).max(128) }).passthrough()),
  })
  .passthrough();

const searchResponseSchema = z
  .object({
    assets: z
      .object({
        items: z.array(assetSchema),
        nextPage: z.union([z.string(), z.number().int(), z.null()]),
        nextCursor: z.string().nullable().optional(),
      })
      .passthrough(),
  })
  .passthrough();

export interface AuthorizedImmichCaller {
  request(path: string, init: { method: 'GET' | 'POST'; body?: string; signal: AbortSignal }): Promise<Response>;
}

export interface ImageSanitizer {
  sanitize(input: Uint8Array, contentType: string, maxOutputBytes: number): Promise<{ bytes: Uint8Array; contentType: string }>;
}

export interface ImmichLimits {
  peoplePages: number;
  peoplePageSize: number;
  assetPages: number;
  assetPageSize: number;
  candidates: number;
  jsonBytes: number;
  mediaBytes: number;
  totalTimeoutMs: number;
}

const DEFAULT_LIMITS: ImmichLimits = {
  peoplePages: 4,
  peoplePageSize: 100,
  assetPages: 8,
  assetPageSize: 100,
  candidates: 96,
  jsonBytes: 1_048_576,
  mediaBytes: 5_242_880,
  totalTimeoutMs: 8_000,
};

export class ImmichHttpCaller implements AuthorizedImmichCaller {
  private readonly baseUrl: URL;

  constructor(
    baseUrl: string,
    private readonly apiKey: string,
    allowedOrigins: readonly string[],
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {
    this.baseUrl = new URL(baseUrl);
    if (!['http:', 'https:'].includes(this.baseUrl.protocol) || this.baseUrl.username || this.baseUrl.password) {
      throw new Error('Invalid Immich URL');
    }
    if (this.baseUrl.pathname !== '/' && this.baseUrl.pathname !== '') throw new Error('Invalid Immich URL path');
    if (!apiKey) throw new Error('Immich API key is required');
    const normalizedAllowed = new Set(allowedOrigins.map((origin) => new URL(origin).origin));
    if (!normalizedAllowed.has(this.baseUrl.origin)) throw new Error('Immich origin is not allowed');
  }

  async request(path: string, init: { method: 'GET' | 'POST'; body?: string; signal: AbortSignal }): Promise<Response> {
    if (!/^\/api\/[A-Za-z0-9/?=&_.%{}-]+$/.test(path)) throw new Error('Invalid Immich API path');
    const target = new URL(path, this.baseUrl);
    if (target.origin !== this.baseUrl.origin) throw new Error('Invalid Immich API origin');
    const headers: Record<string, string> = {
      accept: init.method === 'GET' ? 'application/json, image/*' : 'application/json',
      'x-api-key': this.apiKey,
    };
    if (init.method === 'POST') headers['content-type'] = 'application/json';
    return this.fetchImplementation(target, {
      method: init.method,
      body: init.body,
      signal: init.signal,
      redirect: 'error',
      headers,
    });
  }
}

export class ImmichPhotoSource implements JourneyPhotoSource {
  private readonly limits: ImmichLimits;

  constructor(
    private readonly caller: AuthorizedImmichCaller,
    private readonly subjectIdSecret: string,
    private readonly connectionId: string,
    limits: Partial<ImmichLimits> = {},
    private readonly sanitizer?: ImageSanitizer,
  ) {
    if (subjectIdSecret.length < 32) throw new Error('Subject ID secret must be at least 32 characters');
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(connectionId)) throw new Error('Invalid connection ID');
    this.limits = validateLimits({ ...DEFAULT_LIMITS, ...limits });
  }

  async resolveName(name: string): Promise<SubjectResolution> {
    const wanted = name.trim().toLocaleLowerCase();
    if (!wanted) return { kind: 'missing', subjects: [] };
    const deadline = Date.now() + this.limits.totalTimeoutMs;
    const matches: ResolvedSubject[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= this.limits.peoplePages; page += 1) {
      const response = await this.requestJson(
        `/api/people?page=${page}&size=${this.limits.peoplePageSize}&withHidden=false`,
        { method: 'GET' },
        peopleResponseSchema,
        deadline,
      );
      for (const person of response.people) {
        if (
          !person.isHidden &&
          person.name.trim().toLocaleLowerCase() === wanted &&
          !seen.has(person.id)
        ) {
          seen.add(person.id);
          matches.push({
            option: { id: this.opaqueId('person', person.id), label: person.name.trim() },
            sourceId: person.id,
          });
        }
      }

      if (response.hasNextPage === false) break;
      if (response.hasNextPage === undefined && response.people.length < this.limits.peoplePageSize) break;
      if (response.hasNextPage !== true) throw upstreamInvalid();
      if (page === this.limits.peoplePages) {
        throw new AppError(502, 'IMMICH_PEOPLE_LIMIT', 'Person lookup incomplete');
      }
    }

    if (matches.length === 0) return { kind: 'missing', subjects: [] };
    if (matches.length === 1) return { kind: 'exact', subjects: [matches[0]!] };
    return { kind: 'ambiguous', subjects: matches };
  }

  async discover(subject: ResolvedSubject, request: PreviewRequest): Promise<DiscoveryResult> {
    if (subject.option.id !== this.opaqueId('person', subject.sourceId)) throw upstreamInvalid();
    const deadline = Date.now() + this.limits.totalTimeoutMs;
    const memories: FrozenMemory[] = [];
    const seen = new Set<string>();
    let scanned = 0;
    let incomplete = false;

    for (let page = 1; page <= this.limits.assetPages; page += 1) {
      const body = {
        personIds: [subject.sourceId],
        type: 'IMAGE',
        visibility: 'timeline',
        withDeleted: false,
        withExif: false,
        withPeople: true,
        order: 'asc',
        page,
        size: this.limits.assetPageSize,
        ...(request.fromDate ? { takenAfter: `${request.fromDate}T00:00:00.000Z` } : {}),
        ...(request.toDate ? { takenBefore: `${request.toDate}T23:59:59.999Z` } : {}),
      };
      const response = await this.requestJson(
        '/api/search/metadata',
        { method: 'POST', body: JSON.stringify(body) },
        searchResponseSchema,
        deadline,
      );
      const assets = response.assets;
      scanned += assets.items.length;
      for (const asset of assets.items) {
        if (seen.has(asset.id)) continue;
        seen.add(asset.id);
        const date = eligibleDate(asset, subject.sourceId, request);
        if (!date) continue;
        memories.push({
          id: this.opaqueId('asset', asset.id),
          date,
          ageYears: wholeYearsAt(request.birthDate, date),
          label: `Memory ${memories.length + 1}`,
          source: { kind: 'immich', assetId: asset.id, personId: subject.sourceId },
        });
        if (memories.length === this.limits.candidates) {
          incomplete = assets.nextPage !== null || assets.items.at(-1)?.id !== asset.id;
          return { memories: sortedMemories(memories), scanned, incomplete };
        }
      }

      const nextPage = parseNextPage(assets.nextPage, page);
      if (assets.nextCursor) throw upstreamInvalid();
      if (nextPage === null) break;
      if (page === this.limits.assetPages) {
        incomplete = true;
        break;
      }
    }
    return { memories: sortedMemories(memories), scanned, incomplete };
  }

  async fetchMedia(memory: FrozenMemory): Promise<{ bytes: Uint8Array; contentType: string }> {
    if (memory.source.kind !== 'immich') throw new AppError(404, 'MEDIA_NOT_FOUND', 'Media not found');
    if (!this.sanitizer) throw new AppError(503, 'MEDIA_SANITIZER_REQUIRED', 'Media unavailable');
    const deadline = Date.now() + this.limits.totalTimeoutMs;
    const asset = await this.requestJson(
      `/api/assets/${encodeURIComponent(memory.source.assetId)}`,
      { method: 'GET' },
      assetSchema,
      deadline,
    );
    const date = eligibleDate(asset, memory.source.personId, {
      birthDate: memory.date,
      fromDate: memory.date,
      toDate: memory.date,
    });
    if (!date || asset.id !== memory.source.assetId) {
      throw new AppError(404, 'MEDIA_REVOKED', 'Media unavailable');
    }

    const response = await this.call(
      `/api/assets/${encodeURIComponent(memory.source.assetId)}/thumbnail?size=preview`,
      { method: 'GET' },
      deadline,
    );
    if (!response.ok) throw upstreamUnavailable();
    const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.toLowerCase() ?? '';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) throw upstreamInvalid();
    const raw = await readLimited(response, this.limits.mediaBytes);
    validateImageSignature(raw, contentType);
    const sanitized = await this.sanitizer.sanitize(raw, contentType, this.limits.mediaBytes);
    if (sanitized.bytes.byteLength > this.limits.mediaBytes) throw upstreamInvalid();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(sanitized.contentType)) throw upstreamInvalid();
    validateImageSignature(sanitized.bytes, sanitized.contentType);
    return sanitized;
  }

  private opaqueId(kind: 'person' | 'asset', sourceId: string): string {
    return `${kind}-${createHmac('sha256', this.subjectIdSecret).update(`${this.connectionId}:${kind}:${sourceId}`).digest('hex').slice(0, 32)}`;
  }

  private async requestJson<T>(
    path: string,
    init: { method: 'GET' | 'POST'; body?: string },
    schema: z.ZodType<T>,
    deadline: number,
  ): Promise<T> {
    const response = await this.call(path, init, deadline);
    if (!response.ok) throw upstreamUnavailable();
    const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.toLowerCase();
    if (contentType !== 'application/json') throw upstreamInvalid();
    const bytes = await readLimited(response, this.limits.jsonBytes);
    let value: unknown;
    try {
      value = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw upstreamInvalid();
    }
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw upstreamInvalid();
    return parsed.data;
  }

  private async call(
    path: string,
    init: { method: 'GET' | 'POST'; body?: string },
    deadline: number,
  ): Promise<Response> {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw upstreamUnavailable();
    try {
      return await this.caller.request(path, { ...init, signal: AbortSignal.timeout(remaining) });
    } catch {
      throw upstreamUnavailable();
    }
  }
}

function eligibleDate(
  asset: z.infer<typeof assetSchema>,
  personId: string,
  request: Pick<PreviewRequest, 'birthDate' | 'fromDate' | 'toDate'>,
): string | null {
  if (
    asset.type !== 'IMAGE' ||
    asset.isArchived ||
    asset.isTrashed ||
    asset.isOffline ||
    asset.visibility !== 'timeline' ||
    !asset.people.some((person) => person.id === personId)
  ) {
    return null;
  }
  const instant = new Date(asset.fileCreatedAt);
  if (Number.isNaN(instant.valueOf())) return null;
  const date = instant.toISOString().slice(0, 10);
  if (request.fromDate && date < request.fromDate) return null;
  if (request.toDate && date > request.toDate) return null;
  try {
    wholeYearsAt(request.birthDate, date);
  } catch {
    return null;
  }
  return date;
}

function parseNextPage(value: string | number | null, current: number): number | null {
  if (value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed !== current + 1) throw upstreamInvalid();
  return parsed;
}

async function readLimited(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) throw upstreamInvalid();
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    length += result.value.byteLength;
    if (length > maxBytes) {
      await reader.cancel();
      throw upstreamInvalid();
    }
    chunks.push(result.value);
  }
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function validateImageSignature(bytes: Uint8Array, contentType: string): void {
  const matches =
    (contentType === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9) ||
    (contentType === 'image/png' && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) ||
    (contentType === 'image/webp' && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP');
  if (!matches) throw upstreamInvalid();
}

function sortedMemories(memories: FrozenMemory[]): FrozenMemory[] {
  return memories.sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
}

function validateLimits(limits: ImmichLimits): ImmichLimits {
  for (const value of Object.values(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid Immich limit');
  }
  if (limits.peoplePages > 20 || limits.assetPages > 20 || limits.peoplePageSize > 500 || limits.assetPageSize > 500 || limits.candidates > 240) {
    throw new Error('Immich limit exceeds hard cap');
  }
  return limits;
}

function upstreamInvalid(): AppError {
  return new AppError(502, 'IMMICH_RESPONSE_INVALID', 'Photo service response invalid');
}

function upstreamUnavailable(): AppError {
  return new AppError(502, 'IMMICH_UNAVAILABLE', 'Photo service unavailable');
}
