// Lockstep browser run of the DESIGN-025 vertical demo world (WO107).
//
// The private home's Rat Casino CTA posts a project to the ephemeral editor
// playtest. This script swaps that request for the checked-in
// vertical-v4-demo project and its growth chapter, so the server validates and
// freezes the demo exactly as it would any editor project, and the client
// resolves the server's snapshot. Once the level is ready the page clock
// stops and the harness renders one frame at a time with ordinary keyboard
// input (lockstep-control.mjs): Space to jump, Space again in the air for the
// double jump, W/A/S/D to steer. It climbs the vertical section — high-jump
// ledge, double-jump ledge, bounce pad, sky balcony, lift down, dock — then
// hops the two crumbling platforms to the picnic lawn, taking screenshots
// before, during and after. It also checks the party-themed collectible trail
// and the placed party-kit decor.
//
// Lockstep proves route logic, collisions and the growth-move runtime hook
// under ordinary keyboard input. It is not a frame-time or feel measurement.
//
//   QUEST_E2E_URL        base origin of the candidate build (required)
//   QUEST_E2E_RUN_LABEL  report folder under test-results/vertical-demo
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";

import { inspectGame } from "./authored-browser-driver.mjs";
import { createLockstep, keysToward } from "./lockstep-control.mjs";

const url = process.env.QUEST_E2E_URL;
assert.ok(url, "QUEST_E2E_URL is required; never test a stale implicit server");
const runLabel = process.env.QUEST_E2E_RUN_LABEL ?? "candidate";
const outputDir = new URL(`../../test-results/vertical-demo/${runLabel}/`, import.meta.url);
await fs.mkdir(outputDir, { recursive: true });

const project = JSON.parse(
  await fs.readFile(
    new URL("../../scripts/levels/examples/vertical-v4-demo.project.json", import.meta.url),
    "utf8",
  ),
);
const CHAPTER_ID = "chapter-2";
const chapter = project.chapters.find((entry) => entry.chapterId === CHAPTER_ID);
const ROUTE_ID = chapter.routeId;
const pieces = new Map(chapter.level.pieces.map((piece) => [piece.id, piece]));

const report = {
  runLabel,
  route: ROUTE_ID,
  levelSchemaVersion: chapter.level.schemaVersion,
  steps: [],
  screenshots: [],
  supports: [],
  failures: [],
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
const context = await browser.newContext({
  viewport: { width: 1280, height: 760 },
  deviceScaleFactor: 0.5,
});
const page = await context.newPage();
page.on("pageerror", (error) => report.failures.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") report.failures.push(`console: ${message.text()}`);
});
const lockstep = createLockstep(page, { cruiseFrameMs: 48 });
await lockstep.install();

// Swap the home CTA's playtest request for the demo project.
await page.route("**/api/editor/playtests", async (route) => {
  const request = route.request();
  if (request.method() !== "POST") return route.continue();
  await route.continue({
    postData: JSON.stringify({ project, chapterId: CHAPTER_ID, scope: "chapter" }),
    headers: { ...request.headers(), "content-type": "application/json" },
  });
});

/**
 * Software WebGL sometimes hands the screenshot a frame before it is drawn,
 * which comes back as a flat sky-coloured canvas (a few kilobytes of PNG).
 * Render another frame and retry, keeping the most detailed capture.
 */
async function shot(name) {
  let best = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (lockstep.paused) await lockstep.step();
    const image = await page.screenshot();
    if (!best || image.length > best.length) best = image;
    if (image.length > 60_000) break;
  }
  await fs.writeFile(new URL(`${name}.png`, outputDir), best);
  report.screenshots.push(`${name}.png`);
}

async function state() {
  const inspection = await inspectGame(page);
  assert.ok(inspection, "game inspection unavailable");
  return inspection;
}

function topOf(piece) {
  return piece.center.y + piece.size.y / 2;
}

function sampledTop(inspection, id) {
  const platform = inspection.obby.platforms.find((entry) => entry.id === id);
  return platform.center.y + platform.size.y / 2;
}

function noteSupport(inspection) {
  const support = inspection.obby.supportId;
  if (support && report.supports.at(-1) !== support) report.supports.push(support);
}

/** Holds steering keys toward a point each frame until `done` or the budget ends. */
async function steer(target, done, { frames = 600, jumpAt = [], doubleJump = false, label }) {
  let previousY = null;
  let secondPressed = false;
  let airborne = false;
  for (let frame = 0; frame < frames; frame += 1) {
    const inspection = await state();
    noteSupport(inspection);
    if (await done(inspection)) {
      await lockstep.keys.release();
      report.steps.push({ label, frames: frame, position: inspection.status.position });
      return inspection;
    }
    const position = inspection.status.position;
    await lockstep.keys.hold(keysToward(target.x - position.x, target.z - position.z, 0.05));
    if (jumpAt.includes(frame)) await lockstep.keys.press("Space");
    airborne ||= !inspection.status.grounded;
    if (
      doubleJump &&
      airborne &&
      !secondPressed &&
      previousY !== null &&
      position.y <= previousY
    ) {
      // The first jump's apex: press again for the double jump.
      await lockstep.keys.press("Space");
      secondPressed = true;
    }
    previousY = position.y;
    await lockstep.step();
  }
  await lockstep.keys.release();
  const inspection = await state();
  report.failures.push(`${label} did not finish: ${JSON.stringify(inspection.status.position)} on ${inspection.obby.supportId}`);
  throw new Error(`${label} did not finish`);
}

const onSupport = (id) => (inspection) =>
  inspection.status.grounded && inspection.obby.supportId === id;

