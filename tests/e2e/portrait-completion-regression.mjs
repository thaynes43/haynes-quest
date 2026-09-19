import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { chromium } from "playwright";

import {
  delay,
  inspectGame,
  waitForInspection,
} from "./authored-browser-driver.mjs";

const url = process.env.QUEST_E2E_URL ?? "http://127.0.0.1:4397";
const runLabel = process.env.QUEST_E2E_RUN_LABEL ?? "candidate";
const outDir = `test-results/portrait-completion-regression/${runLabel}`;
const reportPath = `${outDir}/report.json`;
const expectedBundleSha256 = process.env.QUEST_E2E_BUNDLE_SHA256;
const timeoutMs = Number(process.env.QUEST_E2E_TIMEOUT_MS ?? 120_000);
assert.ok(Number.isFinite(timeoutMs) && timeoutMs >= 30_000);
await fs.mkdir(outDir, { recursive: true });

const report = {
  startedAt: new Date().toISOString(),
  status: "running",
  url,
  browser: null,
  bundle: null,
  emulation: {
    engine: "Chromium",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    limits: [
      "Chromium touch emulation does not reproduce Mobile Safari browser chrome or WebKit pointer-event internals.",
      "CDP creates trusted touch contacts; the forced capture exception, hidden Chromium-only capture lifecycle, and explicit release of implicit capture model a browser where capture never succeeded.",
    ],
  },
  captureFailureRelease: null,
  actionCaptureFailure: null,
  secondFinger: null,
  resize: null,
  orientation: null,
  pointerTrace: [],
  screenshots: [],
  responseErrors: [],
  pageErrors: [],
  consoleErrors: [],
};

let browser;
let context;
let page;
let screenshotSequence = 0;

const mark = (stage, details = {}) => {
  console.log(`[portrait-regression] ${stage} ${JSON.stringify(details)}`);
};

const screenshot = async (name) => {
  const safeName = name.replaceAll(/[^a-z0-9-]/gi, "-").toLowerCase();
  const path = `${outDir}/${String(++screenshotSequence).padStart(2, "0")}-${safeName}.png`;
  await page.screenshot({ path, fullPage: true });
  report.screenshots.push(path);
};

const timer = setTimeout(() => {
  void context?.close().catch(() => undefined);
  void browser?.close().catch(() => undefined);
}, timeoutMs);

const point = (id, x, y) => ({
  id,
  x,
  y,
  radiusX: 5,
  radiusY: 5,
  force: 1,
});

