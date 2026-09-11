import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/server/errors.js';
import {
  ImmichHttpCaller,
  ImmichPhotoSource,
  type AuthorizedImmichCaller,
  type ImageSanitizer,
} from '../../src/server/photos/immich.js';

const SECRET = 'opaque-id-secret-with-at-least-thirty-two-characters';
const PERSON_A = 'person-aaaaaaaa';

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

function person(id: string, name: string, isHidden = false) {
  return { id, name, isHidden };
}

function asset(
  id: string,
  overrides: Partial<{
    type: 'IMAGE'; fileCreatedAt: string; isArchived: boolean; isTrashed: boolean;
    isOffline: boolean; visibility: 'timeline' | 'archive' | 'hidden' | 'locked'; people: { id: string }[];
  }> = {},
) {
  return {
    id,
    type: 'IMAGE' as const,
    fileCreatedAt: '2024-01-01T12:00:00.000Z',
    isArchived: false,
    isTrashed: false,
    isOffline: false,
    visibility: 'timeline' as const,
    people: [{ id: PERSON_A }],
    ...overrides,
  };
}

class QueueCaller implements AuthorizedImmichCaller {
  readonly calls: { path: string; method: string; body?: string }[] = [];
  constructor(private readonly responses: Response[]) {}
  async request(path: string, init: { method: 'GET' | 'POST'; body?: string }): Promise<Response> {
    this.calls.push({ path, method: init.method, ...(init.body ? { body: init.body } : {}) });
    const response = this.responses.shift();
    if (!response) throw new Error('Unexpected request');
    return response;
  }
}

function source(caller: AuthorizedImmichCaller, sanitizer?: ImageSanitizer, limits = {}) {
  return new ImmichPhotoSource(caller, SECRET, 'test-connection', limits, sanitizer);
}

async function resolvedSubject(photoSource: ImmichPhotoSource) {
  const resolution = await photoSource.resolveName('Demo Adventurer');
  if (resolution.kind !== 'exact') throw new Error('Expected exact subject');
  return resolution.subjects[0];
}

