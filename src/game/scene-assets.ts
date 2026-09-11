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
  const instances = new Set<THREE.InstancedMesh>();
  root.traverse((object) => {
    if (
      !(object instanceof THREE.Mesh) &&
      !(object instanceof THREE.Points) &&
      !(object instanceof THREE.Line)
    )
      return;
    if (object instanceof THREE.InstancedMesh) instances.add(object);
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
  for (const instance of instances) instance.dispose();
  for (const resource of [...geometries, ...materials, ...textures])
    resource.dispose();
}

type ModelEntry = { promise: Promise<GLTF>; failed: boolean; loading: boolean };
type RetryJob = { run: () => void; valid: () => boolean };

type AttachmentResources = {
  geometries: Set<THREE.BufferGeometry>;
  materials: Set<THREE.Material>;
  textures: Set<THREE.Texture>;
  skeletons: Set<THREE.Skeleton>;
  instances: Set<THREE.InstancedMesh>;
};

type AttachmentClone = {
  root: THREE.Group;
  source: AttachmentResources;
  owned: AttachmentResources;
};

export interface InstanceAttachOptions {
  castShadow?: boolean;
  receiveShadow?: boolean;
}

function disposeInstanceBatch(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const instances = new Set<THREE.InstancedMesh>();
  root.traverse((object) => {
    if (!(object instanceof THREE.InstancedMesh)) return;
    instances.add(object);
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material))
        if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  for (const instance of instances) instance.dispose();
  for (const resource of [...geometries, ...materials, ...textures])
    resource.dispose();
}

function sourceVisible(object: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}

function cloneMaterialWithTextures(
  source: THREE.Material,
  textureClones: Map<THREE.Texture, THREE.Texture>,
  ownedTextures?: Set<THREE.Texture>,
): THREE.Material {
  const material = source.clone();
  const properties = material as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(properties)) {
    if (!(value instanceof THREE.Texture)) continue;
    const texture = textureClones.get(value) ?? value.clone();
    textureClones.set(value, texture);
    ownedTextures?.add(texture);
    properties[key] = texture;
  }
  return material;
}

function attachmentResources(): AttachmentResources {
  return {
    geometries: new Set<THREE.BufferGeometry>(),
    materials: new Set<THREE.Material>(),
    textures: new Set<THREE.Texture>(),
    skeletons: new Set<THREE.Skeleton>(),
    instances: new Set<THREE.InstancedMesh>(),
  };
}

function collectAttachmentResources(root: THREE.Object3D): AttachmentResources {
  const resources = attachmentResources();
  root.traverse((object) => {
    if (object instanceof THREE.InstancedMesh) resources.instances.add(object);
    if (
      !(object instanceof THREE.Mesh) &&
      !(object instanceof THREE.Points) &&
      !(object instanceof THREE.Line)
    )
      return;
    resources.geometries.add(object.geometry);
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      resources.materials.add(material);
      for (const value of Object.values(material))
        if (value instanceof THREE.Texture) resources.textures.add(value);
    }
    if (object instanceof THREE.SkinnedMesh)
      resources.skeletons.add(object.skeleton);
  });
  return resources;
}

function disposeAttachmentResources(resources: AttachmentResources): void {
  for (const instance of resources.instances) instance.dispose();
  for (const skeleton of resources.skeletons) skeleton.dispose();
  for (const resource of [
    ...resources.geometries,
    ...resources.materials,
    ...resources.textures,
  ])
    resource.dispose();
}

function createAttachmentClone(sourceRoot: THREE.Group): AttachmentClone {
  const source = collectAttachmentResources(sourceRoot);
  const owned = attachmentResources();
  const geometryClones = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  const materialClones = new Map<THREE.Material, THREE.Material>();
  const textureClones = new Map<THREE.Texture, THREE.Texture>();
  try {
    const root = clone(sourceRoot) as THREE.Group;
    if (root === sourceRoot)
      throw new Error("Asset hierarchy clone reused the cached source");
    root.traverse((object) => {
      if (object instanceof THREE.InstancedMesh) owned.instances.add(object);
      if (
        !(object instanceof THREE.Mesh) &&
        !(object instanceof THREE.Points) &&
        !(object instanceof THREE.Line)
      )
        return;
      if (object instanceof THREE.SkinnedMesh) {
        if (source.skeletons.has(object.skeleton))
          throw new Error("Asset hierarchy clone reused a cached skeleton");
        owned.skeletons.add(object.skeleton);
      }
      const sourceGeometry = object.geometry;
      let geometry = geometryClones.get(sourceGeometry);
      if (!geometry) {
        const clonedGeometry = sourceGeometry.clone();
        if (clonedGeometry === sourceGeometry)
          throw new Error("Asset geometry clone reused the cached source");
        geometryClones.set(sourceGeometry, clonedGeometry);
        owned.geometries.add(clonedGeometry);
        geometry = clonedGeometry;
      }
      object.geometry = geometry;
      const cloneMaterial = (
        sourceMaterial: THREE.Material,
      ): THREE.Material => {
        let material = materialClones.get(sourceMaterial);
        if (material) return material;
        material = sourceMaterial.clone();
        if (material === sourceMaterial)
          throw new Error("Asset material clone reused the cached source");
        materialClones.set(sourceMaterial, material);
        owned.materials.add(material);
        const properties = material as unknown as Record<string, unknown>;
        for (const [key, value] of Object.entries(properties)) {
          if (!(value instanceof THREE.Texture)) continue;
          let texture = textureClones.get(value);
          if (!texture) {
            texture = value.clone();
            if (texture === value)
              throw new Error("Asset texture clone reused the cached source");
            textureClones.set(value, texture);
            owned.textures.add(texture);
          }
          properties[key] = texture;
        }
        return material;
      };
      object.material = Array.isArray(object.material)
        ? object.material.map(cloneMaterial)
        : cloneMaterial(object.material);
      object.castShadow = true;
      object.receiveShadow = true;
    });
    return { root, source, owned };
  } catch (error) {
    disposeAttachmentResources(owned);
    throw error;
  }
}

