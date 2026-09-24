import { describe, expect, it } from "vitest";

import type { ResolvedAuthoredLevel } from "../../src/shared/authored-level";
import { resolveLevelEditorProject } from "../../src/shared/editor-project";
import ratCasinoProject from "../../src/shared/levels/rat-casino-world-v1.json";
import {
  edgeLabel,
  STAGES,
  traverseEdge,
} from "./authored-traversal-lib";

const resolved = resolveLevelEditorProject(ratCasinoProject);
const ratCasino = resolved.levels["rat-casino-v1"];
if (!ratCasino) throw new Error("Rat Casino route is missing");

function platform(level: ResolvedAuthoredLevel, id: string) {
  const found = level.course.platforms.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Rat Casino platform ${id} is missing`);
  return found;
}

function top(level: ResolvedAuthoredLevel, id: string): number {
  const found = platform(level, id);
  return found.center.y + found.size.y / 2;
}

describe("Rat Casino raised playground", () => {
  it("keeps the required route on the authored terrace profile", () => {
    const expectedTops = {
      "ticket-counter": 0,
      "jackrabbit-beat-lane": 0.3,
      "drum-break": 0.6,
      "token-tray": 0.9,
      "cabinet-landing": 1.2,
      "roulette-hop-one": 1.5,
      "roulette-hop-two": 1.8,
      "fox-card-room": 1.5,
      "backstage-turn": 1.8,
      "moth-projection-room": 2.1,
      "last-ticket-one": 2.4,
      "last-ticket-two": 2.7,
      "rat-pit-stage": 3,
      "after-hours-exit": 3,
      "cabinet-side-bridge": 1.2,
      "golden-view-balcony": 1.2,
    } as const;

    for (const [id, expected] of Object.entries(expectedTops))
      expect(top(ratCasino, id), id).toBeCloseTo(expected, 9);

    expect(platform(ratCasino, "token-tray").size).toMatchObject({
      x: 4.4,
      z: 4.2,
    });

    for (const id of [
      "jackrabbit-beat-lane",
      "drum-break",
      "cabinet-landing",
      "fox-card-room",
      "backstage-turn",
      "moth-projection-room",
      "rat-pit-stage",
      "after-hours-exit",
    ]) {
      const terrace = platform(ratCasino, id);
      expect(
        terrace.center.y - terrace.size.y / 2,
        `${id} must meet the visual ground`,
      ).toBeCloseTo(-1.4, 9);
    }

    const sweepers = ratCasino.document.pieces.filter(
      (piece) => piece.type === "sweeper",
    );
    expect(sweepers.find((piece) => piece.id === "ribbon-padded-bar")?.center.y)
      .toBeCloseTo(0.52, 9);
    expect(sweepers.find((piece) => piece.id === "party-turnstile")?.center.y)
      .toBeCloseTo(2.02, 9);

    expect(
      ratCasino.graph.connections.find(
        (connection) =>
          connection.from === "golden-view-balcony" &&
          connection.to === "fox-card-room",
      )?.mode,
    ).toBe("jump");
  });

  it("regenerates the roulette bypass from its raised endpoints", () => {
    const bypass = ratCasino.document.branches.find(
      (branch) => branch.some((id) => id.startsWith("roulette-bypass-step-")),
    );
    expect(bypass).toBeDefined();
    const expected = [
      1.2,
      1.5,
      1.8,
      2.1,
      2.4,
      2.1,
      1.8,
      1.5,
    ];
    expect(bypass).toHaveLength(expected.length);
    bypass?.forEach((id, index) =>
      expect(top(ratCasino, id), id).toBeCloseTo(expected[index]!, 9),
    );
  });

  for (const stage of STAGES) {
    it(`lands every declared edge without recovery as ${stage}`, () => {
      expect(ratCasino.graph.connections.length).toBeGreaterThan(40);
      for (const connection of ratCasino.graph.connections) {
        const result = traverseEdge(ratCasino, connection, stage);
        const label = edgeLabel(ratCasino, connection, stage, 0);
        expect(result.startedOnSource, `${label} must start supported`).toBe(true);
        expect(result.recovered, `${label} recovered before landing`).toBe(false);
        expect(result.reached, `${label} did not reach its target`).toBe(true);
      }
    });
  }
});
