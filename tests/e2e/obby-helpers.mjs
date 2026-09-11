import assert from "node:assert/strict";

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export function savedProgress(save) {
  return {
    revision: save.revision,
    ageYears: save.ageYears,
    playerHp: save.adventure.playerHp,
    phase: save.adventure.phase,
    completedLevelIds: [...save.adventure.completedLevelIds],
    inventory: save.adventure.inventory.map((item) => ({
      id: item.id,
      kind: item.kind,
      tier: item.tier,
      collected: item.collected,
    })),
    encounters: save.adventure.activeLevel.encounters.map((enemy) => ({
      id: enemy.id,
      hp: enemy.hp,
      defeated: enemy.defeated,
      available: enemy.available,
    })),
  };
}

export async function waitForInspection(
  page,
  inspectGame,
  predicate,
  label,
  timeout = 12_000,
) {
  const deadline = Date.now() + timeout;
  let latest = null;
  while (Date.now() < deadline) {
    latest = await inspectGame(page);
    if (latest && (await predicate(latest))) return latest;
    await delay(50);
  }
  await page.screenshot({ path: `test-results/${label}-failure.png` });
  throw new Error(
    `${label} did not reach the expected local state: ${JSON.stringify(latest)}`,
  );
}

export async function proveModalPause({ page, controls, inspectGame, label }) {
  const help = page.getByRole("button", { name: "How to play" });
  await controls.activate(help);
  const dialog = page.getByRole("dialog", {
    name: "Explore. Prepare. Face the era.",
  });
  await dialog.waitFor();
  await delay(100);
  const pausedStart = await inspectGame(page);
  assert.ok(pausedStart?.obby, `${label} has no course while help is open`);
  await delay(850);
  const pausedEnd = await inspectGame(page);
  assert.equal(
    pausedEnd?.obby?.timeSeconds,
    pausedStart.obby.timeSeconds,
    `${label} course advanced behind the help modal`,
  );
  assert.deepEqual(pausedEnd?.obby?.platforms, pausedStart.obby.platforms);
  assert.deepEqual(pausedEnd?.obby?.hazards, pausedStart.obby.hazards);
  await page.screenshot({ path: `test-results/${label}-paused.png` });
  await controls.activate(
    dialog.getByRole("button", { name: "Back to the adventure" }),
  );
  await dialog.waitFor({ state: "detached" });
  await delay(180);
  const resumed = await inspectGame(page);
  assert.ok(resumed?.obby);
  const resumedDelta = resumed.obby.timeSeconds - pausedEnd.obby.timeSeconds;
  assert.ok(
    resumedDelta >= 0 && resumedDelta < 0.35,
    `${label} course leapt ${resumedDelta}s after an 850ms modal pause`,
  );
  return {
    heldSeconds: 0.85,
    courseTimeBefore: pausedStart.obby.timeSeconds,
    courseTimeAfter: pausedEnd.obby.timeSeconds,
    resumedDelta,
  };
}

export async function proveLocalRecovery({
  page,
  controls,
  inspectGame,
  getSave,
  label,
  trigger,
}) {
  const beforeSave = await getSave(page);
  const beforeProgress = savedProgress(beforeSave);
  const beforeInspection = await inspectGame(page);
  assert.ok(beforeInspection?.obby, `${label} has no active course`);
  const beforeRecoveries = beforeInspection.obby.recoveries;
  await trigger(beforeRecoveries);
  const recovered = await waitForInspection(
    page,
    inspectGame,
    (inspection) => inspection.obby?.recoveries > beforeRecoveries,
    label,
  );
  const afterSave = await getSave(page);
  assert.deepEqual(
    savedProgress(afterSave),
    beforeProgress,
    `${label} changed authoritative progress`,
  );
  assert.ok(
    recovered.obby.recoveryRemaining > 0,
    `${label} did not start local protection`,
  );
  await page.screenshot({ path: `test-results/${label}.png` });
  controls.release?.();
  return {
    beforeRecoveries,
    afterRecoveries: recovered.obby.recoveries,
    checkpointId: recovered.obby.checkpointId,
    position: recovered.status.position,
    recoveryRemaining: recovered.obby.recoveryRemaining,
    savedRevision: afterSave.revision,
    playerHp: afterSave.adventure.playerHp,
    inventoryCount: afterSave.adventure.inventory.length,
    defeatedCount: afterSave.adventure.activeLevel.encounters.filter(
      (enemy) => enemy.defeated,
    ).length,
    completedLevelCount: afterSave.adventure.completedLevelIds.length,
  };
}

