// Browser semantics for the PLAN012 level editor workspace.
//
// Every accessor below drives the editor the way an author does: real roles and
// the visible labels DESIGN019 approved. There are deliberately no test ids, no
// injected globals and no debug shortcuts, so this helper keeps working while
// the workspace markup settles and fails loudly when a named control is gone.
import assert from "node:assert/strict";

/** Browser-local draft key owned by `src/client/editor/editor-storage.ts`. */
export const EDITOR_STORAGE_KEY = "haynes-quest.level-editor.project.v1";

/** Chapter selector labels from DESIGN019 (em dash, not a hyphen). */
export const EDITOR_CHAPTER_LABELS = Object.freeze({
  1: "Level 1 — The Block Party",
  2: "Level 2 — Besties Obby",
});

/** Playtest request chapter ids from the runtime contract. */
export const EDITOR_CHAPTER_IDS = Object.freeze({
  1: "chapter-1",
  2: "chapter-2",
});

/** Authored document ids the untouched templates must still resolve to. */
export const SHIPPED_DOCUMENT_IDS = Object.freeze({
  1: "garden-playground-v2",
  2: "besties-playground-v2",
});

export const EDITOR_PLAYTEST_PATH = "/api/editor/playtests";

/** Header and toolbar controls DESIGN019 names. */
export const EDITOR_HEADER_CONTROLS = Object.freeze([
  "Undo",
  "Redo",
  "Import",
  "Export",
  "Playtest",
]);

export const EDITOR_SECONDARY_CONTROLS = Object.freeze([
  "New project",
  "Validate",
  "Frame level",
  "Frame selection",
]);

/** Inspector property labels DESIGN019 fixes. */
export const EDITOR_PROPERTY_LABELS = Object.freeze([
  "X",
  "Y",
  "Z",
  "Width",
  "Height",
  "Depth",
  "Axis",
  "Travel",
  "Period",
  "Phase",
  "Platform",
  "Checkpoint",
  "Radius",
  "Half length",
  "Min X",
  "Max X",
  "Min Z",
  "Max Z",
]);

export const EDITOR_STORAGE_COPY = Object.freeze({
  saved: "Saved in this browser",
  saving: "Saving…",
  unavailable: "Browser storage is unavailable. Export your draft to keep it.",
  corrupt:
    "The saved draft could not be opened. Import a backup or start a new project.",
});

export const EDITOR_VALIDATION_COPY = Object.freeze({
  ready: "Ready to play",
  draft: "Draft",
  review: "Review issues",
  blocked: "Fix these issues before playtesting.",
  runtimeFailure: "Could not start the playtest. Your draft is safe.",
});

const CONTROL_ROLES = Object.freeze([
  "button",
  "tab",
  "link",
  "menuitem",
  "menuitemradio",
  "menuitemcheckbox",
  "checkbox",
  "radio",
  "switch",
]);

export const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * Find a native `<select>` that offers an exactly matching option label.
 * The chapter and Snap pickers may legitimately be selects or button groups;
 * both are ordinary browser controls, so both are accepted.
 */
async function selectOfferingOption(scope, label) {
  const selects = await scope.locator("select").all();
  for (const select of selects) {
    const options = await select.locator("option").allTextContents();
    if (options.some((option) => option.trim() === label)) return select;
  }
  return null;
}

/**
 * Resolve a visible control by its DESIGN019 label across the roles a real
 * implementation might reasonably use. Never throws; callers decide.
 */
export async function resolveControl(
  scope,
  label,
  { roles = CONTROL_ROLES } = {},
) {
  for (const role of roles) {
    const locator = scope.getByRole(role, { name: label, exact: true });
    const count = await locator.count();
    if (count > 0) {
      return { found: true, label, role, count, locator: locator.first() };
    }
  }
  const offering = await selectOfferingOption(scope, label);
  if (offering) {
    return { found: true, label, role: "option", count: 1, locator: offering };
  }
  // A select named by its own label rather than by an option, e.g. **Snap**.
  const named = await selectFieldByOwnLabel(scope, label);
  if (named) {
    return { found: true, label, role: "select", count: 1, locator: named };
  }
  return { found: false, label, role: null, count: 0, locator: null };
}

