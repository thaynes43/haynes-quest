import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const url = process.env.QUEST_E2E_URL ?? "http://127.0.0.1:4421";
const runLabel = process.env.QUEST_E2E_RUN_LABEL ?? "candidate";
const expectedBundleSha256 = process.env.QUEST_E2E_BUNDLE_SHA256;
const expectedCssSha256 = process.env.QUEST_E2E_CSS_SHA256;
const expectedGameTouchAction = process.env.QUEST_E2E_GAME_TOUCH_ACTION;
const expectHeaderPinchZoom =
  process.env.QUEST_E2E_EXPECT_HEADER_PINCH_ZOOM === "true";
const expectAppZoomLock = process.env.QUEST_E2E_EXPECT_APP_ZOOM_LOCK === "true";
const timeoutMs = Number(process.env.QUEST_E2E_TIMEOUT_MS ?? 180_000);
const viewport = { width: 844, height: 390 };
const outDir = `test-results/phone-viewport-regression/${runLabel}`;
const reportPath = `${outDir}/report.json`;

assert.match(
  expectedBundleSha256 ?? "",
  /^[a-f0-9]{64}$/,
  "QUEST_E2E_BUNDLE_SHA256 is required",
);
assert.match(
  expectedCssSha256 ?? "",
  /^[a-f0-9]{64}$/,
  "QUEST_E2E_CSS_SHA256 is required",
);
assert.ok(
  ["auto", "pan-y"].includes(expectedGameTouchAction),
  "QUEST_E2E_GAME_TOUCH_ACTION must be auto or pan-y",
);
assert.ok(Number.isFinite(timeoutMs) && timeoutMs >= 30_000);
await fs.mkdir(outDir, { recursive: true });

const report = {
  startedAt: new Date().toISOString(),
  status: "running",
  url,
  browser: null,
  viewport,
  assets: null,
  viewportPolicy: null,
  expected: {
    appZoomLock: expectAppZoomLock,
    gameTouchAction: expectedGameTouchAction,
    headerPinchZoom: expectHeaderPinchZoom,
  },
  scenarios: {},
  screenshots: [],
  networkWrites: [],
  responseErrors: [],
  pageErrors: [],
  consoleErrors: [],
  limits: [
    "Chromium mobile touch emulation does not reproduce physical iPhone Safari, browser chrome, or WebKit gesture internals.",
    "Input.dispatchTouchEvent supplies trusted browser touch contacts; this check does not use Input.synthesizePinchGesture or force a page scale.",
    "Pointer ownership, release/rearm, independent action input, resize, and rotation are covered by the separate portrait-completion regression; this report covers native zoom boundaries and native page/dialog scrolling.",
    "Trusted Chromium control-wheel and key events verify that the in-page guard cancels those inputs. Browser-menu zoom, operating-system magnification, and Safari-reserved shortcuts remain outside webpage control.",
  ],
};

let browser;
let activeContext;
let screenshotSequence = 0;
const contexts = new Set();

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const mark = (stage, details = {}) => {
  console.log(`[phone-viewport] ${stage} ${JSON.stringify(details)}`);
};

const point = (id, x, y) => ({
  id,
  x,
  y,
  radiusX: 5,
  radiusY: 5,
  force: 1,
});

const timer = setTimeout(() => {
  void activeContext?.close().catch(() => undefined);
  void browser?.close().catch(() => undefined);
}, timeoutMs);

