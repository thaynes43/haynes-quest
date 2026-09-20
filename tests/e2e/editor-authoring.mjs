import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const baseUrl = process.env.QUEST_E2E_URL ?? "http://127.0.0.1:4430";
const runLabel = process.env.QUEST_E2E_RUN_LABEL ?? "local";
const outputDirectory = join("test-results", "editor-authoring", runLabel);
const storageKey = "haynes-quest.level-editor.project.v1";
const findings = [];

await mkdir(outputDirectory, { recursive: true });

function chapter(project) {
  return project.chapters[0].level;
}

function piece(project, id) {
  return chapter(project).pieces.find((candidate) => candidate.id === id);
}

async function draft(page) {
  return page.evaluate((key) => {
    const source = localStorage.getItem(key);
    return source ? JSON.parse(source) : null;
  }, storageKey);
}

async function waitForDraft(page, predicate, message, timeoutMs = 8_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const project = await draft(page);
    if (project && predicate(project)) return project;
    await page.waitForTimeout(50);
  }
  throw new Error(message);
}

async function waitForRevision(page, previousRevision) {
  return waitForDraft(
    page,
    (project) => project.revision > previousRevision,
    `draft revision did not advance beyond ${previousRevision}`,
  );
}

async function waitForStatus(page, expected) {
  await page.waitForFunction(
    (text) =>
      document.querySelector(".editor-project-status")?.textContent?.trim() ===
      text,
    expected,
  );
}

async function openEditor(browser, name) {
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(`${baseUrl}/editor/`, { waitUntil: "networkidle" });
  await waitForStatus(page, "Ready to play");
  await waitForDraft(page, () => true, "initial draft was not saved");
  return { context, page, errors, name };
}

async function exportedProject(page) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  assert(path, "export download did not produce a local file");
  return {
    filename: download.suggestedFilename(),
    project: JSON.parse(await readFile(path, "utf8")),
  };
}

async function addDuplicateDelete(browser) {
  const fixture = await openEditor(browser, "add-duplicate-delete");
  const { context, page, errors } = fixture;
  try {
    let project = await draft(page);
    const initialPieceCount = chapter(project).pieces.length;
    await page.getByRole("tab", { name: "Add", exact: true }).click();
    for (const label of [
      "Platform",
      "Moving platform",
      "Sweeper",
      "Checkpoint",
    ]) {
      const revision = project.revision;
      await page.getByRole("button", { name: label, exact: true }).click();
      project = await waitForRevision(page, revision);
    }

    assert.equal(chapter(project).pieces.length, initialPieceCount + 4);
    assert.deepEqual(piece(project, "platform"), {
      type: "platform",
      id: "platform",
      center: piece(project, "platform").center,
      size: { x: 4, y: 0.6, z: 4 },
    });
    assert.deepEqual(piece(project, "moving-platform"), {
      type: "moving-platform",
      id: "moving-platform",
      center: piece(project, "moving-platform").center,
      size: { x: 3.4, y: 0.6, z: 3.4 },
      motion: { axis: "x", distance: 1, period: 8 },
    });
    assert.deepEqual(piece(project, "sweeper"), {
      type: "sweeper",
      id: "sweeper",
      center: piece(project, "sweeper").center,
      halfLength: 1,
      radius: 0.18,
      rotation: { period: 12 },
    });
    assert.deepEqual(piece(project, "checkpoint"), {
      type: "checkpoint",
      id: "checkpoint",
      position: piece(project, "checkpoint").position,
      platformId: "welcome",
      activation: { type: "platform" },
    });

    let revision = project.revision;
    await page.getByRole("button", { name: "Duplicate", exact: true }).click();
    project = await waitForRevision(page, revision);
    const duplicate = piece(project, "checkpoint-copy");
    assert(duplicate, "Duplicate did not create checkpoint-copy");
    assert.equal(duplicate.type, "checkpoint");

    revision = project.revision;
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    project = await waitForRevision(page, revision);
    assert.equal(piece(project, "checkpoint-copy"), undefined);

    revision = project.revision;
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    project = await waitForRevision(page, revision);
    assert(
      piece(project, "checkpoint-copy"),
      "Undo did not restore the deletion",
    );

    const exported = await exportedProject(page);
    assert.equal(exported.project.revision, project.revision);
    assert.match(exported.filename, /\.json$/);
    await page.screenshot({
      path: join(outputDirectory, "add-duplicate-delete.png"),
    });
    assert.deepEqual(errors, []);
    findings.push({
      scenario: fixture.name,
      addedTypes: [
        piece(project, "platform").type,
        piece(project, "moving-platform").type,
        piece(project, "sweeper").type,
        piece(project, "checkpoint").type,
      ],
      duplicateRestored: Boolean(piece(project, "checkpoint-copy")),
      revision: project.revision,
    });
  } finally {
    await context.close();
  }
}

