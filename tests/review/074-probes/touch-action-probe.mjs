/**
 * WO074 probe: 717cfe6 changed `.game-screen` from `touch-action: none` to
 * `touch-action: auto` (so the Help modal can scroll on WebKit, which
 * intersects touch-action down the tree). The canvas has no touch-action of
 * its own, so browser gestures on the world are no longer suppressed. This
 * script measures what headless Chromium does with a double tap and a pinch
 * on the world, with and without an injected `.game-canvas{touch-action:none}`.
 *
 * Run against an exact 717cfe6 build:
 *   QUEST_E2E_PORT=4402 node_modules/.bin/tsx tests/e2e/serve-fixture.ts &
 *   QUEST_E2E_URL=http://127.0.0.1:4402 node tests/review/074-probes/touch-action-probe.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const url = process.env.QUEST_E2E_URL ?? "http://127.0.0.1:4402";
const output =
  process.env.QUEST_E2E_RESULTS_DIR ?? "test-results/074-touch-action";
await mkdir(output, { recursive: true });
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
const report = { url, browser: browser.version(), runs: [], errors: [] };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function measure(label, inject) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  page.on("pageerror", (error) =>
    report.errors.push(`${label}: ${error.message}`),
  );
  page.setDefaultTimeout(30_000);
  await page.goto(url);
  const bundle = await page.evaluate(
    () =>
      [...document.scripts]
        .map((script) => script.src)
        .find((src) => src.includes("/assets/index-")) ?? null,
  );
  await page
    .getByRole("button", { name: "Play from the beginning", exact: true })
    .tap();
  await page.locator("canvas").waitFor();
  await sleep(1500);
  if (inject) await page.addStyleTag({ content: inject });
  const styles = await page.evaluate(() => {
    const pick = (selector) => {
      const element = document.querySelector(selector);
      return element ? getComputedStyle(element).touchAction : null;
    };
    return {
      gameScreen: pick(".game-screen"),
      gameCanvas: pick(".game-canvas"),
      canvas: pick("canvas"),
      joystick: pick(".joystick"),
      attack: pick(".combat-attack"),
      viewportMeta:
        document.querySelector('meta[name="viewport"]')?.content ?? null,
    };
  });
  const cdp = await context.newCDPSession(page);
  const scale = () => page.evaluate(() => window.visualViewport.scale);
  const run = {
    label,
    bundle,
    styles,
    scaleStart: await scale(),
    doubleTaps: {},
  };
  // Double-tap the world canvas, then the objective banner and the HUD, which
  // are non-canvas surfaces under .game-screen that a world tap also reaches.
  const targets = await page.evaluate(() => {
    const centre = (selector) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      return rect
        ? {
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
            touchAction: getComputedStyle(document.querySelector(selector))
              .touchAction,
          }
        : null;
    };
    return {
      canvas: { x: 195, y: 330 },
      objective: centre(".era-objective"),
      hud: centre(".era-hud"),
    };
  });
  for (const [name, target] of Object.entries(targets)) {
    if (!target) continue;
    try {
      const before = await scale();
      await cdp.send("Input.synthesizeTapGesture", {
        x: target.x,
        y: target.y,
        tapCount: 2,
      });
      await sleep(900);
      const after = await scale();
      const hit = await page.evaluate(
        ({ x, y }) =>
          document.elementFromPoint(x, y)?.className ??
          document.elementFromPoint(x, y)?.tagName ??
          null,
        target,
      );
      run.doubleTaps[name] = {
        ...target,
        hitElement: hit,
        scaleBefore: before,
        scaleAfter: after,
      };
      if (after !== 1) await page.reload().then(() => sleep(500));
    } catch (error) {
      run.doubleTaps[name] = { ...target, error: String(error) };
    }
  }
  // Pinch is reported but inconclusive: Chromium's synthetic pinch ignores touch-action.
  try {
    await cdp.send("Input.synthesizePinchGesture", {
      x: 195,
      y: 330,
      scaleFactor: 2.5,
    });
    await sleep(900);
    run.scaleAfterPinch = await scale();
  } catch (error) {
    run.pinchError = String(error);
  }
  await page.screenshot({ path: `${output}/${label}.png` });
  report.runs.push(run);
  await context.close();
}

try {
  await measure("as-shipped", null);
  await measure("canvas-touch-action-none", ".game-canvas{touch-action:none}");
} catch (error) {
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