async function fingerprintAsset(indexHtml, expression, expectedSha256, label) {
  const path = indexHtml.match(expression)?.[1];
  assert.ok(path, `${label} asset path missing`);
  const response = await fetch(new URL(path, url));
  assert.equal(response.status, 200, `${label} asset unavailable`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  assert.equal(sha256, expectedSha256, `unexpected ${label} asset`);
  return { path, bytes: bytes.byteLength, sha256 };
}

async function createScenario(name, { startGame = false } = {}) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
  });
  contexts.add(context);
  activeContext = context;
  await context.addInitScript(() => {
    window.__questGestureTrace = [];
    const describe = (target) => {
      if (!(target instanceof Element)) return "window";
      const testId = target.getAttribute("data-testid");
      const className =
        typeof target.className === "string"
          ? target.className.trim().split(/\s+/).filter(Boolean).join(".")
          : "";
      return `${target.tagName}${testId ? `[data-testid=${testId}]` : ""}${className ? `.${className}` : ""}`;
    };
    const surface = (target) => {
      if (!(target instanceof Element)) return "window";
      if (target.closest(".chapter-pill")) return "chapter-pill";
      if (target.closest(".combat-attack")) return "attack-control";
      if (target.closest(".era-modal")) return "help-dialog";
      if (target.closest(".playtest-start h1")) return "start-heading";
      if (target.closest(".playtest-start")) return "start-page";
      if (target.closest("canvas[data-quest-canvas=true]")) return "canvas";
      return "other";
    };
    for (const type of [
      "touchstart",
      "touchmove",
      "touchend",
      "touchcancel",
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
    ]) {
      window.addEventListener(
        type,
        (event) => {
          const touches = "touches" in event ? [...event.touches] : [];
          window.__questGestureTrace.push({
            type,
            target: describe(event.target),
            surface: surface(event.target),
            isTrusted: event.isTrusted,
            cancelable: event.cancelable,
            defaultPrevented: event.defaultPrevented,
            pointerId: "pointerId" in event ? event.pointerId : null,
            pointerType: "pointerType" in event ? event.pointerType : null,
            clientX: "clientX" in event ? event.clientX : null,
            clientY: "clientY" in event ? event.clientY : null,
            touches: touches.map((touch) => ({
              identifier: touch.identifier,
              clientX: touch.clientX,
              clientY: touch.clientY,
            })),
          });
          if (window.__questGestureTrace.length > 240)
            window.__questGestureTrace.shift();
        },
        true,
      );
    }
  });
  const page = await context.newPage();
  page.on("pageerror", (error) =>
    report.pageErrors.push({ scenario: name, message: error.message }),
  );
  page.on("console", (message) => {
    if (message.type() === "error")
      report.consoleErrors.push({ scenario: name, message: message.text() });
  });
  page.on("response", (response) => {
    if (response.status() >= 400)
      report.responseErrors.push({
        scenario: name,
        status: response.status(),
        url: response.url(),
      });
  });
  page.on("request", (request) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method()))
      report.networkWrites.push({
        scenario: name,
        method: request.method(),
        path: new URL(request.url()).pathname,
      });
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  if (startGame) {
    await page
      .getByRole("button", { name: "Play from the beginning", exact: true })
      .tap();
    await page
      .locator("canvas[data-quest-canvas=true]")
      .waitFor({ timeout: 20_000 });
    await page.locator(".chapter-pill").waitFor({ timeout: 10_000 });
  }
  const cdp = await context.newCDPSession(page);
  const finish = async () => {
    await context.close();
    contexts.delete(context);
    if (activeContext === context) activeContext = undefined;
  };
  return { page, cdp, finish };
}

async function takeScreenshot(page, name) {
  const safeName = name.replaceAll(/[^a-z0-9-]/gi, "-").toLowerCase();
  const path = `${outDir}/${String(++screenshotSequence).padStart(2, "0")}-${safeName}.png`;
  await page.screenshot({ path });
  report.screenshots.push(path);
  return path;
}

