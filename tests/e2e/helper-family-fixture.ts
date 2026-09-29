/**
 * Synthetic World A v6 browser fixture, starting at Hero City's authored A3
 * entrance. Uses the real family API and frozen plan; no family media or DB.
 *
 *   QUEST_E2E_PORT=4398 pnpm tsx tests/e2e/helper-family-fixture.ts
 *   Cookie: quest_test_session=admin
 */
import { serve } from '@hono/node-server';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/server/app.js';
import { createAdventureStateAtLevel } from '../../src/shared/adventure.js';
import { validateSaveRecord } from '../../src/server/domain.js';
import { newFamilySave } from '../../src/server/family/saves.js';
import { FamilyTemplateRegistry } from '../../src/server/family/templates.js';
import { ADMIN, fakeFamilyAuth, familyHarness, HARNESS_TODAY } from '../server/family/harness.js';
import { TEST_CHILD_C, syntheticLibrary } from '../server/family/fake-immich.js';

const port = Number(process.env.QUEST_E2E_PORT ?? 4398);
const origin = `http://127.0.0.1:${port}`;
const harness = familyHarness({
  people: [{ id: TEST_CHILD_C.personId, name: TEST_CHILD_C.name, birthDate: TEST_CHILD_C.birthDate }],
  assets: syntheticLibrary(TEST_CHILD_C),
});
const [person] = await harness.service.lookupPeople(TEST_CHILD_C.name);
const child = await harness.service.createChild({
  immichName: TEST_CHILD_C.name,
  personChoiceId: person!.id,
  displayName: 'Web helper synthetic',
  birthDate: TEST_CHILD_C.birthDate,
  templateId: 'family-world-a',
  templateVersion: 'v6',
}, ADMIN.id);
const draft = await harness.service.autoPick(child.id, ADMIN.id);
if (!draft.publishable) throw new Error('Synthetic A3 draft is not publishable');
const published = await harness.service.publish(child.id, draft.revision, randomUUID(), ADMIN.id);
const publication = (await harness.familyStore.getPublication(published.publicationId))!;
const storedChild = (await harness.familyStore.getChild(child.id))!;
const save = newFamilySave({ publication, child: storedChild, startedBy: ADMIN.id, now: new Date() });
const state = createAdventureStateAtLevel(publication.plan, 2);
Object.assign(save, {
  adventureState: state,
  ageYears: state.ageYears,
  abilities: [...state.abilities],
  appearanceStage: state.appearanceStage,
  recoveredIds: [...state.revealedMemoryIds],
});
validateSaveRecord(save);
await harness.questStore.startFamilySave({ childId: child.id, fresh: false, save });

const app = createApp({
  store: harness.questStore,
  fixtureMode: false,
  sessionSecret: 'synthetic-session-secret-with-32-plus-chars',
  appOrigin: origin,
  clientDir: 'dist/client',
  studioDir: 'site',
  familyAuth: fakeFamilyAuth({ admin: ADMIN }),
  family: {
    store: harness.familyStore,
    templates: new FamilyTemplateRegistry(),
    service: harness.service,
    jobs: harness.jobs,
    today: () => HARNESS_TODAY,
  },
  privateMedia: harness.library,
});
serve({ fetch: app.fetch, hostname: '127.0.0.1', port });
console.log(`Synthetic Web helper A3 ready: ${origin} save=${save.id} title=${save.title}`);
