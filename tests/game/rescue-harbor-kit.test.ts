import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { familyA2Level } from "../../scripts/levels/family/a2";
import { DecorScene } from "../../src/game/decor-scene";
import { SceneAssets } from "../../src/game/scene-assets";
import { authoredSurfaceBounds, authoredSurfaceTopRange, isAuthoredSurfacePiece, type AuthoredLevelDocument } from "../../src/shared/authored-level";
import { decorWorldBounds, themeKitPropsFor } from "../../src/shared/theme-kits";
import familyWorldAV5 from "../../src/shared/levels/family-world-a-v5.json";

const ids = ["lookout-tower-facade", "pier-bollard", "rescue-buoy-stand", "small-boat"] as const;
const props = themeKitPropsFor("harbor");
const level = familyWorldAV5.chapters.find((chapter) => chapter.chapterId === "family-a2")!.level as unknown as AuthoredLevelDocument;
const decor = (level.decor ?? []).filter((entry) => ids.includes(entry.kitPropId as typeof ids[number]));
const surfaces = level.pieces.filter(isAuthoredSurfacePiece);

function bytesFor(id: string): Buffer {
  return readFileSync(new URL(`../../docs/assets/media/rescue-harbor-kit/v001/${id}.glb`, import.meta.url));
}

async function exactModel(id: string) {
  const bytes = bytesFor(id);
  const gltf = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, "");
  gltf.scene.updateMatrixWorld(true);
  return { bytes, gltf, bounds: new THREE.Box3().setFromObject(gltf.scene, true) };
}

function placedBounds(meshes: readonly THREE.InstancedMesh[], index: number): THREE.Box3 {
  const bounds = new THREE.Box3();
  const instance = new THREE.Matrix4();
  const point = new THREE.Vector3();
  for (const mesh of meshes) {
    mesh.getMatrixAt(index, instance);
    instance.premultiply(mesh.matrixWorld);
    const positions = mesh.geometry.attributes.position;
    for (let vertex = 0; vertex < positions.count; vertex++)
      bounds.expandByPoint(point.fromBufferAttribute(positions, vertex).applyMatrix4(instance));
  }
  return bounds;
}

function expectInside(actual: THREE.Box3, allowed: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }, id: string) {
  for (const axis of ["x", "y", "z"] as const) {
    expect(actual.min[axis], `${id}: min ${axis}`).toBeGreaterThanOrEqual(allowed.min[axis] - 1e-4);
    expect(actual.max[axis], `${id}: max ${axis}`).toBeLessThanOrEqual(allowed.max[axis] + 1e-4);
  }
}

