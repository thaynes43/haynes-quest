// Browser acceptance harness for the PLAN012 level editor workspace.
//
// Everything here drives the deployed editor through ordinary browser
// interaction: the /editor route, the named DESIGN019 controls, real keyboard
// and touch input, the real export download and the real preview runtime.
// There is no injected debug API, no seeded gameplay state and no test id.
//
//   QUEST_E2E_URL            base origin of the candidate build (required)
//   QUEST_E2E_RUN_LABEL      report folder under test-results/level-editor
//   QUEST_E2E_SOURCE_COMMIT  commit recorded alongside the evidence
//   QUEST_E2E_TIMEOUT_MS     hard wall-clock ceiling (default 900000)
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import sharp from "sharp";

import {
  createHybridControls,
  delay,
  inspectGame,
  waitForInspection,
} from "./authored-browser-driver.mjs";
import {
  EDITOR_CHAPTER_IDS,
  EDITOR_CHAPTER_LABELS,
  EDITOR_HEADER_CONTROLS,
  EDITOR_PLAYTEST_PATH,
  EDITOR_SECONDARY_CONTROLS,
  EDITOR_VALIDATION_COPY,
  SHIPPED_DOCUMENT_IDS,
  activateControl,
  attemptHorizontalScroll,
  attemptPageZoom,
  canonicalText,
  commitNumberProperty,
  commitTextProperty,
  describeEditorSurface,
  documentById,
  exportProject,
  hasProperty,
  importProjectText,
  listPropertyLabels,
  measureControlReachability,
  measureLayout,
  openEditor,
  pieceOrder,
  projectDocuments,
  readNumberProperty,
  readStoredDraft,
  readStoredProject,
  readTextProperty,
  resolveControl,
  resolvePropertyField,
  returnToEditor,
  reviewIssues,
  selectObject,
  setToggle,
  startEditorPreview,
  storageStatus,
  switchChapter,
  toggleState,
  unreachableControls,
  validationSummary,
  waitForEditorWorkspace,
  waitForStoredProject,
  webglFrameRendered,
} from "./editor-driver.mjs";

const url = process.env.QUEST_E2E_URL;
assert.ok(
  url,
  "QUEST_E2E_URL is required; never point this harness at a stale server",
);
const runLabel = process.env.QUEST_E2E_RUN_LABEL ?? "candidate";
const sourceCommit = process.env.QUEST_E2E_SOURCE_COMMIT ?? null;
const timeoutMs = Number(process.env.QUEST_E2E_TIMEOUT_MS ?? 900_000);
assert.ok(Number.isFinite(timeoutMs) && timeoutMs >= 120_000);
const outDir = `test-results/level-editor/${runLabel}`;
const reportPath = `${outDir}/report.json`;
await fs.mkdir(outDir, { recursive: true });

const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const NARROW_VIEWPORT = { width: 390, height: 844 };

const report = {
  startedAt: new Date().toISOString(),
  status: "running",
  url,
  sourceCommit,
  browser: null,
  bundle: null,
  viewports: { desktop: DESKTOP_VIEWPORT, narrow: NARROW_VIEWPORT },
  surface: null,
  scenarios: [],
  failures: [],
  screenshots: [],
  expectedFaults: [],
  responseErrors: [],
  pageErrors: [],
  consoleErrors: [],
  limits: [
    "Chromium desktop and mobile emulation. Physical iPad/iPhone Safari acceptance is Tom's separate gate.",
    "WebGL renders through ANGLE/SwiftShader software rasterisation; frame times here are not device performance.",
    "Browser-menu zoom and operating-system magnification stay outside any webpage's control; only trusted in-page zoom input is exercised.",
  ],
};

let faultWindow = null;
const mark = (stage, details = {}) => {
  console.log(`[level-editor] ${stage} ${JSON.stringify(details)}`);
};

/* -------------------------------------------------------------------------- */

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
report.browser = browser.version();

const desktop = await browser.newContext({
  viewport: DESKTOP_VIEWPORT,
  deviceScaleFactor: 1,
  acceptDownloads: true,
});
const narrow = await browser.newContext({
  viewport: NARROW_VIEWPORT,
  deviceScaleFactor: 1,
  hasTouch: true,
  isMobile: true,
  acceptDownloads: true,
});

const watch = (page, surface) => {
  page.on("pageerror", (error) => {
    const entry = { surface, message: error.message };
    (faultWindow ? report.expectedFaults : report.pageErrors).push({
      type: "pageerror",
      window: faultWindow,
      ...entry,
    });
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const entry = { surface, text: message.text() };
    (faultWindow ? report.expectedFaults : report.consoleErrors).push({
      type: "console",
      window: faultWindow,
      ...entry,
    });
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    const entry = {
      surface,
      method: response.request().method(),
      path: new URL(response.url()).pathname,
      status: response.status(),
    };
    (faultWindow ? report.expectedFaults : report.responseErrors).push({
      type: "response",
      window: faultWindow,
      ...entry,
    });
  });
};

const page = await desktop.newPage();
watch(page, "desktop");

let screenshotSequence = 0;
/**
 * Capture a real composited frame and measure it, so a blank WebGL canvas is a
 * failure rather than a reassuring-looking PNG.
 */
const screenshot = async (
  target,
  name,
  { clip = null, expectImage = false } = {},
) => {
  const safe = name.replaceAll(/[^a-z0-9-]/gi, "-").toLowerCase();
  const path = `${outDir}/${String(++screenshotSequence).padStart(2, "0")}-${safe}.png`;
  await target.screenshot({ path, ...(clip ? { clip } : {}) });
  const stats = await sharp(path).stats();
  const variance = Math.max(...stats.channels.map((channel) => channel.stdev));
  const entry = { path, name, variance: Number(variance.toFixed(3)) };
  report.screenshots.push(entry);
  if (expectImage) {
    assert.ok(
      variance > 2,
      `${name}: captured frame is effectively uniform (stdev ${variance.toFixed(3)}); the WebGL view did not render`,
    );
  }
  return entry;
};

/** Crop a screenshot to the live 3D canvas so the evidence is the rendered world. */
const canvasClip = async (target, selector) => {
  const locator = target.locator(selector).first();
  if ((await locator.count()) === 0) return null;
  const box = await locator.boundingBox();
  if (!box || box.width < 8 || box.height < 8) return null;
  return {
    x: Math.max(0, Math.round(box.x)),
    y: Math.max(0, Math.round(box.y)),
    width: Math.round(box.width),
    height: Math.round(box.height),
  };
};

