import { EventEmitter } from 'node:events';
import type { ClientBase } from 'pg';
import { describe, expect, it } from 'vitest';
import { createDatabasePool } from '../../src/server/db/pool.js';
import { PostgresQuestStore } from '../../src/server/db/postgres-store.js';
import { PostgresFamilyStore } from '../../src/server/family/postgres-store.js';
import type { SafeDiagnostic } from '../../src/server/diagnostics.js';

/** A pg client stand-in: connects at once and never touches the network. */
class FakeClient extends EventEmitter {
  static created: FakeClient[] = [];
  _queryable = true;
  _ending = false;

  constructor() {
    super();
    FakeClient.created.push(this);
  }

  connect(callback: (error?: Error) => void): void {
    setImmediate(() => callback());
  }

  end(callback?: () => void): Promise<void> {
    this._ending = true;
    this.emit('end');
    callback?.();
    return Promise.resolve();
  }
}

/** The shape pg raises when an administrator terminates a backend (a CNPG switchover). */
function terminated(): Error {
  return Object.assign(new Error('terminating connection due to administrator command'), {
    code: '57P01',
    user: 'synthetic-user',
    database: 'synthetic-db',
  });
}

function fakePool(sink: (diagnostic: SafeDiagnostic) => void) {
  FakeClient.created = [];
  return createDatabasePool({ Client: FakeClient as unknown as new () => ClientBase, max: 2 }, sink);
}

describe('database pools (safe diagnostics)', () => {
  it('reports an idle connection loss as one fixed diagnostic instead of crashing', async () => {
    const diagnostics: SafeDiagnostic[] = [];
    const pool = fakePool((diagnostic) => diagnostics.push(diagnostic));
    const client = await pool.connect();
    client.release();
    expect(pool.idleCount).toBe(1);

    // With no pool listener this emit throws: the unhandled 'error' event that crashed the pod.
    expect(() => FakeClient.created[0]!.emit('error', terminated())).not.toThrow();
    expect(diagnostics).toEqual([{ event: 'database_connection_lost', errorClass: 'error' }]);
    expect(JSON.stringify(diagnostics)).not.toMatch(/synthetic|57P01|terminating/);
    expect(pool.totalCount).toBe(0);
    await pool.end();
  });

  it('survives a connection loss while a client is checked out', async () => {
    const diagnostics: SafeDiagnostic[] = [];
    const pool = fakePool((diagnostic) => diagnostics.push(diagnostic));
    const client = await pool.connect();
    // pg drops its own listener while a client is checked out; ours stays.
    expect(() => FakeClient.created[0]!.emit('error', terminated())).not.toThrow();
    // The holder learns through its next query; releasing the broken client discards it.
    FakeClient.created[0]!._queryable = false;
    client.release();
    expect(pool.totalCount).toBe(0);
    expect(diagnostics).toEqual([]);
    await pool.end();
  });

  it('listens on every store pool the server or the operator CLI builds', async () => {
    const quest = PostgresQuestStore.connect('postgres://synthetic@127.0.0.1:1/none');
    expect(quest.pool.listenerCount('error')).toBe(1);
    expect(quest.pool.listenerCount('connect')).toBe(1);
    await quest.close();
    const family = PostgresFamilyStore.connect('postgres://synthetic@127.0.0.1:1/none');
    expect((family as unknown as { pool: EventEmitter }).pool.listenerCount('error')).toBe(1);
    await family.close();
  });
});