async function snapshot(page, locator) {
  const bounds = await locator.boundingBox();
  assert.ok(bounds, "gesture target has no bounds");
  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
  return page.evaluate(
    ({ x, y, selector }) => {
      const selected = selector ? document.querySelector(selector) : null;
      const visualViewport = window.visualViewport;
      const hitChain = document.elementsFromPoint(x, y).map((element) => {
        const style = getComputedStyle(element);
        return {
          tag: element.tagName,
          className:
            typeof element.className === "string" ? element.className : "",
          testId: element.getAttribute("data-testid"),
          touchAction: style.touchAction,
          pointerEvents: style.pointerEvents,
        };
      });
      const gameScreen = document.querySelector(".game-screen");
      const selectedStyle = selected ? getComputedStyle(selected) : null;
      return {
        layoutViewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
        },
        visualViewport: visualViewport
          ? {
              scale: visualViewport.scale,
              width: visualViewport.width,
              height: visualViewport.height,
              offsetLeft: visualViewport.offsetLeft,
              offsetTop: visualViewport.offsetTop,
              pageLeft: visualViewport.pageLeft,
              pageTop: visualViewport.pageTop,
            }
          : null,
        target: {
          selector,
          touchAction: selectedStyle?.touchAction ?? null,
          pointerEvents: selectedStyle?.pointerEvents ?? null,
        },
        gameScreenTouchAction: gameScreen
          ? getComputedStyle(gameScreen).touchAction
          : null,
        center: { x, y },
        hitChain,
      };
    },
    {
      ...center,
      selector: await locator.evaluate((element) => {
        if (element.id) return `#${CSS.escape(element.id)}`;
        if (element.getAttribute("data-testid"))
          return `[data-testid="${CSS.escape(element.getAttribute("data-testid"))}"]`;
        const className =
          typeof element.className === "string"
            ? element.className.trim().split(/\s+/).filter(Boolean)[0]
            : null;
        return className
          ? `.${CSS.escape(className)}`
          : element.tagName.toLowerCase();
      }),
    },
  );
}

async function gestureTrace(page) {
  return page.evaluate(() => window.__questGestureTrace ?? []);
}

async function clearGestureTrace(page) {
  await page.evaluate(() => {
    window.__questGestureTrace = [];
  });
}

function assertNeutralViewport(snapshotValue, label) {
  const { visualViewport, layoutViewport } = snapshotValue;
  assert.ok(visualViewport, `${label} has no visual viewport`);
  assert.ok(
    Math.abs(visualViewport.scale - 1) <= 0.01,
    `${label} changed visual viewport scale`,
  );
  assert.ok(
    Math.abs(visualViewport.width - viewport.width) <= 1 &&
      Math.abs(visualViewport.height - viewport.height) <= 1,
    `${label} cropped the visual viewport`,
  );
  for (const [field, value] of Object.entries({
    offsetLeft: visualViewport.offsetLeft,
    offsetTop: visualViewport.offsetTop,
    pageLeft: visualViewport.pageLeft,
    pageTop: visualViewport.pageTop,
    scrollX: layoutViewport.scrollX,
    scrollY: layoutViewport.scrollY,
  }))
    assert.ok(Math.abs(value) <= 0.5, `${label} changed ${field}`);
}

async function pinch({ page, cdp, locator, label, expectedSurface }) {
  await clearGestureTrace(page);
  const before = await snapshot(page, locator);
  const { x, y } = before.center;
  const firstId = 11;
  const secondId = 12;
  const dispatches = [];
  const send = async (type, touchPoints) => {
    dispatches.push({
      type,
      touchPoints: touchPoints.map(({ id, x: pointX, y: pointY }) => ({
        id,
        x: pointX,
        y: pointY,
      })),
    });
    await cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
  };
  await send("touchStart", [
    point(firstId, x - 18, y),
    point(secondId, x + 18, y),
  ]);
  for (const distance of [28, 40, 52, 64, 76, 88, 94]) {
    await send("touchMove", [
      point(firstId, x - distance, y),
      point(secondId, x + distance, y),
    ]);
    await delay(18);
  }
  await send("touchEnd", []);
  await delay(550);
  const after = await snapshot(page, locator);
  const trace = await gestureTrace(page);
  const pinchStart = trace.find(
    (event) =>
      event.type === "touchstart" &&
      event.isTrusted &&
      event.touches.length === 2,
  );
  assert.ok(pinchStart, `${label} did not start with two trusted contacts`);
  assert.equal(
    pinchStart.surface,
    expectedSurface,
    `${label} started on the wrong surface`,
  );
  const pinchMove = trace.find(
    (event) =>
      event.type === "touchmove" &&
      event.isTrusted &&
      event.touches.length === 2,
  );
  assert.ok(pinchMove, `${label} did not move two trusted contacts`);
  assert.equal(
    pinchMove.surface,
    expectedSurface,
    `${label} moved on the wrong surface`,
  );
  return { before, after, dispatches, trace };
}

