import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const allIds = [
  "mister-hiss",
  "peel-patrol",
  "drama-dragon",
  "sir-flush-a-lot",
  "nap-captain",
  "one-star-diva",
];
// Default audits cover the four completed playtest assets; archived IDs remain opt-in.
const defaultIds = [
  "mister-hiss",
  "peel-patrol",
  "drama-dragon",
  "sir-flush-a-lot",
];
const requestedIds = (process.env.QUEST_PARODY_IDS ?? defaultIds.join(","))
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
assert.ok(requestedIds.length > 0, "at least one parody asset is selected");
assert.equal(
  new Set(requestedIds).size,
  requestedIds.length,
  "parody asset selection has no duplicates",
);
for (const id of requestedIds) {
  assert.ok(allIds.includes(id), `unknown parody asset ID: ${id}`);
}

const base = new URL(process.env.QUEST_E2E_URL ?? "http://127.0.0.1:4392")
  .origin;
const repoRoot = path.resolve(process.env.QUEST_REPO_ROOT ?? process.cwd());
const resultsDir = path.resolve(
  process.env.QUEST_E2E_RESULTS_DIR ??
    path.join(process.cwd(), "test-results/parody-catalog"),
);
const evidenceDir = process.env.QUEST_E2E_EVIDENCE_DIR
  ? path.resolve(process.env.QUEST_E2E_EVIDENCE_DIR)
  : undefined;
const overallTimeoutMs = Number(
  process.env.QUEST_E2E_OVERALL_TIMEOUT_MS ?? 240_000,
);
assert.ok(
  Number.isSafeInteger(overallTimeoutMs) && overallTimeoutMs >= 30_000,
  "overall timeout is an integer of at least 30 seconds",
);

const requiredClips = ["idle", "move", "attack", "hit", "defeat"];
const oneShotClips = new Set(["attack", "hit", "defeat"]);
const expectedVideos = [...requiredClips, "animations", "turntable"].map(
  (name) => `${name}.mp4`,
);
const expectedStills = [
  "concept.png",
  "beauty.png",
  "front.png",
  "side.png",
  "back.png",
];

