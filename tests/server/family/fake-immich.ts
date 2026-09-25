/**
 * A synthetic Immich for family-journey tests. It speaks the same HTTP shapes
 * the real server does (people, metadata/smart search, faces) behind the
 * `AuthorizedImmichCaller` boundary, so tests exercise the real request and
 * parsing code. Every person, date and photo here is fictional.
 */
import type { AuthorizedImmichCaller } from '../../../src/server/photos/immich.js';
import type { PickClock } from '../../../src/server/family/pick.js';

export const TEST_CHILD_B = {
  personId: '00000000-0000-4000-8000-00000000000b',
  name: 'Test Child B',
  birthDate: '2020-02-29',
} as const;

export const TEST_CHILD_A = {
  personId: '00000000-0000-4000-8000-00000000000a',
  name: 'Test Child A',
  birthDate: '2016-02-29',
} as const;

export const TEST_ADULT = '00000000-0000-4000-8000-0000000000ad';

export interface FakePerson {
  id: string;
  name: string;
  birthDate?: string | null;
  isHidden?: boolean;
}

export interface FakeFace {
  personId: string | null;
  box: [number, number, number, number];
}

export interface FakeAsset {
  id: string;
  /** Local wall-clock time, Immich style (encoded with a Z suffix). */
  localDateTime: string;
  /** UTC instant; defaults to `localDateTime`. */
  fileCreatedAt?: string;
  people: string[];
  faces?: FakeFace[];
  width?: number;
  height?: number;
  tags?: string[];
  fileName?: string;
  mimeType?: string;
  make?: string | null;
  type?: 'IMAGE' | 'VIDEO';
  visibility?: 'timeline' | 'archive' | 'hidden' | 'locked';
  isTrashed?: boolean;
  isArchived?: boolean;
  isOffline?: boolean;
}

export interface FakeCall {
  path: string;
  method: 'GET' | 'POST';
  body?: Record<string, unknown>;
  at: number;
}

export class FakeClock implements PickClock {
  // The library turns deadlines into wall-clock abort timers, so start at now.
  time = Date.now();
  readonly sleeps: number[] = [];
  now(): number {
    return this.time;
  }
  async sleep(ms: number): Promise<void> {
    this.sleeps.push(ms);
    this.time += ms;
  }
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

export class FakeImmich implements AuthorizedImmichCaller {
  readonly calls: FakeCall[] = [];
  smartSearchFails = false;
  unavailable = false;
  /** Simulated latency per request, applied to the shared clock. */
  latencyMs = 0;

  constructor(
    readonly people: FakePerson[],
    readonly assets: FakeAsset[],
    private readonly clock?: FakeClock,
  ) {}

  async request(
    path: string,
    init: { method: 'GET' | 'POST'; body?: string; signal: AbortSignal },
  ): Promise<Response> {
    const body = init.body ? JSON.parse(init.body) as Record<string, unknown> : undefined;
    this.calls.push({ path, method: init.method, ...(body ? { body } : {}), at: this.clock?.now() ?? 0 });
    if (this.clock) this.clock.time += this.latencyMs;
    if (this.unavailable) return json({ message: 'down' }, 503);
    const url = new URL(path, 'http://immich.test');
    if (init.method === 'GET' && url.pathname === '/api/people') return this.peoplePage(url);
    if (init.method === 'POST' && url.pathname === '/api/search/metadata') return this.search(body!, false);
    if (init.method === 'POST' && url.pathname === '/api/search/smart') {
      if (this.smartSearchFails) return json({ message: 'Smart search is not enabled' }, 400);
      return this.search(body!, true);
    }
    if (init.method === 'GET' && url.pathname === '/api/faces') return this.faces(url.searchParams.get('id') ?? '');
    return json({ message: 'not found' }, 404);
  }

  searchCalls(): FakeCall[] {
    return this.calls.filter((call) => call.path.startsWith('/api/search/'));
  }

  private peoplePage(url: URL): Response {
    const page = Number(url.searchParams.get('page'));
    const size = Number(url.searchParams.get('size'));
    const visible = this.people.filter((person) => !person.isHidden);
    const items = visible.slice((page - 1) * size, page * size);
    return json({
      people: items.map((person) => ({
        id: person.id,
        name: person.name,
        isHidden: person.isHidden ?? false,
        birthDate: person.birthDate ?? null,
      })),
      total: visible.length,
      hasNextPage: page * size < visible.length,
    });
  }

  private search(body: Record<string, unknown>, smart: boolean): Response {
    const personIds = body.personIds as string[];
    const after = Date.parse(String(body.takenAfter));
    const before = Date.parse(String(body.takenBefore));
    let matches = this.assets.filter((asset) => {
      const instant = Date.parse(asset.fileCreatedAt ?? asset.localDateTime);
      return personIds.every((id) => asset.people.includes(id)) &&
        (body.type === undefined || (asset.type ?? 'IMAGE') === body.type) &&
        (body.withDeleted === true || !asset.isTrashed) &&
        instant >= after && instant <= before;
    });
    // Visibility filtering is left to the client on purpose: the adapter must
    // fail closed on whatever the server returns.
    if (smart) {
      const query = String(body.query);
      matches = [...matches].sort((left, right) =>
        Number((right.tags ?? []).includes(query)) - Number((left.tags ?? []).includes(query)) ||
        left.id.localeCompare(right.id));
    } else {
      matches = [...matches].sort((left, right) =>
        (left.fileCreatedAt ?? left.localDateTime).localeCompare(right.fileCreatedAt ?? right.localDateTime) ||
        left.id.localeCompare(right.id));
    }
    const page = Number(body.page);
    const size = Number(body.size);
    const items = matches.slice((page - 1) * size, page * size).map((asset) => this.assetDto(asset, !smart));
    return json({
      albums: { total: 0, count: 0, items: [], facets: [] },
      assets: {
        total: matches.length,
        count: items.length,
        items,
        facets: [],
        nextPage: page * size < matches.length ? String(page + 1) : null,
      },
    });
  }

