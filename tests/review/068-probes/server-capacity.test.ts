import { describe, expect, it } from 'vitest';
import { InMemoryQuestStore } from '../../../src/server/db/memory-store.js';
import { makeEphemeralApp, startPlaytest, startSession } from './helpers.js';

describe('WO068 probe: ephemeral capacity lockout', () => {
  it('does not let one owner hold every save slot against other players', async () => {
    const store = InMemoryQuestStore.ephemeral({ maxSaves: 2 });
    const { app } = makeEphemeralApp(store);
    const owner = await startSession(app);
    const first = await startPlaytest(app, owner.cookie, 1);
    const second = await startPlaytest(app, owner.cookie, 1);
    expect([first.status, second.status]).toEqual([201, 201]);
    expect(first.body.id).not.toBe(second.body.id);

    // A third run by the SAME owner: superseded runs are never evicted.
    const third = await startPlaytest(app, owner.cookie, 1);
    console.log('OBSERVED third own start', third.status, JSON.stringify(third.body));

    // A different player with their own cookie is now locked out.
    const other = await startSession(app);
    const blocked = await startPlaytest(app, other.cookie, 1);
    console.log('OBSERVED other player start', blocked.status, JSON.stringify(blocked.body));

    // Maintenance is the documented reclaim path; run it with a live-session clock.
    const maintenance = await store.maintainFixtureRecords(new Date());
    const afterMaintenance = await startPlaytest(app, other.cookie, 1);
    console.log('OBSERVED maintenance', JSON.stringify(maintenance), 'then', afterMaintenance.status);

    expect({
      ownerThird: third.status,
      otherPlayer: blocked.status,
      afterMaintenance: afterMaintenance.status,
    }).toEqual({ ownerThird: 201, otherPlayer: 201, afterMaintenance: 201 });
  });

  it('reclaims the preview slot when the save that follows it fails', async () => {
    const store = InMemoryQuestStore.ephemeral({ maxSaves: 1, maxPreviews: 3 });
    const { app } = makeEphemeralApp(store);
    const owner = await startSession(app);
    expect((await startPlaytest(app, owner.cookie, 1)).status).toBe(201);
    const attempts = [
      await startPlaytest(app, owner.cookie, 1),
      await startPlaytest(app, owner.cookie, 1),
      await startPlaytest(app, owner.cookie, 1),
    ];
    console.log('OBSERVED repeated failures', attempts.map((a) => `${a.status}:${a.body.error?.code}`).join(' '));
    // Every failed start still consumed a preview slot, so the error code drifts
    // from the capacity that actually ran out.
    expect(attempts.map((a) => a.body.error?.code)).toEqual([
      'STORE_CAPACITY',
      'STORE_CAPACITY',
      'STORE_CAPACITY',
    ]);
  });
});
