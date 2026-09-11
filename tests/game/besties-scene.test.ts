import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { BestiesScene } from "../../src/game/besties-scene";
import { BestiesSimulation, type BestieActorId } from "../../src/game/besties";
import type { DuoParodyArtwork } from "../../src/game/scene-catalog";
import type { SceneAssets } from "../../src/game/scene-assets";
import type { PositionSnapshot } from "../../src/game/types";

const models = [
  { id: "bestie-pink", url: "/fixture/bestie-pink.glb" },
  { id: "bestie-black", url: "/fixture/bestie-black.glb" },
] as const satisfies DuoParodyArtwork["models"];

function worldPosition(scene: BestiesScene, id: BestieActorId): THREE.Vector3 {
  const actor = scene.root.getObjectByName(id);
  if (!actor) throw new Error(`Missing rendered actor ${id}`);
  return actor.getWorldPosition(new THREE.Vector3());
}

function expectPosition(
  actual: PositionSnapshot | null,
  expected: THREE.Vector3,
): void {
  expect(actual).not.toBeNull();
  expect(actual!.x).toBeCloseTo(expected.x, 8);
  expect(actual!.y).toBeCloseTo(expected.y, 8);
  expect(actual!.z).toBeCloseTo(expected.z, 8);
}

function near(position: THREE.Vector3): PositionSnapshot {
  return { x: position.x + 0.02, y: position.y, z: position.z - 0.01 };
}

describe("BestiesScene spell targeting", () => {
  it("selects the nearer rendered actor through parent transforms and the current high-five pose", () => {
    const assets = { attach: vi.fn() } as unknown as SceneAssets;
    const scene = new BestiesScene(assets, () => true, models);
    const parent = new THREE.Group();
    parent.position.set(7.5, 1.2, -9);
    parent.rotation.set(0.08, 0.72, -0.04);
    parent.scale.set(1.35, 0.9, 0.75);
    scene.root.position.set(-2, 0.4, -11);
    parent.add(scene.root);

    const simulation = new BestiesSimulation();
    let frame = simulation.step({
      player: { x: 8, y: 0, z: 8 },
      deltaSeconds: 0,
      active: true,
      defeated: false,
    }).frame;
    scene.update(frame, 0, 11, 0);

    const pink = worldPosition(scene, "bestie-pink");
    const black = worldPosition(scene, "bestie-black");
    const logicalCenter = scene.root.getWorldPosition(new THREE.Vector3());
    expect(pink.distanceTo(black)).toBeGreaterThan(2);
    expect(pink.distanceTo(logicalCenter)).toBeGreaterThan(0.5);
    expect(black.distanceTo(logicalCenter)).toBeGreaterThan(0.5);
    expectPosition(scene.targetPosition(near(pink)), pink);
    expectPosition(scene.targetPosition(near(black)), black);
    expect(scene.targetPosition(near(pink))).not.toEqual({
      x: logicalCenter.x,
      y: logicalCenter.y,
      z: logicalCenter.z,
    });

    const initialSeparation = pink.distanceTo(black);
    for (let step = 0; step < 100; step += 1) {
      frame = simulation.step({
        player: { x: 8, y: 0, z: 8 },
        deltaSeconds: 0.1,
        active: true,
        defeated: false,
      }).frame;
      if (frame.phase === "high-five" && frame.phaseProgress >= 0.5) break;
    }
    expect(frame.phase).toBe("high-five");
    expect(frame.phaseProgress).toBeGreaterThanOrEqual(0.5);
    scene.update(frame, 0, 11, 7.2);

    const highFivePink = worldPosition(scene, "bestie-pink");
    const highFiveBlack = worldPosition(scene, "bestie-black");
    expect(highFivePink.distanceTo(pink)).toBeGreaterThan(0.2);
    expect(highFiveBlack.distanceTo(black)).toBeGreaterThan(0.2);
    expect(highFivePink.distanceTo(highFiveBlack)).toBeLessThan(
      initialSeparation,
    );
    expect(highFivePink.distanceTo(highFiveBlack)).toBeGreaterThan(0.5);
    expectPosition(scene.targetPosition(near(highFivePink)), highFivePink);
    expectPosition(scene.targetPosition(near(highFiveBlack)), highFiveBlack);
    expect(scene.targetPosition(near(highFivePink))).not.toEqual({
      x: logicalCenter.x,
      y: logicalCenter.y,
      z: logicalCenter.z,
    });

    scene.dispose();
    expect(scene.targetPosition(near(highFivePink))).toBeNull();
  });
});
