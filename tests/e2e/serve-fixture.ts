import { serve } from "@hono/node-server";
import { randomBytes } from "node:crypto";
import { createApp } from "../../src/server/app";
import { InMemoryQuestStore } from "../../src/server/db/memory-store";
import { PostgresQuestStore } from "../../src/server/db/postgres-store";
const port = Number(process.env.QUEST_E2E_PORT ?? 4173);
const store = process.env.QUEST_TEST_DATABASE_URL
  ? PostgresQuestStore.connect(process.env.QUEST_TEST_DATABASE_URL)
  : new InMemoryQuestStore();
if (store instanceof PostgresQuestStore) await store.migrate();
const app = createApp({
  store,
  fixtureMode: true,
  sessionSecret: randomBytes(32).toString("hex"),
  appOrigin: `http://127.0.0.1:${port}`,
  clientDir: "dist/client",
  studioDir: "site",
});
serve({ fetch: app.fetch, hostname: "127.0.0.1", port });
console.log(
  `Synthetic browser-test harness ready on 127.0.0.1:${port}; storage=${store instanceof PostgresQuestStore ? "postgres" : "memory"}`,
);
