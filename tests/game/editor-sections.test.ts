import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  AUTHORED_LEVEL_LIMITS,
  type AuthoredLevelDocument,
  type AuthoredPlatformPiece,
} from "../../src/shared/authored-level";
import {
  applyLevelEditorCommand,
  applyLevelEditorCommands,
  canonicalLevelEditorProjectJson,
  createLevelEditorProject,
  levelEditorCommandBatchSchema,
  parseLevelEditorProject,
  validateLevelEditorProject,
  type LevelEditorChapterId,
  type LevelEditorCommand,
  type LevelEditorCommandResult,
  type LevelEditorProject,
} from "../../src/shared/editor-project";
import {
  LEVEL_EDITOR_SECTION_LIMITS,
  planLevelEditorSection,
} from "../../src/shared/editor-sections";
import bestiesPlayground from "../../src/shared/levels/besties-playground-v2.json";
import gardenPlayground from "../../src/shared/levels/garden-playground-v2.json";
import {
  chapterLevel,
  platformTop,
  raisedGardenPicnicProject,
  rotatePoint,
  rotatedGardenProject,
  sectionSteps,
} from "./editor-section-fixtures";

const CHAPTERS = [
  {
    chapterId: "chapter-1",
    routeId: "garden-playground-v2",
    from: "welcome",
    to: "picnic",
  },
  {
    chapterId: "chapter-2",
    routeId: "besties-playground-v2",
    from: "party-welcome",
    to: "party-picnic",
  },
] as const;

function project(): LevelEditorProject {
  return createLevelEditorProject({
    projectId: "section-test",
    name: "Section test",
  });
}

function section(
  chapterId: LevelEditorChapterId,
  fromPlatformId: string,
  toPlatformId: string,
  overrides: Partial<Omit<Extract<LevelEditorCommand, { type: "section.add" }>, "type">> = {},
): LevelEditorCommand {
  return {
    type: "section.add",
    chapterId,
    idPrefix: "climb",
    fromPlatformId,
    toPlatformId,
    pattern: "arch",
    side: "right",
    ...overrides,
  };
}

function applied(result: LevelEditorCommandResult): LevelEditorProject {
  expect(result.ok, JSON.stringify(result.issues, null, 2)).toBe(true);
  expect(result.issues).toEqual([]);
  return result.project;
}

function rejection(
  before: LevelEditorProject,
  result: LevelEditorCommandResult,
): ReadonlyArray<{ code: string; path: string; message: string }> {
  expect(result.ok).toBe(false);
  // Atomic: a refused section leaves the project and its revision alone.
  expect(result.project).toEqual(before);
  expect(result.project.revision).toBe(before.revision);
  for (const entry of result.issues) {
    expect(entry.source).toBe("command");
    expect(entry.commandIndex).toBe(0);
    expect(entry.message.length).toBeGreaterThan(0);
  }
  return result.issues;
}

function codes(
  issues: ReadonlyArray<{ code: string }>,
): readonly string[] {
  return issues.map((entry) => entry.code);
}

function checkpointFor(
  level: AuthoredLevelDocument,
  platformId: string,
): { id: string; platformId: string; activation: { type: string } } | undefined {
  return level.pieces.find(
    (piece): piece is Extract<typeof piece, { type: "checkpoint" }> =>
      piece.type === "checkpoint" && piece.platformId === platformId,
  );
}

function outgoing(level: AuthoredLevelDocument, from: string): string[] {
  return level.connections
    .filter((connection) => connection.from === from)
    .map((connection) => connection.to);
}

