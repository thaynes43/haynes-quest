import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";

const baseUrl = process.env.QUEST_E2E_URL ?? "http://127.0.0.1:4390";
const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});

const report = {
  browser: await browser.version(),
  previewImages: 0,
  attacks: 0,
  releasedImages: 0,
  savedMediaResponses: 0,
  photoCanvasUploads: 0,
  sceneAutomaticRetries: 0,
  imageManualRetries: 0,
  avatarRequests: 0,
  expectedRequestFailures: 0,
  expectedConsoleMessages: 0,
  unexpected: [],
};

function sanitize(message) {
  return String(message)
    .replace(/\/api\/saves\/[^/\s]+/g, "/api/saves/[save]")
    .replace(/\/media\/[^?\s]+/g, "/media/[memory]")
    .replace(/blob:[^\s)]+/g, "blob:[document-origin]");
}

function observe(page, injected) {
  page.on("pageerror", (error) => {
    report.unexpected.push(`pageerror: ${sanitize(error.message)}`);
  });
  page.on("requestfailed", (request) => {
    if (injected.has(request)) report.expectedRequestFailures++;
    else
      report.unexpected.push(
        `requestfailed: ${request.resourceType()} ${sanitize(request.failure()?.errorText)}`,
      );
  });
  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") return;
    const value = message.text();
    if (
      value.includes("net::ERR_FAILED") ||
      value.includes("PCFSoftShadowMap has been removed")
    ) {
      report.expectedConsoleMessages++;
      return;
    }
    report.unexpected.push(`console ${message.type()}: ${sanitize(value)}`);
  });
}

async function installUploadProbe(context) {
  await context.addInitScript(() => {
    const uploaded = new WeakSet();
    globalThis.__questMediaProbe = {
      photoCanvasUploads: 0,
      photoCanvasDimensions: [],
    };
    for (const constructor of [
      globalThis.WebGLRenderingContext,
      globalThis.WebGL2RenderingContext,
    ]) {
      if (!constructor) continue;
      for (const method of ["texImage2D", "texSubImage2D"]) {
        const original = constructor.prototype[method];
        constructor.prototype[method] = function (...args) {
          const source = args.find(
            (value) =>
              value instanceof HTMLCanvasElement && value.width === 512,
          );
          const result = original.apply(this, args);
          if (source && !uploaded.has(source)) {
            uploaded.add(source);
            globalThis.__questMediaProbe.photoCanvasUploads++;
            globalThis.__questMediaProbe.photoCanvasDimensions.push([
              source.width,
              source.height,
            ]);
          }
          return result;
        };
      }
    }
  });
}

async function openFixtureJourney(page) {
  await page.goto(baseUrl);
  await page.getByRole("button", { name: "Start a journey" }).click();
  await page.getByRole("button", { name: "Preview memories" }).click();
  const images = page.locator(".memory-choice img");
  await images.first().waitFor();
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll(".memory-choice img")].length === 3 &&
      [...document.querySelectorAll(".memory-choice img")].every(
        (image) =>
          image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
      ),
  );
  const decoded = await images.evaluateAll((items) =>
    items.map((image) => ({
      complete: image.complete,
      width: image.naturalWidth,
      height: image.naturalHeight,
    })),
  );
  assert.equal(decoded.length, 3);
  assert.ok(
    decoded.every(
      (image) => image.complete && image.width > 0 && image.height > 0,
    ),
  );
  assert.equal(await page.locator(".memory-image-unavailable").count(), 0);
  await page.getByRole("button", { name: "Begin your journey" }).click();
  await page.locator("canvas[data-quest-canvas=true]").waitFor();
  return decoded.length;
}

async function getOnlySave(page) {
  return page.evaluate(async () => {
    const listResponse = await fetch("/api/saves", {
      credentials: "same-origin",
    });
    if (!listResponse.ok)
      throw new Error(`save list failed: ${listResponse.status}`);
    const list = await listResponse.json();
    if (list.saves.length !== 1)
      throw new Error(`expected one save, got ${list.saves.length}`);
    const response = await fetch(`/api/saves/${list.saves[0].id}`, {
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error(`save read failed: ${response.status}`);
    return response.json();
  });
}

async function applyAction(page, save, action) {
  const result = await page.evaluate(
    async ({ saveId, body }) => {
      const response = await fetch(`/api/saves/${saveId}/actions`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-Quest-Request": "1",
        },
        body: JSON.stringify(body),
      });
      const value = await response.json();
      return { ok: response.ok, status: response.status, value };
    },
    {
      saveId: save.id,
      body: {
        actionId: randomUUID(),
        expectedRevision: save.revision,
        action,
      },
    },
  );
  assert.equal(
    result.ok,
    true,
    `game action failed with ${result.status}: ${result.value?.error?.code ?? "unknown"}`,
  );
  return result.value;
}

async function releaseFirstBundle(page, initial) {
  let save = initial;
  const level = save.adventure.activeLevel;
  const attackTool = level.pickups.find(
    (pickup) => pickup.kind === "attack-tool",
  );
  assert.ok(attackTool);
  save = await applyAction(page, save, {
    type: "collect-equipment",
    levelId: level.id,
    pickupId: attackTool.pickupId,
  });
  let attacks = 0;
  for (const original of level.encounters) {
    while (true) {
      const encounter = save.adventure.activeLevel.encounters.find(
        (candidate) => candidate.id === original.id,
      );
      if (encounter.defeated) break;
      save = await applyAction(page, save, {
        type: "attack",
        levelId: level.id,
        encounterId: encounter.id,
      });
      attacks++;
      await page.waitForTimeout(675);
    }
  }
  assert.equal(attacks, 9);
  assert.equal(save.adventure.phase, "memory-released");
  return { save, attacks };
}