function basename(value) {
  if (typeof value !== "string") return undefined;
  const pathname = value.includes("://") ? new URL(value).pathname : value;
  return decodeURIComponent(pathname.split(/[?#]/)[0].split("/").at(-1));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function publicRequestLocation(value) {
  const url = new URL(value);
  return url.origin === base ? url.pathname : `${url.origin}${url.pathname}`;
}

function normalizeFiles(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).map(([file, declaration]) => ({
    file,
    ...(declaration && typeof declaration === "object" ? declaration : {}),
  }));
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

function manifestFiles(manifest, asset) {
  const files = [
    ...normalizeFiles(asset.files),
    ...normalizeFiles(asset.editable_masters),
  ];
  if (asset.editable_master && typeof asset.editable_master === "object") {
    files.push(asset.editable_master);
  }
  if (asset !== manifest) {
    files.push(
      ...normalizeFiles(manifest.files),
      ...normalizeFiles(manifest.editable_masters),
    );
    if (
      manifest.editable_master &&
      typeof manifest.editable_master === "object"
    ) {
      files.push(manifest.editable_master);
    }
  }
  return files;
}

function matchingFile(files, filename, modelId, kind) {
  const pathKeys = [
    "artifact_id",
    "artifact_url",
    "file",
    "local_name",
    "remote_path",
    "remote_relative_path",
    "repository_path",
    "url",
  ];
  const matches = files.filter((record) =>
    pathKeys.some((key) => basename(record?.[key]) === filename),
  );
  const unique = matches.filter(
    (record, index) =>
      matches.findIndex(
        (candidate) =>
          (candidate.artifact_url ?? candidate.url ?? candidate.remote_path) ===
            (record.artifact_url ?? record.url ?? record.remote_path) &&
          candidate.sha256 === record.sha256,
      ) === index,
  );
  assert.equal(
    unique.length,
    1,
    `${modelId}: manifest has one ${kind} declaration for ${filename}`,
  );
  return unique[0];
}

async function loadRepoManifest(modelId) {
  const manifestPath = path.join(
    repoRoot,
    "docs",
    "assets",
    "media",
    modelId,
    "v001",
    "manifest.json",
  );
  return {
    manifestPath,
    value: JSON.parse(await fs.readFile(manifestPath, "utf8")),
  };
}

function fileDeclaration(manifest, modelId, filename, kind) {
  const asset = manifestAsset(manifest, modelId);
  const file = matchingFile(
    manifestFiles(manifest, asset),
    filename,
    modelId,
    kind,
  );
  const bytes = file.bytes ?? asset.glb_bytes ?? manifest.glb_bytes;
  const digest = file.sha256 ?? asset.glb_sha256 ?? manifest.glb_sha256;
  assert.ok(
    Number.isSafeInteger(bytes) && bytes > 0,
    `${modelId}: manifest declares positive integer bytes for ${filename}`,
  );
  assert.match(
    digest ?? "",
    /^[a-f0-9]{64}$/,
    `${modelId}: manifest declares a SHA-256 hash for ${filename}`,
  );
  return { bytes, sha256: digest, record: file };
}

function masterDeclaration(manifest, modelId) {
  const declaration = fileDeclaration(
    manifest,
    modelId,
    `${modelId}.blend`,
    "editable master",
  );
  const file = declaration.record;
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
  if (!declaredUrl && file.remote_path) {
    assert.ok(
      file.remote_path.startsWith("/workspace/") &&
        !file.remote_path.split("/").includes(".."),
      `${modelId}: remote master path is safe`,
    );
    declaredUrl = `http://blender-authoring.dev.svc.cluster.local:8000/artifacts/${file.remote_path.slice("/workspace/".length)}`;
  }
  if (!declaredUrl) {
    const asset = manifestAsset(manifest, modelId);
    const remoteDirectory = asset.remote_directory ?? manifest.remote_directory;
    assert.equal(
      typeof remoteDirectory,
      "string",
      `${modelId}: master declares an artifact URL, ID, path or directory`,
    );
    assert.ok(
      remoteDirectory.startsWith("/workspace/") &&
        !remoteDirectory.split("/").includes(".."),
      `${modelId}: remote directory is a safe /workspace path`,
    );
    declaredUrl = `http://blender-authoring.dev.svc.cluster.local:8000/artifacts/${remoteDirectory.slice("/workspace/".length).replace(/\/$/, "")}/${modelId}.blend`;
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
  return { bytes: declaration.bytes, sha256: declaration.sha256, url };
}

function inspectGlb(bytes, modelId) {
  assert.ok(bytes.length >= 20, `${modelId}: GLB has a complete header`);
  assert.equal(
    bytes.readUInt32LE(0),
    0x46546c67,
    `${modelId}: GLB magic is valid`,
  );
  assert.equal(bytes.readUInt32LE(4), 2, `${modelId}: GLB version is 2`);
  assert.equal(
    bytes.readUInt32LE(8),
    bytes.length,
    `${modelId}: GLB declared length matches delivery`,
  );
  const jsonLength = bytes.readUInt32LE(12);
  assert.equal(
    bytes.readUInt32LE(16),
    0x4e4f534a,
    `${modelId}: first GLB chunk is JSON`,
  );
  let jsonEnd = 20 + jsonLength;
  while (jsonEnd > 20 && bytes[jsonEnd - 1] <= 32) jsonEnd -= 1;
  const document = JSON.parse(bytes.subarray(20, jsonEnd).toString("utf8"));
  const externalUris = [...(document.buffers ?? []), ...(document.images ?? [])]
    .map((entry) => entry.uri)
    .filter((uri) => typeof uri === "string" && !uri.startsWith("data:"));
  assert.deepEqual(
    externalUris,
    [],
    `${modelId}: GLB has no external buffers or textures`,
  );
  assert.ok(
    (document.images?.length ?? 0) > 0,
    `${modelId}: GLB contains an embedded texture image`,
  );
  assert.ok(
    document.images.every(
      (image) =>
        Number.isSafeInteger(image.bufferView) ||
        image.uri?.startsWith("data:"),
    ),
    `${modelId}: every texture image is embedded`,
  );
  assert.ok(
    (document.textures?.length ?? 0) > 0,
    `${modelId}: GLB declares at least one texture`,
  );
  return {
    images: document.images.length,
    textures: document.textures.length,
    externalUris,
  };
}

async function closeBrowser() {
  if (!browser || !browser.isConnected()) return;
  await browser.close().catch(() => {});
}

async function retrieveMaster(manifest, modelId) {
  const declaration = masterDeclaration(manifest, modelId);
  const signal = AbortSignal.any([
    overallController.signal,
    AbortSignal.timeout(60_000),
  ]);
  const response = await fetch(declaration.url, {
    redirect: "error",
    signal,
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
    modelId,
    artifactPath: declaration.url.pathname,
    ...actual,
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
  assert.equal(model.visible, true, `${modelId}: model is visible`);
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
      const heldTime = await viewer.evaluate((element) => element.currentTime);
      assert.ok(
        Math.abs(heldTime - finishedTime) < 0.025,
        `${modelId}: ${clip} holds after one-shot completion`,
      );
      finished = {
        time: finishedTime,
        heldTime,
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
    await cdp
      .send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      })
      .catch(() => {});
    await cdp.detach().catch(() => {});
  }
  await page.waitForTimeout(250);
  const after = await viewer.evaluate((element) => ({
    ...element.getCameraOrbit(),
  }));
  const changed =
    Math.abs(after.theta - before.theta) > 0.01 ||
    Math.abs(after.phi - before.phi) > 0.01;
  assert.equal(changed, true, `${modelId}: touch drag changes camera orbit`);
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

async function inspectPageStills(page, modelId) {
  const expectedPaths = expectedStills.map(
    (filename) => `/studio/assets/media/${modelId}/v001/${filename}`,
  );
  const stills = await page.locator(".md-content img").evaluateAll((images) =>
    images.map((image) => ({
      path: new URL(image.currentSrc || image.src, location.href).pathname,
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    })),
  );
  assert.deepEqual(
    stills.map((still) => still.path),
    expectedPaths,
    `${modelId}: page displays the exact five expected stills`,
  );
  assert.ok(
    stills.every(
      (still) =>
        still.complete && still.naturalWidth > 0 && still.naturalHeight > 0,
    ),
    `${modelId}: all review stills decode`,
  );
  const posterPaths = await page
    .locator("model-viewer[poster], video[poster]")
    .evaluateAll((elements) =>
      elements.map(
        (element) => new URL(element.poster, location.href).pathname,
      ),
    );
  assert.deepEqual(
    posterPaths.sort(),
    [
      `/studio/assets/media/${modelId}/v001/front.png`,
      `/studio/assets/media/${modelId}/v001/motion-grid.png`,
    ].sort(),
    `${modelId}: model and reel posters use the expected stills`,
  );
  return { stills, posterPaths };
}

async function decodeMp4(page, bytes, modelId, filename) {
  return page.evaluate(
    async ({ encoded, label }) => {
      const binary = atob(encoded);
      const data = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        data[index] = binary.charCodeAt(index);
      }
      const objectUrl = URL.createObjectURL(
        new Blob([data], { type: "video/mp4" }),
      );
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.style.cssText =
        "position:fixed;width:2px;height:2px;left:0;bottom:0;opacity:.01";
      document.body.append(video);
      const event = (name, timeout = 10_000) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error(`${label}: ${name} timeout`)),
            timeout,
          );
          const onError = () => {
            clearTimeout(timer);
            reject(
              new Error(
                `${label}: media error ${video.error?.code ?? "unknown"}`,
              ),
            );
          };
          video.addEventListener(
            name,
            () => {
              clearTimeout(timer);
              video.removeEventListener("error", onError);
              resolve();
            },
            { once: true },
          );
          video.addEventListener("error", onError, { once: true });
        });
      try {
        video.src = objectUrl;
        video.load();
        if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
          await event("loadedmetadata");
        }
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          await event("loadeddata");
        }
        if (
          !Number.isFinite(video.duration) ||
          video.duration <= 0 ||
          video.videoWidth <= 0 ||
          video.videoHeight <= 0
        ) {
          throw new Error(`${label}: invalid decoded metadata`);
        }
        const framePromise = new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error(`${label}: decoded frame timeout`)),
            10_000,
          );
          if (typeof video.requestVideoFrameCallback !== "function") {
            clearTimeout(timer);
            reject(
              new Error(`${label}: requestVideoFrameCallback unavailable`),
            );
            return;
          }
          video.requestVideoFrameCallback((_now, metadata) => {
            clearTimeout(timer);
            resolve({
              mediaTime: metadata.mediaTime,
              presentedFrames: metadata.presentedFrames,
            });
          });
        });
        await video.play();
        const frame = await framePromise;
        const minimumTime = Math.min(0.04, video.duration / 4);
        const deadline = performance.now() + 10_000;
        while (video.currentTime <= minimumTime && !video.ended) {
          if (performance.now() > deadline) {
            throw new Error(`${label}: playback did not advance`);
          }
          await new Promise(requestAnimationFrame);
        }
        return {
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          currentTime: video.currentTime,
          readyState: video.readyState,
          frame,
          decoded: frame.presentedFrames > 0,
        };
      } finally {
        video.pause();
        video.removeAttribute("src");
        video.load();
        video.remove();
        URL.revokeObjectURL(objectUrl);
      }
    },
    { encoded: bytes.toString("base64"), label: `${modelId}/${filename}` },
  );
}

