/**
 * WO074: tests/e2e/serve-fixture.ts never passes ephemeralPlaytest, so the
 * fresh-playtest home ("Play from the beginning") does not appear. This
 * serves the built client from this worktree in the same mode the private
 * playtest uses (fixture + ephemeral memory store).
 *
 *   QUEST_E2E_PORT=4402 node_modules/.bin/tsx tests/review/074-probes/serve-ephemeral-fixture.ts
 */
import { serve } from "@hono/node-server";
import { randomBytes } from "node:crypto";
import { createApp } from "../../../src/server/app";
import { InMemoryQuestStore } from "../../../src/server/db/memory-store";

const port = Number(process.env.QUEST_E2E_PORT ?? 4402);
// The strict docs build (mkdocs) cannot run offline in this pod, so there is
// no site/ directory; point the studio root at a folder whose assets/media is
// a symlink to the checked-in docs/assets/media to serve GLBs and cue WAVs.
const studioDir = process.env.QUEST_E2E_STUDIO_DIR ?? "site";
const app = createApp({
  store: InMemoryQuestStore.ephemeral(),
  fixtureMode: true,
  ephemeralPlaytest: true,
  sessionSecret: randomBytes(32).toString("hex"),
  appOrigin: `http://127.0.0.1:${port}`,
  clientDir: "dist/client",
  studioDir,
});
serve({ fetch: app.fetch, hostname: "127.0.0.1", port });
console.log(`WO074 ephemeral fixture ready on 127.0.0.1:${port}`);
