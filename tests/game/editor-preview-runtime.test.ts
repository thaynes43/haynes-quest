// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authoredLevelResolverFor,
  authoredRoute,
} from "../../src/game/authored-layout";
import {
  checkpointForSave,
  createLevelLayout,
  inspectLevel,
} from "../../src/game/level";
import { createObbyCourse } from "../../src/game/obby-layout";
import { sampleObby } from "../../src/game/obby";
import type { SceneFrame } from "../../src/game/types";
import type {
  GameplayActionRequest,
  SaveView,
} from "../../src/shared/contracts";
import { makeAuthoredSave } from "./authored-fixtures";
import type { ObbyState } from "../../src/game/obby";
import {
  editedV2Documents,
  editedV2Levels,
  V2_TEMPLATE_ROUTE_IDS,
  type V2TemplateRouteId,
} from "../editor-project-fixtures";

const runtimeState = vi.hoisted(() => ({ controllers: [] as ObbyState[] }));

vi.mock("../../src/game/obby", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/game/obby")>();
  return {
    ...actual,
    createObbyState(position: { x: number; y: number; z: number }) {
      const state = actual.createObbyState(position);
      runtimeState.controllers.push(state);
      return state;
    },
  };
});

vi.mock("../../src/game/scene", () => ({
  GardenScene: class {
    readonly canvas = document.createElement("canvas");
    cameraYaw = 0;

    constructor(container: HTMLElement) {
      container.append(this.canvas);
    }

    adjustCamera(): void {}
    rebuildRoute(): void {}
    updateProgress(): void {}
    render(
      _position: unknown,
      _facing: number,
      _elapsed: number,
      _frame?: SceneFrame,
    ): void {}
    getMediaState() {
      return { loading: 0, failed: 0, reloadRequired: false };
    }
    dispose(): void {
      this.canvas.remove();
    }
  },
}));

import { createGame } from "../../src/game/createGame";

/** Two independent author drafts of the same two chapters, edited differently. */
const PROJECT_A_SHIFT = 0.5;
const PROJECT_B_SHIFT = -0.75;

function equippedSave(routeId: V2TemplateRouteId): SaveView {
  const save = structuredClone(
    makeAuthoredSave({ routeId, defeatedOrdinaryCount: 3 }),
  );
  const adventure = save.adventure!;
  const inventory = adventure.activeLevel!.pickups.map((pickup) => ({
    ...pickup,
    collected: true,
  }));
  adventure.activeLevel!.pickups = inventory;
  adventure.inventory = inventory;
  adventure.equippedId = inventory.find(
    (pickup) => pickup.kind === "attack-tool",
  )!.id;
  return save;
}

/** The chapter-two save the server hands back after a chapter transition. */
function chapterTwoSave(from: SaveView): SaveView {
  const next = equippedSave("besties-playground-v2");
  next.id = from.id;
  next.revision = from.revision + 1;
  return next;
}

