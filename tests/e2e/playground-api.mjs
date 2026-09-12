#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_CATALOG = fileURLToPath(
  new URL(
    "../../docs/assets/media/fixture-memories/v001/manifest.json",
    import.meta.url,
  ),
);
const REQUEST_TIMEOUT_MS = 10_000;
const USER_AGENT = "haynes-quest-plan009-release-probe/1";
const EXPECTED_VERSIONS = Object.freeze({
  journey: "era-level-plan-v3",
  age: "birth-date-whole-years-v1",
  progression: "route-major-recovery-v3",
  appearance: "synthetic-traveler-v1",
  catalog: "parody-catalog-v4",
  combat: "discrete-combat-v1",
});
const EXPECTED_AUTHORED_LEVELS = Object.freeze({
  chapterOne: Object.freeze({
    periodId: "block-party-v1",
    routeId: "garden-playground-v1",
    encounterIds: Object.freeze([
      "level-1-2020-encounter-1",
      "level-1-2020-encounter-2",
      "level-1-2020-encounter-3",
      "level-1-2020-encounter-4",
      "level-1-2020-boss",
    ]),
  }),
  chapterTwo: Object.freeze({
    periodId: "besties-obby-v1",
    routeId: "besties-playground-v1",
    encounterIds: Object.freeze([
      "level-2-2024-encounter-1",
      "level-2-2024-encounter-2",
      "level-2-2024-encounter-3",
      "level-2-2024-encounter-4",
      "level-2-2024-boss",
    ]),
  }),
});

