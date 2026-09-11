/** Exact GLB validation. Run on the authoring host with its installed validator. */
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const require = createRequire(import.meta.url);
const validator = require(process.env.GLTF_VALIDATOR_PATH || 'gltf-validator');
const root = path.resolve(process.argv[2] || '/workspace/haynes-quest/era-equipment/v001');
const names = process.argv[3] ? [process.argv[3]] : ['spark-mallet', 'acorn-shield', 'prism-wand', 'ribbon-shield'];
let failed = false;
for (const name of names) {
  const folder = path.join(root, name), filename = name + '.glb';
  const data = await readFile(path.join(folder, filename));
  const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)));
  const construction = JSON.parse(await readFile(path.join(folder, 'construction.json')));
  const report = await validator.validateBytes(new Uint8Array(data), { uri: filename, maxIssues: 100, externalResourceFunction: async (uri) => { throw new Error('Unexpected external URI: ' + uri); } });
  const primitives = gltf.meshes.flatMap((m) => m.primitives);
  const triangles = primitives.reduce((sum, p) => sum + gltf.accessors[p.indices].count / 3, 0);
  const positions = primitives.map((p) => gltf.accessors[p.attributes.POSITION]);
  const min = [0, 1, 2].map((k) => Math.min(...positions.map((p) => p.min[k])));
  const max = [0, 1, 2].map((k) => Math.max(...positions.map((p) => p.max[k])));
  const hash = createHash('sha256').update(data).digest('hex');
  const checks = {
    khronos_no_errors: report.issues.numErrors === 0,
    khronos_no_warnings: report.issues.numWarnings === 0,
    triangles_under_5000: triangles <= 5000,
    material_count_under_5: gltf.materials.length <= 5,
    draw_primitives_under_5: primitives.length <= 5,
    bytes_under_1_mib: data.byteLength <= 1048576,
    embedded_resources: [...(gltf.images || []), ...gltf.buffers].every((p) => !p.uri),
    no_required_decoders: !(gltf.extensionsRequired || []).some((p) => /draco|meshopt|basisu/i.test(p)),
    exact_y_up_height: Math.abs(max[1] - min[1] - construction.exact_height_m) < .000003,
    matching_source_bounds: [...min, ...max].every((p, i) => Math.abs(p - [...construction.bounds_gltf.min, ...construction.bounds_gltf.max][i]) < .000003),
    declared_grip_origin: construction.attachment.origin_gltf_m.every((v) => v === 0),
    source_hash_matches: hash === construction.files[filename].sha256,
    rigid_no_skin_or_clips: !(gltf.skins?.length) && !(gltf.animations?.length),
    all_geometry_indexed_triangles: primitives.every((p) => (p.mode ?? 4) === 4 && Number.isInteger(p.indices)),
  };
  const evidence = { schema_version: 1, asset_id: name, file: filename, sha256: hash, bytes: data.byteLength, triangles, draw_primitives: primitives.length, materials: gltf.materials, image_count: gltf.images?.length || 0, bounds_gltf: { min, max, dimensions: max.map((v, k) => v - min[k]) }, checks, validator: report };
  await writeFile(path.join(folder, 'validation.json'), JSON.stringify(evidence, null, 2) + '\n');
  const failures = Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key);
  console.log(JSON.stringify({ name, bytes: data.byteLength, triangles, materials: gltf.materials.length, failures, issues: report.issues }));
  failed ||= failures.length > 0;
}
process.exitCode = failed ? 1 : 0;
