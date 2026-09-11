import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const base = new URL(process.env.QUEST_E2E_URL ?? "http://127.0.0.1:4390")
  .origin;
const repoRoot = path.resolve(process.env.QUEST_REPO_ROOT ?? process.cwd());
const resultsDir = path.resolve(
  process.env.QUEST_E2E_RESULTS_DIR ??
    path.join(process.cwd(), "test-results/era-catalog"),
);
const requiredClips = ["idle", "move", "attack", "hit", "defeat"];
const oneShotClips = new Set(["attack", "hit", "defeat"]);
const pages = [
  {
    id: "blockling",
    manifestId: "blockling",
    modelIds: ["blockling"],
    animated: true,
    touchModelId: "blockling",
  },
  {
    id: "signal-moth",
    manifestId: "signal-moth",
    modelIds: ["signal-moth"],
    animated: true,
  },
  {
    id: "buffer-baron",
    manifestId: "buffer-baron",
    modelIds: ["buffer-baron"],
    animated: true,
  },
  {
    id: "loop-dancer",
    manifestId: "loop-dancer",
    modelIds: ["loop-dancer"],
    animated: true,
  },
  {
    id: "prism-mimic",
    manifestId: "prism-mimic",
    modelIds: ["prism-mimic"],
    animated: true,
  },
  {
    id: "trendweaver",
    manifestId: "trendweaver",
    modelIds: ["trendweaver"],
    animated: true,
  },
  {
    id: "era-equipment",
    manifestId: "era-equipment",
    modelIds: ["spark-mallet", "acorn-shield", "prism-wand", "ribbon-shield"],
    animated: false,
    touchModelId: "spark-mallet",
  },
];

