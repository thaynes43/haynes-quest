// @vitest-environment node
/**
 * WO074 probe: the real bestie-pink/bestie-black v001 GLBs (docs/assets/media)
 * driven through the production SceneAssets attachment path and the
 * BestiesScene renderer, with the real BestiesSimulation supplying frames.
 * Sampled skinned vertices, not clip inventory, prove pose motion in every
 * routine phase across two cycles, the single-recipient hit clip, the
 * authored defeat timing and the shared anchor/facing contract.
 *
 * Node has no ImageBitmap decoder or asset server: three's FileLoader is
 * pointed at the checked-in bytes and ImageBitmapLoader returns a stub
 * bitmap. Geometry, skins, materials and animation tracks are untouched.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { BestiesScene } from "../../src/game/besties-scene";
import {
  BESTIES_ARENA_CENTER,
  BESTIES_PHASE_SECONDS,
  BestiesSimulation,
  bestiesActorOffset,
  nearestBestiesActor,
  type BestieActorId,
  type BestiesFrame,
  type BestiesPhase,
  type BestiesStepOptions,
} from "../../src/game/besties";
import { SceneAssets } from "../../src/game/scene-assets";
import type { DuoParodyArtwork } from "../../src/game/scene-catalog";
import type { PositionSnapshot } from "../../src/game/types";

const mediaRoot = path.resolve("docs/assets/media");
const prefix = "/studio/assets/media/";
const models = [
  { id: "bestie-pink", url: `${prefix}bestie-pink/v001/bestie-pink.glb` },
  { id: "bestie-black", url: `${prefix}bestie-black/v001/bestie-black.glb` },
] as const satisfies DuoParodyArtwork["models"];
const ids: readonly BestieActorId[] = ["bestie-pink", "bestie-black"];
const DT = 1 / 60;
const entry: PositionSnapshot = { x: 0, y: 0, z: -19.5 };

beforeAll(() => {
  const globals = globalThis as {
    self?: unknown;
    createImageBitmap?: unknown;
  };
  globals.self ??= globalThis;
  globals.createImageBitmap ??= async () => ({
    width: 1024,
    height: 1024,
    close() {},
  });
  THREE.FileLoader.prototype.load = function (
    url: string,
    onLoad?: (data: string | ArrayBuffer) => void,
    _onProgress?: unknown,
    onError?: (error: unknown) => void,
  ) {
    const relative = url.startsWith(prefix) ? url.slice(prefix.length) : null;
    if (!relative) {
      onError?.(new Error(`unexpected asset url ${url}`));
      return;
    }
    readFile(path.join(mediaRoot, relative)).then(
      (bytes) =>
        onLoad?.(
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ),
        ),
      (error) => onError?.(error),
    );
  } as unknown as typeof THREE.FileLoader.prototype.load;
  THREE.ImageBitmapLoader.prototype.load = function (
    _url: string,
    onLoad?: (bitmap: ImageBitmap) => void,
  ) {
    const bitmap = { width: 1024, height: 1024, close() {} };
    queueMicrotask(() => onLoad?.(bitmap as unknown as ImageBitmap));
    return bitmap;
  } as unknown as typeof THREE.ImageBitmapLoader.prototype.load;
});

function actorRoot(scene: BestiesScene, id: BestieActorId): THREE.Object3D {
  const root = scene.root.getObjectByName(id);
  if (!root) throw new Error(`missing rendered actor ${id}`);
  return root;
}

function skinnedMeshes(root: THREE.Object3D): THREE.SkinnedMesh[] {
  const out: THREE.SkinnedMesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh) out.push(object);
  });
  return out;
}

/**
 * Skinned vertex positions in the mesh's own frame (the actor root transform
 * cancels through bindMatrixInverse), so deltas measure animation alone.
 * Caller must have run updateMatrixWorld(true) from an ancestor.
 */
function samplePose(root: THREE.Object3D, stride = 53): Float64Array {
  const values: number[] = [];
  const vertex = new THREE.Vector3();
  for (const mesh of skinnedMeshes(root)) {
    mesh.skeleton.update();
    const count = mesh.geometry.attributes.position!.count;
    for (let index = 0; index < count; index += stride) {
      mesh.getVertexPosition(index, vertex);
      values.push(vertex.x, vertex.y, vertex.z);
    }
  }
  return Float64Array.from(values);
}

