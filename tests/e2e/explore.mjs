import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { chromium } from "playwright";
import { createJourneyDriver } from "./journey-lib.mjs";

/**
 * Exploratory button/flow probes beyond the scripted journey. Each probe
 * records observed facts (status, copy, counts) into
 * test-results/explore/report.json together with synthetic-only screenshots.
 * Select groups with QUEST_EXPLORE=home,setup,viewport,game (default all).
 */
const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const url = process.env.QUEST_E2E_URL ?? "http://127.0.0.1:4173";
const groups = (process.env.QUEST_EXPLORE ?? "all").split(",");
const outDir = "test-results/explore";
await fs.mkdir(outDir, { recursive: true });
const indexHtml = await (await fetch(url)).text();
const bundlePath = indexHtml.match(/src="([^"]+\.js)"/)?.[1];
assert.ok(bundlePath, "fixture bundle path missing");
const bundleBytes = Buffer.from(
  await (await fetch(new URL(bundlePath, url))).arrayBuffer(),
);
const report = {
  date: new Date().toISOString(),
  url,
  bundle: {
    path: bundlePath,
    bytes: bundleBytes.byteLength,
    sha256: createHash("sha256").update(bundleBytes).digest("hex"),
  },
  probes: [],
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
report.browser = browser.version();
const errors = [];
const driver = createJourneyDriver({ url, errors });
const desktopViewport = { width: 1024, height: 768 };

function wants(group) {
  return groups.includes("all") || groups.includes(group);
}

const openContexts = new Set();

async function probe(id, group, title, fn) {
  if (!wants(group)) return;
  const started = Date.now();
  const entry = { id, group, title, status: "pass", observed: {} };
  try {
    await fn(entry);
  } catch (error) {
    entry.status = "fail";
    entry.error = error instanceof Error ? error.stack : String(error);
    for (const page of [...openContexts].flatMap((context) => context.pages()))
      await page
        .screenshot({ path: `${outDir}/${id}-failure.png` })
        .catch(() => undefined);
  } finally {
    for (const context of openContexts) await context.close().catch(() => {});
    openContexts.clear();
  }
  entry.ms = Date.now() - started;
  entry.pageErrors = errors.splice(0);
  if (entry.pageErrors.length && entry.status === "pass")
    entry.status = "page-error";
  report.probes.push(entry);
  console.log(
    `[${entry.status}] ${id} — ${title}${entry.error ? `\n${entry.error}` : ""}`,
  );
}

async function newContext(options = {}) {
  const context = await browser.newContext({
    viewport: desktopViewport,
    ...options,
  });
  openContexts.add(context);
  return context;
}

async function newPage(options = {}) {
  const context = await newContext(options);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  return { context, page };
}

const touchContextOptions = (width = 390, height = 844) => ({
  viewport: { width, height },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 1,
});

async function startGame(kind, contextOptions = {}) {
  const context = await newContext(
    kind === "touch"
      ? { ...touchContextOptions(), ...contextOptions }
      : contextOptions,
  );
  const page = await driver.start(context, kind);
  const controls =
    kind === "touch"
      ? await driver.touchControls(page, context)
      : driver.keyboardControls(page);
  return { context, page, controls };
}

async function activeElement(page) {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!element) return "none";
    const name =
      element.getAttribute("aria-label") ??
      element.textContent?.trim().replace(/\s+/g, " ").slice(0, 40);
    return `${element.tagName.toLowerCase()}${element.getAttribute("role") ? `[${element.getAttribute("role")}]` : ""}:${name}`;
  });
}

async function buttonInventory(page) {
  return page.locator("button").evaluateAll((buttons) =>
    buttons.map((button) => ({
      name:
        button.getAttribute("aria-label") ??
        button.textContent?.trim().replace(/\s+/g, " ") ??
        "",
      disabled: button.disabled,
      visible: button.getClientRects().length > 0,
    })),
  );
}

async function gameError(page) {
  const banner = page.locator(".game-error");
  if (!(await banner.count())) return null;
  return (await banner.first().textContent())?.replace(/×$/, "").trim();
}

async function positionOf(page) {
  const inspection = await driver.inspectGame(page);
  assert.ok(inspection, "inspection unavailable");
  return inspection.status.position;
}

async function positionDelta(page, milliseconds) {
  const before = await positionOf(page);
  await delay(milliseconds);
  const after = await positionOf(page);
  return {
    dx: after.x - before.x,
    dy: after.y - before.y,
    dz: after.z - before.z,
  };
}

async function approachUntil(page, controls, target, predicate, label) {
  for (let step = 0; step < 60; step += 1) {
    const inspection = await driver.inspectGame(page);
    assert.ok(inspection, `${label} inspection unavailable`);
    if (await predicate(inspection)) return inspection;
    const deltaX = target.x - inspection.status.position.x;
    const deltaZ = target.z - inspection.status.position.z;
    const direction =
      Math.abs(deltaX) > Math.abs(deltaZ)
        ? deltaX < 0
          ? "left"
          : "right"
        : deltaZ < 0
          ? "forward"
          : "backward";
    await controls.nudge(direction, 200);
  }
  throw new Error(`${label} could not approach ${JSON.stringify(target)}`);
}

async function playChapterOne(page, controls, label) {
  await driver.collectEquipment(
    page,
    controls,
    "attack-tool",
    `${label}-attack-tool`,
  );
  await driver.passFirstSweeperSafely(page, controls, `${label}-sweeper`);
  await driver.collectEquipment(
    page,
    controls,
    "guard-tool",
    `${label}-guard-tool`,
  );
  await driver.fightEncounter(
    page,
    controls,
    "ordinary-a",
    false,
    `${label}-ordinary-a`,
  );
  await driver.fightEncounter(
    page,
    controls,
    "ordinary-b",
    false,
    `${label}-ordinary-b`,
  );
  return driver.fightEncounter(page, controls, "boss", false, `${label}-boss`);
}

async function shot(page, name, options = {}) {
  await page.screenshot({ path: `${outDir}/${name}.png`, ...options });
}

async function overflow(page) {
  return page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth > innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth,
  }));
}

async function saveCount(page) {
  const response = await page.request.get(new URL("/api/saves", url).href);
  assert.equal(response.status(), 200);
  return (await response.json()).saves.length;
}

async function fillSetup(page, { name, birthDate, fromDate, toDate, limit }) {
  if (name !== undefined) await page.getByLabel("Traveler’s name").fill(name);
  if (birthDate !== undefined)
    await page.getByLabel("Birth date").fill(birthDate);
  if (fromDate !== undefined || toDate !== undefined || limit !== undefined) {
    const details = page.locator("details");
    if (!(await details.evaluate((element) => element.open)))
      await page.getByText("Choose a date range").click();
    if (fromDate !== undefined)
      await page.getByLabel("From", { exact: true }).fill(fromDate);
    if (toDate !== undefined)
      await page.getByLabel("Through", { exact: true }).fill(toDate);
    if (limit !== undefined)
      await page.getByLabel("Maximum memories").fill(String(limit));
  }
}

async function inlineError(page) {
  const error = page.locator(".inline-error");
  await error.waitFor({ timeout: 8_000 });
  return (await error.textContent())?.trim();
}

