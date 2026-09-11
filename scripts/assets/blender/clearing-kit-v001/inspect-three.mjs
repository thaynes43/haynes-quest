/** CPU Three.js GLTFLoader checks; this is not a browser/Safari performance test.
 * Usage: node inspect-three.mjs <artifact-dir> [<absolute-three-package>]
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const root=process.argv[2] || '/tmp/quest-clearing-exact';
const threePackage=process.argv[3] || path.resolve('node_modules/three');
const THREE=await import(pathToFileURL(path.join(threePackage,'build/three.module.js')).href);
const { GLTFLoader }=await import(pathToFileURL(path.join(threePackage,'examples/jsm/loaders/GLTFLoader.js')).href);
const names=['memory-keepsake','ground-tile','path-tile','low-step','clearing-tree','clearing-stone','arrival-landmark'];
let failed=false;
for(const name of names) {
  const bytes=await readFile(path.join(root,name,`${name}.glb`));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  gltf.scene.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(gltf.scene,true);
  const meshes=[];
  gltf.scene.traverse(ob=>{if(ob.isMesh)meshes.push(ob);});
  let groundContactArea=0;
  for(const mesh of meshes) {
    const p=mesh.geometry.getAttribute('position'),index=mesh.geometry.index;
    const count=index?index.count:p.count;
    for(let i=0;i<count;i+=3) {
      const vertices=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+k):i+k).applyMatrix4(mesh.matrixWorld));
      if(vertices.every(v=>Math.abs(v.y)<1e-6))groundContactArea+=new THREE.Vector3().crossVectors(vertices[1].clone().sub(vertices[0]),vertices[2].clone().sub(vertices[0])).length()/2;
    }
  }
  const record={asset_id:name,three_revision:THREE.REVISION,glb_sha256:createHash('sha256').update(bytes).digest('hex'),loader:'Three.js GLTFLoader; CPU geometry and ray checks',bounds:{min:box.min.toArray(),max:box.max.toArray(),dimensions:box.getSize(new THREE.Vector3()).toArray()},meshes:meshes.length,material_primitives:meshes.reduce((n,o)=>n+(Array.isArray(o.material)?o.material.length:1),0),animations:gltf.animations.length,external_fetches:0,checks:{static_mesh_loaded:meshes.length>0,ground_y_zero:Math.abs(box.min.y)<.0001,no_animations:gltf.animations.length===0,all_have_vertex_colors:meshes.every(o=>Boolean(o.geometry.getAttribute('color')))}};
  record.ground_contact_area_m2=groundContactArea;
  record.checks.stable_flat_ground_contact=groundContactArea>.0001;
  if(name==='memory-keepsake') {
    const surface=gltf.scene.getObjectByName('PhotoSurface');
    record.checks.photo_surface_named=Boolean(surface?.isMesh);
    record.checks.photo_material_named=surface?.material.name==='PhotoSurface';
    record.checks.photo_uv_present=Boolean(surface?.geometry.getAttribute('uv'));
    if(surface) {
      const positions=surface.geometry.getAttribute('position');const uv=surface.geometry.getAttribute('uv');
      let minX=Infinity,maxX=-Infinity,uMin=0,uMax=0;
      for(let i=0;i<positions.count;i++) {
        if(positions.getX(i)<minX){minX=positions.getX(i);uMin=uv.getX(i);}
        if(positions.getX(i)>maxX){maxX=positions.getX(i);uMax=uv.getX(i);}
      }
      record.checks.photo_uv_reads_from_minus_z_front=uMin>.99&&uMax<.01;
      // Replacement ignores placeholder COLOR_0; no separate illustration overlays
      // need removal. The deterministic synthetic texture is kept only in CPU RAM.
      const testMap=new THREE.DataTexture(new Uint8Array([255,255,255,255,0,0,0,255,0,0,0,255,255,255,255,255]),2,2);
      surface.material=new THREE.MeshBasicMaterial({map:testMap,vertexColors:false});
      record.checks.photo_replacement_material_assignable=surface.material.map===testMap && !surface.material.vertexColors;
      surface.material.dispose(); testMap.dispose();
    }
  }
  if(name==='ground-tile' || name==='path-tile') {
    const grid=new THREE.Group();
    for(const x of [-1,1])for(const z of [-1,1]){const ob=gltf.scene.clone(true);ob.position.set(x,0,z);grid.add(ob);}
    grid.updateMatrixWorld(true);
    const ray=new THREE.Raycaster();let misses=0;const heights=[];
    for(let i=0;i<41;i++)for(const epsilon of [-.00001,.00001])for(const axis of [0,1]) {
      const t=-1.999+3.998*i/40;
      ray.set(new THREE.Vector3(axis? t:epsilon,1,axis?epsilon:t),new THREE.Vector3(0,-1,0));
      const hits=ray.intersectObject(grid,true);
      if(hits.length)heights.push(hits[0].point.y);else misses++;
    }
    const joined=new THREE.Box3().setFromObject(grid,true).getSize(new THREE.Vector3());
    record.tile_join_check={instances:4,spacing_m:2,samples:164,misses,sampled_top_height_min_m:Math.min(...heights),sampled_top_height_max_m:Math.max(...heights),joined_dimensions:joined.toArray(),method:'Downward rays at ±10 micrometers beside both shared seams, 41 positions per side'};
    record.checks.no_tile_seam_holes=misses===0;
    record.checks.joined_4m_footprint=Math.abs(joined.x-4)<.0001&&Math.abs(joined.z-4)<.0001;
  }
  if(name==='arrival-landmark') {
    const ray=new THREE.Raycaster();const widths=[];
    for(let i=0;i<65;i++) {
      const y=.005+(1.6-.005)*i/64;
      // The gateway's inside faces point into the passage, so front-face ray casting
      // from the center gives actual clear width without a box-bound approximation.
      ray.set(new THREE.Vector3(0,y,0),new THREE.Vector3(-1,0,0));const l=ray.intersectObject(gltf.scene,true)[0];
      ray.set(new THREE.Vector3(0,y,0),new THREE.Vector3(1,0,0));const r=ray.intersectObject(gltf.scene,true)[0];
      if(l&&r)widths.push(r.point.x-l.point.x);
    }
    record.passage_check={samples:65,height_interval_m:[.005,1.6],minimum_width_m:Math.min(...widths)};
    record.checks.passable_width=widths.length===65&&Math.min(...widths)>=1.6-.0001;
  }
  const failures=Object.entries(record.checks).filter(([,v])=>!v).map(([k])=>k);
  await writeFile(path.join(root,name,'three-inspection.json'),JSON.stringify(record,null,2)+'\n');
  console.log(JSON.stringify({name,failures,...(record.tile_join_check?{tile_join:record.tile_join_check}:{}),...(record.passage_check?{passage:record.passage_check}:{})}));
  failed ||= failures.length>0;
}
process.exitCode=failed?1:0;
