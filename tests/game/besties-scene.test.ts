import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { BestiesScene } from "../../src/game/besties-scene";
import {
  BESTIES_PHASE_SECONDS,
  BestiesSimulation,
  nearestBestiesActor,
  type BestieActorId,
  type BestiesFrame,
  type BestiesPhase,
} from "../../src/game/besties";
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

function animationAssets(): SceneAssets {
  return {
    attach: vi.fn(
      (
        _url: string,
        target: THREE.Object3D,
        _valid: () => boolean,
        ready?: (root: THREE.Group, clips: THREE.AnimationClip[]) => void,
      ) => {
        const loaded = new THREE.Group();
        const rig = new THREE.Group();
        rig.name = "test-rig";
        for (const [name, x, y] of [
          ["head", 0, 1.25],
          ["hand_L", -0.4, 0.8],
          ["hand_R", 0.4, 0.8],
        ] as const) {
          const bone = new THREE.Bone();
          bone.name = name;
          bone.position.set(x, y, 0);
          rig.add(bone);
        }
        loaded.add(rig);
        target.add(loaded);
        const track = (axis: "x" | "y" | "z", values: number[]) =>
          new THREE.NumberKeyframeTrack(
            `test-rig.position[${axis}]`,
            [0, 0.5, 1],
            values,
          );
        ready?.(loaded, [
          new THREE.AnimationClip("idle", 1, [track("y", [0, 0.2, 0])]),
          new THREE.AnimationClip("attack", 1, [track("z", [0, -0.6, 0])]),
          new THREE.AnimationClip("hit", 1, [track("x", [0, 0.5, 0])]),
          new THREE.AnimationClip("defeat", 1, [track("y", [0, -0.5, -0.5])]),
          new THREE.AnimationClip("cheer", 1, [track("y", [0, 0.5, 0])]),
          new THREE.AnimationClip("high-five", 1, [track("x", [0, 0.4, 0])]),
          new THREE.AnimationClip("dizzy", 1, [track("z", [0, 0.3, 0])]),
        ]);
      },
    ),
  } as unknown as SceneAssets;
}

