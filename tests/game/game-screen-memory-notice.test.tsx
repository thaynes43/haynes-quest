// @vitest-environment jsdom
/**
 * PLAN011: collected pictures stay in the peripheral HUD; attacking never
 * replaces them with instructions or opens an interaction dialog.
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
  vi.unstubAllGlobals();
});

const memorySlots = () => container.querySelector<HTMLElement>(".memory-slots");

async function renderRoute(save = routeMemorySave(), onLeave = vi.fn()) {
  root = createRoot(container);
  await act(async () =>
    root!.render(<GameScreen initialSave={save} onLeave={onLeave} ephemeral />),
  );
  return mocks.createGame.mock.results[0]!.value as GameHandle;
}

describe("Peripheral memory feedback and automatic recovery", () => {
  it("shows boss health only after the fight engages", async () => {
    const save = routeMemorySave();
    save.adventure!.activeLevel!.encounters.find(
      (enemy) => enemy.role === "boss",
    )!.available = true;
    await renderRoute(save);
    expect(container.querySelector(".boss-hud")).toBeNull();
    await act(async () =>
      options!.onStatus?.({ ...status(), bossEngaged: true }),
    );
    expect(container.querySelector(".boss-hud")).not.toBeNull();
    await act(async () =>
      options!.onStatus?.({ ...status(), bossEngaged: false }),
    );
    expect(container.querySelector(".boss-hud")).toBeNull();
  });

  it("explains a refused checkpoint dispatch and permits a manual retry", async () => {
    const save = routeMemorySave();
    save.adventure!.phase = "fallen";
    const handle = await renderRoute(save);
    vi.mocked(handle.performAction).mockReturnValueOnce(false);
    await act(async () => {
      vi.advanceTimersByTime(650);
    });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.textContent).toContain(
      "The checkpoint retry could not start.",
    );
    const retry = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Return to checkpoint",
    );
    await act(async () => retry!.click());
    expect(handle.performAction).toHaveBeenCalledTimes(2);
  });

  it("preserves a concrete runtime error when a checkpoint request is refused", async () => {
    const save = routeMemorySave();
    save.adventure!.phase = "fallen";
    const handle = await renderRoute(save);
    vi.mocked(handle.performAction).mockReturnValueOnce(false);
    vi.mocked(handle.inspect).mockReturnValue(
      inspection({
        ...status(),
        requestErrorCode: "SECURE_RANDOM_UNAVAILABLE",
      }),
    );
    await act(async () => {
      vi.advanceTimersByTime(650);
    });
    expect(container.textContent).toContain("SECURE_RANDOM_UNAVAILABLE");
    expect(container.textContent).not.toContain(
      "The checkpoint retry could not start.",
    );
  });

  it("keeps the same movement finger through a resized viewport, but clears it on rotation", async () => {
    vi.stubGlobal("innerWidth", 390);
    vi.stubGlobal("innerHeight", 844);
    const handle = await renderRoute();
    const stick = container.querySelector<HTMLElement>(
      '[data-testid="joystick"]',
    )!;
    let top = 500;
    stick.getBoundingClientRect = () => ({
      x: 20,
      y: top,
      width: 176,
      height: 176,
      top,
      left: 20,
      right: 196,
      bottom: top + 176,
      toJSON: () => ({}),
    });
    stick.setPointerCapture = () => {};
    const contact = (type: string, x: number, y: number) =>
      stick.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId: 1,
          pointerType: "touch",
          clientX: x,
          clientY: y,
        }),
      );
    await act(async () => {
      contact("pointerdown", 108, 588);
      contact("pointermove", 140, 588);
    });
    expect(
      vi
        .mocked(handle.setInput)
        .mock.calls.filter(([axis]) => axis === "moveX")
        .at(-1)![1],
    ).toBeGreaterThan(0);
    top = 480;
    vi.stubGlobal("innerHeight", 824);
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });
    // Bounds moved up: the stationary finger is now below the new centre.
    expect(
      vi
        .mocked(handle.setInput)
        .mock.calls.filter(([axis]) => axis === "moveY")
        .at(-1)![1],
    ).toBeLessThan(0);
    await act(async () => {
      contact("pointermove", 60, 568);
    });
    expect(
      vi
        .mocked(handle.setInput)
        .mock.calls.filter(([axis]) => axis === "moveX")
        .at(-1)![1],
    ).toBeLessThan(0);
    vi.stubGlobal("innerWidth", 844);
    vi.stubGlobal("innerHeight", 390);
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(handle.setInput).toHaveBeenLastCalledWith("moveY", 0);
    vi.mocked(handle.setInput).mockClear();
    await act(async () => {
      contact("pointermove", 140, 588);
    });
    expect(handle.setInput).not.toHaveBeenCalled();
    await act(async () => {
      contact("pointerdown", 140, 588);
    });
    expect(handle.setInput).toHaveBeenCalled();
  });

  it("keeps a collected picture in the HUD while repeated empty attacks show no prose or popup", async () => {
    const save = routeMemorySave();
    await renderRoute(save);
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
    expect(memorySlots()?.querySelectorAll("img")).toHaveLength(1);
    for (let sequence = 1; sequence <= 10; sequence++) {
      await act(async () => {
        options!.onStatus?.({
          ...status(),
          attackFeedback: { sequence, outcome: "no-target" },
        });
        vi.advanceTimersByTime(300);
      });
      expect(container.textContent).not.toContain("Move closer");
      expect(container.querySelector(".attack-notice")).toBeNull();
      expect(container.querySelector('[role="dialog"]')).toBeNull();
    }
    expect(memorySlots()?.querySelectorAll("img")).toHaveLength(1);
    expect(
      container.querySelector(
        '[aria-label="1 of 2 little memories collected"]',
      ),
    ).not.toBeNull();
  });

  it("automatically requests one checkpoint retry after defeat without offering a fresh start", async () => {
    const save = routeMemorySave();
    save.adventure!.phase = "fallen";
    save.adventure!.playerHp = 0;
    const onLeave = vi.fn();
    const handle = await renderRoute(save, onLeave);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(650);
    });
    expect(handle.performAction).toHaveBeenCalledExactlyOnceWith({
      type: "retry-level",
      levelId,
    });
    await act(async () => {
      options!.onStatus?.({ ...status(), phase: "fallen", requestBusy: true });
      vi.advanceTimersByTime(1000);
    });
    await act(async () => {
      options!.onStatus?.({ ...status(), phase: "fallen", requestBusy: false });
      vi.advanceTimersByTime(2000);
    });
    expect(handle.performAction).toHaveBeenCalledTimes(1);
    expect(onLeave).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Play again");
  });

  it("keeps the journey paused and offers a bounded retry when checkpoint recovery fails", async () => {
    const save = routeMemorySave();
    save.adventure!.phase = "fallen";
    const handle = await renderRoute(save);
    await act(async () => {
      vi.advanceTimersByTime(650);
    });
    await act(async () => {
      options!.onStatus?.({
        ...status(),
        phase: "fallen",
        requestState: "error",
        requestErrorCode: "network_error",
      });
    });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    const retry = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Return to checkpoint",
    );
    expect(retry).toBeDefined();
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(handle.performAction).toHaveBeenCalledTimes(1);
    await act(async () => retry!.click());
    expect(handle.performAction).toHaveBeenCalledTimes(2);
  });

  it("cancels pending automatic recovery when the game unmounts", async () => {
    const save = routeMemorySave();
    save.adventure!.phase = "fallen";
    const handle = await renderRoute(save);
    await act(async () => root!.unmount());
    root = undefined;
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(handle.performAction).not.toHaveBeenCalled();
  });
});