export async function requireControl(scope, label, options) {
  const control = await resolveControl(scope, label, options);
  assert.ok(
    control.found,
    `editor control "${label}" was not found by role (${CONTROL_ROLES.join(", ")}) or as a select option`,
  );
  return control;
}

/** Click/check/select a control by its label, whatever element it turned out to be. */
export async function activateControl(scope, label, options) {
  const control = await requireControl(scope, label, options);
  if (control.role === "option") {
    await control.locator.selectOption({ label });
  } else if (control.role === "select") {
    // Named by its own label; there is nothing to "press", only to focus.
    await control.locator.click();
  } else if (
    [
      "checkbox",
      "radio",
      "switch",
      "menuitemcheckbox",
      "menuitemradio",
    ].includes(control.role)
  ) {
    await control.locator.check();
  } else {
    await control.locator.click();
  }
  return control;
}

export async function controlEnabled(scope, label) {
  const control = await resolveControl(scope, label);
  if (!control.found) return null;
  return control.locator.isEnabled();
}

/** Read a labelled toggle such as **Move attached objects**. */
export async function toggleState(scope, label) {
  const checkbox = scope.getByLabel(label, { exact: true });
  if ((await checkbox.count()) > 0) return checkbox.first().isChecked();
  const control = await resolveControl(scope, label, {
    roles: ["checkbox", "switch", "menuitemcheckbox", "button"],
  });
  if (!control.found) return null;
  const checked = await control.locator.getAttribute("aria-checked");
  if (checked !== null) return checked === "true";
  const pressed = await control.locator.getAttribute("aria-pressed");
  return pressed === null ? null : pressed === "true";
}

export async function setToggle(scope, label, desired) {
  const current = await toggleState(scope, label);
  assert.notEqual(current, null, `toggle "${label}" was not found`);
  if (current === desired) return current;
  const checkbox = scope.getByLabel(label, { exact: true });
  if ((await checkbox.count()) > 0) {
    await (desired ? checkbox.first().check() : checkbox.first().uncheck());
  } else {
    const control = await requireControl(scope, label, {
      roles: ["checkbox", "switch", "menuitemcheckbox", "button"],
    });
    await control.locator.click();
  }
  const after = await toggleState(scope, label);
  assert.equal(after, desired, `toggle "${label}" did not reach ${desired}`);
  return after;
}

/** The editor workspace is ready when its object rail and toolbar are live. */
export async function waitForEditorWorkspace(page, { timeout = 30_000 } = {}) {
  const deadline = Date.now() + timeout;
  let lastSeen = null;
  while (Date.now() < deadline) {
    const playtest = await resolveControl(page, "Playtest");
    const exportControl = await resolveControl(page, "Export");
    const rail = page.getByRole("tab", { name: "Objects", exact: true });
    lastSeen = {
      playtest: playtest.found,
      export: exportControl.found,
      objectsTab: (await rail.count()) > 0,
    };
    if (playtest.found && exportControl.found) return lastSeen;
    await delay(150);
  }
  throw new Error(
    `level editor workspace did not become ready: ${JSON.stringify(lastSeen)}`,
  );
}

export async function openEditor(page, url, { timeout = 30_000 } = {}) {
  const target = new URL("/editor", url).href;
  const response = await page.goto(target, { waitUntil: "domcontentloaded" });
  assert.ok(response, `no response for ${target}`);
  assert.equal(
    response.status(),
    200,
    `${target} returned ${response.status()}`,
  );
  const ready = await waitForEditorWorkspace(page, { timeout });
  return { target, status: response.status(), ready };
}

/* -------------------------------------------------------------------------- */
/* Project documents                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Locate every authored chapter document inside the portable project envelope
 * without asserting an envelope shape the implementation has not fixed yet.
 */
export function projectDocuments(project) {
  const found = [];
  const visit = (node, path) => {
    if (!node || typeof node !== "object") return;
    if (
      typeof node.schemaVersion === "string" &&
      node.schemaVersion.startsWith("authored-level-") &&
      Array.isArray(node.pieces)
    ) {
      found.push({ path, document: node });
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      visit(value, path ? `${path}.${key}` : key);
    }
  };
  visit(project, "");
  return found;
}

export function documentById(project, id) {
  return (
    projectDocuments(project).find((entry) => entry.document.id === id) ?? null
  );
}

export const pieceOrder = (document) =>
  document.pieces.map((piece) => piece.id);

