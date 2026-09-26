import { describe, expect, it } from 'vitest';
import ratCasinoWorldV2 from '../../../src/shared/levels/rat-casino-world-v2.json';
import { parseLevelEditorProject, type LevelEditorProjectV2 } from '../../../src/shared/editor-project.js';
import { ImmichPhotoSource } from '../../../src/server/photos/immich.js';
import {
  autoPickChapters,
  autoPickJourney,
  bigMemoryWindows,
  littleMemoryWindows,
  manualSlotWindow,
  suggestForSlot,
  type SlotOutcome,
} from '../../../src/server/family/pick.js';
import { rebaseWorldForChild } from '../../../src/server/family/rebase.js';
import {
  FakeClock,
  FakeImmich,
  TEST_ADULT,
  TEST_CHILD_B,
  localNoon,
  syntheticAssetId,
  syntheticLibrary,
  type FakeAsset,
} from './fake-immich.js';

const SECRET = 'synthetic-subject-id-key-with-at-least-32-bytes';
const TODAY = '2026-09-25';
const template = parseLevelEditorProject(ratCasinoWorldV2) as LevelEditorProjectV2;
const world = rebaseWorldForChild(template, TEST_CHILD_B.birthDate, TODAY);

function setup(assets: FakeAsset[] = syntheticLibrary()) {
  const clock = new FakeClock();
  const immich = new FakeImmich([
    { id: TEST_CHILD_B.personId, name: TEST_CHILD_B.name, birthDate: TEST_CHILD_B.birthDate },
  ], assets, clock);
  const library = new ImmichPhotoSource(immich, SECRET, 'test-connection');
  return { clock, immich, library, assets };
}

async function pickAll(context: ReturnType<typeof setup>, seed = 'synthetic-seed-0001') {
  return autoPickJourney({
    chapters: world.chapters,
    birthDate: TEST_CHILD_B.birthDate,
    today: TODAY,
    personId: TEST_CHILD_B.personId,
    seed,
  }, { library: context.library, clock: context.clock });
}

function outcome(outcomes: SlotOutcome[], chapterId: string, slot: string): SlotOutcome {
  return outcomes.find((entry) => entry.chapterId === chapterId && entry.slot === slot)!;
}

describe('pick windows (DESIGN-024 D-04)', () => {
  it('bounds the big memory to the birthday plus 30 days, widened once', () => {
    expect(bigMemoryWindows(world.chapters, 0, TEST_CHILD_B.birthDate, TODAY)).toEqual({
      target: '2024-02-29',
      preferred: { from: '2024-02-29', to: '2024-03-30' },
      widened: { from: '2024-02-29', to: '2024-05-29' },
    });
    // The final chapter's window is the most recent birthday, never past today.
    expect(bigMemoryWindows(world.chapters, 2, TEST_CHILD_B.birthDate, '2026-03-10')).toEqual({
      target: '2026-02-28',
      preferred: { from: '2026-02-28', to: '2026-03-10' },
      widened: null,
    });
  });

  it('aims little memories at the ⅓ and ⅔ points ± 20% of the chapter', () => {
    const chapter = world.chapters[1]!; // 2024-02-29 → 2025-02-28, 365 days
    expect(littleMemoryWindows(chapter, 'minor-one', '2024-03-02', null)).toEqual({
      target: '2024-06-30',
      preferred: { from: '2024-04-18', to: '2024-09-11' },
      widened: { from: '2024-03-03', to: '2025-02-27' },
    });
    expect(littleMemoryWindows(chapter, 'minor-two', '2024-03-02', '2024-06-01')).toEqual({
      target: '2024-10-29',
      preferred: { from: '2024-08-17', to: '2025-01-10' },
      widened: { from: '2024-06-02', to: '2025-02-27' },
    });
  });

  it('keeps manual choices chronological against the chosen neighbours', () => {
    const chosen: Record<string, string> = {
      'chapter-1:major': '2024-03-04',
      'chapter-2:minor-one': '2024-05-01',
      'chapter-2:minor-two': '2024-11-01',
    };
    const lookup = (chapterId: string, slot: string) => chosen[`${chapterId}:${slot}`] ?? null;
    expect(manualSlotWindow(world.chapters, 1, 'minor-one', lookup, TEST_CHILD_B.birthDate, TODAY))
      .toEqual({ from: '2024-03-05', to: '2024-10-31' });
    expect(manualSlotWindow(world.chapters, 0, 'major', lookup, TEST_CHILD_B.birthDate, TODAY))
      .toEqual({ from: '2024-02-29', to: '2024-04-30' });
  });
});

