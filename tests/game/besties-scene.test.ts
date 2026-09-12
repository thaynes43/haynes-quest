import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { BestiesScene } from "../../src/game/besties-scene";
import { BestiesSimulation, type BestieActorId } from "../../src/game/besties";
import type { DuoParodyArtwork } from "../../src/game/scene-catalog";
import { disposeTree, SceneAssets } from "../../src/game/scene-assets";
import type { PositionSnapshot } from "../../src/game/types";

const models = [
  { id: "bestie-pink", url: "/fixture/bestie-pink.glb" },
  { id: "bestie-black", url: "/fixture/bestie-black.glb" },
] as const satisfies DuoParodyArtwork["models"];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}

function gltf(scene: THREE.Group): GLTF {
  return { scene, scenes: [scene], animations: [] } as unknown as GLTF;
}

type DeferredGltf = ReturnType<typeof deferred<GLTF>>;

afterEach(() => vi.restoreAllMocks());

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

  it("keeps both fallbacks through failed loads, swaps them on retry, and releases route-owned geometry", async () => {
    const firstLoads = new Map<string, DeferredGltf>(
      models.map((model) => [model.url, deferred<GLTF>()]),
    );
    const retryLoads = new Map<string, DeferredGltf>(
      models.map((model) => [model.url, deferred<GLTF>()]),
    );
    const attempts = new Map<string, number>();
    const load = vi
      .spyOn(GLTFLoader.prototype, "loadAsync")
      .mockImplementation((url) => {
        const count = (attempts.get(url) ?? 0) + 1;
        attempts.set(url, count);
        return (count === 1 ? firstLoads : retryLoads).get(url)!.promise;
      });
    const assets = new SceneAssets();
    const scene = new BestiesScene(assets, () => true, models);
    const fallbacks = models.map((model) => {
      const actor = scene.root.getObjectByName(model.id)!;
      const fallback = actor.getObjectByName(
        "bestie-artwork-fallback",
      ) as THREE.Mesh;
      return {
        actor,
        fallback,
        geometryDispose: vi.spyOn(fallback.geometry, "dispose"),
        materialDispose: vi.spyOn(
          fallback.material as THREE.Material,
          "dispose",
        ),
      };
    });
    expect(assets.getState()).toEqual({ loading: 2, failed: 0 });
    expect(fallbacks.every(({ fallback }) => fallback.visible && fallback.parent)).toBe(
      true,
    );

    for (const pending of firstLoads.values())
      pending.reject(new Error("temporary GLB failure"));
    await vi.waitFor(() => expect(assets.getState()).toEqual({ loading: 0, failed: 2 }));
    expect(
      fallbacks.every(({ actor, fallback }) =>
        actor.getObjectByName("bestie-artwork-fallback") === fallback,
      ),
    ).toBe(true);

    assets.retry();
    expect(load).toHaveBeenCalledTimes(4);
    for (const model of models) {
      const exact = new THREE.Group();
      exact.name = `exact-${model.id}`;
      exact.add(
        new THREE.Mesh(
          new THREE.BoxGeometry(),
          new THREE.MeshBasicMaterial(),
        ),
      );
      retryLoads.get(model.url)!.resolve(gltf(exact));
    }
    await vi.waitFor(() =>
      expect(
        models.every((model) =>
          scene.root.getObjectByName(`exact-${model.id}`),
        ),
      ).toBe(true),
    );
    for (const [index, model] of models.entries()) {
      const lifecycle = fallbacks[index]!;
      expect(lifecycle.fallback.parent).toBeNull();
      expect(lifecycle.geometryDispose).toHaveBeenCalledOnce();
      expect(lifecycle.materialDispose).toHaveBeenCalledOnce();
      expect(lifecycle.actor.getObjectByName(`exact-${model.id}`)).toBeTruthy();
    }

    const attachedDisposals = models.map((model) => {
      const mesh = scene.root
        .getObjectByName(`exact-${model.id}`)!
        .children[0] as THREE.Mesh;
      return {
        geometry: vi.spyOn(mesh.geometry, "dispose"),
        material: vi.spyOn(mesh.material as THREE.Material, "dispose"),
      };
    });
    scene.dispose();
    disposeTree(scene.root);
    for (const disposal of attachedDisposals) {
      expect(disposal.geometry).toHaveBeenCalledOnce();
      expect(disposal.material).toHaveBeenCalledOnce();
    }
    for (const lifecycle of fallbacks) {
      expect(lifecycle.geometryDispose).toHaveBeenCalledOnce();
      expect(lifecycle.materialDispose).toHaveBeenCalledOnce();
    }
    assets.dispose();
    await Promise.resolve();
  });
});
