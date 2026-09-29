// @vitest-environment node
/** Issue #103: real multi-primitive enemy GLBs use the exported animation envelope. */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { SceneAssets } from "../../src/game/scene-assets";

const pathFor = (name: string) => new URL(
  `../../docs/assets/media/${name}/v001/${name}.glb`, import.meta.url,
);

beforeAll(() => {
  const globals = globalThis as { self?: unknown; createImageBitmap?: unknown };
  globals.self ??= globalThis;
  globals.createImageBitmap ??= async () => ({ width: 1024, height: 1024, close() {} });
  vi.spyOn(THREE.ImageBitmapLoader.prototype, "load").mockImplementation(
    (_url, onLoad) => {
      const bitmap = { width: 1024, height: 1024, close() {} } as ImageBitmap;
      queueMicrotask(() => onLoad?.(bitmap));
      return bitmap;
    },
  );
  vi.spyOn(GLTFLoader.prototype, "loadAsync").mockImplementation(
    function (this: GLTFLoader, url: string): Promise<GLTF> {
      const name = url.split("/").at(-1)!.replace(/\.glb$/, "");
      const bytes = readFileSync(pathFor(name));
      return this.parseAsync(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        "",
      );
    },
  );
});

afterAll(() => vi.restoreAllMocks());

function skinned(root: THREE.Object3D): THREE.SkinnedMesh[] {
  const meshes: THREE.SkinnedMesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh) meshes.push(object);
  });
  return meshes;
}

function skinnedCube(): THREE.SkinnedMesh {
  const geometry = new THREE.BoxGeometry();
  const count = geometry.getAttribute("position").count;
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(new Array(count * 4).fill(0), 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(
    Array.from({ length: count }, () => [1, 0, 0, 0]).flat(), 4,
  ));
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
  const bone = new THREE.Bone();
  mesh.add(bone);
  mesh.bind(new THREE.Skeleton([bone]));
  return mesh;
}

describe("animated skinned mesh culling", () => {
  for (const [name, clipName, clipTime] of [
    ["bin-chicken", "defeat", 1.4],
    ["inator-monster", "defeat", 1.0],
    ["demon-band-idol", "attack", 1.4],
    ["putty-grunt", "defeat", 1.0],
    ["lab-robot", "defeat", 1.0],
    ["radio-host-showman", "attack", 1.25],
  ] as const) {
    it(`fits every ${name} primitive to its exported envelope through ${clipName}`, async () => {
      const assets = new SceneAssets();
      const target = new THREE.Group();
      let clips: THREE.AnimationClip[] = [];
      assets.attach(`/${name}.glb`, target, () => true, (_root, loaded) => { clips = loaded; });
      await vi.waitFor(() => expect(target.children).toHaveLength(1));
      const root = target.children[0]!;
      const meshes = skinned(root);
      expect(meshes.length).toBeGreaterThan(1);
      for (const mesh of meshes) {
        const holder = mesh.parent!;
        const envelope = holder.userData.model_space_bounds_y_up as {
          min: [number, number, number]; max: [number, number, number];
        };
        expect(envelope, `${name}: exported node extras`).toBeDefined();
        const expected = new THREE.Box3(
          new THREE.Vector3(...envelope.min),
          new THREE.Vector3(...envelope.max),
        );
        expect(mesh.boundingBox!.min.distanceTo(expected.min)).toBeLessThan(1e-5);
        expect(mesh.boundingBox!.max.distanceTo(expected.max)).toBeLessThan(1e-5);
        expect(mesh.frustumCulled).toBe(true);
      }
      const clip = clips.find((entry) => entry.name === clipName)!;
      expect(clip).toBeDefined();
      const mixer = new THREE.AnimationMixer(root);
      mixer.clipAction(clip).play();
      mixer.setTime(clipTime);
      root.updateMatrixWorld(true);
      const vertex = new THREE.Vector3();
      for (const mesh of meshes) {
        const positions = mesh.geometry.getAttribute("position");
        for (let index = 0; index < positions.count; index += 1) {
          mesh.getVertexPosition(index, vertex);
          expect(mesh.boundingSphere!.distanceToPoint(vertex), `${name} ${mesh.name} vertex ${index}`)
            .toBeLessThan(1e-4);
        }
      }
      mixer.stopAllAction();
      assets.dispose();
    });
  }

  it("disables culling for a skinned attachment with no trustworthy envelope", async () => {
    const source = new THREE.Group();
    source.add(skinnedCube());
    vi.mocked(GLTFLoader.prototype.loadAsync).mockResolvedValueOnce(
      { scene: source, scenes: [source], animations: [] } as unknown as GLTF,
    );
    const assets = new SceneAssets();
    const target = new THREE.Group();
    assets.attach("/without-envelope.glb", target, () => true);
    await vi.waitFor(() => expect(target.children).toHaveLength(1));
    const attached = skinned(target)[0]!;
    expect(attached.frustumCulled).toBe(false);
    expect(attached.boundingSphere).toBeNull();
    assets.dispose();
  });

  it("converts a parent envelope into a transformed primitive's local space", async () => {
    const source = new THREE.Group();
    const holder = new THREE.Group();
    holder.position.set(5, 1, -2);
    holder.userData.model_space_bounds_y_up = {
      min: [1, -1, -1], max: [3, 1, 1],
    };
    const mesh = skinnedCube();
    mesh.position.x = 2;
    holder.add(mesh);
    source.add(holder);
    vi.mocked(GLTFLoader.prototype.loadAsync).mockResolvedValueOnce(
      { scene: source, scenes: [source], animations: [] } as unknown as GLTF,
    );
    const assets = new SceneAssets();
    const target = new THREE.Group();
    assets.attach("/transformed.glb", target, () => true);
    await vi.waitFor(() => expect(target.children).toHaveLength(1));
    const attached = skinned(target)[0]!;
    expect(attached.boundingBox!.min.toArray()).toEqual([-1, -1, -1]);
    expect(attached.boundingBox!.max.toArray()).toEqual([1, 1, 1]);
    expect(attached.frustumCulled).toBe(true);
    assets.dispose();
  });

  it("keeps an older real skinned enemy visible when its GLB has no envelope", async () => {
    const assets = new SceneAssets();
    const target = new THREE.Group();
    assets.attach("/rat-pit-boss.glb", target, () => true);
    await vi.waitFor(() => expect(target.children).toHaveLength(1));
    const meshes = skinned(target);
    expect(meshes.length).toBeGreaterThan(1);
    expect(meshes.every((mesh) => mesh.frustumCulled === false)).toBe(true);
    assets.dispose();
  });
});
