import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  EnemyAnimation,
  enemyAnimationFadeSeconds,
  enemyAnimationMaxDeltaSeconds,
  enemyVanishSeconds,
} from "../../src/game/enemy-animation";
import type { EnemyFrame, EnemyPhase } from "../../src/game/types";

/**
 * A small skinned rig with linear tracks so every sampled transform has an
 * exact expected value:
 * - idle (1.0 s, loops): Hips.y 1 → 1.4 → 1
 * - move (0.8 s, loops): Hips.y 2 → 2.8 → 2
 * - attack (1.0 s): Arm.x 0 → 10, contact fraction 0.6 → contact pose x = 6
 * - hit (0.4 s): Head.z 0 → 5
 * - defeat (0.5 s): Spine.y 0 → -3
 */
function makeRig() {
  const root = new THREE.Group();
  root.name = "EnemyRoot";
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
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.add(hips);
  mesh.bind(new THREE.Skeleton([hips, spine, arm, head]));
  root.add(mesh);
  return { root, hips, spine, arm, head, geometry, material, mesh };
}

function vectorTrack(
  name: string,
  times: number[],
  values: number[],
): THREE.VectorKeyframeTrack {
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
      vectorTrack("Hips.position", [0, 0.5, 1], [0, 1, 0, 0, 1.4, 0, 0, 1, 0]),
    ]),
    new THREE.AnimationClip("move", 0.8, [
      vectorTrack(
        "Hips.position",
        [0, 0.4, 0.8],
        [0, 2, 0, 0, 2.8, 0, 0, 2, 0],
      ),
    ]),
    new THREE.AnimationClip("attack", 1, [
      vectorTrack("Arm.position", [0, 1], [0, 0, 0, 10, 0, 0]),
    ]),
    new THREE.AnimationClip("hit", 0.4, [
      vectorTrack("Head.position", [0, 0.4], [0, 0, 0, 0, 0, 5]),
    ]),
    new THREE.AnimationClip("defeat", 0.5, [
      vectorTrack("Spine.position", [0, 0.5], [0, 0, 0, 0, -3, 0]),
    ]),
  ];
}

const contactFraction = 0.6;

function frame(
  phase: EnemyPhase,
  extra: Partial<Pick<EnemyFrame, "windupProgress" | "hp">> = {},
): EnemyFrame {
  return {
    id: "enemy-1",
    position: { x: 0, y: 0, z: 0 },
    facing: 0,
    phase,
    windupProgress: 0,
    hp: 4,
    maxHp: 4,
    ...extra,
  };
}

function step(
  animation: EnemyAnimation,
  current: EnemyFrame,
  deltaSeconds: number,
  count = 1,
) {
  let state = animation.update(current, deltaSeconds);
  for (let index = 1; index < count; index += 1)
    state = animation.update(current, deltaSeconds);
  return state;
}

/** Frames of `dt` needed for a cross-fade to finish and the faded action to disable. */
const fadeFrames = (dt: number) =>
  Math.ceil(enemyAnimationFadeSeconds / dt) + 1;

function setup() {
  const rig = makeRig();
  const animation = new EnemyAnimation(rig.root, makeClips(), contactFraction);
  return { ...rig, animation };
}

afterEach(() => vi.restoreAllMocks());

