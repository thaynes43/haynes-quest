// @vitest-environment jsdom
/**
 * DESIGN-027 on the game screen: the device's Scary moments switch reaches the
 * game, scare events play their cues (a cue the manifest lacks simply stays
 * silent), the ambience asks again once audio unlocks, and a jump scare's
 * lunge plays out before the normal checkpoint return.
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CreateGameOptions,
  GameHandle,
  GameStatus,
} from "../../src/game/types";
import type { SaveView } from "../../src/shared/contracts";
import { makeEraSave } from "./fixtures";

const mocks = vi.hoisted(() => ({
  createGame: vi.fn(),
  api: vi.fn(),
  sounds: [] as Array<{
    start: ReturnType<typeof vi.fn>;
    feedback: ReturnType<typeof vi.fn>;
    cue: ReturnType<typeof vi.fn>;
    loop: ReturnType<typeof vi.fn>;
    setPaused: ReturnType<typeof vi.fn>;
  }>,
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
    readonly loop = vi.fn(async () => true);
    readonly audition = vi.fn(async () => true);
    readonly suspend = vi.fn();
    readonly setPaused = vi.fn();
    readonly setPreferences = vi.fn();
    readonly dispose = vi.fn();
    constructor() {
      mocks.sounds.push({
        start: this.start,
        feedback: this.feedback,
        cue: this.cue,
        loop: this.loop,
        setPaused: this.setPaused,
      });
    }
    preferences() {
      return { muted: false, volume: 0.8 };
    }
    status() {
      return { contextState: "suspended" };
    }
  },
}));

import { GameScreen } from "../../src/client/GameScreen";
import { SCARY_MOMENTS_STORAGE_KEY } from "../../src/client/scary-moments";

function status(extra: Partial<GameStatus> = {}): GameStatus {
  return {
    nearFriendlyId: null,
    nearPickupId: null,
    nearEncounterId: null,
    nearMemoryId: null,
    nearFinish: false,
    canConsume: false,
    position: { x: 0, y: 0, z: -3 },
    ageYears: 8,
    appearanceStage: "child",
    abilities: ["move", "interact", "jump"],
    grounded: true,
    playerHp: 10,
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
    ...extra,
  };
}

let container: HTMLDivElement;
let root: Root | undefined;
let options: CreateGameOptions | undefined;
let handle: GameHandle;

beforeEach(() => {
  localStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  mocks.createGame.mockReset();
  mocks.api.mockReset();
  mocks.sounds.length = 0;
  options = undefined;
  mocks.createGame.mockImplementation((next: CreateGameOptions) => {
    options = next;
    next.onStatus?.(status());
    handle = {
      updateSave: vi.fn(),
      setInput: vi.fn(),
      cancelInput: vi.fn(),
      clearInput: vi.fn(),
      setPaused: vi.fn(),
      performAction: vi.fn(() => true),
      retryMedia: vi.fn(),
      inspect: vi.fn(() => ({ status: status() })),
      dispose: vi.fn(),
    } as unknown as GameHandle;
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

async function render(save: SaveView = makeEraSave({ collectedKinds: ["attack-tool"] })) {
  root = createRoot(container);
  await act(async () =>
    root!.render(<GameScreen initialSave={save} onLeave={vi.fn()} ephemeral />),
  );
}

describe("scary moments on the game screen", () => {
  it("passes the device switch to the game: on by default, off once turned off", async () => {
    await render();
    expect(options!.scaryMoments).toBe(true);
    await act(async () => root!.unmount());
    root = undefined;
    localStorage.setItem(SCARY_MOMENTS_STORAGE_KEY, "off");
    await render();
    expect(options!.scaryMoments).toBe(false);
  });

  it("keeps playing when the device's storage refuses to answer", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    await render();
    expect(options!.scaryMoments).toBe(true);
    getItem.mockRestore();
  });

  it("plays each scare event's cue and loops the ambience", async () => {
    await render();
    const sound = mocks.sounds[0]!;
    const report = options!.onFeedback!;
    report({ type: "watcher-creak", encounterId: "moth" });
    report({ type: "blackout-return" });
    report({ type: "ambient-laugh" });
    report({ type: "radio-static", encounterId: "showman" });
    report({ type: "scare-ambient-loop", active: true });
    report({ type: "scare-ambient-loop", active: false });
    expect(sound.cue.mock.calls).toEqual([
      ["servo-creak"],
      ["light-buzz"],
      ["distant-laugh"],
      ["radio-static"],
    ]);
    expect(sound.loop.mock.calls).toEqual([
      ["casino-hum", true],
      ["casino-hum", false],
    ]);
  });

  it("asks for the ambience again once a gesture unlocks audio", async () => {
    await render();
    const sound = mocks.sounds[0]!;
    await act(async () => options!.onFeedback!({ type: "scare-ambient-loop", active: true }));
    expect(sound.loop.mock.calls).toEqual([["casino-hum", true]]);
    await act(async () => {
      document.dispatchEvent(new Event("click"));
      await Promise.resolve();
    });
    expect(sound.start).toHaveBeenCalled();
    expect(sound.loop.mock.calls).toEqual([
      ["casino-hum", true],
      ["casino-hum", true],
    ]);
    await act(async () => options!.onFeedback!({ type: "scare-ambient-loop", active: false }));
    await act(async () => {
      document.dispatchEvent(new Event("click"));
      await Promise.resolve();
    });
    expect(sound.loop.mock.calls.at(-1)).toEqual(["casino-hum", false]);
  });

  it("lets the lunge play before the checkpoint return", async () => {
    vi.useFakeTimers();
    const save = makeEraSave({ collectedKinds: ["attack-tool"] });
    await render(save);
    const sound = mocks.sounds[0]!;
    sound.setPaused.mockClear();
    const levelId = save.adventure!.activeLevel!.id;
    const fallen = structuredClone(save);
    fallen.revision += 1;
    fallen.adventure!.phase = "fallen";
    fallen.adventure!.playerHp = 0;
    mocks.api.mockResolvedValueOnce(fallen);
    // The lethal take-hit's reply arrives, then the runtime starts the lunge.
    await act(async () => {
      await options!.onAction({
        actionId: "lethal",
        expectedRevision: save.revision,
        action: { type: "take-hit", levelId, encounterId: "rat" },
      });
      options!.onFeedback!({ type: "jump-scare", encounterId: "rat", durationMs: 900 });
    });
    expect(sound.cue.mock.calls).toContainEqual(["jump-scare-sting"]);
    const screen = container.querySelector(".game-screen")!;
    expect(screen.getAttribute("data-jump-scare")).toBe("true");
    expect(container.querySelector(".checkpoint-return")).toBeNull();
    // Neither the game nor its sound pauses while the sting plays.
    expect(sound.setPaused).not.toHaveBeenCalledWith(true);
    expect(handle.setPaused).not.toHaveBeenCalledWith(true);
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(handle.performAction).not.toHaveBeenCalled();
    expect(container.querySelector(".checkpoint-return")).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.getAttribute("data-jump-scare")).toBeNull();
    expect(container.querySelector(".checkpoint-return")).not.toBeNull();
    expect(sound.setPaused).toHaveBeenCalledWith(true);
    expect(handle.performAction).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    expect(handle.performAction).toHaveBeenCalledExactlyOnceWith({
      type: "retry-level",
      levelId,
    });
  });
});
