import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AUTHORED_LEVEL_V4_LIMITS,
  resolveAuthoredLevelDocument,
  validateAuthoredLevelDocument,
  type AuthoredConnection,
  type AuthoredLevelDocument,
  type AuthoredLevelPiece,
} from "../../src/shared/authored-level";
import { validateGrowthRequirements } from "../../src/shared/authored-level-growth";
import {
  applyLevelEditorCommand,
  createLevelEditorProject,
  createWorldEditorProject,
  parseLevelEditorProject,
  validateLevelEditorProject,
} from "../../src/shared/editor-project";
import besties from "../../src/shared/levels/besties-playground-v2.json";

const demo = JSON.parse(
  readFileSync(
    new URL("../../scripts/levels/examples/vertical-v4-demo.project.json", import.meta.url),
    "utf8",
  ),
);
const base: AuthoredLevelDocument = demo.chapters[1].level;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function withPiece(
  document: AuthoredLevelDocument,
  id: string,
  change: (piece: Record<string, unknown>) => void,
): AuthoredLevelDocument {
  const next = clone(document) as unknown as { pieces: Record<string, unknown>[] };
  const piece = next.pieces.find((entry) => entry.id === id);
  if (!piece) throw new Error(`Missing piece ${id}`);
  change(piece);
  return next as unknown as AuthoredLevelDocument;
}

function withConnection(
  document: AuthoredLevelDocument,
  from: string,
  to: string,
  change: (connection: Record<string, unknown>) => void,
): AuthoredLevelDocument {
  const next = clone(document) as unknown as { connections: Record<string, unknown>[] };
  const connection = next.connections.find(
    (entry) => entry.from === from && entry.to === to,
  );
  if (!connection) throw new Error(`Missing connection ${from}->${to}`);
  change(connection);
  return next as unknown as AuthoredLevelDocument;
}

function codes(document: unknown): string[] {
  return validateAuthoredLevelDocument(document).map((entry) => entry.code);
}

function connectionIndex(document: AuthoredLevelDocument, from: string, to: string): number {
  return document.connections.findIndex((entry) => entry.from === from && entry.to === to);
}

function topAt(piece: Record<string, unknown>, top: number): void {
  const center = piece.center as { y: number };
  const size = piece.size as { y: number };
  center.y = top - size.y / 2;
}

describe("authored-level-v4 structure", () => {
  it("accepts the demo level and maps lifts and pads into the course", () => {
    expect(validateAuthoredLevelDocument(base)).toEqual([]);
    const { course } = resolveAuthoredLevelDocument(base);
    const lift = course.platforms.find((platform) => platform.id === "sky-lift")!;
    expect(lift.motion).toEqual({ axis: "y", distance: 2, period: 8, phase: -Math.PI / 2 });
    // The course centre is the travel midpoint; t=0 is the authored bottom stop.
    expect(lift.center.y).toBeCloseTo(-0.2 + 2, 10);
    const pad = course.platforms.find((platform) => platform.id === "spring-pad")!;
    expect(pad.bounce).toEqual({ velocity: 9 });
  });

  it("rejects every v4-only field in v1–v3 documents", () => {
    const v3 = { ...clone(base), schemaVersion: "authored-level-v3" };
    expect(codes(v3).every((code) => code.startsWith("schema."))).toBe(true);
    const liftOnly = {
      ...clone(besties),
      schemaVersion: "authored-level-v3",
      id: "lift-route",
      pieces: [
        ...clone(besties).pieces,
        { type: "lift", id: "lift", center: { x: 20, y: 0, z: 0 }, size: { x: 2, y: 0.4, z: 2 }, travel: { distance: 2, period: 8 } },
      ],
    };
    expect(codes(liftOnly)).toContain("schema.invalid_union");
    const requiresOnly = {
      ...clone(besties),
      schemaVersion: "authored-level-v3",
      id: "requires-route",
      connections: [{ ...clone(besties).connections[0], requires: "high-jump" }, ...clone(besties).connections.slice(1)],
    };
    expect(codes(requiresOnly)).toContain("schema.unrecognized_keys");
    const bounceOnly = {
      ...clone(besties),
      connections: [{ ...clone(besties).connections[0], mode: "bounce" }, ...clone(besties).connections.slice(1)],
    };
    expect(codes(bounceOnly)).toContain("schema.invalid_value");
  });

  it("enforces lift and pad ranges in the schema", () => {
    expect(codes(withPiece(base, "sky-lift", (piece) => ((piece.travel as { distance: number }).distance = 9)))).toContain("schema.too_big");
    expect(codes(withPiece(base, "sky-lift", (piece) => ((piece.travel as { period: number }).period = 3)))).toContain("schema.too_small");
    expect(codes(withPiece(base, "spring-pad", (piece) => ((piece.size as { x: number }).x = 1.1)))).toContain("schema.too_small");
  });
});