function usage() {
  return [
    "Usage: node tests/e2e/playground-api.mjs \\",
    "  --base-url http://127.0.0.1:4400 \\",
    "  [--expected-client-sha256 <64 lowercase hex>] \\",
    "  [--catalog <fixture manifest path>]",
  ].join("\n");
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error("usage");
    values[key.slice(2)] = value;
  }
  if (!values["base-url"]) throw new Error("usage");
  if (
    values["expected-client-sha256"] &&
    !/^[0-9a-f]{64}$/.test(values["expected-client-sha256"])
  )
    throw new Error("usage");
  const baseUrl = new URL(values["base-url"]);
  if (
    !["http:", "https:"].includes(baseUrl.protocol) ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.pathname !== "/" ||
    baseUrl.search ||
    baseUrl.hash
  )
    throw new Error("usage");
  return {
    baseUrl,
    catalog: path.resolve(values.catalog ?? DEFAULT_CATALOG),
    expectedClientSha256: values["expected-client-sha256"],
  };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sameValues(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function observedVersionContract(save) {
  return {
    journey: save?.versions?.journey,
    age: save?.versions?.age,
    progression: save?.versions?.progression,
    appearance: save?.versions?.appearance,
    catalog: save?.versions?.catalog,
    combat: save?.versions?.combat,
    adventurePlan: save?.adventure?.planVersion,
    adventureCatalog: save?.adventure?.catalogVersion,
  };
}

function hasExpectedVersionContract(observed) {
  return (
    observed.journey === EXPECTED_VERSIONS.journey &&
    observed.age === EXPECTED_VERSIONS.age &&
    observed.progression === EXPECTED_VERSIONS.progression &&
    observed.appearance === EXPECTED_VERSIONS.appearance &&
    observed.catalog === EXPECTED_VERSIONS.catalog &&
    observed.combat === EXPECTED_VERSIONS.combat &&
    observed.adventurePlan === EXPECTED_VERSIONS.journey &&
    observed.adventureCatalog === EXPECTED_VERSIONS.catalog
  );
}

function observedAuthoredLevel(save) {
  const level = save?.adventure?.activeLevel;
  return {
    periodId: level?.periodId,
    routeId: level?.routeId,
    encounterIds: Array.isArray(level?.encounters)
      ? level.encounters.map((encounter) => encounter?.id)
      : [],
  };
}

function hasExpectedEncounterInstances(observed, expected) {
  return (
    observed.encounterIds.length === 5 &&
    new Set(observed.encounterIds).size === 5 &&
    JSON.stringify(observed.encounterIds) === JSON.stringify(expected.encounterIds)
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const checks = [];
  const requireCheck = (name, passed, evidence = {}) => {
    checks.push({ name, passed: Boolean(passed), ...evidence });
    if (!passed) throw new Error(name);
  };
  const request = async (pathname, init = {}) => {
    const response = await fetch(new URL(pathname, options.baseUrl), {
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ...init,
      headers: {
        "user-agent": USER_AGENT,
        ...init.headers,
      },
    });
    return response;
  };
  const json = async (pathname, status, init = {}) => {
    const response = await request(pathname, init);
    requireCheck(`${pathname} status`, response.status === status, {
      actual: response.status,
      expected: status,
    });
    requireCheck(
      `${pathname} JSON content type`,
      response.headers.get("content-type")?.startsWith("application/json"),
    );
    return { response, body: await response.json() };
  };

  const health = await json("/healthz", 200);
  requireCheck("health response", health.body?.status === "ok");
  const ready = await json("/readyz", 200);
  requireCheck("readiness response", ready.body?.status === "ready");

  let client;
  if (options.expectedClientSha256) {
    const shell = await request("/");
    requireCheck("client shell status", shell.status === 200, {
      actual: shell.status,
      expected: 200,
    });
    const html = await shell.text();
    const sources = [
      ...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/giu),
    ].map((match) => match[1]);
    const entrypoints = sources.filter((source) =>
      /^\/assets\/index-[A-Za-z0-9_-]+\.js$/.test(source),
    );
    requireCheck("single client entrypoint", entrypoints.length === 1, {
      count: entrypoints.length,
    });
    const bundle = await request(entrypoints[0]);
    requireCheck("client bundle status", bundle.status === 200, {
      actual: bundle.status,
      expected: 200,
    });
    const bytes = Buffer.from(await bundle.arrayBuffer());
    const actualSha256 = sha256(bytes);
    requireCheck(
      "client bundle digest",
      actualSha256 === options.expectedClientSha256,
      { bytes: bytes.length, sha256: actualSha256 },
    );
    client = { checked: true, bytes: bytes.length, sha256: actualSha256 };
  } else {
    client = { checked: false };
  }

  const session = await json("/api/session", 200);
  requireCheck(
    "ephemeral fixture session",
    session.body?.mode === "fixture" &&
      session.body?.progressMode === "ephemeral" &&
      session.body?.csrfHeader === "X-Quest-Request",
  );
  const setCookie =
    session.response.headers.getSetCookie?.()[0] ??
    session.response.headers.get("set-cookie");
  const cookie = setCookie?.split(";", 1)[0];
  requireCheck("session cookie issued", Boolean(cookie));

  const authenticatedJson = (pathname, status, init = {}) =>
    json(pathname, status, {
      ...init,
      headers: { cookie, ...init.headers },
    });
  const mutation = (chapter) => ({
    method: "POST",
    body: JSON.stringify({ chapter }),
    headers: {
      origin: options.baseUrl.origin,
      "content-type": "application/json",
      "x-quest-request": "1",
    },
  });

  const savesBefore = await authenticatedJson("/api/saves", 200);
  requireCheck(
    "empty save discovery before fresh starts",
    Array.isArray(savesBefore.body?.saves) && savesBefore.body.saves.length === 0,
  );

  const chapterOne = (
    await authenticatedJson("/api/playtest/start", 201, mutation(1))
  ).body;
  const chapterTwo = (
    await authenticatedJson("/api/playtest/start", 201, mutation(2))
  ).body;
  requireCheck(
    "fresh starts have distinct save identities",
    typeof chapterOne?.id === "string" &&
      chapterOne.id.length > 0 &&
      typeof chapterTwo?.id === "string" &&
      chapterTwo.id.length > 0 &&
      chapterOne.id !== chapterTwo.id,
  );
  requireCheck(
    "chapter one begins at age zero",
    chapterOne?.ageYears === 0 &&
      chapterOne?.adventure?.activeLevelIndex === 0 &&
      chapterOne?.adventure?.phase === "exploring",
    {
      ageYears: chapterOne?.ageYears,
      activeLevelIndex: chapterOne?.adventure?.activeLevelIndex,
    },
  );
  requireCheck(
    "chapter two shortcut begins at age four",
    chapterTwo?.ageYears === 4 &&
      chapterTwo?.adventure?.activeLevelIndex === 1 &&
      chapterTwo?.adventure?.phase === "exploring",
    {
      ageYears: chapterTwo?.ageYears,
      activeLevelIndex: chapterTwo?.adventure?.activeLevelIndex,
    },
  );

  const chapterOneVersions = observedVersionContract(chapterOne);
  const chapterTwoVersions = observedVersionContract(chapterTwo);
  const chapterOneLevel = observedAuthoredLevel(chapterOne);
  const chapterTwoLevel = observedAuthoredLevel(chapterTwo);
  requireCheck(
    "chapter one uses the catalog v4 version contract",
    hasExpectedVersionContract(chapterOneVersions),
    { observed: chapterOneVersions },
  );
  requireCheck(
    "chapter one selects the garden authored route",
    chapterOneLevel.periodId === EXPECTED_AUTHORED_LEVELS.chapterOne.periodId &&
      chapterOneLevel.routeId === EXPECTED_AUTHORED_LEVELS.chapterOne.routeId,
    {
      periodId: chapterOneLevel.periodId,
      routeId: chapterOneLevel.routeId,
    },
  );
  requireCheck(
    "chapter one has five exact unique encounter instances",
    hasExpectedEncounterInstances(
      chapterOneLevel,
      EXPECTED_AUTHORED_LEVELS.chapterOne,
    ),
    { encounterIds: chapterOneLevel.encounterIds },
  );
  requireCheck(
    "chapter two uses the catalog v4 version contract",
    hasExpectedVersionContract(chapterTwoVersions),
    { observed: chapterTwoVersions },
  );
  requireCheck(
    "chapter two selects the Besties authored route",
    chapterTwoLevel.periodId === EXPECTED_AUTHORED_LEVELS.chapterTwo.periodId &&
      chapterTwoLevel.routeId === EXPECTED_AUTHORED_LEVELS.chapterTwo.routeId,
    {
      periodId: chapterTwoLevel.periodId,
      routeId: chapterTwoLevel.routeId,
    },
  );
  requireCheck(
    "chapter two has five exact unique encounter instances",
    hasExpectedEncounterInstances(
      chapterTwoLevel,
      EXPECTED_AUTHORED_LEVELS.chapterTwo,
    ),
    { encounterIds: chapterTwoLevel.encounterIds },
  );

  const savesAfter = await authenticatedJson("/api/saves", 200);
  requireCheck(
    "empty save discovery after fresh starts",
    Array.isArray(savesAfter.body?.saves) && savesAfter.body.saves.length === 0,
  );

  const manifest = JSON.parse(await readFile(options.catalog, "utf8"));
  const assets = manifest.files?.filter(
    (entry) => entry.role === "fixture-picture",
  );
  requireCheck("catalog contains exactly six fixture pictures", assets?.length === 6, {
    count: assets?.length ?? 0,
  });
  const fixtureKeys = assets.map((entry) => entry.fixture_key);
  requireCheck(
    "fresh routes use the six catalog pictures",
    chapterOne?.memories?.length === 6 &&
      chapterTwo?.memories?.length === 6 &&
      sameValues(
        chapterOne.memories.map((memory) => memory.id),
        fixtureKeys,
      ) &&
      sameValues(
        chapterTwo.memories.map((memory) => memory.id),
        fixtureKeys,
      ),
    {
      chapterOneCount: chapterOne?.memories?.length,
      chapterTwoCount: chapterTwo?.memories?.length,
    },
  );

  const assetEvidence = [];
  for (const [index, asset] of assets.entries()) {
    const expected = Buffer.from(
      await readFile(
        path.resolve(path.dirname(options.catalog), path.basename(asset.path)),
      ),
    );
    requireCheck(
      `catalog picture ${index + 1} matches its manifest`,
      expected.length === asset.bytes && sha256(expected) === asset.sha256,
    );
    const response = await request(
      `/api/fixture-media/${encodeURIComponent(asset.fixture_key)}`,
    );
    requireCheck(`fixture picture ${index + 1} status`, response.status === 200, {
      actual: response.status,
      expected: 200,
    });
    requireCheck(
      `fixture picture ${index + 1} SVG content type`,
      response.headers.get("content-type")?.startsWith("image/svg+xml"),
    );
    const served = Buffer.from(await response.arrayBuffer());
    const actualSha256 = sha256(served);
    requireCheck(
      `fixture picture ${index + 1} exact bytes`,
      served.equals(expected) &&
        served.length === asset.bytes &&
        actualSha256 === asset.sha256,
    );
    assetEvidence.push({
      asset: index + 1,
      bytes: served.length,
      sha256: actualSha256,
    });
  }

  return {
    schemaVersion: 1,
    observedAt: new Date().toISOString(),
    target: options.baseUrl.origin,
    passed: true,
    summary: { passed: checks.length, failed: 0, total: checks.length },
    client,
    session: { mode: "fixture", progressMode: "ephemeral" },
    freshStarts: {
      distinct: true,
      chapterOne: {
        ageYears: 0,
        activeLevelIndex: 0,
        versions: chapterOneVersions,
        level: chapterOneLevel,
      },
      chapterTwo: {
        ageYears: 4,
        activeLevelIndex: 1,
        versions: chapterTwoVersions,
        level: chapterTwoLevel,
      },
      listedSaves: 0,
    },
    fixturePictures: {
      count: assetEvidence.length,
      exact: true,
      assets: assetEvidence,
    },
    checks,
  };
}

try {
  const report = await main();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  const showUsage = error instanceof Error && error.message === "usage";
  const report = {
    schemaVersion: 1,
    observedAt: new Date().toISOString(),
    passed: false,
    error: showUsage ? "invalid arguments" : "release API assertion failed",
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (showUsage) process.stderr.write(`${usage()}\n`);
  process.exitCode = 1;
}