async function openSetup(page) {
  await page.goto(url);
  const startButton = page.getByRole("button", { name: "Start a journey" });
  await startButton.waitFor();
  await page.waitForFunction(
    () => !document.querySelector("button.primary")?.hasAttribute("disabled"),
  );
  await startButton.click();
  await page.getByRole("heading", { name: /Whose memories/ }).waitFor();
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

await probe(
  "home-desktop",
  "home",
  "home loads with badge, CTA and empty state",
  async (entry) => {
    const { context, page } = await newPage();
    await page.goto(url);
    const startButton = page.getByRole("button", { name: "Start a journey" });
    await startButton.waitFor();
    entry.observed.disabledBeforeSession = await startButton.isDisabled();
    await page.waitForFunction(
      () => !document.querySelector("button.primary")?.hasAttribute("disabled"),
    );
    entry.observed.badge = (
      await page.locator(".preview-badge").textContent()
    )?.trim();
    entry.observed.emptyState = (
      await page.locator(".empty-journey h3").textContent()
    )?.trim();
    const studio = page.locator("a.studio-link");
    entry.observed.studioHref = await studio.getAttribute("href");
    const studioResponse = await page.request.get(
      new URL(entry.observed.studioHref, url).href,
    );
    entry.observed.studioStatus = studioResponse.status();
    entry.observed.brandHref = await page
      .locator("a.brand")
      .getAttribute("href");
    entry.observed.overflow = await overflow(page);
    assert.equal(
      entry.observed.badge,
      "Playtest · Two chapters · Fictional memories",
    );
    assert.equal(entry.observed.emptyState, "Your story is waiting.");
    assert.equal(entry.observed.studioStatus, 200);
    assert.equal(entry.observed.overflow.horizontal, false);
    await shot(page, "home-desktop", { fullPage: true });
    await context.close();
  },
);

await probe(
  "home-keyboard-nav",
  "home",
  "keyboard reaches Start a journey and Enter opens setup",
  async (entry) => {
    const { context, page } = await newPage();
    await page.goto(url);
    await page.waitForFunction(
      () => !document.querySelector("button.primary")?.hasAttribute("disabled"),
    );
    const focusPath = [];
    for (let step = 0; step < 12; step += 1) {
      await page.keyboard.press("Tab");
      const active = await page.evaluate(() => {
        const element = document.activeElement;
        return element
          ? `${element.tagName.toLowerCase()}:${element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 30)}`
          : "none";
      });
      focusPath.push(active);
      if (active.startsWith("button:Start a journey")) break;
    }
    entry.observed.focusPath = focusPath;
    assert.ok(focusPath.at(-1)?.startsWith("button:Start a journey"));
    await page.keyboard.press("Enter");
    await page.getByRole("heading", { name: /Whose memories/ }).waitFor();
    entry.observed.setupFocus = await page.evaluate(() =>
      document.activeElement
        ? `${document.activeElement.tagName.toLowerCase()}:${document.activeElement.textContent?.trim().slice(0, 30)}`
        : "none",
    );
    await page.keyboard.press("Tab");
    const firstTab = await page.evaluate(() =>
      document.activeElement
        ? `${document.activeElement.tagName.toLowerCase()}:${document.activeElement.textContent?.trim().slice(0, 30) || document.activeElement.getAttribute("type")}`
        : "none",
    );
    entry.observed.setupFirstTab = firstTab;
    await context.close();
  },
);

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

await probe(
  "setup-back",
  "setup",
  "back link returns home without a request",
  async (entry) => {
    const { context, page } = await newPage();
    await openSetup(page);
    await page.getByRole("button", { name: "← Your journeys" }).click();
    await page.getByRole("button", { name: "Start a journey" }).waitFor();
    entry.observed.saves = await saveCount(page);
    assert.equal(entry.observed.saves, 0);
    await context.close();
  },
);

await probe(
  "setup-empty-name",
  "setup",
  "empty name is blocked by native validation",
  async (entry) => {
    const { context, page } = await newPage();
    await openSetup(page);
    await fillSetup(page, { name: "" });
    let requests = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/setup/preview")) requests += 1;
    });
    await page.getByRole("button", { name: "Preview memories" }).click();
    await delay(400);
    entry.observed.validationMessage = await page
      .getByLabel("Traveler’s name")
      .evaluate((element) => element.validationMessage);
    entry.observed.previewRequests = requests;
    assert.equal(requests, 0);
    assert.ok(entry.observed.validationMessage);
    await context.close();
  },
);

await probe(
  "setup-whitespace-name",
  "setup",
  "whitespace-only name",
  async (entry) => {
    const { context, page } = await newPage();
    await openSetup(page);
    await fillSetup(page, { name: "   " });
    await page.getByRole("button", { name: "Preview memories" }).click();
    entry.observed.error = await inlineError(page).catch(() => null);
    entry.observed.validationMessage = await page
      .getByLabel("Traveler’s name")
      .evaluate((element) => element.validationMessage);
    await shot(page, "setup-whitespace-name");
    await context.close();
  },
);

await probe(
  "setup-unknown-name",
  "setup",
  "unknown traveler shows a friendly message",
  async (entry) => {
    const { context, page } = await newPage();
    await openSetup(page);
    await fillSetup(page, { name: "Nobody Here" });
    await page.getByRole("button", { name: "Preview memories" }).click();
    entry.observed.error = await inlineError(page);
    assert.equal(
      entry.observed.error,
      "We couldn’t find that journey. Try Demo Adventurer in this preview.",
    );
    await shot(page, "setup-unknown-name");
    await context.close();
  },
);

await probe(
  "setup-case-name",
  "setup",
  "lower-case name still resolves",
  async (entry) => {
    const { context, page } = await newPage();
    await openSetup(page);
    await fillSetup(page, { name: "demo adventurer" });
    await page.getByRole("button", { name: "Preview memories" }).click();
    await page.locator(".memory-choice").first().waitFor();
    entry.observed.candidates = await page.locator(".memory-choice").count();
    entry.observed.selected = (
      await page.locator(".selection-top span").textContent()
    )?.trim();
    entry.observed.coverage = (
      await page.locator(".coverage").textContent()
    )?.trim();
    assert.equal(entry.observed.candidates, 3);
    assert.equal(entry.observed.selected, "3 selected");
    await context.close();
  },
);

await probe(
  "setup-bad-birthdate",
  "setup",
  "wrong fixture birth date",
  async (entry) => {
    const { context, page } = await newPage();
    await openSetup(page);
    await fillSetup(page, { birthDate: "2019-06-01" });
    await page.getByRole("button", { name: "Preview memories" }).click();
    entry.observed.error = await inlineError(page);
    assert.equal(
      entry.observed.error,
      "Demo Adventurer’s fictional birth date is January 1, 2020.",
    );
    await context.close();
  },
);

await probe(
  "setup-future-birthdate",
  "setup",
  "birth date after every memory",
  async (entry) => {
    const { context, page } = await newPage();
    await openSetup(page);
    await fillSetup(page, { birthDate: "2031-01-01" });
    await page.getByRole("button", { name: "Preview memories" }).click();
    entry.observed.error = await inlineError(page);
    await context.close();
  },
);

await probe(
  "setup-empty-range",
  "setup",
  "date range with no memories",
  async (entry) => {
    const { context, page } = await newPage();
    await openSetup(page);
    await fillSetup(page, { fromDate: "2030-01-01" });
    await page.getByRole("button", { name: "Preview memories" }).click();
    entry.observed.error = await inlineError(page);
    assert.equal(
      entry.observed.error,
      "No memories fall within those dates. Try a wider date range.",
    );
    await context.close();
  },
);

await probe(
  "setup-inverted-range",
  "setup",
  "from after through",
  async (entry) => {
    const { context, page } = await newPage();
    await openSetup(page);
    await fillSetup(page, { fromDate: "2025-01-01", toDate: "2021-01-01" });
    await page.getByRole("button", { name: "Preview memories" }).click();
    entry.observed.error = await inlineError(page);
    await shot(page, "setup-inverted-range");
    await context.close();
  },
);

