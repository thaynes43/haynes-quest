import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const url = process.env.QUEST_E2E_URL ?? "http://127.0.0.1:4392";
const mode = process.env.QUEST_E2E_MODE ?? "keyboard";
assert.ok(["keyboard", "touch"].includes(mode));
const viewport =
  mode === "keyboard"
    ? { width: 1024, height: 768 }
    : { width: 390, height: 844 };
const deviceScaleFactor = 1;
const overallTimeoutMs = 60_000;

await fs.mkdir("test-results", { recursive: true });
const indexResponse = await fetch(url);
assert.equal(indexResponse.status, 200, "fixture index failed");
const indexHtml = await indexResponse.text();
const bundlePath = indexHtml.match(/src="([^"]+\.js)"/)?.[1];
assert.ok(bundlePath, "fixture bundle path missing");
const bundleResponse = await fetch(new URL(bundlePath, url));
assert.equal(bundleResponse.status, 200, "fixture bundle failed");
const bundleBytes = Buffer.from(await bundleResponse.arrayBuffer());
const bundle = {
  path: bundlePath,
  bytes: bundleBytes.byteLength,
  sha256: createHash("sha256").update(bundleBytes).digest("hex"),
};

const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
  ],
});
let cleanupStarted = false;
let forcedExitCode = null;
const forceCleanup = (reason, exitCode) => {
  if (cleanupStarted) return;
  cleanupStarted = true;
  forcedExitCode = exitCode;
  console.error(`[renderer-probe:${mode}] ${reason}; closing Chromium`);
  const hardExit = setTimeout(() => process.exit(exitCode), 10_000);
  hardExit.unref();
  void browser.close();
};
const onInterrupt = () => forceCleanup("interrupted", 130);
const onTerminate = () => forceCleanup("terminated", 143);
process.once("SIGINT", onInterrupt);
process.once("SIGTERM", onTerminate);
const overallTimer = setTimeout(
  () => forceCleanup(`overall timeout ${overallTimeoutMs}ms exceeded`, 124),
  overallTimeoutMs,
);

async function timed(action) {
  const started = performance.now();
  const value = await action();
  return { milliseconds: performance.now() - started, value };
}

async function inspectGame(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return null;
    let element = canvas;
    let fiber = null;
    while (element && !fiber) {
      const fiberKey = Object.keys(element).find((key) =>
        key.startsWith("__reactFiber$"),
      );
      fiber = fiberKey ? element[fiberKey] : null;
      element = element.parentElement;
    }
    while (fiber) {
      let hook = fiber.memoizedState;
      while (hook) {
        const candidate = hook.memoizedState?.current;
        if (candidate && typeof candidate.inspect === "function")
          return candidate.inspect();
        hook = hook.next;
      }
      fiber = fiber.return;
    }
    return null;
  });
}

async function sampleRaf(page, durationMs) {
  return page.evaluate(
    (requestedDuration) =>
      new Promise((resolve) => {
        const started = performance.now();
        let previous = started;
        let frames = 0;
        let largestGapMs = 0;
        const tick = (now) => {
          frames += 1;
          largestGapMs = Math.max(largestGapMs, now - previous);
          previous = now;
          if (now - started >= requestedDuration) {
            resolve({
              frames,
              elapsedMs: now - started,
              framesPerSecond: (frames * 1_000) / (now - started),
              largestGapMs,
            });
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    durationMs,
  );
}

async function performKeyboardMove(page) {
  const down = await timed(() => page.keyboard.down("w"));
  const holdStarted = performance.now();
  await delay(700);
  const holdMs = performance.now() - holdStarted;
  const up = await timed(() => page.keyboard.up("w"));
  return {
    downMs: down.milliseconds,
    plannedHoldMs: 700,
    holdMs,
    upMs: up.milliseconds,
  };
}

async function performTouchMove(page, context) {
  const cdp = await context.newCDPSession(page);
  const stick = await page.getByTestId("joystick").boundingBox();
  assert.ok(stick, "touch joystick missing");
  const center = {
    x: stick.x + stick.width / 2,
    y: stick.y + stick.height / 2,
  };
  const point = (y) => ({
    id: 1,
    x: center.x,
    y,
    radiusX: 5,
    radiusY: 5,
    force: 1,
  });
  const start = await timed(() =>
    cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [point(center.y)],
    }),
  );
  const move = await timed(() =>
    cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [point(center.y - 34)],
    }),
  );
  const holdStarted = performance.now();
  await delay(700);
  const holdMs = performance.now() - holdStarted;
  const end = await timed(() =>
    cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    }),
  );
  await cdp.detach();
  return {
    startMs: start.milliseconds,
    moveMs: move.milliseconds,
    plannedHoldMs: 700,
    holdMs,
    endMs: end.milliseconds,
  };
}

