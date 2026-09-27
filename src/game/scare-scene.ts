import * as THREE from "three";
import type { ScareFrame, ScareLevel } from "./scare";

/**
 * DESIGN-027 D-03/D-05 presentation for chapters playing at scare level 1 or
 * 2. The scene only builds one of these for such a chapter, so a level 0
 * chapter's scene graph, lights and fog stay exactly as before.
 *
 * - Level 1: scene light at 55%, colder and closer fog, and practical lights
 *   (the scenery kit's bulbs and emissive trim) that dip in short flickers.
 * - Level 2 is darker still: scene light at 38%, fog closer again, practical
 *   lights browned out to 60%, and every animatronic's eyes glowing faintly.
 *   It adds blackouts, in which everything but gameplay markers, the
 *   golden-collectible glow and the eyes goes dark, and the jump scare's
 *   close shot: the room drops almost black while a cold light from below
 *   catches the attacker's face.
 */

/** Scene light while a chapter is spooky (D-03: about 55%) or scary. */
export const SCARE_LIGHT_SCALE = Object.freeze({ 1: 0.55, 2: 0.38 } as const);
/** Practical lights between dips: full at level 1, browned out at level 2. */
export const SCARE_PRACTICAL_SCALE = Object.freeze({ 1: 1, 2: 0.6 } as const);
/** Extra light scale during a flicker dip, and what practicals drop to. */
const FLICKER_LIGHT_SCALE = 0.8;
const FLICKER_PRACTICAL_SCALE = 0.12;
/** What scene light falls to at the depth of a blackout. */
const BLACKOUT_LIGHT_SCALE = 0.03;
/** How dark the room goes behind the lunge's close shot. */
const LUNGE_DARKNESS = 0.9;
/** Fog start and end as a share of the chapter's own, tinted toward cold night. */
export const SCARE_FOG_SCALE = Object.freeze({
  1: Object.freeze({ near: 0.5, far: 0.6 }),
  2: Object.freeze({ near: 0.35, far: 0.5 }),
});
const COLD_NIGHT = 0x0e1524;
const COLD_MIX = 0.62;
const EYE_COLOR = 0xff3b2e;
/** Level 2 eyes between scares: a faint ember; flickers, blackouts and lunges flare them. */
const EYE_DIM = 0.45;
const EYE_GLOW_OPACITY = 0.35;
const EYE_DIM_GLOW_OPACITY = 0.12;
/** The lunge's key light: cold, from below the face, bright enough to read in the dark. */
const KEY_LIGHT_COLOR = 0xc4d6ff;
const KEY_LIGHT_INTENSITY = 5;
/** Watcher idle poses: a roll of the head and body around the facing axis. */
const WATCHER_POSE_ROLL = [0, 0.2, -0.18, 0.1] as const;

export function watcherPoseRoll(pose: number | undefined): number {
  if (pose === undefined) return 0;
  return WATCHER_POSE_ROLL[((pose % WATCHER_POSE_ROLL.length) + WATCHER_POSE_ROLL.length) % WATCHER_POSE_ROLL.length]!;
}

interface PracticalOriginal {
  readonly color?: THREE.Color;
  readonly emissiveIntensity?: number;
}

export interface ScareVisualsOptions {
  readonly level: Exclude<ScareLevel, 0>;
  readonly scene: THREE.Scene;
  readonly hemisphere: THREE.HemisphereLight;
  readonly sun: THREE.DirectionalLight;
  /** The scenery roots whose bulbs and emissive trim count as practical lights. */
  readonly practicalRoots: () => readonly THREE.Object3D[];
}