await probe(
  "setup-narrow-range",
  "setup",
  "range keeps only the middle memory",
  async (entry) => {
    const { context, page } = await newPage();
    await openSetup(page);
    await fillSetup(page, { fromDate: "2023-01-01", toDate: "2025-01-01" });
    await page.getByRole("button", { name: "Preview memories" }).click();
    await page.locator(".memory-choice").first().waitFor();
    entry.observed.candidates = await page.locator(".memory-choice").count();
    entry.observed.labels = await page
      .locator(".memory-choice strong")
      .allTextContents();
    entry.observed.coverage = (
      await page.locator(".coverage").textContent()
    )?.trim();
    const before = await saveCount(page);
    await page.getByRole("button", { name: "Begin your journey" }).click();
    const outcome = await Promise.race([
      page
        .locator("canvas")
        .waitFor({ timeout: 15_000 })
        .then(() => "game"),
      inlineError(page).then((text) => `error:${text}`),
    ]);
    entry.observed.beginOutcome = outcome;
    entry.observed.savesCreated = (await saveCount(page)) - before;
    if (outcome === "game") {
      const save = await driver.getSave(page);
      entry.observed.save = {
        ageYears: save.ageYears,
        eraYear: save.adventure.activeLevel.eraYear,
        totalLevels: save.adventure.activeLevel.totalLevels,
        memoryCount: save.memories.length,
      };
      await shot(page, "setup-narrow-range-game");
    } else await shot(page, "setup-narrow-range-error");
    await context.close();
  },
);

await probe(
  "setup-limit-bounds",
  "setup",
  "limit 0, 25 and blank are blocked natively",
  async (entry) => {
    const { context, page } = await newPage();
    await openSetup(page);
    const results = {};
    for (const limit of ["0", "25", ""]) {
      await fillSetup(page, { limit });
      let requests = 0;
      const onRequest = (request) => {
        if (request.url().includes("/api/setup/preview")) requests += 1;
      };
      page.on("request", onRequest);
      await page.getByRole("button", { name: "Preview memories" }).click();
      await delay(350);
      page.off("request", onRequest);
      results[limit === "" ? "blank" : limit] = {
        requests,
        validationMessage: await page
          .getByLabel("Maximum memories")
          .evaluate((element) => element.validationMessage),
      };
    }
    entry.observed.results = results;
    for (const result of Object.values(results)) {
      assert.equal(result.requests, 0);
      assert.ok(result.validationMessage);
    }
    await context.close();
  },
);

await probe(
  "setup-limit-one",
  "setup",
  "limit 1 selects the earliest memory; begin outcome",
  async (entry) => {
    const { context, page } = await newPage();
    await openSetup(page);
    await fillSetup(page, { limit: "1" });
    await page.getByRole("button", { name: "Preview memories" }).click();
    await page.locator(".memory-choice").first().waitFor();
    entry.observed.candidates = await page.locator(".memory-choice").count();
    entry.observed.selected = (
      await page.locator(".selection-top span").textContent()
    )?.trim();
    entry.observed.checked = await page
      .locator(".memory-choice input")
      .evaluateAll((inputs) => inputs.map((input) => input.checked));
    const before = await saveCount(page);
    await page.getByRole("button", { name: "Begin your journey" }).click();
    const outcome = await Promise.race([
      page
        .locator("canvas")
        .waitFor({ timeout: 15_000 })
        .then(() => "game"),
      inlineError(page).then((text) => `error:${text}`),
    ]);
    entry.observed.beginOutcome = outcome;
    entry.observed.savesCreated = (await saveCount(page)) - before;
    if (outcome === "game") {
      const save = await driver.getSave(page);
      entry.observed.save = {
        ageYears: save.ageYears,
        eraYear: save.adventure.activeLevel.eraYear,
        totalLevels: save.adventure.activeLevel.totalLevels,
        memoryCount: save.memories.length,
      };
    }
    await shot(page, "setup-limit-one-outcome");
    await context.close();
  },
);

await probe(
  "setup-only-last-memory",
  "setup",
  "keeping only the age-7 memory",
  async (entry) => {
    const { context, page } = await newPage();
    await openSetup(page);
    await page.getByRole("button", { name: "Preview memories" }).click();
    await page.locator(".memory-choice").first().waitFor();
    await page.locator(".memory-choice").nth(0).click();
    await page.locator(".memory-choice").nth(1).click();
    entry.observed.selected = (
      await page.locator(".selection-top span").textContent()
    )?.trim();
    const before = await saveCount(page);
    await page.getByRole("button", { name: "Begin your journey" }).click();
    const outcome = await Promise.race([
      page
        .locator("canvas")
        .waitFor({ timeout: 15_000 })
        .then(() => "game"),
      inlineError(page).then((text) => `error:${text}`),
    ]);
    entry.observed.beginOutcome = outcome;
    entry.observed.savesCreated = (await saveCount(page)) - before;
    if (outcome === "game") {
      const save = await driver.getSave(page);
      entry.observed.save = {
        ageYears: save.ageYears,
        eraYear: save.adventure.activeLevel.eraYear,
        periodId: save.adventure.activeLevel.periodId,
        targetAgeYears: save.adventure.activeLevel.targetAgeYears,
        totalLevels: save.adventure.activeLevel.totalLevels,
        memoryCount: save.memories.length,
      };
    }
    await shot(page, "setup-only-last-memory");
    await context.close();
  },
);

await probe(
  "setup-deselect-all",
  "setup",
  "deselecting every memory disables begin",
  async (entry) => {
    const { context, page } = await newPage();
    await openSetup(page);
    await page.getByRole("button", { name: "Preview memories" }).click();
    await page.locator(".memory-choice").first().waitFor();
    for (let index = 0; index < 3; index += 1)
      await page.locator(".memory-choice").nth(index).click();
    entry.observed.selected = (
      await page.locator(".selection-top span").textContent()
    )?.trim();
    entry.observed.beginDisabled = await page
      .getByRole("button", { name: "Begin your journey" })
      .isDisabled();
    assert.equal(entry.observed.selected, "0 selected");
    assert.equal(entry.observed.beginDisabled, true);
    await page.locator(".memory-choice").nth(1).click();
    entry.observed.reselected = (
      await page.locator(".selection-top span").textContent()
    )?.trim();
    entry.observed.beginEnabledAfterReselect = await page
      .getByRole("button", { name: "Begin your journey" })
      .isEnabled();
    await context.close();
  },
);

await probe(
  "setup-change-resets-preview",
  "setup",
  "editing the form after a preview clears it",
  async (entry) => {
    const { context, page } = await newPage();
    await openSetup(page);
    await page.getByRole("button", { name: "Preview memories" }).click();
    await page.locator(".memory-choice").first().waitFor();
    await page.getByLabel("Traveler’s name").fill("Demo Adventurer!");
    entry.observed.previewCleared =
      (await page.locator(".memory-choice").count()) === 0;
    entry.observed.emptyHeading = (
      await page.locator(".selection-empty h2").textContent()
    )
      ?.replace(/\s+/g, " ")
      .trim();
    assert.equal(entry.observed.previewCleared, true);
    await context.close();
  },
);