describe("shared vertical section command", () => {
  for (const chapter of CHAPTERS) {
    it(`${chapter.chapterId} builds a climbing arch from ${chapter.from} to ${chapter.to}`, () => {
      const before = project();
      const beforeLevel = chapterLevel(before, chapter.chapterId);
      const result = applyLevelEditorCommand(
        before,
        section(chapter.chapterId, chapter.from, chapter.to, {
          idPrefix: "sunny-climb",
        }),
      );
      const after = applied(result);
      expect(after.revision).toBe(before.revision + 1);
      expect(validateLevelEditorProject(after)).toEqual([]);

      const level = chapterLevel(after, chapter.chapterId);
      const steps = sectionSteps(level, "sunny-climb");
      const { defaultSteps, defaultRise } = LEVEL_EDITOR_SECTION_LIMITS;
      expect(steps.map((step) => step.id)).toEqual(
        Array.from(
          { length: defaultSteps * 2 - 1 },
          (_, index) => `sunny-climb-step-${index + 1}`,
        ),
      );

      // The first created piece is the one the rail selects.
      expect(level.pieces[beforeLevel.pieces.length]!.id).toBe(
        "sunny-climb-step-1",
      );

      // Rise and descent, with the crest exactly the requested climb above the
      // start platform and the rejoin height met from above.
      const startTop = platformTop(
        beforeLevel.pieces.find(
          (piece): piece is AuthoredPlatformPiece =>
            piece.type === "platform" && piece.id === chapter.from,
        )!,
      );
      const rejoinTop = platformTop(
        beforeLevel.pieces.find(
          (piece): piece is AuthoredPlatformPiece =>
            piece.type === "platform" && piece.id === chapter.to,
        )!,
      );
      const tops = steps.map(platformTop);
      const crest = Math.max(...tops);
      expect(crest).toBeCloseTo(startTop + defaultSteps * defaultRise, 6);
      expect(tops.indexOf(crest)).toBe(defaultSteps - 1);
      expect(tops.slice(0, defaultSteps)).toEqual(
        [...tops.slice(0, defaultSteps)].sort((left, right) => left - right),
      );
      expect(tops.slice(defaultSteps - 1)).toEqual(
        [...tops.slice(defaultSteps - 1)].sort((left, right) => right - left),
      );
      expect(tops.at(-1)! - rejoinTop).toBeGreaterThan(0);
      expect(tops.at(-1)! - rejoinTop).toBeLessThanOrEqual(
        AUTHORED_LEVEL_LIMITS.maxConnectionRise,
      );

      // One platform checkpoint per step, and a forward chain that starts and
      // rejoins on the main route.
      for (const step of steps) {
        const checkpoint = checkpointFor(level, step.id);
        expect(checkpoint?.id).toBe(
          `sunny-climb-checkpoint-${steps.indexOf(step) + 1}`,
        );
        expect(checkpoint?.activation).toEqual({ type: "platform" });
      }
      const route = [chapter.from, ...steps.map((step) => step.id), chapter.to];
      for (const [index, source] of route.slice(0, -1).entries())
        expect(outgoing(level, source)).toContain(route[index + 1]);
      expect(level.branches.at(-1)).toEqual(route);
      expect(level.branches).toHaveLength(beforeLevel.branches.length + 1);

      // Nothing that already existed moved.
      expect(level.pieces.slice(0, beforeLevel.pieces.length)).toEqual(
        beforeLevel.pieces,
      );
      expect(
        level.connections.slice(0, beforeLevel.connections.length),
      ).toEqual(beforeLevel.connections);
      expect(level.mainPath).toEqual(beforeLevel.mainPath);
      expect(level.anchors).toEqual(beforeLevel.anchors);
    });
  }

  it("leaves the source project, the other chapter and the published documents untouched", () => {
    const published = {
      garden: JSON.stringify(gardenPlayground),
      besties: JSON.stringify(bestiesPlayground),
    };
    const before = project();
    const snapshot = JSON.parse(JSON.stringify(before)) as LevelEditorProject;
    const after = applied(
      applyLevelEditorCommand(before, section("chapter-1", "welcome", "picnic")),
    );

    expect(before).toEqual(snapshot);
    expect(chapterLevel(after, "chapter-2")).toEqual(
      chapterLevel(before, "chapter-2"),
    );
    expect(JSON.stringify(gardenPlayground)).toBe(published.garden);
    expect(JSON.stringify(bestiesPlayground)).toBe(published.besties);
  });

  it("weaves a zigzag ridge to one side without changing the climb", () => {
    const base = project();
    const arch = chapterLevel(
      applied(
        applyLevelEditorCommand(base, section("chapter-1", "welcome", "picnic")),
      ),
      "chapter-1",
    );
    const zigzag = chapterLevel(
      applied(
        applyLevelEditorCommand(
          base,
          section("chapter-1", "welcome", "picnic", { pattern: "zigzag" }),
        ),
      ),
      "chapter-1",
    );

    const archSteps = sectionSteps(arch, "climb");
    const zigzagSteps = sectionSteps(zigzag, "climb");
    expect(zigzagSteps.map((step) => step.id)).toEqual(
      archSteps.map((step) => step.id),
    );
    expect(zigzagSteps.map(platformTop)).toEqual(archSteps.map(platformTop));
    expect(zigzagSteps.map((step) => step.center.z)).toEqual(
      archSteps.map((step) => step.center.z),
    );

    // Both ends stay on the arch's lane so the hops on and off are unchanged;
    // the interior alternates further out.
    const offsets = zigzagSteps.map(
      (step, index) => step.center.x - archSteps[index]!.center.x,
    );
    expect(offsets.at(0)).toBe(0);
    expect(offsets.at(-1)).toBe(0);
    expect(offsets.filter((offset) => offset > 0)).toHaveLength(
      Math.floor((zigzagSteps.length - 1) / 2),
    );
    for (const offset of offsets)
      expect(Math.abs(offset)).toBeLessThanOrEqual(
        LEVEL_EDITOR_SECTION_LIMITS.zigzagOffset + 1e-9,
      );
  });

  it("puts left and right on opposite sides of the forward direction", () => {
    const base = project();
    const sides = (["left", "right"] as const).map((side) =>
      sectionSteps(
        chapterLevel(
          applied(
            applyLevelEditorCommand(
              base,
              section("chapter-1", "welcome", "picnic", { side }),
            ),
          ),
          "chapter-1",
        ),
        "climb",
      ),
    );
    const [left, right] = sides;
    expect(left!.map((step) => step.center.z)).toEqual(
      right!.map((step) => step.center.z),
    );
    // The course runs towards -z, so the player's right hand is +x.
    for (const step of left!) expect(step.center.x).toBeLessThan(0);
    for (const step of right!) expect(step.center.x).toBeGreaterThan(0);
  });

  it("follows the dominant axis on a rotated and translated course", () => {
    const upright = project();
    const rotated = rotatedGardenProject();
    expect(validateLevelEditorProject(rotated)).toEqual([]);

    for (const side of ["left", "right"] as const) {
      const command = section("chapter-1", "welcome", "picnic", { side });
      const uprightSteps = sectionSteps(
        chapterLevel(applied(applyLevelEditorCommand(upright, command)), "chapter-1"),
        "climb",
      );
      const rotatedSteps = sectionSteps(
        chapterLevel(applied(applyLevelEditorCommand(rotated, command)), "chapter-1"),
        "climb",
      );
      expect(rotatedSteps).toHaveLength(uprightSteps.length);
      rotatedSteps.forEach((step, index) => {
        const expected = rotatePoint(uprightSteps[index]!.center);
        expect(step.center.x).toBeCloseTo(expected.x, 6);
        expect(step.center.y).toBeCloseTo(expected.y, 6);
        expect(step.center.z).toBeCloseTo(expected.z, 6);
        // The footprint turns with the course: depth follows travel.
        expect(step.size.x).toBeCloseTo(uprightSteps[index]!.size.z, 6);
        expect(step.size.z).toBeCloseTo(uprightSteps[index]!.size.x, 6);
      });
    }
  });

  it("accommodates rejoin platforms above and below the start", () => {
    const base = project();
    for (const [from, to] of [
      ["woodland-rest", "memory-grove"],
      ["memory-grove", "pond-dock"],
    ] as const) {
      const level = chapterLevel(
        applied(
          applyLevelEditorCommand(
            base,
            section("chapter-1", from, to, { side: "left", steps: 4 }),
          ),
        ),
        "chapter-1",
      );
      const platforms = new Map(
        level.pieces
          .filter(
            (piece): piece is AuthoredPlatformPiece => piece.type === "platform",
          )
          .map((piece) => [piece.id, piece]),
      );
      const route = [from, ...sectionSteps(level, "climb").map((step) => step.id), to];
      route.slice(0, -1).forEach((source, index) => {
        const rise =
          platformTop(platforms.get(route[index + 1]!)!) -
          platformTop(platforms.get(source)!);
        expect(Math.abs(rise)).toBeLessThanOrEqual(
          AUTHORED_LEVEL_LIMITS.maxConnectionRise + 1e-9,
        );
        expect(Math.abs(rise)).toBeGreaterThan(0);
      });
    }
  });

  it("adds descent landings when an uneven long span would make them too deep", () => {
    const base = raisedGardenPicnicProject();
    const level = chapterLevel(base, "chapter-1");
    const planned = planLevelEditorSection(level, {
      idPrefix: "uneven-climb",
      fromPlatformId: "welcome",
      toPlatformId: "picnic",
      pattern: "arch",
      side: "left",
      steps: 4,
      rise: 0.3,
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;

    expect(planned.plan.stepIds).toHaveLength(7);
    expect(planned.plan.measurements.descentSteps).toBe(3);
    expect(planned.plan.measurements.descentRise).toBeCloseTo(0.225, 6);
    expect(planned.plan.measurements.stepDepth).toBeLessThanOrEqual(
      LEVEL_EDITOR_SECTION_LIMITS.maxStepDepth,
    );

    const result = applyLevelEditorCommand(
      base,
      section("chapter-1", "welcome", "picnic", {
        idPrefix: "uneven-climb",
        side: "left",
        steps: 4,
        rise: 0.3,
      }),
    );
    const after = applied(result);
    expect(validateLevelEditorProject(after)).toEqual([]);
    expect(
      sectionSteps(chapterLevel(after, "chapter-1"), "uneven-climb"),
    ).toHaveLength(7);
  });

  it("reports the derived profile so a caller can describe the section", () => {
    const level = chapterLevel(project(), "chapter-1");
    const planned = planLevelEditorSection(level, {
      idPrefix: "climb",
      fromPlatformId: "memory-grove",
      toPlatformId: "pond-dock",
      pattern: "arch",
      side: "right",
      steps: 4,
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const { measurements, stepIds, branch, connections } = planned.plan;
    expect(measurements.travelAxis).toBe("z");
    expect(measurements.startTop).toBe(0.3);
    expect(measurements.rejoinTop).toBe(0);
    expect(measurements.apexTop).toBeCloseTo(1.5, 6);
    expect(measurements.descentRise).toBeLessThanOrEqual(measurements.rise);
    // A crest 1.5m above the rejoin deck needs five descending hops at 0.3m.
    expect(measurements.descentSteps).toBe(4);
    expect(stepIds).toHaveLength(measurements.steps + measurements.descentSteps);
    expect(branch).toHaveLength(stepIds.length + 2);
    expect(connections).toHaveLength(stepIds.length + 1);
  });

  it("supports the smallest and largest step counts", () => {
    const base = project();
    const smallest = chapterLevel(
      applied(
        applyLevelEditorCommand(
          base,
          section("chapter-1", "dragon-clearing", "garden-reward", {
            steps: LEVEL_EDITOR_SECTION_LIMITS.minSteps,
          }),
        ),
      ),
      "chapter-1",
    );
    expect(sectionSteps(smallest, "climb")).toHaveLength(
      LEVEL_EDITOR_SECTION_LIMITS.minSteps * 2 - 1,
    );

    const largest = chapterLevel(
      applied(
        applyLevelEditorCommand(
          base,
          section("chapter-1", "welcome", "woodland-rest", {
            steps: LEVEL_EDITOR_SECTION_LIMITS.maxSteps,
            side: "left",
          }),
        ),
      ),
      "chapter-1",
    );
    expect(sectionSteps(largest, "climb")).toHaveLength(
      LEVEL_EDITOR_SECTION_LIMITS.maxSteps * 2 - 1,
    );
    expect(
      Math.max(...sectionSteps(largest, "climb").map(platformTop)),
    ).toBeGreaterThanOrEqual(3);
  });

  it("refuses malformed requests before touching the draft", () => {
    const base = project();
    const cases: ReadonlyArray<readonly [string, LevelEditorCommand]> = [
      ["too few steps", section("chapter-1", "welcome", "picnic", { steps: 1 })],
      [
        "too many steps",
        section("chapter-1", "welcome", "picnic", {
          steps: LEVEL_EDITOR_SECTION_LIMITS.maxSteps + 1,
        }),
      ],
      [
        "fractional steps",
        section("chapter-1", "welcome", "picnic", { steps: 3.5 }),
      ],
      ["flat rise", section("chapter-1", "welcome", "picnic", { rise: 0.05 })],
      ["steep rise", section("chapter-1", "welcome", "picnic", { rise: 0.4 })],
      [
        "upper case prefix",
        section("chapter-1", "welcome", "picnic", { idPrefix: "Climb" }),
      ],
      [
        "unknown shape",
        section("chapter-1", "welcome", "picnic", {
          pattern: "spiral" as "arch",
        }),
      ],
    ];
    for (const [label, command] of cases) {
      const issues = rejection(base, applyLevelEditorCommand(base, command));
      expect(issues.length, label).toBeGreaterThan(0);
      for (const entry of issues) expect(entry.code, label).toMatch(/^zod\./);
    }
  });

  it("refuses endpoints that cannot carry a side route", () => {
    const base = project();
    const cases: ReadonlyArray<readonly [string, LevelEditorCommand]> = [
      [
        "section.endpoint-missing",
        section("chapter-1", "welcome", "no-such-deck"),
      ],
      [
        "section.endpoint-static",
        section("chapter-1", "pond-dock", "garden-ferry"),
      ],
      [
        "section.endpoint-route",
        section("chapter-1", "woodland-side-1", "memory-grove"),
      ],
      ["section.endpoint-order", section("chapter-1", "picnic", "welcome")],
      ["section.endpoint-distinct", section("chapter-1", "picnic", "picnic")],
    ];
    for (const [code, command] of cases)
      expect(codes(rejection(base, applyLevelEditorCommand(base, command)))).toEqual([
        code,
      ]);
  });

  it("refuses spans that cannot hold the requested landings", () => {
    const base = project();
    const tooShort = rejection(
      base,
      applyLevelEditorCommand(
        base,
        section("chapter-1", "garden-hop-1", "garden-hop-2", { steps: 6 }),
      ),
    );
    expect(codes(tooShort)).toEqual(["section.span"]);
    expect(tooShort[0]!.message).toContain("4.2m apart");

    const tooLong = rejection(
      base,
      applyLevelEditorCommand(
        base,
        section("chapter-1", "welcome", "picnic", { steps: 2 }),
      ),
    );
    expect(codes(tooLong)).toEqual(["section.span"]);
    expect(tooLong[0]!.message).toContain("deep landings");
  });

  it("bends around local blockers without moving safe endpoint hops", () => {
    const base = project();
    for (const side of ["left", "right"] as const) {
      const built = applied(
        applyLevelEditorCommand(
          base,
          section("chapter-2", "party-welcome", "ribbon-rest", {
            idPrefix: `ribbon-${side}`,
            side,
            steps: 6,
          }),
        ),
      );
      expect(validateLevelEditorProject(built)).toEqual([]);
      const steps = sectionSteps(
        chapterLevel(built, "chapter-2"),
        `ribbon-${side}`,
      );
      expect(steps).toHaveLength(11);
      expect(Math.abs(steps[0]!.center.x)).toBeLessThanOrEqual(7.5);
      expect(Math.abs(steps.at(-1)!.center.x)).toBeLessThanOrEqual(9.8);
    }

    const safeSide = applied(
      applyLevelEditorCommand(
        base,
        section("chapter-1", "welcome", "woodland-rest", {
          side: "left",
          steps: 6,
        }),
      ),
    );
    expect(validateLevelEditorProject(safeSide)).toEqual([]);

    const issues = rejection(
      base,
      applyLevelEditorCommand(
        base,
        section("chapter-1", "welcome", "woodland-rest", { steps: 6 }),
      ),
    );
    expect(codes(issues)).toEqual(["section.lane"]);
    expect(issues[0]!.message).toContain("woodland-side-1");
  });

  it("refuses a second section that would reuse its identifiers", () => {
    const base = project();
    const once = applied(
      applyLevelEditorCommand(base, section("chapter-1", "welcome", "picnic")),
    );
    const issues = rejection(
      once,
      applyLevelEditorCommand(
        once,
        section("chapter-1", "dragon-clearing", "garden-reward"),
      ),
    );
    expect(codes(issues)).toEqual(["section.id-conflict"]);
    expect(issues[0]!.message).toContain("climb-step-1");
  });

  it("refuses a section that would reach into a fight area", () => {
    const widened = applied(
      applyLevelEditorCommand(project(), {
        type: "encounter.arena.set",
        chapterId: "chapter-2",
        slot: "ordinary-2",
        arena: { minX: -7.7, maxX: 1.7, minZ: -55.3, maxZ: -51.3 },
      }),
    );
    const issues = rejection(
      widened,
      applyLevelEditorCommand(
        widened,
        section("chapter-2", "ribbon-rest", "party-dock", {
          side: "left",
          steps: 3,
        }),
      ),
    );
    expect(codes(issues)).toContain("section.encounter");
    expect(issues[0]!.message).toContain("ribbon-rest");
  });

  it("refuses a section the published validator would call unsafe", () => {
    const base = project();
    const issues = rejection(
      base,
      applyLevelEditorCommand(
        base,
        section("chapter-1", "picnic", "winding-east", { steps: 3 }),
      ),
    );
    expect(codes(issues)).toEqual(["section.unsafe"]);
    expect(issues[0]!.message).toContain("connection.gateway-clearance");
  });

  it("keeps a draft's existing problems and still builds a valid section", () => {
    const base = project();
    const broken = applyLevelEditorCommand(base, {
      type: "connection.remove",
      chapterId: "chapter-2",
      match: { from: "party-welcome", to: "party-terrace-1", mode: "jump" },
    });
    expect(broken.ok).toBe(true);
    const existing = validateLevelEditorProject(broken.project);
    expect(codes(existing)).toContain("graph.missing-connection");

    const result = applyLevelEditorCommand(
      broken.project,
      section("chapter-2", "party-welcome", "party-picnic"),
    );
    expect(result.ok, JSON.stringify(result.issues, null, 2)).toBe(true);
    expect(result.issues).toEqual(existing);
    expect(sectionSteps(chapterLevel(result.project, "chapter-2"), "climb")).toHaveLength(
      7,
    );
  });

  it("rolls a whole batch back when its section is refused", () => {
    const base = project();
    const result = applyLevelEditorCommands(base, {
      expectedRevision: base.revision,
      commands: [
        { type: "project.rename", name: "Must roll back" },
        section("chapter-1", "welcome", "picnic", { steps: 2 }),
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.project).toEqual(base);
    expect(result.project.name).toBe("Section test");
    expect(result.issues.map((entry) => entry.commandIndex)).toEqual([1]);
  });

  it("honours the revision guard", () => {
    const base = project();
    const result = applyLevelEditorCommands(base, {
      expectedRevision: base.revision + 1,
      commands: [section("chapter-1", "welcome", "picnic")],
    });
    expect(result.ok).toBe(false);
    expect(codes(result.issues)).toEqual(["revision.conflict"]);
    expect(result.project).toEqual(base);
  });

  it("refuses to spend more platforms than the chapter budget allows", () => {
    const base = project();
    const raw = JSON.parse(JSON.stringify(base)) as {
      chapters: Array<{ level: { pieces: Array<Record<string, unknown>> } }>;
    };
    const pieces = raw.chapters[0]!.level.pieces;
    const used = pieces.filter(
      (piece) => piece.type === "platform" || piece.type === "moving-platform",
    ).length;
    for (let index = 0; index < AUTHORED_LEVEL_LIMITS.maxPlatforms - used; index += 1)
      pieces.push({
        type: "platform",
        id: `filler-${index + 1}`,
        center: { x: 40 + (index % 8) * 2, y: -0.3, z: -index * 1.5 },
        size: { x: 1, y: 0.6, z: 1 },
      });
    const full = parseLevelEditorProject(raw);
    const issues = rejection(
      full,
      applyLevelEditorCommand(full, section("chapter-1", "welcome", "picnic")),
    );
    expect(codes(issues)).toContain("section.budget");
    expect(issues[0]!.message).toContain(
      `over the ${AUTHORED_LEVEL_LIMITS.maxPlatforms} limit`,
    );
  });

  it("is deterministic and repeatable with a fresh prefix", () => {
    const first = applied(
      applyLevelEditorCommand(project(), section("chapter-1", "welcome", "picnic")),
    );
    const second = applied(
      applyLevelEditorCommand(project(), section("chapter-1", "welcome", "picnic")),
    );
    expect(canonicalLevelEditorProjectJson(second)).toBe(
      canonicalLevelEditorProjectJson(first),
    );

    const twice = applied(
      applyLevelEditorCommand(
        first,
        section("chapter-1", "dragon-clearing", "garden-reward", {
          idPrefix: "reward-climb",
          side: "left",
        }),
      ),
    );
    expect(sectionSteps(chapterLevel(twice, "chapter-1"), "climb").length).toBe(7);
    expect(
      sectionSteps(chapterLevel(twice, "chapter-1"), "reward-climb").length,
    ).toBeGreaterThan(0);
    expect(validateLevelEditorProject(twice)).toEqual([]);
  });

  it("publishes the section in the shared command schema", () => {
    const schema = JSON.stringify(z.toJSONSchema(levelEditorCommandBatchSchema));
    for (const field of [
      "section.add",
      "idPrefix",
      "fromPlatformId",
      "toPlatformId",
      "pattern",
      "zigzag",
    ])
      expect(schema).toContain(field);
  });
});
