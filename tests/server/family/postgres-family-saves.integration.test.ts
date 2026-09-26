import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgresQuestStore } from '../../../src/server/db/postgres-store.js';
import { toSaveView } from '../../../src/server/domain.js';
import { PostgresFamilyStore } from '../../../src/server/family/postgres-store.js';
import { newFamilySave } from '../../../src/server/family/saves.js';
import { FamilyJourneyService } from '../../../src/server/family/service.js';
import { FamilyTemplateRegistry } from '../../../src/server/family/templates.js';
import { CandidateTokens } from '../../../src/server/family/tokens.js';
import { ImmichPhotoSource } from '../../../src/server/photos/immich.js';
import { FakeClock, FakeImmich, TEST_CHILD_B, syntheticLibrary } from './fake-immich.js';
import { HARNESS_SECRET, HARNESS_TODAY } from './harness.js';

const testDatabaseUrl = process.env.QUEST_TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)('Postgres family saves', () => {
  let pool: Pool;
  let questStore: PostgresQuestStore;
  let familyStore: PostgresFamilyStore;
  let service: FamilyJourneyService;
  let admin: string;
  let member: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl, max: 6 });
    questStore = new PostgresQuestStore(pool);
    await questStore.migrate();
  });

  afterAll(async () => {
    await pool?.end();
  });

  beforeEach(async () => {
    await pool.query(
      'TRUNCATE quest_journey_publications, quest_journey_drafts, quest_children, quest_saves, quest_setup_previews, quest_fixture_sessions, quest_players RESTART IDENTITY CASCADE',
    );
    admin = randomUUID();
    member = randomUUID();
    for (const [id, label] of [[admin, 'Synthetic Admin'], [member, 'Synthetic Member']]) {
      await pool.query('INSERT INTO quest_players (id, label) VALUES ($1, $2)', [id, label]);
    }
    const clock = new FakeClock();
    familyStore = new PostgresFamilyStore(pool);
    service = new FamilyJourneyService({
      store: familyStore,
      library: new ImmichPhotoSource(new FakeImmich([
        { id: TEST_CHILD_B.personId, name: TEST_CHILD_B.name, birthDate: TEST_CHILD_B.birthDate },
      ], syntheticLibrary(), clock), HARNESS_SECRET, 'test-connection'),
      templates: new FamilyTemplateRegistry(),
      tokens: new CandidateTokens(HARNESS_SECRET, { now: () => clock.now() }),
      clock,
      today: () => HARNESS_TODAY,
    });
  });

  async function publish() {
    const [person] = await service.lookupPeople(TEST_CHILD_B.name);
    const child = await service.createChild({
      immichName: TEST_CHILD_B.name,
      personChoiceId: person!.id,
      displayName: 'Test Child B',
      birthDate: TEST_CHILD_B.birthDate,
      templateId: 'rat-casino-world',
      templateVersion: 'v2',
    }, admin);
    const draft = await service.autoPick(child.id, admin);
    const summary = await service.publish(child.id, draft.revision, randomUUID(), admin);
    return {
      child: (await familyStore.getChild(child.id))!,
      publication: (await familyStore.getPublication(summary.publicationId))!,
      draft,
    };
  }

  it('Postgres starts one household run per child even when devices race', async () => {
    const { child, publication } = await publish();
    const start = (startedBy: string) => questStore.startFamilySave({
      childId: child.id,
      fresh: false,
      save: newFamilySave({ publication, child, startedBy, now: new Date() }),
    });
    const results = await Promise.all([start(member), start(admin), start(member)]);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(results.map((result) => result.save.id)).size).toBe(1);
    const saveId = results[0]!.save.id;
    // Household access: any admitted member, never the owner-scoped fixture path.
    expect((await questStore.getHouseholdSave(saveId))!.childId).toBe(child.id);
    expect(await questStore.getSave(results[0]!.save.ownerId, saveId)).toBeNull();
    expect(await questStore.listSaves(results[0]!.save.ownerId)).toEqual([]);
    const level = results[0]!.save.adventurePlan!.levels[0]!;
    const acted = await questStore.applyHouseholdGameplayAction(saveId, {
      actionId: randomUUID(),
      expectedRevision: 0,
      action: { type: 'collect-equipment', levelId: level.id, pickupId: level.pickups[0]!.pickupId },
    }, new Date());
    expect(acted.revision).toBe(1);
    await expect(questStore.applyHouseholdGameplayAction(saveId, {
      actionId: randomUUID(),
      expectedRevision: 0,
      action: { type: 'collect-equipment', levelId: level.id, pickupId: level.pickups[1]!.pickupId },
    }, new Date())).rejects.toMatchObject({ code: 'SAVE_REVISION_STALE' });
  });

  it('Postgres keeps a started run on its publication until an administrator starts fresh', async () => {
    const { child, publication, draft } = await publish();
    const first = await questStore.startFamilySave({
      childId: child.id,
      fresh: false,
      save: newFamilySave({ publication, child, startedBy: member, now: new Date() }),
    });
    const edited = await service.setCaption(child.id, draft.revision, 'rat-casino', 'major', 'Six candles', admin);
    const second = await service.publish(child.id, edited.revision, randomUUID(), admin);
    const latest = (await familyStore.getPublication(second.publicationId))!;
    const resumed = await questStore.startFamilySave({
      childId: child.id,
      fresh: false,
      save: newFamilySave({ publication: latest, child, startedBy: member, now: new Date() }),
    });
    expect(resumed).toMatchObject({ created: false, save: { id: first.save.id, publicationId: publication.id } });
    expect(toSaveView(resumed.save, new Date()).memories.map((memory) => memory.label)).not.toContain('Six candles');
    const fresh = await questStore.startFamilySave({
      childId: child.id,
      fresh: true,
      save: newFamilySave({ publication: latest, child, startedBy: admin, now: new Date(Date.now() + 1_000) }),
    });
    expect(fresh).toMatchObject({ created: true, save: { publicationId: latest.id } });
    expect((await questStore.currentFamilySaves()).map((save) => save.id)).toEqual([fresh.save.id]);
    // Restart: the stored run reloads and revalidates.
    const restarted = new PostgresQuestStore(pool);
    expect((await restarted.getHouseholdSave(first.save.id))!.publicationId).toBe(publication.id);
  });

  it('Postgres ties a family save to its own child and publication', async () => {
    const { child, publication } = await publish();
    const save = newFamilySave({ publication, child, startedBy: member, now: new Date() });
    await expect(pool.query(
      `INSERT INTO quest_saves (id, owner_id, preview_id, publication_id, child_id, title, subject, birth_date,
         memories, abilities, appearance_stage, versions, save_format, adventure_plan, adventure_state)
       VALUES ($1, $2, NULL, $3, $4, 't', '{}', '2020-02-29', '[]', '[]', 'infant', '{}', 'era-combat-v2', '{}', '{}')`,
      [randomUUID(), member, publication.id, randomUUID()],
    )).rejects.toMatchObject({ code: '23503' });
    await expect(pool.query(
      `INSERT INTO quest_saves (id, owner_id, preview_id, publication_id, child_id, title, subject, birth_date,
         memories, abilities, appearance_stage, versions)
       VALUES ($1, $2, NULL, NULL, NULL, 't', '{}', '2020-02-29', '[]', '[]', 'infant', '{}')`,
      [randomUUID(), member],
    )).rejects.toMatchObject({ code: '23514' });
    expect(save.childId).toBe(child.id);
  });
});
