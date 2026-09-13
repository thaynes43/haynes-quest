import assert from "node:assert/strict";

const modes = new Set(["walk", "jump", "ride"]);
const schemaVersions = new Set(["authored-level-v1", "authored-level-v2"]);

const pairKey = (from, to) => `${from}\u0000${to}`;

const safeMissRetryEdges = (document, connection) => {
  const sourceIndex = document.mainPath.indexOf(connection.from);
  return document.connections.filter((candidate) => {
    if (candidate.from !== connection.safeMissPlatformId) return false;
    if (candidate.to === connection.from) return true;
    const retryIndex = document.mainPath.indexOf(candidate.to);
    return sourceIndex >= 0 && retryIndex >= 0 && retryIndex <= sourceIndex;
  });
};

function requireString(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.ok(value.length > 0, `${label} must not be empty`);
  return value;
}

function requirePoint(value, label) {
  assert.ok(value && typeof value === "object", `${label} must be an object`);
  for (const axis of ["x", "y", "z"]) {
    assert.ok(Number.isFinite(value[axis]), `${label}.${axis} must be finite`);
  }
  return value;
}

/**
 * Reads the public inspection ABI and rejects incomplete navigation metadata.
 * The returned object is the immutable inspection value; this helper never
 * imports production level data or assumes route-specific coordinates.
 */
export function authoredDocumentFromInspection(inspection) {
  const document = inspection?.level?.authored;
  assert.ok(document, "inspection.level.authored is unavailable");
  return validateAuthoredNavigation(document);
}

export function validateAuthoredNavigation(document) {
  assert.ok(
    document && typeof document === "object",
    "authored document missing",
  );
  assert.ok(
    schemaVersions.has(document.schemaVersion),
    `unsupported authored level schema ${document.schemaVersion}`,
  );
  requireString(document.id, "authored.id");
  assert.ok(Array.isArray(document.pieces), "authored.pieces must be an array");
  assert.ok(
    Array.isArray(document.connections),
    "authored.connections must be an array",
  );
  assert.ok(
    Array.isArray(document.mainPath),
    "authored.mainPath must be an array",
  );
  assert.ok(document.mainPath.length >= 2, "authored.mainPath is too short");
  assert.ok(
    Array.isArray(document.branches),
    "authored.branches must be an array",
  );

  const platformIds = new Set();
  const staticPlatformIds = new Set();
  const pieceIds = new Set();
  for (const [index, piece] of document.pieces.entries()) {
    const id = requireString(piece?.id, `authored.pieces[${index}].id`);
    assert.ok(!pieceIds.has(id), `duplicate authored piece id ${id}`);
    pieceIds.add(id);
    if (piece.type === "platform" || piece.type === "moving-platform") {
      requirePoint(piece.center, `authored piece ${id}.center`);
      requirePoint(piece.size, `authored piece ${id}.size`);
      platformIds.add(id);
      if (piece.type === "platform") staticPlatformIds.add(id);
    }
  }

  const connections = new Map();
  for (const [index, connection] of document.connections.entries()) {
    const from = requireString(
      connection?.from,
      `authored.connections[${index}].from`,
    );
    const to = requireString(
      connection?.to,
      `authored.connections[${index}].to`,
    );
    assert.ok(
      platformIds.has(from),
      `connection source ${from} is not a platform`,
    );
    assert.ok(platformIds.has(to), `connection target ${to} is not a platform`);
    assert.ok(
      modes.has(connection.mode),
      `unsupported connection mode ${connection.mode}`,
    );
    if (connection.safeMissPlatformId !== undefined) {
      assert.equal(
        document.schemaVersion,
        "authored-level-v2",
        "safeMissPlatformId requires authored-level-v2",
      );
      assert.ok(
        staticPlatformIds.has(connection.safeMissPlatformId),
        `connection safe miss ${connection.safeMissPlatformId} is not a static platform`,
      );
    }
    const key = pairKey(from, to);
    assert.ok(!connections.has(key), `duplicate connection ${from} -> ${to}`);
    connections.set(key, connection);
  }

  const validatePath = (path, label) => {
    assert.ok(Array.isArray(path) && path.length >= 2, `${label} is too short`);
    for (const [index, platformId] of path.entries()) {
      requireString(platformId, `${label}[${index}]`);
      assert.ok(
        platformIds.has(platformId),
        `${label}[${index}] is not a platform`,
      );
      if (index > 0) {
        const previous = path[index - 1];
        assert.ok(
          connections.has(pairKey(previous, platformId)),
          `${label} has no connection ${previous} -> ${platformId}`,
        );
      }
    }
  };
  validatePath(document.mainPath, "authored.mainPath");

  for (const connection of document.connections) {
    if (connection.safeMissPlatformId === undefined) continue;
    assert.ok(
      safeMissRetryEdges(document, connection).length > 0,
      `safe miss ${connection.safeMissPlatformId} has no declared retry edge back toward the practice start`,
    );
  }

  const mainIndexes = new Map(
    document.mainPath.map((platformId, index) => [platformId, index]),
  );
  for (const [index, branch] of document.branches.entries()) {
    const label = `authored.branches[${index}]`;
    validatePath(branch, label);
    const start = mainIndexes.get(branch[0]);
    const rejoin = mainIndexes.get(branch.at(-1));
    assert.ok(start !== undefined, `${label} does not start on mainPath`);
    assert.ok(rejoin !== undefined, `${label} does not rejoin mainPath`);
    assert.ok(start < rejoin, `${label} must rejoin after its start`);
  }

  validateAnchorPlatforms(document.anchors, platformIds, pieceIds);
  return document;
}