async function doubleTap({ page, cdp, locator, label, expectedSurface }) {
  await clearGestureTrace(page);
  const before = await snapshot(page, locator);
  const { x, y } = before.center;
  const dispatches = [];
  for (let index = 0; index < 2; index += 1) {
    const contact = point(21 + index, x, y);
    dispatches.push({ type: "touchStart", touchPoints: [contact] });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [contact],
    });
    await delay(32);
    dispatches.push({ type: "touchEnd", touchPoints: [] });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await delay(index === 0 ? 82 : 0);
  }
  await delay(700);
  const trace = await gestureTrace(page);
  const trustedStarts = trace.filter(
    (event) =>
      event.type === "touchstart" &&
      event.isTrusted &&
      event.touches.length === 1 &&
      event.surface === expectedSurface,
  );
  const trustedEnds = trace.filter(
    (event) => event.type === "touchend" && event.isTrusted,
  );
  assert.equal(
    trustedStarts.length,
    2,
    `${label} did not deliver two trusted starts on ${expectedSurface}`,
  );
  assert.equal(
    trustedEnds.length,
    2,
    `${label} did not deliver two trusted ends`,
  );
  return {
    before,
    after: await snapshot(page, locator),
    dispatches,
    trace,
  };
}

async function runPinchScenario({
  name,
  startGame,
  locatorFor,
  expectedSurface,
  assertion,
}) {
  mark(name);
  const scenario = await createScenario(name, { startGame });
  try {
    const locator = locatorFor(scenario.page);
    await locator.waitFor({ timeout: 10_000 });
    const result = await pinch({
      ...scenario,
      locator,
      label: name,
      expectedSurface,
    });
    result.screenshot = await takeScreenshot(scenario.page, name);
    assertion(result);
    report.scenarios[name] = result;
  } finally {
    await scenario.finish();
  }
}

async function runGameBoundaryScenario() {
  const name = "game-surface-boundaries";
  mark(name);
  const scenario = await createScenario(name, { startGame: true });
  try {
    const surfaces = [
      ["canvas", scenario.page.locator("canvas[data-quest-canvas=true]")],
      ["hud", scenario.page.locator(".era-hud")],
      [
        "attack-control",
        scenario.page.getByRole("button", { name: "Attack", exact: true }),
      ],
    ];
    const results = {};
    for (const [surface, locator] of surfaces) {
      await locator.waitFor({ timeout: 10_000 });
      await scenario.page.evaluate(() => {
        window.__questGestureTrace = [];
      });
      const result = await pinch({
        ...scenario,
        locator,
        label: `${name}-${surface}`,
        expectedSurface: surface === "hud" ? "canvas" : surface,
      });
      assertNeutralViewport(result.after, `${surface} pinch`);
      results[surface] = result;
    }
    results.visibleBounds = await scenario.page.evaluate(() => {
      const selectors = {
        header: { selector: ".game-header", required: true },
        joystick: {
          selector: '[data-testid="joystick"]',
          required: true,
        },
        actions: { selector: ".combat-actions", required: true },
        jump: { selector: ".combat-jump", required: true },
        attack: { selector: ".combat-attack", required: true },
        bash: { selector: ".combat-guard", required: false },
      };
      const visualViewport = window.visualViewport;
      if (!visualViewport) throw new Error("visual viewport unavailable");
      return Object.fromEntries(
        Object.entries(selectors).map(([label, { selector, required }]) => {
          const element = document.querySelector(selector);
          if (!element) {
            if (required) throw new Error(`${label} is unavailable`);
            return [label, { rendered: false }];
          }
          const bounds = element.getBoundingClientRect();
          return [
            label,
            {
              rendered: true,
              x: bounds.x,
              y: bounds.y,
              width: bounds.width,
              height: bounds.height,
              right: bounds.right,
              bottom: bounds.bottom,
              visualLeft: visualViewport.offsetLeft,
              visualTop: visualViewport.offsetTop,
              visualRight: visualViewport.offsetLeft + visualViewport.width,
              visualBottom: visualViewport.offsetTop + visualViewport.height,
            },
          ];
        }),
      );
    });
    for (const [label, bounds] of Object.entries(results.visibleBounds)) {
      if (!bounds.rendered) continue;
      assert.ok(
        bounds.x >= bounds.visualLeft - 0.5 &&
          bounds.y >= bounds.visualTop - 0.5 &&
          bounds.right <= bounds.visualRight + 0.5 &&
          bounds.bottom <= bounds.visualBottom + 0.5,
        `${label} is cropped outside the visual viewport`,
      );
    }
    results.screenshot = await takeScreenshot(scenario.page, name);
    report.scenarios[name] = results;
  } finally {
    await scenario.finish();
  }
}

