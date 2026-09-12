import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { chromium } from "playwright";

import { createJourneyDriver } from "./journey-lib.mjs";

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const url = process.env.QUEST_E2E_URL ?? "http://127.0.0.1:4397";
const runLabel = process.env.QUEST_E2E_RUN_LABEL;
const outDir = runLabel
  ? `test-results/fresh-playtest/${runLabel}`
  : "test-results/fresh-playtest";
const reportPath = `${outDir}/report.json`;
const timeoutMs = Number(process.env.QUEST_E2E_TIMEOUT_MS ?? 600_000);
const expectedBundleSha256 = process.env.QUEST_E2E_BUNDLE_SHA256;
const routeOnly = process.env.QUEST_E2E_ROUTE_ONLY === "true";
const routeStartChapter = Number(process.env.QUEST_E2E_START_CHAPTER ?? 1);
const stopAfterRunway = process.env.QUEST_E2E_STOP_AFTER_RUNWAY === "true";
const inputOnly = process.env.QUEST_E2E_INPUT_ONLY === "true";
const hybridRoute = process.env.QUEST_E2E_HYBRID_ROUTE === "true";
const skipBossHud = process.env.QUEST_E2E_SKIP_BOSS_HUD === "true";
const landscapeOnly = process.env.QUEST_E2E_LANDSCAPE_ONLY === "true";
const smokeOnly = process.env.QUEST_E2E_SMOKE_ONLY === "true";
assert.ok(Number.isFinite(timeoutMs) && timeoutMs >= 120_000);
assert.ok(
  routeStartChapter === 1 || routeStartChapter === 2,
  "QUEST_E2E_START_CHAPTER must be 1 or 2",
);
await fs.mkdir(outDir, { recursive: true });

class RunwayVerified extends Error {}
class InputDiagnosticComplete extends Error {}
class LandscapeVerified extends Error {}
class SmokeVerified extends Error {}

function installAudioAnalyser() {
  const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
  const entries = [];
  const snapshot = () => ({
    available: Boolean(NativeAudioContext),
    contexts: entries.map((entry) => ({
      state: entry.context.state,
      sampleCount: entry.sampleCount,
      nonzeroSampleCount: entry.nonzeroSampleCount,
      maxAbs: entry.maxAbs,
      analyserConnected: entry.analyserConnected,
    })),
  });
  window.__questOutputProbe = {
    snapshot,
    reset() {
      for (const entry of entries) {
        entry.sampleCount = 0;
        entry.nonzeroSampleCount = 0;
        entry.maxAbs = 0;
      }
    },
  };
  if (!NativeAudioContext) return;

  const InstrumentedAudioContext = new Proxy(NativeAudioContext, {
    construct(target, args) {
      const context = Reflect.construct(target, args);
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      const samples = new Float32Array(analyser.fftSize);
      const entry = {
        context,
        analyser,
        sampleCount: 0,
        nonzeroSampleCount: 0,
        maxAbs: 0,
        analyserConnected: false,
      };
      entries.push(entry);

      const createDynamicsCompressor =
        context.createDynamicsCompressor.bind(context);
      context.createDynamicsCompressor = () => {
        const compressor = createDynamicsCompressor();
        const connect = compressor.connect.bind(compressor);
        compressor.connect = (destination, ...connectArgs) => {
          if (destination === context.destination) {
            const result = connect(analyser);
            if (!entry.analyserConnected) {
              analyser.connect(context.destination);
              entry.analyserConnected = true;
            }
            return result;
          }
          return connect(destination, ...connectArgs);
        };
        return compressor;
      };

      const timer = setInterval(() => {
        if (context.state !== "running") return;
        analyser.getFloatTimeDomainData(samples);
        let peak = 0;
        for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
        entry.sampleCount += samples.length;
        if (peak > 0.00001) entry.nonzeroSampleCount += 1;
        entry.maxAbs = Math.max(entry.maxAbs, peak);
      }, 12);
      timer.unref?.();
      context.addEventListener("statechange", () => {
        if (context.state === "closed") clearInterval(timer);
      });
      return context;
    },
  });
  Object.defineProperty(window, "AudioContext", {
    configurable: true,
    writable: true,
    value: InstrumentedAudioContext,
  });
  if (window.webkitAudioContext) {
    Object.defineProperty(window, "webkitAudioContext", {
      configurable: true,
      writable: true,
      value: InstrumentedAudioContext,
    });
  }
}

function installFrameProbe() {
  const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
  let prior = null;
  let deltas = [];
  const sample = (timestamp) => {
    if (prior !== null) {
      deltas.push(timestamp - prior);
      if (deltas.length > 600) deltas.shift();
    }
    prior = timestamp;
    nativeRequestAnimationFrame(sample);
  };
  window.__questFrameProbe = {
    reset() {
      prior = null;
      deltas = [];
    },
    snapshot() {
      const sorted = [...deltas].sort((left, right) => left - right);
      const durationMs = deltas.reduce((sum, value) => sum + value, 0);
      const averageMs = deltas.length ? durationMs / deltas.length : null;
      return {
        samples: deltas.length,
        durationMs,
        averageMs,
        averageFps: averageMs ? 1_000 / averageMs : null,
        p50Ms: sorted.length
          ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.5))]
          : null,
        p95Ms: sorted.length
          ? sorted[
              Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))
            ]
          : null,
        maxMs: sorted.at(-1) ?? null,
      };
    },
  };
  nativeRequestAnimationFrame(sample);
}

const report = {
  startedAt: new Date().toISOString(),
  status: "running",
  url,
  browser: null,
  bundle: null,
  injectedArtworkFailure: null,
  audio: {},
  gestures: {},
  resets: {},
  chapters: [],
  bestiesShortcut: null,
  performance: [],
  performanceContext: "Headless Chromium with SwiftShader software rendering",
  recoveries: { combatRetries: 0, localObby: [] },
  routeOnly,
  routeTraversal: hybridRoute
    ? "keyboard movement and jumps; touch UI actions"
    : "touch joystick, world taps, and touch UI actions",
  skippedChecks: skipBossHud ? ["boss-hud-world-tap"] : [],
  layout: null,
  progress: [],
  screenshots: [],
  responseErrors: [],
  pageErrors: [],
  consoleErrors: [],
  webkit: {
    cachedRevision: "webkit-2359",
    runnable: false,
    reason:
      "Cached browser is present, but GTK and WPE launch diagnostics both lack libgstreamer-1.0.so.0.",
  },
};

const mark = (stage, details = {}) => {
  const entry = { stage, at: new Date().toISOString(), ...details };
  report.progress.push(entry);
  console.log(`[fresh-playtest] ${stage} ${JSON.stringify(details)}`);
};

const indexResponse = await fetch(url);
assert.equal(indexResponse.status, 200, "fresh playtest index failed");
assert.match(indexResponse.headers.get("cache-control") ?? "", /no-store/);
const indexHtml = await indexResponse.text();
const bundlePath = indexHtml.match(/src="([^"]+\.js)"/)?.[1];
assert.ok(bundlePath, "client bundle path missing");
const bundleResponse = await fetch(new URL(bundlePath, url));
assert.equal(bundleResponse.status, 200, "client bundle failed");
assert.match(
  bundleResponse.headers.get("cache-control") ?? "",
  /max-age=31536000.*immutable/,
);
const bundleBytes = Buffer.from(await bundleResponse.arrayBuffer());
const bundleSha256 = createHash("sha256").update(bundleBytes).digest("hex");
if (expectedBundleSha256)
  assert.equal(bundleSha256, expectedBundleSha256, "unexpected client bundle");
report.bundle = {
  path: bundlePath,
  bytes: bundleBytes.byteLength,
  sha256: bundleSha256,
};

const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
    "--autoplay-policy=user-gesture-required",
  ],
});
report.browser = browser.version();
let cleanupStarted = false;
let forcedExitCode = null;
let forcedReason = null;
const closeBrowser = async () => {
  if (cleanupStarted) return;
  cleanupStarted = true;
  await browser.close().catch(() => undefined);
};
const forceCleanup = (reason, exitCode) => {
  if (cleanupStarted) return;
  forcedExitCode = exitCode;
  forcedReason = reason;
  console.error(`[fresh-playtest] ${reason}`);
  void closeBrowser();
};
const overallTimer = setTimeout(
  () => forceCleanup(`timeout ${timeoutMs}ms exceeded`, 124),
  timeoutMs,
);
const onInterrupt = () => forceCleanup("interrupted", 130);
const onTerminate = () => forceCleanup("terminated", 143);
process.once("SIGINT", onInterrupt);
process.once("SIGTERM", onTerminate);

