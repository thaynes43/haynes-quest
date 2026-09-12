// @vitest-environment jsdom
// WO068 probe: GameScreen gates the chapter/completion celebration on a
// synchronous contextState === "running" read (src/client/GameScreen.tsx:452-457).
// The effect only re-runs when the modal identity changes, so whenever audio is
// not already running at the instant the panel opens - first entry, a reload on
// a finished journey, or any iOS interruption/background return - the
// celebration is skipped and never retried after the next gesture unlocks audio.
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
import { FakeAudioContext } from "./fakes";

const mocks = vi.hoisted(() => ({ createGame: vi.fn() }));
vi.mock("../../../src/game/index", () => ({ createGame: mocks.createGame }));

import { GameScreen } from "../../../src/client/GameScreen";

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

async function renderGame(save: SaveView) {
  root = createRoot(container);
  await act(async () => {
    root!.render(<GameScreen initialSave={save} onLeave={vi.fn()} />);
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  mocks.createGame.mockReset();
  globalThis.localStorage.clear();
});

afterEach(async () => {
  if (root) {
    await act(async () => root!.unmount());
    root = undefined;
  }
  container.remove();
});

describe("GameScreen celebration cue after a late audio unlock", () => {
  it("plays the celebration once the player's gesture unlocks audio", async () => {
    const context = new FakeAudioContext();
    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: function AudioContextStub() {
        return context;
      },
    });
    const fetcher = vi.fn(
      async () => new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 }),
    );
    globalThis.fetch = fetcher as unknown as typeof fetch;
    gameFixture();

    // The journey is finished: the completion panel renders before any gesture.
    await renderGame(makeEraSave({ completed: true }));
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();

    // The player taps the panel. GameScreen's document-level gesture listeners
    // unlock Web Audio and the context reaches "running".
    await act(async () => {
      document.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(context.state).toBe("running");

    const requested = fetcher.mock.calls.map((call) => String((call as unknown[])[0]));
    expect(requested.some((path) => path.includes("ui-confirmed"))).toBe(true);
    expect(requested.some((path) => path.includes("ability-unlocked"))).toBe(
      true,
    );
  });
});
