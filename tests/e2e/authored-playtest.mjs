import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";

import {
  chooseFallDirection,
  createAuthoredRouteDriver,
  createHybridControls,
  delay,
  inspectGame,
  waitForInspection,
} from "./authored-browser-driver.mjs";
import {
  authoredDocumentFromInspection,
  buildTraversalPlan,
  planarDistance,
  summarizeAuthoredCourse,
} from "./authored-navigation.mjs";

const url = process.env.QUEST_E2E_URL ?? "http://127.0.0.1:4397";
const runLabel = process.env.QUEST_E2E_RUN_LABEL;
const outDir = runLabel
  ? `test-results/authored-playtest/${runLabel}`
  : "test-results/authored-playtest";
const reportPath = `${outDir}/report.json`;
const timeoutMs = Number(process.env.QUEST_E2E_TIMEOUT_MS ?? 900_000);
const routeStartChapter = Number(process.env.QUEST_E2E_START_CHAPTER ?? 1);
assert.ok(Number.isFinite(timeoutMs) && timeoutMs >= 180_000);
assert.ok(
  routeStartChapter === 1 || routeStartChapter === 2,
  "QUEST_E2E_START_CHAPTER must be 1 or 2",
);
await fs.mkdir(outDir, { recursive: true });

const report = {
  startedAt: new Date().toISOString(),
  status: "running",
  url,
  routeStartChapter,
  browser: null,
  controls: "real keyboard route movement/jumps and touch combat buttons",
  relatedTouchDiagnostic:
    "test-results/fresh-playtest/plan009-input-diagnostic/report.json",
  chapters: [],
  progress: [],
  screenshots: [],
  responseErrors: [],
  pageErrors: [],
  consoleErrors: [],
};

const mark = (stage, details = {}) => {
  const entry = { stage, at: new Date().toISOString(), ...details };
  report.progress.push(entry);
  console.log(`[authored-playtest] ${stage} ${JSON.stringify(details)}`);
};

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
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 1,
  hasTouch: true,
  isMobile: true,
});
await context.addInitScript(() => {
  window.__authoredPointerTrace = [];
  for (const type of [
    "pointerdown",
    "pointermove",
    "pointerup",
    "pointercancel",
  ]) {
    document.addEventListener(
      type,
      (event) => {
        window.__authoredPointerTrace.push({
          type,
          pointerId: event.pointerId,
          pointerType: event.pointerType,
          target:
            event.target instanceof Element
              ? `${event.target.tagName}.${event.target.className}`
              : null,
          x: event.clientX,
          y: event.clientY,
          timeStamp: event.timeStamp,
          handledAt: performance.now(),
        });
        if (window.__authoredPointerTrace.length > 80) {
          window.__authoredPointerTrace.shift();
        }
      },
      true,
    );
  }
});
const page = await context.newPage();
let latestSave = null;
const observedHits = [];
let screenshotSequence = 0;
let cleanupStarted = false;

const screenshot = async (name) => {
  const safe = name.replaceAll(/[^a-z0-9-]/gi, "-").toLowerCase();
  const path = `${outDir}/${String(++screenshotSequence).padStart(2, "0")}-${safe}.png`;
  await page.screenshot({ path, fullPage: true });
  report.screenshots.push(path);
};

const close = async () => {
  if (cleanupStarted) return;
  cleanupStarted = true;
  await context.close().catch(() => undefined);
  await browser.close().catch(() => undefined);
};

const timer = setTimeout(() => {
  mark("timeout", { timeoutMs });
  void close();
}, timeoutMs);

page.on("pageerror", (error) => report.pageErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") report.consoleErrors.push(message.text());
});
page.on("response", async (response) => {
  const parsed = new URL(response.url());
  if (response.status() >= 400) {
    report.responseErrors.push({
      method: response.request().method(),
      path: parsed.pathname,
      status: response.status(),
    });
  }
  if (
    response.ok() &&
    response.request().method() === "POST" &&
    (parsed.pathname === "/api/playtest/start" ||
      /\/api\/saves\/[^/]+\/actions$/.test(parsed.pathname))
  ) {
    const save = await response.json().catch(() => null);
    if (!save?.id || !Number.isInteger(save.revision)) return;
    const action = response.request().postDataJSON()?.action;
    if (action?.type === "take-hit") {
      observedHits.push({
        encounterId: action.encounterId,
        revision: save.revision,
        playerHp: save.adventure?.playerHp,
      });
    }
    latestSave = save;
  }
});

