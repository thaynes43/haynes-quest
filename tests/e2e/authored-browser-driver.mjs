import assert from "node:assert/strict";

import {
  authoredDocumentFromInspection,
  livePlatform,
  planarDistance,
  platformGateway,
  safeMissRetryEdge,
} from "./authored-navigation.mjs";

export const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function inspectGame(page) {
  if (page.isClosed()) return null;
  return page
    .evaluate(() => {
      const canvas = document.querySelector("canvas[data-quest-canvas=true]");
      if (!canvas) return null;
      let element = canvas;
      let fiber = null;
      while (element && !fiber) {
        const fiberKey = Object.keys(element).find((key) =>
          key.startsWith("__reactFiber$"),
        );
        fiber = fiberKey ? element[fiberKey] : null;
        element = element.parentElement;
      }
      while (fiber) {
        let hook = fiber.memoizedState;
        while (hook) {
          const candidate = hook.memoizedState?.current;
          if (candidate && typeof candidate.inspect === "function") {
            return candidate.inspect();
          }
          hook = hook.next;
        }
        fiber = fiber.return;
      }
      return null;
    })
    .catch(() => null);
}

export async function waitForInspection({
  page,
  predicate,
  label,
  screenshot,
  timeout = 15_000,
}) {
  const deadline = Date.now() + timeout;
  let latest = null;
  while (Date.now() < deadline) {
    latest = await inspectGame(page);
    if (latest && (await predicate(latest))) return latest;
    await delay(45);
  }
  await screenshot(`${label}-failure`).catch(() => undefined);
  throw new Error(
    `${label} did not reach its inspected state: ${JSON.stringify(latest)}`,
  );
}

const touchPoint = (id, x, y) => ({
  id,
  x,
  y,
  radiusX: 5,
  radiusY: 5,
  force: 1,
});

