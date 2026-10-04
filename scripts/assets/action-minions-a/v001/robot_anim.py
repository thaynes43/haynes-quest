"""lab-robot-sentry v001 acting, baked at 60 fps into exactly five NLA clips (no root motion).

idle   2.4 s loop  the concept stance at 0 s; it bobs on its knees and scans left and right, the lens glances and
                   pulses, the antenna wobbles on its spring and each pincer snips once
move   1.0 s loop  a stompy two-step march in place: each boot lifts, swings forward and plants while the other
                   slides back; the pelvis bobs and sways, the shell counter-rolls, the arms swing and the pincers
                   clack, the antenna bounces
attack 2.0 s       tell (0-0.45 s): the lens flares and flickers, the antenna buzzes, it crouches and spreads both
                   pincers wide open; wind-up (0.45-1.0 s): it leans back with both pincers raised high; strike: it
                   lunges a step forward and swings both pincers down together, clamping shut in front of its lens at
                   the 1.25 s contact; then it steps back to the concept stance
hit    0.6 s       jolts back, the lens shrinks to a dot, the antenna whips, the pincers snap open and settle
defeat 2.4 s       it sputters (shell twitching, lens flickering and dimming, antenna drooping), its knees buckle and
                   it sits down hard, then tips over onto its back with both boots in the air and the pincers flopped
                   open on the floor; held from 1.95 s with the lens shrunk and the antenna drooped
"""
import bpy, math, json, importlib.util
from pathlib import Path
from mathutils import Vector, Matrix, Euler, Quaternion
SRC = Path('/workspace/haynes-quest/action-worlds/minions-a/v001/source')
def load(name):
    spec = importlib.util.spec_from_file_location('mna_' + name, SRC / (name + '.py')); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
C = load('common'); RR = load('robot_rig')
V = C.V; smooth = C.smooth
ASSET = 'lab-robot-sentry'; ROOT = C.PACK / ASSET
FPS = 60; CONTACT_S = 1.25; HOLD_S = 1.95
CLIPS = [('idle', 2.4, True), ('move', 1.0, True), ('attack', 2.0, False), ('hit', .6, False), ('defeat', 2.4, False)]
SCALED = {'lens'}

def E(x=0, y=0, z=0): return Euler((math.radians(x), math.radians(y), math.radians(z)), 'XYZ').to_quaternion()
def T(v): return Matrix.Translation(Vector(v))
def lerp(a, b, s):
    if isinstance(a, Quaternion): return a.slerp(b, s)
    if isinstance(a, (tuple, list)): a, b = Vector(a), Vector(b)
    return a + (b - a) * s
def keyed(t, keys, ease=smooth):
    if t <= keys[0][0]: v = keys[0][1]; return Vector(v) if isinstance(v, (tuple, list)) else v
    for (a, x), (b, y) in zip(keys, keys[1:]):
        if t <= b: return lerp(x, y, ease((t - a) / (b - a)) if b > a else 1)
    v = keys[-1][1]; return Vector(v) if isinstance(v, (tuple, list)) else v
def ease_in(s): s = max(0, min(1, s)); return s * s

arm = bpy.data.objects['Lab_Robot_Sentry_Rig']; skin = bpy.data.objects['Lab_Robot_Sentry_Skin']
RIG = C.Rig(arm)
WAIST = V(0, 0, RR.SHELL_Z0 + .02)
EYE_PIVOT = RR.EYE_C - V(0, .14, 0)
POLES = {s: RR.rest_pole(RR.HIP[s], RR.KNEE[s], RR.ANKLE[s]) for s in 'RL'}
LEN = {s: ((RR.KNEE[s] - RR.HIP[s]).length, (RR.ANKLE[s] - RR.KNEE[s]).length) for s in 'RL'}
REST_FT = {s: RR.frame_y(RR.KNEE[s] - RR.HIP[s], POLES[s]) for s in 'RL'}
REST_FS = {s: RR.frame_y(RR.ANKLE[s] - RR.KNEE[s], POLES[s]) for s in 'RL'}
JAW_AXIS = {'R': V(0, 1, 0), 'L': V(0, -1, 0)}
REACH = [0.0]

