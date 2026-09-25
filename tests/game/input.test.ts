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
  innerWidth = 390;
  innerHeight = 844;
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
  captureFails = false;

  setPointerCapture(pointerId: number): void {
    if (this.captureFails) throw new DOMException("Pointer capture unavailable");
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
    elementFromPoint: (x: number, y: number) => Element | null;
  };
  fakeDocument.defaultView = fakeWindow;
  fakeDocument.visibilityState = "visible";
  const target = new FakeGameTarget();
  target.ownerDocument = fakeDocument;
  fakeDocument.elementFromPoint = () => target as unknown as Element;
  const dispose = bindBrowserInput({
    target: target as unknown as HTMLElement,
    input,
  });
  const pointer = (
    type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
    pointerId: number,
    clientX: number,
    clientY: number,
    pointerType: "mouse" | "touch" | "pen",
    button: number,
    eventTarget: FakeElement = target,
    timeStamp = fakeWindow.nowMs,
  ): void => {
    const event = {
      pointerId,
      pointerType,
      button,
      clientX,
      clientY,
      timeStamp,
      target: eventTarget,
      preventDefault: () => {},
    };
    // Match browser propagation: the window capture listener sees a terminal
    // event before the listener on the canvas itself.
    if (type === "pointerup" || type === "pointercancel")
      fakeWindow.dispatch(type, event);
    target.dispatch(type, event);
  };
  const touch = (
    type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
    pointerId: number,
    clientX: number,
    clientY: number,
    eventTarget: FakeElement = target,
    timeStamp = fakeWindow.nowMs,
  ): void =>
    pointer(
      type,
      pointerId,
      clientX,
      clientY,
      "touch",
      0,
      eventTarget,
      timeStamp,
    );
  const mouse = (
    type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
    pointerId: number,
    clientX: number,
    clientY: number,
    button = 0,
    eventTarget: FakeElement = target,
    timeStamp = fakeWindow.nowMs,
  ): void =>
    pointer(
      type,
      pointerId,
      clientX,
      clientY,
      "mouse",
      button,
      eventTarget,
      timeStamp,
    );
  const pen = (
    type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
    pointerId: number,
    clientX: number,
    clientY: number,
    eventTarget: FakeElement = target,
    timeStamp = fakeWindow.nowMs,
  ): void =>
    pointer(
      type,
      pointerId,
      clientX,
      clientY,
      "pen",
      0,
      eventTarget,
      timeStamp,
    );
  return { input, fakeDocument, fakeWindow, target, touch, mouse, pen, dispose };
}

