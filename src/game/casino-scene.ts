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
  readonly scale?: number;
}

type DecorShape = "box" | "bulb" | "coin";
type DecorFinish = "velvet" | "panel" | "brass" | "dark" | "glow";

interface DecorPiece {
  readonly shape: DecorShape;
  readonly finish: DecorFinish;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly rotationY?: number;
}

/** One draw call per shape/finish pair, even for a hall full of trim and bulbs. */
function addDecorBatches(root: THREE.Group, pieces: readonly DecorPiece[]): void {
  const geometries: Record<DecorShape, THREE.BufferGeometry> = {
    box: new THREE.BoxGeometry(1, 1, 1),
    bulb: new THREE.SphereGeometry(0.5, 8, 6),
    coin: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  };
  const materials: Record<DecorFinish, THREE.Material> = {
    velvet: new THREE.MeshStandardMaterial({ color: 0x522d3a, roughness: 0.94 }),
    panel: new THREE.MeshStandardMaterial({ color: 0x3b293c, roughness: 0.88 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc39a61, metalness: 0.3, roughness: 0.52 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x261e2c, roughness: 0.94 }),
    glow: new THREE.MeshBasicMaterial({ color: 0xffd98b }),
  };
  const grouped = new Map<string, DecorPiece[]>();
  for (const piece of pieces) {
    const key = `${piece.shape}:${piece.finish}`;
    const group = grouped.get(key) ?? [];
    group.push(piece);
    grouped.set(key, group);
  }
  const dummy = new THREE.Object3D();
  for (const [key, group] of grouped) {
    const [shape, finish] = key.split(":") as [DecorShape, DecorFinish];
    const mesh = new THREE.InstancedMesh(geometries[shape], materials[finish], group.length);
    mesh.name = `casino-decor-${shape}-${finish}`;
    mesh.castShadow = false;
    mesh.receiveShadow = shape === "box";
    mesh.frustumCulled = false;
    group.forEach((piece, index) => {
      dummy.position.set(piece.x, piece.y, piece.z);
      dummy.rotation.set(0, piece.rotationY ?? 0, 0);
      dummy.scale.set(piece.width, piece.height, piece.depth);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    root.add(mesh);
  }
  // Unused geometries and finishes are never added to the scene graph.
  for (const [shape, geometry] of Object.entries(geometries))
    if (![...grouped.keys()].some((key) => key.startsWith(`${shape}:`))) geometry.dispose();
  for (const [finish, material] of Object.entries(materials))
    if (![...grouped.keys()].some((key) => key.endsWith(`:${finish}`))) material.dispose();
}

function matrixAt(x: number, y: number, z: number, rotationY = 0): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY),
    new THREE.Vector3(1, 1, 1),
  );
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
    level.checkpoint,
    level.finish,
    ...level.memories.map((entry) => entry.position),
    ...level.pickups.map((entry) => entry.position),
    ...level.encounters.map((entry) => entry.position),
    ...(level.friendlies ?? []).map((entry) => entry.position),
    ...(level.course?.checkpoints ?? []).map((entry) => entry.position),
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
        // Keep the center line from Rat to the post-boss memory clear. This
        // model is scenery with no collider, so it belongs in the stage wing.
        x: boss.position.x - 5.5,
        y: boss.position.y,
        z: boss.position.z - 3.8,
        scale: 0.82,
      });
    }

    const widePlatforms = staticPlatforms(level)
      .filter((platform) => platform.size.x >= 7 && platform.size.z >= 6 && platform.size.z < 15)
      .sort((left, right) => right.center.z - left.center.z);
    const cabinetMatrices: THREE.Matrix4[] = [];
    const archMatrices: THREE.Matrix4[] = [];
    const decor: DecorPiece[] = [];
    const box = (finish: DecorFinish, x: number, y: number, z: number, width: number, height: number, depth: number, rotationY = 0) =>
      decor.push({ shape: "box", finish, x, y, z, width, height, depth, rotationY });
    const bulb = (x: number, y: number, z: number, radius = 0.11) =>
      decor.push({ shape: "bulb", finish: "glow", x, y, z, width: radius * 2, height: radius * 2, depth: radius * 2 });

    for (const [index, host] of widePlatforms.entries()) {
      const top = host.center.y + host.size.y / 2;
      const left = host.center.x - host.size.x / 2;
      const right = host.center.x + host.size.x / 2;
      const far = host.center.z - host.size.z / 2;
      const front = host.center.z + host.size.z / 2;
      const arcade = index % 2 === 0;
      const railY = top + 1.05;
      const portalZ = far + 0.55;
      // The third-person camera trails the player about three metres above
      // the previous landing. Keep overhead trim above that sightline when
      // the player has already crossed into the next room.
      const portalTop = top + (arcade ? 4.6 : 4.35);

      // A theatre-like frame at each room's far end creates a visible layered
      // destination without changing the authored lane or fight collision.
      for (const x of [left - 0.4, right + 0.4]) {
        box("panel", x, top + 2.15, portalZ, 0.7, 4.3, 0.75);
        box("brass", x, top + 2.18, portalZ + 0.4, 0.12, 4.4, 0.09);
        box("brass", x, railY, host.center.z, 0.12, 0.12, host.size.z - 0.7);
        box("dark", x, top + 0.48, host.center.z, 0.38, 0.9, host.size.z - 0.7);
      }
      box("velvet", host.center.x, portalTop, portalZ, host.size.x + 1.55, 0.42, 0.72);
      box("brass", host.center.x, portalTop - 0.28, portalZ + 0.41, host.size.x + 1.6, 0.12, 0.1);
      for (let x = left - 0.15; x <= right + 0.15; x += 0.65)
        bulb(x, portalTop - 0.32, portalZ + 0.49);

      // Carpet motifs break up the huge solid top planes but leave target
      // circles, keepsakes and character silhouettes easy to read.
      for (let z = front - 1.2; z > far + 1.1; z -= 1.65) {
        for (const side of [-1, 1]) {
          box("brass", host.center.x + side * Math.min(2.3, host.size.x * 0.27), top + 0.014, z, 0.2, 0.012, 0.2, Math.PI / 4);
        }
      }
      for (const side of [-1, 1]) {
        const x = host.center.x + side * (host.size.x / 2 - 0.55);
        const z = host.center.z + (index % 3 === 0 ? 1.2 : -0.8);
        if (safeCabinetSite(level, x, z)) {
          cabinetMatrices.push(matrixAt(x, top, z, side < 0 ? Math.PI / 2 : -Math.PI / 2));
          box("dark", x, top + 0.05, z, 1.45, 0.1, 1.3);
          bulb(x, top + 2.2, z, 0.16);
        }
      }
    }

    // Small token landings rise on visible pedestals, so their height reads as
    // a playground rather than a row of disconnected floating floor tiles.
    for (const pad of staticPlatforms(level)) {
      const top = pad.center.y + pad.size.y / 2;
      if (pad.size.x >= 7 || pad.size.z >= 6 || top < 0.2) continue;
      const base = Math.min(-1.4, pad.center.y - pad.size.y / 2);
      decor.push({ shape: "coin", finish: "panel", x: pad.center.x, y: (top + base) / 2, z: pad.center.z, width: 0.72, height: top - base, depth: 0.72 });
      decor.push({ shape: "coin", finish: "brass", x: pad.center.x, y: top - 0.12, z: pad.center.z, width: 0.9, height: 0.16, depth: 0.9 });
    }

    // One more exact marquee marks the ticket room. The entrance model above
    // stays individually named for scene inspection.
    const ticketRoom = widePlatforms[1];
    if (ticketRoom)
      archMatrices.push(matrixAt(ticketRoom.center.x, ticketRoom.center.y + ticketRoom.size.y / 2, ticketRoom.center.z + ticketRoom.size.z / 2 - 0.4));

    const bossPlatform = boss && stagePlatform(level, boss.position.x, boss.position.z);
    if (boss && bossPlatform) {
      const top = bossPlatform.center.y + bossPlatform.size.y / 2;
      const edge = bossPlatform.size.x / 2;
      const back = bossPlatform.center.z - bossPlatform.size.z / 2 + 2.2;
      const front = bossPlatform.center.z + bossPlatform.size.z / 2;
      const runnerZ = (front + boss.position.z) / 2;
      box("velvet", bossPlatform.center.x, top + 0.013, runnerZ, 4.8, 0.012, front - boss.position.z - 0.6);
      for (const side of [-1, 1])
        box("brass", bossPlatform.center.x + side * 2.48, top + 0.024, runnerZ, 0.09, 0.015, front - boss.position.z - 0.5);
      // The boss owns an elevated proscenium. Curtains and columns sit along
      // the edge, behind both Rat and Golden, leaving the fight and exit open.
      for (const side of [-1, 1]) {
        const outer = bossPlatform.center.x + side * (edge + 0.38);
        box("panel", outer, top + 2.25, back, 0.82, 4.5, 1.0);
        box("brass", outer, top + 2.3, back + 0.55, 0.13, 4.6, 0.1);
        for (let fold = 0; fold < 4; fold++) {
          const x = bossPlatform.center.x + side * (edge - 0.6 - fold * 0.58);
          box(fold % 2 ? "panel" : "velvet", x, top + 1.7, back - 0.12, 0.62, 3.4, 0.2);
        }
        // Brass footlights run across the stage front, outside the jump entry.
        for (let i = 0; i < 8; i++)
          bulb(bossPlatform.center.x + side * (2.2 + i * 0.55), top + 0.2, front - 0.15, 0.1);
      }
      box("velvet", bossPlatform.center.x, top + 4.5, back, bossPlatform.size.x + 1.1, 0.8, 1.05);
      box("brass", bossPlatform.center.x, top + 4.05, back + 0.58, bossPlatform.size.x + 1.1, 0.16, 0.1);
      for (let x = -edge + 0.4; x < edge; x += 0.58)
        bulb(bossPlatform.center.x + x, top + 4.05, back + 0.7, 0.13);
      // A large carpet medallion makes the arena feel like a stage while the
      // authored boss circle remains visible above it.
      for (const radius of [2.75, 4.15]) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(radius - 0.035, radius + 0.035, 64),
          new THREE.MeshBasicMaterial({ color: 0xc39a61, side: THREE.DoubleSide, transparent: true, opacity: 0.72 }),
        );
        ring.name = "casino-stage-carpet-ring";
        ring.userData.scenicOnly = true;
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(boss.position.x, top + 0.018, boss.position.z);
        this.root.add(ring);
      }
    }

    const cabinetGroup = new THREE.Group();
    cabinetGroup.name = "casino-slot-cabinet";
    cabinetGroup.userData.scenicOnly = true;
    this.root.add(cabinetGroup);
    assets.attachInstances(`${kitBase}/slot-cabinet.glb`, cabinetGroup, cabinetMatrices, valid, { castShadow: false });
    if (archMatrices.length > 0) {
      const archGroup = new THREE.Group();
      archGroup.name = "casino-marquee-repeats";
      archGroup.userData.scenicOnly = true;
      this.root.add(archGroup);
      assets.attachInstances(`${kitBase}/marquee-arch.glb`, archGroup, archMatrices, valid, { castShadow: false });
    }
    const venue = new THREE.Group();
    venue.name = "casino-venue-decor";
    venue.userData.scenicOnly = true;
    addDecorBatches(venue, decor);
    this.root.add(venue);

    for (const placement of placements) {
      const target = new THREE.Group();
      target.name = placement.name;
      target.position.set(placement.x, placement.y, placement.z);
      target.rotation.y = placement.rotationY ?? 0;
      target.scale.setScalar(placement.scale ?? 1);
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