export async function crossShortGap({
  page,
  controls,
  inspectGame,
  edgeZ,
  checkpointId,
  landingSupportId,
  label,
}) {
  const before = await inspectGame(page);
  assert.ok(before?.obby);
  const recoveries = before.obby.recoveries;
  await controls.moveUntil(
    "forward",
    async () => (await inspectGame(page))?.status.position.z <= edgeZ,
    `${label}-edge`,
  );
  const samples = [];
  let jumpApex = 0;
  let landed = null;
  await controls.jumpForwardUntil(async () => {
    const inspection = await inspectGame(page);
    if (!inspection?.obby) return false;
    jumpApex = Math.max(jumpApex, inspection.status.position.y);
    if (samples.length < 30)
      samples.push({
        position: inspection.status.position,
        grounded: inspection.status.grounded,
        supportId: inspection.obby.supportId,
      });
    if (
      inspection.status.grounded &&
      inspection.obby.supportId === landingSupportId
    )
      landed = inspection;
    return landed !== null || inspection.obby.recoveries > recoveries;
  }, `${label}-jump`);
  const afterJump = await inspectGame(page);
  assert.ok(afterJump?.obby);
  assert.ok(
    jumpApex > 0.2,
    `${label} never took off: ${JSON.stringify(samples)}`,
  );
  assert.equal(
    afterJump.obby.recoveries,
    recoveries,
    `${label} recovered instead of clearing the gap: ${JSON.stringify(samples)}`,
  );
  assert.ok(
    landed?.obby,
    `${label} did not land on ${landingSupportId}: ${JSON.stringify(samples)}`,
  );
  const checkpointed = await inspectGame(page);
  assert.ok(checkpointed?.obby);
  assert.equal(
    checkpointed.obby.recoveries,
    recoveries,
    `${label} recovered while activating ${checkpointId}`,
  );
  assert.equal(checkpointed.obby.checkpointId, checkpointId);
  return {
    checkpointId,
    checkpointArmedOnLanding: true,
    landingPosition: landed.status.position,
    position: checkpointed.status.position,
    recoveries: checkpointed.obby.recoveries,
    jumpApex,
  };
}

function ferryFrom(inspection) {
  return inspection.obby?.platforms.find(
    (platform) => platform.id === "ferry-platform",
  );
}

async function waitForCourseProgress({
  page,
  inspectGame,
  predicate,
  label,
  simulationTimeoutSeconds,
  wallTimeoutMs,
}) {
  const startedAt = Date.now();
  const initial = await inspectGame(page);
  assert.ok(initial?.obby, `${label} has no active course`);
  const courseStartedAt = initial.obby.timeSeconds;
  const deadline = startedAt + wallTimeoutMs;
  let latest = initial;
  while (Date.now() < deadline) {
    if (await predicate(latest)) {
      return {
        inspection: latest,
        simulationElapsed: latest.obby.timeSeconds - courseStartedAt,
        wallElapsedMs: Date.now() - startedAt,
      };
    }
    if (latest.obby.timeSeconds - courseStartedAt >= simulationTimeoutSeconds)
      break;
    await delay(50);
    latest = await inspectGame(page);
    assert.ok(latest?.obby, `${label} lost its active course`);
  }
  const simulationElapsed = latest.obby.timeSeconds - courseStartedAt;
  const wallElapsedMs = Date.now() - startedAt;
  await page.screenshot({ path: `test-results/${label}-failure.png` });
  throw new Error(
    `${label} did not reach the expected course state after ${simulationElapsed.toFixed(3)} simulation seconds / ${wallElapsedMs}ms wall time: ${JSON.stringify(latest)}`,
  );
}