export class ScareVisuals {
  readonly level: Exclude<ScareLevel, 0>;
  private readonly scene: THREE.Scene;
  private readonly hemisphere: THREE.HemisphereLight;
  private readonly sun: THREE.DirectionalLight;
  private readonly practicalRoots: () => readonly THREE.Object3D[];
  private readonly base: { hemisphere: number; sun: number; environment: number };
  private readonly night = new THREE.Color();
  private readonly black = new THREE.Color(0x000000);
  private readonly background = new THREE.Color();
  private readonly practicals = new Map<THREE.Material, PracticalOriginal>();
  private practicalScale = 1;
  private practicalUpdates = 0;
  private readonly eyes = new Map<string, THREE.Group>();
  private eyeFlare = false;
  private readonly eyeMaterial = new THREE.MeshBasicMaterial({
    color: EYE_COLOR,
    fog: false,
    toneMapped: false,
  });
  private readonly eyeGlowMaterial = new THREE.MeshBasicMaterial({
    color: EYE_COLOR,
    fog: false,
    toneMapped: false,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  private readonly eyeGeometry = new THREE.SphereGeometry(1, 10, 8);
  /** Level 2 only: lights the attacker's face during the jump scare's close shot. */
  readonly keyLight: THREE.PointLight | null;
  private disposed = false;

  constructor(options: ScareVisualsOptions) {
    this.level = options.level;
    this.scene = options.scene;
    this.hemisphere = options.hemisphere;
    this.sun = options.sun;
    this.practicalRoots = options.practicalRoots;
    this.base = {
      hemisphere: this.hemisphere.intensity,
      sun: this.sun.intensity,
      environment: this.scene.environmentIntensity,
    };
    const background =
      this.scene.background instanceof THREE.Color
        ? this.scene.background
        : new THREE.Color(0x000000);
    this.night.copy(background).lerp(new THREE.Color(COLD_NIGHT), COLD_MIX);
    const fog = this.scene.fog instanceof THREE.Fog ? this.scene.fog : null;
    if (fog) {
      fog.near *= SCARE_FOG_SCALE[this.level].near;
      fog.far *= SCARE_FOG_SCALE[this.level].far;
    }
    if (this.level === 2) {
      this.keyLight = new THREE.PointLight(KEY_LIGHT_COLOR, 0, 4, 2);
      this.keyLight.name = "scare-key-light";
      this.scene.add(this.keyLight);
    } else this.keyLight = null;
    this.update(null);
  }

  /** Gives an enemy a pair of glowing eyes (level 2): faint in the light, flaring in the dark. */
  attachEyes(id: string, model: THREE.Object3D, height: number): void {
    if (this.level !== 2 || this.disposed) return;
    this.eyes.get(id)?.removeFromParent();
    const eyes = new THREE.Group();
    eyes.name = "scare-eyes";
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(this.eyeGeometry, this.eyeMaterial);
      eye.name = "scare-eye";
      const glow = new THREE.Mesh(this.eyeGeometry, this.eyeGlowMaterial);
      glow.name = "scare-eye-glow";
      glow.scale.setScalar(2.4);
      eye.add(glow);
      eye.position.x = side;
      eyes.add(eye);
    }
    eyes.visible = true;
    model.add(eyes);
    this.eyes.set(id, eyes);
    this.placeEyes(id, { height, halfWidth: 0.3 * height, front: 0.22 * height });
  }

  /**
   * Places an enemy's eyes on the front of its loaded model. `bounds` are in
   * the model's own frame, which faces local −Z like every enemy.
   */
  fitEyes(id: string, model: THREE.Object3D): void {
    const eyes = this.eyes.get(id);
    if (!eyes) return;
    const bounds = modelFrameBounds(model, eyes);
    if (!bounds) return;
    const size = bounds.getSize(new THREE.Vector3());
    const height = size.y;
    if (!(height > 0.05)) return;
    this.placeEyes(id, {
      height: bounds.max.y,
      halfWidth: size.x / 2,
      front: -bounds.min.z,
      centerX: (bounds.min.x + bounds.max.x) / 2,
      span: height,
    });
  }

  private placeEyes(
    id: string,
    fit: { height: number; halfWidth: number; front: number; centerX?: number; span?: number },
  ): void {
    const eyes = this.eyes.get(id);
    if (!eyes) return;
    const span = fit.span ?? fit.height;
    const radius = THREE.MathUtils.clamp(span * 0.028, 0.025, 0.07);
    const spacing = THREE.MathUtils.clamp(fit.halfWidth * 0.28, radius * 1.8, span * 0.12);
    eyes.position.set(fit.centerX ?? 0, fit.height - span * 0.16, -Math.max(0.05, fit.front) - radius);
    for (const eye of eyes.children) {
      eye.position.x = Math.sign(eye.position.x) * spacing;
      eye.scale.setScalar(radius);
    }
  }

  /** The height of an enemy's eyes above its feet, for framing the lunge. */
  eyeHeight(id: string): number | null {
    const eyes = this.eyes.get(id);
    return eyes ? eyes.position.y : null;
  }

  update(frame: ScareFrame | null | undefined): void {
    if (this.disposed) return;
    const flicker = frame?.flicker ?? 0;
    const lunge = Boolean(frame?.lunge);
    // The lunge drops the room almost black behind the face, whatever the
    // blackout was doing (a lunge ends a blackout).
    const blackout = lunge ? LUNGE_DARKNESS : (frame?.blackout ?? 0);
    const levelLight = SCARE_LIGHT_SCALE[this.level];
    const lightScale =
      levelLight *
      (flicker > 0 ? FLICKER_LIGHT_SCALE : 1) *
      THREE.MathUtils.lerp(1, BLACKOUT_LIGHT_SCALE, blackout);
    this.hemisphere.intensity = this.base.hemisphere * lightScale;
    this.sun.intensity = this.base.sun * lightScale;
    this.scene.environmentIntensity = this.base.environment * levelLight * (1 - blackout);
    this.background.copy(this.night).lerp(this.black, blackout);
    if (this.scene.background instanceof THREE.Color) this.scene.background.copy(this.background);
    else this.scene.background = this.background.clone();
    if (this.scene.fog instanceof THREE.Fog) this.scene.fog.color.copy(this.background);
    this.setPracticalScale(
      SCARE_PRACTICAL_SCALE[this.level] *
        (flicker > 0 ? FLICKER_PRACTICAL_SCALE : 1) *
        (1 - blackout),
    );
    // Level 2 eyes always glow a little; a dip, a blackout or a lunge flares them.
    const flare = this.level === 2 && (blackout > 0.5 || lunge || flicker > 0);
    this.eyeFlare = flare;
    this.eyeMaterial.color.setHex(EYE_COLOR).multiplyScalar(flare ? 1 : EYE_DIM);
    this.eyeGlowMaterial.opacity = flare ? EYE_GLOW_OPACITY : EYE_DIM_GLOW_OPACITY;
    for (const eyes of this.eyes.values()) eyes.visible = this.level === 2;
    if (this.keyLight) this.keyLight.intensity = lunge ? KEY_LIGHT_INTENSITY : 0;
  }

  /**
   * Scales every practical light; restores the originals at 1. While they are
   * scaled, scenery that finishes loading later joins them within a second.
   */
  private setPracticalScale(scale: number): void {
    this.practicalUpdates = (this.practicalUpdates + 1) % 60;
    const refresh = this.practicalUpdates === 0 && scale !== 1;
    if (scale === this.practicalScale && !refresh) return;
    if (scale !== 1) this.collectPracticals();
    this.practicalScale = scale;
    for (const [material, original] of this.practicals) {
      if (original.color && "color" in material)
        (material as THREE.MeshBasicMaterial).color.copy(original.color).multiplyScalar(scale);
      if (original.emissiveIntensity !== undefined)
        (material as THREE.MeshStandardMaterial).emissiveIntensity =
          original.emissiveIntensity * scale;
    }
  }

  /** Finds practical lights, including scenery that finished loading since the last look. */
  private collectPracticals(): void {
    for (const root of this.practicalRoots())
      root.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) {
          if (this.practicals.has(material)) continue;
          if (material instanceof THREE.MeshBasicMaterial)
            this.practicals.set(material, { color: material.color.clone() });
          else if (
            material instanceof THREE.MeshStandardMaterial &&
            material.emissiveIntensity > 0 &&
            material.emissive.getHex() !== 0
          )
            this.practicals.set(material, { emissiveIntensity: material.emissiveIntensity });
        }
      });
  }

  inspect(): {
    practicals: number;
    practicalScale: number;
    eyes: number;
    eyesVisible: boolean;
    eyesFlared: boolean;
  } {
    return {
      practicals: this.practicals.size,
      practicalScale: this.practicalScale,
      eyes: this.eyes.size,
      eyesVisible: [...this.eyes.values()].some((eyes) => eyes.visible),
      eyesFlared: this.eyeFlare && this.eyes.size > 0,
    };
  }

  /** Restores the scene light and practicals; the caller rebuilds fog and sky. */
  dispose(): void {
    if (this.disposed) return;
    this.setPracticalScale(1);
    this.hemisphere.intensity = this.base.hemisphere;
    this.sun.intensity = this.base.sun;
    this.scene.environmentIntensity = this.base.environment;
    this.keyLight?.removeFromParent();
    this.keyLight?.dispose();
    for (const eyes of this.eyes.values()) eyes.removeFromParent();
    this.eyes.clear();
    this.practicals.clear();
    this.eyeGeometry.dispose();
    this.eyeMaterial.dispose();
    this.eyeGlowMaterial.dispose();
    this.disposed = true;
  }
}

