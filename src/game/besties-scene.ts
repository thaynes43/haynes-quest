import * as THREE from "three";
import type { BestiesFrame, BestieActorId } from "./besties";
import { BESTIES_ARENA_CENTER } from "./besties";
import type { DuoParodyArtwork } from "./scene-catalog";
import { SceneAssets } from "./scene-assets";
import { groundRing } from "./scene-art";

interface DuoActor {
  root: THREE.Group;
  marker: THREE.Mesh;
  mixer?: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  current: string;
}

/** Two authored actors share one authoritative boss and one visible trick at a time. */
export class BestiesScene {
  readonly root = new THREE.Group();
  private readonly actors = new Map<BestieActorId, DuoActor>();
  private readonly hazard = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0xff76bc,
      roughness: 0.8,
      transparent: true,
    }),
  );
  private readonly warning = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({
      color: 0xffe3a1,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  private readonly stars = new THREE.Group();
  private lastHp: number | null = null;
  private hitRemaining = 0;
  constructor(
    assets: SceneAssets,
    valid: () => boolean,
    models: DuoParodyArtwork["models"],
  ) {
    this.root.name = "bickering-besties";
    for (const [id, x, color] of [
      ["bestie-pink", 1.25, 0xff8cca],
      ["bestie-black", -1.25, 0xb699ff],
    ] as const) {
      const root = new THREE.Group();
      root.name = id;
      root.position.x = x;
      root.rotation.y = Math.PI;
      const marker = groundRing(0.58, color, 0.65);
      const pivot = new THREE.Group();
      pivot.position.x = x;
      pivot.add(marker);
      this.root.add(root, pivot);
      const actor: DuoActor = { root, marker, actions: new Map(), current: "" };
      this.actors.set(id, actor);
      assets.attach(
        models.find((entry) => entry.id === id)!.url,
        root,
        valid,
        (loaded, clips) => {
          actor.mixer = new THREE.AnimationMixer(loaded);
          for (const clip of clips) {
            const repeat = ["idle", "move", "cheer", "dizzy"].includes(
              clip.name,
            );
            const action = actor.mixer
              .clipAction(clip)
              .setLoop(
                repeat ? THREE.LoopRepeat : THREE.LoopOnce,
                repeat ? Infinity : 1,
              );
            action.clampWhenFinished = true;
            actor.actions.set(clip.name, action);
          }
        },
      );
    }
    for (const side of [-1, 1]) {
      const orbit = new THREE.Group();
      orbit.position.set(side * 1.25, 1.58, 0);
      for (let index = 0; index < 3; index++) {
        const star = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.065),
          new THREE.MeshBasicMaterial({ color: 0xffe88a }),
        );
        star.position.set(
          Math.cos((index * Math.PI * 2) / 3) * 0.3,
          0,
          Math.sin((index * Math.PI * 2) / 3) * 0.3,
        );
        orbit.add(star);
      }
      this.stars.add(orbit);
    }
    this.hazard.castShadow = true;
    this.root.add(this.hazard, this.warning, this.stars);
    this.hazard.visible = this.warning.visible = this.stars.visible = false;
  }
  update(frame: BestiesFrame, dt: number, hp: number, elapsed: number): void {
    if (this.lastHp !== null && hp < this.lastHp) this.hitRemaining = 0.6;
    if (this.lastHp !== null && hp > this.lastHp) this.hitRemaining = 0;
    this.lastHp = hp;
    for (const actorFrame of frame.actors) {
      const actor = this.actors.get(actorFrame.id)!;
      const side = actorFrame.id === "bestie-pink" ? 1 : -1;
      actor.root.position.copy(actorFrame.offset);
      const together =
        frame.phase === "high-five"
          ? Math.sin(
              (Math.PI / 2) *
                (frame.phaseProgress <= 0.625
                  ? frame.phaseProgress / 0.625
                  : (1 - frame.phaseProgress) / 0.375),
            )
          : 0;
      actor.root.position.x -= side * together * 0.8;
      actor.root.rotation.y = Math.PI;
      actor.marker.parent!.position.copy(actor.root.position);
      actor.marker.visible = frame.phase !== "defeated";
      (actor.marker.material as THREE.MeshBasicMaterial).opacity =
        frame.vulnerable
          ? 0.9
          : frame.activeActor === actorFrame.id
            ? 0.7
            : 0.25;
      const clip =
        frame.phase === "defeated"
          ? "defeat"
          : this.hitRemaining > 0
            ? "hit"
            : actorFrame.clip;
      const action = actor.actions.get(clip);
      if (action && actor.current !== clip) {
        const previous = actor.actions.get(actor.current);
        action.reset().setEffectiveWeight(1).play();
        if (previous) previous.crossFadeTo(action, 0.1, false);
        actor.current = clip;
      }
      if (action && clip === "attack") {
        const duration = action.getClip().duration;
        const contact = duration * 0.625;
        action.paused = true;
        action.time = frame.phase.endsWith("warning")
          ? frame.phaseProgress * contact
          : contact + frame.phaseProgress * (duration - contact);
      } else if (action && clip === "high-five") {
        action.paused = true;
        action.time = frame.phaseProgress * action.getClip().duration;
      }
      actor.mixer?.update(dt);
    }
    this.hitRemaining = Math.max(0, this.hitRemaining - dt);
    this.stars.visible = frame.vulnerable;
    for (const orbit of this.stars.children) orbit.rotation.y = elapsed * 3;
    const hazard = frame.hazards[0];
    this.hazard.visible = Boolean(hazard?.damaging);
    this.warning.visible = Boolean(hazard && !hazard.damaging);
    if (hazard) {
      const mesh = hazard.damaging ? this.hazard : this.warning;
      mesh.position.set(
        hazard.center.x - BESTIES_ARENA_CENTER.x,
        hazard.center.y,
        hazard.center.z - BESTIES_ARENA_CENTER.z,
      );
      mesh.scale.set(
        hazard.halfExtents.x * 2,
        hazard.halfExtents.y * 2,
        hazard.halfExtents.z * 2,
      );
      if (!hazard.damaging && hazard.kind === "foam-bar") {
        mesh.position.x = 0;
        mesh.position.y = 0.028;
        mesh.scale.set(6, 0.025, hazard.halfExtents.z * 2);
      }
      this.hazard.material.color.setHex(
        hazard.kind === "foam-bar" ? 0xf77eb4 : 0x9c82d7,
      );
      this.hazard.material.opacity = hazard.kind === "foam-bar" ? 1 : 0.8;
    }
  }
  dispose(): void {
    for (const actor of this.actors.values()) {
      actor.mixer?.stopAllAction();
      if (actor.mixer) actor.mixer.uncacheRoot(actor.mixer.getRoot());
    }
    this.actors.clear();
  }
}