try {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    isMobile: mode === "touch",
    hasTouch: mode === "touch",
  });
  const page = await context.newPage();
  const pageErrors = [];
  const glbResponses = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (new URL(response.url()).pathname.endsWith(".glb"))
      glbResponses.push({ url: response.url(), status: response.status() });
  });

  const startup = await timed(async () => {
    await page.goto(url);
    await page.getByRole("button", { name: "Start a journey" }).click();
    await page.getByRole("button", { name: "Preview memories" }).click();
    await page.getByRole("button", { name: "Begin your journey" }).click();
    await page.locator("canvas").waitFor();
  });

  const loadedInspection = await timed(async () => {
    const deadline = Date.now() + 12_000;
    let inspection;
    while (Date.now() < deadline) {
      inspection = await inspectGame(page);
      if (
        inspection?.obby?.routeId === "gentle-intro-v1" &&
        inspection.level.encounterPositions.length === 3
      )
        return inspection;
      await delay(50);
    }
    throw new Error("first-period scene inspection did not become ready");
  });
  assert.equal(loadedInspection.value.status.ageYears, 0);

  const resourceDeadline = Date.now() + 12_000;
  while (
    Date.now() < resourceDeadline &&
    !["mister-hiss", "peel-patrol", "drama-dragon"].every((assetId) =>
      glbResponses.some(
        (response) => response.status === 200 && response.url.includes(assetId),
      ),
    )
  )
    await delay(50);

  const raf = await sampleRaf(page, 4_000);
  const inspectionSamples = [];
  for (let index = 0; index < 5; index += 1) {
    const sample = await timed(() => inspectGame(page));
    inspectionSamples.push(sample.milliseconds);
    assert.ok(sample.value?.obby);
  }

  const saveRead = await timed(() =>
    context.request.get(new URL("/api/saves", url).href, { timeout: 5_000 }),
  );
  assert.equal(saveRead.value.status(), 200);
  const before = await inspectGame(page);
  assert.ok(before?.obby);
  const input =
    mode === "keyboard"
      ? await performKeyboardMove(page)
      : await performTouchMove(page, context);
  const after = await inspectGame(page);
  assert.ok(after?.obby);
  const travel = Math.hypot(
    after.status.position.x - before.status.position.x,
    after.status.position.z - before.status.position.z,
  );
  assert.ok(travel > 0.15, `${mode} input did not move the avatar`);

  const resources = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((entry) => entry.name.endsWith(".glb"))
      .map((entry) => ({
        url: entry.name,
        durationMs: entry.duration,
        transferSize: entry.transferSize,
      })),
  );
  const expectedEnemyModels = ["mister-hiss", "peel-patrol", "drama-dragon"];
  const loadedEnemyModels = expectedEnemyModels.filter((assetId) =>
    glbResponses.some(
      (response) => response.status === 200 && response.url.includes(assetId),
    ),
  );
  assert.deepEqual(loadedEnemyModels, expectedEnemyModels);
  assert.deepEqual(pageErrors, []);

  const evidence = {
    date: new Date().toISOString(),
    diagnosticOnly: true,
    browser: browser.version(),
    renderer: "SwiftShader launch flags; no hardware claim",
    mode,
    viewport: { ...viewport, deviceScaleFactor },
    bundle,
    startupMs: startup.milliseconds,
    sceneInspectionReadyMs: loadedInspection.milliseconds,
    raf,
    inspectionLatencyMs: inspectionSamples,
    saveReadMs: saveRead.milliseconds,
    input,
    movement: {
      before: before.status.position,
      after: after.status.position,
      distance: travel,
      courseTimeDelta: after.obby.timeSeconds - before.obby.timeSeconds,
    },
    loadedEnemyModels,
    glbResponses,
    resources,
    pageErrors,
  };
  await page.screenshot({
    path: `test-results/renderer-probe-${mode}.png`,
  });
  await fs.writeFile(
    `test-results/renderer-probe-${mode}.json`,
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence, null, 2));
  await context.close();
} catch (error) {
  if (forcedExitCode === null) throw error;
} finally {
  clearTimeout(overallTimer);
  process.off("SIGINT", onInterrupt);
  process.off("SIGTERM", onTerminate);
  cleanupStarted = true;
  await browser.close();
}
if (forcedExitCode !== null) process.exit(forcedExitCode);