describe("editor preview runtime resolver", () => {
  describe("defaults to the published routes", () => {
    it.each(V2_TEMPLATE_ROUTE_IDS)(
      "builds %s identically with no resolver, the built-in resolver and an empty project",
      (routeId) => {
        const save = makeAuthoredSave({ routeId, defeatedOrdinaryCount: 3 });
        const implicit = createLevelLayout(save);
        expect(createLevelLayout(save, authoredRoute)).toEqual(implicit);
        expect(createLevelLayout(save, authoredLevelResolverFor({}))).toEqual(
          implicit,
        );
        expect(implicit.authored).toEqual(authoredRoute(routeId)!.document);
        expect(createObbyCourse(routeId, authoredLevelResolverFor({}))).toBe(
          authoredRoute(routeId)!.course,
        );
      },
    );

    it("ignores a project that only carries an unrelated route", () => {
      const save = makeAuthoredSave({
        routeId: "garden-playground-v2",
        defeatedOrdinaryCount: 3,
      });
      const resolver = authoredLevelResolverFor({
        "besties-playground-v2": editedV2Levels(PROJECT_A_SHIFT)[
          "besties-playground-v2"
        ],
      });
      expect(createLevelLayout(save, resolver)).toEqual(
        createLevelLayout(save),
      );
    });
  });

  describe("resolves geometry, anchors and bounds from the supplied project", () => {
    it.each(V2_TEMPLATE_ROUTE_IDS)(
      "keeps two simultaneous projects of %s isolated from each other and from the registry",
      (routeId) => {
        const save = makeAuthoredSave({ routeId, defeatedOrdinaryCount: 3 });
        const builtIn = createLevelLayout(save);
        const projects = [
          { shift: PROJECT_A_SHIFT, levels: editedV2Levels(PROJECT_A_SHIFT) },
          { shift: PROJECT_B_SHIFT, levels: editedV2Levels(PROJECT_B_SHIFT) },
        ].map((project) => ({
          ...project,
          layout: createLevelLayout(
            save,
            authoredLevelResolverFor(project.levels),
          ),
        }));

        for (const { shift, levels, layout } of projects) {
          // Every placement the player can reach moves with the document.
          expect(layout.checkpoint.x).toBeCloseTo(builtIn.checkpoint.x + shift);
          expect(layout.finish.x).toBeCloseTo(builtIn.finish.x + shift);
          expect(layout.memories.map((memory) => memory.position.x)).toEqual(
            builtIn.memories.map((memory) =>
              expect.closeTo(memory.position.x + shift),
            ),
          );
          expect(layout.pickups.map((pickup) => pickup.position.x)).toEqual(
            builtIn.pickups.map((pickup) =>
              expect.closeTo(pickup.position.x + shift),
            ),
          );
          expect(
            layout.encounters.map((encounter) => encounter.position.x),
          ).toEqual(
            builtIn.encounters.map((encounter) =>
              expect.closeTo(encounter.position.x + shift),
            ),
          );
          expect(
            layout.friendlies!.map((friendly) => friendly.position.x),
          ).toEqual(
            builtIn.friendlies!.map((friendly) =>
              expect.closeTo(friendly.position.x + shift),
            ),
          );
          // Boss and ordinary arenas gate combat, so they must move too.
          expect(layout.encounters.map((encounter) => encounter.arena)).toEqual(
            builtIn.encounters.map((encounter) => ({
              minX: expect.closeTo(encounter.arena!.minX + shift),
              maxX: expect.closeTo(encounter.arena!.maxX + shift),
              minZ: encounter.arena!.minZ,
              maxZ: encounter.arena!.maxZ,
            })),
          );
          // Collision surfaces and the walkable bounds follow the same document.
          expect(layout.course!.platforms.map((piece) => piece.center.x)).toEqual(
            builtIn.course!.platforms.map((piece) =>
              expect.closeTo(piece.center.x + shift),
            ),
          );
          expect(layout.minX).toBeCloseTo(builtIn.minX + shift);
          expect(layout.maxX).toBeCloseTo(builtIn.maxX + shift);
          expect(layout.minZ).toBe(builtIn.minZ);
          expect(layout.maxZ).toBe(builtIn.maxZ);
          // Inspect data and the authored document come from the same resolution.
          expect(layout.authored).toEqual(levels[routeId].document);
          expect(inspectLevel(layout).authored).toEqual(
            levels[routeId].document,
          );
          expect(layout.course).toBe(levels[routeId].course);
          // The durable checkpoint the runtime would respawn at is the edited
          // one, not the published route's.
          const published = checkpointForSave(save, builtIn);
          expect(checkpointForSave(save, layout)).toEqual({
            x: expect.closeTo(published.x + shift),
            y: published.y,
            z: published.z,
          });
        }

        const [first, second] = projects;
        expect(first!.layout.checkpoint.x).not.toBeCloseTo(
          second!.layout.checkpoint.x,
        );
        expect(first!.layout.course).not.toBe(second!.layout.course);
        expect(first!.layout.course).not.toBe(builtIn.course);

        // The published registry and its cache are untouched by either project.
        expect(authoredRoute(routeId)!.document).toEqual(builtIn.authored);
        expect(createLevelLayout(save)).toEqual(builtIn);
      },
    );

    it.each(V2_TEMPLATE_ROUTE_IDS)(
      "stands the avatar on the edited surface of %s rather than the published one",
      (routeId) => {
        const save = makeAuthoredSave({ routeId, defeatedOrdinaryCount: 3 });
        const levels = editedV2Levels(PROJECT_A_SHIFT);
        const edited = createLevelLayout(
          save,
          authoredLevelResolverFor(levels),
        );
        const spawn = levels[routeId].anchors.spawn.position;
        const onEditedSpawn = sampleObby(edited.course!, 0);
        const support = onEditedSpawn.platforms.find(
          (platform) =>
            Math.abs(platform.center.x - spawn.x) <= platform.size.x / 2 &&
            Math.abs(platform.center.z - spawn.z) <= platform.size.z / 2,
        );
        expect(support).toBeDefined();
        // The published surface no longer covers the shifted far edge.
        const publishedSpan = createLevelLayout(save).course!.platforms.find(
          (platform) => platform.id === support!.id,
        )!;
        expect(support!.center.x).toBeCloseTo(
          publishedSpan.center.x + PROJECT_A_SHIFT,
        );
      },
    );
  });

  describe("survives save action responses and chapter transitions", () => {
    let frames: FrameRequestCallback[] = [];
    let now: number;

    beforeEach(() => {
      runtimeState.controllers.length = 0;
      frames = [];
      now = 1_000;
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      vi.spyOn(window.performance, "now").mockImplementation(() => now);
      vi.spyOn(window, "requestAnimationFrame").mockImplementation(
        (callback) => frames.push(callback),
      );
      vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    /** Steps every running game, so two previews can advance side by side. */
    const advance = (milliseconds = 50): void => {
      now += milliseconds;
      const pending = frames;
      frames = [];
      if (pending.length === 0)
        throw new Error("No runtime requested an animation frame");
      for (const callback of pending) callback(now);
    };

    function startSession(shift: number) {
      const documents = editedV2Documents(shift);
      const levels = editedV2Levels(shift);
      let authoritative = equippedSave("garden-playground-v2");
      const onAction = vi.fn(async (request: GameplayActionRequest) => {
        authoritative = structuredClone(authoritative);
        authoritative.revision += 1;
        const active = authoritative.adventure!.activeLevel!;
        if (request.action.type === "attack") {
          const boss = active.encounters.find(
            (encounter) => encounter.id === active.bossId,
          )!;
          boss.hp = Math.max(0, boss.hp - 1);
        }
        return authoritative;
      });
      const game = createGame({
        container: document.createElement("div"),
        save: authoritative,
        authoredLevelResolver: authoredLevelResolverFor(levels),
        onAction,
        onRefresh: async () => authoritative,
      });
      return {
        shift,
        documents,
        game,
        onAction,
        controller: runtimeState.controllers.at(-1)!,
        latest: () => authoritative,
      };
    }

    it("keeps each project's documents through combat and into chapter two", async () => {
      const sessions = [PROJECT_A_SHIFT, PROJECT_B_SHIFT].map(startSession);
      advance();
      advance();

      const expectChapter = (
        session: (typeof sessions)[number],
        routeId: V2TemplateRouteId,
      ): void => {
        const document = session.documents[routeId];
        const inspection = session.game.inspect();
        expect(inspection.level.authored).toEqual(document);
        expect(inspection.checkpoint.x).toBeCloseTo(
          document.anchors.spawn.position.x,
        );
        expect(inspection.level.finishPosition.x).toBeCloseTo(
          document.anchors.finish.position.x,
        );
      };

      for (const session of sessions) {
        expectChapter(session, "garden-playground-v2");
      }
      expect(sessions[0]!.game.inspect().checkpoint.x).not.toBeCloseTo(
        sessions[1]!.game.inspect().checkpoint.x,
      );

      // Standing on each project's own boss anchor must engage that boss, which
      // only happens if the arena came from the edited document.
      for (const session of sessions) {
        const bossAnchor =
          session.documents["garden-playground-v2"].anchors.encounters.boss;
        Object.assign(session.controller.position, bossAnchor.position);
        Object.assign(session.controller.checkpoint, bossAnchor.position);
        session.controller.velocityY = 0;
        session.controller.grounded = true;
        session.controller.recoveryRemaining = 0;
      }
      advance();
      for (const session of sessions) {
        expect(session.game.inspect().status).toMatchObject({
          bossEngaged: true,
          nearEncounterId: session.latest().adventure!.activeLevel!.bossId,
          attackReady: true,
        });
      }

      // A real action response rebuilds the level; it must not revert.
      for (const session of sessions) {
        session.game.setInput("attack", true);
        session.game.setInput("attack", false);
      }
      advance();
      for (const session of sessions) {
        await vi.waitFor(() =>
          expect(session.onAction).toHaveBeenCalledTimes(1),
        );
        expect(session.latest().adventure!.activeLevel!.encounters).toEqual(
          expect.arrayContaining([expect.objectContaining({ hp: 7 })]),
        );
        expectChapter(session, "garden-playground-v2");
      }

      // The chapter transition rebuilds against the project's second document.
      for (const session of sessions) {
        session.game.updateSave(chapterTwoSave(session.latest()));
      }
      advance();
      advance();
      for (const session of sessions) {
        expectChapter(session, "besties-playground-v2");
      }
      expect(sessions[0]!.game.inspect().checkpoint.x).not.toBeCloseTo(
        sessions[1]!.game.inspect().checkpoint.x,
      );

      for (const session of sessions) session.game.dispose();
    });

    it("plays the published chapters when no resolver is supplied", () => {
      let authoritative = equippedSave("garden-playground-v2");
      const game = createGame({
        container: document.createElement("div"),
        save: authoritative,
        onAction: async () => authoritative,
        onRefresh: async () => authoritative,
      });
      advance();
      advance();
      expect(game.inspect().level.authored).toEqual(
        authoredRoute("garden-playground-v2")!.document,
      );

      authoritative = chapterTwoSave(authoritative);
      game.updateSave(authoritative);
      advance();
      advance();
      expect(game.inspect().level.authored).toEqual(
        authoredRoute("besties-playground-v2")!.document,
      );
      game.dispose();
    });
  });
});
