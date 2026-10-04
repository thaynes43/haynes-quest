/** Storybook planting kit v001: exact GLTFLoader checks of the three static props.
 * node scripts/assets/action-minions-b/v001/inspect-static.mjs <dir-with-glbs> <out.json> */
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const [dir, out] = process.argv.slice(2);
const props = {'storybook-canopy-tree': [3.6, 4.4], 'storybook-cypress': [2.7, 3.2], 'storybook-flowering-shrub': [.7, .9]};
const record = {kit_id: 'storybook-planting-kit', version: 'v001', three_revision: T.REVISION, method: 'Exact GLTFLoader parse of each GLB; world-space vertex bounds; material and draw-primitive inventory. No physical-device claim.', props: {}};
const materialNames = new Set(); let failed = false;
for (const [id, [hmin, hmax]] of Object.entries(props)) {
  const bytes = await readFile(path.join(dir, id + '.glb'));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const meshes = []; gltf.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
  gltf.scene.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(gltf.scene, true), size = box.getSize(new T.Vector3());
  const base = new T.Box3(); const v = new T.Vector3(); let tris = 0;
  for (const m of meshes) { const p = m.geometry.attributes.position; tris += (m.geometry.index ? m.geometry.index.count : p.count) / 3;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); if (v.y <= .05) base.expandByPoint(v); } }
  const mats = [...new Set(meshes.map((m) => m.material))]; mats.forEach((m) => materialNames.add(m.name));
  const checks = {
    one_mesh_one_draw_primitive: meshes.length === 1 && !Array.isArray(meshes[0].material),
    node_named_for_prop_identity_transform: meshes[0].name === id && meshes[0].position.length() === 0 && meshes[0].quaternion.angleTo(new T.Quaternion()) === 0 && meshes[0].scale.equals(new T.Vector3(1, 1, 1)),
    vertex_coloured_standard_material_no_maps: mats.every((m) => m.isMeshStandardMaterial && m.vertexColors && !m.map && !m.normalMap && m.metalness === 0),
    no_animation_or_skin: gltf.animations.length === 0 && meshes.every((m) => !m.isSkinnedMesh),
    base_on_ground: Math.abs(box.min.y) < 1e-4,
    base_centred: Math.abs(base.min.x + base.max.x) <= .06 && Math.abs(base.min.z + base.max.z) <= .06,
    height_in_range: size.y >= hmin && size.y <= hmax,
  };
  if (Object.values(checks).some((x) => !x)) failed = true;
  record.props[id] = {glb_sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, triangles: tris, height_m: size.y, size_m: size.toArray(),
    bounds_y_up: {min: box.min.toArray(), max: box.max.toArray()}, planting_base_below_5cm: {min: base.min.toArray(), max: base.max.toArray()},
    material: mats.map((m) => ({name: m.name, type: m.type, vertexColors: m.vertexColors, roughness: m.roughness})), checks};
}
record.shared_material_across_kit = materialNames.size === 1; if (!record.shared_material_across_kit) failed = true;
record.material_names = [...materialNames];
await writeFile(out, JSON.stringify(record, null, 2) + '\n');
console.log(JSON.stringify({shared: record.shared_material_across_kit, props: Object.fromEntries(Object.entries(record.props).map(([k, p]) => [k, {h: +p.height_m.toFixed(3), tris: p.triangles, fail: Object.entries(p.checks).filter(([, x]) => !x).map(([n]) => n)}]))}));
process.exitCode = failed ? 1 : 0;
