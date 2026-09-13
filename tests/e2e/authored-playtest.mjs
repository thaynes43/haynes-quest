import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
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
  findPlatformPath,
  planarDistance,
  summarizeAuthoredCourse,
} from "./authored-navigation.mjs";

import { verifyControlLayouts } from "./landscape-controls.mjs";

import { createPausedArtworkProbe } from "./paused-artwork-recovery.mjs";

class ControlsVerified extends Error {}
class BossGateVerified extends Error {}
const controlsOnly = process.env.QUEST_E2E_CONTROLS_ONLY === "true";
const retryTimeoutProbe = process.env.QUEST_E2E_RETRY_TIMEOUT_PROBE === "true";
const bossGateProbe = process.env.QUEST_E2E_BOSS_GATE_PROBE === "true";

const pausedArtworkRetry =
  process.env.QUEST_E2E_PAUSED_ARTWORK_RETRY === "true";
const expectedBundleSha256 = process.env.QUEST_E2E_BUNDLE_SHA256;
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
  coverage: controlsOnly
    ? "authored-first-pickups-and-responsive-controls"
    : "full-journey",
  layout: [],
  browser: null,
  bundle: null,
  pausedArtworkRetry,
  injectedArtworkFailure: null,
  retryTimeoutProbe: {
    enabled: retryTimeoutProbe,
    stalls: [],
    manualReturn: null,
  },
  bossGateProbe: null,
  expectedFaults: [],
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
let stalledRetryRequests = 0;
const stalledRetryPayloads = [];
if (retryTimeoutProbe) {
  await context.route("**/api/saves/*/actions", async (route) => {
    const request = route.request();
    const action = request.postDataJSON()?.action;
    if (action?.type !== "retry-level" || stalledRetryRequests >= 2) {
      await route.continue();
      return;
    }
    stalledRetryRequests += 1;
    const payload = request.postDataJSON();
    stalledRetryPayloads.push(payload);
    const entry = { attempt: stalledRetryRequests, heldMs: null };
    report.retryTimeoutProbe.stalls.push(entry);
    mark("retry-timeout:stalled", { attempt: entry.attempt });
    const startedAt = Date.now();
    await delay(8_500);
    entry.heldMs = Date.now() - startedAt;
    await route.abort("timedout").catch(() => undefined);
  });
}
const page = await context.newPage();
const pausedArtworkProbe = pausedArtworkRetry
  ? await createPausedArtworkProbe(page)
  : null;
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
  if (message.type() !== "error") return;
  if (pausedArtworkProbe?.isExpectedConsole(message)) {
    report.expectedFaults.push({ type: "console", message: message.text() });
  } else report.consoleErrors.push(message.text());
});
page.on("response", async (response) => {
  const parsed = new URL(response.url());
  if (response.status() >= 400) {
    const errors = pausedArtworkProbe?.isExpectedResponse(
      parsed.pathname,
      response.status(),
    )
      ? report.expectedFaults
      : report.responseErrors;
    errors.push({
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

const waitForSave = async (
  predicate,
  label,
  timeout = 20_000,
  captureTimeout = true,
) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (latestSave && predicate(latestSave)) return latestSave;
    await delay(50);
  }
  if (captureTimeout) await screenshot(`${label}-save-failure`);
  throw new Error(
    `${label}: save state unavailable: ${JSON.stringify(latestSave)}`,
  );
};

const saveProgress = (save) => ({
  ageYears: save.ageYears,
  abilities: [...save.abilities],
  phase: save.adventure.phase,
  completedLevelIds: [...save.adventure.completedLevelIds],
  recoveredIds: [...save.recoveredIds],
  equippedId: save.adventure.equippedId,
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
    (left, right) =>
      planarDistance(left, target) - planarDistance(right, target),
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
      observed.motion = Math.max(
        observed.motion,
        spatialDistance(observed.first, sample),
      );
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
  const startedAt = Date.now();
  const movingPlatforms = movingIds.map((id) => ({ id, motion: 0 }));
  const sweepers = sweeperIds.map((id) => ({
    id,
    translation: 0,
    rotation: 0,
  }));
  let sampleCount = 1;
  let end = start;

  // Two samples can straddle a turning point or repeat a frame during loading.
  // Require observed motion from every piece within a bounded live interval.
  while (Date.now() - startedAt < 6_000) {
    await delay(150);
    end = await inspectGame(page);
    assert.ok(end?.obby);
    assert.equal(end.level.authored?.id, document.id);
    sampleCount += 1;
    for (const evidence of movingPlatforms) {
      const before = start.obby.platforms.find(
        (entry) => entry.id === evidence.id,
      );
      const after = end.obby.platforms.find(
        (entry) => entry.id === evidence.id,
      );
      assert.ok(
        before && after,
        `${evidence.id}: moving platform missing from live sample`,
      );
      evidence.motion = Math.max(
        evidence.motion,
        planarDistance(before.center, after.center),
      );
    }
    for (const evidence of sweepers) {
      const before = start.obby.hazards.find(
        (entry) => entry.id === evidence.id,
      );
      const after = end.obby.hazards.find((entry) => entry.id === evidence.id);
      assert.ok(
        before && after,
        `${evidence.id}: sweeper missing from live sample`,
      );
      evidence.translation = Math.max(
        evidence.translation,
        planarDistance(before.center, after.center),
      );
      evidence.rotation = Math.max(
        evidence.rotation,
        Math.abs(before.angle - after.angle),
      );
    }
    if (
      movingPlatforms.every((piece) => piece.motion > 0.001) &&
      sweepers.every(
        (piece) => piece.translation > 0.001 || piece.rotation > 0.001,
      )
    )
      break;
  }
  const evidence = {
    movingPlatforms,
    sweepers,
    sampleCount,
    wallElapsedMs: Date.now() - startedAt,
    startTimeSeconds: start.obby.timeSeconds,
    endTimeSeconds: end.obby.timeSeconds,
  };
  for (const piece of movingPlatforms) {
    assert.ok(
      piece.motion > 0.001,
      `${piece.id}: moving platform did not move: ${JSON.stringify(evidence)}`,
    );
  }
  for (const piece of sweepers) {
    assert.ok(
      piece.translation > 0.001 || piece.rotation > 0.001,
      `${piece.id}: sweeper stayed static: ${JSON.stringify(evidence)}`,
    );
  }
  return evidence;
}

async function startChapter(chapter) {
  const priorId = latestSave?.id;
  const button = page.getByRole("button", {
    name: chapter === 1 ? "Play from the beginning" : "Try the Besties chapter",
    exact: true,
  });
  await button.tap();
  await page
    .locator("canvas[data-quest-canvas=true]")
    .waitFor({ timeout: 20_000 });
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
    safeMiss: null,
    deathRecovery: null,
    traversal: null,
  };
  const initial = await waitForInspection({
    page,
    screenshot,
    label: `chapter-${chapter}-authored-ready`,
    timeout: 20_000,
    predicate: (inspection) =>
      Boolean(inspection.level.authored && inspection.obby),
  });
  const document = authoredDocumentFromInspection(initial);
  const expectedId =
    chapter === 1 ? "garden-playground-v2" : "besties-playground-v2";
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
  await screenshot(`chapter-${chapter}-playground-start`);

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
  let safeMissProved = false;
  let deathRecoveryProved = false;
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
  ) => {
    for (let recoveryAttempt = 0; recoveryAttempt < 3; recoveryAttempt += 1) {
      let current = await driver.read(`${label}-route-${recoveryAttempt + 1}`);
      if (done && (await done(current))) return current;
      if (current.obby.supportId !== anchor.platformId) {
        const route = findPlatformPath(
          document,
          current.obby.supportId,
          anchor.platformId,
        );
        for (const [edgeIndex, edge] of route.entries()) {
          current = await driver.crossEdge(
            { ...edge, index: edgeIndex },
            `${label}-recovery-edge-${edgeIndex + 1}`,
          );
          if (current.obby.supportId !== edge.to) break;
        }
        if (current.obby.supportId !== anchor.platformId) continue;
      }
      const recoveryCount = current.obby.recoveries;
      const reached = await driver.moveToPoint(targetFor, {
        label,
        tolerance: 0.32,
        supportId: anchor.platformId,
        stopOnRecovery: true,
        done,
      });
      if (done && (await done(reached))) return reached;
      if (
        reached.obby.supportId === anchor.platformId &&
        reached.obby.recoveries === recoveryCount
      ) {
        return reached;
      }
    }
    throw new Error(
      `${label}: repeated recovery prevented reaching its anchor`,
    );
  };

  const collectPickup = async (kind, anchor) => {
    if (
      latestSave.adventure.activeLevel.pickups.some(
        (item) => item.kind === kind && item.collected,
      )
    )
      return;
    await moveToAnchor(anchor, `chapter-${chapter}-${kind}`, undefined, () =>
      latestSave.adventure.activeLevel.pickups.some(
        (item) => item.kind === kind && item.collected,
      ),
    );
    const save = await waitForSave(
      (candidate) =>
        candidate.adventure.activeLevel.pickups.some(
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
    const already = latestSave.memories.find(
      (memory) => memory.id === id,
    )?.state;
    const ageBefore = latestSave.ageYears;
    if (!["revealed", "consumed"].includes(already)) {
      await moveToAnchor(
        anchor,
        `chapter-${chapter}-${role}`,
        undefined,
        () => {
          const state = latestSave.memories.find(
            (memory) => memory.id === id,
          )?.state;
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
        return (
          visual?.visible === false ||
          inspection.level.authored?.id !== document.id
        );
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
    const live = closest(
      inspection?.level.friendlyPositions ?? [],
      anchor.position,
    );
    assert.ok(live, `${role}: rendered friendly missing`);
    await moveToAnchor(
      anchor,
      `chapter-${chapter}-${role}`,
      (candidate) =>
        candidate.level.friendlyPositions?.find(
          (friend) => friend.id === live.id,
        ),
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
    if (latestSave.adventure.phase === "fallen") {
      const fallenRevision = latestSave.revision;
      assert.equal(
        await page.getByRole("dialog").count(),
        0,
        "combat defeat opened a blocking retry dialog",
      );
      await waitForSave(
        (candidate) =>
          candidate.adventure.phase === "exploring" &&
          candidate.revision > fallenRevision,
        `chapter-${chapter}-${role}-automatic-retry-save`,
      );
      await waitForInspection({
        page,
        screenshot,
        label: `chapter-${chapter}-${role}-automatic-retry`,
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
    let capturedDizzy = false;
    let combatRetries = 0;
    let nonDizzyDamage = null;
    const hitReactions = [];

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
        predicate: (candidate) =>
          candidate.status.nearEncounterId === encounterId,
      });
    };
    const approachSecondary = async () =>
      driver.moveToPoint(
        (candidate) =>
          candidate.level.encounterPositions.find(
            (entry) => entry.id === encounterId,
          ),
        {
          label: `chapter-${chapter}-${role}-secondary-approach`,
          tolerance: 1.1,
          supportId: anchor.platformId,
          allowHazardJump: false,
          stopOnRecovery: true,
        },
      );
    await approach();
    if (role === "boss") {
      const bossHitDeadline = Date.now() + 15_000;
      while (
        Date.now() < bossHitDeadline &&
        observedHits
          .slice(hitStart)
          .every((hit) => hit.encounterId !== encounterId)
      ) {
        if (await recoverCombat(role)) {
          combatRetries += 1;
          await approach();
        } else {
          inspection = await driver.read(
            `chapter-${chapter}-${role}-attack-proof`,
          );
          observeBesties(besties, inspection);
          sawDizzy ||= inspection.status.bestiesPhase === "dizzy";
          await delay(80);
        }
      }
      assert.ok(
        observedHits
          .slice(hitStart)
          .some((hit) => hit.encounterId === encounterId),
        `${role}: no real boss attack reached the player`,
      );
    }

    if (chapter === 2 && role === "boss" && pausedArtworkProbe) {
      report.injectedArtworkFailure = await pausedArtworkProbe.verify({
        screenshot,
        mark,
      });
    }

    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      if (await recoverCombat(role)) {
        combatRetries += 1;
        assert.ok(
          combatRetries <= 4,
          `${role}: combat recovery bound exceeded`,
        );
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
      if (
        chapter === 2 &&
        role === "boss" &&
        !capturedDizzy &&
        inspection.status.bestiesPhase === "dizzy"
      ) {
        await screenshot("besties-dizzy");
        capturedDizzy = true;
      }
      if (inspection.status.nearEncounterId !== encounterId) {
        await approach();
        continue;
      }
      const secondaryBeforePrimary = chapter === 2 && role !== "boss";
      if (
        secondaryBeforePrimary &&
        !secondaryAccepted &&
        !inspection.status.guardReady
      ) {
        await approachSecondary();
        await delay(80);
        continue;
      }
      const useSecondary =
        !secondaryAccepted &&
        inspection.status.guardReady &&
        (primaryAccepted || secondaryBeforePrimary) &&
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
      const bestiesPhaseAtAttack = inspection.status.bestiesPhase;
      if (!(await controls.tapButton(name))) {
        await delay(80);
        continue;
      }
      const changed = await waitForSave(
        (candidate) => {
          const current = candidate.adventure.activeLevel.encounters.find(
            (entry) => entry.id === encounterId,
          );
          return candidate.revision > beforeRevision && current?.hp < beforeHp;
        },
        `chapter-${chapter}-${role}-${name.toLowerCase()}`,
        5_000,
        false,
      ).catch(() => null);
      if (!changed) continue;
      const afterHp = changed.adventure.activeLevel.encounters.find(
        (candidate) => candidate.id === encounterId,
      ).hp;
      if (chapter === 2 && role === "boss") {
        if (bestiesPhaseAtAttack && bestiesPhaseAtAttack !== "dizzy") {
          nonDizzyDamage ??= {
            phase: bestiesPhaseAtAttack,
            beforeHp,
            afterHp,
            action: useSecondary ? "secondary-attack" : "attack",
          };
        }
        const reaction = await waitForInspection({
          page,
          screenshot,
          label: "besties-hit-reaction",
          timeout: 1_000,
          predicate: (candidate) =>
            candidate.visuals?.besties?.some((actor) => actor.clip === "hit"),
        }).catch(() => null);
        const actor = reaction?.visuals?.besties?.find(
          (candidate) => candidate.clip === "hit",
        );
        if (actor) hitReactions.push({ id: actor.id, clip: actor.clip });
      }
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
    if (role === "boss")
      assert.ok(hits.length > 0, `${role}: boss never attacked`);
    if (chapter === 2 && role === "boss") {
      assert.ok(
        nonDizzyDamage,
        "Besties took no authoritative damage outside the dizzy phase",
      );
      assert.ok(
        hitReactions.length > 0,
        "Besties accepted damage without a rendered hit reaction",
      );
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
      ...(nonDizzyDamage ? { nonDizzyDamage } : {}),
      ...(hitReactions.length ? { hitReactions } : {}),
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
      (piece) =>
        piece.type === "checkpoint" && piece.id === before.obby.checkpointId,
    );
    assert.ok(checkpoint, "armed authored checkpoint missing");
    assert.notEqual(
      checkpoint.id,
      document.pieces.find((piece) => piece.type === "checkpoint")?.id,
    );
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
    assert.ok(
      planarDistance(recovered.status.position, checkpoint.position) < 0.7,
    );
    const heldInput = Math.hypot(recovered.input.moveX, recovered.input.moveY);
    assert.ok(
      heldInput > 0.5,
      "intentional fall did not retain its real held input",
    );
    assert.equal(
      latestSave.revision,
      revision,
      "local recovery wrote a save action",
    );
    assert.deepEqual(
      saveProgress(latestSave),
      progress,
      "local recovery changed progress",
    );
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

  const proveSafeMiss = async (edge) => {
    const before = await driver.read(`chapter-${chapter}-safe-miss-before`);
    const progress = saveProgress(latestSave);
    const revision = latestSave.revision;
    const playerHp = latestSave.adventure.playerHp;
    const recoveryCount = before.obby.recoveries;
    const { caught, retryEdge, evidence } = await driver.missToSafePlatform(
      edge,
      `chapter-${chapter}-safe-miss`,
    );
    assert.equal(
      latestSave.revision,
      revision,
      "safe miss wrote a save action",
    );
    assert.equal(latestSave.adventure.playerHp, playerHp);
    assert.equal(caught.obby.recoveries, recoveryCount);
    assert.deepEqual(saveProgress(latestSave), progress);
    assert.equal(
      retryEdge.to,
      document.anchors.spawn.platformId,
      "safe miss retry edge did not return to chapter practice start",
    );
    await screenshot(`chapter-${chapter}-safe-miss-catch`);
    const returned = await driver.crossEdge(
      retryEdge,
      `chapter-${chapter}-safe-miss-retry`,
    );
    assert.equal(returned.obby.supportId, retryEdge.to);
    chapterReport.safeMiss = {
      ...evidence,
      hpPreserved: true,
      progressPreserved: true,
      returnedTo: returned.obby.supportId,
    };
    mark("recovery:safe-miss-complete", chapterReport.safeMiss);
  };

  const proveAutomaticDeathRecovery = async () => {
    const memoryAnchor = document.anchors.memories["minor-two"];
    const checkpoints = document.pieces.filter(
      (piece) =>
        piece.type === "checkpoint" &&
        piece.platformId === memoryAnchor.platformId,
    );
    assert.equal(
      checkpoints.length,
      1,
      "second minor memory has no unique safe checkpoint",
    );
    const checkpoint = checkpoints[0];
    const encounterEntry = Object.entries(document.anchors.encounters).find(
      ([role, anchor]) =>
        role !== "boss" && anchor.platformId === memoryAnchor.platformId,
    );
    assert.ok(encounterEntry, "second memory platform has no defeat encounter");
    const [role, encounterAnchor] = encounterEntry;
    const encounter = activeEncounter(
      role,
      await driver.read(`chapter-${chapter}-death-encounter`),
      encounterAnchor,
    );
    assert.equal(encounter.defeated, false);
    const progress = saveProgress(latestSave);
    const hitStart = observedHits.length;
    const before = await moveToAnchor(
      encounterAnchor,
      `chapter-${chapter}-death-approach`,
      (candidate) =>
        candidate.level.encounterPositions.find(
          (entry) => entry.id === encounter.id,
        ),
      (candidate) => candidate.status.nearEncounterId === encounter.id,
    );
    await controls.release();
    const fallen = await waitForSave(
      (candidate) => candidate.adventure.phase === "fallen",
      `chapter-${chapter}-automatic-death`,
      90_000,
    );
    assert.ok(
      observedHits
        .slice(hitStart)
        .some((hit) => hit.encounterId === encounter.id),
      "automatic death proof observed no authoritative enemy hit",
    );
    assert.equal(
      await page.getByRole("dialog").count(),
      0,
      "combat defeat opened a blocking retry dialog",
    );
    let manualReturn = false;
    if (retryTimeoutProbe) {
      const recoveryDialog = page.getByRole("dialog", {
        name: "Your adventure is safe",
      });
      await recoveryDialog.waitFor({ timeout: 25_000 });
      while (
        report.retryTimeoutProbe.stalls.some((entry) => entry.heldMs === null)
      )
        await delay(50);
      assert.equal(stalledRetryRequests, 2);
      assert.ok(
        report.retryTimeoutProbe.stalls.every((entry) => entry.heldMs >= 8_000),
        "retry-level transport was not stalled through the client timeout",
      );
      assert.equal(stalledRetryPayloads.length, 2);
      assert.equal(
        stalledRetryPayloads[1].actionId,
        stalledRetryPayloads[0].actionId,
        "automatic retry used a different action id after transport timeout",
      );
      assert.equal(
        stalledRetryPayloads[1].expectedRevision,
        stalledRetryPayloads[0].expectedRevision,
        "automatic retry changed its expected revision after transport timeout",
      );
      assert.deepEqual(
        stalledRetryPayloads[1].action,
        stalledRetryPayloads[0].action,
        "automatic retry changed its action after transport timeout",
      );
      const blocked = await driver.read(
        `chapter-${chapter}-retry-timeout-blocked`,
      );
      assert.equal(blocked.status.requestState, "error");
      assert.equal(blocked.status.requestErrorCode, "REQUEST_TIMEOUT");
      assert.equal(latestSave.revision, fallen.revision);
      assert.equal(latestSave.adventure.phase, "fallen");
      await screenshot(`chapter-${chapter}-retry-timeout-manual-return`);
      await recoveryDialog
        .getByRole("button", { name: "Return to checkpoint", exact: true })
        .tap();
      manualReturn = true;
    }
    const recoveredSave = await waitForSave(
      (candidate) =>
        candidate.adventure.phase === "exploring" &&
        candidate.revision > fallen.revision,
      `chapter-${chapter}-automatic-checkpoint-return`,
      20_000,
    );
    const recovered = await waitForInspection({
      page,
      screenshot,
      label: `chapter-${chapter}-memory-checkpoint-return`,
      timeout: 20_000,
      predicate: (candidate) =>
        candidate.status.phase === "exploring" &&
        candidate.obby?.checkpointId === checkpoint.id,
    });
    assert.equal(
      recoveredSave.adventure.playerHp,
      recoveredSave.adventure.maxPlayerHp,
    );
    assert.equal(
      recovered.obby.recoveries,
      0,
      "HP recovery did not rebuild the local traversal counter",
    );
    assert.ok(
      spatialDistance(recovered.status.position, checkpoint.position) < 0.7,
    );
    assert.deepEqual(saveProgress(recoveredSave), progress);
    assert.equal(
      recoveredSave.id,
      fallen.id,
      "manual checkpoint return replaced the active journey",
    );
    if (retryTimeoutProbe) {
      report.retryTimeoutProbe.manualReturn = {
        stalledRequests: stalledRetryRequests,
        errorCode: "REQUEST_TIMEOUT",
        fallenRevision: fallen.revision,
        recoveredRevision: recoveredSave.revision,
        sameJourney: true,
        retriedExactRequest: true,
      };
    }
    await screenshot(`chapter-${chapter}-automatic-memory-checkpoint`);
    chapterReport.deathRecovery = {
      encounterId: encounter.id,
      memoryId: chapterMemoryIds["minor-two"],
      checkpointId: checkpoint.id,
      fallenRevision: fallen.revision,
      recoveredRevision: recoveredSave.revision,
      position: recovered.status.position,
      fullHealth: recoveredSave.adventure.playerHp,
      localRecoveriesBefore: before.obby.recoveries,
      localRecoveriesAfter: recovered.obby.recoveries,
      progressPreserved: true,
      automatic: true,
      manualReturnAfterTimeout: manualReturn,
    };
    mark("recovery:automatic-memory", chapterReport.deathRecovery);
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
    if (document.anchors.pickups["guard-tool"].platformId === platformId) {
      const layout = await verifyControlLayouts({
        page,
        screenshot: (name) => screenshot(`chapter-${chapter}-${name}`),
      });
      report.layout.push({ chapter, courseId: document.id, ...layout });
      mark("responsive-controls:complete", { chapter, ...layout });
      if (controlsOnly) throw new ControlsVerified();
    }
    for (const [role, anchor] of Object.entries(document.anchors.memories)) {
      if (anchor.platformId === platformId && role !== "major") {
        await collectMemory(role, anchor);
      }
    }
    if (
      !deathRecoveryProved &&
      document.anchors.memories["minor-two"].platformId === platformId
    ) {
      await proveAutomaticDeathRecovery();
      deathRecoveryProved = true;
    }
    for (const [role, anchor] of Object.entries(document.anchors.encounters)) {
      if (anchor.platformId !== platformId) continue;
      if (bossGateProbe && role === "ordinary-4") {
        chapterReport.contents.push({
          type: "encounter",
          role,
          platformId,
          deliberatelyLeftUndefeated: true,
        });
        continue;
      }
      if (role === "boss") {
        const ordinary = latestSave.adventure.activeLevel.encounters.filter(
          (encounter) => encounter.role === "ordinary",
        );
        assert.equal(
          ordinary.length,
          4,
          "authored chapter does not have four ordinary fights",
        );
        if (bossGateProbe) {
          const undefeated = ordinary.filter(
            (encounter) => !encounter.defeated,
          );
          assert.equal(
            undefeated.length,
            1,
            "boss gate probe did not leave exactly one ordinary encounter",
          );
          await driver.moveToPoint(() => anchor.position, {
            label: `chapter-${chapter}-boss-gate-approach`,
            tolerance: 0.32,
            supportId: anchor.platformId,
          });
          const boss = latestSave.adventure.activeLevel.encounters.find(
            (encounter) => encounter.role === "boss",
          );
          assert.ok(boss, "boss gate probe has no boss");
          assert.equal(boss.available, true);
          const engaged = await waitForInspection({
            page,
            screenshot,
            label: `chapter-${chapter}-boss-gate-engaged`,
            predicate: (candidate) =>
              candidate.status.nearEncounterId === boss.id &&
              candidate.status.bossEngaged === true &&
              candidate.status.attackReady === true,
          });
          assert.equal(await page.locator(".boss-hud:visible").count(), 1);
          const revision = latestSave.revision;
          const hp = boss.hp;
          const attackSequence = engaged.status.attackFeedback?.sequence ?? 0;
          assert.equal(await controls.tapButton("Attack"), true);
          const primarySave = await waitForSave((candidate) => {
            const currentBoss = candidate.adventure.activeLevel.encounters.find(
              (encounter) => encounter.id === boss.id,
            );
            return candidate.revision > revision && currentBoss?.hp < hp;
          }, `chapter-${chapter}-boss-gate-primary-save`);
          const afterPrimary = await waitForInspection({
            page,
            screenshot,
            label: `chapter-${chapter}-boss-gate-attack`,
            predicate: (candidate) =>
              (candidate.status.attackFeedback?.sequence ?? 0) > attackSequence,
          });
          assert.equal(afterPrimary.status.attackFeedback?.outcome, "accepted");
          const hpAfterPrimary =
            primarySave.adventure.activeLevel.encounters.find(
              (encounter) => encounter.id === boss.id,
            )?.hp;
          assert.ok(hpAfterPrimary < hp);
          const secondaryReady = await moveToAnchor(
            anchor,
            `chapter-${chapter}-boss-gate-secondary-approach`,
            (candidate) =>
              candidate.level.encounterPositions.find(
                (entry) => entry.id === boss.id,
              ),
            (candidate) =>
              candidate.status.nearEncounterId === boss.id &&
              candidate.status.guardReady === true,
          );
          const secondarySequence =
            secondaryReady.status.attackFeedback?.sequence ?? 0;
          assert.equal(await controls.tapButton("Bash"), true);
          const secondarySave = await waitForSave((candidate) => {
            const currentBoss = candidate.adventure.activeLevel.encounters.find(
              (encounter) => encounter.id === boss.id,
            );
            return (
              candidate.revision > primarySave.revision &&
              currentBoss?.hp < hpAfterPrimary
            );
          }, `chapter-${chapter}-boss-gate-secondary-save`);
          const afterSecondary = await waitForInspection({
            page,
            screenshot,
            label: `chapter-${chapter}-boss-gate-secondary`,
            predicate: (candidate) =>
              (candidate.status.attackFeedback?.sequence ?? 0) >
              secondarySequence,
          });
          assert.equal(
            afterSecondary.status.attackFeedback?.outcome,
            "accepted",
          );
          assert.equal(afterSecondary.status.attackFeedback?.kind, "secondary");
          const hpAfterSecondary =
            secondarySave.adventure.activeLevel.encounters.find(
              (encounter) => encounter.id === boss.id,
            )?.hp;
          assert.ok(hpAfterSecondary < hpAfterPrimary);
          report.bossGateProbe = {
            courseId: document.id,
            undefeatedOrdinaryId: undefeated[0].id,
            bossId: boss.id,
            bossAvailable: boss.available,
            bossEngaged: engaged.status.bossEngaged,
            bossHudVisible: true,
            primary: {
              outcome: afterPrimary.status.attackFeedback?.outcome,
              hpBefore: hp,
              hpAfter: hpAfterPrimary,
            },
            secondary: {
              outcome: afterSecondary.status.attackFeedback?.outcome,
              hpBefore: hpAfterPrimary,
              hpAfter: hpAfterSecondary,
            },
          };
          chapterReport.traversal = {
            visitedPlatforms,
            primaryDamage,
            secondaryDamage,
            ...driver.evidence,
          };
          report.chapters.push(chapterReport);
          await screenshot(`chapter-${chapter}-boss-gated`);
          throw new BossGateVerified();
        }
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
      const current = await driver.read(
        `chapter-${chapter}-${platformId}-checkpoint`,
      );
      const firstCheckpoint = document.pieces.find(
        (piece) => piece.type === "checkpoint",
      );
      if (
        current.obby.checkpointId &&
        current.obby.checkpointId !== firstCheckpoint?.id
      ) {
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
    assert.ok(
      crossingCount <= 60,
      "course traversal exceeded its recovery bound",
    );
    const current = await driver.read(`chapter-${chapter}-route-${edgeIndex}`);
    const supportIndex = plan.platformIds.indexOf(current.obby.supportId);
    assert.ok(
      supportIndex >= 0,
      `live support ${current.obby.supportId} is outside the route plan`,
    );
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
    if (!safeMissProved && edge.safeMissPlatformId) {
      await proveSafeMiss(edge);
      safeMissProved = true;
    }
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
    if (
      !documentExited &&
      !finishTriggered &&
      after.obby.supportId !== edge.to
    ) {
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
    if (edge.to === plan.branchPlatformIds.at(-1))
      chapterReport.branch.rejoined = true;
    await processPlatform(edge.to);
    if (
      !documentExited &&
      !finishTriggered &&
      ["woodland-rest", "pond-dock", "party-dock", "turnstile-deck"].includes(
        edge.to,
      )
    ) {
      await screenshot(`chapter-${chapter}-${edge.to}`);
    }
  }

  assert.equal(
    recoveryProved,
    true,
    "intentional checkpoint recovery was not exercised",
  );
  assert.equal(safeMissProved, true, "declared safe miss was not exercised");
  assert.equal(
    deathRecoveryProved,
    true,
    "automatic memory checkpoint recovery was not exercised",
  );
  assert.equal(
    chapterReport.combat.length,
    5,
    "chapter did not complete five fights",
  );
  assert.ok(primaryDamage > 0, "primary attack never damaged an enemy");
  assert.ok(secondaryDamage > 0, "secondary attack never damaged an enemy");
  assert.deepEqual(
    chapterReport.branch.visited,
    plan.branchPlatformIds.slice(1),
    "declared branch was not traversed",
  );
  assert.equal(
    chapterReport.branch.rejoined,
    true,
    "branch did not rejoin main path",
  );
  assert.ok(
    driver.evidence.ferryEvidence.length > 0,
    "ferry carry was not proved",
  );
  assert.ok(
    driver.evidence.hazardJumps.length > 0,
    "no live sweeper was cleared with a jump",
  );
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
  const bundlePath = await page
    .locator('script[type="module"][src]')
    .getAttribute("src");
  assert.ok(bundlePath, "application bundle is missing");
  const bundleResponse = await context.request.get(
    new URL(bundlePath, url).href,
  );
  assert.equal(bundleResponse.status(), 200);
  const bundleBytes = await bundleResponse.body();
  report.bundle = {
    path: bundlePath,
    bytes: bundleBytes.length,
    sha256: createHash("sha256").update(bundleBytes).digest("hex"),
  };
  if (expectedBundleSha256)
    assert.equal(report.bundle.sha256, expectedBundleSha256);
  await page
    .getByRole("button", { name: "Play from the beginning", exact: true })
    .waitFor();
  if (routeStartChapter === 1) {
    await startChapter(1);
    await playChapter(1);
    await page.getByRole("dialog", { name: /Welcome to 2024/ }).waitFor();
    await page
      .getByRole("button", { name: "Enter the next era", exact: true })
      .tap();
    await waitForInspection({
      page,
      screenshot,
      label: "chapter-2-transition",
      predicate: (inspection) =>
        inspection.level.authored?.id === "besties-playground-v2",
      timeout: 20_000,
    });
  } else {
    await startChapter(2);
  }
  await playChapter(2);
  assert.equal(
    controlsOnly,
    false,
    "controls-only diagnostic completed a chapter without verifying its layout",
  );
  await page
    .getByRole("dialog", { name: "Every chapter, a little more you." })
    .waitFor();
  assert.equal(latestSave.completed, true);
  assert.equal(latestSave.recoveredIds.length, 6);
  assert.equal(report.chapters.length, 3 - routeStartChapter);
  assert.ok(report.chapters.every((chapter) => chapter.combat.length === 5));
  assert.deepEqual(
    report.chapters.map((chapter) => chapter.course.id),
    ["garden-playground-v2", "besties-playground-v2"].slice(
      routeStartChapter - 1,
    ),
  );
  if (pausedArtworkRetry) {
    assert.ok(report.injectedArtworkFailure?.failures > 0);
    assert.equal(report.injectedArtworkFailure?.retryPresses, 1);
    assert.equal(report.injectedArtworkFailure?.physicsStayedPaused, true);
  }
  assert.deepEqual(report.responseErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.consoleErrors, []);
  report.status = "passed";
  report.finishedAt = new Date().toISOString();
} catch (error) {
  if (error instanceof ControlsVerified || error instanceof BossGateVerified) {
    assert.deepEqual(report.responseErrors, []);
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.consoleErrors, []);
    if (error instanceof ControlsVerified) {
      assert.equal(report.layout.length, 1);
      report.status = "passed";
    } else {
      assert.ok(report.bossGateProbe);
      if (retryTimeoutProbe) assert.ok(report.retryTimeoutProbe.manualReturn);
      report.status = "passed-boss-gate";
    }
    report.finishedAt = new Date().toISOString();
  } else {
    report.status = "failed";
    report.finishedAt = new Date().toISOString();
    report.failure =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { name: "NonError", message: String(error) };
    await screenshot("failure").catch(() => undefined);
    throw error;
  }
} finally {
  clearTimeout(timer);
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await close();
}
