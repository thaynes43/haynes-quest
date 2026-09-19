// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installViewportZoomLock } from "../../src/client/viewport-zoom";

let button: HTMLButtonElement;
let uninstall: () => void;
const eventOptions = { bubbles: true, cancelable: true };

beforeEach(() => {
  button = document.createElement("button");
  document.body.append(button);
  uninstall = installViewportZoomLock(document);
});
afterEach(() => {
  uninstall();
  button.remove();
});

describe("app-wide viewport zoom lock", () => {
  it("cancels Safari pinch defaults without swallowing event delivery", () => {
    const received: boolean[] = [];
    for (const type of ["gesturestart", "gesturechange"]) {
      button.addEventListener(type, (event) =>
        received.push(event.defaultPrevented),
      );
      button.dispatchEvent(new Event(type, eventOptions));
    }
    expect(received).toEqual([true, true]);
  });

  it("blocks trackpad pinch while leaving ordinary wheel scrolling available", () => {
    const pinch = new WheelEvent("wheel", {
      ...eventOptions,
      ctrlKey: true,
      deltaY: -80,
    });
    const scroll = new WheelEvent("wheel", { ...eventOptions, deltaY: 120 });
    button.dispatchEvent(pinch);
    button.dispatchEvent(scroll);
    expect(pinch.defaultPrevented).toBe(true);
    expect(scroll.defaultPrevented).toBe(false);
  });

  it("blocks plus/minus zoom chords for control, command and the numeric keypad", () => {
    for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
      for (const key of ["+", "=", "-", "_"]) {
        const event = new KeyboardEvent("keydown", {
          ...eventOptions,
          ...modifier,
          key,
        });
        button.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
      }
      for (const code of ["NumpadAdd", "NumpadSubtract"]) {
        const event = new KeyboardEvent("keydown", {
          ...eventOptions,
          ...modifier,
          code,
        });
        button.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
      }
    }
  });

  it("preserves typing, composition, unrelated shortcuts and default-scale recovery", () => {
    for (const init of [
      { key: "+" },
      { key: "-" },
      { key: "c", ctrlKey: true },
      { key: "0", ctrlKey: true },
      { key: "0", metaKey: true },
      { key: "=", ctrlKey: true, altKey: true },
      { key: "=", ctrlKey: true, isComposing: true },
    ]) {
      const event = new KeyboardEvent("keydown", { ...eventOptions, ...init });
      button.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
  });

  it("leaves touch, pointer and click events available to independent controls", () => {
    const received: Event[] = [];
    for (const type of [
      "touchstart",
      "touchmove",
      "touchend",
      "pointerdown",
      "pointerup",
      "click",
    ]) {
      button.addEventListener(type, (event) => received.push(event));
      button.dispatchEvent(new Event(type, eventOptions));
    }
    expect(received).toHaveLength(6);
    expect(received.every((event) => !event.defaultPrevented)).toBe(true);
  });

  it("removes every listener before a replacement bootstrap installs", () => {
    uninstall();
    const makeEvents = () => [
      new Event("gesturestart", eventOptions),
      new Event("gesturechange", eventOptions),
      new WheelEvent("wheel", { ...eventOptions, ctrlKey: true }),
      new KeyboardEvent("keydown", {
        ...eventOptions,
        ctrlKey: true,
        key: "+",
      }),
    ];
    for (const event of makeEvents()) {
      button.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    uninstall = installViewportZoomLock(document);
    for (const event of makeEvents()) {
      button.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
  });
});
