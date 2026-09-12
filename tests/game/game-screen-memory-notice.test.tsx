// @vitest-environment jsdom
/**
 * Regression from WO074: replacing a pickup notice must also clear its photo.
 * An interrupted pickup timer formerly left the image attached to later attacks.
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CreateGameOptions,
  GameHandle,
  GameInspection,
  GameStatus,
} from "../../src/game/types";
import type { SaveView } from "../../src/shared/contracts";
import { makeEraSave } from "./fixtures";

const mocks = vi.hoisted(() => ({
  createGame: vi.fn(),
  api: vi.fn(),
}));

vi.mock("../../src/game/index", () => ({
  createGame: mocks.createGame,
}));

vi.mock("../../src/client/api", () => ({
  api: mocks.api,
  friendlyError: (error: unknown) => String(error),
}));

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

const levelId = "level-1-2020";
const minorId = "route-memory-1";

/** A fresh v3 route-memory save: two released minors and a locked major. */
function routeMemorySave(): SaveView {
  const save = structuredClone(
    makeEraSave({ collectedKinds: ["attack-tool"] }),
  );
  const ids = ["route-memory-1", "route-memory-2", "route-memory-3"] as const;
  save.memories = ids.map((id, index) => ({
    id,
    date: `${2020 + index}-01-01`,
    ageYears: index,
    label: `Route memory ${index + 1}`,
    role: index === 2 ? "major" : "minor",
    state: index === 2 ? "locked" : "released",
    ...(index === 2 ? {} : { mediaUrl: `/fixture/${id}.svg` }),
  })) as SaveView["memories"];
  save.recoveredIds = [];
  save.adventure!.planVersion = "era-level-plan-v3";
  save.adventure!.activeLevel = {
    ...save.adventure!.activeLevel!,
    memoryIds: [...ids],
    minorMemoryIds: [ids[0], ids[1]],
    majorMemoryId: ids[2],
  };
  return save;
}

function status(): GameStatus {
  return {
    nearFriendlyId: null,
    nearPickupId: null,
    nearEncounterId: null,
    nearMemoryId: null,
    nearFinish: false,
    canConsume: false,
    position: { x: 0, y: 0, z: -3 },
    ageYears: 0,
    appearanceStage: "infant",
    abilities: ["move", "interact", "jump"],
    grounded: true,
    playerHp: 8,
    maxPlayerHp: 10,
    phase: "exploring",
    activeLevelId: levelId,
    eraYear: 2020,
    attackReady: false,
    attackFeedback: null,
    guardActive: false,
    guardReady: false,
    requestBusy: false,
    requestState: "idle",
    requestError: null,
    requestErrorCode: null,
    mediaLoading: 0,
    mediaFailed: 0,
  };
}

function inspection(current: GameStatus): GameInspection {
  return {
    status: current,
    input: {
      moveX: 0,
      moveY: 0,
      lookX: 0,
      lookY: 0,
      jump: false,
      interact: false,
      attack: false,
      guard: false,
    },
    checkpoint: { x: 0, y: 0, z: 1 },
    level: {
      id: levelId,
      memoryIds: [],
      memoryPositions: [],
      pickupPositions: [],
      encounterPositions: [],
      friendlyPositions: [],
      finishPosition: { x: 0, y: 0, z: -25 },
      step: null,
    },
    enemies: [],
    disposed: false,
  };
}

let container: HTMLDivElement;
let root: Root | undefined;
let options: CreateGameOptions | undefined;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  container = document.createElement("div");
  document.body.append(container);
  mocks.createGame.mockReset();
  mocks.api.mockReset();
  options = undefined;
  const handle: GameHandle = {
    updateSave: vi.fn(),
    setInput: vi.fn(),
    cancelInput: vi.fn(),
    clearInput: vi.fn(),
    setPaused: vi.fn(),
    performAction: vi.fn(() => true),
    retryMedia: vi.fn(),
    inspect: vi.fn(() => inspection(status())),
    dispose: vi.fn(),
  };
  mocks.createGame.mockImplementation((next: CreateGameOptions) => {
    options = next;
    next.onStatus?.(status());
    return handle;
  });
});

afterEach(async () => {
  if (root) {
    await act(async () => root!.unmount());
    root = undefined;
  }
  container.remove();
  vi.useRealTimers();
});

const notice = () => container.querySelector<HTMLElement>(".attack-notice");

describe("Memory pickup and attack notice lifecycle", () => {
  it("does not resurrect the collected minor's picture on later attack notices", async () => {
    const save = routeMemorySave();
    root = createRoot(container);
    await act(async () => {
      root!.render(
        <GameScreen initialSave={save} onLeave={vi.fn()} ephemeral />,
      );
    });
    expect(options).toBeDefined();

    // 1. Contact collects the first minor: the brief picture notice appears.
    const collected = structuredClone(save);
    collected.revision += 1;
    collected.memories.find((memory) => memory.id === minorId)!.state =
      "revealed";
    collected.recoveredIds = [minorId];
    mocks.api.mockResolvedValueOnce(collected);
    await act(async () => {
      await options!.onAction({
        actionId: "11111111-1111-4111-8111-111111111111",
        expectedRevision: save.revision,
        action: { type: "recover-memory", levelId, memoryId: minorId },
      });
    });
    expect(notice()?.textContent).toContain("Little memory found");
    expect(notice()?.querySelector("img")).not.toBeNull();

    // 2. Within the 2.3 s window the player taps Attack with nothing in range.
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    await act(async () => {
      options!.onStatus?.({
        ...status(),
        attackFeedback: { sequence: 1, outcome: "no-target" },
      });
    });
    expect(notice()?.textContent).toContain("Move closer to a glowing enemy");
    expect(notice()?.querySelector("img")).toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    // 3. The attack notice expires and nothing is shown.
    await act(async () => {
      vi.advanceTimersByTime(1_900);
    });
    expect(notice()).toBeNull();

    // 4. Much later, an unrelated attack notice must not carry the old picture.
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    await act(async () => {
      options!.onStatus?.({
        ...status(),
        attackFeedback: { sequence: 2, outcome: "no-target" },
      });
    });
    const stalePicture = notice()?.querySelector("img");
    expect(notice()?.textContent).toContain("Move closer to a glowing enemy");
    expect(stalePicture).toBeNull();
  });

  it("clears the picture with the pickup notice when nothing interrupts the window (control)", async () => {
    const save = routeMemorySave();
    root = createRoot(container);
    await act(async () => {
      root!.render(
        <GameScreen initialSave={save} onLeave={vi.fn()} ephemeral />,
      );
    });
    const collected = structuredClone(save);
    collected.revision += 1;
    collected.memories.find((memory) => memory.id === minorId)!.state =
      "revealed";
    collected.recoveredIds = [minorId];
    mocks.api.mockResolvedValueOnce(collected);
    await act(async () => {
      await options!.onAction({
        actionId: "22222222-2222-4222-8222-222222222222",
        expectedRevision: save.revision,
        action: { type: "recover-memory", levelId, memoryId: minorId },
      });
    });
    expect(notice()?.querySelector("img")).not.toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(2_400);
    });
    expect(notice()).toBeNull();
    await act(async () => {
      options!.onStatus?.({
        ...status(),
        attackFeedback: { sequence: 1, outcome: "no-target" },
      });
    });
    expect(notice()?.querySelector("img")).toBeNull();
  });
});