describe('automatic picks against a fake Immich (DESIGN-024 D-04)', () => {
  it('fills every slot with an eligible, chronological, well-framed photo', async () => {
    const context = setup();
    const outcomes = await pickAll(context);
    expect(outcomes).toHaveLength(9);
    expect(outcomes.every((entry) => entry.photo !== null)).toBe(true);
    const byId = new Map(context.assets.map((asset) => [asset.id, asset]));
    let priorBig = '';
    for (const chapter of world.chapters) {
      const minorOne = outcome(outcomes, chapter.chapterId, 'minor-one').photo!;
      const minorTwo = outcome(outcomes, chapter.chapterId, 'minor-two').photo!;
      const major = outcome(outcomes, chapter.chapterId, 'major').photo!;
      // The big memory: the birthday itself, the solo landscape party photo.
      expect(major.localDate).toBe(chapter.targetDate);
      expect(byId.get(major.assetId)!.people).toEqual([TEST_CHILD_B.personId]);
      expect(major.reason).toMatchObject({ source: 'auto', window: 'preferred', query: 'birthday cake', faces: 1 });
      // Little memories: inside the chapter, after the previous big memory,
      // on different days and months.
      expect(minorOne.localDate > chapter.startDate).toBe(true);
      expect(minorOne.localDate > priorBig).toBe(true);
      expect(minorTwo.localDate > minorOne.localDate).toBe(true);
      expect(minorTwo.localDate < chapter.targetDate).toBe(true);
      expect(minorTwo.localDate.slice(0, 7)).not.toBe(minorOne.localDate.slice(0, 7));
      priorBig = major.localDate;
    }
    const assetIds = outcomes.map((entry) => entry.photo!.assetId);
    expect(new Set(assetIds).size).toBe(9);
    // Reasons carry scores and generic query text only.
    const reasons = JSON.stringify(outcomes.map((entry) => entry.photo!.reason));
    for (const id of [...assetIds, TEST_CHILD_B.personId]) expect(reasons).not.toContain(id);
  });

  it('is deterministic for a given seed', async () => {
    const assets = syntheticLibrary();
    const first = await pickAll(setup(assets), 'synthetic-seed-0001');
    const second = await pickAll(setup(assets), 'synthetic-seed-0001');
    expect(second.map((entry) => entry.photo?.assetId)).toEqual(first.map((entry) => entry.photo?.assetId));
  });

  it('stays within 8 pages per slot with 250 ms between Immich calls', async () => {
    const context = setup();
    const outcomes = await pickAll(context);
    expect(Math.max(...outcomes.map((entry) => entry.searchedPages))).toBeLessThanOrEqual(8);
    expect(context.immich.searchCalls().length).toBe(outcomes.reduce((sum, entry) => sum + entry.searchedPages, 0));
    const times = context.immich.calls.map((call) => call.at);
    for (let index = 1; index < times.length; index += 1) {
      expect(times[index]! - times[index - 1]!).toBeGreaterThanOrEqual(250);
    }
    for (const call of context.immich.searchCalls()) {
      expect(call.body).toMatchObject({ personIds: [TEST_CHILD_B.personId], type: 'IMAGE', visibility: 'timeline' });
      expect(Number(call.body!.size)).toBeLessThanOrEqual(100);
    }
  });

  it('stops each slot at its 20 s deadline', async () => {
    const context = setup();
    context.immich.latencyMs = 4_000;
    const outcomes = await pickAll(context);
    expect(outcomes.some((entry) => entry.timedOut)).toBe(true);
    // No slot makes more calls than fit in 20 s at 4 s each (plus the one in flight).
    const perSlot = Math.ceil(20_000 / 4_250) + 1;
    expect(context.immich.calls.length).toBeLessThanOrEqual(perSlot * outcomes.length);
  });

  it('never picks screenshots, archived, trashed, video or other-person photos', async () => {
    const birthday = '2025-02-28';
    const decoy = (overrides: Partial<FakeAsset>): FakeAsset => ({
      id: syntheticAssetId(),
      localDateTime: localNoon(birthday),
      people: [TEST_CHILD_B.personId],
      faces: [{ personId: TEST_CHILD_B.personId, box: [0, 0, 1400, 1000] }],
      tags: ['birthday cake', 'birthday party', 'blowing out candles'],
      ...overrides,
    });
    const decoys = [
      decoy({ fileName: 'Screenshot 2025-02-28 at 12.00.00.png', mimeType: 'image/png', make: null }),
      decoy({ visibility: 'archive' }),
      decoy({ isTrashed: true }),
      decoy({ type: 'VIDEO' }),
      decoy({ visibility: 'hidden' }),
      decoy({ people: [TEST_ADULT], faces: [{ personId: TEST_ADULT, box: [0, 0, 1400, 1000] }] }),
    ];
    const context = setup([...decoys, ...syntheticLibrary()]);
    const outcomes = await pickAll(context);
    const picked = new Set(outcomes.map((entry) => entry.photo?.assetId));
    for (const entry of decoys) expect(picked.has(entry.id)).toBe(false);
    expect(outcome(outcomes, 'chapter-2', 'major').photo!.localDate).toBe(birthday);
  });

  it('dates photos by their local calendar day, not the UTC instant', async () => {
    const evening: FakeAsset = {
      id: syntheticAssetId(),
      // 6 pm local on the birthday; already the next day in UTC.
      localDateTime: '2025-02-28T18:00:00.000Z',
      fileCreatedAt: '2025-03-01T02:00:00.000Z',
      people: [TEST_CHILD_B.personId],
      faces: [{ personId: TEST_CHILD_B.personId, box: [300, 150, 800, 700] }],
      tags: ['birthday cake'],
    };
    const assets = syntheticLibrary(TEST_CHILD_B, { gaps: [['2025-02-28', '2025-02-28']] });
    const context = setup([evening, ...assets]);
    const outcomes = await pickAll(context);
    expect(outcome(outcomes, 'chapter-2', 'major').photo).toMatchObject({
      assetId: evening.id,
      localDate: '2025-02-28',
    });
  });

  it('widens an empty window once within the chapter', async () => {
    // Nothing near chapter 2's ⅓ point; photos exist elsewhere in the chapter.
    const context = setup(syntheticLibrary(TEST_CHILD_B, { gaps: [['2024-04-10', '2024-09-20']] }));
    const outcomes = await pickAll(context);
    const minorOne = outcome(outcomes, 'chapter-2', 'minor-one').photo!;
    expect(minorOne.reason.window).toBe('widened');
    expect(minorOne.localDate > '2024-02-29' && minorOne.localDate < '2025-02-28').toBe(true);
  });

  it('marks a slot needs-photo when the widened window is empty too', async () => {
    const context = setup(syntheticLibrary(TEST_CHILD_B, { gaps: [['2024-03-01', '2025-02-27']] }));
    const outcomes = await pickAll(context);
    for (const slot of ['minor-one', 'minor-two']) {
      const entry = outcome(outcomes, 'chapter-2', slot);
      expect(entry.photo).toBeNull();
      expect(entry.searchedPages).toBeGreaterThan(0);
      expect(entry.searchedPages).toBeLessThanOrEqual(8);
    }
    expect(outcome(outcomes, 'chapter-2', 'major').photo).not.toBeNull();
    expect(outcome(outcomes, 'rat-casino', 'minor-one').photo).not.toBeNull();
  });

  it('falls back to metadata search when smart search is unavailable', async () => {
    const context = setup();
    context.immich.smartSearchFails = true;
    const outcomes = await pickAll(context);
    expect(outcomes.every((entry) => entry.photo !== null && entry.degraded)).toBe(true);
    expect(outcome(outcomes, 'chapter-1', 'major').photo!.localDate).toBe('2024-02-29');
    const smartCalls = context.immich.searchCalls().filter((call) => call.path === '/api/search/smart');
    expect(smartCalls.length).toBe(outcomes.length);
  });

  it('surfaces an unavailable Immich as a retryable error', async () => {
    const context = setup();
    context.immich.unavailable = true;
    await expect(pickAll(context)).rejects.toMatchObject({ code: 'IMMICH_UNAVAILABLE' });
  });
});

