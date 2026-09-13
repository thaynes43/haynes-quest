// @vitest-environment jsdom
/** WO083 probe: boss health HUD visibility with the new availability gate. */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateGameOptions, GameHandle, GameStatus } from "../../../src/game/types";
import type { SaveView } from "../../../src/shared/contracts";
import { makeEraSave } from "../../game/fixtures";

const mocks = vi.hoisted(() => ({ createGame: vi.fn(), api: vi.fn() }));
vi.mock("../../../src/game/index", () => ({ createGame: mocks.createGame }));
vi.mock("../../../src/client/api", () => ({ api: mocks.api, friendlyError: (e: unknown) => String(e) }));
vi.mock("../../../src/client/audio", () => ({
  QuestAudio: class {
    readonly start = vi.fn(async () => true);
    readonly cue = vi.fn(async () => true);
    readonly feedback = vi.fn(async () => true);
    readonly audition = vi.fn(async () => true);
    readonly suspend = vi.fn();
    readonly setPaused = vi.fn();
    readonly setPreferences = vi.fn();
    readonly dispose = vi.fn();
    preferences() { return { muted: false, volume: 0.8 }; }
    status() { return { contextState: "suspended" }; }
  },
}));
import { GameScreen } from "../../../src/client/GameScreen";

const levelId = "level-1-2020";
function status(): GameStatus {
  return {
    nearFriendlyId: null, nearPickupId: null, nearEncounterId: null, nearMemoryId: null,
    nearFinish: false, canConsume: false, position: { x: 0, y: 0, z: 1 }, ageYears: 0,
    appearanceStage: "infant", abilities: ["move", "interact", "jump"], grounded: true,
    playerHp: 10, maxPlayerHp: 10, phase: "exploring", activeLevelId: levelId,
    eraYear: 2020, attackReady: false, attackFeedback: null, guardActive: false,
    guardReady: false, requestBusy: false, requestState: "idle", requestError: null,
    requestErrorCode: null, mediaLoading: 0, mediaFailed: 0,
    // No Besties encounter on the garden route: createGame reports undefined here.
    bestiesPhase: undefined,
  };
}

let container: HTMLDivElement;
let root: Root | undefined;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  mocks.createGame.mockReset();
  const handle = {
    updateSave: vi.fn(), setInput: vi.fn(), cancelInput: vi.fn(), clearInput: vi.fn(),
    setPaused: vi.fn(), performAction: vi.fn(() => true), retryMedia: vi.fn(),
    inspect: vi.fn(), dispose: vi.fn(),
  } as unknown as GameHandle;
  mocks.createGame.mockImplementation((next: CreateGameOptions) => {
    next.onStatus?.(status());
    return handle;
  });
});
afterEach(async () => {
  if (root) { await act(async () => root!.unmount()); root = undefined; }
  container.remove();
});

function gardenSave(bossAvailable: boolean): SaveView {
  const save = structuredClone(makeEraSave({ collectedKinds: ["attack-tool"] }));
  const ids = ["route-memory-1", "route-memory-2", "route-memory-3"] as const;
  save.memories = ids.map((id, index) => ({
    id, date: `${2020 + index}-01-01`, ageYears: index,
    label: `Route memory ${index + 1}`,
    role: index === 2 ? "major" : "minor",
    state: index === 2 ? "locked" : "released",
    ...(index === 2 ? {} : { mediaUrl: `/fixture/${id}.svg` }),
  })) as SaveView["memories"];
  save.recoveredIds = [];
  save.adventure!.planVersion = "era-level-plan-v3";
  const level = save.adventure!.activeLevel!;
  save.adventure!.activeLevel = {
    ...level,
    memoryIds: [...ids],
    minorMemoryIds: [ids[0], ids[1]],
    majorMemoryId: ids[2],
    encounters: level.encounters.map((encounter) =>
      encounter.role === "boss"
        ? { ...encounter, defeated: false, available: bossAvailable }
        : { ...encounter, defeated: false, available: true },
    ),
  };
  return save;
}

describe("WO083 probe: boss HUD gate", () => {
  it.each([
    ["v2-style available boss with ordinaries alive", true],
    ["v1-style gated boss with ordinaries alive", false],
  ])("%s", async (_label, bossAvailable) => {
    root = createRoot(container);
    await act(async () =>
      root!.render(
        <GameScreen initialSave={gardenSave(bossAvailable)} onLeave={vi.fn()} ephemeral />,
      ),
    );
    const hud = container.querySelector(".boss-hud");
    console.log(
      `bossAvailable=${bossAvailable} boss-hud rendered=${Boolean(hud)}`,
      hud?.textContent,
    );
    expect(Boolean(hud)).toBe(bossAvailable);
  });
});
