import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const base = new URL(process.env.QUEST_E2E_URL ?? "http://127.0.0.1:4173")
  .origin;
const inventory = [
  ["storybook-reference", 0, 0],
  ["traveler-infant", 1, 0, ["idle", "move", "interact"]],
  ["traveler-child", 1, 0, ["idle", "move", "interact", "jump"]],
  ["memory-keepsake", 1, 0],
  ["clearing-path-kit", 3, 0],
  ["clearing-tree", 1, 0],
  ["clearing-stone", 1, 0],
  ["arrival-landmark", 1, 0],
  ["memory-collected", 0, 1],
  ["ability-unlocked", 0, 1],
  ["movement-landed", 0, 1],
  ["ui-confirmed", 0, 1],
];
const touchOrbitPages = new Set(["traveler-child", "memory-keepsake"]);
const mimeByExtension = {
  glb: /^(?:model\/gltf-binary|application\/octet-stream)(?:;|$)/i,
  jpeg: /^image\/jpeg(?:;|$)/i,
  jpg: /^image\/jpeg(?:;|$)/i,
  mp4: /^video\/mp4(?:;|$)/i,
  png: /^image\/png(?:;|$)/i,
  svg: /^image\/svg\+xml(?:;|$)/i,
  wav: /^audio\/(?:wav|wave|x-wav)(?:;|$)/i,
};

