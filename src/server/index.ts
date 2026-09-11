import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { PostgresQuestStore } from './db/postgres-store.js';

const config = loadConfig();
const store = PostgresQuestStore.connect(config.databaseUrl);
await store.migrate();
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

let closing = false;
async function shutdown(): Promise<void> {
  if (closing) return;
  closing = true;
  server.close(async () => {
    await store.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