def rest_params():
    return {'outer': Matrix.Identity(4), 'pelvis_D': None, 'pelvis_off': V(0, 0, 0), 'pelvis_q': Quaternion(), 'shell_q': Quaternion(), 'eye_q': Quaternion(), 'lens': 1.0,
            'ant': (Quaternion(), Quaternion()), 'shoulder': {s: Quaternion() for s in 'RL'}, 'elbow': {s: Quaternion() for s in 'RL'}, 'wrist': {s: Quaternion() for s in 'RL'},
            'jaw': {s: 0.0 for s in 'RL'}, 'foot': {s: (V(0, 0, 0), Quaternion()) for s in 'RL'}, 'foot_D': {s: None for s in 'RL'}, 'knee_up': 0.0}

def pose(P):
    O = P['outer']; D = {}
    Dp = P['pelvis_D'] if P['pelvis_D'] is not None else T(P['pelvis_off']) @ C.rot_about(RR.PELVIS_C, P['pelvis_q'])
    D['pelvis'] = O @ Dp
    D['shell'] = D['pelvis'] @ C.rot_about(WAIST, P['shell_q'])
    D['eye'] = D['shell'] @ C.rot_about(EYE_PIVOT, P['eye_q'])
    D['lens'] = D['eye'] @ C.scale_about(RR.EYE_C + V(0, .045, 0), RIG.frame('lens'), (P['lens'],) * 3)   # shrink toward the lens face, in front of the dark socket
    D['ant_1'] = D['shell'] @ C.rot_about(RR.ANT_BASE, P['ant'][0]); D['ant_2'] = D['ant_1'] @ C.rot_about(RR.ANT_MID, P['ant'][1])
    for s in 'RL':
        D['shoulder_' + s] = D['shell'] @ C.rot_about(RR.SHOULDER[s], P['shoulder'][s]); D['upper_' + s] = D['shoulder_' + s]
        D['fore_' + s] = D['upper_' + s] @ C.rot_about(RR.ELBOW[s], P['elbow'][s])
        D['claw_' + s] = D['fore_' + s] @ C.rot_about(RR.WRIST[s], P['wrist'][s])
        h = RR.claw_hinge(s); a = math.radians(P['jaw'][s])
        D['jaw_%s_up' % s] = D['claw_' + s] @ C.rot_about(h, Quaternion(JAW_AXIS[s], a))
        D['jaw_%s_lo' % s] = D['claw_' + s] @ C.rot_about(h, Quaternion(JAW_AXIS[s], -a))
        off, q = P['foot'][s]
        Dk = O @ (P['foot_D'][s] if P['foot_D'][s] is not None else T(off) @ C.rot_about(RR.ANKLE[s], q)); D['foot_' + s] = Dk
        S = D['pelvis'] @ RR.HIP[s]; A = Dk @ RR.ANKLE[s]; pole = D['pelvis'].to_quaternion() @ POLES[s].lerp(V(0, .25, 1).normalized(), P['knee_up']); L1, L2 = LEN[s]
        REACH[0] = max(REACH[0], (A - S).length - (L1 + L2), abs(L1 - L2) - (A - S).length)
        K = RR.two_bone(S, A, L1, L2, pole)
        D['thigh_' + s] = T(S) @ (RR.frame_y(K - S, pole) @ REST_FT[s].inverted()).to_4x4() @ T(-RR.HIP[s])
        D['shin_' + s] = T(K) @ (RR.frame_y(A - K, pole) @ REST_FS[s].inverted()).to_4x4() @ T(-RR.KNEE[s])
    return D

def arms(P, pitch=0.0, spread=0.0, elbow=0.0, jaw=0.0, side=None, inward=0.0):
    """Shoulder: spread (+ raises the hanging arm out to the side), then pitch (+ swings it forward), then inward
    (+ swings a forward-pointing arm toward the middle, about the vertical axis); elbow bend (+ forward)."""
    for s in ('RL' if side is None else side):
        sg = 1 if s == 'R' else -1; pt = pitch[s] if isinstance(pitch, dict) else pitch
        P['shoulder'][s] = E(0, 0, sg * inward) @ E(pt, 0, 0) @ E(0, -sg * spread, 0)
        P['elbow'][s] = E(elbow, 0, 0); P['jaw'][s] = jaw if not isinstance(jaw, dict) else jaw[s]

