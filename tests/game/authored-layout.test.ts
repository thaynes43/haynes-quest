import { describe, expect, it } from "vitest";

import { authoredLevelLayout, authoredLevelResolverFor, authoredRoute } from "../../src/game/authored-layout";
import { createObbyCourse } from "../../src/game/obby-layout";
import { createLevelLayout, inspectLevel } from "../../src/game/level";
import type { AuthoredLevelDocument } from "../../src/shared/authored-level";
import { makeSave } from "./fixtures";
import { makeArchivedRoutedSave, makeAuthoredSave } from "./authored-fixtures";
import { resolveLevelEditorProject } from "../../src/shared/editor-project";
import ratCasinoV2 from "../../src/shared/levels/rat-casino-world-v2.json";

describe("authored level layout", () => {
  it.each(["garden-playground-v1", "besties-playground-v1"] as const)(
    "resolves %s through the common course entry point",
    (routeId) => {
      expect(createObbyCourse(routeId)).toBe(authoredRoute(routeId)!.course);
      expect(createObbyCourse(routeId).platforms.length).toBeGreaterThan(10);
    },
  );

  it("binds repeated ordinary kinds to four stable, distinct encounter slots", () => {
    const save = makeAuthoredSave();
    const level = createLevelLayout(save);
    const route = authoredRoute("garden-playground-v1");
    expect(route).not.toBeNull();

    const ordinary = level.encounters.filter(
      (encounter) => encounter.role === "ordinary",
    );
    expect(ordinary.map((encounter) => encounter.kind)).toEqual([
      "ordinary-a",
      "ordinary-b",
      "ordinary-a",
      "ordinary-b",
    ]);
    expect(ordinary.map((encounter) => encounter.position)).toEqual([
      route!.anchors.encounters["ordinary-1"].position,
      route!.anchors.encounters["ordinary-2"].position,
      route!.anchors.encounters["ordinary-3"].position,
      route!.anchors.encounters["ordinary-4"].position,
    ]);
    expect(
      new Set(
        ordinary.map(({ position }) =>
          [position.x, position.y, position.z].join(":"),
        ),
      ).size,
    ).toBe(4);
    expect(ordinary[0]?.position).not.toEqual(ordinary[2]?.position);
    expect(ordinary[1]?.position).not.toEqual(ordinary[3]?.position);
  });

  it("binds the optional Golden encounter by frozen ID without shifting Rat's required slots", () => {
    const save = makeAuthoredSave();
    const active = save.adventure?.activeLevel;
    if (!active) throw new Error("Authored fixture is incomplete");
    const bonusId = "rat-casino-v2-encounter-bonus-1";
    const withBonus = {
      ...active,
      id: "rat-casino-v2",
      routeId: "rat-casino-v2",
      optionalEncounterIds: [bonusId],
      encounters: [
        ...active.encounters,
        { ...active.encounters[0]!, id: bonusId },
      ],
    };
    const route = resolveLevelEditorProject(ratCasinoV2).levels["rat-casino-v2"]!;
    const resolver = authoredLevelResolverFor({ "rat-casino-v2": route });
    const layout = authoredLevelLayout(save, withBonus, resolver)!;
    expect(layout.encounters.find((enemy) => enemy.id === bonusId)?.position).toEqual(
      route.document.anchors.encounters["bonus-1"]?.position,
    );
    expect(layout.encounters.slice(0, 4).map((enemy) => enemy.position)).toEqual(
      ["ordinary-1", "ordinary-2", "ordinary-3", "ordinary-4"].map(
        (slot) => route.document.anchors.encounters[slot as "ordinary-1"].position,
      ),
    );
    expect(() => authoredLevelLayout(save, { ...withBonus, optionalEncounterIds: [] }, resolver))
      .toThrow("Authored encounter slots do not match");
  });

  it("binds the two minor memories and major memory by explicit role", () => {
    const save = makeAuthoredSave();
    const active = save.adventure?.activeLevel;
    const route = authoredRoute("garden-playground-v1");
    if (!active?.minorMemoryIds || !active.majorMemoryId || !route)
      throw new Error("Authored fixture is incomplete");

    const level = createLevelLayout(save);
    expect(level.memories).toEqual([
      {
        id: active.minorMemoryIds[0],
        index: 0,
        position: { ...route.anchors.memories["minor-one"].position },
        state: "revealed",
      },
      {
        id: active.minorMemoryIds[1],
        index: 1,
        position: { ...route.anchors.memories["minor-two"].position },
        state: "released",
      },
      {
        id: active.majorMemoryId,
        index: 2,
        position: { ...route.anchors.memories.major.position },
        state: "locked",
      },
    ]);
  });

  it("leaves legacy gardens and archived obby routes on their frozen layouts", () => {
    const legacy = createLevelLayout(makeSave([0]));
    expect(legacy).toMatchObject({
      id: null,
      checkpoint: { x: 0, y: 0, z: 0 },
      finish: { x: 0, y: 0, z: -8 },
      memories: [{ id: "memory-1", position: { x: -0.7, y: 0, z: -4 } }],
    });
    expect(legacy.authored).toBeUndefined();
    expect(legacy.course).toBeUndefined();

    const archived = createLevelLayout(makeArchivedRoutedSave());
    expect(archived.routeId).toBe("gentle-intro-v1");
    expect(archived.authored).toBeUndefined();
    expect(archived.course?.platforms[0]?.id).toBe("intro-ground");
    expect(
      archived.encounters.map(({ kind, position }) => [kind, position]),
    ).toEqual([
      ["ordinary-a", { x: -2, y: 0, z: -8 }],
      ["ordinary-b", { x: 2, y: 0, z: -14 }],
      ["boss", { x: 0, y: 0, z: -22 }],
    ]);
  });

  it("returns a defensive authored metadata clone on every inspection", () => {
    const level = createLevelLayout(makeAuthoredSave());
    const authoritative = authoredRoute("garden-playground-v1")!.document;
    const first = inspectLevel(level).authored;
    if (!first) throw new Error("Authored inspection metadata is missing");

    expect(first).toEqual(authoritative);
    expect(first).not.toBe(authoritative);
    expect(first.anchors).not.toBe(authoritative.anchors);

    const mutable = first as unknown as {
      mainPath: string[];
      pieces: Array<{ center?: { x: number } }>;
      anchors: { spawn: { position: { z: number } } };
    };
    mutable.mainPath[0] = "damaged";
    mutable.pieces[0]!.center!.x = 999;
    mutable.anchors.spawn.position.z = 999;

    const second = inspectLevel(level).authored as AuthoredLevelDocument;
    expect(second).toEqual(authoritative);
    expect(second.mainPath[0]).not.toBe("damaged");
    expect(second.pieces[0]).toEqual(authoritative.pieces[0]);
    expect(second.anchors.spawn.position.z).toBe(
      authoritative.anchors.spawn.position.z,
    );
  });
});
