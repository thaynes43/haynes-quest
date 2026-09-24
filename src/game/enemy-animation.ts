import * as THREE from "three";
import type { EnemyFrame, EnemyPhase } from "./types";

/** Clip names every authored enemy GLTF must provide, by exact name. */
export const enemyClipNames = [
  "idle",
  "move",
  "attack",
  "hit",
  "defeat",
] as const;
export type EnemyClipName = (typeof enemyClipNames)[number];

/** Seconds over which `vanish` runs 0→1 once the defeat clip has ended. */
export const enemyVanishSeconds = 0.3;
/** Largest simulation step the adapter advances per update. */
export const enemyAnimationMaxDeltaSeconds = 0.1;
/** Cross-fade length between authored poses. */
export const enemyAnimationFadeSeconds = 0.1;

export interface EnemyAnimationState {
  /** False once the defeat sequence has fully vanished or the model was disposed. */
  visible: boolean;
  /** 0 while alive or playing defeat; advances to 1 while the caller shrinks the model. */
  vanish: number;
}

type EnemyAnimationMode = "locomotion" | "attack" | "hit" | "defeat" | "hidden";
type LocomotionClip = "idle" | "move";

function boundedDelta(deltaSeconds: number): number {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return 0;
  return Math.min(enemyAnimationMaxDeltaSeconds, deltaSeconds);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function locomotionFor(phase: EnemyPhase): LocomotionClip {
  return phase === "chasing" ? "move" : "idle";
}

/** Summed frame deltas land a hair short of the clip end; treat that as ended. */
const clipEndTolerance = 1e-6;

function clipEnded(action: THREE.AnimationAction, duration: number): boolean {
  return action.time >= duration - clipEndTolerance;
}

function requireClip(
  root: THREE.Object3D,
  clips: readonly THREE.AnimationClip[],
  name: EnemyClipName,
): THREE.AnimationClip {
  const matches = clips.filter((clip) => clip.name === name);
  if (matches.length === 0)
    throw new Error(`Enemy model is missing the required "${name}" clip`);
  if (matches.length > 1)
    throw new Error(
      `Enemy model has ${matches.length} clips named "${name}"; expected one`,
    );
  const clip = matches[0]!;
  if (!Number.isFinite(clip.duration) || clip.duration <= 0)
    throw new Error(`Enemy clip "${name}" has no positive duration`);
  if (clip.tracks.length === 0)
    throw new Error(`Enemy clip "${name}" has no tracks`);
  let animatesModel = false;
  for (const track of clip.tracks) {
    // Validate every track: a valid first bone track must not hide later root motion.
    const binds = trackBindsToModel(root, track, name);
    animatesModel = binds || animatesModel;
  }
  if (!animatesModel)
    throw new Error(
      `Enemy clip "${name}" has no track that binds to a property of the model`,
    );
  return clip;
}

/**
 * True when the track resolves to an existing property of a node below the
 * root. A track aimed at the root itself is rejected outright: the caller
 * owns the root transform and the adapter must never fight it.
 */
function trackBindsToModel(
  root: THREE.Object3D,
  track: THREE.KeyframeTrack,
  clipName: string,
): boolean {
  const binding = new THREE.PropertyBinding(root, track.name);
  binding.bind();
  if (binding.node === null) return false;
  if (binding.node === root)
    throw new Error(
      `Enemy clip "${clipName}" animates the model root through "${track.name}"; root motion belongs to the caller`,
    );
  // A bound getter writes the property into the probe; an unresolved one is a no-op.
  const probe = new Float64Array(track.getValueSize()).fill(Number.NaN);
  (
    binding as unknown as {
      getValue(target: Float64Array, offset: number): void;
    }
  ).getValue(probe, 0);
  return probe.some((value) => !Number.isNaN(value));
}

/**
 * Drives one cloned enemy GLTF from simulation frames. The caller positions
 * and faces the root, scales it by `1 - vanish` during the final
 * disappearance and calls `dispose()` before removing the model. The adapter
 * never writes the root transform and never disposes geometry or materials,
 * which stay owned by the scene's asset cache.
 */
export class EnemyAnimation {
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions: Readonly<
    Record<EnemyClipName, THREE.AnimationAction>
  >;
  private readonly durations: Readonly<Record<EnemyClipName, number>>;
  private readonly contactSeconds: number;
  private mode: EnemyAnimationMode | null = null;
  private current: THREE.AnimationAction | null = null;
  private currentFadeStart = 0;
  private currentFadeSeconds = 0;
  private lastPhase: EnemyPhase | null = null;
  private lastHp: number | null = null;
  private hitQueued = false;
  /** A client-predicted contact is pending; its confirming HP drop is not a second hit. */
  private swallowNextDrop = false;
  private expectedSeconds = 0;
  private vanish = 0;
  private visible = true;
  private disposed = false;

  constructor(
    private readonly root: THREE.Object3D,
    clips: readonly THREE.AnimationClip[],
    contactFraction: number,
  ) {
    if (
      !Number.isFinite(contactFraction) ||
      contactFraction <= 0 ||
      contactFraction > 1
    )
      throw new Error(
        `Enemy attack contact fraction must be within (0, 1], received ${String(contactFraction)}`,
      );
    const idle = requireClip(root, clips, "idle");
    const move = requireClip(root, clips, "move");
    const attack = requireClip(root, clips, "attack");
    const hit = requireClip(root, clips, "hit");
    const defeat = requireClip(root, clips, "defeat");
    this.mixer = new THREE.AnimationMixer(root);
    const repeat = (clip: THREE.AnimationClip) =>
      this.mixer.clipAction(clip, root).setLoop(THREE.LoopRepeat, Infinity);
    const once = (clip: THREE.AnimationClip) => {
      const action = this.mixer.clipAction(clip, root);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      return action;
    };
    this.actions = {
      idle: repeat(idle),
      move: repeat(move),
      attack: once(attack),
      hit: once(hit),
      defeat: once(defeat),
    };
    this.durations = {
      idle: idle.duration,
      move: move.duration,
      attack: attack.duration,
      hit: hit.duration,
      defeat: defeat.duration,
    };
    this.contactSeconds = attack.duration * contactFraction;
  }

  update(frame: EnemyFrame, deltaSeconds: number): EnemyAnimationState {
    if (this.disposed) return { visible: false, vanish: 1 };
    const dt = boundedDelta(deltaSeconds);
    if (frame.phase === "defeated") this.updateDefeated(dt);
    else this.updateAlive(frame, dt);
    this.lastPhase = frame.phase;
    this.lastHp = frame.hp;
    return { visible: this.visible, vanish: this.vanish };
  }

  /** The client accepted a swing at this enemy; the server's HP drop will confirm it. */
  expectHit(): void {
    if (this.disposed) return;
    this.swallowNextDrop = true;
    this.expectedSeconds = 0;
  }

  /** Plays the hit reaction for a predicted contact at the next allowed moment. */
  anticipateHit(): void {
    if (this.disposed || this.mode === "defeat" || this.mode === "hidden")
      return;
    this.hitQueued = true;
  }

  /** Stops playback and releases the mixer's hold on the root; shared geometry stays intact. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.hitQueued = false;
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.visible = false;
    this.vanish = 1;
  }

  private updateDefeated(dt: number): void {
    this.hitQueued = false;
    if (this.mode === null) {
      // The first frame is already a past victory: never replay it.
      this.mode = "hidden";
      this.visible = false;
      this.vanish = 1;
      return;
    }
    if (this.mode === "hidden") return;
    if (this.mode !== "defeat") {
      this.mode = "defeat";
      this.vanish = 0;
      this.play(this.actions.defeat);
    }
    const defeat = this.actions.defeat;
    const before = defeat.time;
    this.mixer.update(dt);
    if (clipEnded(defeat, this.durations.defeat)) {
      const spent = Math.max(0, defeat.time - before);
      this.vanish = Math.min(
        1,
        this.vanish + Math.max(0, dt - spent) / enemyVanishSeconds,
      );
    }
    if (this.vanish >= 1) {
      this.mode = "hidden";
      this.visible = false;
    }
  }

  private updateAlive(frame: EnemyFrame, dt: number): void {
    if (this.mode === null || this.mode === "defeat" || this.mode === "hidden")
      this.startFresh();
    let hpDropped = this.lastHp !== null && frame.hp < this.lastHp;
    if (this.swallowNextDrop) {
      // Predicted contact plays the reaction; the server's drop only confirms it.
      this.expectedSeconds += dt;
      if (hpDropped) {
        hpDropped = false;
        this.swallowNextDrop = false;
      } else if (this.expectedSeconds > 1.5) this.swallowNextDrop = false;
    }
    const hpRose = this.lastHp !== null && frame.hp > this.lastHp;
    // A retry restoring HP ends any hit feedback; the phase switch below
    // cross-fades from the hit pose instead of snapping.
    if (hpRose) {
      this.hitQueued = false;
      if (this.mode === "hit") this.mode = "locomotion";
    }
    // Preserve the authored warning/contact pose through the attack, then
    // acknowledge damage as soon as the simulation leaves windup/strike.
    const attack = this.actions.attack;
    switch (frame.phase) {
      case "windup":
        if (hpDropped) this.hitQueued = true;
        if (this.mode !== "attack") this.enterAttack();
        attack.paused = true;
        attack.time = clamp01(frame.windupProgress) * this.contactSeconds;
        break;
      case "strike":
        if (hpDropped) this.hitQueued = true;
        if (this.mode !== "attack") this.enterAttack();
        if (this.lastPhase !== "strike") attack.time = this.contactSeconds;
        this.resumeAttack();
        break;
      case "cooldown":
        if (hpDropped || this.hitQueued) this.enterHit();
        else if (this.mode === "attack") {
          if (this.lastPhase === "windup") attack.time = this.contactSeconds;
          this.resumeAttack();
        } else if (this.mode !== "hit") this.enterLocomotion("idle");
        break;
      case "idle":
      case "chasing":
        if (hpDropped || this.hitQueued) this.enterHit();
        else if (this.mode !== "hit")
          this.enterLocomotion(locomotionFor(frame.phase));
        break;
    }
    this.mixer.update(dt);
    if (this.mode === "hit" && clipEnded(this.actions.hit, this.durations.hit))
      this.enterLocomotion(locomotionFor(frame.phase));
  }

  private startFresh(): void {
    this.mixer.stopAllAction();
    this.hitQueued = false;
    this.swallowNextDrop = false;
    this.current = null;
    this.mode = "locomotion";
    this.visible = true;
    this.vanish = 0;
  }

  private enterLocomotion(name: LocomotionClip): void {
    const action = this.actions[name];
    if (this.mode === "locomotion" && this.current === action) return;
    this.mode = "locomotion";
    this.play(action);
  }

  private enterAttack(): void {
    this.mode = "attack";
    this.play(this.actions.attack);
  }

  /** Lets the attack run to its end once; three.js pauses it there and must not be re-armed. */
  private resumeAttack(): void {
    const attack = this.actions.attack;
    if (!clipEnded(attack, this.durations.attack)) attack.paused = false;
  }

  /** The weight three.js is currently applying to the fading-in action. */
  private currentWeight(): number {
    if (this.currentFadeSeconds <= 0) return 1;
    const elapsed = this.mixer.time - this.currentFadeStart;
    return Math.max(0, Math.min(1, elapsed / this.currentFadeSeconds));
  }

  private enterHit(): void {
    this.hitQueued = false;
    this.mode = "hit";
    this.play(this.actions.hit);
  }

  /** Restarts `action` from its first frame and fades every other action out. */
  private play(action: THREE.AnimationAction): void {
    const fade =
      this.current === null || this.current === action
        ? 0
        : enemyAnimationFadeSeconds;
    action.reset();
    action.setEffectiveWeight(1);
    if (fade > 0) action.fadeIn(fade);
    action.play();
    for (const other of Object.values(this.actions)) {
      if (other === action || !other.isScheduled()) continue;
      if (fade > 0 && other.enabled) {
        // Start the fade-out from the weight actually on screen; a fade-in
        // that has not advanced yet still reports its target weight.
        other.setEffectiveWeight(
          other === this.current
            ? this.currentWeight()
            : other.getEffectiveWeight(),
        );
        other.fadeOut(fade);
      } else other.stop();
    }
    this.current = action;
    this.currentFadeStart = this.mixer.time;
    this.currentFadeSeconds = fade;
  }
}
