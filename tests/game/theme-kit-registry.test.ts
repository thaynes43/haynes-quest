import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { CasinoScene } from "../../src/game/casino-scene";
import { planCasinoCollectibles } from "../../src/game/casino-tokens";
import { DecorScene } from "../../src/game/decor-scene";
import type { LevelLayout } from "../../src/game/level";
import type { SceneAssets } from "../../src/game/scene-assets";
import {
  CASINO_TRAIL_LOOK,
  THEME_KITS,
  themeKitFor,
} from "../../src/game/theme-kits";
import { TokenScene } from "../../src/game/token-scene";
import { WORLD_THEMES } from "../../src/game/world-themes";
import { resolveLevelEditorProject } from "../../src/shared/editor-project";
import { THEME_KIT_PROPS } from "../../src/shared/theme-kits";

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
    for (const kit of Object.values(THEME_KITS)) {
      expect(kit.world).toBe(WORLD_THEMES[kit.id]);
      expect(kit.fog).toEqual({ near: 20, far: 52 });
      expect(kit.props).toEqual(THEME_KIT_PROPS.filter((prop) => prop.theme === kit.id));
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
