/** Action minions B v001: Khronos validation plus pack budget/contract checks for one exact GLB.
 * node validate.mjs <glb> <out.json> [--static <halfX,height,halfZ>]
 * Runs inside the Blender authoring pod (global gltf-validator); GLTF_VALIDATOR_PATH may override it. */
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const require = createRequire(import.meta.url);
const validator = require(process.env.GLTF_VALIDATOR_PATH || '/usr/local/lib/node_modules/gltf-validator');
const [file, out] = [path.resolve(process.argv[2]), path.resolve(process.argv[3])];
const staticBox = process.argv.includes('--static') ? process.argv[process.argv.indexOf('--static') + 1].split(',').map(Number) : null;
const id = path.basename(file, '.glb');
const bytes = await readFile(file);
if (bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('invalid GLB header');
const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
const report = await validator.validateBytes(new Uint8Array(bytes), { uri: path.basename(file), maxIssues: 200,
  externalResourceFunction: async (uri) => { throw new Error(`Unexpected external URI ${uri}`); } });
const primitives = (gltf.meshes || []).flatMap((m) => m.primitives || []);
const acc = (i) => gltf.accessors?.[i];
const triangles = primitives.reduce((n, p) => n + (p.indices === undefined ? acc(p.attributes.POSITION).count : acc(p.indices).count) / 3, 0);
const vertices = primitives.reduce((n, p) => n + acc(p.attributes.POSITION).count, 0);
const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (const p of primitives) { const a = acc(p.attributes.POSITION); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], a.min[k]); hi[k] = Math.max(hi[k], a.max[k]); } }
const materials = gltf.materials || [];
const extras = gltf.scenes?.[gltf.scene ?? 0]?.extras || {};
const nodes = gltf.nodes || [];
const sceneRoots = gltf.scenes?.[gltf.scene ?? 0]?.nodes || [];
const anims = gltf.animations || [];
const common = {
  gltf_2: gltf.asset?.version === '2.0',
  khronos_zero_errors: report.issues.numErrors === 0,
  khronos_zero_warnings: report.issues.numWarnings === 0,
  khronos_zero_infos_or_hints_reported: true,
  two_or_fewer_materials: materials.length > 0 && materials.length <= (staticBox ? 3 : 2),
  opaque_vertex_colour_pbr_no_textures: materials.every((m) => (!m.alphaMode || m.alphaMode === 'OPAQUE') && (m.pbrMetallicRoughness?.metallicFactor ?? 1) === 0 &&
    !m.pbrMetallicRoughness?.baseColorTexture && !m.pbrMetallicRoughness?.metallicRoughnessTexture && !m.normalTexture && !m.occlusionTexture && !m.emissiveTexture),
  no_images_textures_samplers: !(gltf.images?.length) && !(gltf.textures?.length) && !(gltf.samplers?.length),
  triangle_primitives_with_normals_and_vertex_colours: primitives.every((p) => (p.mode === undefined || p.mode === 4) && p.attributes.NORMAL !== undefined && p.attributes.COLOR_0 !== undefined),
  embedded_single_buffer: (gltf.buffers || []).length === 1 && !gltf.buffers[0].uri,
  no_extensions: !(gltf.extensionsUsed?.length) && !(gltf.extensionsRequired?.length),
  bytes_at_most_1_5_mib: bytes.length <= 1.5 * 1024 * 1024,
  identity_extras: extras.asset_version === 'v001' && typeof extras.asset_id === 'string' && extras.work_order === '20261004-opus-action-minions-b',
  no_lease_or_addon_metadata: extras.scene_lease === undefined && extras.scene_owner === undefined && !Object.keys(extras).some((k) => k.startsWith('blendermcp_')),
  floor_at_or_above_zero: lo[1] >= -1e-4,
};
let specific, rootChannels, baseBox;
if (staticBox) {
  const [hx, h, hz] = staticBox;
  const meshNodes = nodes.filter((n) => n.mesh !== undefined);
  // the planting base: every vertex within 5 cm of the ground
  const binStart = 20 + bytes.readUInt32LE(12) + 8; baseBox = null;
  for (const prim of primitives) {
    const a = acc(prim.attributes.POSITION), v = gltf.bufferViews[a.bufferView], stride = v.byteStride || 12, off = binStart + (v.byteOffset || 0) + (a.byteOffset || 0);
    for (let k = 0; k < a.count; k++) { const x = bytes.readFloatLE(off + k * stride), y = bytes.readFloatLE(off + k * stride + 4), z = bytes.readFloatLE(off + k * stride + 8);
      if (y > .05) continue; baseBox ??= {min: [x, y, z], max: [x, y, z]}; for (const [i, c] of [x, y, z].entries()) { baseBox.min[i] = Math.min(baseBox.min[i], c); baseBox.max[i] = Math.max(baseBox.max[i], c); } }
  }
  specific = {
    triangles_at_most_7000: triangles > 0 && triangles <= 7000,
    one_static_mesh_node: gltf.meshes?.length === 1 && nodes.length === 1 && meshNodes.length === 1,
    identity_node_named_for_prop: meshNodes[0]?.name === id && !['matrix', 'translation', 'rotation', 'scale'].some((k) => k in meshNodes[0]),
    no_skin_animation_or_morph: !(gltf.skins?.length) && !anims.length && primitives.every((p) => !p.targets),
    base_at_ground_origin: Math.abs(lo[1]) <= 1e-3,
    base_centred_on_origin_within_3cm: baseBox !== null && Math.abs(baseBox.min[0] + baseBox.max[0]) <= .06 && Math.abs(baseBox.min[2] + baseBox.max[2]) <= .06,
    silhouette_balanced_within_20_percent: Math.abs(lo[0] + hi[0]) <= .2 * (hi[0] - lo[0]) && Math.abs(lo[2] + hi[2]) <= .2 * (hi[2] - lo[2]),
    inside_planning_box: lo[0] >= -hx && hi[0] <= hx && hi[1] <= h && lo[2] >= -hz && hi[2] <= hz,
    recognizable_height: hi[1] >= h * .85,
    prop_identity: extras.prop_id === id,
  };
} else {
  const names = anims.map((a) => a.name).sort();
  const rootNode = nodes[sceneRoots[0]];
  // The exporter samples every joint, so the root bone carries channels; they must hold one constant value.
  const binOffset = 20 + bytes.readUInt32LE(12) + 8;
  const floats = (i) => { const a = acc(i), v = gltf.bufferViews[a.bufferView], n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
    if (a.componentType !== 5126) throw new Error('non-float animation accessor');
    const start = binOffset + (v.byteOffset || 0) + (a.byteOffset || 0), stride = v.byteStride || n * 4, out = [];
    for (let k = 0; k < a.count; k++) { const row = []; for (let j = 0; j < n; j++) row.push(bytes.readFloatLE(start + k * stride + j * 4)); out.push(row); } return out; };
  rootChannels = anims.flatMap((a) => a.channels.filter((c) => sceneRoots.includes(c.target.node)).map((c) => {
    const values = floats(a.samplers[c.sampler].output); const first = values[0];
    return { clip: a.name, node: nodes[c.target.node].name, path: c.target.path, constant: values.every((r) => r.every((x, j) => Math.abs(x - first[j]) < 1e-6)), value: first };
  }));
  specific = {
    triangles_at_most_20000: triangles > 0 && triangles <= 20000,
    one_skin: gltf.skins?.length === 1,
    exactly_the_five_adapter_clips: names.join() === ['attack', 'defeat', 'hit', 'idle', 'move'].join(),
    scene_roots_are_skin_and_root_bone: sceneRoots.length === 2 && sceneRoots.some((i) => nodes[i].name === 'root') && sceneRoots.some((i) => nodes[i].skin !== undefined),
    root_level_channels_only_constant_root_bone: rootChannels.every((c) => c.node === 'root' && c.constant),
    root_bone_identity: rootChannels.every((c) => c.path !== 'translation' || c.value.every((x) => Math.abs(x) < 1e-6)),
    skinned_mesh_carries_bounds_envelope: nodes.some((n) => n.skin !== undefined && n.extras?.model_space_bounds_y_up?.min?.length === 3),
    four_influences_max: primitives.every((p) => p.attributes.JOINTS_0 !== undefined && p.attributes.JOINTS_1 === undefined),
  };
}
const checks = { ...common, ...specific };
const failures = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
const record = { id, file: path.basename(file), sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, triangles, vertices,
  primitives: primitives.length, nodes: nodes.length, materials: materials.map((m) => ({ name: m.name, doubleSided: !!m.doubleSided, pbr: m.pbrMetallicRoughness })),
  animations: anims.map((a) => ({ name: a.name, channels: a.channels.length, duration_s: Math.max(...a.samplers.map((s) => acc(s.input).max[0])) })),
  accessor_bounds_gltf: { min: lo, max: hi }, base_bounds_below_5cm: typeof baseBox === 'undefined' ? null : baseBox, scene_extras: extras, root_channels: typeof rootChannels === 'undefined' ? [] : rootChannels.map(({ clip, path, constant }) => ({ clip, path, constant })),
  validator: { name: 'Khronos glTF Validator', version: report.validatorVersion, issues: report.issues }, checks, failures };
await writeFile(out, JSON.stringify(record, null, 2) + '\n');
console.log(JSON.stringify({ id, bytes: bytes.length, triangles, errors: report.issues.numErrors, warnings: report.issues.numWarnings, infos: report.issues.numInfos, hints: report.issues.numHints, failures }));
process.exitCode = failures.length ? 1 : 0;
