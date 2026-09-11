/** Read the real GLBs through Three.js GLTFLoader and exercise every clip.
 * node scripts/assets/travelers/inspect-three.mjs docs/assets/media [node_modules/three]
 * This is a CPU skinning/scene contract check, not GPU or Safari validation.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const media = path.resolve(process.argv[2] || 'docs/assets/media');
const threeRoot = path.resolve(process.argv[3] || 'node_modules/three');
const THREE = await import(pathToFileURL(path.join(threeRoot, 'build/three.module.js')).href);
const { GLTFLoader } = await import(pathToFileURL(path.join(threeRoot, 'examples/jsm/loaders/GLTFLoader.js')).href);
const packageJson = JSON.parse(await readFile(path.join(threeRoot, 'package.json')));
let failed = false;
for (const stage of ['infant', 'child']) {
  const folder = path.join(media, `traveler-${stage}`, 'v001');
  const bytes = await readFile(path.join(folder, `traveler-${stage}.glb`));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);
  const box = () => new THREE.Box3().setFromObject(scene, true);
  const pack = (b) => ({ min: b.min.toArray(), max: b.max.toArray() });
  const rest = box();
  const mixer = new THREE.AnimationMixer(scene);
  const animations = {};
  const rootBone = scene.getObjectByName('root');
  let rootFixed = true;
  for (const clip of gltf.animations) {
    mixer.stopAllAction();
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    const union = new THREE.Box3();
    let changed = false;
    const samples = [];
    for (let i = 0; i <= 32; i++) {
      mixer.setTime(clip.duration * i / 32);
      scene.updateMatrixWorld(true);
      const b = box();
      union.union(b);
      samples.push(pack(b));
      changed ||= !b.min.equals(rest.min) || !b.max.equals(rest.max);
      rootFixed &&= rootBone.position.length() < .0001;
    }
    animations[clip.name] = { duration_s: clip.duration, samples: 33, bounds: pack(union), has_motion: changed };
  }
  mixer.stopAllAction();
  scene.updateMatrixWorld(true);
  const before = box();
  const translation = new THREE.Vector3(2, 0, -3);
  scene.position.copy(translation);
  scene.updateMatrixWorld(true);
  const after = box();
  const error = after.min.clone().sub(before.min).sub(translation).length() + after.max.clone().sub(before.max).sub(translation).length();
  const skinned = [];
  scene.traverse((object) => { if (object.isSkinnedMesh) skinned.push(object); });
  const height = stage === 'infant' ? .75 : 1.2;
  const checks = {
    loader_without_decoder: true,
    skinned_mesh_present: skinned.length > 0,
    exact_physical_height: Math.abs(rest.max.y - rest.min.y - height) < .0001,
    standing_ground_origin: Math.abs(rest.min.y) < .0001,
    all_expected_clips: ['idle', 'move', 'interact', ...(stage === 'child' ? ['jump'] : [])].every((name) => animations[name]),
    all_clips_move_geometry: Object.values(animations).every((clip) => clip.has_motion),
    root_bone_fixed: rootFixed,
    external_scene_translation_correct: error < .0001,
    finite_bounds: [...rest.min.toArray(), ...rest.max.toArray(), ...Object.values(animations).flatMap((a) => [...a.bounds.min, ...a.bounds.max])].every(Number.isFinite),
    no_large_floor_penetration: Object.values(animations).every((clip) => clip.bounds.min[1] >= -.004),
  };
  const report = { stage, tool: 'Three.js GLTFLoader + AnimationMixer + CPU skinned bounds', three_version: packageJson.version,
    sha256: createHash('sha256').update(bytes).digest('hex'), rest_bounds_y_up: pack(rest), animations,
    mesh_primitives: skinned.length, bones_per_primitive: skinned.map((m) => m.skeleton.bones.length), checks,
    limitations: 'No WebGL rasterization, browser, GPU, touch or physical Safari performance is claimed.' };
  await writeFile(path.join(folder, 'three-inspection.json'), JSON.stringify(report, null, 2) + '\n');
  const failures = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key);
  console.log(JSON.stringify({ stage, three: packageJson.version, failures, clips: Object.keys(animations), rest: pack(rest), floor_min: Object.fromEntries(Object.entries(animations).map(([name, value]) => [name, value.bounds.min[1]])) }));
  failed ||= failures.length > 0;
  mixer.uncacheRoot(scene);
}
process.exitCode = failed ? 1 : 0;