function rollbackAttachment(attachment: AttachmentClone): void {
  attachment.root.removeFromParent();
  const resources = attachment.owned;
  attachment.root.traverse((object) => {
    if (
      object instanceof THREE.InstancedMesh &&
      !attachment.source.instances.has(object)
    )
      resources.instances.add(object);
    if (
      !(object instanceof THREE.Mesh) &&
      !(object instanceof THREE.Points) &&
      !(object instanceof THREE.Line)
    )
      return;
    if (!attachment.source.geometries.has(object.geometry))
      resources.geometries.add(object.geometry);
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      if (attachment.source.materials.has(material)) continue;
      resources.materials.add(material);
      for (const value of Object.values(material))
        if (
          value instanceof THREE.Texture &&
          !attachment.source.textures.has(value)
        )
          resources.textures.add(value);
    }
    if (
      object instanceof THREE.SkinnedMesh &&
      !attachment.source.skeletons.has(object.skeleton)
    )
      resources.skeletons.add(object.skeleton);
  });
  disposeAttachmentResources(resources);
}

type SourcePrimitive = {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  transform: THREE.Matrix4;
  name: string;
  visible: boolean;
  renderOrder: number;
  layerMask: number;
  frustumCulled: boolean;
};

function createInstanceBatch(
  gltf: GLTF,
  placements: readonly THREE.Matrix4[],
  options: InstanceAttachOptions,
): THREE.Group {
  const assembly = new THREE.Group();
  const ownedGeometries = new Set<THREE.BufferGeometry>();
  const ownedMaterials = new Set<THREE.Material>();
  const ownedTextures = new Set<THREE.Texture>();
  const geometryClones = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  const materialClones = new Map<THREE.Material, THREE.Material>();
  const textureClones = new Map<THREE.Texture, THREE.Texture>();
  assembly.name = `${gltf.scene.name || "model"}-instances`;
  gltf.scene.updateWorldMatrix(true, true);
  try {
    const primitives: SourcePrimitive[] = [];
    gltf.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (
        object instanceof THREE.SkinnedMesh ||
        object instanceof THREE.InstancedMesh ||
        object.morphTargetInfluences !== undefined
      )
        return;
      const visible = sourceVisible(object);
      primitives.push({
        geometry: object.geometry,
        material: object.material,
        transform: object.matrixWorld.clone(),
        name: object.name,
        visible,
        renderOrder: object.renderOrder,
        layerMask: object.layers.mask,
        frustumCulled: object.frustumCulled,
      });
    });
    const cloneMaterial = (source: THREE.Material): THREE.Material => {
      const material =
        materialClones.get(source) ??
        cloneMaterialWithTextures(source, textureClones, ownedTextures);
      materialClones.set(source, material);
      ownedMaterials.add(material);
      return material;
    };
    for (const primitive of primitives) {
      const geometry =
        geometryClones.get(primitive.geometry) ?? primitive.geometry.clone();
      geometryClones.set(primitive.geometry, geometry);
      ownedGeometries.add(geometry);
      const material = Array.isArray(primitive.material)
        ? primitive.material.map(cloneMaterial)
        : cloneMaterial(primitive.material);
      const batch = new THREE.InstancedMesh(
        geometry,
        material,
        placements.length,
      );
      batch.name = primitive.name;
      batch.castShadow = options.castShadow ?? true;
      batch.receiveShadow = options.receiveShadow ?? true;
      batch.visible = primitive.visible;
      batch.renderOrder = primitive.renderOrder;
      batch.layers.mask = primitive.layerMask;
      batch.frustumCulled = primitive.frustumCulled;
      const instanceTransform = new THREE.Matrix4();
      for (let index = 0; index < placements.length; index++)
        batch.setMatrixAt(
          index,
          instanceTransform.multiplyMatrices(
            placements[index]!,
            primitive.transform,
          ),
        );
      batch.instanceMatrix.needsUpdate = true;
      batch.computeBoundingBox();
      batch.computeBoundingSphere();
      assembly.add(batch);
    }
    if (assembly.children.length === 0)
      throw new Error("Static asset has no compatible mesh primitives");
    return assembly;
  } catch (error) {
    for (const resource of [
      ...ownedGeometries,
      ...ownedMaterials,
      ...ownedTextures,
    ])
      resource.dispose();
    throw error;
  }
}

