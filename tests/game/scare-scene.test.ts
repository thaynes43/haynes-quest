// @vitest-environment jsdom
/**
 * DESIGN-027 presentation with the real GardenScene (fake WebGL and asset
 * loader): a level 0 chapter, or a scary one with the parent switch off,
 * builds exactly today's scene; level 1 darkens the light and fog and
 * flickers practical lights; level 2 blacks the room out except the eyes and
 * the golden glow, and frames the jump scare's close shot.
 */
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import type { ResolvedAuthoredLevel } from "../../src/shared/authored-level";
import type { SaveView } from "../../src/shared/contracts";
import { resolveLevelEditorProject } from "../../src/shared/editor-project";
import familyWorldA from "../../src/shared/levels/family-world-a-v2.json";
import { makeAuthoredSave } from "./authored-fixtures";
import { sceneFingerprint } from "./scene-fingerprint";

const harness = vi.hoisted(() => ({ requests: [] as string[] }));

vi.mock("three", async () => {
  const actual = await vi.importActual<typeof import("three")>("three");
  class FakeRenderer {
    readonly domElement = document.createElement("canvas");
    readonly shadowMap = { enabled: false, type: 0 };
    readonly renderLists = { dispose: vi.fn() };
    outputColorSpace = actual.SRGBColorSpace;
    toneMapping = actual.NoToneMapping;
    toneMappingExposure = 1;
    setPixelRatio(): void {}
    setSize(): void {}
    render(): void {}
    dispose(): void {}
    forceContextLoss(): void {}
  }
  class FakePmremGenerator {
    fromScene(): { texture: THREE.Texture; dispose: () => void } {
      return { texture: new actual.Texture(), dispose: vi.fn() };
    }
    dispose(): void {}
  }
  return { ...actual, WebGLRenderer: FakeRenderer, PMREMGenerator: FakePmremGenerator };
});

vi.mock("../../src/game/scene-assets", async () => {
  const actual = await vi.importActual<typeof import("../../src/game/scene-assets")>(
    "../../src/game/scene-assets",
  );
  class FakeSceneAssets {
    attach(url: string, target: THREE.Object3D): void {
      harness.requests.push(`attach ${url} -> ${target.name}`);
    }
    attachInstances(url: string, target: THREE.Object3D): void {
      harness.requests.push(`instances ${url} -> ${target.name}`);
    }
    getState(): { loading: number; failed: number } {
      return { loading: 0, failed: 0 };
    }
    retry(): void {}
    dispose(): void {}
  }
  return { ...actual, SceneAssets: FakeSceneAssets };
});

import { authoredLevelResolverFor } from "../../src/game/authored-layout";
import { planCasinoCollectibles } from "../../src/game/casino-tokens";
import { createLevelLayout } from "../../src/game/level";
import { GardenScene } from "../../src/game/scene";
import type { ScareFrame } from "../../src/game/scare";
import { ScareVisuals, watcherPoseRoll } from "../../src/game/scare-scene";
import type { EnemyFrame, SceneFrame } from "../../src/game/types";

const world = resolveLevelEditorProject(familyWorldA);
const casino = world.levels["family-a4-casino"]!;

function routeWith(scare: 0 | 1 | 2 | undefined): ResolvedAuthoredLevel {
  const { scare: _ignored, ...document } = casino.document;
  return {
    ...casino,
    document: scare === undefined ? document : { ...document, scare },
  };
}

function build(scare: 0 | 1 | 2 | undefined, scaryMoments?: boolean) {
  const route = routeWith(scare);
  const save = structuredClone(makeAuthoredSave({ routeId: "garden-playground-v2" })) as SaveView;
  const active = save.adventure!.activeLevel!;
  active.routeId = route.document.id;
  const ordinary = active.encounters.find((entry) => entry.role === "ordinary")!;
  active.encounters.push({
    ...structuredClone(ordinary),
    id: "scare-bonus",
    kind: route.anchors.encounters["bonus-1"]!.kind,
  });
  active.optionalEncounterIds = ["scare-bonus"];
  const level = createLevelLayout(save, authoredLevelResolverFor({ [route.document.id]: route }));
  harness.requests.length = 0;
  const scene = new GardenScene(
    document.createElement("div"),
    level,
    save,
    scaryMoments === undefined ? {} : { scaryMoments },
  );
  return { scene, level, save };
}

interface SceneInternals {
  scene: THREE.Scene;
  hemisphere: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  camera: THREE.PerspectiveCamera;
  enemies: Map<string, { root: THREE.Group; model: THREE.Group }>;
}
const internals = (scene: GardenScene) => scene as unknown as SceneInternals;