/**
 * Mesh bounds in `model`'s own frame (ignoring its current facing), skipping
 * `exclude` and anything named `scare-eyes`.
 */
export function modelFrameBounds(
  model: THREE.Object3D,
  exclude?: THREE.Object3D,
): THREE.Box3 | null {
  model.updateWorldMatrix(true, true);
  const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const bounds = new THREE.Box3();
  const box = new THREE.Box3();
  const matrix = new THREE.Matrix4();
  model.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || isWithin(node, exclude) || isWithinEyes(node)) return;
    const geometry = node.geometry as THREE.BufferGeometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox) return;
    matrix.multiplyMatrices(toModel, node.matrixWorld);
    box.copy(geometry.boundingBox).applyMatrix4(matrix);
    bounds.union(box);
  });
  return bounds.isEmpty() ? null : bounds;
}

function isWithin(node: THREE.Object3D, ancestor: THREE.Object3D | undefined): boolean {
  if (!ancestor) return false;
  for (let current: THREE.Object3D | null = node; current; current = current.parent)
    if (current === ancestor) return true;
  return false;
}

function isWithinEyes(node: THREE.Object3D): boolean {
  for (let current: THREE.Object3D | null = node; current; current = current.parent)
    if (current.name === "scare-eyes") return true;
  return false;
}
