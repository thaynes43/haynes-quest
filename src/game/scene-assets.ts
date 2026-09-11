import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";

export const modelUrls = {
  infant: "/studio/assets/media/traveler-infant/v001/traveler-infant.glb",
  child: "/studio/assets/media/traveler-child/v001/traveler-child.glb",
  tree: "/studio/assets/media/clearing-tree/v001/clearing-tree.glb",
  stone: "/studio/assets/media/clearing-stone/v001/clearing-stone.glb",
  path: "/studio/assets/media/clearing-path-kit/v001/path-tile.glb",
  keepsake: "/studio/assets/media/memory-keepsake/v001/memory-keepsake.glb",
  gate: "/studio/assets/media/arrival-landmark/v001/arrival-landmark.glb",
} as const;

/** Each scene owns its copies; no image or skinned resources outlive a game. */
export function disposeTree(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (
      !(object instanceof THREE.Mesh) &&
      !(object instanceof THREE.Points) &&
      !(object instanceof THREE.Line)
    )
      return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material))
        if (value instanceof THREE.Texture) textures.add(value);
    }
    if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose();
  });
  for (const resource of [...geometries, ...materials, ...textures])
    resource.dispose();
}

type ModelEntry = { promise: Promise<GLTF>; failed: boolean; loading: boolean };

export class SceneAssets {
  private readonly loader = new GLTFLoader();
  private readonly entries = new Map<string, ModelEntry>();
  private readonly retryJobs = new Map<string, Set<() => void>>();
  private disposed = false;

  getState(): { loading: number; failed: number } {
    return {
      loading: [...this.entries.values()].filter((entry) => entry.loading)
        .length,
      failed: [...this.entries.values()].filter((entry) => entry.failed).length,
    };
  }

  attach(
    url: string,
    target: THREE.Object3D,
    valid: () => boolean,
    ready?: (root: THREE.Group, clips: THREE.AnimationClip[]) => void,
  ): void {
    let inFlight = false;
    let finished = false;
    const run = () => {
      if (this.disposed || !valid()) {
        this.retryJobs.get(url)?.delete(run);
        if (this.retryJobs.get(url)?.size === 0) this.retryJobs.delete(url);
        return;
      }
      if (inFlight || finished) return;
      inFlight = true;
      void this.load(url)
        .then((gltf) => {
          inFlight = false;
          this.retryJobs.get(url)?.delete(run);
          if (this.disposed || !valid()) return;
          finished = true;
          const root = clone(gltf.scene) as THREE.Group;
          root.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            object.geometry = object.geometry.clone();
            object.material = Array.isArray(object.material)
              ? object.material.map((material) => material.clone())
              : object.material.clone();
            object.castShadow = true;
            object.receiveShadow = true;
          });
          target.add(root);
          ready?.(root, gltf.animations);
        })
        .catch(() => {
          inFlight = false;
          if (this.disposed || !valid()) return;
          const jobs = this.retryJobs.get(url) ?? new Set<() => void>();
          jobs.add(run);
          this.retryJobs.set(url, jobs);
        });
    };
    run();
  }

  retry(): void {
    for (const [url, entry] of this.entries)
      if (entry.failed) this.entries.delete(url);
    for (const jobs of this.retryJobs.values())
      for (const retry of jobs) retry();
  }

  dispose(): void {
    this.disposed = true;
    this.retryJobs.clear();
    for (const entry of this.entries.values()) {
      void entry.promise
        .then((gltf) => disposeTree(gltf.scene))
        .catch(() => undefined);
    }
    this.entries.clear();
  }

  private load(url: string): Promise<GLTF> {
    const previous = this.entries.get(url);
    if (previous) return previous.promise;
    const entry: ModelEntry = {
      promise: Promise.resolve(null as unknown as GLTF),
      failed: false,
      loading: true,
    };
    entry.promise = this.loader
      .loadAsync(url)
      .then((gltf) => {
        entry.loading = false;
        return gltf;
      })
      .catch((error: unknown) => {
        entry.loading = false;
        entry.failed = true;
        throw error;
      });
    this.entries.set(url, entry);
    return entry.promise;
  }
}