describe('swap suggestions', () => {
  it('pages eligible photos inside the allowed window, best first', async () => {
    const context = setup();
    const range = { from: '2024-03-01', to: '2025-02-27' };
    const first = await suggestForSlot({
      personId: TEST_CHILD_B.personId,
      slot: 'minor-one',
      window: range,
      target: '2024-06-29',
      excludeAssetIds: new Set(),
      cursor: 1,
    }, { library: context.library, clock: context.clock });
    expect(first.assets.length).toBeGreaterThan(0);
    expect(first.nextCursor).toBe(2);
    expect(first.assets.every((asset) => asset.localDate >= range.from && asset.localDate <= range.to)).toBe(true);
    const second = await suggestForSlot({
      personId: TEST_CHILD_B.personId,
      slot: 'minor-one',
      window: range,
      target: '2024-06-29',
      excludeAssetIds: new Set([first.assets[0]!.assetId]),
      cursor: 2,
    }, { library: context.library, clock: context.clock });
    expect(second.assets.map((asset) => asset.assetId)).not.toContain(first.assets[0]!.assetId);
    await expect(suggestForSlot({
      personId: TEST_CHILD_B.personId,
      slot: 'minor-one',
      window: range,
      target: '2024-06-29',
      excludeAssetIds: new Set(),
      cursor: 99,
    }, { library: context.library, clock: context.clock })).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
  });
});