function basename(value) {
  if (typeof value !== "string") return undefined;
  const pathname = value.includes("://") ? new URL(value).pathname : value;
  return decodeURIComponent(pathname.split(/[?#]/)[0].split("/").at(-1));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function manifestAsset(manifest, modelId) {
  if (
    manifest.asset_id === modelId ||
    manifest.catalog_id === modelId ||
    manifest.id === modelId
  ) {
    return manifest;
  }
  const exact = manifest.assets?.[modelId];
  if (exact && typeof exact === "object") return exact;

  const candidates = Object.entries(manifest.assets ?? {}).filter(
    ([key, value]) =>
      key === modelId ||
      value?.asset_id === modelId ||
      value?.catalog_id === modelId ||
      value?.id === modelId,
  );
  assert.equal(
    candidates.length,
    1,
    `${modelId}: manifest has one exact asset record`,
  );
  return candidates[0][1];
}

function normalizeFiles(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).map(([file, declaration]) => ({
    file,
    ...(declaration && typeof declaration === "object" ? declaration : {}),
  }));
}

function manifestFiles(manifest, asset) {
  const files = [
    ...normalizeFiles(asset.files),
    ...normalizeFiles(asset.editable_masters),
  ];
  if (asset !== manifest) {
    files.push(
      ...normalizeFiles(manifest.files),
      ...normalizeFiles(manifest.editable_masters),
    );
  }
  return files;
}

function matchingFile(files, filename, modelId, kind) {
  const pathKeys = [
    "artifact_id",
    "artifact_url",
    "file",
    "local_name",
    "remote_relative_path",
    "repository_path",
    "url",
  ];
  const matches = files.filter((record) =>
    pathKeys.some((key) => basename(record?.[key]) === filename),
  );
  assert.equal(
    matches.length,
    1,
    `${modelId}: manifest has one ${kind} declaration for ${filename}`,
  );
  return matches[0];
}

async function loadRepoManifest(pageSpec) {
  const manifestPath = path.join(
    repoRoot,
    "docs",
    "assets",
    "media",
    pageSpec.manifestId,
    "v001",
    "manifest.json",
  );
  return {
    manifestPath,
    value: JSON.parse(await fs.readFile(manifestPath, "utf8")),
  };
}

function modelDeclaration(manifest, modelId) {
  const asset = manifestAsset(manifest, modelId);
  const filename = `${modelId}.glb`;
  const file = matchingFile(
    manifestFiles(manifest, asset),
    filename,
    modelId,
    "runtime GLB",
  );
  const expected = {
    bytes: file.bytes ?? asset.glb_bytes,
    sha256: file.sha256 ?? asset.glb_sha256,
  };
  assert.ok(
    Number.isSafeInteger(expected.bytes) && expected.bytes > 0,
    `${modelId}: manifest declares positive integer GLB bytes`,
  );
  assert.match(
    expected.sha256 ?? "",
    /^[a-f0-9]{64}$/,
    `${modelId}: manifest declares a SHA-256 GLB hash`,
  );
  return expected;
}

function masterDeclaration(manifest, modelId) {
  const asset = manifestAsset(manifest, modelId);
  const filename = `${modelId}.blend`;
  const file = matchingFile(
    manifestFiles(manifest, asset),
    filename,
    modelId,
    "editable master",
  );
  let declaredUrl = file.artifact_url ?? file.url;
  if (!declaredUrl && file.artifact_id) {
    assert.equal(
      path.posix.isAbsolute(file.artifact_id),
      false,
      `${modelId}: artifact ID is relative`,
    );
    assert.equal(
      file.artifact_id.split("/").includes(".."),
      false,
      `${modelId}: artifact ID stays within its root`,
    );
    declaredUrl = `http://blender-authoring.dev.svc.cluster.local:8000/artifacts/${file.artifact_id}`;
  }
  if (!declaredUrl) {
    const remoteDirectory = asset.remote_directory ?? manifest.remote_directory;
    assert.equal(
      typeof remoteDirectory,
      "string",
      `${modelId}: master declares an artifact URL, ID or remote directory`,
    );
    assert.ok(
      remoteDirectory.startsWith("/workspace/") &&
        !remoteDirectory.split("/").includes(".."),
      `${modelId}: remote directory is a safe /workspace path`,
    );
    declaredUrl = `http://blender-authoring.dev.svc.cluster.local:8000/artifacts/${remoteDirectory.slice("/workspace/".length).replace(/\/$/, "")}/${filename}`;
  }
  const url = new URL(declaredUrl);
  assert.equal(url.protocol, "http:", `${modelId}: internal master uses HTTP`);
  assert.equal(
    url.host,
    "blender-authoring.dev.svc.cluster.local:8000",
    `${modelId}: master uses the declared Blender service`,
  );
  assert.equal(url.username, "", `${modelId}: master URL has no credentials`);
  assert.equal(url.password, "", `${modelId}: master URL has no credentials`);
  assert.equal(url.search, "", `${modelId}: master URL has no query`);
  assert.equal(url.hash, "", `${modelId}: master URL has no fragment`);
  assert.ok(
    url.pathname.startsWith("/artifacts/") && url.pathname.endsWith(".blend"),
    `${modelId}: master uses an /artifacts .blend path`,
  );
  assert.ok(
    Number.isSafeInteger(file.bytes) && file.bytes > 0,
    `${modelId}: manifest declares positive integer master bytes`,
  );
  assert.match(
    file.sha256 ?? "",
    /^[a-f0-9]{64}$/,
    `${modelId}: manifest declares a SHA-256 master hash`,
  );
  return { bytes: file.bytes, sha256: file.sha256, url };
}

async function retrieveMaster(manifest, modelId) {
  const declaration = masterDeclaration(manifest, modelId);
  const response = await fetch(declaration.url, {
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(response.status, 200, `${modelId}: retrieve editable master`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const actual = { bytes: bytes.length, sha256: sha256(bytes) };
  assert.deepEqual(
    actual,
    { bytes: declaration.bytes, sha256: declaration.sha256 },
    `${modelId}: retrieved editable master matches manifest`,
  );
  return {
    artifactPath: declaration.url.pathname,
    bytes: actual.bytes,
    sha256: actual.sha256,
    verified: true,
  };
}

async function waitForModel(viewer, modelId) {
  await viewer.scrollIntoViewIfNeeded();
  await viewer.evaluate(
    (element) =>
      new Promise((resolve, reject) => {
        if (element.loaded) return resolve();
        const timer = setTimeout(
          () => reject(new Error("model-viewer load timeout")),
          20_000,
        );
        element.addEventListener(
          "load",
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
        element.addEventListener(
          "error",
          () => {
            clearTimeout(timer);
            reject(new Error("model-viewer load error"));
          },
          { once: true },
        );
      }),
  );
  await viewer.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const model = await viewer.evaluate((element) => {
    const { x, y, z } = element.getDimensions();
    const canvas = element.shadowRoot?.querySelector("canvas");
    return {
      src: new URL(element.src, location.href).href,
      loaded: element.loaded,
      visible: element.modelIsVisible,
      dimensions: { x, y, z },
      clips: [...element.availableAnimations],
      paused: element.paused,
      renderSurface: canvas
        ? { width: canvas.width, height: canvas.height }
        : undefined,
      webgl: globalThis.__questWebglProbe,
    };
  });
  assert.equal(model.loaded, true, `${modelId}: model-viewer loaded`);
  assert.equal(
    model.visible,
    true,
    `${modelId}: model-viewer model is visible`,
  );
  assert.ok(
    Object.values(model.dimensions).every(
      (value) => Number.isFinite(value) && value > 0,
    ),
    `${modelId}: model has positive finite 3D dimensions`,
  );
  assert.ok(model.renderSurface, `${modelId}: viewer has a canvas surface`);
  assert.ok(
    model.renderSurface.width > 0 && model.renderSurface.height > 0,
    `${modelId}: viewer has a non-empty render surface`,
  );
  assert.ok(
    model.webgl.successfulContexts > 0,
    `${modelId}: model-viewer created a WebGL context`,
  );
  return model;
}

async function inspectVisiblePixels(viewer, modelId) {
  const file = path.join(resultsDir, `${modelId}-viewer-phone.png`);
  const screenshot = await viewer.screenshot({ path: file });
  const metadata = await sharp(screenshot).metadata();
  assert.ok(metadata.width && metadata.height, `${modelId}: viewer screenshot`);
  const insetX = Math.max(1, Math.floor(metadata.width * 0.08));
  const insetY = Math.max(1, Math.floor(metadata.height * 0.08));
  const stats = await sharp(screenshot)
    .extract({
      left: insetX,
      top: insetY,
      width: metadata.width - insetX * 2,
      height: metadata.height - insetY * 2,
    })
    .stats();
  const maxRgbStandardDeviation = Math.max(
    ...stats.channels.slice(0, 3).map((channel) => channel.stdev),
  );
  assert.ok(
    maxRgbStandardDeviation > 4,
    `${modelId}: rendered viewer has varied visible pixels`,
  );
  return { file: path.basename(file), maxRgbStandardDeviation };
}

async function exerciseAnimationControls(page, viewer, modelId) {
  assert.deepEqual(
    [
      ...(await viewer.evaluate((element) => element.availableAnimations)),
    ].sort(),
    [...requiredClips].sort(),
    `${modelId}: exact five animation clips`,
  );
  const controls = page.locator(".studio-model-controls");
  assert.equal(await controls.count(), 1, `${modelId}: one animation control`);
  const select = controls.locator("select");
  const playPause = controls.locator("button");
  assert.deepEqual(
    (await select.locator("option").allTextContents()).sort(),
    [...requiredClips].sort(),
    `${modelId}: control lists exact clips`,
  );
  await viewer.evaluate((element) => {
    const originalPlay = element.play.bind(element);
    element.__questPlayCalls = [];
    element.play = (options) => {
      element.__questPlayCalls.push(
        options?.repetitions === Infinity
          ? "Infinity"
          : (options?.repetitions ?? "default"),
      );
      return originalPlay(options);
    };
  });

  const checks = [];
  for (const clip of requiredClips) {
    await select.selectOption(clip);
    assert.equal(
      await viewer.evaluate((element) => element.animationName),
      clip,
      `${modelId}: ${clip} selected on viewer`,
    );
    assert.equal(await playPause.textContent(), "Play");
    await playPause.click();
    await page.waitForFunction(
      ({ selector, minimum }) => {
        const element = document.querySelector(selector);
        return !element.paused && element.currentTime > minimum;
      },
      { selector: "model-viewer", minimum: 0.04 },
      { timeout: 2_000 },
    );
    const runningTime = await viewer.evaluate((element) => element.currentTime);
    const repetitions = await viewer.evaluate((element) =>
      element.__questPlayCalls.at(-1),
    );
    assert.equal(
      repetitions,
      oneShotClips.has(clip) ? 1 : "Infinity",
      `${modelId}: ${clip} uses ${oneShotClips.has(clip) ? "one-shot" : "repeat"} playback`,
    );
    assert.equal(await playPause.textContent(), "Pause");
    await playPause.click();
    assert.equal(
      await viewer.evaluate((element) => element.paused),
      true,
      `${modelId}: ${clip} pauses`,
    );
    const pausedTime = await viewer.evaluate((element) => element.currentTime);
    await page.waitForTimeout(120);
    const afterPause = await viewer.evaluate((element) => element.currentTime);
    assert.ok(
      Math.abs(afterPause - pausedTime) < 0.025,
      `${modelId}: ${clip} time remains paused`,
    );
    assert.equal(await playPause.textContent(), "Play");
    let finished;
    if (oneShotClips.has(clip)) {
      await playPause.click();
      await page.waitForFunction(
        () =>
          document.querySelector(".studio-model-controls button")
            ?.textContent === "Play",
        undefined,
        { timeout: 8_000 },
      );
      const finishedTime = await viewer.evaluate(
        (element) => element.currentTime,
      );
      await page.waitForTimeout(120);
      const afterFinish = await viewer.evaluate(
        (element) => element.currentTime,
      );
      assert.ok(
        Math.abs(afterFinish - finishedTime) < 0.025,
        `${modelId}: ${clip} holds after one-shot completion`,
      );
      finished = {
        time: finishedTime,
        heldTime: afterFinish,
        playLabel: await playPause.textContent(),
      };
    }
    checks.push({
      clip,
      playback: oneShotClips.has(clip) ? "once" : "repeat",
      repetitions,
      runningTime,
      pausedTime,
      advanced: runningTime > 0.04,
      playLabelAfterPause: await playPause.textContent(),
      finished,
    });
  }
  return checks;
}

async function exerciseTouchOrbit(context, page, viewer, modelId) {
  await viewer.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  const before = await viewer.evaluate((element) => ({
    ...element.getCameraOrbit(),
  }));
  const box = await viewer.boundingBox();
  assert.ok(box, `${modelId}: touch target has bounds`);
  const cdp = await context.newCDPSession(page);
  const start = {
    id: 1,
    x: box.x + box.width * 0.7,
    y: box.y + box.height * 0.5,
    radiusX: 8,
    radiusY: 8,
    force: 1,
  };
  try {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [start],
    });
    for (const fraction of [0.62, 0.54, 0.46, 0.38]) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ ...start, x: box.x + box.width * fraction }],
      });
      await page.waitForTimeout(45);
    }
  } finally {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
  }
  await page.waitForTimeout(250);
  const after = await viewer.evaluate((element) => ({
    ...element.getCameraOrbit(),
  }));
  const changed =
    Math.abs(after.theta - before.theta) > 0.01 ||
    Math.abs(after.phi - before.phi) > 0.01;
  assert.equal(
    changed,
    true,
    `${modelId}: real touch drag changes camera orbit`,
  );
  return { before, after, changed };
}