describe("Rescue Harbor v001 production kit", () => {
  it("keeps the fixed planning boxes and all 40 placements in the checked-in A2 route", () => {
    expect(level.decor).toEqual(familyA2Level().decor);
    expect(props.map((prop) => prop.id)).toEqual(ids);
    expect(props.map((prop) => prop.bounds)).toEqual([
      { min: { x: -1.8, y: 0, z: -1.8 }, max: { x: 1.8, y: 7, z: 1.8 } },
      { min: { x: -0.3, y: 0, z: -0.3 }, max: { x: 0.3, y: 0.8, z: 0.3 } },
      { min: { x: -0.6, y: 0, z: -0.25 }, max: { x: 0.6, y: 1.8, z: 0.25 } },
      { min: { x: -1.2, y: 0, z: -2.6 }, max: { x: 1.2, y: 1.1, z: 2.6 } },
    ]);
    expect(decor).toHaveLength(40);
    expect(decor.every((entry) => entry.position.y === -1.4)).toBe(true);
    expect(ids.map((id) => decor.filter((entry) => entry.kitPropId === id).length)).toEqual([2, 20, 6, 12]);
    expect(decor.filter((entry) => entry.kitPropId === "lookout-tower-facade").map((entry) => entry.scale)).toEqual([1.5, 3]);
    expect(decor.filter((entry) => entry.kitPropId === "pier-bollard").map((entry) => entry.scale).sort()).toEqual([
      ...Array(10).fill(1.1), ...Array(10).fill(2),
    ]);
    expect(decor.filter((entry) => entry.kitPropId === "rescue-buoy-stand").map((entry) => entry.rotationY).sort()).toEqual([
      ...Array(3).fill(-Math.PI / 2), ...Array(3).fill(Math.PI / 2),
    ]);
    expect(decor.filter((entry) => entry.kitPropId === "small-boat").every((entry) => entry.scale === 0.8)).toBe(true);
  });

  it.each(ids)("%s has pinned opaque vertex-colour geometry inside its planning box", async (id) => {
    const prop = props.find((entry) => entry.id === id)!;
    const { bytes, gltf, bounds } = await exactModel(id);
    expect(prop.glb?.url).toBe(`/studio/assets/media/rescue-harbor-kit/v001/${id}.glb`);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(prop.glb!.sha256);
    expect(bytes.length).toBeLessThanOrEqual(1.5 * 1024 * 1024);
    expect(gltf.animations).toHaveLength(0);
    expect(bounds.min.y).toBeCloseTo(0, 4);
    expectInside(bounds, prop.bounds, id);
    let triangles = 0;
    const materials = new Set<THREE.Material>();
    gltf.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      expect(object).not.toBeInstanceOf(THREE.SkinnedMesh);
      expect(object.geometry.attributes.color).toBeDefined();
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position!.count) / 3;
      for (const material of [object.material].flat()) materials.add(material);
    });
    expect(triangles).toBeGreaterThan(0);
    expect(triangles).toBeLessThanOrEqual(5000);
    expect(materials.size).toBeGreaterThan(0);
    expect(materials.size).toBeLessThanOrEqual(4);
    for (const material of materials) {
      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
      const standard = material as THREE.MeshStandardMaterial;
      expect(standard.vertexColors).toBe(true);
      expect(standard.transparent).toBe(false);
      expect(standard.metalness).toBe(0);
    }
    if (id === "lookout-tower-facade") expect(bounds.max.y).toBeGreaterThanOrEqual(6.85);
    if (id === "pier-bollard") expect(bounds.max.y).toBeLessThanOrEqual(0.8);
    if (id === "rescue-buoy-stand") expect(bounds.max.y).toBeGreaterThanOrEqual(1.775);
    if (id === "small-boat") expect(bounds.max.y).toBeLessThanOrEqual(1.1);
  });

  it("keeps the tower trestle and lower buoy frame open, with the boat interior below both gunwales", async () => {
    const tower = (await exactModel("lookout-tower-facade")).gltf.scene;
    const tunnel = new THREE.Raycaster(new THREE.Vector3(0, 1.3, 2.5), new THREE.Vector3(0, 0, -1), 0, 5);
    expect(tunnel.intersectObject(tower, true)).toHaveLength(0);
    for (const x of [-1.4, 1.4]) {
      const leg = new THREE.Raycaster(new THREE.Vector3(x, 1.3, 2.5), new THREE.Vector3(0, 0, -1), 0, 5);
      expect(leg.intersectObject(tower, true).length).toBeGreaterThan(0);
    }
    const stand = (await exactModel("rescue-buoy-stand")).gltf.scene;
    const frameOpening = new THREE.Raycaster(new THREE.Vector3(0, 0.22, 1), new THREE.Vector3(0, 0, -1), 0, 2);
    expect(frameOpening.intersectObject(stand, true)).toHaveLength(0);
    for (const x of [-0.46, 0.46]) {
      const post = new THREE.Raycaster(new THREE.Vector3(x, 0.22, 1), new THREE.Vector3(0, 0, -1), 0, 2);
      expect(post.intersectObject(stand, true).length).toBeGreaterThan(0);
    }
    const boat = (await exactModel("small-boat")).gltf.scene;
    const down = (x: number) => new THREE.Raycaster(new THREE.Vector3(x, 2, 0), new THREE.Vector3(0, -1), 0, 3)
      .intersectObject(boat, true).map((hit) => hit.point.y);
    expect(down(0).some((height) => height < 0.4)).toBe(true);
    for (const x of [-1, 1]) expect(down(x)[0]).toBeGreaterThan(0.7);
  });

  it("renders every real A2 transform through DecorScene's SceneAssets adapter without false footholds", async () => {
    const loader = vi.spyOn(GLTFLoader.prototype, "loadAsync").mockImplementation(async function (this: GLTFLoader, url: string) {
      const id = url.split("/").at(-1)!.replace(/\.glb$/, "");
      const bytes = bytesFor(id);
      return this.parseAsync(Uint8Array.from(bytes).buffer, "");
    });
    const assets = new SceneAssets();
    try {
      const scene = new DecorScene(decor, assets, () => true);
      await vi.waitFor(() => {
        for (const id of ids) expect(scene.root.getObjectByName(`decor-model-${id}`)!.children.length, id).toBeGreaterThan(0);
      });
      scene.update();
      for (const id of ids) {
        expect(scene.root.getObjectByName(`decor-fallback-${id}`)!.visible).toBe(false);
        const model = scene.root.getObjectByName(`decor-model-${id}`)!;
        model.updateMatrixWorld(true);
        const meshes: THREE.InstancedMesh[] = [];
        model.traverse((object) => { if (object instanceof THREE.InstancedMesh) meshes.push(object); });
        const placements = decor.filter((entry) => entry.kitPropId === id);
        expect(meshes.length, id).toBeGreaterThan(0);
        expect(meshes.every((mesh) => mesh.count === placements.length)).toBe(true);
        const prop = props.find((entry) => entry.id === id)!;
        for (const [index, entry] of placements.entries()) {
          const actual = placedBounds(meshes, index);
          expectInside(actual, decorWorldBounds(prop.bounds, entry), entry.id);
          for (const surface of surfaces) {
            const bounds = authoredSurfaceBounds(surface);
            const distance = Math.hypot(
              Math.max(0, bounds.minX - actual.max.x, actual.min.x - bounds.maxX),
              Math.max(0, bounds.minZ - actual.max.z, actual.min.z - bounds.maxZ),
            );
            if (distance >= 2.5) continue;
            const top = authoredSurfaceTopRange(surface);
            expect(actual.max.y > top.min - 0.5 + 1e-6 && actual.max.y < top.max + 1.4 - 1e-6,
              `${entry.id} near ${surface.id}`).toBe(false);
          }
          if (id === "small-boat") {
            expect(actual.min.y).toBeCloseTo(-1.4, 4);
            expect(actual.max.y).toBeGreaterThan(-0.8);
            expect(actual.max.y).toBeLessThanOrEqual(-0.5);
          }
        }
      }
    } finally {
      assets.dispose();
      loader.mockRestore();
    }
  });

  it("leaves a procedural stand-in visible when an exact harbor GLB is missing", async () => {
    const missing = decor.find((entry) => entry.kitPropId === "small-boat")!;
    const loader = vi.spyOn(GLTFLoader.prototype, "loadAsync").mockRejectedValue(new Error("404"));
    const assets = new SceneAssets();
    try {
      const scene = new DecorScene([missing], assets, () => true);
      await vi.waitFor(() => expect(assets.getState().failed).toBe(1));
      scene.update();
      expect(scene.root.getObjectByName("decor-fallback-small-boat")!.visible).toBe(true);
      expect(scene.root.getObjectByName("decor-model-small-boat")!.children).toHaveLength(0);
    } finally {
      assets.dispose();
      loader.mockRestore();
    }
  });
});