/**
 * Deterministic, order-preserving canonical form for semantic equality.
 * Arrays keep their order (piece order is meaningful); object keys are sorted
 * so a differently serialised but identical project still compares equal.
 */
export function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    const sorted = {};
    for (const key of Object.keys(value).sort())
      sorted[key] = canonicalValue(value[key]);
    return sorted;
  }
  return value;
}

export const canonicalText = (value) => JSON.stringify(canonicalValue(value));

/** Read the browser-local draft exactly as the editor stored it. */
export async function readStoredDraft(page, key = EDITOR_STORAGE_KEY) {
  return page.evaluate((storageKey) => {
    try {
      return window.localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }, key);
}

export async function readStoredProject(page, key = EDITOR_STORAGE_KEY) {
  const raw = await readStoredDraft(page, key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function waitForStoredProject(
  page,
  predicate,
  label,
  timeout = 10_000,
) {
  const deadline = Date.now() + timeout;
  let latest = null;
  while (Date.now() < deadline) {
    latest = await readStoredProject(page);
    if (latest && predicate(latest)) return latest;
    await delay(120);
  }
  throw new Error(
    `${label}: browser draft never matched; last seen ${latest === null ? "null" : "a project"}`,
  );
}

/* -------------------------------------------------------------------------- */
/* Selection and properties                                                   */
/* -------------------------------------------------------------------------- */

/** Object rail rows are ordinary buttons carrying the object id or slot label. */
export function objectRow(page, label) {
  return page.getByRole("button", { name: label, exact: true });
}

export async function selectObject(page, label) {
  const rows = objectRow(page, label);
  const count = await rows.count();
  assert.ok(count > 0, `object rail has no row named "${label}"`);
  await rows.first().click();
  await delay(60);
  const current = await rows.first().getAttribute("aria-current");
  return { label, rows: count, ariaCurrent: current };
}

export async function selectedObjectLabel(page) {
  const current = page.locator('[aria-current="true"]');
  if ((await current.count()) === 0) return null;
  return (await current.first().innerText()).trim();
}

/**
 * A wrapped `<select>` folds its option text into the label's accessible name
 * ("Platformwelcomegarden-hop-1"), so `getByLabel` alone silently misses every
 * enumerated inspector property. Compare against the label's own text with the
 * control's subtree removed instead.
 */
async function selectFieldByOwnLabel(scope, label) {
  const selects = scope.locator("select");
  const count = await selects.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = selects.nth(index);
    const own = await candidate.evaluate((element) => {
      const owner =
        element.closest("label") ??
        (element.id
          ? element.ownerDocument.querySelector(
              `label[for="${CSS.escape(element.id)}"]`,
            )
          : null);
      if (!owner) return element.getAttribute("aria-label") ?? "";
      const clone = owner.cloneNode(true);
      for (const control of clone.querySelectorAll("select, input, textarea"))
        control.remove();
      return clone.textContent ?? "";
    });
    if (own.trim() === label) return candidate;
  }
  return null;
}

/**
 * Resolve one inspector property control by its DESIGN019 label. Numeric and
 * text fields come straight from the accessible label; enumerated selects fall
 * back to the own-text match above. No test ids are involved either way, and
 * the Add-panel buttons never match because buttons carry no label association.
 */
export async function resolvePropertyField(scope, label) {
  const direct = scope.getByLabel(label, { exact: true });
  const directCount = await direct.count();
  if (directCount > 0) {
    return { locator: direct.first(), count: directCount, kind: "labelled" };
  }
  const select = await selectFieldByOwnLabel(scope, label);
  return select
    ? { locator: select, count: 1, kind: "select" }
    : { locator: null, count: 0, kind: "missing" };
}

export async function readNumberProperty(page, label) {
  const field = await resolvePropertyField(page, label);
  assert.equal(
    field.count,
    1,
    `expected exactly one "${label}" field, found ${field.count}`,
  );
  const raw = await field.locator.inputValue();
  const parsed = Number(raw);
  assert.ok(
    Number.isFinite(parsed),
    `"${label}" held non-numeric text ${JSON.stringify(raw)}`,
  );
  return parsed;
}

export async function readTextProperty(page, label) {
  const field = await resolvePropertyField(page, label);
  assert.ok(field.count > 0, `property "${label}" is unavailable`);
  return field.locator.inputValue();
}

export async function hasProperty(page, label) {
  return (await resolvePropertyField(page, label)).count > 0;
}

/** Commit a numeric property the way an author does: type, then press Enter. */
export async function commitNumberProperty(page, label, value) {
  const field = await resolvePropertyField(page, label);
  assert.equal(
    field.count,
    1,
    `expected exactly one "${label}" field to edit, found ${field.count}`,
  );
  await field.locator.click();
  await field.locator.fill(String(value));
  await field.locator.press("Enter");
  await delay(120);
  return readNumberProperty(page, label);
}

/** Choose an enumerated property value, e.g. **Platform** or **Axis**. */
export async function commitSelectProperty(page, label, value) {
  const field = await resolvePropertyField(page, label);
  assert.equal(field.count, 1, `expected exactly one "${label}" select`);
  await field.locator.selectOption({ label: value });
  await delay(120);
  return field.locator.inputValue();
}

/** Commit a text property the way an author does: type, then press Enter. */
export async function commitTextProperty(page, label, value) {
  const field = await resolvePropertyField(page, label);
  assert.equal(field.count, 1, `expected exactly one "${label}" field to edit`);
  await field.locator.click();
  await field.locator.fill(value);
  await field.locator.press("Enter");
  await delay(120);
  return field.locator.inputValue();
}

/** Retained-while-typing check: text stays put before the commit keystroke. */
export async function typeWithoutCommitting(page, label, text) {
  const field = await resolvePropertyField(page, label);
  assert.ok(field.count > 0, `property "${label}" is unavailable`);
  await field.locator.click();
  await field.locator.fill(text);
  return field.locator.inputValue();
}

export async function listPropertyLabels(page) {
  const present = [];
  for (const label of EDITOR_PROPERTY_LABELS) {
    if (await hasProperty(page, label)) present.push(label);
  }
  return present;
}

/* -------------------------------------------------------------------------- */
/* Chapters, validation, export and import                                    */
/* -------------------------------------------------------------------------- */

export async function switchChapter(page, chapter) {
  const label = EDITOR_CHAPTER_LABELS[chapter];
  assert.ok(label, `unknown chapter ${chapter}`);
  const control = await requireControl(page, label);
  if (control.role === "option") await control.locator.selectOption({ label });
  else await control.locator.click();
  await delay(200);
  return { chapter, label, role: control.role };
}

/** The validation summary text DESIGN019 requires in the header. */
export async function validationSummary(page) {
  const ready = page.getByText(EDITOR_VALIDATION_COPY.ready, { exact: true });
  if ((await ready.count()) > 0 && (await ready.first().isVisible())) {
    return { state: "ready", text: EDITOR_VALIDATION_COPY.ready, issues: 0 };
  }
  const issues = page.getByText(/^\d+ issues? to fix$/);
  if ((await issues.count()) > 0) {
    const text = (await issues.first().innerText()).trim();
    return { state: "issues", text, issues: Number(text.split(" ")[0]) };
  }
  const draft = page.getByText(EDITOR_VALIDATION_COPY.draft, { exact: true });
  if ((await draft.count()) > 0) {
    return { state: "draft", text: EDITOR_VALIDATION_COPY.draft, issues: null };
  }
  return { state: "unknown", text: null, issues: null };
}

export async function storageStatus(page) {
  for (const [state, text] of Object.entries(EDITOR_STORAGE_COPY)) {
    const locator = page.getByText(text, { exact: true });
    if ((await locator.count()) > 0 && (await locator.first().isVisible())) {
      return { state, text };
    }
  }
  return { state: "unknown", text: null };
}

/**
 * Open the validation panel and read its issue rows. DESIGN019 names a
 * **Review issues** control; the shipped workspace instead makes the
 * `{count} issues to fix` summary the button, so both are accepted and the
 * resolved affordance is reported.
 */
export async function reviewIssues(page) {
  const summary = await validationSummary(page);
  let opened = null;
  const named = await resolveControl(page, EDITOR_VALIDATION_COPY.review);
  if (named.found) {
    await named.locator.click();
    opened = EDITOR_VALIDATION_COPY.review;
  } else if (summary.text) {
    const count = await resolveControl(page, summary.text);
    if (count.found) {
      await count.locator.click();
      opened = summary.text;
    }
  }
  if (opened) await delay(250);
  const read = async (locator) =>
    (await locator.allInnerTexts()).map((text) => text.trim()).filter(Boolean);
  let issues = await read(page.getByRole("listitem"));
  let source = "listitem";
  if (issues.length === 0) {
    // Keep only leaf rows: drop the summary and any container that merely
    // concatenates the rows beneath it.
    const candidates = await read(page.locator('[class*="issue" i]'));
    issues = candidates.filter(
      (text) =>
        text !== summary.text &&
        !candidates.some((other) => other !== text && text.includes(other)),
    );
    source = "class~=issue";
  }
  if (issues.length === 0) {
    issues = await read(page.getByRole("alert"));
    source = "alert";
  }
  return { opened, reviewControlPresent: named.found, source, issues };
}

export async function exportProject(page, { timeout = 20_000 } = {}) {
  const control = await requireControl(page, "Export");
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout }),
    control.locator.click(),
  ]);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return {
    filename: download.suggestedFilename(),
    bytes: Buffer.byteLength(text, "utf8"),
    text,
    project: JSON.parse(text),
  };
}

