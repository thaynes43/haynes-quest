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
  };

  private readonly keys = new Set<string>();
  private pendingActions = { jump: false, interact: false };
  private pointerLookX = 0;
  private pointerLookY = 0;

  set(action: GameInputAction, value: number | boolean): void {
    if (analogActions.has(action)) {
      this.external[action as "moveX" | "moveY" | "lookX" | "lookY"] =
        clampUnit(Number(value));
      return;
    }
    const button = action as "jump" | "interact";
    if (value && !this.external[button]) this.pendingActions[button] = true;
    this.external[button] = Boolean(value);
  }

  setKey(code: string, pressed: boolean): void {
    if (!movementCodes.has(code) && !actionCodes.has(code)) return;
    if (pressed && !this.keys.has(code)) {
      if (code === "Space") this.pendingActions.jump = true;
      if (code === "KeyE") this.pendingActions.interact = true;
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
    };
  }

  consumeActions(): { jump: boolean; interact: boolean } {
    const result = { ...this.pendingActions };
    this.pendingActions = { jump: false, interact: false };
    return result;
  }

  clear(): void {
    this.pendingActions = { jump: false, interact: false };
    this.external.moveX = 0;
    this.external.moveY = 0;
    this.external.lookX = 0;
    this.external.lookY = 0;
    this.external.jump = false;
    this.external.interact = false;
    this.keys.clear();
    this.pointerLookX = 0;
    this.pointerLookY = 0;
  }
}

interface PointerRecord {
  x: number;
  y: number;
}

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
    const source = event.target instanceof Element ? event.target : null;
    if (source?.closest("input, textarea, select, [role=dialog]")) return;
    event.preventDefault();
    input.setKey(event.code, true);
  };
  const onKeyUp = (event: KeyboardEvent): void =>
    input.setKey(event.code, false);
  const onPointerDown = (event: PointerEvent): void => {
    const element = event.target instanceof Element ? event.target : null;
    if (element?.closest("[data-quest-ui]")) return;
    if (event.pointerType === "touch") {
      const rect = target.getBoundingClientRect();
      if (event.clientX < rect.left + rect.width / 2) return;
    } else if (event.button !== 0) {
      return;
    }
    cameraPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    target.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };
  const onPointerMove = (event: PointerEvent): void => {
    const previous = cameraPointers.get(event.pointerId);
    if (!previous) return;
    input.addPointerLook(
      event.clientX - previous.x,
      event.clientY - previous.y,
    );
    cameraPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.preventDefault();
  };
  const stopPointer = (event: PointerEvent): void => {
    cameraPointers.delete(event.pointerId);
  };
  const clearAll = (): void => {
    cameraPointers.clear();
    input.clear();
  };
  const onVisibility = (): void => {
    if (documentTarget.visibilityState !== "visible") clearAll();
  };

  windowTarget.addEventListener("keydown", onKeyDown, { passive: false });
  windowTarget.addEventListener("keyup", onKeyUp);
  windowTarget.addEventListener("blur", clearAll);
  windowTarget.addEventListener("pointercancel", clearAll, true);
  target.addEventListener("pointerdown", onPointerDown, { passive: false });
  target.addEventListener("pointermove", onPointerMove, { passive: false });
  target.addEventListener("pointerup", stopPointer);
  target.addEventListener("pointercancel", stopPointer);
  documentTarget.addEventListener("visibilitychange", onVisibility);

  return () => {
    clearAll();
    windowTarget.removeEventListener("keydown", onKeyDown);
    windowTarget.removeEventListener("keyup", onKeyUp);
    windowTarget.removeEventListener("blur", clearAll);
    windowTarget.removeEventListener("pointercancel", clearAll, true);
    target.removeEventListener("pointerdown", onPointerDown);
    target.removeEventListener("pointermove", onPointerMove);
    target.removeEventListener("pointerup", stopPointer);
    target.removeEventListener("pointercancel", stopPointer);
    documentTarget.removeEventListener("visibilitychange", onVisibility);
  };
}
