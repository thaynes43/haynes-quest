import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, it } from "vitest";
import { ScenicCameraOcclusion } from "../../src/game/camera-occlusion";

function sightHits(root: THREE.Object3D, target: THREE.Vector3, camera: THREE.Vector3) {
  const direction = camera.clone().sub(target);
  return new THREE.Raycaster(target, direction.clone().normalize(), 0, direction.length())
    .intersectObject(root, true);
}

describe("chase-camera scenic occlusion", () => {
  it("clears the actual A4 ticket-room marquee from the first fight sightline and restores it after moving", async () => {
    const file = await readFile(new URL("../../docs/assets/media/rat-casino-kit/v001/marquee-arch.glb", import.meta.url));
    const gltf = await new GLTFLoader().parseAsync(
      file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
      "",
    );
    const scene = new THREE.Group();
    scene.userData.scenicOnly = true;
    const assembly = new THREE.Group();
    assembly.userData.scenicInstanceBatch = true;
    // family-world-a@v4 ticket-counter is 14 x 12 at z=-35.8; CasinoScene
    // places this exact GLB 0.4 m inside the room's near edge, at z=-30.2.
    gltf.scene.updateMatrixWorld(true);
    const originals = new Map<THREE.InstancedMesh, { first: THREE.Matrix4; second: THREE.Matrix4 }>();
    gltf.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const mesh = new THREE.InstancedMesh(object.geometry, object.material, 2);
      mesh.name = object.name;
      const first = new THREE.Matrix4().makeTranslation(0, 0, -30.2).multiply(object.matrixWorld);
      const second = new THREE.Matrix4().makeTranslation(15, 0, -30.2).multiply(object.matrixWorld);
      mesh.setMatrixAt(0, first);
      mesh.setMatrixAt(1, second);
      mesh.computeBoundingSphere();
      assembly.add(mesh);
      originals.set(mesh, { first, second });
    });
    scene.add(assembly);
    scene.updateMatrixWorld(true);
    // The child approaches Chick-flia (3.2, 0, -35.8) from the south and
    // fights near the right pillar. This is the obstructed camera geometry.
    const target = new THREE.Vector3(2.6, 1.5, -32);
    const camera = new THREE.Vector3(2.6, 3.1, -27.5);
    const before = sightHits(scene, target, camera);
    expect(before.length).toBeGreaterThan(0);
    expect(before.some((hit) => hit.object.name === "marquee-arch_export_mesh")).toBe(true);

    const occlusion = new ScenicCameraOcclusion();
    occlusion.update(camera, target, [scene]);
    const actual = new THREE.Matrix4();
    for (const mesh of originals.keys()) {
      mesh.getMatrixAt(0, actual);
      expect(actual.determinant()).toBe(0);
      mesh.getMatrixAt(1, actual);
      expect(actual.determinant()).not.toBe(0);
    }
    occlusion.update(new THREE.Vector3(10, 3.1, -27.5), new THREE.Vector3(10, 1.5, -32), [scene]);
    for (const [mesh, { first, second }] of originals) {
      mesh.getMatrixAt(0, actual);
      for (let index = 0; index < 16; index++)
        expect(actual.elements[index]).toBeCloseTo(first.elements[index]!, 5);
      mesh.getMatrixAt(1, actual);
      for (let index = 0; index < 16; index++)
        expect(actual.elements[index]).toBeCloseTo(second.elements[index]!, 5);
    }
    occlusion.clear();
  });

  it("hides one blocking scenic instance, preserves its neighbors, and restores its matrix", () => {
    const root = new THREE.Group();
    root.userData.scenicOnly = true;
    const props = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 3, 1), new THREE.MeshBasicMaterial(), 2);
    const first = new THREE.Matrix4().makeTranslation(0, 1.5, 2);
    const second = new THREE.Matrix4().makeTranslation(8, 1.5, 2);
    props.setMatrixAt(0, first);
    props.setMatrixAt(1, second);
    props.computeBoundingBox();
    props.computeBoundingSphere();
    root.add(props);
    const nonScenic = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    nonScenic.position.set(0, 1.5, 3);
    const alreadyHidden = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    alreadyHidden.position.set(0, 1.5, 3);
    alreadyHidden.visible = false;
    root.add(alreadyHidden);
    const occlusion = new ScenicCameraOcclusion();
    occlusion.update(new THREE.Vector3(0, 2, 4), new THREE.Vector3(0, 1.5, 0), [root, nonScenic]);
    const actual = new THREE.Matrix4();
    props.getMatrixAt(0, actual);
    expect(actual.determinant()).toBe(0);
    props.getMatrixAt(1, actual);
    expect(actual.equals(second)).toBe(true);
    expect(nonScenic.visible).toBe(true);
    expect(alreadyHidden.visible).toBe(false);
    occlusion.clear();
    props.getMatrixAt(0, actual);
    expect(actual.equals(first)).toBe(true);
    expect(alreadyHidden.visible).toBe(false);
  });

  it("also clears a scenic box when the camera starts inside it", () => {
    const root = new THREE.Group();
    root.userData.scenicOnly = true;
    const box = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), new THREE.MeshBasicMaterial());
    root.add(box);
    const occlusion = new ScenicCameraOcclusion();
    occlusion.update(new THREE.Vector3(0, 0, 0.5), new THREE.Vector3(0, 0, 0), [root]);
    expect(box.visible).toBe(false);
    occlusion.clear();
    expect(box.visible).toBe(true);
  });
});