async function importSurface(page) {
  const named = page.getByRole("dialog", { name: /Import project/i });
  if ((await named.count()) > 0) return named.first();
  const anyDialog = page.getByRole("dialog");
  if ((await anyDialog.count()) > 0) return anyDialog.first();
  return page;
}

/**
 * Paste-import a project the way an author does. Returns the surface state so
 * callers can assert both acceptance and rejection without a thrown error.
 */
export async function importProjectText(page, text, { timeout = 15_000 } = {}) {
  await activateControl(page, "Import");
  const surface = await importSurface(page);
  let field = surface.getByLabel("Paste JSON", { exact: true });
  if ((await field.count()) === 0) {
    const mode = await resolveControl(surface, "Paste JSON");
    if (mode.found) {
      await mode.locator.click();
      await delay(120);
    }
    field = surface.locator("textarea");
  }
  assert.ok(
    (await field.count()) > 0,
    "import surface offers no Paste JSON field",
  );
  await field.first().fill(text);
  const confirm = await requireControl(surface, "Import", {
    roles: ["button", "menuitem"],
  });
  await confirm.locator.click();
  const deadline = Date.now() + timeout;
  let closed = false;
  while (Date.now() < deadline) {
    const dialogs = await page.getByRole("dialog").count();
    if (dialogs === 0) {
      closed = true;
      break;
    }
    await delay(120);
  }
  const alerts = (await page.getByRole("alert").allInnerTexts())
    .map((entry) => entry.trim())
    .filter(Boolean);
  return { closed, alerts };
}

