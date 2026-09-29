/** WO111 Rescue Harbor v001: Khronos validation of the exact four static GLBs.
 * node scripts/assets/rescue-harbor-kit/v001/validate.mjs <directory-containing-glbs>
 * The authoring pod provides gltf-validator globally; GLTF_VALIDATOR_PATH may override it.
 */
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const require = createRequire(import.meta.url);
const validator = require(process.env.GLTF_VALIDATOR_PATH || '/usr/local/lib/node_modules/gltf-validator');
if (!process.argv[2]) throw new Error('Usage: node validate.mjs <directory-containing-glbs>');
const root = path.resolve(process.argv[2]);
const boxes = {
  'lookout-tower-facade': [1.8, 7, 1.8],
  'pier-bollard': [0.3, 0.8, 0.3],
  'rescue-buoy-stand': [0.6, 1.8, 0.25],
  'small-boat': [1.2, 1.1, 2.6],
};
const results = {};
let failed = false;
for (const [id, [halfX, height, halfZ]] of Object.entries(boxes)) {
  const file = `${id}.glb`;
  const bytes = await readFile(path.join(root, file));
  if (bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length)
    throw new Error(`${file}: invalid GLB header or byte count`);
  if (bytes.toString('ascii', 16, 20) !== 'JSON') throw new Error(`${file}: first GLB chunk is not JSON`);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
  const report = await validator.validateBytes(new Uint8Array(bytes), {
    uri: file,
    maxIssues: 200,
    externalResourceFunction: async (uri) => { throw new Error(`Unexpected external URI ${uri}`); },
  });
  const primitives = (gltf.meshes || []).flatMap((mesh) => mesh.primitives || []);
  const accessor = (index) => gltf.accessors?.[index];
  const triangleCount = primitives.reduce((count, primitive) => {
    if (primitive.mode !== undefined && primitive.mode !== 4) return NaN;
    const vertexCount = primitive.indices === undefined
      ? accessor(primitive.attributes?.POSITION)?.count
      : accessor(primitive.indices)?.count;
    return count + vertexCount / 3;
  }, 0);
  const low = [Infinity, Infinity, Infinity];
  const high = [-Infinity, -Infinity, -Infinity];
  for (const primitive of primitives) {
    const position = accessor(primitive.attributes?.POSITION);
    if (!position?.min || !position?.max) continue;
    for (let axis = 0; axis < 3; axis++) {
      low[axis] = Math.min(low[axis], position.min[axis]);
      high[axis] = Math.max(high[axis], position.max[axis]);
    }
  }
  const nodes = gltf.nodes || [];
  const meshNodes = nodes.filter((node) => node.mesh !== undefined);
  const materials = gltf.materials || [];
  const extras = gltf.scenes?.[gltf.scene ?? 0]?.extras || {};
  const checks = {
    gltf_2: gltf.asset?.version === '2.0',
    khronos_zero_errors: report.issues.numErrors === 0,
    khronos_zero_warnings: report.issues.numWarnings === 0,
    triangles_at_most_5000: Number.isInteger(triangleCount) && triangleCount > 0 && triangleCount <= 5000,
    materials_at_most_4: materials.length > 0 && materials.length <= 4,
    bytes_at_most_1_5_mib: bytes.length <= 1.5 * 1024 * 1024,
    one_static_mesh_node: gltf.meshes?.length === 1 && nodes.length === 1 && meshNodes.length === 1,
    identity_node_named_for_prop: meshNodes[0]?.name === id && !['matrix', 'translation', 'rotation', 'scale'].some((key) => key in meshNodes[0]),
    triangle_primitives_with_normals_and_vertex_colours: primitives.length > 0 && primitives.every((p) =>
      (p.mode === undefined || p.mode === 4) && p.attributes?.NORMAL !== undefined && p.attributes?.COLOR_0 !== undefined),
    opaque_vertex_colour_pbr: materials.every((m) =>
      (!m.alphaMode || m.alphaMode === 'OPAQUE') &&
      (m.pbrMetallicRoughness?.metallicFactor ?? 1) === 0 &&
      !m.pbrMetallicRoughness?.baseColorTexture && !m.pbrMetallicRoughness?.metallicRoughnessTexture &&
      !m.normalTexture && !m.occlusionTexture && !m.emissiveTexture),
    no_image_texture_or_sampler: !(gltf.images?.length) && !(gltf.textures?.length) && !(gltf.samplers?.length),
    embedded_binary_only: (gltf.buffers || []).length === 1 && (gltf.buffers || []).every((buffer) => !buffer.uri),
    no_skin_animation_or_morph: !(gltf.skins?.length) && !(gltf.animations?.length) && primitives.every((p) => !p.targets),
    no_extensions_or_decoder: !(gltf.extensionsUsed?.length) && !(gltf.extensionsRequired?.length),
    floor_at_zero: Math.abs(low[1]) <= 1e-4,
    inside_unchanged_planning_box: low[0] >= -halfX - 1e-5 && high[0] <= halfX + 1e-5 &&
      low[1] >= -1e-5 && high[1] <= height + 1e-5 && low[2] >= -halfZ - 1e-5 && high[2] <= halfZ + 1e-5,
    footprint_centred_within_2cm: Math.abs(low[0] + high[0]) <= 0.04 && Math.abs(low[2] + high[2]) <= 0.04,
    rescue_harbor_identity: extras.work_order === 'WO111' && extras.asset_id === 'rescue-harbor-kit' &&
      extras.asset_version === 'v001' && extras.prop_id === id &&
      String(extras.candidate_status || '').startsWith('WO111 rescue-harbor-kit v001'),
    no_scene_lease_metadata: extras.scene_lease === undefined && extras.scene_owner === undefined &&
      !Object.keys(extras).some((key) => key.startsWith('blendermcp_')),
    tower_retains_sheet_height: id !== 'lookout-tower-facade' || high[1] >= 6.85,
    bollard_height: id !== 'pier-bollard' || high[1] <= 0.8 + 1e-5,
    buoy_stand_height: id !== 'rescue-buoy-stand' || (high[1] >= 1.775 && high[1] <= 1.8 + 1e-5),
    boat_height: id !== 'small-boat' || (high[1] >= 0.75 && high[1] <= 1.1 + 1e-5),
  };
  const failures = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  if (failures.length) failed = true;
  results[id] = {
    file, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length,
    triangles: triangleCount, primitives: primitives.length, nodes: nodes.length,
    materials: materials.map((m) => ({ name: m.name, pbr: m.pbrMetallicRoughness })),
    accessor_bounds_gltf: { min: low, max: high },
    unchanged_registry_box_gltf: { min: [-halfX, 0, -halfZ], max: [halfX, height, halfZ] },
    scene_extras: extras, checks, validator: report,
  };
  console.log(JSON.stringify({ id, bytes: bytes.length, triangles: triangleCount,
    issues: { errors: report.issues.numErrors, warnings: report.issues.numWarnings }, failures }));
}
await writeFile(path.join(root, 'validation.json'), JSON.stringify({ work_order: 'WO111', asset_id: 'rescue-harbor-kit',
  version: 'v001', validator: { name: 'Khronos glTF Validator', version: Object.values(results)[0].validator.validatorVersion },
  all_checks_pass: !failed, props: results }, null, 2) + '\n');
process.exitCode = failed ? 1 : 0;
