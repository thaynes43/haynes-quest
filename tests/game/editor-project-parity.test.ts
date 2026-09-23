/**
 * Parity between a published chapter and the same chapter after a full trip
 * through the level editor's project envelope (PRD002 R-01/R-02/R-07).
 *
 * `editor-project.test.ts` owns the structural contract. This suite asks the
 * harder question: does an exported-and-reimported project still *play* the
 * same? It resolves the reimported project and hands the result to the same
 * auto-pilot helpers that guard the shipped routes, so the real `stepObby`
 * collision, checkpoint arming and fall recovery decide the answer.
 *
 * It also covers two paths no published document exercises: `pieces[]` order
 * as a load-bearing input to fall recovery, and the `radius` / `box` checkpoint
 * activations that `courseFor` implements but no shipped level uses.
 */
import { describe, expect, it } from "vitest";

import {
  canonicalLevelEditorProjectJson,
  createLevelEditorProject,
  LEVEL_EDITOR_TEMPLATE_ROUTE_IDS,
  parseLevelEditorProject,
  parseLevelEditorProjectJson,
  LevelEditorProjectValidationError,
  resolveLevelEditorProject,
  serializeLevelEditorProject,
  validateLevelEditorProject,
  type LevelEditorProjectV1,
  type LevelEditorTemplateRouteId,
} from "../../src/shared/editor-project";
import {
  resolveAuthoredLevelDocument,
  validateAuthoredLevelDocument,
  type AuthoredCheckpointActivation,
  type ResolvedAuthoredLevel,
} from "../../src/shared/authored-level";
import {
  createObbyState,
  OBBY_TUNING,
  type ObbyState,
  type ObbyStepResult,
} from "../../src/game/obby";
import {
  edgeLabel,
  loadLevel,
  runtimeStep,
  STAGES,
  traverseEdge,
  type AppearanceStage,
  type Simulation,
} from "./authored-traversal-lib";
import gardenPlayground from "../../src/shared/levels/garden-playground-v2.json";
import bestiesPlayground from "../../src/shared/levels/besties-playground-v2.json";

const PUBLISHED = {
  "garden-playground-v2": gardenPlayground,
  "besties-playground-v2": bestiesPlayground,
} as const satisfies Record<LevelEditorTemplateRouteId, unknown>;

function template(): LevelEditorProjectV1 {
  return createLevelEditorProject({ projectId: "parity-fixture" });
}

function parseLegacyProject(input: unknown): LevelEditorProjectV1 {
  const parsed = parseLevelEditorProject(input);
  if (parsed.schemaVersion !== "level-editor-project-v1")
    throw new Error("Expected a legacy editor project");
  return parsed;
}

/** The full durable handoff: export to text, reimport it, resolve it. */
function roundTrip(project: LevelEditorProjectV1): LevelEditorProjectV1 {
  return parseLevelEditorProjectJson(
    serializeLevelEditorProject(project),
  ) as LevelEditorProjectV1;
}

function resolvedRoundTrip(
  project: LevelEditorProjectV1 = template(),
): Readonly<Record<LevelEditorTemplateRouteId, ResolvedAuthoredLevel>> {
  return resolveLevelEditorProject(roundTrip(project)).levels as Readonly<
    Record<LevelEditorTemplateRouteId, ResolvedAuthoredLevel>
  >;
}

function pieceIds(level: ResolvedAuthoredLevel): string[] {
  return level.document.pieces.map((piece) => piece.id);
}

function simulationAt(
  level: ResolvedAuthoredLevel,
  stage: AppearanceStage,
  position: Readonly<{ x: number; y: number; z: number }>,
): Simulation {
  return {
    course: level.course,
    stage,
    state: createObbyState({ ...position }),
    timeSeconds: 0,
  };
}

