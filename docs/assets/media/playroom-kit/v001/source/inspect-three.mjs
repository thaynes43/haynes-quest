/** WO111 playroom-kit v001: exact-GLB Three.js inspection and the actual game decor adapter.
 * Copy into a haynes-quest worktree at scripts/assets/playroom-kit/v001/ and run from the repo root:
 *   node_modules/.bin/tsx scripts/assets/playroom-kit/v001/inspect-three.mjs <artifact-dir>
 * 1. GLTFLoader.parseAsync on the exact bytes: every vertex through its node transform gives the tight glTF bounds
 *    (floor-centred, +Y up, front +Z), rounded outward to the millimetre like the registry's shared-kit entries.
 * 2. SceneAssets.attachInstances (what DecorScene calls for a prop with a GLB): the real createInstanceBatch path,
 *    placed at rotationY 0 / 90 / 180 / 270 deg and scale 1 / 1.25, must stay inside decorWorldBounds of the
 *    registry box for that placement (the validator's movement-lane envelope). No browser, no physical device. */
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SceneAssets} from '../../../../src/game/scene-assets.ts';
import {THEME_KIT_PROPS, decorWorldBounds} from '../../../../src/shared/theme-kits.ts';

const root = path.resolve(process.argv[2]);
const IDS = ['stacking-block-tower', 'toy-bus-garage', 'crib-rail-fence', 'giant-plush-ball'];
const PREFIX = '/kit/';
THREE.FileLoader.prototype.load = function (url, onLoad, _onProgress, onError) {
  if (!url.startsWith(PREFIX)) { onError?.(new Error('unexpected url ' + url)); return; }
  readFile(path.join(root, url.slice(PREFIX.length))).then(b => onLoad(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), e => onError?.(e));
};
const mm = (v, dir) => (dir < 0 ? Math.floor(v * 1000 + 1e-3) : Math.ceil(v * 1000 - 1e-3)) / 1000;  // outward to the mm, ignoring float32 noise
const inside = (box, env, eps = 1e-6) => ['x', 'y', 'z'].every(k => box.min[k] >= env.min[k] - eps && box.max[k] <= env.max[k] + eps);
const pack = b => ({min: {x: +b.min.x.toFixed(5), y: +b.min.y.toFixed(5), z: +b.min.z.toFixed(5)}, max: {x: +b.max.x.toFixed(5), y: +b.max.y.toFixed(5), z: +b.max.z.toFixed(5)}});
const results = {};
const assets = new SceneAssets();
for (const id of IDS) {
  const bytes = await readFile(path.join(root, id + '.glb'));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  const meshes = []; gltf.scene.traverse(o => { if (o.isMesh) meshes.push(o); });
  const box = new THREE.Box3(); const v = new THREE.Vector3(); let triangles = 0;
  for (const m of meshes) {
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld));
    triangles += (m.geometry.index ? m.geometry.index.count : pos.count) / 3;
  }
  const reg = THEME_KIT_PROPS.find(p => p.id === id);
  const tight = {min: {x: mm(box.min.x, -1), y: mm(box.min.y, -1), z: mm(box.min.z, -1)}, max: {x: mm(box.max.x, 1), y: mm(box.max.y, 1), z: mm(box.max.z, 1)}};
  const symmetric = {halfX: Math.max(-tight.min.x, tight.max.x), height: tight.max.y, halfZ: Math.max(-tight.min.z, tight.max.z)};
  const materials = [...new Set(meshes.flatMap(m => [].concat(m.material)))].map(m => ({name: m.name, type: m.type, vertexColors: m.vertexColors, roughness: m.roughness, metalness: m.metalness,
    color: '#' + m.color.getHexString(), transparent: m.transparent, side: m.side}));
  const colour = meshes.map(m => { const c = m.geometry.attributes.color; return c ? {itemSize: c.itemSize, normalized: c.normalized, array: c.array.constructor.name} : null; });
  // Game adapter: the same call DecorScene makes, at several placements.
  const placements = [];
  for (const scale of [1, 1.25]) for (const quarter of [0, 1, 2, 3]) placements.push({position: {x: 3 * quarter, y: 0, z: -2 * quarter}, rotationY: quarter * Math.PI / 2, scale});
  const matrices = placements.map(p => new THREE.Matrix4().compose(new THREE.Vector3(p.position.x, p.position.y, p.position.z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rotationY), new THREE.Vector3(p.scale, p.scale, p.scale)));
  const target = new THREE.Group(); target.name = 'decor-model-' + id;
  const t0 = performance.now();
  assets.attachInstances(PREFIX + id + '.glb', target, matrices, () => true, {castShadow: false});
  for (let i = 0; i < 400 && target.children.length === 0; i++) await new Promise(r => setTimeout(r, 5));
  const attachMs = performance.now() - t0;
  target.updateMatrixWorld(true);
  const batches = []; target.traverse(o => { if (o.isInstancedMesh) batches.push(o); });
  const perPlacement = placements.map((p, idx) => {
    const b = new THREE.Box3(), m = new THREE.Matrix4(), w = new THREE.Vector3();
    for (const inst of batches) {
      inst.getMatrixAt(idx, m); const pos = inst.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) b.expandByPoint(w.fromBufferAttribute(pos, i).applyMatrix4(m).applyMatrix4(inst.matrixWorld));
    }
    const env = decorWorldBounds(reg.bounds, p);
    return {placement: {rotationY_deg: Math.round(p.rotationY * 180 / Math.PI), scale: p.scale}, model_bounds: pack(b), registry_envelope: env, inside: inside(b, env)};
  });
  const checks = {
    registry_entry_present: !!reg, registry_theme_playroom: reg?.theme === 'playroom', single_gltf_node_named_for_id: gltf.scene.children.length === 1 && gltf.scene.children[0].name === id && meshes.every(m => m === gltf.scene.children[0] || m.parent === gltf.scene.children[0]) && meshes.length === materials.length,
    identity_node_transform: meshes.every(m => m.matrixWorld.equals(new THREE.Matrix4())), static: gltf.animations.length === 0 && meshes.every(m => !m.isSkinnedMesh && !m.morphTargetInfluences),
    triangle_budget_5000: triangles <= 5000, material_budget_4: materials.length <= 4, vertex_colours_enabled: materials.every(m => m.vertexColors) && colour.every(Boolean),
    standard_opaque_materials: materials.every(m => m.type === 'MeshStandardMaterial' && !m.transparent && m.metalness === 0), floor_at_zero: Math.abs(box.min.y) < 1e-4,
    tight_box_inside_registry_box: inside(box, reg.bounds), adapter_attached: batches.length > 0 && batches.every(b => b.count === placements.length),
    adapter_every_placement_inside_decorWorldBounds: perPlacement.every(p => p.inside),
  };
  results[id] = {file: id + '.glb', sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, triangles, meshes: meshes.length,
    exact_bounds_gltf: pack(box), tight_bounds_mm: tight, symmetric_registry_suggestion: symmetric,
    size_m: {width_x: +(box.max.x - box.min.x).toFixed(4), height_y: +(box.max.y - box.min.y).toFixed(4), depth_z: +(box.max.z - box.min.z).toFixed(4)},
    registry_bounds: reg.bounds, registry_fill: {width: +((box.max.x - box.min.x) / (reg.bounds.max.x - reg.bounds.min.x)).toFixed(3), height: +(box.max.y / reg.bounds.max.y).toFixed(3),
      depth: +((box.max.z - box.min.z) / (reg.bounds.max.z - reg.bounds.min.z)).toFixed(3)},
    materials, colour_attributes: colour, adapter: {instanced_batches: batches.length, instances_per_batch: batches[0]?.count, attach_ms: +attachMs.toFixed(1), placements: perPlacement}, checks};
  console.log(JSON.stringify({id, triangles, size: results[id].size_m, fill: results[id].registry_fill, batches: batches.length, failures: Object.entries(checks).filter(([, x]) => !x).map(([k]) => k)}));
}
assets.dispose?.();
const all = Object.values(results).every(r => Object.values(r.checks).every(Boolean));
await writeFile(path.join(root, 'three-inspection.json'), JSON.stringify({work_order: 'WO111', asset_id: 'playroom-kit', version: 'v001', three_revision: THREE.REVISION,
  loader: 'three/addons/loaders/GLTFLoader.js parseAsync (exact bytes) + src/game/scene-assets.ts SceneAssets.attachInstances (DecorScene path)',
  envelope: 'src/shared/theme-kits.ts decorWorldBounds(registry bounds, placement) at rotationY 0/90/180/270 deg, scale 1 and 1.25',
  all_checks_pass: all, props: results}, null, 2) + '\n');
const bounds = Object.fromEntries(Object.entries(results).map(([id, r]) => [id, {exact_gltf: r.exact_bounds_gltf, tight_mm: r.tight_bounds_mm, symmetric_registry_suggestion: r.symmetric_registry_suggestion,
  size_m: r.size_m, registry: r.registry_bounds, sha256: r.sha256}]));
await writeFile(path.join(root, 'bounds.json'), JSON.stringify({axes: 'glTF metres, +Y up, front toward +Z, origin at the floor centre', props: bounds}, null, 2) + '\n');
process.exitCode = all ? 0 : 1;
