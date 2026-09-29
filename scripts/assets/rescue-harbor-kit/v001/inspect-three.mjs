/** WO111 Rescue Harbor v001: exact GLB bounds through GLTFLoader and SceneAssets.
 * node_modules/.bin/tsx scripts/assets/rescue-harbor-kit/v001/inspect-three.mjs <directory-containing-glbs>
 * Exercises every checked-in A2 v5 transform plus representative quarter turns and scales.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SceneAssets } from '../../../../src/game/scene-assets.ts';
import { authoredSurfaceBounds, authoredSurfaceTopRange, isAuthoredSurfacePiece } from '../../../../src/shared/authored-level.ts';
import { decorWorldBounds, themeKitPropsFor } from '../../../../src/shared/theme-kits.ts';

if (!process.argv[2]) throw new Error('Usage: tsx inspect-three.mjs <directory-containing-glbs>');
const root = path.resolve(process.argv[2]);
const ids = ['lookout-tower-facade', 'pier-bollard', 'rescue-buoy-stand', 'small-boat'];
const project = JSON.parse(await readFile(new URL('../../../../src/shared/levels/family-world-a-v5.json', import.meta.url), 'utf8'));
const level = project.chapters.find((chapter) => chapter.chapterId === 'family-a2')?.level;
if (!level) throw new Error('family-world-a-v5 has no A2 level');
const realDecor = level.decor.filter((entry) => ids.includes(entry.kitPropId));
const surfaces = level.pieces.filter(isAuthoredSurfacePiece);
const props = new Map(themeKitPropsFor('harbor').map((prop) => [prop.id, prop]));
const expectedCounts = { 'lookout-tower-facade': 2, 'pier-bollard': 20, 'rescue-buoy-stand': 6, 'small-boat': 12 };

const prefix = '/rescue-harbor-kit/';
THREE.FileLoader.prototype.load = function (url, onLoad, _onProgress, onError) {
  if (!url.startsWith(prefix)) { onError?.(new Error(`Unexpected URL ${url}`)); return; }
  readFile(path.join(root, url.slice(prefix.length)))
    .then((bytes) => onLoad(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)), onError);
};
const assetCache = new SceneAssets();
const pack = (box) => ({
  min: Object.fromEntries(['x', 'y', 'z'].map((axis) => [axis, +box.min[axis].toFixed(5)])),
  max: Object.fromEntries(['x', 'y', 'z'].map((axis) => [axis, +box.max[axis].toFixed(5)])),
});
const inside = (box, limit, tolerance = 1e-4) => ['x', 'y', 'z'].every((axis) =>
  box.min[axis] >= limit.min[axis] - tolerance && box.max[axis] <= limit.max[axis] + tolerance);
const mmOut = (value, low) => (low ? Math.floor(value * 1000 + 1e-3) : Math.ceil(value * 1000 - 1e-3)) / 1000;
const placementMatrix = (entry) => new THREE.Matrix4().compose(
  new THREE.Vector3(entry.position.x, entry.position.y, entry.position.z),
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), entry.rotationY),
  new THREE.Vector3(entry.scale, entry.scale, entry.scale),
);
const boxFromVertices = (meshes, index) => {
  const box = new THREE.Box3();
  const matrix = new THREE.Matrix4();
  const vertex = new THREE.Vector3();
  for (const mesh of meshes) {
    mesh.getMatrixAt(index, matrix);
    matrix.premultiply(mesh.matrixWorld);
    const positions = mesh.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) box.expandByPoint(vertex.fromBufferAttribute(positions, i).applyMatrix4(matrix));
  }
  return box;
};
const falseFootholds = (entry, box) => {
  const problems = [];
  for (const surface of surfaces) {
    const bounds = authoredSurfaceBounds(surface);
    const horizontalDistance = Math.hypot(
      Math.max(0, bounds.minX - box.max.x, box.min.x - bounds.maxX),
      Math.max(0, bounds.minZ - box.max.z, box.min.z - bounds.maxZ),
    );
    if (horizontalDistance >= 2.5) continue;
    const top = authoredSurfaceTopRange(surface);
    if (box.max.y > top.min - 0.5 + 1e-6 && box.max.y < top.max + 1.4 - 1e-6)
      problems.push(surface.id);
  }
  return problems;
};

const results = {};
let allChecksPass = true;
for (const id of ids) {
  const prop = props.get(id);
  if (!prop) throw new Error(`No registry prop ${id}`);
  const filename = `${id}.glb`;
  const bytes = await readFile(path.join(root, filename));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  const sourceMeshes = [];
  gltf.scene.traverse((object) => { if (object.isMesh) sourceMeshes.push(object); });
  const source = new THREE.Box3();
  const point = new THREE.Vector3();
  let triangles = 0;
  for (const mesh of sourceMeshes) {
    const position = mesh.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) source.expandByPoint(point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld));
    triangles += (mesh.geometry.index?.count ?? position.count) / 3;
  }
  const materials = [...new Set(sourceMeshes.flatMap((mesh) => [mesh.material].flat()))];
  const actual = realDecor.filter((entry) => entry.kitPropId === id);
  const probes = [1, 1.25].flatMap((scale) => [0, 1, 2, 3].map((quarter) => ({
    id: `probe-${quarter * 90}-scale-${scale}`, kitPropId: id,
    position: { x: 20 + quarter * 5, y: -1.4, z: -20 - quarter * 5 }, rotationY: quarter * Math.PI / 2, scale,
  })));
  const entries = [...actual, ...probes];
  const target = new THREE.Group();
  assetCache.attachInstances(`${prefix}${filename}`, target, entries.map(placementMatrix), () => true, { castShadow: false });
  for (let i = 0; i < 500 && target.children.length === 0; i++) await new Promise((resolve) => setTimeout(resolve, 5));
  target.updateMatrixWorld(true);
  const batches = [];
  target.traverse((object) => { if (object.isInstancedMesh) batches.push(object); });
  const placed = batches.length ? entries.map((entry, index) => {
    const box = boxFromVertices(batches, index);
    const limit = decorWorldBounds(prop.bounds, entry);
    return { id: entry.id, rotationY: entry.rotationY, scale: entry.scale, bounds: pack(box),
      registry_envelope: limit, inside: inside(box, limit), false_footholds: index < actual.length ? falseFootholds(entry, box) : [] };
  }) : [];
  const measuredHeight = source.max.y - source.min.y;
  const checks = {
    exact_registry_prop_and_fixed_box: prop.theme === 'harbor' &&
      JSON.stringify(prop.bounds) === JSON.stringify({
        min: { x: -({ 'lookout-tower-facade': 1.8, 'pier-bollard': 0.3, 'rescue-buoy-stand': 0.6, 'small-boat': 1.2 })[id], y: 0,
          z: -({ 'lookout-tower-facade': 1.8, 'pier-bollard': 0.3, 'rescue-buoy-stand': 0.25, 'small-boat': 2.6 })[id] },
        max: { x: ({ 'lookout-tower-facade': 1.8, 'pier-bollard': 0.3, 'rescue-buoy-stand': 0.6, 'small-boat': 1.2 })[id],
          y: ({ 'lookout-tower-facade': 7, 'pier-bollard': 0.8, 'rescue-buoy-stand': 1.8, 'small-boat': 1.1 })[id],
          z: ({ 'lookout-tower-facade': 1.8, 'pier-bollard': 0.3, 'rescue-buoy-stand': 0.25, 'small-boat': 2.6 })[id] },
      }),
    registry_hash_matches_when_pinned: !prop.glb || prop.glb.sha256 === sha256,
    actual_a2_count: actual.length === expectedCounts[id],
    all_actual_origins_on_water_plane: actual.every((entry) => entry.position.y === -1.4),
    floor_at_zero: Math.abs(source.min.y) <= 1e-4,
    source_inside_planning_box: inside(source, prop.bounds),
    static_opaque_vertex_colour_pbr: gltf.animations.length === 0 && sourceMeshes.length > 0 &&
      sourceMeshes.every((mesh) => !mesh.isSkinnedMesh && !mesh.morphTargetInfluences && !!mesh.geometry.attributes.color) &&
      materials.length <= 4 && materials.every((m) => m.type === 'MeshStandardMaterial' && m.vertexColors && !m.transparent && m.metalness === 0),
    triangle_budget: triangles > 0 && triangles <= 5000,
    adapter_attached_every_instance: batches.length > 0 && batches.every((batch) => batch.count === entries.length),
    every_rotation_scale_and_a2_placement_inside_box: placed.length === entries.length && placed.every((entry) => entry.inside),
    no_false_footholds_in_actual_a2: placed.slice(0, actual.length).every((entry) => entry.false_footholds.length === 0),
    tower_sheet_height: id !== 'lookout-tower-facade' || (measuredHeight >= 6.85 && measuredHeight <= 7),
    bollard_height: id !== 'pier-bollard' || measuredHeight <= 0.8 + 1e-4,
    stand_height: id !== 'rescue-buoy-stand' || (measuredHeight >= 1.775 && measuredHeight <= 1.8 + 1e-4),
    boat_height_and_waterline: id !== 'small-boat' || (measuredHeight >= 0.75 && measuredHeight <= 1.1 + 1e-4 &&
      placed.slice(0, actual.length).every((entry) => Math.abs(entry.bounds.min.y + 1.4) <= 1e-4 &&
        entry.bounds.max.y >= -0.8 && entry.bounds.max.y <= -0.5)),
  };
  const failures = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  if (failures.length) allChecksPass = false;
  const tight = { min: Object.fromEntries(['x', 'y', 'z'].map((axis) => [axis, mmOut(source.min[axis], true)])),
    max: Object.fromEntries(['x', 'y', 'z'].map((axis) => [axis, mmOut(source.max[axis], false)])) };
  results[id] = { file: filename, sha256, bytes: bytes.length, triangles, meshes: sourceMeshes.length,
    materials: materials.map((m) => ({ name: m.name, type: m.type, vertexColors: m.vertexColors, metalness: m.metalness, transparent: m.transparent })),
    exact_bounds_gltf: pack(source), tight_bounds_mm: tight, unchanged_registry_box: prop.bounds,
    size_m: { width: +(source.max.x - source.min.x).toFixed(5), height: +measuredHeight.toFixed(5), depth: +(source.max.z - source.min.z).toFixed(5) },
    adapter: { instanced_batches: batches.length, actual_a2_placements: actual.length, probes: probes.length, placements: placed }, checks };
  console.log(JSON.stringify({ id, triangles, size_m: results[id].size_m, actual_a2_placements: actual.length, failures }));
}
assetCache.dispose();
await writeFile(path.join(root, 'three-inspection.json'), JSON.stringify({ work_order: 'WO111', asset_id: 'rescue-harbor-kit',
  version: 'v001', three_revision: THREE.REVISION, source: 'family-world-a-v5 A2',
  adapter: 'GLTFLoader.parseAsync exact bytes + SceneAssets.attachInstances (DecorScene path)',
  actual_placement_count: realDecor.length, all_checks_pass: allChecksPass && realDecor.length === 40, props: results }, null, 2) + '\n');
await writeFile(path.join(root, 'bounds.json'), JSON.stringify({ axes: 'glTF metres, +Y up, front +Z, floor-centred origin',
  registry_boxes_unchanged: true, props: Object.fromEntries(Object.entries(results).map(([id, result]) => [id, {
    sha256: result.sha256, exact_gltf: result.exact_bounds_gltf, tight_mm: result.tight_bounds_mm, size_m: result.size_m,
    unchanged_registry_box: result.unchanged_registry_box,
  }])) }, null, 2) + '\n');
process.exitCode = allChecksPass && realDecor.length === 40 ? 0 : 1;