# ---------------------------------------------------------------- clips
def idle(t):
    P = rest_params(); w = math.tau * t / 2.4; b = .5 - .5 * math.cos(2 * w)
    P['pelvis_off'] = V(.008 * math.sin(w), 0, -.014 * b)
    P['shell_q'] = E(1.5 * math.sin(2 * w), 2 * math.sin(w), 14 * math.sin(w))
    P['eye_q'] = E(3 * math.sin(3 * w), 0, 6 * math.sin(w + .0))
    P['lens'] = 1 + .06 * math.sin(3 * w)
    P['ant'] = (E(5 * math.sin(2 * w), 4 * math.sin(w), 0), E(6 * math.sin(2 * w) + 5 * math.sin(4 * w), 6 * math.sin(w) + 3 * math.sin(3 * w), 0))
    snip = {'R': 26 * C.bell(t, .7, .12), 'L': 26 * C.bell(t, 1.9, .12)}
    arms(P, pitch=4 * math.sin(w), spread=3 * b, elbow=5 * b, jaw=snip)
    return P

def move(t):
    P = rest_params(); u = t / 1.0; w = math.tau * u; stride = .11
    for s, ph0 in (('R', 0.0), ('L', .5)):
        ph = (u + ph0) % 1.0
        if ph < .5:   # swing: lift and bring forward
            k = smooth(ph / .5); y = -stride + 2 * stride * k; z = .1 * math.sin(math.pi * ph / .5); pitch = 10 * math.sin(math.pi * ph / .5) * (1 if k < .5 else -.6)
        else:         # stance: planted, sliding back
            k = (ph - .5) / .5; y = stride - 2 * stride * k; z = 0.0; pitch = 0.0
        P['foot'][s] = (V(0, y, z), E(pitch * (z / .1 if z > 0 else 0), 0, 0))
    plant = abs(math.cos(w))
    P['pelvis_off'] = V(.03 * math.sin(w), .0, -.03 + .025 * (1 - plant)); P['pelvis_q'] = E(0, -3 * math.sin(w), 5 * math.sin(w))
    P['shell_q'] = E(-5, 4 * math.sin(w), -4 * math.sin(w))
    swing = {'R': -20 * math.sin(w), 'L': 20 * math.sin(w)}
    arms(P, pitch=swing, spread=4, elbow=10, jaw={'R': 14 + 14 * math.sin(2 * w), 'L': 14 - 14 * math.sin(2 * w)})
    P['ant'] = (E(-6 + 6 * math.sin(2 * w + .5), 0, 0), E(10 * math.sin(2 * w - .4), 5 * math.sin(w), 0)); P['lens'] = 1.0; P['eye_q'] = E(-2, 0, 0)
    return P

def attack(t):
    P = rest_params()
    tell = C.bell(t, .25, .26) if t < .45 else 0.0
    wind = keyed(t, [(0, 0.0), (.45, 0.0), (.95, 1.0), (1.08, .7), (1.25, 0.0), (2, 0.0)])
    lunge = keyed(t, [(0, 0.0), (1.0, 0.0), (1.25, 1.0), (1.45, 1.0), (2, 0.0)])
    crouch = keyed(t, [(0, 0.0), (.3, 1.0), (.95, 1.3), (1.25, 1.5), (1.45, 1.2), (2, 0.0)])
    P['pelvis_off'] = V(0, .14 * lunge - .03 * wind, -.03 * crouch); P['pelvis_q'] = E(-6 * lunge, 0, 0)
    P['foot']['R'] = (V(0, .24 * lunge, .09 * math.sin(math.pi * min(1, max(0, (t - 1.0) / .2)))), Quaternion())
    P['shell_q'] = E(8 * wind + 4 * tell - 9 * lunge, 0, 0)
    P['lens'] = 1 + .22 * tell + .08 * math.sin(math.tau * 9 * t) * tell + .15 * keyed(t, [(0, 0.0), (1.2, 0.0), (1.27, 1.0), (1.6, 0.0)])
    buzz = 14 * math.sin(math.tau * 11 * t) * tell
    P['ant'] = (E(buzz, buzz * .6, 0), E(-buzz * 1.2 + 25 * keyed(t, [(0, 0.0), (1.2, 0.0), (1.3, 1.0), (1.6, -.4), (1.8, 0.0)]), 0, 0))
    # arms: tell spreads them open, wind-up raises them high and back, strike swings both forward and down to meet in front
    pitch = 10 * tell - 152 * wind + 80 * lunge
    spread = 30 * tell + 30 * wind
    elbow = 8 * tell + 20 * wind + 14 * lunge
    inward = 41 * lunge
    jaw = 42 * max(tell, wind) + 30 * keyed(t, [(0, 0.0), (1.0, 0.0), (1.15, 1.0), (1.22, 0.0)]) - 16 * keyed(t, [(0, 0.0), (1.21, 0.0), (1.25, 1.0), (1.45, 1.0), (1.6, 0.0)])
    arms(P, pitch=pitch, spread=spread, elbow=elbow, jaw=jaw, inward=inward)
    for s in 'RL': P['wrist'][s] = E(0, 0, (1 if s == 'R' else -1) * 20 * lunge)
    return P

