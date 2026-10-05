import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { CasinoScene } from "../../src/game/casino-scene";
import { planCasinoCollectibles } from "../../src/game/casino-tokens";
import { DecorScene } from "../../src/game/decor-scene";
import { storybookPlantingKit } from "../../src/game/scene-catalog";
import type { LevelLayout } from "../../src/game/level";
import { SceneAssets } from "../../src/game/scene-assets";
import {
  CASINO_TRAIL_LOOK,
  courseFog,
  THEME_KITS,
  themeKitFor,
} from "../../src/game/theme-kits";
import { TokenScene } from "../../src/game/token-scene";
import { WORLD_THEMES } from "../../src/game/world-themes";
import { AUTHORED_LEVEL_V4_ONLY_THEMES, type AuthoredDecor } from "../../src/shared/authored-level";
import { resolveLevelEditorProject } from "../../src/shared/editor-project";
import { decorWorldBounds, THEME_KIT_PROPS, themeKitProp, themeKitPropsFor } from "../../src/shared/theme-kits";

const demo = resolveLevelEditorProject(
  JSON.parse(
    readFileSync(
      new URL("../../scripts/levels/examples/vertical-v4-demo.project.json", import.meta.url),
      "utf8",
    ),
  ),
);
const route = demo.levels["chapter-2-route"]!;

describe("theme-kit registry (DESIGN-025 D-05)", () => {
  it("registers every world theme with its existing world entry and the shared props", () => {
    expect(Object.keys(THEME_KITS).sort()).toEqual(Object.keys(WORLD_THEMES).sort());
    // The original themes keep their fog; the v4 era themes see further.
    const eraThemes: readonly string[] = AUTHORED_LEVEL_V4_ONLY_THEMES;
    for (const kit of Object.values(THEME_KITS)) {
      expect(kit.world).toBe(WORLD_THEMES[kit.id]);
      expect(kit.fog).toEqual(eraThemes.includes(kit.id) ? { near: 30, far: 95 } : { near: 20, far: 52 });
      expect(kit.props).toEqual(THEME_KIT_PROPS.filter((prop) => prop.theme === kit.id));
    }
  });

  it("gives every v4 course the era fog whatever its theme, and earlier courses their theme's fog", () => {
    // World B's Big Stage keeps the party theme (R13) and World A's finale the
    // casino theme; on a v4 course their tall finales must read from afar.
    for (const kit of Object.values(THEME_KITS)) {
      expect(courseFog(kit, { schemaVersion: "authored-level-v4" })).toEqual({ near: 30, far: 95 });
      for (const schemaVersion of ["authored-level-v1", "authored-level-v2", "authored-level-v3"])
        expect(courseFog(kit, { schemaVersion })).toBe(kit.fog);
      expect(courseFog(kit, undefined)).toBe(kit.fog);
    }
  });

  it("makes the Rat Casino's scenery a registry entry", () => {
    const casino = themeKitFor("casino");
    expect(casino.trail).toBe(CASINO_TRAIL_LOOK);
    expect(casino.exitGate?.url).toBe("/studio/assets/media/rat-casino-kit/v001/marquee-arch.glb");
    const assets = { attach: () => undefined, attachInstances: () => undefined } as unknown as SceneAssets;
    const level = {
      course: route.course,
      authored: route.document,
      checkpoint: route.anchors.spawn.position,
      finish: route.anchors.finish.position,
      memories: [],
      pickups: [],
      encounters: [],
      friendlies: [],
    } as unknown as LevelLayout;
    const scenery = casino.scenery!({
      level,
      save: { adventure: null } as never,
      assets,
      valid: () => true,
    });
    expect(scenery).toBeInstanceOf(CasinoScene);
    for (const theme of ["garden", "party", "arcade", "toybox"] as const)
      expect(themeKitFor(theme).scenery).toBeNull();
  });
});

