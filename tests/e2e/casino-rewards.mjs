// Browser check for the Rat Casino fun pass (DESIGN-022).
//
// Enters Rat Casino through the private home CTA, then uses ordinary keyboard
// movement and jumps to collect the foyer's token trail and the golden ticket
// at the top of the ticket loft. It then swings at the first mascot while the
// server's reply is held, proving contact sparks play before the reply. It
// checks the HUD counter, the rendered tokens and a 390x844 layout. The full
// course and its closing tally are covered by tests/e2e/rat-casino.mjs.
//
//   QUEST_E2E_URL            base origin of the candidate build (required)
//   QUEST_E2E_RUN_LABEL      report folder under test-results/casino-rewards
//   QUEST_E2E_SOURCE_COMMIT  commit recorded alongside the evidence
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";

import {
  createAuthoredRouteDriver,
  createHybridControls,
  inspectGame,
  waitForInspection,
} from "./authored-browser-driver.mjs";
import {
  findPlatformPath,
  planarDistance,
  platformGateway,
} from "./authored-navigation.mjs";
import { measureLayout } from "./editor-driver.mjs";

const url = process.env.QUEST_E2E_URL;
assert.ok(url, "QUEST_E2E_URL is required; never test a stale implicit server");
const origin = new URL(url).origin;
const runLabel = process.env.QUEST_E2E_RUN_LABEL ?? "candidate";
const outputDirectory = `test-results/casino-rewards/${runLabel}`;
await fs.mkdir(outputDirectory, { recursive: true });

const ROUTE_ID = "rat-casino-v1";
const TICKET_PLATFORMS = [
  "golden-view-balcony",
  "roulette-bypass-step-4",
  "ticket-loft-step-11",
];
const LOFT_TICKET_PLATFORM = "ticket-loft-step-11";

const report = {
  startedAt: new Date().toISOString(),
  status: "running",
  url,
  sourceCommit: process.env.QUEST_E2E_SOURCE_COMMIT ?? null,
  browser: null,
  planned: null,
  trail: null,
  ticket: null,
  contact: null,
  narrow: null,
  screenshots: [],
  pageErrors: [],
  consoleErrors: [],
  responseErrors: [],
  failedRequests: [],
  externalRequests: [],
  limits: [
    "Chromium with software WebGL; physical iPhone/iPad Safari remains a separate gate.",
    "Sound is triggered but not listened to.",
    "The loft climb and contact check step the page clock one 16 ms frame at a time.",
  ],
};

const mark = (stage, details = {}) =>
  console.log(`[casino-rewards] ${stage} ${JSON.stringify(details)}`);

let browser;
let screenshotSequence = 0;
const screenshot = async (target, name) => {
  const path = `${outputDirectory}/${String(++screenshotSequence).padStart(2, "0")}-${name}.png`;
  await target.screenshot({ path, fullPage: false });
  report.screenshots.push(path);
  return path;
};

const watchPage = (target, surface) => {
  target.on("pageerror", (error) =>
    report.pageErrors.push({ surface, message: error.message }),
  );
  target.on("console", (message) => {
    if (message.type() === "error")
      report.consoleErrors.push({ surface, message: message.text() });
  });
  target.on("request", (request) => {
    const parsed = new URL(request.url());
    if (
      ["http:", "https:"].includes(parsed.protocol) &&
      parsed.origin !== origin
    )
      report.externalRequests.push({ surface, url: request.url() });
  });
  target.on("requestfailed", (request) =>
    report.failedRequests.push({
      surface,
      path: new URL(request.url()).pathname,
      error: request.failure()?.errorText ?? "unknown",
    }),
  );
  target.on("response", (response) => {
    if (response.status() >= 400)
      report.responseErrors.push({
        surface,
        path: new URL(response.url()).pathname,
        status: response.status(),
      });
  });
};

// The driver reads the v2 navigation graph; v3 only adds the world theme.
const navigationDocument = (document) => ({
  ...document,
  schemaVersion:
    document.schemaVersion === "authored-level-v3"
      ? "authored-level-v2"
      : document.schemaVersion,
});
const navigationPage = (target) =>
  new Proxy(target, {
    get(value, property) {
      if (property === "evaluate") {
        return async (...args) => {
          const inspected = await value.evaluate(...args);
          if (inspected?.level?.authored?.schemaVersion !== "authored-level-v3")
            return inspected;
          return {
            ...inspected,
            level: {
              ...inspected.level,
              authored: navigationDocument(inspected.level.authored),
            },
          };
        };
      }
      const member = Reflect.get(value, property, value);
      return typeof member === "function" ? member.bind(value) : member;
    },
  });

