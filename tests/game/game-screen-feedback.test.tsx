// @vitest-environment jsdom
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
  audioStartResults: [] as boolean[],
  audioVolume: 0.35,
  audioInstances: [] as Array<{
    start: ReturnType<typeof vi.fn>;
    cue: ReturnType<typeof vi.fn>;
    audition: ReturnType<typeof vi.fn>;
    suspend: ReturnType<typeof vi.fn>;
    setPaused: ReturnType<typeof vi.fn>;
    setPreferences: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("../../src/game/index", () => ({
  createGame: mocks.createGame,
}));

vi.mock("../../src/client/audio", () => ({
  QuestAudio: class {
    readonly start = vi.fn(async () => mocks.audioStartResults.shift() ?? true);
    readonly cue = vi.fn(async () => true);
    readonly audition = vi.fn(async () => true);
    readonly suspend = vi.fn();
    readonly setPaused = vi.fn();
    readonly setPreferences = vi.fn();
    readonly dispose = vi.fn();

    constructor() {
      mocks.audioInstances.push(this);
    }

    preferences() {
      return { muted: false, volume: mocks.audioVolume };
    }

    status() {
      return { contextState: "suspended" };
    }
  },
}));

import { GameScreen } from "../../src/client/GameScreen";

const friend = {
  id: "level-1-2020-friendly-blockling",
  assetId: "blockling",
  assetVersion: "v001",
  hp: 4,
  maxHp: 4,
  defeated: false,
  boonClaimed: false,
  penaltyActive: false,
} as const;

function friendlySave(): SaveView {
  const save = structuredClone(
    makeEraSave({ playerHp: 8, collectedKinds: ["attack-tool"] }),
  );
  save.adventure!.activeLevel!.friendlies = [{ ...friend }];
  return save;
}

function status(nearFriendlyId: string | null = friend.id): GameStatus {
  return {
    nearFriendlyId,
    nearPickupId: null,
    nearEncounterId: null,
    nearMemoryId: null,
    nearFinish: false,
    canConsume: false,
    position: { x: 3.7, y: 0, z: 0.2 },
    ageYears: 0,
    appearanceStage: "infant",
    abilities: ["move", "interact"],
    grounded: true,
    playerHp: 8,
    maxPlayerHp: 10,
    phase: "exploring",
    activeLevelId: "level-1-2020",
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

function inspection(currentStatus: GameStatus): GameInspection {
  return {
    status: currentStatus,
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
      id: "level-1-2020",
      memoryIds: [],
      memoryPositions: [],
      pickupPositions: [],
      encounterPositions: [],
      friendlyPositions: [
        { id: friend.id, assetId: friend.assetId, x: 3.7, y: 0, z: 0.2 },
      ],
      finishPosition: { x: 0, y: 0, z: -25 },
      step: null,
    },
    enemies: [],
    disposed: false,
  };
}

function gameFixture(initialStatus = status()) {
  let liveStatus = initialStatus;
  let pauseSawDialog: boolean | undefined;
  const handle: GameHandle = {
    updateSave: vi.fn(),
    setInput: vi.fn(),
    cancelInput: vi.fn(),
    clearInput: vi.fn(),
    setPaused: vi.fn((paused: boolean) => {
      if (paused && pauseSawDialog === undefined)
        pauseSawDialog = Boolean(document.querySelector('[role="dialog"]'));
    }),
    performAction: vi.fn(() => true),
    retryMedia: vi.fn(),
    inspect: vi.fn(() => inspection(liveStatus)),
    dispose: vi.fn(),
  };
  mocks.createGame.mockImplementation((options: CreateGameOptions) => {
    options.onStatus?.(liveStatus);
    return handle;
  });
  return {
    handle,
    pauseSawDialog: () => pauseSawDialog,
    setLiveStatus(next: GameStatus) {
      liveStatus = next;
    },
  };
}

let container: HTMLDivElement;
let root: Root | undefined;

async function renderGame(save = friendlySave()) {
  root = createRoot(container);
  await act(async () => {
    root!.render(<GameScreen initialSave={save} onLeave={vi.fn()} />);
  });
}

function button(selector: string): HTMLButtonElement {
  const candidate = container.querySelector<HTMLButtonElement>(selector);
  if (!candidate) throw new Error(`Missing button ${selector}`);
  return candidate;
}

function buttonNamed(name: string): HTMLButtonElement {
  const candidate = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find((entry) => entry.textContent?.includes(name));
  if (!candidate) throw new Error(`Missing button named ${name}`);
  return candidate;
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  mocks.createGame.mockReset();
  mocks.audioStartResults.length = 0;
  mocks.audioVolume = 0.35;
  mocks.audioInstances.length = 0;
});

afterEach(async () => {
  if (root) {
    await act(async () => root!.unmount());
    root = undefined;
  }
  container.remove();
});

describe("GameScreen friendly and audio feedback boundaries", () => {
  it("acknowledges a sound tap immediately, reports failure and permits another tap", async () => {
    gameFixture(status(null));
    await renderGame();
    await act(async () => button('[aria-label="How to play"]').click());
    const audio = mocks.audioInstances[0]!;
    let finish!: (played: boolean) => void;
    audio.audition.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    await act(async () => buttonNamed("Play a test sound").click());
    expect(container.querySelector("#sound-test-status")?.textContent).toBe(
      "Starting sound…",
    );
    expect(buttonNamed("Play a test sound").disabled).toBe(false);
    await act(async () => finish(false));
    expect(
      container.querySelector("#sound-test-status")?.textContent,
    ).toContain("Tap again to retry");
    await act(async () => buttonNamed("Play a test sound").click());
    expect(
      container.querySelector("#sound-test-status")?.textContent,
    ).toContain("Test sound played");
    expect(audio.audition).toHaveBeenCalledTimes(2);
  });

  it("keeps the persistent world-tap instruction out of the play surface", async () => {
    gameFixture(status(null));
    await renderGame();
    expect(container.querySelector(".touch-jump-hint")).toBeNull();
    await act(async () => button('[aria-label="How to play"]').click());
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
      "Tap the world to jump",
    );
  });

  it("retries an interrupted celebration from a gesture and plays it only once", async () => {
    gameFixture(status(null));
    await renderGame(makeEraSave({ completed: true }));
    const audio = mocks.audioInstances[0]!;
    expect(audio.audition).not.toHaveBeenCalled();
    await act(async () => {
      for (const type of ["pointerdown", "pointerup", "touchend", "click"])
        document.dispatchEvent(new Event(type, { bubbles: true }));
    });
    expect(audio.audition).toHaveBeenCalledExactlyOnceWith("ability-unlocked");
    await act(async () => {
      document.dispatchEvent(new Event("keydown", { bubbles: true }));
      root!.unmount();
    });
    root = undefined;
    document.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(audio.audition).toHaveBeenCalledOnce();
  });

  it("labels zero volume as off and restores audible volume when enabled", async () => {
    gameFixture(status(null));
    mocks.audioVolume = 0;
    await renderGame();
    await act(async () => button('[aria-label="Enable sound"]').click());
    expect(mocks.audioInstances[0]!.setPreferences).toHaveBeenCalledWith(
      false,
      0.8,
    );
    expect(button('[aria-label="Mute sound"]').textContent).toContain(
      "Sound on",
    );
  });

  it("rejects a stale visible friendly prompt without opening or freezing the world", async () => {
    const game = gameFixture();
    await renderGame();
    const prompt = button(".friendly-prompt");
    vi.mocked(game.handle.setPaused).mockClear();
    game.setLiveStatus(status(null));

    await act(async () => prompt.click());

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(game.handle.setPaused).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Land beside your friend to say hello.",
    );
  });

  it("synchronously pauses a freshly validated nearby world before opening the friend dialog", async () => {
    const game = gameFixture();
    await renderGame();
    vi.mocked(game.handle.setPaused).mockClear();

    await act(async () => button(".friendly-prompt").click());

    expect(game.handle.setPaused).toHaveBeenCalledWith(true);
    expect(game.pauseSawDialog()).toBe(false);
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
      "Blockling",
    );
  });

  it("shows feedback when the runtime rejects an explicit friendly action", async () => {
    const game = gameFixture();
    game.handle.performAction = vi.fn(() => false);
    await renderGame();
    await act(async () => button(".friendly-prompt").click());

    await act(async () => buttonNamed("Say hello · +2 health").click());

    expect(game.handle.performAction).toHaveBeenCalledWith({
      type: "interact-friendly",
      levelId: "level-1-2020",
      friendlyId: friend.id,
    });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "That action isn’t ready yet. Keep exploring and try again.",
    );
  });

  it("retries audio unlock on pointerup and removes every gesture listener on cleanup", async () => {
    gameFixture(status(null));
    mocks.audioStartResults.push(false, true);
    await renderGame();
    const audio = mocks.audioInstances[0]!;

    await act(async () => {
      document.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(audio.start).toHaveBeenCalledOnce();
    await expect(audio.start.mock.results[0]!.value).resolves.toBe(false);

    await act(async () => {
      document.dispatchEvent(new Event("pointerup", { bubbles: true }));
    });
    expect(audio.start).toHaveBeenCalledTimes(2);
    await expect(audio.start.mock.results[1]!.value).resolves.toBe(true);

    await act(async () => root!.unmount());
    root = undefined;
    expect(audio.dispose).toHaveBeenCalledOnce();
    document.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    document.dispatchEvent(new Event("pointerup", { bubbles: true }));
    document.dispatchEvent(new Event("touchend", { bubbles: true }));
    document.dispatchEvent(new Event("click", { bubbles: true }));
    document.dispatchEvent(new Event("keydown", { bubbles: true }));
    expect(audio.start).toHaveBeenCalledTimes(2);
  });
});
