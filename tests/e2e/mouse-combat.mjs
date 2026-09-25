// Browser regression for the desktop mouse / touch scenery split.
// QUEST_E2E_URL must point at a synthetic-fixture build or private playtest.
import assert from "node:assert/strict";
import { chromium } from "playwright";

import { delay, inspectGame } from "./authored-browser-driver.mjs";

const baseUrl = process.env.QUEST_E2E_URL;
assert.ok(baseUrl, "QUEST_E2E_URL is required");

const browser = await chromium.launch({ headless: true });
const pageErrors = [];
const report = { url: baseUrl, browser: browser.version(), desktop: {}, touch: {} };

async function waitFor(page, predicate, label, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  let latest = null;
  while (Date.now() < deadline) {
    latest = await inspectGame(page);
    if (latest && predicate(latest)) return latest;
    await delay(35);
  }
  throw new Error(`${label}: ${JSON.stringify(latest?.status ?? latest)}`);
}

function sequence(inspection) {
  return inspection.status.attackFeedback?.sequence ?? 0;
}

async function enterCasino(page) {
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Enter Rat Casino", exact: true }).click();
  await page.locator("canvas[data-quest-canvas=true]").waitFor();
  return waitFor(
    page,
    (state) => state.status.phase === "exploring" && state.status.mediaLoading === 0,
    "Rat Casino playable",
    45_000,
  );
}

async function canvasCenter(page) {
  const bounds = await page.locator("canvas[data-quest-canvas=true]").boundingBox();
  assert.ok(bounds, "game canvas must be visible");
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

try {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 760 } });
  const desktopPage = await desktop.newPage();
  let state = await enterCasino(desktopPage);
  const point = await canvasCenter(desktopPage);
  const initial = sequence(state);

  await desktopPage.mouse.click(point.x, point.y, { button: "left" });
  state = await waitFor(desktopPage, (next) => sequence(next) > initial, "left mouse attack");
  assert.notEqual(state.status.attackFeedback?.kind, "secondary");
  report.desktop.left = state.status.attackFeedback;

  let before = sequence(state);
  await desktopPage.mouse.move(point.x, point.y);
  await desktopPage.mouse.down({ button: "left" });
  await desktopPage.mouse.move(point.x + 60, point.y + 30, { steps: 4 });
  await desktopPage.mouse.up({ button: "left" });
  await delay(150);
  state = await inspectGame(desktopPage);
  assert.equal(sequence(state), before, "camera drag attacked");
  report.desktop.dragDidNotAttack = true;

  await desktopPage.evaluate(() => {
    window.__questContextMenu = [];
    document.addEventListener("contextmenu", (event) => {
      window.__questContextMenu.push(event.defaultPrevented);
    });
  });
  before = sequence(state);
  await desktopPage.mouse.click(point.x, point.y, { button: "right" });
  state = await waitFor(desktopPage, (next) => sequence(next) > before, "right mouse secondary");
  assert.equal(state.status.attackFeedback?.kind, "secondary");
  assert.deepEqual(await desktopPage.evaluate(() => window.__questContextMenu), [true]);
  report.desktop.right = state.status.attackFeedback;

  before = sequence(state);
  await desktopPage.mouse.move(point.x, point.y);
  await desktopPage.mouse.down({ button: "right" });
  await desktopPage.mouse.move(point.x + 60, point.y + 30, { steps: 4 });
  await desktopPage.mouse.up({ button: "right" });
  await delay(150);
  state = await inspectGame(desktopPage);
  assert.equal(sequence(state), before, "right mouse drag attacked");
  report.desktop.rightDragDidNotAttack = true;

  const boundary = await desktopPage.evaluate(() => {
    const canvas = document.querySelector("canvas[data-quest-canvas=true]");
    for (const ui of document.querySelectorAll("[data-quest-ui]")) {
      const box = ui.getBoundingClientRect();
      if (box.width < 12 || box.height < 12) continue;
      const midX = box.left + box.width / 2;
      const midY = box.top + box.height / 2;
      const pairs = [
        [{ x: midX, y: box.bottom + 3 }, { x: midX, y: box.bottom - 3 }],
        [{ x: midX, y: box.top - 3 }, { x: midX, y: box.top + 3 }],
        [{ x: box.left - 3, y: midY }, { x: box.left + 3, y: midY }],
        [{ x: box.right + 3, y: midY }, { x: box.right - 3, y: midY }],
      ];
      for (const [start, end] of pairs) {
        if (
          document.elementFromPoint(start.x, start.y) === canvas &&
          document.elementFromPoint(end.x, end.y)?.closest("[data-quest-ui]")
        ) return { start, end };
      }
    }
    return null;
  });
  assert.ok(boundary, "a canvas/UI boundary must be testable");
  before = sequence(state);
  await desktopPage.mouse.move(boundary.start.x, boundary.start.y);
  await desktopPage.mouse.down({ button: "left" });
  await desktopPage.mouse.move(boundary.end.x, boundary.end.y);
  await desktopPage.mouse.up({ button: "left" });
  await delay(150);
  state = await inspectGame(desktopPage);
  assert.equal(sequence(state), before, "captured release over UI attacked");
  report.desktop.capturedReleaseOverUiDidNotAttack = true;
  await desktop.close();

  const touch = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const touchPage = await touch.newPage();
  state = await enterCasino(touchPage);
  const touchPoint = await canvasCenter(touchPage);
  before = sequence(state);
  await touchPage.touchscreen.tap(touchPoint.x, touchPoint.y);
  await delay(150);
  state = await inspectGame(touchPage);
  assert.equal(sequence(state), before, "touch scenery tap attacked");
  report.touch.sceneryTapDidNotAttack = true;

  await touchPage.getByRole("button", { name: "Attack", exact: true }).tap();
  state = await waitFor(touchPage, (next) => sequence(next) > before, "touch Attack button");
  report.touch.attackButton = state.status.attackFeedback;
  await touch.close();

  assert.deepEqual(pageErrors, [], "browser page errors");
  report.pageErrors = pageErrors;
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