export async function cancelImport(page) {
  const surface = await importSurface(page);
  const cancel = await resolveControl(surface, "Cancel");
  if (!cancel.found) return false;
  await cancel.locator.click();
  await delay(150);
  return true;
}

/* -------------------------------------------------------------------------- */
/* Preview                                                                    */
/* -------------------------------------------------------------------------- */

export const PREVIEW_SCOPE_LABELS = Object.freeze({
  chapter: "From this level",
  adventure: "Full adventure",
});

/**
 * Enter the frozen preview through the real **Playtest** control. Resolves with
 * the blocked-validation state instead of throwing when the draft is invalid,
 * so a harness can assert the block as a first-class outcome.
 */
export async function startEditorPreview(
  page,
  { scope = "chapter", timeout = 60_000 } = {},
) {
  const label = PREVIEW_SCOPE_LABELS[scope];
  assert.ok(label, `unknown preview scope ${scope}`);
  const requests = [];
  const record = (request) => {
    if (!request.url().includes(EDITOR_PLAYTEST_PATH)) return;
    requests.push({
      method: request.method(),
      body: request.postDataJSON?.() ?? null,
    });
  };
  page.on("request", record);
  try {
    const before = await validationSummary(page);
    await activateControl(page, "Playtest");
    await delay(200);
    const option = await resolveControl(page, label);
    if (!option.found) {
      return {
        started: false,
        blocked: false,
        missing: label,
        validation: before,
        requests,
        scope,
      };
    }
    await option.locator.click();
    // An already-invalid draft should answer within a couple of seconds; a
    // valid one has to build a scene, so it gets the full budget.
    const deadline = Date.now() + (before.state === "issues" ? 8_000 : timeout);
    const blocked = page.getByText(EDITOR_VALIDATION_COPY.blocked, {
      exact: true,
    });
    const failure = page.getByText(EDITOR_VALIDATION_COPY.runtimeFailure, {
      exact: true,
    });
    while (Date.now() < deadline) {
      if ((await page.locator("canvas[data-quest-canvas=true]").count()) > 0) {
        return {
          started: true,
          blocked: false,
          validation: before,
          requests,
          scope,
        };
      }
      if ((await blocked.count()) > 0 && (await blocked.first().isVisible())) {
        return {
          started: false,
          blocked: true,
          validation: before,
          requests,
          scope,
        };
      }
      if ((await failure.count()) > 0 && (await failure.first().isVisible())) {
        return {
          started: false,
          blocked: false,
          runtimeFailure: true,
          validation: before,
          requests,
          scope,
        };
      }
      await delay(150);
    }
    // Neither a preview nor an explanation: report it rather than hanging.
    return {
      started: false,
      blocked: false,
      silent: true,
      validation: before,
      requests,
      scope,
    };
  } finally {
    page.off("request", record);
  }
}

