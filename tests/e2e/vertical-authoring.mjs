// Browser acceptance for optional geometry and generated climbing sections.
//
// Authoring uses named editor controls. Preview inspection is read-only, and
// the generated branch is traversed through ordinary keyboard movement/jumps;
// this harness never teleports the player or mutates game state.
//
//   QUEST_E2E_URL            base origin of the candidate build (required)
//   QUEST_E2E_RUN_LABEL      report folder under test-results/vertical-authoring
//   QUEST_E2E_SOURCE_COMMIT  commit recorded alongside the evidence
//   QUEST_E2E_TIMEOUT_MS     hard wall-clock ceiling (default 360000)
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";

import {
  chooseFallDirection,
  createAuthoredRouteDriver,
  createHybridControls,
  inspectGame,
  waitForInspection,
} from "./authored-browser-driver.mjs";
import {
  connectionBetween,
  planarDistance,
} from "./authored-navigation.mjs";
import {
  SHIPPED_DOCUMENT_IDS,
  activateControl,
  canonicalText,
  commitNumberProperty,
  commitSelectProperty,
  documentById,
  openEditor,
  readNumberProperty,
  readTextProperty,
  returnToEditor,
  selectObject,
  startEditorPreview,
  storageStatus,
  validationSummary,
  waitForEditorWorkspace,
  waitForStoredProject,
} from "./editor-driver.mjs";

const url = process.env.QUEST_E2E_URL;
assert.ok(
  url,
  "QUEST_E2E_URL is required; never point this harness at a stale server",
);
const runLabel = process.env.QUEST_E2E_RUN_LABEL ?? "candidate";
const sourceCommit = process.env.QUEST_E2E_SOURCE_COMMIT ?? null;
const timeoutMs = Number(process.env.QUEST_E2E_TIMEOUT_MS ?? 360_000);
assert.ok(Number.isFinite(timeoutMs) && timeoutMs >= 120_000);

const outputDirectory = `test-results/vertical-authoring/${runLabel}`;
const reportPath = `${outputDirectory}/report.json`;
const chapterDocumentId = SHIPPED_DOCUMENT_IDS[1];
const optionalPlatform = Object.freeze({
  id: "platform",
  center: Object.freeze({ x: 24, y: 3, z: -10 }),
  size: Object.freeze({ x: 4, y: 0.6, z: 4 }),
});

await fs.mkdir(outputDirectory, { recursive: true });

const report = {
  startedAt: new Date().toISOString(),
  status: "running",
  url,
  sourceCommit,
  browser: null,
  authored: null,
  preview: null,
  persisted: null,
  section: null,
  screenshots: [],
  pageErrors: [],
  consoleErrors: [],
  responseErrors: [],
  limits: [
    "Chromium desktop coverage does not establish physical iPad/iPhone Safari acceptance.",
    "The standalone floating platform is sampled but deliberately remains outside every required route.",
    "The generated arch is traversed with normal keyboard input; enjoyment remains a human playtest criterion.",
  ],
};

let browser;
let context;
let page;
let timer;

function levelDocument(project) {
  const found = documentById(project, chapterDocumentId);
  assert.ok(found, `project has no ${chapterDocumentId} document`);
  return found.document;
}

function piece(document, id) {
  return document.pieces.find((candidate) => candidate.id === id);
}

function explicitTopology(document) {
  return {
    connections: document.connections,
    mainPath: document.mainPath,
    branches: document.branches,
  };
}

function assertTopologyUnchanged(document, expected, stage) {
  assert.equal(
    canonicalText(explicitTopology(document)),
    canonicalText(expected),
    `${stage} changed the explicit route topology`,
  );
}

function assertPlatform(candidate, expected, stage) {
  assert.ok(candidate, `${stage} has no ${expected.id} platform`);
  assert.equal(candidate.type, "platform", `${stage} changed the piece type`);
  assert.deepEqual(candidate.center, expected.center, `${stage} changed its center`);
  assert.deepEqual(candidate.size, expected.size, `${stage} changed its size`);
}

async function waitForReady(stage, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  let latest = null;
  while (Date.now() < deadline) {
    latest = await validationSummary(page);
    if (latest.state === "ready") return latest;
    await page.waitForTimeout(120);
  }
  throw new Error(`${stage} never became ready: ${JSON.stringify(latest)}`);
}

