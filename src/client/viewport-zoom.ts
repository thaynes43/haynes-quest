/** Keep browser zoom gestures separate from scrolling and game input. */
export function installViewportZoomLock(doc: Document): () => void {
  const preventZoom = (event: Event) => event.preventDefault();
  const onWheel = (event: WheelEvent) => {
    // Trackpad pinch is delivered as Ctrl-wheel in Chromium and Firefox.
    if (event.ctrlKey) event.preventDefault();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if ((!event.ctrlKey && !event.metaKey) || event.altKey || event.isComposing)
      return;
    if (
      ["+", "=", "-", "_"].includes(event.key) ||
      event.code === "NumpadAdd" ||
      event.code === "NumpadSubtract"
    )
      event.preventDefault();
    // Leave Ctrl/Cmd-0 available to restore browser-controlled default scale.
  };
  const options = { capture: true, passive: false };
  // Safari exposes its pinch separately from ordinary touch/pointer events.
  doc.addEventListener("gesturestart", preventZoom, options);
  doc.addEventListener("gesturechange", preventZoom, options);
  doc.addEventListener("wheel", onWheel, options);
  doc.addEventListener("keydown", onKeyDown, true);
  return () => {
    doc.removeEventListener("gesturestart", preventZoom, true);
    doc.removeEventListener("gesturechange", preventZoom, true);
    doc.removeEventListener("wheel", onWheel, true);
    doc.removeEventListener("keydown", onKeyDown, true);
  };
}