/**
 * Leave the desktop page back on the workspace so one failed scenario does not
 * cascade into the rest of the evidence run.
 */
const recoverWorkspace = async () => {
  if ((await page.locator("canvas[data-quest-canvas=true]").count()) > 0) {
    await returnToEditor(page).catch(() => undefined);
  }
  await waitForEditorWorkspace(page, { timeout: 20_000 }).catch(
    () => undefined,
  );
};

/**
 * Scenarios record their failure and continue by default; the run still exits
 * non-zero because `report.failures` is asserted empty at the end. `fatal`
 * marks the few checks without which nothing later would mean anything.
 */
const scenario = async (name, run, { fatal = false } = {}) => {
  const entry = {
    name,
    status: "running",
    startedAt: new Date().toISOString(),
  };
  report.scenarios.push(entry);
  mark(`scenario:start`, { name });
  try {
    entry.evidence = (await run()) ?? null;
    entry.status = "passed";
    mark("scenario:passed", { name });
  } catch (error) {
    entry.status = "failed";
    entry.error =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { name: "NonError", message: String(error) };
    report.failures.push({ name, message: entry.error.message });
    mark("scenario:failed", { name, message: entry.error.message });
    await screenshot(page, `failure-${name}`).catch(() => undefined);
    if (fatal) throw error;
    await recoverWorkspace();
  } finally {
    entry.finishedAt = new Date().toISOString();
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  return entry.evidence;
};

const close = async () => {
  await desktop.close().catch(() => undefined);
  await narrow.close().catch(() => undefined);
  await browser.close().catch(() => undefined);
};

const timer = setTimeout(() => {
  mark("timeout", { timeoutMs });
  void close();
}, timeoutMs);

/* -------------------------------------------------------------------------- */
/* Shared state built up across scenarios                                     */
/* -------------------------------------------------------------------------- */

/** The anchor this run edits, and the values that prove it is not a built-in. */
const anchorProbe = {
  chapter: 1,
  documentId: SHIPPED_DOCUMENT_IDS[1],
  slot: "attack-tool",
  rowLabel: "Attack tool",
  shippedX: null,
  editedX: null,
  platformId: null,
};

const anchorPosition = (project, documentId, slot) =>
  documentById(project, documentId)?.document.anchors.pickups[slot].position ??
  null;

/* -------------------------------------------------------------------------- */

try {
  const index = await fetch(url);
  assert.equal(index.status, 200, "candidate build is unavailable");

  await scenario(
    "editor-route-and-shell",
    async () => {
      const opened = await openEditor(page, url);
      const bundlePath = await page
        .locator('script[type="module"][src]')
        .first()
        .getAttribute("src");
      assert.ok(bundlePath, "application bundle is missing from /editor");
      const bundleResponse = await desktop.request.get(
        new URL(bundlePath, url).href,
      );
      assert.equal(bundleResponse.status(), 200);
      const bytes = await bundleResponse.body();
      report.bundle = {
        path: bundlePath,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
      const surface = await describeEditorSurface(page);
      report.surface = surface;
      for (const label of [
        ...EDITOR_HEADER_CONTROLS,
        ...EDITOR_SECONDARY_CONTROLS,
      ]) {
        assert.ok(
          surface.controls[label],
          `DESIGN019 control "${label}" is missing from /editor`,
        );
      }
      for (const chapter of [1, 2]) {
        assert.ok(
          surface.controls[EDITOR_CHAPTER_LABELS[chapter]],
          `chapter selector is missing "${EDITOR_CHAPTER_LABELS[chapter]}"`,
        );
      }
      assert.ok(
        surface.canvases.total > 0,
        "the editor workspace rendered no 3D view",
      );
      assert.ok(
        await webglFrameRendered(page),
        "the editor 3D viewport never produced a WebGL frame",
      );
      assert.equal(
        surface.canvases.gameCanvas,
        0,
        "the editor mounted the gameplay canvas instead of an editing viewport",
      );
      return { opened, bundle: report.bundle, surface };
    },
    { fatal: true },
  );

  await scenario(
    "initial-two-chapter-project",
    async () => {
      const project = await waitForStoredProject(
        page,
        (candidate) => projectDocuments(candidate).length >= 2,
        "initial-project",
      );
      const documents = projectDocuments(project);
      assert.equal(
        documents.length,
        2,
        "the initial project does not hold exactly two chapters",
      );
      const ids = documents.map((entry) => entry.document.id);
      assert.deepEqual(
        [...ids].sort(),
        [SHIPPED_DOCUMENT_IDS[1], SHIPPED_DOCUMENT_IDS[2]].sort(),
        "the initial project is not the two shipped v2 templates",
      );
      const summary = await validationSummary(page);
      assert.equal(
        summary.state,
        "ready",
        `an untouched project must read "${EDITOR_VALIDATION_COPY.ready}", saw ${JSON.stringify(summary)}`,
      );
      const storage = await storageStatus(page);
      anchorProbe.shippedX = anchorPosition(
        project,
        anchorProbe.documentId,
        anchorProbe.slot,
      )?.x;
      anchorProbe.platformId = documentById(
        project,
        anchorProbe.documentId,
      )?.document.anchors.pickups[anchorProbe.slot].platformId;
      assert.ok(
        Number.isFinite(anchorProbe.shippedX),
        "shipped attack-tool anchor unreadable",
      );
      assert.ok(
        anchorProbe.platformId,
        "shipped attack-tool anchor has no supporting platform",
      );
      return {
        documents: documents.map((entry) => ({
          path: entry.path,
          id: entry.document.id,
          pieces: entry.document.pieces.length,
          connections: entry.document.connections.length,
          mainPath: entry.document.mainPath.length,
          canonicalSha256: createHash("sha256")
            .update(canonicalText(entry.document))
            .digest("hex"),
        })),
        validation: summary,
        storage,
        anchorProbe: { ...anchorProbe },
      };
    },
    { fatal: true },
  );

  // The strongest available parity evidence that needs no source import: the
  // shipped runtime's own authored document, read from the ordinary playtest.
  await scenario("templates-match-the-shipped-runtime-documents", async () => {
    const shipped = await desktop.newPage();
    watch(shipped, "shipped-runtime");
    const editorProject = await readStoredProject(page);
    const comparisons = [];
    try {
      for (const chapter of [1, 2]) {
        await shipped.goto(url, { waitUntil: "domcontentloaded" });
        await shipped
          .getByRole("button", {
            name:
              chapter === 1
                ? "Play from the beginning"
                : "Try the Besties chapter",
            exact: true,
          })
          .click();
        const inspection = await waitForInspection({
          page: shipped,
          screenshot: async () => undefined,
          label: `shipped-chapter-${chapter}`,
          timeout: 45_000,
          predicate: (candidate) =>
            candidate.level.authored?.id === SHIPPED_DOCUMENT_IDS[chapter],
        });
        const runtimeDocument = inspection.level.authored;
        const editorDocument = documentById(
          editorProject,
          SHIPPED_DOCUMENT_IDS[chapter],
        )?.document;
        assert.ok(
          editorDocument,
          `editor project has no ${SHIPPED_DOCUMENT_IDS[chapter]}`,
        );
        const runtimeCanonical = canonicalText(runtimeDocument);
        const editorCanonical = canonicalText(editorDocument);
        comparisons.push({
          chapter,
          id: SHIPPED_DOCUMENT_IDS[chapter],
          equal: runtimeCanonical === editorCanonical,
          runtimeSha256: createHash("sha256")
            .update(runtimeCanonical)
            .digest("hex"),
          editorSha256: createHash("sha256")
            .update(editorCanonical)
            .digest("hex"),
          pieceOrderEqual:
            JSON.stringify(pieceOrder(runtimeDocument)) ===
            JSON.stringify(pieceOrder(editorDocument)),
        });
        assert.equal(
          editorCanonical,
          runtimeCanonical,
          `chapter ${chapter}: the editor template is not an exact copy of the shipped document`,
        );
      }
    } finally {
      await shipped.close().catch(() => undefined);
    }
    return { comparisons };
  });

  await scenario("object-selection-and-properties", async () => {
    await selectObject(page, anchorProbe.platformId);
    const platform = {
      x: await readNumberProperty(page, "X"),
      y: await readNumberProperty(page, "Y"),
      z: await readNumberProperty(page, "Z"),
      width: await readNumberProperty(page, "Width"),
      height: await readNumberProperty(page, "Height"),
      depth: await readNumberProperty(page, "Depth"),
      labels: await listPropertyLabels(page),
    };
    const project = await readStoredProject(page);
    const piece = documentById(
      project,
      anchorProbe.documentId,
    )?.document.pieces.find(
      (candidate) => candidate.id === anchorProbe.platformId,
    );
    assert.ok(piece, "selected platform is absent from the stored draft");
    assert.equal(
      platform.x,
      piece.center.x,
      "inspector X does not match the document",
    );
    assert.equal(
      platform.width,
      piece.size.x,
      "inspector Width does not match the document",
    );
    assert.equal(
      platform.depth,
      piece.size.z,
      "inspector Depth does not match the document",
    );

    await selectObject(page, "Boss");
    const boss = {
      labels: await listPropertyLabels(page),
      minX: (await hasProperty(page, "Min X"))
        ? await readNumberProperty(page, "Min X")
        : null,
      maxX: (await hasProperty(page, "Max X"))
        ? await readNumberProperty(page, "Max X")
        : null,
      minZ: (await hasProperty(page, "Min Z"))
        ? await readNumberProperty(page, "Min Z")
        : null,
      maxZ: (await hasProperty(page, "Max Z"))
        ? await readNumberProperty(page, "Max Z")
        : null,
    };
    for (const label of [
      "Min X",
      "Max X",
      "Min Z",
      "Max Z",
      "Platform",
      "Checkpoint",
    ]) {
      assert.ok(
        boss.labels.includes(label),
        `boss inspector is missing "${label}"`,
      );
    }
    const bossAnchor = documentById(project, anchorProbe.documentId)?.document
      .anchors.encounters.boss;
    assert.equal(
      boss.minX,
      bossAnchor.arena.minX,
      "boss arena Min X does not match the document",
    );
    assert.equal(
      boss.maxZ,
      bossAnchor.arena.maxZ,
      "boss arena Max Z does not match the document",
    );

    // Gameplay slots are movable but never deletable (DESIGN019).
    const deleteControl = await resolveControl(page, "Delete");
    const deletable = deleteControl.found
      ? await deleteControl.locator.isEnabled()
      : false;
    assert.equal(deletable, false, "a gameplay slot offered an enabled Delete");
    return {
      platform,
      boss,
      gameplayDeleteOffered: deleteControl.found,
      deletable,
    };
  });

  await scenario("supported-anchor-edit-stays-valid", async () => {
    await selectObject(page, anchorProbe.rowLabel);
    const before = await readNumberProperty(page, "X");
    assert.equal(
      before,
      anchorProbe.shippedX,
      "anchor inspector disagrees with the template",
    );
    const project = await readStoredProject(page);
    const platform = documentById(
      project,
      anchorProbe.documentId,
    )?.document.pieces.find((piece) => piece.id === anchorProbe.platformId);
    // Stay a comfortable margin inside the supporting platform so the edit is a
    // legitimate authoring move, not a deliberate geometry error.
    const margin = 0.8;
    const limit = platform.center.x + platform.size.x / 2 - margin;
    const candidate = Number((before + 2.5).toFixed(2));
    anchorProbe.editedX =
      candidate <= limit
        ? candidate
        : Number((platform.center.x - platform.size.x / 2 + margin).toFixed(2));
    assert.notEqual(
      anchorProbe.editedX,
      anchorProbe.shippedX,
      "the probe edit would not change the anchor",
    );
    const committed = await commitNumberProperty(
      page,
      "X",
      anchorProbe.editedX,
    );
    assert.equal(
      committed,
      anchorProbe.editedX,
      "the anchor X field did not commit",
    );
    const saved = await waitForStoredProject(
      page,
      (candidateProject) =>
        anchorPosition(
          candidateProject,
          anchorProbe.documentId,
          anchorProbe.slot,
        )?.x === anchorProbe.editedX,
      "anchor-edit-autosave",
    );
    const summary = await validationSummary(page);
    assert.equal(
      summary.state,
      "ready",
      `the anchor edit left the project invalid: ${JSON.stringify(summary)}`,
    );
    const storage = await storageStatus(page);
    const clip = await canvasClip(page, "canvas");
    await screenshot(page, "editor-desktop-anchor-selected", {
      clip,
      expectImage: true,
    });
    return {
      slot: anchorProbe.slot,
      shippedX: anchorProbe.shippedX,
      editedX: anchorProbe.editedX,
      storedX: anchorPosition(saved, anchorProbe.documentId, anchorProbe.slot)
        .x,
      validation: summary,
      storage,
    };
  });

  await scenario("chapter-switch-keeps-both-documents", async () => {
    const toTwo = await switchChapter(page, 2);
    const twoProject = await readStoredProject(page);
    const besties = documentById(twoProject, SHIPPED_DOCUMENT_IDS[2])?.document;
    assert.ok(besties, "chapter two vanished from the project");
    const bestiesRow = page.getByRole("button", {
      name: besties.pieces[0].id,
      exact: true,
    });
    assert.ok(
      (await bestiesRow.count()) > 0,
      "the object rail did not switch to the chapter two document",
    );
    const twoSummary = await validationSummary(page);
    const toOne = await switchChapter(page, 1);
    await selectObject(page, anchorProbe.rowLabel);
    const retained = await readNumberProperty(page, "X");
    assert.equal(
      retained,
      anchorProbe.editedX,
      "switching chapters discarded the chapter one edit",
    );
    const project = await readStoredProject(page);
    assert.equal(
      projectDocuments(project).length,
      2,
      "a chapter was dropped from the project",
    );
    return { toTwo, toOne, twoSummary, retainedX: retained };
  });

  await scenario("move-attached-objects-translates-anchors", async () => {
    const readPlatformX = async () => {
      const project = await readStoredProject(page);
      const document = documentById(project, anchorProbe.documentId).document;
      return {
        platform: document.pieces.find(
          (piece) => piece.id === anchorProbe.platformId,
        ).center.x,
        anchor: document.anchors.pickups[anchorProbe.slot].position.x,
      };
    };
    // Autosave is debounced, so every read below waits for the draft to land
    // rather than sampling it once.
    const awaitPlatformX = async (expected, label) => {
      await waitForStoredProject(
        page,
        (project) => {
          const document = documentById(
            project,
            anchorProbe.documentId,
          )?.document;
          if (!document) return false;
          const platform = document.pieces.find(
            (piece) => piece.id === anchorProbe.platformId,
          )?.center.x;
          const anchor = document.anchors.pickups[anchorProbe.slot].position.x;
          return (
            Math.abs(platform - expected.platform) < 1e-6 &&
            Math.abs(anchor - expected.anchor) < 1e-6
          );
        },
        label,
      );
      return readPlatformX();
    };

    await selectObject(page, anchorProbe.platformId);
    const attachedDefault = await toggleState(page, "Move attached objects");
    assert.equal(
      attachedDefault,
      true,
      "Move attached objects must default on for a platform (DESIGN019)",
    );
    const start = await readPlatformX();
    const delta = 1;
    const moved = start.platform + delta;
    await commitNumberProperty(page, "X", moved);
    const withAttached = await awaitPlatformX(
      { platform: moved, anchor: start.anchor + delta },
      "move-with-attached",
    );
    assert.ok(
      Math.abs(withAttached.platform - moved) < 1e-6,
      "the platform did not move",
    );
    assert.ok(
      Math.abs(withAttached.anchor - start.anchor - delta) < 1e-6,
      "the supported anchor did not translate with its platform",
    );
    const attachedValidation = await validationSummary(page);

    await activateControl(page, "Undo");
    const undone = await awaitPlatformX(start, "undo-attached-move");

    await selectObject(page, anchorProbe.platformId);
    await setToggle(page, "Move attached objects", false);
    const detachedTarget = start.platform + delta;
    await commitNumberProperty(page, "X", detachedTarget);
    const detached = await awaitPlatformX(
      { platform: detachedTarget, anchor: start.anchor },
      "move-with-attached-off",
    );
    assert.ok(
      Math.abs(detached.platform - detachedTarget) < 1e-6,
      "the platform did not move with the toggle off",
    );
    assert.ok(
      Math.abs(detached.anchor - start.anchor) < 1e-6,
      "the anchor moved even though Move attached objects was off",
    );
    await activateControl(page, "Undo");
    const restored = await awaitPlatformX(start, "undo-detached-move");
    await selectObject(page, anchorProbe.platformId);
    await setToggle(page, "Move attached objects", true);
    return {
      start,
      withAttached,
      attachedValidation,
      detached,
      undone,
      restored,
    };
  });

  await scenario("undo-and-redo-the-anchor-edit", async () => {
    await activateControl(page, "Undo");
    const undoneProject = await waitForStoredProject(
      page,
      (project) =>
        anchorPosition(project, anchorProbe.documentId, anchorProbe.slot)?.x ===
        anchorProbe.shippedX,
      "undo-anchor-edit",
    );
    const undoneValidation = await validationSummary(page);
    await activateControl(page, "Redo");
    const redoneProject = await waitForStoredProject(
      page,
      (project) =>
        anchorPosition(project, anchorProbe.documentId, anchorProbe.slot)?.x ===
        anchorProbe.editedX,
      "redo-anchor-edit",
    );
    await selectObject(page, anchorProbe.rowLabel);
    const inspectorX = await readNumberProperty(page, "X");
    assert.equal(
      inspectorX,
      anchorProbe.editedX,
      "redo did not reach the inspector",
    );
    return {
      undoneX: anchorPosition(
        undoneProject,
        anchorProbe.documentId,
        anchorProbe.slot,
      ).x,
      redoneX: anchorPosition(
        redoneProject,
        anchorProbe.documentId,
        anchorProbe.slot,
      ).x,
      undoneValidation,
      inspectorX,
    };
  });

  await scenario("export-import-round-trip", async () => {
    const exported = await exportProject(page);
    assert.match(
      exported.filename,
      /^[a-z0-9-]+\.json$/,
      `export produced an unreadable filename ${JSON.stringify(exported.filename)}`,
    );
    const stored = await readStoredProject(page);
    assert.equal(
      canonicalText(exported.project),
      canonicalText(stored),
      "the exported file is not semantically equal to the saved draft",
    );
    const beforeOrder = Object.fromEntries(
      projectDocuments(stored).map((entry) => [
        entry.document.id,
        pieceOrder(entry.document),
      ]),
    );
    const exportedOrder = Object.fromEntries(
      projectDocuments(exported.project).map((entry) => [
        entry.document.id,
        pieceOrder(entry.document),
      ]),
    );
    assert.deepEqual(exportedOrder, beforeOrder, "export reordered the pieces");
    assert.equal(
      anchorPosition(exported.project, anchorProbe.documentId, anchorProbe.slot)
        .x,
      anchorProbe.editedX,
      "export lost the anchor edit",
    );
    // Deterministic canonical serialisation: exporting twice is byte-identical.
    const again = await exportProject(page);
    assert.equal(again.text, exported.text, "export is not deterministic");

    const imported = await importProjectText(page, exported.text);
    assert.equal(
      imported.closed,
      true,
      `a valid import was rejected: ${JSON.stringify(imported)}`,
    );
    const importedRevision = exported.project.revision + 1;
    const afterImport = await waitForStoredProject(
      page,
      (project) => project.revision === importedRevision,
      "valid-import",
    );
    assert.equal(
      afterImport.revision,
      importedRevision,
      "the imported project was not committed as the next revision",
    );
    assert.equal(
      canonicalText({
        ...afterImport,
        revision: exported.project.revision,
      }),
      canonicalText(exported.project),
      "the re-imported project is not semantically equal to the exported file",
    );
    assert.deepEqual(
      Object.fromEntries(
        projectDocuments(afterImport).map((entry) => [
          entry.document.id,
          pieceOrder(entry.document),
        ]),
      ),
      beforeOrder,
      "import reordered the pieces",
    );
    // A successful import is undoable (DESIGN019).
    const undoAfterImport = await resolveControl(page, "Undo");
    const undoEnabled = undoAfterImport.found
      ? await undoAfterImport.locator.isEnabled()
      : false;
    assert.equal(undoEnabled, true, "a successful import left nothing to undo");
    await undoAfterImport.locator.click();
    const afterImportUndo = await waitForStoredProject(
      page,
      (project) => project.revision === exported.project.revision,
      "undo-valid-import",
    );
    assert.equal(
      canonicalText(afterImportUndo),
      canonicalText(stored),
      "undoing the import did not restore the pre-import project",
    );
    const redoAfterImport = await resolveControl(page, "Redo");
    assert.equal(
      redoAfterImport.found ? await redoAfterImport.locator.isEnabled() : false,
      true,
      "undoing the import left nothing to redo",
    );
    await redoAfterImport.locator.click();
    const afterImportRedo = await waitForStoredProject(
      page,
      (project) => project.revision === importedRevision,
      "redo-valid-import",
    );
    assert.equal(
      canonicalText(afterImportRedo),
      canonicalText(afterImport),
      "redoing the import did not restore the imported project",
    );
    return {
      filename: exported.filename,
      bytes: exported.bytes,
      deterministic: true,
      sha256: createHash("sha256").update(exported.text).digest("hex"),
      pieceOrder: beforeOrder,
      importAlerts: imported.alerts,
      revisions: {
        exported: exported.project.revision,
        imported: afterImport.revision,
        undone: afterImportUndo.revision,
        redone: afterImportRedo.revision,
      },
    };
  });

  await scenario("malformed-import-leaves-the-project-intact", async () => {
    const before = await settleDraft();
    faultWindow = "malformed-import";
    const attempts = [];
    try {
      for (const [label, payload] of [
        ["truncated", '{"name":"Broken adventure","chapters":['],
        ["not-json", "this is not a project"],
        [
          "wrong-shape",
          JSON.stringify({ name: "Nope", chapters: { one: 42 } }),
        ],
      ]) {
        const result = await importProjectText(page, payload);
        await activateControl(page, "Cancel").catch(() => undefined);
        await waitForEditorWorkspace(page);
        const after = await readStoredDraft(page);
        assert.equal(
          after,
          before,
          `${label}: a rejected import changed the saved draft`,
        );
        attempts.push({ label, ...result });
      }
    } finally {
      faultWindow = null;
    }
    const project = await readStoredProject(page);
    assert.equal(
      anchorPosition(project, anchorProbe.documentId, anchorProbe.slot).x,
      anchorProbe.editedX,
      "a rejected import disturbed the current project",
    );
    const summary = await validationSummary(page);
    assert.equal(
      summary.state,
      "ready",
      "a rejected import left the project invalid",
    );
    return { attempts, validation: summary };
  });

  await scenario("invalid-draft-is-retained-and-blocks-playtest", async () => {
    faultWindow = "invalid-draft";
    let evidence;
    try {
      // A deliberate geometry error an author can make and then repair: drag a
      // routed platform far out of reach of its connections.
      await switchChapter(page, 1);
      const project = await readStoredProject(page);
      const document = documentById(project, anchorProbe.documentId).document;
      const routed = document.mainPath[1];
      const piece = document.pieces.find(
        (candidate) => candidate.id === routed,
      );
      assert.ok(piece, "chapter one main path references a missing piece");
      await selectObject(page, routed);
      const brokenZ = Number((piece.center.z - 48).toFixed(2));
      await commitNumberProperty(page, "Z", brokenZ);
      const summary = await waitForInvalid();
      const issues = await reviewIssues(page);
      assert.ok(
        issues.issues.length > 0,
        "the issues panel listed nothing to fix",
      );
      assert.ok(
        issues.issues.some(
          (text) =>
            text.includes(routed) || /anchors|pieces|connections/.test(text),
        ),
        `validation issues carry no object/path context: ${JSON.stringify(issues.issues)}`,
      );
      assert.ok(
        issues.issues.every((text) => !/\bat \w+ \(.*:\d+:\d+\)/.test(text)),
        "validation surfaced a raw stack trace",
      );
      // The invalid draft still exports and still edits.
      const exported = await exportProject(page);
      assert.equal(
        documentById(
          exported.project,
          anchorProbe.documentId,
        ).document.pieces.find((candidate) => candidate.id === routed).center.z,
        brokenZ,
        "an invalid draft could not be exported",
      );
      const blocked = await startEditorPreview(page, { scope: "chapter" });
      assert.equal(
        blocked.started,
        false,
        "Playtest started from an invalid draft",
      );
      assert.equal(
        blocked.blocked,
        true,
        "Playtest did not surface the blocking message",
      );
      assert.deepEqual(
        blocked.requests,
        [],
        "an invalid draft still posted a playtest request",
      );
      await activateControl(page, "Undo");
      const repaired = await waitForStoredProject(
        page,
        (candidate) =>
          documentById(candidate, anchorProbe.documentId).document.pieces.find(
            (entry) => entry.id === routed,
          ).center.z === piece.center.z,
        "repair-invalid-draft",
      );
      const readyAgain = await validationSummary(page);
      assert.equal(
        readyAgain.state,
        "ready",
        "the repair did not restore a valid project",
      );
      evidence = {
        brokenPieceId: routed,
        brokenZ,
        summary,
        issues: issues.issues.slice(0, 12),
        blocked,
        repairedZ: documentById(
          repaired,
          anchorProbe.documentId,
        ).document.pieces.find((entry) => entry.id === routed).center.z,
        readyAgain,
      };
    } finally {
      faultWindow = null;
    }
    return evidence;
  });

  await scenario("reload-restores-the-browser-draft", async () => {
    const before = await settleDraft();
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForEditorWorkspace(page);
    const after = await readStoredDraft(page);
    assert.equal(after, before, "reload rewrote the saved draft");
    await switchChapter(page, 1);
    await selectObject(page, anchorProbe.rowLabel);
    const restoredX = await readNumberProperty(page, "X");
    assert.equal(
      restoredX,
      anchorProbe.editedX,
      "reload lost the edited anchor",
    );
    const storage = await storageStatus(page);
    const undo = await resolveControl(page, "Undo");
    return {
      restoredX,
      storage,
      // Recorded, not asserted: DESIGN019 autosaves the project, not the
      // undo stack, so a fresh load legitimately starts with empty history.
      undoEnabledAfterReload: undo.found
        ? await undo.locator.isEnabled()
        : null,
    };
  });

  await scenario("preview-chapter-one-uses-the-edited-document", async () => {
    await switchChapter(page, 1);
    await selectObject(page, anchorProbe.rowLabel);
    // Seed one deliberate, geometry-free edit so "history survives the
    // preview" is a real claim: the reload scenario above legitimately
    // emptied the undo stack. It has to be the project name, not the chapter
    // name -- DESIGN019 puts an edited chapter name into the chapter selector,
    // which would rename the very label this harness selects chapters by.
    const historyMarker = "Editor lane history check";
    const chapterNameBefore = await readTextProperty(page, "Project name");
    await commitTextProperty(page, "Project name", historyMarker);
    await delay(200);
    const undoBefore = await resolveControl(page, "Undo");
    const undoEnabledBeforePreview = await undoBefore.locator.isEnabled();
    assert.equal(
      undoEnabledBeforePreview,
      true,
      "a deliberate name edit created no undo transaction",
    );
    const started = await startEditorPreview(page, { scope: "chapter" });
    assert.equal(
      started.started,
      true,
      `preview did not start: ${JSON.stringify(started)}`,
    );
    const request = started.requests.at(-1);
    assert.ok(request, "preview did not post to " + EDITOR_PLAYTEST_PATH);
    assert.equal(request.method, "POST");
    assert.equal(request.body?.chapterId, EDITOR_CHAPTER_IDS[1]);
    assert.equal(request.body?.scope, "chapter");
    assert.ok(request.body?.project, "the preview request carried no project");
    assert.equal(
      canonicalText(request.body.project),
      canonicalText(await readStoredProject(page)),
      "the preview froze a project that is not the current draft",
    );

    const initial = await waitForInspection({
      page,
      screenshot: (name) => screenshot(page, name),
      label: "preview-chapter-1-ready",
      timeout: 60_000,
      predicate: (inspection) =>
        inspection.level.authored?.id === anchorProbe.documentId &&
        Boolean(inspection.obby),
    });
    const runtimeAnchor =
      initial.level.authored.anchors.pickups[anchorProbe.slot].position;
    assert.equal(
      runtimeAnchor.x,
      anchorProbe.editedX,
      "the preview runtime resolved the shipped anchor, not the edited one",
    );
    assert.notEqual(
      runtimeAnchor.x,
      anchorProbe.shippedX,
      "the preview silently played the built-in document",
    );
    const rendered = [...initial.level.pickupPositions].sort(
      (left, right) =>
        Math.abs(left.x - anchorProbe.editedX) -
        Math.abs(right.x - anchorProbe.editedX),
    )[0];
    assert.ok(rendered, "the preview rendered no equipment pickups");
    assert.ok(
      Math.abs(rendered.x - anchorProbe.editedX) < 0.05,
      `rendered pickup sits at x=${rendered.x}, expected the edited ${anchorProbe.editedX}`,
    );
    const clip = await canvasClip(page, "canvas[data-quest-canvas=true]");
    await screenshot(page, "preview-chapter-1-edited-anchor", {
      clip,
      expectImage: true,
    });

    // A normal action: walk into the moved pickup and let the save round-trip.
    const controls = createHybridControls({ page });
    const collected = await walkIntoPickup(controls, rendered.id);
    const after = await waitForInspection({
      page,
      screenshot: (name) => screenshot(page, name),
      label: "preview-chapter-1-after-action",
      timeout: 20_000,
      predicate: (inspection) =>
        inspection.level.authored?.id === anchorProbe.documentId,
    });
    const persisted =
      after.level.authored.anchors.pickups[anchorProbe.slot].position;
    assert.equal(
      persisted.x,
      anchorProbe.editedX,
      "a normal action and SaveView update reverted the geometry to the built-in document",
    );
    const persistedRender = after.level.pickupPositions.find(
      (pickup) => pickup.id === rendered.id,
    );
    assert.ok(
      Math.abs(persistedRender.x - anchorProbe.editedX) < 0.05,
      "the rendered pickup moved back to the built-in placement after the save update",
    );

    const back = await returnToEditor(page);
    await switchChapter(page, 1);
    await selectObject(page, anchorProbe.rowLabel);
    const editorX = await readNumberProperty(page, "X");
    assert.equal(
      editorX,
      anchorProbe.editedX,
      "returning from preview replaced the draft",
    );
    const retainedChapterName = await readTextProperty(page, "Project name");
    assert.equal(
      retainedChapterName,
      historyMarker,
      "returning from preview discarded the pending name edit",
    );
    const undo = await resolveControl(page, "Undo");
    assert.equal(
      await undo.locator.isEnabled(),
      true,
      "returning from preview discarded the undo history",
    );
    // The surviving entry must be the real transaction, not an empty stack.
    await undo.locator.click();
    await delay(400);
    const undoneChapterName = await readTextProperty(page, "Project name");
    assert.equal(
      undoneChapterName,
      chapterNameBefore,
      "the undo entry that survived the preview did not restore the prior name",
    );
    const anchorAfterUndo = await (async () => {
      await selectObject(page, anchorProbe.rowLabel);
      return readNumberProperty(page, "X");
    })();
    assert.equal(
      anchorAfterUndo,
      anchorProbe.editedX,
      "undoing the name edit also reverted the anchor edit",
    );
    return {
      historyRetention: {
        projectNameBefore: chapterNameBefore,
        historyMarker,
        retainedProjectName: retainedChapterName,
        undoneProjectName: undoneChapterName,
        undoEnabledBeforePreview,
      },
      request: { chapterId: request.body.chapterId, scope: request.body.scope },
      runtimeAnchor,
      renderedPickup: {
        id: rendered.id,
        x: rendered.y === undefined ? null : rendered.x,
      },
      collected,
      persisted,
      back,
      editorX,
    };
  });

  await scenario("preview-chapter-two-and-full-adventure", async () => {
    await switchChapter(page, 2);
    const chapterTwo = await startEditorPreview(page, { scope: "chapter" });
    assert.equal(chapterTwo.started, true, "chapter two preview did not start");
    assert.equal(
      chapterTwo.requests.at(-1)?.body?.chapterId,
      EDITOR_CHAPTER_IDS[2],
    );
    assert.equal(chapterTwo.requests.at(-1)?.body?.scope, "chapter");
    const twoInspection = await waitForInspection({
      page,
      screenshot: (name) => screenshot(page, name),
      label: "preview-chapter-2-ready",
      timeout: 60_000,
      predicate: (inspection) =>
        inspection.level.authored?.id === SHIPPED_DOCUMENT_IDS[2] &&
        Boolean(inspection.obby),
    });
    const twoClip = await canvasClip(page, "canvas[data-quest-canvas=true]");
    await screenshot(page, "preview-chapter-2", {
      clip: twoClip,
      expectImage: true,
    });
    await returnToEditor(page);

    const adventure = await startEditorPreview(page, { scope: "adventure" });
    assert.equal(
      adventure.started,
      true,
      "full-adventure preview did not start",
    );
    const adventureRequest = adventure.requests.at(-1);
    assert.equal(
      adventureRequest?.scope ?? adventureRequest?.body?.scope,
      "adventure",
    );
    assert.ok(
      [EDITOR_CHAPTER_IDS[1], EDITOR_CHAPTER_IDS[2]].includes(
        adventureRequest?.body?.chapterId,
      ),
      `full adventure posted an unexpected chapterId ${adventureRequest?.body?.chapterId}`,
    );
    const adventureInspection = await waitForInspection({
      page,
      screenshot: (name) => screenshot(page, name),
      label: "preview-adventure-ready",
      timeout: 60_000,
      predicate: (inspection) =>
        Boolean(inspection.level.authored?.id) && Boolean(inspection.obby),
    });
    const adventureClip = await canvasClip(
      page,
      "canvas[data-quest-canvas=true]",
    );
    await screenshot(page, "preview-full-adventure", {
      clip: adventureClip,
      expectImage: true,
    });
    await returnToEditor(page);
    const project = await readStoredProject(page);
    assert.equal(
      projectDocuments(project).length,
      2,
      "preview replaced the draft project",
    );
    return {
      chapterTwo: {
        request: chapterTwo.requests.at(-1)?.body
          ? {
              chapterId: chapterTwo.requests.at(-1).body.chapterId,
              scope: chapterTwo.requests.at(-1).body.scope,
            }
          : null,
        documentId: twoInspection.level.authored.id,
      },
      adventure: {
        request: adventureRequest?.body
          ? {
              chapterId: adventureRequest.body.chapterId,
              scope: adventureRequest.body.scope,
            }
          : null,
        documentId: adventureInspection.level.authored.id,
      },
    };
  });

  await scenario("desktop-layout-and-zoom-lock", async () => {
    await waitForEditorWorkspace(page);
    const before = await measureLayout(page);
    const zoom = await attemptPageZoom(page, desktop);
    const after = await measureLayout(page);
    const scrollLeft = await attemptHorizontalScroll(page);
    assert.ok(
      before.horizontalOverflow <= 1,
      `desktop workspace overflows horizontally by ${before.horizontalOverflow}px: ${JSON.stringify(before.offenders)}`,
    );
    assert.equal(scrollLeft, 0, "the desktop workspace scrolled horizontally");
    assert.ok(
      after.visualViewport && Math.abs(after.visualViewport.scale - 1) <= 0.01,
      `trusted zoom input changed the desktop page scale: ${JSON.stringify(after.visualViewport)}`,
    );
    const clip = await canvasClip(page, "canvas");
    await screenshot(page, "editor-desktop-workspace", { expectImage: true });
    await screenshot(page, "editor-desktop-viewport", {
      clip,
      expectImage: true,
    });
    return { before, after, zoom, scrollLeft };
  });

  await scenario("narrow-touch-layout-and-drawers", async () => {
    const small = await narrow.newPage();
    watch(small, "narrow");
    try {
      await openEditor(small, url);
      await waitForStoredProject(
        small,
        (project) => projectDocuments(project).length === 2,
        "narrow-initial-project",
      );
      const layout = await measureLayout(small);
      assert.ok(
        layout.horizontalOverflow <= 1,
        `narrow workspace overflows horizontally by ${layout.horizontalOverflow}px: ${JSON.stringify(layout.offenders)}`,
      );
      const scrollLeft = await attemptHorizontalScroll(small);
      assert.equal(scrollLeft, 0, "the narrow workspace scrolled horizontally");

      const drawers = {};
      for (const [label, check] of [
        ["View", async () => await small.locator("canvas").first().isVisible()],
        [
          "Objects",
          async () =>
            await small
              .getByRole("button", {
                name: anchorProbe.platformId,
                exact: true,
              })
              .first()
              .isVisible(),
        ],
        [
          "Properties",
          async () =>
            (await resolvePropertyField(small, "X")).locator?.isVisible() ??
            false,
        ],
        [
          "Checks",
          async () => (await validationSummary(small)).state !== "unknown",
        ],
      ]) {
        const control = await resolveControl(small, label);
        if (!control.found) {
          drawers[label] = { found: false, usable: false };
          continue;
        }
        await control.locator.click();
        await delay(250);
        if (label === "Properties") {
          // Properties needs a selection; pick one through the Objects drawer.
          const objects = await resolveControl(small, "Objects");
          if (objects.found) {
            await objects.locator.click();
            await delay(200);
            await selectObject(small, anchorProbe.platformId);
            await control.locator.click().catch(() => undefined);
            await delay(250);
          }
        }
        drawers[label] = {
          found: true,
          role: control.role,
          usable: await check().catch(() => false),
        };
        assert.equal(
          drawers[label].usable,
          true,
          `the narrow "${label}" drawer showed nothing usable`,
        );
      }

      // Numeric precision editing must survive without a gizmo on touch.
      const objectsTab = await resolveControl(small, "Objects");
      if (objectsTab.found) {
        await objectsTab.locator.click();
        await delay(200);
      }
      await selectObject(small, anchorProbe.platformId);
      const properties = await resolveControl(small, "Properties");
      if (properties.found) {
        await properties.locator.click();
        await delay(250);
      }
      const touchX = await readNumberProperty(small, "X");
      const fontSize = await (
        await resolvePropertyField(small, "X")
      ).locator.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      );
      assert.ok(
        fontSize >= 16,
        `touch editing text is ${fontSize}px, below the 16px floor`,
      );

      const zoom = await attemptPageZoom(small, narrow);
      const afterZoom = await measureLayout(small);
      assert.ok(
        afterZoom.visualViewport &&
          Math.abs(afterZoom.visualViewport.scale - 1) <= 0.01,
        `trusted zoom input changed the narrow page scale: ${JSON.stringify(afterZoom.visualViewport)}`,
      );
      const viewTab = await resolveControl(small, "View");
      if (viewTab.found) {
        await viewTab.locator.click();
        await delay(300);
      }
      assert.ok(
        await webglFrameRendered(small),
        "the narrow 3D view produced no WebGL frame",
      );
      const clip = await canvasClip(small, "canvas");
      await screenshot(small, "editor-narrow-workspace", { expectImage: true });
      if (clip)
        await screenshot(small, "editor-narrow-viewport", {
          clip,
          expectImage: true,
        });
      return { layout, scrollLeft, drawers, touchX, fontSize, zoom, afterZoom };
    } finally {
      await small.close().catch(() => undefined);
    }
  });

  await scenario("toolbar-controls-stay-reachable", async () => {
    // A clipped header row keeps `scrollWidth` honest while still burying a
    // control, so reachability is hit-tested at each target width.
    const labels = [
      ...EDITOR_HEADER_CONTROLS,
      ...EDITOR_SECONDARY_CONTROLS,
      "Snap",
      EDITOR_CHAPTER_LABELS[1],
    ];
    const surfaces = [
      {
        name: "phone-portrait",
        viewport: { width: 390, height: 844 },
        touch: true,
      },
      {
        name: "ipad-portrait",
        viewport: { width: 834, height: 1112 },
        touch: true,
      },
      { name: "desktop", viewport: DESKTOP_VIEWPORT, touch: false },
    ];
    const results = {};
    const offenders = [];
    for (const surface of surfaces) {
      const context = await browser.newContext({
        viewport: surface.viewport,
        deviceScaleFactor: 1,
        hasTouch: surface.touch,
        isMobile: surface.touch,
      });
      const sized = await context.newPage();
      watch(sized, surface.name);
      try {
        await openEditor(sized, url);
        const layout = await measureLayout(sized);
        const measured = await measureControlReachability(sized, labels);
        const unreachable = unreachableControls(measured);
        results[surface.name] = {
          viewport: surface.viewport,
          horizontalOverflow: layout.horizontalOverflow,
          measured,
          unreachable: unreachable.map((entry) => ({
            label: entry.label,
            reason: !entry.inViewport ? "outside the viewport" : "covered",
            left: entry.left,
            right: entry.right,
            top: entry.top,
            bottom: entry.bottom,
            hitTarget: entry.hitTarget,
          })),
        };
        if (unreachable.length > 0) {
          offenders.push(
            `${surface.name} (${surface.viewport.width}x${surface.viewport.height}): ${unreachable
              .map((entry) => entry.label)
              .join(", ")}`,
          );
        }
        await screenshot(sized, `toolbar-${surface.name}`);
      } finally {
        await sized.close().catch(() => undefined);
        await context.close().catch(() => undefined);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `toolbar controls are present but unusable: ${offenders.join(" | ")}`,
    );
    return results;
  });

  await scenario("clean-console-and-network", async () => {
    assert.deepEqual(report.pageErrors, [], "the editor raised page errors");
    assert.deepEqual(
      report.consoleErrors,
      [],
      "the editor logged console errors",
    );
    assert.deepEqual(
      report.responseErrors,
      [],
      "the editor produced failing responses",
    );
    return {
      expectedFaults: report.expectedFaults.length,
      expectedFaultWindows: [
        ...new Set(report.expectedFaults.map((fault) => fault.window)),
      ],
    };
  });

  assert.deepEqual(
    report.failures.map((failure) => failure.name),
    [],
    `${report.failures.length} scenario(s) failed`,
  );
  report.status = "passed";
  report.finishedAt = new Date().toISOString();
} catch (error) {
  report.status = "failed";
  report.finishedAt = new Date().toISOString();
  report.failure =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { name: "NonError", message: String(error) };
  throw error;
} finally {
  clearTimeout(timer);
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await close();
}

/* -------------------------------------------------------------------------- */
/* Local helpers used by the scenarios above                                   */
/* -------------------------------------------------------------------------- */

/** Wait for the debounced autosave to stop writing before sampling the draft. */
async function settleDraft(timeout = 6_000) {
  const deadline = Date.now() + timeout;
  let last = await readStoredDraft(page);
  let stableSince = Date.now();
  while (Date.now() < deadline) {
    await delay(150);
    const current = await readStoredDraft(page);
    if (current !== last) {
      last = current;
      stableSince = Date.now();
      continue;
    }
    if (Date.now() - stableSince >= 700) return current;
  }
  return last;
}

async function waitForInvalid(timeout = 10_000) {
  const deadline = Date.now() + timeout;
  let summary = null;
  while (Date.now() < deadline) {
    summary = await validationSummary(page);
    if (summary.state === "issues") return summary;
    await delay(150);
  }
  throw new Error(
    `a broken route never reported "{count} issues to fix": ${JSON.stringify(summary)}`,
  );
}

/** Walk into an equipment pickup with the ordinary movement controls. */
async function walkIntoPickup(controls, pickupId, timeout = 60_000) {
  const deadline = Date.now() + timeout;
  let best = Number.POSITIVE_INFINITY;
  try {
    while (Date.now() < deadline) {
      const inspection = await inspectGame(page);
      assert.ok(inspection?.obby, "preview inspection is unavailable");
      const pickup = inspection.level.pickupPositions.find(
        (candidate) => candidate.id === pickupId,
      );
      assert.ok(pickup, `preview lost the ${pickupId} pickup`);
      if (pickup.collected) {
        return {
          pickupId,
          collectedAt: inspection.status.position,
          pickupAt: { x: pickup.x, y: pickup.y, z: pickup.z },
        };
      }
      const dx = pickup.x - inspection.status.position.x;
      const dz = pickup.z - inspection.status.position.z;
      best = Math.min(best, Math.hypot(dx, dz));
      await controls.pulseToward(dx, dz, { milliseconds: 130 });
    }
  } finally {
    await controls.release().catch(() => undefined);
  }
  throw new Error(
    `walking into ${pickupId} never collected it; nearest approach ${best.toFixed(2)}`,
  );
}
