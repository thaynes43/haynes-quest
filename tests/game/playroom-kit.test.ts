import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { themeKitPropsFor } from "../../src/shared/theme-kits";

const props = themeKitPropsFor("playroom");

async function model(id: string) {
  const prop = props.find((entry) => entry.id === id)!;
  const bytes = readFileSync(new URL(`../../docs${prop.glb!.url.replace("/studio", "")}`, import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  gltf.scene.updateMatrixWorld(true);
  return { prop, bytes, gltf };
}

describe("Playroom kit production props", () => {
  it.each(props.map((prop) => prop.id))("%s has the pinned static model inside its placement envelope", async (id) => {
    const { prop, bytes, gltf } = await model(id);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(prop.glb!.sha256);
    expect(bytes.length).toBeLessThanOrEqual(1.5 * 1024 * 1024);
    expect(gltf.animations).toHaveLength(0);
    const bounds = new THREE.Box3().setFromObject(gltf.scene, true);
    for (const axis of ["x", "y", "z"] as const) {
      expect(bounds.min[axis]).toBeGreaterThanOrEqual(prop.bounds.min[axis] - 1e-6);
      expect(bounds.max[axis]).toBeLessThanOrEqual(prop.bounds.max[axis] + 1e-6);
    }
    expect(bounds.min.y).toBeCloseTo(0, 5);
    let triangles = 0;
    const materials = new Set<THREE.Material>();
    gltf.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position!.count) / 3;
      for (const material of [object.material].flat()) materials.add(material);
      expect(object.geometry.attributes.color).toBeDefined();
    });
    expect(triangles).toBeLessThanOrEqual(5000);
    expect(materials.size).toBeLessThanOrEqual(4);
  });

  it("keeps the garage doorway open and the crib rail transparent between spindles", async () => {
    const garage = (await model("toy-bus-garage")).gltf.scene;
    // Look into the doorway below the raised slats. The ray can reach its deep back wall.
    const portal = new THREE.Raycaster(new THREE.Vector3(-0.564, 0.6, 3), new THREE.Vector3(0, 0, -1));
    const hits = portal.intersectObject(garage, true);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.distance).toBeGreaterThan(4);
    const fence = (await model("crib-rail-fence")).gltf.scene;
    const gap = new THREE.Raycaster(new THREE.Vector3(-1.18, 0.47, 1), new THREE.Vector3(0, 0, -1), 0, 2);
    expect(gap.intersectObject(fence, true)).toHaveLength(0);
    const spindle = new THREE.Raycaster(new THREE.Vector3(-1.2827, 0.47, 1), new THREE.Vector3(0, 0, -1), 0, 2);
    expect(spindle.intersectObject(fence, true).length).toBeGreaterThan(0);
  });

  it("preserves the tower's flat 2.4 m stacking faces and the fence's 3.2 m tiling width", async () => {
    const tower = (await model("stacking-block-tower")).gltf.scene;
    for (const [x, z] of [[0, 0], [0.2, 0.2], [-0.2, -0.2]]) {
      const top = new THREE.Raycaster(new THREE.Vector3(x, 3, z), new THREE.Vector3(0, -1, 0)).intersectObject(tower, true);
      const base = new THREE.Raycaster(new THREE.Vector3(x, -1, z), new THREE.Vector3(0, 1, 0)).intersectObject(tower, true);
      expect(top[0]!.point.y).toBeCloseTo(2.4, 5);
      expect(base[0]!.point.y).toBeCloseTo(0, 5);
    }
    const fence = (await model("crib-rail-fence")).gltf.scene;
    const box = new THREE.Box3().setFromObject(fence, true);
    expect(box.min.x).toBeCloseTo(-1.6, 5);
    expect(box.max.x).toBeCloseTo(1.6, 5);
  });
});
