import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  disposeEditorObjectTree,
  editorCameraFitDistance,
} from "../../src/client/editor/EditorViewport";

describe("level editor scene disposal", () => {
  it("disposes nested geometry and materials and detaches the tree", () => {
    const parent = new THREE.Group();
    const root = new THREE.Group();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial();
    const geometryDispose = vi.spyOn(geometry, "dispose");
    const materialDispose = vi.spyOn(material, "dispose");
    root.add(new THREE.Mesh(geometry, material));
    parent.add(root);

    disposeEditorObjectTree(root);

    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(root.parent).toBeNull();
  });

  it("fits every scene-box corner at desktop and narrow aspect ratios", () => {
    const box = new THREE.Box3(
      new THREE.Vector3(-8, -1, -120),
      new THREE.Vector3(8, 5, 0),
    );
    const fov = 46;
    const direction = new THREE.Vector3(22, 18, 63).normalize();
    for (const aspect of [16 / 9, 0.55]) {
      const distance = editorCameraFitDistance(box, fov, aspect, direction);
      const center = box.getCenter(new THREE.Vector3());
      const camera = new THREE.PerspectiveCamera(fov, aspect, 0.05, 1_000);
      camera.position.copy(center).addScaledVector(direction, distance);
      camera.lookAt(center);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      const projected = [
        new THREE.Vector3(box.min.x, box.min.y, box.min.z),
        new THREE.Vector3(box.min.x, box.min.y, box.max.z),
        new THREE.Vector3(box.min.x, box.max.y, box.min.z),
        new THREE.Vector3(box.min.x, box.max.y, box.max.z),
        new THREE.Vector3(box.max.x, box.min.y, box.min.z),
        new THREE.Vector3(box.max.x, box.min.y, box.max.z),
        new THREE.Vector3(box.max.x, box.max.y, box.min.z),
        new THREE.Vector3(box.max.x, box.max.y, box.max.z),
      ].map((corner) => corner.project(camera));
      expect(
        Math.max(...projected.map((corner) => Math.abs(corner.x))),
      ).toBeLessThanOrEqual(0.900001);
      expect(
        Math.max(...projected.map((corner) => Math.abs(corner.y))),
      ).toBeLessThanOrEqual(0.900001);
    }
    expect(editorCameraFitDistance(box, fov, 0.55, direction)).toBeGreaterThan(
      editorCameraFitDistance(box, fov, 16 / 9, direction),
    );
  });
});