try {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const enter = page.getByRole("button", { name: "Enter Rat Casino", exact: true });
  await enter.waitFor({ state: "visible", timeout: 30_000 });
  await enter.click();
  await page.locator("canvas[data-quest-canvas=true]").waitFor({ timeout: 60_000 });
  const deadline = Date.now() + 90_000;
  let opening = null;
  while (Date.now() < deadline) {
    opening = await inspectGame(page).catch(() => null);
    if (
      opening?.level?.authored?.id === ROUTE_ID &&
      opening.status.mediaLoading === 0
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(opening?.level?.authored?.id, ROUTE_ID, "demo route did not load");
  assert.equal(opening.level.authored.schemaVersion, "authored-level-v4");
  report.growthMoves = opening.status.growthMoves ?? null;
  report.appearanceStage = opening.status.appearanceStage;
  report.mediaFailed = opening.status.mediaFailed;
  assert.deepEqual(report.growthMoves, ["jump", "high-jump", "double-jump"]);
  report.collectibles = opening.collectibles?.counts ?? null;
  report.collectibleNames = opening.status.collectibleNames ?? null;
  assert.ok(report.collectibles?.tokenTotal > 20, "the v4 party level planned no trail");
  assert.equal(report.collectibleNames?.tokens, "confetti coins");
  report.tally = await page.locator(".casino-tally").getAttribute("aria-label");
  assert.match(report.tally, /confetti coins/);

  await lockstep.pause();
  await shot("01-before-spawn");

  // 1. Walk to the spawn deck's edge, then the high jump over the catch floor.
  await steer({ x: 0, z: -3.2 }, (s) => s.status.position.z <= -3.15, { label: "walk-to-high-jump" });
  await steer({ x: 0, z: -6.4 }, onSupport("hj-ledge"), { jumpAt: [0], label: "high-jump" });
  // 2. The double jump up to the next ledge.
  await steer({ x: 0, z: -7.4 }, (s) => s.status.position.z <= -7.35, { label: "walk-to-double-jump" });
  await steer({ x: 0, z: -10.8 }, onSupport("dj-ledge"), {
    jumpAt: [0],
    doubleJump: true,
    label: "double-jump",
  });
  await shot("02-double-jump-ledge");
  // 3. Walk onto the bounce pad and steer to the sky balcony.
  const balcony = pieces.get("sky-balcony");
  await steer({ x: 0, z: -13.4 }, (s) => !s.status.grounded && s.status.position.y > topOf(pieces.get("dj-ledge")) + 0.3, {
    label: "onto-bounce-pad",
  });
  await steer({ x: 0, z: -16.2 }, onSupport("sky-balcony"), { label: "bounce-to-balcony" });
  report.balconyFeetY = (await state()).status.position.y;
  assert.ok(Math.abs(report.balconyFeetY - topOf(balcony)) < 0.02);
  await shot("03-sky-balcony");
  // 4. Wait at the balcony edge for the lift's top stop, then board it.
  await steer({ x: 0, z: -18.6 }, (s) => s.status.position.z <= -18.55, { label: "walk-to-lift" });
  const liftReady = await lockstep.until(
    async () => {
      const inspection = await state();
      return Math.abs(sampledTop(inspection, "sky-lift") - topOf(balcony)) < 0.12;
    },
    { timeout: 20_000, frame: 16 },
  );
  assert.ok(liftReady, "the lift never reached the balcony");
  await steer({ x: 0, z: -21 }, onSupport("sky-lift"), { jumpAt: [0], label: "board-lift" });
  await lockstep.advance(1_000);
  await shot("04-riding-lift");
  // 5. Ride down; step off at the bottom stop.
  const bottom = await lockstep.until(
    async () => {
      const inspection = await state();
      noteSupport(inspection);
      return inspection.obby.supportId === "sky-lift" &&
        sampledTop(inspection, "sky-lift") < 0.1
        ? inspection
        : null;
    },
    { timeout: 20_000, frame: 16 },
  );
  assert.ok(bottom, "the lift never carried the rider down");
  await steer({ x: 0, z: -25 }, onSupport("lift-dock"), { jumpAt: [0], label: "leave-lift" });
  // 6. The crumbling detour: hop across before each one drops.
  await steer({ x: 2.2, z: -24 }, (s) => s.status.position.x >= 2.15, { label: "walk-to-crumble" });
  await steer({ x: 4.8, z: -24 }, onSupport("crumble-a"), { jumpAt: [0], label: "onto-crumble-a" });
  await steer({ x: 4.8, z: -27.4 }, onSupport("crumble-b"), { jumpAt: [0], label: "onto-crumble-b" });
  await shot("05-crumbling-detour");
  await steer({ x: 4.2, z: -31.5 }, onSupport("party-picnic"), { jumpAt: [0], label: "crumble-to-picnic" });
  const dropped = await lockstep.until(
    async () => {
      const inspection = await state();
      return inspection.obby.platforms.find((entry) => entry.id === "crumble-b")?.crumble === "down"
        ? inspection
        : null;
    },
    { timeout: 3_000, frame: 16 },
  );
  assert.ok(dropped, "the crumbling platform never dropped behind the player");
  report.crumbleDropped = true;
  await shot("06-after-picnic");
  const final = await state();
  report.final = {
    position: final.status.position,
    support: final.obby.supportId,
    recoveries: final.obby.recoveries,
    collectibles: final.status.collectibles,
  };
  assert.equal(final.obby.recoveries, 0, "the climb needed a recovery");
  report.lockstep = lockstep.summary();
  report.result = "passed";
} catch (error) {
  report.result = "failed";
  report.error = error instanceof Error ? error.message : String(error);
  await shot("failure").catch(() => undefined);
  process.exitCode = 1;
} finally {
  await fs.writeFile(new URL("report.json", outputDir), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
  console.log(JSON.stringify({ result: report.result, error: report.error, supports: report.supports, lockstep: report.lockstep }, null, 2));
}
