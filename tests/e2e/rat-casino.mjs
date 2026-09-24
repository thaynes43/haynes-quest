// Browser acceptance for the checked-in Rat Casino world.
//
// This enters through the private home CTA and then uses the same keyboard,
// jump and combat surfaces as a player. The narrow check is Chromium mobile
// emulation; it deliberately makes no physical Safari claim.
//
//   QUEST_E2E_URL            base origin of the candidate build (required)
//   QUEST_E2E_RUN_LABEL      report folder under test-results/rat-casino
//   QUEST_E2E_SOURCE_COMMIT  commit recorded alongside the evidence
//   QUEST_E2E_TIMEOUT_MS     hard wall-clock ceiling (default 1200000)
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";

import {
  chooseFallDirection,
  createAuthoredRouteDriver,
  createHybridControls,
  delay,
  waitForInspection,
} from "./authored-browser-driver.mjs";
import {
  buildTraversalPlan,
  findPlatformPath,
  planarDistance,
} from "./authored-navigation.mjs";
import {
  measureLayout,
  startEditorPreview,
  waitForEditorWorkspace,
} from "./editor-driver.mjs";

const url = process.env.QUEST_E2E_URL;
assert.ok(url, "QUEST_E2E_URL is required; never test a stale implicit server");
const origin = new URL(url).origin;
const runLabel = process.env.QUEST_E2E_RUN_LABEL ?? "candidate";
const sourceCommit = process.env.QUEST_E2E_SOURCE_COMMIT ?? null;
const timeoutMs = Number(process.env.QUEST_E2E_TIMEOUT_MS ?? 1_200_000);
assert.ok(Number.isFinite(timeoutMs) && timeoutMs >= 300_000);

const sourcePath = new URL(
  "../../src/shared/levels/rat-casino-world-v1.json",
  import.meta.url,
);
const project = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const outputDirectory = `test-results/rat-casino/${runLabel}`;
const reportPath = `${outputDirectory}/report.json`;
await fs.mkdir(outputDirectory, { recursive: true });

const ROUTE_ID = "rat-casino-v1";
const CHAPTER_ID = "rat-casino";
// DESIGN-022: the journey explores the golden-view side route for its ticket.
const TICKET_PLATFORM_ID = "golden-view-balcony";
const ENCOUNTER_ART = Object.freeze({
  "chick-flia": "/studio/assets/media/chick-flia/v001/chick-flia.glb",
  "jackrabbit-drummer":
    "/studio/assets/media/jackrabbit-drummer/v001/jackrabbit-drummer.glb",
  "fox-card-shark":
    "/studio/assets/media/fox-card-shark/v001/fox-card-shark.glb",
  "moth-projectionist":
    "/studio/assets/media/moth-projectionist/v001/moth-projectionist.glb",
  "rat-pit-boss": "/studio/assets/media/rat-pit-boss/v002/rat-pit-boss.glb",
});
const SCENIC_ART = Object.freeze({
  "casino-marquee-arch":
    "/studio/assets/media/rat-casino-kit/v001/marquee-arch.glb",
  "casino-roulette-dais":
    "/studio/assets/media/rat-casino-kit/v001/roulette-dais.glb",
  "casino-slot-cabinet":
    "/studio/assets/media/rat-casino-kit/v001/slot-cabinet.glb",
  "casino-golden-cameo":
    "/studio/assets/media/golden-after-hours-rat/v001/golden-after-hours-rat.glb",
});
const expectedMediaPaths = new Set([
  ...Object.values(ENCOUNTER_ART),
  ...Object.values(SCENIC_ART),
]);

assert.equal(project.schemaVersion, "level-editor-project-v2");
const ratCasinoChapter = project.chapters.find(
  (chapter) => chapter.chapterId === CHAPTER_ID,
);
assert.ok(ratCasinoChapter, `project has no ${CHAPTER_ID} chapter`);
assert.equal(ratCasinoChapter.routeId, ROUTE_ID);
assert.equal(ratCasinoChapter.level?.id, ROUTE_ID);
assert.equal(ratCasinoChapter.level?.theme, "casino");

const report = {
  startedAt: new Date().toISOString(),
  status: "running",
  url,
  sourceCommit,
  sourcePath: "src/shared/levels/rat-casino-world-v1.json",
  project: {
    id: project.projectId,
    revision: project.revision,
    chapterId: CHAPTER_ID,
    routeId: ROUTE_ID,
  },
  browser: null,
  previewRequest: null,
  media: {},
  encounters: null,
  recovery: null,
  performance: null,
  editorSample: null,
  fullAdventure: null,
  completion: null,
  collectibles: null,
  narrow: null,
  actions: [],
  screenshots: [],
  pageErrors: [],
  consoleErrors: [],
  responseErrors: [],
  failedRequests: [],
  externalRequests: [],
  limits: [
    "Desktop and 390x844 mobile coverage use headless Chromium with software WebGL.",
    "Physical iPhone/iPad Safari play remains a separate acceptance gate.",
  ],
};

const mark = (stage, details = {}) =>
  console.log(`[rat-casino] ${stage} ${JSON.stringify(details)}`);

let browser;
let desktopContext;
let page;
let latestSave = null;
let previewPayload = null;
let screenshotSequence = 0;
let timedOut = false;

