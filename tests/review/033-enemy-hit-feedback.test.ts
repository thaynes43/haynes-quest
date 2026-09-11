/**
 * WO-033 review regression (finding R-8). Authored enemies lose an HP drop
 * observed during windup/strike because those branches always keep the attack
 * clip active and `lastHp` is updated at the end of the frame. The authored
 * model also skips the procedural squash fallback, so its hit clip never plays.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { EnemyAnimation } from "../../src/game/enemy-animation";
import type { EnemyFrame, EnemyPhase } from "../../src/game/types";

function makeRig() {
  const root = new THREE.Group();
  const hips = new THREE.Bone();
  hips.name = "Hips";
  const spine = new THREE.Bone();
  spine.name = "Spine";
  const arm = new THREE.Bone();
  arm.name = "Arm";
  const head = new THREE.Bone();
  head.name = "Head";
  spine.add(arm, head);
  hips.add(spine);
  const mesh = new THREE.SkinnedMesh(
    new THREE.BoxGeometry(),
    new THREE.MeshStandardMaterial(),
  );
  mesh.add(hips);
  mesh.bind(new THREE.Skeleton([hips, spine, arm, head]));
  root.add(mesh);
  return { root, head };
}

function track(name: string, times: number[], values: number[]) {
  return new THREE.VectorKeyframeTrack(
    name,
    times,
    values,
    THREE.InterpolateLinear,
  );
}

function makeClips(): THREE.AnimationClip[] {
  return [
    new THREE.AnimationClip("idle", 1, [
      track("Hips.position", [0, 1], [0, 1, 0, 0, 1, 0]),
    ]),
    new THREE.AnimationClip("move", 0.8, [
      track("Hips.position", [0, 0.8], [0, 2, 0, 0, 2, 0]),
    ]),
    new THREE.AnimationClip("attack", 1, [
      track("Arm.position", [0, 1], [0, 0, 0, 10, 0, 0]),
    ]),
    new THREE.AnimationClip("hit", 0.4, [
      track("Head.position", [0, 0.4], [0, 0, 0, 0, 0, 5]),
    ]),
    new THREE.AnimationClip("defeat", 0.5, [
      track("Spine.position", [0, 0.5], [0, 0, 0, 0, -3, 0]),
    ]),
  ];
}

function frame(
  phase: EnemyPhase,
  hp: number,
  windupProgress = 0,
): EnemyFrame {
  return {
    id: "review-enemy",
    position: { x: 0, y: 0, z: 0 },
    facing: 0,
    phase,
    windupProgress,
    hp,
    maxHp: 10,
  };
}

function hitDuring(phase: "windup" | "strike"): number {
  const rig = makeRig();
  const animation = new EnemyAnimation(rig.root, makeClips(), 0.6);
  animation.update(frame("chasing", 10), 0.016);
  animation.update(frame(phase, 10, phase === "windup" ? 0.1 : 0), 0.016);
  animation.update(frame(phase, 6, phase === "windup" ? 0.2 : 0), 0.05);
  animation.update(frame(phase, 6, phase === "windup" ? 0.3 : 0), 0.05);
  return rig.head.position.z;
}

describe("authored enemy hit feedback", () => {
  it.fails("does not discard the hit reaction when HP drops during an attack", () => {
    expect(hitDuring("windup")).toBeGreaterThan(0);
    expect(hitDuring("strike")).toBeGreaterThan(0);
  });

  it("plays the same hit clip when HP drops during cooldown", () => {
    const rig = makeRig();
    const animation = new EnemyAnimation(rig.root, makeClips(), 0.6);
    animation.update(frame("chasing", 10), 0.016);
    animation.update(frame("cooldown", 10), 0.016);
    animation.update(frame("cooldown", 6), 0.05);
    animation.update(frame("cooldown", 6), 0.05);
    expect(rig.head.position.z).toBeGreaterThan(0);
  });
});
