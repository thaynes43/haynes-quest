import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { chromium } from "playwright";
import { createJourneyDriver } from "./journey-lib.mjs";

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const url = process.env.QUEST_E2E_URL ?? "http://127.0.0.1:4173";
const timeoutMs = Number(process.env.QUEST_TOUCH_MENU_TIMEOUT_MS ?? 120_000);
assert.ok(Number.isInteger(timeoutMs) && timeoutMs >= 30_000);

const outDir = "test-results/touch-menu-regression";
const reportPath = `${outDir}/report.json`;
await fs.mkdir(outDir, { recursive: true });

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
const report = {
  date: new Date().toISOString(),
  status: "running",
  url,
  browser: browser.version(),
  viewport: {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    cdpTouch: true,
  },
  bundle,
  actions: {},
  trace: [],
  pageErrors: [],
};

let page;
let context;
let timedOut = false;
const deadline = setTimeout(() => {
  timedOut = true;
  void browser.close();
}, timeoutMs);

const traceInstaller = () => {
  window.__questTouchMenuTrace = [];
  let sequence = 0;
  const describe = (target) => {
    if (!(target instanceof Element)) return null;
    const control = target.closest(
      "button, a[href], [role=button], [data-testid]",
    );
    if (!control) return null;
    return {
      tag: control.tagName.toLowerCase(),
      label:
        control.getAttribute("aria-label") ??
        control.getAttribute("data-testid") ??
        control.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ??
        "",
      testId: control.getAttribute("data-testid"),
      className:
        typeof control.className === "string" ? control.className : null,
    };
  };
  const record = (event) => {
    const target = event.target;
    const control =
      target instanceof Element
        ? target.closest("button, a[href], [role=button], [data-testid]")
        : null;
    const pointerId = "pointerId" in event ? event.pointerId : null;
    let targetHasPointerCapture = null;
    let controlHasPointerCapture = null;
    if (pointerId !== null) {
      try {
        targetHasPointerCapture =
          target instanceof Element &&
          typeof target.hasPointerCapture === "function"
            ? target.hasPointerCapture(pointerId)
            : null;
        controlHasPointerCapture =
          control && typeof control.hasPointerCapture === "function"
            ? control.hasPointerCapture(pointerId)
            : null;
      } catch {
        // A detached target can reject capture inspection; retain null as evidence.
      }
    }
    window.__questTouchMenuTrace.push({
      sequence: sequence++,
      at: performance.now(),
      type: event.type,
      control: describe(target),
      pointerId,
      pointerType: "pointerType" in event ? event.pointerType : null,
      isPrimary: "isPrimary" in event ? event.isPrimary : null,
      detail: "detail" in event ? event.detail : null,
      isTrusted: event.isTrusted,
      targetHasPointerCapture,
      controlHasPointerCapture,
    });
  };
  for (const type of [
    "pointerdown",
    "pointerup",
    "pointercancel",
    "lostpointercapture",
    "click",
    "keydown",
  ])
    document.addEventListener(type, record, true);
};

const errors = report.pageErrors;
const driver = createJourneyDriver({ url, errors });

const trace = () => page.evaluate(() => window.__questTouchMenuTrace ?? []);
const clearTrace = () =>
  page.evaluate(() => {
    window.__questTouchMenuTrace = [];
  });
const eventsSince = async (start) => (await trace()).slice(start);
const traceLength = async () => (await trace()).length;
const soundClick = (event) =>
  event.type === "click" &&
  ["Enable sound", "Mute sound"].includes(event.control?.label);
const toggledSoundLabel = (label) => {
  if (label === "Enable sound") return "Mute sound";
  if (label === "Mute sound") return "Enable sound";
  throw new Error(`unexpected sound label: ${label}`);
};

