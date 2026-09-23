/** WO101 exact-byte Khronos validation and provisional character budgets. */
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const validator=require(process.env.GLTF_VALIDATOR_PATH||'/usr/local/lib/node_modules/gltf-validator');
const root=path.resolve(process.argv[2]),file='jackrabbit-drummer.glb',data=await readFile(path.join(root,file));
const gltf=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
const report=await validator.validateBytes(new Uint8Array(data),{uri:file,maxIssues:200,externalResourceFunction:async uri=>{throw Error('Unexpected external URI '+uri)}});
const primitives=gltf.meshes.flatMap(m=>m.primitives);
const triangles=primitives.reduce((n,p)=>n+gltf.accessors[p.indices].count/3,0);
const clips=(gltf.animations||[]).map(a=>({name:a.name,duration_s:Math.max(...a.samplers.map(s=>gltf.accessors[s.input].max[0])),channels:a.channels.length}));
const checks={gltf_2:gltf.asset.version==='2.0',khronos_no_errors:report.issues.numErrors===0,khronos_no_warnings:report.issues.numWarnings===0,
 five_exact_clips:clips.map(c=>c.name).sort().join()===['idle','move','attack','hit','defeat'].sort().join(),positive_animated_clips:clips.every(c=>c.duration_s>0&&c.channels>0),
 triangle_budget_15000:triangles<=15000,material_budget_2:gltf.materials.length<=2,primitive_budget_2:primitives.length<=2,glb_budget_2_mib:data.length<=2097152,
 one_embedded_atlas:gltf.images?.length===1,embedded_resources:[...(gltf.buffers||[]),...(gltf.images||[])].every(r=>!r.uri),no_required_extensions:!(gltf.extensionsRequired?.length),
 all_have_uvs:primitives.every(p=>p.attributes.TEXCOORD_0!==undefined),single_skin:gltf.skins.length===1,
 at_most_4_influences:primitives.every(p=>p.attributes.JOINTS_0!==undefined&&p.attributes.JOINTS_1===undefined),opaque_surfaces:gltf.materials.every(m=>!m.alphaMode||m.alphaMode==='OPAQUE')};
const record={asset_id:'jackrabbit-drummer',version:'v001',file,sha256:createHash('sha256').update(data).digest('hex'),bytes:data.length,triangles,draw_primitives:primitives.length,
 materials:gltf.materials.map(m=>({name:m.name,pbr:m.pbrMetallicRoughness})),joints:gltf.skins[0].joints.map(j=>gltf.nodes[j].name),clips,extensions_used:gltf.extensionsUsed||[],checks,validator:report};
await writeFile(path.join(root,'validation.json'),JSON.stringify(record,null,2)+'\n');
const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
console.log(JSON.stringify({triangles,bytes:data.length,issues:report.issues,failures}));process.exitCode=failures.length?1:0;
