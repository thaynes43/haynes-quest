import * as THREE from "three";
import type { ScareFrame, ScareLevel } from "./scare";

/**
 * DESIGN-027 D-03/D-05 presentation for chapters playing at scare level 1 or
 * 2. The scene only builds one of these for such a chapter, so a level 0
 * chapter's scene graph, lights and fog stay exactly as before.
 *
 * - Level 1: scene light at 55%, colder and closer fog, and practical lights
 *   (the scenery kit's bulbs and emissive trim) that dip in short flickers.
 * - Level 2 adds blackouts, in which everything but gameplay markers, the
 *   golden-collectible glow and the animatronics' eyes goes dark, and a key
 *   light for the jump scare's close shot.
 */

/** Scene light while a chapter is spooky or scary (D-03: about 55%). */
export const SCARE_LIGHT_SCALE = 0.55;
/** Extra light scale during a flicker dip, and what practicals drop to. */
const FLICKER_LIGHT_SCALE = 0.8;
const FLICKER_PRACTICAL_SCALE = 0.12;
/** What scene light falls to at the depth of a blackout. */
const BLACKOUT_LIGHT_SCALE = 0.03;
/** Fog starts at half its distance and ends at 60%, tinted toward cold night. */
const FOG_NEAR_SCALE = 0.5;
const FOG_FAR_SCALE = 0.6;
const COLD_NIGHT = 0x0e1524;
const COLD_MIX = 0.62;
const EYE_COLOR = 0xff3b2e;
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
  private readonly eyes = new Map<string, THREE.Group>();
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
      fog.near *= FOG_NEAR_SCALE;
      fog.far *= FOG_FAR_SCALE;
    }
    if (this.level === 2) {
      this.keyLight = new THREE.PointLight(0xffe2c8, 0, 4, 2);
      this.keyLight.name = "scare-key-light";
      this.scene.add(this.keyLight);
    } else this.keyLight = null;
    this.update(null);
  }

  /** Gives an enemy a pair of glowing eyes (level 2), shown in the dark and in the lunge. */
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
    eyes.visible = false;
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
    const blackout = frame?.lunge ? 0 : (frame?.blackout ?? 0);
    const lightScale =
      SCARE_LIGHT_SCALE *
      (flicker > 0 ? FLICKER_LIGHT_SCALE : 1) *
      THREE.MathUtils.lerp(1, BLACKOUT_LIGHT_SCALE, blackout);
    this.hemisphere.intensity = this.base.hemisphere * lightScale;
    this.sun.intensity = this.base.sun * lightScale;
    this.scene.environmentIntensity = this.base.environment * SCARE_LIGHT_SCALE * (1 - blackout);
    this.background.copy(this.night).lerp(this.black, blackout);
    if (this.scene.background instanceof THREE.Color) this.scene.background.copy(this.background);
    else this.scene.background = this.background.clone();
    if (this.scene.fog instanceof THREE.Fog) this.scene.fog.color.copy(this.background);
    this.setPracticalScale((flicker > 0 ? FLICKER_PRACTICAL_SCALE : 1) * (1 - blackout));
    const eyesOn =
      this.level === 2 && (blackout > 0.5 || Boolean(frame?.lunge) || flicker > 0);
    for (const eyes of this.eyes.values()) eyes.visible = eyesOn;
    if (this.keyLight) this.keyLight.intensity = frame?.lunge ? 7 : 0;
  }

  /** Scales every practical light; restores the originals at 1. */
  private setPracticalScale(scale: number): void {
    if (scale === this.practicalScale) return;
    if (this.practicalScale === 1) this.collectPracticals();
    this.practicalScale = scale;
    for (const [material, original] of this.practicals) {
      if (original.color && "color" in material)
        (material as THREE.MeshBasicMaterial).color.copy(original.color).multiplyScalar(scale);
      if (original.emissiveIntensity !== undefined)
        (material as THREE.MeshStandardMaterial).emissiveIntensity =
          original.emissiveIntensity * scale;
    }
  }

  /** Finds practical lights, including scenery that finished loading since the last dip. */
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

  inspect(): { practicals: number; practicalScale: number; eyes: number; eyesVisible: boolean } {
    return {
      practicals: this.practicals.size,
      practicalScale: this.practicalScale,
      eyes: this.eyes.size,
      eyesVisible: [...this.eyes.values()].some((eyes) => eyes.visible),
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

/** Mesh bounds in `model`'s own frame (ignoring its current facing), skipping `exclude`. */
function modelFrameBounds(model: THREE.Object3D, exclude: THREE.Object3D): THREE.Box3 | null {
  model.updateWorldMatrix(true, true);
  const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const bounds = new THREE.Box3();
  const box = new THREE.Box3();
  const matrix = new THREE.Matrix4();
  model.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || isWithin(node, exclude)) return;
    const geometry = node.geometry as THREE.BufferGeometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox) return;
    matrix.multiplyMatrices(toModel, node.matrixWorld);
    box.copy(geometry.boundingBox).applyMatrix4(matrix);
    bounds.union(box);
  });
  return bounds.isEmpty() ? null : bounds;
}

function isWithin(node: THREE.Object3D, ancestor: THREE.Object3D): boolean {
  for (let current: THREE.Object3D | null = node; current; current = current.parent)
    if (current === ancestor) return true;
  return false;
}