export async function createTouchControls({ page, context }) {
  const cdp = await context.newCDPSession(page);
  let nextPointerId = 1;
  let held = null;

  const send = (type, touchPoints) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
  const controlCenter = async (locator, label) => {
    const bounds = await locator.boundingBox();
    assert.ok(bounds, `${label} is unavailable`);
    return {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
  };
  const movementContacts = async (deltaX, deltaZ, strength = 1) => {
    const magnitude = Math.hypot(deltaX, deltaZ);
    assert.ok(magnitude > 0, "zero-length touch movement requested");
    const bounds = await page.getByTestId("joystick").boundingBox();
    assert.ok(bounds, "touch joystick is unavailable");
    const center = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
    // A physical thumb can travel past the visible knob radius. Keep the
    // gesture proportional to the rendered control at every phone/tablet size.
    const dragRadius = bounds.width * 0.38;
    const id = nextPointerId++;
    return {
      origin: touchPoint(id, center.x, center.y),
      target: touchPoint(
        id,
        center.x + (deltaX / magnitude) * dragRadius * strength,
        center.y + (deltaZ / magnitude) * dragRadius * strength,
      ),
    };
  };
  const release = async () => {
    if (!held) return;
    held = null;
    await send("touchEnd", []);
    await delay(35);
  };
  const beginToward = async (deltaX, deltaZ, strength = 1) => {
    await release();
    const { origin, target } = await movementContacts(deltaX, deltaZ, strength);
    // The fixed game camera maps +X to joystick right and -Z to joystick up.
    held = target;
    await Promise.all([
      send("touchStart", [origin]),
      send("touchMove", [target]),
    ]);
    return target;
  };
  const jumpToward = async (
    deltaX,
    deltaZ,
    { strength = 1, milliseconds = 600 } = {},
  ) => {
    await release();
    const jumpCenter = await controlCenter(
      page.getByRole("button", { name: "Jump", exact: true }),
      "Jump button",
    );
    const { origin, target } = await movementContacts(deltaX, deltaZ, strength);
    const jump = touchPoint(nextPointerId++, jumpCenter.x, jumpCenter.y);
    held = target;
    // Queue the full two-finger gesture before waiting for slow CDP command
    // acknowledgements. At software-rendered frame rates, awaiting the moved
    // joystick first can walk through the final takeoff margin before the
    // second finger reaches the world.
    const started = send("touchStart", [origin]);
    const moved = send("touchMove", [target]);
    const down = send("touchStart", [held, jump]);
    await delay(10);
    // There is deliberately no move event for the Jump contact.
    // Chromium treats the listed contact as the released pointer while the
    // captured joystick contact stays active (covered by the existing input
    // diagnostic and used here only through the normal touch surface).
    const up = send("touchEnd", [jump]);
    await delay(Math.max(0, milliseconds - 10));
    held = null;
    const ended = send("touchEnd", []);
    await Promise.all([started, moved, down, up, ended]);
    await delay(35);
  };

  return {
    kind: "touch",
    beginToward,
    jumpToward,
    release,
    async pulseToward(
      deltaX,
      deltaZ,
      { jump = false, milliseconds = 150 } = {},
    ) {
      if (jump) return jumpToward(deltaX, deltaZ, { milliseconds });
      await release();
      const { origin, target } = await movementContacts(deltaX, deltaZ);
      held = target;
      const started = send("touchStart", [origin]);
      const moved = send("touchMove", [target]);
      await delay(milliseconds);
      held = null;
      const ended = send("touchEnd", []);
      await Promise.all([started, moved, ended]);
      await delay(35);
    },
    async tapButton(name) {
      return page
        .getByRole("button", { name, exact: true })
        .tap({ timeout: 1_000 })
        .then(() => true)
        .catch(() => false);
    },
  };
}

export function createHybridControls({ page }) {
  let heldKeys = [];
  const keysToward = (deltaX, deltaZ) => {
    const horizontal =
      Math.abs(deltaX) > 0.08 ? (deltaX < 0 ? "KeyA" : "KeyD") : null;
    const vertical =
      Math.abs(deltaZ) > 0.08 ? (deltaZ < 0 ? "KeyW" : "KeyS") : null;
    if (!horizontal) return vertical ? [vertical] : [];
    if (!vertical) return [horizontal];
    // Closed-loop pulses resolve non-45-degree approaches one axis at a time.
    return Math.abs(deltaX) > Math.abs(deltaZ) ? [horizontal] : [vertical];
  };
  const release = async () => {
    for (const key of [...heldKeys].reverse()) await page.keyboard.up(key);
    heldKeys = [];
  };
  const beginToward = async (deltaX, deltaZ) => {
    await release();
    heldKeys = keysToward(deltaX, deltaZ);
    assert.ok(heldKeys.length, "zero-length keyboard movement requested");
    for (const key of heldKeys) await page.keyboard.down(key);
  };
  return {
    kind: "keyboard-route-touch-actions",
    beginToward,
    release,
    async jumpToward(deltaX, deltaZ, { milliseconds = 600 } = {}) {
      await beginToward(deltaX, deltaZ);
      try {
        await page.keyboard.press("Space", { delay: 30 });
        await delay(milliseconds);
      } finally {
        await release();
      }
    },
    async pulseToward(
      deltaX,
      deltaZ,
      { jump = false, milliseconds = 150 } = {},
    ) {
      await beginToward(deltaX, deltaZ);
      try {
        if (jump) await page.keyboard.press("Space", { delay: 30 });
        await delay(milliseconds);
      } finally {
        await release();
      }
    },
    async tapButton(name) {
      return page
        .getByRole("button", { name, exact: true })
        .tap({ timeout: 1_000 })
        .then(() => true)
        .catch(() => false);
    },
  };
}

function pointToSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared === 0) return planarDistance(point, start);
  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared,
    ),
  );
  return Math.hypot(
    point.x - (start.x + projection * dx),
    point.z - (start.z + projection * dz),
  );
}

export function nearbyHazard(inspection, point, clearance = 1.25) {
  return inspection.obby?.hazards.find(
    (hazard) =>
      pointToSegmentDistance(point, hazard.start, hazard.end) <=
      hazard.radius + clearance,
  );
}

function isMovingPlatform(document, platformId) {
  return document.pieces.some(
    (piece) => piece.id === platformId && piece.type === "moving-platform",
  );
}

