import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import fs from "node:fs/promises";
import { chromium } from "playwright";
import sharp from "sharp";
import { createJourneyDriver } from "./journey-lib.mjs";

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const url = process.env.QUEST_E2E_URL ?? "http://127.0.0.1:4396";
const expectedBundleSha256 =
  process.env.QUEST_E2E_BUNDLE_SHA256 ??
  "718cc412a27bb79d768238f6326f154a0cccb52da555a69ed3ec4ce31173cebe";
const outDir = "test-results/feedback";
const timeoutMs = Number(process.env.QUEST_E2E_TIMEOUT_MS ?? 240_000);
const scenario = process.env.QUEST_E2E_SCENARIO ?? "all";
const sessionId = "20000000-0000-4000-8000-000000000055";
const sessionSecret =
  "feedback-fixture-only-2026-09-11-00000000000000000000000000000000";
const saveIds = {
  friendly: "30000000-0000-4000-8000-000000000051",
  besties: "30000000-0000-4000-8000-000000000052",
  dragon: "30000000-0000-4000-8000-000000000053",
};
const bestiesAssets = {
  pink: {
    path: "/studio/assets/media/bestie-pink/v001/bestie-pink.glb",
    sha256: "0f7020f53ed257dd88e6a8cb9e8fb0011c70e84bf33bc2e55fb671473aea96ae",
  },
  black: {
    path: "/studio/assets/media/bestie-black/v001/bestie-black.glb",
    sha256: "0819c67a17d38f340ace0ebdaff6bd316a800286af7f7a0da91273e898d80f05",
  },
};

assert.ok(Number.isFinite(timeoutMs) && timeoutMs >= 60_000);
assert.ok(
  ["all", "friendly", "dragon", "besties"].includes(scenario),
  `unknown feedback scenario ${scenario}`,
);
await fs.mkdir(outDir, { recursive: true });

function signSession() {
  const signature = createHmac("sha256", sessionSecret)
    .update(sessionId)
    .digest("base64url");
  return `${sessionId}.${signature}`;
}

