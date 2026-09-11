import * as THREE from "three";
import type { FriendlyView, SaveView } from "../shared/contracts";
import type { LevelLayout } from "./level";
import type { PositionSnapshot } from "./types";
import { SceneAssets } from "./scene-assets";
import { groundRing } from "./scene-art";

const heights: Record<string, number> = {
  blockling: 0.85,
  "signal-moth": 0.9,
  "buffer-baron": 1.85,
  "loop-dancer": 1.1,
  "prism-mimic": 1.05,
  trendweaver: 1.9,
};

/** Retains the authored defeat pose so making amends always has a visible target. */
export class FriendlyScene {
  readonly root = new THREE.Group();
  private readonly residents = new Map<
    string,
    {
      root: THREE.Group;
      model: THREE.Group;
      heart: THREE.Mesh;
      ring: THREE.Mesh;
      progress: FriendlyView;
      lastHp: number;
      mixer?: THREE.AnimationMixer;
      actions?: Map<string, THREE.AnimationAction>;
      current?: string;
      hitRemaining: number;
    }
  >();
  constructor(level: LevelLayout, assets: SceneAssets, valid: () => boolean) {
    for (const placement of level.friendlies ?? []) {
      const root = new THREE.Group();
      root.name = `friendly-${placement.assetId}`;
      root.position.copy(placement.position);
      const model = new THREE.Group();
      const ring = groundRing(0.63, 0x79ecc6, 0.6);
      const shape = new THREE.Shape();
      shape.moveTo(0, -0.13);
      shape.bezierCurveTo(-0.3, 0.08, -0.16, 0.3, 0, 0.14);
      shape.bezierCurveTo(0.16, 0.3, 0.3, 0.08, 0, -0.13);
      const heart = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshBasicMaterial({
          color: 0x91f8cc,
          side: THREE.DoubleSide,
        }),
      );
      heart.position.y = (heights[placement.assetId] ?? 1.2) + 0.3;
      root.add(model, ring, heart);
      this.root.add(root);
      const resident = {
        root,
        model,
        heart,
        ring,
        progress: placement,
        lastHp: placement.hp,
        hitRemaining: 0,
      } as typeof this.residents extends Map<string, infer T> ? T : never;
      this.residents.set(placement.id, resident);
      if (!(placement.assetId in heights) || placement.assetVersion !== "v001")
        continue;
      assets.attach(
        `/studio/assets/media/${placement.assetId}/v001/${placement.assetId}.glb`,
        model,
        valid,
        (loaded, clips) => {
          resident.mixer = new THREE.AnimationMixer(loaded);
          resident.actions = new Map(
            clips.map((clip) => {
              const action = resident.mixer!.clipAction(clip);
              action.setLoop(
                clip.name === "idle" ? THREE.LoopRepeat : THREE.LoopOnce,
                clip.name === "idle" ? Infinity : 1,
              );
              action.clampWhenFinished = true;
              return [clip.name, action];
            }),
          );
        },
      );
    }
  }
  targetPosition(id: string): PositionSnapshot | null {
    const resident = this.residents.get(id);
    return resident
      ? {
          x: resident.root.position.x,
          y: resident.root.position.y,
          z: resident.root.position.z,
        }
      : null;
  }
  sync(save: SaveView): void {
    for (const friend of save.adventure?.activeLevel?.friendlies ?? []) {
      const visual = this.residents.get(friend.id);
      if (!visual) continue;
      if (friend.hp < visual.lastHp) visual.hitRemaining = 0.6;
      if (friend.hp > visual.lastHp) visual.hitRemaining = 0;
      visual.lastHp = friend.hp;
      visual.progress = friend;
    }
  }
  update(
    dt: number,
    elapsed: number,
    player: PositionSnapshot,
    camera: THREE.Camera,
  ): void {
    for (const visual of this.residents.values()) {
      const friend = visual.progress;
      const clip = friend.defeated
        ? "defeat"
        : visual.hitRemaining > 0
          ? "hit"
          : "idle";
      if (visual.actions && visual.current !== clip) {
        const next = visual.actions.get(clip);
        if (next) {
          for (const action of visual.actions.values()) action.stop();
          next.reset().play();
          if (friend.defeated && !visual.current) {
            next.time = next.getClip().duration;
            next.paused = true;
          }
          visual.current = clip;
        }
      }
      visual.mixer?.update(dt);
      visual.hitRemaining = Math.max(0, visual.hitRemaining - dt);
      if (!friend.defeated)
        visual.model.rotation.y = Math.atan2(
          visual.root.position.x - player.x,
          visual.root.position.z - player.z,
        );
      visual.heart.quaternion.copy(camera.quaternion);
      visual.heart.scale.setScalar(1 + Math.sin(elapsed * 2.5) * 0.06);
      (visual.heart.material as THREE.MeshBasicMaterial).color.setHex(
        friend.penaltyActive
          ? 0xffbe8d
          : friend.boonClaimed
            ? 0xb1c9bc
            : 0x91f8cc,
      );
      (visual.ring.material as THREE.MeshBasicMaterial).color.setHex(
        friend.penaltyActive ? 0xffbe8d : 0x79ecc6,
      );
    }
  }
  dispose(): void {
    for (const visual of this.residents.values()) {
      visual.mixer?.stopAllAction();
      if (visual.mixer) visual.mixer.uncacheRoot(visual.mixer.getRoot());
    }
    this.residents.clear();
  }
}
