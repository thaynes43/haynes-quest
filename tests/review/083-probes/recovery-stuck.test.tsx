// @vitest-environment jsdom
/** WO083 probe: what the player can still do while automatic recovery is in flight. */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CreateGameOptions,
  GameHandle,
  GameInspection,
  GameStatus,
} from "../../../src/game/types";
import type { SaveView } from "../../../src/shared/contracts";
import { makeEraSave } from "../../game/fixtures";

const mocks = vi.hoisted(() => ({ createGame: vi.fn(), api: vi.fn() }));
vi.mock("../../../src/game/index", () => ({ createGame: mocks.createGame }));
vi.mock("../../../src/client/api", () => ({
  api: mocks.api,
  friendlyError: (error: unknown) => String(error),
}));
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
    preferences() {
      return { muted: false, volume: 0.8 };
    }
    status() {
      return { contextState: "suspended" };
    }
  },
}));

import { GameScreen } from "../../../src/client/GameScreen";

const levelId = "level-1-2020";

function routeMemorySave(): SaveView {
  const save = structuredClone(makeEraSave({ collectedKinds: ["attack-tool"] }));
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
    playerHp: 0,
    maxPlayerHp: 10,
    phase: "fallen",
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
    input: { moveX: 0, moveY: 0, lookX: 0, lookY: 0, jump: false, interact: false, attack: false, guard: false },
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
let handle: GameHandle;
let performAction: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  container = document.createElement("div");
  document.body.append(container);
  mocks.createGame.mockReset();
  mocks.api.mockReset();
  options = undefined;
  performAction = vi.fn(() => true);
  handle = {
    updateSave: vi.fn(),
    setInput: vi.fn(),
    cancelInput: vi.fn(),
    clearInput: vi.fn(),
    setPaused: vi.fn(),
    performAction: performAction as unknown as GameHandle["performAction"],
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

async function renderFallen() {
  const save = routeMemorySave();
  save.adventure!.phase = "fallen";
  save.adventure!.playerHp = 0;
  root = createRoot(container);
  await act(async () =>
    root!.render(<GameScreen initialSave={save} onLeave={vi.fn()} ephemeral />),
  );
  return save;
}

function reachableButtons(): string[] {
  const overlay = container.querySelector<HTMLElement>(".checkpoint-return");
  return [...container.querySelectorAll("button")].map(
    (button) =>
      `${button.getAttribute("aria-label") ?? button.textContent}${button.disabled ? " [disabled]" : ""}${overlay && !overlay.contains(button) ? " [under overlay z25]" : ""}`,
  );
}

describe("WO083 probe: automatic recovery that never settles", () => {
  it("leaves no usable control while the retry request stays in flight", async () => {
    await renderFallen();
    await act(async () => {
      vi.advanceTimersByTime(650);
    });
    expect(performAction).toHaveBeenCalledTimes(1);
    // The request is accepted and never settles: requestBusy stays true.
    await act(async () => {
      options!.onStatus?.({ ...status(), requestBusy: true, requestState: "acting" });
    });
    for (let minute = 0; minute < 5; minute += 1)
      await act(async () => {
        vi.advanceTimersByTime(60_000);
      });
    console.log("overlay present:", Boolean(container.querySelector(".checkpoint-return")));
    console.log("dialog present:", Boolean(container.querySelector('[role="dialog"]')));
    console.log("buttons:", reachableButtons());
    console.log("performAction calls:", performAction.mock.calls.length);
    expect(container.querySelector(".checkpoint-return")).not.toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(performAction).toHaveBeenCalledTimes(1);
  });

  it("shows the failure modal when the dispatch is merely refused, with no real error", async () => {
    performAction.mockReturnValue(false);
    await renderFallen();
    await act(async () => {
      vi.advanceTimersByTime(650);
    });
    console.log("dialog text:", container.querySelector('[role="dialog"]')?.textContent);
    console.log("buttons:", reachableButtons());
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });
});
