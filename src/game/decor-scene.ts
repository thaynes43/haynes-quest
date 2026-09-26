import * as THREE from "three";

import type { AuthoredDecor } from "../shared/authored-level";
import {
  themeKitProp,
  type ThemeKitPropDefinition,
} from "../shared/theme-kits";
import type { SceneAssets } from "./scene-assets";

/**
 * Placed theme-kit decor (DESIGN-025 D-04/D-05). Every prop first draws its
 * procedural stand-in, sized to the catalog bounding box, so the room is
 * framed even before, or without, the exact model. When a prop names a GLB,
 * one instanced batch per prop is requested; once it has attached, that
 * prop's stand-in hides. A missing or failed GLB simply leaves the stand-in
 * in place. Decor never collides: it is scenery only.
 */
export class DecorScene {
  readonly root = new THREE.Group();
  private readonly swaps: Array<{
    readonly model: THREE.Group;
    readonly fallback: THREE.Object3D;
  }> = [];

  constructor(
    decor: readonly AuthoredDecor[],
    assets: Pick<SceneAssets, "attachInstances">,
    valid: () => boolean,
  ) {
    this.root.name = "theme-kit-decor";
    this.root.userData.scenicOnly = true;
    const byProp = new Map<string, AuthoredDecor[]>();
    for (const entry of decor) {
      if (!themeKitProp(entry.kitPropId)) continue;
      const group = byProp.get(entry.kitPropId) ?? [];
      group.push(entry);
      byProp.set(entry.kitPropId, group);
    }
    for (const [propId, entries] of byProp) {
      const prop = themeKitProp(propId)!;
      const fallback = fallbackBatch(prop, entries);
      this.root.add(fallback);
      if (prop.glb) {
        const model = new THREE.Group();
        model.name = `decor-model-${prop.id}`;
        model.userData.scenicOnly = true;
        this.root.add(model);
        assets.attachInstances(
          prop.glb.url,
          model,
          entries.map((entry) => placementMatrix(entry)),
          valid,
          { castShadow: false },
        );
        this.swaps.push({ model, fallback });
      }
    }
  }

  /** Hides a stand-in once its exact model has attached. */
  update(): void {
    for (const swap of this.swaps)
      swap.fallback.visible = swap.model.children.length === 0;
  }
}

function placementMatrix(entry: AuthoredDecor): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(entry.position.x, entry.position.y, entry.position.z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), entry.rotationY),
    new THREE.Vector3(entry.scale, entry.scale, entry.scale),
  );
}

/**
 * Unit boxes placed and scaled to fill the prop's bounds: a single slab, a
 * post, or an arch of two posts and a lintel.
 */
function fallbackParts(prop: ThemeKitPropDefinition): Array<{
  readonly center: THREE.Vector3;
  readonly size: THREE.Vector3;
  readonly trim: boolean;
}> {
  const { min, max } = prop.bounds;
  const width = max.x - min.x;
  const height = max.y - min.y;
  const depth = max.z - min.z;
  const centerX = (min.x + max.x) / 2;
  const centerZ = (min.z + max.z) / 2;
  if (prop.fallback.shape === "arch") {
    const post = Math.max(0.2, width * 0.12);
    const lintel = Math.max(0.2, height * 0.14);
    return [
      { center: new THREE.Vector3(min.x + post / 2, min.y + (height - lintel) / 2, centerZ), size: new THREE.Vector3(post, height - lintel, depth), trim: false },
      { center: new THREE.Vector3(max.x - post / 2, min.y + (height - lintel) / 2, centerZ), size: new THREE.Vector3(post, height - lintel, depth), trim: false },
      { center: new THREE.Vector3(centerX, max.y - lintel / 2, centerZ), size: new THREE.Vector3(width, lintel, depth), trim: true },
    ];
  }
  return [
    { center: new THREE.Vector3(centerX, min.y + height * 0.45, centerZ), size: new THREE.Vector3(width, height * 0.9, depth), trim: false },
    { center: new THREE.Vector3(centerX, max.y - height * 0.05, centerZ), size: new THREE.Vector3(width * 1.04, height * 0.1, depth * 1.04), trim: true },
  ];
}

function fallbackBatch(
  prop: ThemeKitPropDefinition,
  entries: readonly AuthoredDecor[],
): THREE.Group {
  const group = new THREE.Group();
  group.name = `decor-fallback-${prop.id}`;
  group.userData.scenicOnly = true;
  const parts = fallbackParts(prop);
  const geometry =
    prop.fallback.shape === "cylinder"
      ? new THREE.CylinderGeometry(0.5, 0.5, 1, 16)
      : new THREE.BoxGeometry(1, 1, 1);
  const body = new THREE.MeshStandardMaterial({ color: prop.fallback.color, roughness: 0.85 });
  const trim = new THREE.MeshStandardMaterial({ color: prop.fallback.trim, roughness: 0.6 });
  const part = new THREE.Matrix4();
  const dummy = new THREE.Object3D();
  for (const [index, piece] of parts.entries()) {
    const mesh = new THREE.InstancedMesh(geometry, piece.trim ? trim : body, entries.length);
    mesh.name = `decor-fallback-${prop.id}-${index}`;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    entries.forEach((entry, instance) => {
      dummy.position.copy(piece.center);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.copy(piece.size);
      dummy.updateMatrix();
      part.multiplyMatrices(placementMatrix(entry), dummy.matrix);
      mesh.setMatrixAt(instance, part);
    });
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }
  return group;
}