export function createAuthoredRouteDriver({
  page,
  controls,
  screenshot,
  mark,
  maxRecoveries = 10,
}) {
  let document = null;
  let startingRecoveries = null;
  const recoveries = [];
  const edgeEvidence = [];
  const ferryEvidence = [];
  const hazardJumps = [];
  const safeMissEvidence = [];
  const edgeAttempts = new Map();

  const read = async (label, { allowDocumentExit = false } = {}) => {
    const inspection = await inspectGame(page);
    assert.ok(inspection?.obby, `${label}: active obby inspection unavailable`);
    document ??= authoredDocumentFromInspection(inspection);
    const inspectedDocumentId = inspection.level.authored?.id ?? null;
    if (inspectedDocumentId !== document.id && allowDocumentExit) {
      return inspection;
    }
    assert.equal(
      inspectedDocumentId,
      document.id,
      `${label}: authored document changed during traversal`,
    );
    assert.equal(
      inspection.obby.routeId,
      document.id,
      `${label}: rendered route and authored document differ`,
    );
    startingRecoveries ??= inspection.obby.recoveries;
    const observed = inspection.obby.recoveries - startingRecoveries;
    assert.ok(
      observed <= maxRecoveries,
      `${label}: exceeded ${maxRecoveries} bounded local recoveries`,
    );
    if (recoveries.length < observed) {
      recoveries.push({
        at: label,
        count: inspection.obby.recoveries,
        checkpointId: inspection.obby.checkpointId,
        position: inspection.status.position,
      });
      mark("recovery:local", recoveries.at(-1));
    }
    return inspection;
  };

  const moveToPoint = async (
    targetFor,
    {
      label,
      tolerance = 0.5,
      supportId = null,
      allowHazardJump = true,
      stopOnRecovery = false,
      done = null,
      allowDocumentExit = false,
    } = {},
  ) => {
    let best = Number.POSITIVE_INFINITY;
    const recoveryCount = (await read(`${label}-start`)).obby.recoveries;
    const deadline = Date.now() + 25_000;
    while (Date.now() < deadline) {
      const inspection = await read(label, { allowDocumentExit });
      if (inspection.level.authored?.id !== document.id) {
        assert.ok(
          done && (await done(inspection)),
          `${label}: left the authored document before reaching the target`,
        );
        await controls.release();
        return inspection;
      }
      if (stopOnRecovery && inspection.obby.recoveries > recoveryCount) {
        await controls.release();
        return inspection;
      }
      if (done && (await done(inspection))) {
        await controls.release();
        return inspection;
      }
      const target = targetFor(inspection);
      assert.ok(target, `${label}: movement target unavailable`);
      const distance = planarDistance(inspection.status.position, target);
      best = Math.min(best, distance);
      if (
        distance <= tolerance &&
        (!supportId || inspection.obby.supportId === supportId)
      ) {
        await controls.release();
        return inspection;
      }
      if (distance < 0.08 && inspection.obby.supportId !== supportId) {
        await controls.release();
        mark("movement:support-changed", {
          label,
          requestedSupportId: supportId,
          supportId: inspection.obby.supportId,
          position: inspection.status.position,
        });
        return inspection;
      }
      const dx = target.x - inspection.status.position.x;
      const dz = target.z - inspection.status.position.z;
      const hazard = allowHazardJump
        ? nearbyHazard(inspection, inspection.status.position)
        : null;
      const jump = Boolean(hazard && inspection.status.grounded);
      if (jump) {
        hazardJumps.push({
          id: hazard.id,
          at: inspection.status.position,
          angle: hazard.angle,
        });
        mark("hazard:jump", hazardJumps.at(-1));
      }
      await controls.pulseToward(dx, dz, {
        jump,
        milliseconds: jump ? 300 : Math.min(180, Math.max(90, distance * 35)),
      });
    }
    await screenshot(`${label}-unreachable`);
    throw new Error(
      `${label}: target unreachable; nearest distance ${best.toFixed(2)}`,
    );
  };

  const ride = async (edge, label) => {
    await read(`${label}-start`);
    const targetIsMoving = isMovingPlatform(document, edge.to);
    const sourceIsMoving = isMovingPlatform(document, edge.from);
    assert.ok(
      targetIsMoving || sourceIsMoving,
      `${label}: ride edge has no moving platform`,
    );
    if (targetIsMoving) {
      let boarded = null;
      const boardDeadline = Date.now() + 30_000;
      while (Date.now() < boardDeadline && !boarded) {
        const boardInspection = await read(`${label}-board-wait`);
        const moving = livePlatform(boardInspection, edge.to);
        const source = livePlatform(boardInspection, edge.from);
        const gateway = platformGateway(source, moving);
        const target = gateway.to;
        const sourceEdge = gateway.from;
        if (
          planarDistance(boardInspection.status.position, sourceEdge) > 0.65
        ) {
          const approached = await moveToPoint(() => sourceEdge, {
            label: `${label}-board-approach`,
            tolerance: 0.6,
            supportId: edge.from,
            stopOnRecovery: true,
          });
          if (approached.obby.supportId !== edge.from) return approached;
          continue;
        }
        const gap = planarDistance(sourceEdge, target);
        if (gap > 1.45) {
          await delay(80);
          continue;
        }
        const recoveriesBefore = boardInspection.obby.recoveries;
        await controls.jumpToward(
          target.x - sourceEdge.x,
          target.z - sourceEdge.z,
        );
        try {
          boarded = await waitForInspection({
            page,
            screenshot,
            label: `${label}-boarded`,
            timeout: 3_000,
            predicate: (candidate) =>
              candidate.obby?.supportId === edge.to ||
              candidate.obby?.recoveries > recoveriesBefore,
          }).catch(() => null);
        } finally {
          await controls.release();
        }
        if (boarded?.obby?.recoveries > recoveriesBefore) return boarded;
        if (boarded?.obby?.supportId !== edge.to) boarded = null;
      }
      assert.ok(boarded, `${label}: moving platform could not be boarded`);
      const ferryAtBoard = livePlatform(boarded, edge.to);
      const riderOffset = {
        x: boarded.status.position.x - ferryAtBoard.center.x,
        z: boarded.status.position.z - ferryAtBoard.center.z,
      };
      const carryRecoveries = boarded.obby.recoveries;
      const carried = await waitForInspection({
        page,
        screenshot,
        label: `${label}-carried`,
        timeout: 20_000,
        predicate: (candidate) => {
          if (candidate.obby?.recoveries > carryRecoveries) return true;
          if (candidate.obby?.supportId !== edge.to) return false;
          const live = livePlatform(candidate, edge.to);
          return planarDistance(live.center, ferryAtBoard.center) >= 0.12;
        },
      });
      if (carried.obby.supportId !== edge.to) return carried;
      const ferryAfterCarry = livePlatform(carried, edge.to);
      const offsetAfter = {
        x: carried.status.position.x - ferryAfterCarry.center.x,
        z: carried.status.position.z - ferryAfterCarry.center.z,
      };
      const offsetDrift = planarDistance(riderOffset, offsetAfter);
      assert.ok(
        offsetDrift < 0.08,
        `${label}: player was not carried by the ferry`,
      );
      const evidence = {
        edge,
        supportId: carried.obby.supportId,
        platformTravel: planarDistance(
          ferryAtBoard.center,
          ferryAfterCarry.center,
        ),
        riderOffset,
        offsetDrift,
      };
      ferryEvidence.push(evidence);
      mark("ride:carried", evidence);
      return carried;
    }

    let inspection;
    const landingDeadline = Date.now() + 30_000;
    while (Date.now() < landingDeadline) {
      inspection = await read(`${label}-landing-wait`);
      assert.equal(
        inspection.obby.supportId,
        edge.from,
        `${label}: left moving platform before disembarking`,
      );
      const source = livePlatform(inspection, edge.from);
      const target = livePlatform(inspection, edge.to);
      const gateway = platformGateway(source, target);
      const sourceEdge = gateway.from;
      const targetEdge = gateway.to;
      if (planarDistance(inspection.status.position, sourceEdge) > 0.6) {
        const approached = await moveToPoint(
          (candidate) =>
            platformGateway(
              livePlatform(candidate, edge.from),
              livePlatform(candidate, edge.to),
            ).from,
          {
            label: `${label}-disembark-approach`,
            tolerance: 0.55,
            supportId: edge.from,
            allowHazardJump: false,
            stopOnRecovery: true,
          },
        );
        if (approached.obby.supportId !== edge.from) return approached;
        continue;
      }
      if (planarDistance(sourceEdge, targetEdge) > 1.45) {
        await delay(80);
        continue;
      }
      const recoveriesBefore = inspection.obby.recoveries;
      await controls.jumpToward(
        targetEdge.x - inspection.status.position.x,
        targetEdge.z - inspection.status.position.z,
      );
      let landed;
      try {
        landed = await waitForInspection({
          page,
          screenshot,
          label: `${label}-landed`,
          timeout: 4_000,
          predicate: (candidate) =>
            (candidate.status.grounded &&
              candidate.obby?.supportId === edge.to) ||
            candidate.obby?.recoveries > recoveriesBefore,
        }).catch(() => null);
      } finally {
        await controls.release();
      }
      if (landed?.obby?.recoveries > recoveriesBefore) return landed;
      if (landed?.obby?.supportId === edge.to) return landed;
    }
    throw new Error(`${label}: moving platform never reached its landing`);
  };

  const missToSafePlatform = async (edge, label) => {
    assert.equal(
      edge.mode,
      "jump",
      `${label}: safe miss must belong to a jump`,
    );
    assert.ok(
      edge.safeMissPlatformId,
      `${label}: jump has no declared safe miss platform`,
    );
    let before = await read(`${label}-before`);
    assert.equal(
      before.obby.supportId,
      edge.from,
      `${label}: expected support ${edge.from}, got ${before.obby.supportId}`,
    );
    const source = livePlatform(before, edge.from);
    const target = livePlatform(before, edge.to);
    const catchPlatform = livePlatform(before, edge.safeMissPlatformId);
    const gateway = platformGateway(source, target);
    const delta = {
      x: gateway.to.x - gateway.from.x,
      z: gateway.to.z - gateway.from.z,
    };
    const travelAxis = Math.abs(delta.z) >= Math.abs(delta.x) ? "z" : "x";
    const crossAxis = travelAxis === "z" ? "x" : "z";
    const crossHalf = source.size[crossAxis] / 2 - 0.55;
    const targetHalf = target.size[crossAxis] / 2 + 0.4;
    const catchHalf = catchPlatform.size[crossAxis] / 2 - 0.55;
    const crossCandidates = [-1, 1]
      .map(
        (direction) =>
          source.center[crossAxis] + direction * Math.max(0, crossHalf),
      )
      .filter(
        (coordinate) =>
          Math.abs(coordinate - target.center[crossAxis]) > targetHalf &&
          Math.abs(coordinate - catchPlatform.center[crossAxis]) <= catchHalf,
      );
    assert.ok(
      crossCandidates.length,
      `${label}: no normal-control miss lane reaches the declared catch`,
    );
    const missTakeoff = {
      ...gateway.from,
      [crossAxis]: crossCandidates[0],
    };
    if (planarDistance(before.status.position, missTakeoff) > 0.5) {
      before = await moveToPoint(() => missTakeoff, {
        label: `${label}-approach`,
        tolerance: 0.5,
        supportId: edge.from,
        allowHazardJump: false,
        stopOnRecovery: true,
      });
    }
    assert.equal(before.obby.supportId, edge.from);
    const jumpSequence = before.status.jumpSequence;
    const recoveries = before.obby.recoveries;
    await controls.jumpToward(
      travelAxis === "x" ? delta.x : 0,
      travelAxis === "z" ? delta.z : 0,
      { milliseconds: 600 },
    );
    let caught;
    caught = await waitForInspection({
      page,
      screenshot,
      label: `${label}-caught`,
      timeout: 8_000,
      predicate: (candidate) =>
        (candidate.status.grounded &&
          candidate.obby?.supportId === edge.safeMissPlatformId) ||
        candidate.obby?.recoveries > recoveries,
    });
    assert.equal(
      caught.obby.recoveries,
      recoveries,
      `${label}: safe miss triggered local recovery`,
    );
    assert.equal(
      caught.obby.supportId,
      edge.safeMissPlatformId,
      `${label}: missed jump did not land on its declared catch`,
    );
    assert.ok(
      caught.status.jumpSequence > jumpSequence,
      `${label}: deliberate miss did not use the normal jump control`,
    );
    const retryEdge = safeMissRetryEdge(document, edge);
    const evidence = {
      edge: { from: edge.from, to: edge.to, mode: edge.mode },
      safeMissPlatformId: edge.safeMissPlatformId,
      landed: caught.status.position,
      recoveries,
      jumpSequenceBefore: jumpSequence,
      jumpSequenceAfter: caught.status.jumpSequence,
      missTakeoff,
      retryEdge: {
        from: retryEdge.from,
        to: retryEdge.to,
        mode: retryEdge.mode,
      },
    };
    safeMissEvidence.push(evidence);
    mark("jump:safe-miss", evidence);
    return { caught, retryEdge, evidence };
  };

  const crossEdge = async (
    edge,
    label,
    { allowFinishTrigger = false, finishReached = null } = {},
  ) => {
    const edgeKey = `${edge.from}->${edge.to}`;
    let before = await read(`${label}-before`);
    if (before.obby.supportId === edge.to) {
      edgeAttempts.delete(edgeKey);
      return before;
    }
    assert.equal(
      before.obby.supportId,
      edge.from,
      `${label}: expected support ${edge.from}, got ${before.obby.supportId}`,
    );
    const recoveriesBefore = before.obby.recoveries;
    let after;
    while ((edgeAttempts.get(edgeKey) ?? 0) < 3) {
      const attempt = (edgeAttempts.get(edgeKey) ?? 0) + 1;
      edgeAttempts.set(edgeKey, attempt);
      before = await read(`${label}-attempt-${attempt}`);
      if (before.obby.supportId === edge.to) {
        after = before;
        break;
      }
      if (before.obby.supportId !== edge.from) return before;
      if (edge.mode === "ride") {
        after = await ride(edge, `${label}-ride`);
      } else {
        const target = livePlatform(before, edge.to);
        const source = livePlatform(before, edge.from);
        const gateway = platformGateway(source, target);
        const landing = gateway.to;
        if (edge.mode === "jump") {
          const takeoff = gateway.from;
          const approached = await moveToPoint(() => takeoff, {
            label: `${label}-takeoff`,
            tolerance: 0.5,
            supportId: edge.from,
            stopOnRecovery: true,
          });
          if (approached.obby.supportId !== edge.from) return approached;
          const current = await read(`${label}-jump-ready`);
          const attemptRecoveries = current.obby.recoveries;
          const jumpSequence = current.status.jumpSequence;
          mark("jump:requested", {
            edge,
            attempt,
            input: current.input,
            position: current.status.position,
            jumpSequence,
          });
          await controls.jumpToward(
            landing.x - current.status.position.x,
            landing.z - current.status.position.z,
          );
          try {
            after = await waitForInspection({
              page,
              screenshot,
              label: `${label}-jump-land`,
              timeout: 6_000,
              predicate: (candidate) =>
                (candidate.status.grounded &&
                  candidate.obby?.supportId === edge.to) ||
                candidate.obby?.recoveries > attemptRecoveries,
            }).catch(() => null);
          } finally {
            await controls.release();
          }
          if (!after) {
            after = await read(`${label}-jump-timeout`);
          }
          mark("jump:observed", {
            edge,
            attempt,
            input: after.input,
            position: after.status.position,
            grounded: after.status.grounded,
            supportId: after.obby.supportId,
            recoveries: after.obby.recoveries,
            jumpSequence: after.status.jumpSequence,
            pointerTrace: await page.evaluate(() =>
              (window.__authoredPointerTrace ?? []).slice(-12),
            ),
          });
          assert.ok(
            after.status.jumpSequence > jumpSequence,
            `${label}: touch jump was not accepted`,
          );
        } else {
          after = await moveToPoint(
            (candidate) => livePlatform(candidate, edge.to).center,
            {
              label: `${label}-walk`,
              tolerance: 0.55,
              supportId: edge.to,
              stopOnRecovery: true,
              allowDocumentExit: allowFinishTrigger,
              done: allowFinishTrigger
                ? (candidate) =>
                    candidate.level.authored?.id !== document.id ||
                    finishReached?.(candidate)
                : null,
            },
          );
        }
      }
      const finishTriggered = Boolean(
        allowFinishTrigger && finishReached?.(after),
      );
      if (after.level.authored?.id !== document.id || finishTriggered) {
        assert.equal(
          allowFinishTrigger && edge.to === document.anchors.finish.platformId,
          true,
          `${label}: document exit occurred outside the declared finish edge`,
        );
        break;
      }
      if (after.obby.supportId === edge.to) break;
      if (after.obby.supportId !== edge.from) {
        mark("edge:rewind", {
          edge,
          attempt,
          supportId: after.obby.supportId,
          recoveries: after.obby.recoveries,
        });
        return after;
      }
      mark("edge:retry", {
        edge,
        attempt,
        recoveries: after.obby.recoveries,
      });
    }
    assert.ok(
      after,
      `${label}: ${edge.mode} edge exhausted its 3-attempt budget without a landing observation`,
    );
    const documentExited = after.level.authored?.id !== document.id;
    const finishTriggered = Boolean(
      allowFinishTrigger && finishReached?.(after),
    );
    if (!documentExited && !finishTriggered) {
      assert.equal(
        after?.obby.supportId,
        edge.to,
        `${label}: ${edge.mode} edge remained unreachable after ${edgeAttempts.get(edgeKey)} real attempts`,
      );
    }
    edgeAttempts.delete(edgeKey);
    const evidence = {
      ...edge,
      ...(documentExited || finishTriggered
        ? {
            recoveries: 0,
            finishTriggered,
            ...(documentExited
              ? {
                  documentExited: true,
                  nextDocumentId: after.level.authored?.id ?? null,
                }
              : { triggerPosition: after.status.position }),
          }
        : {
            recoveries: after.obby.recoveries - recoveriesBefore,
            landed: after.status.position,
          }),
    };
    edgeEvidence.push(evidence);
    mark("edge:crossed", evidence);
    return after;
  };

  return {
    read,
    moveToPoint,
    missToSafePlatform,
    crossEdge,
    evidence: {
      edgeEvidence,
      ferryEvidence,
      hazardJumps,
      safeMissEvidence,
      recoveries,
    },
    document: () => document,
  };
}

