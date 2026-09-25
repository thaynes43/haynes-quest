import { describe, expect, it } from 'vitest';
import { ImmichPhotoSource, type AuthorizedImmichCaller } from '../../../src/server/photos/immich.js';
import { TEST_CHILD_B } from './fake-immich.js';

const SECRET = 'synthetic-subject-id-key-with-at-least-32-bytes';
const PERSON = TEST_CHILD_B.personId;

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });
}

class CannedCaller implements AuthorizedImmichCaller {
  readonly calls: Array<{ path: string; body?: Record<string, unknown> }> = [];
  constructor(private readonly responses: unknown[]) {}
  async request(path: string, init: { method: 'GET' | 'POST'; body?: string }): Promise<Response> {
    this.calls.push({ path, ...(init.body ? { body: JSON.parse(init.body) as Record<string, unknown> } : {}) });
    const next = this.responses.shift();
    if (next === undefined) throw new Error('Unexpected request');
    return json(next);
  }
}

function asset(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: 'IMAGE',
    localDateTime: '2024-02-29T19:30:00.000Z',
    fileCreatedAt: '2024-03-01T03:30:00.000Z',
    isArchived: false,
    isTrashed: false,
    isOffline: false,
    visibility: 'timeline',
    originalFileName: 'IMG_0001.JPG',
    originalMimeType: 'image/jpeg',
    exifInfo: { exifImageWidth: 4032, exifImageHeight: 3024, orientation: '1', make: 'Synthetic Camera' },
    ...overrides,
  };
}

const request = { personId: PERSON, fromDate: '2024-02-29', toDate: '2024-03-30', page: 1, size: 50 };
const deadline = () => Date.now() + 5_000;

