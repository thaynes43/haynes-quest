import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { chromium } from "playwright";
import {
  crossShortGap,
  proveLocalRecovery,
  proveModalPause,
  rideFerry,
  waitForInspection,
} from "./obby-helpers.mjs";

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
const saveIds = new WeakMap();

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

async function readSaveEndpoint(page, path) {
  try {
    const response = await page.context().request.get(new URL(path, url).href, {
      timeout: 5_000,
    });
    return {
      status: response.status(),
      body: response.ok() ? await response.json() : null,
    };
  } catch (error) {
    return {
      status: 0,
      body: null,
      error: error instanceof Error ? error.name : "request-failed",
    };
  }
}

async function getSave(page) {
  let saveId = saveIds.get(page);
  if (!saveId) {
    for (let attempt = 0; attempt < 6 && !saveId; attempt += 1) {
      const list = await readSaveEndpoint(page, "/api/saves");
      if (list.status === 200) {
        saveId = list.body.saves.find(
          (item) => item.format === "era-combat-v2",
        )?.id;
        break;
      }
      if (list.status !== 0 && list.status !== 429)
        throw new Error(`save list failed: ${list.status}`);
      await delay(300);
    }
    assert.ok(saveId, "era save missing");
    saveIds.set(page, saveId);
  }
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = await readSaveEndpoint(
      page,
      `/api/saves/${encodeURIComponent(saveId)}`,
    );
    if (result.status === 200) return result.body;
    if (result.status !== 0 && result.status !== 429)
      throw new Error(`save read failed: ${result.status}`);
    await delay(300);
  }
  throw new Error("save reads remained rate limited");
}

async function waitForSave(page, predicate, label, timeout = 12_000) {
  const deadline = Date.now() + timeout;
  let latest;
  while (Date.now() < deadline) {
    latest = await getSave(page);
    if (predicate(latest)) return latest;
    await delay(150);
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
  left: { keys: ["a"], touch: { x: -34, y: 0 } },
  right: { keys: ["d"], touch: { x: 34, y: 0 } },
  forward: { keys: ["w"], touch: { x: 0, y: -34 } },
  backward: { keys: ["s"], touch: { x: 0, y: 34 } },
};

function keyboardControls(page) {
  return {
    kind: "keyboard",
    async nudge(direction, duration) {
      const keys = directions[direction].keys;
      for (const key of keys) await page.keyboard.down(key);
      await delay(duration);
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
          await delay(60);
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
    async jumpForwardUntil(predicate, label, timeout = 8_000) {
      await page.keyboard.down("w");
      await page.keyboard.press("Space", { delay: 70 });
      const deadline = Date.now() + timeout;
      try {
        while (Date.now() < deadline) {
          if (await predicate()) return;
          await delay(40);
        }
      } finally {
        await page.keyboard.up("w");
      }
      await page.screenshot({ path: `test-results/${label}-failure.png` });
      throw new Error(`${label} did not complete with keyboard jump movement`);
    },
    use: () => page.keyboard.press("e", { delay: 70 }),
    attack: () => page.keyboard.press("f", { delay: 55 }),
    guard: () => page.keyboard.press("Shift", { delay: 55 }),
    jump: () => page.keyboard.press("Space", { delay: 55 }),
    async activate(locator) {
      await locator.focus();
      await page.keyboard.press("Enter");
    },
  };
}

async function touchControls(page, context) {
  const cdp = await context.newCDPSession(page);
  const stick = await page.getByTestId("joystick").boundingBox();
  assert.ok(stick);
  const jumpButton = await page
    .getByRole("button", { name: "Jump", exact: true })
    .boundingBox();
  assert.ok(jumpButton);
  const center = {
    x: stick.x + stick.width / 2,
    y: stick.y + stick.height / 2,
  };
  const point = (id, x, y) => ({
    id,
    x,
    y,
    radiusX: 5,
    radiusY: 5,
    force: 1,
  });
  const send = (type, points) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
  return {
    kind: "touch",
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
      await delay(duration);
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
          await delay(60);
        }
      } finally {
        await send("touchEnd", []);
      }
      await page.screenshot({ path: `test-results/${label}-failure.png` });
      throw new Error(
        `${label} was unreachable with touch movement: ${JSON.stringify(await inspectGame(page))}`,
      );
    },
    async jumpForwardUntil(predicate, label, timeout = 8_000) {
      const forward = directions.forward.touch;
      const stickOrigin = point(1, center.x, center.y);
      const stickPoint = point(1, center.x + forward.x, center.y + forward.y);
      const jumpPoint = point(
        2,
        jumpButton.x + jumpButton.width / 2,
        jumpButton.y + jumpButton.height / 2,
      );
      // CDP tracks contacts by id. Establish the joystick at its real center,
      // add Jump as a second contact, then end only Jump so the captured
      // joystick stays held at its moved position.
      await send("touchStart", [stickOrigin]);
      await send("touchStart", [stickOrigin, jumpPoint]);
      await send("touchMove", [stickPoint, jumpPoint]);
      await delay(80);
      await send("touchEnd", [jumpPoint]);
      const deadline = Date.now() + timeout;
      try {
        while (Date.now() < deadline) {
          if (await predicate()) return;
          await delay(40);
        }
      } finally {
        await send("touchEnd", []);
      }
      await page.screenshot({ path: `test-results/${label}-failure.png` });
      throw new Error(`${label} did not complete with touch jump movement`);
    },
    use: () => page.getByRole("button", { name: /Take gear|Remember/ }).tap(),
    attack: () =>
      page.getByRole("button", { name: "Attack", exact: true }).tap(),
    guard: () => page.getByRole("button", { name: "Guard", exact: true }).tap(),
    jump: () => page.getByRole("button", { name: "Jump", exact: true }).tap(),
    activate: (locator) => locator.tap(),
  };
}

