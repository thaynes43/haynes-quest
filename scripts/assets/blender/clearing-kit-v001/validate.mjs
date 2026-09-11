/** Exact GLB Khronos validation and explicit WO-010 geometry/resource contract. */
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const require=createRequire(import.meta.url);
const validator=require(process.env.GLTF_VALIDATOR_PATH || 'gltf-validator');
const root=process.argv[2] || '/workspace/haynes-quest/clearing-kit/v001';
const records=JSON.parse(await readFile(path.join(root,'build-inventory.json'),'utf8'));
let failed=false;
for (const [name,construction] of Object.entries(records)) {
  const filename=`${name}.glb`; const file=await readFile(path.join(root,name,filename));
  const doc=JSON.parse(file.subarray(20,20+file.readUInt32LE(12)).toString());
  const report=await validator.validateBytes(new Uint8Array(file),{uri:filename,maxIssues:200,externalResourceFunction:async uri=>{throw new Error(`Unexpected external URI: ${uri}`);}});
  const primitives=doc.meshes.flatMap(m=>m.primitives);
  const triangles=primitives.reduce((n,p)=>n+doc.accessors[p.indices].count/3,0);
  // Export copies are joined after baking all source transforms. Record and enforce
  // identity transforms rather than incorrectly treating local bounds as world bounds.
  const identityNodes=doc.nodes.every(n=>(!n.translation || n.translation.every(v=>Math.abs(v)<1e-7)) && (!n.rotation || n.rotation.every((v,k)=>Math.abs(v-(k===3?1:0))<1e-7)) && (!n.scale || n.scale.every(v=>Math.abs(v-1)<1e-7)) && !n.matrix);
  const positions=primitives.map(p=>doc.accessors[p.attributes.POSITION]);
  const min=[0,1,2].map(k=>Math.min(...positions.map(a=>a.min[k])));
  const max=[0,1,2].map(k=>Math.max(...positions.map(a=>a.max[k])));
  const dimensions=max.map((v,k)=>v-min[k]);
  const spec=construction.spec;
  const photoNode=doc.nodes.find(n=>n.name==='PhotoSurface');
  const photoPrimitives=photoNode?doc.meshes[photoNode.mesh].primitives:[];
  const photoPositions=photoPrimitives.map(p=>doc.accessors[p.attributes.POSITION]);
  const checks={
    gltf_2:doc.asset.version==='2.0',
    khronos_no_errors:report.issues.numErrors===0,
    khronos_no_warnings:report.issues.numWarnings===0,
    identity_node_transforms:identityNodes,
    triangle_budget:triangles<=spec.triangles_max,
    material_budget:doc.materials.length<=spec.materials_max,
    file_budget:file.byteLength<=spec.bytes_max,
    exact_dimensions:spec.dimensions_xyz.every((v,k)=>v===null || Math.abs(v-dimensions[k])<.0001),
    ground_y_zero:Math.abs(min[1])<.0001,
    centered_footprint:Math.abs(min[0]+max[0])<.0001 && Math.abs(min[2]+max[2])<.0001,
    no_external_resources:[...(doc.buffers||[]),...(doc.images||[])].every(r=>!r.uri),
    no_textures:(doc.textures||[]).length===0,
    no_required_extensions:(doc.extensionsRequired||[]).length===0,
    opaque_surfaces:doc.materials.every(m=>!m.alphaMode || m.alphaMode==='OPAQUE'),
    matte_materials:doc.materials.every(m=>(m.pbrMetallicRoughness.roughnessFactor??1)>=.5),
    vertex_colors:primitives.every(p=>Number.isInteger(p.attributes.COLOR_0)),
    all_triangle_primitives:primitives.every(p=>(p.mode??4)===4),
    no_skin_or_animation:!(doc.skins?.length || doc.animations?.length),
    closed_source_shells:Object.entries(construction.topology).every(([part,t])=>part==='PhotoSurface' || (t.boundary_edges===0 && t.nonmanifold_edges===0)),
    stable_flat_ground_contact:construction.ground_contact_area_m2>.0001,
  };
  if(name==='memory-keepsake') {
    checks.photo_surface_named=Boolean(photoNode);
    checks.photo_material_named=photoPrimitives.length===1 && doc.materials[photoPrimitives[0].material].name==='PhotoSurface';
    checks.photo_surface_has_uv=photoPrimitives.every(p=>Number.isInteger(p.attributes.TEXCOORD_0));
    checks.photo_surface_flat=photoPositions.every(p=>Math.abs(p.min[2]-p.max[2])<1e-7);
  }
  const evidence={asset_id:name,file:filename,sha256:createHash('sha256').update(file).digest('hex'),bytes:file.byteLength,triangles,materials:doc.materials.map(m=>({name:m.name,...m.pbrMetallicRoughness,emissiveFactor:m.emissiveFactor})),draw_primitives:primitives.length,bounds_gltf:{min,max,dimensions},extensions_used:doc.extensionsUsed||[],extensions_required:doc.extensionsRequired||[],checks,validator:report};
  await writeFile(path.join(root,name,'validation.json'),JSON.stringify(evidence,null,2)+'\n');
  const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
  console.log(JSON.stringify({name,bytes:file.byteLength,triangles,materials:doc.materials.length,issues:report.issues,failures}));
  failed ||= failures.length>0;
}
process.exitCode=failed?1:0;
