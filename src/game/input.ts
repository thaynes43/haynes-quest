import type { GameInputAction, GameInputSnapshot } from "./types";

const analogActions = new Set<GameInputAction>([
  "moveX",
  "moveY",
  "lookX",
  "lookY",
]);
const movementCodes = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);
const actionCodes = new Set(["KeyE", "Space"]);
const buttonForCode: Partial<Record<string, ButtonAction>> = {
  KeyE: "interact",
  Space: "jump",
  KeyF: "attack",
  ShiftLeft: "guard",
  ShiftRight: "guard",
};
type ButtonAction = "jump" | "interact" | "attack" | "guard";

for (const code of Object.keys(buttonForCode)) actionCodes.add(code);

function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
}

export interface JoystickVector {
  x: number;
  y: number;
  distance: number;
}

/** Pure pointer-to-stick conversion for coordinator-owned touch controls. */
export function getJoystickVector(
  originX: number,
  originY: number,
  pointerX: number,
  pointerY: number,
  radius: number,
): JoystickVector {
  const safeRadius = Math.max(1, radius);
  const dx = pointerX - originX;
  const dy = pointerY - originY;
  const rawDistance = Math.hypot(dx, dy);
  const scale = rawDistance > safeRadius ? safeRadius / rawDistance : 1;
  return {
    x: clampUnit((dx * scale) / safeRadius),
    y: dy === 0 ? 0 : clampUnit((-dy * scale) / safeRadius),
    distance: Math.min(1, rawDistance / safeRadius),
  };
}

export class GameInputState {
  private readonly external: GameInputSnapshot = {
    moveX: 0,
    moveY: 0,
    lookX: 0,
    lookY: 0,
    jump: false,
    interact: false,
    attack: false,
    guard: false,
  };

  private readonly keys = new Set<string>();
  private pendingActions: Record<ButtonAction, boolean> = {
    jump: false,
    interact: false,
    attack: false,
    guard: false,
  };
  private pointerLookX = 0;
  private pointerLookY = 0;

  set(action: GameInputAction, value: number | boolean): void {
    if (analogActions.has(action)) {
      this.external[action as "moveX" | "moveY" | "lookX" | "lookY"] =
        clampUnit(Number(value));
      return;
    }
    const button = action as ButtonAction;
    if (value && !this.external[button]) this.pendingActions[button] = true;
    this.external[button] = Boolean(value);
  }

  cancel(action: GameInputAction): void {
    if (analogActions.has(action)) {
      this.external[action as "moveX" | "moveY" | "lookX" | "lookY"] = 0;
      return;
    }
    const button = action as ButtonAction;
    this.external[button] = false;
    this.pendingActions[button] = false;
  }

  setKey(code: string, pressed: boolean): void {
    if (!movementCodes.has(code) && !actionCodes.has(code)) return;
    if (pressed && !this.keys.has(code)) {
      const button = buttonForCode[code];
      if (button) this.pendingActions[button] = true;
    }
    if (pressed) this.keys.add(code);
    else this.keys.delete(code);
  }

  addPointerLook(deltaX: number, deltaY: number): void {
    if (Number.isFinite(deltaX)) this.pointerLookX += deltaX;
    if (Number.isFinite(deltaY)) this.pointerLookY += deltaY;
  }

  consumePointerLook(): { x: number; y: number } {
    const result = { x: this.pointerLookX, y: this.pointerLookY };
    this.pointerLookX = 0;
    this.pointerLookY = 0;
    return result;
  }