def hit(t):
    P = rest_params()
    k = keyed(t, [(0, 0.0), (.07, 1.0), (.3, .3), (.6, 0.0)])
    P['pelvis_off'] = V(0, -.04 * k, -.015 * k); P['shell_q'] = E(13 * k, 0, 0)
    P['lens'] = 1 - .45 * keyed(t, [(0, 0.0), (.05, 1.0), (.3, 1.0), (.45, 0.0)])
    whip = 30 * math.sin(math.tau * 4 * t) * (1 - t / .6)
    P['ant'] = (E(-whip * .5, 0, 0), E(-whip, 0, 0))
    arms(P, pitch=-15 * k, spread=28 * k, elbow=-5 * k, jaw=40 * k)
    return P

# ---- defeat: sit, then tip over onto the back; the final lying pose is solved so the lowest point rests on the floor
SIT_DROP = .5; SIT_FEET = .3
TIP_PIVOT = V(0, -.19, RR.PELVIS_C.z - .09 - SIT_DROP)
def sit_D(s):  return T(V(0, -.04 * s, -SIT_DROP * s)) @ C.rot_about(RR.PELVIS_C, E(-8 * s))
def tip_D(s, lift=0.0): return T(V(0, 0, -lift * s)) @ C.rot_about(TIP_PIVOT, E(84 * s)) @ sit_D(1.0)
def lie_lift():
    """How far the fully tipped pose must drop so its lowest vertex rests on the floor (rigid parts: dominant-bone transform)."""
    P = defeat_params(HOLD_S, solve=False); D = RIG.complete(pose(P)); dom = []
    for v in skin.data.vertices:
        g = max(v.groups, key=lambda g: g.weight); dom.append((skin.vertex_groups[g.group].name, v.co))
    return min((D[b] @ co).z for b, co in dom)

def defeat_params(t, solve=True):
    P = rest_params()
    jolt = keyed(t, [(0, 0.0), (.06, 1.0), (.25, 0.0)])
    sput = keyed(t, [(0, 0.0), (.25, 1.0), (.8, 1.0), (1.0, 0.0)])
    sit = keyed(t, [(.8, 0.0), (1.2, 1.0)], ease_in) if t > .8 else 0.0
    tip = keyed(t, [(1.25, 0.0), (1.68, 1.0)], ease_in) if t > 1.25 else 0.0
    bounce = .025 * math.sin(math.pi * min(1, max(0, (t - 1.68) / .14))) if t > 1.68 else 0.0
    jit = sput * (4 * math.sin(math.tau * 13 * t) + 3 * math.sin(math.tau * 7.3 * t + 1))
    if tip > 0: P['pelvis_D'] = T(V(0, 0, bounce)) @ tip_D(tip, LIFT if solve else 0.0)
    elif sit > 0: P['pelvis_D'] = sit_D(sit)
    else: P['pelvis_off'] = V(0, -.04 * jolt, -.01 * jolt)
    P['shell_q'] = E(12 * jolt + jit * .6 + 10 * sit - 6 * tip, jit * .4, jit)
    for s in 'RL':
        if sit > 0 or tip > 0:
            feet = T(V(0, SIT_FEET * sit if tip == 0 else SIT_FEET, 0))
            P['foot_D'][s] = feet if tip == 0 else (P['pelvis_D'] @ sit_D(1.0).inverted() @ feet)
    P['lens'] = max(.32, 1 - .5 * jolt - .4 * sput * (.5 + .5 * math.sin(math.tau * 6 * t)) - .55 * min(1, sit + tip))
    droop = keyed(t, [(0, 0.0), (.3, 0.0), (1.0, 1.0)])
    P['ant'] = (E(40 * droop + 15 * jolt, 10 * droop, 0), E(55 * droop + 20 * math.sin(math.tau * 3 * t) * (1 - droop), 0, 0))
    P['eye_q'] = E(-10 * droop, 0, 8 * math.sin(math.tau * 2.5 * t) * sput)
    flop = min(1, sit + tip); P['knee_up'] = sit if tip == 0 else 1.0
    arms(P, pitch=-10 * jolt + 12 * sput * math.sin(math.tau * 5 * t) - 20 * flop, spread=25 * jolt + 30 * flop, elbow=-5 * flop, jaw=35 * jolt + 20 * flop)
    return P