const waitForSave = async (predicate, label, timeout = 20_000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (latestSave && predicate(latestSave)) return latestSave;
    await delay(50);
  }
  await screenshot(`${label}-save-failure`);
  throw new Error(`${label}: save state unavailable: ${JSON.stringify(latestSave)}`);
};

const saveProgress = (save) => ({
  ageYears: save.ageYears,
  phase: save.adventure.phase,
  completedLevelIds: [...save.adventure.completedLevelIds],
  inventory: save.adventure.inventory.map(({ id, kind, tier, collected }) => ({
    id,
    kind,
    tier,
    collected,
  })),
  memories: save.memories.map(({ id, state }) => ({ id, state })),
  encounters: save.adventure.activeLevel.encounters.map(
    ({ id, hp, defeated, available }) => ({ id, hp, defeated, available }),
  ),
});

const closest = (entries, target) =>
  [...entries].sort(
    (left, right) => planarDistance(left, target) - planarDistance(right, target),
  )[0];

const spatialDistance = (first, second) =>
  Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z);

const activeEncounter = (role, inspection, anchor) => {
  const live = closest(inspection.level.encounterPositions, anchor.position);
  assert.ok(live, `${role}: no rendered encounter`);
  const saved = latestSave.adventure.activeLevel.encounters.find(
    (candidate) => candidate.id === live.id,
  );
  assert.ok(saved, `${role}: encounter ${live.id} absent from save`);
  return saved;
};

function observeBesties(tracker, inspection) {
  for (const actor of inspection.visuals?.besties ?? []) {
    const observed = tracker.get(actor.id) ?? {
      visible: false,
      clips: new Set(),
      first: null,
      motion: 0,
    };
    observed.visible ||= actor.visible;
    if (actor.clip) observed.clips.add(actor.clip);
    const sample = actor.pose?.head ?? actor.position;
    if (sample) {
      observed.first ??= { ...sample };
      observed.motion = Math.max(observed.motion, spatialDistance(observed.first, sample));
    }
    tracker.set(actor.id, observed);
  }
}

const summarizeBesties = (tracker) =>
  [...tracker].map(([id, actor]) => ({
    id,
    visible: actor.visible,
    clips: [...actor.clips],
    motion: actor.motion,
  }));

async function proveDynamicPieces(document) {
  const movingIds = document.pieces
    .filter((piece) => piece.type === "moving-platform")
    .map((piece) => piece.id);
  const sweeperIds = document.pieces
    .filter((piece) => piece.type === "sweeper")
    .map((piece) => piece.id);
  const start = await inspectGame(page);
  assert.ok(start?.obby);
  await delay(450);
  const end = await inspectGame(page);
  assert.ok(end?.obby);
  const movingPlatforms = movingIds.map((id) => {
    const before = start.obby.platforms.find((entry) => entry.id === id);
    const after = end.obby.platforms.find((entry) => entry.id === id);
    assert.ok(before && after, `${id}: moving platform missing from live sample`);
    const motion = planarDistance(before.center, after.center);
    assert.ok(motion > 0.001, `${id}: moving platform did not move`);
    return { id, motion };
  });
  const sweepers = sweeperIds.map((id) => {
    const before = start.obby.hazards.find((entry) => entry.id === id);
    const after = end.obby.hazards.find((entry) => entry.id === id);
    assert.ok(before && after, `${id}: sweeper missing from live sample`);
    const translation = planarDistance(before.center, after.center);
    const rotation = Math.abs(before.angle - after.angle);
    assert.ok(translation > 0.001 || rotation > 0.001, `${id}: sweeper stayed static`);
    return { id, translation, rotation };
  });
  return { movingPlatforms, sweepers };
}