  snapshot(): GameInputSnapshot {
    const keyboardX =
      Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) -
      Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft"));
    const keyboardY =
      Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) -
      Number(this.keys.has("KeyS") || this.keys.has("ArrowDown"));
    let moveX = clampUnit(this.external.moveX + keyboardX);
    let moveY = clampUnit(this.external.moveY + keyboardY);
    const magnitude = Math.hypot(moveX, moveY);
    if (magnitude > 1) {
      moveX /= magnitude;
      moveY /= magnitude;
    }
    return {
      moveX,
      moveY,
      lookX: this.external.lookX,
      lookY: this.external.lookY,
      jump: this.external.jump || this.keys.has("Space"),
      interact: this.external.interact || this.keys.has("KeyE"),
      attack: this.external.attack || this.keys.has("KeyF"),
      guard:
        this.external.guard ||
        this.keys.has("ShiftLeft") ||
        this.keys.has("ShiftRight"),
    };
  }

  consumeActions(deferJump = false): Record<ButtonAction, boolean> {
    const result = { ...this.pendingActions };
    this.pendingActions = {
      jump: deferJump && result.jump,
      interact: false,
      attack: false,
      guard: false,
    };
    if (deferJump) result.jump = false;
    return result;
  }

  /** Discard action edges after a local recovery while the stick stays held. */
  clearActions(): void {
    this.pendingActions = {
      jump: false,
      interact: false,
      attack: false,
      guard: false,
    };
    this.external.jump = false;
    this.external.interact = false;
    this.external.attack = false;
    this.external.guard = false;
    for (const code of actionCodes) this.keys.delete(code);
  }

  clear(): void {
    this.clearActions();
    this.external.moveX = 0;
    this.external.moveY = 0;
    this.external.lookX = 0;
    this.external.lookY = 0;
    this.keys.clear();
    this.pointerLookX = 0;
    this.pointerLookY = 0;
  }
}

interface PointerRecord {
  x: number;
  y: number;
  startX: number;
  startY: number;
  startedAt: number;
  pointerType: string;
  button: number;
  dragging: boolean;
}

const pointerDragThreshold = 10;
const mouseClickDurationMs = 500;

export interface BrowserInputBindingOptions {
  target: HTMLElement;
  input: GameInputState;
}