describe('partial picks around kept photos (DESIGN-024 D-11)', () => {
  it('picks only the named chapters, never reuses a kept photo and stays chronological around them', async () => {
    const context = setup();
    const full = await pickAll(context);
    // Keep chapter two as picked; pick the other two chapters again around it.
    const kept = new Map(full
      .filter((entry) => entry.chapterId === 'chapter-2' && entry.photo)
      .map((entry) => [`${entry.chapterId}:${entry.slot}`, { assetId: entry.photo!.assetId, localDate: entry.photo!.localDate }]));
    const partial = await autoPickChapters({
      chapters: world.chapters,
      birthDate: TEST_CHILD_B.birthDate,
      today: TODAY,
      personId: TEST_CHILD_B.personId,
      seed: 'synthetic-seed-0001',
      pickChapterIds: new Set(['chapter-1', 'rat-casino']),
      fixed: kept,
    }, { library: context.library, clock: context.clock });
    expect(partial.map((entry) => `${entry.chapterId}:${entry.slot}`)).toEqual([
      'chapter-1:minor-one', 'chapter-1:minor-two', 'chapter-1:major',
      'rat-casino:minor-one', 'rat-casino:minor-two', 'rat-casino:major',
    ]);
    const keptAssets = new Set([...kept.values()].map((entry) => entry.assetId));
    for (const entry of partial) expect(keptAssets.has(entry.photo!.assetId)).toBe(false);
    expect(outcome(partial, 'chapter-1', 'major').photo!.localDate < kept.get('chapter-2:minor-one')!.localDate).toBe(true);
    expect(outcome(partial, 'rat-casino', 'minor-one').photo!.localDate > kept.get('chapter-2:major')!.localDate).toBe(true);
    // With the same seed and library, the picked chapters match a full pick.
    for (const chapterId of ['chapter-1', 'rat-casino']) {
      for (const slot of ['minor-one', 'minor-two', 'major']) {
        expect(outcome(partial, chapterId, slot).photo).toEqual(outcome(full, chapterId, slot).photo);
      }
    }
  });
});