async function startChapter(chapter) {
  const priorId = latestSave?.id;
  const button = page.getByRole("button", {
    name: chapter === 1 ? "Play from the beginning" : "Try the Besties chapter",
    exact: true,
  });
  await button.tap();
  await page.locator("canvas[data-quest-canvas=true]").waitFor({ timeout: 20_000 });
  const save = await waitForSave(
    (candidate) =>
      candidate.id !== priorId &&
      candidate.adventure?.activeLevelIndex === chapter - 1,
    `chapter-${chapter}-start`,
  );
  assert.equal(save.adventure.planVersion, "era-level-plan-v3");
  return save;
}

async function playChapter(chapter) {
  const chapterReport = {
    chapter,
    course: null,
    plan: null,
    dynamics: null,
    contents: [],
    combat: [],
    branch: null,
    recovery: null,
    traversal: null,
  };
  const initial = await waitForInspection({
    page,
    screenshot,
    label: `chapter-${chapter}-authored-ready`,
    timeout: 20_000,
    predicate: (inspection) => Boolean(inspection.level.authored && inspection.obby),
  });
  const document = authoredDocumentFromInspection(initial);
  const expectedId = chapter === 1 ? "garden-playground-v1" : "besties-playground-v1";
  assert.equal(document.id, expectedId);
  assert.equal(initial.obby.routeId, expectedId);
  chapterReport.course = summarizeAuthoredCourse(document);
  const plan = buildTraversalPlan(document, {
    branchIndex: document.branches.length ? 0 : null,
  });
  chapterReport.plan = {
    branchIndex: plan.branchIndex,
    platformIds: plan.platformIds,
    edges: plan.edges.map(({ from, to, mode }) => ({ from, to, mode })),
  };
  chapterReport.branch = {
    declared: plan.branchPlatformIds,
    visited: [],
    rejoined: false,
  };
  chapterReport.dynamics = await proveDynamicPieces(document);

  const controls = createHybridControls({ page });
  const driver = createAuthoredRouteDriver({
    page,
    controls,
    screenshot,
    mark,
    maxRecoveries: 10,
  });
  const visitedPlatforms = [];
  const processed = new Set();
  let recoveryProved = false;
  let primaryDamage = 0;
  let secondaryDamage = 0;
  const chapterMemoryIds = {
    "minor-one": latestSave.adventure.activeLevel.minorMemoryIds[0],
    "minor-two": latestSave.adventure.activeLevel.minorMemoryIds[1],
    major: latestSave.adventure.activeLevel.majorMemoryId,
  };

  const moveToAnchor = async (
    anchor,
    label,
    targetFor = () => anchor.position,
    done = null,
  ) =>
    driver.moveToPoint(targetFor, {
      label,
      tolerance: 0.32,
      supportId: anchor.platformId,
      done,
    });

  const collectPickup = async (kind, anchor) => {
    if (
      latestSave.adventure.inventory.some(
        (item) => item.kind === kind && item.collected,
      )
    )
      return;
    await moveToAnchor(
      anchor,
      `chapter-${chapter}-${kind}`,
      undefined,
      () =>
        latestSave.adventure.inventory.some(
          (item) => item.kind === kind && item.collected,
        ),
    );
    const save = await waitForSave(
      (candidate) =>
        candidate.adventure.inventory.some(
          (item) => item.kind === kind && item.collected,
        ),
      `chapter-${chapter}-${kind}-collected`,
    );
    chapterReport.contents.push({
      type: "pickup",
      role: kind,
      revision: save.revision,
      platformId: anchor.platformId,
    });
  };

  const collectMemory = async (role, anchor) => {
    const id = chapterMemoryIds[role];
    assert.ok(id, `${role}: runtime memory id missing`);
    const already = latestSave.memories.find((memory) => memory.id === id)?.state;
    const ageBefore = latestSave.ageYears;
    if (!["revealed", "consumed"].includes(already)) {
      await moveToAnchor(
        anchor,
        `chapter-${chapter}-${role}`,
        undefined,
        () => {
          const state = latestSave.memories.find((memory) => memory.id === id)?.state;
          return ["revealed", "consumed"].includes(state);
        },
      );
    }
    const save = await waitForSave(
      (candidate) =>
        ["revealed", "consumed"].includes(
          candidate.memories.find((memory) => memory.id === id)?.state,
        ),
      `chapter-${chapter}-${role}-collected`,
    );
    if (role !== "major") assert.equal(save.ageYears, ageBefore);
    const rendered = await waitForInspection({
      page,
      screenshot,
      label: `chapter-${chapter}-${role}-hidden`,
      predicate: (inspection) => {
        const visual = inspection.visuals?.memories.find(
          (memory) => memory.id === id,
        );
        return visual?.visible === false || inspection.level.authored?.id !== document.id;
      },
    });
    assert.ok(rendered);
    chapterReport.contents.push({
      type: "memory",
      role,
      id,
      revision: save.revision,
      platformId: anchor.platformId,
      renderedHidden: true,
    });
  };

  const visitFriendly = async (role, anchor) => {
    const inspection = await inspectGame(page);
    const live = closest(inspection?.level.friendlyPositions ?? [], anchor.position);
    assert.ok(live, `${role}: rendered friendly missing`);
    await moveToAnchor(
      anchor,
      `chapter-${chapter}-${role}`,
      (candidate) =>
        candidate.level.friendlyPositions?.find((friend) => friend.id === live.id),
      (candidate) => candidate.status.nearFriendlyId === live.id,
    );
    await waitForInspection({
      page,
      screenshot,
      label: `chapter-${chapter}-${role}-contact`,
      predicate: (candidate) => candidate.status.nearFriendlyId === live.id,
    });
    chapterReport.contents.push({
      type: "friendly",
      role,
      id: live.id,
      platformId: anchor.platformId,
      contacted: true,
    });
  };

  const recoverCombat = async (role) => {
    const retry = page.getByRole("button", { name: "Try this level again" });
    if ((await retry.count()) && (await retry.isVisible())) {
      await retry.tap();
      await waitForInspection({
        page,
        screenshot,
        label: `chapter-${chapter}-${role}-retry`,
        predicate: (inspection) => inspection.status.phase === "exploring",
      });
      return true;
    }
    return false;
  };

  const fight = async (role, anchor) => {
    let inspection = await driver.read(`chapter-${chapter}-${role}-inspect`);
    let encounter = activeEncounter(role, inspection, anchor);
    if (encounter.defeated) return;
    const encounterId = encounter.id;
    const besties = new Map();
    const hpAtApproach = latestSave.adventure.playerHp;
    const hitStart = observedHits.length;
    let primaryAccepted = false;
    let secondaryAccepted = false;
    let sawDizzy = false;
    let combatRetries = 0;

    const approach = async () => {
      await moveToAnchor(
        anchor,
        `chapter-${chapter}-${role}-approach`,
        (candidate) =>
          candidate.level.encounterPositions.find(
            (entry) => entry.id === encounterId,
          ),
        (candidate) => candidate.status.nearEncounterId === encounterId,
      );
      return waitForInspection({
        page,
        screenshot,
        label: `chapter-${chapter}-${role}-near`,
        predicate: (candidate) => candidate.status.nearEncounterId === encounterId,
      });
    };
    await approach();
    if (role === "boss") {
      const bossHitDeadline = Date.now() + 15_000;
      while (
        Date.now() < bossHitDeadline &&
        observedHits.slice(hitStart).every((hit) => hit.encounterId !== encounterId)
      ) {
        if (await recoverCombat(role)) {
          combatRetries += 1;
          await approach();
        } else {
          inspection = await driver.read(`chapter-${chapter}-${role}-attack-proof`);
          observeBesties(besties, inspection);
          sawDizzy ||= inspection.status.bestiesPhase === "dizzy";
          await delay(80);
        }
      }
      assert.ok(
        observedHits.slice(hitStart).some((hit) => hit.encounterId === encounterId),
        `${role}: no real boss attack reached the player`,
      );
    }

    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      if (await recoverCombat(role)) {
        combatRetries += 1;
        assert.ok(combatRetries <= 4, `${role}: combat recovery bound exceeded`);
        await approach();
        continue;
      }
      encounter = latestSave.adventure.activeLevel.encounters.find(
        (candidate) => candidate.id === encounterId,
      );
      if (encounter?.defeated) break;
      inspection = await driver.read(`chapter-${chapter}-${role}-fight`);
      observeBesties(besties, inspection);
      sawDizzy ||= inspection.status.bestiesPhase === "dizzy";
      if (inspection.status.nearEncounterId !== encounterId) {
        await approach();
        continue;
      }
      const useSecondary =
        primaryAccepted &&
        !secondaryAccepted &&
        inspection.status.guardReady &&
        (chapter !== 2 || role !== "boss" || sawDizzy);
      const usePrimary = !primaryAccepted || !useSecondary;
      const name = useSecondary ? "Bash" : usePrimary ? "Attack" : "Bash";
      const ready = useSecondary
        ? inspection.status.guardReady
        : inspection.status.attackReady;
      if (!ready) {
        await delay(80);
        continue;
      }
      const beforeHp = encounter.hp;
      const beforeRevision = latestSave.revision;
      await controls.tapButton(name);
      const changed = await waitForSave(
        (candidate) => {
          const current = candidate.adventure.activeLevel.encounters.find(
            (entry) => entry.id === encounterId,
          );
          return candidate.revision > beforeRevision && current?.hp < beforeHp;
        },
        `chapter-${chapter}-${role}-${name.toLowerCase()}`,
        5_000,
      ).catch(() => null);
      if (!changed) continue;
      const afterHp = changed.adventure.activeLevel.encounters.find(
        (candidate) => candidate.id === encounterId,
      ).hp;
      if (useSecondary) {
        secondaryAccepted = true;
        secondaryDamage += beforeHp - afterHp;
      } else {
        primaryAccepted = true;
        primaryDamage += beforeHp - afterHp;
      }
    }
    encounter = latestSave.adventure.activeLevel.encounters.find(
      (candidate) => candidate.id === encounterId,
    );
    assert.equal(encounter?.defeated, true, `${role}: combat timed out`);
    const hits = observedHits
      .slice(hitStart)
      .filter((hit) => hit.encounterId === encounterId);
    if (role === "boss") assert.ok(hits.length > 0, `${role}: boss never attacked`);
    if (chapter === 2 && role === "boss") {
      assert.equal(sawDizzy, true, "Besties never entered dizzy state");
      for (const id of ["bestie-pink", "bestie-black"]) {
        const actor = besties.get(id);
        assert.ok(actor?.visible, `${id}: never rendered visibly`);
        assert.ok(actor.clips.size > 0, `${id}: no animation clip selected`);
        assert.ok(actor.motion > 0.002, `${id}: rendered pose stayed static`);
      }
      const defeated = await waitForInspection({
        page,
        screenshot,
        label: "besties-defeat-hidden",
        timeout: 20_000,
        predicate: (candidate) =>
          candidate.status.bestiesPhase === "defeated" &&
          candidate.visuals?.besties?.length === 2 &&
          candidate.visuals.besties.every(
            (actor) => actor.clip === "defeat" && actor.visible === false,
          ),
      });
      observeBesties(besties, defeated);
    }
    const evidence = {
      role,
      id: encounterId,
      platformId: anchor.platformId,
      primaryAccepted,
      secondaryAccepted,
      hitsReceived: hits.length,
      hpAtApproach,
      playerHpAfter: latestSave.adventure.playerHp,
      combatRetries,
      sawDizzy,
      ...(besties.size ? { besties: summarizeBesties(besties) } : {}),
    };
    chapterReport.combat.push(evidence);
    chapterReport.contents.push({
      type: "encounter",
      role,
      id: encounterId,
      defeated: true,
      platformId: anchor.platformId,
    });
    mark("combat:defeated", evidence);
  };

  const proveCheckpointRecovery = async () => {
    const before = await driver.read(`chapter-${chapter}-fall-before`);
    const checkpoint = document.pieces.find(
      (piece) => piece.type === "checkpoint" && piece.id === before.obby.checkpointId,
    );
    assert.ok(checkpoint, "armed authored checkpoint missing");
    assert.notEqual(checkpoint.id, document.pieces.find((piece) => piece.type === "checkpoint")?.id);
    const progress = saveProgress(latestSave);
    const revision = latestSave.revision;
    const recoveryCount = before.obby.recoveries;
    const direction = chooseFallDirection(before);
    await controls.beginToward(direction.dx, direction.dz);
    let recovered;
    try {
      recovered = await waitForInspection({
        page,
        screenshot,
        label: `chapter-${chapter}-intentional-fall`,
        timeout: 12_000,
        predicate: (candidate) => candidate.obby?.recoveries > recoveryCount,
      });
    } finally {
      await controls.release();
    }
    assert.equal(recovered.obby.checkpointId, checkpoint.id);
    assert.ok(recovered.obby.recoveryRemaining > 0);
    assert.ok(planarDistance(recovered.status.position, checkpoint.position) < 0.7);
    const heldInput = Math.hypot(recovered.input.moveX, recovered.input.moveY);
    assert.ok(heldInput > 0.5, "intentional fall did not retain its real held input");
    assert.equal(latestSave.revision, revision, "local recovery wrote a save action");
    assert.deepEqual(saveProgress(latestSave), progress, "local recovery changed progress");
    chapterReport.recovery = {
      checkpointId: checkpoint.id,
      direction,
      before: recoveryCount,
      after: recovered.obby.recoveries,
      position: recovered.status.position,
      protectionSeconds: recovered.obby.recoveryRemaining,
      heldInput,
      progressPreserved: true,
    };
    mark("recovery:intentional", chapterReport.recovery);
  };

  const processPlatform = async (platformId) => {
    if (processed.has(platformId)) return;
    processed.add(platformId);
    for (const [role, anchor] of Object.entries(document.anchors.friendlies)) {
      if (anchor.platformId === platformId) await visitFriendly(role, anchor);
    }
    for (const [kind, anchor] of Object.entries(document.anchors.pickups)) {
      if (anchor.platformId === platformId) await collectPickup(kind, anchor);
    }
    for (const [role, anchor] of Object.entries(document.anchors.memories)) {
      if (anchor.platformId === platformId && role !== "major") {
        await collectMemory(role, anchor);
      }
    }
    for (const [role, anchor] of Object.entries(document.anchors.encounters)) {
      if (anchor.platformId !== platformId) continue;
      if (role === "boss") {
        const ordinary = latestSave.adventure.activeLevel.encounters.filter(
          (encounter) => encounter.role === "ordinary",
        );
        assert.equal(ordinary.length, 4, "authored chapter does not have four ordinary fights");
        assert.ok(ordinary.every((encounter) => encounter.defeated));
        for (const minorRole of ["minor-one", "minor-two"]) {
          const id = chapterMemoryIds[minorRole];
          assert.ok(
            ["revealed", "consumed"].includes(
              latestSave.memories.find((memory) => memory.id === id)?.state,
            ),
            `${minorRole} was not collected before boss`,
          );
        }
      }
      await fight(role, anchor);
    }
    if (!recoveryProved) {
      const current = await driver.read(`chapter-${chapter}-${platformId}-checkpoint`);
      const firstCheckpoint = document.pieces.find(
        (piece) => piece.type === "checkpoint",
      );
      if (current.obby.checkpointId && current.obby.checkpointId !== firstCheckpoint?.id) {
        await proveCheckpointRecovery();
        recoveryProved = true;
      }
    }
    const major = document.anchors.memories.major;
    if (major.platformId === platformId) await collectMemory("major", major);
  };

  await processPlatform(plan.platformIds[0]);
  visitedPlatforms.push(plan.platformIds[0]);
  let edgeIndex = 0;
  let crossingCount = 0;
  while (edgeIndex < plan.edges.length) {
    crossingCount += 1;
    assert.ok(crossingCount <= 60, "course traversal exceeded its recovery bound");
    const current = await driver.read(`chapter-${chapter}-route-${edgeIndex}`);
    const supportIndex = plan.platformIds.indexOf(current.obby.supportId);
    assert.ok(supportIndex >= 0, `live support ${current.obby.supportId} is outside the route plan`);
    if (supportIndex !== edgeIndex) {
      assert.ok(
        supportIndex < edgeIndex,
        `course skipped from route index ${edgeIndex} to ${supportIndex}`,
      );
      edgeIndex = supportIndex;
      await processPlatform(plan.platformIds[edgeIndex]);
      continue;
    }
    const edge = plan.edges[edgeIndex];
    const finishEdge = edge.to === document.anchors.finish.platformId;
    const finishReached = () =>
      ["revealed", "consumed"].includes(
        latestSave.memories.find(
          (memory) => memory.id === chapterMemoryIds.major,
        )?.state,
      );
    const after = await driver.crossEdge(
      edge,
      `chapter-${chapter}-edge-${edgeIndex + 1}`,
      { allowFinishTrigger: finishEdge, finishReached },
    );
    const documentExited = after.level.authored?.id !== document.id;
    const finishTriggered = finishEdge && finishReached();
    if (!documentExited && !finishTriggered && after.obby.supportId !== edge.to) {
      continue;
    }
    assert.ok(
      !documentExited || finishEdge,
      "authored document changed before the declared finish edge",
    );
    edgeIndex += 1;
    if (!visitedPlatforms.includes(edge.to)) visitedPlatforms.push(edge.to);
    if (
      plan.branchPlatformIds.slice(1).includes(edge.to) &&
      !chapterReport.branch.visited.includes(edge.to)
    ) {
      chapterReport.branch.visited.push(edge.to);
    }
    if (edge.to === plan.branchPlatformIds.at(-1)) chapterReport.branch.rejoined = true;
    await processPlatform(edge.to);
  }

  assert.equal(recoveryProved, true, "intentional checkpoint recovery was not exercised");
  assert.equal(chapterReport.combat.length, 5, "chapter did not complete five fights");
  assert.ok(primaryDamage > 0, "primary attack never damaged an enemy");
  assert.ok(secondaryDamage > 0, "secondary attack never damaged an enemy");
  assert.deepEqual(
    chapterReport.branch.visited,
    plan.branchPlatformIds.slice(1),
    "declared branch was not traversed",
  );
  assert.equal(chapterReport.branch.rejoined, true, "branch did not rejoin main path");
  assert.ok(driver.evidence.ferryEvidence.length > 0, "ferry carry was not proved");
  assert.ok(driver.evidence.hazardJumps.length > 0, "no live sweeper was cleared with a jump");
  chapterReport.traversal = {
    visitedPlatforms,
    primaryDamage,
    secondaryDamage,
    ...driver.evidence,
  };
  report.chapters.push(chapterReport);
  await screenshot(`chapter-${chapter}-complete`);
  mark(`chapter:${chapter}:complete`, {
    documentId: document.id,
    platforms: visitedPlatforms.length,
    recoveries: driver.evidence.recoveries.length,
  });
}

