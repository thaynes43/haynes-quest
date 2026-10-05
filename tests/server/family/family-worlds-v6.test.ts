/** Frozen friendly catalog selection and synthetic World A v5 -> v6 publication. */
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { createAdventureStateAtLevel } from '../../../src/shared/adventure.js';
import {
  FRIENDLY_CATALOG_V1,
  FRIENDLY_CATALOG_V2,
  createInitialFriendlyState,
  friendlyDefinitionsForLevel,
  friendlyDefinitionsForPlan,
  friendlyViewsForLevel,
  reduceFriendlyAction,
} from '../../../src/shared/friendly.js';
import { toSaveView, validateSaveRecord } from '../../../src/server/domain.js';
import { newFamilySave } from '../../../src/server/family/saves.js';
import { validateFamilyWorldPlan } from '../../../src/server/family/plan.js';
import { FamilyTemplateRegistry } from '../../../src/server/family/templates.js';
import { familyHarness, HARNESS_TODAY } from './harness.js';
import { TEST_CHILD_C, syntheticLibrary } from './fake-immich.js';

const ACTOR = '30000000-0000-4000-8000-000000000001';
const registry = new FamilyTemplateRegistry();

async function publish(version: 'v5' | 'v6') {
  const harness = familyHarness({
    people: [{ id: TEST_CHILD_C.personId, name: TEST_CHILD_C.name, birthDate: TEST_CHILD_C.birthDate }],
    assets: syntheticLibrary(TEST_CHILD_C),
  });
  const [person] = await harness.service.lookupPeople(TEST_CHILD_C.name);
  const child = await harness.service.createChild({
    immichName: TEST_CHILD_C.name,
    personChoiceId: person!.id,
    displayName: 'Synthetic Child C',
    birthDate: TEST_CHILD_C.birthDate,
    templateId: 'family-world-a',
    templateVersion: version,
  }, ACTOR);
  const draft = await harness.service.autoPick(child.id, ACTOR);
  expect(draft.publishable).toBe(true);
  const result = await harness.service.publish(child.id, draft.revision, randomUUID(), ACTOR);
  const publication = (await harness.familyStore.getPublication(result.publicationId))!;
  return { harness, child, draft, publication };
}