describe('Immich family search adapter', () => {
  it('sends bounded smart and metadata searches that over-fetch a day each side', async () => {
    const caller = new CannedCaller([
      { assets: { items: [], nextPage: null } },
      { assets: { items: [], nextPage: null } },
    ]);
    const library = new ImmichPhotoSource(caller, SECRET, 'test-connection');
    await library.search({ ...request, query: 'birthday cake' }, { deadline: deadline() });
    await library.search(request, { deadline: deadline() });
    expect(caller.calls[0]).toEqual({
      path: '/api/search/smart',
      body: {
        query: 'birthday cake',
        personIds: [PERSON],
        type: 'IMAGE',
        visibility: 'timeline',
        withDeleted: false,
        withExif: true,
        takenAfter: '2024-02-28T00:00:00.000Z',
        takenBefore: '2024-03-31T23:59:59.999Z',
        page: 1,
        size: 50,
      },
    });
    expect(caller.calls[1]).toMatchObject({
      path: '/api/search/metadata',
      body: { withPeople: true, order: 'asc', personIds: [PERSON], takenAfter: '2024-02-28T00:00:00.000Z' },
    });
    expect(caller.calls[1]!.body).not.toHaveProperty('query');
  });

  it('keeps eligible images by local date and reads framing and screenshot hints', async () => {
    const caller = new CannedCaller([{
      assets: {
        items: [
          asset('local-evening'),
          asset('rotated', { exifInfo: { exifImageWidth: 4032, exifImageHeight: 3024, orientation: '6', make: 'X' } }),
          asset('png-no-camera', { originalFileName: 'IMG_0002.PNG', originalMimeType: 'image/png', exifInfo: { make: null } }),
          asset('named-screenshot', { originalFileName: 'Screen Shot 2024-03-01.jpg' }),
          asset('outside-window', { localDateTime: '2024-02-28T23:30:00.000Z' }),
          asset('no-local-date', { localDateTime: undefined }),
          asset('archived', { visibility: 'archive' }),
          asset('trashed', { isTrashed: true }),
          asset('video', { type: 'VIDEO' }),
          asset('someone-else', { people: [{ id: 'other-person' }] }),
          asset('with-child', { people: [{ id: PERSON }, { id: 'other-person' }] }),
        ],
        nextPage: '2',
      },
    }]);
    const library = new ImmichPhotoSource(caller, SECRET, 'test-connection');
    const page = await library.search(request, { deadline: deadline() });
    expect(page.nextPage).toBe(2);
    expect(page.assets.map((entry) => entry.assetId)).toEqual([
      'local-evening', 'rotated', 'png-no-camera', 'named-screenshot', 'with-child',
    ]);
    const byId = new Map(page.assets.map((entry) => [entry.assetId, entry]));
    expect(byId.get('local-evening')).toEqual({
      assetId: 'local-evening', localDate: '2024-02-29', personIds: null, width: 4032, height: 3024, likelyScreenshot: false,
    });
    expect(byId.get('rotated')).toMatchObject({ width: 3024, height: 4032 });
    expect(byId.get('png-no-camera')!.likelyScreenshot).toBe(true);
    expect(byId.get('named-screenshot')!.likelyScreenshot).toBe(true);
    expect(byId.get('with-child')!.personIds).toEqual([PERSON, 'other-person']);
  });

  it('fails closed on cursors, oversized pages and invalid requests', async () => {
    const cursor = new ImmichPhotoSource(new CannedCaller([{ assets: { items: [], nextPage: null, nextCursor: 'abc' } }]), SECRET, 'test-connection');
    await expect(cursor.search(request, { deadline: deadline() })).rejects.toMatchObject({ code: 'IMMICH_RESPONSE_INVALID' });
    const oversized = new ImmichPhotoSource(new CannedCaller([{ assets: { items: [asset('a'), asset('b')], nextPage: null } }]), SECRET, 'test-connection');
    await expect(oversized.search({ ...request, size: 1 }, { deadline: deadline() })).rejects.toMatchObject({ code: 'IMMICH_RESPONSE_INVALID' });
    const skipped = new ImmichPhotoSource(new CannedCaller([{ assets: { items: [], nextPage: '5' } }]), SECRET, 'test-connection');
    await expect(skipped.search(request, { deadline: deadline() })).rejects.toMatchObject({ code: 'IMMICH_RESPONSE_INVALID' });
    const library = new ImmichPhotoSource(new CannedCaller([]), SECRET, 'test-connection');
    for (const bad of [
      { ...request, page: 0 },
      { ...request, size: 251 },
      { ...request, fromDate: '2024-04-01' },
      { ...request, query: '  ' },
      { ...request, fromDate: '2024-02-30' },
    ]) {
      await expect(library.search(bad, { deadline: deadline() })).rejects.toThrow(RangeError);
    }
  });

  it('returns clamped face boxes and drops degenerate ones', async () => {
    const caller = new CannedCaller([[
      { imageWidth: 1440, imageHeight: 1080, boundingBoxX1: -10, boundingBoxY1: 20, boundingBoxX2: 300, boundingBoxY2: 2000, person: { id: PERSON } },
      { imageWidth: 1440, imageHeight: 1080, boundingBoxX1: 500, boundingBoxY1: 500, boundingBoxX2: 500, boundingBoxY2: 600, person: null },
      { imageWidth: 1440, imageHeight: 1080, boundingBoxX1: 700, boundingBoxY1: 100, boundingBoxX2: 800, boundingBoxY2: 220, person: null },
    ]]);
    const library = new ImmichPhotoSource(caller, SECRET, 'test-connection');
    expect(await library.faces('asset-with-faces', { deadline: deadline() })).toEqual([
      { personId: PERSON, imageWidth: 1440, imageHeight: 1080, x1: 0, y1: 20, x2: 300, y2: 1080 },
      { personId: null, imageWidth: 1440, imageHeight: 1080, x1: 700, y1: 100, x2: 800, y2: 220 },
    ]);
    expect(caller.calls[0]!.path).toBe('/api/faces?id=asset-with-faces');
  });

  it('derives a stable opaque asset reference that hides the upstream id', () => {
    const library = new ImmichPhotoSource(new CannedCaller([]), SECRET, 'test-connection');
    const ref = library.opaqueAssetRef('10000000-0000-4000-8000-000000000001');
    expect(ref).toMatch(/^asset-[a-f0-9]{32}$/);
    expect(library.opaqueAssetRef('10000000-0000-4000-8000-000000000001')).toBe(ref);
    expect(new ImmichPhotoSource(new CannedCaller([]), SECRET, 'other-connection')
      .opaqueAssetRef('10000000-0000-4000-8000-000000000001')).not.toBe(ref);
  });

  it('reports people with a valid entered birthday only', async () => {
    const caller = new CannedCaller([{
      people: [
        { id: PERSON, name: 'Test Child B', isHidden: false, birthDate: '2020-02-29' },
        { id: 'p2', name: 'Test Child B', isHidden: false, birthDate: '2020-02-30' },
        { id: 'p3', name: 'Test Child B', isHidden: false },
      ],
      total: 3,
      hasNextPage: false,
    }]);
    const library = new ImmichPhotoSource(caller, SECRET, 'test-connection');
    const people = await library.findPeople('Test Child B', { deadline: deadline() });
    expect(people.map((person) => person.birthDate)).toEqual(['2020-02-29', null, null]);
    expect(people.every((person) => /^person-[a-f0-9]{32}$/.test(person.option.id))).toBe(true);
  });
});
