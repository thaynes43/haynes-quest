import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { disposeTree, SceneAssets } from "../../src/game/scene-assets";

function gltf(scene: THREE.Group): GLTF {
  return { scene, scenes: [scene], animations: [] } as unknown as GLTF;
}

function imageWithClose(): { close: ReturnType<typeof vi.fn> } {
  return { close: vi.fn() };
}

afterEach(() => vi.restoreAllMocks());

describe("SceneAssets attachment recovery", () => {
  it("rolls back a failed callback and retries one isolated hierarchy from the cached GLTF", async () => {
    const source = new THREE.Group();
    const sourceImage = imageWithClose();
    const sourceTexture = new THREE.Texture(
      sourceImage as unknown as TexImageSource,
    );
    const sourceGeometry = new THREE.BoxGeometry();
    const sourceMaterial = new THREE.MeshBasicMaterial({ map: sourceTexture });
    const sourceMesh = new THREE.Mesh(sourceGeometry, sourceMaterial);
    sourceMesh.name = "shared-static";
    const bone = new THREE.Bone();
    bone.name = "root-bone";
    const sourceSkeleton = new THREE.Skeleton([bone]);
    const skinnedMesh = new THREE.SkinnedMesh(sourceGeometry, sourceMaterial);
    skinnedMesh.name = "shared-skinned";
    skinnedMesh.bind(sourceSkeleton);
    source.add(sourceMesh, bone, skinnedMesh);
    const sourceGeometryDispose = vi.spyOn(sourceGeometry, "dispose");
    const sourceMaterialDispose = vi.spyOn(sourceMaterial, "dispose");
    const sourceTextureDispose = vi.spyOn(sourceTexture, "dispose");
    const sourceSkeletonDispose = vi.spyOn(sourceSkeleton, "dispose");
    const load = vi
      .spyOn(GLTFLoader.prototype, "loadAsync")
      .mockResolvedValue(gltf(source));
    const target = new THREE.Group();
    const assets = new SceneAssets();
    let failedGeometryDispose: ReturnType<typeof vi.spyOn> | undefined;
    let failedMaterialDispose: ReturnType<typeof vi.spyOn> | undefined;
    let failedTextureDispose: ReturnType<typeof vi.spyOn> | undefined;
    let failedSkeletonDispose: ReturnType<typeof vi.spyOn> | undefined;
    const callbackGeometry = new THREE.SphereGeometry();
    const callbackImage = imageWithClose();
    const callbackTexture = new THREE.Texture(
      callbackImage as unknown as TexImageSource,
    );
    const callbackMaterial = new THREE.MeshBasicMaterial({
      map: callbackTexture,
    });
    const callbackGeometryDispose = vi.spyOn(callbackGeometry, "dispose");
    const callbackMaterialDispose = vi.spyOn(callbackMaterial, "dispose");
    const callbackTextureDispose = vi.spyOn(callbackTexture, "dispose");
    let attempts = 0;

    assets.attach(
      "/animated.glb",
      target,
      () => true,
      (root) => {
        attempts++;
        if (attempts !== 1) return;
        const staticClone = root.getObjectByName("shared-static") as THREE.Mesh;
        const skinnedClone = root.getObjectByName(
          "shared-skinned",
        ) as THREE.SkinnedMesh;
        const clonedMaterial = staticClone.material as THREE.MeshBasicMaterial;
        failedGeometryDispose = vi.spyOn(staticClone.geometry, "dispose");
        failedMaterialDispose = vi.spyOn(clonedMaterial, "dispose");
        failedTextureDispose = vi.spyOn(clonedMaterial.map!, "dispose");
        failedSkeletonDispose = vi.spyOn(skinnedClone.skeleton, "dispose");
        const callbackChild = new THREE.Mesh(
          callbackGeometry,
          callbackMaterial,
        );
        callbackChild.name = "callback-child";
        root.add(callbackChild);
        throw new Error("missing required animation clip");
      },
    );

    await vi.waitFor(() => expect(assets.getState().failed).toBe(1));
    expect(target.children).toHaveLength(0);
    expect(failedGeometryDispose).toHaveBeenCalledOnce();
    expect(failedMaterialDispose).toHaveBeenCalledOnce();
    expect(failedTextureDispose).toHaveBeenCalledOnce();
    expect(failedSkeletonDispose).toHaveBeenCalledOnce();
    expect(callbackGeometryDispose).toHaveBeenCalledOnce();
    expect(callbackMaterialDispose).toHaveBeenCalledOnce();
    expect(callbackTextureDispose).toHaveBeenCalledOnce();
    expect(sourceGeometryDispose).not.toHaveBeenCalled();
    expect(sourceMaterialDispose).not.toHaveBeenCalled();
    expect(sourceTextureDispose).not.toHaveBeenCalled();
    expect(sourceSkeletonDispose).not.toHaveBeenCalled();
    expect(sourceImage.close).not.toHaveBeenCalled();
    expect(callbackImage.close).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledOnce();

    assets.retry();
    assets.retry();

    await vi.waitFor(() => expect(target.children).toHaveLength(1));
    expect(attempts).toBe(2);
    expect(load).toHaveBeenCalledOnce();
    expect(
      target.children[0]!.getObjectByName("callback-child"),
    ).toBeUndefined();
    expect(assets.getState()).toEqual({ loading: 0, failed: 0 });
    assets.retry();
    await Promise.resolve();
    expect(target.children).toHaveLength(1);
    expect(attempts).toBe(2);

    disposeTree(target);
    assets.dispose();
  });

  it("releases completed clones after partial construction without touching borrowed cache resources", async () => {
    const source = new THREE.Group();
    const sourceImage = imageWithClose();
    const sourceTexture = new THREE.Texture(
      sourceImage as unknown as TexImageSource,
    );
    const sourceGeometry = new THREE.BoxGeometry();
    const firstMaterial = new THREE.MeshBasicMaterial({ map: sourceTexture });
    const failingMaterial = new THREE.MeshBasicMaterial();
    source.add(
      new THREE.Mesh(sourceGeometry, firstMaterial),
      new THREE.Mesh(sourceGeometry, failingMaterial),
    );
    const geometryClone = sourceGeometry.clone();
    const materialClone = firstMaterial.clone();
    const textureClone = sourceTexture.clone();
    const geometryCloneDispose = vi.spyOn(geometryClone, "dispose");
    const materialCloneDispose = vi.spyOn(materialClone, "dispose");
    const textureCloneDispose = vi.spyOn(textureClone, "dispose");
    vi.spyOn(sourceGeometry, "clone").mockReturnValue(geometryClone);
    vi.spyOn(firstMaterial, "clone").mockReturnValue(materialClone);
    vi.spyOn(sourceTexture, "clone").mockReturnValue(textureClone);
    vi.spyOn(failingMaterial, "clone").mockImplementation(() => {
      throw new Error("temporary material clone failure");
    });
    const sourceGeometryDispose = vi.spyOn(sourceGeometry, "dispose");
    const firstMaterialDispose = vi.spyOn(firstMaterial, "dispose");
    const failingMaterialDispose = vi.spyOn(failingMaterial, "dispose");
    const sourceTextureDispose = vi.spyOn(sourceTexture, "dispose");
    vi.spyOn(GLTFLoader.prototype, "loadAsync").mockResolvedValue(gltf(source));
    const assets = new SceneAssets();
    const target = new THREE.Group();
    let valid = true;

    assets.attach("/partial.glb", target, () => valid);

    await vi.waitFor(() => expect(assets.getState().failed).toBe(1));
    expect(target.children).toHaveLength(0);
    expect(geometryCloneDispose).toHaveBeenCalledOnce();
    expect(materialCloneDispose).toHaveBeenCalledOnce();
    expect(textureCloneDispose).toHaveBeenCalledOnce();
    expect(sourceGeometryDispose).not.toHaveBeenCalled();
    expect(firstMaterialDispose).not.toHaveBeenCalled();
    expect(failingMaterialDispose).not.toHaveBeenCalled();
    expect(sourceTextureDispose).not.toHaveBeenCalled();
    expect(sourceImage.close).not.toHaveBeenCalled();
    valid = false;
    expect(assets.getState()).toEqual({ loading: 0, failed: 0 });
    assets.dispose();
  });

  it("rolls back a callback result when its target becomes stale", async () => {
    const sourceGeometry = new THREE.BoxGeometry();
    const sourceMaterial = new THREE.MeshBasicMaterial();
    const source = new THREE.Group();
    source.add(new THREE.Mesh(sourceGeometry, sourceMaterial));
    vi.spyOn(GLTFLoader.prototype, "loadAsync").mockResolvedValue(gltf(source));
    const sourceGeometryDispose = vi.spyOn(sourceGeometry, "dispose");
    const sourceMaterialDispose = vi.spyOn(sourceMaterial, "dispose");
    const callbackGeometry = new THREE.BoxGeometry();
    const callbackMaterial = new THREE.MeshBasicMaterial();
    const callbackGeometryDispose = vi.spyOn(callbackGeometry, "dispose");
    const callbackMaterialDispose = vi.spyOn(callbackMaterial, "dispose");
    const target = new THREE.Group();
    const assets = new SceneAssets();
    let valid = true;

    assets.attach(
      "/stale-callback.glb",
      target,
      () => valid,
      (root) => {
        root.add(new THREE.Mesh(callbackGeometry, callbackMaterial));
        valid = false;
      },
    );

    await vi.waitFor(() =>
      expect(callbackMaterialDispose).toHaveBeenCalledOnce(),
    );
    expect(callbackGeometryDispose).toHaveBeenCalledOnce();
    expect(target.children).toHaveLength(0);
    expect(sourceGeometryDispose).not.toHaveBeenCalled();
    expect(sourceMaterialDispose).not.toHaveBeenCalled();
    expect(assets.getState()).toEqual({ loading: 0, failed: 0 });
    assets.retry();
    await Promise.resolve();
    expect(target.children).toHaveLength(0);
    assets.dispose();
  });

  it("rolls back callback-owned resources when disposal happens inside the callback", async () => {
    const source = new THREE.Group();
    source.add(
      new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()),
    );
    const load = vi
      .spyOn(GLTFLoader.prototype, "loadAsync")
      .mockResolvedValue(gltf(source));
    const callbackGeometry = new THREE.BoxGeometry();
    const callbackMaterial = new THREE.MeshBasicMaterial();
    const callbackGeometryDispose = vi.spyOn(callbackGeometry, "dispose");
    const callbackMaterialDispose = vi.spyOn(callbackMaterial, "dispose");
    const target = new THREE.Group();
    const assets = new SceneAssets();

    assets.attach(
      "/disposed-callback.glb",
      target,
      () => true,
      (root) => {
        root.add(new THREE.Mesh(callbackGeometry, callbackMaterial));
        assets.dispose();
      },
    );

    await vi.waitFor(() =>
      expect(callbackMaterialDispose).toHaveBeenCalledOnce(),
    );
    expect(callbackGeometryDispose).toHaveBeenCalledOnce();
    expect(target.children).toHaveLength(0);
    expect(assets.getState()).toEqual({ loading: 0, failed: 0 });
    assets.retry();
    await Promise.resolve();
    expect(load).toHaveBeenCalledOnce();
    expect(target.children).toHaveLength(0);
  });
});
