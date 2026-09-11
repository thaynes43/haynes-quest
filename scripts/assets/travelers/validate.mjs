/** Validate GLB bytes and the explicit traveler runtime contract.
 * Run: NODE_PATH=/usr/local/lib/node_modules node validate.mjs <artifact-dir>
 * Uses the installed Khronos gltf-validator; no network or decoders are needed.
 */
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const validator = require(process.env.GLTF_VALIDATOR_PATH || 'gltf-validator');
const folder = process.argv[2] || '/workspace/haynes-quest/travelers/v001';
let failed = false;
for (const stage of ['infant', 'child']) {
  const file = `traveler-${stage}.glb`;
  const data = await readFile(path.join(folder, file));
  const jsonLength = data.readUInt32LE(12);
  const gltf = JSON.parse(data.subarray(20, 20 + jsonLength).toString());
  const report = await validator.validateBytes(new Uint8Array(data), {
    uri: file,
    maxIssues: 200,
    externalResourceFunction: async (uri) => { throw new Error(`Unexpected external resource: ${uri}`); },
  });
  const expected = ['idle', 'move', 'interact', ...(stage === 'child' ? ['jump'] : [])];
  const clips = (gltf.animations || []).map((animation) => ({
    name: animation.name,
    duration_s: Math.max(...animation.samplers.map((s) => gltf.accessors[s.input].max[0])),
    channels: animation.channels.length,
  }));
  const primitives = gltf.meshes.flatMap((mesh) => mesh.primitives);
  const triangles = primitives.reduce((total, primitive) => total + gltf.accessors[primitive.indices].count / 3, 0);
  const positions = primitives.map((primitive) => gltf.accessors[primitive.attributes.POSITION]);
  const min = [0, 1, 2].map((k) => Math.min(...positions.map((p) => p.min[k])));
  const max = [0, 1, 2].map((k) => Math.max(...positions.map((p) => p.max[k])));
  const height = stage === 'infant' ? .75 : 1.2;
  const checks = {
    gltf_version_2: gltf.asset.version === '2.0',
    khronos_no_errors: report.issues.numErrors === 0,
    khronos_no_warnings: report.issues.numWarnings === 0,
    exact_clip_names: clips.map((c) => c.name).sort().join() === expected.sort().join(),
    all_clips_animated: clips.every((clip) => clip.channels > 0 && clip.duration_s > 0),
    triangle_budget_12000: triangles <= 12000,
    material_budget_8: gltf.materials.length <= 8,
    glb_budget_2_mib: data.byteLength <= 2 * 1024 * 1024,
    embedded_resources: [...(gltf.buffers || []), ...(gltf.images || [])].every((entry) => !entry.uri),
    no_required_decoders: !(gltf.extensionsRequired || []).some((ext) => /draco|meshopt|basisu/i.test(ext)),
    y_up_ground_origin: Math.abs(min[1]) < .0001,
    physical_height_m: Math.abs(max[1] - min[1] - height) < .0001,
    shared_16_joint_rig: gltf.skins.length === 1 && gltf.skins[0].joints.length === 16,
    vertex_colors: primitives.every((p) => Number.isInteger(p.attributes.COLOR_0)),
    max_4_influences: primitives.every((p) => Number.isInteger(p.attributes.JOINTS_0) && !('JOINTS_1' in p.attributes)),
    matte_materials: gltf.materials.every((m) => (m.pbrMetallicRoughness.roughnessFactor ?? 1) >= .4),
  };
  const evidence = {
    file,
    sha256: createHash('sha256').update(data).digest('hex'),
    bytes: data.byteLength,
    triangles,
    materials: gltf.materials.map((m) => ({ name: m.name, ...m.pbrMetallicRoughness })),
    primitives: primitives.length,
    bones: gltf.skins[0].joints.map((id) => gltf.nodes[id].name),
    textures: gltf.textures?.length || 0,
    extensions_required: gltf.extensionsRequired || [],
    extensions_used: gltf.extensionsUsed || [],
    rest_bounds_gltf: { min, max },
    clips,
    checks,
    validator: report,
  };
  await writeFile(path.join(folder, `validation-${stage}.json`), JSON.stringify(evidence, null, 2) + '\n');
  const failures = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key);
  console.log(JSON.stringify({ stage, bytes: data.byteLength, triangles, issues: report.issues, failures }));
  failed ||= failures.length > 0;
}
process.exitCode = failed ? 1 : 0;