const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
await context.addInitScript(installAudioAnalyser);
await context.addInitScript(installFrameProbe);
await context.addInitScript(() => {
  window.__questPointerTrace = [];
  for (const type of ["pointerdown", "pointerup", "pointercancel"]) {
    document.addEventListener(
      type,
      (event) => {
        window.__questPointerTrace.push({
          type,
          id: event.pointerId,
          pointerType: event.pointerType,
          target: event.target.tagName,
          x: event.clientX,
          y: event.clientY,
          timeStamp: event.timeStamp,
          handledAt: performance.now(),
        });
        if (window.__questPointerTrace.length > 64)
          window.__questPointerTrace.shift();
      },
      true,
    );
  }
});

let failArtwork = true;
let failedArtworkRequests = 0;
await context.route("**/bestie-pink/v001/bestie-pink.glb", async (route) => {
  if (failArtwork) {
    failArtwork = false;
    failedArtworkRequests += 1;
    await route.fulfill({
      status: 503,
      contentType: "text/plain",
      body: "injected playtest artwork failure",
    });
    return;
  }
  await route.continue();
});

const errors = report.pageErrors;
const driver = createJourneyDriver({ url, errors });
const page = await context.newPage();
let latestSave = null;
const observedSaves = [];
const observedHits = [];
page.on("pageerror", (error) => report.pageErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") report.consoleErrors.push(message.text());
});
page.on("response", async (response) => {
  const parsed = new URL(response.url());
  const isInjectedArtworkFailure =
    response.status() === 503 &&
    parsed.pathname.endsWith("/bestie-pink/v001/bestie-pink.glb");
  if (response.status() >= 400 && !isInjectedArtworkFailure) {
    report.responseErrors.push({
      method: response.request().method(),
      path: parsed.pathname,
      status: response.status(),
    });
  }
  if (
    response.ok() &&
    response.request().method() === "POST" &&
    (parsed.pathname === "/api/playtest/start" ||
      /\/api\/saves\/[^/]+\/actions$/.test(parsed.pathname))
  ) {
    const body = await response.json().catch(() => null);
    if (body?.id && Number.isInteger(body.revision)) {
      const action = response.request().postDataJSON()?.action;
      if (action?.type === "take-hit") {
        observedHits.push({
          encounterId: action.encounterId,
          revision: body.revision,
          beforeHp: latestSave?.adventure?.playerHp,
          afterHp: body.adventure?.playerHp,
        });
      }
      latestSave = body;
      observedSaves.push({
        id: body.id,
        revision: body.revision,
        ageYears: body.ageYears,
        phase: body.adventure?.phase,
        activeLevelIndex: body.adventure?.activeLevelIndex,
      });
    }
  }
});

