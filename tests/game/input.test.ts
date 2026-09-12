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

class FakeElement extends FakeEventTarget {
  constructor(private readonly questUi = false) {
    super();
  }

  closest(selector: string): FakeElement | null {
    return this.questUi && selector === "[data-quest-ui]" ? this : null;
  }
}

class FakeWindow extends FakeEventTarget {
  readonly Element = FakeElement;
  nowMs = 0;
  readonly performance = { now: () => this.nowMs };
}

class FakeGameTarget extends FakeElement {
  ownerDocument!: FakeEventTarget & {
    defaultView: FakeWindow;
    visibilityState: DocumentVisibilityState;
  };
  private readonly capturedPointers = new Set<number>();

  setPointerCapture(pointerId: number): void {
    this.capturedPointers.add(pointerId);
  }

  hasPointerCapture(pointerId: number): boolean {
    return this.capturedPointers.has(pointerId);
  }

  releasePointerCapture(pointerId: number): void {
    this.capturedPointers.delete(pointerId);
  }
}

function makePointerHarness() {
  const input = new GameInputState();
  const fakeWindow = new FakeWindow();
  const fakeDocument = new FakeEventTarget() as FakeEventTarget & {
    defaultView: FakeWindow;
    visibilityState: DocumentVisibilityState;
  };
  fakeDocument.defaultView = fakeWindow;
  fakeDocument.visibilityState = "visible";
  const target = new FakeGameTarget();
  target.ownerDocument = fakeDocument;
  const dispose = bindBrowserInput({
    target: target as unknown as HTMLElement,
    input,
  });
  const touch = (
    type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
    pointerId: number,
    clientX: number,
    clientY: number,
    eventTarget: FakeElement = target,
  ): void => {
    target.dispatch(type, {
      pointerId,
      pointerType: "touch",
      button: 0,
      clientX,
      clientY,
      target: eventTarget,
      preventDefault: () => {},
    });
  };
  return { input, fakeWindow, target, touch, dispose };
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

  it("clears independent channels on blur and removes listeners on dispose", () => {
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

    fakeWindow.dispatch("keydown", keyEvent("KeyW"));
    fakeWindow.dispatch("keydown", keyEvent("Space"));
    expect(input.consumeActions().jump).toBe(true);
    input.clear();
    fakeWindow.dispatch("keydown", { ...keyEvent("KeyW"), repeat: true });
    fakeWindow.dispatch("keydown", { ...keyEvent("Space"), repeat: true });
    expect(input.snapshot().moveY).toBe(0);
    expect(input.consumeActions().jump).toBe(false);
    fakeWindow.dispatch("keyup", keyEvent("KeyW"));
    fakeWindow.dispatch("keyup", keyEvent("Space"));
    fakeWindow.dispatch("keydown", keyEvent("KeyW"));
    fakeWindow.dispatch("keydown", keyEvent("Space"));
    expect(input.snapshot().moveY).toBe(1);
    expect(input.consumeActions().jump).toBe(true);

    dispose();
    input.set("moveX", 0.5);
    fakeWindow.dispatch("blur");
    expect(input.snapshot().moveX).toBe(0.5);
  });

  it("cancels one touch action without erasing a held joystick", () => {
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

    input.set("moveY", 1);
    input.set("attack", true);
    fakeWindow.dispatch("pointercancel", { pointerId: 7 });
    input.cancel("attack");

    expect(input.snapshot().moveY).toBe(1);
    expect(input.snapshot().attack).toBe(false);
    expect(input.consumeActions().attack).toBe(false);
    dispose();
  });

  it("queues one jump for a deliberate touch tap at the movement and time limits", () => {
    const { input, fakeWindow, touch, dispose } = makePointerHarness();
    fakeWindow.nowMs = 100;
    touch("pointerdown", 1, 20, 30);
    touch("pointermove", 1, 26, 38);
    fakeWindow.nowMs = 600;
    touch("pointerup", 1, 26, 38);

    expect(input.consumePointerLook()).toEqual({ x: 0, y: 0 });
    expect(input.consumeActions().jump).toBe(true);
    expect(input.consumeActions().jump).toBe(false);
    dispose();
  });

  it("turns a touch drag into camera motion and never queues its release as a jump", () => {
    const { input, fakeWindow, touch, dispose } = makePointerHarness();
    fakeWindow.nowMs = 10;
    touch("pointerdown", 2, 80, 90);
    touch("pointermove", 2, 86, 98);
    touch("pointermove", 2, 92, 99);
    fakeWindow.nowMs = 200;
    touch("pointerup", 2, 92, 99);

    expect(input.consumePointerLook()).toEqual({ x: 12, y: 9 });
    expect(input.consumeActions().jump).toBe(false);
    dispose();
  });

  it("does not jump after pointer cancellation or a touch held beyond the tap window", () => {
    const { input, fakeWindow, touch, dispose } = makePointerHarness();
    fakeWindow.nowMs = 20;
    touch("pointerdown", 3, 40, 50);
    touch("pointercancel", 3, 40, 50);
    touch("pointerup", 3, 40, 50);
    expect(input.consumeActions().jump).toBe(false);

    fakeWindow.nowMs = 100;
    touch("pointerdown", 4, 40, 50);
    fakeWindow.nowMs = 601;
    touch("pointerup", 4, 40, 50);
    expect(input.consumeActions().jump).toBe(false);
    dispose();
  });

  it("excludes menu and action-control contacts from world taps", () => {
    const { input, fakeWindow, touch, dispose } = makePointerHarness();
    const uiControl = new FakeElement(true);
    fakeWindow.nowMs = 100;
    touch("pointerdown", 5, 70, 80, uiControl);
    fakeWindow.nowMs = 150;
    touch("pointerup", 5, 70, 80, uiControl);

    expect(input.consumeActions().jump).toBe(false);
    expect(input.consumePointerLook()).toEqual({ x: 0, y: 0 });
    dispose();
  });

  it("keeps a held joystick independent while another finger taps the world", () => {
    const { input, fakeWindow, touch, dispose } = makePointerHarness();
    const joystick = new FakeElement(true);
    input.set("moveX", -0.5);
    input.set("moveY", 1);
    fakeWindow.nowMs = 1_000;
    touch("pointerdown", 6, 25, 400, joystick);
    touch("pointerdown", 7, 20, 120);
    fakeWindow.nowMs = 1_100;
    touch("pointerup", 7, 20, 120);

    expect(input.snapshot()).toMatchObject({
      moveX: -0.4472135954999579,
      moveY: 0.8944271909999159,
    });
    expect(input.consumeActions().jump).toBe(true);
    expect(input.snapshot().moveY).toBeGreaterThan(0);
    touch("pointerup", 6, 25, 400, joystick);
    expect(input.consumeActions().jump).toBe(false);
    dispose();
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