async function runStartDoubleTapScenario() {
  const name = "start-page-double-tap";
  mark(name);
  const scenario = await createScenario(name);
  try {
    const locator = scenario.page.locator(".playtest-start h1");
    const result = await doubleTap({
      ...scenario,
      locator,
      label: name,
      expectedSurface: "start-heading",
    });
    if (expectAppZoomLock)
      assertNeutralViewport(result.after, "start-page double tap");
    result.screenshot = await takeScreenshot(scenario.page, name);
    report.scenarios[name] = result;
  } finally {
    await scenario.finish();
  }
}

async function runGameDoubleTapScenario() {
  const name = "game-header-double-tap";
  mark(name);
  const scenario = await createScenario(name, { startGame: true });
  try {
    const locator = scenario.page.locator(".chapter-pill");
    const result = await doubleTap({
      ...scenario,
      locator,
      label: name,
      expectedSurface: "chapter-pill",
    });
    if (!expectHeaderPinchZoom)
      assertNeutralViewport(result.after, "header double tap");
    result.screenshot = await takeScreenshot(scenario.page, name);
    report.scenarios[name] = result;
  } finally {
    await scenario.finish();
  }
}

async function runStartPageScrollScenario() {
  const name = "start-page-scroll";
  mark(name);
  const scenario = await createScenario(name);
  try {
    const start = scenario.page.locator(".playtest-start");
    await start.waitFor({ timeout: 10_000 });
    const before = await start.evaluate((element) => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      scrollY: window.scrollY,
      htmlTouchAction: getComputedStyle(document.documentElement).touchAction,
      bodyTouchAction: getComputedStyle(document.body).touchAction,
      rootTouchAction: getComputedStyle(document.querySelector("#root"))
        .touchAction,
      targetTouchAction: getComputedStyle(element).touchAction,
    }));
    assert.ok(
      before.scrollHeight > before.clientHeight,
      "start page did not have overflow content",
    );
    const bounds = await start.boundingBox();
    assert.ok(bounds, "start page has no bounds");
    const x = Math.min(
      viewport.width - 24,
      Math.max(24, bounds.x + bounds.width * 0.75),
    );
    const startY = viewport.height - 32;
    const endY = 48;
    const dispatches = [];
    const contactId = 41;
    const send = async (type, touchPoints) => {
      dispatches.push({
        type,
        touchPoints: touchPoints.map(({ id, x: pointX, y: pointY }) => ({
          id,
          x: pointX,
          y: pointY,
        })),
      });
      await scenario.cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints,
      });
    };
    await clearGestureTrace(scenario.page);
    await send("touchStart", [point(contactId, x, startY)]);
    for (let step = 1; step <= 10; step += 1) {
      const y = startY + ((endY - startY) * step) / 10;
      await send("touchMove", [point(contactId, x, y)]);
      await delay(22);
    }
    await send("touchEnd", []);
    await delay(450);
    const after = await scenario.page.evaluate(() => {
      const visualViewport = window.visualViewport;
      return {
        scrollY: window.scrollY,
        scrollX: window.scrollX,
        visualViewport: visualViewport
          ? {
              scale: visualViewport.scale,
              width: visualViewport.width,
              height: visualViewport.height,
              offsetLeft: visualViewport.offsetLeft,
              offsetTop: visualViewport.offsetTop,
              pageLeft: visualViewport.pageLeft,
              pageTop: visualViewport.pageTop,
            }
          : null,
      };
    });
    assert.ok(
      after.scrollY > 40,
      "trusted vertical swipe did not scroll start page",
    );
    assert.equal(
      after.scrollX,
      0,
      "start-page vertical swipe scrolled horizontally",
    );
    assert.ok(after.visualViewport, "start-page scroll has no visual viewport");
    assert.ok(
      Math.abs(after.visualViewport.scale - 1) <= 0.01 &&
        Math.abs(after.visualViewport.width - viewport.width) <= 1 &&
        Math.abs(after.visualViewport.height - viewport.height) <= 1,
      "start-page scroll changed visual viewport scale or size",
    );
    assert.ok(
      Math.abs(after.visualViewport.offsetLeft) <= 0.5 &&
        Math.abs(after.visualViewport.offsetTop) <= 0.5 &&
        Math.abs(after.visualViewport.pageLeft) <= 0.5 &&
        Math.abs(after.visualViewport.pageTop - after.scrollY) <= 1,
      "start-page scroll shifted the visual viewport independently",
    );
    const trace = await gestureTrace(scenario.page);
    const swipeStart = trace.find(
      (event) =>
        event.type === "touchstart" &&
        event.isTrusted &&
        event.touches.length === 1,
    );
    assert.ok(swipeStart, "start-page scroll did not begin with trusted touch");
    assert.equal(
      swipeStart.surface,
      "start-page",
      "start-page swipe began on the wrong surface",
    );
    assert.ok(
      trace.some((event) => event.type === "pointercancel" && event.isTrusted),
      "start-page scroll did not transfer to native panning",
    );
    report.scenarios[name] = {
      before,
      after,
      dispatches,
      trace,
      screenshot: await takeScreenshot(scenario.page, name),
    };
  } finally {
    await scenario.finish();
  }
}