describe("level editor project parity", () => {
  it("exports, reimports and resolves both chapters into the published course, graph and anchors", () => {
    const levels = resolvedRoundTrip();
    for (const routeId of LEVEL_EDITOR_TEMPLATE_ROUTE_IDS) {
      const published = loadLevel(routeId);
      const reimported = levels[routeId];
      // The whole resolved bundle: document, collision course, authoring graph
      // and every gameplay anchor.
      expect(reimported).toEqual(published);
      // Keep explicit assertions for the orders gameplay reads so a failure
      // identifies checkpoint or platform ordering immediately.
      expect(pieceIds(reimported)).toEqual(pieceIds(published));
      expect(reimported.course.checkpoints.map((entry) => entry.id)).toEqual(
        published.course.checkpoints.map((entry) => entry.id),
      );
      expect(reimported.course.platforms.map((entry) => entry.id)).toEqual(
        published.course.platforms.map((entry) => entry.id),
      );
    }
  });

  it("keeps the published documents immutable and the canonical export stable", () => {
    const before = {
      "garden-playground-v2": JSON.stringify(PUBLISHED["garden-playground-v2"]),
      "besties-playground-v2": JSON.stringify(
        PUBLISHED["besties-playground-v2"],
      ),
    };
    const first = template();
    const canonical = canonicalLevelEditorProjectJson(first);
    const again = roundTrip(roundTrip(first));
    expect(canonicalLevelEditorProjectJson(again)).toBe(canonical);
    expect(parseLevelEditorProject(JSON.parse(canonical))).toEqual(first);
    for (const routeId of LEVEL_EDITOR_TEMPLATE_ROUTE_IDS) {
      expect(JSON.stringify(PUBLISHED[routeId])).toBe(before[routeId]);
      // Semantic, not byte, equality: `"y": 0.0` in the shipped v2 files is
      // re-emitted as `"y": 0`, so a byte round trip is already impossible.
      expect(
        again.chapters.find((chapter) => chapter.templateRouteId === routeId)
          ?.level,
      ).toEqual(PUBLISHED[routeId]);
    }
  });

  for (const routeId of LEVEL_EDITOR_TEMPLATE_ROUTE_IDS) {
    for (const stage of STAGES) {
      it(`${routeId} still traverses every declared edge as ${stage} after export and import`, () => {
        const level = resolvedRoundTrip()[routeId];
        expect(level.graph.connections.length).toBeGreaterThan(20);
        for (const connection of level.graph.connections) {
          const result = traverseEdge(level, connection, stage);
          const label = edgeLabel(level, connection, stage, 0);
          expect(result.startedOnSource, `${label} must start supported`).toBe(
            true,
          );
          expect(result.recovered, `${label} recovered before landing`).toBe(
            false,
          );
          expect(result.reached, `${label} did not reach its target`).toBe(
            true,
          );
          expect(
            result.airborne,
            `${label} declared ${connection.mode} with unexpected airborne state`,
          ).toBe(connection.mode !== "walk");
        }
      });
    }

    it(`${routeId} arms and recovers at every checkpoint after export and import`, () => {
      const level = resolvedRoundTrip()[routeId];
      expect(level.course.checkpoints).toHaveLength(8);
      for (const checkpoint of level.course.checkpoints) {
        const simulation = simulationAt(level, "child", checkpoint.position);
        runtimeStep(simulation, { moveX: 0, moveY: 0 });
        expect(
          simulation.state.checkpointId,
          `${checkpoint.id} did not arm`,
        ).toBe(checkpoint.id);
        let recovery: ObbyStepResult | null = null;
        for (let frame = 0; frame < 360; frame += 1) {
          const result = runtimeStep(simulation, { moveX: 1, moveY: 0 });
          if (result.recovered) {
            recovery = result;
            break;
          }
        }
        expect(recovery, `${checkpoint.id} did not recover`).not.toBeNull();
        expect(simulation.state).toMatchObject({
          grounded: true,
          checkpointId: checkpoint.id,
          supportId: checkpoint.triggerPlatformId,
        });
        expect(simulation.state.position.x).toBeCloseTo(
          checkpoint.position.x,
          9,
        );
        expect(simulation.state.position.y).toBeCloseTo(
          checkpoint.position.y,
          9,
        );
        expect(simulation.state.position.z).toBeCloseTo(
          checkpoint.position.z,
          9,
        );
      }
    });
  }
});

/**
 * The Besties court guard is only useful if the editor's own validator
 * surfaces it. Prove the whole path: a narrowed court reaches
 * `validateLevelEditorProject` as a semantic issue against the right chapter,
 * and blocks preview by making `resolveLevelEditorProject` throw.
 */
describe("Besties court guard through the editor validator", () => {
  function withNarrowedCourt(sizeX: number): LevelEditorProjectV1 {
    const project = template();
    const besties = project.chapters[1].level;
    return parseLegacyProject({
      ...project,
      chapters: [
        project.chapters[0],
        {
          ...project.chapters[1],
          level: {
            ...besties,
            pieces: besties.pieces.map((piece) =>
              piece.type === "platform" && piece.id === "besties-court"
                ? { ...piece, size: { ...piece.size, x: sizeX } }
                : piece,
            ),
          },
        },
      ],
    });
  }

  it("reports the shipped project clean and a narrowed court as a chapter-2 semantic issue", () => {
    expect(validateLevelEditorProject(template())).toEqual([]);

    const narrowed = withNarrowedCourt(10);
    // The published structural validator still sees nothing wrong.
    expect(validateAuthoredLevelDocument(narrowed.chapters[1].level)).toEqual(
      [],
    );
    const issues = validateLevelEditorProject(narrowed);
    expect(issues.map((entry) => entry.code)).toEqual([
      "besties.support-footprint",
    ]);
    expect(issues[0]).toMatchObject({ source: "semantic" });
    expect(issues[0]?.path).toContain("chapters[1]");
    expect(issues[0]?.path).toContain("boss");
  });

  it("blocks preview on a narrowed court but still resolves the widened one", () => {
    expect(() => resolveLevelEditorProject(withNarrowedCourt(10))).toThrow(
      LevelEditorProjectValidationError,
    );
    expect(
      resolveLevelEditorProject(withNarrowedCourt(13.2)).levels[
        "besties-playground-v2"
      ].course.platforms.find((platform) => platform.id === "besties-court")
        ?.size.x,
    ).toBe(13.2);
  });
});