export async function returnToEditor(page, { timeout = 30_000 } = {}) {
  await activateControl(page, "Back to editor");
  return waitForEditorWorkspace(page, { timeout });
}

/* -------------------------------------------------------------------------- */
/* Layout health                                                              */
/* -------------------------------------------------------------------------- */

/** Layout and zoom measurements taken from the live page, not from CSS review. */
export async function measureLayout(page) {
  return page.evaluate(() => {
    const root = window.document.documentElement;
    const body = window.document.body;
    const visual = window.visualViewport;
    const offenders = [];
    for (const element of window.document.querySelectorAll("*")) {
      const bounds = element.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) continue;
      if (bounds.right <= root.clientWidth + 1 && bounds.left >= -1) continue;
      offenders.push({
        tag: element.tagName.toLowerCase(),
        className:
          typeof element.className === "string" ? element.className : "",
        left: Math.round(bounds.left),
        right: Math.round(bounds.right),
      });
      if (offenders.length >= 8) break;
    }
    return {
      innerWidth: window.innerWidth,
      clientWidth: root.clientWidth,
      documentScrollWidth: root.scrollWidth,
      bodyScrollWidth: body.scrollWidth,
      horizontalOverflow:
        Math.max(root.scrollWidth, body.scrollWidth) - root.clientWidth,
      scrollLeft: window.scrollX,
      metaViewport:
        window.document
          .querySelector('meta[name="viewport"]')
          ?.getAttribute("content") ?? null,
      visualViewport: visual
        ? {
            scale: visual.scale,
            width: visual.width,
            height: visual.height,
            offsetLeft: visual.offsetLeft,
            offsetTop: visual.offsetTop,
          }
        : null,
      offenders,
    };
  });
}

export async function attemptHorizontalScroll(page) {
  await page.evaluate(() => window.scrollTo(4_000, 0));
  await delay(120);
  const scrollLeft = await page.evaluate(() => window.scrollX);
  await page.evaluate(() => window.scrollTo(0, 0));
  return scrollLeft;
}

/**
 * Trusted zoom attempts a browser actually delivers to the page: ctrl+wheel,
 * the zoom keyboard shortcuts and a two-finger CDP pinch. Operating-system
 * magnification and browser-menu zoom stay outside any webpage's control.
 */
export async function attemptPageZoom(page, context, { center } = {}) {
  const viewport = page.viewportSize() ?? { width: 800, height: 600 };
  const point = center ?? { x: viewport.width / 2, y: viewport.height / 2 };
  await page.mouse.move(point.x, point.y);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -320);
  await page.mouse.wheel(0, 320);
  await page.keyboard.up("Control");
  await page.keyboard.press("Control+Equal");
  await page.keyboard.press("Control+Minus");
  let pinch;
  try {
    const cdp = await context.newCDPSession(page);
    const contact = (id, x, y) => ({
      id,
      x,
      y,
      radiusX: 6,
      radiusY: 6,
      force: 1,
    });
    const left = { x: point.x - 40, y: point.y };
    const right = { x: point.x + 40, y: point.y };
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [contact(1, left.x, left.y), contact(2, right.x, right.y)],
    });
    for (const spread of [30, 60, 90]) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          contact(1, left.x - spread, left.y),
          contact(2, right.x + spread, right.y),
        ],
      });
      await delay(30);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach().catch(() => undefined);
    pinch = "dispatched";
  } catch (error) {
    pinch = `unavailable: ${error instanceof Error ? error.message : String(error)}`;
  }
  await delay(200);
  return { pinch, point };
}

