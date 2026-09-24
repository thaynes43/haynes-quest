import * as THREE from "three";

import { ParticlePool, type ParticleBurst } from "./juice";
import type { PositionSnapshot } from "./types";

// Particle bursts for contact, defeats, pickups and landings (DESIGN-022).
// One pooled instanced mesh keeps every burst to a single draw call.

const dummy = new THREE.Object3D();
const color = new THREE.Color();

const honey = 0xdca953;
const gold = 0xffd36b;
const plum = 0x8c5bd6;
const mint = 0x7fd1b9;
const rose = 0xff8fa3;
const cream = 0xfff4dc;

export type EffectKind =
  "hit" | "defeat" | "boss-defeat" | "token" | "ticket" | "landing";

/** Tuned burst presets; positions are feet- or contact-relative world points. */
export function burstFor(
  kind: EffectKind,
  origin: PositionSnapshot,
): ParticleBurst {
  switch (kind) {
    case "hit":
      return {
        origin,
        count: 14,
        colors: [cream, gold, 0xffffff],
        speed: 3.4,
        lift: 0.8,
        gravity: -9,
        lifeSeconds: 0.32,
        size: 0.07,
      };
    case "defeat":
      return {
        origin,
        count: 40,
        colors: [honey, plum, mint, rose, cream],
        speed: 3.6,
        lift: 2.6,
        gravity: -7,
        lifeSeconds: 1.1,
        size: 0.085,
      };
    case "boss-defeat":
      return {
        origin,
        count: 96,
        colors: [honey, plum, mint, rose, cream, gold],
        speed: 4.6,
        lift: 3.4,
        gravity: -6,
        lifeSeconds: 1.6,
        size: 0.11,
      };
    case "token":
      return {
        origin,
        count: 9,
        colors: [gold, cream, honey],
        speed: 1.7,
        lift: 1.3,
        gravity: -5,
        lifeSeconds: 0.42,
        size: 0.05,
      };
    case "ticket":
      return {
        origin,
        count: 44,
        colors: [gold, honey, plum, cream],
        speed: 3.1,
        lift: 2.6,
        gravity: -6,
        lifeSeconds: 1.05,
        size: 0.09,
      };
    case "landing":
      return {
        origin,
        count: 7,
        colors: [0xe8dcc6, 0xd7c7ad],
        speed: 1.25,
        lift: 0.15,
        gravity: -2.5,
        lifeSeconds: 0.3,
        size: 0.06,
      };
  }
}

export class EffectsScene {
  readonly root = new THREE.Group();
  private readonly pool: ParticlePool;
  private readonly mesh: THREE.InstancedMesh;
  private dirty = true;

  constructor(capacity = 256) {
    this.pool = new ParticlePool(capacity);
    this.root.name = "effects";
    this.mesh = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        toneMapped: false,
      }),
      capacity,
    );
    this.mesh.name = "effect-particles";
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    dummy.position.set(0, 0, 0);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (let index = 0; index < capacity; index++) {
      this.mesh.setMatrixAt(index, dummy.matrix);
      this.mesh.setColorAt(index, color.setHex(0xffffff));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    // Hidden while idle, so a calm frame costs no draw call.
    this.mesh.visible = false;
    this.root.add(this.mesh);
  }

  emit(kind: EffectKind, origin: PositionSnapshot): void {
    this.pool.burst(burstFor(kind, origin));
    this.mesh.visible = true;
    this.dirty = true;
  }

  update(deltaSeconds: number): void {
    if (!this.dirty) return;
    this.pool.step(deltaSeconds);
    this.pool.particles.forEach((particle, index) => {
      dummy.position.set(particle.x, particle.y, particle.z);
      dummy.rotation.set(
        particle.spin * particle.age,
        particle.spin * particle.age * 0.7,
        0,
      );
      dummy.scale.setScalar(ParticlePool.scaleOf(particle));
      dummy.updateMatrix();
      this.mesh.setMatrixAt(index, dummy.matrix);
      if (particle.alive)
        this.mesh.setColorAt(index, color.setHex(particle.color));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    // Keep updating while anything lives; the pass after the last death zeroes it.
    this.dirty = this.pool.aliveCount > 0;
    this.mesh.visible = this.dirty;
  }

  clear(): void {
    this.pool.clear();
    this.dirty = true;
  }

  get aliveCount(): number {
    return this.pool.aliveCount;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}