export function bindBrowserInput({
  target,
  input,
}: BrowserInputBindingOptions): () => void {
  const documentTarget = target.ownerDocument;
  const windowTarget = documentTarget.defaultView;
  if (!windowTarget) throw new Error("Game input requires a window");

  const cameraPointers = new Map<number, PointerRecord>();
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!movementCodes.has(event.code) && !actionCodes.has(event.code)) return;
    const source =
      typeof windowTarget.Element === "function" &&
      event.target instanceof windowTarget.Element
        ? event.target
        : null;
    if (source?.closest("input, textarea, select, [role=dialog]")) return;
    event.preventDefault();
    // Recovery and pause clear held inputs; OS repeats must not re-arm them.
    if (event.repeat) return;
    input.setKey(event.code, true);
  };
  const onKeyUp = (event: KeyboardEvent): void =>
    input.setKey(event.code, false);
  const onPointerDown = (event: PointerEvent): void => {
    const element =
      typeof windowTarget.Element === "function" &&
      event.target instanceof windowTarget.Element
        ? event.target
        : null;
    if (element?.closest("[data-quest-ui]")) return;
    if (
      event.pointerType === "mouse"
        ? event.button !== 0 && event.button !== 2
        : event.button !== 0
    )
      return;
    cameraPointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: event.timeStamp,
      pointerType: event.pointerType,
      button: event.button,
      dragging: false,
    });
    try {
      target.setPointerCapture?.(event.pointerId);
    } catch {
      // Window-level termination still retires the contact if capture fails.
    }
    event.preventDefault();
  };
  const onPointerMove = (event: PointerEvent): void => {
    const previous = cameraPointers.get(event.pointerId);
    if (!previous) return;
    if (
      Math.hypot(
        event.clientX - previous.startX,
        event.clientY - previous.startY,
      ) > pointerDragThreshold
    )
      previous.dragging = true;
    if (previous.pointerType !== "touch" || previous.dragging) {
      input.addPointerLook(
        event.clientX - previous.x,
        event.clientY - previous.y,
      );
      previous.x = event.clientX;
      previous.y = event.clientY;
    }
    event.preventDefault();
  };
  const stopPointer = (event: PointerEvent, allowAction = true): void => {
    const pointer = cameraPointers.get(event.pointerId);
    cameraPointers.delete(event.pointerId);
    const elapsed = pointer ? event.timeStamp - pointer.startedAt : -1;
    const distance = pointer
      ? Math.hypot(
          event.clientX - pointer.startX,
          event.clientY - pointer.startY,
        )
      : Number.POSITIVE_INFINITY;
    if (
      allowAction &&
      event.type === "pointerup" &&
      pointer?.pointerType === "mouse" &&
      event.button === pointer.button &&
      !pointer.dragging &&
      distance <= pointerDragThreshold &&
      elapsed >= 0 &&
      elapsed <= mouseClickDurationMs
    ) {
      const action = pointer.button === 0 ? "attack" : "guard";
      input.set(action, true);
      input.set(action, false);
    }
    if (target.hasPointerCapture?.(event.pointerId))
      target.releasePointerCapture(event.pointerId);
  };
  const clearAll = (): void => {
    for (const pointerId of cameraPointers.keys()) {
      if (target.hasPointerCapture?.(pointerId))
        target.releasePointerCapture(pointerId);
    }
    cameraPointers.clear();
    input.clear();
  };
  const cancelCameraPointer = (event: PointerEvent): void => {
    stopPointer(event, false);
  };
  const finishCameraPointer = (event: PointerEvent): void => {
    // Capture listeners run before the canvas handler. Finalize here so an
    // uncaptured release outside the canvas cannot leave a stale contact.
    // Pointer capture retargets the event to the canvas even when the pointer
    // is physically over UI, so use the release coordinates for this check.
    const releaseTarget = documentTarget.elementFromPoint?.(
      event.clientX,
      event.clientY,
    );
    stopPointer(event, releaseTarget === target);
  };
  const onContextMenu = (event: MouseEvent): void => {
    const element =
      typeof windowTarget.Element === "function" &&
      event.target instanceof windowTarget.Element
        ? event.target
        : null;
    if (element?.closest("[data-quest-ui]")) return;
    event.preventDefault();
  };
  let landscape = windowTarget.innerWidth > windowTarget.innerHeight;
  const onResize = (): void => {
    const nextLandscape = windowTarget.innerWidth > windowTarget.innerHeight;
    if (nextLandscape !== landscape) clearAll();
    landscape = nextLandscape;
  };
  const onVisibility = (): void => {
    if (documentTarget.visibilityState !== "visible") clearAll();
  };

  windowTarget.addEventListener("keydown", onKeyDown, { passive: false });
  windowTarget.addEventListener("keyup", onKeyUp);
  windowTarget.addEventListener("blur", clearAll);
  windowTarget.addEventListener("pagehide", clearAll);
  windowTarget.addEventListener("resize", onResize);
  // A browser can cancel one touch in a multi-contact gesture. Each gameplay
  // control owns its pointer, so cancelling one must not erase a still-held
  // joystick or a separate queued action.
  windowTarget.addEventListener("pointercancel", cancelCameraPointer, true);
  windowTarget.addEventListener("pointerup", finishCameraPointer, true);
  target.addEventListener("pointerdown", onPointerDown, { passive: false });
  target.addEventListener("pointermove", onPointerMove, { passive: false });
  target.addEventListener("pointerup", stopPointer);
  target.addEventListener("pointercancel", stopPointer);
  target.addEventListener("contextmenu", onContextMenu);
  documentTarget.addEventListener("visibilitychange", onVisibility);
  documentTarget.addEventListener("freeze", clearAll);

  return () => {
    clearAll();
    windowTarget.removeEventListener("keydown", onKeyDown);
    windowTarget.removeEventListener("keyup", onKeyUp);
    windowTarget.removeEventListener("blur", clearAll);
    windowTarget.removeEventListener("pagehide", clearAll);
    windowTarget.removeEventListener("resize", onResize);
    windowTarget.removeEventListener(
      "pointercancel",
      cancelCameraPointer,
      true,
    );
    windowTarget.removeEventListener("pointerup", finishCameraPointer, true);
    target.removeEventListener("pointerdown", onPointerDown);
    target.removeEventListener("pointermove", onPointerMove);
    target.removeEventListener("pointerup", stopPointer);
    target.removeEventListener("pointercancel", stopPointer);
    target.removeEventListener("contextmenu", onContextMenu);
    documentTarget.removeEventListener("visibilitychange", onVisibility);
    documentTarget.removeEventListener("freeze", clearAll);
  };
}
