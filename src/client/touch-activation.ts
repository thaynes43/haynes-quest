/**
 * Keep buttons tappable while another finger is on the screen.
 *
 * Chromium-based browsers only recognise a tap, and therefore only dispatch
 * `click`, for a single-finger touch sequence. As soon as a second contact
 * exists — a thumb parked on the joystick, or a hand still resting on the
 * glass when a dialog appears — a tap on any control still fires its pointer
 * events but never a click, so every `onClick` button is dead until all
 * fingers lift. Pointer events are dispatched per contact regardless, so this
 * installer turns a completed, unmoved touch press on an activatable element
 * into a click when the press was part of a multi-touch sequence, and swallows
 * a late native click for the same press so nothing activates twice. Controls
 * that hold pointer capture (the joystick and the action buttons) handle their
 * own pointers and are left alone.
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
  return target instanceof Element ? target.closest(ACTIVATABLE) : null;
}

function isDisabled(element: Element): boolean {
  return (
    element.matches(":disabled") ||
    element.getAttribute("aria-disabled") === "true"
  );
}

export function installMultiTouchActivation(doc: Document): () => void {
  const presses = new Map<number, TouchPress>();
  let synthesized: { target: Element; at: number } | null = null;
  const now = () => doc.defaultView?.performance.now() ?? Date.now();

  const onPointerDown = (event: PointerEvent): void => {
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
    const target = press.target;
    if (!target.isConnected || isDisabled(target)) return;
    if (target.hasPointerCapture?.(event.pointerId)) return;
    const lifted = activatableFrom(
      doc.elementFromPoint?.(event.clientX, event.clientY) ?? event.target,
    );
    if (lifted !== target) return;
    synthesized = { target, at: now() };
    (target as HTMLElement).click();
  };

  const onPointerCancel = (event: PointerEvent): void => {
    presses.delete(event.pointerId);
  };

  const onClick = (event: MouseEvent): void => {
    if (!event.isTrusted || !synthesized) return;
    const { target, at } = synthesized;
    if (now() - at > DUPLICATE_WINDOW_MS) {
      synthesized = null;
      return;
    }
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

  doc.addEventListener("pointerdown", onPointerDown, true);
  doc.addEventListener("pointermove", onPointerMove, true);
  doc.addEventListener("pointerup", onPointerUp, true);
  doc.addEventListener("pointercancel", onPointerCancel, true);
  doc.addEventListener("click", onClick, true);
  return () => {
    doc.removeEventListener("pointerdown", onPointerDown, true);
    doc.removeEventListener("pointermove", onPointerMove, true);
    doc.removeEventListener("pointerup", onPointerUp, true);
    doc.removeEventListener("pointercancel", onPointerCancel, true);
    doc.removeEventListener("click", onClick, true);
    presses.clear();
    synthesized = null;
  };
}
