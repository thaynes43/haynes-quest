import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  ROUTE_ATTACK_COOLDOWN_MS,
  createInitialAdventureState,
  createRouteMemoryPlan,
  type AdventureMemory,
} from "../../src/shared/adventure.js";
import type {
  GameplayAction,
  GameplayActionRequest,
  SaveView,
} from "../../src/shared/contracts.js";
import { createApp } from "../../src/server/app.js";
import { parseStoredAdventure } from "../../src/server/adventure-schema.js";
import { InMemoryQuestStore } from "../../src/server/db/memory-store.js";

const ORIGIN = "https://quest.test";
const SECRET = "fixture-session-secret-that-is-at-least-32-characters";
const MEMORIES: AdventureMemory[] = [
  { id: "memory-age-0", date: "2020-07-01", ageYears: 0 },
  { id: "memory-age-2", date: "2022-01-01", ageYears: 2 },
  { id: "memory-age-4", date: "2024-01-01", ageYears: 4 },
  { id: "memory-age-5", date: "2025-01-01", ageYears: 5 },
  { id: "memory-age-6", date: "2026-01-01", ageYears: 6 },
  { id: "memory-age-7", date: "2027-01-01", ageYears: 7 },
];

class TestClock {
  private value = Date.now();

  now = (): Date => new Date(this.value);

  advance(milliseconds: number): void {
    this.value += milliseconds;
  }
}

function mutation(cookie: string, body: unknown): RequestInit {
  return {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      cookie,
      origin: ORIGIN,
      "content-type": "application/json",
      "x-quest-request": "1",
    },
  };
}

async function applyAction(
  app: ReturnType<typeof createApp>,
  cookie: string,
  save: SaveView,
  action: GameplayAction,
): Promise<SaveView> {
  const request: GameplayActionRequest = {
    actionId: randomUUID(),
    expectedRevision: save.revision,
    action,
  };
  const response = await app.request(
    `/api/saves/${save.id}/actions`,
    mutation(cookie, request),
  );
  expect(response.status, await response.clone().text()).toBe(200);
  return response.json() as Promise<SaveView>;
}

