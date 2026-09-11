import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const url = process.env.QUEST_E2E_URL ?? "http://127.0.0.1:4173";
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
const errors = [];
const saveIds = new WeakMap();
const mode = process.env.QUEST_E2E_MODE ?? "all";
assert.ok(["all", "keyboard", "touch"].includes(mode));
await fs.mkdir("test-results", { recursive: true });

async function start(context) {
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url);
  await page.getByRole("button", { name: "Start a journey" }).click();
  await page.getByRole("button", { name: "Preview memories" }).click();
  await page.getByRole("button", { name: "Begin your journey" }).click();
  await page.locator("canvas").waitFor();
  return page;
}

async function getSave(page) {
  let saveId = saveIds.get(page);
  if (!saveId) {
    const list = await page.evaluate(async () => {
      const response = await fetch("/api/saves");
      return { status: response.status, body: await response.json() };
    });
    assert.equal(list.status, 200, `save list failed: ${list.status}`);
    saveId = list.body.saves.find(
      (item) => item.format === "era-combat-v2",
    )?.id;
    assert.ok(saveId, "era save missing");
    saveIds.set(page, saveId);
  }
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = await page.evaluate(async (id) => {
      const response = await fetch(`/api/saves/${encodeURIComponent(id)}`);
      return {
        status: response.status,
        body: response.ok ? await response.json() : null,
      };
    }, saveId);
    if (result.status === 200) return result.body;
    if (result.status !== 429)
      throw new Error(`save read failed: ${result.status}`);
    await page.waitForTimeout(300);
  }
  throw new Error("save reads remained rate limited");
}

async function waitForSave(page, predicate, label, timeout = 12_000) {
  const deadline = Date.now() + timeout;
  let latest;
  while (Date.now() < deadline) {
    latest = await getSave(page);
    if (predicate(latest)) return latest;
    await page.waitForTimeout(150);
  }
  await page.screenshot({ path: `test-results/${label}-failure.png` });
  throw new Error(
    `${label} did not reach the expected save state: ${JSON.stringify(latest)}`,
  );
}

async function locatorReady(locator) {
  return (await locator.count()) > 0 && (await locator.first().isVisible());
}

async function inspectGame(page) {
  if (page.isClosed()) return null;
  return page
    .evaluate(() => {
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
          if (candidate && typeof candidate.inspect === "function") {
            return candidate.inspect();
          }
          hook = hook.next;
        }
        fiber = fiber.return;
      }
      return null;
    })
    .catch(() => null);
}

const directions = {
  leftForward: { keys: ["a", "w"], touch: { x: -30, y: -34 } },
  rightForward: { keys: ["d", "w"], touch: { x: 30, y: -34 } },
  left: { keys: ["a"], touch: { x: -34, y: 0 } },
  right: { keys: ["d"], touch: { x: 34, y: 0 } },
  forward: { keys: ["w"], touch: { x: 0, y: -34 } },
};

function keyboardControls(page) {
  return {
    async nudge(direction, duration) {
      const keys = directions[direction].keys;
      for (const key of keys) await page.keyboard.down(key);
      await page.waitForTimeout(duration);
      for (const key of [...keys].reverse()) await page.keyboard.up(key);
    },
    async moveUntil(direction, predicate, label, timeout = 9_000) {
      const keys = directions[direction].keys;
      let failureInspection;
      for (const key of keys) await page.keyboard.down(key);
      const deadline = Date.now() + timeout;
      try {
        while (Date.now() < deadline) {
          if (await predicate()) return;
          await page.waitForTimeout(60);
        }
      } finally {
        failureInspection = await inspectGame(page);
        for (const key of [...keys].reverse()) await page.keyboard.up(key);
      }
      await page.screenshot({ path: `test-results/${label}-failure.png` });
      throw new Error(
        `${label} was unreachable with keyboard movement: ${JSON.stringify(failureInspection)}`,
      );
    },
    use: () => page.keyboard.press("e", { delay: 70 }),
    attack: () => page.keyboard.press("f", { delay: 55 }),
    guard: () => page.keyboard.press("Shift", { delay: 55 }),
    jump: () => page.keyboard.press("Space", { delay: 55 }),
  };
}