const screenshot = async (target, name) => {
  const safe = name.replaceAll(/[^a-z0-9-]/gi, "-").toLowerCase();
  const path = `${outputDirectory}/${String(++screenshotSequence).padStart(2, "0")}-${safe}.png`;
  await target.screenshot({ path, fullPage: false });
  report.screenshots.push(path);
  return path;
};

const watchPage = (target, surface) => {
  target.on("pageerror", (error) =>
    report.pageErrors.push({ surface, message: error.message }),
  );
  target.on("console", (message) => {
    if (message.type() === "error")
      report.consoleErrors.push({ surface, message: message.text() });
  });
  target.on("request", (request) => {
    const parsed = new URL(request.url());
    if (
      ["http:", "https:"].includes(parsed.protocol) &&
      parsed.origin !== origin
    )
      report.externalRequests.push({
        surface,
        method: request.method(),
        url: request.url(),
      });
    if (request.method() !== "POST") return;
    if (parsed.pathname === "/api/editor/playtests") {
      const body = request.postDataJSON();
      report.previewRequest = {
        chapterId: body?.chapterId ?? null,
        scope: body?.scope ?? null,
        project: body?.project ?? null,
      };
    }
    if (/^\/api\/saves\/[^/]+\/actions$/.test(parsed.pathname)) {
      const action = request.postDataJSON()?.action;
      if (action) report.actions.push({ surface, ...action });
    }
  });
  target.on("requestfailed", (request) =>
    report.failedRequests.push({
      surface,
      method: request.method(),
      path: new URL(request.url()).pathname,
      error: request.failure()?.errorText ?? "unknown",
    }),
  );
  target.on("response", async (response) => {
    const parsed = new URL(response.url());
    if (response.status() >= 400)
      report.responseErrors.push({
        surface,
        method: response.request().method(),
        path: parsed.pathname,
        status: response.status(),
      });
    if (expectedMediaPaths.has(parsed.pathname)) {
      const contentLength = Number(response.headers()["content-length"]);
      report.media[parsed.pathname] = {
        surface,
        status: response.status(),
        contentType: response.headers()["content-type"] ?? null,
        bytes: Number.isFinite(contentLength) ? contentLength : null,
      };
    }
    if (!response.ok() || response.request().method() !== "POST") return;
    if (
      parsed.pathname !== "/api/editor/playtests" &&
      !/^\/api\/saves\/[^/]+\/actions$/.test(parsed.pathname)
    )
      return;
    const payload = await response.json().catch(() => null);
    if (parsed.pathname === "/api/editor/playtests") previewPayload = payload;
    const save =
      parsed.pathname === "/api/editor/playtests" ? payload?.save : payload;
    if (save?.id && Number.isInteger(save.revision)) latestSave = save;
  });
};

const waitForSave = async (predicate, label, timeout = 20_000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (latestSave && predicate(latestSave)) return latestSave;
    await delay(50);
  }
  if (page)
    await screenshot(page, `${label}-save-timeout`).catch(() => undefined);
  throw new Error(`${label}: save unavailable: ${JSON.stringify(latestSave)}`);
};

const navigationDocument = (document) => ({
  ...document,
  // v3 adds the world theme; its navigation ABI is otherwise the v2 graph.
  schemaVersion:
    document.schemaVersion === "authored-level-v3"
      ? "authored-level-v2"
      : document.schemaVersion,
});

const navigationPage = (target) =>
  new Proxy(target, {
    get(value, property) {
      if (property === "evaluate") {
        return async (...args) => {
          const inspected = await value.evaluate(...args);
          if (inspected?.level?.authored?.schemaVersion !== "authored-level-v3")
            return inspected;
          return {
            ...inspected,
            level: {
              ...inspected.level,
              authored: navigationDocument(inspected.level.authored),
            },
          };
        };
      }
      const member = Reflect.get(value, property, value);
      return typeof member === "function" ? member.bind(value) : member;
    },
  });

const progressSnapshot = (save) => ({
  revision: save.revision,
  ageYears: save.ageYears,
  recoveredIds: [...save.recoveredIds],
  phase: save.adventure.phase,
  pickups: save.adventure.activeLevel.pickups.map((item) => ({
    id: item.id,
    collected: item.collected,
  })),
  encounters: save.adventure.activeLevel.encounters.map((item) => ({
    id: item.id,
    hp: item.hp,
    defeated: item.defeated,
  })),
});

const sampleFrameTiming = (target, sampleFrames = 120) =>
  target.evaluate(
    (frameCount) =>
      new Promise((resolve) => {
        const timestamps = [];
        const startedAt = performance.now();
        const sample = (timestamp) => {
          timestamps.push(timestamp);
          if (
            timestamps.length < frameCount + 1 &&
            timestamp - startedAt < 5_000
          ) {
            requestAnimationFrame(sample);
            return;
          }
          const intervals = timestamps
            .slice(1)
            .map((value, index) => value - timestamps[index])
            .sort((left, right) => left - right);
          const mean =
            intervals.reduce((total, value) => total + value, 0) /
            intervals.length;
          resolve({
            frames: intervals.length,
            meanFrameMs: Number(mean.toFixed(2)),
            p95FrameMs: Number(
              intervals[Math.floor(intervals.length * 0.95)].toFixed(2),
            ),
            fps: Number((1_000 / mean).toFixed(1)),
          });
        };
        requestAnimationFrame(sample);
      }),
    sampleFrames,
  );