await probe(
  "setup-preview-twice",
  "setup",
  "repeated preview taps keep one grid and a working begin",
  async (entry) => {
    const { context, page } = await newPage();
    await openSetup(page);
    const preview = page.getByRole("button", { name: "Preview memories" });
    let requests = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/setup/preview")) requests += 1;
    });
    // Two taps in separate tasks, the fastest a person can produce.
    await preview.evaluate((button) => {
      button.click();
      setTimeout(() => button.click(), 0);
    });
    await page.locator(".memory-choice").first().waitFor();
    await delay(400);
    entry.observed.previewRequestsAfterRapidDoubleTap = requests;
    entry.observed.candidates = await page.locator(".memory-choice").count();
    await preview.click();
    await page.locator(".memory-choice").first().waitFor();
    await delay(300);
    entry.observed.previewRequestsAfterSecondPreview = requests;
    const before = await saveCount(page);
    await page.getByRole("button", { name: "Begin your journey" }).click();
    await page.locator("canvas").waitFor({ timeout: 15_000 });
    entry.observed.savesCreated = (await saveCount(page)) - before;
    assert.equal(entry.observed.previewRequestsAfterRapidDoubleTap, 1);
    assert.equal(entry.observed.candidates, 3);
    assert.equal(entry.observed.savesCreated, 1);
    await context.close();
  },
);

await probe(
  "setup-double-begin",
  "setup",
  "a rapid double tap on begin creates one journey",
  async (entry) => {
    const { context, page } = await newPage();
    await openSetup(page);
    await page.getByRole("button", { name: "Preview memories" }).click();
    await page.locator(".memory-choice").first().waitFor();
    const before = await saveCount(page);
    let requests = 0;
    page.on("request", (request) => {
      if (request.url().endsWith("/api/saves") && request.method() === "POST")
        requests += 1;
    });
    await page
      .getByRole("button", { name: "Begin your journey" })
      .evaluate((button) => {
        button.click();
        setTimeout(() => button.click(), 0);
      });
    await page.locator("canvas").waitFor({ timeout: 15_000 });
    await delay(500);
    entry.observed.postRequests = requests;
    entry.observed.savesCreated = (await saveCount(page)) - before;
    assert.equal(entry.observed.postRequests, 1);
    assert.equal(entry.observed.savesCreated, 1);
    await context.close();
  },
);

// ---------------------------------------------------------------------------
// Viewports (home and setup only; the game screens are covered in "game")
// ---------------------------------------------------------------------------

const viewports = [
  { name: "320x568", width: 320, height: 568, mobile: true },
  { name: "375x667", width: 375, height: 667, mobile: true },
  { name: "390x844", width: 390, height: 844, mobile: true },
  { name: "844x390", width: 844, height: 390, mobile: true },
  { name: "768x1024", width: 768, height: 1024, mobile: true },
  { name: "1024x768", width: 1024, height: 768, mobile: false },
  { name: "1366x768", width: 1366, height: 768, mobile: false },
];

await probe(
  "viewport-home-setup",
  "viewport",
  "home and setup fit every viewport without horizontal overflow",
  async (entry) => {
    entry.observed.viewports = {};
    for (const viewport of viewports) {
      const { context, page } = await newPage({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.mobile,
        hasTouch: viewport.mobile,
      });
      await page.goto(url);
      const startButton = page.getByRole("button", { name: "Start a journey" });
      await startButton.waitFor();
      const home = await overflow(page);
      const startBox = await startButton.boundingBox();
      await shot(page, `home-${viewport.name}`, { fullPage: true });
      await page.waitForFunction(
        () =>
          !document.querySelector("button.primary")?.hasAttribute("disabled"),
      );
      await startButton.click();
      await page.getByRole("heading", { name: /Whose memories/ }).waitFor();
      const setup = await overflow(page);
      await page.getByRole("button", { name: "Preview memories" }).click();
      await page.locator(".memory-choice").first().waitFor();
      const preview = await overflow(page);
      await shot(page, `setup-preview-${viewport.name}`, { fullPage: true });
      entry.observed.viewports[viewport.name] = {
        homeOverflow: home.horizontal,
        startWithinViewport:
          startBox !== null &&
          startBox.x >= 0 &&
          startBox.x + startBox.width <= viewport.width,
        setupOverflow: setup.horizontal,
        previewOverflow: preview.horizontal,
      };
      await context.close();
    }
    for (const [name, result] of Object.entries(entry.observed.viewports)) {
      assert.equal(result.homeOverflow, false, `${name} home overflows`);
      assert.equal(result.setupOverflow, false, `${name} setup overflows`);
      assert.equal(result.previewOverflow, false, `${name} preview overflows`);
      assert.equal(result.startWithinViewport, true, `${name} CTA clipped`);
    }
  },
);

// ---------------------------------------------------------------------------
// Game: desktop shell, modals, input, touch, held buttons, victory and fallen
// ---------------------------------------------------------------------------

await probe(
  "game-desktop-shell",
  "game",
  "desktop shell: names, HUD copy, help/album/sound, save-leave, reload",
  async (entry) => {
    const { page } = await startGame("keyboard");
    entry.observed.focusAfterStart = await activeElement(page);
    const buttons = await buttonInventory(page);
    entry.observed.buttons = buttons;
    assert.ok(
      buttons.every((button) => button.name.length > 0),
      "unnamed button",
    );
    const leave = page.getByRole("button", { name: "Save & leave" });
    entry.observed.leaveTextVisible = await leave.locator("span").isVisible();
    entry.observed.objective = (
      await page.locator(".era-objective p").textContent()
    )?.trim();
    entry.observed.chapter = (
      await page.locator(".era-objective small").textContent()
    )
      ?.replace(/\s+/g, " ")
      .trim();
    entry.observed.chapterPill = (
      await page.locator(".chapter-pill").textContent()
    )
      ?.replace(/\s+/g, " ")
      .trim();
    entry.observed.age = (await page.locator(".age-line").textContent())
      ?.replace(/\s+/g, " ")
      .trim();
    entry.observed.health = await page
      .locator(".health-line meter")
      .evaluate((meter) => ({
        label: meter.getAttribute("aria-label"),
        value: meter.value,
        max: meter.max,
      }));
    entry.observed.equipment = (
      await page.locator(".equipment-line").textContent()
    )
      ?.replace(/\s+/g, " ")
      .trim();
    entry.observed.keyboardHint = (
      await page.locator(".keyboard-hint").textContent()
    )
      ?.replace(/\s+/g, " ")
      .trim();
    entry.observed.placeholder = (
      await page.locator(".placeholder-label").textContent()
    )?.trim();
    await shot(page, "game-desktop-start");

    // Help modal: focus, pause, Escape, close button, tab trap, back button.
    const help = page.getByRole("button", { name: "How to play" });
    await help.click();
    const dialog = page.getByRole("dialog", {
      name: "Explore. Prepare. Face the era.",
    });
    await dialog.waitFor();
    entry.observed.helpFocus = await activeElement(page);
    await page.keyboard.down("w");
    const heldDelta = await positionDelta(page, 400);
    await page.keyboard.up("w");
    entry.observed.movementWhileHelpOpen = heldDelta;
    assert.ok(Math.abs(heldDelta.dz) < 0.001, "moved behind the help modal");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    entry.observed.focusAfterEscape = await activeElement(page);
    await help.click();
    await dialog.waitFor();
    await dialog.getByRole("button", { name: "Close" }).click();
    await dialog.waitFor({ state: "detached" });
    await help.click();
    await dialog.waitFor();
    const tabStops = [];
    for (let index = 0; index < 8; index += 1) {
      await page.keyboard.press("Tab");
      tabStops.push(await activeElement(page));
    }
    entry.observed.helpTabStops = tabStops;
    entry.observed.tabStaysInDialog = await page.evaluate(() =>
      Boolean(document.activeElement?.closest("[role=dialog]")),
    );
    assert.equal(entry.observed.tabStaysInDialog, true);
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Shift+Tab");
    entry.observed.shiftTabWraps = await page.evaluate(() =>
      Boolean(document.activeElement?.closest("[role=dialog]")),
    );
    const slider = dialog.getByLabel("Sound volume");
    entry.observed.volumeDefault = await slider.inputValue();
    await slider.focus();
    for (let index = 0; index < 5; index += 1)
      await page.keyboard.press("ArrowLeft");
    entry.observed.volumeAfterFiveLeft = await slider.inputValue();
    await dialog.getByRole("button", { name: "Back to the adventure" }).click();
    await dialog.waitFor({ state: "detached" });
    entry.observed.focusAfterBack = await activeElement(page);

    // Album before any memory.
    await page.getByRole("button", { name: "Open your memories" }).click();
    const album = page.getByRole("dialog", { name: "Your remembered world." });
    await album.waitFor();
    entry.observed.albumEyebrow = (
      await album.locator(".eyebrow").textContent()
    )?.trim();
    entry.observed.albumEmpty = (
      await album.locator("p").last().textContent()
    )?.trim();
    await page.keyboard.press("Escape");
    await album.waitFor({ state: "detached" });

    // Sound toggle labels.
    const sound = page.locator(".game-tools button").first();
    entry.observed.soundLabels = [await sound.getAttribute("aria-label")];
    await sound.click();
    entry.observed.soundLabels.push(await sound.getAttribute("aria-label"));
    await sound.click();
    entry.observed.soundLabels.push(await sound.getAttribute("aria-label"));
    assert.deepEqual(entry.observed.soundLabels, [
      "Enable sound",
      "Mute sound",
      "Enable sound",
    ]);

    // Save & leave, resume, reload, resume.
    const before = await driver.getSave(page);
    await leave.click();
    await page.locator("canvas").waitFor({ state: "detached" });
    const card = page.locator(".save-card").first();
    entry.observed.card = (await card.textContent())
      ?.replace(/\s+/g, " ")
      .trim();
    await card.click();
    await page.locator("canvas").waitFor();
    const resumed = await driver.getSave(page);
    assert.equal(resumed.id, before.id);
    await page.reload();
    await page.locator(".save-card").first().waitFor();
    entry.observed.pageAfterReload = "home";
    await page.locator(".save-card").first().click();
    await page.locator("canvas").waitFor();
    entry.observed.positionAfterReload = await positionOf(page);
    entry.observed.gameError = await gameError(page);
  },
);

