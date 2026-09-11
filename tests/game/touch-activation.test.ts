// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installMultiTouchActivation } from "../../src/client/touch-activation";

let button: HTMLButtonElement;
let elsewhere: HTMLDivElement;
let clicks: number;
let uninstall: () => void;

function pointer(
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  target: Element,
  pointerId: number,
  init: Partial<PointerEventInit> = {},
): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId,
      pointerType: "touch",
      clientX: 100,
      clientY: 100,
      ...init,
    }),
  );
}

function tap(target: Element, pointerId: number): void {
  pointer("pointerdown", target, pointerId);
  pointer("pointerup", target, pointerId);
}

beforeEach(() => {
  button = document.createElement("button");
  button.textContent = "How to play";
  button.addEventListener("click", () => {
    clicks += 1;
  });
  elsewhere = document.createElement("div");
  document.body.append(button, elsewhere);
  clicks = 0;
  uninstall = installMultiTouchActivation(document);
});
afterEach(() => {
  uninstall();
  button.remove();
  elsewhere.remove();
});

describe("multi-touch button activation", () => {
  it("leaves a single-finger tap to the browser's own click", () => {
    tap(button, 1);
    expect(clicks).toBe(0);
  });

  it("clicks a button tapped while another finger is already down", () => {
    pointer("pointerdown", elsewhere, 1);
    tap(button, 2);
    expect(clicks).toBe(1);
    pointer("pointerup", elsewhere, 1);
    expect(clicks).toBe(1);
  });

  it("clicks a button pressed first when a second finger lands before release", () => {
    pointer("pointerdown", button, 1);
    pointer("pointerdown", elsewhere, 2);
    pointer("pointerup", button, 1);
    expect(clicks).toBe(1);
  });

  it("ignores presses that moved, were cancelled, or came from a mouse", () => {
    pointer("pointerdown", elsewhere, 1);
    pointer("pointerdown", button, 2);
    pointer("pointermove", button, 2, { clientX: 140, clientY: 100 });
    pointer("pointerup", button, 2, { clientX: 140, clientY: 100 });
    pointer("pointerdown", button, 3);
    pointer("pointercancel", button, 3);
    pointer("pointerup", button, 3);
    pointer("pointerdown", button, 4, { pointerType: "mouse" });
    pointer("pointerup", button, 4, { pointerType: "mouse" });
    expect(clicks).toBe(0);
  });

  it("never activates a disabled button or a control holding pointer capture", () => {
    pointer("pointerdown", elsewhere, 1);
    button.disabled = true;
    tap(button, 2);
    button.disabled = false;
    Object.defineProperty(button, "hasPointerCapture", {
      configurable: true,
      value: () => true,
    });
    tap(button, 3);
    expect(clicks).toBe(0);
  });

  it("stops listening once uninstalled", () => {
    uninstall();
    pointer("pointerdown", elsewhere, 1);
    tap(button, 2);
    expect(clicks).toBe(0);
    uninstall = installMultiTouchActivation(document);
  });
});