async function runGuardedDesktopGestureScenario() {
  const name = "guarded-desktop-zoom-gestures";
  mark(name);
  const scenario = await createScenario(name);
  try {
    const heading = scenario.page.locator(".playtest-start h1");
    await heading.waitFor({ timeout: 10_000 });
    await scenario.page.evaluate(() => {
      window.__questZoomGuardTrace = [];
      for (const type of ["wheel", "keydown"])
        window.addEventListener(type, (event) => {
          window.__questZoomGuardTrace.push({
            type,
            isTrusted: event.isTrusted,
            defaultPrevented: event.defaultPrevented,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            key: "key" in event ? event.key : null,
          });
        });
    });
    const before = await snapshot(scenario.page, heading);
    const bounds = await heading.boundingBox();
    assert.ok(bounds, "start heading has no bounds");
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;
    await scenario.cdp.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x,
      y,
    });
    await scenario.cdp.send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x,
      y,
      deltaX: 0,
      deltaY: -180,
      modifiers: 2,
    });
    await scenario.page.keyboard.down("Control");
    await scenario.page.keyboard.press("=");
    await scenario.page.keyboard.press("-");
    await scenario.page.keyboard.up("Control");
    await scenario.page.keyboard.down("Meta");
    await scenario.page.keyboard.press("=");
    await scenario.page.keyboard.press("-");
    await scenario.page.keyboard.up("Meta");
    await delay(300);
    const trace = await scenario.page.evaluate(
      () => window.__questZoomGuardTrace ?? [],
    );
    const wheel = trace.find(
      (event) => event.type === "wheel" && event.isTrusted && event.ctrlKey,
    );
    assert.ok(wheel, "control-wheel was not delivered as trusted input");
    assert.equal(
      wheel.defaultPrevented,
      true,
      "control-wheel was not cancelled",
    );
    for (const modifier of ["ctrlKey", "metaKey"])
      for (const key of ["=", "-"])
        assert.ok(
          trace.some(
            (event) =>
              event.type === "keydown" &&
              event.isTrusted &&
              event[modifier] &&
              event.key === key &&
              event.defaultPrevented,
          ),
          `${modifier} ${key} was not cancelled`,
        );
    const after = await snapshot(scenario.page, heading);
    assertNeutralViewport(after, "guarded desktop zoom gestures");
    report.scenarios[name] = {
      before,
      after,
      trace,
      screenshot: await takeScreenshot(scenario.page, name),
    };
  } finally {
    await scenario.finish();
  }
}

