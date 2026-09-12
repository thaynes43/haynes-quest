import * as THREE from "three";
import type { AppearanceStage, EquipmentView } from "../shared/contracts";
import { disposeTree, type SceneAssets } from "./scene-assets";
import { equipmentArtwork } from "./scene-catalog";

const sockets = {
  infant: [0.010140156952023374, -0.015210235428035061, -0.01747703508606994],
  child: [0.01085169822656668, -0.024243172375776632, -0.013848632668898558],
} as const;

/** Grip centers measured from the exact v001 traveler rigs, in meters. */
export class TravelerEquipment {
  private readonly bones = new Map<string, THREE.Bone>();
  private readonly animatedPose = new Map<THREE.Bone, THREE.Quaternion>();
  private readonly slots = new Map<string, { id: string; root: THREE.Group }>();
  private disposed = false;

  constructor(
    root: THREE.Group,
    private readonly stage: AppearanceStage,
    private readonly assets: SceneAssets,
    private readonly valid: () => boolean,
  ) {
    // GLTFLoader sanitizes dots out of animation target names, preserving the
    // authored joint name in userData. Use that stable identity for sockets.
    root.traverse((object) => {
      if (object instanceof THREE.Bone)
        this.bones.set(object.userData.name ?? object.name, object);
    });
    for (const side of ["L", "R"])
      for (const joint of ["hand", "forearm", "upper_arm"]) {
        const name = `${joint}.${side}`;
        if (!this.bones.has(name))
          throw new Error("Traveler is missing a required equipment joint");
      }
  }

  update(inventory: EquipmentView[], equippedId: string | null): void {
    if (this.disposed) return;
    const weapon = inventory.find((item) => item.id === equippedId);
    const shield = inventory
      .filter((item) => item.kind === "guard-tool")
      .reduce<EquipmentView | undefined>(
        (best, item) =>
          !best || item.guardReduction > best.guardReduction ? item : best,
        undefined,
      );
    this.attach("R", weapon);
    this.attach("L", shield);
  }

  /** Restore last frame's animation pose before the mixer writes the next one. */
  resetPose(): void {
    for (const [bone, quaternion] of this.animatedPose)
      bone.quaternion.copy(quaternion);
    this.animatedPose.clear();
  }

  pose(attackTime: number, guarding: boolean, secondaryTime = 10): void {
    if (this.disposed) return;
    if (this.slots.has("R") || attackTime < 0.4) {
      // These offsets animate the arms and wrist, keeping the prop in its grip.
      const strike =
        attackTime >= 0 && attackTime < 0.4
          ? Math.sin((attackTime / 0.4) * Math.PI)
          : 0;
      this.rotate("upper_arm.R", 0.15 + strike, 0, 0.12);
      this.rotate("forearm.R", 0.25 + strike * 0.1, 0, 0);
      this.rotate("hand.R", -0.4 - strike * 2.25, 0, 0);
    }
    if (this.slots.has("L")) {
      const bash =
        secondaryTime >= 0 && secondaryTime < 0.4
          ? Math.sin((secondaryTime / 0.4) * Math.PI)
          : 0;
      this.rotate(
        "upper_arm.L",
        guarding ? 0.55 : 0.12 + bash * 1.4,
        bash * 0.3,
        -0.14,
      );
      this.rotate("forearm.L", guarding ? 0.9 : 0.25 + bash * 0.5, 0, 0);
      this.rotate("hand.L", guarding ? -1.45 : -0.37 - bash, 0, 0);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resetPose();
    for (const { root } of this.slots.values()) {
      root.removeFromParent();
      disposeTree(root);
    }
    this.slots.clear();
  }

  private attach(side: "L" | "R", item?: EquipmentView): void {
    const previous = this.slots.get(side);
    if (previous?.id === item?.id) return;
    if (previous) {
      previous.root.removeFromParent();
      disposeTree(previous.root);
      this.slots.delete(side);
    }
    if (!item) return;
    const root = new THREE.Group();
    const artwork = equipmentArtwork(item.kind, item.tier);
    root.name = `held-${artwork.id}`;
    const offset = sockets[this.stage];
    root.position.set(
      side === "R" ? offset[0] : -offset[0],
      offset[1],
      offset[2],
    );
    this.bones.get(`hand.${side}`)!.add(root);
    this.slots.set(side, { id: item.id, root });
    this.assets.attach(
      artwork.url,
      root,
      () =>
        !this.disposed && this.valid() && this.slots.get(side)?.root === root,
    );
  }

  private rotate(name: string, x: number, y: number, z: number): void {
    const bone = this.bones.get(name)!;
    this.animatedPose.set(bone, bone.quaternion.clone());
    bone.quaternion.multiply(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)),
    );
  }
}
