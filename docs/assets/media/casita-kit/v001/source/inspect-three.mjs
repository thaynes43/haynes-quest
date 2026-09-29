/** WO111 Casita v001: exact GLB bounds through GLTFLoader and SceneAssets.
 * node_modules/.bin/tsx scripts/assets/casita-kit/v001/inspect-three.mjs <directory-containing-glbs>
 * Exercises every checked-in B2 v5 transform plus representative quarter turns and scales.
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
const ids = ['casita-terrace-wall', 'flower-planter', 'patterned-door', 'butterfly-arch'];
const project = JSON.parse(await readFile(new URL('../../../../src/shared/levels/family-world-b-v5.json', import.meta.url), 'utf8'));
const level = project.chapters.find((chapter) => chapter.chapterId === 'family-b2')?.level;
if (!level) throw new Error('family-world-b-v5 has no B2 level');
const realDecor = level.decor.filter((entry) => ids.includes(entry.kitPropId));
const surfaces = level.pieces.filter(isAuthoredSurfacePiece);
const props = new Map(themeKitPropsFor('casita').map((prop) => [prop.id, prop]));
const expectedCounts = { 'casita-terrace-wall':9, 'flower-planter':20, 'patterned-door':4, 'butterfly-arch':3 };
const boxes = { 'casita-terrace-wall':[2.4,2,.35], 'flower-planter':[.6,.9,.6], 'patterned-door':[.8,2.4,.2], 'butterfly-arch':[1.8,3.2,.3] };

const prefix = '/casita-kit/';
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
const routeOverlaps = (_entry, box) => surfaces.filter((surface) => {
  const b=authoredSurfaceBounds(surface), top=authoredSurfaceTopRange(surface);
  return box.max.x>b.minX+1e-4 && box.min.x<b.maxX-1e-4 && box.max.z>b.minZ+1e-4 && box.min.z<b.maxZ-1e-4 &&
    box.max.y>top.min+1e-4 && box.min.y<top.max+1.4;
}).map((surface)=>surface.id);

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
      registry_envelope: limit, inside: inside(box, limit), route_overlaps: index < actual.length ? routeOverlaps(entry, box) : [] };
  }) : [];
  const measuredHeight = source.max.y - source.min.y;
  const checks = {
    exact_registry_prop_and_fixed_box: prop.theme==='casita' && JSON.stringify(prop.bounds)===JSON.stringify({
      min:{x:-boxes[id][0],y:0,z:-boxes[id][2]},max:{x:boxes[id][0],y:boxes[id][1],z:boxes[id][2]}}),
    registry_hash_matches_when_pinned: !prop.glb || prop.glb.sha256 === sha256,
    actual_b2_count: actual.length === expectedCounts[id],
    all_actual_origins_on_ground_plane: actual.every((entry) => entry.position.y === -1.4),
    floor_at_zero: Math.abs(source.min.y) <= 1e-4,
    source_inside_planning_box: inside(source, prop.bounds),
    static_opaque_vertex_colour_pbr: gltf.animations.length === 0 && sourceMeshes.length > 0 &&
      sourceMeshes.every((mesh) => !mesh.isSkinnedMesh && !mesh.morphTargetInfluences && !!mesh.geometry.attributes.color) &&
      materials.length <= 4 && materials.every((m) => m.type === 'MeshStandardMaterial' && m.vertexColors && !m.transparent && m.metalness === 0),
    triangle_budget: triangles > 0 && triangles <= 5000,
    adapter_attached_every_instance: batches.length > 0 && batches.every((batch) => batch.count === entries.length),
    every_rotation_scale_and_b2_placement_inside_box: placed.length === entries.length && placed.every((entry) => entry.inside),
    no_walkable_surface_overlap_in_actual_b2: placed.slice(0, actual.length).every((entry) => entry.route_overlaps.length === 0),
    retains_sheet_height: measuredHeight>=boxes[id][1]*0.985,
  };
  const failures = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  if (failures.length) allChecksPass = false;
  const tight = { min: Object.fromEntries(['x', 'y', 'z'].map((axis) => [axis, mmOut(source.min[axis], true)])),
    max: Object.fromEntries(['x', 'y', 'z'].map((axis) => [axis, mmOut(source.max[axis], false)])) };
  results[id] = { file: filename, sha256, bytes: bytes.length, triangles, meshes: sourceMeshes.length,
    materials: materials.map((m) => ({ name: m.name, type: m.type, vertexColors: m.vertexColors, metalness: m.metalness, transparent: m.transparent })),
    exact_bounds_gltf: pack(source), tight_bounds_mm: tight, unchanged_registry_box: prop.bounds,
    size_m: { width: +(source.max.x - source.min.x).toFixed(5), height: +measuredHeight.toFixed(5), depth: +(source.max.z - source.min.z).toFixed(5) },
    adapter: { instanced_batches: batches.length, actual_b2_placements: actual.length, probes: probes.length, placements: placed }, checks };
  console.log(JSON.stringify({ id, triangles, size_m: results[id].size_m, actual_b2_placements: actual.length, failures }));
}
assetCache.dispose();
await writeFile(path.join(root, 'three-inspection.json'), JSON.stringify({ work_order: 'WO111', asset_id: 'casita-kit',
  version: 'v001', three_revision: THREE.REVISION, source: 'family-world-b-v5 B2',
  adapter: 'GLTFLoader.parseAsync exact bytes + SceneAssets.attachInstances (DecorScene path)',
  actual_placement_count: realDecor.length, all_checks_pass: allChecksPass && realDecor.length === 36, props: results }, null, 2) + '\n');
await writeFile(path.join(root, 'bounds.json'), JSON.stringify({ axes: 'glTF metres, +Y up, front +Z, floor-centred origin',
  registry_boxes_unchanged: true, props: Object.fromEntries(Object.entries(results).map(([id, result]) => [id, {
    sha256: result.sha256, exact_gltf: result.exact_bounds_gltf, tight_mm: result.tight_bounds_mm, size_m: result.size_m,
    unchanged_registry_box: result.unchanged_registry_box,
  }])) }, null, 2) + '\n');
process.exitCode = allChecksPass && realDecor.length === 36 ? 0 : 1;