function basename(value) {
  if (typeof value !== "string") return undefined;
  const pathname = value.includes("://") ? new URL(value).pathname : value;
  return decodeURIComponent(pathname.split(/[?#]/)[0].split("/").at(-1));
}

function manifestDeclarations(manifest, modelUrl) {
  const modelFile = basename(modelUrl);
  const keys = [
    "local_name",
    "file",
    "url",
    "repository_path",
    "remote_relative_path",
    "artifact_url",
  ];
  const matchesModel = (record) =>
    keys.some((key) => basename(record?.[key]) === modelFile);
  const declarations = [];

  for (const record of Array.isArray(manifest.files) ? manifest.files : []) {
    if (matchesModel(record)) declarations.push(record);
  }
  for (const asset of Object.values(manifest.assets ?? {})) {
    const records = Array.isArray(asset?.files) ? asset.files : [];
    const matches = records.filter(matchesModel);
    declarations.push(...matches);
    if (matches.length > 0 && asset.glb_sha256) {
      declarations.push({ sha256: asset.glb_sha256 });
    }
  }

  return declarations;
}

function assertMediaMime(url, mime) {
  const extension = new URL(url).pathname.split(".").at(-1).toLowerCase();
  assert.match(
    mime,
    mimeByExtension[extension],
    `${url}: expected MIME for .${extension}`,
  );
}

async function exerciseTouchOrbit(context, page, viewer, id) {
  const before = await viewer.evaluate((element) => ({
    ...element.getCameraOrbit(),
  }));
  const box = await viewer.boundingBox();
  assert.ok(box, `${id}: touch target has bounds`);
  const cdp = await context.newCDPSession(page);
  const start = {
    id: 1,
    x: box.x + box.width * 0.68,
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
    for (const fraction of [0.6, 0.52, 0.44, 0.36]) {
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
  assert.equal(changed, true, `${id}: touch drag changes camera orbit`);
  return { before, after, changed };
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
  viewport: { width: 1280, height: 900 },
  hasTouch: true,
});
const evidence = {
  date: new Date().toISOString(),
  base,
  browser: {
    engine: "Chromium",
    version: browser.version(),
    rendering: "SwiftShader software (requested)",
  },
  pages: [],
  pageErrors: [],
  consoleErrors: [],
  badResponses: [],
  externalRequests: [],
  physicalSafari: "not tested",
  audioReview: "browser decoding only; listening not performed",
};
const seenMedia = new Map();
const seenManifests = new Map();
await fs.mkdir("test-results/studio", { recursive: true });

try {
  for (const [id, models, audio, expectedClips] of inventory) {
    const page = await context.newPage();
    page.on("pageerror", (error) =>
      evidence.pageErrors.push({ id, message: error.message }),
    );
    page.on("console", (message) => {
      if (message.type() === "error") {
        evidence.consoleErrors.push({ id, message: message.text() });
      }
    });
    page.on("response", (response) => {
      if (response.status() >= 400) {
        evidence.badResponses.push({
          id,
          status: response.status(),
          url: response.url(),
        });
      }
    });
    page.on("request", (request) => {
      if (new URL(request.url()).origin !== base) {
        evidence.externalRequests.push({ id, url: request.url() });
      }
    });

    const response = await page.goto(
      `${base}/studio/assets/reviews/${id}/v001.html`,
    );
    assert.equal(response.status(), 200, id);
    assert.equal(
      await page.locator("model-viewer").count(),
      models,
      `${id}: required GLB viewers`,
    );
    assert.equal(
      await page.locator("audio").count(),
      audio,
      `${id}: required audio audition`,
    );
    assert.equal(
      await page
        .locator("video[autoplay],audio[autoplay],model-viewer[autoplay]")
        .count(),
      0,
    );
    const report = {
      id,
      models: [],
      audio: [],
      media: [],
      touchOrbit: undefined,
    };

    for (let index = 0; index < models; index++) {
      const viewer = page.locator("model-viewer").nth(index);
      await viewer.scrollIntoViewIfNeeded();
      await viewer.evaluate(
        (element) =>
          new Promise((resolve, reject) => {
            if (element.loaded) return resolve();
            const timer = setTimeout(
              () => reject(new Error("GLB load timeout")),
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
                reject(new Error("GLB load error"));
              },
              { once: true },
            );
          }),
      );
      const model = await viewer.evaluate((element) => ({
        src: element.src,
        poster: element.poster,
        dimensions: element.getDimensions(),
        clips: [...element.availableAnimations],
        paused: element.paused,
      }));
      assert.ok(model.poster, `${id}: model ${index + 1} has a poster`);
      assert.ok(
        Object.values(model.dimensions).every(
          (dimension) => Number.isFinite(dimension) && dimension > 0,
        ),
        `${id}: model ${index + 1} has positive finite dimensions`,
      );
      assert.equal(model.paused, true);
      if (expectedClips) {
        assert.deepEqual(model.clips, expectedClips, `${id}: exact clips`);
      }
      for (const clip of model.clips) {
        await viewer.evaluate((element, name) => {
          element.animationName = name;
          element.currentTime = 0;
          element.play();
        }, clip);
        await page.waitForTimeout(180);
        const running = await viewer.evaluate((element) => ({
          paused: element.paused,
          time: element.currentTime,
        }));
        assert.equal(running.paused, false);
        assert.ok(running.time > 0, `${id}: ${clip} advances`);
        await viewer.evaluate((element) => element.pause());
        const paused = await viewer.evaluate((element) => element.currentTime);
        await page.waitForTimeout(100);
        assert.ok(
          Math.abs(
            (await viewer.evaluate((element) => element.currentTime)) - paused,
          ) < 0.025,
          `${id}: ${clip} remains paused`,
        );
      }
      report.models.push(model);
    }

    const media = await page.locator("main").evaluate((main) => {
      const urls = [];
      for (const node of main.querySelectorAll(
        "img,model-viewer,video,audio,source,a",
      )) {
        const raw = node.getAttribute("src") ?? node.getAttribute("href");
        if (raw && /\.(glb|png|jpg|jpeg|svg|mp4|wav)(?:$|[?#])/i.test(raw)) {
          urls.push(new URL(raw, location.href).href);
        }
        const poster = node.getAttribute("poster");
        if (poster) urls.push(new URL(poster, location.href).href);
      }
      return [...new Set(urls)];
    });
    for (const url of media) {
      assert.equal(new URL(url).origin, base, `${id}: same-origin media`);
      if (!seenMedia.has(url)) {
        const downloaded = await context.request.get(url);
        assert.equal(downloaded.status(), 200, `download ${url}`);
        const bytes = await downloaded.body();
        assert.ok(bytes.length > 0, `${url}: non-empty`);
        const mime = downloaded.headers()["content-type"] ?? "";
        assertMediaMime(url, mime);
        seenMedia.set(url, {
          url,
          bytes: bytes.length,
          mime,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        });
      }
      report.media.push(seenMedia.get(url));
    }

    const pageLinks = await page
      .locator("a")
      .evaluateAll((links) => links.map((link) => link.href));
    for (const model of report.models) {
      const delivery = seenMedia.get(model.src);
      assert.ok(delivery, `${id}: downloaded viewer GLB`);
      const manifestUrl = new URL("manifest.json", model.src).href;
      assert.ok(
        pageLinks.includes(manifestUrl),
        `${id}: review links its exact manifest`,
      );
      if (!seenManifests.has(manifestUrl)) {
        const manifestResponse = await context.request.get(manifestUrl);
        assert.equal(manifestResponse.status(), 200, `download ${manifestUrl}`);
        assert.match(
          manifestResponse.headers()["content-type"] ?? "",
          /^application\/json(?:;|$)/i,
          `${manifestUrl}: JSON MIME`,
        );
        seenManifests.set(manifestUrl, await manifestResponse.json());
      }
      const declarations = manifestDeclarations(
        seenManifests.get(manifestUrl),
        model.src,
      );
      assert.ok(
        declarations.length > 0,
        `${id}: manifest identifies ${basename(model.src)}`,
      );
      for (const declaration of declarations) {
        if (declaration.sha256) {
          assert.equal(
            declaration.sha256,
            delivery.sha256,
            `${id}: delivered GLB matches manifest hash`,
          );
        }
        if (Number.isFinite(declaration.bytes)) {
          assert.equal(
            declaration.bytes,
            delivery.bytes,
            `${id}: delivered GLB matches manifest size`,
          );
        }
      }
      model.delivery = {
        ...delivery,
        manifestUrl,
        declarations: declarations.length,
      };
    }

    for (let index = 0; index < audio; index++) {
      report.audio.push(
        await page
          .locator("audio")
          .nth(index)
          .evaluate(async (player) => {
            const url = player.querySelector("source")?.src ?? player.src;
            const audioContext = new AudioContext();
            try {
              const response = await fetch(url);
              const decoded = await audioContext.decodeAudioData(
                await response.arrayBuffer(),
              );
              return {
                url,
                duration: decoded.duration,
                channels: decoded.numberOfChannels,
                sampleRate: decoded.sampleRate,
                paused: player.paused,
              };
            } finally {
              await audioContext.close();
            }
          }),
      );
      assert.equal(report.audio[index].paused, true);
      assert.ok(report.audio[index].duration > 0);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      true,
      `${id}: portrait overflow`,
    );
    if (models)
      await page.locator("model-viewer").first().scrollIntoViewIfNeeded();
    else if (audio)
      await page.locator("audio").first().scrollIntoViewIfNeeded();
    if (touchOrbitPages.has(id)) {
      report.touchOrbit = await exerciseTouchOrbit(
        context,
        page,
        page.locator("model-viewer").first(),
        id,
      );
    }
    await page.screenshot({ path: `test-results/studio/${id}-phone.png` });
    evidence.pages.push(report);
    await page.close();
  }

  assert.equal(evidence.pages.length, 12);
  assert.equal(
    evidence.pages.reduce((sum, page) => sum + page.models.length, 0),
    9,
  );
  assert.equal(
    evidence.pages.reduce(
      (sum, page) =>
        sum +
        page.models.reduce((clips, model) => clips + model.clips.length, 0),
      0,
    ),
    7,
  );
  assert.equal(
    evidence.pages.reduce((sum, page) => sum + page.audio.length, 0),
    4,
  );
  assert.deepEqual(
    evidence.pages
      .filter((page) => page.touchOrbit?.changed)
      .map((page) => page.id),
    [...touchOrbitPages],
  );
  assert.deepEqual(evidence.pageErrors, []);
  assert.deepEqual(evidence.consoleErrors, []);
  assert.deepEqual(evidence.badResponses, []);
  assert.deepEqual(evidence.externalRequests, []);
  console.log(
    JSON.stringify({
      pages: evidence.pages.length,
      models: 9,
      clips: 7,
      audio: 4,
      touchOrbits: touchOrbitPages.size,
      media: seenMedia.size,
      manifests: seenManifests.size,
      pageErrors: 0,
      browser: evidence.browser,
    }),
  );
} finally {
  await fs.writeFile(
    "test-results/studio/evidence.json",
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
  await browser.close();
}