function lights(scene: GardenScene) {
  const inner = internals(scene);
  return {
    hemisphere: inner.hemisphere.intensity,
    sun: inner.sun.intensity,
    environment: inner.scene.environmentIntensity,
  };
}

function frame(scare: ScareFrame | undefined, enemies: EnemyFrame[] = []): SceneFrame {
  return {
    deltaSeconds: 1 / 60,
    moving: false,
    grounded: true,
    attacking: false,
    attackTargetId: null,
    guarding: false,
    enemies,
    currentTarget: null,
    ...(scare ? { scare } : {}),
  };
}

const lit = (level: 1 | 2, overrides: Partial<ScareFrame> = {}): ScareFrame => ({
  level,
  flicker: 0,
  blackout: 0,
  blackoutElapsed: null,
  lunge: null,
  ...overrides,
});

/** The Rat Casino kit's bulbs: the practical light the flicker must reach. */
function bulbColor(scene: GardenScene): number {
  let color = -1;
  internals(scene).scene.traverse((node) => {
    if (node.name === "casino-decor-bulb-glow")
      color = ((node as THREE.Mesh).material as THREE.MeshBasicMaterial).color.getHex();
  });
  return color;
}

describe("DESIGN-027 scene presentation", () => {
  it("builds today's exact scene at level 0 and for a scary chapter with the switch off", () => {
    const baseline = build(undefined);
    const expected = sceneFingerprint(baseline.scene, harness.requests);
    const expectedLights = lights(baseline.scene);
    baseline.scene.dispose();
    for (const [scare, scaryMoments] of [
      [0, undefined],
      [0, true],
      [undefined, false],
      [1, false],
      [2, false],
    ] as const) {
      const { scene } = build(scare, scaryMoments);
      expect(sceneFingerprint(scene, harness.requests), `${scare}/${scaryMoments}`).toBe(expected);
      expect(lights(scene)).toEqual(expectedLights);
      expect(scene.inspectVisuals().scare).toBeUndefined();
      scene.dispose();
    }
    expect(expectedLights).toEqual({ hemisphere: 1.15, sun: 2.1, environment: 0.3 });
  });

  it("dims level 1 to 55% with colder, closer fog and no eyes or key light", () => {
    const baseline = build(undefined);
    const baseFog = internals(baseline.scene).scene.fog as THREE.Fog;
    const baseSky = (internals(baseline.scene).scene.background as THREE.Color).getHex();
    const [near, far] = [baseFog.near, baseFog.far];
    baseline.scene.dispose();

    const { scene } = build(1);
    expect(lights(scene).hemisphere).toBeCloseTo(1.15 * 0.55);
    expect(lights(scene).sun).toBeCloseTo(2.1 * 0.55);
    expect(lights(scene).environment).toBeCloseTo(0.3 * 0.55);
    const inner = internals(scene).scene;
    const fog = inner.fog as THREE.Fog;
    expect(fog.near).toBeCloseTo(near * 0.5);
    expect(fog.far).toBeCloseTo(far * 0.6);
    const sky = inner.background as THREE.Color;
    expect(sky.getHex()).not.toBe(baseSky);
    expect(fog.color.getHex()).toBe(sky.getHex());
    // Colder: more blue than red relative to the original sky.
    const original = new THREE.Color(baseSky);
    expect(sky.b - sky.r).toBeGreaterThan(original.b - original.r - 1e-6);
    expect(inner.getObjectByName("scare-key-light")).toBeUndefined();
    expect(scene.inspectVisuals().scare).toMatchObject({ eyes: 0, eyesVisible: false });
    scene.dispose();
  });

  it("dips practical lights in a flicker and restores them exactly", () => {
    const { scene, level } = build(1);
    const original = bulbColor(scene);
    expect(original).toBeGreaterThan(0);
    const position = level.checkpoint;
    scene.render(position, 0, 0, frame(lit(1, { flicker: 1 })));
    expect(bulbColor(scene)).not.toBe(original);
    expect(scene.inspectVisuals().scare!.practicals).toBeGreaterThan(0);
    expect(scene.inspectVisuals().scare!.practicalScale).toBeCloseTo(0.12);
    expect(lights(scene).hemisphere).toBeCloseTo(1.15 * 0.55 * 0.8);
    scene.render(position, 0, 0, frame(lit(1)));
    expect(bulbColor(scene)).toBe(original);
    expect(lights(scene).hemisphere).toBeCloseTo(1.15 * 0.55);
    scene.dispose();
  });

  it("blacks out everything but the eyes and the golden glow at level 2", () => {
    const { scene, level } = build(2);
    const plan = planCasinoCollectibles(level)!;
    scene.setCollectibles(plan);
    const tokenGlow = () => {
      const values: number[] = [];
      internals(scene).scene.traverse((node) => {
        if (!(node instanceof THREE.Mesh) || !node.parent?.name.includes("token")) return;
        const material = node.material as THREE.MeshStandardMaterial;
        if ("emissiveIntensity" in material) values.push(material.emissiveIntensity);
      });
      return values;
    };
    const beforeTokens = tokenGlow();
    const eyes = scene.inspectVisuals().scare!.eyes;
    expect(eyes).toBe(level.encounters.length);
    expect(scene.inspectVisuals().scare!.eyesVisible).toBe(false);
    scene.render(level.checkpoint, 0, 0, frame(lit(2, { blackout: 1, blackoutElapsed: 0.5 })));
    expect(lights(scene).hemisphere).toBeCloseTo(1.15 * 0.55 * 0.03);
    expect(lights(scene).environment).toBe(0);
    const inner = internals(scene).scene;
    expect((inner.background as THREE.Color).getHex()).toBe(0x000000);
    expect((inner.fog as THREE.Fog).color.getHex()).toBe(0x000000);
    expect(bulbColor(scene)).toBe(0x000000);
    expect(scene.inspectVisuals().scare).toMatchObject({ practicalScale: 0, eyesVisible: true });
    expect(tokenGlow()).toEqual(beforeTokens);
    scene.render(level.checkpoint, 0, 0, frame(lit(2)));
    expect(scene.inspectVisuals().scare).toMatchObject({ practicalScale: 1, eyesVisible: false });
    expect(lights(scene).hemisphere).toBeCloseTo(1.15 * 0.55);
    scene.dispose();
  });

  it("frames the attacker's face close up with a key light for the lunge", () => {
    const { scene, level } = build(2);
    const enemy = level.encounters.find((entry) => entry.role === "ordinary")!;
    const enemyFrame: EnemyFrame = {
      id: enemy.id,
      position: { ...enemy.position },
      facing: Math.PI / 3,
      phase: "cooldown",
      windupProgress: 0,
      hp: 4,
      maxHp: 4,
    };
    const player = {
      x: enemy.position.x - Math.sin(Math.PI / 3) * 1.2,
      y: enemy.position.y,
      z: enemy.position.z - Math.cos(Math.PI / 3) * 1.2,
    };
    scene.render(player, 0, 0, frame(lit(2), [enemyFrame]));
    const camera = internals(scene).camera;
    const normalDistance = camera.position.distanceTo(new THREE.Vector3(enemy.position.x, enemy.position.y, enemy.position.z));
    for (const [progress, reducedMotion] of [
      [0.05, false],
      [0.6, false],
      [0.5, true],
    ] as const) {
      scene.render(
        player,
        0,
        0,
        frame(lit(2, { lunge: { encounterId: enemy.id, progress, reducedMotion } }), [enemyFrame]),
      );
      const face = new THREE.Vector3(enemy.position.x, enemy.position.y + 1, enemy.position.z);
      const distance = camera.position.distanceTo(face);
      expect(distance).toBeLessThan(3);
      expect(distance).toBeLessThan(normalDistance);
      // In front of the face: along the enemy's facing (−sin θ, −cos θ).
      const forward = new THREE.Vector3(-Math.sin(Math.PI / 3), 0, -Math.cos(Math.PI / 3));
      const offset = camera.position.clone().sub(face).setY(0);
      expect(offset.normalize().dot(forward)).toBeGreaterThan(0.9);
      const looking = new THREE.Vector3();
      camera.getWorldDirection(looking);
      expect(looking.setY(0).normalize().dot(forward)).toBeLessThan(-0.9);
      const key = internals(scene).scene.getObjectByName("scare-key-light") as THREE.PointLight;
      expect(key.intensity).toBeGreaterThan(0);
      expect(scene.inspectVisuals().scare!.eyesVisible).toBe(true);
    }
    scene.render(player, 0, 0, frame(lit(2), [enemyFrame]));
    const key = internals(scene).scene.getObjectByName("scare-key-light") as THREE.PointLight;
    expect(key.intensity).toBe(0);
    scene.dispose();
  });

  it("restores today's light and scene when a scary chapter rebuilds into an unscary one", () => {
    // The same play either way: one rendered frame, then a rebuild into the
    // unscary chapter. Only the first chapter's scare level differs.
    const rebuilt = (scare: 0 | 2 | undefined) => {
      const { scene, level, save } = build(scare);
      scene.render(
        level.checkpoint,
        0,
        0,
        frame(scare ? lit(scare, { blackout: 1, blackoutElapsed: 0.4 }) : undefined),
      );
      const unscary = createLevelLayout(
        save,
        authoredLevelResolverFor({ [casino.document.id]: routeWith(undefined) }),
      );
      harness.requests.length = 0;
      scene.rebuildRoute(unscary, save);
      return scene;
    };
    const plain = rebuilt(undefined);
    const expected = sceneFingerprint(plain, harness.requests);
    plain.dispose();
    const scene = rebuilt(2);
    expect(lights(scene)).toEqual({ hemisphere: 1.15, sun: 2.1, environment: 0.3 });
    expect(internals(scene).scene.getObjectByName("scare-key-light")).toBeUndefined();
    expect(sceneFingerprint(scene, harness.requests)).toBe(expected);
    scene.dispose();
  });

  it("fits the eyes to the front of a loaded model, whatever its facing", () => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x224466);
    scene.fog = new THREE.Fog(0x224466, 30, 95);
    const hemisphere = new THREE.HemisphereLight(0xffffff, 0x000000, 1.15);
    const sun = new THREE.DirectionalLight(0xffffff, 2.1);
    const visuals = new ScareVisuals({ level: 2, scene, hemisphere, sun, practicalRoots: () => [] });
    const model = new THREE.Group();
    model.position.set(3, 0, -4);
    model.rotation.y = 1.1;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2, 0.6));
    body.position.y = 1;
    model.add(body);
    scene.add(model);
    visuals.attachEyes("enemy", model, 1.35);
    visuals.fitEyes("enemy", model);
    const eyes = model.getObjectByName("scare-eyes")!;
    expect(visuals.eyeHeight("enemy")).toBeCloseTo(2 - 2 * 0.16);
    // In front of the 0.6 m deep body, on the model's forward (−Z) side.
    expect(eyes.position.z).toBeLessThan(-0.3);
    expect(eyes.position.x).toBeCloseTo(0);
    expect(eyes.children.map((eye) => Math.sign(eye.position.x))).toEqual([-1, 1]);
    // Level 1 has no eyes; disposal removes them and restores the light.
    visuals.update(lit(2, { blackout: 1, blackoutElapsed: 0.5 }));
    expect(eyes.visible).toBe(true);
    expect(hemisphere.intensity).toBeLessThan(0.1);
    visuals.dispose();
    expect(model.getObjectByName("scare-eyes")).toBeUndefined();
    expect(hemisphere.intensity).toBe(1.15);
    expect(sun.intensity).toBe(2.1);
    expect(scene.getObjectByName("scare-key-light")).toBeUndefined();
  });

  it("poses a sleeping watcher only when its frame carries a pose", () => {
    const { scene, level } = build(1);
    const enemy = level.encounters.find((entry) => entry.role === "ordinary")!;
    const enemyFrame = (pose?: number): EnemyFrame => ({
      id: enemy.id,
      position: { ...enemy.position },
      facing: 0.4,
      phase: "idle",
      windupProgress: 0,
      hp: 4,
      maxHp: 4,
      ...(pose === undefined ? {} : { pose }),
    });
    const model = internals(scene).enemies.get(enemy.id)!.model;
    scene.render(level.checkpoint, 0, 0, frame(lit(1), [enemyFrame()]));
    expect(model.rotation.z).toBe(0);
    scene.render(level.checkpoint, 0, 0, frame(lit(1), [enemyFrame(2)]));
    expect(model.rotation.z).toBe(watcherPoseRoll(2));
    expect(model.rotation.y).toBe(0.4);
    scene.render(level.checkpoint, 0, 0, frame(lit(1), [enemyFrame(0)]));
    expect(model.rotation.z).toBe(0);
    scene.dispose();
  });

  it("rolls a watcher into its idle poses, and never without a pose", () => {
    expect(watcherPoseRoll(undefined)).toBe(0);
    expect(watcherPoseRoll(0)).toBe(0);
    const rolls = [1, 2, 3].map(watcherPoseRoll);
    expect(new Set(rolls).size).toBe(3);
    for (const roll of rolls) expect(Math.abs(roll)).toBeGreaterThan(0.05);
    expect(watcherPoseRoll(5)).toBe(watcherPoseRoll(1));
  });

  it("reports what the camera can see", () => {
    const { scene, level } = build(1);
    const at = level.checkpoint;
    expect(scene.isInView({ x: at.x + 500, y: at.y, z: at.z })).toBe(true);
    scene.render(at, 0, 0, frame(lit(1)));
    expect(scene.isInView(at)).toBe(true);
    // The chase camera sits behind the player (+z) and looks toward −z.
    expect(scene.isInView({ x: at.x, y: at.y, z: at.z + 30 })).toBe(false);
    expect(scene.isInView({ x: at.x, y: at.y, z: at.z - 12 })).toBe(true);
    scene.dispose();
  });
});
