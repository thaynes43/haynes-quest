import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { CasinoScene } from "../../src/game/casino-scene";
import type { LevelLayout } from "../../src/game/level";
import type { SceneAssets } from "../../src/game/scene-assets";
import { resolveLevelEditorProject } from "../../src/shared/editor-project";
import ratCasinoProject from "../../src/shared/levels/rat-casino-world-v1.json";

const route = resolveLevelEditorProject(ratCasinoProject).levels["rat-casino-v1"];
if (!route) throw new Error("Rat Casino route is missing");

function fixtureLevel(): LevelLayout {
  const { document, course } = route;
  const platforms = course.platforms;
  return {
    id: document.id,
    routeId: document.id,
    authored: document,
    course,
    checkpoint: document.anchors.spawn.position,
    finish: document.anchors.finish.position,
    memories: Object.entries(document.anchors.memories).map(([id, anchor], index) => ({
      id,
      index,
      position: anchor.position,
      state: "released" as const,
    })),
    pickups: Object.entries(document.anchors.pickups).map(([kind, anchor]) => ({
      id: kind,
      equipmentId: kind,
      kind: kind as "attack-tool" | "guard-tool",
      position: anchor.position,
      collected: false,
    })),
    encounters: Object.entries(document.anchors.encounters).map(([slot, anchor]) => ({
      id: slot,
      role: slot === "boss" ? "boss" as const : "ordinary" as const,
      kind: anchor.kind,
      position: anchor.position,
      arena: anchor.arena,
    })),
    step: null,
    minX: Math.min(...platforms.map((entry) => entry.center.x - entry.size.x / 2)),
    maxX: Math.max(...platforms.map((entry) => entry.center.x + entry.size.x / 2)),
    minZ: Math.min(...platforms.map((entry) => entry.center.z - entry.size.z / 2)),
    maxZ: Math.max(...platforms.map((entry) => entry.center.z + entry.size.z / 2)),
  };
}

describe("Rat Casino venue scenery", () => {
  it("fills the actual authored course with bounded instanced decor and safe cabinets", () => {
    const level = fixtureLevel();
    const batches: Array<{ url: string; matrices: readonly THREE.Matrix4[] }> = [];
    const attached: string[] = [];
    const assets = {
      attach: (url: string) => attached.push(url),
      attachInstances: (url: string, _target: THREE.Object3D, matrices: readonly THREE.Matrix4[]) =>
        batches.push({ url, matrices }),
    } as unknown as SceneAssets;
    const scene = new CasinoScene(level, assets, () => true, true);
    const venue = scene.root.getObjectByName("casino-venue-decor");
    expect(venue).toBeInstanceOf(THREE.Group);
    expect(venue?.userData.scenicOnly).toBe(true);
    const decorCount = venue?.children.reduce(
      (sum, child) => sum + (child instanceof THREE.InstancedMesh ? child.count : 0),
      0,
    ) ?? 0;
    expect(decorCount).toBeGreaterThan(150);
    expect(decorCount).toBeLessThan(1_200);
    expect(scene.root.getObjectByName("casino-stage-carpet-ring")).toBeDefined();
    const boss = level.encounters.find((entry) => entry.role === "boss");
    const dais = scene.root.getObjectByName("casino-roulette-dais");
    expect(boss?.arena).toBeDefined();
    expect(dais).toBeDefined();
    expect(dais!.position.x + (3.51 * dais!.scale.x) / 2).toBeLessThan(boss!.arena!.minX);
    const stage = level.course!.platforms.find((entry) => entry.id === "rat-pit-stage")!;
    const stageFront = stage.center.z + stage.size.z / 2;
    const stageTop = stage.center.y + stage.size.y / 2;
    const bulbs = venue?.getObjectByName("casino-decor-bulb-glow");
    expect(bulbs).toBeInstanceOf(THREE.InstancedMesh);
    const bulbMatrix = new THREE.Matrix4();
    const bulbPosition = new THREE.Vector3();
    for (let index = 0; index < (bulbs as THREE.InstancedMesh).count; index++) {
      (bulbs as THREE.InstancedMesh).getMatrixAt(index, bulbMatrix);
      bulbMatrix.decompose(bulbPosition, new THREE.Quaternion(), new THREE.Vector3());
      if (Math.abs(bulbPosition.z - (stageFront - 0.15)) < 0.02 &&
        Math.abs(bulbPosition.y - (stageTop + 0.2)) < 0.02)
        expect(Math.abs(bulbPosition.x - boss!.position.x)).toBeGreaterThan(2.1);
    }

    const cabinets = batches.find((batch) => batch.url.endsWith("/slot-cabinet.glb"));
    expect(cabinets).toBeDefined();
    expect(cabinets!.matrices.length).toBeGreaterThan(5);
    expect(cabinets!.matrices.length).toBeLessThanOrEqual(20);
    expect(batches.some((batch) => batch.url.endsWith("/marquee-arch.glb"))).toBe(true);
    expect(attached).toContain(
      "/studio/assets/media/rat-casino-kit/v001/roulette-dais.glb",
    );
    const required = [
      level.checkpoint,
      level.finish,
      ...level.memories.map((entry) => entry.position),
      ...level.pickups.map((entry) => entry.position),
      ...level.encounters.map((entry) => entry.position),
      ...level.course!.checkpoints.map((entry) => entry.position),
    ];
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    for (const matrix of cabinets!.matrices) {
      matrix.decompose(position, rotation, scale);
      expect(
        level.course!.platforms.some(
          (platform) =>
            !platform.motion &&
            Math.abs(position.x - platform.center.x) <= platform.size.x / 2 &&
            Math.abs(position.z - platform.center.z) <= platform.size.z / 2 &&
            Math.abs(position.y - (platform.center.y + platform.size.y / 2)) < 0.05,
        ),
      ).toBe(true);
      expect(required.every((entry) => Math.hypot(position.x - entry.x, position.z - entry.z) >= 2.1)).toBe(true);
      expect(level.encounters.every((entry) =>
        !entry.arena ||
        position.x < entry.arena.minX - 0.7 ||
        position.x > entry.arena.maxX + 0.7 ||
        position.z < entry.arena.minZ - 0.7 ||
        position.z > entry.arena.maxZ + 0.7,
      )).toBe(true);
    }
    scene.dispose();
  });

  it("keeps the Golden cameo opt-in and tolerates a sparse themed layout", () => {
    const level = { ...fixtureLevel(), course: { platforms: [], checkpoints: [], hazards: [] }, encounters: [] } as LevelLayout;
    const assets = { attach: () => undefined, attachInstances: () => undefined } as unknown as SceneAssets;
    const scene = new CasinoScene(level, assets, () => true, false);
    expect(scene.root.getObjectByName("casino-golden-cameo")).toBeUndefined();
    expect(scene.root.getObjectByName("casino-venue-decor")).toBeDefined();
    scene.dispose();
  });
});
