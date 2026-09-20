/**
 * Controller acceptance for generated climbing sections.
 *
 * A section that validates is not yet a section a child can climb: the
 * published validator constrains each hop in isolation and cannot see that a
 * step overlaps the deck it was laid beside. These tests drive the real
 * `stepObby` auto-pilot over the edited chapter, so every declared edge -- the
 * section's ascent and descent, and every edge the chapter already had -- has
 * to still be walkable, for both avatar sizes.
 */
import { describe, expect, it } from "vitest";

import { createObbyState } from "../../src/game/obby";
import {
  applyLevelEditorCommand,
  createLevelEditorProject,
  resolveLevelEditorProject,
  type LevelEditorChapterId,
  type LevelEditorCommand,
  type LevelEditorProject,
  type LevelEditorTemplateRouteId,
} from "../../src/shared/editor-project";
import type { ResolvedAuthoredLevel } from "../../src/shared/authored-level";
import {
  edgeEntry,
  edgeLabel,
  inputToward,
  runtimeStep,
  sampledPlatform,
  settledState,
  STAGES,
  traverseEdge,
  type AppearanceStage,
  type Simulation,
} from "./authored-traversal-lib";
import {
  platformTop,
  raisedGardenPicnicProject,
  rotatedGardenProject,
  sectionSteps,
} from "./editor-section-fixtures";

const PREFIX = "climb";

interface SectionCase {
  readonly title: string;
  readonly chapterId: LevelEditorChapterId;
  readonly routeId: LevelEditorTemplateRouteId;
  readonly command: Omit<
    Extract<LevelEditorCommand, { type: "section.add" }>,
    "type" | "chapterId" | "idPrefix"
  >;
  readonly project?: () => LevelEditorProject;
  readonly stages?: readonly AppearanceStage[];
}

const CASES: readonly SectionCase[] = [
  {
    title: "a raised arch beside the garden welcome deck",
    chapterId: "chapter-1",
    routeId: "garden-playground-v2",
    command: {
      fromPlatformId: "welcome",
      toPlatformId: "picnic",
      pattern: "arch",
      side: "right",
      steps: 4,
    },
  },
  {
    title: "a zigzag ridge beside the party welcome deck",
    chapterId: "chapter-2",
    routeId: "besties-playground-v2",
    command: {
      fromPlatformId: "party-welcome",
      toPlatformId: "party-picnic",
      pattern: "zigzag",
      side: "left",
      steps: 4,
    },
  },
  {
    title: "an arch onto a higher rejoin deck",
    chapterId: "chapter-1",
    routeId: "garden-playground-v2",
    command: {
      fromPlatformId: "woodland-rest",
      toPlatformId: "memory-grove",
      pattern: "arch",
      side: "left",
      steps: 4,
    },
  },
  {
    title: "an uneven long arch with an added descent landing",
    chapterId: "chapter-1",
    routeId: "garden-playground-v2",
    command: {
      fromPlatformId: "welcome",
      toPlatformId: "picnic",
      pattern: "arch",
      side: "left",
      steps: 4,
    },
    project: raisedGardenPicnicProject,
  },
  {
    title: "a tall arch from welcome to woodland rest",
    chapterId: "chapter-1",
    routeId: "garden-playground-v2",
    command: {
      fromPlatformId: "welcome",
      toPlatformId: "woodland-rest",
      pattern: "arch",
      side: "left",
      steps: 12,
    },
  },
  {
    title: "a locally routed arch to ribbon rest",
    chapterId: "chapter-2",
    routeId: "besties-playground-v2",
    command: {
      fromPlatformId: "party-welcome",
      toPlatformId: "ribbon-rest",
      pattern: "arch",
      side: "right",
      steps: 6,
    },
  },
  {
    title: "a locally routed zigzag to ribbon rest",
    chapterId: "chapter-2",
    routeId: "besties-playground-v2",
    command: {
      fromPlatformId: "party-welcome",
      toPlatformId: "ribbon-rest",
      pattern: "zigzag",
      side: "left",
      steps: 6,
    },
  },
  {
    title: "an arch on a course that runs along x",
    chapterId: "chapter-1",
    routeId: "garden-playground-v2",
    command: {
      fromPlatformId: "welcome",
      toPlatformId: "picnic",
      pattern: "arch",
      side: "right",
      steps: 4,
    },
    project: rotatedGardenProject,
    stages: ["child"],
  },
];

function build(entry: SectionCase): ResolvedAuthoredLevel {
  const base =
    entry.project?.() ??
    createLevelEditorProject({ projectId: "traversal", name: "Traversal" });
  const result = applyLevelEditorCommand(base, {
    type: "section.add",
    chapterId: entry.chapterId,
    idPrefix: PREFIX,
    ...entry.command,
  });
  expect(result.ok, JSON.stringify(result.issues, null, 2)).toBe(true);
  expect(result.issues).toEqual([]);
  return resolveLevelEditorProject(result.project).levels[entry.routeId];
}

function reachesSweeperSideLane(
  level: ResolvedAuthoredLevel,
  stage: AppearanceStage,
  timeSeconds: number,
  lateral: -1 | 1,
): boolean {
  const connection = level.graph.connections.find(
    (candidate) =>
      candidate.from === `${PREFIX}-step-3` && candidate.to === "winding-east",
  );
  if (!connection) throw new Error("Missing final winding-east section edge");
  const state = createObbyState(
    edgeEntry(level.course, connection, timeSeconds, 0.75, lateral),
  );
  const simulation: Simulation = {
    course: level.course,
    stage,
    state,
    timeSeconds,
  };
  runtimeStep(simulation, { moveX: 0, moveY: 0 });
  if (!state.grounded || state.supportId !== connection.from) return false;

  for (let frame = 0; frame < 180; frame += 1) {
    const target = sampledPlatform(
      level.course,
      connection.to,
      simulation.timeSeconds + 1 / 60,
    );
    const result = runtimeStep(
      simulation,
      inputToward(state, {
        x: target.center.x,
        z: target.center.z - lateral,
      }),
      frame === 0,
    );
    if (result.recovered) return false;
    if (state.grounded && state.supportId === connection.to) return true;
  }
  return false;
}