export async function rideFerry({ page, controls, inspectGame, label }) {
  const current = await inspectGame(page);
  assert.ok(current?.obby);
  const approachRecoveries = current.obby.recoveries;
  await controls.moveUntil(
    "forward",
    async () => {
      const inspection = await inspectGame(page);
      return (
        (inspection?.status.position.z ?? 0) <= -15.05 ||
        (inspection?.obby?.recoveries ?? approachRecoveries) >
          approachRecoveries
      );
    },
    `${label}-bank`,
    10_000,
    controls.kind === "touch" ? 0.35 : 1,
  );
  let bank = await inspectGame(page);
  assert.ok(bank?.obby);
  assert.equal(
    bank.obby.recoveries,
    approachRecoveries,
    `${label} recovered while reaching the safe ferry bank`,
  );
  if (Math.abs(bank.status.position.x) > 0.45) {
    const direction = bank.status.position.x > 0 ? "left" : "right";
    await controls.moveUntil(
      direction,
      async () => {
        const inspection = await inspectGame(page);
        return (
          Math.abs(inspection?.status.position.x ?? 10) <= 0.45 ||
          (inspection?.obby?.recoveries ?? approachRecoveries) >
            approachRecoveries
        );
      },
      `${label}-center`,
      10_000,
      controls.kind === "touch" ? 0.5 : 1,
    );
    bank = await inspectGame(page);
    assert.ok(bank?.obby);
    assert.equal(
      bank.obby.recoveries,
      approachRecoveries,
      `${label} recovered while centering beyond the sweeper`,
    );
  }
  const nearDockWait = await waitForCourseProgress({
    page,
    inspectGame,
    predicate: (inspection) =>
      (ferryFrom(inspection)?.center.z ?? -20) >= -16.72,
    label: `${label}-near-dock`,
    simulationTimeoutSeconds: 7.25,
    wallTimeoutMs: 35_000,
  });
  const beforeBoardRecoveries = nearDockWait.inspection.obby.recoveries;
  let boarded = null;
  await controls.jumpForwardUntil(async () => {
    const inspection = await inspectGame(page);
    if (!inspection?.obby) return false;
    if (inspection.obby.supportId === "ferry-platform") boarded = inspection;
    return (
      boarded !== null || inspection.obby.recoveries > beforeBoardRecoveries
    );
  }, `${label}-board`);
  assert.ok(boarded?.obby, `${label} recovered instead of boarding the ferry`);
  const boardFerry = ferryFrom(boarded);
  assert.ok(boardFerry);
  const riderOffset = boarded.status.position.z - boardFerry.center.z;
  const rideWait = await waitForCourseProgress({
    page,
    inspectGame,
    predicate: (inspection) => {
      const ferry = ferryFrom(inspection);
      return (
        inspection.obby?.supportId === "ferry-platform" &&
        ferry &&
        Math.abs(ferry.center.z - boardFerry.center.z) >= 0.08
      );
    },
    label: `${label}-ride`,
    simulationTimeoutSeconds: 4,
    wallTimeoutMs: 25_000,
  });
  const ridden = rideWait.inspection;
  const riddenFerry = ferryFrom(ridden);
  assert.ok(riddenFerry);
  assert.ok(
    Math.abs(ridden.status.position.z - riddenFerry.center.z - riderOffset) <
      0.035,
    `${label} player was not carried with the ferry`,
  );
  await page.screenshot({ path: `test-results/${label}.png` });
  const farDockWait = await waitForCourseProgress({
    page,
    inspectGame,
    predicate: (inspection) =>
      inspection.obby?.supportId === "ferry-platform" &&
      (ferryFrom(inspection)?.center.z ?? 0) <= -17.28,
    label: `${label}-far-dock`,
    simulationTimeoutSeconds: 7.25,
    wallTimeoutMs: 35_000,
  });
  const farDock = farDockWait.inspection;
  const beforeLandingRecoveries = farDock.obby.recoveries;
  let landed = null;
  await controls.jumpForwardUntil(async () => {
    const inspection = await inspectGame(page);
    if (!inspection?.obby) return false;
    if (
      inspection.status.grounded &&
      inspection.obby.checkpointId === "boss-landing"
    )
      landed = inspection;
    return (
      landed !== null || inspection.obby.recoveries > beforeLandingRecoveries
    );
  }, `${label}-boss-landing`);
  assert.ok(
    landed?.obby,
    `${label} recovered instead of reaching the boss landing`,
  );
  return {
    boardedAt: boardFerry.center.z,
    riddenTo: riddenFerry.center.z,
    farDockAt: ferryFrom(farDock)?.center.z,
    riderOffsetDrift:
      ridden.status.position.z - riddenFerry.center.z - riderOffset,
    waits: {
      nearDock: {
        simulationSeconds: nearDockWait.simulationElapsed,
        wallMilliseconds: nearDockWait.wallElapsedMs,
      },
      ride: {
        simulationSeconds: rideWait.simulationElapsed,
        wallMilliseconds: rideWait.wallElapsedMs,
      },
      farDock: {
        simulationSeconds: farDockWait.simulationElapsed,
        wallMilliseconds: farDockWait.wallElapsedMs,
      },
    },
    checkpointId: landed.obby.checkpointId,
    landingPosition: landed.status.position,
  };
}
