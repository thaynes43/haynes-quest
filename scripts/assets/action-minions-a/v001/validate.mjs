/** Action minions A v001: exact-byte Khronos glTF validation plus the character budgets for one candidate.
 * Runs inside the Blender authoring pod (node + gltf-validator are installed there): node validate.mjs <asset-id> <asset-dir>
 * Adapted from the WO111 mischief-kitten v001 validate.mjs. */
import {createRequire} from 'node:module';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const require = createRequire(import.meta.url);
const validator = require(process.env.GLTF_VALIDATOR_PATH || '/usr/local/lib/node_modules/gltf-validator');
const id = process.argv[2], root = path.resolve(process.argv[3]), file = id + '.glb', data = await readFile(path.join(root, file));
const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
const report = await validator.validateBytes(new Uint8Array(data), {uri: file, maxIssues: 200, externalResourceFunction: async uri => { throw Error('Unexpected external URI ' + uri); }});
const primitives = gltf.meshes.flatMap(m => m.primitives);
const triangles = primitives.reduce((n, p) => n + gltf.accessors[p.indices].count / 3, 0);
const clips = (gltf.animations || []).map(a => ({name: a.name, duration_s: Math.max(...a.samplers.map(s => gltf.accessors[s.input].max[0])), channels: a.channels.length}));
const ex = gltf.scenes[gltf.scene ?? 0].extras || {};
const checks = {gltf_2: gltf.asset.version === '2.0', khronos_no_errors: report.issues.numErrors === 0, khronos_no_warnings: report.issues.numWarnings === 0,
  scene_identity: ex.asset_id === id && ex.asset_version === 'v001' && ex.pack === 'action-minions-a' && /Awaiting Tom's review/.test(ex.candidate_status || ''),
  no_lease_keys_exported: !('scene_owner' in ex) && !('scene_lease' in ex),
  five_exact_clips: clips.map(c => c.name).sort().join() === ['attack', 'defeat', 'hit', 'idle', 'move'].join(), positive_animated_clips: clips.every(c => c.duration_s > 0 && c.channels > 0),
  attack_2_s: Math.abs(clips.find(c => c.name === 'attack').duration_s - 2) < .01,
  triangle_budget_15000: triangles <= 15000, material_budget_2: gltf.materials.length <= 2, primitive_budget_2: primitives.length <= 2, glb_budget_2_mib: data.length <= 2097152,
  one_embedded_atlas: gltf.images?.length === 1, embedded_resources: [...(gltf.buffers || []), ...(gltf.images || [])].every(r => !r.uri),
  no_required_extensions: !(gltf.extensionsRequired?.length), no_compression_extensions: !(gltf.extensionsUsed || []).some(e => /draco|meshopt|basisu/i.test(e)),
  all_have_uvs: primitives.every(p => p.attributes.TEXCOORD_0 !== undefined), single_skin: gltf.skins?.length === 1,
  at_most_4_influences: primitives.every(p => p.attributes.JOINTS_0 !== undefined && p.attributes.JOINTS_1 === undefined), opaque_surfaces: gltf.materials.every(m => !m.alphaMode || m.alphaMode === 'OPAQUE')};
const record = {asset_id: id, version: 'v001', file, sha256: createHash('sha256').update(data).digest('hex'), bytes: data.length, triangles, draw_primitives: primitives.length,
  materials: gltf.materials.map(m => ({name: m.name, pbr: m.pbrMetallicRoughness})), images: (gltf.images || []).map(i => ({mimeType: i.mimeType, bufferView: i.bufferView, bytes: gltf.bufferViews[i.bufferView].byteLength})),
  joints: gltf.skins[0].joints.map(j => gltf.nodes[j].name), clips, scene_extras: ex, extensions_used: gltf.extensionsUsed || [], generator: gltf.asset.generator, checks, validator: report};
await writeFile(path.join(root, 'validation.json'), JSON.stringify(record, null, 2) + '\n');
const failures = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
console.log(JSON.stringify({asset: id, triangles, bytes: data.length, issues: report.issues, validator_version: report.validatorVersion, failures})); process.exitCode = failures.length ? 1 : 0;
