import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const url = process.env.QUEST_E2E_URL ?? "http://127.0.0.1:4173";
const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const errors = [];
await fs.mkdir("test-results", { recursive: true });
async function start(context) {
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.getByRole("button", { name: "Start a journey" }).click();
  await page.getByRole("button", { name: "Preview memories" }).click();
  await page.getByRole("button", { name: "Begin your journey" }).click();
  await page.locator("canvas").waitFor();
  return page;
}
async function getSave(page) {
  return page.evaluate(async () => {
    const r = await fetch("/api/saves");
    const data = await r.json();
    return data.saves[0];
  });
}
async function approachKeyboard(page, jump = false) {
  const button = page.getByRole("button", { name: "Remember", exact: true });
  await page.keyboard.down("w");
  const started = Date.now();
  let nextJump = 0;
  try {
    while (await button.isDisabled()) {
      if (Date.now() - started > 20000) {
        await page.screenshot({ path: "test-results/keyboard-failure.png" });
        throw new Error("Memory unreachable using keyboard");
      }
      if (jump && Date.now() > nextJump) {
        await page.keyboard.press("Space", { delay: 80 });
        nextJump = Date.now() + 700;
      }
      await page.waitForTimeout(100);
    }
  } finally {
    await page.keyboard.up("w");
  }
  await page.keyboard.press("e", { delay: 80 });
}
try {
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await start(desktop);
  await approachKeyboard(page);
  await page.getByText("1 / 3 memories", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Save & leave" }).click();
  assert.equal(await page.locator("canvas").count(), 0);
  await page.reload();
  await page
    .getByRole("button", { name: /Demo Adventurer.*The first clearing/ })
    .click();
  await page.getByText("1 / 3 memories", { exact: true }).waitFor();
  await approachKeyboard(page);
  await page.getByText("Age 4", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Jump", exact: true }).isDisabled(),
    false,
  );
  await page.screenshot({ path: "test-results/game-growth.png" });
  await approachKeyboard(page, true);
  await page.getByText("3 / 3 memories", { exact: true }).waitFor();
  await page.keyboard.down("w");
  await page
    .getByRole("button", { name: "Complete journey", exact: true })
    .waitFor();
  await page.keyboard.up("w");
  await page.keyboard.press("e", { delay: 80 });
  await page.getByRole("heading", { name: /A little more of you/ }).waitFor();
  assert.equal((await getSave(page)).completed, true);
  await page.screenshot({ path: "test-results/game-complete.png" });
  await page.getByRole("button", { name: "Back to your journeys" }).click();
  assert.equal(await page.locator("canvas").count(), 0);
  await desktop.close();
  const touch = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const mobile = await start(touch);
  const cdp = await touch.newCDPSession(mobile);
  const stick = await mobile.getByTestId("joystick").boundingBox();
  assert.ok(stick);
  const center = {
    x: stick.x + stick.width / 2,
    y: stick.y + stick.height / 2,
  };
  const point = (id, x, y) => ({ id, x, y, radiusX: 5, radiusY: 5, force: 1 });
  const send = (type, points) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
  async function approachTouch(jump = false) {
    const button = mobile.getByRole("button", {
      name: "Remember",
      exact: true,
    });
    await send("touchStart", [point(1, center.x, center.y)]);
    await send("touchMove", [point(1, center.x, center.y - 34)]);
    let sinceJump = 0;
    const started = Date.now();
    try {
      while (await button.isDisabled()) {
        if (Date.now() - started > 22000) {
          await mobile.screenshot({ path: "test-results/touch-failure.png" });
          throw new Error("Memory unreachable using touch");
        }
        if (jump && Date.now() > sinceJump) {
          const b = await mobile
            .getByRole("button", { name: "Jump", exact: true })
            .boundingBox();
          await send("touchStart", [
            point(1, center.x, center.y - 34),
            point(3, b.x + b.width / 2, b.y + b.height / 2),
          ]);
          await mobile.waitForTimeout(100);
          await send("touchEnd", [point(1, center.x, center.y - 34)]);
          sinceJump = Date.now() + 700;
        }
        await mobile.waitForTimeout(100);
      }
    } finally {
      await send("touchEnd", []);
    }
    await button.tap();
  }
  // Exercise real simultaneous stick+camera pointers, then reverse the camera delta.
  await send("touchStart", [point(1, center.x, center.y), point(2, 640, 170)]);
  await send("touchMove", [
    point(1, center.x, center.y - 20),
    point(2, 660, 170),
  ]);
  await mobile.waitForTimeout(150);
  await send("touchMove", [point(1, center.x, center.y), point(2, 640, 170)]);
  await send("touchEnd", []);
  await approachTouch();
  await mobile.getByText("1 / 3 memories", { exact: true }).waitFor();
  await approachTouch();
  await mobile.getByText("Age 4", { exact: true }).waitFor();
  await approachTouch(true);
  await mobile.getByText("3 / 3 memories", { exact: true }).waitFor();
  await send("touchStart", [point(1, center.x, center.y)]);
  await send("touchMove", [point(1, center.x, center.y - 34)]);
  await mobile
    .getByRole("button", { name: "Complete journey", exact: true })
    .waitFor();
  await send("touchEnd", []);
  await mobile
    .getByRole("button", { name: "Complete journey", exact: true })
    .tap();
  await mobile.getByRole("heading", { name: /A little more of you/ }).waitFor();
  assert.equal((await getSave(mobile)).completed, true);
  await mobile.screenshot({ path: "test-results/touch-complete.png" });
  await touch.close();
  const portrait = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const phone = await portrait.newPage();
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
    keyboard:
      "complete route; refresh/resume; growth; jump; finish; canvas disposal",
    touch:
      "Chromium emulation 844x390; simultaneous stick/camera and stick/jump; complete route",
    portrait: "390x844 no horizontal overflow",
    pageErrors: errors,
    storage:
      process.env.QUEST_E2E_STORAGE ??
      "test harness; consult server invocation",
    physicalDevices: "not tested",
  };
  await fs.writeFile(
    "test-results/journey-evidence.json",
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await browser.close();
}
