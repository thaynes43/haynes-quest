import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AUTHORED_LEVEL_V4_LIMITS,
  resolveAuthoredLevelDocument,
  validateAuthoredLevelDocument,
  type AuthoredDecor,
  type AuthoredLevelDocument,
  type AuthoredLevelPiece,
} from "../../src/shared/authored-level";
import {
  applyLevelEditorCommand,
  createWorldEditorProject,
} from "../../src/shared/editor-project";
import {
  decorWorldBounds,
  THEME_KIT_PROPS,
  themeKitProp,
} from "../../src/shared/theme-kits";
import {
  createObbyState,
  sampleObby,
  stepObby,
  type ObbyCourse,
} from "../../src/game/obby";

const DT = 1 / 60;
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

function codes(document: unknown): string[] {
  return validateAuthoredLevelDocument(document).map((entry) => entry.code);
}

function withDecor(...entries: AuthoredDecor[]): AuthoredLevelDocument {
  const next = clone(base) as unknown as { decor: AuthoredDecor[] };
  next.decor = [...(next.decor ?? []), ...entries];
  return next as unknown as AuthoredLevelDocument;
}

function prop(id: string, kitPropId: string, x: number, y: number, z: number, scale = 1): AuthoredDecor {
  return { id, kitPropId, position: { x, y, z }, rotationY: 0, scale };
}

describe("crumbling platforms (physics)", () => {
  const course: ObbyCourse = {
    platforms: [
      {
        id: "crumble",
        center: { x: 0, y: -0.25, z: 0 },
        size: { x: 2, y: 0.5, z: 2 },
        crumble: { shakeSeconds: 0.8, downSeconds: 3 },
      },
      { id: "floor", center: { x: 0, y: -3.5, z: 0 }, size: { x: 10, y: 1, z: 10 } },
    ],
    hazards: [],
    checkpoints: [],
  };

  function run() {
    const state = createObbyState({ x: 0, y: 0, z: 0 });
    let time = 0;
    const step = () => {
      time += DT;
      return stepObby(state, { moveX: 0, moveY: 0 }, course, {
        deltaSeconds: DT,
        timeSeconds: time,
        cameraYaw: 0,
        canJump: true,
        jumpPressed: false,
        radius: 0.25,
        height: 0.9,
      });
    };
    return { state, step, time: () => time };
  }

  it("holds for 0.8 s after the first touch, drops for 3 s, then returns", () => {
    const sim = run();
    sim.step();
    expect(sim.state.supportId).toBe("crumble");
    const touched = sim.state.crumbles!.crumble!;
    expect(touched).toBeGreaterThan(0);
    expect(touched).toBeLessThanOrEqual(DT);
    let dropAt: number | null = null;
    for (let frame = 0; frame < 120 && dropAt === null; frame += 1) {
      sim.step();
      if (sim.state.supportId !== "crumble") dropAt = sim.time();
    }
    expect(dropAt! - touched).toBeGreaterThanOrEqual(0.8 - 1e-9);
    expect(dropAt! - touched).toBeLessThan(0.8 + 2 * DT);
    // The player falls onto the floor below; the crumble is visibly falling.
    for (let frame = 0; frame < 90 && !sim.state.grounded; frame += 1) sim.step();
    expect(sim.state.supportId).toBe("floor");
    const falling = sampleObby(course, sim.time(), sim.state).platforms[0]!;
    expect(falling.crumble).toBe("down");
    expect(falling.center.y).toBeLessThan(-0.25);
    // Solid again 3 s after it dropped, and the touch record is cleared.
    while (sim.time() < touched + 0.8 + 3 - 2 * DT) sim.step();
    expect(sim.state.crumbles!.crumble).toBeDefined();
    sim.step();
    sim.step();
    sim.step();
    expect(sim.state.crumbles!.crumble).toBeUndefined();
    const back = sampleObby(course, sim.time(), sim.state).platforms[0]!;
    expect(back.crumble).toBeUndefined();
    expect(back.center).toEqual({ x: 0, y: -0.25, z: 0 });
  });

  it("shakes visibly before it drops and never moves without a state", () => {
    const sim = run();
    sim.step();
    for (let frame = 0; frame < 10; frame += 1) sim.step();
    const shaking = sampleObby(course, sim.time(), sim.state).platforms[0]!;
    expect(shaking.crumble).toBe("shaking");
    expect(sampleObby(course, sim.time()).platforms[0]).toEqual({
      id: "crumble",
      center: { x: 0, y: -0.25, z: 0 },
      size: { x: 2, y: 0.5, z: 2 },
    });
  });

  it("waits to return while the player stands inside its volume", () => {
    const state = createObbyState({ x: 0, y: -0.2, z: 0 });
    state.crumbles = { crumble: 0 };
    // Stand on a pillar that pokes up into the crumble's volume.
    const pillarCourse: ObbyCourse = {
      ...course,
      platforms: [
        ...course.platforms,
        { id: "pillar", center: { x: 0, y: -1.2, z: 0 }, size: { x: 0.8, y: 2, z: 0.8 } },
      ],
    };
    stepObby(state, { moveX: 0, moveY: 0 }, pillarCourse, {
      deltaSeconds: DT,
      timeSeconds: 10,
      cameraYaw: 0,
      canJump: true,
      jumpPressed: false,
      radius: 0.25,
      height: 0.9,
    });
    expect(state.supportId).toBe("pillar");
    expect(state.crumbles.crumble).toBe(0);
  });

  it("never writes crumble state on a course without crumbling platforms", () => {
    const state = createObbyState({ x: 0, y: 0, z: 0 });
    stepObby(state, { moveX: 0, moveY: 0 }, { ...course, platforms: [course.platforms[1]!] }, {
      deltaSeconds: DT,
      timeSeconds: DT,
      cameraYaw: 0,
      canJump: true,
      jumpPressed: false,
      radius: 0.25,
      height: 0.9,
    });
    expect("crumbles" in state).toBe(false);
  });
});

