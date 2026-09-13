// @vitest-environment jsdom
/** WO083 probe: a resize while the stick is held. */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateGameOptions, GameHandle, GameStatus } from "../../../src/game/types";
import { makeEraSave } from "../../game/fixtures";

const mocks = vi.hoisted(() => ({ createGame: vi.fn(), api: vi.fn() }));
vi.mock("../../../src/game/index", () => ({ createGame: mocks.createGame }));
vi.mock("../../../src/client/api", () => ({
  api: mocks.api,
  friendlyError: (e: unknown) => String(e),
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
    preferences() { return { muted: false, volume: 0.8 }; }
    status() { return { contextState: "suspended" }; }
  },
}));

import { GameScreen } from "../../../src/client/GameScreen";

const levelId = "level-1-2020";
function status(): GameStatus {
  return {
    nearFriendlyId: null, nearPickupId: null, nearEncounterId: null,
    nearMemoryId: null, nearFinish: false, canConsume: false,
    position: { x: 0, y: 0, z: -3 }, ageYears: 0, appearanceStage: "infant",
    abilities: ["move", "interact", "jump"], grounded: true, playerHp: 8,
    maxPlayerHp: 10, phase: "exploring", activeLevelId: levelId, eraYear: 2020,
    attackReady: false, attackFeedback: null, guardActive: false,
    guardReady: false, requestBusy: false, requestState: "idle",
    requestError: null, requestErrorCode: null, mediaLoading: 0, mediaFailed: 0,
  };
}

let container: HTMLDivElement;
let root: Root | undefined;
let setInput: ReturnType<typeof vi.fn>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  mocks.createGame.mockReset();
  setInput = vi.fn();
  const handle = {
    updateSave: vi.fn(), setInput, cancelInput: vi.fn(), clearInput: vi.fn(),
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

function pointer(
  el: Element, type: string, pointerId: number, clientX: number, clientY: number,
) {
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true, pointerId, pointerType: "touch", clientX, clientY, isPrimary: true,
    }),
  );
}

describe("WO083 probe: joystick resize while held", () => {
  it("stops responding to the held finger after a resize", async () => {
    const save = structuredClone(makeEraSave({ collectedKinds: ["attack-tool"] }));
    save.adventure!.planVersion = "era-level-plan-v3";
    root = createRoot(container);
    await act(async () =>
      root!.render(<GameScreen initialSave={save} onLeave={vi.fn()} ephemeral />),
    );
    const stick = container.querySelector('[data-testid="joystick"]')!;
    Object.defineProperty(stick, "getBoundingClientRect", {
      value: () => ({ x: 20, y: 500, width: 176, height: 176, top: 500, left: 20, right: 196, bottom: 676 }),
      configurable: true,
    });
    (stick as HTMLElement).setPointerCapture = () => {};
    (stick as HTMLElement).hasPointerCapture = () => true;
    (stick as HTMLElement).releasePointerCapture = () => {};

    await act(async () => pointer(stick, "pointerdown", 1, 108, 540));
    await act(async () => pointer(stick, "pointermove", 1, 140, 540));
    const beforeResize = setInput.mock.calls.filter(([a]) => a === "moveX").at(-1);
    console.log("moveX after press+move:", beforeResize);
    expect(beforeResize?.[1]).not.toBe(0);

    setInput.mockClear();
    await act(async () => window.dispatchEvent(new Event("resize")));
    console.log("setInput on resize:", setInput.mock.calls);

    setInput.mockClear();
    await act(async () => pointer(stick, "pointermove", 1, 30, 540));
    console.log("setInput for the still-held finger after resize:", setInput.mock.calls);
    expect(setInput.mock.calls.filter(([a]) => a === "moveX")).toHaveLength(0);

    // Lifting and re-pressing restores it.
    await act(async () => pointer(stick, "pointerup", 1, 30, 540));
    await act(async () => pointer(stick, "pointerdown", 2, 60, 540));
    console.log("after re-press:", setInput.mock.calls.filter(([a]) => a === "moveX").at(-1));
    expect(setInput.mock.calls.filter(([a]) => a === "moveX").at(-1)?.[1]).not.toBe(0);
  });
});
