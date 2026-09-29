// @vitest-environment jsdom

/**
 * DESIGN-025 D-05 requires the theme-kit registry refactor to leave the Rat
 * Casino (and every existing theme) rendering identically. With the same
 * renderer, identical output follows from an identical scene: this test
 * builds each world with the real GardenScene (fake WebGL and asset loader),
 * fingerprints every object's name, type, transform, visibility, geometry,
 * material, instance matrices and light, plus the background, fog, exposure
 * and every asset request with its placements, and compares the SHA-256 with
 * the value recorded after DESIGN-028 replaced the shared spinning attack
 * ring with separate forward strikes. The pre-registry baseline is in git
 * history at 32cee46.
 */
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
import { sceneFingerprint } from "./scene-fingerprint";

const fingerprint = (scene: GardenScene): string => sceneFingerprint(scene, harness.requests);

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

/** Recorded after DESIGN-028's intentional strike-shape change. */
const EXPECTED: Record<string, string> = {
  "rat-casino-v2": "6107e7c6a50f6e838536acc1ad947b42ad0d4ee0e4cf694c9268a33b4eb1ec00",
  "theme-garden": "340e2648197f9c2b5a86774cef2268395b564035a4f4d714be6f5a98ee277cc0",
  "theme-party": "e21c30ae08ab2e2efcde3feea52f379bf8e1c96278c41e44cec6d9e455bf5b10",
  "theme-arcade": "18700c66db81128694dac615d70d015d01de0d9853598623c90e10b53de315bd",
  "theme-toybox": "ce659258fd724074ff38273e8c64fa9a3a045551720c81615a0bf3cfbb36da3c",
  "theme-casino": "68d294be909030175dc5bf53f923364995f975dc1ea0e8030ee7f082eb941848",
  "garden-playground-v2": "340e2648197f9c2b5a86774cef2268395b564035a4f4d714be6f5a98ee277cc0",
  "besties-playground-v2": "47ff47727f68ef59b09b07eafe4c543109823e8a02dcd87a2cb7715d834bd09f",
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
