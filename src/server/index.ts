import { serve } from '@hono/node-server';
import { pathToFileURL } from 'node:url';
import { classifyError, createApp, emitSafeDiagnostic, writeSafeDiagnostic } from './app.js';
import { FamilyAuth } from './auth/family-auth.js';
import { PostgresFamilyPlayerStore } from './auth/player-store.js';
import { loadConfig, type ServerConfig } from './config.js';
import { createConfiguredFamily, createConfiguredImmich } from './family/wiring.js';
import { InMemoryQuestStore } from './db/memory-store.js';
import { PostgresQuestStore } from './db/postgres-store.js';
import type { QuestStore } from './domain.js';

const MAINTENANCE_INTERVAL_MS = 5 * 60_000;
let startupStore: QuestStore | null = null;

export function createConfiguredStore(config: ServerConfig): QuestStore {
  if (config.ephemeralPlaytest) return InMemoryQuestStore.ephemeral();
  if (!config.databaseUrl) throw new Error('DATABASE_URL is required');
  return PostgresQuestStore.connect(config.databaseUrl);
}

/** Family sign-in for the non-fixture release; null in fixture mode (ADR-005, C-03). */
export function createConfiguredFamilyAuth(config: ServerConfig, store: QuestStore): FamilyAuth | null {
  if (config.fixtureMode || !config.familyAuth) return null;
  if (!(store instanceof PostgresQuestStore)) throw new Error('Family sign-in requires Postgres');
  return new FamilyAuth({
    config: config.familyAuth,
    appOrigin: config.appOrigin,
    secret: config.sessionSecret,
    database: store.pool,
    players: new PostgresFamilyPlayerStore(store.pool),
  });
}

export async function start(): Promise<void> {
  const config = loadConfig();
  const store = createConfiguredStore(config);
  startupStore = store;
  if (store instanceof PostgresQuestStore) await store.migrate();
  // Constructed after migrations: Better Auth validates its tables at startup.
  const familyAuth = createConfiguredFamilyAuth(config, store);
  const immich = familyAuth ? createConfiguredImmich(config) : null;
  const family = familyAuth ? createConfiguredFamily(config, store, immich) : null;

  let maintenanceJob: Promise<void> | null = null;
  const runMaintenance = (phase: 'scheduled' | 'startup'): Promise<void> => {
    if (maintenanceJob) return maintenanceJob;
    const job = (async () => {
      try {
        await store.maintainFixtureRecords(new Date());
        await familyAuth?.deleteExpiredRecords(new Date());
      } catch (error) {
        emitSafeDiagnostic(writeSafeDiagnostic, {
          event: 'maintenance_failed',
          errorClass: classifyError(error),
          phase,
        });
      }
    })();
    maintenanceJob = job;
    void job.finally(() => {
      if (maintenanceJob === job) maintenanceJob = null;
    });
    return job;
  };

  await runMaintenance('startup');
  const app = createApp({
    store,
    fixtureMode: config.fixtureMode,
    ephemeralPlaytest: config.ephemeralPlaytest,
    sessionSecret: config.sessionSecret,
    appOrigin: config.appOrigin,
    clientDir: config.clientDir,
    studioDir: config.studioDir,
    ...(familyAuth ? { familyAuth } : {}),
    ...(family ? { family } : {}),
    ...(immich ? { privateMedia: immich } : {}),
  });
  const server = serve({ fetch: app.fetch, port: config.port, hostname: '0.0.0.0' });
  process.stdout.write(`Haynes Quest server listening on port ${config.port}\n`);

  const maintenanceTimer = setInterval(() => {
    void runMaintenance('scheduled');
  }, MAINTENANCE_INTERVAL_MS);
  maintenanceTimer.unref();

  let closing = false;
  async function shutdown(): Promise<void> {
    if (closing) return;
    closing = true;
    clearInterval(maintenanceTimer);
    let failed = false;
    try {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    } catch (error) {
      failed = true;
      emitSafeDiagnostic(writeSafeDiagnostic, {
        event: 'shutdown_failed',
        errorClass: classifyError(error),
      });
    }
    await maintenanceJob;
    try {
      await store.close?.();
    } catch (error) {
      failed = true;
      emitSafeDiagnostic(writeSafeDiagnostic, {
        event: 'shutdown_failed',
        errorClass: classifyError(error),
      });
    }
    process.exitCode = failed ? 1 : 0;
  }

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1];
  return entrypoint !== undefined && import.meta.url === pathToFileURL(entrypoint).href;
}

if (isMainModule()) {
  void start().catch(async (error: unknown) => {
    emitSafeDiagnostic(writeSafeDiagnostic, {
      event: 'startup_failed',
      errorClass: classifyError(error),
    });
    try {
      await startupStore?.close?.();
    } catch (closeError) {
      emitSafeDiagnostic(writeSafeDiagnostic, {
        event: 'shutdown_failed',
        errorClass: classifyError(closeError),
      });
    }
    process.exitCode = 1;
  });
}
