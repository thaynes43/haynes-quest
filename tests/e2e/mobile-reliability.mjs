import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const url = process.env.QUEST_E2E_URL ?? "http://127.0.0.1:4398";
const output =
  process.env.QUEST_E2E_RESULTS_DIR ?? "test-results/mobile-reliability";
await mkdir(output, { recursive: true });
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
const report = {
  url,
  browser: browser.version(),
  viewport: { width: 390, height: 844 },
  errors: [],
  checks: [],
};
try {
  const context = await browser.newContext({
    viewport: report.viewport,
    hasTouch: true,
    isMobile: true,
  });
  await context.addInitScript(() => {
    window.__audioStarts = [];
    window.__soundClicks = 0;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      const result = start.apply(this, args);
      window.__audioStarts.push({
        duration: this.buffer?.duration,
        state: this.context.state,
      });
      return result;
    };
    document.addEventListener(
      "click",
      (event) => {
        if (event.target.closest?.(".sound-test")) window.__soundClicks++;
      },
      true,
    );
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.setDefaultTimeout(20000);
  await page.goto(url);
  const bundleUrl = await page
    .locator('script[type="module"][src]')
    .getAttribute("src");
  assert.ok(bundleUrl, "Missing application module");
  const bundleResponse = await context.request.get(
    new URL(bundleUrl, url).href,
  );
  assert.equal(bundleResponse.status(), 200);
  const bundleBytes = await bundleResponse.body();
  report.client = {
    path: bundleUrl,
    bytes: bundleBytes.length,
    sha256: createHash("sha256").update(bundleBytes).digest("hex"),
  };
  await page
    .getByRole("button", { name: "Play from the beginning", exact: true })
    .tap();
  await page.locator("canvas").waitFor();
  assert.equal(await page.locator(".touch-jump-hint").count(), 0);
  await page.getByRole("button", { name: "How to play", exact: true }).tap();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  const cdp = await context.newCDPSession(page);
  // Swipe the actual overflow panel instead of assigning scrollTop or using a mouse wheel.
  let scrollBefore = await dialog.evaluate((el) => el.scrollTop);
  for (let swipe = 0; swipe < 3; swipe++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ id: 7, x: 295, y: 670 }],
    });
    for (let step = 1; step <= 6; step++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ id: 7, x: 295, y: 670 - step * 60 }],
      });
      await new Promise((resolve) => setTimeout(resolve, 35));
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (
      await page.locator(".sound-test").evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.y > 0 && r.bottom < innerHeight;
      })
    )
      break;
  }
  const scrollAfter = await dialog.evaluate((el) => el.scrollTop);
  assert.ok(
    scrollAfter > scrollBefore,
    `Help did not scroll under touch: ${scrollBefore} → ${scrollAfter}`,
  );
  const sound = page.getByRole("button", {
    name: "Play a test sound",
    exact: true,
  });
  let failedCueRequests = 0;
  await page.route("**/memory-collected/v001/cue.wav", async (route) => {
    if (failedCueRequests === 0) {
      failedCueRequests++;
      await route.fulfill({
        status: 503,
        body: "injected audio delivery failure",
      });
    } else await route.continue();
  });
  await sound.tap();
  await page
    .locator("#sound-test-status")
    .filter({ hasText: "Tap again to retry" })
    .waitFor();
  assert.equal(failedCueRequests, 1);
  assert.equal(await sound.isEnabled(), true);
  report.checks.push({
    check:
      "failed cue delivery produces a visible retry state without disabling the button",
  });
  const before = await page.evaluate(() => ({
    clicks: window.__soundClicks,
    starts: window.__audioStarts.length,
  }));
  await sound.tap();
  await page
    .locator("#sound-test-status")
    .filter({ hasText: "Sound test started" })
    .waitFor();
  const after = await page.evaluate(() => ({
    clicks: window.__soundClicks,
    starts: window.__audioStarts,
  }));
  assert.equal(after.clicks, before.clicks + 1);
  assert.ok(after.starts.length > before.starts);
  assert.ok(after.starts.at(-1).duration > 0);
  assert.equal(await sound.isEnabled(), true);
  report.checks.push({
    check: "scrolled Help accepts real touch and starts a decoded cue",
    scrollBefore,
    scrollAfter,
    before,
    after,
    limitation:
      "AudioBufferSource start is not physical iPhone speaker evidence.",
  });
  await page.screenshot({ path: `${output}/help-sound.png` });
  await sound.tap();
  await page
    .locator("#sound-test-status")
    .filter({ hasText: "Sound test started" })
    .waitFor();
  assert.equal(
    await page.evaluate(() => window.__soundClicks),
    before.clicks + 2,
  );
  report.checks.push({ check: "sound test remains repeatable" });
  await page
    .getByRole("button", { name: "Back to the adventure", exact: true })
    .tap();
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Attack", exact: true }).tap();
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.getByRole("button", { name: "Leave playtest", exact: true }).tap();
  await page
    .getByRole("button", { name: "Try the Besties chapter", exact: true })
    .waitFor();
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failure = String(error);
  process.exitCode = 1;
} finally {
  await writeFile(
    `${output}/report.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
