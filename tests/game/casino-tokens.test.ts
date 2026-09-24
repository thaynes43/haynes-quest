import { describe, expect, it } from "vitest";

import {
  CollectibleTracker,
  planCasinoCollectibles,
  TICKET_RADIUS,
  TOKEN_RADIUS,
  type CollectiblePlan,
} from "../../src/game/casino-tokens";
import { getAvatarProportions } from "../../src/game/controller";
import { createObbyState } from "../../src/game/obby";
import type { ResolvedAuthoredLevel } from "../../src/shared/authored-level";
import { resolveLevelEditorProject } from "../../src/shared/editor-project";
import ratCasinoProject from "../../src/shared/levels/rat-casino-world-v1.json";
import {
  edgeEntry,
  inputToward,
  runtimeStep,
  sampledPlatform,
  STAGES,
  type Simulation,
} from "./authored-traversal-lib";

const resolved = resolveLevelEditorProject(ratCasinoProject);
const ratCasino = resolved.levels["rat-casino-v1"];
if (!ratCasino) throw new Error("Rat Casino route is missing");

function plan(level: ResolvedAuthoredLevel): CollectiblePlan {
  const result = planCasinoCollectibles({
    authored: level.document,
    course: level.course,
  });
  if (!result) throw new Error(`${level.document.id} has no collectibles`);
  return result;
}

function platform(level: ResolvedAuthoredLevel, id: string) {
  const found = level.course.platforms.find((entry) => entry.id === id);
  if (!found) throw new Error(`Platform ${id} is missing`);
  return found;
}

const top = (level: ResolvedAuthoredLevel, id: string) => {
  const found = platform(level, id);
  return found.center.y + found.size.y / 2;
};

