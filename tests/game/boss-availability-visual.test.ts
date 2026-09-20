// @vitest-environment jsdom

/**
 * The boss health bar must follow the same availability rule as combat and the
 * server. `bossRequiresOrdinaryDefeats` releases the v2 playground bosses from
 * the ordinary-defeat gate (DESIGN018), but the scene used to derive dormancy
 * from "any ordinary alive" alone, so a v2 boss could be fought with its health
 * bar hidden and its idle bob slowed. Legacy routes keep the old presentation.
 */
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import type { SceneFrame } from "../../src/game/types";
import type { SaveView } from "../../src/shared/contracts";
import { makeAuthoredSave, type AuthoredRouteId } from "./authored-fixtures";

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
  return {
    ...actual,
    WebGLRenderer: FakeRenderer,
    PMREMGenerator: FakePmremGenerator,
  };
});

vi.mock("../../src/game/scene-assets", async () => {
  const actual = await vi.importActual<
    typeof import("../../src/game/scene-assets")
  >("../../src/game/scene-assets");
  class FakeSceneAssets {
    // Never invoke the ready callback: the encounter keeps its placeholder
    // model, so the health bar is the only observable under test.
    attach(): void {}
    attachInstances(): void {}
    getState(): { loading: number; failed: number } {
      return { loading: 0, failed: 0 };
    }
    retry(): void {}
    dispose(): void {}
  }
  return { ...actual, SceneAssets: FakeSceneAssets };
});

import { createLevelLayout } from "../../src/game/level";
import { GardenScene } from "../../src/game/scene";

const BOSS_HP_BAR_WIDTH = 1.1;
const BOSS_HP_BAR_HEIGHT = 0.065;

function frame(overrides: Partial<SceneFrame> = {}): SceneFrame {
  return {
    deltaSeconds: 0,
    moving: false,
    grounded: true,
    attacking: false,
    attackTargetId: null,
    guarding: false,
    enemies: [],
    currentTarget: null,
    ...overrides,
  };
}

/**
 * The health bar is the only 1.1 x 0.065 plane in the graph; ordinaries use
 * 0.65 and the ground plane is metres across.
 */
function bossHealthBars(root: THREE.Object3D): THREE.Mesh[] {
  const found: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry;
    if (!(geometry instanceof THREE.PlaneGeometry)) return;
    const { width, height } = geometry.parameters;
    if (width === BOSS_HP_BAR_WIDTH && height === BOSS_HP_BAR_HEIGHT) {
      found.push(object);
    }
  });
  return found;
}

function renderDamagedBoss(save: SaveView): { visible: boolean; scaleX: number } {
  const level = createLevelLayout(save);
  const container = document.createElement("div");
  const scene = new GardenScene(container, level, save);
  const boss = level.encounters.find((entry) => entry.role === "boss");
  if (!boss) throw new Error("Authored fixture must place a boss");
  const bossEncounter = save.adventure?.activeLevel?.encounters.find(
    (entry) => entry.role === "boss",
  );
  if (!bossEncounter) throw new Error("Authored fixture must plan a boss");
  scene.render(
    { x: boss.position.x, y: boss.position.y, z: boss.position.z + 2 },
    0,
    0,
    frame({
      deltaSeconds: 1 / 60,
      enemies: [
        {
          id: boss.id,
          position: boss.position,
          facing: 0,
          phase: "idle",
          windupProgress: 0,
          // Damaged, so the bar's visibility is decided by dormancy alone.
          hp: bossEncounter.maxHp - 1,
          maxHp: bossEncounter.maxHp,
        },
      ],
    }),
  );
  const meshes = bossHealthBars(sceneRootOf(scene));
  expect(meshes).toHaveLength(1);
  const bar = meshes[0]!;
  const result = { visible: bar.visible, scaleX: bar.scale.x };
  scene.dispose();
  return result;
}

function sceneRootOf(scene: GardenScene): THREE.Object3D {
  const root = (scene as unknown as { scene: THREE.Scene }).scene;
  if (!root) throw new Error("GardenScene must expose its three.js scene");
  return root;
}

function damagedBossSave(routeId: AuthoredRouteId): SaveView {
  const save = makeAuthoredSave({ routeId });
  const adventure = save.adventure;
  const activeLevel = adventure?.activeLevel;
  if (!adventure || !activeLevel) throw new Error("Fixture needs an active level");
  return {
    ...save,
    adventure: {
      ...adventure,
      activeLevel: {
        ...activeLevel,
        encounters: activeLevel.encounters.map((encounter) =>
          encounter.role === "boss"
            ? { ...encounter, hp: encounter.maxHp - 1 }
            : encounter,
        ),
      },
    },
  };
}

describe("boss health bar visibility", () => {
  it("shows a damaged v2 boss's health bar while its ordinaries are still alive", () => {
    const save = damagedBossSave("garden-playground-v2");
    const ordinaries = save.adventure?.activeLevel?.encounters.filter(
      (encounter) => encounter.role === "ordinary",
    );
    expect(ordinaries?.some((encounter) => !encounter.defeated)).toBe(true);
    const bar = renderDamagedBoss(save);
    expect(bar.visible).toBe(true);
    expect(bar.scaleX).toBeLessThan(1);
  });

  it("keeps the legacy route's boss dormant until its ordinaries are defeated", () => {
    const dormant = renderDamagedBoss(damagedBossSave("garden-playground-v1"));
    expect(dormant.visible).toBe(false);

    const cleared = makeAuthoredSave({
      routeId: "garden-playground-v1",
      defeatedOrdinaryCount: 4,
    });
    const adventure = cleared.adventure;
    const activeLevel = adventure?.activeLevel;
    if (!adventure || !activeLevel) throw new Error("Fixture needs an active level");
    const awakened = renderDamagedBoss({
      ...cleared,
      adventure: {
        ...adventure,
        activeLevel: {
          ...activeLevel,
          encounters: activeLevel.encounters.map((encounter) =>
            encounter.role === "boss"
              ? { ...encounter, hp: encounter.maxHp - 1 }
              : encounter,
          ),
        },
      },
    });
    expect(awakened.visible).toBe(true);
  });
});
