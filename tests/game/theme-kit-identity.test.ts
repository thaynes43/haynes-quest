// @vitest-environment jsdom

/**
 * DESIGN-025 D-05 requires the theme-kit registry refactor to leave the Rat
 * Casino (and every existing theme) rendering identically. With the same
 * renderer, identical output follows from an identical scene: this test
 * builds each world with the real GardenScene (fake WebGL and asset loader),
 * fingerprints every object's name, type, transform, visibility, geometry,
 * material, instance matrices and light, plus the background, fog, exposure
 * and every asset request with its placements, and compares the SHA-256 with
 * the value recorded from the pre-registry code on main at 32cee46.
 */
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import {
  AUTHORED_LEVEL_SCHEMA_VERSION_V3,
  type AuthoredLevelDocument,
  type AuthoredLevelTheme,
  type ResolvedAuthoredLevel,
} from "../../src/shared/authored-level";
import type { SaveView } from "../../src/shared/contracts";
import { resolveLevelEditorProject } from "../../src/shared/editor-project";
import ratCasinoProject from "../../src/shared/levels/rat-casino-world-v2.json";
import { makeAuthoredSave } from "./authored-fixtures";

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
  const round = (value: number) => Math.round(value * 1e6) / 1e6;
  class FakeSceneAssets {
    attach(url: string, target: THREE.Object3D): void {
      harness.requests.push(`attach ${url} -> ${target.name}`);
    }
    attachInstances(url: string, target: THREE.Object3D, matrices: readonly THREE.Matrix4[]): void {
      harness.requests.push(
        `instances ${url} -> ${target.name} ${JSON.stringify(matrices.map((matrix) => matrix.elements.map(round)))}`,
      );
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
import { GardenScene } from "../../src/game/scene";

const round = (value: number) => Math.round(value * 1e6) / 1e6;

function describeMaterial(material: THREE.Material): unknown {
  const record = material as unknown as Record<string, unknown>;
  const color = (key: string) =>
    record[key] instanceof THREE.Color ? (record[key] as THREE.Color).getHex() : null;
  return [
    material.type,
    color("color"),
    color("emissive"),
    record.emissiveIntensity ?? null,
    record.roughness ?? null,
    record.metalness ?? null,
    material.opacity,
    material.transparent,
    material.side,
    material.depthWrite,
    record.vertexColors ?? null,
  ];
}

function fingerprint(scene: GardenScene): string {
  const internals = scene as unknown as {
    scene: THREE.Scene;
    renderer: { toneMappingExposure: number };
  };
  const root = internals.scene;
  const nodes: unknown[] = [];
  root.traverse((node) => {
    const entry: Record<string, unknown> = {
      name: node.name,
      type: node.type,
      position: node.position.toArray().map(round),
      quaternion: node.quaternion.toArray().map(round),
      scale: node.scale.toArray().map(round),
      visible: node.visible,
      userData: JSON.stringify(node.userData),
      children: node.children.length,
    };
    if (node instanceof THREE.Mesh || node instanceof THREE.Points || node instanceof THREE.Line) {
      const geometry = node.geometry as THREE.BufferGeometry & { parameters?: unknown };
      entry.geometry = [
        geometry.type,
        JSON.stringify(geometry.parameters ?? null, (key, value) => (key === "uuid" ? undefined : value)),
      ];
      const position = geometry.getAttribute("position");
      if (position) entry.vertices = createHash("sha256").update(Buffer.from((position.array as Float32Array).buffer)).digest("hex");
      const color = geometry.getAttribute("color");
      if (color) entry.colors = createHash("sha256").update(Buffer.from((color.array as Float32Array).buffer)).digest("hex");
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      entry.materials = materials.map(describeMaterial);
      entry.shadow = [node.castShadow, node.receiveShadow, node.frustumCulled];
    }
    if (node instanceof THREE.InstancedMesh) {
      entry.count = node.count;
      entry.instances = createHash("sha256")
        .update(JSON.stringify(Array.from(node.instanceMatrix.array, round)))
        .digest("hex");
    }
    if (node instanceof THREE.Light) entry.light = [node.color.getHex(), round(node.intensity)];
    nodes.push(entry);
  });
  const fog = root.fog as THREE.Fog | null;
  const summary = {
    background: root.background instanceof THREE.Color ? root.background.getHex() : null,
    fog: fog ? [fog.color.getHex(), fog.near, fog.far] : null,
    exposure: internals.renderer.toneMappingExposure,
    nodes,
    requests: harness.requests,
  };
  return createHash("sha256").update(JSON.stringify(summary)).digest("hex");
}

function ratCasinoScene(): GardenScene {
  const resolved = resolveLevelEditorProject(ratCasinoProject);
  const route = resolved.levels["rat-casino-v2"]!;
  const save = structuredClone(makeAuthoredSave({ routeId: "besties-playground-v2" })) as SaveView;
  const active = save.adventure!.activeLevel!;
  active.routeId = "rat-casino-v2";
  active.periodId = "rat-casino-v1";
  // The v2 route carries Golden's optional side-stage slot.
  const ordinary = active.encounters.find((entry) => entry.role === "ordinary")!;
  active.encounters.push({
    ...structuredClone(ordinary),
    id: "identity-bonus-golden",
    kind: route.anchors.encounters["bonus-1"]!.kind,
    content: {
      catalogEntryId: "golden-after-hours-rat",
      catalogEntryVersion: "v001",
      assetId: "golden-after-hours-rat",
      assetVersion: "v001",
    },
  });
  active.optionalEncounterIds = ["identity-bonus-golden"];
  const level = createLevelLayout(save, authoredLevelResolverFor({ "rat-casino-v2": route }));
  return new GardenScene(document.createElement("div"), level, save);
}

function themedScene(theme: AuthoredLevelTheme): GardenScene {
  const source = authoredRoute("garden-playground-v2")!;
  const document_: AuthoredLevelDocument = {
    ...source.document,
    schemaVersion: AUTHORED_LEVEL_SCHEMA_VERSION_V3,
    id: "identity-preview",
    theme,
  };
  const route: ResolvedAuthoredLevel = { ...source, document: document_ };
  const save = structuredClone(makeAuthoredSave({ routeId: "garden-playground-v2" })) as SaveView;
  save.adventure!.activeLevel!.routeId = "identity-preview";
  const level = createLevelLayout(save, authoredLevelResolverFor({ "identity-preview": route }));
  return new GardenScene(document.createElement("div"), level, save);
}

function publishedScene(routeId: "garden-playground-v2" | "besties-playground-v2"): GardenScene {
  const save = makeAuthoredSave({ routeId });
  return new GardenScene(document.createElement("div"), createLevelLayout(save), save);
}

/** Recorded from the pre-registry scene code (main at 32cee46). */
const EXPECTED: Record<string, string> = {
  "rat-casino-v2": "9419d4dc36f9a9cd37f85d6f0417eb37132945ee9a2a9a9d6520655b35497802",
  "theme-garden": "6d772a99310fe79794b75e56948f10a4cb9ee083815ecd186c22e6262e97d751",
  "theme-party": "3b6b7742dbf7f8e45e4d01a562ed0636e408392b027800d1977aab6b577db29c",
  "theme-arcade": "759dcedbbd1bd95efb4711ad987d59d88d032241aeac45a78151f36e235863cf",
  "theme-toybox": "5d7fecad433b49ad099d96367f0cfd36f155a1467fe5f07dde904110ce509081",
  "theme-casino": "4198334c2798306006e8717745bf4a235f93c1507ad2ff5f9dd2047a7d41eb12",
  "garden-playground-v2": "6d772a99310fe79794b75e56948f10a4cb9ee083815ecd186c22e6262e97d751",
  "besties-playground-v2": "9aa460ca28752f65b585ff2d146195fe954fa4af06d66119b42e0680f01d34d1",
};

const builders: Record<string, () => GardenScene> = {
  "rat-casino-v2": ratCasinoScene,
  "theme-garden": () => themedScene("garden"),
  "theme-party": () => themedScene("party"),
  "theme-arcade": () => themedScene("arcade"),
  "theme-toybox": () => themedScene("toybox"),
  "theme-casino": () => themedScene("casino"),
  "garden-playground-v2": () => publishedScene("garden-playground-v2"),
  "besties-playground-v2": () => publishedScene("besties-playground-v2"),
};

describe("theme-kit registry keeps existing worlds scene-identical", () => {
  it.each(Object.keys(builders))("%s", (name) => {
    harness.requests.length = 0;
    const scene = builders[name]!();
    const actual = fingerprint(scene);
    scene.dispose();
    if (process.env.PRINT_SCENE_FINGERPRINTS) console.log(`FINGERPRINT ${name} ${actual}`);
    expect(actual).toBe(EXPECTED[name]);
  });
});
