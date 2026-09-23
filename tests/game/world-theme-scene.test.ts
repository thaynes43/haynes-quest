// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import type {
  AuthoredLevelDocument,
  AuthoredLevelTheme,
  ResolvedAuthoredLevel,
} from "../../src/shared/authored-level";
import { AUTHORED_LEVEL_SCHEMA_VERSION_V3 } from "../../src/shared/authored-level";
import type { SaveView } from "../../src/shared/contracts";
import { makeAuthoredSave } from "./authored-fixtures";

const harness = vi.hoisted(() => ({
  attached: [] as string[],
  instanced: [] as string[],
}));

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
    attach(url: string): void {
      harness.attached.push(url);
    }
    attachInstances(url: string): void {
      harness.instanced.push(url);
    }
    getState(): { loading: number; failed: number } {
      return { loading: 0, failed: 0 };
    }
    retry(): void {}
    dispose(): void {}
  }
  return { ...actual, SceneAssets: FakeSceneAssets };
});

import {
  authoredLevelResolverFor,
  authoredRoute,
} from "../../src/game/authored-layout";
import { createLevelLayout, type LevelLayout } from "../../src/game/level";
import { modelUrls } from "../../src/game/scene-assets";
import { GardenScene } from "../../src/game/scene";
import { WORLD_THEMES } from "../../src/game/world-themes";

const customRouteId = "private-scene-theme-preview";
const clearingAssetUrls = [
  modelUrls.path,
  modelUrls.tree,
  modelUrls.stone,
  modelUrls.gate,
];

function v3Route(theme: AuthoredLevelTheme): ResolvedAuthoredLevel {
  const source = authoredRoute("garden-playground-v2");
  if (!source) throw new Error("Published garden fixture is unavailable");
  const document: AuthoredLevelDocument = {
    ...source.document,
    schemaVersion: AUTHORED_LEVEL_SCHEMA_VERSION_V3,
    id: customRouteId,
    theme,
  };
  return { ...source, document };
}

function previewSave(): SaveView {
  const save = structuredClone(
    makeAuthoredSave({ routeId: "garden-playground-v2" }),
  );
  if (!save.adventure?.activeLevel)
    throw new Error("Authored fixture needs an active level");
  save.adventure.activeLevel.routeId = customRouteId;
  return save;
}

function previewFor(theme: AuthoredLevelTheme): {
  scene: GardenScene;
  level: LevelLayout;
} {
  const save = previewSave();
  const resolver = authoredLevelResolverFor({
    [customRouteId]: v3Route(theme),
  });
  const level = createLevelLayout(save, resolver);
  return {
    level,
    scene: new GardenScene(document.createElement("div"), level, save),
  };
}

function instancePositions(mesh: THREE.InstancedMesh): THREE.Vector3[] {
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  return Array.from({ length: mesh.count }, (_, index) => {
    mesh.getMatrixAt(index, matrix);
    matrix.decompose(position, rotation, scale);
    return position.clone();
  });
}

function pendingScenery(
  world: THREE.Group,
  theme: "arcade" | "toybox",
): THREE.Group {
  const scenery = world.getObjectByName(
    `${theme}-pending-kit-placeholder-scenery`,
  );
  if (!(scenery instanceof THREE.Group))
    throw new Error(`Missing ${theme} pending scenery`);
  return scenery;
}

function expectOffCourse(mesh: THREE.InstancedMesh, level: LevelLayout): void {
  for (const position of instancePositions(mesh)) {
    for (const platform of level.course?.platforms ?? []) {
      const motionX =
        platform.motion?.axis === "x" ? Math.abs(platform.motion.distance) : 0;
      const motionZ =
        platform.motion?.axis === "z" ? Math.abs(platform.motion.distance) : 0;
      expect(
        Math.abs(position.x - platform.center.x) <=
          platform.size.x / 2 + motionX + 0.45 &&
          Math.abs(position.z - platform.center.z) <=
            platform.size.z / 2 + motionZ + 0.45,
        `${mesh.name} entered platform ${platform.id}`,
      ).toBe(false);
    }
    for (const encounter of level.encounters) {
      if (!encounter.arena) continue;
      expect(
        position.x >= encounter.arena.minX &&
          position.x <= encounter.arena.maxX &&
          position.z >= encounter.arena.minZ &&
          position.z <= encounter.arena.maxZ,
        `${mesh.name} entered ${encounter.id}'s arena`,
      ).toBe(false);
    }
  }
}

