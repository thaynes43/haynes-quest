import * as THREE from "three";

/**
 * Hides scenic geometry that lies between the chase camera and the traveler.
 * The original transforms are restored before every probe, so moving the
 * camera away immediately brings the scenery back. Course collision and
 * gameplay objects are never eligible.
 */
export class ScenicCameraOcclusion {
  private readonly ray = new THREE.Raycaster();
  private readonly direction = new THREE.Vector3();
  private readonly probe = new THREE.Vector3();
  private readonly box = new THREE.Box3();
  private readonly matrix = new THREE.Matrix4();
  private readonly hiddenMeshes = new Set<THREE.Mesh>();
  private readonly hiddenInstances = new Map<THREE.InstancedMesh, Map<number, THREE.Matrix4>>();
  private readonly hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

  update(camera: THREE.Vector3, target: THREE.Vector3, roots: THREE.Object3D[]): void {
    this.clear();
    if (roots.length === 0 || camera.distanceToSquared(target) < 0.25) return;
    const candidates = new Map<THREE.Mesh, Set<number>>();
    for (const root of roots) root.updateWorldMatrix(true, true);
    const addCandidate = (mesh: THREE.Mesh, index?: number) => {
      const indices = candidates.get(mesh) ?? new Set<number>();
      if (index !== undefined) indices.add(index);
      candidates.set(mesh, indices);
    };
    const include = (object: THREE.Object3D, index?: number) => {
      if (!(object instanceof THREE.Mesh) || !this.isScenic(object) || !this.isOpaque(object)) return;
      if (object instanceof THREE.InstancedMesh && index !== undefined &&
          object.parent?.userData.scenicInstanceBatch === true) {
        for (const sibling of object.parent.children)
          if (sibling instanceof THREE.InstancedMesh && sibling.count > index)
            addCandidate(sibling, index);
      } else addCandidate(object, index);
    };

    // Front-face materials may not report a ray that starts inside them. The
    // reverse ray catches that case when the traveler is outside the prop.
    // Chest and head samples keep a broad prop from hiding most of the avatar
    // while leaving the center point clear.
    for (const height of [0, -0.55, 0.55]) {
      this.probe.copy(target);
      this.probe.y += height;
      for (const [start, end] of [[camera, this.probe], [this.probe, camera]] as const) {
        this.direction.subVectors(end, start);
        const distance = this.direction.length();
        if (distance < 0.35) continue;
        this.ray.set(start, this.direction.divideScalar(distance));
        this.ray.near = 0.01;
        this.ray.far = distance - 0.2;
        for (const hit of this.ray.intersectObjects(roots, true))
          include(hit.object, hit.instanceId);
      }
    }

    // A camera embedded in a closed scenic surface can miss both rays. Test
    // its position against each primitive's box as a conservative fallback.
    for (const root of roots) root.traverseVisible((object) => {
      if (!(object instanceof THREE.Mesh) || !this.isScenic(object) || !this.isOpaque(object)) return;
      if (object instanceof THREE.InstancedMesh) {
        if (!object.boundingBox) object.computeBoundingBox();
        object.updateWorldMatrix(true, false);
        if (!object.boundingBox || !this.box.copy(object.boundingBox).applyMatrix4(object.matrixWorld).containsPoint(camera))
          return;
        object.geometry.computeBoundingBox();
        const bounds = object.geometry.boundingBox;
        if (!bounds) return;
        for (let index = 0; index < object.count; index++) {
          object.getMatrixAt(index, this.matrix);
          this.matrix.premultiply(object.matrixWorld);
          if (this.box.copy(bounds).applyMatrix4(this.matrix).containsPoint(camera))
            include(object, index);
        }
      } else {
        object.geometry.computeBoundingBox();
        const bounds = object.geometry.boundingBox;
        if (!bounds) return;
        object.updateWorldMatrix(true, false);
        if (this.box.copy(bounds).applyMatrix4(object.matrixWorld).containsPoint(camera))
          include(object);
      }
    });

    for (const [mesh, indices] of candidates) {
      if (mesh instanceof THREE.InstancedMesh) {
        const originals = new Map<number, THREE.Matrix4>();
        for (const index of indices) {
          mesh.getMatrixAt(index, this.matrix);
          originals.set(index, this.matrix.clone());
          mesh.setMatrixAt(index, this.hiddenMatrix);
        }
        if (originals.size > 0) {
          this.hiddenInstances.set(mesh, originals);
          mesh.instanceMatrix.needsUpdate = true;
        }
      } else {
        this.hiddenMeshes.add(mesh);
        mesh.visible = false;
      }
    }
  }

  clear(): void {
    for (const mesh of this.hiddenMeshes) mesh.visible = true;
    this.hiddenMeshes.clear();
    for (const [mesh, originals] of this.hiddenInstances) {
      for (const [index, matrix] of originals) mesh.setMatrixAt(index, matrix);
      mesh.instanceMatrix.needsUpdate = true;
    }
    this.hiddenInstances.clear();
  }

  private isScenic(object: THREE.Object3D): boolean {
    for (let node: THREE.Object3D | null = object; node; node = node.parent)
      if (node.userData.scenicOnly === true) return true;
    return false;
  }

  private isOpaque(object: THREE.Mesh): boolean {
    for (let node: THREE.Object3D | null = object; node; node = node.parent)
      if (!node.visible) return false;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    return materials.some((material) =>
      material.visible && material.blending !== THREE.AdditiveBlending &&
      !(material.transparent && material.opacity < 0.6));
  }
}