def defeat(t): return defeat_params(t)
LIFT = 0.0
FN = {'idle': idle, 'move': move, 'attack': attack, 'hit': hit, 'defeat': defeat}
def evaluate(name, t):
    if name == 'defeat': t = min(t, HOLD_S)
    return pose(FN[name](t))

if __name__ == '__main__':
    C.guard(ASSET)
    LIFT = lie_lift(); print('solved lying drop (m):', LIFT)
    sc = bpy.context.scene; sc.frame_start = 0; sc.frame_end = 150
    ident = lambda D: max(max(abs(m[i][j] - (1 if i == j else 0)) for i in range(4) for j in range(4)) for m in RIG.complete(D).values())
    rest_err = ident(pose(rest_params())); idle0 = ident(evaluate('idle', 0))
    assert rest_err < 1e-5 and idle0 < 1e-5, ('bind/idle-0 pose is not the concept pose', rest_err, idle0)
    reach = {}
    for name, dur, loop in CLIPS:
        REACH[0] = -1.0
        for f in range(round(dur * FPS) + 1): evaluate(name, f / FPS)
        reach[name] = REACH[0]
    print('max IK overreach per clip (m, <= 0 means the boots stay attached):', json.dumps(reach))
    report = {'attack': {'contact_time_s': CONTACT_S, 'contact_fraction': CONTACT_S / 2.0, 'tell_s': [0.0, .45], 'windup_s': [.45, 1.0], 'strike_s': [1.0, CONTACT_S]},
              'defeat': {'held_final_pose_from_s': HOLD_S, 'sputter_s': [.25, 1.0], 'sit_s': [.8, 1.2], 'tip_s': [1.25, 1.68]}}
    records, shear = C.bake(RIG, CLIPS, evaluate, FPS, SCALED, report)
    arm['attack_contact_seconds'] = CONTACT_S; arm['attack_contact_fraction'] = CONTACT_S / 2.0
    bp = ROOT / 'bounds.json'
    if bp.exists():
        br = json.loads(bp.read_text()); skin['model_space_bounds_y_up'] = br['safe_culling_envelope']; skin['bounds_method'] = br['method']
    for name in ('common.py', 'robot_rig.py', 'robot_build.py', 'robot_anim.py'):
        old = bpy.data.texts.get('source ' + name)
        if old: bpy.data.texts.remove(old)
        bpy.data.texts.new('source ' + name).write((SRC / name).read_text())
    rec = json.loads((ROOT / 'construction.json').read_text()); rec['clips'] = records; rec['max_bone_shear'] = shear; rec['rest_reproduction_error'] = rest_err; rec['idle0_reproduction_error'] = idle0
    rec['fps'] = FPS; rec['scaled_bones'] = sorted(SCALED); rec['ik_max_overreach_m'] = reach; rec['defeat_lying_drop_m'] = LIFT
    bpy.ops.object.select_all(action='DESELECT'); skin.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / (ASSET + '.blend')), copy=True, compress=True)
    status = "action-minions-a lab-robot-sentry v001 · Awaiting Tom's review · candidate for the action worlds"
    C.export_glb(ROOT / (ASSET + '.glb'), skin, arm, {'asset_id': ASSET, 'asset_version': 'v001', 'pack': 'action-minions-a', 'candidate_status': status,
                 'source_reference': 'docs/assets/media/action-minions-a/v001/concept.png (coordinator image-generated construction reference, row 3)',
                 'source_concept_sha256': C.sha(C.PACK / 'concept.png'),
                 'orientation': 'glTF +Y up, forward -Z, floor-centred stationary root, character right +X',
                 'role': 'ordinary enemy (DESIGN-029 Hero City cast)', 'authoring_model': 'claude-opus-5-5 xhigh (Claude Code, Max plan)', 'design': 'DESIGN-029'})
    rec['files'] = {n: {'bytes': (ROOT / n).stat().st_size, 'sha256': C.sha(ROOT / n)} for n in (ASSET + '.blend', ASSET + '.glb', 'pigment.png')}
    (ROOT / 'construction.json').write_text(json.dumps(rec, indent=2) + '\n')
    print(json.dumps({'clips': [(r['name'], r['frames']) for r in records], 'shear': shear, 'files': rec['files']}))