async function assertPortraitLayout(page, viewer, modelId) {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    true,
    `${modelId}: 390px page has no horizontal overflow`,
  );
  await viewer.scrollIntoViewIfNeeded();
  const box = await viewer.boundingBox();
  assert.ok(box, `${modelId}: viewer has portrait bounds`);
  assert.ok(box.x >= -1, `${modelId}: viewer starts inside portrait width`);
  assert.ok(
    box.x + box.width <= 391,
    `${modelId}: viewer ends inside portrait width`,
  );
  assert.ok(
    Math.abs(box.width - box.height) <= 2,
    `${modelId}: viewer retains its square frame`,
  );
  return box;
}

await fs.mkdir(resultsDir, { recursive: true });
const manifests = new Map();
for (const pageSpec of pages) {
  manifests.set(pageSpec.manifestId, await loadRepoManifest(pageSpec));
}

const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  deviceScaleFactor: 1,
});
await context.addInitScript(() => {
  globalThis.__questWebglProbe = {
    calls: 0,
    successfulContexts: 0,
    types: [],
  };
  for (const constructor of [
    globalThis.HTMLCanvasElement,
    globalThis.OffscreenCanvas,
  ]) {
    if (!constructor) continue;
    const original = constructor.prototype.getContext;
    constructor.prototype.getContext = function (type, ...args) {
      const result = original.call(this, type, ...args);
      if (["webgl", "webgl2", "experimental-webgl"].includes(type)) {
        globalThis.__questWebglProbe.calls++;
        if (result) globalThis.__questWebglProbe.successfulContexts++;
        globalThis.__questWebglProbe.types.push(type);
      }
      return result;
    };
  }
});
const report = {
  date: new Date().toISOString(),
  base,
  repoRoot,
  browser: {
    engine: "Chromium",
    version: browser.version(),
    rendering: "SwiftShader software (requested)",
    viewport: { width: 390, height: 844, hasTouch: true },
  },
  physicalSafari: "not tested",
  pages: [],
  masters: [],
  pageErrors: [],
  consoleErrors: [],
  badResponses: [],
  failedRequests: [],
  externalRequests: [],
};