function advanceTo(
  simulation: BestiesSimulation,
  phase: BestiesPhase,
  progress = 0,
): BestiesFrame {
  let frame = simulation.step({
    player: { x: 0, y: 0, z: -25 },
    deltaSeconds: 0,
    active: true,
    defeated: false,
  }).frame;
  for (let index = 0; index < 400; index += 1) {
    if (frame.phase === phase && frame.phaseProgress >= progress) return frame;
    frame = simulation.step({
      player: { x: 0, y: 0, z: -25 },
      deltaSeconds: 0.05,
      active: true,
      defeated: false,
    }).frame;
  }
  throw new Error(`Besties routine did not reach ${phase} at ${progress}`);
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
    expect(
      fallbacks.every(({ fallback }) => fallback.visible && fallback.parent),
    ).toBe(true);

    for (const pending of firstLoads.values())
      pending.reject(new Error("temporary GLB failure"));
    await vi.waitFor(() =>
      expect(assets.getState()).toEqual({ loading: 0, failed: 2 }),
    );
    expect(
      fallbacks.every(
        ({ actor, fallback }) =>
          actor.getObjectByName("bestie-artwork-fallback") === fallback,
      ),
    ).toBe(true);

    assets.retry();
    expect(load).toHaveBeenCalledTimes(4);
    for (const model of models) {
      const exact = new THREE.Group();
      exact.name = `exact-${model.id}`;
      exact.add(
        new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()),
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
      const mesh = scene.root.getObjectByName(`exact-${model.id}`)!
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

describe("BestiesScene animation state", () => {
  it("reports rendered transforms, animation poses, and effective visibility", () => {
    const scene = new BestiesScene(animationAssets(), () => true, models);
    const parent = new THREE.Group();
    parent.position.set(3, 0.5, -4);
    parent.add(scene.root);
    const simulation = new BestiesSimulation();
    const early = advanceTo(simulation, "pink-warning", 0.2);

    scene.update(early, 0, 11, 0);

    const pinkRoot = scene.root.getObjectByName("bestie-pink")!;
    const earlyPink = scene
      .inspectVisuals()
      .find((actor) => actor.id === "bestie-pink")!;
    expectPosition(earlyPink.position, worldPosition(scene, "bestie-pink"));
    expect(earlyPink).toMatchObject({
      visible: true,
      clip: "attack",
      pose: {
        head: expect.any(Object),
        leftHand: expect.any(Object),
        rightHand: expect.any(Object),
      },
    });

    const late = advanceTo(simulation, "pink-warning", 0.8);
    scene.update(late, 0, 11, 0);
    const latePink = scene
      .inspectVisuals()
      .find((actor) => actor.id === "bestie-pink")!;
    expect(latePink.pose?.head).not.toEqual(earlyPink.pose?.head);

    scene.root.visible = false;
    expect(scene.inspectVisuals().every((actor) => !actor.visible)).toBe(true);
    expect(pinkRoot.visible).toBe(true);
    scene.root.visible = true;

    const defeated = simulation.step({
      player: { x: 0, y: 0, z: -22 },
      deltaSeconds: 0,
      active: true,
      defeated: true,
    }).frame;
    scene.update(defeated, 1.01, 0, 1.01);
    expect(scene.inspectVisuals()).toEqual([
      expect.objectContaining({
        id: "bestie-pink",
        visible: false,
        clip: "defeat",
      }),
      expect.objectContaining({
        id: "bestie-black",
        visible: false,
        clip: "defeat",
      }),
    ]);

    scene.dispose();
  });

  it("evaluates scrubbed attacks and resumes a looping clip after their transition", () => {
    const scene = new BestiesScene(animationAssets(), () => true, models);
    const simulation = new BestiesSimulation();
    const pink = scene.root.getObjectByName("bestie-pink")!;
    const pinkRig = pink.getObjectByName("test-rig")!;

    const warning = advanceTo(simulation, "pink-warning", 0.5);
    scene.update(warning, 0.6, 11, 0.6);
    expect(pink.position.z).toBeGreaterThan(0.2);
    expect(pinkRig.position.z).toBeLessThan(-0.1);

    const cheer = advanceTo(simulation, "black-warning", 0);
    scene.update(cheer, 0.25, 11, 3.25);
    const firstCheerY = pinkRig.position.y;
    scene.update(cheer, 0.25, 11, 3.5);
    expect(pinkRig.position.y).not.toBeCloseTo(firstCheerY, 5);

    scene.dispose();
  });

  it("turns each actor toward the supplied player position", () => {
    const scene = new BestiesScene(animationAssets(), () => true, models);
    const simulation = new BestiesSimulation();
    const warning = advanceTo(simulation, "pink-warning", 0.5);
    const player = { x: 5, y: 0, z: -22 };
    scene.root.position.z = -22;

    scene.update(warning, 0, 11, 0, null, player);
    for (const id of ["bestie-pink", "bestie-black"] as const) {
      const actor = scene.root.getObjectByName(id)!;
      const expected =
        Math.atan2(player.x - actor.position.x, -actor.position.z) + Math.PI;
      expect(actor.rotation.y).toBeCloseTo(expected, 8);
    }

    scene.dispose();
  });

  it("scrubs the high-five clip through its authored contact pose", () => {
    const scene = new BestiesScene(animationAssets(), () => true, models);
    const simulation = new BestiesSimulation();
    const pinkRig = scene.root
      .getObjectByName("bestie-pink")!
      .getObjectByName("test-rig")!;
    const blackRig = scene.root
      .getObjectByName("bestie-black")!
      .getObjectByName("test-rig")!;

    const highFive = advanceTo(simulation, "high-five", 0.5);
    expect(highFive.phaseProgress).toBeGreaterThanOrEqual(0.5);
    scene.update(highFive, BESTIES_PHASE_SECONDS["high-five"] / 2, 11, 7.2);
    expect(pinkRig.position.x).toBeGreaterThan(0.25);
    expect(blackRig.position.x).toBeGreaterThan(0.25);

    scene.dispose();
  });

  it("plays shared-health damage feedback only on the supplied visible actor", () => {
    const scene = new BestiesScene(animationAssets(), () => true, models);
    const simulation = new BestiesSimulation();
    const pinkRig = scene.root
      .getObjectByName("bestie-pink")!
      .getObjectByName("test-rig")!;
    const blackRig = scene.root
      .getObjectByName("bestie-black")!
      .getObjectByName("test-rig")!;
    const dizzy = advanceTo(simulation, "dizzy", 0.25);
    scene.update(dizzy, 0.15, 11, 8.2);

    scene.update(dizzy, 0.15, 9, 8.35, "bestie-pink");
    expect(pinkRig.position.x).toBeGreaterThan(0.1);
    expect(blackRig.position.x).toBeCloseTo(0, 5);
    expect(blackRig.position.z).not.toBeCloseTo(0, 5);

    scene.update(dizzy, 0.5, 9, 8.85, "bestie-pink");
    scene.update(dizzy, 0.15, 9, 9, "bestie-pink");
    expect(pinkRig.position.x).toBeCloseTo(0, 5);
    expect(pinkRig.position.z).not.toBeCloseTo(0, 5);

    scene.dispose();
  });

  it.each(["pink-warning", "dizzy"] as const)(
    "plays and then hides a defeat received during %s",
    (sourcePhase) => {
      const scene = new BestiesScene(animationAssets(), () => true, models);
      const simulation = new BestiesSimulation();
      const pink = scene.root.getObjectByName("bestie-pink")!;
      const black = scene.root.getObjectByName("bestie-black")!;
      const pinkRig = pink.getObjectByName("test-rig")!;
      const source = advanceTo(simulation, sourcePhase, 0.25);
      scene.update(source, 0.15, 11, 1);

      const defeated = simulation.step({
        player: { x: 0, y: 0, z: -22 },
        deltaSeconds: 0,
        active: true,
        defeated: true,
      }).frame;
      scene.update(defeated, 0.25, 0, 1.25);
      expect(pink.visible).toBe(true);
      expect(black.visible).toBe(true);
      expect(pinkRig.position.y).toBeLessThan(-0.1);

      scene.update(defeated, 0.7, 0, 1.95);
      expect(pink.visible).toBe(true);
      expect(black.visible).toBe(true);
      scene.update(defeated, 0.06, 0, 2.01);
      expect(pink.visible).toBe(false);
      expect(black.visible).toBe(false);
      scene.update(defeated, 2, 0, 4.01);
      expect(pink.visible).toBe(false);
      expect(black.visible).toBe(false);

      scene.dispose();
    },
  );

  it("removes standing fallbacks after a bounded defeated state", () => {
    const assets = { attach: vi.fn() } as unknown as SceneAssets;
    const scene = new BestiesScene(assets, () => true, models);
    const simulation = new BestiesSimulation();
    advanceTo(simulation, "pink-warning");
    const defeated = simulation.step({
      player: { x: 0, y: 0, z: -22 },
      deltaSeconds: 0,
      active: true,
      defeated: true,
    }).frame;
    const pink = scene.root.getObjectByName("bestie-pink")!;
    const black = scene.root.getObjectByName("bestie-black")!;

    scene.update(defeated, 0.59, 0, 0.59);
    expect(pink.visible).toBe(true);
    expect(black.visible).toBe(true);
    scene.update(defeated, 0.02, 0, 0.61);
    expect(pink.visible).toBe(false);
    expect(black.visible).toBe(false);

    scene.dispose();
  });
});

describe("BestiesScene warnings", () => {
  it("draws Pink's full announced sweep corridor from its frame geometry", () => {
    const assets = { attach: vi.fn() } as unknown as SceneAssets;
    const scene = new BestiesScene(assets, () => true, models);
    const simulation = new BestiesSimulation();
    const opening = advanceTo(simulation, "pink-warning");
    const foam = opening.hazards[0];
    if (!foam || foam.kind !== "foam-bar")
      throw new Error("Expected Pink's warning frame");
    const aimed: BestiesFrame = {
      ...opening,
      hazards: [
        {
          ...foam,
          center: { x: -2, y: 0.2, z: -23 },
          halfExtents: { x: 0.4, y: 0.2, z: 0.3 },
          sweep: {
            from: { x: -2, y: 0.2, z: -23 },
            to: { x: 3, y: 0.2, z: -21 },
          },
        },
      ],
    };

    scene.update(aimed, 0, 11, 0);
    const warning = scene.root.getObjectByName("besties-warning")!;
    expect(warning.visible).toBe(true);
    expect(warning.position.x).toBeCloseTo(0.5, 8);
    expect(warning.position.y).toBeCloseTo(0.028, 8);
    expect(warning.position.z).toBeCloseTo(0, 8);
    expect(warning.scale.x).toBeCloseTo(5.8, 8);
    expect(warning.scale.y).toBeCloseTo(0.025, 8);
    expect(warning.scale.z).toBeCloseTo(2.6, 8);

    scene.dispose();
  });
});

describe("authored Besties world alignment", () => {
  it("draws translated warning and damage boxes at the simulation geometry and targets visible actors", () => {
    const origin = { x: 8, y: 0, z: -112 };
    const simulation = new BestiesSimulation(origin);
    const scene = new BestiesScene(animationAssets(), () => true, models);
    scene.root.position.copy(origin);
    const player = { x: 8, y: 0, z: -110 };
    for (let i = 0; i < 100; i++) {
      const frame = simulation.step({
        player,
        deltaSeconds: 0.05,
        active: true,
        defeated: false,
        aimAtPlayer: true,
      }).frame;
      scene.update(frame, 0.05, 10, i * 0.05, null, player);
      scene.root.updateMatrixWorld(true);
      const target = nearestBestiesActor(frame, player);
      expectPosition(
        scene.targetPosition(player),
        new THREE.Vector3(
          target.position.x,
          target.position.y,
          target.position.z,
        ),
      );
      const hazard = frame.hazards[0];
      if (!hazard) continue;
      const mesh = scene.root.getObjectByName(
        hazard.damaging ? "besties-hazard" : "besties-warning",
      )!;
      const rendered = mesh.getWorldPosition(new THREE.Vector3());
      const expectedX =
        !hazard.damaging && hazard.kind === "foam-bar"
          ? (hazard.sweep.from.x + hazard.sweep.to.x) / 2
          : hazard.center.x;
      expect(rendered.x).toBeCloseTo(expectedX, 8);
      expect(rendered.z).toBeCloseTo(hazard.center.z, 8);
      expect(mesh.visible).toBe(true);
    }
    scene.dispose();
  });
});