describe("route boss persistence", () => {
  it("persists both v5 boss fights and major progression with an ordinary left behind", async () => {
    const clock = new TestClock();
    const store = InMemoryQuestStore.ephemeral();
    const app = createApp({
      store,
      fixtureMode: true,
      ephemeralPlaytest: true,
      sessionSecret: SECRET,
      appOrigin: ORIGIN,
      clientDir: "/tmp/quest-client-not-present",
      studioDir: "/tmp/quest-studio-not-present",
      now: clock.now,
    });
    const sessionResponse = await app.request("/api/session");
    const cookie = sessionResponse.headers.get("set-cookie")!.split(";", 1)[0]!;
    const player = (await sessionResponse.json()) as { player: { id: string } };
    const startResponse = await app.request(
      "/api/playtest/start",
      mutation(cookie, { chapter: 1 }),
    );
    expect(startResponse.status, await startResponse.clone().text()).toBe(201);
    let save = (await startResponse.json()) as SaveView;
    const expectedRoutes = ["garden-playground-v2", "besties-playground-v2"];

    for (const [chapterIndex, expectedRoute] of expectedRoutes.entries()) {
      const level = save.adventure!.activeLevel!;
      expect(level.routeId).toBe(expectedRoute);
      const ordinary = level.encounters
        .filter((encounter) => encounter.role === "ordinary")
        .at(-1)!;
      expect(ordinary.id).toMatch(/encounter-4$/);
      const boss = level.encounters.find(
        (encounter) => encounter.role === "boss",
      )!;
      const attackTool = level.pickups.find(
        (pickup) => pickup.kind === "attack-tool",
      )!;
      const guardTool = level.pickups.find(
        (pickup) => pickup.kind === "guard-tool",
      )!;

      save = await applyAction(app, cookie, save, {
        type: "collect-equipment",
        levelId: level.id,
        pickupId: attackTool.pickupId,
      });
      save = await applyAction(app, cookie, save, {
        type: "collect-equipment",
        levelId: level.id,
        pickupId: guardTool.pickupId,
      });
      save = await applyAction(app, cookie, save, {
        type: "recover-memory",
        levelId: level.id,
        memoryId: level.minorMemoryIds![0],
      });

      save = await applyAction(app, cookie, save, {
        type: "attack",
        levelId: level.id,
        encounterId: ordinary.id,
      });
      const partialOrdinaryHp = save.adventure!.activeLevel!.encounters.find(
        (encounter) => encounter.id === ordinary.id,
      )!.hp;
      expect(partialOrdinaryHp).toBeGreaterThan(0);
      expect(partialOrdinaryHp).toBeLessThan(ordinary.maxHp);
      clock.advance(ROUTE_ATTACK_COOLDOWN_MS);

      expect(
        save.adventure!.activeLevel!.encounters.find(
          (encounter) => encounter.id === boss.id,
        ),
      ).toMatchObject({ available: true, hp: boss.maxHp });
      save = await applyAction(app, cookie, save, {
        type: "attack",
        levelId: level.id,
        encounterId: boss.id,
      });
      expect(
        save.adventure!.activeLevel!.encounters.find(
          (encounter) => encounter.id === boss.id,
        )!.hp,
      ).toBe(boss.maxHp - attackTool.damage);

      save = await applyAction(app, cookie, save, {
        type: "secondary-attack",
        levelId: level.id,
        encounterId: boss.id,
      });
      expect(
        save.adventure!.activeLevel!.encounters.find(
          (encounter) => encounter.id === boss.id,
        )!.hp,
      ).toBe(boss.maxHp - attackTool.damage - (guardTool.tier + 1));

      while (
        !save.adventure!.activeLevel!.encounters.find(
          (encounter) => encounter.id === boss.id,
        )!.defeated
      ) {
        clock.advance(ROUTE_ATTACK_COOLDOWN_MS);
        save = await applyAction(app, cookie, save, {
          type: "attack",
          levelId: level.id,
          encounterId: boss.id,
        });
      }
      expect(save.adventure).toMatchObject({ phase: "memory-released" });
      expect(
        save.adventure!.activeLevel!.encounters.find(
          (encounter) => encounter.id === ordinary.id,
        ),
      ).toMatchObject({ hp: partialOrdinaryHp, defeated: false });

      const persistedFight = (await (
        await app.request(`/api/saves/${save.id}`, { headers: { cookie } })
      ).json()) as SaveView;
      expect(persistedFight).toMatchObject({
        revision: save.revision,
        adventure: { phase: "memory-released" },
      });

      const prematureMajor = await app.request(
        `/api/saves/${save.id}/actions`,
        mutation(cookie, {
          actionId: randomUUID(),
          expectedRevision: save.revision,
          action: {
            type: "recover-memory",
            levelId: level.id,
            memoryId: level.majorMemoryId!,
          },
        } satisfies GameplayActionRequest),
      );
      expect(prematureMajor.status).toBe(409);
      expect(await prematureMajor.json()).toMatchObject({
        error: { code: "MEMORY_BUNDLE_INCOMPLETE" },
      });
      save = await applyAction(app, cookie, save, {
        type: "recover-memory",
        levelId: level.id,
        memoryId: level.minorMemoryIds![1],
      });

      save = await applyAction(app, cookie, save, {
        type: "recover-memory",
        levelId: level.id,
        memoryId: level.majorMemoryId!,
      });
      expect(save.adventure).toMatchObject(
        chapterIndex === 0
          ? { activeLevelIndex: 1, phase: "exploring" }
          : { activeLevelIndex: 2, phase: "complete" },
      );

      const persisted = await store.getSave(player.player.id, save.id);
      expect(persisted?.adventureState?.encounters[ordinary.id]).toMatchObject({
        hp: partialOrdinaryHp,
        defeated: false,
      });
      const fullRead = await app.request(`/api/saves/${save.id}`, {
        headers: { cookie },
      });
      expect(fullRead.status).toBe(200);
      expect(await fullRead.json()).toMatchObject({
        revision: save.revision,
        completed: chapterIndex === 1,
      });
    }

    const completed = await store.getSave(player.player.id, save.id);
    expect(completed?.adventureState?.phase).toBe("complete");
    for (const level of completed!.adventurePlan!.levels) {
      const boss = level.encounters.find(
        (encounter) => encounter.id === level.bossId,
      )!;
      const bossAlive = structuredClone(completed!.adventureState!);
      bossAlive.encounters[boss.id] = {
        hp: boss.maxHp,
        defeated: false,
        nextReportedHitAtMs: 0,
      };
      expect(() =>
        parseStoredAdventure(completed!.adventurePlan, bossAlive),
      ).toThrowError(expect.objectContaining({ code: "SAVE_DATA_INVALID" }));

      const bossMissing = structuredClone(completed!.adventureState!);
      delete bossMissing.encounters[boss.id];
      expect(() =>
        parseStoredAdventure(completed!.adventurePlan, bossMissing),
      ).toThrowError(expect.objectContaining({ code: "SAVE_DATA_INVALID" }));
    }
  });

  it("continues to reject archived boss damage while an ordinary remains", () => {
    const plan = createRouteMemoryPlan(
      "2020-01-01",
      MEMORIES,
      "parody-catalog-v4",
    );
    const state = createInitialAdventureState(plan);
    const level = plan.levels[0]!;
    const boss = level.encounters.find(
      (encounter) => encounter.role === "boss",
    )!;
    state.encounters[boss.id]!.hp -= 1;

    expect(() => parseStoredAdventure(plan, state)).toThrowError(
      expect.objectContaining({ code: "SAVE_DATA_INVALID" }),
    );
  });
});