describe("generated section traversal", () => {
  for (const entry of CASES) {
    for (const stage of entry.stages ?? STAGES) {
      it(`${entry.title} keeps every declared edge walkable as ${stage}`, () => {
        const level = build(entry);
        const sectionEdges = level.graph.connections.filter(
          (connection) =>
            connection.from.startsWith(PREFIX) || connection.to.startsWith(PREFIX),
        );
        expect(sectionEdges).toHaveLength(
          sectionSteps(level.document, PREFIX).length + 1,
        );

        for (const connection of level.graph.connections) {
          const result = traverseEdge(level, connection, stage);
          const label = edgeLabel(level, connection, stage, 0);
          expect(result.startedOnSource, `${label} must start supported`).toBe(true);
          expect(result.recovered, `${label} recovered before landing`).toBe(false);
          expect(result.reached, `${label} did not reach its target`).toBe(true);
        }
      });

      it(`${entry.title} climbs to its crest and back down as ${stage}`, () => {
        const level = build(entry);
        const steps = sectionSteps(level.document, PREFIX);
        const tops = steps.map(platformTop);
        const crest = tops.indexOf(Math.max(...tops));
        expect(crest).toBeGreaterThan(0);
        expect(crest).toBeLessThan(steps.length - 1);

        const ascent = {
          from: steps[crest - 1]!.id,
          to: steps[crest]!.id,
          mode: "jump" as const,
        };
        const descent = {
          from: steps[crest]!.id,
          to: steps[crest + 1]!.id,
          mode: "jump" as const,
        };
        for (const connection of [ascent, descent]) {
          const result = traverseEdge(level, connection, stage);
          expect(result.airborne, `${connection.from} must leave the ground`).toBe(
            true,
          );
          expect(result.reached, `${connection.from} did not reach its landing`).toBe(
            true,
          );
        }
        expect(tops[crest]! - tops[crest - 1]!).toBeGreaterThan(0);
        expect(tops[crest]! - tops[crest + 1]!).toBeGreaterThan(0);
      });

      it(`${entry.title} recovers a fall from its crest as ${stage}`, () => {
        const level = build(entry);
        const steps = sectionSteps(level.document, PREFIX);
        const tops = steps.map(platformTop);
        const crestStep = steps[tops.indexOf(Math.max(...tops))]!;
        const checkpoint = level.course.checkpoints.find(
          (entryPoint) => entryPoint.triggerPlatformId === crestStep.id,
        );
        if (!checkpoint) throw new Error("The crest step has no checkpoint");

        // Standing on the crest arms its checkpoint.
        const armed = settledState(level, stage, checkpoint.position);
        expect(armed.grounded).toBe(true);
        expect(armed.supportId).toBe(crestStep.id);
        expect(armed.checkpointId).toBe(checkpoint.id);

        // Walking off the outward edge drops the player clear of the course.
        const state = createObbyState({ ...checkpoint.position });
        const simulation: Simulation = {
          course: level.course,
          stage,
          state,
          timeSeconds: 0,
        };
        runtimeStep(simulation, { moveX: 0, moveY: 0 });
        expect(state.checkpointId).toBe(checkpoint.id);
        const firstStep = steps[0]!;
        const lastStep = steps.at(-1)!;
        const source = sampledPlatform(
          level.course,
          entry.command.fromPlatformId,
          0,
        );
        const travelAxis =
          Math.abs(lastStep.center.x - firstStep.center.x) >=
          Math.abs(lastStep.center.z - firstStep.center.z)
            ? "x"
            : "z";
        const crossAxis = travelAxis === "x" ? "z" : "x";
        const outward =
          Math.sign(crestStep.center[crossAxis] - source.center[crossAxis]) || 1;
        const away =
          crossAxis === "x"
            ? { moveX: outward, moveY: 0 }
            : { moveX: 0, moveY: -outward };
        let recovered = false;
        for (let frame = 0; frame < 900 && !recovered; frame += 1)
          recovered = runtimeStep(simulation, away).recovered;

        expect(recovered).toBe(true);
        expect(state.supportId).toBe(crestStep.id);
        expect(state.position.x).toBeCloseTo(checkpoint.position.x, 6);
        expect(state.position.y).toBeCloseTo(checkpoint.position.y, 6);
        expect(state.position.z).toBeCloseTo(checkpoint.position.z, 6);
      });
    }
  }

  it("keeps a real side lane around the winding-east sweeper", () => {
    for (const pattern of ["arch", "zigzag"] as const) {
      const level = build({
        title: `${pattern} into winding-east`,
        chapterId: "chapter-1",
        routeId: "garden-playground-v2",
        command: {
          fromPlatformId: "picnic",
          toPlatformId: "winding-east",
          pattern,
          side: "right",
          steps: 2,
        },
      });
      for (const stage of STAGES)
        for (const timeSeconds of [0, 2.5, 5, 7.5, 10])
          for (const lateral of [-1, 1] as const)
            expect(
              reachesSweeperSideLane(level, stage, timeSeconds, lateral),
              `${pattern} ${stage} t=${timeSeconds}s lateral=${lateral}`,
            ).toBe(true);
    }
  });
});
