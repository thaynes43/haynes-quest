/** Action minions A v001: exact GLTFLoader import, all-vertex 60 Hz motion bounds, part clearance and the
 * actual game adapter (src/game/enemy-animation.ts) for one candidate.
 *   node_modules/.bin/tsx scripts/assets/action-minions-a/v001/inspect-three.mjs <asset-id> <artifact-dir> [--write-bounds]
 * Run from the repo root. Adapted from the WO111 mischief-kitten / lab-robot v001 inspections.
 * glTF frame: +Y up, forward -Z, character right +X. */
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import sharp from 'sharp';
import {EnemyAnimation} from '../../../../src/game/enemy-animation.ts';
import {ASSETS} from './assets.mjs';
globalThis.self = globalThis;
const images = [];
globalThis.createImageBitmap = async blob => {
  const bytes = Buffer.from(await blob.arrayBuffer()), {data, info} = await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  images.push({width: info.width, height: info.height, encoded_bytes: bytes.length}); return {width: info.width, height: info.height, data, close() {}};
};
const id = process.argv[2], root = path.resolve(process.argv[3]), A = ASSETS[id];
if (!A) throw new Error('unknown asset ' + id);
const bytes = await readFile(path.join(root, id + '.glb'));
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const construction = JSON.parse(await readFile(path.join(root, 'construction.json'), 'utf8'));
const scene = gltf.scene, meshes = [], bones = [];
scene.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); if (o.isBone) bones.push(o); });
const B = n => scene.getObjectByName(n);
const pack = b => ({min: b.min.toArray(), max: b.max.toArray()});
const wp = o => o.getWorldPosition(new T.Vector3());
// dominant bone per vertex (stable across frames)
const dominant = meshes.map(mesh => { const ix = mesh.geometry.attributes.skinIndex, w = mesh.geometry.attributes.skinWeight, out = [];
  for (let i = 0; i < ix.count; i++) { let best = 0; for (let j = 1; j < 4; j++) if (w.getComponent(i, j) > w.getComponent(i, best)) best = j; out.push(mesh.skeleton.bones[ix.getComponent(i, best)].name); } return out; });
function points() {
  scene.updateMatrixWorld(true);
  let minimum = {y: Infinity}; const positions = [], groups = Object.fromEntries(bones.map(b => [b.name, []]));
  meshes.forEach((mesh, m) => { mesh.skeleton.update();
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
      const p = mesh.getVertexPosition(i, new T.Vector3()).applyMatrix4(mesh.matrixWorld); positions.push(p); const name = dominant[m][i];
      if (p.y < minimum.y) minimum = {y: p.y, bone: name, position: p.toArray()};
      groups[name].push(p);
    } });
  return {positions, groups, minimum, box: new T.Box3().setFromPoints(positions)};
}
const rest = points(), mixer = new T.AnimationMixer(scene), union = rest.box.clone(), animations = {}, bindings = [];
// rest-space oriented boxes for clearance checks: points of bone group `of`, in bone `frame`'s rest local space
const restInv = Object.fromEntries(bones.map(b => [b.name, b.matrixWorld.clone().invert()]));
const obb = {};
for (const [name, spec] of Object.entries(A.solids || {})) {
  // spec.min/max: an axis-aligned box in glTF rest coordinates, carried by bone spec.frame
  const corners = []; for (const x of [spec.min[0], spec.max[0]]) for (const y of [spec.min[1], spec.max[1]]) for (const z of [spec.min[2], spec.max[2]]) corners.push(new T.Vector3(x, y, z).applyMatrix4(restInv[spec.frame]));
  const b = new T.Box3().setFromPoints(corners); b.expandByScalar(-(spec.shrink ?? 0)); obb[name] = {box: b, frame: spec.frame};
}
const inside = (name, p) => obb[name].box.containsPoint(p.clone().applyMatrix4(B(obb[name].frame).matrixWorld.clone().invert()));
let maxInfluences = 0, maxWeightError = 0;
for (const mesh of meshes) { const w = mesh.geometry.attributes.skinWeight; for (let i = 0; i < w.count; i++) {
  const v = [w.getX(i), w.getY(i), w.getZ(i), w.getW(i)]; maxInfluences = Math.max(maxInfluences, v.filter(x => x > 1e-6).length); maxWeightError = Math.max(maxWeightError, Math.abs(v.reduce((a, b) => a + b, 0) - 1)); } }