describe("game input", () => {
  it("preserves held controls on same-orientation resize and clears them on rotation", () => {
    const { input, fakeWindow, dispose } = makePointerHarness();
    input.set("moveY", 1);
    input.set("jump", true);
    fakeWindow.innerHeight = 780;
    fakeWindow.dispatch("resize");
    expect(input.snapshot().moveY).toBe(1);
    expect(input.consumeActions().jump).toBe(true);
    fakeWindow.innerWidth = 844;
    fakeWindow.innerHeight = 390;
    fakeWindow.dispatch("resize");
    expect(input.snapshot().moveY).toBe(0);
    expect(input.consumeActions().jump).toBe(false);
    dispose();
  });

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

  it("clears queued actions while preserving held analog and keyboard movement", () => {
    const input = new GameInputState();
    input.set("moveX", 0.4);
    input.set("lookX", -0.25);
    input.setKey("KeyW", true);
    for (const action of ["jump", "interact", "attack", "guard"] as const) {
      input.set(action, true);
      input.set(action, false);
    }
    for (const code of ["Space", "KeyE", "KeyF", "ShiftLeft"])
      input.setKey(code, true);

    input.clearActions();

    expect(input.snapshot()).toMatchObject({
      lookX: -0.25,
      jump: false,
      interact: false,
      attack: false,
      guard: false,
    });
    expect(input.snapshot().moveX).toBeGreaterThan(0);
    expect(input.snapshot().moveY).toBeGreaterThan(0);
    expect(input.consumeActions()).toEqual({
      jump: false,
      interact: false,
      attack: false,
      guard: false,
    });
    input.setKey("KeyW", false);
    expect(input.snapshot()).toMatchObject({ moveX: 0.4, moveY: 0 });
  });

  it("clears independent channels on blur or visibility loss and removes listeners on dispose", () => {
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
    fakeDocument.visibilityState = "hidden";
    fakeDocument.dispatch("visibilitychange");
    expect(input.snapshot().moveY).toBe(0);
    fakeDocument.visibilityState = "visible";

    input.set("moveX", -1);
    fakeWindow.dispatch("pagehide");
    expect(input.snapshot().moveX).toBe(0);

    input.set("moveY", -1);
    fakeDocument.dispatch("freeze");
    expect(input.snapshot().moveY).toBe(0);

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
    expect(input.snapshot()).toMatchObject({ moveX: 0, moveY: 0, jump: false });
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

  it("queues primary and secondary combat from short mouse clicks after capture-phase release", () => {
    const { input, fakeWindow, mouse, dispose } = makePointerHarness();

    fakeWindow.nowMs = 100;
    mouse("pointerdown", 40, 100, 120, 0);
    fakeWindow.nowMs = 180;
    mouse("pointerup", 40, 102, 123, 0);
    expect(input.consumeActions()).toEqual({
      jump: false,
      interact: false,
      attack: true,
      guard: false,
    });
    expect(input.consumeActions().attack).toBe(false);

    fakeWindow.nowMs = 200;
    mouse("pointerdown", 41, 140, 160, 2);
    fakeWindow.nowMs = 260;
    mouse("pointerup", 41, 141, 160, 2);
    expect(input.consumeActions()).toEqual({
      jump: false,
      interact: false,
      attack: false,
      guard: true,
    });
    expect(input.consumeActions().guard).toBe(false);
    dispose();
  });

  it("rejects captured mouse releases physically over UI or outside the canvas", () => {
    const { input, fakeDocument, fakeWindow, target, mouse, dispose } =
      makePointerHarness();
    const uiControl = new FakeElement(true);

    fakeWindow.nowMs = 100;
    mouse("pointerdown", 55, 100, 120, 0);
    expect(target.hasPointerCapture(55)).toBe(true);
    fakeDocument.elementFromPoint = () => uiControl as unknown as Element;
    fakeWindow.nowMs = 150;
    // Pointer capture still reports the canvas as event.target; hit testing
    // must use the physical release coordinates instead.
    mouse("pointerup", 55, 100, 120, 0, target);
    expect(input.consumeActions().attack).toBe(false);

    fakeDocument.elementFromPoint = () => null;
    fakeWindow.nowMs = 200;
    mouse("pointerdown", 56, 140, 160, 2);
    fakeWindow.nowMs = 250;
    mouse("pointerup", 56, 140, 160, 2, target);
    expect(input.consumeActions().guard).toBe(false);
    dispose();
  });

  it("keeps mouse drags as camera look and rejects long or cancelled clicks", () => {
    const { input, fakeWindow, mouse, dispose } = makePointerHarness();

    fakeWindow.nowMs = 10;
    mouse("pointerdown", 42, 20, 30, 0);
    fakeWindow.nowMs = 30;
    mouse("pointermove", 42, 36, 35, 0);
    fakeWindow.nowMs = 80;
    mouse("pointerup", 42, 36, 35, 0);
    expect(input.consumePointerLook()).toEqual({ x: 16, y: 5 });
    expect(input.consumeActions().attack).toBe(false);

    fakeWindow.nowMs = 100;
    mouse("pointerdown", 43, 50, 60, 2);
    fakeWindow.nowMs = 150;
    mouse("pointermove", 43, 43, 72, 2);
    fakeWindow.nowMs = 200;
    mouse("pointerup", 43, 43, 72, 2);
    expect(input.consumePointerLook()).toEqual({ x: -7, y: 12 });
    expect(input.consumeActions().guard).toBe(false);

    fakeWindow.nowMs = 300;
    mouse("pointerdown", 44, 70, 80, 0);
    fakeWindow.nowMs = 350;
    mouse("pointercancel", 44, 70, 80, 0);
    fakeWindow.nowMs = 360;
    mouse("pointerup", 44, 70, 80, 0);
    expect(input.consumeActions().attack).toBe(false);

    fakeWindow.nowMs = 400;
    mouse("pointerdown", 45, 90, 100, 2);
    fakeWindow.nowMs = 901;
    mouse("pointerup", 45, 90, 100, 2);
    expect(input.consumeActions().guard).toBe(false);

    fakeWindow.nowMs = 1_000;
    mouse("pointerdown", 53, 100, 100, 0);
    fakeWindow.nowMs = 1_050;
    mouse("pointerup", 53, 120, 100, 0);
    expect(input.consumeActions().attack).toBe(false);
    dispose();
  });

  it("invalidates mouse clicks on blur and visibility loss", () => {
    const { input, fakeDocument, fakeWindow, mouse, dispose } =
      makePointerHarness();

    fakeWindow.nowMs = 100;
    mouse("pointerdown", 46, 10, 20, 0);
    fakeWindow.dispatch("blur");
    fakeWindow.nowMs = 150;
    mouse("pointerup", 46, 10, 20, 0);
    expect(input.consumeActions().attack).toBe(false);

    fakeWindow.nowMs = 200;
    mouse("pointerdown", 47, 10, 20, 2);
    fakeDocument.visibilityState = "hidden";
    fakeDocument.dispatch("visibilitychange");
    fakeDocument.visibilityState = "visible";
    fakeWindow.nowMs = 250;
    mouse("pointerup", 47, 10, 20, 2);
    expect(input.consumeActions().guard).toBe(false);
    dispose();
  });

  it("does not map touch, pen, or UI contacts to mouse combat", () => {
    const { input, fakeWindow, target, touch, mouse, pen, dispose } =
      makePointerHarness();
    const uiControl = new FakeElement(true);

    fakeWindow.nowMs = 100;
    touch("pointerdown", 48, 20, 30);
    fakeWindow.nowMs = 150;
    touch("pointerup", 48, 20, 30);
    pen("pointerdown", 49, 40, 50);
    fakeWindow.nowMs = 200;
    pen("pointerup", 49, 40, 50);
    mouse("pointerdown", 50, 60, 70, 0, uiControl);
    fakeWindow.nowMs = 250;
    mouse("pointerup", 50, 60, 70, 0, uiControl);
    mouse("pointerdown", 51, 60, 70, 2, uiControl);
    fakeWindow.nowMs = 300;
    mouse("pointerup", 51, 60, 70, 2, uiControl);
    mouse("pointerdown", 54, 60, 70, 1);
    mouse("pointerup", 54, 60, 70, 1);

    expect(input.consumeActions()).toEqual({
      jump: false,
      interact: false,
      attack: false,
      guard: false,
    });
    expect(input.consumePointerLook()).toEqual({ x: 0, y: 0 });
    expect(target.hasPointerCapture(50)).toBe(false);
    expect(target.hasPointerCapture(51)).toBe(false);
    dispose();
  });

  it("prevents the canvas context menu and restores it on disposal", () => {
    const { input, fakeDocument, fakeWindow, target, mouse, dispose } =
      makePointerHarness();
    const uiControl = new FakeElement(true);
    let canvasPrevented = 0;
    let uiPrevented = 0;
    let elsewherePrevented = 0;

    target.dispatch("contextmenu", {
      target,
      preventDefault: () => {
        canvasPrevented += 1;
      },
    });
    target.dispatch("contextmenu", {
      target: uiControl,
      preventDefault: () => {
        uiPrevented += 1;
      },
    });
    fakeDocument.dispatch("contextmenu", {
      target: new FakeElement(),
      preventDefault: () => {
        elsewherePrevented += 1;
      },
    });
    expect(canvasPrevented).toBe(1);
    expect(uiPrevented).toBe(0);
    expect(elsewherePrevented).toBe(0);

    fakeWindow.nowMs = 100;
    mouse("pointerdown", 52, 80, 90, 2);
    expect(target.hasPointerCapture(52)).toBe(true);
    dispose();
    expect(target.hasPointerCapture(52)).toBe(false);

    fakeWindow.nowMs = 150;
    mouse("pointerup", 52, 80, 90, 2);
    expect(input.consumeActions().guard).toBe(false);
    target.dispatch("contextmenu", {
      target,
      preventDefault: () => {
        canvasPrevented += 1;
      },
    });
    expect(canvasPrevented).toBe(1);
  });

  it("keeps a deliberate scenery tap separate from the Jump button", () => {
    const { input, fakeWindow, touch, dispose } = makePointerHarness();
    fakeWindow.nowMs = 100;
    touch("pointerdown", 1, 20, 30);
    touch("pointermove", 1, 26, 38);
    fakeWindow.nowMs = 600;
    touch("pointerup", 1, 26, 38);

    expect(input.consumePointerLook()).toEqual({ x: 0, y: 0 });
    expect(input.consumeActions().jump).toBe(false);
    expect(input.consumeActions().jump).toBe(false);
    dispose();
  });

  it("retires a camera contact at the window when pointer capture fails", () => {
    const { input, fakeWindow, target, touch, dispose } = makePointerHarness();
    target.captureFails = true;
    expect(() => touch("pointerdown", 31, 20, 30)).not.toThrow();
    fakeWindow.dispatch("pointerup", { pointerId: 31 });
    touch("pointermove", 31, 60, 70);

    expect(input.consumePointerLook()).toEqual({ x: 0, y: 0 });
    dispose();
  });

  it("does not turn a delayed scenery release into a jump", () => {
    const { input, fakeWindow, touch, dispose } = makePointerHarness();
    fakeWindow.nowMs = 21_525.5;
    touch("pointerdown", 8, 40, 50, undefined, 21_499.8);
    fakeWindow.nowMs = 22_056.8;
    touch("pointerup", 8, 40, 50, undefined, 21_510.8);

    expect(input.consumeActions().jump).toBe(false);
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
    touch("pointerdown", 4, 40, 50, undefined, 100);
    fakeWindow.nowMs = 150;
    touch("pointerup", 4, 40, 50, undefined, 601);
    expect(input.consumeActions().jump).toBe(false);
    dispose();
  });

  it("excludes menu and action-control contacts from camera gestures", () => {
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
    expect(input.consumeActions().jump).toBe(false);
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