async function touchControls(page, context) {
  const cdp = await context.newCDPSession(page);
  const stick = await page.getByTestId("joystick").boundingBox();
  assert.ok(stick);
  const center = {
    x: stick.x + stick.width / 2,
    y: stick.y + stick.height / 2,
  };
  const point = (id, x, y) => ({ id, x, y, radiusX: 5, radiusY: 5, force: 1 });
  const send = (type, points) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
  return {
    cdp,
    center,
    point,
    send,
    async nudge(direction, duration) {
      const delta = directions[direction].touch;
      await send("touchStart", [point(1, center.x, center.y)]);
      await send("touchMove", [
        point(1, center.x + delta.x, center.y + delta.y),
      ]);
      await page.waitForTimeout(duration);
      await send("touchEnd", []);
    },
    async moveUntil(direction, predicate, label, timeout = 10_000) {
      const delta = directions[direction].touch;
      await send("touchStart", [point(1, center.x, center.y)]);
      await send("touchMove", [
        point(1, center.x + delta.x, center.y + delta.y),
      ]);
      const deadline = Date.now() + timeout;
      try {
        while (Date.now() < deadline) {
          if (await predicate()) return;
          await page.waitForTimeout(60);
        }
      } finally {
        await send("touchEnd", []);
      }
      await page.screenshot({ path: `test-results/${label}-failure.png` });
      throw new Error(
        `${label} was unreachable with touch movement: ${JSON.stringify(await inspectGame(page))}`,
      );
    },
    use: () => page.getByRole("button", { name: /Take gear|Remember/ }).tap(),
    attack: () =>
      page.getByRole("button", { name: "Attack", exact: true }).tap(),
    guard: () => page.getByRole("button", { name: "Guard", exact: true }).tap(),
    jump: () => page.getByRole("button", { name: "Jump", exact: true }).tap(),
  };
}

async function collectCurrentLevelEquipment(page, controls, label) {
  const gearButton = page.getByRole("button", {
    name: "Take gear",
    exact: true,
  });
  let save = await getSave(page);
  const startingInventory = save.adventure.inventory.length;
  await controls.moveUntil(
    "leftForward",
    () => gearButton.isEnabled().catch(() => false),
    `${label}-attack-tool`,
  );
  await controls.use();
  save = await waitForSave(
    page,
    (candidate) =>
      candidate.adventure.inventory.length === startingInventory + 1,
    `${label}-attack-tool-save`,
  );
  assert.equal(
    save.adventure.inventory.find(
      (item) => item.id === save.adventure.equippedId,
    )?.kind,
    "attack-tool",
  );

  await controls.moveUntil(
    "rightForward",
    () => gearButton.isEnabled().catch(() => false),
    `${label}-guard-tool`,
  );
  await controls.use();
  save = await waitForSave(
    page,
    (candidate) =>
      candidate.adventure.inventory.length === startingInventory + 2,
    `${label}-guard-tool-save`,
  );
  assert.equal(
    save.adventure.inventory.some((item) => item.kind === "guard-tool"),
    true,
  );
  return save;
}

async function fightEncounter(page, controls, kind, allowJump, label) {
  const deadline = Date.now() + 120_000;
  let retries = 0;
  let usedGuard = false;
  let initialRemaining;
  let horizontallyAligned = kind === "boss";
  const targetHint = page.locator(".target-hint");
  while (Date.now() < deadline) {
    let save = await getSave(page);
    if (save.adventure.phase === "fallen") {
      retries += 1;
      assert.ok(retries <= 2, `${label} exceeded bounded retries`);
      await page.getByRole("button", { name: "Try this level again" }).click();
      await waitForSave(
        page,
        (candidate) => candidate.adventure.phase === "exploring",
        `${label}-retry`,
      );
      initialRemaining = undefined;
      horizontallyAligned = kind === "boss";
      continue;
    }
    const remaining = save.adventure.activeLevel.encounters.filter(
      (enemy) =>
        (kind === "ordinary"
          ? enemy.role === "ordinary"
          : enemy.kind === kind) && !enemy.defeated,
    );
    initialRemaining ??= remaining.length;
    if (
      !remaining.length ||
      (kind === "ordinary" && remaining.length < initialRemaining)
    ) {
      return { save, retries, usedGuard };
    }
    if (!(await locatorReady(targetHint))) {
      if (!horizontallyAligned) {
        await controls.nudge(
          remaining[0].kind === "ordinary-a" ? "left" : "right",
          650,
        );
        horizontallyAligned = true;
      }
      await controls.moveUntil(
        "forward",
        async () => {
          if (await locatorReady(targetHint)) return true;
          return locatorReady(
            page.getByRole("button", { name: "Try this level again" }),
          );
        },
        `${label}-approach-${remaining[0].kind}`,
        30_000,
      );
      continue;
    }

    await controls.guard();
    await page.waitForTimeout(150);
    save = await getSave(page);
    usedGuard ||= save.adventure.guardActiveRemainingMs > 0;
    if (allowJump) {
      await controls.jump();
      await page.waitForTimeout(45);
    }
    await controls.attack();
    await page.waitForTimeout(690);
  }
  await page.screenshot({ path: `test-results/${label}-combat-timeout.png` });
  throw new Error(`${label} combat timed out`);
}