function expectOnCourseSurface(
  mesh: THREE.InstancedMesh,
  level: LevelLayout,
): void {
  for (const position of instancePositions(mesh)) {
    expect(
      level.course?.platforms.some(
        (platform) =>
          !platform.motion &&
          Math.abs(position.x - platform.center.x) <= platform.size.x / 2 &&
          Math.abs(position.z - platform.center.z) <= platform.size.z / 2 &&
          Math.abs(position.y - (platform.center.y + platform.size.y / 2)) <
            0.05,
      ),
      `${mesh.name} was not placed on a visible course surface`,
    ).toBe(true);
  }
}

function publishedScene(
  routeId: "garden-playground-v2" | "besties-playground-v2",
) {
  const save = makeAuthoredSave({ routeId });
  const level = createLevelLayout(save);
  return new GardenScene(document.createElement("div"), level, save);
}

function worldOf(scene: GardenScene): THREE.Group {
  return (scene as unknown as { world: THREE.Group }).world;
}

function firstPlatformSideColor(world: THREE.Group): number {
  const course = world.getObjectByName("obstacle-course");
  const platform = course?.children.find((child) =>
    child.name.startsWith("platform-"),
  );
  const floor = platform?.children[0];
  if (!(floor instanceof THREE.Mesh) || !Array.isArray(floor.material))
    throw new Error("Obstacle course is missing its platform surface");
  const side = floor.material[0];
  if (!(side instanceof THREE.MeshStandardMaterial))
    throw new Error("Platform side must use a standard material");
  return side.color.getHex();
}

