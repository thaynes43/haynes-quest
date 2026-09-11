import { serve } from '@hono/node-server';
import { classifyError, createApp, emitSafeDiagnostic, writeSafeDiagnostic } from './app.js';
import { loadConfig } from './config.js';
import { PostgresQuestStore } from './db/postgres-store.js';

const MAINTENANCE_INTERVAL_MS = 5 * 60_000;
let startupStore: PostgresQuestStore | null = null;

async function start(): Promise<void> {
  const config = loadConfig();
  const store = PostgresQuestStore.connect(config.databaseUrl);
  startupStore = store;
  await store.migrate();

  let maintenanceJob: Promise<void> | null = null;
  const runMaintenance = (phase: 'scheduled' | 'startup'): Promise<void> => {
    if (maintenanceJob) return maintenanceJob;
    const job = (async () => {
      try {
        await store.maintainFixtureRecords(new Date());
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
    sessionSecret: config.sessionSecret,
    appOrigin: config.appOrigin,
    clientDir: config.clientDir,
    studioDir: config.studioDir,
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
      await store.close();
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

void start().catch(async (error: unknown) => {
  emitSafeDiagnostic(writeSafeDiagnostic, {
    event: 'startup_failed',
    errorClass: classifyError(error),
  });
  try {
    await startupStore?.close();
  } catch (closeError) {
    emitSafeDiagnostic(writeSafeDiagnostic, {
      event: 'shutdown_failed',
      errorClass: classifyError(closeError),
    });
  }
  process.exitCode = 1;
});
