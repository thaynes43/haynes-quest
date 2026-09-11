// @vitest-environment jsdom

/**
 * WO-033 review regression (finding R-3). `GameInputState.clear()` runs on every
 * traversal recovery and on pause/resume so a child gets a fresh start. Browsers
 * keep firing `keydown` with `repeat: true` while a key is physically held, and
 * `bindBrowserInput` forwards those repeats unchanged, so the first repeat after a
 * clear is treated as a brand-new press: a held Space yields a bonus jump at the
 * checkpoint and a held W resumes walking within one OS repeat interval.
 *
 * These cases are marked `fails` because they reproduce the defect at eaa7eb3.
 * Once the runtime ignores repeat keydowns (or remembers physically held keys
 * across a clear) they will start passing; flip `it.fails` to `it` then.
 */
import { afterEach, describe, expect, it } from "vitest";
import { bindBrowserInput, GameInputState } from "../../src/game/input";

function key(code: string, repeat: boolean): KeyboardEvent {
  return new KeyboardEvent("keydown", { code, repeat, bubbles: true, cancelable: true });
}

describe("held keys across an input clear", () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
  });

  function bound(): GameInputState {
    const input = new GameInputState();
    const target = document.createElement("canvas");
    document.body.append(target);
    cleanups.push(bindBrowserInput({ target, input }), () => target.remove());
    return input;
  }

  it("does not turn the auto-repeat of a still-held Space into a second jump press", () => {
    const input = bound();
    window.dispatchEvent(key("Space", false));
    expect(input.consumeActions().jump).toBe(true);
    window.dispatchEvent(key("Space", true));
    expect(input.consumeActions().jump).toBe(false);

    input.clear(); // what createGame does on recovery and on pause/resume
    window.dispatchEvent(key("Space", true)); // the key was never released
    expect(input.consumeActions().jump).toBe(false);
  });

  it("keeps a held movement key cleared until it is released and pressed again", () => {
    const input = bound();
    window.dispatchEvent(key("KeyW", false));
    expect(input.snapshot().moveY).toBe(1);

    input.clear();
    expect(input.snapshot().moveY).toBe(0);
    window.dispatchEvent(key("KeyW", true)); // OS auto-repeat, roughly 33 ms later
    expect(input.snapshot().moveY).toBe(0);
  });
});
