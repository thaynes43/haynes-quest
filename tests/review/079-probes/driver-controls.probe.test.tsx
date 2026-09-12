// @vitest-environment jsdom
/**
 * WO079 adversarial probe: the new authored browser driver
 * (tests/e2e/authored-browser-driver.mjs) jumps by tapping a touch control it
 * resolves with getByRole("button", { name: "Jump", exact: true }). PLAN007
 * replaced that cluster with world taps and PLAN008 removed the jump hint, so
 * the control no longer exists. This renders the real GameScreen and lists
 * every accessible button name the touch HUD offers.
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CreateGameOptions,
  GameHandle,
  GameInspection,
  GameStatus,
} from "../../../src/game/types";
import { makeEraSave } from "../../game/fixtures";

const mocks = vi.hoisted(() => ({ createGame: vi.fn() }));

vi.mock("../../../src/game/index", () => ({ createGame: mocks.createGame }));
vi.mock("../../../src/client/audio", () => ({
  QuestAudio: class {
    readonly start = vi.fn(async () => true);
    readonly cue = vi.fn(async () => true);
    readonly audition = vi.fn(async () => true);
    readonly suspend = vi.fn();
    readonly setPaused = vi.fn();
    readonly setPreferences = vi.fn();
    readonly dispose = vi.fn();
    preferences() {
      return { muted: false, volume: 0.35 };
    }
    status() {
      return { contextState: "running" };
    }
  },
}));

import { GameScreen } from "../../../src/client/GameScreen";

function status(): GameStatus {
  return {
    nearFriendlyId: null,
    nearPickupId: null,
    nearEncounterId: null,
    nearMemoryId: null,
    nearFinish: false,
    canConsume: false,
    position: { x: 0, y: 0, z: 1 },
    ageYears: 0,
    appearanceStage: "infant",
    abilities: ["move", "interact", "jump"],
    grounded: true,
    playerHp: 10,
    maxPlayerHp: 10,
    phase: "exploring",
    activeLevelId: "level-1-2020",
    eraYear: 2020,
    attackReady: true,
    attackFeedback: null,
    guardActive: false,
    guardReady: true,
    requestBusy: false,
    requestState: "idle",
    requestError: null,
    requestErrorCode: null,
    mediaLoading: 0,
    mediaFailed: 0,
  } as GameStatus;
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
      id: "level-1-2020",
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
  } as unknown as GameInspection;
}

let container: HTMLDivElement;
let root: Root | undefined;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  mocks.createGame.mockReset();
});

afterEach(async () => {
  if (root) {
    await act(async () => root!.unmount());
    root = undefined;
  }
  container.remove();
});

describe("WO079 probe: authored browser driver touch controls", () => {
  it("DEFECT: the rendered touch HUD has no button named Jump, which the new driver requires", async () => {
    const current = status();
    const handle: GameHandle = {
      updateSave: vi.fn(),
      setInput: vi.fn(),
      cancelInput: vi.fn(),
      clearInput: vi.fn(),
      setPaused: vi.fn(),
      performAction: vi.fn(() => true),
      retryMedia: vi.fn(),
      inspect: vi.fn(() => inspection(current)),
      dispose: vi.fn(),
    };
    mocks.createGame.mockImplementation((options: CreateGameOptions) => {
      options.onStatus?.(current);
      return handle;
    });
    // Render the route-memory HUD the authored playtest actually drives.
    const save = structuredClone(
      makeEraSave({ playerHp: 10, collectedKinds: ["attack-tool", "guard-tool"] }),
    );
    const active = save.adventure!.activeLevel!;
    active.routeId = "garden-playground-v1";
    active.minorMemoryIds = [
      active.memoryIds[0] ?? "memory-age-0",
      active.memoryIds[1] ?? "memory-age-2",
    ];
    active.majorMemoryId = active.memoryIds.at(-1) ?? "memory-age-4";
    root = createRoot(container);
    await act(async () => {
      root!.render(<GameScreen initialSave={save} onLeave={vi.fn()} />);
    });

    const names = [...container.querySelectorAll("button")].map((element) =>
      (
        element.getAttribute("aria-label") ??
        element.textContent ??
        ""
      ).trim(),
    );
     
    console.log(JSON.stringify({ renderedButtonNames: names }));
    // The two action controls the playtest taps exist; the jump control does not.
    expect(names).toContain("Attack");
    expect(names).toContain("Bash");
    expect(names).not.toContain("Jump");
    expect(container.querySelector('[data-testid="joystick"]')).not.toBeNull();

    // The new driver hard-depends on that missing control.
    const driver = readFileSync("tests/e2e/authored-browser-driver.mjs", "utf8");
    expect(driver).toContain('name: "Jump", exact: true');
    expect(driver).toContain("touch Jump control is unavailable");
    const playtest = readFileSync("tests/e2e/authored-playtest.mjs", "utf8");
    // The playtest has no keyboard fallback: touch controls are the only path.
    expect(playtest).toContain("createTouchControls");
    expect(playtest).not.toContain("keyboard.press");
  });
});
