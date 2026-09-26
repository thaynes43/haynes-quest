// @vitest-environment jsdom
/**
 * DESIGN-024 child journey on the client: a real published family save (built
 * through the server service with a fake Immich) plays in GameScreen. The big
 * memory advances age, shows "Turning N!" and the new-move card, and no
 * fixture-only copy appears.
 */
import { randomUUID } from "node:crypto";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateGameOptions, GameHandle, GameStatus } from "../../src/game/types";
import type { GameplayAction, SaveView } from "../../src/shared/contracts";
import { applyGameplayActionToSave, toSaveView, type SaveRecord } from "../../src/server/domain";
import { familyWorldView, newFamilySave } from "../../src/server/family/saves";
import { resolveFamilyWorld } from "../../src/client/family/family-world";
import { ADMIN, familyHarness } from "../server/family/harness";
import { TEST_CHILD_B } from "../server/family/fake-immich";

const mocks = vi.hoisted(() => ({ createGame: vi.fn(), api: vi.fn() }));

vi.mock("../../src/game/index", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/game/index")>()),
  createGame: mocks.createGame,
}));
vi.mock("../../src/client/api", () => ({ api: mocks.api, friendlyError: (error: unknown) => String(error) }));
vi.mock("../../src/client/audio", () => ({
  QuestAudio: class {
    readonly start = vi.fn(async () => true);
    readonly cue = vi.fn(async () => true);
    readonly feedback = vi.fn(async () => true);
    readonly audition = vi.fn(async () => true);
    readonly suspend = vi.fn();
    readonly setPaused = vi.fn();
    readonly setPreferences = vi.fn();
    readonly dispose = vi.fn();
    preferences() {
      return { muted: false, volume: 0.8 };
    }
    status() {
      return { contextState: "suspended" };
    }
  },
}));

import { GameScreen } from "../../src/client/GameScreen";

async function familySave() {
  const harness = familyHarness();
  const [person] = await harness.service.lookupPeople(TEST_CHILD_B.name);
  const child = await harness.service.createChild({
    immichName: TEST_CHILD_B.name,
    personChoiceId: person!.id,
    displayName: "Test Child B",
    birthDate: TEST_CHILD_B.birthDate,
    templateId: "rat-casino-world",
    templateVersion: "v2",
  }, ADMIN.id);
  const draft = await harness.service.autoPick(child.id, ADMIN.id);
  const summary = await harness.service.publish(child.id, draft.revision, randomUUID(), ADMIN.id);
  const publication = (await harness.familyStore.getPublication(summary.publicationId))!;
  return newFamilySave({
    publication,
    child: (await harness.familyStore.getChild(child.id))!,
    startedBy: ADMIN.id,
    now: new Date(1_000),
  });
}

function status(save: SaveView): GameStatus {
  return {
    nearFriendlyId: null, nearPickupId: null, nearEncounterId: null, nearMemoryId: null, nearFinish: false,
    canConsume: false, position: { x: 0, y: 0, z: 0 }, ageYears: save.ageYears, appearanceStage: "infant",
    abilities: [...save.abilities], grounded: true, playerHp: 10, maxPlayerHp: 10, phase: "exploring",
    activeLevelId: save.adventure!.currentLevelId, eraYear: 2020, attackReady: true, attackFeedback: null,
    guardActive: false, guardReady: true, requestBusy: false, requestState: "idle", requestError: null,
    requestErrorCode: null, mediaLoading: 0, mediaFailed: 0,
  };
}

let container: HTMLDivElement;
let root: Root | undefined;
let options: CreateGameOptions | undefined;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  mocks.createGame.mockReset();
  mocks.api.mockReset();
  mocks.createGame.mockImplementation((next: CreateGameOptions) => {
    options = next;
    next.onStatus?.(status(next.save));
    return {
      updateSave: vi.fn(), setInput: vi.fn(), cancelInput: vi.fn(), clearInput: vi.fn(), setPaused: vi.fn(),
      performAction: vi.fn(() => true), retryMedia: vi.fn(), inspect: vi.fn(), dispose: vi.fn(),
    } as unknown as GameHandle;
  });
});

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  container.remove();
});

describe("family journey in GameScreen", () => {
  it("grows the traveler with the big memory and teaches the new moves", async () => {
    let record: SaveRecord = await familySave();
    const world = resolveFamilyWorld(familyWorldView(record));
    let now = 2_000;
    const view = () => toSaveView(record, new Date(now));
    const level = record.adventurePlan!.levels[0]!;
    if (!("minorMemoryIds" in level)) throw new Error("Expected route memories");
    // Everything before the big memory happens on the server.
    const serverAct = (action: GameplayAction) => {
      record = applyGameplayActionToSave(record, { actionId: randomUUID(), expectedRevision: record.revision, action }, new Date(now)).save;
      now += 1_000;
    };
    serverAct({ type: "collect-equipment", levelId: level.id, pickupId: level.pickups[0]!.pickupId });
    for (const memoryId of level.minorMemoryIds) serverAct({ type: "recover-memory", levelId: level.id, memoryId });
    while (!record.adventureState!.encounters[level.bossId]!.defeated) {
      serverAct({ type: "attack", levelId: level.id, encounterId: level.bossId });
    }
    const before = view();
    expect(before.adventure!.activeLevel!.growthMoves).toEqual(["move", "interact", "jump"]);

    root = createRoot(container);
    await act(async () => root!.render(
      <GameScreen
        initialSave={before}
        onLeave={vi.fn()}
        familyPhotos
        authoredLevelResolver={world.resolver}
        chapterTitles={world.chapterTitles}
        chapterSubtitles={world.chapterSubtitles}
        chapterDescriptions={world.chapterDescriptions}
      />,
    ));
    expect(options!.authoredLevelResolver?.("rat-casino-v2")?.document.id).toBe("rat-casino-v2");

    const request = {
      actionId: randomUUID(),
      expectedRevision: record.revision,
      action: { type: "recover-memory" as const, levelId: level.id, memoryId: level.majorMemoryId },
    };
    record = applyGameplayActionToSave(record, request, new Date(now)).save;
    const after = view();
    expect(after.adventure!.activeLevel!.growthMoves).toEqual(["move", "interact", "jump", "high-jump", "double-jump"]);
    mocks.api.mockResolvedValueOnce(after);
    await act(async () => {
      await options!.onAction(request);
    });

    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain("AGE 4");
    expect(dialog.textContent).toContain("Turning 4!");
    expect(dialog.textContent).toContain("2024-02-29 · Age 4");
    expect(dialog.textContent).toContain("New move: High Jump");
    expect(dialog.textContent).toContain("New move: Double Jump");
    // Card titles end in "!", so no colon follows them.
    expect(dialog.textContent).toContain("New move: High Jump! You're bigger now, so every jump goes higher.");
    expect(dialog.textContent).not.toMatch(/!:/);
    expect(dialog.textContent).toContain("AGE 4 · BESTIES OBBY");
    expect(container.textContent).not.toMatch(/fictional/i);
  });
});
