import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { EquipmentView } from "../../src/shared/contracts";
import { SceneAssets } from "../../src/game/scene-assets";
import { TravelerEquipment } from "../../src/game/traveler-equipment";

async function traveler() {
  const bytes = readFileSync(
    new URL(
      "../../docs/assets/media/traveler-child/v001/traveler-child.glb",
      import.meta.url,
    ),
  );
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  const assets = new SceneAssets();
  const attach = vi
    .spyOn(assets, "attach")
    .mockImplementation((_url, target) => {
      target.add(
        new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.4, 0.1),
          new THREE.MeshBasicMaterial(),
        ),
      );
    });
  const equipment = new TravelerEquipment(
    gltf.scene,
    "child",
    assets,
    () => true,
  );
  return { root: gltf.scene, equipment, attach };
}

function item(
  id: string,
  kind: EquipmentView["kind"],
  tier = 1,
): EquipmentView {
  return {
    id,
    pickupId: id,
    kind,
    tier,
    damage: kind === "attack-tool" ? tier + 1 : 0,
    guardReduction: kind === "guard-tool" ? tier + 1 : 0,
    collected: true,
  };
}

describe("equipment on the exported traveler rig", () => {
  it("keeps the physical grip on the animated hand, including world movement", async () => {
    const { root, equipment } = await traveler();
    equipment.update([item("mallet", "attack-tool")], "mallet");
    const hand = root.getObjectByName("handR")!;
    const held = root.getObjectByName("held-spark-mallet")!;
    expect(held.parent).toBe(hand);
    const before = held.getWorldPosition(new THREE.Vector3());
    root.getObjectByName("upper_armR")!.rotateX(0.7);
    const animated = held.getWorldPosition(new THREE.Vector3());
    expect(animated.distanceTo(before)).toBeGreaterThan(0.1);
    root.position.set(2, 0, -3);
    const moved = held.getWorldPosition(new THREE.Vector3());
    expect(
      moved
        .clone()
        .sub(animated)
        .distanceTo(new THREE.Vector3(2, 0, -3)),
    ).toBeLessThan(1e-6);
    equipment.dispose();
  });

  it("replaces both stronger tools without duplicate loads or a detached stale prop", async () => {
    const { root, equipment, attach } = await traveler();
    const inventory = [
      item("mallet", "attack-tool"),
      item("acorn", "guard-tool"),
    ];
    equipment.update(inventory, "mallet");
    const oldShield = root.getObjectByName("held-acorn-shield")!;
    const oldMesh = oldShield.children[0] as THREE.Mesh;
    const dispose = vi.spyOn(oldMesh.geometry, "dispose");
    equipment.update(inventory, "mallet");
    expect(attach).toHaveBeenCalledTimes(2);
    inventory.push(
      item("wand", "attack-tool", 2),
      item("ribbon", "guard-tool", 2),
    );
    equipment.update(inventory, "wand");
    expect(attach).toHaveBeenCalledTimes(4);
    expect(oldShield.parent).toBeNull();
    expect(dispose).toHaveBeenCalledOnce();
    expect(root.getObjectByName("held-prism-wand")?.parent?.userData.name).toBe(
      "hand.R",
    );
    expect(root.getObjectByName("held-ribbon-shield")?.parent?.userData.name).toBe(
      "hand.L",
    );
    expect(attach.mock.calls[0]![2]()).toBe(false);
    expect(attach.mock.calls[3]![2]()).toBe(true);
    equipment.dispose();
    expect(attach.mock.calls[3]![2]()).toBe(false);
  });

  it("does not accumulate pose offsets or leave posed bones after disposal", async () => {
    const { root, equipment } = await traveler();
    equipment.update(
      [item("mallet", "attack-tool"), item("acorn", "guard-tool")],
      "mallet",
    );
    const arm = root.getObjectByName("upper_armR")!;
    const baseline = arm.quaternion.clone();
    equipment.pose(0.2, true);
    const posed = arm.quaternion.clone();
    expect(posed.angleTo(baseline)).toBeGreaterThan(0.5);
    for (let frame = 0; frame < 30; frame++) {
      equipment.resetPose();
      equipment.pose(0.2, true);
    }
    expect(arm.quaternion.angleTo(posed)).toBeLessThan(1e-6);
    equipment.dispose();
    expect(arm.quaternion.angleTo(baseline)).toBeLessThan(1e-6);
    expect(root.getObjectByName("held-spark-mallet")).toBeUndefined();
  });
});
