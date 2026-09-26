// @vitest-environment jsdom
/**
 * DESIGN-008: the game screen routes family world events to their cues, runs
 * the glide wind as a loop and leaves a launch's jump to its own cue.
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CreateGameOptions,
  GameHandle,
  GameStatus,
} from "../../src/game/types";
import { makeEraSave } from "./fixtures";

const mocks = vi.hoisted(() => ({
  createGame: vi.fn(),
  api: vi.fn(),
  sounds: [] as Array<{
    feedback: ReturnType<typeof vi.fn>;
    cue: ReturnType<typeof vi.fn>;
    loop: ReturnType<typeof vi.fn>;
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
      mocks.sounds.push({ feedback: this.feedback, cue: this.cue, loop: this.loop });
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
    ...extra,
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
  mocks.sounds.length = 0;
  options = undefined;
  mocks.createGame.mockImplementation((next: CreateGameOptions) => {
    options = next;
    next.onStatus?.(status({ jumpSequence: 0, launchJumpSequence: 0 }));
    return {
      updateSave: vi.fn(),
      setInput: vi.fn(),
      cancelInput: vi.fn(),
      clearInput: vi.fn(),
      setPaused: vi.fn(),
      performAction: vi.fn(() => true),
      retryMedia: vi.fn(),
      inspect: vi.fn(),
      dispose: vi.fn(),
    } as unknown as GameHandle;
  });
});

afterEach(async () => {
  if (root) {
    await act(async () => root!.unmount());
    root = undefined;
  }
  container.remove();
});

async function render() {
  root = createRoot(container);
  await act(async () =>
    root!.render(
      <GameScreen
        initialSave={makeEraSave({ collectedKinds: ["attack-tool"] })}
        onLeave={vi.fn()}
        ephemeral
      />,
    ),
  );
}

describe("family world sounds on the game screen", () => {
  it("plays each family world event's cue and loops the glide wind", async () => {
    await render();
    const sound = mocks.sounds[0]!;
    const report = options!.onFeedback!;
    report({ type: "bounce" });
    report({ type: "lift-stop", platformId: "lift" });
    report({ type: "crumble", platformId: "crumble" });
    report({ type: "double-jump" });
    report({ type: "ticket", theme: "harbor" });
    report({ type: "windup", encounterId: "boss", assetId: "honk-bus" });
    report({ type: "windup", encounterId: "cat", assetId: "clubhouse-bully-cat" });
    report({ type: "defeat", encounterId: "boss", boss: true, familyWorld: true });
    report({ type: "glide", active: true });
    report({ type: "glide", active: false });

    expect(sound.cue.mock.calls).toEqual([
      ["bounce-pad-boing"],
      ["lift-arrival-chime"],
      ["crumble-crack"],
      ["double-jump-whoosh"],
      ["golden-ticket-sparkle"],
      ["honk-bus-honk"],
      ["enemy-poof", { gain: 0.75 }],
    ]);
    expect(sound.feedback.mock.calls).toEqual([["defeat"]]);
    expect(sound.loop.mock.calls).toEqual([
      ["glide-wind", true],
      ["glide-wind", false],
    ]);
  });

  it("leaves a bounce or double jump to its own cue and still plays plain jumps", async () => {
    await render();
    const sound = mocks.sounds[0]!;
    const jumps = () => sound.feedback.mock.calls.filter(([id]) => id === "jump").length;
    await act(async () => options!.onStatus!(status({ jumpSequence: 1, launchJumpSequence: 1 })));
    expect(jumps()).toBe(0);
    await act(async () => options!.onStatus!(status({ jumpSequence: 2, launchJumpSequence: 1 })));
    expect(jumps()).toBe(1);
    // A route without launch counts plays every new jump, as before.
    await act(async () => options!.onStatus!(status({ jumpSequence: 3 })));
    expect(jumps()).toBe(2);
  });
});
