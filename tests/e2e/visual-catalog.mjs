import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium, request as playwrightRequest } from "playwright";

const repoRoot = path.resolve(process.env.QUEST_REPO_ROOT ?? process.cwd());
const catalogUrl = new URL(
  process.env.QUEST_CATALOG_URL ?? "http://127.0.0.1:4394/assets/catalog.html",
);
const resultsDir = path.resolve(
  process.env.QUEST_E2E_RESULTS_DIR ??
    path.join(repoRoot, "test-results/visual-catalog"),
);
const inventoryPath = path.resolve(
  process.env.QUEST_CATALOG_INVENTORY ??
    path.join(repoRoot, "scripts/assets/catalog-inventory.json"),
);
const overallTimeoutMs = Number(
  process.env.QUEST_E2E_OVERALL_TIMEOUT_MS ?? 240_000,
);

assert.ok(
  ["http:", "https:"].includes(catalogUrl.protocol),
  "catalog URL uses HTTP or HTTPS",
);
assert.ok(
  Number.isSafeInteger(overallTimeoutMs) && overallTimeoutMs >= 30_000,
  "overall timeout is an integer of at least 30 seconds",
);

const viewports = [
  { name: "desktop", width: 1440, height: 1000, hasTouch: false },
  { name: "phone", width: 390, height: 844, hasTouch: true },
];
const requiredNapClips = ["idle", "move", "attack", "hit", "defeat"];
const modelMime = /^(?:model\/gltf-binary|application\/octet-stream)(?:;|$)/i;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function pathValue(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return undefined;
  return (
    value.path ?? value.repository_path ?? value.file ?? value.url ?? value.src
  );
}

function mediaRecords(value) {
  return asArray(value)
    .map((entry) => {
      if (typeof entry === "string") return { path: entry };
      if (!entry || typeof entry !== "object") return undefined;
      return { ...entry, path: pathValue(entry) };
    })
    .filter((entry) => typeof entry?.path === "string");
}

function normalizeInventory(value) {
  const source = Array.isArray(value)
    ? value
    : (value.assets ?? value.entries ?? value.items);
  assert.ok(Array.isArray(source), "catalog inventory has an assets array");

  const assets = source.map((entry, index) => {
    assert.ok(entry && typeof entry === "object", `inventory entry ${index}`);
    const id = entry.id ?? entry.stable_id ?? entry.asset_id;
    const reviewRecord =
      entry.review && typeof entry.review === "object"
        ? entry.review
        : undefined;
    let review =
      pathValue(reviewRecord) ??
      entry.review_path ??
      entry.review_url ??
      (typeof entry.review === "string" ? entry.review : undefined);
    const reviewAnchor = reviewRecord?.anchor ?? entry.review_anchor;
    if (review && reviewAnchor && !review.includes("#")) {
      review = `${review}#${reviewAnchor}`;
    }

    const models = mediaRecords(
      entry.models ?? entry.model_files ?? entry.model ?? entry.glb,
    ).map((model) => ({
      ...model,
      sha256: model.sha256 ?? entry.checksums?.[model.path],
    }));
    const audio = mediaRecords(
      entry.audio ?? entry.audio_files ?? entry.auditions ?? entry.wav,
    );
    const inspirationImages = mediaRecords(
      entry.inspiration_images ??
        entry.concept_images ??
        entry.concepts ??
        entry.inspiration,
    );
    const modelImages = mediaRecords(
      entry.model_images ?? entry.renders ?? entry.model_render,
    );
    const thumbnail =
      pathValue(entry.thumbnail ?? entry.preview) ??
      modelImages[0]?.path ??
      inspirationImages[0]?.path;

    assert.match(id ?? "", /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `entry ${index} ID`);
    assert.equal(typeof review, "string", `${id}: review path`);
    return {
      ...entry,
      id,
      review,
      models,
      audio,
      inspirationImages,
      modelImages,
      thumbnail,
      stateText:
        typeof entry.state === "string"
          ? entry.state
          : (entry.state?.label ?? entry.status ?? ""),
    };
  });

  assert.equal(
    new Set(assets.map((entry) => entry.id)).size,
    assets.length,
    "inventory stable IDs are unique",
  );
  return assets;
}