await probe(
  "game-desktop-input",
  "game",
  "keyboard movement, blocked jump, weaponless keys, blur and hidden-tab clearing",
  async (entry) => {
    const { page, controls } = await startGame("keyboard");
    // Models and shaders load after the canvas appears and can stall the
    // software renderer for whole seconds, so hold each key until the
    // traveler has clearly moved instead of trusting a fixed window.
    const moves = {};
    for (const [key, axis, sign] of [
      ["w", "z", -1],
      ["s", "z", 1],
      ["a", "x", -1],
      ["d", "x", 1],
      ["ArrowUp", "z", -1],
      ["ArrowLeft", "x", -1],
    ]) {
      const before = await positionOf(page);
      await page.keyboard.down(key);
      const startedAt = Date.now();
      let delta = 0;
      while (Date.now() - startedAt < 4_000) {
        delta = (await positionOf(page))[axis] - before[axis];
        if (delta * sign >= 0.1) break;
        await delay(60);
      }
      await page.keyboard.up(key);
      moves[key] = {
        [`d${axis}`]: Number(delta.toFixed(3)),
        ms: Date.now() - startedAt,
      };
      assert.ok(
        delta * sign >= 0.1,
        `${key} did not move the traveler: ${JSON.stringify(moves)}`,
      );
    }
    entry.observed.moves = moves;
    let maxY = 0;
    await page.keyboard.down("Space");
    for (let index = 0; index < 8; index += 1) {
      maxY = Math.max(maxY, (await positionOf(page)).y);
      await delay(50);
    }
    await page.keyboard.up("Space");
    entry.observed.maxYWithSpaceAtAgeZero = maxY;
    assert.ok(maxY < 0.01, "jumped before the jump ability");
    await controls.attack();
    await delay(400);
    entry.observed.errorAfterWeaponlessAttack = await gameError(page);
    await controls.guard();
    await delay(400);
    entry.observed.errorAfterShieldlessGuard = await gameError(page);
    await controls.use();
    await delay(400);
    entry.observed.errorAfterIdleUse = await gameError(page);
    const requestState = (await driver.inspectGame(page))?.status;
    entry.observed.requestState = {
      state: requestState?.requestState,
      code: requestState?.requestErrorCode,
    };
    // Window blur while a key is held must stop movement.
    await page.keyboard.down("w");
    await delay(250);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await delay(150);
    entry.observed.afterBlur = await positionDelta(page, 400);
    await page.keyboard.up("w");
    assert.ok(
      Math.abs(entry.observed.afterBlur.dz) < 0.001,
      "kept moving after blur",
    );
    // Labelled DOM fault injection: pretend the tab is hidden; the course
    // clock must freeze, then run again once the tab is visible.
    const courseBefore = (await driver.inspectGame(page)).obby.timeSeconds;
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await delay(700);
    const courseHidden = (await driver.inspectGame(page)).obby.timeSeconds;
    await page.evaluate(() => {
      delete document.visibilityState;
      delete document.hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const resumedAt = Date.now();
    let courseVisible = courseHidden;
    while (
      Date.now() - resumedAt < 4_000 &&
      courseVisible - courseHidden < 0.05
    ) {
      await delay(80);
      courseVisible = (await driver.inspectGame(page)).obby.timeSeconds;
    }
    entry.observed.hiddenTab = {
      advanceWhileHidden: courseHidden - courseBefore,
      advanceAfterReturn: courseVisible - courseHidden,
      injected: "document.visibilityState getter override",
    };
    assert.ok(
      entry.observed.hiddenTab.advanceWhileHidden < 0.06,
      "course advanced while hidden",
    );
    assert.ok(
      entry.observed.hiddenTab.advanceAfterReturn >= 0.05,
      "course did not resume",
    );
    // Mouse camera drag on the right half of the canvas.
    const canvas = await page.locator("canvas").boundingBox();
    await page.mouse.move(
      canvas.x + canvas.width * 0.75,
      canvas.y + canvas.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      canvas.x + canvas.width * 0.55,
      canvas.y + canvas.height / 2,
      { steps: 8 },
    );
    await page.mouse.up();
    await delay(200);
    entry.observed.errorAfterCameraDrag = await gameError(page);
    await shot(page, "game-desktop-input");
  },
);

await probe(
  "game-touch-controls",
  "game",
  "touch: disabled states, joystick, second finger, taps while another finger rests",
  async (entry) => {
    const { page, controls } = await startGame("touch");
    const names = ["Jump", "Attack", "Guard", "Remember"];
    entry.observed.disabledAtStart = Object.fromEntries(
      await Promise.all(
        names.map(async (name) => [
          name,
          await page.getByRole("button", { name, exact: true }).isDisabled(),
        ]),
      ),
    );
    assert.deepEqual(entry.observed.disabledAtStart, {
      Jump: true,
      Attack: true,
      Guard: true,
      Remember: true,
    });
    const { send, point, center } = controls;
    const centerOf = async (locator) => {
      const box = await locator.boundingBox();
      assert.ok(box, "control has no box");
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    const tapWhileHeld = async (held, id, locator) => {
      const target = await centerOf(locator);
      const contact = point(id, target.x, target.y);
      await send("touchStart", [held, contact]);
      await delay(60);
      await send("touchEnd", [contact]);
    };
    const stickHeld = point(1, center.x, center.y - 30);
    await send("touchStart", [point(1, center.x, center.y)]);
    await send("touchMove", [stickHeld]);
    await delay(250);
    const single = await driver.inspectGame(page);
    entry.observed.singleFinger = {
      moveY: single.input.moveY,
      knob: await page
        .locator(".joystick > i")
        .evaluate((element) => element.style.transform),
    };
    assert.ok(single.input.moveY > 0.5);
    const second = point(2, center.x + 12, center.y + 12);
    await send("touchStart", [stickHeld, second]);
    await delay(250);
    const twoFingers = await driver.inspectGame(page);
    entry.observed.secondFingerOnStick = {
      moveY: twoFingers.input.moveY,
      moveX: twoFingers.input.moveX,
    };
    assert.ok(
      twoFingers.input.moveY > 0.5 && Math.abs(twoFingers.input.moveX) < 0.05,
      "second finger hijacked the stick",
    );
    await send("touchEnd", [second]);
    await delay(100);
    // Thumb parked on the stick, other hand taps "?": the dialog must open.
    const help = page.getByRole("button", { name: "How to play" });
    await tapWhileHeld(stickHeld, 3, help);
    const dialog = page.getByRole("dialog", {
      name: "Explore. Prepare. Face the era.",
    });
    entry.observed.helpOpenedWithStickHeld = await dialog
      .waitFor({ timeout: 4_000 })
      .then(() => true)
      .catch(() => false);
    assert.equal(
      entry.observed.helpOpenedWithStickHeld,
      true,
      "help button dead while the stick is held",
    );
    await delay(150);
    const paused = await driver.inspectGame(page);
    entry.observed.whileHelpOpen = {
      moveY: paused.input.moveY,
      delta: await positionDelta(page, 400),
    };
    assert.equal(paused.input.moveY, 0);
    // Same thumb still down; close the dialog with the other hand.
    await tapWhileHeld(
      stickHeld,
      4,
      dialog.getByRole("button", { name: "Back to the adventure" }),
    );
    entry.observed.helpClosedWithStickHeld = await dialog
      .waitFor({ state: "detached", timeout: 4_000 })
      .then(() => true)
      .catch(() => false);
    assert.equal(entry.observed.helpClosedWithStickHeld, true);
    await delay(150);
    const resumed = await driver.inspectGame(page);
    entry.observed.afterHelpClosedStillHeld = {
      moveY: resumed.input.moveY,
      delta: await positionDelta(page, 400),
    };
    assert.equal(
      resumed.input.moveY,
      0,
      "stale stick drove movement after the modal",
    );
    await send("touchEnd", []);
    await delay(100);
    await send("touchStart", [point(1, center.x, center.y)]);
    await send("touchMove", [stickHeld]);
    await delay(250);
    entry.observed.freshStickAfterModal = (
      await driver.inspectGame(page)
    ).input.moveY;
    await send("touchEnd", []);
    assert.ok(
      entry.observed.freshStickAfterModal > 0.5,
      "stick dead after the modal",
    );
    // A single-finger tap must activate exactly once (no duplicate click).
    const sound = page.locator(".game-tools button").first();
    const soundLabels = [await sound.getAttribute("aria-label")];
    const soundPoint = await centerOf(sound);
    await send("touchStart", [point(5, soundPoint.x, soundPoint.y)]);
    await delay(60);
    await send("touchEnd", [point(5, soundPoint.x, soundPoint.y)]);
    await delay(300);
    soundLabels.push(await sound.getAttribute("aria-label"));
    await send("touchStart", [point(6, soundPoint.x, soundPoint.y)]);
    await delay(60);
    await send("touchEnd", [point(6, soundPoint.x, soundPoint.y)]);
    await delay(300);
    soundLabels.push(await sound.getAttribute("aria-label"));
    entry.observed.singleTapSoundLabels = soundLabels;
    assert.deepEqual(soundLabels, [
      "Enable sound",
      "Mute sound",
      "Enable sound",
    ]);
    // A finger resting on the scene while the other taps a dialog button.
    await help.tap();
    await dialog.waitFor();
    const resting = point(7, 40, 420);
    await send("touchStart", [resting]);
    await delay(120);
    await tapWhileHeld(
      resting,
      8,
      dialog.getByRole("button", { name: "Back to the adventure" }),
    );
    entry.observed.dialogClosedWithRestingFinger = await dialog
      .waitFor({ state: "detached", timeout: 4_000 })
      .then(() => true)
      .catch(() => false);
    await send("touchEnd", []);
    assert.equal(entry.observed.dialogClosedWithRestingFinger, true);
    await page
      .getByRole("button", { name: "Attack", exact: true })
      .tap({ force: true })
      .catch(() => undefined);
    await delay(300);
    entry.observed.errorAfterDisabledAttackTap = await gameError(page);
    await shot(page, "game-touch-controls");
  },
);

await probe(
  "game-touch-held-pickup",
  "game",
  "Take gear held through collection; the next pickup must still work",
  async (entry) => {
    const { page, controls } = await startGame("touch");
    const { send, point } = controls;
    const gear = page.getByRole("button", { name: "Take gear", exact: true });
    const holdThrough = {
      ...controls,
      async use() {
        const box = await gear.boundingBox();
        const held = point(7, box.x + box.width / 2, box.y + box.height / 2);
        const before = (await driver.getSave(page)).adventure.inventory.length;
        await send("touchStart", [held]);
        const deadline = Date.now() + 8_000;
        while (Date.now() < deadline) {
          if ((await driver.getSave(page)).adventure.inventory.length > before)
            break;
          await delay(120);
        }
        await delay(500);
        const interact = page.getByRole("button", {
          name: /Take gear|Remember/,
        });
        entry.observed.buttonWhileHeld = {
          name: await interact.getAttribute("aria-label"),
          disabled: await interact.isDisabled(),
        };
        entry.observed.interactWhileHeld = (
          await driver.inspectGame(page)
        ).input.interact;
        await send("touchEnd", [held]);
        await delay(300);
        entry.observed.interactAfterRelease = (
          await driver.inspectGame(page)
        ).input.interact;
      },
    };
    await driver.collectEquipment(
      page,
      holdThrough,
      "attack-tool",
      "held-attack-tool",
    );
    await shot(page, "game-touch-held-pickup-collected");
    await driver.passFirstSweeperSafely(page, controls, "held-pickup-sweeper");
    try {
      await driver.collectEquipment(
        page,
        controls,
        "guard-tool",
        "held-pickup-guard-tool",
      );
      entry.observed.secondPickup = "collected with a normal tap";
    } catch (error) {
      entry.observed.secondPickup = `failed: ${error instanceof Error ? error.message.slice(0, 160) : String(error)}`;
      entry.observed.interactBeforeHeal = (
        await driver.inspectGame(page)
      ).input.interact;
      await page.getByRole("button", { name: "How to play" }).tap();
      const dialog = page.getByRole("dialog", {
        name: "Explore. Prepare. Face the era.",
      });
      await dialog.waitFor();
      await dialog.getByRole("button", { name: "Back to the adventure" }).tap();
      await dialog.waitFor({ state: "detached" });
      entry.observed.interactAfterModalHeal = (
        await driver.inspectGame(page)
      ).input.interact;
      await driver.collectEquipment(
        page,
        controls,
        "guard-tool",
        "held-pickup-guard-tool-after-heal",
      );
      entry.observed.secondPickupAfterHeal =
        "collected after a modal cleared input";
    }
    await shot(page, "game-touch-held-pickup-end");
    assert.equal(
      entry.observed.interactAfterRelease,
      false,
      "interact stayed latched after release",
    );
    assert.equal(entry.observed.secondPickup, "collected with a normal tap");
  },
);

await probe(
  "game-victory",
  "game",
  "boss release: dialog open/close, in-world remember, double taps, reload, absorb, chapter, era-two resume",
  async (entry) => {
    const { page, controls } = await startGame("keyboard");
    await playChapterOne(page, controls, "explore-victory");
    const reclaim = page.getByRole("button", { name: "Reclaim your memories" });
    await reclaim.waitFor();
    entry.observed.focusAfterBoss = await activeElement(page);
    entry.observed.buttonsAfterBoss = (await buttonInventory(page)).filter(
      (button) => button.visible,
    );
    await shot(page, "game-victory-world");
    const victory = page.getByRole("dialog", {
      name: "The memories are yours again.",
    });
    await reclaim.click();
    await victory.waitFor();
    entry.observed.victoryEyebrow = (
      await victory.locator(".eyebrow").textContent()
    )?.trim();
    await victory.getByRole("button", { name: "Close" }).click();
    await victory.waitFor({ state: "detached" });
    entry.observed.reclaimVisibleAfterClose = await reclaim.isVisible();
    await reclaim.click();
    await victory.waitFor();
    await page.keyboard.press("Escape");
    await victory.waitFor({ state: "detached" });
    // In-world remember: walk to a released keepsake and press E.
    const inspection = await driver.inspectGame(page);
    const keepsake = inspection.level.memoryPositions[0];
    entry.observed.keepsake = keepsake;
    const near = await approachUntil(
      page,
      controls,
      keepsake,
      (sample) => sample.status.nearMemoryId !== null,
      "keepsake",
    );
    entry.observed.nearMemoryId = near.status.nearMemoryId;
    entry.observed.rememberButtonEnabled = await page
      .getByRole("button", { name: "Remember", exact: true })
      .isEnabled();
    await controls.use();
    const photo = page
      .locator(".era-modal")
      .filter({ hasText: "A MEMORY RECLAIMED" });
    await photo.waitFor({ timeout: 10_000 });
    entry.observed.photoDialogTitle = (
      await photo.locator("h2").textContent()
    )?.trim();
    await shot(page, "game-victory-in-world-photo");
    await photo.getByRole("button", { name: "Keep exploring" }).click();
    await photo.waitFor({ state: "detached" });
    let save = await driver.getSave(page);
    entry.observed.stateAfterWorldRemember = save.memories.find(
      (memory) => memory.id === near.status.nearMemoryId,
    )?.state;
    // Double click on the next card's Remember button.
    await reclaim.click();
    await victory.waitFor();
    const cards = victory.locator(".victory-memory");
    entry.observed.rememberedMarksBefore = await victory
      .locator(".remembered-mark")
      .count();
    const pendingCard = cards
      .filter({
        has: page.getByRole("button", { name: "Remember this moment" }),
      })
      .first();
    const revision = save.revision;
    await pendingCard
      .getByRole("button", { name: "Remember this moment" })
      .evaluate((button) => {
        button.click();
        button.click();
      });
    await driver.waitForSave(
      page,
      (candidate) => candidate.revision > revision,
      "double-remember",
    );
    await delay(1_200);
    entry.observed.noticeAfterDoubleRemember = (await victory
      .locator(".game-error")
      .count())
      ? (await victory.locator(".game-error").textContent())?.trim()
      : null;
    entry.observed.rememberedMarksAfterDouble = await victory
      .locator(".remembered-mark")
      .count();
    const remaining = victory.getByRole("button", {
      name: "Remember this moment",
    });
    while (await remaining.count()) {
      const current = (await driver.getSave(page)).revision;
      await remaining.first().click();
      await driver.waitForSave(
        page,
        (candidate) => candidate.revision > current,
        "remember-rest",
      );
    }
    await victory.getByRole("button", { name: /Absorb memories/ }).waitFor();
    entry.observed.absorbEnabled = await victory
      .getByRole("button", { name: /Absorb memories/ })
      .isEnabled();
    // Reload while the bundle is released: the dialog must come back on resume.
    await page.reload();
    await page.locator(".save-card").first().click();
    await page.locator("canvas").waitFor();
    entry.observed.victoryAutoOpenAfterReload = await victory
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (!entry.observed.victoryAutoOpenAfterReload) {
      await reclaim.click();
      await victory.waitFor();
    }
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".victory-memory img")].every(
        (img) => img.complete && img.naturalWidth > 0,
      ),
    );
    await shot(page, "game-victory-dialog");
    const absorb = victory.getByRole("button", { name: /Absorb memories/ });
    await driver.waitForEnabled(page, absorb, "absorb");
    await absorb.evaluate((button) => {
      button.click();
      button.click();
    });
    await driver.waitForSave(
      page,
      (candidate) => candidate.ageYears === 4,
      "absorb",
    );
    const chapter = page.getByRole("dialog", { name: "Welcome to 2024." });
    await chapter.waitFor();
    entry.observed.chapterNotice = (
      await chapter.locator("p").first().textContent()
    )?.trim();
    entry.observed.errorAfterDoubleAbsorb = await gameError(page);
    await shot(page, "game-chapter-notice");
    await page.keyboard.press("Escape");
    await chapter.waitFor({ state: "detached" });
    entry.observed.jumpEnabledAfterGrowth = await page
      .getByRole("button", { name: "Jump", exact: true })
      .isEnabled();
    entry.observed.keyboardHintAfterGrowth = (
      await page.locator(".keyboard-hint").textContent()
    )
      ?.replace(/\s+/g, " ")
      .trim();
    entry.observed.objectiveEraTwo = (
      await page.locator(".era-objective p").textContent()
    )?.trim();
    await page.getByRole("button", { name: "Open your memories" }).click();
    const album = page.getByRole("dialog", { name: "Your remembered world." });
    await album.waitFor();
    entry.observed.albumAfterGrowth = {
      eyebrow: (await album.locator(".eyebrow").textContent())?.trim(),
      cards: await album.locator(".victory-memory").count(),
    };
    await page.keyboard.press("Escape");
    await album.waitFor({ state: "detached" });
    await page.getByRole("button", { name: "Save & leave" }).click();
    await page.locator("canvas").waitFor({ state: "detached" });
    entry.observed.cardAfterGrowth = (
      await page.locator(".save-card").first().textContent()
    )
      ?.replace(/\s+/g, " ")
      .trim();
    await page.locator(".save-card").first().click();
    await page.locator("canvas").waitFor();
    entry.observed.resumedEraTwo = (
      await driver.getSave(page)
    ).adventure.activeLevel.eraYear;
    await shot(page, "game-era-two-resumed");
  },
);

