import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  applyGameplayActionToSave,
  canAccessSaveMemory,
  toSaveView,
  validateSaveRecord,
  type SaveRecord,
} from '../../../src/server/domain.js';
import { familyWorldView, newFamilySave } from '../../../src/server/family/saves.js';
import { ADMIN, familyHarness } from './harness.js';
import { TEST_CHILD_B } from './fake-immich.js';

async function published() {
  const harness = familyHarness();
  const [person] = await harness.service.lookupPeople(TEST_CHILD_B.name);
  const child = await harness.service.createChild({
    immichName: TEST_CHILD_B.name,
    personChoiceId: person!.id,
    displayName: 'Test Child B',
    birthDate: TEST_CHILD_B.birthDate,
    templateId: 'rat-casino-world',
    templateVersion: 'v2',
  }, ADMIN.id);
  const draft = await harness.service.autoPick(child.id, ADMIN.id);
  const summary = await harness.service.publish(child.id, draft.revision, randomUUID(), ADMIN.id);
  const publication = (await harness.familyStore.getPublication(summary.publicationId))!;
  const record = (await harness.familyStore.getChild(child.id))!;
  return { harness, publication, child: record };
}

describe('family saves (DESIGN-024 D-02, D-07)', () => {
  it('starts a validated household run from a publication', async () => {
    const { harness, publication, child } = await published();
    const save = newFamilySave({ publication, child, startedBy: ADMIN.id, now: new Date() });
    expect(save).toMatchObject({
      previewId: null,
      publicationId: publication.id,
      childId: child.id,
      ageYears: 0,
      abilities: ['move', 'interact', 'jump'],
      appearanceStage: 'infant',
      versions: publication.versions,
    });
    const view = toSaveView(save, new Date());
    const serialized = JSON.stringify([view, familyWorldView(save)]);
    expect(serialized).not.toContain(TEST_CHILD_B.personId);
    for (const asset of harness.assets) expect(serialized).not.toContain(asset.id);
    expect(view.memories.every((memory) => !('source' in memory))).toBe(true);
    // The leap-day big memory keeps its family-rule age.
    expect(view.memories.find((memory) => memory.id === 'chapter-2-route-memory-major'))
      .toMatchObject({ date: '2025-02-28', ageYears: 5, label: 'Turning 5!' });
  });

  it('grants the frozen ladder when a chapter completes', async () => {
    const { publication, child } = await published();
    let save: SaveRecord = newFamilySave({ publication, child, startedBy: ADMIN.id, now: new Date(1_000) });
    const level = save.adventurePlan!.levels[0]!;
    if (!('minorMemoryIds' in level)) throw new Error('Expected a route-memory level');
    let time = 2_000;
    const act = (action: Parameters<typeof applyGameplayActionToSave>[1]['action']) => {
      save = applyGameplayActionToSave(save, { actionId: randomUUID(), expectedRevision: save.revision, action }, new Date(time)).save;
      time += 1_000;
    };
    act({ type: 'collect-equipment', levelId: level.id, pickupId: level.pickups[0]!.pickupId });
    expect(canAccessSaveMemory(save, level.minorMemoryIds[0])).toBe(true);
    expect(canAccessSaveMemory(save, level.majorMemoryId)).toBe(false);
    for (const memoryId of level.minorMemoryIds) act({ type: 'recover-memory', levelId: level.id, memoryId });
    while (!save.adventureState!.encounters[level.bossId]!.defeated) {
      act({ type: 'attack', levelId: level.id, encounterId: level.bossId });
    }
    act({ type: 'recover-memory', levelId: level.id, memoryId: level.majorMemoryId });
    expect(save).toMatchObject({
      ageYears: 4,
      appearanceStage: 'child',
      abilities: ['move', 'interact', 'jump', 'high-jump', 'double-jump'],
    });
    expect(validateSaveRecord(save)).toMatchObject({ revision: save.revision });
  });

  it('accepts a family plan only through a publication and only untampered', async () => {
    const { publication, child } = await published();
    const save = newFamilySave({ publication, child, startedBy: ADMIN.id, now: new Date() });
    const invalid = (record: SaveRecord) => expect(() => validateSaveRecord(record))
      .toThrow(expect.objectContaining({ code: 'SAVE_DATA_INVALID' }));
    invalid({ ...save, publicationId: null });
    invalid({ ...save, childId: null });
    invalid({
      ...save,
      memories: save.memories.map((memory, index) => index === 0 ? { ...memory, label: 'Changed' } : memory),
    });
    const plan = structuredClone(save.adventurePlan!) as unknown as { levels: Array<{ memorySlots: Array<{ date: string }> }> };
    plan.levels[1]!.memorySlots[0]!.date = '2024-01-01';
    invalid({ ...save, adventurePlan: plan as unknown as SaveRecord['adventurePlan'] });
    invalid({ ...save, versions: { ...save.versions, age: 'birth-date-whole-years-v1' } });
  });
});