describe("placed decor rendering", () => {
  it("loads the reviewed planting GLBs for actual A8 decor and hides their stand-ins", () => {
    const expected = [
      ["broad-canopy-tree", "storybook-canopy-tree.glb", "c37b8ebd55c7bcf31c9db769f974c465df26a5502b6da702ade17f34b74008a4"],
      ["slim-cypress", "storybook-cypress.glb", "4446ad06c4e3ccd09cd8cef61471453eb54291f4e578a0d020b4a4ce025248a1"],
      ["flowering-shrub", "storybook-flowering-shrub.glb", "5d01c42466237fd3dea99509eb762660955b22e40988b152baf71970a2644d2c"],
    ] as const;
    const project = JSON.parse(readFileSync(new URL("../../src/shared/levels/family-world-a-v8.json", import.meta.url), "utf8")) as {
      chapters: Array<{ chapterId: string; level: { decor: AuthoredDecor[] } }>;
    };
    const inspection = JSON.parse(readFileSync(new URL("../../docs/assets/media/storybook-planting-kit/v001/three-inspection.json", import.meta.url), "utf8")) as {
      props: Record<string, { bounds_y_up: { min: [number, number, number]; max: [number, number, number] } }>;
    };
    const a1 = project.chapters.find((chapter) => chapter.chapterId === "family-a1")!;
    const planting = a1.level.decor.filter((entry) =>
      expected.some(([id]) => entry.kitPropId === id) ||
      entry.kitPropId === "storybook-flower-bed" || entry.kitPropId === "storybook-planter-island");
    const requests: Array<{ url: string; count: number }> = [];
    const assets = {
      attachInstances: (url: string, target: THREE.Object3D, matrices: readonly THREE.Matrix4[]) => {
        requests.push({ url, count: matrices.length });
        target.add(new THREE.Group()); // completed load, as SceneAssets does
      },
    };
    const scene = new DecorScene(planting, assets, () => true);
    scene.update();
    for (const [id, filename, sha256] of expected) {
      const prop = themeKitProp(id)!;
      const url = `/studio/assets/media/storybook-planting-kit/v001/${filename}`;
      expect(prop.glb).toEqual({ url, sha256 });
      expect(storybookPlantingKit[id].url).toBe(url);
      const file = new URL(`../../docs${url.replace("/studio", "")}`, import.meta.url);
      expect(createHash("sha256").update(readFileSync(file)).digest("hex")).toBe(sha256);
      const measured = inspection.props[filename.slice(0, -4)]!.bounds_y_up;
      const registeredMin = [prop.bounds.min.x, prop.bounds.min.y, prop.bounds.min.z];
      const registeredMax = [prop.bounds.max.x, prop.bounds.max.y, prop.bounds.max.z];
      for (let axis = 0; axis < 3; axis++) {
        expect(registeredMin[axis]!, `${id} min ${axis}`).toBeLessThanOrEqual(measured.min[axis]!);
        expect(registeredMax[axis]!, `${id} max ${axis}`).toBeGreaterThanOrEqual(measured.max[axis]!);
      }
      expect(requests).toContainEqual({
        url,
        count: planting.filter((entry) => entry.kitPropId === id).length,
      });
      expect(scene.root.getObjectByName(`decor-fallback-${id}`)?.visible).toBe(false);
    }
    expect(requests).toHaveLength(3);
    expect(scene.root.getObjectByName("decor-fallback-storybook-flower-bed")?.visible).toBe(true);
    expect(scene.root.getObjectByName("decor-fallback-storybook-planter-island")?.visible).toBe(true);
  });

  it("draws procedural stand-ins sized to each prop and swaps in a loaded model", () => {
    const requests: Array<{ url: string; matrices: readonly THREE.Matrix4[]; target: THREE.Object3D }> = [];
    const assets = {
      attachInstances: (url: string, target: THREE.Object3D, matrices: readonly THREE.Matrix4[]) =>
        requests.push({ url, matrices, target }),
    };
    const decor = [
      { id: "a", kitPropId: "casino-slot-cabinet", position: { x: 1, y: 0, z: 2 }, rotationY: 0, scale: 1 },
      { id: "b", kitPropId: "casino-slot-cabinet", position: { x: 4, y: 0, z: 2 }, rotationY: 1, scale: 2 },
      { id: "c", kitPropId: "garden-hedge", position: { x: 0, y: 0, z: 9 }, rotationY: 0, scale: 1 },
    ];
    const scene = new DecorScene(decor, assets, () => true);
    const fallback = scene.root.getObjectByName("decor-fallback-casino-slot-cabinet")!;
    const meshes = fallback.children as THREE.InstancedMesh[];
    expect(meshes.every((mesh) => mesh.count === 2)).toBe(true);
    // The stand-in body fills the catalog bounds at the placement.
    const matrix = new THREE.Matrix4();
    meshes[0]!.getMatrixAt(0, matrix);
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    matrix.decompose(position, new THREE.Quaternion(), scale);
    expect(scale.x).toBeCloseTo(0.517 * 2, 6);
    expect(position.x).toBeCloseTo(1, 6);
    expect(requests.map((request) => request.url)).toEqual([
      "/studio/assets/media/rat-casino-kit/v001/slot-cabinet.glb",
    ]);
    expect(requests[0]!.matrices).toHaveLength(2);
    // A procedural-only prop never requests a model.
    expect(scene.root.getObjectByName("decor-fallback-garden-hedge")).toBeDefined();
    scene.update();
    expect(fallback.visible).toBe(true);
    requests[0]!.target.add(new THREE.Group());
    scene.update();
    expect(fallback.visible).toBe(false);
  });

  it.each([
    { theme: "clubhouse" as const, kit: "toon-clubhouse-kit", missing: "stage-marker" },
    { theme: "playroom" as const, kit: "playroom-kit", missing: "giant-plush-ball" },
  ])("swaps in the exact $kit models inside their bounds and keeps a stand-in for a missing one", async ({ theme, kit, missing }) => {
    // The real SceneAssets parses the published GLB bytes; one file is missing.
    const load = vi
      .spyOn(GLTFLoader.prototype, "loadAsync")
      .mockImplementation(async function (this: GLTFLoader, url: string) {
        if (url.endsWith(`/${missing}.glb`)) throw new Error(`404 ${url}`);
        const bytes = readFileSync(new URL(`../../docs${url.replace("/studio", "")}`, import.meta.url));
        return this.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
      });
    const assets = new SceneAssets();
    const props = themeKitPropsFor(theme);
    const decor = props.flatMap((prop, index) => [
      { id: `${prop.id}-a`, kitPropId: prop.id, position: { x: index * 12, y: 0, z: 0 }, rotationY: 0, scale: 1 },
      { id: `${prop.id}-b`, kitPropId: prop.id, position: { x: index * 12, y: 0.5, z: -9 }, rotationY: Math.PI / 2, scale: 2.2 },
    ]);
    const scene = new DecorScene(decor, assets, () => true);
    expect(load.mock.calls.map(([url]) => url)).toEqual(
      props.map((prop) => `/studio/assets/media/${kit}/v001/${prop.id}.glb`),
    );
    await vi.waitFor(() => {
      for (const prop of props)
        if (prop.id !== missing)
          expect(scene.root.getObjectByName(`decor-model-${prop.id}`)!.children, prop.id).toHaveLength(1);
      expect(assets.getState()).toEqual({ loading: 0, failed: 1 });
    });
    scene.update();
    for (const prop of props) {
      const fallback = scene.root.getObjectByName(`decor-fallback-${prop.id}`)!;
      const model = scene.root.getObjectByName(`decor-model-${prop.id}`)!;
      if (prop.id === missing) {
        expect(fallback.visible).toBe(true);
        expect(model.children).toHaveLength(0);
        continue;
      }
      expect(fallback.visible, prop.id).toBe(false);
      // Every placed instance stays inside the registered box at its placement.
      model.updateMatrixWorld(true);
      const meshes: THREE.InstancedMesh[] = [];
      model.traverse((object) => {
        if (object instanceof THREE.InstancedMesh) meshes.push(object);
      });
      expect(meshes.length, prop.id).toBeGreaterThan(0);
      for (const [instance, entry] of decor.filter((candidate) => candidate.kitPropId === prop.id).entries()) {
        const placed = new THREE.Box3();
        for (const mesh of meshes) {
          mesh.geometry.computeBoundingBox();
          const matrix = new THREE.Matrix4();
          mesh.getMatrixAt(instance, matrix);
          placed.union(mesh.geometry.boundingBox!.clone().applyMatrix4(matrix.premultiply(mesh.matrixWorld)));
        }
        const allowed = decorWorldBounds(prop.bounds, entry);
        expect(placed.min.x, `${entry.id} min x`).toBeGreaterThanOrEqual(allowed.min.x - 1e-4);
        expect(placed.min.y, `${entry.id} min y`).toBeGreaterThanOrEqual(allowed.min.y - 1e-4);
        expect(placed.min.z, `${entry.id} min z`).toBeGreaterThanOrEqual(allowed.min.z - 1e-4);
        expect(placed.max.x, `${entry.id} max x`).toBeLessThanOrEqual(allowed.max.x + 1e-4);
        expect(placed.max.y, `${entry.id} max y`).toBeLessThanOrEqual(allowed.max.y + 1e-4);
        expect(placed.max.z, `${entry.id} max z`).toBeLessThanOrEqual(allowed.max.z + 1e-4);
      }
    }
    assets.dispose();
    load.mockRestore();
  });

  it("skips unknown props rather than breaking the scene", () => {
    const scene = new DecorScene(
      [{ id: "x", kitPropId: "missing", position: { x: 0, y: 0, z: 0 }, rotationY: 0, scale: 1 }],
      { attachInstances: () => undefined },
      () => true,
    );
    expect(scene.root.children).toHaveLength(0);
  });
});