try {
  for (const pageSpec of pages) {
    const page = await context.newPage();
    page.on("pageerror", (error) =>
      report.pageErrors.push({ page: pageSpec.id, message: error.message }),
    );
    page.on("console", (message) => {
      if (message.type() === "error") {
        report.consoleErrors.push({
          page: pageSpec.id,
          message: message.text(),
        });
      }
    });
    page.on("response", (response) => {
      if (response.status() >= 400) {
        report.badResponses.push({
          page: pageSpec.id,
          status: response.status(),
          url: response.url(),
        });
      }
    });
    page.on("requestfailed", (request) =>
      report.failedRequests.push({
        page: pageSpec.id,
        error: request.failure()?.errorText,
        url: request.url(),
      }),
    );
    page.on("request", (request) => {
      if (new URL(request.url()).origin !== base) {
        report.externalRequests.push({
          page: pageSpec.id,
          method: request.method(),
          url: request.url(),
        });
      }
    });

    const pageUrl = `${base}/studio/assets/reviews/${pageSpec.id}/v001.html`;
    const navigation = await page.goto(pageUrl, {
      waitUntil: "domcontentloaded",
    });
    assert.equal(
      navigation?.status(),
      200,
      `${pageSpec.id}: built review page`,
    );
    assert.equal(
      await page.locator("model-viewer").count(),
      pageSpec.modelIds.length,
      `${pageSpec.id}: exact model-viewer count`,
    );
    assert.equal(
      await page
        .locator("video[autoplay],audio[autoplay],model-viewer[autoplay]")
        .count(),
      0,
      `${pageSpec.id}: no media autoplay`,
    );

    const manifestUrl = `${base}/studio/assets/media/${pageSpec.manifestId}/v001/manifest.json`;
    assert.ok(
      (
        await page
          .locator("a")
          .evaluateAll((links) => links.map((link) => link.href))
      ).includes(manifestUrl),
      `${pageSpec.id}: review links exact manifest`,
    );
    const hostedManifest = await context.request.get(manifestUrl);
    assert.equal(
      hostedManifest.status(),
      200,
      `${pageSpec.id}: hosted manifest`,
    );
    assert.match(
      hostedManifest.headers()["content-type"] ?? "",
      /^application\/json(?:;|$)/i,
      `${pageSpec.id}: hosted manifest JSON MIME`,
    );
    assert.deepEqual(
      await hostedManifest.json(),
      manifests.get(pageSpec.manifestId).value,
      `${pageSpec.id}: built manifest matches repository manifest`,
    );

    const modelLocators = new Map();
    for (const modelId of pageSpec.modelIds) {
      const viewer = page.locator(
        `model-viewer[src$="/${modelId}.glb"], model-viewer[src="${modelId}.glb"]`,
      );
      assert.equal(await viewer.count(), 1, `${modelId}: one exact viewer`);
      modelLocators.set(modelId, viewer);
    }

    const pageResult = {
      id: pageSpec.id,
      url: pageUrl,
      manifest: path.relative(
        repoRoot,
        manifests.get(pageSpec.manifestId).manifestPath,
      ),
      overflow: false,
      models: [],
      touchOrbit: undefined,
      screenshot: `${pageSpec.id}-page-phone.png`,
    };
    for (const modelId of pageSpec.modelIds) {
      const viewer = modelLocators.get(modelId);
      const model = await waitForModel(viewer, modelId);
      assert.equal(
        basename(model.src),
        `${modelId}.glb`,
        `${modelId}: viewer uses exact GLB`,
      );
      assert.equal(
        new URL(model.src).origin,
        base,
        `${modelId}: GLB is same-origin`,
      );
      assert.equal(model.paused, true, `${modelId}: viewer starts paused`);

      const animations = pageSpec.animated
        ? await exerciseAnimationControls(page, viewer, modelId)
        : [];
      if (!pageSpec.animated) {
        assert.deepEqual(
          model.clips,
          [],
          `${modelId}: rigid prop has no clips`,
        );
      }

      const download = await context.request.get(model.src);
      assert.equal(download.status(), 200, `${modelId}: download GLB`);
      assert.match(
        download.headers()["content-type"] ?? "",
        /^(?:model\/gltf-binary|application\/octet-stream)(?:;|$)/i,
        `${modelId}: GLB MIME`,
      );
      const bytes = await download.body();
      const delivery = { bytes: bytes.length, sha256: sha256(bytes) };
      assert.deepEqual(
        delivery,
        modelDeclaration(manifests.get(pageSpec.manifestId).value, modelId),
        `${modelId}: downloaded GLB matches repository manifest`,
      );

      const portrait = await assertPortraitLayout(page, viewer, modelId);
      const pixels = await inspectVisiblePixels(viewer, modelId);
      pageResult.models.push({
        id: modelId,
        src: model.src,
        dimensions: model.dimensions,
        webgl: model.webgl,
        renderSurface: model.renderSurface,
        clips: model.clips,
        animations,
        delivery,
        portrait,
        pixels,
      });
    }
    if (pageSpec.touchModelId) {
      pageResult.touchOrbit = {
        modelId: pageSpec.touchModelId,
        ...(await exerciseTouchOrbit(
          context,
          page,
          modelLocators.get(pageSpec.touchModelId),
          pageSpec.touchModelId,
        )),
      };
    }
    await page.screenshot({
      path: path.join(resultsDir, pageResult.screenshot),
    });
    report.pages.push(pageResult);
    await page.close();
  }

  for (const pageSpec of pages) {
    for (const modelId of pageSpec.modelIds) {
      report.masters.push(
        await retrieveMaster(manifests.get(pageSpec.manifestId).value, modelId),
      );
      report.masters.at(-1).modelId = modelId;
    }
  }

  assert.equal(report.pages.length, 7, "seven review pages audited");
  assert.equal(
    report.pages.reduce((sum, page) => sum + page.models.length, 0),
    10,
    "ten GLB viewers audited",
  );
  assert.equal(
    report.pages.reduce(
      (sum, page) =>
        sum +
        page.models.reduce((clips, model) => clips + model.clips.length, 0),
      0,
    ),
    30,
    "six enemies expose five clips each",
  );
  assert.deepEqual(
    report.pages
      .filter((page) => page.touchOrbit?.changed)
      .map((page) => page.touchOrbit.modelId),
    ["blockling", "spark-mallet"],
    "one enemy and one prop pass touch orbit",
  );
  assert.equal(report.masters.length, 10, "ten editable masters retrieved");
  assert.ok(report.masters.every((master) => master.verified));
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.badResponses, []);
  assert.deepEqual(report.failedRequests, []);
  assert.deepEqual(report.externalRequests, []);

  console.log(
    JSON.stringify({
      pages: report.pages.length,
      models: 10,
      animationClips: 30,
      touchOrbits: 2,
      masters: report.masters.length,
      pageErrors: 0,
      failedRequests: 0,
      externalRequests: 0,
      browser: report.browser,
    }),
  );
} catch (error) {
  report.failure = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  await fs.writeFile(
    path.join(resultsDir, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await browser.close();
}