function sitePrefix() {
  const marker = "/assets/catalog.html";
  assert.ok(
    catalogUrl.pathname.endsWith(marker),
    `catalog URL ends with ${marker}`,
  );
  return catalogUrl.pathname.slice(0, -marker.length);
}

function repositoryPathToUrl(value) {
  assert.equal(typeof value, "string", "repository path is a string");
  if (/^https?:\/\//i.test(value)) return new URL(value);

  const [rawPath, rawFragment] = value.split("#", 2);
  let publicPath = rawPath.replace(/^\.\//, "");
  if (publicPath.startsWith("docs/")) publicPath = publicPath.slice(5);
  if (publicPath.endsWith(".md")) {
    publicPath = `${publicPath.slice(0, -3)}.html`;
  }
  const prefix = sitePrefix();
  const url = new URL(
    `${prefix}/${publicPath.replace(/^\/+/, "")}`.replace(/\/{2,}/g, "/"),
    catalogUrl.origin,
  );
  if (rawFragment !== undefined) url.hash = rawFragment;
  return url;
}

function comparableUrl(value) {
  const url = new URL(value, catalogUrl.href);
  url.search = "";
  return url.href;
}

function publicLocation(value) {
  const url = new URL(value);
  return url.origin === catalogUrl.origin
    ? `${url.pathname}${url.search}${url.hash}`
    : url.href;
}

function serializeError(error) {
  if (!(error instanceof Error)) return { message: String(error) };
  return { name: error.name, message: error.message, stack: error.stack };
}

function attachDiagnostics(page, report, scope, expectedAbortContext) {
  page.on("pageerror", (error) => {
    report.pageErrors.push({ scope, message: error.message });
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      report.consoleErrors.push({ scope, message: message.text() });
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      report.badResponses.push({
        scope,
        status: response.status(),
        url: publicLocation(response.url()),
      });
    }
  });
  page.on("requestfailed", (request) => {
    const failure = {
      scope,
      resourceType: request.resourceType(),
      error: request.failure()?.errorText,
      url: publicLocation(request.url()),
    };
    const expectedMetadataAbort =
      failure.resourceType === "media" &&
      failure.error === "net::ERR_ABORTED" &&
      expectedAbortContext?.activity &&
      expectedAbortContext.metadataOnlyUrls.has(comparableUrl(request.url()));
    if (expectedMetadataAbort) {
      report.expectedMetadataAborts.push({
        ...failure,
        during: expectedAbortContext.activity,
      });
    } else {
      report.failedRequests.push(failure);
    }
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== catalogUrl.origin) {
      report.externalRequests.push({
        scope,
        resourceType: request.resourceType(),
        url: url.href,
      });
    }
  });
}

async function waitForImages(page, locator, label) {
  const count = await locator.count();
  assert.ok(count > 0, `${label}: at least one image`);
  for (let index = 0; index < count; index += 1) {
    const image = locator.nth(index);
    await image.scrollIntoViewIfNeeded();
    await image.evaluate(async (element) => {
      if (!element.complete) {
        await new Promise((resolve) => {
          element.addEventListener("load", resolve, { once: true });
          element.addEventListener("error", resolve, { once: true });
        });
      }
      await element.decode().catch(() => {});
    });
  }
  const inspections = await locator.evaluateAll((images) =>
    images.map((image) => ({
      alt: image.alt,
      complete: image.complete,
      height: image.naturalHeight,
      src: image.currentSrc || image.src,
      width: image.naturalWidth,
    })),
  );
  for (const image of inspections) {
    assert.equal(image.complete, true, `${label}: image completed`);
    assert.ok(
      image.width > 0 && image.height > 0,
      `${label}: ${publicLocation(image.src)} decoded`,
    );
    assert.equal(
      new URL(image.src).origin,
      catalogUrl.origin,
      `${label}: image is hosted locally`,
    );
    assert.ok(image.alt.trim(), `${label}: thumbnail has alt text`);
  }
  return inspections.map((image) => ({
    ...image,
    src: publicLocation(image.src),
  }));
}

function cardTitleLink(card) {
  return card.locator(
    ":scope :is(h2,h3,h4) a[href]:not(.headerlink), :scope a.catalog-title[href]",
  );
}