describe("themed collectible trails on v4 levels", () => {
  it("plans a trail and the golden collectible on the optional ability route", () => {
    const plan = planCasinoCollectibles({ authored: route.document, course: route.course });
    expect(plan).not.toBeNull();
    expect(plan!.tokens.length).toBeGreaterThan(20);
    expect(plan!.tickets.map((ticket) => ticket.platformId)).toContain("golden-perch");
    // Lifts, pads and crumbling platforms carry no trail of their own.
    const skipped = new Set(["sky-lift", "spring-pad", "crumble-a", "crumble-b"]);
    expect(plan!.tokens.filter((token) => token.role === "trail" && skipped.has(token.platformId))).toEqual([]);
  });

  it("keeps v3 non-casino levels trail-free", () => {
    const v3 = { ...route.document, schemaVersion: "authored-level-v3" as const };
    expect(planCasinoCollectibles({ authored: v3, course: route.course })).toBeNull();
  });

  it("draws the theme's trail colours and keeps the casino look by default", () => {
    const plan = planCasinoCollectibles({ authored: route.document, course: route.course })!;
    const colour = (scene: TokenScene) =>
      ((scene.root.getObjectByName("casino-token-discs") as THREE.InstancedMesh).material as THREE.MeshStandardMaterial).color.getHex();
    expect(colour(new TokenScene(plan))).toBe(CASINO_TRAIL_LOOK.disc);
    expect(colour(new TokenScene(plan, new Set(), themeKitFor("party").trail))).toBe(
      themeKitFor("party").trail.disc,
    );
  });
});
