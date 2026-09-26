// @vitest-environment jsdom

/**
 * The family-world era themes render with no automatic scenery: no clearing
 * trees, stones, path tiles, hills or meadow and no placeholder props, only
 * the course, the pending finish marker, their era fog and any placed decor
 * (including shared GLB props).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import {
  AUTHORED_LEVEL_SCHEMA_VERSION_V4,
  AUTHORED_LEVEL_V4_ONLY_THEMES,
  type AuthoredLevelDocument,
  type AuthoredLevelTheme,
  type ResolvedAuthoredLevel,
} from "../../src/shared/authored-level";
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
  return { ...actual, WebGLRenderer: FakeRenderer, PMREMGenerator: FakePmremGenerator };
});

vi.mock("../../src/game/scene-assets", async () => {
  const actual = await vi.importActual<typeof import("../../src/game/scene-assets")>(
    "../../src/game/scene-assets",
  );
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

import { authoredLevelResolverFor, authoredRoute } from "../../src/game/authored-layout";
import { createLevelLayout } from "../../src/game/level";
import { modelUrls } from "../../src/game/scene-assets";
import { GardenScene } from "../../src/game/scene";
import { WORLD_THEMES } from "../../src/game/world-themes";

const routeId = "private-era-theme-preview";

function v4Route(theme: AuthoredLevelTheme): ResolvedAuthoredLevel {
  const source = authoredRoute("garden-playground-v2");
  if (!source) throw new Error("Published garden fixture is unavailable");
  const document: AuthoredLevelDocument = {
    ...source.document,
    schemaVersion: AUTHORED_LEVEL_SCHEMA_VERSION_V4,
    id: routeId,
    theme,
    decor: [
      { id: "era-tree", kitPropId: "clearing-tree", position: { x: 20, y: 0, z: -10 }, rotationY: 0, scale: 1 },
      { id: "era-prop", kitPropId: "water-tower", position: { x: -20, y: 0, z: -10 }, rotationY: 0, scale: 1 },
    ],
  };
  return { ...source, document };
}

function sceneFor(theme: AuthoredLevelTheme): GardenScene {
  const save: SaveView = structuredClone(makeAuthoredSave({ routeId: "garden-playground-v2" }));
  if (!save.adventure?.activeLevel) throw new Error("Authored fixture needs an active level");
  save.adventure.activeLevel.routeId = routeId;
  const level = createLevelLayout(save, authoredLevelResolverFor({ [routeId]: v4Route(theme) }));
  return new GardenScene(document.createElement("div"), level, save);
}

function internals(scene: GardenScene) {
  return scene as unknown as { scene: THREE.Scene; world: THREE.Group };
}

describe("era theme scenes", () => {
  beforeEach(() => {
    harness.attached.length = 0;
    harness.instanced.length = 0;
  });

  it.each(AUTHORED_LEVEL_V4_ONLY_THEMES)("draws %s with era fog, decor and no automatic scenery", (theme) => {
    const scene = sceneFor(theme);
    try {
      const { scene: root, world } = internals(scene);
      expect(world.userData.worldTheme).toBe(theme);
      expect(world.userData.environmentKitState).toBe("pending-kit");
      const fog = root.fog as THREE.Fog;
      expect([fog.near, fog.far]).toEqual([30, 95]);
      expect((root.background as THREE.Color).getHex()).toBe(WORLD_THEMES[theme].course.sky);
      const names: string[] = [];
      world.traverse((node) => names.push(node.name));
      expect(names.some((name) => name.startsWith("outdoor-hill"))).toBe(false);
      for (const meadow of ["route-grass", "route-flowers", "route-particles"])
        expect(names).not.toContain(meadow);
      // The pending scenery root exists but holds no placeholder props.
      const pending = world.getObjectByName(`${theme}-pending-kit-placeholder-scenery`)!;
      expect(pending.children).toHaveLength(0);
      expect(world.getObjectByName(`${theme}-pending-kit-fallback`)).toBeDefined();
      // No clearing kit is auto-placed; only the placed shared tree loads a model.
      const clearing: readonly string[] = [modelUrls.path, modelUrls.stone, modelUrls.gate];
      expect([...harness.attached, ...harness.instanced].filter((url) => clearing.includes(url))).toEqual([]);
      expect(harness.instanced.filter((url) => url === modelUrls.tree)).toEqual([modelUrls.tree]);
      const decor = world.getObjectByName("theme-kit-decor")!;
      expect(decor.getObjectByName("decor-fallback-water-tower")).toBeDefined();
      expect(decor.getObjectByName("decor-model-clearing-tree")).toBeDefined();
    } finally {
      scene.dispose();
    }
  });
});