async function inspectLanding(browser, inventory, viewport, report) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    hasTouch: viewport.hasTouch,
    deviceScaleFactor: 1,
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(30_000);
  const scope = `catalog-${viewport.name}`;
  attachDiagnostics(page, report, scope);
  const heavyLandingRequests = [];
  page.on("request", (browserRequest) => {
    if (/\.(?:glb|wav)(?:$|[?#])/i.test(browserRequest.url())) {
      heavyLandingRequests.push(publicLocation(browserRequest.url()));
    }
  });

  try {
    const navigation = await page.goto(catalogUrl.href, {
      waitUntil: "networkidle",
    });
    assert.equal(navigation?.status(), 200, `${scope}: catalog response`);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      true,
      `${scope}: no horizontal page overflow`,
    );

    const jumpLinks = page.locator('.catalog-jumps a[href^="#"]');
    assert.ok(await jumpLinks.count(), `${scope}: category jump navigation`);
    const jumps = await jumpLinks.evaluateAll((links) =>
      links.map((link) => ({
        href: link.getAttribute("href"),
        text: link.textContent,
      })),
    );
    for (const jump of jumps) {
      assert.ok(jump.text?.trim(), `${scope}: category jump has text`);
      assert.equal(
        await page.evaluate(
          (id) => Boolean(document.getElementById(decodeURIComponent(id))),
          jump.href.slice(1),
        ),
        true,
        `${scope}: ${jump.href} target exists`,
      );
    }

    const grid = page.locator(".catalog-grid");
    assert.ok(await grid.count(), `${scope}: catalog grids exist`);
    const cards = page.locator(".catalog-grid .catalog-card[data-asset-id]");
    const ids = await cards.evaluateAll((elements) =>
      elements.map((element) => element.dataset.assetId),
    );
    assert.deepEqual(
      [...ids].sort(),
      inventory.map((entry) => entry.id).sort(),
      `${scope}: card IDs exactly match inventory`,
    );
    assert.equal(
      new Set(ids).size,
      ids.length,
      `${scope}: card IDs are unique`,
    );

    const cardInspections = [];
    for (const asset of inventory) {
      const card = page.locator(`.catalog-card[data-asset-id="${asset.id}"]`);
      assert.equal(await card.count(), 1, `${scope}: ${asset.id} card`);
      assert.equal(
        await card.locator("img.catalog-preview").count(),
        1,
        `${scope}: ${asset.id} has one primary thumbnail`,
      );
      assert.equal(
        await card.locator(".catalog-state").count(),
        1,
        `${scope}: ${asset.id} has one visible state`,
      );
      const state = (await card.locator(".catalog-state").innerText()).trim();
      assert.ok(state, `${scope}: ${asset.id} state is not empty`);
      assert.ok(
        (await cardTitleLink(card).count()) === 1,
        `${scope}: ${asset.id} has one title link`,
      );
      assert.equal(
        await card.locator(".catalog-inspiration img").count(),
        asset.models.length > 0 ? 1 : 0,
        `${scope}: ${asset.id} has the expected small inspiration image`,
      );
      const bounds = await card.boundingBox();
      assert.ok(bounds, `${scope}: ${asset.id} has bounds`);
      assert.ok(bounds.x >= -1, `${scope}: ${asset.id} begins inside viewport`);
      assert.ok(
        bounds.x + bounds.width <= viewport.width + 1,
        `${scope}: ${asset.id} ends inside viewport`,
      );
      const expectedReview = comparableUrl(repositoryPathToUrl(asset.review));
      const actualReview = comparableUrl(
        await cardTitleLink(card).evaluate((element) => element.href),
      );
      assert.equal(
        actualReview,
        expectedReview,
        `${scope}: ${asset.id} title links to inventory review`,
      );
      const reviewLinks = await card
        .locator("a[href]:not(.headerlink)")
        .evaluateAll((links) => links.map((link) => link.href));
      assert.ok(reviewLinks.length >= 2, `${scope}: ${asset.id} review links`);
      assert.deepEqual(
        [...new Set(reviewLinks.map(comparableUrl))],
        [expectedReview],
        `${scope}: every ${asset.id} link uses its exact review target`,
      );
      cardInspections.push({
        id: asset.id,
        review: publicLocation(actualReview),
        state,
      });
    }

    const modelAssets = inventory.filter((entry) => entry.models.length > 0);
    assert.equal(modelAssets.length, 24, `${scope}: all 24 models have cards`);
    const nap = modelAssets.find((entry) => entry.id === "nap-captain");
    assert.ok(nap, `${scope}: Nap Captain model card exists`);
    assert.equal(
      modelAssets.filter((entry) => entry.id !== "nap-captain").length,
      23,
      `${scope}: 23 other completed model candidates`,
    );
    assert.ok(
      modelAssets
        .filter((entry) => entry.id !== "nap-captain")
        .every((entry) => /completed/i.test(entry.stateText)),
      `${scope}: the other 23 model records are completed candidates`,
    );
    const napState = await page
      .locator('.catalog-card[data-asset-id="nap-captain"] .catalog-state')
      .innerText();
    assert.match(
      `${nap.stateText} ${napState}`,
      /partial|paused|unfinished|correction/i,
      `${scope}: Nap Captain is plainly unfinished`,
    );

    const images = await waitForImages(
      page,
      page.locator(".catalog-grid .catalog-card img"),
      scope,
    );
    assert.deepEqual(
      heavyLandingRequests,
      [],
      `${scope}: landing fetches no GLB or WAV`,
    );
    const screenshot = path.join(resultsDir, `catalog-${viewport.name}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);
    const viewportScreenshot = path.join(
      resultsDir,
      `catalog-${viewport.name}-viewport.png`,
    );
    await page.screenshot({ path: viewportScreenshot });

    const firstCard = cards.first();
    const firstTitleLink = cardTitleLink(firstCard);
    await firstTitleLink.focus();
    assert.equal(
      await firstTitleLink.evaluate(
        (element) =>
          document.activeElement === element &&
          element.matches(":focus-visible"),
      ),
      true,
      `${scope}: card title link receives keyboard focus`,
    );

    const result = {
      ...viewport,
      cards: cardInspections,
      categoryJumps: jumps,
      images,
      noHeavyLandingRequests: true,
      noHorizontalOverflow: true,
      screenshot: path.basename(screenshot),
      viewportScreenshot: path.basename(viewportScreenshot),
    };

    if (viewport.name === "desktop") {
      const expectedDestination = comparableUrl(
        await firstTitleLink.evaluate((element) => element.href),
      );
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
        page.keyboard.press("Enter"),
      ]);
      assert.equal(
        comparableUrl(page.url()),
        expectedDestination,
        `${scope}: Enter follows the card title without JavaScript`,
      );
      result.keyboardDestination = publicLocation(page.url());
    } else {
      const soundJump = page.locator(
        '.catalog-jumps a[href="#sound-auditions"]',
      );
      assert.equal(await soundJump.count(), 1, `${scope}: sound category jump`);
      await soundJump.tap();
      await page.waitForFunction(() => location.hash === "#sound-auditions");
      const soundHeadingVisible = await page
        .locator("#sound-auditions")
        .evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.top >= -1 && bounds.top < window.innerHeight;
        });
      assert.equal(
        soundHeadingVisible,
        true,
        `${scope}: native category jump reveals Sound auditions`,
      );
      result.categoryJump = {
        href: "#sound-auditions",
        headingVisible: true,
      };
      const expectedDestination = comparableUrl(
        await firstTitleLink.evaluate((element) => element.href),
      );
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
        firstTitleLink.tap(),
      ]);
      assert.equal(
        comparableUrl(page.url()),
        expectedDestination,
        `${scope}: phone tap follows the card title`,
      );
      result.tapDestination = publicLocation(page.url());
    }
    return result;
  } finally {
    await context.close();
  }
}

async function inspectReviewPages(browser, inventory, report) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(30_000);
  const expectedAbortContext = {
    activity: undefined,
    metadataOnlyUrls: new Set(),
  };
  attachDiagnostics(
    page,
    report,
    "reviews-no-javascript",
    expectedAbortContext,
  );

  const groups = new Map();
  for (const asset of inventory) {
    const reviewUrl = repositoryPathToUrl(asset.review);
    const key = `${reviewUrl.origin}${reviewUrl.pathname}${reviewUrl.search}`;
    const group = groups.get(key) ?? [];
    group.push({ asset, reviewUrl });
    groups.set(key, group);
  }

  const results = [];
  try {
    for (const [pageUrl, entries] of groups) {
      if (results.length > 0) {
        expectedAbortContext.activity = "serial review navigation";
      }
      let navigation;
      try {
        navigation = await page.goto(pageUrl, {
          waitUntil: "networkidle",
        });
      } finally {
        expectedAbortContext.activity = undefined;
      }
      assert.equal(
        navigation?.status(),
        200,
        `${publicLocation(pageUrl)} review`,
      );
      const metadataOnlyUrls = await page
        .locator('video[preload="metadata"]')
        .evaluateAll((videos) =>
          videos
            .flatMap((video) => [
              video.getAttribute("src"),
              ...[...video.querySelectorAll("source[src]")].map((source) =>
                source.getAttribute("src"),
              ),
            ])
            .filter(Boolean)
            .map((source) => new URL(source, location.href).href),
        );
      for (const url of metadataOnlyUrls) {
        expectedAbortContext.metadataOnlyUrls.add(comparableUrl(url));
      }
      const images = await waitForImages(
        page,
        page.locator("main img"),
        publicLocation(pageUrl),
      );
      const imageUrls = new Set(
        await page
          .locator("main img")
          .evaluateAll((elements) =>
            elements.map((element) => new URL(element.src, location.href).href),
          ),
      );
      const linkUrls = new Set(
        await page
          .locator("main a[href]")
          .evaluateAll((elements) => elements.map((element) => element.href)),
      );
      const modelUrls = new Set(
        await page
          .locator("model-viewer[src]")
          .evaluateAll((elements) =>
            elements.map(
              (element) =>
                new URL(element.getAttribute("src"), location.href).href,
            ),
          ),
      );

      const checkedEntries = [];
      for (const { asset, reviewUrl } of entries) {
        if (reviewUrl.hash) {
          assert.equal(
            await page.evaluate(
              (id) => Boolean(document.getElementById(decodeURIComponent(id))),
              reviewUrl.hash.slice(1),
            ),
            true,
            `${asset.id}: review fragment ${reviewUrl.hash} exists`,
          );
        }
        if (asset.models.length > 0) {
          assert.ok(
            asset.inspirationImages.length > 0,
            `${asset.id}: inventory pairs model with inspiration image`,
          );
        }
        for (const [index, concept] of asset.inspirationImages.entries()) {
          const expected = comparableUrl(repositoryPathToUrl(concept.path));
          if (index === 0) {
            assert.ok(
              imageUrls.has(expected),
              `${asset.id}: review displays current inspiration ${publicLocation(expected)}`,
            );
          } else {
            assert.ok(
              imageUrls.has(expected) || linkUrls.has(expected),
              `${asset.id}: review retains historical inspiration ${publicLocation(expected)}`,
            );
          }
        }
        for (const model of asset.models) {
          const expected = comparableUrl(repositoryPathToUrl(model.path));
          assert.ok(
            modelUrls.has(expected),
            `${asset.id}: model-viewer src matches ${publicLocation(expected)}`,
          );
        }
        checkedEntries.push({
          id: asset.id,
          fragment: reviewUrl.hash || undefined,
          inspirationImages: asset.inspirationImages.map((image) => image.path),
          models: asset.models.map((model) => model.path),
        });
      }
      results.push({
        url: publicLocation(pageUrl),
        entries: checkedEntries,
        imageCount: images.length,
        modelViewerCount: modelUrls.size,
      });
    }
    return results;
  } finally {
    expectedAbortContext.activity = "review context teardown";
    await context.close();
  }
}

async function verifyModelDeliveries(inventory, report) {
  const api = await playwrightRequest.newContext({
    baseURL: catalogUrl.origin,
    extraHTTPHeaders: { Accept: "model/gltf-binary,application/octet-stream" },
  });
  const models = inventory.flatMap((asset) =>
    asset.models.map((model) => ({ assetId: asset.id, ...model })),
  );
  assert.equal(models.length, 24, "inventory declares exactly 24 model files");
  assert.equal(
    new Set(models.map((model) => model.path)).size,
    models.length,
    "model repository paths are unique",
  );

  const results = [];
  try {
    for (const model of models) {
      assert.match(
        model.sha256 ?? "",
        /^[a-f0-9]{64}$/,
        `${model.assetId}: model inventory declares SHA-256`,
      );
      const url = repositoryPathToUrl(model.path);
      assert.equal(
        url.origin,
        catalogUrl.origin,
        `${model.assetId}: model is hosted locally`,
      );
      const response = await api.get(url.href, { timeout: 30_000 });
      assert.equal(response.status(), 200, `${model.assetId}: model response`);
      assert.match(
        response.headers()["content-type"] ?? "",
        modelMime,
        `${model.assetId}: model MIME`,
      );
      const body = await response.body();
      const actual = { bytes: body.length, sha256: sha256(body) };
      assert.equal(
        actual.sha256,
        model.sha256,
        `${model.assetId}: delivered model hash matches inventory`,
      );
      assert.ok(
        actual.bytes > 0,
        `${model.assetId}: delivered model is non-empty`,
      );
      const contentLength = response.headers()["content-length"];
      if (contentLength !== undefined) {
        assert.equal(
          Number(contentLength),
          actual.bytes,
          `${model.assetId}: model Content-Length`,
        );
      }
      results.push({
        assetId: model.assetId,
        url: publicLocation(url.href),
        contentType: response.headers()["content-type"],
        ...actual,
      });
    }
    return results;
  } catch (error) {
    report.deliveryError = serializeError(error);
    throw error;
  } finally {
    await api.dispose();
  }
}

async function exerciseTouchOrbit(context, page, viewer) {
  const before = await viewer.evaluate((element) => ({
    ...element.getCameraOrbit(),
  }));
  const box = await viewer.boundingBox();
  assert.ok(box, "Nap Captain: viewer has touch bounds");
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
  assert.equal(changed, true, "Nap Captain: touch drag changes camera orbit");
  return { before, after, changed };
}

async function inspectNapCaptain(browser, inventory, report) {
  const nap = inventory.find((entry) => entry.id === "nap-captain");
  assert.ok(nap, "Nap Captain is in inventory");
  assert.equal(nap.models.length, 1, "Nap Captain has one partial model");
  const expectedModel = comparableUrl(repositoryPathToUrl(nap.models[0].path));
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  await context.addInitScript(() => {
    globalThis.__questWebglProbe = { calls: 0, successfulContexts: 0 };
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
        }
        return result;
      };
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.setDefaultNavigationTimeout(30_000);
  const expectedAbortContext = {
    activity: undefined,
    metadataOnlyUrls: new Set(),
  };
  attachDiagnostics(page, report, "nap-captain-viewer", expectedAbortContext);
  const modelRequests = [];
  page.on("request", (browserRequest) => {
    if (/\.glb(?:$|[?#])/i.test(browserRequest.url())) {
      modelRequests.push(comparableUrl(browserRequest.url()));
    }
  });

  try {
    const reviewUrl = repositoryPathToUrl(nap.review);
    reviewUrl.hash = "";
    const navigation = await page.goto(reviewUrl.href, {
      waitUntil: "domcontentloaded",
    });
    assert.equal(navigation?.status(), 200, "Nap Captain review response");
    const metadataOnlyUrls = await page
      .locator('video[preload="metadata"]')
      .evaluateAll((videos) =>
        videos
          .flatMap((video) => [
            video.getAttribute("src"),
            ...[...video.querySelectorAll("source[src]")].map((source) =>
              source.getAttribute("src"),
            ),
          ])
          .filter(Boolean)
          .map((source) => new URL(source, location.href).href),
      );
    for (const url of metadataOnlyUrls) {
      expectedAbortContext.metadataOnlyUrls.add(comparableUrl(url));
    }
    const viewer = page.locator("model-viewer[src]");
    assert.equal(await viewer.count(), 1, "Nap Captain has one model viewer");
    assert.equal(
      comparableUrl(
        await viewer.evaluate(
          (element) => new URL(element.getAttribute("src"), location.href).href,
        ),
      ),
      expectedModel,
      "Nap Captain viewer uses inventory model",
    );
    await viewer.scrollIntoViewIfNeeded();
    await viewer.evaluate(
      (element) =>
        new Promise((resolve, reject) => {
          if (element.loaded) return resolve();
          const timer = setTimeout(
            () => reject(new Error("Nap Captain model-viewer load timeout")),
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
              reject(new Error("Nap Captain model-viewer load error"));
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
    const inspection = await viewer.evaluate((element) => {
      const dimensions = element.getDimensions();
      const canvas = element.shadowRoot?.querySelector("canvas");
      return {
        clips: [...element.availableAnimations],
        dimensions: {
          x: dimensions.x,
          y: dimensions.y,
          z: dimensions.z,
        },
        loaded: element.loaded,
        modelIsVisible: element.modelIsVisible,
        renderSurface: canvas
          ? { width: canvas.width, height: canvas.height }
          : undefined,
        src: new URL(element.src, location.href).href,
        webgl: globalThis.__questWebglProbe,
      };
    });
    assert.equal(inspection.loaded, true, "Nap Captain model loaded");
    assert.equal(
      inspection.modelIsVisible,
      true,
      "Nap Captain model is visible",
    );
    assert.ok(
      Object.values(inspection.dimensions).every(
        (dimension) => Number.isFinite(dimension) && dimension > 0,
      ),
      "Nap Captain model has positive finite dimensions",
    );
    assert.ok(
      inspection.renderSurface?.width > 0 &&
        inspection.renderSurface?.height > 0,
      "Nap Captain viewer has a non-empty canvas",
    );
    assert.ok(
      inspection.webgl.successfulContexts > 0,
      "Nap Captain viewer created a WebGL context",
    );
    assert.deepEqual(
      [...inspection.clips].sort(),
      [...requiredNapClips].sort(),
      "Nap Captain partial model exposes the five existing clips",
    );
    assert.deepEqual(
      [...new Set(modelRequests)],
      [expectedModel],
      "Nap Captain is the only model loaded by model-viewer",
    );
    const orbit = await exerciseTouchOrbit(context, page, viewer);
    const screenshot = path.join(resultsDir, "nap-captain-viewer-phone.png");
    await viewer.screenshot({ path: screenshot });
    return {
      ...inspection,
      src: publicLocation(inspection.src),
      orbit,
      screenshot: path.basename(screenshot),
      state: "paused partial model; corrections remain",
      qualityAssessment: "not performed",
    };
  } finally {
    expectedAbortContext.activity = "viewer context teardown";
    await context.close();
  }
}

await fs.mkdir(resultsDir, { recursive: true });
const report = {
  date: new Date().toISOString(),
  catalogUrl: catalogUrl.href,
  inventory: path.relative(repoRoot, inventoryPath),
  browser: undefined,
  landing: [],
  reviews: [],
  modelDeliveries: [],
  napCaptain: undefined,
  pageErrors: [],
  consoleErrors: [],
  badResponses: [],
  failedRequests: [],
  expectedMetadataAborts: [],
  externalRequests: [],
  physicalSafari: "not tested",
  scope:
    "catalog delivery, responsive navigation, exact model files and Nap Captain partial-model interaction; no final art-quality claim",
  harnessNotes: [
    "The current first inspiration image must be displayed inline; retained superseded concepts may instead remain reachable as local links.",
    "Raw preload=metadata media cancellations are separated only when observed during serial review navigation or viewer teardown; video playback remains covered by earlier focused audits.",
  ],
};

let browser;
let failure;
let timedOut = false;
const timeout = setTimeout(() => {
  timedOut = true;
  void browser?.close().catch(() => {});
}, overallTimeoutMs);

try {
  const inventory = normalizeInventory(
    JSON.parse(await fs.readFile(inventoryPath, "utf8")),
  );
  report.inventoryEntries = inventory.length;
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
  };

  for (const viewport of viewports) {
    report.landing.push(
      await inspectLanding(browser, inventory, viewport, report),
    );
  }
  report.reviews = await inspectReviewPages(browser, inventory, report);
  report.modelDeliveries = await verifyModelDeliveries(inventory, report);
  report.napCaptain = await inspectNapCaptain(browser, inventory, report);

  assert.deepEqual(report.pageErrors, [], "no page errors");
  assert.deepEqual(report.consoleErrors, [], "no console errors");
  assert.deepEqual(report.badResponses, [], "no HTTP error responses");
  assert.deepEqual(report.failedRequests, [], "no failed browser requests");
  assert.deepEqual(
    report.externalRequests.filter((entry) => entry.resourceType === "image"),
    [],
    "no externally hosted images",
  );
  report.outcome = "passed";
} catch (error) {
  failure = timedOut
    ? new Error(`visual catalog audit exceeded ${overallTimeoutMs}ms`, {
        cause: error,
      })
    : error;
  report.outcome = "failed";
  report.failure = serializeError(failure);
} finally {
  clearTimeout(timeout);
  await browser?.close().catch(() => {});
  await fs.writeFile(
    path.join(resultsDir, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
}

if (failure) throw failure;
console.log(JSON.stringify(report, null, 2));