function validateAnchorPlatforms(anchors, platformIds, pieceIds) {
  assert.ok(anchors && typeof anchors === "object", "authored.anchors missing");
  const groups = [
    ["spawn", anchors.spawn],
    ["finish", anchors.finish],
    ["rewardRespawn", anchors.rewardRespawn],
    ...Object.entries(anchors.pickups ?? {}).map(([key, value]) => [
      `pickups.${key}`,
      value,
    ]),
    ...Object.entries(anchors.memories ?? {}).map(([key, value]) => [
      `memories.${key}`,
      value,
    ]),
    ...Object.entries(anchors.encounters ?? {}).map(([key, value]) => [
      `encounters.${key}`,
      value,
    ]),
    ...Object.entries(anchors.friendlies ?? {}).map(([key, value]) => [
      `friendlies.${key}`,
      value,
    ]),
  ];
  for (const [key, anchor] of groups) {
    assert.ok(anchor, `authored.anchors.${key} missing`);
    requirePoint(anchor.position, `authored.anchors.${key}.position`);
    assert.ok(
      platformIds.has(anchor.platformId),
      `authored.anchors.${key}.platformId is not a platform`,
    );
    if (key.startsWith("encounters.")) {
      assert.ok(
        pieceIds.has(anchor.checkpointId),
        `authored.anchors.${key}.checkpointId is not a piece`,
      );
    }
  }
}

/** Returns the named directed edge from the validated document. */
export function connectionBetween(document, from, to) {
  const connection = document.connections.find(
    (candidate) => candidate.from === from && candidate.to === to,
  );
  assert.ok(connection, `authored route has no connection ${from} -> ${to}`);
  return connection;
}

/** Returns the one declared retry edge that leaves a connection's safe catch. */
export function safeMissRetryEdge(document, connection) {
  validateAuthoredNavigation(document);
  const platformId = requireString(
    connection?.safeMissPlatformId,
    "connection.safeMissPlatformId",
  );
  const retries = safeMissRetryEdges(document, connection);
  assert.equal(
    retries.length,
    1,
    `safe miss ${platformId} must have exactly one declared retry edge`,
  );
  return retries[0];
}

/**
 * Builds one continuous start-to-finish route. A selected branch replaces the
 * main-path segment between its start and rejoin, exactly as the authored graph
 * declares. No coordinates or platform names influence the result.
 */
export function buildTraversalPlan(document, { branchIndex = null } = {}) {
  validateAuthoredNavigation(document);
  let platformIds = [...document.mainPath];
  let branch = null;
  if (branchIndex !== null) {
    assert.ok(
      Number.isInteger(branchIndex) && document.branches[branchIndex],
      `authored branch ${branchIndex} is unavailable`,
    );
    branch = document.branches[branchIndex];
    const start = platformIds.indexOf(branch[0]);
    const rejoin = platformIds.indexOf(branch.at(-1), start + 1);
    assert.ok(
      start >= 0 && rejoin > start,
      "selected branch endpoints are invalid",
    );
    platformIds = [
      ...platformIds.slice(0, start),
      ...branch,
      ...platformIds.slice(rejoin + 1),
    ];
  }
  const edges = platformIds.slice(1).map((to, index) => {
    const from = platformIds[index];
    return { ...connectionBetween(document, from, to), index };
  });
  return {
    documentId: document.id,
    schemaVersion: document.schemaVersion,
    branchIndex,
    branchPlatformIds: branch ? [...branch] : [],
    platformIds,
    edges,
  };
}

/**
 * Finds a shortest directed platform path. This is used to reach a content
 * anchor from live support state; it never changes game state itself.
 */
