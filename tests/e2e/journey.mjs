import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { chromium } from "playwright";
import { createJourneyDriver } from "./journey-lib.mjs";

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const url = process.env.QUEST_E2E_URL ?? "http://127.0.0.1:4173";
const mode = process.env.QUEST_E2E_MODE ?? "all";
assert.ok(["all", "keyboard", "touch"].includes(mode));
const viewports = {
  keyboard: { width: 1024, height: 768, deviceScaleFactor: 1 },
  touch: { width: 390, height: 844, deviceScaleFactor: 1 },
  portrait: { width: 390, height: 844, deviceScaleFactor: 1 },
};
const overallTimeoutMs = Number(
  process.env.QUEST_E2E_TIMEOUT_MS ?? (mode === "all" ? 1_200_000 : 600_000),
);
assert.ok(Number.isFinite(overallTimeoutMs) && overallTimeoutMs > 0);
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
let activePage = null;
let cleanupStarted = false;
let forcedExitCode = null;
const forceCleanup = (reason, exitCode) => {
  if (cleanupStarted) return;
  cleanupStarted = true;
  forcedExitCode = exitCode;
  console.error(`[journey] ${reason}; closing Chromium`);
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
const errors = [];
const driver = createJourneyDriver({ url, errors });
const { keyboardControls, touchControls, playJourney } = driver;
async function start(context, inputKind) {
  const page = await driver.start(context, inputKind);
  activePage = page;
  return page;
}

const journeyEvidence = {};

try {
  if (mode !== "touch") {
    const desktop = await browser.newContext({
      viewport: {
        width: viewports.keyboard.width,
        height: viewports.keyboard.height,
      },
      deviceScaleFactor: viewports.keyboard.deviceScaleFactor,
    });
    const page = await start(desktop, "keyboard");
    const keyboard = keyboardControls(page);
    const desktopResult = await playJourney(page, keyboard, "keyboard", true);
    assert.equal(desktopResult.save.ageYears, 7);
    journeyEvidence.keyboard = desktopResult.obbyEvidence;
    await page.getByRole("button", { name: "Back to your journeys" }).click();
    assert.equal(await page.locator("canvas").count(), 0);
    await desktop.close();
  }

  if (mode !== "keyboard") {
    const touchContext = await browser.newContext({
      viewport: {
        width: viewports.touch.width,
        height: viewports.touch.height,
      },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: viewports.touch.deviceScaleFactor,
    });
    const mobile = await start(touchContext, "touch");
    const touch = await touchControls(mobile, touchContext);
    for (const control of [
      mobile.getByTestId("joystick"),
      mobile.getByRole("button", { name: "Guard", exact: true }),
      mobile.getByRole("button", { name: "Jump", exact: true }),
      mobile.getByRole("button", { name: "Attack", exact: true }),
      mobile.getByRole("button", { name: "Remember", exact: true }),
    ]) {
      const bounds = await control.boundingBox();
      assert.ok(bounds);
      assert.ok(
        bounds.x >= 0 && bounds.x + bounds.width <= viewports.touch.width,
      );
      assert.ok(
        bounds.y >= 0 && bounds.y + bounds.height <= viewports.touch.height,
      );
    }
    await touch.send("touchStart", [
      touch.point(1, touch.center.x, touch.center.y),
    ]);
    await touch.send("touchMove", [
      touch.point(1, touch.center.x, touch.center.y - 30),
    ]);
    assert.equal(
      /^translate\(0px,\s*0px\)$/.test(
        await mobile
          .locator(".joystick > i")
          .evaluate((element) => element.style.transform),
      ),
      false,
    );
    await touch.send("touchCancel", []);
    await delay(50);
    assert.equal(
      /^translate\(0px,\s*0px\)$/.test(
        await mobile
          .locator(".joystick > i")
          .evaluate((element) => element.style.transform),
      ),
      true,
    );
    const touchResult = await playJourney(mobile, touch, "touch");
    assert.equal(touchResult.save.ageYears, 7);
    journeyEvidence.touch = touchResult.obbyEvidence;
    await mobile.getByRole("button", { name: "Back to your journeys" }).tap();
    assert.equal(await mobile.locator("canvas").count(), 0);
    await touchContext.close();
  }

  const portrait = await browser.newContext({
    viewport: {
      width: viewports.portrait.width,
      height: viewports.portrait.height,
    },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: viewports.portrait.deviceScaleFactor,
  });
  const phone = await portrait.newPage();
  phone.on("pageerror", (error) => errors.push(error.message));
  await phone.goto(url);
  await phone.getByRole("button", { name: "Start a journey" }).waitFor();
  assert.equal(
    await phone.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await phone.screenshot({
    path: "test-results/home-phone.png",
    fullPage: true,
  });
  await portrait.close();

  assert.deepEqual(errors, []);
  const evidence = {
    date: new Date().toISOString(),
    browser: browser.version(),
    bundle,
    viewport: {
      keyboard: viewports.keyboard,
      touch: { ...viewports.touch, cdpTouch: true },
      portrait: viewports.portrait,
    },
    keyboard:
      mode === "touch"
        ? "not run in touch-only mode"
        : "two complete v2 courses and era battles through keyboard/UI controls; deliberate local recoveries, checkpoints, gaps, ferry, equipment, guard, boss gate, all fictional memory reveals, age transitions, save/leave/resume",
    touch:
      mode === "keyboard"
        ? "not run in keyboard-only mode"
        : "Chromium emulation 390x844 at DPR1 with CDP touch; two complete v2 courses and eras through joystick/action buttons, including recoveries, jumps, ferry and pointer cancellation",
    media:
      mode === "touch"
        ? "not run in touch-only mode"
        : "forced same-origin memory fetch failure produced visible scene/photo recovery states; retry restored artwork",
    authority:
      "read-only GET save assertions confirmed local recovery changes no revision, HP, inventory, victories or encounters; boss/reveal do not change age; absorption advances 0→4→7",
    obby: journeyEvidence,
    portrait: "390x844 home has no horizontal overflow",
    pageErrors: errors,
    storage: process.env.QUEST_E2E_STORAGE ?? "fixture memory harness",
    physicalDevices: "not tested",
  };
  const evidenceName =
    mode === "all" ? "journey-evidence.json" : `journey-${mode}-evidence.json`;
  await fs.writeFile(
    `test-results/${evidenceName}`,
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence, null, 2));
} catch (error) {
  if (forcedExitCode === null) {
    if (activePage && !activePage.isClosed()) {
      await activePage
        .screenshot({ path: `test-results/journey-${mode}-failure.png` })
        .catch(() => undefined);
    }
    throw error;
  }
} finally {
  clearTimeout(overallTimer);
  process.off("SIGINT", onInterrupt);
  process.off("SIGTERM", onTerminate);
  cleanupStarted = true;
  await browser.close();
}
if (forcedExitCode !== null) process.exit(forcedExitCode);