try {
  browser = await chromium.launch({
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
  const timeout = setTimeout(() => {
    timedOut = true;
    void browser.close();
  }, timeoutMs);

  try {
    desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 760 },
      deviceScaleFactor: 1,
    });
    page = await desktopContext.newPage();
    watchPage(page, "desktop");
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page
      .getByRole("button", { name: "Enter Rat Casino", exact: true })
      .waitFor({ state: "visible", timeout: 20_000 });
    await screenshot(page, "rat-casino-home");
    await page
      .getByRole("button", { name: "Enter Rat Casino", exact: true })
      .click();
    await page
      .locator("canvas[data-quest-canvas=true]")
      .waitFor({ timeout: 30_000 });
    const openingSave = await waitForSave(
      (save) => save.adventure?.currentLevelId === ROUTE_ID,
      "rat-casino-start",
      30_000,
    );
    assert.equal(report.previewRequest?.chapterId, CHAPTER_ID);
    assert.equal(report.previewRequest?.scope, "chapter");
    assert.deepEqual(
      report.previewRequest?.project,
      project,
      "home CTA did not submit the checked-in project",
    );
    assert.equal(
      previewPayload?.project?.chapters?.length,
      project.chapters.length,
    );

    const opening = await waitForInspection({
      page,
      screenshot: (name) => screenshot(page, name),
      label: "rat-casino-rendered",
      timeout: 45_000,
      predicate: (inspection) =>
        inspection.level.authored?.id === ROUTE_ID &&
        inspection.level.authored?.theme === "casino" &&
        inspection.status.mediaLoading === 0 &&
        inspection.status.mediaFailed === 0,
    });
    assert.equal(opening.level.authored.schemaVersion, "authored-level-v3");
    assert.equal(opening.obby.routeId, ROUTE_ID);
    assert.equal(openingSave.adventure.activeLevel.minorMemoryIds.length, 2);

    const identities = openingSave.adventure.activeLevel.encounters.map(
      (encounter) => ({
        id: encounter.id,
        role: encounter.role,
        catalogEntryId: encounter.content?.catalogEntryId ?? null,
        assetId: encounter.content?.assetId ?? null,
        assetVersion: encounter.content?.assetVersion ?? null,
      }),
    );
    assert.equal(identities.length, 5);
    assert.deepEqual(
      identities.map((entry) => entry.assetId).sort(),
      Object.keys(ENCOUNTER_ART).sort(),
    );
    assert.equal(
      identities.filter((entry) => entry.role === "ordinary").length,
      4,
    );
    assert.deepEqual(
      identities
        .filter((entry) => entry.role === "boss")
        .map((entry) => entry.assetId),
      ["rat-pit-boss"],
    );
    for (const identity of identities) {
      assert.equal(identity.catalogEntryId, identity.assetId);
      const version = ENCOUNTER_ART[identity.assetId].split("/").at(-2);
      assert.equal(identity.assetVersion, version);
    }
    report.encounters = identities;

    const mediaDeadline = Date.now() + 20_000;
    while (
      Date.now() < mediaDeadline &&
      [...expectedMediaPaths].some((path) => !report.media[path])
    )
      await delay(50);
    for (const path of expectedMediaPaths) {
      assert.equal(
        report.media[path]?.status,
        200,
        `${path}: exact art did not load`,
      );
      assert.match(
        report.media[path]?.contentType ?? "",
        /model\/gltf-binary|application\/octet-stream/,
        `${path}: unexpected media type`,
      );
      assert.ok(report.media[path].bytes > 0, `${path}: byte count missing`);
    }
    report.mediaTransferBytes = Object.values(report.media).reduce(
      (total, entry) => total + entry.bytes,
      0,
    );
    await screenshot(page, "casino-opening-art");

    const planned = opening.collectibles;
    assert.ok(planned, "the casino chapter planned no tokens");
    assert.equal(planned.counts.tokens, 0);
    assert.equal(planned.counts.tickets, 0);
    assert.equal(planned.counts.ticketTotal, 3);
    assert.ok(planned.counts.tokenTotal >= 100, "too few casino tokens");
    const ticket = planned.items.find(
      (item) =>
        item.kind === "ticket" && item.platformId === TICKET_PLATFORM_ID,
    );
    assert.ok(ticket, `${TICKET_PLATFORM_ID}: golden ticket missing`);
    const tally = page.locator(".casino-tally");
    await tally.waitFor({ state: "visible", timeout: 5_000 });
    assert.equal(
      await tally.getAttribute("aria-label"),
      "0 casino tokens, 0 of 3 golden tickets",
    );
    report.collectibles = {
      planned: {
        tokens: planned.counts.tokenTotal,
        tickets: planned.counts.ticketTotal,
        ticketPlatforms: planned.items
          .filter((item) => item.kind === "ticket")
          .map((item) => item.platformId),
      },
      ticket: null,
      haul: null,
      input: "ordinary keyboard movement and jumps; no collection shortcut",
    };

    const document = navigationDocument(opening.level.authored);
    const ticketBranch = document.branches.findIndex((branch) =>
      branch.includes(TICKET_PLATFORM_ID),
    );
    assert.ok(ticketBranch >= 0, "golden-view branch missing");
    const plan = buildTraversalPlan(document, { branchIndex: ticketBranch });
    const controls = createHybridControls({ page });
    let driver = createAuthoredRouteDriver({
      page: navigationPage(page),
      controls,
      screenshot: (name) => screenshot(page, name),
      mark,
      maxRecoveries: 14,
    });

    const beforeFall = await driver.read("safety-fall-before");
    const savedProgress = progressSnapshot(latestSave);
    const recoveryCount = beforeFall.obby.recoveries;
    const fallDirection = chooseFallDirection(beforeFall);
    await controls.beginToward(fallDirection.dx, fallDirection.dz);
    let recovered;
    try {
      recovered = await waitForInspection({
        page,
        screenshot: (name) => screenshot(page, name),
        label: "intentional-safety-recovery",
        timeout: 15_000,
        predicate: (inspection) => inspection.obby?.recoveries > recoveryCount,
      });
    } finally {
      await controls.release();
    }
    assert.equal(recovered.obby.checkpointId, beforeFall.obby.checkpointId);
    assert.ok(recovered.obby.recoveryRemaining > 0);
    assert.ok(
      planarDistance(recovered.status.position, beforeFall.checkpoint) < 0.8,
    );
    assert.deepEqual(progressSnapshot(latestSave), savedProgress);
    report.recovery = {
      checkpointId: recovered.obby.checkpointId,
      before: recoveryCount,
      after: recovered.obby.recoveries,
      progressPreserved: true,
      input: "held keyboard movement off the platform",
    };
    await waitForInspection({
      page,
      screenshot: (name) => screenshot(page, name),
      label: "recovery-settled",
      predicate: (inspection) =>
        inspection.status.grounded && inspection.obby?.supportId !== null,
    });

    const memoryIds = {
      "minor-one": openingSave.adventure.activeLevel.minorMemoryIds[0],
      "minor-two": openingSave.adventure.activeLevel.minorMemoryIds[1],
      major: openingSave.adventure.activeLevel.majorMemoryId,
    };
    const visited = new Set();
    const fights = [];
    const memories = [];
    const levelFinished = () =>
      latestSave.completed ||
      latestSave.adventure.currentLevelId !== ROUTE_ID ||
      latestSave.adventure.completedLevelIds.includes(ROUTE_ID);

    const moveToAnchor = async (
      anchor,
      label,
      targetFor = () => anchor.position,
      done = null,
    ) => {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        let current = await driver.read(`${label}-route-${attempt + 1}`);
        if (done && (await done(current))) return current;
        if (current.obby.supportId === null) {
          current = await waitForInspection({
            page,
            screenshot: (name) => screenshot(page, name),
            label: `${label}-settled-${attempt + 1}`,
            timeout: 10_000,
            predicate: (candidate) =>
              candidate.status.grounded && candidate.obby?.supportId !== null,
          });
          if (done && (await done(current))) return current;
        }
        if (current.obby.supportId !== anchor.platformId) {
          const currentIndex = plan.platformIds.indexOf(current.obby.supportId);
          const targetIndex = plan.platformIds.indexOf(anchor.platformId);
          const route =
            currentIndex >= 0 && targetIndex > currentIndex
              ? plan.edges.slice(currentIndex, targetIndex)
              : findPlatformPath(
                  document,
                  current.obby.supportId,
                  anchor.platformId,
                );
          for (const [index, edge] of route.entries()) {
            current = await driver.crossEdge(
              { ...edge, index: edge.index ?? index },
              `${label}-edge-${index + 1}`,
            );
            if (
              (done && (await done(current))) ||
              current.obby.supportId !== edge.to
            )
              break;
          }
          if (done && (await done(current))) return current;
          if (current.obby.supportId !== anchor.platformId) {
            driver = createAuthoredRouteDriver({
              page: navigationPage(page),
              controls,
              screenshot: (name) => screenshot(page, name),
              mark,
              maxRecoveries: 14,
            });
            continue;
          }
        }
        const recoveries = current.obby.recoveries;
        const reached = await driver.moveToPoint(targetFor, {
          label,
          tolerance: 0.34,
          supportId: anchor.platformId,
          stopOnRecovery: true,
          done,
        });
        if (done && (await done(reached))) return reached;
        if (
          reached.obby.supportId === anchor.platformId &&
          reached.obby.recoveries === recoveries
        )
          return reached;
      }
      throw new Error(`${label}: repeated recovery prevented anchor contact`);
    };

    const collectPickup = async (kind, anchor) => {
      const collected = (save) =>
        save.adventure?.activeLevel?.pickups.some(
          (pickup) => pickup.kind === kind && pickup.collected,
        );
      if (!collected(latestSave))
        await moveToAnchor(anchor, `pickup-${kind}`, undefined, () =>
          collected(latestSave),
        );
      await waitForSave(collected, `pickup-${kind}`);
    };

    const collectMemory = async (role, anchor) => {
      const id = memoryIds[role];
      assert.ok(id, `${role}: runtime memory id missing`);
      const collected = (save) =>
        ["revealed", "consumed"].includes(
          save.memories.find((memory) => memory.id === id)?.state,
        );
      if (!collected(latestSave))
        await moveToAnchor(anchor, `memory-${role}`, undefined, () =>
          collected(latestSave),
        );
      const saved = await waitForSave(collected, `memory-${role}`, 30_000);
      memories.push({ role, id, revision: saved.revision });
    };

    const closest = (entries, point) =>
      [...entries].sort(
        (left, right) =>
          planarDistance(left, point) - planarDistance(right, point),
      )[0];

    const fight = async (role, anchor) => {
      const identified = await driver.read(`fight-${role}-identify`);
      const rendered = closest(
        identified.level.encounterPositions,
        anchor.position,
      );
      assert.ok(rendered, `${role}: rendered encounter missing`);
      const encounterId = rendered.id;
      const frozen = identities.find((entry) => entry.id === encounterId);
      assert.ok(frozen, `${role}: frozen encounter missing`);
      const encounterFor = (save) =>
        save.adventure?.activeLevel?.encounters.find(
          (encounter) => encounter.id === encounterId,
        );
      let encounter = encounterFor(latestSave);
      if (encounter?.defeated) return;

      const approach = async () => {
        await moveToAnchor(
          anchor,
          `fight-${role}-approach`,
          (candidate) =>
            candidate.level.encounterPositions.find(
              (entry) => entry.id === encounterId,
            ),
          (candidate) => candidate.status.nearEncounterId === encounterId,
        );
        return waitForInspection({
          page,
          screenshot: (name) => screenshot(page, name),
          label: `fight-${role}-near`,
          timeout: 12_000,
          predicate: (candidate) =>
            candidate.status.nearEncounterId === encounterId,
        });
      };

      await approach();
      if (frozen.assetId === "fox-card-shark")
        await screenshot(page, "casino-midcourse-card-room");
      if (role === "boss") {
        await screenshot(page, "casino-boss-stage");
        report.performance = {
          ...(await sampleFrameTiming(page)),
          surface: "boss stage",
          browser: "headless Chromium",
          renderer: "ANGLE/SwiftShader software WebGL",
          deviceEvidence: false,
        };
      }
      let retries = 0;
      let primaryHits = 0;
      let secondaryHits = 0;
      const deadline = Date.now() + 75_000;
      while (Date.now() < deadline) {
        if (latestSave.adventure.phase === "fallen") {
          const revision = latestSave.revision;
          retries += 1;
          assert.ok(retries <= 4, `${role}: checkpoint retry bound exceeded`);
          await waitForSave(
            (save) =>
              save.revision > revision && save.adventure.phase === "exploring",
            `${role}-retry`,
            25_000,
          );
          await waitForInspection({
            page,
            screenshot: (name) => screenshot(page, name),
            label: `${role}-retry-ready`,
            predicate: (candidate) =>
              candidate.status.grounded && candidate.obby?.supportId !== null,
          });
          await approach();
        }
        encounter = encounterFor(latestSave);
        if (encounter?.defeated) break;
        const inspection = await driver.read(`fight-${role}`);
        if (inspection.status.nearEncounterId !== encounterId) {
          await approach();
          continue;
        }
        const beforeHp = encounter.hp;
        const beforeRevision = latestSave.revision;
        const secondary = inspection.status.guardReady && secondaryHits === 0;
        const primary = inspection.status.attackReady;
        if (!secondary && !primary) {
          await delay(60);
          continue;
        }
        const control = secondary ? "Bash" : "Attack";
        await page.keyboard.press(secondary ? "Shift" : "f", { delay: 55 });
        const changed = await waitForSave(
          (save) => {
            const current = encounterFor(save);
            return (
              save.revision > beforeRevision &&
              (current?.hp < beforeHp || save.adventure.phase === "fallen")
            );
          },
          `${role}-${control.toLowerCase()}`,
          5_000,
        ).catch(() => null);
        const after = changed && encounterFor(changed);
        if (after && after.hp < beforeHp) {
          if (secondary) secondaryHits += 1;
          else primaryHits += 1;
        }
      }
      encounter = encounterFor(latestSave);
      assert.equal(encounter?.defeated, true, `${role}: combat timed out`);
      fights.push({
        role,
        encounterId,
        assetId: frozen.assetId,
        primaryHits,
        secondaryHits,
        retries,
      });
      mark("combat:defeated", fights.at(-1));
    };

    const collectTicket = async () => {
      const taken = (inspection) =>
        inspection.collectibles?.items.find((item) => item.id === ticket.id)
          ?.collected === true;
      await screenshot(page, "casino-golden-ticket-ahead");
      await moveToAnchor(
        { platformId: ticket.platformId, position: ticket.position },
        "golden-ticket",
        undefined,
        taken,
      );
      const collected = await waitForInspection({
        page,
        screenshot: (name) => screenshot(page, name),
        label: "golden-ticket-collected",
        timeout: 10_000,
        predicate: taken,
      });
      await page
        .locator(".casino-tally .ticket-slot.collected")
        .first()
        .waitFor({ state: "visible", timeout: 5_000 });
      report.collectibles.ticket = {
        id: ticket.id,
        platformId: ticket.platformId,
        tokensSoFar: collected.collectibles.counts.tokens,
        tally: await tally.getAttribute("aria-label"),
      };
      mark("collectibles:ticket", report.collectibles.ticket);
      await screenshot(page, "casino-golden-ticket-collected");
      // A corner ticket can sit beside a raised neighbour. Step back to the
      // platform's middle row, as a player would, before rejoining the route.
      const middle = collected.obby.platforms.find(
        (entry) => entry.id === ticket.platformId,
      ).center.z;
      await moveToAnchor(
        {
          platformId: ticket.platformId,
          position: { ...ticket.position, z: middle },
        },
        "golden-ticket-return",
      );
    };

    const processPlatform = async (platformId) => {
      if (visited.has(platformId) || levelFinished()) return;
      visited.add(platformId);
      if (platformId === ticket.platformId) await collectTicket();
      for (const [kind, anchor] of Object.entries(document.anchors.pickups))
        if (anchor.platformId === platformId) await collectPickup(kind, anchor);
      for (const [role, anchor] of Object.entries(document.anchors.memories))
        if (role !== "major" && anchor.platformId === platformId)
          await collectMemory(role, anchor);
      const encounters = Object.entries(document.anchors.encounters)
        .filter(([, anchor]) => anchor.platformId === platformId)
        .sort(
          ([left], [right]) =>
            Number(left === "boss") - Number(right === "boss"),
        );
      for (const [role, anchor] of encounters) {
        if (role === "boss") {
          const ordinary = latestSave.adventure.activeLevel.encounters.filter(
            (candidate) => candidate.role === "ordinary",
          );
          assert.equal(ordinary.length, 4);
          assert.ok(ordinary.every((candidate) => candidate.defeated));
        }
        await fight(role, anchor);
      }
      const major = document.anchors.memories.major;
      if (major.platformId === platformId) await collectMemory("major", major);
    };

    await processPlatform(plan.platformIds[0]);
    let edgeIndex = 0;
    let crossings = 0;
    while (edgeIndex < plan.edges.length && !levelFinished()) {
      crossings += 1;
      assert.ok(
        crossings <= 70,
        "course traversal exceeded its recovery bound",
      );
      const current = await driver.read(`route-${edgeIndex}`);
      const supportIndex = plan.platformIds.indexOf(current.obby.supportId);
      if (supportIndex < 0) {
        const retry = findPlatformPath(
          document,
          current.obby.supportId,
          plan.platformIds[0],
        );
        for (const [index, edge] of retry.entries())
          await driver.crossEdge(edge, `safe-catch-${index + 1}`);
        driver = createAuthoredRouteDriver({
          page: navigationPage(page),
          controls,
          screenshot: (name) => screenshot(page, name),
          mark,
          maxRecoveries: 14,
        });
        edgeIndex = 0;
        continue;
      }
      if (supportIndex !== edgeIndex) {
        assert.ok(
          supportIndex < edgeIndex,
          "route unexpectedly skipped forward",
        );
        edgeIndex = supportIndex;
        continue;
      }
      const edge = plan.edges[edgeIndex];
      const finishEdge = edge.to === document.anchors.finish.platformId;
      const after = await driver.crossEdge(
        edge,
        `route-edge-${edgeIndex + 1}`,
        {
          allowFinishTrigger: finishEdge,
          finishReached: levelFinished,
        },
      );
      if (finishEdge && levelFinished()) break;
      if (after.obby.supportId !== edge.to) {
        driver = createAuthoredRouteDriver({
          page: navigationPage(page),
          controls,
          screenshot: (name) => screenshot(page, name),
          mark,
          maxRecoveries: 14,
        });
        continue;
      }
      edgeIndex += 1;
      if (edge.to === "cabinet-landing")
        await screenshot(page, "casino-elevated-cabinet-run");
      if (edge.to === "moth-projection-room")
        await screenshot(page, "casino-stage-ascent");
      await processPlatform(edge.to);
    }

    if (!levelFinished()) {
      assert.equal(latestSave.adventure.phase, "memory-released");
      await collectMemory("major", document.anchors.memories.major);
    }
    const completed = await waitForSave(
      (save) => save.adventure.completedLevelIds.includes(ROUTE_ID),
      "rat-casino-complete",
      30_000,
    );
    assert.equal(
      memories.filter((entry) => entry.role.startsWith("minor")).length,
      2,
    );
    assert.equal(fights.length, 5);
    assert.deepEqual(
      fights.map((entry) => entry.assetId).sort(),
      Object.keys(ENCOUNTER_ART).sort(),
    );
    assert.ok(memoryIds.major);
    for (const memoryId of Object.values(memoryIds))
      assert.ok(
        completed.recoveredIds.includes(memoryId),
        `${memoryId}: not recovered`,
      );
    for (const [role, memoryId] of Object.entries(memoryIds)) {
      assert.ok(
        report.actions.some(
          (action) =>
            action.type === "recover-memory" && action.memoryId === memoryId,
        ),
        `${role}: natural recover-memory action was not observed`,
      );
      if (!memories.some((entry) => entry.role === role))
        memories.push({
          role,
          id: memoryId,
          revision: completed.revision,
          trigger: "walked into post-boss major memory and finish",
        });
    }
    assert.ok(completed.adventure.completedLevelIds.includes(ROUTE_ID));
    assert.ok(
      report.actions.some((action) => action.type === "recover-memory"),
    );
    assert.ok(report.actions.some((action) => action.type === "attack"));
    report.completion = {
      routeId: ROUTE_ID,
      revision: completed.revision,
      completed: completed.completed,
      memories,
      fights,
      recoveredMemoryIds: Object.values(memoryIds),
      completedLevelIds: [...completed.adventure.completedLevelIds],
    };
    const completionDialog = page.getByRole("dialog", {
      name: /Rat Casino complete\./,
    });
    await completionDialog.waitFor({ state: "visible", timeout: 15_000 });
    const completionCopy = (await completionDialog.textContent()) ?? "";
    assert.match(completionCopy, /CHAPTER COMPLETE/);
    assert.match(completionCopy, /3 fictional memories reclaimed\./);
    assert.doesNotMatch(completionCopy, /9 memories/);
    assert.equal(
      await completionDialog.locator("figure.victory-memory").count(),
      3,
    );
    report.completion.presentation = {
      title: await completionDialog.getAttribute("aria-label"),
      memoryCards: 3,
      copy: "3 fictional memories reclaimed.",
    };
    const haulCopy =
      (await completionDialog.locator(".casino-haul").textContent()) ?? "";
    const haul = haulCopy.match(
      /You grabbed (\d+) of (\d+) casino tokens and (\d+) of (\d+) golden tickets\./,
    );
    assert.ok(haul, `completion haul missing: ${haulCopy}`);
    const [tokens, tokenTotal, tickets, ticketTotal] = haul
      .slice(1)
      .map(Number);
    assert.equal(tokenTotal, planned.counts.tokenTotal);
    assert.equal(ticketTotal, 3);
    assert.ok(tickets >= 1, "the golden ticket was not counted");
    assert.ok(
      tokens >= 10,
      `only ${tokens} tokens collected on the explorer route`,
    );
    report.collectibles.haul = { tokens, tokenTotal, tickets, ticketTotal };
    await screenshot(page, "rat-casino-complete");

    const fullAdventureContext = await browser.newContext({
      viewport: { width: 1280, height: 760 },
      deviceScaleFactor: 1,
    });
    const fullAdventurePage = await fullAdventureContext.newPage();
    page = fullAdventurePage;
    watchPage(fullAdventurePage, "full-adventure");
    await fullAdventurePage.goto(new URL("/editor", url).href, {
      waitUntil: "domcontentloaded",
    });
    await waitForEditorWorkspace(fullAdventurePage, { timeout: 30_000 });
    let sampleConfirmation = null;
    fullAdventurePage.once("dialog", (dialog) => {
      sampleConfirmation = dialog.message();
      void dialog.accept();
    });
    const draftDownload = fullAdventurePage.waitForEvent("download");
    await fullAdventurePage
      .getByRole("button", { name: "Open Rat Casino sample", exact: true })
      .click();
    await (await draftDownload).cancel();
    const chapterPicker = fullAdventurePage.getByRole("combobox", {
      name: "Chapter",
      exact: true,
    });
    await chapterPicker.waitFor({ state: "visible", timeout: 10_000 });
    assert.equal(await chapterPicker.inputValue(), CHAPTER_ID);
    assert.match(sampleConfirmation ?? "", /Open the Rat Casino sample/);
    const editorScreenshot = await screenshot(
      fullAdventurePage,
      "rat-casino-editor-sample-selected",
    );
    report.editorSample = {
      action: "Open Rat Casino sample",
      selectedChapterId: await chapterPicker.inputValue(),
      selectedChapterLabel: await chapterPicker
        .locator("option:checked")
        .textContent(),
      screenshot: editorScreenshot,
    };
    await chapterPicker.selectOption("chapter-1");
    assert.equal(await chapterPicker.inputValue(), "chapter-1");
    latestSave = null;
    previewPayload = null;
    report.previewRequest = null;
    const fullStarted = await startEditorPreview(fullAdventurePage, {
      scope: "adventure",
      timeout: 60_000,
    });
    assert.equal(fullStarted.started, true, JSON.stringify(fullStarted));
    const fullOpeningSave = await waitForSave(
      (save) => save.adventure?.activeLevelIndex === 0,
      "full-adventure-opening",
      30_000,
    );
    assert.equal(report.previewRequest?.scope, "adventure");
    assert.equal(report.previewRequest?.chapterId, "chapter-1");
    assert.deepEqual(
      report.previewRequest?.project?.chapters,
      project.chapters,
    );
    assert.equal(report.previewRequest?.project?.projectId, project.projectId);
    assert.equal(fullOpeningSave.adventure.activeLevel.totalLevels, 3);
    assert.equal(fullOpeningSave.adventure.planVersion, "editor-world-plan-v1");
    assert.deepEqual(
      project.chapters.map((chapter) => chapter.routeId),
      ["chapter-1-route", "chapter-2-route", ROUTE_ID],
    );
    await waitForInspection({
      page: fullAdventurePage,
      screenshot: (name) => screenshot(fullAdventurePage, name),
      label: "full-adventure-garden-ready",
      timeout: 30_000,
      predicate: (inspection) =>
        inspection.level.authored?.id === "chapter-1-route" &&
        inspection.status.mediaLoading === 0 &&
        inspection.status.mediaFailed === 0,
    });
    await screenshot(fullAdventurePage, "full-adventure-garden-baseline");
    const gardenPerformance = {
      ...(await sampleFrameTiming(fullAdventurePage)),
      surface: "garden opening",
      browser: "headless Chromium",
      renderer: "ANGLE/SwiftShader software WebGL",
      deviceEvidence: false,
    };
    const bossPerformance = report.performance;
    report.performance = {
      gardenBaseline: gardenPerformance,
      ratCasinoBoss: bossPerformance,
      ratToGardenFpsRatio: Number(
        (bossPerformance.fps / gardenPerformance.fps).toFixed(2),
      ),
    };

    const ratChapter = project.chapters.find(
      (chapter) => chapter.routeId === ROUTE_ID,
    );
    assert.ok(ratChapter, "frozen adventure is missing Rat Casino");
    assert.deepEqual(
      Object.values(ratChapter.encounterSlots)
        .map((slot) => slot.catalogEntryId)
        .sort(),
      Object.keys(ENCOUNTER_ART).sort(),
    );
    report.fullAdventure = {
      scope: "adventure",
      planVersion: fullOpeningSave.adventure.planVersion,
      totalLevels: fullOpeningSave.adventure.activeLevel.totalLevels,
      frozenRoutes: project.chapters.map((chapter) => chapter.routeId),
      transitions: [],
      activeRouteId: fullOpeningSave.adventure.currentLevelId,
      activeLevelIndex: fullOpeningSave.adventure.activeLevelIndex,
      completedLevelIds: [...fullOpeningSave.adventure.completedLevelIds],
      ratEncounterIds: Object.values(ratChapter.encounterSlots).map(
        (slot) => slot.catalogEntryId,
      ),
      coverage:
        "frozen three-chapter plan and garden entry; Rat chapter completed separately from-level",
    };
    await fullAdventureContext.close();

    const narrowContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      hasTouch: true,
      isMobile: true,
    });
    const narrowPage = await narrowContext.newPage();
    page = narrowPage;
    watchPage(narrowPage, "narrow-390x844");
    await narrowPage.goto(url, { waitUntil: "domcontentloaded" });
    const homeLayout = await measureLayout(narrowPage);
    assert.ok(
      homeLayout.horizontalOverflow <= 1,
      "narrow home overflows horizontally",
    );
    const cta = narrowPage.getByRole("button", {
      name: "Enter Rat Casino",
      exact: true,
    });
    await cta.tap();
    await narrowPage
      .locator("canvas[data-quest-canvas=true]")
      .waitFor({ timeout: 30_000 });
    const narrowInspection = await waitForInspection({
      page: narrowPage,
      screenshot: (name) => screenshot(narrowPage, name),
      label: "narrow-casino-ready",
      timeout: 45_000,
      predicate: (inspection) =>
        inspection.level.authored?.id === ROUTE_ID &&
        inspection.status.mediaLoading === 0 &&
        inspection.status.mediaFailed === 0,
    });
    const narrowLayout = await measureLayout(narrowPage);
    assert.ok(
      narrowLayout.horizontalOverflow <= 1,
      "narrow game overflows horizontally",
    );
    for (const name of ["Jump", "Attack"])
      await narrowPage
        .getByRole("button", { name, exact: true })
        .waitFor({ state: "visible", timeout: 5_000 });
    await narrowPage
      .locator(".casino-tally")
      .waitFor({ state: "visible", timeout: 5_000 });
    const canvasBox = await narrowPage
      .locator("canvas[data-quest-canvas=true]")
      .boundingBox();
    assert.ok(canvasBox && canvasBox.width > 300 && canvasBox.height > 400);
    report.narrow = {
      viewport: { width: 390, height: 844 },
      routeId: narrowInspection.level.authored.id,
      homeHorizontalOverflow: homeLayout.horizontalOverflow,
      gameHorizontalOverflow: narrowLayout.horizontalOverflow,
      controls: ["Jump", "Attack"],
      canvas: canvasBox,
      browser: "Chromium mobile emulation",
    };
    await screenshot(narrowPage, "rat-casino-narrow");
    await narrowContext.close();

    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.consoleErrors, []);
    assert.deepEqual(report.responseErrors, []);
    assert.deepEqual(report.failedRequests, []);
    assert.deepEqual(report.externalRequests, []);
    report.status = "passed";
    report.finishedAt = new Date().toISOString();
  } finally {
    clearTimeout(timeout);
  }
} catch (error) {
  report.status = "failed";
  report.finishedAt = new Date().toISOString();
  report.failure = {
    name: error instanceof Error ? error.name : "Error",
    message: timedOut
      ? `Rat Casino harness exceeded ${timeoutMs}ms`
      : error instanceof Error
        ? error.message
        : String(error),
    stack: error instanceof Error ? error.stack : null,
  };
  if (page && !page.isClosed())
    await screenshot(page, "failure").catch(() => undefined);
  throw error;
} finally {
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await desktopContext?.close().catch(() => undefined);
  await browser?.close().catch(() => undefined);
}