function maxDiff(a: Float64Array, b: Float64Array): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let max = 0;
  for (let index = 0; index < a.length; index += 3) {
    max = Math.max(
      max,
      Math.hypot(
        a[index]! - b[index]!,
        a[index + 1]! - b[index + 1]!,
        a[index + 2]! - b[index + 2]!,
      ),
    );
  }
  return max;
}

interface Attached {
  scene: BestiesScene;
  top: THREE.Group;
  assets: SceneAssets;
}

/** Mirrors scene.ts: the enemy visual sits at the arena centre and owns the duo root. */
async function attachedScene(): Promise<Attached> {
  const assets = new SceneAssets();
  const top = new THREE.Group();
  const model = new THREE.Group();
  model.position.set(
    BESTIES_ARENA_CENTER.x,
    BESTIES_ARENA_CENTER.y,
    BESTIES_ARENA_CENTER.z,
  );
  top.add(model);
  const scene = new BestiesScene(assets, () => true, models);
  model.add(scene.root);
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const ready = ids.every(
      (id) =>
        skinnedMeshes(actorRoot(scene, id)).length > 0 &&
        !actorRoot(scene, id).getObjectByName("bestie-artwork-fallback"),
    );
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  for (const id of ids)
    expect(skinnedMeshes(actorRoot(scene, id)).length).toBeGreaterThan(0);
  return { scene, top, assets };
}

function step(
  simulation: BestiesSimulation,
  player: PositionSnapshot,
  deltaSeconds: number,
  extra: Partial<BestiesStepOptions> = {},
) {
  return simulation.step({
    player,
    deltaSeconds,
    active: true,
    defeated: false,
    aimAtPlayer: true,
    ...extra,
  });
}

function advanceTo(
  simulation: BestiesSimulation,
  phase: BestiesPhase,
  progress = 0,
  player: PositionSnapshot = entry,
): BestiesFrame {
  let frame = step(simulation, player, 0).frame;
  for (let index = 0; index < 2_000; index += 1) {
    if (frame.phase === phase && frame.phaseProgress >= progress) return frame;
    frame = step(simulation, player, DT).frame;
  }
  throw new Error(`routine did not reach ${phase}@${progress}`);
}