function installAudioProbe() {
  const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
  let lastGestureAt = 0;
  let nextNodeId = 1;
  const nodeIds = new WeakMap();
  const contexts = [];
  const gains = [];
  const sources = [];
  const connections = [];
  const gestures = [];

  document.addEventListener(
    "pointerdown",
    (event) => {
      lastGestureAt = performance.now();
      gestures.push({
        at: lastGestureAt,
        pointerType: event.pointerType,
        target:
          event.target instanceof Element
            ? event.target.getAttribute("aria-label") ||
              event.target.getAttribute("data-testid") ||
              event.target.tagName
            : "unknown",
      });
    },
    true,
  );

  const idFor = (node, type) => {
    let id = nodeIds.get(node);
    if (!id) {
      id = `${type}-${nextNodeId++}`;
      nodeIds.set(node, id);
    }
    return id;
  };
  const wrapConnect = (node, type) => {
    const id = idFor(node, type);
    const connect = node.connect.bind(node);
    node.connect = (destination, ...args) => {
      const knownDestination = nodeIds.get(destination);
      connections.push({
        from: id,
        to: knownDestination ?? idFor(destination, "node"),
        at: performance.now(),
      });
      return connect(destination, ...args);
    };
    return id;
  };

  const probe = {
    available: Boolean(NativeAudioContext),
    snapshot() {
      return {
        available: this.available,
        gestures: [...gestures],
        contexts: contexts.map((entry) => ({
          id: entry.id,
          state: entry.context.state,
          createdAt: entry.createdAt,
          gestureAtCreation: entry.gestureAtCreation,
          resumes: [...entry.resumes],
          suspends: [...entry.suspends],
          closes: [...entry.closes],
        })),
        gains: gains.map((entry) => ({
          id: entry.id,
          value: entry.node.gain.value,
        })),
        sources: sources.map((entry) => ({
          id: entry.id,
          startedAt: entry.startedAt,
          stoppedAt: entry.stoppedAt,
          bufferDuration: entry.bufferDuration,
          channels: entry.channels,
          playbackRate: entry.node.playbackRate.value,
        })),
        connections: [...connections],
      };
    },
  };
  window.__questAudioProbe = probe;
  if (!NativeAudioContext) return;

  const InstrumentedAudioContext = new Proxy(NativeAudioContext, {
    construct(target, args) {
      const context = Reflect.construct(target, args);
      const contextEntry = {
        id: `context-${contexts.length + 1}`,
        context,
        createdAt: performance.now(),
        gestureAtCreation: lastGestureAt,
        resumes: [],
        suspends: [],
        closes: [],
      };
      contexts.push(contextEntry);
      idFor(context.destination, "destination");

      const createGain = context.createGain.bind(context);
      context.createGain = () => {
        const node = createGain();
        const id = wrapConnect(node, "gain");
        gains.push({ id, node });
        return node;
      };
      const createBufferSource = context.createBufferSource.bind(context);
      context.createBufferSource = () => {
        const node = createBufferSource();
        const id = wrapConnect(node, "source");
        const entry = {
          id,
          node,
          startedAt: null,
          stoppedAt: null,
          bufferDuration: 0,
          channels: 0,
        };
        sources.push(entry);
        const start = node.start.bind(node);
        node.start = (...startArgs) => {
          entry.startedAt = performance.now();
          entry.bufferDuration = node.buffer?.duration ?? 0;
          entry.channels = node.buffer?.numberOfChannels ?? 0;
          return start(...startArgs);
        };
        const stop = node.stop.bind(node);
        node.stop = (...stopArgs) => {
          entry.stoppedAt = performance.now();
          return stop(...stopArgs);
        };
        return node;
      };
      const resume = context.resume.bind(context);
      context.resume = async () => {
        const result = await resume();
        contextEntry.resumes.push({
          at: performance.now(),
          state: context.state,
        });
        return result;
      };
      const suspend = context.suspend.bind(context);
      context.suspend = async () => {
        const result = await suspend();
        contextEntry.suspends.push({
          at: performance.now(),
          state: context.state,
        });
        return result;
      };
      const close = context.close.bind(context);
      context.close = async () => {
        const result = await close();
        contextEntry.closes.push({
          at: performance.now(),
          state: context.state,
        });
        return result;
      };
      return context;
    },
  });
  Object.defineProperty(window, "AudioContext", {
    configurable: true,
    writable: true,
    value: InstrumentedAudioContext,
  });
  if (window.webkitAudioContext) {
    Object.defineProperty(window, "webkitAudioContext", {
      configurable: true,
      writable: true,
      value: InstrumentedAudioContext,
    });
  }
}