describe("crumbling platforms (validator)", () => {
  it("maps into the course with the design timing", () => {
    const { course } = resolveAuthoredLevelDocument(base);
    expect(course.platforms.find((platform) => platform.id === "crumble-a")?.crumble).toEqual({
      shakeSeconds: AUTHORED_LEVEL_V4_LIMITS.crumbleShakeSeconds,
      downSeconds: AUTHORED_LEVEL_V4_LIMITS.crumbleDownSeconds,
    });
  });

  it("keeps crumbling platforms off the main path", () => {
    const next = clone(base) as unknown as { mainPath: string[]; branches: string[][]; connections: unknown[] };
    const dock = next.mainPath.indexOf("lift-dock");
    next.mainPath.splice(dock + 1, 0, "crumble-a", "crumble-b");
    next.branches = next.branches.filter((branch) => !branch.includes("crumble-a"));
    expect(codes(next)).toContain("crumble.main-path");
  });

  it("keeps crumbling platforms from under objectives, fights and checkpoints", () => {
    const next = clone(base) as unknown as { pieces: AuthoredLevelPiece[] };
    next.pieces = next.pieces.map((piece) =>
      piece.id === "crumble-b" && piece.type === "crumble"
        ? { ...piece, center: { ...piece.center, z: -31.6 } }
        : piece,
    ) as AuthoredLevelPiece[];
    expect(codes(next)).toContain("crumble.objective");
  });
});

describe("decor (validator)", () => {
  it("accepts the demo's props beside the route", () => {
    expect(base.decor?.length).toBeGreaterThan(0);
    expect(validateAuthoredLevelDocument(base)).toEqual([]);
  });

  it("rejects unknown props, other themes' props and duplicate ids", () => {
    expect(codes(withDecor(prop("mystery", "no-such-prop", -9, 0, 0)))).toContain("decor.kit-prop");
    expect(codes(withDecor(prop("cabinet", "casino-slot-cabinet", -9, 0, 0)))).toContain("decor.theme");
    expect(codes(withDecor(prop("welcome-arch", "party-gift-stack", -9, 0, 0)))).toContain("decor.duplicate-id");
  });

  it("keeps props out of walkable volumes, connection strips and fight areas", () => {
    // On the spawn deck.
    expect(codes(withDecor(prop("deck-gift", "party-gift-stack", 0, 0, 2)))).toContain("decor.clearance");
    // In the gap between the high-jump ledge and the double-jump ledge, below both tops.
    expect(codes(withDecor(prop("gap-post", "party-balloon-post", 0, 0.7, -8.6, 0.25)))).toContain("decor.clearance");
    // Hovering in the picnic fight area just above head height.
    expect(codes(withDecor(prop("fight-arch", "party-arch", 0, 2.5, -35.8)))).toContain("decor.clearance");
  });

  it("allows overhead trim at least 3 m above the highest standing height and props below a surface", () => {
    const overhead = prop("overhead", "party-arch", 0, 3.01, -35.8);
    expect(codes(withDecor(overhead))).not.toContain("decor.clearance");
    const tooLow = prop("too-low", "party-arch", 0, 2.9, -35.8);
    expect(codes(withDecor(tooLow))).toContain("decor.clearance");
    // Under the sky balcony (top 4, bottom 3.4), entirely below its floor.
    const under = prop("under", "party-gift-stack", 4.5, 1.9, -18.8);
    expect(codes(withDecor(under))).not.toContain("decor.clearance");
  });

  it("enforces the 200-prop limit and the 0.25–4 scale range in the schema", () => {
    const many = Array.from({ length: 201 }, (_, index) =>
      prop(`far-${index}`, "party-gift-stack", -40 - (index % 20) * 2, 0, -index),
    );
    expect(codes(withDecor(...many))).toContain("schema.too_big");
    expect(codes(withDecor(prop("tiny", "party-gift-stack", -9, 0, 0, 0.2)))).toContain("schema.too_small");
    expect(codes(withDecor(prop("huge", "party-gift-stack", -9, 0, 0, 4.1)))).toContain("schema.too_big");
  });

  it("rejects decor in a v3 document", () => {
    const v3 = { ...clone(base), schemaVersion: "authored-level-v3" };
    expect(codes(v3)).toContain("schema.invalid_union");
  });

  it("computes rotated world bounds", () => {
    const cabinet = themeKitProp("casino-slot-cabinet")!;
    const turned = decorWorldBounds(cabinet.bounds, {
      position: { x: 10, y: 1, z: -5 },
      rotationY: Math.PI / 2,
      scale: 2,
    });
    expect(turned.min.x).toBeCloseTo(10 - 0.551 * 2, 6);
    expect(turned.max.z).toBeCloseTo(-5 + 0.517 * 2, 6);
    expect(turned.min.y).toBe(1);
    expect(turned.max.y).toBeCloseTo(1 + 2.134 * 2, 6);
  });
});