describe("ability-aware connections (D-03)", () => {
  const hj = connectionIndex(base, "party-welcome", "hj-ledge");

  it("allows a high jump up to 0.70 m and rejects more", () => {
    const atLimit = withPiece(base, "hj-ledge", (piece) => topAt(piece, 0.7));
    expect(validateAuthoredLevelDocument(atLimit).filter((entry) => entry.path === `$.connections[${hj}]`)).toEqual([]);
    const beyond = withPiece(base, "hj-ledge", (piece) => topAt(piece, 0.75));
    expect(
      validateAuthoredLevelDocument(beyond).filter((entry) => entry.path === `$.connections[${hj}]`).map((entry) => entry.code),
    ).toContain("connection.rise");
  });

  it("applies each move's own gap limit", () => {
    const perch = connectionIndex(base, "dj-ledge", "golden-perch");
    const far = withPiece(base, "golden-perch", (piece) => ((piece.center as { x: number }).x = 4.5 + 2.1));
    const issues = validateAuthoredLevelDocument(far).filter((entry) => entry.path === `$.connections[${perch}]`);
    expect(issues.map((entry) => entry.message)).toContain(
      `double-jump gap 2.600m exceeds ${AUTHORED_LEVEL_V4_LIMITS.requires["double-jump"].maxGap}m across the motion envelope`,
    );
  });

  it("requires a glide to descend at least 0.8 m", () => {
    const index = connectionIndex(base, "golden-perch", "sky-balcony");
    const climbing = withConnection(base, "golden-perch", "sky-balcony", (connection) => (connection.requires = "glide"));
    expect(
      validateAuthoredLevelDocument(climbing).filter((entry) => entry.path === `$.connections[${index}]`).map((entry) => entry.code),
    ).toEqual(["connection.rise"]);
    const descending = withPiece(climbing, "golden-perch", (piece) => topAt(piece, 4.9));
    expect(validateAuthoredLevelDocument(descending).filter((entry) => entry.path === `$.connections[${index}]`)).toEqual([]);
  });

  it("allows requires only on jumps", () => {
    const walked = withConnection(base, "dj-ledge", "spring-pad", (connection) => (connection.requires = "high-jump"));
    expect(codes(walked)).toContain("requires.mode");
  });
});

describe("growth pieces (D-04)", () => {
  it("keeps bounce connections to pads", () => {
    expect(codes(withConnection(base, "spring-pad", "sky-balcony", (connection) => (connection.mode = "jump")))).toContain("bounce.source-mode");
    expect(codes(withConnection(base, "golden-perch", "sky-balcony", (connection) => {
      connection.mode = "bounce";
      delete connection.requires;
    }))).toContain("bounce.source");
    const ontoLift = clone(base) as unknown as { connections: AuthoredConnection[] };
    ontoLift.connections.push({ from: "spring-pad", to: "sky-lift", mode: "bounce" });
    expect(codes(ontoLift)).toContain("bounce.destination");
  });

  it("limits the bounce rise per pad strength", () => {
    const index = connectionIndex(base, "spring-pad", "sky-balcony");
    const tooHigh = withPiece(base, "sky-balcony", (piece) => topAt(piece, 1.8 + 2.7));
    expect(validateAuthoredLevelDocument(tooHigh).filter((entry) => entry.path === `$.connections[${index}]`).map((entry) => entry.code)).toContain("connection.rise");
    const small = withPiece(base, "spring-pad", (piece) => (piece.strength = "small"));
    expect(validateAuthoredLevelDocument(small).filter((entry) => entry.path === `$.connections[${index}]`).map((entry) => entry.message)).toContain(
      "bounce height difference 2.200m exceeds 1.3m",
    );
  });

  it("needs a pad's launch column clear and its top unambiguous", () => {
    const blocked = clone(base) as unknown as { pieces: AuthoredLevelPiece[] };
    blocked.pieces.push({ type: "platform", id: "lid", center: { x: 0, y: 3.2, z: -13.4 }, size: { x: 1, y: 0.2, z: 1 } });
    expect(codes(blocked)).toContain("bounce-pad.headroom");
    const flush = clone(base) as unknown as { pieces: AuthoredLevelPiece[] };
    flush.pieces.push({ type: "platform", id: "twin", center: { x: 0.5, y: 1.5, z: -13.4 }, size: { x: 1, y: 0.6, z: 1 } });
    expect(codes(flush)).toContain("bounce-pad.overlap");
  });

  it("requires lifts to be ridden and to have landings at both stops", () => {
    expect(codes(withConnection(base, "sky-balcony", "sky-lift", (connection) => (connection.mode = "jump")))).toContain("connection.mode");
    const noDock = clone(base) as unknown as { connections: AuthoredConnection[] };
    noDock.connections = noDock.connections.filter((entry) => !(entry.from === "sky-lift" && entry.to === "lift-dock"));
    expect(codes(noDock)).toContain("lift.bottom-landing");
    const shorter = withPiece(base, "sky-lift", (piece) => ((piece.travel as { distance: number }).distance = 3));
    expect(codes(shorter)).toContain("lift.top-landing");
  });

  it("keeps a lift's travel clear of other geometry, sweepers and the height limit", () => {
    const overFloor = withPiece(base, "sky-lift", (piece) => ((piece.center as { z: number }).z = -12));
    expect(codes(overFloor)).toContain("lift.swept-volume");
    const swept = clone(base) as unknown as { pieces: AuthoredLevelPiece[] };
    swept.pieces.push({ type: "sweeper", id: "shaft-bar", center: { x: 0, y: 2, z: -21 }, halfLength: 1, radius: 0.2 });
    expect(codes(swept)).toContain("lift.hazard");
    const tall = withPiece(base, "sky-lift", (piece) => {
      (piece.center as { y: number }).y = 25;
      (piece.travel as { distance: number }).distance = 8;
    });
    expect(codes(tall)).toContain("lift.height");
  });
});

