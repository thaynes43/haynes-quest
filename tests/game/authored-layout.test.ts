import { describe, expect, it } from "vitest";

import { authoredRoute } from "../../src/game/authored-layout";
import { createObbyCourse } from "../../src/game/obby-layout";
import { createLevelLayout, inspectLevel } from "../../src/game/level";
import type { AuthoredLevelDocument } from "../../src/shared/authored-level";
import { makeSave } from "./fixtures";
import { makeArchivedRoutedSave, makeAuthoredSave } from "./authored-fixtures";

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