describe("EnemyAnimation construction", () => {
  it("rejects missing, duplicated, empty, unbound or root-moving required clips", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { root } = makeRig();
    const clips = makeClips();
    expect(
      () =>
        new EnemyAnimation(
          root,
          clips.filter((clip) => clip.name !== "hit"),
          contactFraction,
        ),
    ).toThrow(/"hit"/);
    expect(
      () =>
        new EnemyAnimation(
          root,
          [...clips, clips.find((clip) => clip.name === "attack")!],
          contactFraction,
        ),
    ).toThrow(/2 clips named "attack"/);
    const emptyDefeat = clips.map((clip) =>
      clip.name === "defeat"
        ? new THREE.AnimationClip("defeat", 0.5, [])
        : clip,
    );
    expect(
      () => new EnemyAnimation(root, emptyDefeat, contactFraction),
    ).toThrow(/"defeat" has no tracks/);
    const unboundMove = clips.map((clip) =>
      clip.name === "move"
        ? new THREE.AnimationClip("move", 0.8, [
            vectorTrack("Tail.position", [0, 0.8], [0, 0, 0, 1, 0, 0]),
          ])
        : clip,
    );
    expect(
      () => new EnemyAnimation(root, unboundMove, contactFraction),
    ).toThrow(/"move" has no track that binds/);
    const propertyLessHit = clips.map((clip) =>
      clip.name === "hit"
        ? new THREE.AnimationClip("hit", 0.4, [
            new THREE.NumberKeyframeTrack(
              "Hips.morphTargetInfluences[weep]",
              [0, 0.4],
              [0, 1],
            ),
          ])
        : clip,
    );
    expect(
      () => new EnemyAnimation(root, propertyLessHit, contactFraction),
    ).toThrow(/"hit" has no track that binds/);
    for (const rootTrack of [".position", "EnemyRoot.position"]) {
      const rootMove = clips.map((clip) =>
        clip.name === "move"
          ? new THREE.AnimationClip("move", 0.8, [
              vectorTrack(rootTrack, [0, 0.8], [0, 0, 0, 5, 0, 0]),
            ])
          : clip,
      );
      expect(() => new EnemyAnimation(root, rootMove, contactFraction)).toThrow(
        /"move" animates the model root/,
      );
    }
    const mixedRootMotion = clips.map((clip) =>
      clip.name === "move"
        ? new THREE.AnimationClip("move", clip.duration, [
            ...clip.tracks,
            vectorTrack(".position", [0, 0.8], [0, 0, 0, 5, 0, 0]),
          ])
        : clip,
    );
    expect(
      () => new EnemyAnimation(root, mixedRootMotion, contactFraction),
    ).toThrow(/"move" animates the model root/);
    expect(root.position.toArray()).toEqual([0, 0, 0]);
    expect(() => new EnemyAnimation(root, clips, 0)).toThrow(
      /contact fraction/,
    );
    expect(() => new EnemyAnimation(root, clips, 1.2)).toThrow(
      /contact fraction/,
    );
    expect(() => new EnemyAnimation(root, clips, Number.NaN)).toThrow(
      /contact fraction/,
    );
    expect(() => new EnemyAnimation(root, clips, 1)).not.toThrow();
  });
});

