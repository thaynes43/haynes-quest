import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { ObbyScene } from "../../src/game/obby-scene";
import { sampleObby, type ObbyCourse } from "../../src/game/obby";
import { disposeTree } from "../../src/game/scene-assets";
import { WORLD_THEMES } from "../../src/game/world-themes";

const course: ObbyCourse = {
  platforms: [
    { id: "fixed", center: { x: 0, y: -0.4, z: 0 }, size: { x: 4, y: 0.8, z: 6 } },
    { id: "moving", center: { x: 7, y: 1, z: 0 }, size: { x: 3, y: 0.6, z: 4 },
      motion: { axis: "x", distance: 1.5, period: 2 } },
    { id: "fragile", center: { x: 0, y: 1, z: -9 }, size: { x: 2.5, y: 0.5, z: 3 },
      crumble: { shakeSeconds: 0.2, downSeconds: 1 } },
  ],
  hazards: [],
  checkpoints: [],
};

function triangleSignatures(geometry: THREE.BufferGeometry, topGroup: number): string[] {
  const index = geometry.getIndex()!;
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");
  const signatures: string[] = [];
  for (const group of geometry.groups) {
    const finish = group.materialIndex === topGroup ? "top" : "side";
    for (let offset = group.start; offset < group.start + group.count; offset += 3) {
      const vertices: string[] = [];
      for (let corner = 0; corner < 3; corner++) {
        const vertex = index.getX(offset + corner);
        vertices.push([
          position.getX(vertex), position.getY(vertex), position.getZ(vertex),
          normal.getX(vertex), normal.getY(vertex), normal.getZ(vertex),
          uv.getX(vertex), uv.getY(vertex),
        ].join(","));
      }
      signatures.push(`${finish}:${vertices.join("|")}`);
    }
  }
  return signatures.sort();
}

describe("ObbyScene slab draw groups", () => {
  it("keeps every original triangle, normal, UV and face material with two groups", () => {
    const scene = new ObbyScene(course, WORLD_THEMES.clubhouse.obby);
    for (const platform of course.platforms) {
      const group = scene.root.getObjectByName(`platform-${platform.id}`) as THREE.Group;
      const floor = group.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.Material[]>;
      const old = new THREE.BoxGeometry(platform.size.x, platform.size.y, platform.size.z);
      expect(floor.geometry.groups).toHaveLength(2);
      expect(floor.material).toHaveLength(2);
      expect(floor.geometry.groups.map(({ count }) => count)).toEqual([30, 6]);
      expect(triangleSignatures(floor.geometry, 1)).toEqual(triangleSignatures(old, 2));
      const top = floor.geometry.groups[1]!;
      const indices = floor.geometry.getIndex()!;
      const normals = floor.geometry.getAttribute("normal");
      const positions = floor.geometry.getAttribute("position");
      for (let offset = top.start; offset < top.start + top.count; offset++) {
        const vertex = indices.getX(offset);
        expect(normals.getY(vertex)).toBe(1);
        expect(positions.getY(vertex)).toBeCloseTo(platform.size.y / 2);
      }
      old.dispose();
    }
    disposeTree(scene.root);
  });

  it("keeps moving and crumbling slabs as individual updated meshes and disposes resources once", () => {
    const scene = new ObbyScene(course, WORLD_THEMES.clubhouse.obby);
    const moving = scene.root.getObjectByName("platform-moving") as THREE.Group;
    const fragile = scene.root.getObjectByName("platform-fragile") as THREE.Group;
    const movingFloor = moving.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.Material[]>;
    const fragileFloor = fragile.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.Material[]>;
    const geometryDispose = vi.spyOn(movingFloor.geometry, "dispose");
    const sideDispose = vi.spyOn(movingFloor.material[0]!, "dispose");
    const topDispose = vi.spyOn(movingFloor.material[1]!, "dispose");
    const sample = sampleObby(course, 0.3, { crumbles: { fragile: 0 } });
    scene.update(sample, null, 0.3);
    expect(moving.position.x).toBeCloseTo(sample.platforms.find((p) => p.id === "moving")!.center.x);
    expect(fragile.position.y).toBeCloseTo(sample.platforms.find((p) => p.id === "fragile")!.center.y);
    expect(moving.children[0]).toBe(movingFloor);
    expect(fragile.children[0]).toBe(fragileFloor);
    disposeTree(scene.root);
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(sideDispose).toHaveBeenCalledOnce();
    expect(topDispose).toHaveBeenCalledOnce();
  });
});