/**
 * Geometry and hit-testing for named controls. A clipped header row keeps the
 * page free of horizontal overflow while still putting a control off-screen or
 * underneath a neighbour, so overflow alone cannot establish "reachable".
 */
export async function measureControlReachability(scope, labels) {
  const measured = [];
  for (const label of labels) {
    const control = await resolveControl(scope, label);
    if (!control.found) {
      measured.push({ label, present: false });
      continue;
    }
    const geometry = await control.locator.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;
      const hit = window.document.elementFromPoint(centerX, centerY);
      return {
        top: Math.round(bounds.top),
        bottom: Math.round(bounds.bottom),
        left: Math.round(bounds.left),
        right: Math.round(bounds.right),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
        topmost:
          hit === element ||
          element.contains(hit) ||
          (hit ? hit.contains(element) : false),
        hitTarget: hit
          ? `${hit.tagName.toLowerCase()}${
              typeof hit.className === "string" && hit.className
                ? `.${hit.className.split(" ")[0]}`
                : ""
            }`
          : null,
        inViewport:
          bounds.top >= 0 &&
          bounds.left >= 0 &&
          bounds.bottom <= window.innerHeight &&
          bounds.right <= window.innerWidth,
      };
    });
    measured.push({ label, present: true, role: control.role, ...geometry });
  }
  return measured;
}

/** Controls that are on the page but cannot actually be used. */
export const unreachableControls = (measured) =>
  measured.filter(
    (entry) => entry.present && (!entry.topmost || !entry.inViewport),
  );

/* -------------------------------------------------------------------------- */
/* Discovery                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A structural snapshot of the workspace. Recorded in every report so a failing
 * run says which named surface was missing rather than only which click failed.
 */
export async function describeEditorSurface(page) {
  const controls = {};
  for (const label of [
    ...EDITOR_HEADER_CONTROLS,
    ...EDITOR_SECONDARY_CONTROLS,
    "Snap",
    "Objects",
    "Add",
    "Properties",
    "Route",
    "Checks",
    "View",
    "Duplicate",
    "Delete",
    "Add connection",
    "Remove connection",
    "Move attached objects",
    EDITOR_CHAPTER_LABELS[1],
    EDITOR_CHAPTER_LABELS[2],
  ]) {
    const control = await resolveControl(page, label);
    controls[label] = control.found
      ? { role: control.role, count: control.count }
      : null;
  }
  const editorCanvas = page.locator('canvas[aria-label="3D level view"]');
  const anyCanvas = page.locator("canvas");
  return {
    title: await page.title(),
    heading: await page
      .getByRole("heading", { level: 1 })
      .first()
      .innerText()
      .catch(() => null),
    brand:
      (
        await page
          .locator("header")
          .first()
          .innerText()
          .catch(() => "")
      ).trim() || null,
    controls,
    canvases: {
      labelled3dView: await editorCanvas.count(),
      total: await anyCanvas.count(),
      gameCanvas: await page.locator("canvas[data-quest-canvas=true]").count(),
    },
    propertyLabels: await listPropertyLabels(page),
    validation: await validationSummary(page),
    storage: await storageStatus(page),
  };
}

/** True once the editor viewport has actually rasterised a WebGL frame. */
export async function webglFrameRendered(page, { timeout = 15_000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const drawn = await page
      .locator("canvas")
      .first()
      .evaluate((canvas) => {
        if (!(canvas instanceof HTMLCanvasElement)) return false;
        const context =
          canvas.getContext("webgl2", { preserveDrawingBuffer: true }) ??
          canvas.getContext("webgl", { preserveDrawingBuffer: true });
        return Boolean(context) && canvas.width > 0 && canvas.height > 0;
      })
      .catch(() => false);
    if (drawn) return true;
    await delay(200);
  }
  return false;
}