async function verifyVideos(context, page, manifest, modelId) {
  const pageReferences = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        ".md-content a[href], .md-content source[src]",
      ),
    ]
      .map(
        (element) =>
          new URL(element.href || element.src, location.href).pathname,
      )
      .filter((pathname) => pathname.endsWith(".mp4")),
  );
  const results = [];
  for (const filename of expectedVideos) {
    const pathname = `/studio/assets/media/${modelId}/v001/${filename}`;
    const pageReferenced = pageReferences.includes(pathname);
    if (filename !== "turntable.mp4") {
      assert.ok(
        pageReferenced,
        `${modelId}: review page references ${filename}`,
      );
    }
    const declaration = fileDeclaration(
      manifest,
      modelId,
      filename,
      "review MP4",
    );
    const response = await context.request.get(`${base}${pathname}`);
    assert.equal(response.status(), 200, `${modelId}: download ${filename}`);
    assert.match(
      response.headers()["content-type"] ?? "",
      /^video\/mp4(?:;|$)/i,
      `${modelId}: ${filename} has video/mp4 MIME`,
    );
    const bytes = await response.body();
    const delivery = { bytes: bytes.length, sha256: sha256(bytes) };
    assert.deepEqual(
      delivery,
      { bytes: declaration.bytes, sha256: declaration.sha256 },
      `${modelId}: ${filename} matches manifest`,
    );
    const decoded = await decodeMp4(page, bytes, modelId, filename);
    assert.equal(decoded.decoded, true, `${modelId}: ${filename} decodes`);
    results.push({ filename, pageReferenced, ...delivery, ...decoded });
  }
  return results;
}