export function chooseFallDirection(inspection) {
  assert.ok(inspection?.obby?.supportId, "fall proof needs a supported player");
  const support = livePlatform(inspection, inspection.obby.supportId);
  const options = [
    {
      dx: 1,
      dz: 0,
      distance:
        support.center.x + support.size.x / 2 - inspection.status.position.x,
    },
    {
      dx: -1,
      dz: 0,
      distance:
        inspection.status.position.x - (support.center.x - support.size.x / 2),
    },
    {
      dx: 0,
      dz: 1,
      distance:
        support.center.z + support.size.z / 2 - inspection.status.position.z,
    },
    {
      dx: 0,
      dz: -1,
      distance:
        inspection.status.position.z - (support.center.z - support.size.z / 2),
    },
  ];
  for (const option of options) {
    const exit = {
      x: support.center.x + option.dx * (support.size.x / 2 + 1.5),
      z: support.center.z + option.dz * (support.size.z / 2 + 1.5),
    };
    option.clearance = Math.min(
      ...inspection.obby.platforms
        .filter((platform) => platform.id !== support.id)
        .map((platform) => {
          const dx = Math.max(
            0,
            Math.abs(exit.x - platform.center.x) - platform.size.x / 2,
          );
          const dz = Math.max(
            0,
            Math.abs(exit.z - platform.center.z) - platform.size.z / 2,
          );
          return Math.hypot(dx, dz);
        }),
    );
  }
  return options.sort(
    (left, right) =>
      right.clearance - left.clearance || left.distance - right.distance,
  )[0];
}
