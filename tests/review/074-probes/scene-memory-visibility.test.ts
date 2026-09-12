// @vitest-environment jsdom
/**
 * WO074 probe: GardenScene.updateProgress's keepsake visibility rule, run
 * against the real prototype method with a minimal receiver (no WebGL).
 * v3 route-memory saves hide revealed (collected) keepsakes; archived v2 saves
 * keep their original visible-until-consumed behaviour.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { GardenScene } from "../../../src/game/scene";
import type { SaveView } from "../../../src/shared/contracts";
import { makeEraSave } from "../../game/fixtures";

type Receiver = {
  disposed: boolean;
  save: SaveView | undefined;
  friendlyVisual: undefined;
  memories: Map<string, THREE.Group>;
  photos: Map<string, unknown>;
  pickups: Map<string, THREE.Object3D>;
  stage: SaveView["appearance"]["stage"];
  equipment: undefined;
};

function run(save: SaveView, ids: string[]): Record<string, boolean> {
  const memories = new Map(ids.map((id) => [id, new THREE.Group()]));
  const receiver: Receiver = {
    disposed: false,
    save: undefined,
    friendlyVisual: undefined,
    memories,
    photos: new Map(),
    pickups: new Map(),
    stage: save.appearance.stage,
    equipment: undefined,
  };
  (
    GardenScene.prototype as unknown as {
      updateProgress(this: Receiver, next: SaveView): void;
    }
  ).updateProgress.call(receiver, save);
  return Object.fromEntries(
    [...memories].map(([id, group]) => [id, group.visible]),
  );
}

function withMemories(
  save: SaveView,
  states: Record<string, "locked" | "released" | "revealed" | "consumed">,
  routeMemories: boolean,
): SaveView {
  const next = structuredClone(save);
  const ids = Object.keys(states);
  next.memories = ids.map((id, index) => ({
    id,
    date: `${2020 + index}-01-01`,
    ageYears: index,
    label: id,
    role: index === ids.length - 1 ? "major" : "minor",
    state: states[id]!,
  })) as SaveView["memories"];
  next.adventure!.activeLevel = {
    ...next.adventure!.activeLevel!,
    memoryIds: ids,
    ...(routeMemories
      ? {
          minorMemoryIds: [ids[0]!, ids[1]!] as [string, string],
          majorMemoryId: ids.at(-1)!,
        }
      : {}),
  };
  return next;
}

describe("WO074 keepsake visibility after collection (717cfe6)", () => {
  it("hides collected minors and the locked major in a v3 route-memory level", () => {
    const save = withMemories(
      makeEraSave(),
      { m1: "revealed", m2: "released", m3: "locked" },
      true,
    );
    expect(run(save, ["m1", "m2", "m3"])).toEqual({
      m1: false,
      m2: true,
      m3: false,
    });
    const afterBoss = withMemories(
      makeEraSave({ phase: "memory-released" }),
      { m1: "revealed", m2: "revealed", m3: "released" },
      true,
    );
    expect(run(afterBoss, ["m1", "m2", "m3"])).toEqual({
      m1: false,
      m2: false,
      m3: true,
    });
  });

  it("keeps revealed keepsakes visible for archived v2 saves without a major memory", () => {
    const save = withMemories(
      makeEraSave({ phase: "memory-released" }),
      { m1: "revealed", m2: "released", m3: "consumed" },
      false,
    );
    expect(run(save, ["m1", "m2", "m3"])).toEqual({
      m1: true,
      m2: true,
      m3: false,
    });
  });
});