async function writeReport() {
  await fs.mkdir(resultsDir, { recursive: true });
  await fs.writeFile(
    path.join(resultsDir, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  if (!evidenceDir || report.failure) return;
  await fs.mkdir(evidenceDir, { recursive: true });
  for (const page of report.pages) {
    await fs.copyFile(
      path.join(resultsDir, page.screenshot),
      path.join(evidenceDir, page.screenshot),
    );
  }
  const sanitized = {
    date: report.date,
    sourceCommit: report.sourceCommit,
    selectedIds: report.selectedIds,
    browser: report.browser,
    physicalSafari: report.physicalSafari,
    pages: report.pages.map((page) => ({
      id: page.id,
      url: page.url,
      manifest: page.manifest,
      model: page.model,
      videos: page.videos,
      stills: page.stills,
      touchOrbit: page.touchOrbit,
      screenshot: page.screenshot,
    })),
    masters: report.masters,
    diagnostics: {
      pageErrors: report.pageErrors.length,
      consoleErrors: report.consoleErrors.length,
      badResponses: report.badResponses.length,
      failedRequests: report.failedRequests.length,
      expectedMetadataAborts: report.expectedMetadataAborts.length,
      externalRequests: report.externalRequests.length,
    },
  };
  await fs.writeFile(
    path.join(evidenceDir, "report.json"),
    `${JSON.stringify(sanitized, null, 2)}\n`,
  );
}

await fs.mkdir(resultsDir, { recursive: true });
const manifests = new Map();
for (const modelId of requestedIds) {
  manifests.set(modelId, await loadRepoManifest(modelId));
}

const overallController = new AbortController();
let browser;
let receivedSignal;
const stop = (reason) => {
  if (!overallController.signal.aborted) {
    overallController.abort(new Error(reason));
  }
  void closeBrowser();
};
const signalHandlers = new Map(
  ["SIGINT", "SIGTERM"].map((signal) => [
    signal,
    () => {
      receivedSignal = signal;
      stop(`received ${signal}`);
    },
  ]),
);
for (const [signal, handler] of signalHandlers) {
  process.once(signal, handler);
}
const overallTimer = setTimeout(
  () => stop(`overall timeout after ${overallTimeoutMs}ms`),
  overallTimeoutMs,
);

const report = {
  date: new Date().toISOString(),
  base,
  repoRoot,
  sourceCommit: process.env.QUEST_SOURCE_COMMIT ?? "not supplied",
  selectedIds: requestedIds,
  defaultIds,
  browser: undefined,
  physicalSafari: "not tested",
  pages: [],
  masters: [],
  pageErrors: [],
  consoleErrors: [],
  badResponses: [],
  failedRequests: [],
  expectedMetadataAborts: [],
  externalRequests: [],
};

try {
  browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  report.browser = {
    engine: "Chromium",
    version: browser.version(),
    rendering: "SwiftShader software (requested)",
    viewport: { width: 390, height: 844, hasTouch: true, deviceScaleFactor: 1 },
  };
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
    globalThis.__questLoadedMetadata = [];
    document.addEventListener(
      "loadedmetadata",
      (event) => {
        if (!(event.target instanceof HTMLVideoElement)) return;
        const source =
          event.target.currentSrc ||
          event.target.querySelector("source")?.src ||
          event.target.src;
        if (source?.startsWith(location.origin)) {
          globalThis.__questLoadedMetadata.push(new URL(source).pathname);
        }
      },
      true,
    );
    for (const constructor of [
      globalThis.HTMLCanvasElement,
      globalThis.OffscreenCanvas,
    ]) {
      if (!constructor) continue;
      const original = constructor.prototype.getContext;
      constructor.prototype.getContext = function (type, ...args) {
        const result = original.call(this, type, ...args);
        if (["webgl", "webgl2", "experimental-webgl"].includes(type)) {
          globalThis.__questWebglProbe.calls += 1;
          if (result) globalThis.__questWebglProbe.successfulContexts += 1;
          globalThis.__questWebglProbe.types.push(type);
        }
        return result;
      };
    }
  });

  for (const modelId of requestedIds) {
    if (overallController.signal.aborted) {
      throw overallController.signal.reason;
    }
    const page = await context.newPage();
    const successfulMetadataMedia = new Map();
    const observedFailedRequests = [];
    page.on("pageerror", (error) =>
      report.pageErrors.push({ page: modelId, message: error.message }),
    );
    page.on("console", (message) => {
      if (message.type() === "error") {
        report.consoleErrors.push({ page: modelId, message: message.text() });
      }
    });
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (
        response.status() < 400 &&
        response.request().resourceType() === "media" &&
        url.origin === base &&
        url.pathname.endsWith(".mp4")
      ) {
        successfulMetadataMedia.set(response.url(), response.status());
      }
      if (response.status() >= 400) {
        report.badResponses.push({
          page: modelId,
          status: response.status(),
          url: publicRequestLocation(response.url()),
        });
      }
    });
    page.on("requestfailed", (request) => {
      observedFailedRequests.push({
        page: modelId,
        error: request.failure()?.errorText,
        url: request.url(),
        resourceType: request.resourceType(),
      });
    });
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (["http:", "https:"].includes(url.protocol) && url.origin !== base) {
        report.externalRequests.push({
          page: modelId,
          method: request.method(),
          url: publicRequestLocation(request.url()),
        });
      }
    });

    const pageUrl = `${base}/studio/assets/reviews/${modelId}/v001.html`;
    const navigation = await page.goto(pageUrl, {
      waitUntil: "domcontentloaded",
    });
    assert.equal(navigation?.status(), 200, `${modelId}: built review page`);
    assert.equal(
      await page.locator("model-viewer").count(),
      1,
      `${modelId}: one model-viewer`,
    );
    assert.equal(
      await page
        .locator("video[autoplay], audio[autoplay], model-viewer[autoplay]")
        .count(),
      0,
      `${modelId}: no media autoplay`,
    );

    const manifestUrl = `${base}/studio/assets/media/${modelId}/v001/manifest.json`;
    assert.ok(
      (
        await page
          .locator("a")
          .evaluateAll((links) => links.map((link) => link.href))
      ).includes(manifestUrl),
      `${modelId}: review links exact manifest`,
    );
    const hostedManifest = await context.request.get(manifestUrl);
    assert.equal(hostedManifest.status(), 200, `${modelId}: hosted manifest`);
    assert.match(
      hostedManifest.headers()["content-type"] ?? "",
      /^application\/json(?:;|$)/i,
      `${modelId}: hosted manifest JSON MIME`,
    );
    assert.deepEqual(
      await hostedManifest.json(),
      manifests.get(modelId).value,
      `${modelId}: hosted manifest matches repository manifest`,
    );

    const viewer = page.locator(
      `model-viewer[src$="/${modelId}.glb"], model-viewer[src="${modelId}.glb"]`,
    );
    assert.equal(await viewer.count(), 1, `${modelId}: one exact viewer`);
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
    const animations = await exerciseAnimationControls(page, viewer, modelId);
    const download = await context.request.get(model.src);
    assert.equal(download.status(), 200, `${modelId}: download GLB`);
    assert.match(
      download.headers()["content-type"] ?? "",
      /^(?:model\/gltf-binary|application\/octet-stream)(?:;|$)/i,
      `${modelId}: GLB MIME`,
    );
    const modelBytes = await download.body();
    const delivery = { bytes: modelBytes.length, sha256: sha256(modelBytes) };
    const declaration = fileDeclaration(
      manifests.get(modelId).value,
      modelId,
      `${modelId}.glb`,
      "runtime GLB",
    );
    assert.deepEqual(
      delivery,
      { bytes: declaration.bytes, sha256: declaration.sha256 },
      `${modelId}: downloaded GLB matches repository manifest`,
    );
    const embedded = inspectGlb(modelBytes, modelId);
    const portrait = await assertPortraitLayout(page, viewer, modelId);
    const pixels = await inspectVisiblePixels(viewer, modelId);
    const stills = await inspectPageStills(page, modelId);
    const videos = await verifyVideos(
      context,
      page,
      manifests.get(modelId).value,
      modelId,
    );
    const touchOrbit = await exerciseTouchOrbit(context, page, viewer, modelId);
    const screenshot = `${modelId}-page-phone.png`;
    await page.screenshot({
      path: path.join(resultsDir, screenshot),
      fullPage: true,
    });

    for (const failure of observedFailedRequests) {
      const url = new URL(failure.url);
      let mediaState;
      if (
        failure.error === "net::ERR_ABORTED" &&
        failure.resourceType === "media" &&
        url.origin === base &&
        url.pathname.endsWith(".mp4") &&
        successfulMetadataMedia.has(failure.url)
      ) {
        mediaState = await page
          .locator("video")
          .evaluateAll((videos, pathname) => {
            const player = videos.find((video) => {
              const source =
                video.currentSrc ||
                video.querySelector("source")?.src ||
                video.src;
              return (
                source && new URL(source, location.href).pathname === pathname
              );
            });
            return player
              ? {
                  readyState: player.readyState,
                  errorCode: player.error?.code ?? null,
                  loadedMetadata:
                    globalThis.__questLoadedMetadata.includes(pathname),
                }
              : undefined;
          }, url.pathname);
      }
      if (
        mediaState?.loadedMetadata === true &&
        mediaState.readyState >= 1 &&
        mediaState.errorCode === null
      ) {
        report.expectedMetadataAborts.push({
          page: modelId,
          error: failure.error,
          path: url.pathname,
          responseStatus: successfulMetadataMedia.get(failure.url),
          ...mediaState,
        });
      } else {
        report.failedRequests.push({
          page: modelId,
          error: failure.error,
          path: publicRequestLocation(failure.url),
          resourceType: failure.resourceType,
          responseStatus: successfulMetadataMedia.get(failure.url),
          mediaState,
        });
      }
    }

    report.pages.push({
      id: modelId,
      url: new URL(pageUrl).pathname,
      manifest: path.relative(repoRoot, manifests.get(modelId).manifestPath),
      model: {
        src: new URL(model.src).pathname,
        dimensions: model.dimensions,
        renderSurface: model.renderSurface,
        webgl: model.webgl,
        clips: model.clips,
        animations,
        delivery,
        embedded,
        portrait,
        pixels,
      },
      stills,
      videos,
      touchOrbit,
      screenshot,
    });
    await page.close();
  }

  for (const modelId of requestedIds) {
    if (overallController.signal.aborted) {
      throw overallController.signal.reason;
    }
    report.masters.push(
      await retrieveMaster(manifests.get(modelId).value, modelId),
    );
  }

  assert.equal(
    report.pages.length,
    requestedIds.length,
    "every selected review page was audited",
  );
  assert.equal(
    report.pages.reduce((sum, page) => sum + page.model.clips.length, 0),
    requestedIds.length * requiredClips.length,
    "every selected model exposes five clips",
  );
  assert.equal(
    report.pages.reduce((sum, page) => sum + page.videos.length, 0),
    requestedIds.length * expectedVideos.length,
    "every selected page has seven decoded MP4s",
  );
  assert.ok(report.pages.every((page) => page.touchOrbit.changed));
  assert.equal(
    report.masters.length,
    requestedIds.length,
    "every selected main editable master was retrieved",
  );
  assert.ok(report.masters.every((master) => master.verified));
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.badResponses, []);
  assert.deepEqual(report.failedRequests, []);
  assert.deepEqual(report.externalRequests, []);

  console.log(
    JSON.stringify({
      pages: report.pages.length,
      models: report.pages.length,
      animationClips: report.pages.length * requiredClips.length,
      decodedMp4s: report.pages.length * expectedVideos.length,
      touchOrbits: report.pages.length,
      masters: report.masters.length,
      pageErrors: 0,
      consoleErrors: 0,
      failedRequests: 0,
      expectedMetadataAborts: report.expectedMetadataAborts.length,
      externalRequests: 0,
      browser: report.browser,
    }),
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  report.failure = overallController.signal.aborted
    ? (overallController.signal.reason?.message ?? "audit aborted")
    : message.split("\n", 1)[0];
  console.error(report.failure);
  process.exitCode =
    receivedSignal === "SIGINT" ? 130 : receivedSignal ? 143 : 1;
} finally {
  clearTimeout(overallTimer);
  for (const [signal, handler] of signalHandlers) {
    process.removeListener(signal, handler);
  }
  await closeBrowser();
  await writeReport();
}