  private assetDto(asset: FakeAsset, withPeople: boolean) {
    return {
      id: asset.id,
      type: asset.type ?? 'IMAGE',
      originalFileName: asset.fileName ?? `IMG_${asset.id.slice(-4)}.JPG`,
      originalMimeType: asset.mimeType ?? 'image/jpeg',
      fileCreatedAt: asset.fileCreatedAt ?? asset.localDateTime,
      localDateTime: asset.localDateTime,
      isArchived: asset.isArchived ?? false,
      isTrashed: asset.isTrashed ?? false,
      isOffline: asset.isOffline ?? false,
      visibility: asset.visibility ?? 'timeline',
      exifInfo: {
        exifImageWidth: asset.width ?? 4032,
        exifImageHeight: asset.height ?? 3024,
        orientation: '1',
        make: asset.make === undefined ? 'Synthetic Camera' : asset.make,
      },
      ...(withPeople ? { people: asset.people.map((id) => ({ id, name: 'Synthetic', faces: [] })) } : {}),
    };
  }

  private faces(assetId: string): Response {
    const asset = this.assets.find((candidate) => candidate.id === assetId);
    if (!asset) return json({ message: 'not found' }, 400);
    const width = asset.width ?? 1440;
    const height = asset.height ?? 1080;
    const faces = asset.faces ?? asset.people.map((personId, index) => ({
      personId,
      box: [100 + index * 300, 100, 260 + index * 300, 300] as [number, number, number, number],
    }));
    return json(faces.map((face, index) => ({
      id: `${assetId}-face-${index}`,
      imageWidth: width,
      imageHeight: height,
      boundingBoxX1: face.box[0],
      boundingBoxY1: face.box[1],
      boundingBoxX2: face.box[2],
      boundingBoxY2: face.box[3],
      person: face.personId ? { id: face.personId, name: 'Synthetic' } : null,
      sourceType: 'machine-learning',
    })));
  }
}

let sequence = 0;
export function syntheticAssetId(): string {
  sequence += 1;
  return `10000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
}

/** Local noon on a date, Immich `localDateTime` style. */
export function localNoon(date: string): string {
  return `${date}T12:00:00.000Z`;
}

/**
 * A synthetic library for Test Child B: a birthday party on each birthday, and
 * everyday photos every 11 days with rotating memorable-moment tags. Includes
 * decoys the picker must never choose.
 */
export function syntheticLibrary(
  child: { personId: string; birthDate: string } = TEST_CHILD_B,
  options: { through?: string; gaps?: Array<[string, string]> } = {},
): FakeAsset[] {
  const through = options.through ?? '2026-09-20';
  const assets: FakeAsset[] = [];
  const tags = ['child playing outside', 'holiday', 'halloween costume', 'christmas morning', 'beach', 'first day of school', 'playground', 'swimming'];
  const inGap = (date: string) => (options.gaps ?? []).some(([from, to]) => date >= from && date <= to);
  const start = Date.parse(`${child.birthDate}T00:00:00.000Z`);
  let index = 0;
  for (let time = start + 3 * 86_400_000; ; time += 11 * 86_400_000) {
    const date = new Date(time).toISOString().slice(0, 10);
    if (date > through) break;
    index += 1;
    if (inGap(date)) continue;
    const crowd = index % 4 === 0;
    assets.push({
      id: syntheticAssetId(),
      localDateTime: localNoon(date),
      people: crowd ? [child.personId, TEST_ADULT] : [child.personId],
      faces: crowd
        ? [{ personId: child.personId, box: [100, 100, 250, 260] }, { personId: TEST_ADULT, box: [600, 120, 760, 300] }, { personId: null, box: [900, 100, 1000, 220] }]
        : [{ personId: child.personId, box: [400, 200, 700 + (index % 3) * 60, 560] }],
      width: index % 5 === 0 ? 3024 : 4032,
      height: index % 5 === 0 ? 4032 : 3024,
      tags: [tags[index % tags.length]!],
    });
  }
  const birthYear = Number(child.birthDate.slice(0, 4));
  for (let age = 1; ; age += 1) {
    const year = birthYear + age;
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const md = child.birthDate.slice(5);
    const date = md === '02-29' && !leap ? `${year}-02-28` : `${year}-${md}`;
    if (date > through) break;
    if (inGap(date)) continue;
    assets.push({
      id: syntheticAssetId(),
      localDateTime: localNoon(date),
      people: [child.personId],
      faces: [{ personId: child.personId, box: [300, 150, 800, 700] }],
      tags: ['birthday cake', 'birthday party', 'blowing out candles'],
    });
    // A crowded, portrait party photo on the same day that should lose.
    assets.push({
      id: syntheticAssetId(),
      localDateTime: localNoon(date),
      people: [child.personId, TEST_ADULT],
      faces: [{ personId: child.personId, box: [10, 10, 60, 60] }, { personId: TEST_ADULT, box: [200, 10, 400, 300] }, { personId: null, box: [500, 10, 600, 100] }],
      width: 3024,
      height: 4032,
      tags: ['birthday party'],
    });
  }
  return assets;
}