async function rememberAndAbsorb(page, expectedAge, nextAge, label) {
  if (
    !(await page
      .getByRole("dialog", { name: "The memories are yours again." })
      .isVisible())
  )
    await page.getByRole("button", { name: "Reclaim your memories" }).click();
  await page
    .getByRole("dialog", { name: "The memories are yours again." })
    .waitFor();
  let save = await getSave(page);
  assert.equal(save.adventure.phase, "memory-released");
  assert.equal(save.ageYears, expectedAge, "boss defeat must not change age");
  while (
    (await page.getByRole("button", { name: "Remember this moment" }).count()) >
    0
  ) {
    const revision = save.revision;
    await page
      .getByRole("button", { name: "Remember this moment" })
      .first()
      .click();
    save = await waitForSave(
      page,
      (candidate) => candidate.revision > revision,
      `${label}-remember`,
    );
    assert.equal(
      save.ageYears,
      expectedAge,
      "photo reveal must not change age",
    );
  }
  assert.equal(
    save.adventure.activeLevel.memoryIds.every((id) =>
      save.memories.some(
        (memory) => memory.id === id && memory.state === "revealed",
      ),
    ),
    true,
  );
  const absorb = page.getByRole("button", {
    name: /Absorb memories · Grow to age/,
  });
  assert.equal(await absorb.isEnabled(), true);
  await absorb.click();
  return waitForSave(
    page,
    (candidate) => candidate.ageYears === nextAge,
    `${label}-absorb`,
  );
}

async function leaveAndResume(page, expected) {
  await page.getByRole("button", { name: "Save & leave" }).click();
  await page.locator("canvas").waitFor({ state: "detached" });
  await page.reload();
  await page.locator(".save-card").first().click();
  await page.locator("canvas").waitFor();
  const resumed = await getSave(page);
  assert.equal(resumed.id, expected.id);
  assert.ok(resumed.revision >= expected.revision);
  assert.deepEqual(resumed.adventure.inventory, expected.adventure.inventory);
  assert.deepEqual(
    resumed.adventure.activeLevel.encounters.map((enemy) => enemy.defeated),
    expected.adventure.activeLevel.encounters.map((enemy) => enemy.defeated),
  );
  return resumed;
}