export class SceneAssets {
  private readonly loader = new GLTFLoader();
  private readonly entries = new Map<string, ModelEntry>();
  private readonly retryJobs = new Map<string, Set<RetryJob>>();
  private disposed = false;

  getState(): { loading: number; failed: number } {
    this.pruneRetryJobs();
    const failedUrls = new Set(
      [...this.entries].filter(([, entry]) => entry.failed).map(([url]) => url),
    );
    for (const [url, jobs] of this.retryJobs)
      if (jobs.size > 0) failedUrls.add(url);
    return {
      loading: [...this.entries.values()].filter((entry) => entry.loading)
        .length,
      failed: failedUrls.size,
    };
  }

  private removeRetry(url: string, job: RetryJob): void {
    const jobs = this.retryJobs.get(url);
    jobs?.delete(job);
    if (jobs?.size === 0) {
      this.retryJobs.delete(url);
      this.dropFailedLoadWithoutJobs(url);
    }
  }

  private registerRetry(url: string, job: RetryJob): void {
    const jobs = this.retryJobs.get(url) ?? new Set<RetryJob>();
    jobs.add(job);
    this.retryJobs.set(url, jobs);
  }

  private dropFailedLoadWithoutJobs(url: string): void {
    if (!this.retryJobs.get(url)?.size && this.entries.get(url)?.failed)
      this.entries.delete(url);
  }

  private pruneRetryJobs(): void {
    for (const [url, jobs] of this.retryJobs) {
      for (const job of jobs)
        if (this.disposed || !job.valid()) jobs.delete(job);
      if (jobs.size === 0) {
        this.retryJobs.delete(url);
        this.dropFailedLoadWithoutJobs(url);
      }
    }
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
        this.removeRetry(url, job);
        return;
      }
      if (inFlight || finished) return;
      inFlight = true;
      void this.load(url).then(
        (gltf) => {
          if (this.disposed || !valid()) {
            inFlight = false;
            this.removeRetry(url, job);
            return;
          }
          let attachment: AttachmentClone;
          try {
            attachment = createAttachmentClone(gltf.scene);
          } catch {
            inFlight = false;
            if (this.disposed || !valid()) {
              this.removeRetry(url, job);
              return;
            }
            this.registerRetry(url, job);
            return;
          }
          if (this.disposed || !valid()) {
            rollbackAttachment(attachment);
            inFlight = false;
            this.removeRetry(url, job);
            return;
          }
          try {
            target.add(attachment.root);
            ready?.(attachment.root, gltf.animations);
          } catch {
            rollbackAttachment(attachment);
            inFlight = false;
            if (this.disposed || !valid()) {
              this.removeRetry(url, job);
              return;
            }
            this.registerRetry(url, job);
            return;
          }
          if (this.disposed || !valid()) {
            rollbackAttachment(attachment);
            inFlight = false;
            this.removeRetry(url, job);
            return;
          }
          finished = true;
          inFlight = false;
          this.removeRetry(url, job);
        },
        () => {
          inFlight = false;
          if (finished) return;
          if (this.disposed || !valid()) {
            this.dropFailedLoadWithoutJobs(url);
            return;
          }
          this.registerRetry(url, job);
        },
      );
    };
    const job: RetryJob = { run, valid };
    run();
  }

  /** Flattens a static GLTF into one instanced batch per compatible source mesh. */
  attachInstances(
    url: string,
    target: THREE.Object3D,
    placements: readonly THREE.Matrix4[],
    valid: () => boolean,
    options: InstanceAttachOptions = {},
  ): void {
    if (placements.length === 0) return;
    const placementSnapshot = placements.map((placement) => placement.clone());
    const optionSnapshot = { ...options };
    let inFlight = false;
    let finished = false;
    const run = () => {
      if (this.disposed || !valid()) {
        this.removeRetry(url, job);
        return;
      }
      if (inFlight || finished) return;
      inFlight = true;
      void this.load(url).then(
        (gltf) => {
          inFlight = false;
          this.removeRetry(url, job);
          if (this.disposed || !valid()) return;
          let assembly: THREE.Group;
          try {
            assembly = createInstanceBatch(
              gltf,
              placementSnapshot,
              optionSnapshot,
            );
          } catch {
            this.registerRetry(url, job);
            return;
          }
          if (this.disposed || !valid()) {
            disposeInstanceBatch(assembly);
            return;
          }
          target.add(assembly);
          finished = true;
        },
        () => {
          inFlight = false;
          if (this.disposed || !valid()) {
            this.dropFailedLoadWithoutJobs(url);
            return;
          }
          this.registerRetry(url, job);
        },
      );
    };
    const job: RetryJob = { run, valid };
    run();
  }

  retry(): void {
    this.pruneRetryJobs();
    for (const [url, entry] of this.entries)
      if (entry.failed) this.entries.delete(url);
    for (const jobs of this.retryJobs.values())
      for (const job of jobs) job.run();
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
