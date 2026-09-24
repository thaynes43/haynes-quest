// @vitest-environment jsdom
/**
 * DESIGN-022: the HUD counts casino tokens and golden tickets, the chapter
 * ending keeps the haul, and runtime feedback drives immediate sounds without
 * replaying an impact the player already heard at contact.
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CollectibleCounts } from "../../src/game/casino-tokens";
import type {
  CreateGameOptions,
  GameHandle,
  GameInspection,
  GameStatus,
} from "../../src/game/types";
import type { GameplayAction, SaveView } from "../../src/shared/contracts";
import { makeEraSave } from "./fixtures";

const mocks = vi.hoisted(() => ({
  createGame: vi.fn(),
  api: vi.fn(),
  feedback: [] as Array<ReturnType<typeof vi.fn>>,
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
    constructor() {
      mocks.feedback.push(this.feedback);
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

const levelId = "level-1-2020";
const enemyId = `${levelId}-ordinary-a`;

function status(collectibles?: CollectibleCounts | null): GameStatus {
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
    playerHp: 10,
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
    ...(collectibles === undefined ? {} : { collectibles }),
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
  container = document.createElement("div");
  document.body.append(container);
  mocks.createGame.mockReset();
  mocks.api.mockReset();
  mocks.feedback.length = 0;
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
});

async function render(save = makeEraSave({ collectedKinds: ["attack-tool"] })) {
  root = createRoot(container);
  await act(async () =>
    root!.render(<GameScreen initialSave={save} onLeave={vi.fn()} ephemeral />),
  );
}

async function reportStatus(next: GameStatus) {
  await act(async () => options!.onStatus!(next));
}

async function reply(next: SaveView, action: GameplayAction) {
  mocks.api.mockResolvedValueOnce(next);
  await act(async () => {
    await options!.onAction({
      actionId: `action-${next.revision}`,
      expectedRevision: next.revision - 1,
      action,
    });
  });
}

const tally = () => container.querySelector<HTMLElement>(".casino-tally");

describe("Casino haul on the game screen", () => {
  it("counts tokens and golden tickets only while a casino chapter reports them", async () => {
    await render();
    expect(tally()).toBeNull();

    await reportStatus(
      status({ tokens: 12, tokenTotal: 146, tickets: 1, ticketTotal: 3 }),
    );
    expect(tally()?.getAttribute("aria-label")).toBe(
      "12 casino tokens, 1 of 3 golden tickets",
    );
    expect(tally()?.querySelector(".token-count b")?.textContent).toBe("12");
    expect(tally()?.querySelectorAll(".ticket-slot")).toHaveLength(3);
    expect(tally()?.querySelectorAll(".ticket-slot.collected")).toHaveLength(1);

    await reportStatus(status(null));
    expect(tally()).toBeNull();
  });

  it("plays contact, reward and defeat sounds as the runtime reports them", async () => {
    await render();
    const feedback = mocks.feedback[0]!;
    options!.onFeedback!({
      type: "hit",
      encounterId: enemyId,
      kind: "primary",
    });
    options!.onFeedback!({ type: "token", streak: 0 });
    options!.onFeedback!({ type: "token", streak: 2 });
    options!.onFeedback!({ type: "token", streak: 40 });
    options!.onFeedback!({ type: "ticket" });
    options!.onFeedback!({ type: "defeat", encounterId: enemyId, boss: false });
    expect(feedback.mock.calls).toEqual([
      ["impact"],
      ["token", 1],
      ["token", 1.08],
      ["token", 1.2],
      ["ticket"],
      ["defeat"],
    ]);
  });

  it("does not replay the impact when the server confirms the player's own hit", async () => {
    await render();
    const feedback = mocks.feedback[0]!;
    const struck = makeEraSave({
      collectedKinds: ["attack-tool"],
      revision: 1,
    });
    struck.adventure!.activeLevel!.encounters[0]!.hp -= 2;
    await reply(struck, { type: "attack", levelId, encounterId: enemyId });
    expect(feedback).not.toHaveBeenCalledWith("impact");

    const hurt = makeEraSave({
      collectedKinds: ["attack-tool"],
      revision: 2,
      playerHp: 8,
    });
    hurt.adventure!.activeLevel!.encounters[0]!.hp -= 2;
    await reply(hurt, { type: "take-hit", levelId, encounterId: enemyId });
    expect(feedback).toHaveBeenCalledWith("impact");
  });

  it("keeps the finished chapter's haul for the completion screen", async () => {
    await render();
    await reportStatus(
      status({ tokens: 40, tokenTotal: 146, tickets: 3, ticketTotal: 3 }),
    );
    await reply(makeEraSave({ completed: true, revision: 1 }), {
      type: "consume-memory-bundle",
      levelId,
    });
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
      "You grabbed 40 of 146 casino tokens and 3 of 3 golden tickets. Every golden ticket found!",
    );
  });

  it("shows no haul for a chapter without casino tokens", async () => {
    await render();
    await reply(makeEraSave({ completed: true, revision: 1 }), {
      type: "consume-memory-bundle",
      levelId,
    });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.querySelector(".casino-haul")).toBeNull();
  });
});