async function playJourney(page, controls, label, testMediaFailure = false) {
  let save = await collectCurrentLevelEquipment(
    page,
    controls,
    `${label}-era-1`,
  );
  assert.equal(save.ageYears, 0);
  assert.equal(
    save.adventure.activeLevel.encounters.find((enemy) => enemy.role === "boss")
      .available,
    false,
  );

  const ordinaryOneA = await fightEncounter(
    page,
    controls,
    "ordinary",
    false,
    `${label}-era-1-ordinary-a`,
  );
  await leaveAndResume(page, ordinaryOneA.save);
  const ordinaryOneB = await fightEncounter(
    page,
    controls,
    "ordinary",
    false,
    `${label}-era-1-ordinary-b`,
  );
  assert.equal(ordinaryOneA.usedGuard || ordinaryOneB.usedGuard, true);
  assert.equal(
    ordinaryOneB.save.adventure.activeLevel.encounters
      .filter((enemy) => enemy.role === "ordinary")
      .every((enemy) => enemy.defeated),
    true,
  );
  assert.equal(
    ordinaryOneB.save.adventure.activeLevel.encounters.find(
      (enemy) => enemy.role === "boss",
    ).available,
    true,
  );

  await leaveAndResume(page, ordinaryOneB.save);
  let failMedia = testMediaFailure;
  if (testMediaFailure) {
    await page.route(/\/api\/saves\/[^/]+\/media\//, (route) =>
      failMedia ? route.abort("failed") : route.continue(),
    );
  }
  const bossOne = await fightEncounter(
    page,
    controls,
    "boss",
    false,
    `${label}-era-1-boss`,
  );
  assert.equal(bossOne.save.ageYears, 0);

  if (testMediaFailure) {
    await page.getByRole("button", { name: "Reclaim your memories" }).click();
    await page
      .getByText("Some artwork couldn’t load.")
      .waitFor({ timeout: 16_000 });
    assert.equal(
      await page.getByRole("button", { name: "Retry artwork" }).isVisible(),
      true,
    );
    await page
      .getByText(/Reconnecting to this picture|This picture couldn’t load/)
      .first()
      .waitFor({ timeout: 16_000 });
    failMedia = false;
    const victory = page.getByRole("dialog", {
      name: "The memories are yours again.",
    });
    await victory.getByRole("button", { name: "Retry artwork" }).click();
    await page
      .getByText("Some artwork couldn’t load.")
      .waitFor({ state: "hidden", timeout: 16_000 });
    const pictureRetries = page.getByRole("button", {
      name: "Try the picture again",
    });
    for (let index = 0; index < (await pictureRetries.count()); index += 1) {
      await pictureRetries.nth(index).click();
    }
    await page
      .locator(".victory-memory img")
      .first()
      .waitFor({ state: "visible", timeout: 16_000 });
  }

  save = await rememberAndAbsorb(page, 0, 4, `${label}-era-1`);
  assert.equal(save.completed, false);
  assert.equal(save.adventure.activeLevel.eraYear, 2024);
  assert.equal(save.adventure.completedLevelIds.length, 1);
  await page.getByRole("button", { name: "Enter the next era" }).click();
  assert.equal(
    await page.getByRole("button", { name: "Jump", exact: true }).isEnabled(),
    true,
  );

  await collectCurrentLevelEquipment(page, controls, `${label}-era-2`);
  const ordinaryTwoA = await fightEncounter(
    page,
    controls,
    "ordinary",
    true,
    `${label}-era-2-ordinary-a`,
  );
  await leaveAndResume(page, ordinaryTwoA.save);
  const ordinaryTwoB = await fightEncounter(
    page,
    controls,
    "ordinary",
    true,
    `${label}-era-2-ordinary-b`,
  );
  assert.equal(ordinaryTwoA.usedGuard || ordinaryTwoB.usedGuard, true);
  await leaveAndResume(page, ordinaryTwoB.save);
  const bossTwo = await fightEncounter(
    page,
    controls,
    "boss",
    true,
    `${label}-era-2-boss`,
  );
  assert.equal(bossTwo.save.ageYears, 4);
  save = await rememberAndAbsorb(page, 4, 7, `${label}-era-2`);
  assert.equal(save.completed, true);
  assert.equal(save.adventure.phase, "complete");
  assert.equal(save.adventure.completedLevelIds.length, 2);
  await page
    .getByRole("dialog", { name: "Every chapter, a little more you." })
    .waitFor();
  await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll(".victory-memory")];
    return (
      cards.length === 3 &&
      cards.every((card) => {
        const picture = card.querySelector("img");
        return (
          picture?.complete &&
          picture.naturalWidth > 0 &&
          !card.textContent?.includes("Opening this memory")
        );
      })
    );
  });
  const finalInspection = await inspectGame(page);
  assert.ok(finalInspection);
  assert.equal(
    finalInspection.level.id,
    save.adventure.completedLevelIds.at(-1),
  );
  assert.ok(finalInspection.status.position.z < -20);
  await page.screenshot({ path: `test-results/${label}-complete.png` });
  return save;
}

try {
  if (mode !== "touch") {
    const desktop = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await start(desktop);
    const keyboard = keyboardControls(page);
    const desktopSave = await playJourney(page, keyboard, "keyboard", true);
    assert.equal(desktopSave.ageYears, 7);
    await page.getByRole("button", { name: "Back to your journeys" }).click();
    assert.equal(await page.locator("canvas").count(), 0);
    await desktop.close();
  }

  if (mode !== "keyboard") {
    const touchContext = await browser.newContext({
      viewport: { width: 844, height: 390 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
    });
    const mobile = await start(touchContext);
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
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 844);
      assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 390);
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
    await mobile.waitForTimeout(50);
    assert.equal(
      /^translate\(0px,\s*0px\)$/.test(
        await mobile
          .locator(".joystick > i")
          .evaluate((element) => element.style.transform),
      ),
      true,
    );
    const touchSave = await playJourney(mobile, touch, "touch");
    assert.equal(touchSave.ageYears, 7);
    await mobile.getByRole("button", { name: "Back to your journeys" }).tap();
    assert.equal(await mobile.locator("canvas").count(), 0);
    await touchContext.close();
  }

  const portrait = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
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
    keyboard:
      mode === "touch"
        ? "not run in touch-only mode"
        : "two complete era battles through UI controls; equipment, guard, boss gate, memory reveal, age transitions, save/leave/resume",
    touch:
      mode === "keyboard"
        ? "not run in keyboard-only mode"
        : "Chromium emulation 844x390; virtual movement, use, attack, guard and jump; pointer cancellation; two complete eras",
    media:
      mode === "touch"
        ? "not run in touch-only mode"
        : "forced same-origin memory fetch failure produced visible scene/photo recovery states; retry restored artwork",
    authority:
      "read-only GET save assertions confirmed boss/reveal do not change age and absorption advances 0→4→7",
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
} finally {
  await browser.close();
}
