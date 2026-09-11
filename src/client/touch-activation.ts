/**
 * Keep buttons tappable while another finger is on the screen.
 *
 * The tested Chromium touch path omits `click` for multi-contact gestures:
 * a thumb parked on the joystick, or a hand resting on the glass when a dialog
 * appears, prevents another finger from activating an `onClick` control.
 * Pointer events are still dispatched per contact, so this
 * installer turns a completed, unmoved touch press on an activatable element
 * into a click when the press was part of a multi-touch sequence, and swallows
 * a late native click for the same press so nothing activates twice. Controls
 * marked as pointer-driven gameplay controls handle their own pointers and
 * are left alone. Ordinary touch buttons may have implicit pointer capture.
 */
const ACTIVATABLE = "button, a[href], label, [role=button]";
const MOVE_TOLERANCE_PX = 12;
const DUPLICATE_WINDOW_MS = 600;

interface TouchPress {
  target: Element | null;
  x: number;
  y: number;
  moved: boolean;
  multi: boolean;
}

function activatableFrom(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;
  if (target.closest("[data-quest-pointer-action]")) return null;
  return target.closest(ACTIVATABLE);
}

function isDisabled(element: Element): boolean {
  return (
    element.matches(":disabled") ||
    element.getAttribute("aria-disabled") === "true"
  );
}

export function installMultiTouchActivation(doc: Document): () => void {
  const presses = new Map<number, TouchPress>();
  let synthesized: { target: Element; pointerId: number; at: number } | null =
    null;
  const now = () => doc.defaultView?.performance.now() ?? Date.now();

  const onPointerDown = (event: PointerEvent): void => {
    // A fresh physical press must not be mistaken for the previous touch's
    // compatibility click, even when it reaches the same button immediately.
    synthesized = null;
    if (event.pointerType !== "touch") return;
    const multi = presses.size > 0;
    for (const press of presses.values()) press.multi = true;
    presses.set(event.pointerId, {
      target: activatableFrom(event.target),
      x: event.clientX,
      y: event.clientY,
      moved: false,
      multi,
    });
  };

  const onPointerMove = (event: PointerEvent): void => {
    const press = presses.get(event.pointerId);
    if (!press || press.moved) return;
    if (
      Math.hypot(event.clientX - press.x, event.clientY - press.y) >
      MOVE_TOLERANCE_PX
    )
      press.moved = true;
  };

  const onPointerUp = (event: PointerEvent): void => {
    const press = presses.get(event.pointerId);
    presses.delete(event.pointerId);
    if (!press?.target || press.moved || !press.multi) return;
    if (
      Math.hypot(event.clientX - press.x, event.clientY - press.y) >
      MOVE_TOLERANCE_PX
    )
      return;
    const target = press.target;
    if (!target.isConnected || isDisabled(target)) return;
    const lifted = activatableFrom(
      typeof doc.elementFromPoint === "function"
        ? doc.elementFromPoint(event.clientX, event.clientY)
        : event.target,
    );
    if (lifted !== target) return;
    synthesized = { target, pointerId: event.pointerId, at: now() };
    (target as HTMLElement).click();
  };

  const onPointerCancel = (event: PointerEvent): void => {
    presses.delete(event.pointerId);
  };

  const onClick = (event: MouseEvent): void => {
    if (!event.isTrusted || !synthesized) return;
    const { target, pointerId, at } = synthesized;
    if (now() - at > DUPLICATE_WINDOW_MS) {
      synthesized = null;
      return;
    }
    // Modern browsers identify clicks by their originating pointer. A
    // keyboard click (detail zero), or a click from a different pointer,
    // cannot be the compatibility event we are suppressing.
    if (event.detail === 0) return;
    if (
      "pointerId" in event &&
      (event.pointerId !== pointerId ||
        ("pointerType" in event && event.pointerType !== "touch"))
    )
      return;
    const clicked = event.target;
    if (
      clicked instanceof Node &&
      (clicked === target || target.contains(clicked))
    ) {
      synthesized = null;
      event.stopPropagation();
      event.preventDefault();
    }
  };

  const onKeyDown = (): void => {
    synthesized = null;
  };
  const reset = (): void => {
    presses.clear();
    synthesized = null;
  };
  const onVisibilityChange = (): void => {
    if (doc.hidden) reset();
  };

  doc.addEventListener("pointerdown", onPointerDown, true);
  doc.addEventListener("pointermove", onPointerMove, true);
  doc.addEventListener("pointerup", onPointerUp, true);
  doc.addEventListener("pointercancel", onPointerCancel, true);
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("keydown", onKeyDown, true);
  doc.addEventListener("visibilitychange", onVisibilityChange);
  doc.defaultView?.addEventListener("blur", reset);
  return () => {
    doc.removeEventListener("pointerdown", onPointerDown, true);
    doc.removeEventListener("pointermove", onPointerMove, true);
    doc.removeEventListener("pointerup", onPointerUp, true);
    doc.removeEventListener("pointercancel", onPointerCancel, true);
    doc.removeEventListener("click", onClick, true);
    doc.removeEventListener("keydown", onKeyDown, true);
    doc.removeEventListener("visibilitychange", onVisibilityChange);
    doc.defaultView?.removeEventListener("blur", reset);
    reset();
  };
}
