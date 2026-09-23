// Reproducible Khronos validation of the three exact WO096 exports.
// NODE_PATH=/usr/local/lib/node_modules node validate-glbs.mjs (authoring image).
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const require=createRequire(import.meta.url);
const validator=require(process.env.GLTF_VALIDATOR_PATH || 'gltf-validator');
const directory=path.dirname(fileURLToPath(import.meta.url));
const names=['block-tower','safety-rail','windup-lantern'];
const records=[];
for(const name of names){
  const file=name+'.glb';
  const bytes=await fs.readFile(path.join(directory,file));
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  const result=await validator.validateBytes(new Uint8Array(bytes),{
    uri:file,maxIssues:100,externalResourceFunction:async uri=>{throw Error('Unexpected external URI: '+uri);}
  });
  await fs.writeFile(path.join(directory,name+'-validator.json'),JSON.stringify(result,null,2)+'\n');
  const primitives=gltf.meshes.flatMap(mesh=>mesh.primitives);
  const triangles=primitives.reduce((sum,primitive)=>sum+gltf.accessors[primitive.indices].count/3,0);
  const record={asset:name,file,sha256:createHash('sha256').update(bytes).digest('hex'),
    bytes:bytes.length,meshes:gltf.meshes.length,primitives:primitives.length,triangles,
    materials:gltf.materials.map(material=>({name:material.name,pbr:material.pbrMetallicRoughness,
      emissive:material.emissiveFactor,extensions:material.extensions})),
    images:gltf.images?.length??0,animations:gltf.animations?.length??0,skins:gltf.skins?.length??0,
    extensionsUsed:gltf.extensionsUsed??[],extensionsRequired:gltf.extensionsRequired??[],
    checks:{khronosNoErrors:result.issues.numErrors===0,khronosNoWarnings:result.issues.numWarnings===0,
      triangleCeiling3000:triangles<=3000,materialCeiling3:gltf.materials.length<=3,
      singleExportMesh:gltf.meshes.length===1,allPrimitivesColored:primitives.every(p=>p.attributes.COLOR_0!==undefined),
      noTextures:!gltf.images?.length,noAnimationOrSkin:!gltf.animations?.length&&!gltf.skins?.length,
      resourcesEmbedded:[...(gltf.buffers??[]),...(gltf.images??[])].every(item=>!item.uri),
      noRequiredExtensions:!gltf.extensionsRequired?.length,
      opaqueMaterials:gltf.materials.every(m=>!m.alphaMode||m.alphaMode==='OPAQUE')},
    validatorIssues:result.issues};
  records.push(record);
  const failures=Object.entries(record.checks).filter(([,value])=>!value).map(([key])=>key);
  if(failures.length)process.exitCode=1;
  console.log(JSON.stringify({asset:name,bytes:bytes.length,triangles,materials:gltf.materials.length,failures}));
}
await fs.writeFile(path.join(directory,'glb-measurements.json'),JSON.stringify({
  workOrder:'WO096',validator:'Khronos glTF Validator',assets:records},null,2)+'\n');
