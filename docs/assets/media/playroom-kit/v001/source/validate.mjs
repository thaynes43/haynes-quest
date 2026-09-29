/** WO111 playroom-kit v001: exact-byte Khronos validation plus static-prop budgets for all four GLBs.
 * Runs inside the Blender authoring pod (node + gltf-validator are installed there): node validate.mjs <root>
 * Adapted from the WO097 Rat Casino kit validate-glbs.mjs and the WO111 character validators. */
import {createRequire} from 'node:module';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const require = createRequire(import.meta.url);
const validator = require(process.env.GLTF_VALIDATOR_PATH || '/usr/local/lib/node_modules/gltf-validator');
const root = path.resolve(process.argv[2]);
const REGISTRY = {'stacking-block-tower': [0.7, 2.4, 0.7], 'toy-bus-garage': [2, 2.2, 1.6], 'crib-rail-fence': [1.6, 0.9, 0.12], 'giant-plush-ball': [0.9, 1.8, 0.9]};
const records = [];
let failed = false;
for (const [id, [hx, h, hz]] of Object.entries(REGISTRY)) {
  const file = id + '.glb', data = await readFile(path.join(root, file));
  const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
  const report = await validator.validateBytes(new Uint8Array(data), {uri: file, maxIssues: 200,
    externalResourceFunction: async uri => { throw Error('Unexpected external URI ' + uri); }});
  const primitives = gltf.meshes.flatMap(m => m.primitives);
  const triangles = primitives.reduce((n, p) => n + gltf.accessors[p.indices].count / 3, 0);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of primitives) { const a = gltf.accessors[p.attributes.POSITION]; for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], a.min[k]); hi[k] = Math.max(hi[k], a.max[k]); } }
  const nodes = gltf.nodes || [], meshNodes = nodes.filter(n => n.mesh !== undefined);
  const identity = n => !n.matrix && !n.translation && !n.rotation && !n.scale;
  const extras = gltf.scenes[gltf.scene ?? 0].extras || {};
  const checks = {
    gltf_2: gltf.asset.version === '2.0', khronos_no_errors: report.issues.numErrors === 0, khronos_no_warnings: report.issues.numWarnings === 0,
    triangle_budget_5000: triangles <= 5000, material_budget_4: gltf.materials.length <= 4, glb_budget_1_5_mib: data.length <= 1572864,
    single_mesh_single_node: gltf.meshes.length === 1 && meshNodes.length === 1 && nodes.length === 1,
    root_node_identity: meshNodes.every(identity), node_named_for_registry_id: meshNodes[0]?.name === id,
    vertex_colour_on_every_primitive: primitives.every(p => p.attributes.COLOR_0 !== undefined), normals_on_every_primitive: primitives.every(p => p.attributes.NORMAL !== undefined),
    no_textures_or_images: !(gltf.images?.length) && !(gltf.textures?.length), static_no_animation_skin_morph: !(gltf.animations?.length) && !(gltf.skins?.length) && primitives.every(p => !p.targets),
    embedded_resources: [...(gltf.buffers || []), ...(gltf.images || [])].every(r => !r.uri), no_extensions: !(gltf.extensionsUsed?.length) && !(gltf.extensionsRequired?.length),
    opaque_materials: gltf.materials.every(m => !m.alphaMode || m.alphaMode === 'OPAQUE'), non_metallic_materials: gltf.materials.every(m => (m.pbrMetallicRoughness?.metallicFactor ?? 1) === 0),
    floor_at_zero: Math.abs(lo[1]) < 1e-4, inside_registry_box: lo[0] >= -hx - 1e-6 && hi[0] <= hx + 1e-6 && lo[1] >= -1e-6 && hi[1] <= h + 1e-6 && lo[2] >= -hz - 1e-6 && hi[2] <= hz + 1e-6,
    footprint_centred_within_2cm: Math.abs((lo[0] + hi[0]) / 2) <= 0.02 && Math.abs((lo[2] + hi[2]) / 2) <= 0.02,
    scene_identity: extras.work_order === 'WO111' && extras.asset_id === 'playroom-kit' && extras.asset_version === 'v001' && extras.prop_id === id && String(extras.candidate_status || '').startsWith('WO111 playroom-kit v001'),
    no_author_lease_state_in_extras: extras.scene_lease === undefined && extras.scene_owner === undefined && !Object.keys(extras).some(k => k.startsWith('blendermcp_')),
  };
  const record = {prop_id: id, file, sha256: createHash('sha256').update(data).digest('hex'), bytes: data.length, triangles, meshes: gltf.meshes.length,
    primitives: primitives.length, nodes: nodes.length, materials: gltf.materials.map(m => ({name: m.name, pbr: m.pbrMetallicRoughness})),
    accessor_bounds_gltf: {min: lo.map(v => +v.toFixed(5)), max: hi.map(v => +v.toFixed(5))}, registry_box_gltf: {min: [-hx, 0, -hz], max: [hx, h, hz]},
    scene_extras: extras, extensions_used: gltf.extensionsUsed || [], checks, validator: report};
  records.push(record);
  const failures = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  if (failures.length) failed = true;
  console.log(JSON.stringify({id, bytes: data.length, triangles, primitives: primitives.length, issues: {e: report.issues.numErrors, w: report.issues.numWarnings, i: report.issues.numInfos, h: report.issues.numHints}, failures}));
}
await writeFile(path.join(root, 'validation.json'), JSON.stringify({work_order: 'WO111', asset_id: 'playroom-kit', version: 'v001',
  validator: {name: 'Khronos glTF Validator', version: records[0].validator.validatorVersion}, all_checks_pass: !failed, props: records}, null, 2) + '\n');
process.exitCode = failed ? 1 : 0;