try {
  const index = await fetch(url);
  assert.equal(index.status, 200, "authored playtest fixture unavailable");
  await page.goto(url);
  await page
    .getByRole("button", { name: "Play from the beginning", exact: true })
    .waitFor();
  if (routeStartChapter === 1) {
    await startChapter(1);
    await playChapter(1);
    await page.getByRole("dialog", { name: /Welcome to 2024/ }).waitFor();
    await page.getByRole("button", { name: "Enter the next era", exact: true }).tap();
    await waitForInspection({
      page,
      screenshot,
      label: "chapter-2-transition",
      predicate: (inspection) =>
        inspection.level.authored?.id === "besties-playground-v1",
      timeout: 20_000,
    });
  } else {
    await startChapter(2);
  }
  await playChapter(2);
  await page
    .getByRole("dialog", { name: "Every chapter, a little more you." })
    .waitFor();
  assert.equal(latestSave.completed, true);
  assert.equal(latestSave.recoveredIds.length, 6);
  assert.equal(report.chapters.length, 3 - routeStartChapter);
  assert.ok(report.chapters.every((chapter) => chapter.combat.length === 5));
  assert.deepEqual(
    report.chapters.map((chapter) => chapter.course.id),
    ["garden-playground-v1", "besties-playground-v1"].slice(
      routeStartChapter - 1,
    ),
  );
  assert.deepEqual(report.responseErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.consoleErrors, []);
  report.status = "passed";
  report.finishedAt = new Date().toISOString();
} catch (error) {
  report.status = "failed";
  report.finishedAt = new Date().toISOString();
  report.failure =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { name: "NonError", message: String(error) };
  await screenshot("failure").catch(() => undefined);
  throw error;
} finally {
  clearTimeout(timer);
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await close();
}