async function runEntryLeaveViewportScenario() {
  const name = "entry-leave-viewport";
  mark(name);
  const scenario = await createScenario(name);
  try {
    const heading = scenario.page.locator(".playtest-start h1");
    await heading.waitFor({ timeout: 10_000 });
    const beforeEntry = await snapshot(scenario.page, heading);
    assertNeutralViewport(beforeEntry, "before game entry");
    await scenario.page
      .getByRole("button", { name: "Play from the beginning", exact: true })
      .tap();
    const canvas = scenario.page.locator("canvas[data-quest-canvas=true]");
    await canvas.waitFor({ timeout: 20_000 });
    const inGame = await snapshot(scenario.page, canvas);
    assertNeutralViewport(inGame, "after game entry");
    await scenario.page
      .getByRole("button", { name: /Leave playtest|Save & leave/ })
      .tap();
    await heading.waitFor({ timeout: 10_000 });
    const afterLeave = await snapshot(scenario.page, heading);
    assertNeutralViewport(afterLeave, "after leaving game");
    report.scenarios[name] = {
      beforeEntry,
      inGame,
      afterLeave,
      screenshot: await takeScreenshot(scenario.page, name),
    };
  } finally {
    await scenario.finish();
  }
}

async function runHelpScrollScenario() {
  const name = "help-dialog-scroll";
  mark(name);
  const scenario = await createScenario(name, { startGame: true });
  try {
    await scenario.page
      .getByRole("button", { name: "How to play", exact: true })
      .tap();
    const dialog = scenario.page.getByRole("dialog", {
      name: "Explore. Prepare. Face the era.",
    });
    await dialog.waitFor({ timeout: 10_000 });
    const before = await dialog.evaluate((element) => ({
      scrollTop: element.scrollTop,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      touchAction: getComputedStyle(element).touchAction,
    }));
    assert.ok(
      before.scrollHeight > before.clientHeight,
      "Help dialog did not have overflow content",
    );
    assert.equal(before.touchAction, "pan-y", "Help dialog lost vertical pan");
    const pinchResult = await pinch({
      ...scenario,
      locator: dialog,
      label: "Help dialog pinch",
      expectedSurface: "help-dialog",
    });
    assertNeutralViewport(pinchResult.after, "Help dialog pinch");
    const bounds = await dialog.boundingBox();
    assert.ok(bounds, "Help dialog has no bounds");
    const x = bounds.x + bounds.width / 2;
    const startY = Math.min(
      bounds.y + bounds.height - 44,
      viewport.height - 24,
    );
    const endY = Math.max(bounds.y + 44, startY - 230);
    const dispatches = [];
    const contactId = 31;
    const send = async (type, touchPoints) => {
      dispatches.push({
        type,
        touchPoints: touchPoints.map(({ id, x: pointX, y: pointY }) => ({
          id,
          x: pointX,
          y: pointY,
        })),
      });
      await scenario.cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints,
      });
    };
    await clearGestureTrace(scenario.page);
    await send("touchStart", [point(contactId, x, startY)]);
    for (let step = 1; step <= 8; step += 1) {
      const y = startY + ((endY - startY) * step) / 8;
      await send("touchMove", [point(contactId, x, y)]);
      await delay(22);
    }
    await send("touchEnd", []);
    await delay(450);
    const after = await dialog.evaluate((element) => ({
      scrollTop: element.scrollTop,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      touchAction: getComputedStyle(element).touchAction,
    }));
    assert.ok(
      after.scrollTop > 40,
      "trusted vertical swipe did not scroll Help",
    );
    const trace = await gestureTrace(scenario.page);
    const swipeStart = trace.find(
      (event) =>
        event.type === "touchstart" &&
        event.isTrusted &&
        event.touches.length === 1,
    );
    assert.ok(swipeStart, "Help scroll did not start with a trusted touch");
    assert.equal(
      swipeStart.surface,
      "help-dialog",
      "Help swipe started outside the dialog",
    );
    assert.ok(
      trace.some((event) => event.type === "pointercancel" && event.isTrusted),
      "Help scroll did not transfer to native panning",
    );
    const finalViewport = await snapshot(scenario.page, dialog);
    assertNeutralViewport(finalViewport, "Help scroll");
    report.scenarios[name] = {
      before,
      after,
      pinch: pinchResult,
      finalViewport,
      dispatches,
      trace,
      screenshot: await takeScreenshot(scenario.page, name),
    };
  } finally {
    await scenario.finish();
  }
}

