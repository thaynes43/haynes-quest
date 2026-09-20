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

  it("fits the enclosing scene sphere at desktop and narrow aspect ratios", () => {
    const radius = 70;
    const fov = 46;
    for (const aspect of [16 / 9, 0.55]) {
      const distance = editorCameraFitDistance(radius, fov, aspect);
      const verticalHalfFov = THREE.MathUtils.degToRad(fov / 2);
      const horizontalHalfFov = Math.atan(
        Math.tan(verticalHalfFov) * aspect,
      );
      const sphereHalfAngle = Math.asin(radius / distance);
      expect(sphereHalfAngle).toBeLessThan(
        Math.min(verticalHalfFov, horizontalHalfFov),
      );
    }
    expect(editorCameraFitDistance(radius, fov, 0.55)).toBeGreaterThan(
      editorCameraFitDistance(radius, fov, 16 / 9),
    );
  });
});