const rootTracks = gltf.animations.flatMap(c => c.tracks.filter(t => t.name.startsWith('root.')).map(t => ({clip: c.name, track: t.name, constant: Array.from(t.values).every((x, i, a) => Math.abs(x - a[i % t.getValueSize()]) < 1e-7)})));
const holdFrom = construction.clips.find(c => c.name === 'defeat').held_final_pose_from_s;
const clearance = {};
let rootFixed = true;
for (const clip of gltf.animations) {
  for (const track of clip.tracks) {
    const binding = new T.PropertyBinding(scene, track.name); binding.bind(); const probe = new Float64Array(track.getValueSize()).fill(NaN); binding.getValue(probe, 0);
    bindings.push({clip: clip.name, track: track.name, node: binding.node?.name, resolves: probe.some(Number.isFinite), targets_scene_root: binding.node === scene});
  }
  mixer.stopAllAction(); const action = mixer.clipAction(clip).setLoop(T.LoopOnce, 1); action.clampWhenFinished = true; action.play();
  const total = Math.round(clip.duration * 60), bounds = new T.Box3(); let first, last, hold, heldDiff = 0, maxDisp = 0, floor = {y: Infinity};
  for (let i = 0; i <= total; i++) {
    const time = clip.duration * i / total; mixer.setTime(time); const s = points(); bounds.union(s.box);
    if (s.minimum.y < floor.y) floor = {...s.minimum, time_s: time};
    if (i === 0) first = s.positions; if (i === total) last = s.positions;
    for (let j = 0; j < s.positions.length; j++) maxDisp = Math.max(maxDisp, s.positions[j].distanceTo(first[j]));
    if (clip.name === 'defeat' && time >= holdFrom - 1e-6) { if (!hold) hold = s.positions; else for (let j = 0; j < hold.length; j++) heldDiff = Math.max(heldDiff, hold[j].distanceTo(s.positions[j])); }
    for (const [label, spec] of Object.entries(A.clearance || {})) {
      if (spec.clips && !spec.clips.includes(clip.name)) continue;
      const pts = spec.of.flatMap(g => s.groups[g] || []); let n = 0, worst = null;
      // mode 'outside' (default): no vertex may enter the solid; mode 'inside': every vertex must stay in it (hidden props)
      for (const p of pts) if (inside(spec.solid, p) !== (spec.mode === 'inside')) { n++; worst = worst ?? {time_s: time, point: p.toArray()}; }
      const key = label; clearance[key] ??= {pairs: spec, inside_vertices_max: 0, first: null, per_clip: {}};
      clearance[key].per_clip[clip.name] = Math.max(clearance[key].per_clip[clip.name] ?? 0, n);
      if (n > clearance[key].inside_vertices_max) { clearance[key].inside_vertices_max = n; clearance[key].first = {clip: clip.name, ...worst}; }
    }
    rootFixed &&= scene.position.length() < 1e-8 && scene.quaternion.angleTo(new T.Quaternion()) < 1e-8;
  }
  let seam = 0; for (let j = 0; j < first.length; j++) seam = Math.max(seam, first[j].distanceTo(last[j]));
  animations[clip.name] = {duration_s: clip.duration, samples: total + 1, vertices_per_sample: rest.positions.length, max_vertex_displacement_m: maxDisp, bounds_y_up: pack(bounds), loop_seam_max_m: seam, floor_minimum: floor, held_defeat_difference_m: clip.name === 'defeat' ? heldDiff : null};
  union.union(bounds);
}
const at = (clipName, t, fn) => { const clip = gltf.animations.find(c => c.name === clipName); mixer.stopAllAction(); const a = mixer.clipAction(clip).setLoop(T.LoopOnce, 1); a.clampWhenFinished = true; a.play(); mixer.setTime(t); const s = points(); const r = fn(s); mixer.stopAllAction(); scene.updateMatrixWorld(true); return r; };
const groupBox = (s, names) => new T.Box3().setFromPoints(names.flatMap(n => s.groups[n] || []));
// asset-specific beats
const beats = A.beats({at, B, wp, groupBox, T, rest, construction});
// actual adapter on a SkeletonUtils clone
const c1 = clone(scene), c2 = clone(scene), frozen = bones.map(b => b.matrix.toArray());
const adapter = new EnemyAnimation(c1, gltf.animations, A.contactFraction);
const frame = {id: 'action-minions-a-' + id, position: {x: 0, y: 0, z: 0}, facing: 0, phase: 'idle', windupProgress: 0, hp: 100, maxHp: 100};
const phases = []; const probe = A.contactProbe;
for (const phase of ['idle', 'chasing', 'windup', 'strike', 'cooldown']) {
  frame.phase = phase; for (let i = 0; i < 20; i++) { frame.windupProgress = Math.min(1, i / 15); adapter.update(frame, .05); }
  c1.updateMatrixWorld(true); phases.push({phase, visible: c1.visible, probe: wp(c1.getObjectByName(probe)).toArray()});
}
const direct = at('attack', 2.0 * A.contactFraction, () => wp(B(probe)));
frame.hp = 70; frame.phase = 'idle'; adapter.update(frame, .1);
for (let i = 0; i < 20; i++) adapter.update(frame, .05);
frame.phase = 'defeated'; let state; const defeatStates = [];
for (let i = 0; i < 80; i++) { state = adapter.update(frame, .05); if ([0, 20, 40, 52, 58, 79].includes(i)) defeatStates.push({time_s: (i + 1) * .05, ...state}); }
scene.updateMatrixWorld(true); c2.updateMatrixWorld(true);
const cloneIndependent = bones.every((b, i) => b.matrix.toArray().every((x, j) => Math.abs(x - frozen[i][j]) < 1e-10));
const stored = meshes[0].userData.model_space_bounds_y_up ?? meshes[0].parent?.userData.model_space_bounds_y_up;
const body = groupBox(rest, A.bodyBones);
const checks = {
  five_exact_clips: gltf.animations.map(c => c.name).sort().join() === ['attack', 'defeat', 'hit', 'idle', 'move'].join(),
  attack_2_s: Math.abs(gltf.animations.find(c => c.name === 'attack').duration - 2) < 1e-6,
  all_tracks_resolve_below_scene_root: bindings.every(b => b.resolves && !b.targets_scene_root),
  no_root_motion: rootFixed && rootTracks.every(t => t.constant),
  all_clips_move_vertices: Object.values(animations).every(a => a.max_vertex_displacement_m > .01),
  idle_move_seamless: ['idle', 'move'].every(n => animations[n].loop_seam_max_m < 1e-4),
  held_defeat: animations.defeat.held_defeat_difference_m < 1e-5,
  no_floor_penetration: Object.values(animations).every(a => a.bounds_y_up.min[1] >= -1e-4),
  at_most_four_influences: maxInfluences <= 4, normalized_weights: maxWeightError < 1e-4,
  height_1_3_to_1_6_m: rest.box.max.y >= 1.3 && rest.box.max.y <= 1.6,
  standing_on_floor: rest.box.min.y >= -1e-4 && rest.box.min.y < .01,
  floor_centred_body: Math.abs(body.max.x + body.min.x) < .06 && Math.abs(body.max.z + body.min.z) < .08,
  one_1024_atlas: images.length === 1 && images[0].width === 1024 && images[0].height === 1024,
  two_draw_primitives: meshes.length === 2,
  exported_bounds_cover_all_poses: !!stored && union.min.toArray().every((v, i) => v >= stored.min[i]) && union.max.toArray().every((v, i) => v <= stored.max[i]),
  actual_adapter_contact_pose: new T.Vector3(...phases.find(p => p.phase === 'windup').probe).distanceTo(direct) < 1e-4,
  actual_adapter_defeat_vanish: state.visible === false && state.vanish === 1,
  adapter_root_identity: c1.position.length() < 1e-8 && c1.scale.distanceTo(new T.Vector3(1, 1, 1)) < 1e-8,
  independent_skeleton_clone: cloneIndependent,
  ...Object.fromEntries(Object.entries(clearance).map(([k, v]) => ['clear_' + k, v.inside_vertices_max === 0])),
  ...beats.checks,
};
const bounds = {method: 'All exact exported skin vertices, rest and every clip at 60 Hz; 0.005 m padding per axis.', safe_culling_envelope: {min: union.min.toArray().map(n => Math.floor((n - .005) * 1000) / 1000), max: union.max.toArray().map(n => Math.ceil((n + .005) * 1000) / 1000)}};
if (process.argv.includes('--write-bounds')) await writeFile(path.join(root, 'bounds.json'), JSON.stringify(bounds, null, 2) + '\n');
const record = {asset_id: id, version: 'v001', glb_sha256: createHash('sha256').update(bytes).digest('hex'), three_revision: T.REVISION,
  method: 'Exact GLTFLoader import of the GLB bytes; every exported skin vertex sampled at 60 Hz in every clip; SkeletonUtils clones driven by the real src/game/enemy-animation.ts adapter. Part clearance uses rest-space boxes of the named bone groups (dominant skin weight), so it is a proxy, not triangle collision. No physical-device claim.',
  rest_bounds_y_up: pack(rest.box), all_animation_bounds_y_up: pack(union), height_m: rest.box.max.y, dimensions_m: rest.box.getSize(new T.Vector3()).toArray(), body_footprint_y_up: pack(body),
  exported_bounds: stored ?? null, root_bone_tracks: rootTracks, animations, clearance, images, max_skin_influences: maxInfluences, max_weight_sum_error: maxWeightError,
  adapter: {contact_fraction: A.contactFraction, probe, phases, direct_contact_probe: direct.toArray(), defeat_states: defeatStates}, beats: beats.data, checks};
await writeFile(path.join(root, 'three-inspection.json'), JSON.stringify(record, null, 2) + '\n');
const failures = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
console.log(JSON.stringify({asset: id, failures, height: rest.box.max.y, rest: record.rest_bounds_y_up, animated: record.all_animation_bounds_y_up,
  floor: Object.fromEntries(Object.entries(animations).map(([k, a]) => [k, [+a.bounds_y_up.min[1].toFixed(4), a.floor_minimum.bone, +a.floor_minimum.time_s.toFixed(3)]])),
  clearance: Object.fromEntries(Object.entries(clearance).map(([k, v]) => [k, [v.inside_vertices_max, v.first]])), beats: beats.data}, null, 0));
process.exitCode = failures.length ? 1 : 0;
