import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { familyA3Level } from "../../scripts/levels/family/a3";
import { DecorScene } from "../../src/game/decor-scene";
import { SceneAssets } from "../../src/game/scene-assets";
import { authoredSurfaceBounds, authoredSurfaceTopRange, isAuthoredSurfacePiece, type AuthoredLevelDocument } from "../../src/shared/authored-level";
import { decorWorldBounds, themeKitPropsFor } from "../../src/shared/theme-kits";
import familyWorldAV5 from "../../src/shared/levels/family-world-a-v5.json";

const ids = ["water-tower", "rooftop-ac-unit", "crane-hook", "billboard-frame"] as const;
const props = themeKitPropsFor("rooftop");
const level = familyWorldAV5.chapters.find((chapter) => chapter.chapterId === "family-a3")!.level as unknown as AuthoredLevelDocument;
const decor = (level.decor ?? []).filter((entry) => ids.includes(entry.kitPropId as typeof ids[number]));
const surfaces = level.pieces.filter(isAuthoredSurfacePiece);

function bytesFor(id: string): Buffer {
  return readFileSync(new URL(`../../docs/assets/media/rooftop-city-kit/v001/${id}.glb`, import.meta.url));
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

describe("Rooftop City v001 production kit", () => {
  it("keeps the fixed planning boxes and all 50 placements in the checked-in A3 route", () => {
    expect(level.decor).toEqual(familyA3Level().decor);
    expect(props.map((prop) => prop.id)).toEqual(ids);
    expect(props.map((prop) => prop.bounds)).toEqual([
      { min: { x: -1.4, y: 0, z: -1.4 }, max: { x: 1.4, y: 5, z: 1.4 } },
      { min: { x: -0.9, y: 0, z: -0.7 }, max: { x: 0.9, y: 1.1, z: 0.7 } },
      { min: { x: -0.5, y: 0, z: -0.5 }, max: { x: 0.5, y: 1.6, z: 0.5 } },
      { min: { x: -2.5, y: 0, z: -0.25 }, max: { x: 2.5, y: 4, z: 0.25 } },
    ]);
    expect(decor).toHaveLength(50);
    expect(ids.map((id) => decor.filter((entry) => entry.kitPropId === id).length)).toEqual([21, 16, 5, 8]);
  });

  it.each(ids)("%s has pinned opaque vertex-colour geometry inside its planning box", async (id) => {
    const prop = props.find((entry) => entry.id === id)!;
    const { bytes, gltf, bounds } = await exactModel(id);
    expect(prop.glb?.url).toBe(`/studio/assets/media/rooftop-city-kit/v001/${id}.glb`);
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
    expect(bounds.max.y).toBeGreaterThanOrEqual(prop.bounds.max.y * 0.9);
  });

  it("keeps the billboard's centre and the tower trestle genuinely open", async () => {
    const billboard = (await exactModel("billboard-frame")).gltf.scene;
    for (const x of [-1, 0, 1]) {
      const opening = new THREE.Raycaster(new THREE.Vector3(x, 2.5, 1), new THREE.Vector3(0, 0, -1), 0, 2);
      expect(opening.intersectObject(billboard, true)).toHaveLength(0);
    }
    for (const x of [-2.36, 2.36]) {
      const edge = new THREE.Raycaster(new THREE.Vector3(x, 2.5, 1), new THREE.Vector3(0, 0, -1), 0, 2);
      expect(edge.intersectObject(billboard, true).length).toBeGreaterThan(0);
    }
    const tower = (await exactModel("water-tower")).gltf.scene;
    const trestle = new THREE.Raycaster(new THREE.Vector3(0.4, 1.1, 2), new THREE.Vector3(0, 0, -1), 0, 4);
    expect(trestle.intersectObject(tower, true)).toHaveLength(0);
  });

  it("renders every real A3 transform through DecorScene's SceneAssets adapter without false footholds", async () => {
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

        }
      }
    } finally {
      assets.dispose();
      loader.mockRestore();
    }
  });

  it("leaves a procedural stand-in visible when an exact rooftop GLB is missing", async () => {
    const missing = decor.find((entry) => entry.kitPropId === "billboard-frame")!;
    const loader = vi.spyOn(GLTFLoader.prototype, "loadAsync").mockRejectedValue(new Error("404"));
    const assets = new SceneAssets();
    try {
      const scene = new DecorScene([missing], assets, () => true);
      await vi.waitFor(() => expect(assets.getState().failed).toBe(1));
      scene.update();
      expect(scene.root.getObjectByName("decor-fallback-billboard-frame")!.visible).toBe(true);
      expect(scene.root.getObjectByName("decor-model-billboard-frame")!.children).toHaveLength(0);
    } finally {
      assets.dispose();
      loader.mockRestore();
    }
  });
});