async function fetchHashed(path) {
  const response = await fetch(new URL(path, url));
  assert.equal(response.status, 200, `${path} did not load`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    path,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

const indexResponse = await fetch(url);
assert.equal(indexResponse.status, 200, "focused fixture index failed");
const indexHtml = await indexResponse.text();
const bundlePath = indexHtml.match(/src="([^"]+\.js)"/)?.[1];
assert.ok(bundlePath, "fixture bundle path missing");
const bundle = await fetchHashed(bundlePath);
assert.equal(bundle.sha256, expectedBundleSha256, "unexpected client bundle");
const exactAssets = {};
for (const [name, expected] of Object.entries(bestiesAssets)) {
  const fetched = await fetchHashed(expected.path);
  assert.equal(fetched.sha256, expected.sha256, `${name} GLB hash mismatch`);
  exactAssets[name] = fetched;
}

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
const errors = [];
const failedResponses = [];
const assetResponses = [];
const driver = createJourneyDriver({ url, errors });
let cleanupStarted = false;

const closeBrowser = async () => {
  if (cleanupStarted) return;
  cleanupStarted = true;
  await browser.close().catch(() => undefined);
};
const overallTimer = setTimeout(() => {
  console.error(`[feedback] timeout ${timeoutMs}ms exceeded`);
  void closeBrowser().finally(() => process.exit(124));
}, timeoutMs);
overallTimer.unref();
for (const [signal, code] of [
  ["SIGINT", 130],
  ["SIGTERM", 143],
]) {
  process.once(signal, () => {
    void closeBrowser().finally(() => process.exit(code));
  });
}

async function waitFor(predicate, label, timeout = 12_000) {
  const deadline = Date.now() + timeout;
  let latest;
  while (Date.now() < deadline) {
    latest = await predicate();
    if (latest) return latest;
    await delay(60);
  }
  throw new Error(`${label} timed out; latest=${JSON.stringify(latest)}`);
}

async function readSave(page, saveId) {
  const response = await page
    .context()
    .request.get(new URL(`/api/saves/${encodeURIComponent(saveId)}`, url).href);
  assert.equal(response.status(), 200, `save ${saveId} read failed`);
  return response.json();
}

async function waitForSave(page, saveId, predicate, label, timeout = 12_000) {
  let latest;
  return waitFor(
    async () => {
      latest = await readSave(page, saveId);
      return predicate(latest) ? latest : null;
    },
    `${label}; latest save ${JSON.stringify(latest)}`,
    timeout,
  );
}

async function waitForDragonRetaliation(
  page,
  saveId,
  bossId,
  playerHp,
  timeout = 9_000,
) {
  const startedAt = Date.now();
  const samples = [];
  let latestSave;
  while (Date.now() - startedAt < timeout) {
    const [inspection, candidate] = await Promise.all([
      driver.inspectGame(page),
      readSave(page, saveId),
    ]);
    latestSave = candidate;
    const enemy = inspection?.enemies.find((entry) => entry.id === bossId);
    const player = inspection?.status.position;
    if (enemy && player) {
      samples.push({
        elapsedMs: Date.now() - startedAt,
        player,
        enemy: { position: enemy.position, phase: enemy.phase },
        distance: Math.hypot(
          player.x - enemy.position.x,
          player.z - enemy.position.z,
        ),
        playerHp: candidate.adventure.playerHp,
      });
    }
    if (candidate.adventure.playerHp < playerHp)
      return { save: candidate, samples };
    await delay(120);
  }
  throw new Error(
    `V2 dragon retaliation timed out; trace=${JSON.stringify(samples)}; latest=${JSON.stringify(latestSave)}`,
  );
}

async function audioSnapshot(page) {
  return page.evaluate(() => window.__questAudioProbe?.snapshot());
}

async function openCheckpoint(viewport, title) {
  const context = await browser.newContext({
    viewport,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  await context.addInitScript(installAudioProbe);
  await context.addCookies([
    {
      name: "quest_fixture_session",
      value: signSession(),
      url,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    const path = new URL(response.url()).pathname;
    if (response.status() >= 400)
      failedResponses.push({ path, status: response.status() });
    if (Object.values(bestiesAssets).some((asset) => asset.path === path))
      assetResponses.push({ path, status: response.status() });
  });
  await page.goto(url);
  const card = page.locator(".save-card").filter({ hasText: title });
  await card.waitFor();
  await card.tap();
  await page.locator("canvas").waitFor();
  await waitFor(
    async () => (await driver.inspectGame(page))?.status,
    `${title} runtime inspection`,
  );
  const controls = await driver.touchControls(page, context);
  return { context, page, controls };
}

async function screenshot(page, name) {
  const path = `${outDir}/${name}.png`;
  await page.screenshot({ path });
  return path;
}

async function canvasEvidence(page) {
  const image = await page.locator("canvas").screenshot();
  const stats = await sharp(image).stats();
  return {
    bytes: image.byteLength,
    width:
      stats.channels[0]?.min === undefined
        ? 0
        : await sharp(image)
            .metadata()
            .then((m) => m.width),
    height: await sharp(image)
      .metadata()
      .then((m) => m.height),
    entropy: stats.entropy,
    channelDeviation: stats.channels.map((channel) => channel.stdev),
  };
}

async function runFriendlyAndAudio() {
  const { context, page, controls } = await openCheckpoint(
    { width: 820, height: 1180 },
    "Friendly checkpoint",
  );
  const saveId = saveIds.friendly;
  let save = await readSave(page, saveId);
  const friendlyId = save.adventure.activeLevel.friendlies[0].id;
  assert.equal(save.adventure.playerHp, save.adventure.maxPlayerHp);
  assert.equal(save.adventure.activeLevel.friendlies[0].boonClaimed, false);

  await controls.moveUntil(
    "right",
    async () =>
      (await driver.inspectGame(page))?.status.nearFriendlyId === friendlyId,
    "feedback-friendly-range",
  );
  const inRange = await driver.inspectGame(page);
  assert.equal(inRange.status.nearFriendlyId, friendlyId);
  const worldScreenshot = await screenshot(page, "ipad-friendly-world");

  const beforeNormalAttack = save;
  await controls.attack();
  await page
    .getByText("Move closer to a glowing enemy, then attack.", { exact: true })
    .waitFor();
  save = await readSave(page, saveId);
  assert.equal(save.revision, beforeNormalAttack.revision);
  assert.equal(save.adventure.activeLevel.friendlies[0].hp, 4);
  await page
    .getByText("Move closer to a glowing enemy, then attack.", { exact: true })
    .waitFor({ state: "detached", timeout: 4_000 });

  await page.locator(".friendly-prompt").tap();
  let dialog = page.getByRole("dialog", { name: "Blockling" });
  await dialog.waitFor();
  const healthy = dialog.getByRole("button", {
    name: "You’re already healthy",
  });
  assert.equal(await healthy.isDisabled(), true);
  save = await readSave(page, saveId);
  assert.equal(save.adventure.activeLevel.friendlies[0].boonClaimed, false);

  await dialog.getByRole("button", { name: "Hurt this friend…" }).tap();
  await dialog.getByText(/Harming them costs you up to 2 health/).waitFor();
  const confirmScreenshot = await screenshot(
    page,
    "ipad-friendly-harm-confirm",
  );
  const beforeFirstHarmRevision = save.revision;
  await dialog.getByRole("button", { name: "Attack anyway" }).tap();
  save = await waitForSave(
    page,
    saveId,
    (candidate) => candidate.revision > beforeFirstHarmRevision,
    "first friendly harm",
  );
  await dialog.waitFor({ state: "detached" });
  await page
    .getByText(
      "You hurt your friend · −2 health. Make amends to restore their help.",
      { exact: true },
    )
    .waitFor();
  assert.equal(save.adventure.playerHp, 8);
  assert.deepEqual(
    {
      hp: save.adventure.activeLevel.friendlies[0].hp,
      defeated: save.adventure.activeLevel.friendlies[0].defeated,
      penaltyActive: save.adventure.activeLevel.friendlies[0].penaltyActive,
    },
    { hp: 2, defeated: false, penaltyActive: true },
  );
  const audible = await waitFor(async () => {
    const probe = await audioSnapshot(page);
    return probe?.sources.some(
      (source) => source.startedAt !== null && source.bufferDuration > 0,
    )
      ? probe
      : null;
  }, "connected Web Audio source");

  await page.locator(".friendly-prompt").waitFor({ timeout: 4_000 });
  await page.locator(".friendly-prompt").tap();
  dialog = page.getByRole("dialog", { name: "Blockling" });
  await dialog.waitFor();
  await dialog.getByRole("button", { name: "Hurt this friend…" }).tap();
  const beforeDefeatRevision = save.revision;
  await dialog.getByRole("button", { name: "Attack anyway" }).tap();
  save = await waitForSave(
    page,
    saveId,
    (candidate) => candidate.revision > beforeDefeatRevision,
    "friendly defeat",
  );
  await dialog.waitFor({ state: "detached" });
  assert.deepEqual(
    {
      hp: save.adventure.activeLevel.friendlies[0].hp,
      defeated: save.adventure.activeLevel.friendlies[0].defeated,
      penaltyActive: save.adventure.activeLevel.friendlies[0].penaltyActive,
      playerHp: save.adventure.playerHp,
    },
    { hp: 0, defeated: true, penaltyActive: true, playerHp: 8 },
  );
  await page.locator(".friendly-prompt").waitFor({ timeout: 4_000 });
  await page.locator(".friendly-prompt").tap();
  dialog = page.getByRole("dialog", { name: "Blockling" });
  await dialog.getByRole("button", { name: "Make amends" }).waitFor();
  const amendsScreenshot = await screenshot(page, "ipad-friendly-amends");

  const beforeAmendsRevision = save.revision;
  await dialog.getByRole("button", { name: "Make amends" }).tap();
  save = await waitForSave(
    page,
    saveId,
    (candidate) => candidate.revision > beforeAmendsRevision,
    "make amends",
  );
  assert.deepEqual(
    {
      hp: save.adventure.activeLevel.friendlies[0].hp,
      defeated: save.adventure.activeLevel.friendlies[0].defeated,
      penaltyActive: save.adventure.activeLevel.friendlies[0].penaltyActive,
      boonClaimed: save.adventure.activeLevel.friendlies[0].boonClaimed,
    },
    { hp: 4, defeated: false, penaltyActive: false, boonClaimed: false },
  );

  const beforeHealRevision = save.revision;
  await dialog.getByRole("button", { name: "Say hello · +2 health" }).tap();
  save = await waitForSave(
    page,
    saveId,
    (candidate) => candidate.revision > beforeHealRevision,
    "friendly heal",
  );
  assert.equal(save.adventure.playerHp, 10);
  assert.equal(save.adventure.activeLevel.friendlies[0].boonClaimed, true);
  const shared = dialog.getByRole("button", { name: "Gift already shared" });
  await shared.waitFor();
  assert.equal(await shared.isDisabled(), true);
  await dialog.getByRole("button", { name: "Keep exploring" }).tap();

  assert.ok(audible.available, "native Web Audio unavailable");
  assert.equal(audible.contexts.length, 1);
  assert.ok(audible.contexts[0].gestureAtCreation > 0);
  assert.ok(
    audible.contexts[0].createdAt - audible.contexts[0].gestureAtCreation < 100,
    "AudioContext was not created in the touch gesture",
  );
  assert.ok(
    audible.connections.some((connection) =>
      connection.to.startsWith("destination-"),
    ),
    "master gain was not connected to the destination",
  );
  assert.ok(
    audible.sources.some(
      (source) =>
        source.startedAt !== null &&
        source.bufferDuration > 0 &&
        source.channels > 0,
    ),
    "no decoded native source started",
  );
  assert.ok(audible.gains.some((gain) => gain.value > 0));

  const sound = page.getByRole("button", { name: "Mute sound" });
  await sound.tap();
  await page.getByRole("button", { name: "Enable sound" }).waitFor();
  const muted = await audioSnapshot(page);
  assert.equal(muted.gains[0].value, 0);
  assert.deepEqual(
    JSON.parse(
      await page.evaluate(
        () => localStorage.questAudio ?? localStorage.getItem("quest-audio"),
      ),
    ),
    {
      muted: true,
      volume: 0.35,
    },
  );

  await page.getByRole("button", { name: "Enable sound" }).tap();
  await page.getByRole("button", { name: "Mute sound" }).waitFor();
  await waitFor(
    async () => (await audioSnapshot(page)).contexts[0].state === "running",
    "audio resume after unmute",
  );
  const beforePausePosition = (await driver.inspectGame(page)).status.position;
  await page.getByRole("button", { name: "How to play" }).tap();
  const help = page.getByRole("dialog", {
    name: "Explore. Prepare. Face the era.",
  });
  await help.waitFor();
  const paused = await waitFor(async () => {
    const probe = await audioSnapshot(page);
    return probe.contexts[0].state === "suspended" ? probe : null;
  }, "audio pause with modal");
  assert.ok(paused.contexts[0].suspends.length > 0);
  await delay(250);
  assert.deepEqual(
    (await driver.inspectGame(page)).status.position,
    beforePausePosition,
  );
  const volume = help.getByRole("slider", { name: "Sound volume" });
  const volumeBox = await volume.boundingBox();
  assert.ok(volumeBox);
  await volume.tap({
    position: { x: volumeBox.width * 0.75, y: volumeBox.height / 2 },
  });
  const preferences = JSON.parse(
    await page.evaluate(() => localStorage.getItem("quest-audio")),
  );
  assert.equal(preferences.muted, false);
  assert.ok(preferences.volume >= 0.7 && preferences.volume <= 0.8);
  const afterVolume = await audioSnapshot(page);
  assert.ok(Math.abs(afterVolume.gains[0].value - preferences.volume) < 0.001);
  await help.getByRole("button", { name: "Back to the adventure" }).tap();
  await help.waitFor({ state: "detached" });
  await waitFor(
    async () => (await audioSnapshot(page)).contexts[0].state === "running",
    "audio resume after modal close",
  );

  await page.reload();
  const card = page
    .locator(".save-card")
    .filter({ hasText: "Friendly checkpoint" });
  await card.waitFor();
  await card.tap();
  await page.locator("canvas").waitFor();
  const retained = await readSave(page, saveId);
  assert.deepEqual(
    {
      playerHp: retained.adventure.playerHp,
      hp: retained.adventure.activeLevel.friendlies[0].hp,
      defeated: retained.adventure.activeLevel.friendlies[0].defeated,
      penaltyActive: retained.adventure.activeLevel.friendlies[0].penaltyActive,
      boonClaimed: retained.adventure.activeLevel.friendlies[0].boonClaimed,
    },
    {
      playerHp: 10,
      hp: 4,
      defeated: false,
      penaltyActive: false,
      boonClaimed: true,
    },
  );
  await context.close();
  return {
    viewport: { width: 820, height: 1180, touch: true },
    friendId: friendlyId,
    fullHealthGiftRetained: true,
    normalAttackRevisionUnchanged: beforeNormalAttack.revision,
    harm: { firstHp: 2, defeatedHp: 0, playerHpFloorObserved: 8 },
    amends: { hp: 4, penaltyActive: false },
    heal: { playerHp: 10, boonClaimed: true, retainedAfterReload: true },
    audio: {
      unlock: audible.contexts[0],
      connectedSources: audible.sources.length,
      connections: audible.connections,
      muteMasterGain: muted.gains[0].value,
      pauseSuspends: paused.contexts[0].suspends.length,
      volume: preferences.volume,
    },
    screenshots: [worldScreenshot, confirmScreenshot, amendsScreenshot],
  };
}

async function runArchivedDragon() {
  const { context, page, controls } = await openCheckpoint(
    { width: 820, height: 1180 },
    "Archived V2 dragon checkpoint",
  );
  const saveId = saveIds.dragon;
  let save = await readSave(page, saveId);
  assert.equal(save.ageYears, 4);
  assert.equal(save.adventure.catalogVersion, "parody-catalog-v2");
  assert.equal(save.adventure.activeLevel.periodId, "remix-runway-v2");
  const boss = save.adventure.activeLevel.encounters.find(
    (encounter) => encounter.role === "boss",
  );
  assert.equal(boss.content.assetId, "drama-dragon");
  const inspection = await waitFor(async () => {
    const candidate = await driver.inspectGame(page);
    return candidate?.status.nearEncounterId === boss.id ? candidate : null;
  }, "V2 dragon target");

  const attack = page.getByRole("button", { name: "Attack", exact: true });
  const attackBox = await attack.boundingBox();
  assert.ok(attackBox);
  const stickOrigin = controls.point(20, controls.center.x, controls.center.y);
  const stickHeld = controls.point(
    20,
    controls.center.x + 18,
    controls.center.y,
  );
  const attackPoint = controls.point(
    21,
    attackBox.x + attackBox.width / 2,
    attackBox.y + attackBox.height / 2,
  );
  const beforePosition = inspection.status.position;
  const beforeBossHp = boss.hp;
  const beforeRevision = save.revision;
  await controls.send("touchStart", [stickOrigin]);
  await controls.send("touchStart", [stickOrigin, attackPoint]);
  await controls.send("touchMove", [stickHeld, attackPoint]);
  await delay(70);
  await page
    .getByText("Zap!", { exact: true })
    .waitFor({ state: "visible", timeout: 700 });
  const heldAfterAttack = await driver.inspectGame(page);
  assert.ok(heldAfterAttack.input.moveX > 0.3);
  await controls.send("touchEnd", [attackPoint]);
  await delay(170);
  const continued = await driver.inspectGame(page);
  assert.ok(continued.input.moveX > 0.3);
  assert.ok(continued.status.position.x > heldAfterAttack.status.position.x);
  await controls.send("touchEnd", []);
  const beamScreenshot = await screenshot(page, "ipad-v2-dragon-wand");
  save = await waitForSave(
    page,
    saveId,
    (candidate) =>
      candidate.revision > beforeRevision &&
      candidate.adventure.activeLevel.encounters.find(
        (encounter) => encounter.id === boss.id,
      ).hp < beforeBossHp,
    "V2 wand damage",
  );
  const damagedBoss = save.adventure.activeLevel.encounters.find(
    (encounter) => encounter.id === boss.id,
  );
  assert.equal(damagedBoss.hp, beforeBossHp - 3);
  const hpBeforeRetaliation = save.adventure.playerHp;
  const retaliation = await waitForDragonRetaliation(
    page,
    saveId,
    boss.id,
    hpBeforeRetaliation,
    9_000,
  );
  save = retaliation.save;
  const retaliationScreenshot = await screenshot(
    page,
    "ipad-v2-dragon-retaliation",
  );
  assert.equal(save.adventure.playerHp, hpBeforeRetaliation - 4);
  assert.equal(
    save.adventure.activeLevel.encounters.find((entry) => entry.id === boss.id)
      .hp,
    damagedBoss.hp,
  );
  await context.close();
  return {
    viewport: { width: 820, height: 1180, touch: true },
    catalogVersion: save.adventure.catalogVersion,
    periodId: save.adventure.activeLevel.periodId,
    bossAssetId: boss.content.assetId,
    heldJoystick: {
      inputMoveX: heldAfterAttack.input.moveX,
      beforePosition,
      afterPosition: continued.status.position,
    },
    wandDamage: beforeBossHp - damagedBoss.hp,
    retaliationDamage: hpBeforeRetaliation - save.adventure.playerHp,
    retaliationTrace: retaliation.samples,
    screenshots: [beamScreenshot, retaliationScreenshot],
  };
}

async function runBesties() {
  const responseStart = assetResponses.length;
  const { context, page, controls } = await openCheckpoint(
    { width: 390, height: 844 },
    "Besties checkpoint",
  );
  const saveId = saveIds.besties;
  let save = await readSave(page, saveId);
  assert.equal(save.adventure.catalogVersion, "parody-catalog-v3");
  const boss = save.adventure.activeLevel.encounters.find(
    (encounter) => encounter.role === "boss",
  );
  assert.equal(boss.content.assetId, "bickering-besties");

  await controls.moveUntil(
    "backward",
    async () => (await driver.inspectGame(page))?.status.position.z >= -18.6,
    "feedback-besties-safe-position",
    5_000,
    0.55,
  );
  await waitFor(
    async () => {
      const paths = new Set(
        assetResponses
          .slice(responseStart)
          .filter((entry) => entry.status === 200)
          .map((entry) => entry.path),
      );
      return Object.values(bestiesAssets).every((asset) =>
        paths.has(asset.path),
      )
        ? paths
        : null;
    },
    "Besties model responses",
    20_000,
  );
  const loadedInspection = await waitFor(
    async () => {
      const candidate = await driver.inspectGame(page);
      return candidate?.status.mediaLoading === 0 &&
        candidate.status.mediaFailed === 0 &&
        candidate.status.bestiesPhase !== "inactive"
        ? candidate
        : null;
    },
    "Besties media readiness",
    20_000,
  );
  if (loadedInspection.status.bestiesPhase === "dizzy") {
    await waitFor(async () => {
      const candidate = await driver.inspectGame(page);
      return candidate?.status.bestiesPhase === "pink-warning"
        ? candidate
        : null;
    }, "next closed Besties cycle");
  }
  const closedInspection = await driver.inspectGame(page);
  assert.notEqual(closedInspection.status.bestiesPhase, "dizzy");
  const closedScreenshot = await screenshot(page, "phone-besties-hazard");
  const renderedCanvas = await canvasEvidence(page);
  assert.ok(renderedCanvas.bytes > 20_000);
  assert.ok(renderedCanvas.entropy > 1);
  assert.ok(renderedCanvas.channelDeviation.some((value) => value > 10));

  const beforeClosed = save;
  await controls.attack();
  await page
    .getByText("Wait for their missed high-five. Attack when they’re dizzy!", {
      exact: true,
    })
    .waitFor();
  save = await readSave(page, saveId);
  assert.equal(save.revision, beforeClosed.revision);
  assert.equal(
    save.adventure.activeLevel.encounters.find((entry) => entry.id === boss.id)
      .hp,
    boss.hp,
  );

  const dizzy = await waitFor(
    async () => {
      const candidate = await driver.inspectGame(page);
      return candidate?.status.bestiesPhase === "dizzy" ? candidate : null;
    },
    "Besties dizzy window",
    14_000,
  );
  await page
    .getByText("They’re dizzy! Now use your wand!", { exact: true })
    .waitFor();
  const dizzyScreenshot = await screenshot(page, "phone-besties-dizzy");
  const beforeOpenRevision = save.revision;
  const beforeOpenHp = boss.hp;
  await controls.attack();
  await page.getByText("Zap!", { exact: true }).waitFor();
  const openHitScreenshot = await screenshot(page, "phone-besties-open-hit");
  save = await waitForSave(
    page,
    saveId,
    (candidate) =>
      candidate.revision > beforeOpenRevision &&
      candidate.adventure.activeLevel.encounters.find(
        (entry) => entry.id === boss.id,
      ).hp < beforeOpenHp,
    "Besties open-window damage",
  );
  const afterOpenHp = save.adventure.activeLevel.encounters.find(
    (entry) => entry.id === boss.id,
  ).hp;
  await context.close();
  return {
    viewport: { width: 390, height: 844, touch: true },
    catalogVersion: save.adventure.catalogVersion,
    bossAssetId: boss.content.assetId,
    modelResponses: assetResponses.slice(responseStart),
    exactAssets,
    media: {
      loading: loadedInspection.status.mediaLoading,
      failed: loadedInspection.status.mediaFailed,
      canvas: renderedCanvas,
    },
    closedPhase: closedInspection.status.bestiesPhase,
    closedRevisionUnchanged: beforeClosed.revision,
    dizzyPhase: dizzy.status.bestiesPhase,
    openWindowDamage: beforeOpenHp - afterOpenHp,
    screenshots: [closedScreenshot, dizzyScreenshot, openHitScreenshot],
  };
}

let report;
try {
  const friendly =
    scenario === "all" || scenario === "friendly"
      ? await runFriendlyAndAudio()
      : undefined;
  const dragon =
    scenario === "all" || scenario === "dragon"
      ? await runArchivedDragon()
      : undefined;
  const besties =
    scenario === "all" || scenario === "besties"
      ? await runBesties()
      : undefined;
  assert.deepEqual(errors, []);
  assert.deepEqual(failedResponses, []);
  report = {
    date: new Date().toISOString(),
    status: "passed",
    scenario,
    fixture: {
      origin: url,
      storage: "isolated in-memory test harness",
      setup:
        "Three validated saves were advanced to focused checkpoints before browser play with the production reducers. Browser combat and friendly actions used touch UI only.",
      preserved: ["existing port 4395 fixture", "unrelated port 4392 fixture"],
    },
    browser: browser.version(),
    renderer: "headless Chromium with SwiftShader WebGL",
    bundle,
    friendly,
    dragon,
    besties,
    pageErrors: errors,
    failedResponses,
    limits: [
      "Chromium touch emulation is not physical iPad or iPhone Safari.",
      "Web Audio graph, decode, gesture unlock and lifecycle were instrumented; nobody listened to output in this run.",
      "Screenshots and a nonblank canvas check establish rendered output, successful exact model loads and framing, not child usability or device frame time.",
    ],
  };
  await fs.writeFile(
    `${outDir}/report.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  const failure = {
    date: new Date().toISOString(),
    status: "failed",
    message: error instanceof Error ? error.stack : String(error),
    bundle,
    errors,
    failedResponses,
  };
  await fs.writeFile(
    `${outDir}/failure.json`,
    `${JSON.stringify(failure, null, 2)}\n`,
  );
  throw error;
} finally {
  clearTimeout(overallTimer);
  await closeBrowser();
}