try {
  const indexResponse = await fetch(url);
  assert.equal(indexResponse.status, 200, "regression target unavailable");
  const indexHtml = await indexResponse.text();
  const [bundle, css] = await Promise.all([
    fingerprintAsset(
      indexHtml,
      /src="([^"]+\.js)"/,
      expectedBundleSha256,
      "JavaScript",
    ),
    fingerprintAsset(
      indexHtml,
      /href="([^"]+\.css)"/,
      expectedCssSha256,
      "CSS",
    ),
  ]);
  report.assets = { bundle, css };
  report.viewportPolicy = indexHtml.match(
    /<meta\s+name="viewport"\s+content="([^"]+)"/,
  )?.[1];
  assert.match(report.viewportPolicy ?? "", /width=device-width/);
  if (expectAppZoomLock) {
    assert.match(report.viewportPolicy ?? "", /user-scalable=no/);
    assert.match(report.viewportPolicy ?? "", /minimum-scale=1(?:\.0)?/);
    assert.match(report.viewportPolicy ?? "", /maximum-scale=1(?:\.0)?/);
  } else {
    assert.doesNotMatch(report.viewportPolicy ?? "", /user-scalable=no/);
    assert.doesNotMatch(report.viewportPolicy ?? "", /minimum-scale=1(?:\.0)?/);
    assert.doesNotMatch(report.viewportPolicy ?? "", /maximum-scale=1(?:\.0)?/);
  }

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

  await runPinchScenario({
    name: "start-page-pinch",
    startGame: false,
    locatorFor: (page) => page.locator(".playtest-start h1"),
    expectedSurface: "start-heading",
    assertion: (result) => {
      if (expectAppZoomLock)
        assertNeutralViewport(result.after, "start-page pinch");
      else
        assert.ok(
          result.after.visualViewport.scale > 1.05,
          "baseline start-page pinch did not reproduce page zoom",
        );
    },
  });
  await runPinchScenario({
    name: "game-header-pinch",
    startGame: true,
    locatorFor: (page) => page.locator(".chapter-pill"),
    expectedSurface: "chapter-pill",
    assertion: (result) => {
      assert.equal(
        result.before.gameScreenTouchAction,
        expectedGameTouchAction,
        "game screen touch policy differs from the expected build",
      );
      if (expectHeaderPinchZoom)
        assert.ok(
          result.after.visualViewport.scale > 1.05,
          "baseline header pinch did not reproduce page zoom",
        );
      else assertNeutralViewport(result.after, "game header pinch");
    },
  });
  await runGameBoundaryScenario();
  await runStartDoubleTapScenario();
  await runGameDoubleTapScenario();
  await runStartPageScrollScenario();
  if (expectAppZoomLock) await runGuardedDesktopGestureScenario();
  await runEntryLeaveViewportScenario();
  await runHelpScrollScenario();

  assert.equal(report.responseErrors.length, 0, "HTTP failures observed");
  assert.equal(report.pageErrors.length, 0, "page errors observed");
  assert.equal(report.consoleErrors.length, 0, "console errors observed");
  assert.equal(
    report.networkWrites.some((request) =>
      /\/(actions?|saves?)(\/|$)/.test(request.path),
    ),
    false,
    "regression harness mutated gameplay through an action/save endpoint",
  );
  report.status = "passed";
  report.finishedAt = new Date().toISOString();
  mark("passed", { reportPath });
} catch (error) {
  report.status = "failed";
  report.finishedAt = new Date().toISOString();
  report.error = error instanceof Error ? error.stack : String(error);
  mark("failed", { error: report.error });
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
  for (const context of contexts) await context.close().catch(() => undefined);
  await browser?.close().catch(() => undefined);
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}
