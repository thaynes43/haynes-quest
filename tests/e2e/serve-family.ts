/**
 * Synthetic family-mode harness for browser journeys (DESIGN-024). It serves
 * the real client build and the real family routes, with an in-process fake
 * Immich, in-memory stores and a fake session: the cookie
 * `quest_test_session=admin|member` stands in for an Authentik sign-in (the
 * sign-in itself is covered by WO106's fake identity-provider tests). Every
 * child, date and photo is synthetic.
 *
 *   pnpm build && QUEST_E2E_PORT=4180 npx tsx tests/e2e/serve-family.ts
 */
import { serve } from "@hono/node-server";
import { createApp } from "../../src/server/app";
import { InMemoryQuestStore } from "../../src/server/db/memory-store";
import { AutoPickJobs } from "../../src/server/family/jobs";
import { InMemoryFamilyStore } from "../../src/server/family/memory-store";
import { FamilyJourneyService } from "../../src/server/family/service";
import { FamilyTemplateRegistry } from "../../src/server/family/templates";
import { CandidateTokens } from "../../src/server/family/tokens";
import { ImmichPhotoSource } from "../../src/server/photos/immich";
import { SharpImageSanitizer } from "../../src/server/photos/sanitizer";
import type { PickClock } from "../../src/server/family/pick";
import { FakeImmich, TEST_CHILD_A, TEST_CHILD_B, syntheticLibrary } from "../server/family/fake-immich";
import { ADMIN, HARNESS_SECRET, MEMBER, fakeFamilyAuth } from "../server/family/harness";

const port = Number(process.env.QUEST_E2E_PORT ?? 4180);
const origin = `http://127.0.0.1:${port}`;
// Wall-clock time with instant pacing: deadlines stay real while the bounded
// 250 ms spacing costs nothing in the harness.
let skew = 0;
const clock: PickClock = {
  now: () => Date.now() + skew,
  sleep: async (ms) => {
    skew += ms;
  },
};
const immich = new FakeImmich([
  { id: TEST_CHILD_B.personId, name: TEST_CHILD_B.name, birthDate: TEST_CHILD_B.birthDate },
  { id: TEST_CHILD_A.personId, name: TEST_CHILD_A.name, birthDate: TEST_CHILD_A.birthDate },
], syntheticLibrary());
const library = new ImmichPhotoSource(immich, HARNESS_SECRET, "e2e-connection", {}, new SharpImageSanitizer());
const familyStore = new InMemoryFamilyStore();
const templates = new FamilyTemplateRegistry();
const today = () => "2026-09-25";
const app = createApp({
  store: new InMemoryQuestStore(),
  fixtureMode: false,
  sessionSecret: "synthetic-session-secret-with-32-plus-chars",
  appOrigin: origin,
  clientDir: "dist/client",
  studioDir: "site",
  familyAuth: fakeFamilyAuth({ admin: ADMIN, member: MEMBER }),
  family: {
    store: familyStore,
    templates,
    service: new FamilyJourneyService({
      store: familyStore,
      library,
      templates,
      tokens: new CandidateTokens(HARNESS_SECRET),
      clock,
      today,
    }),
    jobs: new AutoPickJobs(),
    today,
  },
  privateMedia: library,
});
serve({ fetch: app.fetch, hostname: "127.0.0.1", port });
console.log(`Synthetic family harness ready on ${origin}`);