async function collectEquipment(page, controls, kind, label) {
  const gearButton = page.getByRole("button", {
    name: "Take gear",
    exact: true,
  });
  let save = await getSave(page);
  const startingInventory = save.adventure.inventory.length;
  const startingInspection = await inspectGame(page);
  assert.ok(startingInspection?.obby, `${label} course unavailable`);
  const startingRecoveries = startingInspection.obby.recoveries;
  for (let step = 0; step < 40; step += 1) {
    if (await gearButton.isEnabled().catch(() => false)) break;
    const inspection = await inspectGame(page);
    assert.ok(inspection, `${label} inspection unavailable`);
    const pickup = inspection.level.pickupPositions.find(
      (candidate) => candidate.kind === kind && !candidate.collected,
    );
    assert.ok(pickup, `${label} ${kind} pickup missing`);
    const deltaX = pickup.x - inspection.status.position.x;
    const deltaZ = pickup.z - inspection.status.position.z;
    if (step % 5 === 0)
      console.log(
        `[journey:${label}] pickup approach step ${step} at ${inspection.status.position.x.toFixed(2)},${inspection.status.position.z.toFixed(2)}`,
      );
    const direction =
      Math.abs(deltaX) > Math.abs(deltaZ)
        ? deltaX < 0
          ? "left"
          : "right"
        : deltaZ < 0
          ? "forward"
          : "backward";
    await controls.nudge(direction, 220);
    const afterStep = await inspectGame(page);
    assert.equal(
      afterStep?.obby?.recoveries,
      startingRecoveries,
      `${label} left the course while approaching ${kind}`,
    );
  }
  assert.equal(
    await gearButton.isEnabled(),
    true,
    `${label} stayed out of reach`,
  );
  await controls.use();
  save = await waitForSave(
    page,
    (candidate) =>
      candidate.adventure.inventory.length === startingInventory + 1,
    `${label}-save`,
  );
  const collected = save.adventure.inventory.filter(
    (item) => item.kind === kind && item.collected,
  );
  assert.ok(collected.length > 0, `${label} did not persist ${kind}`);
  if (kind === "attack-tool")
    assert.equal(
      save.adventure.inventory.find(
        (item) => item.id === save.adventure.equippedId,
      )?.kind,
      "attack-tool",
    );
  return save;
}

function encounterFrom(inspection, encounterId) {
  return inspection?.level.encounterPositions.find(
    (encounter) => encounter.id === encounterId,
  );
}

async function approachEncounter(page, controls, encounterId, label) {
  for (let step = 0; step < 70; step += 1) {
    const inspection = await inspectGame(page);
    assert.ok(inspection, `${label} inspection unavailable`);
    if (inspection.status.nearEncounterId === encounterId) return;
    if (
      await locatorReady(
        page.getByRole("button", { name: "Try this level again" }),
      )
    )
      return;
    const encounter = encounterFrom(inspection, encounterId);
    assert.ok(encounter, `${label} encounter ${encounterId} missing`);
    const deltaX = encounter.x - inspection.status.position.x;
    const deltaZ = encounter.z - inspection.status.position.z;
    if (step % 10 === 0)
      console.log(
        `[journey:${label}] encounter approach step ${step} at ${inspection.status.position.x.toFixed(2)},${inspection.status.position.z.toFixed(2)}`,
      );
    const direction =
      Math.abs(deltaX) > Math.abs(deltaZ)
        ? deltaX < 0
          ? "left"
          : "right"
        : deltaZ < 0
          ? "forward"
          : "backward";
    await controls.nudge(direction, 220);
  }
  await page.screenshot({ path: `test-results/${label}-failure.png` });
  throw new Error(`${label} could not approach encounter ${encounterId}`);
}