describe("casino tokens and golden tickets", () => {
  it("leaves the gentle garden and Besties chapters without collectibles", () => {
    for (const [routeId, level] of Object.entries(resolved.levels)) {
      if (routeId === "rat-casino-v1") continue;
      expect(
        planCasinoCollectibles({
          authored: level.document,
          course: level.course,
        }),
        routeId,
      ).toBeNull();
    }
  });

  it("plans the same trail every time with a lively token count", () => {
    const first = plan(ratCasino);
    expect(plan(ratCasino)).toEqual(first);
    expect(first.tokens.length).toBeGreaterThanOrEqual(100);
    expect(first.tokens.length).toBeLessThanOrEqual(200);
    const ids = [...first.tokens, ...first.tickets].map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("puts one golden ticket at the top of each optional detour", () => {
    const { tickets } = plan(ratCasino);
    expect(tickets.map((ticket) => ticket.platformId)).toEqual([
      "golden-view-balcony",
      "ticket-loft-step-11",
      "roulette-bypass-step-4",
    ]);
    const mainRoute = new Set(ratCasino.document.mainPath);
    for (const ticket of tickets) {
      expect(mainRoute.has(ticket.platformId)).toBe(false);
      const branch = ratCasino.document.branches.find((path) =>
        path.includes(ticket.platformId),
      )!;
      const detourTops = branch
        .filter((id) => !mainRoute.has(id))
        .map((id) => top(ratCasino, id));
      expect(top(ratCasino, ticket.platformId)).toBe(Math.max(...detourTops));
    }
    // The ticket loft's golden ticket crowns its 3.3 m summit.
    expect(top(ratCasino, "ticket-loft-step-11")).toBeCloseTo(3.3, 5);
  });

  it("keeps tokens on solid ground, clear of edges, hazards and gameplay anchors", () => {
    const { tokens } = plan(ratCasino);
    const anchors = [
      ratCasino.document.anchors.spawn,
      ratCasino.document.anchors.finish,
      ratCasino.document.anchors.rewardRespawn,
      ...Object.values(ratCasino.document.anchors.pickups),
      ...Object.values(ratCasino.document.anchors.memories),
      ...Object.values(ratCasino.document.anchors.encounters),
      ...Object.values(ratCasino.document.anchors.friendlies),
    ].map((anchor) => anchor.position);
    for (const token of tokens) {
      for (const anchor of anchors) {
        const apart =
          Math.hypot(
            anchor.x - token.position.x,
            anchor.z - token.position.z,
          ) >= 1.2 || Math.abs(anchor.y - token.position.y) > 1.6;
        expect(apart, `${token.id} crowds an anchor`).toBe(true);
      }
      for (const hazard of ratCasino.course.hazards) {
        const reach =
          hazard.halfLength + hazard.radius + (hazard.motion?.distance ?? 0);
        expect(
          Math.hypot(
            hazard.center.x - token.position.x,
            hazard.center.z - token.position.z,
          ),
          `${token.id} sits in a sweeper's path`,
        ).toBeGreaterThanOrEqual(reach);
      }
      if (token.role !== "trail") continue;
      const support = platform(ratCasino, token.platformId);
      expect(
        support.motion,
        `${token.id} rides a moving platform`,
      ).toBeUndefined();
      expect(Math.abs(token.position.x - support.center.x)).toBeLessThanOrEqual(
        support.size.x / 2 - 0.4 + 1e-6,
      );
      expect(Math.abs(token.position.z - support.center.z)).toBeLessThanOrEqual(
        support.size.z / 2 - 0.4 + 1e-6,
      );
      expect(token.position.y).toBeCloseTo(
        top(ratCasino, token.platformId) + 0.55,
        3,
      );
    }
    for (const [index, token] of tokens.entries())
      for (const other of tokens.slice(index + 1))
        expect(
          Math.hypot(
            token.position.x - other.position.x,
            token.position.y - other.position.y,
            token.position.z - other.position.z,
          ),
        ).toBeGreaterThanOrEqual(0.8);
  });

  it("keeps every item out of platforms and off floors a higher room covers", () => {
    const current = plan(ratCasino);
    const solids = ratCasino.course.platforms.filter((entry) => !entry.motion);
    const over = (
      solid: (typeof solids)[number],
      point: { x: number; z: number },
      margin: number,
    ) =>
      Math.abs(point.x - solid.center.x) < solid.size.x / 2 + margin &&
      Math.abs(point.z - solid.center.z) < solid.size.z / 2 + margin;
    for (const item of [...current.tokens, ...current.tickets]) {
      const radius = item.kind === "ticket" ? TICKET_RADIUS : TOKEN_RADIUS;
      const floor = top(ratCasino, item.platformId);
      for (const solid of solids) {
        const solidTop = solid.center.y + solid.size.y / 2;
        const solidBottom = solid.center.y - solid.size.y / 2;
        expect(
          over(solid, item.position, radius) &&
            item.position.y > solidBottom - radius &&
            item.position.y < solidTop + radius,
          `${item.id} is inside ${solid.id}`,
        ).toBe(false);
        if (item.role === "arc" || solid.id === item.platformId) continue;
        expect(
          over(solid, item.position, 0.25) &&
            solidTop > floor + 0.01 &&
            solidBottom < floor + 1.3,
          `${item.id} stands where ${solid.id} rises over its floor`,
        ).toBe(false);
      }
    }
    // The fox card room overlaps the golden-view balcony's north strip 0.3 m
    // higher, so that balcony's ticket must stand on its open floor.
    const balconyTicket = current.tickets.find(
      (ticket) => ticket.platformId === "golden-view-balcony",
    )!;
    expect(
      over(platform(ratCasino, "fox-card-room"), balconyTicket.position, 0.25),
    ).toBe(false);
  });

  it("lets a standing child or infant collect every trail token and ticket", () => {
    const current = plan(ratCasino);
    for (const stage of STAGES) {
      const body = getAvatarProportions(stage);
      for (const item of [...current.tokens, ...current.tickets]) {
        if (item.role === "arc") continue;
        const tracker = new CollectibleTracker(current);
        const found = tracker.collect(
          {
            x: item.position.x,
            y: top(ratCasino, item.platformId),
            z: item.position.z,
          },
          { radius: body.colliderRadius, height: body.height },
        );
        expect(
          found.map((entry) => entry.id),
          `${stage} at ${item.id}`,
        ).toContain(item.id);
      }
    }
  });

  it("collects each jump's arc tokens during an ordinary physics jump", () => {
    const current = plan(ratCasino);
    const arcsByEdge = new Map<string, string[]>();
    for (const token of current.tokens) {
      if (token.role !== "arc") continue;
      const key = `${token.from}>${token.platformId}`;
      arcsByEdge.set(key, [...(arcsByEdge.get(key) ?? []), token.id]);
    }
    expect(arcsByEdge.size).toBeGreaterThan(20);
    for (const stage of STAGES) {
      const body = getAvatarProportions(stage);
      for (const [edge, ids] of arcsByEdge) {
        const [from, to] = edge.split(">") as [string, string];
        const tracker = new CollectibleTracker(current);
        const simulation: Simulation = {
          course: ratCasino.course,
          stage,
          state: createObbyState(
            edgeEntry(ratCasino.course, { from, to, mode: "jump" }, 0, 0.35, 0),
          ),
          timeSeconds: 0,
        };
        runtimeStep(simulation, { moveX: 0, moveY: 0 });
        const target = sampledPlatform(ratCasino.course, to, 0).center;
        for (let frame = 0; frame < 150; frame++) {
          runtimeStep(
            simulation,
            inputToward(simulation.state, target),
            frame === 0,
          );
          tracker.collect(simulation.state.position, {
            radius: body.colliderRadius,
            height: body.height,
          });
          if (
            simulation.state.grounded &&
            simulation.state.supportId === to &&
            Math.hypot(
              target.x - simulation.state.position.x,
              target.z - simulation.state.position.z,
            ) < 1
          )
            break;
        }
        expect(simulation.state.supportId, `${stage} landed from ${edge}`).toBe(
          to,
        );
        for (const id of ids)
          expect(tracker.has(id), `${stage} collected ${id} over ${edge}`).toBe(
            true,
          );
      }
    }
  });

  it("counts each item once and keeps them for the rest of the run", () => {
    const current = plan(ratCasino);
    const tracker = new CollectibleTracker(current);
    const first = current.tokens[0]!;
    const feet = {
      x: first.position.x,
      y: first.position.y - 0.55,
      z: first.position.z,
    };
    const body = { radius: 0.24, height: 1.22 };
    expect(tracker.collect(feet, body).map((item) => item.id)).toContain(
      first.id,
    );
    expect(tracker.collect(feet, body)).toEqual([]);
    expect(tracker.counts()).toMatchObject({
      tokens: expect.any(Number),
      tokenTotal: current.tokens.length,
      tickets: 0,
      ticketTotal: 3,
    });
    expect(tracker.has(first.id)).toBe(true);
    // Far away and far below: nothing is touched.
    expect(tracker.collect({ x: 500, y: -50, z: 500 }, body)).toEqual([]);
  });
});
