/** Action minions B v001: exact GLTFLoader + the real game adapter (src/game/enemy-animation.ts).
 * node_modules/.bin/tsx scripts/assets/action-minions-b/v001/inspect-three.mjs <asset-id> <glb> <out.json>
 * All exported skin vertices sampled at 60 Hz for every clip; SkeletonUtils clones; adapter phases. */
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {EnemyAnimation, enemyClipNames} from '../../../../src/game/enemy-animation.ts';
const [id, glbPath, outPath] = process.argv.slice(2);
const cfg = JSON.parse(await readFile(new URL('./assets.json', import.meta.url), 'utf8'))[id];
const bytes = await readFile(glbPath);
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const scene = gltf.scene, meshes = [], bones = [];
scene.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); if (o.isBone) bones.push(o); });
const B = (n) => scene.getObjectByName(n), wp = (o) => o.getWorldPosition(new T.Vector3());
const pack = (b) => ({min: b.min.toArray(), max: b.max.toArray()});
function points() {
  scene.updateMatrixWorld(true); const out = [];
  for (const m of meshes) { m.skeleton.update(); for (let i = 0; i < m.geometry.attributes.position.count; i++) out.push(m.getVertexPosition(i, new T.Vector3()).applyMatrix4(m.matrixWorld)); }
  return out;
}
const box = (p) => new T.Box3().setFromPoints(p);
const rest = points(), restBox = box(rest), feetBox = box(rest.filter((p) => p.y < 0.06));  // standing footprint: soles and toes below 6 cm
const mixer = new T.AnimationMixer(scene), animations = {}, bindings = [];
const play = (name, t) => { mixer.stopAllAction(); const a = mixer.clipAction(gltf.animations.find((c) => c.name === name)).setLoop(T.LoopOnce, 1); a.clampWhenFinished = true; a.play(); mixer.setTime(t); scene.updateMatrixWorld(true); };
const union = restBox.clone();
for (const clip of gltf.animations) {
  for (const track of clip.tracks) { const b = new T.PropertyBinding(scene, track.name); b.bind(); const probe = new Float64Array(track.getValueSize()).fill(NaN); b.getValue(probe, 0); bindings.push({clip: clip.name, track: track.name, node: b.node?.name, resolves: probe.some(Number.isFinite), targets_scene_root: b.node === scene}); }
  const total = Math.round(clip.duration * 60), bounds = new T.Box3(); let first, last, maxMove = 0, held = 0, holdRef = null, floor = {y: Infinity};
  const holdFrom = clip.name === 'defeat' ? cfg.defeat_hold_s ?? null : null;
  for (let i = 0; i <= total; i++) {
    const t = clip.duration * i / total; play(clip.name, t); const p = points(); const b = box(p); bounds.union(b);
    if (b.min.y < floor.y) floor = {y: b.min.y, time_s: t};
    if (i === 0) first = p; if (i === total) last = p;
    for (let j = 0; j < p.length; j += 7) maxMove = Math.max(maxMove, p[j].distanceTo(first[j]));
    if (holdFrom !== null && t >= holdFrom - 1e-9) { if (!holdRef) holdRef = p; else for (let j = 0; j < p.length; j += 3) held = Math.max(held, p[j].distanceTo(holdRef[j])); }
  }
  let seam = 0; for (let j = 0; j < first.length; j++) seam = Math.max(seam, first[j].distanceTo(last[j]));
  animations[clip.name] = {duration_s: clip.duration, samples: total + 1, vertices_per_sample: rest.length, bounds_y_up: pack(bounds), floor, max_vertex_travel_m: maxMove, loop_seam_m: seam, held_defeat_motion_m: holdFrom !== null ? held : null};
  union.union(bounds);
}
// facing and strike direction: the face sits on -Z (adapter forward); the strike limb drives toward -Z at contact
play('idle', 0); const face = wp(B(cfg.front_bone)), strike0 = wp(B(cfg.strike_bone));
play('attack', 1.25); const strike = wp(B(cfg.strike_bone));
play('attack', 0.25 * 2.0); const telegraph = wp(B(cfg.strike_bone));
const burst = {};
if (cfg.burst_bone) { const ws = () => B(cfg.burst_bone).getWorldScale(new T.Vector3()).x; play('idle', 0); burst.idle0 = ws(); play('attack', 1.0); burst.windup = ws(); play('attack', 1.42); burst.contact = ws(); }
const envelope = meshes[0].parent?.userData?.model_space_bounds_y_up ?? meshes[0].userData?.model_space_bounds_y_up ?? (() => { let e; scene.traverse((o) => { if (o.userData?.model_space_bounds_y_up) e = o.userData.model_space_bounds_y_up; }); return e; })();
// adapter: the exact runtime class, on an independent SkeletonUtils clone
mixer.stopAllAction(); scene.updateMatrixWorld(true);
const first = clone(scene), second = clone(scene); const frozen = bones.map((b) => b.matrix.toArray());
const adapter = new EnemyAnimation(first, gltf.animations, 0.625);
const frame = {id: 'inspect-' + id, position: {x: 0, y: 0, z: 0}, facing: 0, phase: 'idle', windupProgress: 0, hp: 100, maxHp: 100};
const phases = [];
for (const phase of ['idle', 'chasing', 'windup', 'strike', 'cooldown']) {
  frame.phase = phase; for (let i = 0; i < 20; i++) { frame.windupProgress = Math.min(1, i / 15); adapter.update(frame, 0.05); }
  first.updateMatrixWorld(true); phases.push({phase, visible: first.visible, strike_bone: wp(first.getObjectByName(cfg.strike_bone)).toArray()});
}
frame.hp = 60; frame.phase = 'idle'; const hitState = adapter.update(frame, 0.1);
for (let i = 0; i < 20; i++) adapter.update(frame, 0.05);
frame.phase = 'defeated'; let state; const defeatStates = [];
for (let i = 0; i < 80; i++) { state = adapter.update(frame, 0.05); if ([0, 20, 40, 50, 60, 79].includes(i)) defeatStates.push({t: +((i + 1) * 0.05).toFixed(2), ...state}); }
const cloneIndependent = bones.every((b, i) => b.matrix.toArray().every((x, j) => Math.abs(x - frozen[i][j]) < 1e-10)) && second !== first;
adapter.dispose();
const materials = [...new Set(meshes.map((m) => m.material))];
let maxInf = 0, wErr = 0; for (const m of meshes) { const w = m.geometry.attributes.skinWeight; for (let i = 0; i < w.count; i++) { const v = [w.getX(i), w.getY(i), w.getZ(i), w.getW(i)]; maxInf = Math.max(maxInf, v.filter((x) => x > 1e-6).length); wErr = Math.max(wErr, Math.abs(v.reduce((a, b) => a + b, 0) - 1)); } }
const atWindup = phases.find((p) => p.phase === 'windup');
const checks = {
  five_exact_clips: gltf.animations.map((c) => c.name).sort().join() === [...enemyClipNames].sort().join(),
  all_tracks_bind_below_scene_root: bindings.every((b) => b.resolves && !b.targets_scene_root),
  every_clip_moves_vertices: Object.values(animations).every((a) => a.max_vertex_travel_m > 0.01),
  seamless_idle_and_move: ['idle', 'move'].every((n) => animations[n].loop_seam_m < 1e-4),
  attack_2s_contact_1_25: Math.abs(animations.attack.duration_s - 2) < 1e-6,
  defeat_final_pose_held: animations.defeat.held_defeat_motion_m !== null && animations.defeat.held_defeat_motion_m < 1e-5,
  no_floor_penetration: Object.values(animations).every((a) => a.floor.y >= -1e-4) && restBox.min.y >= -1e-4,
  standing_on_floor_at_rest: restBox.min.y < 0.01,
  height_in_range: restBox.max.y >= cfg.height[0] && restBox.max.y <= cfg.height[1],
  footprint_centred: Math.abs(feetBox.min.x + feetBox.max.x) < 0.08 && Math.abs(feetBox.min.z + feetBox.max.z) < 0.12,
  faces_minus_z: face.z < -0.05,
  strike_drives_forward_at_contact: strike.z < strike0.z - (cfg.strike_min_forward ?? 0.15),
  ...(cfg.burst_bone ? {burst_opens_only_at_contact: burst.contact > 4 && burst.idle0 < 1.01 && burst.windup < 1.01} : {}),
  envelope_covers_all_poses: !!envelope && union.min.toArray().every((v, i) => v >= envelope.min[i] - 1e-6) && union.max.toArray().every((v, i) => v <= envelope.max[i] + 1e-6),
  two_vertex_coloured_standard_materials: materials.length === 2 && materials.every((m) => m.isMeshStandardMaterial && m.vertexColors && !m.map),
  at_most_four_influences: maxInf <= 4, normalized_weights: wErr < 1e-4,
  adapter_constructs_and_vanishes: state.visible === false && state.vanish === 1,
  adapter_windup_holds_contact_pose: new T.Vector3(...atWindup.strike_bone).distanceTo(strike) < 1e-4,
  adapter_root_untouched: first.position.length() < 1e-9 && first.quaternion.angleTo(new T.Quaternion()) < 1e-9 && first.scale.distanceTo(new T.Vector3(1, 1, 1)) < 1e-9,
  independent_skeleton_clone: cloneIndependent,
};
const record = {asset_id: id, version: 'v001', glb_sha256: createHash('sha256').update(bytes).digest('hex'), three_revision: T.REVISION,
  method: 'Exact GLTFLoader parse; every exported skin vertex at 60 Hz per clip; SkeletonUtils clones; the actual src/game/enemy-animation.ts adapter driven through idle/chasing/windup/strike/cooldown/hit/defeated. No physical-device claim.',
  height_m: restBox.max.y, rest_bounds_y_up: pack(restBox), footprint_below_0_06_m: pack(feetBox), all_animation_bounds_y_up: pack(union), exported_envelope: envelope, animations,
  facing: {front_bone: cfg.front_bone, position: face.toArray()}, strike: {bone: cfg.strike_bone, idle0: strike0.toArray(), telegraph_0_5s: telegraph.toArray(), contact_1_25s: strike.toArray(), burst_bone: cfg.burst_bone ?? null, burst_world_scale: burst},
  adapter: {phases, hit_state: hitState, defeat_states: defeatStates}, max_influences: maxInf, max_weight_error: wErr,
  materials: materials.map((m) => ({name: m.name, type: m.type, vertexColors: m.vertexColors, roughness: m.roughness})), track_count: bindings.length, checks};
await writeFile(outPath, JSON.stringify(record, null, 2) + '\n');
const failures = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
console.log(JSON.stringify({id, height: restBox.max.y, failures, floor: Object.fromEntries(Object.entries(animations).map(([k, a]) => [k, +a.floor.y.toFixed(4)]))}));
process.exitCode = failures.length ? 1 : 0;