describe('family-world-a@v6 friendly catalog', () => {
  let released: Awaited<ReturnType<typeof publish>>;
  beforeAll(async () => { released = await publish('v6'); });

  it('keeps all six v1 JSON entries, all old fingerprints and the v5 source bytes', () => {
    expect(createHash('sha256').update(JSON.stringify(FRIENDLY_CATALOG_V1)).digest('hex'))
      .toBe('d4c9de7bfd8592d3ea56a00c8fe89a284f7e0779b49e8a9d30aef1b25e8fb227');
    expect(JSON.stringify(FRIENDLY_CATALOG_V2.slice(0, 6))).toBe(JSON.stringify(FRIENDLY_CATALOG_V1));
    expect(FRIENDLY_CATALOG_V1.map((entry) => entry.id)).toEqual([
      'blockling', 'signal-moth', 'buffer-baron', 'loop-dancer', 'prism-mimic', 'trendweaver',
    ]);
    expect(FRIENDLY_CATALOG_V2[6]).toEqual({
      id: 'web-slinger-helper', version: 'v001', title: 'Web-slinger Helper',
      assetId: 'web-slinger-helper', assetVersion: 'v001', chapterGroup: 0, maxHp: 4,
    });
    expect(createHash('sha1').update(readFileSync('src/shared/levels/family-world-a-v5.json')).digest('hex'))
      .toBe('b2279d9fe0857f6dd18789db2f82316e273a604f');
    expect(registry.require('family-world-a', 'v1').fingerprint)
      .toBe('b0bf1dc783d077b69765604cc6e933b779404c84686d076504cb52b844d53008');
    expect(registry.require('family-world-a', 'v4').fingerprint)
      .toBe('d743503c54e6a58ff70da15fc945925844e2fa502c816ea50754e3bd318940ac');
    const v5 = registry.require('family-world-a', 'v5');
    const v6 = registry.require('family-world-a', 'v6');
    expect(v5.friendlyCatalogVersion).toBeUndefined();
    expect(v6.friendlyCatalogVersion).toBe('friendly-catalog-v2');
    expect(v6.project).toEqual(v5.project);
    expect(v6.fingerprint).not.toBe(v5.fingerprint);
    expect(registry.require('family-world-b', 'v5').friendlyCatalogVersion).toBeUndefined();
  });

  it('pins v2 only on A v6 and changes only the A3 second friendly', () => {
    const plan = released.publication.plan;
    expect(plan).toMatchObject({
      template: { id: 'family-world-a', version: 'v6', fingerprint: registry.require('family-world-a', 'v6').fingerprint },
      friendlyCatalogVersion: 'friendly-catalog-v2',
    });
    expect(validateFamilyWorldPlan(plan, { birthDate: released.publication.birthDate, memories: released.publication.memories })).toEqual([]);
    const v5 = registry.require('family-world-a', 'v5');
    expect(plan.levels.map((level) => level.authoredLevel)).toEqual(v5.project.chapters.map((chapter) => chapter.level));
    const assigned = plan.levels.map((level) => friendlyDefinitionsForLevel(level.id, level.index, 'friendly-catalog-v2').map((entry) => entry.assetId));
    expect(assigned).toEqual([
      ['blockling', 'signal-moth', 'buffer-baron'],
      ['loop-dancer', 'prism-mimic', 'trendweaver'],
      ['blockling', 'web-slinger-helper', 'buffer-baron'],
      ['loop-dancer', 'prism-mimic', 'trendweaver'],
    ]);
    expect(friendlyDefinitionsForPlan(plan).filter((entry) => entry.assetId === 'web-slinger-helper'))
      .toHaveLength(1);
    const a3 = plan.levels[2]!;
    expect(a3.authoredLevel.anchors.friendlies['friendly-2']).toEqual(
      v5.project.chapters[2]!.level.anchors.friendlies['friendly-2'],
    );
    expect(createInitialFriendlyState(plan).catalogVersion).toBe('friendly-catalog-v2');
  });

  it('rejects removed, changed, forged and mismatched plan/sidecar pins', async () => {
    const { publication, child } = released;
    const storedChild = (await released.harness.familyStore.getChild(child.id))!;
    const valid = newFamilySave({ publication, child: storedChild, startedBy: ACTOR, now: new Date() });
    expect(validateSaveRecord(valid).friendlyState?.catalogVersion).toBe('friendly-catalog-v2');
    const nullSidecar = { ...valid, friendlyState: null };
    expect(validateSaveRecord(nullSidecar).friendlyState).toBeNull();
    const a3State = createAdventureStateAtLevel(publication.plan, 2);
    Object.assign(nullSidecar, {
      adventureState: a3State,
      recoveredIds: [...a3State.revealedMemoryIds],
      ageYears: a3State.ageYears,
      abilities: [...a3State.abilities],
      appearanceStage: a3State.appearanceStage,
    });
    expect(toSaveView(nullSidecar, new Date()).adventure?.activeLevel?.friendlies?.[1]?.assetId)
      .toBe('web-slinger-helper');
    for (const pin of [undefined, 'friendly-catalog-v1', 'friendly-catalog-v3'] as const) {
      const forged = structuredClone(publication.plan) as unknown as Record<string, unknown>;
      if (pin === undefined) delete forged.friendlyCatalogVersion;
      else forged.friendlyCatalogVersion = pin;
      expect(validateFamilyWorldPlan(forged as unknown as typeof publication.plan, {
        birthDate: publication.birthDate, memories: publication.memories,
      })).toContain('plan.template');
      expect(() => validateSaveRecord({ ...valid, adventurePlan: forged as unknown as typeof publication.plan }))
        .toThrow(expect.objectContaining({ code: 'SAVE_DATA_INVALID' }));
    }
    const wrongSidecar = structuredClone(valid.friendlyState)!;
    wrongSidecar.catalogVersion = 'friendly-catalog-v1';
    expect(() => validateSaveRecord({ ...valid, friendlyState: wrongSidecar }))
      .toThrow(expect.objectContaining({ code: 'SAVE_DATA_INVALID' }));
    const mixed = structuredClone(valid.friendlyState)!;
    const helperId = Object.keys(mixed.friendlies).find((id) => id.endsWith('web-slinger-helper'))!;
    delete mixed.friendlies[helperId];
    mixed.friendlies[helperId.replace('web-slinger-helper', 'signal-moth')] = {
      hp: 4, defeated: false, boonClaimed: false, penaltyActive: false,
    };
    expect(() => validateSaveRecord({ ...valid, friendlyState: mixed }))
      .toThrow(expect.objectContaining({ code: 'SAVE_DATA_INVALID' }));
    const old = registry.require('family-world-a', 'v5');
    expect(validateFamilyWorldPlan({ ...publication.plan, template: {
      id: old.id, version: old.version, fingerprint: old.fingerprint,
    } }, { birthDate: publication.birthDate, memories: publication.memories })).toContain('plan.template');
    const b = registry.require('family-world-b', 'v5');
    expect(validateFamilyWorldPlan({ ...publication.plan, template: {
      id: b.id, version: b.version, fingerprint: b.fingerprint,
    } }, { birthDate: publication.birthDate, memories: publication.memories })).toContain('plan.template');
  });

  it('uses the existing healing, harm, amends and cooldown rules without changing boss progress', () => {
    const plan = released.publication.plan;
    const level = plan.levels[2]!;
    const helper = friendlyDefinitionsForLevel(level.id, 2, 'friendly-catalog-v2')[1]!;
    const state = createAdventureStateAtLevel(plan, 2);
    const sidecar = createInitialFriendlyState(plan);
    const fullHealth = () => reduceFriendlyAction(plan, state, sidecar, {
      type: 'interact-friendly', levelId: level.id, friendlyId: helper.id,
    }, 1_000);
    expect(fullHealth).toThrow(expect.objectContaining({ code: 'FRIENDLY_HELP_NOT_NEEDED' }));
    expect(sidecar.friendlies[helper.id]!.boonClaimed).toBe(false);
    state.playerHp = 1;
    const weapon = level.pickups.find((pickup) => pickup.kind === 'attack-tool')!;
    state.inventoryIds.push(weapon.id);
    state.equippedId = weapon.id;
    const attacked = reduceFriendlyAction(plan, state, sidecar, {
      type: 'attack-friendly', levelId: level.id, friendlyId: helper.id,
    }, 1_000);
    expect(attacked.adventureState.playerHp).toBe(1);
    expect(attacked.adventureState.encounters).toEqual(state.encounters);
    expect(attacked.friendlyState.friendlies[helper.id]).toMatchObject({ hp: 0, defeated: true, penaltyActive: true });
    const neighbor = friendlyDefinitionsForLevel(level.id, 2, 'friendly-catalog-v2')[0]!;
    expect(() => reduceFriendlyAction(plan, attacked.adventureState, attacked.friendlyState, {
      type: 'attack-friendly', levelId: level.id, friendlyId: neighbor.id,
    }, 1_000)).toThrow(expect.objectContaining({ code: 'ATTACK_COOLDOWN' }));
    expect(() => reduceFriendlyAction(plan, attacked.adventureState, attacked.friendlyState, {
      type: 'attack-friendly', levelId: level.id, friendlyId: helper.id,
    }, 1_000)).toThrow(expect.objectContaining({ code: 'FRIENDLY_NOT_ACTIVE' }));
    const amended = reduceFriendlyAction(plan, attacked.adventureState, attacked.friendlyState, {
      type: 'interact-friendly', levelId: level.id, friendlyId: helper.id,
    }, 1_000);
    expect(amended.friendlyState.friendlies[helper.id]).toEqual({ hp: 4, defeated: false, boonClaimed: false, penaltyActive: false });
    const healed = reduceFriendlyAction(plan, amended.adventureState, amended.friendlyState, {
      type: 'interact-friendly', levelId: level.id, friendlyId: helper.id,
    }, 1_000);
    expect(healed.adventureState.playerHp).toBe(3);
    expect(healed.friendlyState.friendlies[helper.id]!.boonClaimed).toBe(true);
    expect(() => reduceFriendlyAction(plan, healed.adventureState, healed.friendlyState, {
      type: 'interact-friendly', levelId: level.id, friendlyId: helper.id,
    }, 1_000)).toThrow(expect.objectContaining({ code: 'FRIENDLY_BOON_ALREADY_CLAIMED' }));
    expect(friendlyViewsForLevel(level.id, level.index, healed.friendlyState)[1]).toMatchObject({
      assetId: 'web-slinger-helper', hp: 4, boonClaimed: true,
    });
  });

  it('upgrades a v5 synthetic publication to v6 with all photos and edited captions', async () => {
    const { harness, child, draft, publication: before } = await publish('v5');
    const storedChild = (await harness.familyStore.getChild(child.id))!;
    const oldSave = newFamilySave({ publication: before, child: storedChild, startedBy: ACTOR, now: new Date() });
    expect(before.plan.friendlyCatalogVersion).toBeUndefined();
    expect(oldSave.friendlyState?.catalogVersion).toBe('friendly-catalog-v1');
    expect(validateSaveRecord({ ...oldSave, friendlyState: null }).friendlyState).toBeNull();
    expect(() => validateSaveRecord({
      ...oldSave,
      adventurePlan: { ...before.plan, friendlyCatalogVersion: 'friendly-catalog-v2' },
    })).toThrow(expect.objectContaining({ code: 'SAVE_DATA_INVALID' }));
    const edited = await harness.service.setCaption(child.id, draft.revision, 'family-a3', 'minor-one', 'Synthetic rooftop day', ACTOR);
    const upgraded = await harness.service.upgradeTemplate(child.id, {
      templateId: 'family-world-a', templateVersion: 'v6', expectedRevision: edited.revision,
    }, ACTOR);
    expect(upgraded).toMatchObject({ carried: 12, total: 12, needsPhoto: 0 });
    expect(upgraded.draft.publishable).toBe(true);
    expect(upgraded.draft.chapters[2]!.slots[0]).toMatchObject({ caption: 'Synthetic rooftop day', captionEdited: true });
    const published = await harness.service.publish(child.id, upgraded.draft.revision, randomUUID(), ACTOR);
    const after = (await harness.familyStore.getPublication(published.publicationId))!;
    expect(after.memories.map((memory) => [memory.id, memory.date, memory.source]))
      .toEqual(before.memories.map((memory) => [memory.id, memory.date, memory.source]));
    expect(after.memories.find((memory) => memory.id.includes('family-a3') && memory.id.endsWith('minor-one'))?.label)
      .toBe('Synthetic rooftop day');
    expect(after.plan.friendlyCatalogVersion).toBe('friendly-catalog-v2');
    expect(after.plan.levels.map((level) => level.authoredLevel))
      .toEqual(before.plan.levels.map((level) => level.authoredLevel));
    expect(registry.newestUpgrade('family-world-a', 'v5', TEST_CHILD_C.birthDate, HARNESS_TODAY)?.version).toBe('v9');
  });
});
