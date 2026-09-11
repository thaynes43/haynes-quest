import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { disposeTree, SceneAssets } from "../../src/game/scene-assets";

function gltf(scene: THREE.Group): GLTF {
  return { scene, scenes: [scene], animations: [] } as unknown as GLTF;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}

function expectMatrix(actual: THREE.Matrix4, expected: THREE.Matrix4): void {
  actual.elements.forEach((value, index) =>
    expect(value).toBeCloseTo(expected.elements[index]!, 6),
  );
}

afterEach(() => vi.restoreAllMocks());

describe("SceneAssets.attachInstances", () => {
  it("bakes the complete source hierarchy into every placement and preserves grouped materials", async () => {
    const scene = new THREE.Group();
    scene.name = "fixture-root";
    scene.position.set(1.25, -0.5, 2.75);
    scene.rotation.set(0.2, -0.35, 0.1);
    scene.scale.set(1.1, 0.8, 1.3);
    const nested = new THREE.Group();
    nested.position.set(-0.75, 1.5, 0.25);
    nested.rotation.z = 0.4;
    const geometry = new THREE.BoxGeometry(1, 2, 3);
    geometry.clearGroups();
    geometry.addGroup(0, 18, 0);
    geometry.addGroup(18, 18, 1);
    const sourceTexture = new THREE.Texture();
    const sourceTextureDispose = vi.spyOn(sourceTexture, "dispose");
    const materials = [
      new THREE.MeshStandardMaterial({ color: 0xaabbcc, map: sourceTexture }),
      new THREE.MeshStandardMaterial({ color: 0x332211 }),
    ];
    const source = new THREE.Mesh(geometry, materials);
    source.name = "grouped-primitive";
    source.position.set(0.5, 0.25, -1.5);
    source.rotation.y = 0.65;
    source.scale.set(0.75, 1.2, 0.9);
    source.renderOrder = 7;
    source.layers.set(3);
    nested.add(source);
    const repeatedParent = new THREE.Group();
    repeatedParent.position.set(2, -1, 0.75);
    repeatedParent.rotation.x = -0.3;
    const repeatedSource = new THREE.Mesh(geometry, materials);
    repeatedSource.position.set(-0.4, 0.6, 1.1);
    repeatedSource.renderOrder = 7;
    repeatedSource.layers.set(3);
    repeatedParent.add(repeatedSource);
    scene.add(nested, repeatedParent);
    scene.updateMatrix();
    nested.updateMatrix();
    source.updateMatrix();
    repeatedParent.updateMatrix();
    repeatedSource.updateMatrix();
    const sourceTransforms = [
      new THREE.Matrix4()
        .multiplyMatrices(scene.matrix, nested.matrix)
        .multiply(source.matrix),
      new THREE.Matrix4()
        .multiplyMatrices(scene.matrix, repeatedParent.matrix)
        .multiply(repeatedSource.matrix),
    ];
    expectMatrix(source.matrixWorld, new THREE.Matrix4());
    expectMatrix(repeatedSource.matrixWorld, new THREE.Matrix4());
    const placements = [
      new THREE.Matrix4().makeTranslation(4, 0, -2),
      new THREE.Matrix4().compose(
        new THREE.Vector3(-3, 2, 6),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 1.1, 0)),
        new THREE.Vector3(1.5, 1.5, 1.5),
      ),
    ];
    const placementSnapshot = placements.map((placement) => placement.clone());
    const geometryClone = vi.spyOn(geometry, "clone");
    const geometryDispose = vi.spyOn(geometry, "dispose");
    const materialDisposals = materials.map((material) =>
      vi.spyOn(material, "dispose"),
    );
    vi.spyOn(GLTFLoader.prototype, "loadAsync").mockResolvedValue(gltf(scene));
    const target = new THREE.Group();
    target.position.set(50, 0, 0);
    const assets = new SceneAssets();
    const options = { castShadow: false, receiveShadow: true };

    assets.attachInstances(
      "/grouped.glb",
      target,
      placements,
      () => true,
      options,
    );
    placements[0]!.makeScale(9, 9, 9);
    options.castShadow = true;
    options.receiveShadow = false;

    await vi.waitFor(() => expect(target.children).toHaveLength(1));
    const assembly = target.children[0]!;
    expect(assembly.name).toBe("fixture-root-instances");
    expect(assembly.children).toHaveLength(2);
    expect(
      assembly.children.every((child) => child instanceof THREE.InstancedMesh),
    ).toBe(true);
    const batch = assembly.children[0] as THREE.InstancedMesh;
    const repeatedBatch = assembly.children[1] as THREE.InstancedMesh;
    expect(batch.count).toBe(2);
    expect(repeatedBatch.count).toBe(2);
    expect(batch.name).toBe("grouped-primitive");
    expect(batch.castShadow).toBe(false);
    expect(batch.receiveShadow).toBe(true);
    expect(batch.renderOrder).toBe(7);
    expect(batch.layers.mask).toBe(source.layers.mask);
    expect(batch.geometry).not.toBe(geometry);
    expect(repeatedBatch.geometry).toBe(batch.geometry);
    expect(geometryClone).toHaveBeenCalledOnce();
    expect(batch.geometry.groups).toEqual(geometry.groups);
    expect(Array.isArray(batch.material)).toBe(true);
    const clonedMaterials = batch.material as THREE.Material[];
    expect(clonedMaterials).toHaveLength(2);
    expect(clonedMaterials[0]).not.toBe(materials[0]);
    expect(clonedMaterials[1]).not.toBe(materials[1]);
    expect(repeatedBatch.material).toEqual(clonedMaterials);
    const clonedTexture = (clonedMaterials[0] as THREE.MeshStandardMaterial)
      .map;
    const repeatedMaterials = repeatedBatch.material as THREE.Material[];
    expect(clonedTexture).toBeInstanceOf(THREE.Texture);
    expect(clonedTexture).not.toBe(sourceTexture);
    expect((repeatedMaterials[0] as THREE.MeshStandardMaterial).map).toBe(
      clonedTexture,
    );
    expect(
      (clonedMaterials[0] as THREE.MeshStandardMaterial).color.getHex(),
    ).toBe(0xaabbcc);
    expect(
      (clonedMaterials[1] as THREE.MeshStandardMaterial).color.getHex(),
    ).toBe(0x332211);
    const actual = new THREE.Matrix4();
    for (let index = 0; index < placementSnapshot.length; index++) {
      batch.getMatrixAt(index, actual);
      expectMatrix(
        actual,
        new THREE.Matrix4().multiplyMatrices(
          placementSnapshot[index]!,
          sourceTransforms[0]!,
        ),
      );
      repeatedBatch.getMatrixAt(index, actual);
      expectMatrix(
        actual,
        new THREE.Matrix4().multiplyMatrices(
          placementSnapshot[index]!,
          sourceTransforms[1]!,
        ),
      );
    }
    expect(batch.boundingBox).not.toBeNull();
    expect(batch.boundingSphere).not.toBeNull();
    const clonedGeometryDispose = vi.spyOn(batch.geometry, "dispose");
    const instanceDisposals = [batch, repeatedBatch].map((instance) =>
      vi.spyOn(instance, "dispose"),
    );
    const clonedMaterialDisposals = clonedMaterials.map((material) =>
      vi.spyOn(material, "dispose"),
    );
    const clonedTextureDispose = vi.spyOn(clonedTexture!, "dispose");
    disposeTree(target);
    for (const disposal of instanceDisposals)
      expect(disposal).toHaveBeenCalledOnce();
    expect(clonedGeometryDispose).toHaveBeenCalledOnce();
    for (const disposal of clonedMaterialDisposals)
      expect(disposal).toHaveBeenCalledOnce();
    expect(geometryDispose).not.toHaveBeenCalled();
    for (const disposal of materialDisposals)
      expect(disposal).not.toHaveBeenCalled();
    expect(clonedTextureDispose).toHaveBeenCalledOnce();
    expect(sourceTextureDispose).not.toHaveBeenCalled();
  });

  it("shares a retried load without duplicating batches and drops invalid jobs", async () => {
    const sourceScene = new THREE.Group();
    const geometry = new THREE.BoxGeometry();
    sourceScene.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
    const retryLoad = deferred<GLTF>();
    const load = vi
      .spyOn(GLTFLoader.prototype, "loadAsync")
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockImplementationOnce(() => retryLoad.promise);
    const geometryClone = vi.spyOn(geometry, "clone");
    const assets = new SceneAssets();
    const staleTarget = new THREE.Group();
    const currentTarget = new THREE.Group();
    let stale = false;
    const placement = [new THREE.Matrix4().makeTranslation(1, 2, 3)];

    assets.attachInstances("/shared.glb", staleTarget, placement, () => !stale);
    assets.attachInstances("/shared.glb", currentTarget, placement, () => true);
    await vi.waitFor(() => expect(assets.getState().failed).toBe(1));
    expect(load).toHaveBeenCalledTimes(1);
    stale = true;

    assets.retry();
    assets.retry();
    expect(load).toHaveBeenCalledTimes(2);
    retryLoad.resolve(gltf(sourceScene));

    await vi.waitFor(() => expect(currentTarget.children).toHaveLength(1));
    expect(staleTarget.children).toHaveLength(0);
    expect(currentTarget.children[0]!.children).toHaveLength(1);
    expect(geometryClone).toHaveBeenCalledTimes(1);
    expect(assets.getState()).toEqual({ loading: 0, failed: 0 });
    assets.retry();
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(2);
    expect(currentTarget.children).toHaveLength(1);
  });

  it("keeps construction failures visible and retries the cached GLTF", async () => {
    const sourceScene = new THREE.Group();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial();
    sourceScene.add(new THREE.Mesh(geometry, material));
    const clone = material.clone.bind(material);
    vi.spyOn(material, "clone")
      .mockImplementationOnce(() => {
        throw new Error("temporary construction failure");
      })
      .mockImplementation(clone);
    const load = vi
      .spyOn(GLTFLoader.prototype, "loadAsync")
      .mockResolvedValue(gltf(sourceScene));
    const assets = new SceneAssets();
    const target = new THREE.Group();

    assets.attachInstances(
      "/construction.glb",
      target,
      [new THREE.Matrix4()],
      () => true,
    );

    await vi.waitFor(() => expect(assets.getState().failed).toBe(1));
    expect(target.children).toHaveLength(0);
    expect(load).toHaveBeenCalledOnce();
    assets.retry();
    await vi.waitFor(() => expect(target.children).toHaveLength(1));
    expect(load).toHaveBeenCalledOnce();
    expect(assets.getState()).toEqual({ loading: 0, failed: 0 });

    const emptyTarget = new THREE.Group();
    let emptyValid = true;
    load.mockResolvedValueOnce(gltf(new THREE.Group()));
    assets.attachInstances(
      "/empty.glb",
      emptyTarget,
      [new THREE.Matrix4()],
      () => emptyValid,
    );
    await vi.waitFor(() => expect(assets.getState().failed).toBe(1));
    expect(emptyTarget.children).toHaveLength(0);
    assets.retry();
    await vi.waitFor(() => expect(assets.getState().failed).toBe(1));
    expect(emptyTarget.children).toHaveLength(0);
    expect(load).toHaveBeenCalledTimes(2);
    emptyValid = false;
    expect(assets.getState()).toEqual({ loading: 0, failed: 0 });
    assets.retry();
    expect(emptyTarget.children).toHaveLength(0);
  });

  it("keeps existing hierarchy attachments isolated from cached textures", async () => {
    const sourceScene = new THREE.Group();
    const texture = new THREE.Texture();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial({ map: texture });
    sourceScene.add(new THREE.Mesh(geometry, material));
    const clip = new THREE.AnimationClip("idle", 1, []);
    const fixture = gltf(sourceScene);
    fixture.animations = [clip];
    vi.spyOn(GLTFLoader.prototype, "loadAsync").mockResolvedValue(fixture);
    const sourceTextureDispose = vi.spyOn(texture, "dispose");
    const assets = new SceneAssets();
    const target = new THREE.Group();
    const ready = vi.fn();

    assets.attach("/existing.glb", target, () => true, ready);

    await vi.waitFor(() => expect(target.children).toHaveLength(1));
    const attached = target.children[0] as THREE.Group;
    const attachedMesh = attached.children[0] as THREE.Mesh;
    const attachedTexture = (attachedMesh.material as THREE.MeshBasicMaterial)
      .map;
    expect(attachedMesh.geometry).not.toBe(geometry);
    expect(attachedMesh.material).not.toBe(material);
    expect(attachedTexture).toBeInstanceOf(THREE.Texture);
    expect(attachedTexture).not.toBe(texture);
    expect(ready).toHaveBeenCalledWith(attached, [clip]);
    const attachedTextureDispose = vi.spyOn(attachedTexture!, "dispose");
    disposeTree(target);
    expect(attachedTextureDispose).toHaveBeenCalledOnce();
    expect(sourceTextureDispose).not.toHaveBeenCalled();
    assets.dispose();
    await vi.waitFor(() => expect(sourceTextureDispose).toHaveBeenCalledOnce());
  });

  it("disposes a batch assembled after its route becomes stale", async () => {
    const sourceScene = new THREE.Group();
    const sourceGeometry = new THREE.BoxGeometry();
    const sourceTexture = new THREE.Texture();
    const sourceMaterial = new THREE.MeshBasicMaterial({ map: sourceTexture });
    const sourceGeometryDispose = vi.spyOn(sourceGeometry, "dispose");
    const sourceMaterialDispose = vi.spyOn(sourceMaterial, "dispose");
    const sourceTextureDispose = vi.spyOn(sourceTexture, "dispose");
    const textureDispose = vi.spyOn(THREE.Texture.prototype, "dispose");
    const clonedGeometry = sourceGeometry.clone();
    const clonedMaterial = sourceMaterial.clone();
    const geometryDispose = vi.spyOn(clonedGeometry, "dispose");
    const materialDispose = vi.spyOn(clonedMaterial, "dispose");
    vi.spyOn(sourceGeometry, "clone").mockReturnValue(clonedGeometry);
    vi.spyOn(sourceMaterial, "clone").mockReturnValue(clonedMaterial);
    sourceScene.add(new THREE.Mesh(sourceGeometry, sourceMaterial));
    vi.spyOn(GLTFLoader.prototype, "loadAsync").mockResolvedValue(
      gltf(sourceScene),
    );
    const instanceDispose = vi.spyOn(THREE.InstancedMesh.prototype, "dispose");
    const assets = new SceneAssets();
    const target = new THREE.Group();
    let validityChecks = 0;

    assets.attachInstances(
      "/stale.glb",
      target,
      [new THREE.Matrix4()],
      () => ++validityChecks < 3,
    );

    await vi.waitFor(() => expect(materialDispose).toHaveBeenCalledOnce());
    expect(instanceDispose).toHaveBeenCalledOnce();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(target.children).toHaveLength(0);
    expect(sourceGeometryDispose).not.toHaveBeenCalled();
    expect(sourceMaterialDispose).not.toHaveBeenCalled();
    expect(textureDispose).toHaveBeenCalledOnce();
    expect(sourceTextureDispose).not.toHaveBeenCalled();
  });

  it("does not assemble after disposal and releases the cached source GLTF", async () => {
    const sourceScene = new THREE.Group();
    const texture = new THREE.Texture();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial({ map: texture });
    sourceScene.add(new THREE.Mesh(geometry, material));
    const geometryDispose = vi.spyOn(geometry, "dispose");
    const materialDispose = vi.spyOn(material, "dispose");
    const textureDispose = vi.spyOn(texture, "dispose");
    const pending = deferred<GLTF>();
    const load = vi
      .spyOn(GLTFLoader.prototype, "loadAsync")
      .mockReturnValue(pending.promise);
    const assets = new SceneAssets();
    const target = new THREE.Group();

    assets.attachInstances(
      "/pending.glb",
      target,
      [new THREE.Matrix4()],
      () => true,
    );
    assets.dispose();
    assets.retry();
    pending.resolve(gltf(sourceScene));

    await vi.waitFor(() => expect(textureDispose).toHaveBeenCalledOnce());
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(target.children).toHaveLength(0);
    expect(load).toHaveBeenCalledTimes(1);
    expect(assets.getState()).toEqual({ loading: 0, failed: 0 });
  });
});