await probe(
  "game-fallen-retry",
  "game",
  "fallen: modal, controls hidden, reload, save & leave, retry restores health and keeps gear",
  async (entry) => {
    const { page, controls } = await startGame("keyboard");
    await driver.collectEquipment(
      page,
      controls,
      "attack-tool",
      "fallen-attack-tool",
    );
    await driver.passFirstSweeperSafely(page, controls, "fallen-sweeper");
    await driver.collectEquipment(
      page,
      controls,
      "guard-tool",
      "fallen-guard-tool",
    );
    const armed = await driver.getSave(page);
    const enemyId = armed.adventure.activeLevel.encounters.find(
      (enemy) => enemy.kind === "ordinary-a",
    ).id;
    await driver.approachEncounter(page, controls, enemyId, "fallen-approach");
    const hpTimeline = [];
    const deadline = Date.now() + 150_000;
    let fallenSave = null;
    while (Date.now() < deadline) {
      const sample = await driver.getSave(page);
      if (hpTimeline.at(-1) !== sample.adventure.playerHp)
        hpTimeline.push(sample.adventure.playerHp);
      if (sample.adventure.phase === "fallen") {
        fallenSave = sample;
        break;
      }
      const status = (await driver.inspectGame(page))?.status;
      if (status?.nearEncounterId !== enemyId)
        await driver
          .approachEncounter(page, controls, enemyId, "fallen-reapproach")
          .catch(() => undefined);
      await delay(700);
    }
    entry.observed.hpTimeline = hpTimeline;
    assert.ok(fallenSave, "never fell");
    const fallen = page.getByRole("dialog", {
      name: "Take a breath. Try again.",
    });
    await fallen.waitFor();
    entry.observed.fallenEyebrow = (
      await fallen.locator(".eyebrow").textContent()
    )?.trim();
    entry.observed.fallenButtons = (await buttonInventory(page)).filter(
      (button) => button.visible,
    );
    entry.observed.controlsHiddenWhileFallen =
      (await page.locator(".game-bottom").count()) === 0;
    const courseBefore = (await driver.inspectGame(page)).obby.timeSeconds;
    await delay(600);
    entry.observed.courseAdvanceWhileFallen =
      (await driver.inspectGame(page)).obby.timeSeconds - courseBefore;
    await shot(page, "game-fallen");
    await page.reload();
    await page.locator(".save-card").first().click();
    await page.locator("canvas").waitFor();
    entry.observed.fallenAfterReload = await fallen
      .waitFor({ timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
    assert.equal(entry.observed.fallenAfterReload, true);
    await fallen.getByRole("button", { name: "Save & leave" }).click();
    await page.locator("canvas").waitFor({ state: "detached" });
    entry.observed.cardWhileFallen = (
      await page.locator(".save-card").first().textContent()
    )
      ?.replace(/\s+/g, " ")
      .trim();
    await page.locator(".save-card").first().click();
    await page.locator("canvas").waitFor();
    await fallen.waitFor();
    await fallen.getByRole("button", { name: "Try this level again" }).click();
    const retried = await driver.waitForSave(
      page,
      (candidate) => candidate.adventure.phase === "exploring",
      "retry",
    );
    entry.observed.afterRetry = {
      hp: retried.adventure.playerHp,
      inventory: retried.adventure.inventory.length,
      age: retried.ageYears,
      completedLevels: retried.adventure.completedLevelIds.length,
      position: await positionOf(page),
      objective: (await page.locator(".era-objective p").textContent())?.trim(),
    };
    assert.equal(retried.adventure.playerHp, retried.adventure.maxPlayerHp);
    assert.equal(
      retried.adventure.inventory.length,
      fallenSave.adventure.inventory.length,
    );
    assert.equal(retried.adventure.inventory.length, 2);
    await shot(page, "game-after-retry");
  },
);

await probe(
  "game-viewports",
  "game",
  "in-game HUD fits small phones, landscape phone and tablet",
  async (entry) => {
    const sizes = [
      { name: "320x568", width: 320, height: 568 },
      { name: "375x667", width: 375, height: 667 },
      { name: "844x390", width: 844, height: 390 },
      { name: "768x1024", width: 768, height: 1024 },
    ];
    entry.observed.sizes = {};
    for (const size of sizes) {
      const { page } = await startGame(
        "touch",
        touchContextOptions(size.width, size.height),
      );
      const boxes = await page.evaluate(() => {
        const pick = (selector) =>
          [...document.querySelectorAll(selector)].map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              selector,
              x: rect.x,
              y: rect.y,
              right: rect.right,
              bottom: rect.bottom,
            };
          });
        return [
          ".game-header",
          ".era-hud",
          ".era-objective",
          ".game-bottom",
          ".joystick",
          ".combat-actions",
          ".placeholder-label",
        ].flatMap(pick);
      });
      const within = boxes
        .filter(
          (box) =>
            box.x < -0.5 ||
            box.y < -0.5 ||
            box.right > size.width + 0.5 ||
            box.bottom > size.height + 0.5,
        )
        .map((box) => box.selector);
      const overlaps = [];
      const find = (selector) => boxes.find((box) => box.selector === selector);
      const intersects = (a, b) =>
        a &&
        b &&
        a.x < b.right &&
        b.x < a.right &&
        a.y < b.bottom &&
        b.y < a.bottom;
      for (const [a, b] of [
        [".era-hud", ".era-objective"],
        [".game-bottom", ".era-hud"],
        [".game-bottom", ".era-objective"],
        [".game-header", ".era-hud"],
        [".game-header", ".era-objective"],
        [".placeholder-label", ".joystick"],
        [".placeholder-label", ".combat-actions"],
      ])
        if (intersects(find(a), find(b))) overlaps.push(`${a}~${b}`);
      const leave = page.getByRole("button", { name: "Save & leave" });
      entry.observed.sizes[size.name] = {
        outsideViewport: within,
        overlaps,
        leaveName: await leave.getAttribute("aria-label"),
        leaveTextVisible: await leave.locator("span").isVisible(),
        overflow: (await overflow(page)).horizontal,
      };
      await shot(page, `game-${size.name}`);
      for (const context of openContexts) await context.close();
      openContexts.clear();
    }
    for (const [name, result] of Object.entries(entry.observed.sizes)) {
      assert.deepEqual(
        result.outsideViewport,
        [],
        `${name} controls leave the viewport`,
      );
      assert.equal(
        result.leaveName,
        "Save & leave",
        `${name} leave button unnamed`,
      );
      assert.equal(result.overflow, false, `${name} overflows`);
    }
  },
);

