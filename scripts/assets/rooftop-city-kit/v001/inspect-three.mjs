/** WO111 Rooftop City v001: exact GLB bounds through GLTFLoader and SceneAssets.
 * node_modules/.bin/tsx scripts/assets/rooftop-city-kit/v001/inspect-three.mjs <directory-containing-glbs>
 * Exercises every checked-in A3 v5 transform plus representative quarter turns and scales.
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
const ids = ['water-tower', 'rooftop-ac-unit', 'crane-hook', 'billboard-frame'];
const project = JSON.parse(await readFile(new URL('../../../../src/shared/levels/family-world-a-v5.json', import.meta.url), 'utf8'));
const level = project.chapters.find((chapter) => chapter.chapterId === 'family-a3')?.level;
if (!level) throw new Error('family-world-a-v5 has no A3 level');
const realDecor = level.decor.filter((entry) => ids.includes(entry.kitPropId));
const surfaces = level.pieces.filter(isAuthoredSurfacePiece);
const props = new Map(themeKitPropsFor('rooftop').map((prop) => [prop.id, prop]));
const expectedCounts = { 'water-tower': 21, 'rooftop-ac-unit': 16, 'crane-hook': 5, 'billboard-frame': 8 };
const boxes = { 'water-tower': [1.4, 5, 1.4], 'rooftop-ac-unit': [0.9, 1.1, 0.7], 'crane-hook': [0.5, 1.6, 0.5], 'billboard-frame': [2.5, 4, 0.25] };

const prefix = '/rooftop-city-kit/';
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
    exact_registry_prop_and_fixed_box: prop.theme === 'rooftop' &&
      JSON.stringify(prop.bounds) === JSON.stringify({min: {x:-boxes[id][0],y:0,z:-boxes[id][2]}, max: {x:boxes[id][0],y:boxes[id][1],z:boxes[id][2]}}),
    registry_hash_matches_when_pinned: !prop.glb || prop.glb.sha256 === sha256,
    actual_a3_count: actual.length === expectedCounts[id],
    floor_at_zero: Math.abs(source.min.y) <= 1e-4,
    source_inside_planning_box: inside(source, prop.bounds),
    static_opaque_vertex_colour_pbr: gltf.animations.length === 0 && sourceMeshes.length > 0 &&
      sourceMeshes.every((mesh) => !mesh.isSkinnedMesh && !mesh.morphTargetInfluences && !!mesh.geometry.attributes.color) &&
      materials.length <= 4 && materials.every((m) => m.type === 'MeshStandardMaterial' && m.vertexColors && !m.transparent && m.metalness === 0),
    triangle_budget: triangles > 0 && triangles <= 5000,
    adapter_attached_every_instance: batches.length > 0 && batches.every((batch) => batch.count === entries.length),
    every_rotation_scale_and_a3_placement_inside_box: placed.length === entries.length && placed.every((entry) => entry.inside),
    no_false_footholds_in_actual_a3: placed.slice(0, actual.length).every((entry) => entry.false_footholds.length === 0),
    recognizable_height: measuredHeight >= boxes[id][1] * 0.9,
  };
  const failures = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  if (failures.length) allChecksPass = false;
  const tight = { min: Object.fromEntries(['x', 'y', 'z'].map((axis) => [axis, mmOut(source.min[axis], true)])),
    max: Object.fromEntries(['x', 'y', 'z'].map((axis) => [axis, mmOut(source.max[axis], false)])) };
  results[id] = { file: filename, sha256, bytes: bytes.length, triangles, meshes: sourceMeshes.length,
    materials: materials.map((m) => ({ name: m.name, type: m.type, vertexColors: m.vertexColors, metalness: m.metalness, transparent: m.transparent })),
    exact_bounds_gltf: pack(source), tight_bounds_mm: tight, unchanged_registry_box: prop.bounds,
    size_m: { width: +(source.max.x - source.min.x).toFixed(5), height: +measuredHeight.toFixed(5), depth: +(source.max.z - source.min.z).toFixed(5) },
    adapter: { instanced_batches: batches.length, actual_a3_placements: actual.length, probes: probes.length, placements: placed }, checks };
  console.log(JSON.stringify({ id, triangles, size_m: results[id].size_m, actual_a3_placements: actual.length, failures }));
}
assetCache.dispose();
await writeFile(path.join(root, 'three-inspection.json'), JSON.stringify({ work_order: 'WO111', asset_id: 'rooftop-city-kit',
  version: 'v001', three_revision: THREE.REVISION, source: 'family-world-a-v5 A3',
  adapter: 'GLTFLoader.parseAsync exact bytes + SceneAssets.attachInstances (DecorScene path)',
  actual_placement_count: realDecor.length, all_checks_pass: allChecksPass && realDecor.length === 50, props: results }, null, 2) + '\n');
await writeFile(path.join(root, 'bounds.json'), JSON.stringify({ axes: 'glTF metres, +Y up, front +Z, floor-centred origin',
  registry_boxes_unchanged: true, props: Object.fromEntries(Object.entries(results).map(([id, result]) => [id, {
    sha256: result.sha256, exact_gltf: result.exact_bounds_gltf, tight_mm: result.tight_bounds_mm, size_m: result.size_m,
    unchanged_registry_box: result.unchanged_registry_box,
  }])) }, null, 2) + '\n');
process.exitCode = allChecksPass && realDecor.length === 50 ? 0 : 1;