describe("GardenScene world theme assets", () => {
  beforeEach(() => {
    harness.attached.length = 0;
    harness.instanced.length = 0;
  });

  it.each(["arcade", "toybox"] as const)(
    "renders the %s pending-kit fallback without clearing GLBs",
    (theme) => {
      const { scene, level } = previewFor(theme);
      const world = worldOf(scene);
      const requested = [...harness.attached, ...harness.instanced];

      for (const url of clearingAssetUrls) expect(requested).not.toContain(url);
      expect(world.userData).toMatchObject({
        worldTheme: theme,
        environmentKitState: "pending-kit",
      });
      const fallbackName = WORLD_THEMES[theme].environment.fallbackName;
      const fallback = world.getObjectByName(fallbackName!);
      expect(fallback).toBeDefined();
      expect(fallback?.children).toHaveLength(3);
      expect(firstPlatformSideColor(world)).toBe(
        WORLD_THEMES[theme].obby.platformSide,
      );
      expect(world.getObjectByName("route-grass")).toBeUndefined();
      expect(world.getObjectByName("route-flowers")).toBeUndefined();
      expect(world.getObjectByName("route-particles")).toBeUndefined();
      expect(world.getObjectByName("outdoor-hill-1")).toBeUndefined();

      const scenery = pendingScenery(world, theme);
      expect(scenery.userData).toMatchObject({
        worldTheme: theme,
        environmentKitState: "pending-kit",
      });
      expect(
        scenery.children.every((child) => child instanceof THREE.InstancedMesh),
      ).toBe(true);
      expect(scenery.children.length).toBeLessThanOrEqual(
        theme === "arcade" ? 6 : 5,
      );
      for (const child of scenery.children) {
        const instances = child as THREE.InstancedMesh;
        if (child.name === "arcade-warm-string-lights") {
          const highestSurface = Math.max(
            ...level.course!.platforms.map(
              (platform) => platform.center.y + platform.size.y / 2,
            ),
          );
          for (const position of instancePositions(instances))
            expect(position.y).toBeGreaterThan(highestSurface + 2.8);
        } else if (
          child.name.includes("floor") ||
          child.name.includes("playmat") ||
          child.name.includes("guidance")
        ) {
          expectOnCourseSurface(instances, level);
        } else {
          expectOffCourse(instances, level);
        }
      }
      scene.dispose();
    },
  );

  it("builds recognizable bounded arcade placeholders", () => {
    const { scene } = previewFor("arcade");
    const scenery = pendingScenery(worldOf(scene), "arcade");
    expect(scenery.children.map((child) => [child.name, child.count])).toEqual([
      ["arcade-cabinet-silhouettes", 36],
      ["arcade-cabinet-honey-screens", 12],
      ["arcade-cabinet-cherry-controls", 24],
      ["arcade-warm-string-lights", 27],
      ["arcade-plum-floor-tiles", 112],
      ["arcade-honey-route-guidance", 26],
    ]);
    const silhouettes = scenery.getObjectByName(
      "arcade-cabinet-silhouettes",
    ) as THREE.InstancedMesh;
    const nearSpawn = instancePositions(silhouettes).filter(
      (position) => position.z > -2,
    );
    expect(nearSpawn).toHaveLength(6);
    expect(nearSpawn.every((position) => Math.abs(position.x) < 8)).toBe(true);
    const screens = scenery.getObjectByName(
      "arcade-cabinet-honey-screens",
    ) as THREE.InstancedMesh;
    const screenMaterial = screens.material as THREE.MeshStandardMaterial;
    expect(screenMaterial.emissive.getHex()).toBe(
      WORLD_THEMES.arcade.palette.light,
    );
    expect(screenMaterial.color.getHex()).not.toBe(
      WORLD_THEMES.arcade.palette.light,
    );
    scene.dispose();
  });

  it("builds bounded toybox block towers and honey accents", () => {
    const { scene } = previewFor("toybox");
    const scenery = pendingScenery(worldOf(scene), "toybox");
    expect(scenery.children.map((child) => [child.name, child.count])).toEqual([
      ["toybox-soft-blocks-peach", 16],
      ["toybox-soft-blocks-blue", 8],
      ["toybox-honey-accents", 8],
      ["toybox-blue-playmat-tiles", 92],
      ["toybox-honey-route-guidance", 26],
    ]);
    const peach = scenery.getObjectByName(
      "toybox-soft-blocks-peach",
    ) as THREE.InstancedMesh;
    expect(
      instancePositions(peach).some(
        (position) => position.z > -2 && Math.abs(position.x) < 8,
      ),
    ).toBe(true);
    scene.dispose();
  });

  it.each([
    ["garden-playground-v2", "garden"],
    ["besties-playground-v2", "party"],
  ] as const)(
    "keeps published %s on its existing %s asset paths",
    (routeId, theme) => {
      const scene = publishedScene(routeId);
      const requested = [...harness.attached, ...harness.instanced];

      for (const url of clearingAssetUrls) expect(requested).toContain(url);
      expect(worldOf(scene).userData).toMatchObject({
        worldTheme: theme,
        environmentKitState: "legacy-runtime",
      });
      expect(firstPlatformSideColor(worldOf(scene))).toBe(
        WORLD_THEMES[theme].obby.platformSide,
      );
      expect(worldOf(scene).getObjectByName("route-grass")).toBeDefined();
      expect(worldOf(scene).getObjectByName("route-flowers")).toBeDefined();
      expect(worldOf(scene).getObjectByName("route-particles")).toBeDefined();
      expect(worldOf(scene).getObjectByName("outdoor-hill-12")).toBeDefined();
      expect(
        worldOf(scene).getObjectByName(
          `${theme}-pending-kit-placeholder-scenery`,
        ),
      ).toBeUndefined();
      scene.dispose();
    },
  );
});