try {
  const indexResponse = await fetch(url);
  assert.equal(indexResponse.status, 200, "regression fixture unavailable");
  assert.match(indexResponse.headers.get("cache-control") ?? "", /no-store/);
  const indexHtml = await indexResponse.text();
  const bundlePath = indexHtml.match(/src="([^"]+\.js)"/)?.[1];
  assert.ok(bundlePath, "client bundle path missing");
  const bundleResponse = await fetch(new URL(bundlePath, url));
  assert.equal(bundleResponse.status, 200, "client bundle unavailable");
  const bundleBytes = Buffer.from(await bundleResponse.arrayBuffer());
  const bundleSha256 = createHash("sha256").update(bundleBytes).digest("hex");
  if (expectedBundleSha256)
    assert.equal(bundleSha256, expectedBundleSha256, "unexpected client bundle");
  report.bundle = {
    path: bundlePath,
    bytes: bundleBytes.byteLength,
    sha256: bundleSha256,
  };

  browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--disable-dev-shm-usage",
    ],
  });
  report.browser = browser.version();
  context = await browser.newContext({
    viewport: report.emulation.viewport,
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
  });
  await context.addInitScript(() => {
    const nativeSetPointerCapture = HTMLElement.prototype.setPointerCapture;
    const nativeReleasePointerCapture =
      HTMLElement.prototype.releasePointerCapture;
    Object.defineProperties(window, {
      __questNativeCapture: {
        configurable: true,
        value: {
          set: nativeSetPointerCapture,
          release: nativeReleasePointerCapture,
        },
      },
      __questPointerTrace: {
        configurable: true,
        value: [],
        writable: true,
      },
    });
    HTMLElement.prototype.setPointerCapture = function setPointerCapture(
      pointerId,
    ) {
      if (
        this.matches?.(
          '[data-testid="joystick"], [data-quest-pointer-action]',
        )
      ) {
        window.__questPointerTrace.push({
          type: "forced-capture-error",
          pointerId,
          target: this.getAttribute("aria-label") ?? "joystick",
          trusted: null,
        });
        throw new DOMException(
          "Injected joystick capture failure",
          "InvalidStateError",
        );
      }
      return nativeSetPointerCapture.call(this, pointerId);
    };
    // Chromium implicitly captures every touch pointer even when the explicit
    // capture request throws. To model a browser where capture never succeeded,
    // keep Chromium's compatibility got/lost lifecycle away from React while
    // still recording the trusted touch stream below.
    for (const type of ["gotpointercapture", "lostpointercapture"]) {
      window.addEventListener(
        type,
        (event) => {
          if (
            !event.target?.closest?.(
              '[data-testid="joystick"], [data-quest-pointer-action]',
            )
          )
            return;
          const control = event.target.closest(
            '[data-testid="joystick"], [data-quest-pointer-action]',
          );
          window.__questPointerTrace.push({
            type: `suppressed-${type}`,
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            target:
              control.getAttribute("aria-label") ?? "joystick",
            x: event.clientX,
            y: event.clientY,
            trusted: event.isTrusted,
          });
          event.stopImmediatePropagation();
        },
        true,
      );
    }
    for (const type of [
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
      "gotpointercapture",
      "lostpointercapture",
    ]) {
      window.addEventListener(
        type,
        (event) => {
          window.__questPointerTrace.push({
            type,
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            target:
              event.target instanceof Element
                ? `${event.target.tagName}.${event.target.className}`
                : "window",
            x: event.clientX,
            y: event.clientY,
            trusted: event.isTrusted,
          });
          if (window.__questPointerTrace.length > 160)
            window.__questPointerTrace.shift();
        },
        true,
      );
    }
  });

  page = await context.newPage();
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400)
      report.responseErrors.push({
        status: response.status(),
        url: response.url(),
      });
  });

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: "Play from the beginning", exact: true })
    .tap();
  await page
    .locator("canvas[data-quest-canvas=true]")
    .waitFor({ timeout: 20_000 });
  await waitForInspection({
    page,
    screenshot,
    label: "game-ready",
    timeout: 20_000,
    predicate: (inspection) =>
      inspection.status.phase === "exploring" &&
      inspection.status.grounded === true,
  });
  const cdp = await context.newCDPSession(page);
  const sendTouch = (type, touchPoints) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
  let nextContactId = 20;
  const stickGeometry = async () => {
    const bounds = await page.getByTestId("joystick").boundingBox();
    assert.ok(bounds, "touch joystick has no bounds");
    const center = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
    const radius = bounds.width * 0.34;
    return { bounds, center, radius };
  };
  const expectedStickInput = (bounds, contact) => {
    const origin = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
    const travel = Math.max(16, bounds.width * 0.29);
    const dx = contact.x - origin.x;
    const dy = contact.y - origin.y;
    const rawDistance = Math.hypot(dx, dy);
    const distance = Math.min(1, rawDistance / travel);
    const deadZone = 8 / travel;
    const strength =
      distance <= deadZone ? 0 : (distance - deadZone) / (1 - deadZone);
    return {
      moveX: rawDistance ? (dx / rawDistance) * strength : 0,
      moveY: rawDistance ? (-dy / rawDistance) * strength : 0,
      origin,
      travel,
      distance,
      deadZone,
    };
  };
  const beginStick = async (direction, scale = 1) => {
    const geometry = await stickGeometry();
    const id = nextContactId++;
    const deltas = {
      "upper-left": { x: -1, y: -1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    const delta = deltas[direction];
    const magnitude = Math.hypot(delta.x, delta.y);
    const origin = point(id, geometry.center.x, geometry.center.y);
    const target = point(
      id,
      geometry.center.x +
        (delta.x / magnitude) * geometry.radius * scale,
      geometry.center.y +
        (delta.y / magnitude) * geometry.radius * scale,
    );
    await sendTouch("touchStart", [origin]);
    await sendTouch("touchMove", [target]);
    const pointerId = await page.evaluate(() => {
      const entries = window.__questPointerTrace.filter(
        (entry) =>
          entry.type === "pointerdown" && entry.target.includes("joystick"),
      );
      return entries.at(-1)?.pointerId ?? null;
    });
    assert.ok(pointerId, "joystick pointerdown was not observed");
    return { id, pointerId, target, geometry };
  };

  mark("capture-failure:start", report.bundle);
  const stuckContact = await beginStick("upper-left");
  const held = await waitForInspection({
    page,
    screenshot,
    label: "capture-failure-held",
    predicate: (inspection) =>
      inspection.input.moveX < -0.35 && inspection.input.moveY > 0.35,
  });
  const captureRelease = await page.evaluate((pointerId) => {
    const joystick = document.querySelector('[data-testid="joystick"]');
    const before = joystick?.hasPointerCapture?.(pointerId) ?? false;
    if (before)
      window.__questNativeCapture.release.call(joystick, pointerId);
    return {
      pointerId,
      implicitCaptureBeforeRelease: before,
      captureAfterRelease:
        joystick?.hasPointerCapture?.(pointerId) ?? false,
    };
  }, stuckContact.pointerId);
  const outside = point(
    stuckContact.id,
    report.emulation.viewport.width * 0.58,
    report.emulation.viewport.height * 0.48,
  );
  await sendTouch("touchMove", [outside]);
  await delay(60);
  const afterOffControlMove = await inspectGame(page);
  assert.ok(afterOffControlMove, "inspection missing after off-control move");
  assert.ok(
    Math.hypot(
      afterOffControlMove.input.moveX,
      afterOffControlMove.input.moveY,
    ) > 0.3,
    "off-control movement cleared before its owning contact ended",
  );
  await sendTouch("touchEnd", []);
  await delay(250);
  const afterOutsideRelease = await inspectGame(page);
  assert.ok(afterOutsideRelease, "inspection missing after outside release");

  const nextContact = await beginStick("right", 0.8);
  await delay(180);
  const afterNextContact = await inspectGame(page);
  assert.ok(afterNextContact, "inspection missing after next touch");
  await sendTouch("touchEnd", []);
  await delay(180);
  const afterNextRelease = await inspectGame(page);
  assert.ok(afterNextRelease, "inspection missing after next release");
  report.captureFailureRelease = {
    forcedCaptureError: true,
    captureRelease,
    owningPointerId: stuckContact.pointerId,
    heldInput: held.input,
    offControlPoint: { x: outside.x, y: outside.y },
    inputAfterOffControlMove: afterOffControlMove.input,
    inputAfterOffControlRelease: afterOutsideRelease.input,
    subsequentPointerId: nextContact.pointerId,
    inputDuringSubsequentContact: afterNextContact.input,
    inputAfterSubsequentRelease: afterNextRelease.input,
  };
  await screenshot("capture-failure-recovered");
  assert.equal(
    afterOutsideRelease.input.moveX,
    0,
    "off-control release left horizontal movement latched",
  );
  assert.equal(
    afterOutsideRelease.input.moveY,
    0,
    "off-control release left vertical movement latched",
  );
  assert.ok(
    afterNextContact.input.moveX > 0.3,
    "a subsequent joystick contact was rejected",
  );
  assert.equal(afterNextRelease.input.moveX, 0);
  assert.equal(afterNextRelease.input.moveY, 0);
  assert.equal(captureRelease.captureAfterRelease, false);
  const joystickCaptureFailure = await page.evaluate((pointerId) =>
    window.__questPointerTrace.some(
      (entry) =>
        entry.type === "forced-capture-error" &&
        entry.target === "Touch movement control" &&
        entry.pointerId === pointerId,
    ),
  stuckContact.pointerId);
  assert.equal(
    joystickCaptureFailure,
    true,
    "the owning joystick pointer did not receive the forced capture failure",
  );
  mark("capture-failure:complete", report.captureFailureRelease);

  const beforeActionFailure = await waitForInspection({
    page,
    screenshot,
    label: "action-capture-grounded",
    predicate: (inspection) => inspection.status.grounded,
  });
  const jumpButton = page.getByRole("button", {
    name: "Jump",
    exact: true,
  });
  const jumpFailureBounds = await jumpButton.boundingBox();
  assert.ok(jumpFailureBounds, "Jump button has no bounds");
  const jumpFailureContact = point(
    nextContactId++,
    jumpFailureBounds.x + jumpFailureBounds.width / 2,
    jumpFailureBounds.y + jumpFailureBounds.height / 2,
  );
  await sendTouch("touchStart", [jumpFailureContact]);
  const firstJump = await waitForInspection({
    page,
    screenshot,
    label: "action-capture-first-jump",
    predicate: (inspection) =>
      inspection.status.jumpSequence >
      beforeActionFailure.status.jumpSequence,
  });
  assert.equal(
    firstJump.status.jumpSequence,
    beforeActionFailure.status.jumpSequence + 1,
    "the first failed-capture press queued duplicate jumps",
  );
  assert.equal(
    firstJump.input.jump,
    true,
    "the failed-capture Jump contact was not held before termination",
  );
  const jumpPointerId = await page.evaluate(() => {
    const entries = window.__questPointerTrace.filter(
      (entry) =>
        entry.type === "forced-capture-error" && entry.target === "Jump",
    );
    return entries.at(-1)?.pointerId ?? null;
  });
  assert.ok(jumpPointerId, "Jump pointerdown was not observed");
  const actionCaptureRelease = await page.evaluate(
    ({ pointerId, x, y }) => {
      const target = document.elementFromPoint(x, y);
      const before = target?.hasPointerCapture?.(pointerId) ?? false;
      if (before)
        window.__questNativeCapture.release.call(target, pointerId);
      return {
        pointerId,
        implicitCaptureBeforeRelease: before,
        captureAfterRelease: target?.hasPointerCapture?.(pointerId) ?? false,
        captureTarget: target?.tagName ?? null,
      };
    },
    {
      pointerId: jumpPointerId,
      x: jumpFailureContact.x,
      y: jumpFailureContact.y,
    },
  );
  const jumpOutside = point(
    jumpFailureContact.id,
    report.emulation.viewport.width * 0.52,
    report.emulation.viewport.height * 0.48,
  );
  await sendTouch("touchMove", [jumpOutside]);
  await delay(60);
  const actionBeforeOwnerEnd = await inspectGame(page);
  assert.ok(actionBeforeOwnerEnd);
  assert.equal(
    actionBeforeOwnerEnd.input.jump,
    true,
    "off-control movement released Jump before its owning contact ended",
  );
  await sendTouch("touchEnd", []);
  const actionAfterOwnerEnd = await waitForInspection({
    page,
    screenshot,
    label: "action-capture-owner-ended",
    predicate: (inspection) => inspection.input.jump === false,
  });
  await waitForInspection({
    page,
    screenshot,
    label: "action-capture-first-landed",
    predicate: (inspection) => inspection.status.grounded,
  });
  const secondJumpContact = point(
    nextContactId++,
    jumpFailureBounds.x + jumpFailureBounds.width / 2,
    jumpFailureBounds.y + jumpFailureBounds.height / 2,
  );
  await sendTouch("touchStart", [secondJumpContact]);
  await delay(25);
  await sendTouch("touchEnd", []);
  const secondJump = await waitForInspection({
    page,
    screenshot,
    label: "action-capture-second-jump",
    predicate: (inspection) =>
      inspection.status.jumpSequence > firstJump.status.jumpSequence,
  });
  assert.equal(
    secondJump.status.jumpSequence,
    firstJump.status.jumpSequence + 1,
    "the re-armed Jump press queued zero or duplicate jumps",
  );
  await waitForInspection({
    page,
    screenshot,
    label: "action-capture-second-landed",
    predicate: (inspection) => inspection.status.grounded,
  });
  report.actionCaptureFailure = {
    forcedCaptureError: true,
    captureRelease: actionCaptureRelease,
    offControlPoint: { x: jumpOutside.x, y: jumpOutside.y },
    jumpSequenceBefore: beforeActionFailure.status.jumpSequence,
    jumpSequenceFirst: firstJump.status.jumpSequence,
    jumpSequenceSecond: secondJump.status.jumpSequence,
    inputBeforeOwnerEnd: actionBeforeOwnerEnd.input,
    inputAfterOwnerEnd: actionAfterOwnerEnd.input,
    rearmed: true,
  };
  assert.equal(actionCaptureRelease.captureAfterRelease, false);
  mark("action-capture:complete", report.actionCaptureFailure);

  const beforeSecondFinger = await waitForInspection({
    page,
    screenshot,
    label: "second-finger-grounded",
    predicate: (inspection) => inspection.status.grounded,
  });
  const movement = await beginStick("left", 0.55);
  const heldBeforeAction = await waitForInspection({
    page,
    screenshot,
    label: "second-finger-stick-held",
    predicate: (inspection) => inspection.input.moveX < -0.2,
  });
  const jumpBounds = await page
    .getByRole("button", { name: "Jump", exact: true })
    .boundingBox();
  assert.ok(jumpBounds, "Jump button has no bounds");
  const jumpContact = point(
    nextContactId++,
    jumpBounds.x + jumpBounds.width / 2,
    jumpBounds.y + jumpBounds.height / 2,
  );
  await sendTouch("touchStart", [movement.target, jumpContact]);
  await delay(20);
  await sendTouch("touchEnd", [jumpContact]);
  const heldAfterActionRelease = await waitForInspection({
    page,
    screenshot,
    label: "second-finger-release-retained-stick",
    predicate: (inspection) =>
      inspection.input.moveX < -0.2 &&
      inspection.input.jump === false &&
      inspection.status.jumpSequence > beforeSecondFinger.status.jumpSequence,
  });
  assert.equal(
    heldAfterActionRelease.status.jumpSequence,
    beforeSecondFinger.status.jumpSequence + 1,
    "the second-finger Jump queued zero or duplicate jumps",
  );
  assert.equal(
    heldAfterActionRelease.input.jump,
    false,
    "releasing the action finger left Jump held",
  );
  const unrelatedCancelId = movement.pointerId + 10_000;
  await page.evaluate((pointerId) => {
    const jump = document.querySelector('button[aria-label="Jump"]');
    jump?.dispatchEvent(
      new PointerEvent("pointercancel", {
        bubbles: true,
        pointerId,
        pointerType: "touch",
      }),
    );
  }, unrelatedCancelId);
  const heldAfterUnrelatedCancel = await waitForInspection({
    page,
    screenshot,
    label: "second-finger-unrelated-cancel-retained-stick",
    predicate: (inspection) =>
      inspection.input.moveX < -0.2 && inspection.input.jump === false,
  });
  await sendTouch("touchEnd", []);
  const afterMovementRelease = await waitForInspection({
    page,
    screenshot,
    label: "second-finger-all-released",
    predicate: (inspection) =>
      inspection.input.moveX === 0 && inspection.input.moveY === 0,
  });
  report.secondFinger = {
    movementPointerId: movement.pointerId,
    jumpContactId: jumpContact.id,
    unrelatedCancelPointerId: unrelatedCancelId,
    heldBeforeAction: heldBeforeAction.input,
    heldAfterActionRelease: heldAfterActionRelease.input,
    heldAfterUnrelatedCancel: heldAfterUnrelatedCancel.input,
    jumpSequenceBefore: beforeSecondFinger.status.jumpSequence,
    jumpSequenceAfter: heldAfterActionRelease.status.jumpSequence,
    inputAfterMovementRelease: afterMovementRelease.input,
    cancelLimit:
      "CDP has no targeted partial touchCancel; an untrusted unrelated pointercancel verifies pointer ownership after a trusted two-contact Jump/release gesture.",
  };
  assert.ok(
    heldAfterUnrelatedCancel.input.moveX < -0.2,
    "a different pointer cancellation cleared the held joystick",
  );
  assert.equal(
    heldAfterUnrelatedCancel.input.jump,
    false,
    "an unrelated cancellation re-latched Jump",
  );
  mark("second-finger:complete", report.secondFinger);

  await waitForInspection({
    page,
    screenshot,
    label: "resize-grounded",
    predicate: (inspection) => inspection.status.grounded,
  });
  const resizedMovement = await beginStick("right", 0.55);
  const beforeResize = await waitForInspection({
    page,
    screenshot,
    label: "resize-stick-held",
    predicate: (inspection) => inspection.input.moveX > 0.2,
  });
  const boundsBeforeResize = resizedMovement.geometry.bounds;
  await page.setViewportSize({ width: 360, height: 844 });
  await page.waitForFunction(
    (priorWidth) => {
      const joystick = document.querySelector('[data-testid="joystick"]');
      return (
        joystick &&
        Math.abs(joystick.getBoundingClientRect().width - priorWidth) > 0.5
      );
    },
    boundsBeforeResize.width,
  );
  const boundsAfterResize = await page.getByTestId("joystick").boundingBox();
  assert.ok(boundsAfterResize);
  const expectedAfterResize = expectedStickInput(
    boundsAfterResize,
    resizedMovement.target,
  );
  const afterResize = await waitForInspection({
    page,
    screenshot,
    label: "resize-stick-remeasured",
    predicate: (inspection) =>
      Math.abs(inspection.input.moveX - expectedAfterResize.moveX) < 0.02 &&
      Math.abs(inspection.input.moveY - expectedAfterResize.moveY) < 0.02,
  });
  assert.ok(
    Math.hypot(
      afterResize.input.moveX - beforeResize.input.moveX,
      afterResize.input.moveY - beforeResize.input.moveY,
    ) > 0.05,
    "same-orientation resize retained the stale pre-resize vector",
  );
  const resizedCenter = point(
    resizedMovement.id,
    expectedAfterResize.origin.x,
    expectedAfterResize.origin.y,
  );
  await sendTouch("touchMove", [resizedCenter]);
  const centeredAfterResize = await waitForInspection({
    page,
    screenshot,
    label: "resize-stick-new-center-neutral",
    predicate: (inspection) =>
      inspection.input.moveX === 0 && inspection.input.moveY === 0,
  });
  const resizedRight = point(
    resizedMovement.id,
    expectedAfterResize.origin.x + boundsAfterResize.width * 0.34 * 0.55,
    expectedAfterResize.origin.y,
  );
  await sendTouch("touchMove", [resizedRight]);
  const movedAfterResize = await waitForInspection({
    page,
    screenshot,
    label: "resize-stick-new-right",
    predicate: (inspection) => inspection.input.moveX > 0.2,
  });
  await sendTouch("touchEnd", []);
  const afterResizeRelease = await waitForInspection({
    page,
    screenshot,
    label: "resize-stick-released",
    predicate: (inspection) =>
      inspection.input.moveX === 0 && inspection.input.moveY === 0,
  });
  report.resize = {
    viewportBefore: { width: 390, height: 844 },
    viewportAfter: { width: 360, height: 844 },
    boundsBefore: boundsBeforeResize,
    boundsAfter: boundsAfterResize,
    owningPointerId: resizedMovement.pointerId,
    stationaryContact: resizedMovement.target,
    expectedAfterResize,
    newCenter: resizedCenter,
    newRightPoint: resizedRight,
    inputBefore: beforeResize.input,
    inputAfter: afterResize.input,
    inputAtNewCenter: centeredAfterResize.input,
    inputAfterNewRightMove: movedAfterResize.input,
    inputAfterRelease: afterResizeRelease.input,
  };
  assert.notEqual(
    boundsAfterResize.width,
    boundsBeforeResize.width,
    "same-orientation resize did not recompute the joystick bounds",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await delay(120);
  mark("resize:complete", report.resize);

  const orientationMovement = await beginStick("right", 0.55);
  const beforeOrientation = await waitForInspection({
    page,
    screenshot,
    label: "orientation-stick-held",
    predicate: (inspection) => inspection.input.moveX > 0.2,
  });
  await page.setViewportSize({ width: 844, height: 390 });
  const afterOrientation = await waitForInspection({
    page,
    screenshot,
    label: "orientation-stick-cleared",
    predicate: (inspection) =>
      inspection.input.moveX === 0 && inspection.input.moveY === 0,
  });
  await sendTouch("touchEnd", []);
  report.orientation = {
    pointerId: orientationMovement.pointerId,
    viewportBefore: { width: 390, height: 844 },
    viewportAfter: { width: 844, height: 390 },
    inputBefore: beforeOrientation.input,
    inputAfter: afterOrientation.input,
  };
  await screenshot("landscape-orientation-cleared");
  mark("orientation:complete", report.orientation);

  report.pointerTrace = await page.evaluate(() => window.__questPointerTrace);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responseErrors, []);
  assert.deepEqual(report.consoleErrors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = {
    name: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : null,
  };
  if (page && !page.isClosed()) {
    report.pointerTrace = await page
      .evaluate(() => window.__questPointerTrace ?? [])
      .catch(() => []);
    await screenshot("failure").catch(() => undefined);
  }
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await context?.close().catch(() => undefined);
  await browser?.close().catch(() => undefined);
  mark("finished", { status: report.status, reportPath });
}
