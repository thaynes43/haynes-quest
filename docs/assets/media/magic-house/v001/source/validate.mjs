/** WO111 magic-house: exact-byte Khronos validation and character budgets (boss contract, WO099/WO111).
 * Runs inside the Blender authoring pod (node + gltf-validator are installed there): node validate.mjs <root> */
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const validator=require(process.env.GLTF_VALIDATOR_PATH||'/usr/local/lib/node_modules/gltf-validator');
const root=path.resolve(process.argv[2]),file='magic-house.glb',data=await readFile(path.join(root,file));
const gltf=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
const report=await validator.validateBytes(new Uint8Array(data),{uri:file,maxIssues:200,externalResourceFunction:async uri=>{throw Error('Unexpected external URI '+uri)}});
const primitives=gltf.meshes.flatMap(m=>m.primitives);
const triangles=primitives.reduce((n,p)=>n+gltf.accessors[p.indices].count/3,0);
const clips=(gltf.animations||[]).map(a=>({name:a.name,duration_s:Math.max(...a.samplers.map(s=>gltf.accessors[s.input].max[0])),channels:a.channels.length}));
const checks={gltf_2:gltf.asset.version==='2.0',khronos_no_errors:report.issues.numErrors===0,khronos_no_warnings:report.issues.numWarnings===0,
 correct_scene_identity:gltf.scenes.every(s=>s.extras?.work_order==='WO111'&&s.extras?.asset_id==='magic-house'&&s.extras?.asset_version==='v001'&&s.extras?.candidate_status?.startsWith('WO111 magic-house v001')),
 five_exact_clips:clips.map(c=>c.name).sort().join()===['idle','move','attack','hit','defeat'].sort().join(),positive_animated_clips:clips.every(c=>c.duration_s>0&&c.channels>0),
 attack_about_2_s:Math.abs(clips.find(c=>c.name==='attack').duration_s-2)<.01,
 triangle_budget_15000:triangles<=15000,material_budget_2:gltf.materials.length<=2,primitive_budget_2:primitives.length<=2,glb_budget_2_mib:data.length<=2097152,
 one_embedded_atlas:gltf.images?.length===1,embedded_resources:[...(gltf.buffers||[]),...(gltf.images||[])].every(r=>!r.uri),no_required_extensions:!(gltf.extensionsRequired?.length),no_compression_extensions:!(gltf.extensionsUsed||[]).some(e=>/draco|meshopt|KHR_texture_basisu/i.test(e)),
 all_have_uvs:primitives.every(p=>p.attributes.TEXCOORD_0!==undefined),single_skin:gltf.skins.length===1,
 at_most_4_influences:primitives.every(p=>p.attributes.JOINTS_0!==undefined&&p.attributes.JOINTS_1===undefined),opaque_surfaces:gltf.materials.every(m=>!m.alphaMode||m.alphaMode==='OPAQUE'),
 emissive_uses_the_same_atlas:gltf.materials.filter(m=>m.emissiveTexture).every(m=>gltf.textures[m.emissiveTexture.index].source===gltf.textures[m.pbrMetallicRoughness.baseColorTexture.index].source),
 no_custom_vertex_attributes:primitives.every(p=>Object.keys(p.attributes).every(a=>['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0'].includes(a)))};
const record={asset_id:'magic-house',version:'v001',file,sha256:createHash('sha256').update(data).digest('hex'),bytes:data.length,triangles,draw_primitives:primitives.length,
 materials:gltf.materials.map(m=>({name:m.name,pbr:m.pbrMetallicRoughness,emissiveFactor:m.emissiveFactor,emissiveTexture:m.emissiveTexture,doubleSided:!!m.doubleSided})),images:(gltf.images||[]).map(i=>({mimeType:i.mimeType,bufferView:i.bufferView})),joints:gltf.skins[0].joints.map(j=>gltf.nodes[j].name),clips,extensions_used:gltf.extensionsUsed||[],checks,validator:report};
await writeFile(path.join(root,'validation.json'),JSON.stringify(record,null,2)+'\n');
const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
console.log(JSON.stringify({triangles,bytes:data.length,issues:report.issues,failures}));process.exitCode=failures.length?1:0;