async function fightEncounter(page, controls, kind, allowJump, label) {
  const deadline = Date.now() + 120_000;
  let retries = 0;
  let usedGuard = false;
  let initialRemaining;
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
    const expectedId = remaining[0].id;
    const inspection = await inspectGame(page);
    if (inspection?.status.nearEncounterId !== expectedId) {
      await approachEncounter(
        page,
        controls,
        expectedId,
        `${label}-approach-${remaining[0].kind}`,
      );
      continue;
    }
    await targetHint.waitFor({ state: "visible", timeout: 2_000 });

    await controls.guard();
    await delay(150);
    save = await getSave(page);
    usedGuard ||= save.adventure.guardActiveRemainingMs > 0;
    if (allowJump) {
      await controls.jump();
      await delay(45);
    }
    await controls.attack();
    await delay(690);
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

async function waitForRecoveryEnd(page, label) {
  return waitForInspection(
    page,
    inspectGame,
    (inspection) => (inspection.obby?.recoveryRemaining ?? 0) <= 0,
    label,
  );
}

async function proveFirstSweeperRecovery(page, controls, label) {
  return proveLocalRecovery({
    page,
    controls,
    inspectGame,
    getSave,
    label,
    trigger: async (beforeRecoveries) => {
      await controls.moveUntil(
        "forward",
        async () => {
          const inspection = await inspectGame(page);
          return (
            (inspection?.obby?.recoveries ?? 0) > beforeRecoveries ||
            (inspection?.status.position.z ?? 1) <= -3.15
          );
        },
        `${label}-approach`,
      );
    },
  });
}

async function passFirstSweeperSafely(page, controls, label) {
  await waitForRecoveryEnd(page, `${label}-protection`);
  const before = await inspectGame(page);
  assert.ok(before?.obby);
  await controls.moveUntil(
    "right",
    async () => (await inspectGame(page))?.status.position.x >= 5.7,
    `${label}-outside-sweep`,
  );
  await controls.moveUntil(
    "forward",
    async () => (await inspectGame(page))?.status.position.z <= -4.55,
    `${label}-past-sweep`,
  );
  const after = await inspectGame(page);
  assert.equal(
    after?.obby?.recoveries,
    before.obby.recoveries,
    `${label} did not avoid the sweeper on the second attempt`,
  );
  return {
    recoveries: after.obby.recoveries,
    position: after.status.position,
  };
}

async function jumpRunwaySweeper(page, controls, label) {
  const before = await inspectGame(page);
  assert.ok(before?.obby);
  const recoveries = before.obby.recoveries;
  await controls.moveUntil(
    "forward",
    async () => (await inspectGame(page))?.status.position.z <= -11.35,
    `${label}-approach`,
  );
  const takeoff = await inspectGame(page);
  const hazard = takeoff.obby.hazards.find(
    (candidate) => candidate.id === "runway-sweeper",
  );
  assert.ok(hazard, `${label} runway sweeper sample missing`);
  let latest = takeoff;
  let jumpApex = 0;
  await controls.jumpForwardUntil(async () => {
    latest = await inspectGame(page);
    if (!latest?.obby) return false;
    jumpApex = Math.max(jumpApex, latest.status.position.y);
    return (
      (latest.status.grounded && latest.status.position.z <= -12.9) ||
      latest.obby.recoveries > recoveries
    );
  }, `${label}-jump`);
  const landed = latest;
  assert.ok(landed?.obby);
  assert.ok(jumpApex > 0.2, `${label} never took off`);
  assert.equal(
    landed.obby.recoveries,
    recoveries,
    `${label} hit the runway sweeper instead of clearing it`,
  );
  return {
    takeoffPosition: takeoff.status.position,
    hazardAngle: hazard.angle,
    jumpApex,
    landingPosition: landed.status.position,
    recoveries: landed.obby.recoveries,
  };
}

async function playJourney(page, controls, label, testMediaFailure = false) {
  const mark = (stage) => console.log(`[journey:${label}] ${stage}`);
  const obbyEvidence = {
    pause: await proveModalPause({ page, controls, inspectGame, label }),
  };
  mark("intro route and modal pause proved");
  let inspection = await inspectGame(page);
  assert.equal(inspection?.obby?.routeId, "gentle-intro-v1");

  let save = await collectEquipment(
    page,
    controls,
    "attack-tool",
    `${label}-era-1-attack-tool`,
  );
  mark("first attack tool collected");
  assert.equal(save.ageYears, 0);
  assert.equal(
    save.adventure.activeLevel.encounters.find((enemy) => enemy.role === "boss")
      .available,
    false,
  );
  obbyEvidence.firstHazardRecovery = await proveFirstSweeperRecovery(
    page,
    controls,
    `${label}-era-1-hazard-recovery`,
  );
  mark("first hazard recovery proved");
  assert.equal(obbyEvidence.firstHazardRecovery.checkpointId, "start");
  obbyEvidence.firstHazardPass = await passFirstSweeperSafely(
    page,
    controls,
    `${label}-era-1-hazard-pass`,
  );
  mark("first hazard safe pass proved");
  await collectEquipment(
    page,
    controls,
    "guard-tool",
    `${label}-era-1-guard-tool`,
  );
  mark("first guard tool collected");

  mark("approaching first-era ordinary-a");
  const ordinaryOneA = await fightEncounter(
    page,
    controls,
    "ordinary-a",
    false,
    `${label}-era-1-ordinary-a`,
  );
  mark("first-era ordinary-a defeated");
  await leaveAndResume(page, ordinaryOneA.save);
  mark("first-era checkpoint save resumed");
  mark("approaching first-era ordinary-b");
  const ordinaryOneB = await fightEncounter(
    page,
    controls,
    "ordinary-b",
    false,
    `${label}-era-1-ordinary-b`,
  );
  mark("first-era ordinary encounters defeated");
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
  mark("first boss defeated");
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
  mark("first memories revealed; age advanced 0 to 4");
  assert.equal(save.completed, false);
  assert.equal(save.adventure.activeLevel.eraYear, 2024);
  assert.equal(save.adventure.completedLevelIds.length, 1);
  await page.getByRole("button", { name: "Enter the next era" }).click();
  assert.equal(
    await page.getByRole("button", { name: "Jump", exact: true }).isEnabled(),
    true,
  );
  inspection = await inspectGame(page);
  assert.equal(inspection?.obby?.routeId, "gentle-jump-v1");

  await collectEquipment(
    page,
    controls,
    "attack-tool",
    `${label}-era-2-attack-tool`,
  );
  obbyEvidence.missedGapRecovery = await proveLocalRecovery({
    page,
    controls,
    inspectGame,
    getSave,
    label: `${label}-era-2-gap-recovery`,
    trigger: async (beforeRecoveries) => {
      await controls.moveUntil(
        "forward",
        async () =>
          ((await inspectGame(page))?.obby?.recoveries ?? 0) > beforeRecoveries,
        `${label}-era-2-walk-off-gap`,
      );
    },
  });
  assert.equal(obbyEvidence.missedGapRecovery.checkpointId, "start");
  await waitForRecoveryEnd(page, `${label}-era-2-gap-protection`);
  obbyEvidence.firstGap = await crossShortGap({
    page,
    controls,
    inspectGame,
    edgeZ: -2.85,
    checkpointId: "first-clearing",
    label: `${label}-era-2-first-gap`,
  });
  mark("missed jump recovery and first checkpoint jump proved");
  await collectEquipment(
    page,
    controls,
    "guard-tool",
    `${label}-era-2-guard-tool`,
  );
  const ordinaryTwoA = await fightEncounter(
    page,
    controls,
    "ordinary-a",
    true,
    `${label}-era-2-ordinary-a`,
  );
  mark("second-era first ordinary encounter defeated");
  obbyEvidence.secondGap = await crossShortGap({
    page,
    controls,
    inspectGame,
    edgeZ: -8.95,
    checkpointId: "second-clearing",
    label: `${label}-era-2-second-gap`,
  });
  obbyEvidence.runwaySweeper = await jumpRunwaySweeper(
    page,
    controls,
    `${label}-era-2-runway-sweeper`,
  );
  mark("second gap and runway sweeper jump proved");
  const ordinaryTwoB = await fightEncounter(
    page,
    controls,
    "ordinary-b",
    true,
    `${label}-era-2-ordinary-b`,
  );
  mark("second-era second ordinary encounter defeated");
  assert.equal(ordinaryTwoA.usedGuard || ordinaryTwoB.usedGuard, true);
  obbyEvidence.ferry = await rideFerry({
    page,
    controls,
    inspectGame,
    label: `${label}-era-2-ferry`,
  });
  mark("moving ferry ride and boss checkpoint proved");
  await leaveAndResume(page, ordinaryTwoB.save);
  const bossTwo = await fightEncounter(
    page,
    controls,
    "boss",
    true,
    `${label}-era-2-boss`,
  );
  mark("second boss defeated");
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
  mark("journey complete; age advanced 4 to 7");
  return { save, obbyEvidence };
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
    const page = await start(desktop);
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
  if (forcedExitCode === null) throw error;
} finally {
  clearTimeout(overallTimer);
  process.off("SIGINT", onInterrupt);
  process.off("SIGTERM", onTerminate);
  cleanupStarted = true;
  await browser.close();
}
if (forcedExitCode !== null) process.exit(forcedExitCode);
