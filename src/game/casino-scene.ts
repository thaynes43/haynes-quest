import * as THREE from "three";
import type { LevelLayout } from "./level";
import type { SceneAssets } from "./scene-assets";

const kitBase = "/studio/assets/media/rat-casino-kit/v001";
const goldenUrl =
  "/studio/assets/media/golden-after-hours-rat/v001/golden-after-hours-rat.glb";

interface ScenicPlacement {
  readonly name: string;
  readonly url: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotationY?: number;
}

function staticPlatforms(level: LevelLayout) {
  return (level.course?.platforms ?? []).filter((platform) => !platform.motion);
}

function stagePlatform(level: LevelLayout, x: number, z: number) {
  return staticPlatforms(level).find(
    (platform) =>
      Math.abs(x - platform.center.x) <= platform.size.x / 2 &&
      Math.abs(z - platform.center.z) <= platform.size.z / 2,
  );
}

function safeCabinetSite(level: LevelLayout, x: number, z: number): boolean {
  const required = [
    ...level.memories.map((entry) => entry.position),
    ...level.pickups.map((entry) => entry.position),
    ...level.encounters.map((entry) => entry.position),
    ...(level.friendlies ?? []).map((entry) => entry.position),
  ];
  if (required.some((entry) => Math.hypot(entry.x - x, entry.z - z) < 2.1))
    return false;
  return level.encounters.every(
    (entry) =>
      !entry.arena ||
      x < entry.arena.minX - 0.7 ||
      x > entry.arena.maxX + 0.7 ||
      z < entry.arena.minZ - 0.7 ||
      z > entry.arena.maxZ + 0.7,
  );
}

/**
 * Fixed scenic rules for the prepared Rat Casino kit. The authored project
 * remains the sole source of collision, checkpoints and objective placement.
 */
export class CasinoScene {
  readonly root = new THREE.Group();
  private cameoMixer: THREE.AnimationMixer | null = null;
  private cameoRoot: THREE.Group | null = null;

  constructor(
    level: LevelLayout,
    assets: SceneAssets,
    valid: () => boolean,
    showGoldenCameo: boolean,
  ) {
    this.root.name = "casino-prepared-kit-scenery";
    this.root.userData.environmentKitState = "prepared-kit";
    const boss = level.encounters.find((entry) => entry.role === "boss");
    const spawn = level.checkpoint;
    const placements: ScenicPlacement[] = [
      {
        name: "casino-marquee-arch",
        url: `${kitBase}/marquee-arch.glb`,
        x: spawn.x,
        y: spawn.y,
        z: spawn.z - 2.6,
      },
    ];
    if (boss) {
      placements.push({
        name: "casino-roulette-dais",
        url: `${kitBase}/roulette-dais.glb`,
        x: boss.position.x,
        y: boss.position.y,
        z: boss.position.z - 4.8,
      });
    }

    const widePlatforms = staticPlatforms(level)
      .filter((platform) => platform.size.x >= 8 && platform.size.z >= 5)
      .sort((left, right) => right.center.z - left.center.z);
    const cabinetFractions = [0.13, 0.29, 0.48, 0.67, 0.81] as const;
    for (const [index, fraction] of cabinetFractions.entries()) {
      const targetZ = level.maxZ - fraction * (level.maxZ - level.minZ);
      const host = [...widePlatforms].sort(
        (left, right) =>
          Math.abs(left.center.z - targetZ) - Math.abs(right.center.z - targetZ),
      )[0];
      if (!host) continue;
      const side = index % 2 === 0 ? -1 : 1;
      const x = host.center.x + side * (host.size.x / 2 - 0.72);
      const z = host.center.z;
      if (!safeCabinetSite(level, x, z)) continue;
      placements.push({
        name: "casino-slot-cabinet",
        url: `${kitBase}/slot-cabinet.glb`,
        x,
        y: host.center.y + host.size.y / 2,
        z,
        rotationY: side < 0 ? Math.PI / 2 : -Math.PI / 2,
      });
    }

    for (const placement of placements) {
      const target = new THREE.Group();
      target.name = placement.name;
      target.position.set(placement.x, placement.y, placement.z);
      target.rotation.y = placement.rotationY ?? 0;
      target.userData.scenicOnly = true;
      this.root.add(target);
      assets.attach(placement.url, target, valid);
    }

    if (boss && showGoldenCameo) {
      const platform = stagePlatform(level, boss.position.x, boss.position.z);
      if (platform && platform.size.x >= 12) {
        const cameo = new THREE.Group();
        cameo.name = "casino-golden-cameo";
        cameo.userData.scenicOnly = true;
        cameo.position.set(
          platform.center.x + platform.size.x / 2 - 1.35,
          platform.center.y + platform.size.y / 2,
          boss.position.z - 4,
        );
        cameo.rotation.y = Math.PI - 0.25;
        this.root.add(cameo);
        assets.attach(goldenUrl, cameo, valid, (loaded, clips) => {
          const idle = clips.find((clip) => clip.name === "idle");
          if (!idle) throw new Error("Golden mascot is missing its idle clip");
          this.cameoRoot = loaded;
          this.cameoMixer = new THREE.AnimationMixer(loaded);
          this.cameoMixer.clipAction(idle, loaded).play();
        });
      }
    }
  }

  update(deltaSeconds: number): void {
    this.cameoMixer?.update(Math.min(0.1, Math.max(0, deltaSeconds)));
  }

  dispose(): void {
    this.cameoMixer?.stopAllAction();
    if (this.cameoRoot) this.cameoMixer?.uncacheRoot(this.cameoRoot);
    this.cameoMixer = null;
    this.cameoRoot = null;
  }
}
