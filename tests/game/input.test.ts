import { describe, expect, it } from "vitest";
import {
  bindBrowserInput,
  GameInputState,
  getJoystickVector,
} from "../../src/game/input";

class FakeEventTarget {
  private readonly listeners = new Map<
    string,
    Set<EventListenerOrEventListenerObject>
  >();

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
  ): void {
    if (!listener) return;
    const listeners =
      this.listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
  ): void {
    if (listener) this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string, event: Record<string, unknown> = {}): void {
    for (const listener of this.listeners.get(type) ?? []) {
      if (typeof listener === "function")
        listener({ type, ...event } as unknown as Event);
      else listener.handleEvent({ type, ...event } as unknown as Event);
    }
  }
}

describe("game input", () => {
  it("retains simultaneous move, camera and action pointers until cleanup", () => {
    const input = new GameInputState();
    input.set("moveX", 1);
    input.set("moveY", 1);
    input.set("lookX", -0.6);
    input.set("lookY", 0.25);
    input.set("jump", true);
    input.set("interact", true);
    input.set("attack", true);
    input.set("guard", true);

    const active = input.snapshot();
    expect(active.moveX).toBeCloseTo(Math.SQRT1_2);
    expect(active.moveY).toBeCloseTo(Math.SQRT1_2);
    expect(active.lookX).toBe(-0.6);
    expect(active.lookY).toBe(0.25);
    expect(active.jump).toBe(true);
    expect(active.interact).toBe(true);
    expect(active.attack).toBe(true);
    expect(active.guard).toBe(true);

    input.clear();
    expect(input.snapshot()).toEqual({
      moveX: 0,
      moveY: 0,
      lookX: 0,
      lookY: 0,
      jump: false,
      interact: false,
      attack: false,
      guard: false,
    });
  });

  it("clears independent channels on blur and pointer cancellation and removes listeners on dispose", () => {
    const input = new GameInputState();
    const fakeWindow = new FakeEventTarget();
    const fakeDocument = new FakeEventTarget() as FakeEventTarget & {
      defaultView: FakeEventTarget;
      visibilityState: DocumentVisibilityState;
    };
    fakeDocument.defaultView = fakeWindow;
    fakeDocument.visibilityState = "visible";
    const fakeTarget = new FakeEventTarget() as FakeEventTarget & {
      ownerDocument: typeof fakeDocument;
      getBoundingClientRect: () => DOMRect;
    };
    fakeTarget.ownerDocument = fakeDocument;
    fakeTarget.getBoundingClientRect = () =>
      ({ left: 0, width: 100 }) as DOMRect;
    const dispose = bindBrowserInput({
      target: fakeTarget as unknown as HTMLElement,
      input,
    });

    const keyEvent = (code: string) => ({
      code,
      target: null,
      preventDefault: () => {},
    });
    fakeWindow.dispatch("keydown", keyEvent("KeyF"));
    fakeWindow.dispatch("keyup", keyEvent("KeyF"));
    fakeWindow.dispatch("keydown", keyEvent("ShiftLeft"));
    fakeWindow.dispatch("keyup", keyEvent("ShiftLeft"));
    expect(input.consumeActions()).toMatchObject({ attack: true, guard: true });

    input.set("moveX", 1);
    input.set("jump", true);
    fakeWindow.dispatch("blur");
    expect(input.snapshot().moveX).toBe(0);
    expect(input.snapshot().jump).toBe(false);

    input.set("moveY", 1);
    input.set("interact", true);
    input.set("attack", true);
    input.set("guard", true);
    fakeWindow.dispatch("pointercancel", { pointerId: 4 });
    expect(input.snapshot().moveY).toBe(0);
    expect(input.snapshot().interact).toBe(false);
    expect(input.snapshot().attack).toBe(false);
    expect(input.snapshot().guard).toBe(false);
    expect(input.consumeActions()).toMatchObject({
      attack: false,
      guard: false,
    });

    dispose();
    input.set("moveX", 0.5);
    fakeWindow.dispatch("blur");
    expect(input.snapshot().moveX).toBe(0.5);
  });

  it("caps joystick travel and maps upward screen travel to forward movement", () => {
    expect(getJoystickVector(50, 50, 80, 10, 25)).toMatchObject({
      distance: 1,
    });
    const centered = getJoystickVector(50, 50, 50, 50, 25);
    expect(centered).toEqual({ x: 0, y: 0, distance: 0 });
    const forward = getJoystickVector(50, 50, 50, 25, 25);
    expect(forward).toEqual({ x: 0, y: 1, distance: 1 });
  });
});
