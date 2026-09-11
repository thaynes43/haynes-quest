import { describe, expect, it } from "vitest";
import { GameInputState } from "../../src/game/input";
describe("brief actions between rendering frames", () => {
  it("retains a released keyboard press exactly once, without repeats", () => {
    const input = new GameInputState();
    input.setKey("Space", true);
    input.setKey("Space", false);
    expect(input.snapshot().jump).toBe(false);
    expect(input.consumeActions()).toEqual({ jump: true, interact: false });
    expect(input.consumeActions().jump).toBe(false);
  });
  it("retains a quick touch action while independent movement continues", () => {
    const input = new GameInputState();
    input.set("moveY", 1);
    input.set("interact", true);
    input.set("interact", false);
    expect(input.consumeActions().interact).toBe(true);
    expect(input.snapshot().moveY).toBe(1);
    input.set("jump", true);
    input.clear();
    expect(input.consumeActions()).toEqual({ jump: false, interact: false });
  });
});