/**
 * `spawnCandidates` walks `course.checkpoints` backwards from the armed one,
 * and `courseFor` emits them in `pieces[]` order. An editor view that sorted
 * pieces would silently re-target every fall recovery, with no validation
 * error — so prove both that the order survives the round trip and that it is
 * the thing deciding where a player lands.
 */
describe("fall-recovery fallback ordering", () => {
  const UNSUPPORTED = { x: 120, y: 0, z: 120 } as const;

  function fallbackCheckpointId(
    level: ResolvedAuthoredLevel,
    armedId: string,
  ): { id: string | null; state: ObbyState } {
    // Start off the course so the player falls, with the armed checkpoint
    // pointing somewhere nothing supports.
    const simulation = simulationAt(level, "child", { x: 60, y: 0, z: -60 });
    simulation.state.checkpointId = armedId;
    simulation.state.checkpoint = { ...UNSUPPORTED };
    for (let frame = 0; frame < 360; frame += 1) {
      if (runtimeStep(simulation, { moveX: 0, moveY: 0 }).recovered) break;
    }
    return { id: simulation.state.checkpointId, state: simulation.state };
  }

  it("falls back to the previously declared checkpoint after export and import", () => {
    const level = resolvedRoundTrip()["garden-playground-v2"];
    const order = level.course.checkpoints.map((entry) => entry.id);
    expect(order).toEqual([
      "garden-start",
      "picnic-safe",
      "winding-safe",
      "woodland-safe",
      "grove-safe",
      "pond-safe",
      "dragon-safe",
      "garden-reward-safe",
    ]);
    const { id, state } = fallbackCheckpointId(level, "woodland-safe");
    expect(id).toBe("winding-safe");
    const winding = level.course.checkpoints.find(
      (entry) => entry.id === "winding-safe",
    );
    expect(state.grounded).toBe(true);
    expect(state.position.x).toBeCloseTo(winding!.position.x, 9);
    expect(state.position.z).toBeCloseTo(winding!.position.z, 9);
    expect(state.recoveryRemaining).toBeCloseTo(OBBY_TUNING.recoverySeconds, 6);
  });

  it("carries a reordered pieces array through export and import, changing where a fall lands", () => {
    const project = template();
    const garden = project.chapters[0].level;
    const checkpoints = garden.pieces.filter(
      (piece) => piece.type === "checkpoint",
    );
    const reordered = {
      ...project,
      chapters: [
        {
          ...project.chapters[0],
          level: {
            ...garden,
            pieces: [
              ...garden.pieces.filter((piece) => piece.type !== "checkpoint"),
              ...[...checkpoints].reverse(),
            ],
          },
        },
        project.chapters[1],
      ],
    };
    // Reordering pieces is structurally and semantically legal today: the
    // published validator has nothing to say about it.
    expect(validateAuthoredLevelDocument(reordered.chapters[0].level)).toEqual(
      [],
    );

    const level = resolvedRoundTrip(parseLegacyProject(reordered))[
      "garden-playground-v2"
    ];
    expect(level.course.checkpoints.map((entry) => entry.id)).toEqual([
      "garden-reward-safe",
      "dragon-safe",
      "pond-safe",
      "grove-safe",
      "woodland-safe",
      "winding-safe",
      "picnic-safe",
      "garden-start",
    ]);
    // Same geometry, same anchors, same graph — a different recovery, decided
    // purely by array order.
    expect(level.course.platforms).toEqual(
      loadLevel("garden-playground-v2").course.platforms,
    );
    expect(fallbackCheckpointId(level, "woodland-safe").id).toBe("grove-safe");
  });
});

/**
 * Every shipped checkpoint uses `platform` activation, so the `radius` and
 * `box` branches of `courseFor` and of the controller's arming rule have never
 * been exercised by real level data. The editor exposes them, so pin both the
 * projection and the actual activation distance.
 */