describe("Authored Besties animation integration", () => {
  it("both authored GLBs expose the eight exact clips at the recorded durations", async () => {
    const expected: Record<string, number> = {
      idle: 2.4,
      move: 1.2,
      attack: 1.6,
      hit: 0.6,
      defeat: 2,
      cheer: 2,
      "high-five": 1.6,
      dizzy: 2.4,
    };
    for (const model of models) {
      const gltf = await new GLTFLoader().loadAsync(model.url);
      const durations = Object.fromEntries(
        gltf.animations.map((clip) => [clip.name, clip.duration]),
      );
      expect(Object.keys(durations).sort()).toEqual(
        Object.keys(expected).sort(),
      );
      for (const [name, duration] of Object.entries(expected))
        expect(durations[name]).toBeCloseTo(duration, 2);
      expect(skinnedMeshes(gltf.scene).length).toBeGreaterThan(0);
    }
  }, 60_000);

  it("moves the authored geometry in every routine phase of two full cycles (no frozen mixer after scrubbed clips)", async () => {
    const { scene, top } = await attachedScene();
    const simulation = new BestiesSimulation();
    let frame = step(simulation, entry, 0).frame;
    expect(frame.phase).toBe("pink-warning");
    let elapsed = 0;
    scene.update(frame, DT, 6, elapsed, null, entry);
    top.updateMatrixWorld(true);
    const previous = new Map<BestieActorId, Float64Array>();
    for (const id of ids) previous.set(id, samplePose(actorRoot(scene, id)));
    type Bucket = { frames: number; moving: number; max: number };
    const motion = new Map<string, Bucket>();
    const totalFrames = Math.round(27 / DT); // two cycles (13 s each) plus a second pink warning
    for (let index = 0; index < totalFrames; index += 1) {
      frame = step(simulation, entry, DT).frame;
      elapsed += DT;
      scene.update(frame, DT, 6, elapsed, null, entry);
      top.updateMatrixWorld(true);
      for (const id of ids) {
        const pose = samplePose(actorRoot(scene, id));
        expect(pose.every(Number.isFinite)).toBe(true);
        const delta = maxDiff(previous.get(id)!, pose);
        previous.set(id, pose);
        const key = `${frame.cycleIndex}:${frame.phase}:${id}`;
        const bucket = motion.get(key) ?? { frames: 0, moving: 0, max: 0 };
        bucket.frames += 1;
        if (delta > 1e-4) bucket.moving += 1;
        bucket.max = Math.max(bucket.max, delta);
        motion.set(key, bucket);
      }
    }
    const rows = [...motion.entries()]
      .map(
        ([key, bucket]) =>
          `${key}: ${bucket.moving}/${bucket.frames} frames moved, max step ${bucket.max.toFixed(4)} m`,
      )
      .join("\n");
    console.log(`WO074 real-GLB pose motion by cycle:phase:actor\n${rows}`);
    const routine: BestiesPhase[] = [
      "pink-warning",
      "pink-trick",
      "black-warning",
      "black-trick",
      "high-five",
      "dizzy",
    ];
    for (const cycle of [0, 1]) {
      for (const phase of routine) {
        for (const id of ids) {
          const bucket = motion.get(`${cycle}:${phase}:${id}`);
          expect(
            bucket,
            `${cycle}:${phase}:${id} was never rendered`,
          ).toBeDefined();
          expect(
            bucket!.moving / bucket!.frames,
            `${cycle}:${phase}:${id} moved on ${bucket!.moving}/${bucket!.frames} frames`,
          ).toBeGreaterThan(0.7); // authored clips hold their final pose; see the clip-tail probe
          expect(bucket!.max).toBeGreaterThan(1e-3);
        }
      }
    }
  }, 120_000);

  it("plays the real hit clip on the struck actor only, and never when the runtime passes null", async () => {
    const control = await attachedScene();
    const struck = await attachedScene();
    const simulation = new BestiesSimulation();
    let frame = advanceTo(simulation, "dizzy", 0.05);
    let elapsed = 0;
    const render = (
      attached: Attached,
      hp: number,
      hitActor: BestieActorId | null | undefined,
    ) => {
      attached.scene.update(frame, DT, hp, elapsed, hitActor, entry);
      attached.top.updateMatrixWorld(true);
    };
    render(control, 6, null);
    render(struck, 6, null);
    // Authoritative HP drops; createGame supplies the actor nearest the attack.
    frame = step(simulation, entry, DT).frame;
    elapsed += DT;
    render(control, 6, null);
    render(struck, 5, "bestie-black");
    let pinkDiverged = 0;
    let blackDiverged = 0;
    let blackFrozen = 0;
    let previousBlack = samplePose(actorRoot(struck.scene, "bestie-black"));
    const hitFrames = Math.round(0.55 / DT);
    for (let index = 0; index < hitFrames; index += 1) {
      frame = step(simulation, entry, DT).frame;
      elapsed += DT;
      render(control, 6, null);
      render(struck, 5, null);
      const pink = maxDiff(
        samplePose(actorRoot(control.scene, "bestie-pink")),
        samplePose(actorRoot(struck.scene, "bestie-pink")),
      );
      const black = maxDiff(
        samplePose(actorRoot(control.scene, "bestie-black")),
        samplePose(actorRoot(struck.scene, "bestie-black")),
      );
      const blackNow = samplePose(actorRoot(struck.scene, "bestie-black"));
      if (maxDiff(previousBlack, blackNow) < 1e-6) blackFrozen += 1;
      previousBlack = blackNow;
      if (pink > 1e-9) pinkDiverged += 1;
      if (black > 1e-3) blackDiverged += 1;
    }
    console.log(
      `WO074 hit clip: pink diverged on ${pinkDiverged}/${hitFrames} frames, black diverged on ${blackDiverged}/${hitFrames}, black frozen on ${blackFrozen}`,
    );
    expect(pinkDiverged).toBe(0);
    expect(blackDiverged).toBeGreaterThan(hitFrames * 0.8);
    expect(blackFrozen).toBeLessThan(hitFrames * 0.5); // the hit clip's authored end hold

    // A null recipient (createGame's initial value) applies no hit clip at all.
    const quiet = await attachedScene();
    const twin = await attachedScene();
    const simulation2 = new BestiesSimulation();
    frame = advanceTo(simulation2, "dizzy", 0.05);
    elapsed = 0;
    for (const attached of [quiet, twin]) {
      attached.scene.update(frame, DT, 6, elapsed, null, entry);
      attached.top.updateMatrixWorld(true);
    }
    frame = step(simulation2, entry, DT).frame;
    quiet.scene.update(frame, DT, 6, elapsed, null, entry);
    twin.scene.update(frame, DT, 5, elapsed, null, entry);
    let identical = 0;
    for (let index = 0; index < 20; index += 1) {
      frame = step(simulation2, entry, DT).frame;
      elapsed += DT;
      quiet.scene.update(frame, DT, 6, elapsed, null, entry);
      twin.scene.update(frame, DT, 5, elapsed, null, entry);
      quiet.top.updateMatrixWorld(true);
      twin.top.updateMatrixWorld(true);
      const same = ids.every(
        (id) =>
          maxDiff(
            samplePose(actorRoot(quiet.scene, id)),
            samplePose(actorRoot(twin.scene, id)),
          ) < 1e-9,
      );
      if (same) identical += 1;
    }
    expect(identical).toBe(20);
  }, 120_000);

  it("plays the authored 2.0 s defeat clip after victory disables combat, then hides both actors", async () => {
    const { scene, top } = await attachedScene();
    const simulation = new BestiesSimulation();
    let frame = advanceTo(simulation, "dizzy", 0.2);
    let elapsed = 0;
    scene.update(frame, DT, 1, elapsed, null, entry);
    top.updateMatrixWorld(true);
    // Mirrors createGame after the winning blow: combat inactive, encounter defeated.
    const result = step(simulation, entry, DT, {
      active: false,
      defeated: true,
    });
    frame = result.frame;
    expect(result.phaseEntered).toBe("defeated");
    expect(frame.hazards).toEqual([]);
    expect(frame.actors.map((actor) => actor.clip)).toEqual([
      "defeat",
      "defeat",
    ]);
    const previous = new Map<BestieActorId, Float64Array>();
    let hiddenAt: number | null = null;
    let moving = 0;
    let frames = 0;
    for (let index = 0; index < Math.round(3 / DT); index += 1) {
      frame = step(simulation, entry, DT, {
        active: false,
        defeated: true,
      }).frame;
      elapsed += DT;
      scene.update(frame, DT, 0, elapsed, null, entry);
      top.updateMatrixWorld(true);
      const visible = ids.map((id) => actorRoot(scene, id).visible);
      if (hiddenAt === null && visible.every((flag) => !flag))
        hiddenAt = index * DT;
      if (visible.some((flag) => flag) && hiddenAt !== null)
        throw new Error("an actor reappeared after the defeat clip");
      if (hiddenAt === null) {
        frames += 1;
        let moved = false;
        for (const id of ids) {
          const pose = samplePose(actorRoot(scene, id));
          const last = previous.get(id);
          if (last && maxDiff(last, pose) > 1e-4) moved = true;
          previous.set(id, pose);
        }
        if (moved) moving += 1;
      }
    }
    console.log(
      `WO074 defeat: both actors hidden after ${hiddenAt?.toFixed(3)} s; geometry moved on ${moving}/${frames} visible frames`,
    );
    expect(hiddenAt).not.toBeNull();
    expect(hiddenAt!).toBeGreaterThan(1.95);
    expect(hiddenAt!).toBeLessThan(2.1);
    expect(moving / frames).toBeGreaterThan(0.6); // the defeat clip's authored end hold
    expect(scene.root.getObjectByName("besties-hazard")!.visible).toBe(false);
    expect(scene.root.getObjectByName("besties-warning")!.visible).toBe(false);
  }, 120_000);

  it("renders each actor at the anchor the attack code targets and turns the authored -Z face toward the player", async () => {
    const { scene, top } = await attachedScene();
    const player: PositionSnapshot = { x: 3, y: 0, z: -19.5 };
    for (const [phase, progress] of [
      ["pink-warning", 0.5],
      ["high-five", 0.45],
      ["dizzy", 0.1],
    ] as const) {
      const simulation = new BestiesSimulation();
      const frame = advanceTo(simulation, phase, progress, player);
      scene.update(frame, DT, 6, 0, null, player);
      top.updateMatrixWorld(true);
      for (const actorFrame of frame.actors) {
        const root = actorRoot(scene, actorFrame.id);
        const rendered = root.getWorldPosition(new THREE.Vector3());
        const offset = bestiesActorOffset(frame, actorFrame);
        expect(rendered.x).toBeCloseTo(BESTIES_ARENA_CENTER.x + offset.x, 9);
        expect(rendered.y).toBeCloseTo(BESTIES_ARENA_CENTER.y + offset.y, 9);
        expect(rendered.z).toBeCloseTo(BESTIES_ARENA_CENTER.z + offset.z, 9);
        // runtime.json for both models records forward "-Z".
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
          root.getWorldQuaternion(new THREE.Quaternion()),
        );
        forward.y = 0;
        forward.normalize();
        const toPlayer = new THREE.Vector3(
          player.x - rendered.x,
          0,
          player.z - rendered.z,
        ).normalize();
        expect(forward.dot(toPlayer)).toBeGreaterThan(0.9999);
      }
      const nearest = nearestBestiesActor(frame, player);
      const nearestRendered = actorRoot(scene, nearest.id).getWorldPosition(
        new THREE.Vector3(),
      );
      expect(
        nearestRendered.distanceTo(
          new THREE.Vector3(
            nearest.position.x,
            nearest.position.y,
            nearest.position.z,
          ),
        ),
      ).toBeLessThan(1e-9);
      const target = scene.targetPosition(player)!;
      expect(target.x).toBeCloseTo(nearest.position.x, 9);
      expect(target.z).toBeCloseTo(nearest.position.z, 9);
    }
  }, 60_000);

  it("processes defeat while the routine is paused for recovery, and a recovery restart keeps the aimed geometry", () => {
    const simulation = new BestiesSimulation();
    const aimed = { x: 0.4, y: 0, z: -21.2 };
    advanceTo(simulation, "pink-trick", 0.3, aimed);
    expect(simulation.frame().hazards[0]!.center.z).toBeCloseTo(-21.2, 9);
    simulation.restartThreatenedTrick();
    expect(simulation.frame().phase).toBe("pink-warning");
    expect(simulation.frame().hazards[0]!.center.z).toBeCloseTo(-21.2, 9);
    const paused = step(simulation, aimed, DT, {
      paused: true,
      defeated: true,
      active: false,
    });
    expect(paused.frame.phase).toBe("defeated");
    expect(paused.phaseEntered).toBe("defeated");
    expect(paused.frame.hazards).toEqual([]);
    expect(BESTIES_PHASE_SECONDS.dizzy).toBe(5);
  });
  it("measures each authored clip's trailing static hold on the raw GLB (evidence for the motion thresholds)", async () => {
    const holds: string[] = [];
    for (const model of models) {
      const gltf = await new GLTFLoader().loadAsync(model.url);
      const mixer = new THREE.AnimationMixer(gltf.scene);
      for (const clip of gltf.animations) {
        mixer.stopAllAction();
        const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        action.play();
        const samples = 80;
        let lastMotionAt = 0;
        let previous: Float64Array | null = null;
        for (let index = 0; index <= samples; index += 1) {
          const time = (clip.duration * index) / samples;
          mixer.setTime(time);
          gltf.scene.updateMatrixWorld(true);
          const pose = samplePose(gltf.scene, 29);
          if (previous && maxDiff(previous, pose) > 1e-4) lastMotionAt = time;
          previous = pose;
        }
        const hold = clip.duration - lastMotionAt;
        holds.push(
          `${model.id}/${clip.name}: ${clip.duration.toFixed(2)} s, static tail ${hold.toFixed(3)} s`,
        );
        expect(hold).toBeLessThan(0.6);
        expect(lastMotionAt).toBeGreaterThan(0);
      }
    }
    console.log(`WO074 authored clip tails\n${holds.join("\n")}`);
  }, 60_000);
});
