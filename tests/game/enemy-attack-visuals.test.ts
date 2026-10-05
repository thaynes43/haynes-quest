import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { EnemyAttackVisuals } from "../../src/game/enemy-attack-visuals";
import { disposeTree } from "../../src/game/scene-assets";
import type { EnemyFrame } from "../../src/game/types";

const enemy: EnemyFrame = {
  id: "synthetic-charger", position: { x: 7, y: 2, z: -3 }, facing: 0,
  phase: "windup", windupProgress: 0.5, hp: 8, maxHp: 8,
  attackPattern: "charge", attackTarget: { x: 11, y: 2, z: -3 },
};

describe("readable enemy attack paths", () => {
  it("covers the locked charge path and the full hit width in world space", () => {
    const visual = new EnemyAttackVisuals();
    const parent = new THREE.Group();
    parent.position.set(enemy.position.x, enemy.position.y, enemy.position.z);
    parent.add(visual.root);
    visual.update(enemy, 1);
    parent.updateMatrixWorld(true);
    const lane = visual.root.getObjectByName("locked-attack-lane")!;
    const bounds = new THREE.Box3().setFromObject(lane);
    expect(bounds.min.x).toBeCloseTo(7);
    expect(bounds.max.x).toBeCloseTo(11);
    expect(bounds.min.z).toBeCloseTo(-3.65);
    expect(bounds.max.z).toBeCloseTo(-2.35);
    visual.update({ ...enemy, phase: "cooldown" }, 2);
    expect(lane.visible).toBe(false);
    disposeTree(parent);
  });

  it("keeps a fired bolt at its world location when its source moves, then hides it", () => {
    const visual = new EnemyAttackVisuals();
    const parent = new THREE.Group();
    parent.position.set(8, 2, -3);
    parent.add(visual.root);
    visual.update({
      ...enemy, attackPattern: "bolt", position: { x: 8, y: 2, z: -3 },
      phase: "cooldown", projectile: { x: 10, y: 2, z: -3 },
    }, 1);
    const bolt = visual.root.getObjectByName("enemy-bolt")!;
    const position = bolt.getWorldPosition(new THREE.Vector3());
    expect(position.toArray()).toEqual([10, 2.2, -3]);
    expect(bolt.visible).toBe(true);
    visual.update({ ...enemy, attackPattern: "bolt", phase: "defeated" }, 2);
    expect(bolt.visible).toBe(false);
    disposeTree(parent);
  });
});