function routeSection(page, heading) {
  return page.locator(".editor-route-section").filter({
    has: page.locator("h2", { hasText: heading }),
  });
}

async function commitSequence(section, text) {
  const input = section.locator("textarea").first();
  await input.fill(text);
  await input.press("Enter");
}

async function routeForms(browser) {
  const fixture = await openEditor(browser, "route-forms");
  const { context, page, errors } = fixture;
  try {
    let project = await draft(page);
    const original = structuredClone(chapter(project));
    await page.getByRole("tab", { name: "Route", exact: true }).click();

    const firstConnection = page.locator(".editor-connection").first();
    let revision = project.revision;
    await firstConnection.locator("select").nth(2).selectOption("ride");
    project = await waitForRevision(page, revision);
    assert.equal(chapter(project).connections[0].mode, "ride");
    await waitForStatus(page, "Draft");
    const connectionEditExport = await exportedProject(page);
    assert.equal(
      chapter(connectionEditExport.project).connections[0].mode,
      "ride",
    );

    revision = project.revision;
    await firstConnection
      .locator("select")
      .nth(2)
      .selectOption(original.connections[0].mode);
    project = await waitForRevision(page, revision);
    assert.deepEqual(chapter(project).connections[0], original.connections[0]);
    await waitForStatus(page, "Ready to play");

    const originalConnectionCount = original.connections.length;
    revision = project.revision;
    await firstConnection
      .getByRole("button", { name: "Remove connection", exact: true })
      .click();
    project = await waitForRevision(page, revision);
    assert.equal(
      chapter(project).connections.length,
      originalConnectionCount - 1,
    );
    await waitForStatus(page, "Draft");

    revision = project.revision;
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    project = await waitForRevision(page, revision);
    assert.deepEqual(chapter(project).connections, original.connections);
    await waitForStatus(page, "Ready to play");

    revision = project.revision;
    await page
      .getByRole("button", { name: "Add connection", exact: true })
      .click();
    project = await waitForRevision(page, revision);
    assert.equal(
      chapter(project).connections.length,
      originalConnectionCount + 1,
    );
    await waitForStatus(page, "Draft");

    const addedConnection = page.locator(".editor-connection").last();
    revision = project.revision;
    await addedConnection
      .locator("select")
      .nth(2)
      .selectOption(original.connections[0].mode);
    project = await waitForRevision(page, revision);
    assert.equal(
      chapter(project).connections.at(-1).mode,
      original.connections[0].mode,
    );
    const duplicateConnectionExport = await exportedProject(page);
    assert.equal(
      chapter(duplicateConnectionExport.project).connections.length,
      originalConnectionCount + 1,
    );

    revision = project.revision;
    await addedConnection
      .getByRole("button", {
        name: "Remove connection",
        exact: true,
      })
      .click();
    project = await waitForRevision(page, revision);
    assert.deepEqual(chapter(project).connections, original.connections);
    await waitForStatus(page, "Ready to play");

    const mainRoute = routeSection(page, "Main route");
    const mainRouteInput = mainRoute.locator("textarea").first();
    revision = project.revision;
    await mainRouteInput.fill("welcome, garden-hop-2");
    await mainRouteInput.press("Escape");
    await page.waitForTimeout(400);
    assert.equal((await draft(page)).revision, revision);
    assert.equal(
      await mainRouteInput.inputValue(),
      original.mainPath.join(", "),
    );

    revision = project.revision;
    await commitSequence(mainRoute, "welcome, missing-platform");
    project = await waitForRevision(page, revision);
    assert.deepEqual(chapter(project).mainPath, [
      "welcome",
      "missing-platform",
    ]);
    await waitForStatus(page, "Draft");
    assert.match(
      await page.locator(".editor-issue-summary").textContent(),
      /issues? to fix/,
    );
    const invalidExport = await exportedProject(page);
    assert.deepEqual(chapter(invalidExport.project).mainPath, [
      "welcome",
      "missing-platform",
    ]);

    revision = project.revision;
    await commitSequence(mainRoute, original.mainPath.join(", "));
    project = await waitForRevision(page, revision);
    assert.deepEqual(chapter(project).mainPath, original.mainPath);
    await waitForStatus(page, "Ready to play");

    const originalBranchCount = original.branches.length;
    revision = project.revision;
    await page.getByRole("button", { name: "Add branch", exact: true }).click();
    project = await waitForRevision(page, revision);
    assert.equal(chapter(project).branches.length, originalBranchCount + 1);
    await waitForStatus(page, "Draft");

    const branchIds = [
      original.mainPath[0],
      original.mainPath[2],
      original.mainPath[1],
    ];
    revision = project.revision;
    const addedBranch = page.locator(".editor-branch").last();
    await addedBranch.locator("textarea").fill(branchIds.join(", "));
    await addedBranch.locator("textarea").press("Enter");
    project = await waitForRevision(page, revision);
    assert.deepEqual(chapter(project).branches.at(-1), branchIds);
    await waitForStatus(page, "Draft");
    const branchEditExport = await exportedProject(page);
    assert.deepEqual(
      chapter(branchEditExport.project).branches.at(-1),
      branchIds,
    );

    revision = project.revision;
    await addedBranch
      .getByRole("button", { name: "Remove branch", exact: true })
      .click();
    project = await waitForRevision(page, revision);
    assert.deepEqual(chapter(project).branches, original.branches);
    await waitForStatus(page, "Ready to play");

    await page.screenshot({ path: join(outputDirectory, "route-forms.png") });
    assert.deepEqual(errors, []);
    findings.push({
      scenario: fixture.name,
      connectionEditExported: connectionEditExport.project.revision,
      duplicateConnectionRepaired: duplicateConnectionExport.project.revision,
      invalidMainPathExported: invalidExport.project.chapters[0].level.mainPath,
      branchEditExported: branchEditExport.project.revision,
      routeEscapeCanceled: true,
      finalRevision: project.revision,
    });
  } finally {
    await context.close();
  }
}