try {
  context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(traceInstaller);
  page = await driver.start(context, "touch");
  const controls = await driver.touchControls(page, context);
  const { send, point, center } = controls;

  await clearTrace();
  const centerOf = async (locator) => {
    const box = await locator.boundingBox();
    assert.ok(box, "control has no visible box");
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const tapWhileHeld = async (heldPoint, pointerId, locator) => {
    const target = await centerOf(locator);
    const contact = point(pointerId, target.x, target.y);
    const start = await traceLength();
    await send("touchStart", [heldPoint, contact]);
    await delay(60);
    await send("touchEnd", [contact]);
    return eventsSince(start);
  };
  const assertImplicitCapture = (events, label) => {
    const pointerUp = events.find((event) => event.type === "pointerup");
    assert.ok(pointerUp, `${label} pointerup missing`);
    assert.equal(
      pointerUp.pointerType,
      "touch",
      `${label} was not touch input`,
    );
    assert.equal(
      pointerUp.isPrimary,
      false,
      `${label} was not the secondary contact`,
    );
    assert.equal(
      pointerUp.controlHasPointerCapture,
      true,
      `${label} did not retain implicit pointer capture through pointerup`,
    );
    return pointerUp;
  };
  const assertOriginalStillHeld = async (pointerId, label) => {
    assert.equal(
      (await trace()).some(
        (event) =>
          ["pointerup", "pointercancel", "lostpointercapture"].includes(
            event.type,
          ) && event.pointerId === pointerId,
      ),
      false,
      `${label} released or cancelled the original joystick contact`,
    );
  };

  const joystickId = 1;
  const stickOrigin = point(joystickId, center.x, center.y);
  const stickHeld = point(joystickId, center.x, center.y - 30);
  await send("touchStart", [stickOrigin]);
  await send("touchMove", [stickHeld]);
  await delay(150);
  const joystickPointerDown = (await trace()).find(
    (event) =>
      event.type === "pointerdown" && event.control?.testId === "joystick",
  );
  assert.ok(joystickPointerDown, "joystick pointerdown trace missing");
  const joystickPointerId = joystickPointerDown.pointerId;
  const heldInspection = await driver.inspectGame(page);
  assert.ok(heldInspection?.input.moveY > 0.5, "joystick did not engage");

  const helpButton = page.getByRole("button", { name: "How to play" });
  const helpEvents = await tapWhileHeld(stickHeld, 2, helpButton);
  const helpDialog = page.getByRole("dialog", {
    name: "Explore. Prepare. Face the era.",
  });
  await helpDialog.waitFor({ timeout: 4_000 });
  report.actions.helpOpen = {
    pointerUp: assertImplicitCapture(helpEvents, "Help"),
    events: helpEvents,
  };
  await assertOriginalStillHeld(joystickPointerId, "opening Help");

  const helpCloseEvents = await tapWhileHeld(
    stickHeld,
    3,
    helpDialog.getByRole("button", { name: "Close", exact: true }),
  );
  await helpDialog.waitFor({ state: "detached", timeout: 4_000 });
  report.actions.helpClose = {
    pointerUp: assertImplicitCapture(helpCloseEvents, "Help close"),
    events: helpCloseEvents,
  };
  await assertOriginalStillHeld(joystickPointerId, "closing Help");

  const albumButton = page.getByRole("button", {
    name: "Open your memories",
  });
  const albumEvents = await tapWhileHeld(stickHeld, 4, albumButton);
  const albumDialog = page.getByRole("dialog", {
    name: "Your remembered world.",
  });
  await albumDialog.waitFor({ timeout: 4_000 });
  report.actions.albumOpen = {
    pointerUp: assertImplicitCapture(albumEvents, "Album"),
    events: albumEvents,
  };
  await assertOriginalStillHeld(joystickPointerId, "opening Album");

  const albumCloseEvents = await tapWhileHeld(
    stickHeld,
    5,
    albumDialog.getByRole("button", { name: "Close", exact: true }),
  );
  await albumDialog.waitFor({ state: "detached", timeout: 4_000 });
  report.actions.albumClose = {
    pointerUp: assertImplicitCapture(albumCloseEvents, "Album close"),
    events: albumCloseEvents,
  };
  await assertOriginalStillHeld(joystickPointerId, "closing Album");

  const sound = page.locator(".game-tools button").first();
  const soundBefore = await sound.getAttribute("aria-label");
  assert.ok(soundBefore);
  const secondarySoundEvents = await tapWhileHeld(stickHeld, 6, sound);
  const soundAfterSecondary = await sound.getAttribute("aria-label");
  assert.equal(soundAfterSecondary, toggledSoundLabel(soundBefore));
  const syntheticClick = secondarySoundEvents.find(
    (event) => soundClick(event) && !event.isTrusted,
  );
  assert.ok(syntheticClick, "secondary sound tap did not synthesize a click");
  const soundPointerUp = assertImplicitCapture(
    secondarySoundEvents,
    "secondary sound tap",
  );

  const keyboardStart = await traceLength();
  await sound.focus();
  await page.keyboard.press("Enter");
  const keyboardEvents = await eventsSince(keyboardStart);
  const soundAfterKeyboard = await sound.getAttribute("aria-label");
  assert.equal(soundAfterKeyboard, toggledSoundLabel(soundAfterSecondary));
  assert.equal(
    keyboardEvents.filter(soundClick).length,
    1,
    "keyboard activation did not fire exactly once",
  );
  const keyboardClick = keyboardEvents.find(soundClick);
  assert.equal(keyboardClick.isTrusted, true);
  assert.equal(keyboardClick.detail, 0);
  const keyboardDown = keyboardEvents.find(
    (event) => event.type === "keydown" && event.control?.label,
  );
  assert.ok(keyboardDown, "keyboard activation trace missing keydown");
  const keyboardGapMs = keyboardDown.at - syntheticClick.at;
  assert.ok(
    keyboardGapMs >= 0 && keyboardGapMs < 600,
    `keyboard activation missed the 600ms deduplication window: ${keyboardGapMs}ms`,
  );
  report.actions.soundSecondaryThenKeyboard = {
    labels: [soundBefore, soundAfterSecondary, soundAfterKeyboard],
    secondaryPointerUp: soundPointerUp,
    keyboardGapMs,
    secondaryEvents: secondarySoundEvents,
    keyboardEvents,
  };
  await assertOriginalStillHeld(
    joystickPointerId,
    "sound and keyboard activation",
  );

  await send("touchEnd", []);
  await delay(80);
  const releasedTrace = await trace();
  assert.ok(
    releasedTrace.some(
      (event) =>
        event.type === "pointerup" && event.pointerId === joystickPointerId,
    ),
    "original joystick release missing",
  );

  const primaryPoint = await centerOf(sound);
  const primaryContact = point(7, primaryPoint.x, primaryPoint.y);
  const primaryStart = await traceLength();
  const primaryBefore = await sound.getAttribute("aria-label");
  await send("touchStart", [primaryContact]);
  await delay(60);
  await send("touchEnd", [primaryContact]);
  await delay(100);
  const primaryEvents = await eventsSince(primaryStart);
  const primaryAfter = await sound.getAttribute("aria-label");
  assert.equal(primaryAfter, toggledSoundLabel(primaryBefore));
  assert.equal(
    primaryEvents.filter(soundClick).length,
    1,
    "primary touch activation did not fire exactly once",
  );
  const primaryClick = primaryEvents.find(soundClick);
  assert.equal(primaryClick.isTrusted, true);
  assert.equal(primaryClick.pointerType, "touch");
  report.actions.soundPrimaryTouch = {
    labels: [primaryBefore, primaryAfter],
    events: primaryEvents,
  };

  const mouseStart = await traceLength();
  const mouseBefore = await sound.getAttribute("aria-label");
  await sound.click();
  const mouseEvents = await eventsSince(mouseStart);
  const mouseAfter = await sound.getAttribute("aria-label");
  assert.equal(mouseAfter, toggledSoundLabel(mouseBefore));
  assert.equal(
    mouseEvents.filter(soundClick).length,
    1,
    "mouse activation did not fire exactly once",
  );
  const trustedMouseClick = mouseEvents.find(soundClick);
  assert.equal(trustedMouseClick.isTrusted, true);
  assert.equal(trustedMouseClick.pointerType, "mouse");
  report.actions.soundMouse = {
    labels: [mouseBefore, mouseAfter],
    events: mouseEvents,
  };

  const currentSave = await driver.getSave(page);
  const beforeList = await driver.readSaveEndpoint(page, "/api/saves");
  assert.equal(beforeList.status, 200);
  assert.equal(
    beforeList.body.saves.filter((save) => save.id === currentSave.id).length,
    1,
    "current journey was not present exactly once before leaving",
  );

  const leaveJoystickId = 8;
  const leaveOrigin = point(leaveJoystickId, center.x, center.y);
  const leaveHeld = point(leaveJoystickId, center.x, center.y - 30);
  await send("touchStart", [leaveOrigin]);
  await send("touchMove", [leaveHeld]);
  await delay(150);
  assert.ok(
    (await driver.inspectGame(page))?.input.moveY > 0.5,
    "Save & leave joystick did not engage",
  );
  const leaveEvents = await tapWhileHeld(
    leaveHeld,
    9,
    page.getByRole("button", { name: "Save & leave" }),
  );
  await page.locator("canvas").waitFor({ state: "detached", timeout: 4_000 });
  await send("touchEnd", []);
  await page.locator(".save-card").first().waitFor({ timeout: 4_000 });

  const afterList = await driver.readSaveEndpoint(page, "/api/saves");
  assert.equal(afterList.status, 200);
  assert.deepEqual(
    afterList.body.saves.map((save) => save.id).sort(),
    beforeList.body.saves.map((save) => save.id).sort(),
    "Save & leave duplicated or removed a journey",
  );
  assert.equal(
    afterList.body.saves.filter((save) => save.id === currentSave.id).length,
    1,
    "current journey was not preserved exactly once",
  );
  report.actions.saveAndLeave = {
    journeyId: currentSave.id,
    savesBefore: beforeList.body.saves.length,
    savesAfter: afterList.body.saves.length,
    currentJourneyMatchesAfter: 1,
    pointerUp: assertImplicitCapture(leaveEvents, "Save & leave"),
    events: leaveEvents,
  };

  assert.deepEqual(errors, []);
  report.trace = await trace();
  report.status = "pass";
} catch (error) {
  report.status = timedOut ? "timeout" : "fail";
  report.error = error instanceof Error ? error.stack : String(error);
  if (page && !page.isClosed()) {
    report.trace = await trace().catch(() => []);
    await page
      .screenshot({ path: `${outDir}/failure.png` })
      .catch(() => undefined);
  }
  process.exitCode = timedOut ? 124 : 1;
} finally {
  clearTimeout(deadline);
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  if (context) await context.close().catch(() => undefined);
  await browser.close().catch(() => undefined);
}

console.log(JSON.stringify(report, null, 2));