describe("EnemyAnimation playback", () => {
  it("loops idle and move on the hip bone, cross-fades between them and never moves the root", () => {
    const { animation, root, hips } = setup();
    root.position.set(5, 0, -3);

    expect(animation.update(frame("idle"), 0.1)).toEqual({
      visible: true,
      vanish: 0,
    });
    expect(hips.position.y).toBeCloseTo(1.08, 5);
    step(animation, frame("idle"), 0.05, 21);
    expect(hips.position.y).toBeCloseTo(1.12, 5); // 1.15 s wrapped to 0.15 s

    const idleBeforeSwitch = hips.position.y;
    animation.update(frame("chasing"), 0.05);
    expect(hips.position.y).toBeGreaterThan(idleBeforeSwitch);
    expect(hips.position.y).toBeLessThan(2.1); // mid-fade blend, move at 0.05 s
    step(animation, frame("chasing"), 0.05, 3);
    expect(hips.position.y).toBeCloseTo(2.4, 5); // pure move at 0.2 s
    step(animation, frame("chasing"), 0.05, 12);
    expect(hips.position.y).toBeCloseTo(2, 5); // 0.8 s wrapped back to the loop start
    expect(root.position.toArray()).toEqual([5, 0, -3]);
  });

  it("seeks the attack clip to the windup progress, restarts a reset windup, freezes while paused and strikes from the contact pose", () => {
    const { animation, arm, hips } = setup();
    step(animation, frame("chasing"), 0.05, 3);

    step(
      animation,
      frame("windup", { windupProgress: 0.5 }),
      0.05,
      fadeFrames(0.05),
    );
    expect(arm.position.x).toBeCloseTo(3, 5); // 0.5 × 0.6 × 10
    expect(hips.position.y).toBeCloseTo(0, 5); // move faded out to the bind pose
    animation.update(frame("windup", { windupProgress: 0.9 }), 0.05);
    expect(arm.position.x).toBeCloseTo(5.4, 5);
    animation.update(frame("windup", { windupProgress: 0.1 }), 0.05);
    expect(arm.position.x).toBeCloseTo(0.6, 5); // visible restart of the warning pose

    step(animation, frame("windup", { windupProgress: 0.1 }), 0, 3);
    animation.update(frame("windup", { windupProgress: 0.1 }), -1);
    animation.update(frame("windup", { windupProgress: 0.1 }), Number.NaN);
    expect(arm.position.x).toBeCloseTo(0.6, 5);

    animation.update(frame("windup", { windupProgress: 1 }), 0.05);
    expect(arm.position.x).toBeCloseTo(6, 5);
    animation.update(frame("strike"), 0.1);
    expect(arm.position.x).toBeCloseTo(7, 5); // contact pose, then 0.1 s of follow-through
    step(animation, frame("cooldown"), 0.1, 3);
    expect(arm.position.x).toBeCloseTo(10, 5); // remainder finished during cooldown
    step(animation, frame("cooldown"), 0.1, 3);
    expect(arm.position.x).toBeCloseTo(10, 5); // clamped at the end

    step(animation, frame("chasing"), 0.05, 4);
    expect(arm.position.x).toBeCloseTo(0, 5);
    expect(hips.position.y).toBeCloseTo(2.4, 5);
  });

  it("returns a cancelled windup to locomotion and starts a strike without a seen windup at the contact pose", () => {
    const { animation, arm, hips } = setup();
    step(animation, frame("windup", { windupProgress: 0.5 }), 0.05, 2);
    expect(arm.position.x).toBeCloseTo(3, 5);
    step(animation, frame("chasing"), 0.05, 4);
    expect(arm.position.x).toBeCloseTo(0, 5);
    expect(hips.position.y).toBeCloseTo(2.4, 5);

    step(animation, frame("idle"), 0.05, 4);
    animation.update(frame("strike"), 0);
    step(animation, frame("strike"), 0.05, fadeFrames(0.05));
    expect(arm.position.x).toBeCloseTo(6 + 0.05 * fadeFrames(0.05) * 10, 5);
  });

  it("plays one hit clip per HP drop and queues attack-phase hits until the cue resolves", () => {
    const { animation, arm, head, hips } = setup();
    step(animation, frame("idle"), 0.05, 2);

    animation.update(frame("idle", { hp: 3 }), 0.05);
    const firstSample = head.position.z;
    expect(firstSample).toBeGreaterThan(0);
    step(animation, frame("idle", { hp: 3 }), 0.05, 7);
    expect(head.position.z).toBeCloseTo(5, 5); // hit clip end at 0.4 s, full weight
    step(animation, frame("idle", { hp: 3 }), 0.05, 4);
    expect(head.position.z).toBeCloseTo(0, 5); // returned to locomotion
    expect(hips.position.y).toBeCloseTo(1 + 0.8 * 0.2, 5); // fresh idle, 4 frames in
    step(animation, frame("idle", { hp: 3 }), 0.05, 10);
    expect(head.position.z).toBeCloseTo(0, 5); // no second hit for the same HP

    step(animation, frame("windup", { windupProgress: 0.5, hp: 2 }), 0.05, 4);
    expect(arm.position.x).toBeCloseTo(3, 5); // attack cue kept
    expect(head.position.z).toBeCloseTo(0, 5); // no hit pose over the windup
    animation.update(frame("windup", { windupProgress: 1, hp: 2 }), 0.05);
    animation.update(frame("strike", { hp: 2 }), 0.05);
    animation.update(frame("chasing", { hp: 2 }), 0.05);
    expect(head.position.z).toBeGreaterThan(0); // queued hit starts after the attack phase
    step(animation, frame("chasing", { hp: 2 }), 0.05, 7);
    expect(head.position.z).toBeCloseTo(5, 5);
    step(animation, frame("chasing", { hp: 2 }), 0.05, 4);
    expect(head.position.z).toBeCloseTo(0, 5);

    step(animation, frame("windup", { windupProgress: 1, hp: 2 }), 0.05, 3);
    animation.update(frame("strike", { hp: 2 }), 0.05);
    step(animation, frame("cooldown", { hp: 2 }), 0.05, 2);
    expect(arm.position.x).toBeGreaterThan(6);
    step(animation, frame("cooldown", { hp: 1 }), 0.05, 8);
    expect(head.position.z).toBeCloseTo(5, 5); // hit interrupts the cooldown hold
    expect(arm.position.x).toBeCloseTo(0, 5);
    step(animation, frame("cooldown", { hp: 1 }), 0.05, 4);
    expect(head.position.z).toBeCloseTo(0, 5);
    expect(hips.position.y).toBeCloseTo(1 + 0.8 * 0.2, 5); // idle while cooldown holds without an attack
  });

  it("clears a running hit when HP rises on retry and accepts a later hit again", () => {
    const { animation, head } = setup();
    step(animation, frame("idle"), 0.05, 2);
    step(animation, frame("idle", { hp: 2 }), 0.05, 3);
    expect(head.position.z).toBeGreaterThan(0);

    const beforeRise = head.position.z;
    animation.update(frame("idle", { hp: 4 }), 0.05);
    expect(head.position.z).toBeGreaterThan(0); // cross-fades out instead of snapping
    expect(head.position.z).toBeLessThan(beforeRise + 5 * 0.05); // and never grows past the hit's own motion
    step(animation, frame("idle", { hp: 4 }), 0.05, fadeFrames(0.05));
    expect(head.position.z).toBeCloseTo(0, 5);
    step(animation, frame("idle", { hp: 4 }), 0.05, 6);
    expect(head.position.z).toBeCloseTo(0, 5);

    step(animation, frame("idle", { hp: 3 }), 0.05, 8);
    expect(head.position.z).toBeCloseTo(5, 5);
  });

  it("clears a queued attack-phase hit when retry restores HP", () => {
    const { animation, head } = setup();
    step(animation, frame("idle"), 0.05, 2);
    animation.update(
      frame("windup", { windupProgress: 0.2, hp: 3 }),
      0.05,
    );
    animation.update(
      frame("windup", { windupProgress: 0.3, hp: 4 }),
      0.05,
    );
    step(animation, frame("chasing", { hp: 4 }), 0.05, 6);
    expect(head.position.z).toBeCloseTo(0, 5);

    step(animation, frame("chasing", { hp: 3 }), 0.05, 8);
    expect(head.position.z).toBeCloseTo(5, 5);
  });

  it("plays defeat once, holds the end pose, vanishes over 0.3 s and ignores repeated defeated frames", () => {
    const { animation, spine, hips } = setup();
    step(animation, frame("idle"), 0.05, 2);

    expect(animation.update(frame("defeated", { hp: 0 }), 0.1)).toEqual({
      visible: true,
      vanish: 0,
    });
    expect(spine.position.y).toBeCloseTo(-0.6, 5);
    const state = step(animation, frame("defeated", { hp: 0 }), 0.1, 4);
    expect(state.visible).toBe(true);
    expect(state.vanish).toBeCloseTo(0, 10); // clip ends exactly here, nothing left over
    expect(spine.position.y).toBeCloseTo(-3, 5);
    expect(hips.position.y).toBeCloseTo(0, 5); // idle faded out

    let next = animation.update(frame("defeated", { hp: 0 }), 0.1);
    expect(next.visible).toBe(true);
    expect(next.vanish).toBeCloseTo(0.1 / enemyVanishSeconds, 5);
    expect(spine.position.y).toBeCloseTo(-3, 5); // end pose held while vanishing
    next = animation.update(frame("defeated", { hp: 0 }), 0.1);
    expect(next.vanish).toBeCloseTo(0.2 / enemyVanishSeconds, 5);
    next = animation.update(frame("defeated", { hp: 0 }), 0.1);
    expect(next).toEqual({ visible: false, vanish: 1 });

    for (let index = 0; index < 5; index += 1)
      expect(animation.update(frame("defeated", { hp: 0 }), 0.1)).toEqual({
        visible: false,
        vanish: 1,
      });
    expect(spine.position.y).toBeCloseTo(-3, 5); // never restarted
  });

  it("keeps a model hidden when its very first frame is already defeated", () => {
    const { animation, spine, hips } = setup();
    for (let index = 0; index < 4; index += 1)
      expect(animation.update(frame("defeated", { hp: 0 }), 0.1)).toEqual({
        visible: false,
        vanish: 1,
      });
    expect(spine.position.y).toBe(0);
    expect(hips.position.y).toBe(0);
  });

  it("revives a defeated model with fresh locomotion, no hit, and lets it be defeated again", () => {
    const { animation, spine, hips, head } = setup();
    step(animation, frame("idle"), 0.05, 6);
    step(
      animation,
      frame("windup", { windupProgress: 0.2, hp: 3 }),
      0.05,
      2,
    ); // queues a hit which defeat must discard
    step(animation, frame("defeated", { hp: 0 }), 0.1, 8);
    expect(animation.update(frame("defeated", { hp: 0 }), 0.1).visible).toBe(
      false,
    );

    expect(animation.update(frame("idle"), 0.05)).toEqual({
      visible: true,
      vanish: 0,
    });
    expect(hips.position.y).toBeCloseTo(1.04, 5); // idle restarted at 0
    expect(spine.position.y).toBeCloseTo(0, 5);
    expect(head.position.z).toBeCloseTo(0, 5); // HP rise on revival is not a hit
    step(animation, frame("idle"), 0.05, 2);
    expect(head.position.z).toBeCloseTo(0, 5);

    step(animation, frame("defeated", { hp: 0 }), 0.1, 3);
    expect(spine.position.y).toBeCloseTo(-1.8, 5); // a second defeat plays again
    expect(animation.update(frame("chasing"), 0.05)).toEqual({
      visible: true,
      vanish: 0,
    });
    expect(hips.position.y).toBeCloseTo(2.1, 5); // revived mid-defeat into fresh move
    expect(spine.position.y).toBeCloseTo(0, 5);
  });

  it("finishes the attack clip exactly once while cooldown holds its end pose", () => {
    const { animation, arm } = setup();
    const dispatch = vi.spyOn(THREE.AnimationMixer.prototype, "dispatchEvent");
    step(animation, frame("windup", { windupProgress: 1 }), 0.05, 3);
    animation.update(frame("strike"), 0.05);
    step(animation, frame("cooldown"), 0.05, 20);
    expect(arm.position.x).toBeCloseTo(10, 5);
    const finished = dispatch.mock.calls.filter(
      ([event]) =>
        (event as { type: string }).type === "finished" &&
        (event as { action: THREE.AnimationAction }).action.getClip().name ===
          "attack",
    );
    expect(finished).toHaveLength(1);
  });

  it("fades a locomotion switch that lands right after a hit from the pose actually shown", () => {
    const { animation, hips, head } = setup();
    step(animation, frame("idle"), 0.05, 2);
    step(animation, frame("idle", { hp: 3 }), 0.05, 8); // hit plays to its end
    expect(head.position.z).toBeCloseTo(5, 5);
    // The hit has just handed back to idle, whose fade-in has not advanced yet.
    animation.update(frame("chasing", { hp: 3 }), 0.05);
    // Only the fading hit (which leaves the hips alone) and move contribute:
    // move at 0.05 s carries half weight, the idle pose none.
    expect(hips.position.y).toBeCloseTo(0.5 * 2.1, 5);
    step(animation, frame("chasing", { hp: 3 }), 0.05, 3);
    expect(hips.position.y).toBeCloseTo(2.4, 5);
    expect(head.position.z).toBeCloseTo(0, 5);
  });

  it("bounds a large simulation delta", () => {
    const { animation, hips } = setup();
    animation.update(frame("idle"), 5);
    expect(hips.position.y).toBeCloseTo(
      1 + 0.8 * enemyAnimationMaxDeltaSeconds,
      5,
    );
  });

  it("disposes by stopping playback and uncaching the root without disposing shared resources", () => {
    const { animation, root, hips, geometry, material, mesh } = setup();
    step(animation, frame("chasing"), 0.05, 4);
    expect(hips.position.y).toBeCloseTo(2.4, 5);
    const uncacheRoot = vi.spyOn(THREE.AnimationMixer.prototype, "uncacheRoot");
    const stopAll = vi.spyOn(THREE.AnimationMixer.prototype, "stopAllAction");
    const geometryDispose = vi.spyOn(geometry, "dispose");
    const materialDispose = vi.spyOn(material, "dispose");
    const skeletonDispose = vi.spyOn(mesh.skeleton, "dispose");

    animation.dispose();
    expect(stopAll).toHaveBeenCalledOnce();
    expect(uncacheRoot).toHaveBeenCalledExactlyOnceWith(root);
    expect(hips.position.y).toBe(0); // bind pose restored
    expect(geometryDispose).not.toHaveBeenCalled();
    expect(materialDispose).not.toHaveBeenCalled();
    expect(skeletonDispose).not.toHaveBeenCalled();
    expect(mesh.parent).toBe(root);

    expect(animation.update(frame("chasing"), 0.05)).toEqual({
      visible: false,
      vanish: 1,
    });
    expect(hips.position.y).toBe(0);
    animation.dispose();
    expect(uncacheRoot).toHaveBeenCalledOnce();
  });
});