describe('Immich photo source', () => {
  it('fails closed for a missing name without searching assets', async () => {
    const caller = new QueueCaller([json({ people: [person(PERSON_A, 'Someone Else')], total: 1, hasNextPage: false })]);
    const result = await source(caller).resolveName('Demo Adventurer');
    expect(result).toEqual({ kind: 'missing', subjects: [] });
    expect(caller.calls).toHaveLength(1);
    expect(caller.calls[0]!.path).toContain('/api/people?');
  });

  it('returns every exact duplicate as an opaque ambiguous choice', async () => {
    const caller = new QueueCaller([
      json({
        people: [person('source-id-one', 'Demo Adventurer'), person('source-id-two', 'demo adventurer')],
        total: 2,
        hasNextPage: false,
      }),
    ]);
    const result = await source(caller).resolveName(' Demo Adventurer ');
    expect(result.kind).toBe('ambiguous');
    if (result.kind !== 'ambiguous') return;
    expect(result.subjects).toHaveLength(2);
    expect(result.subjects[0]!.option.id).not.toContain('source-id-one');
    expect(result.subjects[0]!.option.id).not.toBe(result.subjects[1]!.option.id);
  });

  it('refuses to claim a complete people lookup after its page cap', async () => {
    const caller = new QueueCaller([
      json({ people: [person(PERSON_A, 'Someone Else')], total: 2, hasNextPage: true }),
    ]);
    await expect(source(caller, undefined, { peoplePages: 1, peoplePageSize: 1 }).resolveName('Demo Adventurer'))
      .rejects.toMatchObject({ code: 'IMMICH_PEOPLE_LIMIT' });
  });

  it('keeps the person/date/image filters on every page and rejects ineligible returned assets', async () => {
    const caller = new QueueCaller([
      json({ people: [person(PERSON_A, 'Demo Adventurer')], total: 1, hasNextPage: false }),
      json({
        assets: {
          items: [
            asset('eligible-1', { fileCreatedAt: '2020-07-01T12:00:00.000Z' }),
            asset('archived', { isArchived: true }),
            asset('wrong-person', { people: [{ id: 'other-person' }] }),
          ],
          nextPage: '2',
          nextCursor: null,
        },
      }),
      json({
        assets: {
          items: [asset('eligible-2', { fileCreatedAt: '2027-01-01T12:00:00.000Z' })],
          nextPage: null,
          nextCursor: null,
        },
      }),
    ]);
    const photoSource = source(caller);
    const subject = await resolvedSubject(photoSource);
    const result = await photoSource.discover(subject, {
      name: 'Demo Adventurer', birthDate: '2020-01-01', fromDate: '2020-01-01', toDate: '2028-01-01',
    });
    expect(result.memories.map((memory) => [memory.date, memory.ageYears])).toEqual([
      ['2020-07-01', 0], ['2027-01-01', 7],
    ]);
    expect(result.scanned).toBe(4);
    expect(result.memories.every((memory) => !memory.id.includes('eligible'))).toBe(true);

    const searches = caller.calls.filter((call) => call.path === '/api/search/metadata');
    expect(searches).toHaveLength(2);
    for (const call of searches) {
      expect(JSON.parse(call.body!)).toMatchObject({
        personIds: [PERSON_A], type: 'IMAGE', visibility: 'timeline', withDeleted: false, withPeople: true,
      });
    }
  });

  it('marks discovery incomplete at the asset page cap and rejects malformed pagination', async () => {
    const cappedCaller = new QueueCaller([
      json({ people: [person(PERSON_A, 'Demo Adventurer')], total: 1, hasNextPage: false }),
      json({ assets: { items: [asset('first')], nextPage: 2, nextCursor: null } }),
    ]);
    const cappedSource = source(cappedCaller, undefined, { assetPages: 1, assetPageSize: 1 });
    const capped = await cappedSource.discover(await resolvedSubject(cappedSource), {
      name: 'Demo Adventurer', birthDate: '2020-01-01',
    });
    expect(capped.incomplete).toBe(true);

    const malformedCaller = new QueueCaller([
      json({ people: [person(PERSON_A, 'Demo Adventurer')], total: 1, hasNextPage: false }),
      json({ assets: { items: [asset('first')], nextPage: '999', nextCursor: null } }),
    ]);
    const malformedSource = source(malformedCaller);
    await expect(malformedSource.discover(await resolvedSubject(malformedSource), {
      name: 'Demo Adventurer', birthDate: '2020-01-01',
    })).rejects.toMatchObject({ code: 'IMMICH_RESPONSE_INVALID' });
  });

  it('revalidates person/date/state and sanitizes bounded media before returning it', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0x01, 0xff, 0xd9]);
    const sanitizer: ImageSanitizer = {
      sanitize: vi.fn(async (bytes, contentType) => ({ bytes, contentType })),
    };
    const caller = new QueueCaller([
      json(asset('source-asset', { fileCreatedAt: '2024-01-01T12:00:00.000Z' })),
      new Response(jpeg, { headers: { 'content-type': 'image/jpeg', 'content-length': String(jpeg.byteLength) } }),
    ]);
    const photoSource = source(caller, sanitizer);
    const memory = {
      id: 'opaque-memory', date: '2024-01-01', ageYears: 4, label: 'Memory 1',
      source: { kind: 'immich' as const, assetId: 'source-asset', personId: PERSON_A },
    };
    const result = await photoSource.fetchMedia(memory);
    expect(result.contentType).toBe('image/jpeg');
    expect(sanitizer.sanitize).toHaveBeenCalledOnce();

    const revoked = source(new QueueCaller([
      json(asset('source-asset', { isTrashed: true })),
    ]), sanitizer);
    await expect(revoked.fetchMedia(memory)).rejects.toMatchObject({ code: 'MEDIA_REVOKED' });
  });

  it('requires a sanitizer and enforces media byte limits', async () => {
    const memory = {
      id: 'opaque-memory', date: '2024-01-01', ageYears: 4, label: 'Memory 1',
      source: { kind: 'immich' as const, assetId: 'source-asset', personId: PERSON_A },
    };
    await expect(source(new QueueCaller([])).fetchMedia(memory)).rejects.toMatchObject({ code: 'MEDIA_SANITIZER_REQUIRED' });

    const caller = new QueueCaller([
      json(asset('source-asset')),
      new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), {
        headers: { 'content-type': 'image/jpeg', 'content-length': '999' },
      }),
    ]);
    const sanitizer: ImageSanitizer = { sanitize: async (bytes, contentType) => ({ bytes, contentType }) };
    await expect(source(caller, sanitizer, { mediaBytes: 4 }).fetchMedia(memory))
      .rejects.toMatchObject({ code: 'IMMICH_RESPONSE_INVALID' });
  });

  it('applies a total deadline to upstream work', async () => {
    const caller: AuthorizedImmichCaller = {
      request: async (_path, init) => new Promise<Response>((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
      }),
    };
    await expect(source(caller, undefined, { totalTimeoutMs: 5 }).resolveName('Demo Adventurer'))
      .rejects.toSatisfy((error: AppError) => error.code === 'IMMICH_UNAVAILABLE');
  });
});

describe('Immich HTTP caller', () => {
  it('pins credentials to an allowed origin and rejects non-API destinations', async () => {
    expect(() => new ImmichHttpCaller('http://immich.internal', 'key', ['https://other.internal']))
      .toThrow('not allowed');
    let captured: { url: string; init: RequestInit | undefined } | undefined;
    const fetchImplementation: typeof fetch = async (input, init) => {
      captured = { url: String(input), init };
      return json({ ok: true });
    };
    const caller = new ImmichHttpCaller('http://immich.internal', 'key', ['http://immich.internal'], fetchImplementation);
    await expect(caller.request('https://metadata.invalid/latest', { method: 'GET', signal: AbortSignal.timeout(100) }))
      .rejects.toThrow('Invalid Immich API path');
    await caller.request('/api/people?page=1', { method: 'GET', signal: AbortSignal.timeout(100) });
    expect(captured?.url).toBe('http://immich.internal/api/people?page=1');
    expect(new Headers(captured?.init?.headers).get('x-api-key')).toBe('key');
    expect(captured?.init?.redirect).toBe('error');
  });
});