export function findPlatformPath(document, from, to) {
  validateAuthoredNavigation(document);
  if (from === to) return [];
  const outgoing = new Map();
  for (const connection of document.connections) {
    const list = outgoing.get(connection.from) ?? [];
    list.push(connection);
    outgoing.set(connection.from, list);
  }
  const queue = [{ at: from, edges: [] }];
  const visited = new Set([from]);
  while (queue.length) {
    const candidate = queue.shift();
    for (const connection of outgoing.get(candidate.at) ?? []) {
      if (visited.has(connection.to)) continue;
      const edges = [...candidate.edges, connection];
      if (connection.to === to) return edges;
      visited.add(connection.to);
      queue.push({ at: connection.to, edges });
    }
  }
  throw new Error(`authored route cannot reach ${to} from ${from}`);
}

export function livePlatform(inspection, platformId) {
  const platform = inspection?.obby?.platforms?.find(
    (candidate) => candidate.id === platformId,
  );
  assert.ok(platform, `live platform ${platformId} is unavailable`);
  requirePoint(platform.center, `live platform ${platformId}.center`);
  requirePoint(platform.size, `live platform ${platformId}.size`);
  return platform;
}

export function planarDistance(first, second) {
  return Math.hypot(first.x - second.x, first.z - second.z);
}

/** Nearest safe point inside a platform top, leaving room for the traveler. */
export function landingPoint(platform, from, inset = 0.45) {
  const halfX = Math.max(0, platform.size.x / 2 - inset);
  const halfZ = Math.max(0, platform.size.z / 2 - inset);
  return {
    x: Math.max(
      platform.center.x - halfX,
      Math.min(platform.center.x + halfX, from.x),
    ),
    y: platform.center.y + platform.size.y / 2,
    z: Math.max(
      platform.center.z - halfZ,
      Math.min(platform.center.z + halfZ, from.z),
    ),
  };
}

/** Closest aligned inset points across two axis-aligned platform tops. */
export function platformGateway(source, target, inset = 0.32) {
  const interval = (platform, axis) => {
    const half = Math.max(0, platform.size[axis] / 2 - inset);
    return [platform.center[axis] - half, platform.center[axis] + half];
  };
  const coordinates = (axis) => {
    const [sourceMin, sourceMax] = interval(source, axis);
    const [targetMin, targetMax] = interval(target, axis);
    const overlapMin = Math.max(sourceMin, targetMin);
    const overlapMax = Math.min(sourceMax, targetMax);
    if (overlapMin <= overlapMax) {
      const shared = (overlapMin + overlapMax) / 2;
      return [shared, shared];
    }
    return sourceMax < targetMin
      ? [sourceMax, targetMin]
      : [sourceMin, targetMax];
  };
  let [sourceX, targetX] = coordinates("x");
  let [sourceZ, targetZ] = coordinates("z");
  const sourceTop = source.center.y + source.size.y / 2;
  const targetTop = target.center.y + target.size.y / 2;
  if (
    targetTop > sourceTop + 0.001 &&
    sourceX === targetX &&
    sourceZ === targetZ
  ) {
    const deltaX = source.center.x - target.center.x;
    const deltaZ = source.center.z - target.center.z;
    const axis = Math.abs(deltaX) >= Math.abs(deltaZ) ? "x" : "z";
    const direction = Math.sign(axis === "x" ? deltaX : deltaZ);
    assert.notEqual(
      direction,
      0,
      "raised overlapping platforms have no reachable outer face",
    );
    const targetFace =
      target.center[axis] + direction * (target.size[axis] / 2);
    if (axis === "x") {
      sourceX = targetFace + direction * inset;
      targetX = targetFace - direction * inset;
    } else {
      sourceZ = targetFace + direction * inset;
      targetZ = targetFace - direction * inset;
    }
  }
  return {
    from: {
      x: sourceX,
      y: sourceTop,
      z: sourceZ,
    },
    to: {
      x: targetX,
      y: targetTop,
      z: targetZ,
    },
  };
}

export function summarizeAuthoredCourse(document) {
  validateAuthoredNavigation(document);
  return {
    id: document.id,
    schemaVersion: document.schemaVersion,
    platforms: document.pieces.filter((piece) => piece.type === "platform")
      .length,
    movingPlatforms: document.pieces.filter(
      (piece) => piece.type === "moving-platform",
    ).length,
    sweepers: document.pieces.filter((piece) => piece.type === "sweeper")
      .length,
    checkpoints: document.pieces.filter((piece) => piece.type === "checkpoint")
      .length,
    mainPathPlatforms: document.mainPath.length,
    branches: document.branches.length,
    connections: document.connections.length,
    safeMissConnections: document.connections.filter(
      (connection) => connection.safeMissPlatformId !== undefined,
    ).length,
    safeMissPlatforms: new Set(
      document.connections.flatMap((connection) =>
        connection.safeMissPlatformId === undefined
          ? []
          : [connection.safeMissPlatformId],
      ),
    ).size,
  };
}
