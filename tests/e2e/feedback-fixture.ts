import { serve } from "@hono/node-server";
import { randomUUID } from "node:crypto";
import {
  createAdventurePlan,
  createInitialAdventureState,
  type AdventurePlanV2,
} from "../../src/shared/adventure.js";
import type { GameplayAction } from "../../src/shared/contracts.js";
import { PARODY_CATALOGS } from "../../src/shared/parody-catalog.js";
import { createApp } from "../../src/server/app.js";
import { InMemoryQuestStore } from "../../src/server/db/memory-store.js";
import {
  FIXTURE_SUBJECT,
  RULE_VERSIONS,
  applyGameplayActionToSave,
  validateSaveRecord,
  type FrozenMemory,
  type SaveRecord,
} from "../../src/server/domain.js";

const port = Number(process.env.QUEST_E2E_PORT ?? 4396);
const owner = {
  id: "10000000-0000-4000-8000-000000000055",
  label: "Feedback player",
};
const sessionId = "20000000-0000-4000-8000-000000000055";
const sessionSecret =
  "feedback-fixture-only-2026-09-11-00000000000000000000000000000000";
const setupStartMs = Date.parse("2026-09-11T12:00:00.000Z");
let setupSequence = 0;

const memories: FrozenMemory[] = [
  {
    id: "demo-memory-2020-07",
    date: "2020-07-01",
    ageYears: 0,
    label: "The first glow",
  },
  {
    id: "demo-memory-2024-01",
    date: "2024-01-01",
    ageYears: 4,
    label: "A taller path",
  },
  {
    id: "demo-memory-2027-01",
    date: "2027-01-01",
    ageYears: 7,
    label: "The lantern gate",
  },
].map((memory) => ({
  ...memory,
  source: { kind: "fixture", key: memory.id },
}));

function archivedCatalogV2Plan(): AdventurePlanV2 {
  const current = createAdventurePlan("2020-01-01", memories);
  const archived = PARODY_CATALOGS["parody-catalog-v2"];
  return {
    ...current,
    catalogVersion: "parody-catalog-v2",
    levels: current.levels.map((level, index) => {
      const periodId = index === 0 ? "block-party-v1" : "remix-runway-v2";
      return {
        ...level,
        periodId,
        encounters: level.encounters.map((encounter) => {
          const entry = archived.find(
            (candidate) =>
              candidate.periodId === periodId &&
              candidate.kind === encounter.kind &&
              candidate.role === encounter.role,
          );
          if (!entry) throw new Error("Archived V2 fixture entry missing");
          return {
            ...encounter,
            content: {
              catalogEntryId: entry.id,
              catalogEntryVersion: entry.version,
              assetId: entry.assetId,
              assetVersion: entry.assetVersion,
            },
          };
        }),
      };
    }),
  };
}

function baseSave(
  id: string,
  title: string,
  plan: AdventurePlanV2,
): SaveRecord {
  const createdAt = new Date("2026-09-11T11:00:00.000Z");
  return validateSaveRecord({
    id,
    ownerId: owner.id,
    previewId: id.replace(/^3/, "4"),
    title,
    subject: FIXTURE_SUBJECT,
    birthDate: "2020-01-01",
    memories: structuredClone(memories),
    recoveredIds: [],
    ageYears: 0,
    abilities: ["move", "interact"],
    appearanceStage: "infant",
    completed: false,
    saveFormat: "era-combat-v2",
    adventurePlan: plan,
    adventureState: createInitialAdventureState(plan),
    friendlyState: null,
    revision: 0,
    createdAt,
    updatedAt: createdAt,
    versions: {
      ...RULE_VERSIONS,
      catalog: plan.catalogVersion,
    },
  });
}

function applySetup(save: SaveRecord, action: GameplayAction): SaveRecord {
  setupSequence += 1;
  return applyGameplayActionToSave(
    save,
    {
      actionId: randomUUID(),
      expectedRevision: save.revision,
      action,
    },
    new Date(setupStartMs + setupSequence * 1_000),
  ).save;
}

function collectAttackTool(save: SaveRecord): SaveRecord {
  const level =
    save.adventurePlan!.levels[save.adventureState!.activeLevelIndex]!;
  const pickup = level.pickups.find(
    (candidate) => candidate.kind === "attack-tool",
  )!;
  return applySetup(save, {
    type: "collect-equipment",
    levelId: level.id,
    pickupId: pickup.pickupId,
  });
}

function defeatEncounter(save: SaveRecord, encounterId: string): SaveRecord {
  let current = save;
  const level =
    current.adventurePlan!.levels[current.adventureState!.activeLevelIndex]!;
  while (!current.adventureState!.encounters[encounterId]!.defeated) {
    current = applySetup(current, {
      type: "attack",
      levelId: level.id,
      encounterId,
    });
  }
  return current;
}

function bossCheckpoint(save: SaveRecord): SaveRecord {
  let current = collectAttackTool(save);
  const first = current.adventurePlan!.levels[0]!;
  for (const encounter of first.encounters) {
    current = defeatEncounter(current, encounter.id);
  }
  for (const memoryId of first.memoryIds) {
    current = applySetup(current, {
      type: "recover-memory",
      levelId: first.id,
      memoryId,
    });
  }
  current = applySetup(current, {
    type: "consume-memory-bundle",
    levelId: first.id,
  });
  current = collectAttackTool(current);
  const second = current.adventurePlan!.levels[1]!;
  for (const encounter of second.encounters.filter(
    (candidate) => candidate.role === "ordinary",
  )) {
    current = defeatEncounter(current, encounter.id);
  }
  return validateSaveRecord(current);
}

const currentPlan = createAdventurePlan("2020-01-01", memories);
const friendly = collectAttackTool(
  baseSave(
    "30000000-0000-4000-8000-000000000051",
    "Friendly checkpoint",
    currentPlan,
  ),
);
const besties = bossCheckpoint(
  baseSave(
    "30000000-0000-4000-8000-000000000052",
    "Besties checkpoint",
    currentPlan,
  ),
);
const dragon = bossCheckpoint(
  baseSave(
    "30000000-0000-4000-8000-000000000053",
    "Archived V2 dragon checkpoint",
    archivedCatalogV2Plan(),
  ),
);

const store = new InMemoryQuestStore(
  [friendly, besties, dragon],
  [
    {
      sessionId,
      player: owner,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
    },
  ],
);
const app = createApp({
  store,
  fixtureMode: true,
  sessionSecret,
  appOrigin: `http://127.0.0.1:${port}`,
  clientDir: "dist/client",
  studioDir: "site",
});
const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port });

console.log(
  JSON.stringify({
    fixture: "PLAN006 focused feedback checkpoints",
    origin: `http://127.0.0.1:${port}`,
    sessionId,
    saves: [
      { id: friendly.id, title: friendly.title, revision: friendly.revision },
      { id: besties.id, title: besties.title, revision: besties.revision },
      { id: dragon.id, title: dragon.title, revision: dragon.revision },
    ],
  }),
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close(() => process.exit(signal === "SIGINT" ? 130 : 143));
  });
}