async function capture(name) {
  const path = `${outputDirectory}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  report.screenshots.push(path);
  return path;
}

/**
 * Add and place one standalone floating platform through visible controls.
 */
async function addRaisedPlatform(expected) {
  await activateControl(page, "Add");
  await activateControl(page, "Platform", { roles: ["button"] });
  await waitForStoredProject(
    page,
    (project) => Boolean(piece(levelDocument(project), expected.id)),
    `${expected.id} was not added`,
  );
  await activateControl(page, "Properties");
  await commitNumberProperty(page, "X", expected.center.x);
  await commitNumberProperty(page, "Y", expected.center.y);
  await commitNumberProperty(page, "Z", expected.center.z);
  return waitForStoredProject(
    page,
    (project) => {
      const candidate = piece(levelDocument(project), expected.id);
      return (
        candidate?.center.x === expected.center.x &&
        candidate.center.y === expected.center.y &&
        candidate.center.z === expected.center.z
      );
    },
    `${expected.id} placement was not saved`,
  );
}

/** Read-only preview hook shared by standalone and generated geometry checks. */
async function inspectPreviewPlatforms(expectedPlatforms, label) {
  return waitForInspection({
    page,
    label,
    timeout: 60_000,
    screenshot: capture,
    predicate: (inspection) =>
      inspection.level.authored?.id === chapterDocumentId &&
      expectedPlatforms.every((expected) =>
        inspection.obby?.platforms?.some(
          (candidate) => candidate.id === expected.id,
        ),
      ),
  });
}

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
  context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  page = await context.newPage();
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    report.responseErrors.push({
      method: response.request().method(),
      path: new URL(response.url()).pathname,
      status: response.status(),
    });
  });
  timer = setTimeout(() => {
    void browser?.close();
  }, timeoutMs);

  await openEditor(page, url);
  const initialProject = await waitForStoredProject(
    page,
    (project) => Boolean(documentById(project, chapterDocumentId)),
    "initial editor project was not stored",
  );
  const initialDocument = levelDocument(initialProject);
  assert.equal(
    piece(initialDocument, optionalPlatform.id),
    undefined,
    `${optionalPlatform.id} already exists in the template`,
  );
  const initialTopology = structuredClone(explicitTopology(initialDocument));
  const initialPieceIds = initialDocument.pieces.map((candidate) => candidate.id);

  const authoredProject = await addRaisedPlatform(optionalPlatform);
  const authoredDocument = levelDocument(authoredProject);
  assertPlatform(
    piece(authoredDocument, optionalPlatform.id),
    optionalPlatform,
    "stored draft",
  );
  assertTopologyUnchanged(authoredDocument, initialTopology, "adding geometry");
  assert.deepEqual(
    authoredDocument.pieces
      .slice(0, initialPieceIds.length)
      .map((candidate) => candidate.id),
    initialPieceIds,
    "adding geometry reordered existing pieces",
  );
  assert.equal(
    authoredDocument.pieces.length,
    initialPieceIds.length + 1,
    "adding one platform changed the piece count unexpectedly",
  );
  const authoredValidation = await waitForReady("optional platform draft");
  const authoredStorage = await storageStatus(page);
  await capture("optional-platform-authored");
  report.authored = {
    platform: piece(authoredDocument, optionalPlatform.id),
    validation: authoredValidation,
    storage: authoredStorage,
    topologyUnchanged: true,
    pieceCount: authoredDocument.pieces.length,
  };

  const started = await startEditorPreview(page, { scope: "chapter" });
  assert.equal(
    started.started,
    true,
    `normal chapter preview did not start: ${JSON.stringify(started)}`,
  );
  const request = started.requests.at(-1);
  assert.equal(request?.method, "POST", "preview made no POST request");
  assert.equal(request?.body?.scope, "chapter");
  assert.equal(request?.body?.chapterId, "chapter-1");
  const requestDocument = levelDocument(request.body.project);
  assertPlatform(
    piece(requestDocument, optionalPlatform.id),
    optionalPlatform,
    "preview request",
  );
  assertTopologyUnchanged(requestDocument, initialTopology, "preview request");

  const inspection = await inspectPreviewPlatforms(
    [optionalPlatform],
    "optional-platform-preview",
  );
  const runtimePlatform = inspection.obby.platforms.find(
    (candidate) => candidate.id === optionalPlatform.id,
  );
  assert.ok(runtimePlatform, "preview did not sample the optional platform");
  assert.deepEqual(runtimePlatform.center, optionalPlatform.center);
  assert.deepEqual(runtimePlatform.size, optionalPlatform.size);
  assertPlatform(
    piece(inspection.level.authored, optionalPlatform.id),
    optionalPlatform,
    "resolved authored document",
  );

  const spawn = requestDocument.anchors.spawn;
  assert.equal(
    inspection.obby.supportId,
    spawn.platformId,
    "optional geometry displaced the player from the authored spawn support",
  );
  assert.ok(
    Math.hypot(
      inspection.status.position.x - spawn.position.x,
      inspection.status.position.z - spawn.position.z,
    ) < 0.05,
    "the no-input preview moved the player away from the authored spawn",
  );
  assert.equal(inspection.status.grounded, true, "spawn is not grounded");
  await page.waitForTimeout(400);
  const untouched = await inspectGame(page);
  assert.ok(untouched, "preview inspection disappeared without input");
  assert.equal(untouched.obby.supportId, spawn.platformId);
  assert.ok(
    Math.hypot(
      untouched.status.position.x - inspection.status.position.x,
      untouched.status.position.z - inspection.status.position.z,
    ) < 0.01,
    "the player moved despite receiving no gameplay input",
  );
  await capture("optional-platform-preview");
  report.preview = {
    request: { method: request.method, scope: request.body.scope },
    platform: runtimePlatform,
    spawn: {
      authored: spawn,
      position: inspection.status.position,
      supportId: inspection.obby.supportId,
      grounded: inspection.status.grounded,
    },
    readOnlyInspection: true,
  };

  await returnToEditor(page);
  const afterReturn = await waitForStoredProject(
    page,
    (project) => Boolean(piece(levelDocument(project), optionalPlatform.id)),
    "returning from preview lost the optional platform",
  );
  assertPlatform(
    piece(levelDocument(afterReturn), optionalPlatform.id),
    optionalPlatform,
    "draft after preview",
  );
  assertTopologyUnchanged(
    levelDocument(afterReturn),
    initialTopology,
    "returning from preview",
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForEditorWorkspace(page);
  const reloadedProject = await waitForStoredProject(
    page,
    (project) => Boolean(piece(levelDocument(project), optionalPlatform.id)),
    "reloading the editor lost the optional platform",
  );
  const reloadedDocument = levelDocument(reloadedProject);
  assertPlatform(
    piece(reloadedDocument, optionalPlatform.id),
    optionalPlatform,
    "reloaded draft",
  );
  assertTopologyUnchanged(reloadedDocument, initialTopology, "reloading");
  await waitForReady("reloaded optional platform draft");
  await activateControl(page, "Objects");
  await selectObject(page, optionalPlatform.id);
  await activateControl(page, "Properties");
  assert.equal(await readNumberProperty(page, "X"), optionalPlatform.center.x);
  assert.equal(await readNumberProperty(page, "Y"), optionalPlatform.center.y);
  assert.equal(await readNumberProperty(page, "Z"), optionalPlatform.center.z);
  await capture("optional-platform-reloaded");
  report.persisted = {
    platform: piece(reloadedDocument, optionalPlatform.id),
    validation: await validationSummary(page),
    storage: await storageStatus(page),
    topologyUnchanged: true,
  };

  // Build the default four-step raised arch as an ordinary author would. The
  // generated branch remains data: every support, edge and checkpoint below is
  // discovered from the stored document rather than duplicated in the harness.
  await activateControl(page, "Objects");
  await selectObject(page, "welcome");
  await activateControl(page, "Add");
  await commitSelectProperty(page, "Shape", "Raised arch");
  await commitSelectProperty(page, "Start platform", "welcome");
  await commitSelectProperty(page, "Rejoin platform", "picnic");
  await commitSelectProperty(page, "Side", "Left");
  await commitNumberProperty(page, "Climbing steps", 4);
  await commitNumberProperty(page, "Rise per step", 0.3);

  const beforeSectionProject = await waitForStoredProject(
    page,
    (project) => Boolean(piece(levelDocument(project), optionalPlatform.id)),
    "optional platform disappeared before section authoring",
  );
  const beforeSectionDocument = structuredClone(
    levelDocument(beforeSectionProject),
  );
  await activateControl(page, "Add section", { roles: ["button"] });
  const builtProject = await waitForStoredProject(
    page,
    (project) => Boolean(piece(levelDocument(project), "arch-step-1")),
    "raised arch was not added",
  );
  const builtDocument = levelDocument(builtProject);
  const sectionBranch = builtDocument.branches.find((branch) =>
    branch.includes("arch-step-1"),
  );
  assert.ok(sectionBranch, "raised arch created no explicit branch");
  assert.equal(sectionBranch[0], "welcome");
  assert.equal(sectionBranch.at(-1), "picnic");
  assert.deepEqual(
    builtDocument.mainPath,
    beforeSectionDocument.mainPath,
    "section builder changed the required main path",
  );
  assert.deepEqual(
    builtDocument.anchors,
    beforeSectionDocument.anchors,
    "section builder moved required gameplay anchors",
  );
  assert.deepEqual(
    builtDocument.pieces
      .slice(0, beforeSectionDocument.pieces.length)
      .map((candidate) => candidate.id),
    beforeSectionDocument.pieces.map((candidate) => candidate.id),
    "section builder reordered prior pieces",
  );

  const sectionPlatformIds = sectionBranch.slice(1, -1);
  const sectionPlatforms = sectionPlatformIds.map((id) => {
    const candidate = piece(builtDocument, id);
    assert.equal(candidate?.type, "platform", `${id} is not a static platform`);
    return candidate;
  });
  assert.ok(
    sectionPlatforms.length >= 4,
    "four climbing steps produced too few platforms",
  );
  const platformTops = sectionPlatforms.map(
    (candidate) => candidate.center.y + candidate.size.y / 2,
  );
  const peakTop = Math.max(...platformTops);
  const peakIndex = platformTops.indexOf(peakTop);
  const peakPlatform = sectionPlatforms[peakIndex];
  assert.ok(peakTop > 1, `raised arch crested at only ${peakTop}m`);
  assert.ok(peakIndex > 0, "raised arch has no ascent");
  assert.ok(
    platformTops.slice(peakIndex + 1).some((top) => top < peakTop),
    "raised arch has no descent",
  );

  const sectionCheckpoints = builtDocument.pieces.filter(
    (candidate) =>
      candidate.type === "checkpoint" &&
      sectionPlatformIds.includes(candidate.platformId),
  );
  assert.equal(
    sectionCheckpoints.length,
    sectionPlatformIds.length,
    "each generated step must have one checkpoint",
  );
  assert.deepEqual(
    new Set(sectionCheckpoints.map((checkpoint) => checkpoint.platformId)),
    new Set(sectionPlatformIds),
    "generated checkpoints do not cover every step",
  );
  const sectionEdges = sectionBranch.slice(1).map((to, index) =>
    connectionBetween(builtDocument, sectionBranch[index], to),
  );
  assert.equal(sectionEdges.length, sectionBranch.length - 1);
  assert.equal(await readTextProperty(page, "ID"), "arch-step-1");
  await waitForReady("raised arch draft");
  await capture("raised-arch-authored");

  await activateControl(page, "Undo");
  const undoneProject = await waitForStoredProject(
    page,
    (project) => !piece(levelDocument(project), "arch-step-1"),
    "one undo did not remove the whole section",
  );
  assert.equal(
    canonicalText(levelDocument(undoneProject)),
    canonicalText(beforeSectionDocument),
    "one undo did not restore the exact pre-section document",
  );
  await activateControl(page, "Redo");
  const redoneProject = await waitForStoredProject(
    page,
    (project) => Boolean(piece(levelDocument(project), "arch-step-1")),
    "redo did not restore the section",
  );
  assert.equal(
    canonicalText(levelDocument(redoneProject)),
    canonicalText(builtDocument),
    "redo did not restore the exact built section",
  );
  await waitForReady("redone raised arch draft");

  const sectionStarted = await startEditorPreview(page, { scope: "chapter" });
  assert.equal(
    sectionStarted.started,
    true,
    `raised arch preview did not start: ${JSON.stringify(sectionStarted)}`,
  );
  const sectionRequest = sectionStarted.requests.at(-1);
  assert.equal(sectionRequest?.method, "POST");
  const previewDocument = levelDocument(sectionRequest.body.project);
  assert.equal(
    canonicalText(previewDocument),
    canonicalText(builtDocument),
    "section preview did not freeze the redone document",
  );

  const sectionInspection = await inspectPreviewPlatforms([
    optionalPlatform,
    ...sectionPlatforms,
  ], "raised-arch-preview");
  for (const expected of sectionPlatforms) {
    const sampled = sectionInspection.obby.platforms.find(
      (candidate) => candidate.id === expected.id,
    );
    assert.ok(sampled, `preview did not sample ${expected.id}`);
    assert.deepEqual(sampled.center, expected.center);
    assert.deepEqual(sampled.size, expected.size);
  }
  assert.equal(sectionInspection.obby.supportId, "welcome");
  await capture("raised-arch-preview-start");

  const controls = createHybridControls({ page });
  const traversalEvents = [];
  const driver = createAuthoredRouteDriver({
    page,
    controls,
    screenshot: capture,
    mark: (stage, details) => traversalEvents.push({ stage, details }),
    maxRecoveries: 3,
  });
  let recovery = null;
  for (const [edgeIndex, edge] of sectionEdges.entries()) {
    const landed = await driver.crossEdge(
      edge,
      `raised-arch-edge-${edgeIndex + 1}`,
    );
    assert.equal(
      landed.obby.supportId,
      edge.to,
      `${edge.from}->${edge.to} landed on overlapping geometry`,
    );
    if (edge.to !== peakPlatform.id) continue;

    const peakCheckpoint = sectionCheckpoints.find(
      (checkpoint) => checkpoint.platformId === peakPlatform.id,
    );
    assert.ok(peakCheckpoint, "crest platform has no checkpoint");
    const checkpointed = await waitForInspection({
      page,
      screenshot: capture,
      label: "raised-arch-crest-checkpoint",
      timeout: 5_000,
      predicate: (candidate) =>
        candidate.obby?.supportId === peakPlatform.id &&
        candidate.obby?.checkpointId === peakCheckpoint.id,
    });
    const recoveriesBefore = checkpointed.obby.recoveries;
    const direction = chooseFallDirection(checkpointed);
    await controls.beginToward(direction.dx, direction.dz);
    let recovered;
    try {
      recovered = await waitForInspection({
        page,
        screenshot: capture,
        label: "raised-arch-checkpoint-recovery",
        timeout: 12_000,
        predicate: (candidate) =>
          candidate.obby?.recoveries > recoveriesBefore,
      });
    } finally {
      await controls.release();
    }
    assert.equal(recovered.obby.checkpointId, peakCheckpoint.id);
    assert.equal(recovered.obby.supportId, peakPlatform.id);
    assert.ok(recovered.obby.recoveryRemaining > 0);
    assert.ok(
      planarDistance(recovered.status.position, peakCheckpoint.position) < 0.7,
      "recovery did not return to the generated crest checkpoint",
    );
    recovery = {
      checkpointId: peakCheckpoint.id,
      platformId: peakPlatform.id,
      before: recoveriesBefore,
      after: recovered.obby.recoveries,
      direction,
      position: recovered.status.position,
    };
    await capture("raised-arch-checkpoint-recovered");
  }
  assert.ok(recovery, "the traversal never exercised crest recovery");
  const completed = await driver.read("raised-arch-complete");
  assert.equal(completed.obby.supportId, "picnic");
  assert.equal(
    driver.evidence.edgeEvidence.length,
    sectionEdges.length,
    "normal controls did not cross every generated connection",
  );

  await returnToEditor(page);
  const returnedProject = await waitForStoredProject(
    page,
    (project) => Boolean(piece(levelDocument(project), "arch-step-1")),
    "returning from traversal lost the raised section",
  );
  assert.equal(
    canonicalText(levelDocument(returnedProject)),
    canonicalText(builtDocument),
    "gameplay changed the authored section draft",
  );
  report.section = {
    branch: sectionBranch,
    platformIds: sectionPlatformIds,
    checkpointIds: sectionCheckpoints.map((checkpoint) => checkpoint.id),
    tops: platformTops,
    peakTop,
    undoRestoredPreSectionDocument: true,
    redoRestoredSectionDocument: true,
    traversal: {
      crossed: driver.evidence.edgeEvidence,
      events: traversalEvents,
      completedOn: completed.obby.supportId,
      recovery,
    },
    returned: {
      validation: await validationSummary(page),
      storage: await storageStatus(page),
      draftPreserved: true,
    },
  };

  assert.deepEqual(report.pageErrors, [], "the page raised runtime errors");
  assert.deepEqual(report.consoleErrors, [], "the page logged console errors");
  assert.deepEqual(report.responseErrors, [], "requests returned error responses");
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
  await context?.close().catch(() => undefined);
  await browser?.close().catch(() => undefined);
}