await probe(
  "game-complete-resume",
  "complete",
  "a finished journey: home card, resume shows the completion dialog",
  async (entry) => {
    const { page, controls } = await startGame("keyboard");
    const result = await driver.playJourney(page, controls, "explore-complete");
    entry.observed.finalAge = result.save.ageYears;
    const complete = page.getByRole("dialog", {
      name: "Every chapter, a little more you.",
    });
    entry.observed.completeSummary = (
      await complete.locator("p").first().textContent()
    )
      ?.replace(/\s+/g, " ")
      .trim();
    entry.observed.completeButtons = (await buttonInventory(page)).filter(
      (button) => button.visible,
    );
    await complete
      .getByRole("button", { name: "Back to your journeys" })
      .click();
    await page.locator("canvas").waitFor({ state: "detached" });
    entry.observed.card = (
      await page.locator(".save-card").first().textContent()
    )
      ?.replace(/\s+/g, " ")
      .trim();
    await page.locator(".save-card").first().click();
    await page.locator("canvas").waitFor();
    await complete.waitFor({ timeout: 10_000 });
    entry.observed.completeReopens = true;
    entry.observed.controlsHiddenWhenComplete =
      (await page.locator(".game-bottom").count()) === 0;
    await shot(page, "game-complete-resume");
    await complete
      .getByRole("button", { name: "Back to your journeys" })
      .click();
    await page.locator("canvas").waitFor({ state: "detached" });
  },
);

await browser.close();
report.summary = {
  total: report.probes.length,
  pass: report.probes.filter((probe) => probe.status === "pass").length,
  fail: report.probes.filter((probe) => probe.status === "fail").length,
  pageError: report.probes.filter((probe) => probe.status === "page-error")
    .length,
};
await fs.writeFile(`${outDir}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary));
if (report.summary.fail || report.summary.pageError) process.exitCode = 1;