describe("radius and box checkpoint activation through the editor path", () => {
  function withGardenStartActivation(
    activation: AuthoredCheckpointActivation,
  ): ResolvedAuthoredLevel {
    const project = template();
    const garden = project.chapters[0].level;
    const edited = {
      ...project,
      chapters: [
        {
          ...project.chapters[0],
          level: {
            ...garden,
            pieces: garden.pieces.map((piece) =>
              piece.type === "checkpoint" && piece.id === "garden-start"
                ? { ...piece, activation }
                : piece,
            ),
          },
        },
        project.chapters[1],
      ],
    };
    expect(validateAuthoredLevelDocument(edited.chapters[0].level)).toEqual([]);
    return resolvedRoundTrip(parseLegacyProject(edited))[
      "garden-playground-v2"
    ];
  }

  function armsAt(
    level: ResolvedAuthoredLevel,
    offset: Readonly<{ x: number; z: number }>,
  ): string | null {
    const start = level.course.checkpoints.find(
      (entry) => entry.id === "garden-start",
    );
    if (!start) throw new Error("garden-start checkpoint is missing");
    const simulation = simulationAt(level, "child", {
      x: start.position.x + offset.x,
      y: start.position.y,
      z: start.position.z + offset.z,
    });
    runtimeStep(simulation, { moveX: 0, moveY: 0 });
    expect(simulation.state.grounded).toBe(true);
    expect(simulation.state.supportId).toBe("welcome");
    return simulation.state.checkpointId;
  }

  it("arms anywhere on the support platform under the shipped platform activation", () => {
    // The control for the two negative cases below: every rejection there is
    // caused by the new activation shape, not by the probe position.
    const published = loadLevel("garden-playground-v2");
    for (const offset of [
      { x: 1.8, z: 0 },
      { x: 1.2, z: -1.2 },
      { x: 0, z: 0.9 },
      { x: 2.4, z: 0 },
    ]) {
      expect(armsAt(published, offset)).toBe("garden-start");
    }
  });

  it("projects and activates a radius checkpoint at its authored distance", () => {
    const level = withGardenStartActivation({ type: "radius", radius: 1.5 });
    const start = level.course.checkpoints.find(
      (entry) => entry.id === "garden-start",
    );
    expect(start).toMatchObject({ triggerRadius: 1.5 });
    expect(start?.triggerPlatformId).toBeUndefined();
    expect(start?.triggerHalfExtents).toBeUndefined();

    expect(armsAt(level, { x: 1.2, z: 0 })).toBe("garden-start");
    expect(armsAt(level, { x: 0, z: -1.4 })).toBe("garden-start");
    // Outside the circle but still standing on `welcome`, which would have
    // armed it under the shipped platform activation.
    expect(armsAt(level, { x: 1.8, z: 0 })).toBeNull();
    expect(armsAt(level, { x: 1.2, z: -1.2 })).toBeNull();
  });

  it("projects and activates a box checkpoint on its half extents, not its radius", () => {
    const level = withGardenStartActivation({
      type: "box",
      halfExtents: { x: 2, z: 0.6 },
    });
    const start = level.course.checkpoints.find(
      (entry) => entry.id === "garden-start",
    );
    expect(start).toMatchObject({
      // `courseFor` reports the inscribed radius for rendering, but arming
      // must use the rectangle.
      triggerRadius: 0.6,
      triggerHalfExtents: { x: 2, z: 0.6 },
    });
    expect(start?.triggerPlatformId).toBeUndefined();

    // Inside the rectangle and well outside the 0.6m inscribed circle.
    expect(armsAt(level, { x: 1.8, z: 0 })).toBe("garden-start");
    expect(armsAt(level, { x: 0, z: 0.5 })).toBe("garden-start");
    // Inside the circle's reach on x but outside the rectangle on z.
    expect(armsAt(level, { x: 0, z: 0.9 })).toBeNull();
    expect(armsAt(level, { x: 2.4, z: 0 })).toBeNull();
  });

  it("leaves the other chapter and the published route untouched by the edit", () => {
    const level = withGardenStartActivation({ type: "radius", radius: 1.5 });
    expect(level.course.checkpoints).toHaveLength(8);
    expect(
      loadLevel("garden-playground-v2").course.checkpoints.find(
        (entry) => entry.id === "garden-start",
      ),
    ).toMatchObject({ triggerRadius: 1, triggerPlatformId: "welcome" });
    expect(
      resolveAuthoredLevelDocument(gardenPlayground).course.checkpoints[0],
    ).toMatchObject({ triggerPlatformId: "welcome" });
  });
});
