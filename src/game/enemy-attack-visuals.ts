import * as THREE from "three";
import type { EnemyFrame } from "./types";

/** A locked ground lane and a visible, jumpable bolt; built only for patterned foes. */
export class EnemyAttackVisuals {
  readonly root = new THREE.Group();
  private readonly laneMaterial = new THREE.MeshBasicMaterial({
    color: 0xff815b,
    transparent: true,
    depthWrite: false,
    opacity: 0.4,
  });
  private readonly lane = new THREE.Mesh(new THREE.BoxGeometry(1, 0.018, 1), this.laneMaterial);
  private readonly bolt = new THREE.Group();
  private readonly core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.24, 0),
    new THREE.MeshBasicMaterial({ color: 0xff8068 }),
  );
  private readonly glow = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.35, 0),
    new THREE.MeshBasicMaterial({
      color: 0xff456b, transparent: true, opacity: 0.35, depthWrite: false,
    }),
  );

  constructor() {
    this.root.name = "enemy-attack-pattern";
    this.lane.name = "locked-attack-lane";
    const arrow = new THREE.Shape();
    arrow.moveTo(-0.3, -0.08);
    arrow.lineTo(0, 0.05);
    arrow.lineTo(0.3, -0.08);
    arrow.lineTo(0.3, -0.01);
    arrow.lineTo(0, 0.12);
    arrow.lineTo(-0.3, -0.01);
    arrow.closePath();
    const arrowGeometry = new THREE.ShapeGeometry(arrow);
    arrowGeometry.rotateX(Math.PI / 2);
    const arrowMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff5d6, side: THREE.DoubleSide, transparent: true,
      opacity: 0.9, depthWrite: false,
    });
    for (const z of [-0.3, 0, 0.3]) {
      const mark = new THREE.Mesh(arrowGeometry, arrowMaterial);
      mark.name = "locked-attack-arrow";
      mark.position.set(0, 0.015, z);
      this.lane.add(mark);
    }
    this.bolt.name = "enemy-bolt";
    this.bolt.add(this.glow, this.core);
    this.root.add(this.lane, this.bolt);
    this.lane.visible = this.bolt.visible = false;
  }

  update(enemy: EnemyFrame, elapsed: number): void {
    const aimed = enemy.attackPattern === "charge" || enemy.attackPattern === "bolt";
    this.lane.visible = aimed && Boolean(enemy.attackTarget) &&
      (enemy.phase === "windup" || enemy.phase === "strike");
    if (this.lane.visible && enemy.attackTarget) {
      const dx = enemy.attackTarget.x - enemy.position.x;
      const dz = enemy.attackTarget.z - enemy.position.z;
      const length = Math.hypot(dx, dz);
      this.lane.position.set(dx / 2, 0.035, dz / 2);
      this.lane.rotation.y = Math.atan2(dx, dz);
      this.lane.scale.set(enemy.attackPattern === "charge" ? 1.3 : 0.7, 1, Math.max(0.01, length));
      this.laneMaterial.color.setHex(enemy.attackPattern === "charge" ? 0xff815b : 0xffd26c);
      this.laneMaterial.opacity = enemy.phase === "strike" ? 0.7 : 0.35 + enemy.windupProgress * 0.35;
    }
    this.bolt.visible = Boolean(enemy.projectile) && enemy.phase !== "defeated";
    if (enemy.projectile) {
      this.bolt.position.set(
        enemy.projectile.x - enemy.position.x,
        enemy.projectile.y - enemy.position.y + 0.2,
        enemy.projectile.z - enemy.position.z,
      );
      this.core.rotation.set(elapsed * 7, elapsed * 5, 0);
      this.glow.scale.setScalar(1 + Math.sin(elapsed * 18) * 0.1);
    }
  }
}