const enterRatCasino = async (target, { tap = false } = {}) => {
  await target.goto(url, { waitUntil: "domcontentloaded" });
  const cta = target.getByRole("button", {
    name: "Enter Rat Casino",
    exact: true,
  });
  await cta.waitFor({ state: "visible", timeout: 20_000 });
  if (tap) await cta.tap();
  else await cta.click();
  await target
    .locator("canvas[data-quest-canvas=true]")
    .waitFor({ timeout: 30_000 });
  return waitForInspection({
    page: target,
    screenshot: (name) => screenshot(target, name),
    label: "rat-casino-ready",
    timeout: 45_000,
    predicate: (inspection) =>
      inspection.level.authored?.id === ROUTE_ID &&
      inspection.status.mediaLoading === 0 &&
      inspection.status.mediaFailed === 0,
  });
};

try {
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
  const context = await browser.newContext({
    viewport: { width: 1280, height: 760 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  watchPage(page, "desktop");
  const opening = await enterRatCasino(page);

  const planned = opening.collectibles;
  assert.ok(planned, "Rat Casino planned no collectibles");
  assert.deepEqual(
    { tokens: planned.counts.tokens, tickets: planned.counts.tickets },
    { tokens: 0, tickets: 0 },
  );
  assert.ok(planned.counts.tokenTotal >= 100, "too few casino tokens");
  const tickets = planned.items.filter((item) => item.kind === "ticket");
  assert.deepEqual(
    tickets.map((item) => item.platformId).sort(),
    TICKET_PLATFORMS,
  );
  assert.deepEqual(opening.visuals?.collectibles, {
    tokens: planned.counts.tokenTotal,
    visibleTokens: planned.counts.tokenTotal,
    tickets: 3,
    visibleTickets: 3,
  });
  const tally = page.locator(".casino-tally");
  await tally.waitFor({ state: "visible", timeout: 5_000 });
  assert.equal(
    await tally.getAttribute("aria-label"),
    "0 casino tokens, 0 of 3 golden tickets",
  );
  report.planned = {
    tokens: planned.counts.tokenTotal,
    tickets: tickets.map((item) => ({
      id: item.id,
      platformId: item.platformId,
    })),
  };
  await screenshot(page, "casino-token-trail");

  const document = navigationDocument(opening.level.authored);
  const controls = createHybridControls({ page });
  const driver = createAuthoredRouteDriver({
    page: navigationPage(page),
    controls,
    screenshot: (name) => screenshot(page, name),
    mark,
    maxRecoveries: 10,
  });

  // Walk the foyer's trail toward the exit and count what the HUD shows.
  const foyerTrail = planned.items
    .filter(
      (item) =>
        item.kind === "token" &&
        item.role === "trail" &&
        item.platformId === "casino-foyer",
    )
    .sort(
      (left, right) =>
        planarDistance(left.position, opening.status.position) -
        planarDistance(right.position, opening.status.position),
    );
  assert.ok(foyerTrail.length >= 2, "the foyer has no token trail");
  const trailGoal = foyerTrail[1];
  const trailTaken = (inspection) =>
    inspection.collectibles?.items.find((item) => item.id === trailGoal.id)
      ?.collected === true;
  await driver.moveToPoint(() => trailGoal.position, {
    label: "foyer-trail",
    tolerance: 0.3,
    supportId: "casino-foyer",
    done: trailTaken,
  });
  const afterTrail = await waitForInspection({
    page,
    screenshot: (name) => screenshot(page, name),
    label: "foyer-trail-collected",
    predicate: trailTaken,
  });
  const trailCount = afterTrail.collectibles.counts.tokens;
  assert.ok(trailCount >= 2, `walking the trail collected ${trailCount}`);
  await page.waitForFunction(
    (count) =>
      window.document.querySelector(".casino-tally .token-count b")
        ?.textContent === String(count),
    trailCount,
    { timeout: 5_000 },
  );
  // A collected token pops for a moment before it disappears.
  const trailSettled = await waitForInspection({
    page,
    screenshot: (name) => screenshot(page, name),
    label: "foyer-trail-hidden",
    predicate: (inspection) =>
      inspection.visuals?.collectibles?.visibleTokens ===
      planned.counts.tokenTotal - inspection.collectibles.counts.tokens,
  });
  report.trail = {
    collected: trailCount,
    hud: await tally.getAttribute("aria-label"),
    visibleTokens: trailSettled.visuals.collectibles.visibleTokens,
    input: "held keyboard movement",
  };
  mark("trail", report.trail);
  await screenshot(page, "casino-trail-collected");

  await context.close();

  // Part 2 steps the page clock one 60 Hz frame at a time. Software WebGL here
  // renders about five frames a second, too coarse for the loft's 1.1 m steps;
  // stepping keeps the physics identical to a fast device. The keyboard stays
  // the only input, and the server still decides every action.
  const lockContext = await browser.newContext({
    viewport: { width: 1280, height: 760 },
    deviceScaleFactor: 1,
  });
  const lockPage = await lockContext.newPage();
  watchPage(lockPage, "desktop-lockstep");
  await lockPage.clock.install();
  const frameMs = 16;
  const step = (frames = 1) => lockPage.clock.runFor(frameMs * frames);
  const lockOpening = await enterRatCasino(lockPage);
  // Page time flows normally while Rat Casino loads, then stops; from here
  // the script advances it one frame at a time.
  const pageNow = await lockPage.evaluate(() => Date.now());
  await lockPage.clock.pauseAt(pageNow + 2_000);

  const readLite = () =>
    lockPage.evaluate(() => {
      const findHandle = () => {
        let element = window.document.querySelector(
          "canvas[data-quest-canvas=true]",
        );
        let fiber = null;
        while (element && !fiber) {
          const key = Object.keys(element).find((name) =>
            name.startsWith("__reactFiber$"),
          );
          fiber = key ? element[key] : null;
          element = element.parentElement;
        }
        while (fiber) {
          let hook = fiber.memoizedState;
          while (hook) {
            const candidate = hook.memoizedState?.current;
            if (candidate && typeof candidate.inspect === "function")
              return candidate;
            hook = hook.next;
          }
          fiber = fiber.return;
        }
        return null;
      };
      window.__casinoRewardsGame ??= findHandle();
      const inspection = window.__casinoRewardsGame?.inspect();
      if (!inspection?.obby) return null;
      return {
        position: inspection.status.position,
        grounded: inspection.status.grounded,
        phase: inspection.status.phase,
        nearEncounterId: inspection.status.nearEncounterId,
        attackReady: inspection.status.attackReady,
        counts: inspection.collectibles?.counts ?? null,
        collected:
          inspection.collectibles?.items
            .filter((item) => item.collected)
            .map((item) => item.id) ?? [],
        supportId: inspection.obby.supportId,
        recoveries: inspection.obby.recoveries,
        particles: inspection.visuals?.particles ?? 0,
        visibleTickets: inspection.visuals?.collectibles?.visibleTickets,
        hasWand: inspection.level.pickupPositions.some(
          (pickup) => pickup.kind === "attack-tool" && pickup.collected,
        ),
        encounterHp: Object.fromEntries(
          inspection.level.encounterPositions.map((entry) => [
            entry.id,
            entry.hp,
          ]),
        ),
      };
    });
  let heldKeys = [];
  const hold = async (keys) => {
    for (const key of heldKeys)
      if (!keys.includes(key)) await lockPage.keyboard.up(key);
    for (const key of keys)
      if (!heldKeys.includes(key)) await lockPage.keyboard.down(key);
    heldKeys = [...keys];
  };
  const keysToward = (deltaX, deltaZ) => [
    ...(Math.abs(deltaX) > 0.03 ? [deltaX < 0 ? "KeyA" : "KeyD"] : []),
    ...(Math.abs(deltaZ) > 0.03 ? [deltaZ < 0 ? "KeyW" : "KeyS"] : []),
  ];
  const moveTo = async (target, { tolerance = 0.08, done = null } = {}) => {
    for (let frame = 0; frame < 600; frame += 1) {
      const state = await readLite();
      const deltaX = target.x - state.position.x;
      const deltaZ = target.z - state.position.z;
      if (done?.(state) || Math.hypot(deltaX, deltaZ) <= tolerance) {
        await hold([]);
        return state;
      }
      await hold(keysToward(deltaX, deltaZ));
      await step();
    }
    throw new Error(`lockstep move to ${JSON.stringify(target)} timed out`);
  };
  const platformsById = new Map(
    lockOpening.obby.platforms.map((platform) => [platform.id, platform]),
  );
  const jumpEdge = async (edge) => {
    const source = platformsById.get(edge.from);
    const target = platformsById.get(edge.to);
    const takeoff = platformGateway(source, target).from;
    let state = await moveTo(takeoff);
    assert.equal(state.supportId, edge.from, `${edge.from}: slipped off`);
    const recoveries = state.recoveries;
    const aim = target.center;
    await hold(keysToward(aim.x - state.position.x, aim.z - state.position.z));
    await lockPage.keyboard.press("Space");
    for (let frame = 0; frame < 150; frame += 1) {
      await step();
      state = await readLite();
      assert.equal(state.recoveries, recoveries, `${edge.to}: missed jump`);
      if (state.grounded && state.supportId === edge.to && frame > 2) {
        await hold([]);
        return state;
      }
      const deltaX = aim.x - state.position.x;
      const deltaZ = aim.z - state.position.z;
      await hold(
        Math.hypot(deltaX, deltaZ) <= 0.12 ? [] : keysToward(deltaX, deltaZ),
      );
    }
    throw new Error(`${edge.from} -> ${edge.to}: no landing`);
  };

  // Walk into the wand first, as a player would before any fight.
  const wand = lockOpening.level.pickupPositions.find(
    (pickup) => pickup.kind === "attack-tool",
  );
  let lock = await moveTo(wand, {
    tolerance: 0.2,
    done: (state) => state.hasWand,
  });
  for (let frame = 0; frame < 150 && !lock.hasWand; frame += 1) {
    await step();
    lock = await readLite();
  }
  assert.ok(lock.hasWand, "the wand was not collected");

  // Climb the ticket loft with ordinary jumps and take its golden ticket.
  const ticket = tickets.find(
    (item) => item.platformId === LOFT_TICKET_PLATFORM,
  );
  lock = await readLite();
  const climb = findPlatformPath(
    document,
    lock.supportId,
    LOFT_TICKET_PLATFORM,
  );
  for (const edge of climb) {
    lock = await jumpEdge(edge);
    if (edge.to === "ticket-loft-step-9")
      await screenshot(lockPage, "casino-golden-ticket-ahead");
  }
  const tokensBeforeTicket = lock.counts.tokens;
  lock = await moveTo(ticket.position, {
    tolerance: 0.05,
    done: (state) => state.collected.includes(ticket.id),
  });
  assert.ok(lock.collected.includes(ticket.id), "golden ticket not collected");
  assert.equal(lock.counts.tickets, 1);
  assert.ok(lock.particles > 0, "the golden ticket burst no sparkle");
  await screenshot(lockPage, "casino-golden-ticket-burst");
  await step(20);
  lock = await readLite();
  assert.equal(lock.visibleTickets, 2, "the collected ticket still renders");
  await lockPage.waitForFunction(
    () =>
      window.document.querySelectorAll(".casino-tally .ticket-slot.collected")
        .length === 1,
    undefined,
    { timeout: 5_000 },
  );
  assert.ok(tokensBeforeTicket >= 11, "the loft's jump arcs gave few tokens");
  report.ticket = {
    id: ticket.id,
    platformId: ticket.platformId,
    edges: climb.length,
    tokens: lock.counts.tokens,
    hud: await lockPage.locator(".casino-tally").getAttribute("aria-label"),
    recoveries: lock.recoveries,
    input: "held WASD and Space jumps with a lockstep page clock",
  };
  mark("ticket", report.ticket);
  await screenshot(lockPage, "casino-golden-ticket-collected");

  // Carry on down to the first mascot. Its reply is held back so the check can
  // prove that contact plays before the server answers.
  const descent = findPlatformPath(document, lock.supportId, "ticket-counter");
  for (const edge of descent) lock = await jumpEdge(edge);
  const enemy = lockOpening.level.encounterPositions
    .filter((entry) => entry.role === "ordinary")
    .sort(
      (left, right) =>
        planarDistance(left, lock.position) -
        planarDistance(right, lock.position),
    )[0];
  let releaseReply;
  const replyHeld = new Promise((resolve) => {
    releaseReply = resolve;
  });
  let heldAttacks = 0;
  await lockPage.route(/\/api\/saves\/[^/]+\/actions$/, async (route) => {
    if (route.request().postDataJSON()?.action?.type !== "attack")
      return route.continue();
    heldAttacks += 1;
    await replyHeld;
    await route.continue();
  });
  // Stand just south of the mascot so the camera, which faces north, sees
  // the fight; then let it come within reach.
  lock = await moveTo({ x: enemy.x, z: enemy.z + 1.5 }, { tolerance: 0.15 });
  const inReach = (state) =>
    state.nearEncounterId === enemy.id && state.attackReady;
  for (let frame = 0; frame < 240 && !inReach(lock); frame += 1) {
    await step();
    lock = await readLite();
  }
  assert.ok(inReach(lock), "the mascot never came within reach");
  const particlesBefore = lock.particles;
  await lockPage.keyboard.press("KeyF");
  let contactFrame = null;
  for (let frame = 1; frame <= 12 && contactFrame === null; frame += 1) {
    await step();
    lock = await readLite();
    if (lock.particles > particlesBefore) contactFrame = frame;
  }
  assert.ok(contactFrame !== null, "no contact sparks after the swing");
  assert.equal(heldAttacks, 1, "the swing did not reach the server");
  // Let the sparks clear the swing for a few frames; the reply stays held.
  await step(8);
  assert.equal(heldAttacks, 1);
  await screenshot(lockPage, "casino-contact-before-reply");
  releaseReply();
  const hpDrop = await lockPage.waitForResponse(
    (response) =>
      /\/api\/saves\/[^/]+\/actions$/.test(response.url()) &&
      response.request().postDataJSON()?.action?.type === "attack",
    { timeout: 15_000 },
  );
  const confirmed = await hpDrop.json();
  const struck = confirmed.adventure.activeLevel.encounters.find(
    (entry) => entry.id === enemy.id,
  );
  assert.ok(struck.hp < struck.maxHp, "the server did not confirm the hit");
  await lockPage.unroute(/\/api\/saves\/[^/]+\/actions$/);

  // Keep swinging until the mascot is beaten, then catch its confetti.
  let swings = 1;
  for (let frame = 0; frame < 900; frame += 1) {
    lock = await readLite();
    if (lock.encounterHp[enemy.id] === 0) break;
    if (lock.attackReady) {
      await lockPage.keyboard.press("KeyF");
      swings += 1;
    } else if (lock.nearEncounterId !== enemy.id) {
      const current = (
        await inspectGame(lockPage)
      ).level.encounterPositions.find((entry) => entry.id === enemy.id);
      await hold(
        keysToward(current.x - lock.position.x, current.z - lock.position.z),
      );
    } else await hold([]);
    await step();
  }
  await hold([]);
  assert.equal(lock.encounterHp[enemy.id], 0, "the mascot was not defeated");
  const particlesAtDefeat = lock.particles;
  let confetti = 0;
  // About 0.3 s lets the confetti fly clear of the mascot's body.
  for (let frame = 0; frame < 18; frame += 1) {
    await step();
    confetti = Math.max(confetti, (await readLite()).particles);
  }
  assert.ok(confetti > particlesAtDefeat, "defeat released no confetti");
  await screenshot(lockPage, "casino-defeat-confetti");
  report.contact = {
    encounterId: enemy.id,
    contactFrame,
    contactMs: contactFrame * frameMs,
    replyHeldUntilContact: true,
    confirmedHp: `${struck.hp}/${struck.maxHp}`,
    swingsToDefeat: swings,
    confettiParticles: confetti,
  };
  mark("contact", report.contact);
  await lockContext.close();

  const narrowContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
  });
  const narrowPage = await narrowContext.newPage();
  watchPage(narrowPage, "narrow-390x844");
  await enterRatCasino(narrowPage, { tap: true });
  await narrowPage
    .locator(".casino-tally")
    .waitFor({ state: "visible", timeout: 5_000 });
  const layout = await measureLayout(narrowPage);
  assert.ok(layout.horizontalOverflow <= 1, "narrow game overflows");
  const tallyBox = await narrowPage.locator(".casino-tally").boundingBox();
  const hudBox = await narrowPage.locator(".era-hud").boundingBox();
  assert.ok(
    tallyBox &&
      hudBox &&
      tallyBox.x >= hudBox.x &&
      tallyBox.x + tallyBox.width <= hudBox.x + hudBox.width + 0.5,
    "the tally spills out of the HUD panel",
  );
  report.narrow = {
    viewport: { width: 390, height: 844 },
    horizontalOverflow: layout.horizontalOverflow,
    tally: tallyBox,
    hud: hudBox,
    browser: "Chromium mobile emulation",
  };
  await screenshot(narrowPage, "casino-narrow");
  await narrowContext.close();

  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.responseErrors, []);
  assert.deepEqual(report.failedRequests, []);
  assert.deepEqual(report.externalRequests, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : null,
  };
  throw error;
} finally {
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(
    `${outputDirectory}/report.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await browser?.close().catch(() => undefined);
}