describe("age-aware requirements", () => {
  it("rejects moves locked at the chapter's start age", () => {
    const locked = validateGrowthRequirements(base, { startAgeYears: 2 });
    expect(locked.map((entry) => [entry.path, entry.code])).toEqual(
      base.connections.flatMap((connection, index) =>
        connection.requires === "double-jump"
          ? [[`$.connections[${index}].requires`, "requires.locked"]]
          : [],
      ),
    );
    expect(validateGrowthRequirements(base, { startAgeYears: 4, previousStartAgeYears: 0 })).toEqual([]);
  });

  it("requires a practice stretch before a newly unlocked move's first required use", () => {
    const unpracticed = withConnection(base, "hj-ledge", "dj-ledge", (connection) => delete connection.safeMissPlatformId);
    const index = connectionIndex(base, "hj-ledge", "dj-ledge");
    expect(validateGrowthRequirements(unpracticed, { startAgeYears: 4, previousStartAgeYears: 2 })).toEqual([
      expect.objectContaining({
        path: `$.connections[${index}].safeMissPlatformId`,
        code: "requires.practice-missing",
      }),
    ]);
    // A move the player already had in the previous chapter needs no practice.
    expect(validateGrowthRequirements(unpracticed, { startAgeYears: 5, previousStartAgeYears: 4 })).toEqual([]);
    // Branch uses never need practice.
    expect(
      validateGrowthRequirements(base, { startAgeYears: 4, previousStartAgeYears: 0 }).some((entry) =>
        entry.path.includes(`[${connectionIndex(base, "dj-ledge", "golden-perch")}]`),
      ),
    ).toBe(false);
  });

  it("reports age issues through the world project validator", () => {
    const project = clone(demo);
    project.chapters[1].level = clone(
      withConnection(base, "hj-ledge", "dj-ledge", (connection) => delete connection.safeMissPlatformId),
    );
    const index = connectionIndex(base, "hj-ledge", "dj-ledge");
    expect(validateLevelEditorProject(project)).toEqual([
      expect.objectContaining({
        path: `$.chapters[1].level.connections[${index}].safeMissPlatformId`,
        code: "requires.practice-missing",
      }),
    ]);
  });
});

describe("editor opt-in (chapter.level.upgrade)", () => {
  it("upgrades a world chapter once without changing its validation", () => {
    const world = createWorldEditorProject({ projectId: "upgrade-check" });
    const upgraded = applyLevelEditorCommand(world, {
      type: "chapter.level.upgrade",
      chapterId: "chapter-1",
      schemaVersion: "authored-level-v4",
    });
    expect(upgraded.ok).toBe(true);
    expect(upgraded.issues).toEqual([]);
    expect(upgraded.project.chapters[0]!.level.schemaVersion).toBe("authored-level-v4");
    const again = applyLevelEditorCommand(upgraded.project, {
      type: "chapter.level.upgrade",
      chapterId: "chapter-1",
      schemaVersion: "authored-level-v4",
    });
    expect(again.ok).toBe(false);
    expect(again.issues.map((entry) => entry.code)).toEqual(["level.version"]);
  });

  it("refuses v4 content in v1 projects and v3 chapters", () => {
    const legacy = createLevelEditorProject({ projectId: "legacy-check" });
    expect(
      applyLevelEditorCommand(legacy, {
        type: "chapter.level.upgrade",
        chapterId: "chapter-1",
        schemaVersion: "authored-level-v4",
      }).ok,
    ).toBe(false);
    const world = createWorldEditorProject({ projectId: "v3-check" });
    const result = applyLevelEditorCommand(world, {
      type: "piece.add",
      chapterId: "chapter-2",
      piece: {
        type: "bounce-pad",
        id: "pad",
        center: { x: 30, y: 0, z: 0 },
        size: { x: 1.4, y: 0.2, z: 1.4 },
        strength: "small",
      },
    });
    expect(result.ok).toBe(false);
    expect(parseLevelEditorProject(result.project)).toEqual(world);
  });
});
