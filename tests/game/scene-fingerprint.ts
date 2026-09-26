/**
 * Scene fingerprints for "renders identically" tests (DESIGN-025 D-05,
 * DESIGN-027 scare level 0): every object's name, type, transform, visibility,
 * geometry, material, instance matrices and light, plus the background, fog,
 * exposure and every asset request with its placements, hashed with SHA-256.
 * Callers mock `three`'s renderer and the scene asset loader themselves.
 */
import { createHash } from "node:crypto";
import * as THREE from "three";
import type { GardenScene } from "../../src/game/scene";

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

export function sceneFingerprint(scene: GardenScene, requests: readonly string[]): string {
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
    requests,
  };
  return createHash("sha256").update(JSON.stringify(summary)).digest("hex");
}