async function redAxisHandle(canvas) {
  const bounds = await canvas.boundingBox();
  assert(bounds, "editor canvas has no bounding box");
  const screenshot = await canvas.screenshot();
  const { data, info } = await sharp(screenshot)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const center = { x: info.width / 2, y: info.height / 2 };
  const red = [];
  for (let y = Math.max(0, center.y - 100); y < center.y + 100; y += 1) {
    for (let x = center.x + 15; x < center.x + 150; x += 1) {
      const offset = (Math.floor(y) * info.width + Math.floor(x)) * 3;
      if (data[offset] > 245 && data[offset + 1] < 45 && data[offset + 2] < 45)
        red.push({ x, y });
    }
  }
  assert(red.length > 20, "could not find the selected gizmo's red axis");
  const maximumX = Math.max(...red.map((point) => point.x));
  const shaft = red.filter(
    (point) => point.x >= maximumX - 28 && point.x <= maximumX - 10,
  );
  assert(shaft.length > 0, "could not find a draggable red-axis shaft");
  return {
    x: bounds.x + maximumX - 18,
    y:
      bounds.y +
      shaft.reduce((total, point) => total + point.y, 0) / shaft.length,
  };
}

async function dragGizmo(page, start, delta) {
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 10 });
}

async function gizmoTransactions(browser) {
  const fixture = await openEditor(browser, "gizmo-transactions");
  const { context, page, errors } = fixture;
  try {
    const initial = await draft(page);
    const originalCenter = structuredClone(piece(initial, "welcome").center);
    await page.getByRole("button", { name: "welcome", exact: true }).click();
    await page.waitForTimeout(350);
    const canvas = page.locator(".editor-viewport canvas");
    const handle = await redAxisHandle(canvas);

    await dragGizmo(page, handle, { x: 60, y: 5 });
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await page.mouse.up();
    await page.waitForTimeout(350);
    let project = await draft(page);
    assert.equal(project.revision, initial.revision);
    assert.deepEqual(piece(project, "welcome").center, originalCenter);

    await dragGizmo(page, handle, { x: 60, y: 5 });
    await page.mouse.up();
    project = await waitForRevision(page, initial.revision);
    const movedCenter = structuredClone(piece(project, "welcome").center);
    assert.notDeepEqual(movedCenter, originalCenter);
    assert.equal(project.revision, initial.revision + 1);

    const movedRevision = project.revision;
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    project = await waitForRevision(page, movedRevision);
    assert.deepEqual(piece(project, "welcome").center, originalCenter);
    assert.equal(
      await page
        .getByRole("button", { name: "Undo", exact: true })
        .isDisabled(),
      true,
      "one undo did not consume the single gizmo transaction",
    );

    await page.screenshot({
      path: join(outputDirectory, "gizmo-transactions.png"),
    });
    assert.deepEqual(errors, []);
    findings.push({
      scenario: fixture.name,
      interruptedDragRevision: initial.revision,
      completedDragRevision: movedRevision,
      originalCenter,
      movedCenter,
      oneUndoRestoredCenter: true,
    });
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({ headless: true });
let failure;
try {
  for (const scenario of [addDuplicateDelete, routeForms, gizmoTransactions]) {
    const name = scenario.name;
    process.stdout.write(`[editor-authoring] scenario:start ${name}\n`);
    try {
      await scenario(browser);
      process.stdout.write(`[editor-authoring] scenario:passed ${name}\n`);
    } catch (error) {
      failure ??= error;
      findings.push({ scenario: name, error: String(error) });
      process.stdout.write(
        `[editor-authoring] scenario:failed ${name} ${String(error)}\n`,
      );
    }
  }
} finally {
  await browser.close();
}

await writeFile(
  join(outputDirectory, "report.json"),
  `${JSON.stringify({ baseUrl, runLabel, findings }, null, 2)}\n`,
);
if (failure) throw failure;
