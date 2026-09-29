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
  /** Static scenic instances keep their measured world boxes until a caller changes a transform. */
  private readonly instanceBounds = new WeakMap<THREE.InstancedMesh, {
    version: number;
    worldMatrix: THREE.Matrix4;
    union: THREE.Box3;
    boxes: THREE.Box3[];
  }>();

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

    // Cast from the traveler toward the camera so a front-face prop still
    // registers when the camera has entered it. Chest and head samples catch
    // a prop that clips only part of the avatar. The opposite center ray is
    // needed only if those samples found nothing (traveler inside a prop).
    for (const height of [0, -0.55, 0.55]) {
      this.probe.copy(target);
      this.probe.y += height;
      this.direction.subVectors(camera, this.probe);
      const distance = this.direction.length();
      if (distance < 0.35) continue;
      this.ray.set(this.probe, this.direction.divideScalar(distance));
      this.ray.near = 0.01;
      this.ray.far = distance - 0.2;
      for (const hit of this.ray.intersectObjects(roots, true))
        include(hit.object, hit.instanceId);
    }
    if (candidates.size === 0) {
      this.direction.subVectors(target, camera);
      const distance = this.direction.length();
      this.ray.set(camera, this.direction.divideScalar(distance));
      this.ray.near = 0.01;
      this.ray.far = distance - 0.2;
      for (const hit of this.ray.intersectObjects(roots, true))
        include(hit.object, hit.instanceId);
    }

    // A camera embedded in a closed scenic surface can miss both rays. Test
    // its position against each primitive's box as a conservative fallback.
    for (const root of roots) root.traverseVisible((object) => {
      if (!(object instanceof THREE.Mesh) || !this.isScenic(object) || !this.isOpaque(object)) return;
      if (object instanceof THREE.InstancedMesh) {
        object.updateWorldMatrix(true, false);
        const bounds = this.boundsFor(object);
        if (!bounds.union.containsPoint(camera)) return;
        for (let index = 0; index < bounds.boxes.length; index++)
          if (bounds.boxes[index]!.containsPoint(camera)) include(object, index);
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
          const bounds = this.instanceBounds.get(mesh);
          if (bounds) bounds.version = mesh.instanceMatrix.version;
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
      const bounds = this.instanceBounds.get(mesh);
      if (bounds) bounds.version = mesh.instanceMatrix.version;
    }
    this.hiddenInstances.clear();
  }

  private isScenic(object: THREE.Object3D): boolean {
    for (let node: THREE.Object3D | null = object; node; node = node.parent)
      if (node.userData.scenicOnly === true) return true;
    return false;
  }

  private boundsFor(mesh: THREE.InstancedMesh) {
    const cached = this.instanceBounds.get(mesh);
    if (cached && cached.version === mesh.instanceMatrix.version &&
        cached.worldMatrix.equals(mesh.matrixWorld)) return cached;
    mesh.geometry.computeBoundingBox();
    const geometry = mesh.geometry.boundingBox;
    const boxes: THREE.Box3[] = [];
    const union = new THREE.Box3();
    if (geometry) for (let index = 0; index < mesh.count; index++) {
      mesh.getMatrixAt(index, this.matrix);
      this.matrix.premultiply(mesh.matrixWorld);
      const box = geometry.clone().applyMatrix4(this.matrix);
      boxes.push(box);
      union.union(box);
    }
    const bounds = {
      version: mesh.instanceMatrix.version,
      worldMatrix: mesh.matrixWorld.clone(),
      union,
      boxes,
    };
    this.instanceBounds.set(mesh, bounds);
    return bounds;
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
