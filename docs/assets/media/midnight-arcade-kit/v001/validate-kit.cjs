// WO095: run with Node beside the GLBs and a Khronos glTF validator install.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const validator = require(process.env.GLTF_VALIDATOR_PATH || '/usr/local/lib/node_modules/gltf-validator');
const directory = __dirname;

async function inspect(name) {
  const filename = name + '.glb';
  const bytes = fs.readFileSync(path.join(directory, filename));
  const jsonSize = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonSize).toString());
  const binaryOffset = 20 + jsonSize + 8;
  const bin = bytes.subarray(binaryOffset);
  const report = await validator.validateBytes(new Uint8Array(bytes), { uri: filename });
  fs.writeFileSync(path.join(directory, name + '-validator.json'), JSON.stringify(report, null, 2) + '\n');
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  let triangles = 0, vertices = 0, normals = 0, minNormal = Infinity, maxNormal = 0;
  const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  function readFloatAccessor(index) {
    const a = gltf.accessors[index];
    if (a.componentType !== 5126) throw new Error('Expected float accessor');
    const view = gltf.bufferViews[a.bufferView];
    const width = components[a.type];
    const stride = view.byteStride || width * 4;
    const offset = (view.byteOffset || 0) + (a.byteOffset || 0);
    return Array.from({ length: a.count }, (_, i) =>
      Array.from({ length: width }, (_, k) => bin.readFloatLE(offset + i * stride + k * 4)));
  }
  for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
    const positions = readFloatAccessor(primitive.attributes.POSITION);
    vertices += positions.length;
    for (const position of positions) position.forEach((v, axis) => {
      bounds.min[axis] = Math.min(bounds.min[axis], v);
      bounds.max[axis] = Math.max(bounds.max[axis], v);
    });
    triangles += (primitive.indices === undefined ? positions.length : gltf.accessors[primitive.indices].count) / 3;
    for (const normal of readFloatAccessor(primitive.attributes.NORMAL)) {
      const len = Math.hypot(...normal);
      normals++;
      minNormal = Math.min(minNormal, len);
      maxNormal = Math.max(maxNormal, len);
    }
  }
  const selfContained = (gltf.buffers || []).every(b => !b.uri) && (gltf.images || []).every(i => !i.uri);
  const identityNodes = gltf.nodes.every(n => !n.matrix && !n.translation && !n.rotation && !n.scale);
  const result = {
    file: filename, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    validator: { version: validator.version(), errors: report.issues.numErrors, warnings: report.issues.numWarnings,
      infos: report.issues.numInfos, hints: report.issues.numHints, report: name + '-validator.json' },
    meshes: gltf.meshes.length, nodes: gltf.nodes.length,
    primitives: gltf.meshes.reduce((n, m) => n + m.primitives.length, 0),
    materials: gltf.materials.length, materialNames: gltf.materials.map(m => m.name),
    triangles, exportedVertices: vertices, normals: { count: normals, minimumLength: minNormal, maximumLength: maxNormal },
    boundingBoxYUp: bounds, dimensionsMeters: bounds.max.map((v, i) => v - bounds.min[i]),
    animations: (gltf.animations || []).length, skins: (gltf.skins || []).length,
    images: (gltf.images || []).length, textures: (gltf.textures || []).length,
    selfContained, identityNodes, rootAtFloor: Math.abs(bounds.min[1]) < 0.000001,
    up: '+Y', front: '+Z', origin: 'floor center of base footprint',
    extensionsUsed: gltf.extensionsUsed || [],
  };
  if (result.validator.errors || result.validator.warnings || triangles > 3000 || result.materials > 3 ||
      !selfContained || !identityNodes || !result.rootAtFloor || Math.abs(minNormal - 1) > 0.00001 ||
      Math.abs(maxNormal - 1) > 0.00001) throw new Error(JSON.stringify(result));
  return result;
}
(async () => {
  const results = [];
  for (const name of ['ticket-arch', 'arcade-cabinet', 'joystick-bollard']) results.push(await inspect(name));
  fs.writeFileSync(path.join(directory, 'glb-measurements.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results));
})().catch(error => { console.error(error); process.exitCode = 1; });