describe("decor commands", () => {
  const entry = prop("side-gift", "party-gift-stack", -9, 0, -20);

  it("adds and removes props on a v4 chapter", () => {
    const world = createWorldEditorProject({ projectId: "decor-commands" });
    const upgraded = applyLevelEditorCommand(world, {
      type: "chapter.level.upgrade",
      chapterId: "chapter-2",
      schemaVersion: "authored-level-v4",
    }).project;
    const added = applyLevelEditorCommand(upgraded, { type: "decor.add", chapterId: "chapter-2", decor: entry });
    expect(added.ok).toBe(true);
    expect(added.issues).toEqual([]);
    expect(added.project.chapters[1]!.level.decor).toEqual([entry]);
    const again = applyLevelEditorCommand(added.project, { type: "decor.add", chapterId: "chapter-2", decor: entry });
    expect(again.issues.map((issue) => issue.code)).toEqual(["decor.duplicate"]);
    const removed = applyLevelEditorCommand(added.project, {
      type: "decor.remove",
      chapterId: "chapter-2",
      decorId: "side-gift",
    });
    expect(removed.ok).toBe(true);
    expect(removed.project.chapters[1]!.level.decor).toBeUndefined();
    const missing = applyLevelEditorCommand(removed.project, {
      type: "decor.remove",
      chapterId: "chapter-2",
      decorId: "side-gift",
    });
    expect(missing.issues.map((issue) => issue.code)).toEqual(["decor.missing"]);
  });

  it("asks for the upgrade on a v3 chapter", () => {
    const world = createWorldEditorProject({ projectId: "decor-v3" });
    const result = applyLevelEditorCommand(world, { type: "decor.add", chapterId: "chapter-2", decor: entry });
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(["level.version"]);
  });
});

const inventoryChecksums = new Map<string, string>(
  (
    JSON.parse(
      readFileSync(new URL("../../scripts/assets/catalog-inventory.json", import.meta.url), "utf8"),
    ) as { assets: Array<{ checksums?: Record<string, string> }> }
  ).assets.flatMap((asset) => Object.entries(asset.checksums ?? {})),
);

describe("theme-kit prop catalog", () => {
  it("has unique ids, sane bounds and checksums that match the published models", () => {
    const ids = THEME_KIT_PROPS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of THEME_KIT_PROPS) {
      expect(entry.bounds.max.x).toBeGreaterThan(entry.bounds.min.x);
      expect(entry.bounds.max.y).toBeGreaterThan(entry.bounds.min.y);
      expect(entry.bounds.max.z).toBeGreaterThan(entry.bounds.min.z);
      if (!entry.glb) continue;
      expect(entry.glb.url).toMatch(/^\/studio\/assets\/media\/[a-z0-9-]+\/v\d{3}\/[a-z0-9-]+\.glb$/);
      const file = new URL(`../../docs${entry.glb.url.replace("/studio", "")}`, import.meta.url);
      // The exact published bytes hash to the registered SHA-256.
      expect(createHash("sha256").update(readFileSync(file)).digest("hex")).toBe(entry.glb.sha256);
      // Kits that ship a checksum manifest list it there; older single-model
      // assets (the shared clearing props) record it in the catalog inventory.
      const manifest = new URL("checksums.sha256", file);
      const name = entry.glb.url.split("/").at(-1)!;
      if (existsSync(manifest))
        expect(readFileSync(manifest, "utf8")).toContain(`${entry.glb.sha256}  ${name}`);
      else
        expect(inventoryChecksums.get(`docs${entry.glb.url.replace("/studio", "")}`)).toBe(
          entry.glb.sha256,
        );
    }
  });

  it("offers every world theme at least two props", () => {
    for (const theme of ["garden", "party", "arcade", "toybox", "casino"] as const)
      expect(THEME_KIT_PROPS.filter((entry) => entry.theme === theme).length).toBeGreaterThanOrEqual(2);
  });
});