async function runPhotoDelivery() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await installUploadProbe(context);
  const injected = new WeakSet();
  const sceneAttempts = new Map();
  let interceptSavedMedia = false;
  let failedImageUrl;
  let allowFailedImage = false;
  await context.route("**/api/saves/*/media/*", async (route, request) => {
    if (!interceptSavedMedia) return route.continue();
    if (request.resourceType() === "fetch") {
      const attempts = (sceneAttempts.get(request.url()) ?? 0) + 1;
      sceneAttempts.set(request.url(), attempts);
      if (attempts <= 2) {
        injected.add(request);
        return route.abort("failed");
      }
    }
    if (request.resourceType() === "image") {
      failedImageUrl ??= request.url();
      if (request.url() === failedImageUrl && !allowFailedImage) {
        injected.add(request);
        return route.abort("failed");
      }
    }
    return route.continue();
  });
  const page = await context.newPage();
  observe(page, injected);
  report.previewImages = await openFixtureJourney(page);
  const released = await releaseFirstBundle(page, await getOnlySave(page));
  report.attacks = released.attacks;
  const releasedMedia = released.save.memories.filter(
    (memory) => memory.state === "released" && memory.mediaUrl,
  );
  assert.equal(releasedMedia.length, 2);
  report.releasedImages = releasedMedia.length;

  interceptSavedMedia = true;
  await page.reload();
  await page.locator(".save-card").click();
  await page.locator("canvas[data-quest-canvas=true]").waitFor();

  const manualRetry = page.getByRole("button", {
    name: "Try the picture again",
  });
  await manualRetry.waitFor({ timeout: 12_000 });
  assert.equal(
    await manualRetry
      .locator(
        "xpath=ancestor::*[contains(@class, 'memory-image-unavailable')]",
      )
      .count(),
    1,
  );
  allowFailedImage = true;
  await manualRetry.click();
  report.imageManualRetries++;
  await page.waitForFunction(
    (count) =>
      document.querySelectorAll(".victory-memory .memory-image.is-loaded img")
        .length === count,
    releasedMedia.length,
    { timeout: 12_000 },
  );

  await page.waitForFunction(
    (count) => globalThis.__questMediaProbe.photoCanvasUploads >= count,
    releasedMedia.length,
    { timeout: 12_000 },
  );
  const probe = await page.evaluate(() => globalThis.__questMediaProbe);
  assert.ok(
    probe.photoCanvasDimensions.every(
      ([width, height]) => width === 512 && height > 0,
    ),
  );
  report.photoCanvasUploads = probe.photoCanvasUploads;
  report.sceneAutomaticRetries = [...sceneAttempts.values()].reduce(
    (sum, attempts) => sum + Math.min(2, attempts - 1),
    0,
  );
  assert.equal(report.sceneAutomaticRetries, releasedMedia.length * 2);
  assert.equal(await page.locator(".media-warning").count(), 0);
  assert.equal(await page.getByText("This picture couldn’t load.").count(), 0);

  const mediaChecks = await page.evaluate(
    async (paths) =>
      Promise.all(
        paths.map(async (path) => {
          const response = await fetch(path, {
            credentials: "same-origin",
            cache: "no-store",
          });
          const blob = await response.blob();
          return {
            ok: response.ok,
            status: response.status,
            image:
              response.headers.get("content-type")?.startsWith("image/") ??
              false,
            bytes: blob.size,
          };
        }),
      ),
    releasedMedia.map((memory) => memory.mediaUrl),
  );
  assert.ok(
    mediaChecks.every(
      (result) =>
        result.ok && result.status === 200 && result.image && result.bytes > 0,
    ),
  );
  report.savedMediaResponses = mediaChecks.length;
  await context.close();
}

async function runAvatarRetry() {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const injected = new WeakSet();
  let blockAvatar = true;
  let avatarRequests = 0;
  await context.route("**/traveler-infant/**/*.glb", async (route, request) => {
    avatarRequests++;
    if (blockAvatar) {
      injected.add(request);
      return route.abort("failed");
    }
    return route.continue();
  });
  const page = await context.newPage();
  observe(page, injected);
  await openFixtureJourney(page);
  const retry = page.getByRole("button", { name: "Retry artwork" });
  await retry.waitFor({ timeout: 8_000 });
  assert.equal(avatarRequests, 1);
  blockAvatar = false;
  await retry.evaluate((button) => {
    button.click();
    button.click();
  });
  await page.waitForFunction(
    () => !document.querySelector(".media-warning"),
    undefined,
    { timeout: 12_000 },
  );
  await page.waitForTimeout(500);
  assert.equal(
    avatarRequests,
    2,
    "a double retry must start only one replacement GLB request",
  );
  report.avatarRequests = avatarRequests;
  await context.close();
}

try {
  await runPhotoDelivery();
  await runAvatarRetry();
  assert.deepEqual(report.unexpected, []);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