const screenshot = async (name) => {
  const path = `${outDir}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  report.screenshots.push(path);
};
const waitForSave = async (predicate, label, timeout = 15_000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (latestSave && predicate(latestSave)) return latestSave;
    await delay(50);
  }
  await screenshot(`${label}-failure`);
  throw new Error(
    `${label} save state unavailable: ${JSON.stringify(latestSave)}`,
  );
};
const inspectGame = () => driver.inspectGame(page);
const waitForInspection = async (predicate, label, timeout = 12_000) => {
  const deadline = Date.now() + timeout;
  let latest = null;
  while (Date.now() < deadline) {
    latest = await inspectGame();
    if (latest && predicate(latest)) return latest;
    await delay(35);
  }
  await screenshot(`${label}-failure`);
  throw new Error(`${label} inspection unavailable: ${JSON.stringify(latest)}`);
};
const resetAudioProbe = () =>
  page.evaluate(() => window.__questOutputProbe?.reset());
const audioSnapshot = () =>
  page.evaluate(() => window.__questOutputProbe?.snapshot());
const sampleActiveFrames = async (label) => {
  await waitForInspection(
    (inspection) =>
      inspection.status.phase === "exploring" &&
      inspection.status.mediaLoading === 0,
    `${label}-frame-readiness`,
    20_000,
  );
  await page.evaluate(() => window.__questFrameProbe?.reset());
  await delay(3_000);
  const frames = await page.evaluate(() =>
    window.__questFrameProbe?.snapshot(),
  );
  report.performance.push({ label, ...(frames ?? { samples: 0 }) });
  mark(`frames:${label}`, frames);
  assert.ok(frames, `${label}: frame probe did not initialize`);
  return frames;
};

function assertFreshHome() {
  return Promise.all([
    page.getByRole("button", { name: "Play from the beginning" }).waitFor(),
    page
      .getByText(
        "Every test starts fresh. Progress resets when you leave or reload.",
      )
      .waitFor(),
    page
      .getByText("Your journeys", { exact: true })
      .count()
      .then((count) => assert.equal(count, 0)),
    page
      .locator(".save-card")
      .count()
      .then((count) => assert.equal(count, 0)),
  ]);
}

const startPlaytest = async (chapter) => {
  const priorId = latestSave?.id;
  const button =
    chapter === 1
      ? page.getByRole("button", { name: "Play from the beginning" })
      : page.getByRole("button", { name: "Try the Besties chapter" });
  await button.tap();
  await page
    .locator("canvas[data-quest-canvas=true]")
    .waitFor({ timeout: 20_000 });
  cachedWorldTapPoint = null;
  cachedStickGeometry = null;
  await Promise.all([worldPoint(), stickGeometry()]);
  const save = await waitForSave(
    (candidate) =>
      candidate.id !== priorId &&
      candidate.adventure?.activeLevelIndex === chapter - 1,
    `start-chapter-${chapter}`,
    20_000,
  );
  assert.equal(save.adventure.planVersion, "era-level-plan-v3");
  assert.equal(save.memories.length, 6);
  return save;
};

const cdp = await context.newCDPSession(page);
let nextPointerId = 1;
let cachedWorldTapPoint = null;
let cachedStickGeometry = null;
const point = (id, x, y) => ({
  id,
  x,
  y,
  radiusX: 5,
  radiusY: 5,
  force: 1,
});
const sendTouch = (type, touchPoints) =>
  cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
const controlCenter = async (locator) => {
  const bounds = await locator.boundingBox();
  assert.ok(bounds, "touch control has no bounds");
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
};
const worldPoint = async () => {
  if (cachedWorldTapPoint) return cachedWorldTapPoint;
  const candidate = await page.evaluate(() => {
    const canvas = document.querySelector("canvas[data-quest-canvas=true]");
    if (!canvas) return null;
    const bounds = canvas.getBoundingClientRect();
    for (const [xRatio, yRatio] of [
      [0.7, 0.55],
      [0.52, 0.5],
      [0.82, 0.42],
      [0.45, 0.62],
    ]) {
      const x = bounds.left + bounds.width * xRatio;
      const y = bounds.top + bounds.height * yRatio;
      if (document.elementFromPoint(x, y) === canvas) return { x, y };
    }
    return null;
  });
  assert.ok(candidate, "no unobstructed world-tap point found");
  cachedWorldTapPoint = candidate;
  return cachedWorldTapPoint;
};
const stickGeometry = async () => {
  if (cachedStickGeometry) return cachedStickGeometry;
  const center = await controlCenter(page.getByTestId("joystick"));
  cachedStickGeometry = {
    center,
    held: {
      left: { x: center.x - 44, y: center.y },
      right: { x: center.x + 44, y: center.y },
      forward: { x: center.x, y: center.y - 44 },
      backward: { x: center.x, y: center.y + 44 },
    },
  };
  return cachedStickGeometry;
};
const standaloneWorldTap = async () => {
  const world = await worldPoint();
  const id = nextPointerId++;
  await sendTouch("touchStart", [point(id, world.x, world.y)]);
  await delay(70);
  await sendTouch("touchEnd", []);
};
const cancelWorldTouch = async () => {
  const world = await worldPoint();
  const id = nextPointerId++;
  await sendTouch("touchStart", [point(id, world.x, world.y)]);
  await delay(70);
  await sendTouch("touchCancel", []);
};
const cancelWorldTouchWhileHeld = async (held) => {
  const world = await worldPoint();
  const contact = point(nextPointerId++, world.x, world.y);
  await sendTouch("touchStart", [held, contact]);
  await delay(10);
  await sendTouch("touchCancel", []);
};
const beginStick = async (direction, scale = 1) => {
  const geometry = await stickGeometry();
  const id = nextPointerId++;
  const origin = point(id, geometry.center.x, geometry.center.y);
  const directionTarget = geometry.held[direction];
  const target = point(
    id,
    geometry.center.x + (directionTarget.x - geometry.center.x) * scale,
    geometry.center.y + (directionTarget.y - geometry.center.y) * scale,
  );
  await sendTouch("touchStart", [origin]);
  await sendTouch("touchMove", [target]);
  return target;
};
const endTouches = () => sendTouch("touchEnd", []);
const tapPointWhileHeld = async (held, center) => {
  const contact = point(nextPointerId++, center.x, center.y);
  const startedAt = Date.now();
  const down = sendTouch("touchStart", [held, contact]);
  await delay(10);
  // CDP has no documented partial-touch release. Chromium accepts this active
  // contact on touchEnd, emits pointerup only for it, and keeps `held` active;
  // the input-only diagnostic records that behavior for this exact runtime.
  const up = sendTouch("touchEnd", [contact]);
  await Promise.all([down, up]);
  return { durationMs: Date.now() - startedAt, pointerId: contact.id };
};

const keyForDirection = {
  left: "KeyA",
  right: "KeyD",
  forward: "KeyW",
  backward: "KeyS",
};
const beginRouteMovement = async (direction) => {
  if (!hybridRoute) return beginStick(direction);
  const key = keyForDirection[direction];
  await page.keyboard.down(key);
  return { key };
};
const endRouteMovement = async (held) => {
  if (hybridRoute) {
    if (held?.key) await page.keyboard.up(held.key);
    return;
  }
  await endTouches();
};
const jumpWhileMoving = async (held) => {
  if (hybridRoute) {
    const startedAt = Date.now();
    await page.keyboard.press("Space", { delay: 30 });
    return { durationMs: Date.now() - startedAt, pointerId: null };
  }
  return tapPointWhileHeld(held, await worldPoint());
};

const tapPassivePanelToJump = async (locator, label) => {
  await locator.waitFor();
  await waitForInspection(
    (inspection) => inspection.status.grounded,
    `${label}-grounded`,
  );
  const before = await inspectGame();
  const center = await controlCenter(locator);
  const hitElement = await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    return {
      tag: element?.tagName ?? null,
      className:
        typeof element?.className === "string" ? element.className : null,
    };
  }, center);
  assert.equal(
    hitElement.tag,
    "CANVAS",
    `${label} did not pass through to canvas`,
  );
  const contact = point(nextPointerId++, center.x, center.y);
  await sendTouch("touchStart", [contact]);
  await delay(10);
  await sendTouch("touchEnd", []);
  const jumped = await waitForInspection(
    (inspection) =>
      inspection.status.jumpSequence > before.status.jumpSequence &&
      !inspection.status.grounded,
    `${label}-jump`,
  );
  report.gestures.passivePanels ??= {};
  report.gestures.passivePanels[label] = {
    hitElement,
    ageYears: jumped.status.ageYears,
    jumpSequence: jumped.status.jumpSequence,
  };
  await waitForInspection(
    (inspection) => inspection.status.grounded,
    `${label}-landed`,
  );
};

const verifyZeroVolumeRestore = async () => {
  await page.getByRole("button", { name: "How to play" }).tap();
  const dialog = page.getByRole("dialog", {
    name: "Explore. Prepare. Face the era.",
  });
  await dialog.waitFor();
  await dialog.getByLabel("Sound volume").fill("0");
  await dialog.getByRole("button", { name: "Back to the adventure" }).tap();
  const enable = page.getByRole("button", { name: "Enable sound" });
  await enable.waitFor();
  await resetAudioProbe();
  await enable.tap();
  await page.getByRole("button", { name: "Mute sound" }).waitFor();
  await delay(1_000);
  const output = await audioSnapshot();
  assert.ok(
    output.contexts.some(
      (entry) => entry.nonzeroSampleCount > 0 && entry.maxAbs > 0.0001,
    ),
    `zero-volume restore produced no analyser output: ${JSON.stringify(output)}`,
  );
  await page.getByRole("button", { name: "How to play" }).tap();
  const restoredVolume = Number(
    await dialog.getByLabel("Sound volume").inputValue(),
  );
  assert.ok(restoredVolume > 0, "header Enable sound kept volume at zero");
  await screenshot("zero-volume-restored");
  await dialog.getByRole("button", { name: "Back to the adventure" }).tap();
  report.audio.zeroVolumeRestore = { restoredVolume, output };
};

const diagnoseHeldWorldTap = async () => {
  await waitForInspection(
    (inspection) => inspection.status.grounded,
    "input-diagnostic-grounded",
  );
  await page.evaluate(() => {
    window.__questPointerTrace = [];
    for (const type of [
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
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
                : null,
            timeStamp: event.timeStamp,
            x: event.clientX,
            y: event.clientY,
          });
        },
        true,
      );
    }
  });
  const before = await inspectGame();
  const held = await beginStick("forward");
  const heldInspection = await waitForInspection(
    (inspection) => inspection.input.moveY > 0.9,
    "input-diagnostic-held",
  );
  const tap = await tapPointWhileHeld(held, await worldPoint());
  await delay(500);
  const after = await inspectGame();
  const pointerTrace = await page.evaluate(() => window.__questPointerTrace);
  await endTouches();
  report.gestures.heldWorldTapDiagnostic = {
    tap,
    beforeJumpSequence: before.status.jumpSequence,
    afterJumpSequence: after.status.jumpSequence,
    heldMoveYBeforeTap: heldInspection.input.moveY,
    heldMoveYAfterTap: after.input.moveY,
    groundedAfterTap: after.status.grounded,
    pointerTrace,
  };
  mark("input-only:complete", report.gestures.heldWorldTapDiagnostic);
};

const recoverIfFallen = async () => {
  const retry = page.getByRole("button", { name: "Try this level again" });
  if ((await retry.count()) && (await retry.isVisible())) {
    report.recoveries.combatRetries += 1;
    await retry.tap();
    await waitForInspection(
      (inspection) => inspection.status.phase === "exploring",
      "retry-level",
      15_000,
    );
    return true;
  }
  return false;
};

const observedObbyRecoveries = new Map();
const recordObbyRecoveries = (inspection, label) => {
  if (!inspection.obby) return false;
  const levelId = inspection.level.id;
  const previous = observedObbyRecoveries.get(levelId) ?? 0;
  if (inspection.obby.recoveries > previous) {
    report.recoveries.localObby.push({
      label,
      levelId,
      from: previous,
      to: inspection.obby.recoveries,
      checkpointId: inspection.obby.checkpointId,
      position: inspection.status.position,
    });
  }
  observedObbyRecoveries.set(levelId, inspection.obby.recoveries);
  return inspection.obby.recoveries > previous;
};

const routeJumpIsDue = (inspection, direction) => {
  if (
    direction !== "forward" ||
    !inspection.status.grounded ||
    !inspection.obby
  )
    return false;
  const z = inspection.status.position.z;
  const hazardAhead = inspection.obby.hazards.some((hazard) => {
    const distanceAhead = z - hazard.center.z;
    return distanceAhead >= 0.55 && distanceAhead <= 1.8;
  });
  if (hazardAhead) return true;
  if (inspection.obby.routeId !== "gentle-jump-v1") return false;
  return [
    [-3.45, -1.3],
    [-9.45, -7.3],
    [-15.45, -13.3],
    [-18.35, -16.15],
  ].some(([farZ, nearZ]) => z <= nearZ && z >= farZ);
};

const moveHeldUntil = async (direction, predicate, label, timeout = 12_000) => {
  const held = await beginRouteMovement(direction);
  const deadline = Date.now() + timeout;
  try {
    while (Date.now() < deadline) {
      const inspection = await inspectGame();
      assert.ok(inspection, `${label}: inspection missing`);
      if (await predicate(inspection)) return inspection;
      await delay(55);
    }
  } finally {
    await endRouteMovement(held);
    await delay(45);
  }
  throw new Error(`${label}: held movement timed out`);
};

const clearedRunways = new Set();
const crossRunwaySweeper = async (label) => {
  let inspection = await inspectGame();
  assert.ok(inspection?.obby, `${label}: obby inspection missing`);
  const levelId = inspection.level.id;
  const startingRecoveries = inspection.obby.recoveries;
  mark(`move:${label}:runway-stage`, {
    position: inspection.status.position,
    startingRecoveries,
  });

  if (Math.abs(inspection.status.position.x) > 0.15) {
    const direction = inspection.status.position.x > 0 ? "left" : "right";
    inspection = await moveHeldUntil(
      direction,
      (candidate) =>
        Math.abs(candidate.status.position.x) <= 0.15 ||
        candidate.obby.recoveries > startingRecoveries,
      `${label}-runway-center`,
    );
  }
  if (inspection.obby.recoveries > startingRecoveries) return false;

  if (inspection.status.position.z > -11.45) {
    inspection = await moveHeldUntil(
      "forward",
      (candidate) =>
        candidate.status.position.z <= -11.45 ||
        candidate.obby.recoveries > startingRecoveries,
      `${label}-runway-approach`,
    );
  }
  if (inspection.obby.recoveries > startingRecoveries) return false;

  inspection = await waitForInspection(
    (candidate) => {
      const hazard = candidate.obby?.hazards.find(
        (entry) => entry.id === "runway-sweeper",
      );
      if (!hazard) return false;
      const phase = ((hazard.angle % Math.PI) + Math.PI) % Math.PI;
      const untilNextHorizontal = Math.PI - phase;
      return untilNextHorizontal >= 0.69 && untilNextHorizontal <= 0.81;
    },
    `${label}-runway-safe-pose`,
    20_000,
  );
  const hazard = inspection.obby.hazards.find(
    (entry) => entry.id === "runway-sweeper",
  );
  assert.ok(hazard, `${label}: runway sweeper missing`);

  const held = await beginRouteMovement("forward");
  let jumped = false;
  let tookOff = false;
  let landed = null;
  let tapEvidence = null;
  let takeoffJumpSequence = null;
  const deadline = Date.now() + 12_000;
  try {
    while (Date.now() < deadline) {
      inspection = await inspectGame();
      assert.ok(inspection?.obby, `${label}: runway inspection missing`);
      if (inspection.obby.recoveries > startingRecoveries) {
        recordObbyRecoveries(inspection, `${label}-runway`);
        assert.ok(
          inspection.input.moveY > 0.5,
          `${label}: runway recovery cleared the held joystick`,
        );
        return false;
      }
      if (!jumped && inspection.status.position.z <= -12.25) {
        mark(`move:${label}:runway-world-tap`, {
          position: inspection.status.position,
          hazardAngle: hazard.angle,
          jumpSequence: inspection.status.jumpSequence,
        });
        takeoffJumpSequence = inspection.status.jumpSequence;
        tapEvidence = await jumpWhileMoving(held);
        jumped = true;
      }
      if (jumped && !inspection.status.grounded) tookOff = true;
      if (
        tookOff &&
        inspection.status.grounded &&
        inspection.obby.supportId === "second-clearing-island" &&
        inspection.status.position.z < hazard.center.z
      ) {
        landed = inspection;
        break;
      }
      await delay(45);
    }
  } finally {
    await endRouteMovement(held);
    await delay(45);
  }
  assert.ok(landed, `${label}: runway jump did not land beyond the sweeper`);

  inspection = await moveHeldUntil(
    "forward",
    (candidate) =>
      candidate.status.position.z <= -14.7 ||
      candidate.obby.recoveries > startingRecoveries,
    `${label}-runway-exit`,
  );
  if (inspection.obby.recoveries > startingRecoveries) {
    recordObbyRecoveries(inspection, `${label}-runway-exit`);
    return false;
  }
  clearedRunways.add(levelId);
  mark(`move:${label}:runway-cleared`, {
    position: inspection.status.position,
    recoveries: inspection.obby.recoveries,
    tapDurationMs: tapEvidence?.durationMs,
    jumpSequenceBefore: takeoffJumpSequence,
    jumpSequenceAfter: inspection.status.jumpSequence,
  });
  return true;
};

const moveTo = async (targetFor, done, label, maxSteps = 180) => {
  let bestDistance = Number.POSITIVE_INFINITY;
  let combatRetries = 0;
  let lastInspection = null;
  let lastTarget = null;
  let held = null;
  let heldDirection = null;
  let jumpZoneActive = false;
  const releaseStick = async () => {
    if (!held) return;
    await endRouteMovement(held);
    held = null;
    heldDirection = null;
    await delay(45);
  };
  mark(`move:${label}:start`);
  try {
    for (let step = 0; step < maxSteps; step += 1) {
      if (await done()) {
        mark(`move:${label}:done`, {
          steps: step,
          bestDistance,
          combatRetries,
        });
        return;
      }
      if (latestSave?.adventure?.phase === "fallen") {
        await releaseStick();
        if (await recoverIfFallen()) combatRetries += 1;
        continue;
      }
      const inspection = await inspectGame();
      assert.ok(inspection, `${label}: game inspection missing`);
      if (recordObbyRecoveries(inspection, label)) {
        jumpZoneActive = false;
        if (heldDirection) {
          const heldInput = ["forward", "backward"].includes(heldDirection)
            ? Math.abs(inspection.input.moveY)
            : Math.abs(inspection.input.moveX);
          assert.ok(
            heldInput > 0.5,
            `${label}: local recovery cleared a still-held joystick`,
          );
          report.recoveries.localObby.at(-1).heldInputAfterRecovery = heldInput;
          mark(`move:${label}:held-through-recovery`, {
            heldDirection,
            heldInput,
            checkpointId: inspection.obby?.checkpointId,
          });
        }
      }
      const target = targetFor(inspection);
      if (!target) {
        await releaseStick();
        await delay(80);
        if (await done()) {
          mark(`move:${label}:done`, {
            steps: step,
            bestDistance,
            combatRetries,
            targetDisappeared: true,
          });
          return;
        }
        continue;
      }
      lastInspection = inspection;
      lastTarget = target;
      const dx = target.x - inspection.status.position.x;
      const dz = target.z - inspection.status.position.z;
      const distance = Math.hypot(dx, dz);
      bestDistance = Math.min(bestDistance, distance);
      if (
        inspection.obby?.routeId === "gentle-jump-v1" &&
        target.z < -15 &&
        inspection.status.position.z > -14.7 &&
        !clearedRunways.has(inspection.level.id)
      ) {
        await releaseStick();
        const runwayCleared = await crossRunwaySweeper(label);
        if (runwayCleared && stopAfterRunway) throw new RunwayVerified(label);
        jumpZoneActive = false;
        continue;
      }
      if ((distance < 1.4 && !inspection.status.grounded) || distance < 0.45) {
        await releaseStick();
        await delay(100);
        continue;
      }
      const direction =
        Math.abs(dx) > Math.max(0.65, Math.abs(dz) * 0.7)
          ? dx < 0
            ? "left"
            : "right"
          : dz < 0
            ? "forward"
            : "backward";
      if (heldDirection !== direction) {
        await releaseStick();
        held = await beginRouteMovement(direction);
        heldDirection = direction;
      }
      const jumpIsDue = routeJumpIsDue(inspection, direction);
      if (jumpIsDue && !jumpZoneActive) {
        const jumpSequenceBefore = inspection.status.jumpSequence;
        mark(`move:${label}:world-tap`, {
          position: inspection.status.position,
          checkpointId: inspection.obby?.checkpointId,
          jumpSequence: jumpSequenceBefore,
        });
        const tap = await jumpWhileMoving(held);
        mark(`move:${label}:world-tap-dispatched`, {
          positionAtRequest: inspection.status.position,
          jumpSequenceBefore,
          tapDurationMs: tap.durationMs,
        });
      }
      jumpZoneActive = jumpIsDue;
      await delay(90);
    }
  } finally {
    await releaseStick();
  }
  await screenshot(`${label}-failure`);
  throw new Error(
    `${label} unreachable; nearest distance ${bestDistance.toFixed(2)}, combat retries ${combatRetries}, last ${JSON.stringify({ position: lastInspection?.status.position, grounded: lastInspection?.status.grounded, playerHp: lastInspection?.status.playerHp, phase: lastInspection?.status.phase, input: lastInspection?.input, nearEncounterId: lastInspection?.status.nearEncounterId, target: lastTarget, obby: lastInspection?.obby })}`,
  );
};

const collectPickup = async (kind, label) => {
  const levelId = latestSave.adventure.currentLevelId;
  await moveTo(
    (inspection) =>
      inspection.level.pickupPositions.find(
        (pickup) => pickup.kind === kind && !pickup.collected,
      ),
    () =>
      latestSave.adventure.currentLevelId === levelId &&
      latestSave.adventure.activeLevel.pickups.some(
        (item) => item.kind === kind && item.collected,
      ),
    label,
  );
  assert.equal(
    await page.getByRole("button", { name: "Take gear", exact: true }).count(),
    0,
    "route gear exposed a retired interaction button",
  );
};

const collectMinor = async (memoryId, expectedAge, label) => {
  await moveTo(
    (inspection) =>
      inspection.level.memoryPositions.find((memory) => memory.id === memoryId),
    () =>
      ["revealed", "consumed"].includes(
        latestSave.memories.find((memory) => memory.id === memoryId)?.state,
      ),
    label,
  );
  assert.equal(latestSave.ageYears, expectedAge, "minor memory changed age");
  assert.equal(
    latestSave.memories.find((memory) => memory.id === memoryId)?.role,
    "minor",
  );
  const rendered = await waitForInspection(
    (inspection) =>
      inspection.visuals?.memories.some(
        (memory) => memory.id === memoryId && memory.visible === false,
      ),
    `${label}-rendered-hidden`,
    20_000,
  );
  const visual = rendered.visuals.memories.find(
    (memory) => memory.id === memoryId,
  );
  assert.deepEqual(visual, { id: memoryId, visible: false });
  mark(`memory:${label}:rendered-hidden`, visual);
  return visual;
};

const waitForEnemyChange = async (
  encounterId,
  hp,
  revision,
  timeout = 4_000,
) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const enemy = latestSave?.adventure?.activeLevel?.encounters.find(
      (candidate) => candidate.id === encounterId,
    );
    if (latestSave?.revision > revision && enemy && enemy.hp < hp) return enemy;
    await delay(45);
  }
  return null;
};

const finitePoint = (point) =>
  point && [point.x, point.y, point.z].every(Number.isFinite);

const pointDistance = (first, second) =>
  Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z);

const createBestiesVisualTracker = () => ({
  actors: new Map(),
  samples: [],
  lastSignature: null,
});

const observeBestiesVisuals = (tracker, inspection) => {
  const phase = inspection.status.bestiesPhase;
  const actors = inspection.visuals?.besties;
  if (!phase || !actors?.length) return;
  const signature = `${phase}:${actors
    .map((actor) => `${actor.id}:${actor.clip}:${actor.visible}`)
    .join("|")}`;
  if (signature !== tracker.lastSignature && tracker.samples.length < 16) {
    tracker.lastSignature = signature;
    tracker.samples.push({
      phase,
      actors: actors.map((actor) => ({
        id: actor.id,
        visible: actor.visible,
        clip: actor.clip,
        position: actor.position,
        ...(actor.pose?.head ? { head: actor.pose.head } : {}),
      })),
    });
  }
  for (const actor of actors) {
    let observed = tracker.actors.get(actor.id);
    if (!observed) {
      observed = {
        clips: new Set(),
        sawVisible: false,
        firstPosition: null,
        furthestPosition: null,
        maxPositionMotion: 0,
        firstHead: null,
        furthestHead: null,
        maxHeadMotion: 0,
      };
      tracker.actors.set(actor.id, observed);
    }
    if (actor.clip) observed.clips.add(`${phase}:${actor.clip}`);
    observed.sawVisible ||= actor.visible;
    if (finitePoint(actor.position)) {
      observed.firstPosition ??= { ...actor.position };
      const motion = pointDistance(observed.firstPosition, actor.position);
      if (motion >= observed.maxPositionMotion) {
        observed.maxPositionMotion = motion;
        observed.furthestPosition = { ...actor.position };
      }
    }
    if (finitePoint(actor.pose?.head)) {
      observed.firstHead ??= { ...actor.pose.head };
      const motion = pointDistance(observed.firstHead, actor.pose.head);
      if (motion >= observed.maxHeadMotion) {
        observed.maxHeadMotion = motion;
        observed.furthestHead = { ...actor.pose.head };
      }
    }
  }
};

const bestiesVisualsReady = (tracker) =>
  ["bestie-pink", "bestie-black"].every((id) => {
    const observed = tracker.actors.get(id);
    return (
      observed?.sawVisible &&
      observed.clips.size > 0 &&
      observed.firstHead &&
      Math.max(observed.maxPositionMotion, observed.maxHeadMotion) > 0.002
    );
  });

const summarizeBestiesVisuals = (tracker) => ({
  samples: tracker.samples,
  actors: ["bestie-pink", "bestie-black"].map((id) => {
    const observed = tracker.actors.get(id);
    assert.ok(observed, `${id}: rendered observation unavailable`);
    assert.equal(observed.sawVisible, true, `${id}: never visibly rendered`);
    assert.ok(observed.clips.size > 0, `${id}: selected clip unavailable`);
    assert.ok(observed.firstHead, `${id}: rendered head pose unavailable`);
    assert.ok(
      Math.max(observed.maxPositionMotion, observed.maxHeadMotion) > 0.002,
      `${id}: rendered pose and position remained static`,
    );
    return {
      id,
      clips: [...observed.clips],
      maxPositionMotion: observed.maxPositionMotion,
      maxHeadMotion: observed.maxHeadMotion,
      firstPosition: observed.firstPosition,
      furthestPosition: observed.furthestPosition,
      firstHead: observed.firstHead,
      furthestHead: observed.furthestHead,
    };
  }),
});

const verifyBestiesArtworkRecovery = async () => {
  mark("besties-artwork:fallback");
  await page
    .getByText("Some artwork couldn’t load.")
    .waitFor({ timeout: 20_000 });
  assert.equal(failedArtworkRequests, 1);
  const beforeRetry = await inspectGame();
  assert.ok(beforeRetry && beforeRetry.status.mediaFailed > 0);
  await screenshot("besties-pink-fallback");
  await page.getByRole("button", { name: "Retry artwork" }).tap();
  await page.getByText("Some artwork couldn’t load.").waitFor({
    state: "hidden",
    timeout: 20_000,
  });
  const afterRetry = await waitForInspection(
    (inspection) => {
      const actors = inspection.visuals?.besties;
      return (
        inspection.status.mediaFailed === 0 &&
        inspection.status.mediaLoading === 0 &&
        actors?.length === 2 &&
        actors.every((actor) => actor.clip && actor.pose?.head)
      );
    },
    "besties-artwork-retry",
    20_000,
  );
  report.injectedArtworkFailure = {
    path: "/studio/assets/media/bestie-pink/v001/bestie-pink.glb",
    failures: failedArtworkRequests,
    before: beforeRetry.status.mediaFailed,
    after: afterRetry.status.mediaFailed,
    gamePhase: afterRetry.status.phase,
    renderedActors: afterRetry.visuals.besties.map((actor) => actor.id),
  };
  await screenshot("besties-pink-restored");
  mark("besties-artwork:restored");
};

const fight = async (roleOrKind, label, requireDizzy = false) => {
  mark(`fight:${label}:start`);
  const encounter = latestSave.adventure.activeLevel.encounters.find(
    (candidate) =>
      (roleOrKind === "boss"
        ? candidate.role === "boss"
        : candidate.kind === roleOrKind) && !candidate.defeated,
  );
  assert.ok(encounter, `${label}: encounter missing`);
  const reachedEncounter = async () => {
    const inspection = await inspectGame();
    if (inspection?.status.nearEncounterId !== encounter.id) return false;
    if (
      encounter.role === "boss" &&
      inspection.obby?.routeId === "gentle-jump-v1"
    ) {
      return (
        inspection.status.grounded &&
        inspection.obby.supportId === "boss-island"
      );
    }
    return true;
  };
  const bashTarget = (inspection) => {
    if (!requireDizzy)
      return inspection.level.encounterPositions.find(
        (candidate) => candidate.id === encounter.id,
      );
    const visibleActors =
      inspection.visuals?.besties?.filter((actor) => actor.visible) ?? [];
    return visibleActors.sort(
      (left, right) =>
        pointDistance(inspection.status.position, left.position) -
        pointDistance(inspection.status.position, right.position),
    )[0]?.position;
  };
  const reachedBashRange = async () => {
    const inspection = await inspectGame();
    const target = inspection ? bashTarget(inspection) : null;
    return Boolean(
      inspection?.status.grounded &&
      target &&
      pointDistance(inspection.status.position, target) <= 1.2,
    );
  };
  await moveTo(
    (inspection) =>
      inspection.level.encounterPositions.find(
        (candidate) => candidate.id === encounter.id,
      ),
    reachedEncounter,
    `${label}-approach`,
  );
  if (requireDizzy && report.injectedArtworkFailure === null)
    await verifyBestiesArtworkRecovery();

  const playerHpAtApproach = latestSave.adventure.playerHp;
  let lowestPlayerHp = playerHpAtApproach;
  const observedBossPhases = new Set();
  const bestiesVisualTracker = requireDizzy
    ? createBestiesVisualTracker()
    : null;
  let sawDizzy = false;
  let capturedDizzy = false;
  let bashAccepted = false;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await recoverIfFallen()) continue;
    const current = latestSave.adventure.activeLevel.encounters.find(
      (candidate) => candidate.id === encounter.id,
    );
    lowestPlayerHp = Math.min(lowestPlayerHp, latestSave.adventure.playerHp);
    if (current?.defeated) {
      const evidence = {
        sawDizzy,
        bashAccepted,
        playerHpAtApproach,
        lowestPlayerHp,
        playerHpAfter: latestSave.adventure.playerHp,
        phases: [...observedBossPhases],
        ...(bestiesVisualTracker
          ? { renderedBesties: summarizeBestiesVisuals(bestiesVisualTracker) }
          : {}),
      };
      mark(`fight:${label}:defeated`, evidence);
      return evidence;
    }
    const inspection = await inspectGame();
    assert.ok(inspection, `${label}: inspection missing`);
    if (bestiesVisualTracker)
      observeBestiesVisuals(bestiesVisualTracker, inspection);
    if (inspection.status.nearEncounterId !== encounter.id) {
      await moveTo(
        (candidate) =>
          candidate.level.encounterPositions.find(
            (entry) => entry.id === encounter.id,
          ),
        reachedEncounter,
        `${label}-reapproach`,
      );
      continue;
    }
    if (requireDizzy) {
      observedBossPhases.add(inspection.status.bestiesPhase);
      sawDizzy ||= inspection.status.bestiesPhase === "dizzy";
      if (
        inspection.status.bestiesPhase !== "dizzy" ||
        !bestiesVisualsReady(bestiesVisualTracker)
      ) {
        await delay(80);
        continue;
      }
      if (!capturedDizzy) {
        await screenshot("besties-dizzy");
        capturedDizzy = true;
      }
    }

    const guardEquipped = latestSave.adventure.inventory.some(
      (item) => item.kind === "guard-tool" && item.collected,
    );
    const currentBashTarget = bashTarget(inspection);
    if (
      guardEquipped &&
      !bashAccepted &&
      (!inspection.status.grounded ||
        !currentBashTarget ||
        pointDistance(inspection.status.position, currentBashTarget) > 1.2)
    ) {
      await moveTo(bashTarget, reachedBashRange, `${label}-secondary-approach`);
      continue;
    }
    if (guardEquipped && !bashAccepted && !inspection.status.guardReady) {
      await delay(90);
      continue;
    }

    const hp = current.hp;
    const revision = latestSave.revision;
    const bash = page.getByRole("button", { name: "Bash", exact: true });
    if (
      (await bash.count()) &&
      (await bash.isEnabled()) &&
      inspection.status.guardReady
    ) {
      const activated = await bash
        .tap({ timeout: 1_000 })
        .then(() => true)
        .catch(() => false);
      if (!activated) continue;
      bashAccepted ||= Boolean(
        await waitForEnemyChange(encounter.id, hp, revision),
      );
    } else if (inspection.status.attackReady) {
      const activated = await page
        .getByRole("button", { name: "Attack", exact: true })
        .tap({ timeout: 1_000 })
        .then(() => true)
        .catch(() => false);
      if (!activated) continue;
      await waitForEnemyChange(encounter.id, hp, revision);
    } else {
      await delay(90);
    }
  }
  await screenshot(`${label}-failure`);
  throw new Error(`${label}: combat timeout`);
};

const collectMajor = async (memoryId, expectedAge, nextAge, label) => {
  assert.equal(latestSave.ageYears, expectedAge);
  assert.equal(
    latestSave.memories.find((memory) => memory.id === memoryId)?.role,
    "major",
  );
  await moveTo(
    (inspection) =>
      inspection.level.memoryPositions.find((memory) => memory.id === memoryId),
    () => latestSave.ageYears === nextAge,
    label,
  );
  assert.equal(latestSave.ageYears, nextAge);
};

const playChapter = async (expectedAge, nextAge, index) => {
  mark(`chapter:${index + 1}:start`, { expectedAge, nextAge });
  const level = latestSave.adventure.activeLevel;
  assert.equal(level.index, index);
  assert.equal(latestSave.ageYears, expectedAge);
  const [minorOne, minorTwo] = level.minorMemoryIds;
  const major = level.majorMemoryId;
  const evidence = {
    chapter: index + 1,
    levelId: level.id,
    eraYear: level.eraYear,
    startAge: expectedAge,
    minorIds: [minorOne, minorTwo],
    majorId: major,
    minorVisuals: [],
    revisions: {},
  };
  await delay(500);
  await screenshot(`chapter-${index + 1}-route-start`);
  evidence.frames = await sampleActiveFrames(
    `chapter-${index + 1}-active-route`,
  );
  if (index === 0 && !report.gestures.passivePanels) {
    await tapPassivePanelToJump(page.locator(".era-hud"), "age-hud");
    await tapPassivePanelToJump(
      page.locator(".era-objective"),
      "objective-hud",
    );
  }

  await collectPickup("attack-tool", `chapter-${index + 1}-attack-tool`);
  evidence.revisions.attackTool = latestSave.revision;
  evidence.minorVisuals.push(
    await collectMinor(minorOne, expectedAge, `chapter-${index + 1}-minor-one`),
  );
  evidence.revisions.minorOne = latestSave.revision;
  await collectPickup("guard-tool", `chapter-${index + 1}-guard-tool`);
  evidence.revisions.guardTool = latestSave.revision;
  const firstFight = await fight(
    "ordinary-a",
    `chapter-${index + 1}-ordinary-a`,
  );
  evidence.revisions.ordinaryOne = latestSave.revision;
  evidence.minorVisuals.push(
    await collectMinor(minorTwo, expectedAge, `chapter-${index + 1}-minor-two`),
  );
  evidence.revisions.minorTwo = latestSave.revision;
  assert.equal(
    latestSave.adventure.activeLevel.minorMemoryIds.every((id) =>
      ["revealed", "consumed"].includes(
        latestSave.memories.find((memory) => memory.id === id)?.state,
      ),
    ),
    true,
  );
  assert.equal(latestSave.ageYears, expectedAge);
  const secondFight = await fight(
    "ordinary-b",
    `chapter-${index + 1}-ordinary-b`,
  );
  evidence.revisions.ordinaryTwo = latestSave.revision;
  evidence.ordinaryDefeatedBeforeBoss =
    latestSave.adventure.activeLevel.encounters
      .filter((encounter) => encounter.role === "ordinary")
      .map((encounter) => ({ id: encounter.id, defeated: encounter.defeated }));
  assert.equal(
    evidence.ordinaryDefeatedBeforeBoss.every(
      (encounter) => encounter.defeated,
    ),
    true,
    "boss approached before both ordinary encounters were defeated",
  );
  if (index === 0 && !skipBossHud)
    await tapPassivePanelToJump(page.locator(".boss-hud"), "boss-hud");
  const bossFight = await fight(
    "boss",
    `chapter-${index + 1}-boss`,
    index === 1,
  );
  evidence.bossCombat = bossFight;
  evidence.bossHits = observedHits.filter(
    (hit) => hit.encounterId === level.bossId,
  );
  evidence.revisions.boss = latestSave.revision;
  evidence.secondaryAttackAccepted =
    firstFight.bashAccepted ||
    secondFight.bashAccepted ||
    bossFight.bashAccepted;
  evidence.sawBestiesDizzy = bossFight.sawDizzy;
  assert.equal(
    latestSave.ageYears,
    expectedAge,
    "boss changed age before major memory",
  );
  assert.equal(latestSave.adventure.phase, "memory-released");
  if (index === 1)
    assert.equal(bossFight.sawDizzy, true, "Besties never became dizzy");
  if (index === 1) {
    const defeatWaitStarted = Date.now();
    const defeatedVisuals = await waitForInspection(
      (inspection) => {
        const actors = inspection.visuals?.besties;
        return (
          inspection.status.bestiesPhase === "defeated" &&
          actors?.length === 2 &&
          actors.every(
            (actor) => actor.clip === "defeat" && actor.visible === false,
          )
        );
      },
      "Besties defeat animation completes in renderer",
      20_000,
    );
    evidence.bestiesDefeatVisuals = {
      waitedMs: Date.now() - defeatWaitStarted,
      actors: defeatedVisuals.visuals.besties.map((actor) => ({
        id: actor.id,
        visible: actor.visible,
        clip: actor.clip,
        position: actor.position,
        ...(actor.pose?.head ? { head: actor.pose.head } : {}),
      })),
    };
    mark("besties:defeat-rendered-hidden", evidence.bestiesDefeatVisuals);
  }
  await screenshot(`chapter-${index + 1}-boss-defeated`);

  await collectMajor(major, expectedAge, nextAge, `chapter-${index + 1}-major`);
  evidence.revisions.major = latestSave.revision;
  evidence.endAge = latestSave.ageYears;
  report.chapters.push(evidence);
  await screenshot(`chapter-${index + 1}-complete`);
  mark(`chapter:${index + 1}:complete`, { ageYears: latestSave.ageYears });
};

const verifyHeldAttackDamage = async () => {
  const encounter = latestSave.adventure.activeLevel.encounters.find(
    (candidate) => candidate.kind === "ordinary-a" && !candidate.defeated,
  );
  assert.ok(encounter, "held-attack target missing");
  await moveTo(
    (inspection) =>
      inspection.level.encounterPositions.find(
        (candidate) => candidate.id === encounter.id,
      ),
    async () => (await inspectGame())?.status.nearEncounterId === encounter.id,
    "held-attack-approach",
  );
  await waitForInspection(
    (inspection) =>
      inspection.status.nearEncounterId === encounter.id &&
      inspection.status.attackReady,
    "held-attack-ready",
  );
  const attackCenter = await controlCenter(
    page.getByRole("button", { name: "Attack", exact: true }),
  );
  const revision = latestSave.revision;
  const hp = encounter.hp;
  const held = await beginStick("left");
  try {
    await waitForInspection(
      (inspection) => inspection.input.moveX < -0.9,
      "held-attack-stick",
    );
    const tap = await tapPointWhileHeld(held, attackCenter);
    const damaged = await waitForSave(
      (save) =>
        save.revision > revision &&
        save.adventure.activeLevel.encounters.some(
          (candidate) => candidate.id === encounter.id && candidate.hp < hp,
        ),
      "held-attack-damage",
    );
    const after = await waitForInspection(
      (inspection) => inspection.input.moveX < -0.9,
      "held-attack-retained",
    );
    report.gestures.heldAttackDamage = {
      encounterId: encounter.id,
      revisionBefore: revision,
      revisionAfter: damaged.revision,
      hpBefore: hp,
      hpAfter: damaged.adventure.activeLevel.encounters.find(
        (candidate) => candidate.id === encounter.id,
      )?.hp,
      retainedMoveX: after.input.moveX,
      tapDurationMs: tap.durationMs,
    };
  } finally {
    await endTouches();
  }
};

const verifyLandscapeControls = async () => {
  await collectPickup("attack-tool", "landscape-attack-tool");
  await collectPickup("guard-tool", "landscape-guard-tool");
  await verifyHeldAttackDamage();
  await page.setViewportSize({ width: 844, height: 390 });
  cachedWorldTapPoint = null;
  cachedStickGeometry = null;
  await delay(350);

  const attack = page.getByRole("button", { name: "Attack", exact: true });
  const bash = page.getByRole("button", { name: "Bash", exact: true });
  const joystick = page.getByTestId("joystick");
  const header = page.locator(".game-header");
  await Promise.all([
    attack.waitFor(),
    bash.waitFor(),
    joystick.waitFor(),
    header.waitFor(),
  ]);
  const [attackBox, bashBox, joystickBox, headerBox] = await Promise.all([
    attack.boundingBox(),
    bash.boundingBox(),
    joystick.boundingBox(),
    header.boundingBox(),
  ]);
  assert.ok(attackBox && bashBox && joystickBox && headerBox);
  const withinViewport = (box) =>
    box.x >= 0 &&
    box.y >= 0 &&
    box.x + box.width <= 844 &&
    box.y + box.height <= 390;
  const overlapArea = (left, right) =>
    Math.max(
      0,
      Math.min(left.x + left.width, right.x + right.width) -
        Math.max(left.x, right.x),
    ) *
    Math.max(
      0,
      Math.min(left.y + left.height, right.y + right.height) -
        Math.max(left.y, right.y),
    );
  for (const box of [attackBox, bashBox, joystickBox, headerBox])
    assert.equal(withinViewport(box), true, "landscape control left viewport");
  assert.ok(
    attackBox.width * attackBox.height > bashBox.width * bashBox.height,
    "landscape Attack target was not larger than Bash",
  );
  for (const actionBox of [attackBox, bashBox]) {
    assert.equal(overlapArea(actionBox, joystickBox), 0);
    assert.equal(overlapArea(actionBox, headerBox), 0);
  }
  await screenshot("landscape-controls");

  await page.getByRole("button", { name: "How to play" }).tap();
  const dialog = page.getByRole("dialog", {
    name: "Explore. Prepare. Face the era.",
  });
  await dialog.waitFor();
  const close = dialog.getByRole("button", { name: "Back to the adventure" });
  await close.waitFor();
  assert.equal(await close.isVisible(), true);
  await screenshot("landscape-help");
  await close.tap();
  await dialog.waitFor({ state: "detached" });

  report.layout = {
    viewport: { width: 844, height: 390 },
    attack: attackBox,
    bash: bashBox,
    joystick: joystickBox,
    header: headerBox,
    helpOpenedAndClosed: true,
  };
  await page.setViewportSize({ width: 390, height: 844 });
  cachedWorldTapPoint = null;
  cachedStickGeometry = null;
  await delay(250);
  mark("landscape:complete", report.layout);
};

const assertNoUnexpectedBrowserErrors = () => {
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responseErrors, []);
  assert.equal(
    report.consoleErrors.filter(
      (message) =>
        !message.includes(
          "Failed to load resource: the server responded with a status of 503",
        ),
    ).length,
    0,
    `unexpected console errors: ${JSON.stringify(report.consoleErrors)}`,
  );
};

try {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await assertFreshHome();
  assert.equal(
    await page.getByText("Save & leave", { exact: true }).count(),
    0,
  );
  await screenshot("fresh-home");

  if (!routeOnly) {
    const initial = await startPlaytest(1);
    assert.equal(initial.ageYears, 0);
    assert.deepEqual(initial.abilities, ["move", "interact", "jump"]);

    const help = page.getByRole("button", { name: "How to play" });
    await help.tap();
    const helpDialog = page.getByRole("dialog", {
      name: "Explore. Prepare. Face the era.",
    });
    await helpDialog.waitFor();
    await helpDialog.getByLabel("Sound volume").fill("1");
    await resetAudioProbe();
    await helpDialog.getByRole("button", { name: "Play a test sound" }).tap();
    await delay(1_500);
    const testSound = await audioSnapshot();
    assert.equal(testSound.available, true, "Web Audio unavailable");
    assert.ok(testSound.contexts.some((entry) => entry.analyserConnected));
    assert.ok(
      testSound.contexts.some(
        (entry) => entry.nonzeroSampleCount > 0 && entry.maxAbs > 0.0001,
      ),
      `test sound produced no analyser output: ${JSON.stringify(testSound)}`,
    );
    report.audio.testSound = testSound;
    await screenshot("help-and-sound-test");
    await helpDialog
      .getByRole("button", { name: "Back to the adventure" })
      .tap();

    await page.getByRole("button", { name: "Mute sound" }).tap();
    await page.getByRole("button", { name: "Enable sound" }).waitFor();
    await delay(300);
    await resetAudioProbe();
    await standaloneWorldTap();
    await delay(500);
    const muted = await audioSnapshot();
    assert.equal(
      muted.contexts.some((entry) => entry.maxAbs > 0.0001),
      false,
      `muted gesture reached output: ${JSON.stringify(muted)}`,
    );
    report.audio.mutedJump = muted;
    await resetAudioProbe();
    await page.getByRole("button", { name: "Enable sound" }).tap();
    await page.getByRole("button", { name: "Mute sound" }).waitFor();
    await delay(700);
    const unmuted = await audioSnapshot();
    assert.ok(
      unmuted.contexts.some((entry) => entry.maxAbs > 0.0001),
      `unmute confirmation produced no output: ${JSON.stringify(unmuted)}`,
    );
    report.audio.unmute = unmuted;

    await waitForInspection(
      (inspection) => inspection.status.grounded,
      "pre-space",
    );
    const beforeSpace = await inspectGame();
    await page.keyboard.press("Space", { delay: 70 });
    const spaceJump = await waitForInspection(
      (inspection) =>
        !inspection.status.grounded &&
        inspection.status.position.y > beforeSpace.status.position.y + 0.08,
      "age-zero-space-jump",
    );
    report.gestures.spaceAtAgeZero = {
      age: spaceJump.status.ageYears,
      startY: beforeSpace.status.position.y,
      airborneY: spaceJump.status.position.y,
    };
    assert.equal(spaceJump.status.ageYears, 0);
    await waitForInspection(
      (inspection) => inspection.status.grounded,
      "space-landed",
    );

    const beforeCancel = await inspectGame();
    await cancelWorldTouch();
    await delay(180);
    const afterCancel = await inspectGame();
    assert.equal(afterCancel.status.grounded, true);
    assert.ok(
      Math.abs(afterCancel.status.position.y - beforeCancel.status.position.y) <
        0.03,
      "cancelled world contact jumped",
    );
    report.gestures.cancelledWorldTouch = {
      before: beforeCancel.status.position,
      after: afterCancel.status.position,
    };

    await waitForInspection(
      (inspection) => inspection.status.grounded,
      "pre-world-tap",
    );
    const beforeWorldTap = await inspectGame();
    await standaloneWorldTap();
    const worldJump = await waitForInspection(
      (inspection) =>
        !inspection.status.grounded &&
        inspection.status.position.y > beforeWorldTap.status.position.y + 0.08,
      "age-zero-world-jump",
    );
    report.gestures.worldTapAtAgeZero = {
      age: worldJump.status.ageYears,
      startY: beforeWorldTap.status.position.y,
      airborneY: worldJump.status.position.y,
    };
    assert.equal(worldJump.status.ageYears, 0);
    await waitForInspection(
      (inspection) => inspection.status.grounded,
      "world-tap-landed",
    );

    const initialId = latestSave.id;
    await page.getByRole("button", { name: "Leave playtest" }).tap();
    await page.locator("canvas").waitFor({ state: "detached" });
    await assertFreshHome();
    const afterLeave = await startPlaytest(1);
    assert.notEqual(afterLeave.id, initialId);
    assert.equal(afterLeave.revision, 0);
    report.resets.leave = { priorId: initialId, freshId: afterLeave.id };

    await collectPickup("attack-tool", "reload-proof-gear");
    const progressedId = latestSave.id;
    const progressedRevision = latestSave.revision;

    await waitForInspection(
      (inspection) => inspection.status.grounded,
      "pre-simultaneous-input",
    );
    const attackSequence =
      (await inspectGame()).status.attackFeedback?.sequence ?? 0;
    const attackCenter = await controlCenter(
      page.getByRole("button", { name: "Attack", exact: true }),
    );
    const held = await beginStick("left", 0.3);
    await tapPointWhileHeld(held, attackCenter);
    const simultaneousAttack = await waitForInspection(
      (inspection) =>
        inspection.input.moveX < -0.1 &&
        (inspection.status.attackFeedback?.sequence ?? 0) > attackSequence,
      "held-stick-attack",
    );
    const jumpSequence = simultaneousAttack.status.jumpSequence;
    const jumpTouch = await tapPointWhileHeld(held, await worldPoint());
    report.gestures.heldJumpTouch = jumpTouch;
    report.gestures.heldJumpPointerTrace = await page.evaluate(
      () => window.__questPointerTrace,
    );
    const simultaneousJump = await waitForInspection(
      (inspection) =>
        inspection.input.moveX < -0.1 &&
        inspection.status.jumpSequence > jumpSequence &&
        !inspection.status.grounded,
      "held-stick-world-jump",
    );
    await endTouches();
    report.gestures.simultaneous = {
      attackOutcome: simultaneousAttack.status.attackFeedback.outcome,
      heldMoveXDuringAttack: simultaneousAttack.input.moveX,
      heldMoveXDuringJump: simultaneousJump.input.moveX,
      airborneY: simultaneousJump.status.position.y,
      jumpSequence: simultaneousJump.status.jumpSequence,
    };
    await waitForInspection(
      (inspection) => inspection.status.grounded,
      "pre-held-stick-cancel",
    );
    const beforeHeldCancel = await inspectGame();
    const heldForCancel = await beginStick("left", 0.3);
    const heldAfterCancel = await waitForInspection(
      (inspection) => inspection.input.moveX < -0.1,
      "held-stick-cancel",
    );
    await cancelWorldTouchWhileHeld(heldForCancel);
    await delay(180);
    const settledAfterCancel = await inspectGame();
    assert.equal(
      settledAfterCancel.status.jumpSequence,
      beforeHeldCancel.status.jumpSequence,
      "cancelled world pointer queued a jump while the joystick was held",
    );
    assert.equal(
      settledAfterCancel.input.moveX,
      0,
      "touch cancellation did not clear the cancelled joystick contact",
    );
    report.gestures.simultaneous.cancelledWorldPointer = {
      heldContactId: heldForCancel.id,
      heldMoveXBeforeCancel: heldAfterCancel.input.moveX,
      moveXAfterCancel: settledAfterCancel.input.moveX,
      jumpSequence: settledAfterCancel.status.jumpSequence,
    };

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("canvas").waitFor({ state: "detached" });
    await assertFreshHome();
    assert.equal(
      await page.getByText("Save & leave", { exact: true }).count(),
      0,
    );
    const fullRoute = await startPlaytest(1);
    assert.notEqual(fullRoute.id, progressedId);
    assert.equal(fullRoute.revision, 0);
    report.resets.reload = {
      priorId: progressedId,
      priorRevision: progressedRevision,
      freshId: fullRoute.id,
    };
    if (smokeOnly) {
      assertNoUnexpectedBrowserErrors();
      await screenshot("smoke-complete");
      throw new SmokeVerified();
    }
  } else {
    const fullRoute = await startPlaytest(routeStartChapter);
    if (routeStartChapter === 1) assert.equal(fullRoute.revision, 0);
    else assert.ok(fullRoute.revision > 0);
    assert.equal(fullRoute.ageYears, routeStartChapter === 1 ? 0 : 4);
    mark("route-only:fresh-start", {
      id: fullRoute.id,
      chapter: routeStartChapter,
    });
    if (landscapeOnly) {
      await verifyLandscapeControls();
      assertNoUnexpectedBrowserErrors();
      throw new LandscapeVerified();
    }
    if (inputOnly) {
      await verifyZeroVolumeRestore();
      await tapPassivePanelToJump(page.locator(".era-hud"), "age-hud");
      await tapPassivePanelToJump(
        page.locator(".era-objective"),
        "objective-hud",
      );
      await diagnoseHeldWorldTap();
      throw new InputDiagnosticComplete();
    }
    if (routeStartChapter === 1) await verifyZeroVolumeRestore();
  }

  if (!routeOnly || routeStartChapter === 1) {
    await playChapter(0, 4, 0);
    await page.getByRole("dialog", { name: /Welcome to 2024/ }).waitFor();
    await page.getByRole("button", { name: "Enter the next era" }).tap();
  }
  await playChapter(4, 7, 1);
  await page
    .getByRole("dialog", {
      name: "Every chapter, a little more you.",
    })
    .waitFor();
  assert.equal(latestSave.completed, true);
  assert.equal(latestSave.recoveredIds.length, 6);
  assert.equal(
    report.chapters.every((chapter) => chapter.secondaryAttackAccepted),
    true,
  );
  assert.equal(
    report.chapters.find((chapter) => chapter.chapter === 2)?.sawBestiesDizzy,
    true,
  );

  await page.getByRole("button", { name: "Play again" }).tap();
  await assertFreshHome();
  const shortcut = await startPlaytest(2);
  assert.equal(shortcut.ageYears, 4);
  assert.equal(shortcut.adventure.activeLevelIndex, 1);
  const shortcutInspection = await waitForInspection(
    (inspection) => inspection.status.bestiesPhase !== undefined,
    "besties-shortcut",
    20_000,
  );
  report.bestiesShortcut = {
    id: shortcut.id,
    revision: shortcut.revision,
    ageYears: shortcut.ageYears,
    activeLevelIndex: shortcut.adventure.activeLevelIndex,
    bestiesPhase: shortcutInspection.status.bestiesPhase,
  };
  await screenshot("besties-shortcut");

  assertNoUnexpectedBrowserErrors();
  report.status = "passed";
  report.finishedAt = new Date().toISOString();
  report.observedSaves = observedSaves;
} catch (error) {
  if (
    error instanceof RunwayVerified ||
    error instanceof InputDiagnosticComplete ||
    error instanceof LandscapeVerified ||
    error instanceof SmokeVerified
  ) {
    report.status =
      error instanceof RunwayVerified
        ? "passed-runway"
        : error instanceof LandscapeVerified
          ? "passed-landscape"
          : error instanceof SmokeVerified
            ? "passed-smoke"
            : "input-diagnostic";
    report.finishedAt = new Date().toISOString();
    if (error instanceof RunwayVerified)
      mark("runway-only:complete", { label: error.message });
  } else {
    report.status = forcedExitCode === null ? "failed" : "interrupted";
    report.finishedAt = new Date().toISOString();
    report.failure =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { name: "NonError", message: String(error) };
    if (forcedReason) report.interruption = forcedReason;
    if (forcedExitCode === null) {
      await screenshot("failure").catch(() => undefined);
      throw error;
    }
  }
} finally {
  clearTimeout(overallTimer);
  process.removeListener("SIGINT", onInterrupt);
  process.removeListener("SIGTERM", onTerminate);
  report.observedSaves ??= observedSaves;
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await context.close().catch(() => undefined);
  await closeBrowser();
}

if (forcedExitCode !== null) process.exitCode = forcedExitCode;
console.log(
  JSON.stringify({
    status: report.status,
    report: reportPath,
    bundle: report.bundle,
    chapters: report.chapters.map((chapter) => ({
      eraYear: chapter.eraYear,
      startAge: chapter.startAge,
      endAge: chapter.endAge,
      sawBestiesDizzy: chapter.sawBestiesDizzy,
    })),
    audioPeak: report.audio.testSound?.contexts?.reduce(
      (peak, contextEntry) => Math.max(peak, contextEntry.maxAbs),
      0,
    ),
  }),
);
