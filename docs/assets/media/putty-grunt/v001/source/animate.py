"""WO111 putty-grunt acting, baked at 30 fps into exactly five NLA clips.

The bind pose is the rig-friendly A-pose rest the sheet notes suggest; every clip except `move` starts from the
sheet's wobbly "hi-yah!" guard (head tilted 8 deg to its right, right mitten fist raised in front of the chest, left
fist low and out, knees bent on the bow-legged pancake feet), recreated at idle 0 s.

idle   2.0 s loop  wobbly double bounce in the guard with a clay squash on each dip; two quick "hi-yah" feints of the
                   right fist; the antenna jiggles a beat behind; one slow blink of the blank eyes
move   0.8 s loop  bouncy bow-legged waddle-jog: the pancake feet squash flat on every landing, the arms pump, the
                   body rocks side to side and the antenna flops
attack 2.0 s       clumsy double-fist swing. 0.00-0.55 hops back onto its heels and heaves both fists up over its
                   head, leaning back, tongue out in concentration; 0.55-1.08 teeters forward onto its toes with the
                   fists wobbling overhead; 1.08-1.20 swings both fists down in front, the clay arms stretching;
                   1.20-1.32 contact (1.25 s): the mitten fists squash flat on the target; 1.32-1.55 the arms snap back
                   like elastic ("boing"); 1.55-1.85 it nearly falls over backwards, windmilling its left arm;
                   1.85-2.00 settles back into the guard
hit    0.7 s       the whole body squashes sideways like poked clay with a big dent in the belly, the eyes squeeze
                   shut and the antenna springs, then it wobbles back into shape and the guard
defeat 2.4 s       it jolts, teeters backwards with its arms flying up, then melts into a flopped clay puddle: the
                   torso and head flatten, the legs splay flat and the arms flop out, while the two blank eyes, the
                   belt ring and the (drooping) antenna stick up out of the puddle; the antenna keeps wiggling, then
                   everything is held from 2.0 s

Rig notes: the clay body is one bone-heat skin. Legs hang from the root and are solved as two-bone world IK with
an analytic floor pivot (toe or heel) so hips squash never rescales them; every other bone is driven in its own
local basis (translation, rotation, scale), so the exported glTF TRS channels reproduce the Blender pose exactly
even where a parent is non-uniformly scaled. Counter-scaling bones keep shapes that must not squash: the eye and
antenna sockets, the fists (under the stretching forearms) and the belt (only in the defeat puddle). A numeric floor
guard skins the exact mesh each frame (linear blend skinning, as three.js does) and lifts the whole pose if any
vertex would dip below a 2.5 mm contact plane. No root motion; the root bone is never keyed.
"""
import bpy, math, json, hashlib
from pathlib import Path
import numpy as np
from mathutils import Vector, Matrix, Euler, Quaternion

ROOT = Path('/workspace/haynes-quest/family-eras/putty-grunt/v001')
FPS = 30
sc = bpy.context.scene
assert sc.get('work_order') == 'WO111' and sc.get('asset_id') == 'putty-grunt' and sc.get('scene_lease') == 'active'
assert sc.get('scene_owner') == 'claude-opus-5-5/putty-grunt-model'
arm = bpy.data.objects['Putty_Grunt_Rig']; skin = bpy.data.objects['Putty_Grunt_Skin']; bones = arm.data.bones
CLIPS = [('idle', 2.0, True), ('move', 0.8, True), ('attack', 2.0, False), ('hit', 0.7, False), ('defeat', 2.4, False)]
CONTACT_S = 1.25; DEFEAT_HOLD_S = 2.0
FLOOR = 0.0025
RIG = json.loads((ROOT / 'source/rig-rest.json').read_text()); LAY = RIG['layout']
EXPORT = globals().get('EXPORT', True)

def V(*a): return Vector(a)
def smooth(t): t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)
def bell(t, c, w): return smooth(1 - abs(t - c) / w)
def keyed(T, keys):
    """Smoothstep between (time, value) keys; values are floats or 3-vectors."""
    vec = isinstance(keys[0][1], (tuple, list, Vector))
    def val(x): return Vector(x) if vec else x
    if T <= keys[0][0]: return val(keys[0][1])
    for (a, x), (b, y) in zip(keys, keys[1:]):
        if T <= b:
            s = smooth((T - a) / (b - a)) if b > a else 1.0
            return val(x).lerp(val(y), s) if vec else x + (y - x) * s
    return val(keys[-1][1])
def RX(a): return Matrix.Rotation(a, 3, 'X')
def RY(a): return Matrix.Rotation(a, 3, 'Y')
def RZ(a): return Matrix.Rotation(a, 3, 'Z')
def RA(axis, a): return Matrix.Rotation(a, 3, Vector(axis).normalized())
I3 = Matrix.Identity(3)

RESTM = {b.name: b.matrix_local.copy() for b in bones}
RESTI = {k: m.inverted() for k, m in RESTM.items()}
R3 = {k: m.to_3x3().normalized() for k, m in RESTM.items()}
PARENT = {b.name: (b.parent.name if b.parent else None) for b in bones}
def depth(n):
    d = 0
    while PARENT[n]: n = PARENT[n]; d += 1
    return d
ORDER = sorted(RESTM, key=lambda n: (depth(n), n))
def head(n): return RESTM[n].translation.copy()
def tail(n): return bones[n].tail_local.copy()

def local(b, E=None, d=None, S=None):
    """Basis for bone b: rotation E (3x3, armature axes, about the bone head, in the parent's posed frame),
    translation d (armature axes of the parent's rest frame) and scale S (the bone's own local axes)."""
    R = R3[b]; Ri = R.transposed()
    rot = Ri @ (E if E is not None else I3) @ R
    M = Matrix.Translation(Ri @ Vector(d) if d is not None else Vector()) @ rot.to_4x4()
    if S is not None: M = M @ Matrix.Diagonal((S[0], S[1], S[2], 1.0))
    return M
def wscale(b, s):
    """Scale given along armature X, Y, Z for a bone whose rest axes are armature-aligned (the vertical chain)."""
    R = R3[b]; return [sum(abs(R[j][i]) * s[j] for j in range(3)) for i in range(3)]
def fk(B):
    P = {}
    for b in ORDER:
        p = PARENT[b]
        P[b] = (P[p] @ RESTI[p] @ RESTM[b] @ B[b]) if p else (RESTM[b] @ B[b])
    return P
def carried(P, b):
    """World matrix bone b would have with an identity basis under its posed parent."""
    p = PARENT[b]; return P[p] @ RESTI[p] @ RESTM[b]
def counter(P, b):
    M = carried(P, b).to_3x3(); return [1.0 / max(1e-6, M.col[i].length) for i in range(3)]

def solve_two(a, target, l1, l2, pole):
    delta = target - a; dist = min(max(delta.length, 1e-5), (l1 + l2) * .9995); d = delta.normalized()
    side = Vector(pole) - d * d.dot(Vector(pole))
    if side.length < 1e-5: side = V(0, 1, 0) - d * d.y
    side.normalize(); along = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist)
    return a + d * along + side * math.sqrt(max(0, l1 * l1 - along * along)), a + d * dist
def fbasis(a, n):
    a = a.normalized(); n = (n - a * a.dot(n)).normalized(); return Matrix((a, n, a.cross(n))).transposed()
def frame_rot(a0, n0, a1, n1): return fbasis(a1, n1) @ fbasis(a0, n0).transposed()
def slerp_dir(a, b, s):
    a = a.normalized(); b = b.normalized(); c = max(-1.0, min(1.0, a.dot(b))); w = math.acos(c)
    if w < 1e-5: return a.lerp(b, s).normalized()
    return ((math.sin((1 - s) * w) * a + math.sin(s * w) * b) / math.sin(w)).normalized()

# ---------------- arms: two-bone IK solved in the rest frame of the shoulder, driven as local FK ----------------
ARM = {}
for s in 'RL':
    S0, E0, W0 = head('upper_arm_' + s), head('forearm_' + s), head('fist_' + s)
    ARM[s] = dict(S0=S0, E0=E0, W0=W0, l1=(E0 - S0).length, l2=(W0 - E0).length, n0=(E0 - S0).cross(W0 - E0))
def arm_rot(s, wrist, pole, twist=0.0, wrist_E=None):
    """Local armature-axes rotations (upper rel. shoulder, forearm rel. upper, fist rel. forearm) that put the wrist
    on `wrist` with the elbow toward `pole`, the shoulder at rest. `twist` spins the forearm about its own axis."""
    A = ARM[s]; E, W = solve_two(A['S0'], Vector(wrist), A['l1'], A['l2'], pole)
    n1 = (E - A['S0']).cross(W - E)
    if n1.length < 1e-7: n1 = A['n0']
    Du = frame_rot(A['E0'] - A['S0'], A['n0'], E - A['S0'], n1)
    Df = frame_rot(A['W0'] - A['E0'], A['n0'], W - E, n1)
    if twist: Df = RA(W - E, twist) @ Df
    Dw = (wrist_E @ Df) if wrist_E is not None else Df
    return Du, Du.transposed() @ Df, Df.transposed() @ Dw
def arm_dir_target(s, direction, reach=1.0):
    A = ARM[s]; return A['S0'] + Vector(direction).normalized() * (A['l1'] + A['l2']) * reach

# sheet guard (blockout coordinates): right wrist raised in front of the chest, left wrist low and out
def blockout_wrist(c, F, r=0.071):
    F = Vector(F).normalized(); return Vector(c) - F * r * 0.7
GUARD_W = {'R': blockout_wrist((0.292, 0.232, 0.848), (-0.18, 0.42, 0.89)), 'L': blockout_wrist((-0.332, 0.14, 0.492), (0.05, 0.62, -0.78))}
GUARD_E = {'R': V(0.345, 0.06, 0.675), 'L': V(-0.33, 0.0, 0.655)}
def pole_from(s, elbow, wrist):
    S0 = ARM[s]['S0']; line = (Vector(wrist) - S0).normalized(); v = Vector(elbow) - S0; return (v - line * v.dot(line)).normalized()
GUARD_P = {s: pole_from(s, GUARD_E[s], GUARD_W[s]) for s in 'RL'}
GUARD_TW = {'R': float(globals().get('TW_R', -0.9)), 'L': float(globals().get('TW_L', 0.6))}
GUARD_WR = {'R': RX(-0.25), 'L': RX(0.15)}      # mitten wrist cock: knuckles up in the raised guard
HEAD_TILT = math.radians(8)

# ---------------- legs: world two-bone IK from the hip socket, analytic floor pivot ----------------
LEG = {}
for s in 'RL':
    H0, K0, A0 = head('thigh_' + s), head('shin_' + s), head('foot_' + s)
    lay = LAY['legs'][s]; fwd = Vector(lay['fwd']); fc = Vector(lay['foot_centre'])
    LEG[s] = dict(H0=H0, K0=K0, A0=A0, l1=(K0 - H0).length, l2=(A0 - K0).length, n0=(K0 - H0).cross(A0 - K0),
                  toe=V(fc.x, fc.y, 0.0) + fwd * 0.155, heel=V(fc.x, fc.y, 0.0) - fwd * 0.13, fwd=fwd,
                  pole=((K0 - H0) - (A0 - H0).normalized() * (K0 - H0).dot((A0 - H0).normalized())).normalized())
def pivot_foot(s, pitch, lift=0.0, shift=(0, 0, 0)):
    """Foot pitch about the toe (pitch < 0, heel up) or the heel (pitch > 0, toes up) so the contact stays put."""
    Lg = LEG[s]; piv = Lg['toe'] if pitch < 0 else Lg['heel']
    side = Lg['fwd'].cross(V(0, 0, 1)).normalized(); Rm = RA(side, pitch)      # +pitch: toes up about the heel
    A = piv + Rm @ (Lg['A0'] - piv)
    return A + V(*shift) + V(0, 0, lift), Rm
def legs(B, P, c):
    for s in 'RL':
        Lg = LEG[s]; th, sh, ft = 'thigh_' + s, 'shin_' + s, 'foot_' + s
        H = P['hips'] @ RESTI['hips'] @ Lg['H0'] + c.get('socket_' + s, V(0, 0, 0))
        K, A = solve_two(H, c['ankle_' + s], Lg['l1'], Lg['l2'], c.get('pole_' + s, Lg['pole']))
        n1 = (K - H).cross(A - K)
        if n1.length < 1e-7: n1 = Lg['n0']
        Pt = Matrix.Translation(H) @ (frame_rot(Lg['K0'] - Lg['H0'], Lg['n0'], K - H, n1) @ R3[th]).to_4x4()
        B[th] = RESTI[th] @ Pt
        Ps = Matrix.Translation(K) @ (frame_rot(Lg['A0'] - Lg['K0'], Lg['n0'], A - K, n1) @ R3[sh]).to_4x4()
        B[sh] = (Pt @ RESTI[th] @ RESTM[sh]).inverted() @ Ps
        Pf = Matrix.Translation(A) @ (c['foot_rot_' + s] @ R3[ft]).to_4x4()
        B[ft] = (Ps @ RESTI[sh] @ RESTM[ft]).inverted() @ Pf @ Matrix.Diagonal((*c.get('foot_scale_' + s, (1, 1, 1)), 1.0))
        f = c.get('leg_flat_' + s)
        if f is not None and f < 0.999:        # defeat: flatten the lying leg along its most vertical cross axis
            Rw = Pt.to_3x3(); i = max((0, 2), key=lambda k: abs((Rw @ Vector([1.0 if j == k else 0.0 for j in range(3)])).z))
            sv = [1.0, 1.0, 1.0]; sv[i] = f; sv[2 - i] = c.get('leg_widen_' + s, 1.0)
            B[th] = B[th] @ Matrix.Diagonal((*sv, 1.0))

# ---------------- skinning (exact linear blend, for the floor guard) ----------------
VG = {g.index: g.name for g in skin.vertex_groups}
BONE_I = {n: i for i, n in enumerate(ORDER)}
NV = len(skin.data.vertices)
REST_CO = np.zeros((NV, 4)); REST_CO[:, 3] = 1.0
IDX = np.zeros((NV, 4), dtype=np.int64); WT = np.zeros((NV, 4))
MW = skin.matrix_world
for v in skin.data.vertices:
    REST_CO[v.index, :3] = MW @ v.co
    gs = sorted(((BONE_I[VG[g.group]], g.weight) for g in v.groups if g.weight > 1e-6), key=lambda x: -x[1])[:4]
    tot = sum(w for _, w in gs)
    for k, (bi, w) in enumerate(gs): IDX[v.index, k] = bi; WT[v.index, k] = w / tot
REST_INV = np.array([np.array(RESTI[n]) for n in ORDER])
def skin_np(P):
    K = np.array([np.array(P[n]) for n in ORDER]) @ REST_INV
    out = np.zeros((NV, 4))
    for k in range(4): out += WT[:, k:k + 1] * np.einsum('nij,nj->ni', K[IDX[:, k]], REST_CO)
    return out[:, :3]

# ---------------- controls ----------------
def base(clip_guard=True):
    c = {'hips_d': V(0, 0, 0), 'hips_E': I3, 'hips_S': (1, 1, 1),
         'spine_E': I3, 'chest_E': I3, 'head_E': RY(HEAD_TILT) if clip_guard else I3, 'head_d': V(0, 0, 0), 'head_S': (1, 1, 1),
         'belly_S': (1, 1, 1), 'belly_d': V(0, 0, 0), 'ant1_E': I3, 'ant2_E': I3, 'tongue_E': I3, 'tongue_S': (1, 1, 1),
         'eye_S': {'R': (1, 1, 1), 'L': (1, 1, 1)}, 'eye_E': {'R': I3, 'L': I3}, 'belt_S': None,
         'shoulder_E': {'R': I3, 'L': I3}, 'shoulder_k': 0.0, 'arm_S': {s: {'upper': (1, 1, 1), 'fore': (1, 1, 1), 'fist': (1, 1, 1)} for s in 'RL'}}
    for s in 'RL':
        c['arm_' + s] = arm_rot(s, GUARD_W[s], GUARD_P[s], GUARD_TW[s], GUARD_WR[s]) if clip_guard else (I3, I3, I3)
        c['ankle_' + s] = LEG[s]['A0'].copy(); c['foot_rot_' + s] = I3.copy()
    return c

def blend_arm(a, b, s):
    """Blend two arm rotation triples (quaternion slerp per joint)."""
    return tuple(x.to_quaternion().slerp(y.to_quaternion(), s).to_matrix() for x, y in zip(a, b))

def attack_arm(s, T, guard, teeter, raise_, swing, stagger, wind):
    sx = 1 if s == 'R' else -1
    def over():
        return arm_rot(s, arm_dir_target(s, V(0.16 * sx, -0.10 + 0.14 * teeter, 1.0), 0.97), V(sx, 0.2, 0), 0.0)
    def arc(u):
        d0 = V(0.16 * sx, -0.10 + 0.14 * teeter, 1.0); d1 = V(-0.22 * sx, 0.95, -0.12)
        return arm_rot(s, arm_dir_target(s, slerp_dir(d0, d1, u), 0.97 + 0.029 * u), V(sx, 0.2 * (1 - u), 0.3 * u), -1.2 * sx * u)
    recoil = arm_rot(s, arm_dir_target(s, V(0.55 * sx, 0.35, -0.2), 0.8), V(sx, -0.6, 0), -0.6 * sx)
    if T <= 1.08: return blend_arm(guard, over(), raise_)
    if T <= 1.32: return arc(swing)
    rec = keyed(T, [(1.32, 0), (1.42, 1)])
    a = blend_arm(arc(1.0), recoil, rec)
    if T > 1.42:
        if s == 'L':
            th = math.tau * 1.25 * smooth((T - 1.50) / 0.36)
            tail_pose = arm_rot('L', arm_dir_target('L', V(-0.45, 0.88 * math.sin(th + 0.4), -0.88 * math.cos(th + 0.4)), 0.99), V(-1, 0, 0), 0.4)
            a = blend_arm(recoil, tail_pose, wind)
        else:
            tail_pose = arm_rot('R', arm_dir_target('R', V(0.75, 0.15 * math.sin(math.tau * 3 * T), 0.35 + 0.25 * math.sin(math.tau * 2.5 * T)), 0.9), V(0.3, -1, 0), -0.4)
            a = blend_arm(recoil, tail_pose, stagger)
    return blend_arm(a, guard, keyed(T, [(1.84, 0), (1.99, 1), (2.0, 1)]))

def evaluate(clip, t, duration):
    T = t * duration; tau = math.tau * t
    if clip == 'idle':
        c = base()
        b = 0.5 - 0.5 * math.cos(2 * tau); bl = 0.5 - 0.5 * math.cos(2 * tau - 0.9)
        c['hips_d'] = V(0.012 * math.sin(tau), 0, -0.024 * b)
        c['hips_E'] = RY(0.03 * math.sin(tau))
        c['hips_S'] = (1 + 0.035 * b, 1 + 0.035 * b, 1 - 0.05 * b)
        c['spine_E'] = RY(-0.02 * math.sin(tau)) @ RX(-0.03 * b)
        c['chest_E'] = RY(-0.015 * math.sin(tau - 0.5))
        c['head_E'] = RY(HEAD_TILT + 0.045 * (math.sin(tau - 0.8) - math.sin(-0.8))) @ RX(0.05 * (bl - (0.5 - 0.5 * math.cos(-0.9))))
        c['ant1_E'] = RX(0.20 * math.sin(2 * tau - 1.7)) @ RY(-0.12 * math.sin(tau - 1.4))
        c['ant2_E'] = RX(0.30 * math.sin(2 * tau - 2.5)) @ RY(-0.20 * math.sin(tau - 2.1))
        c['tongue_E'] = RX(0.10 * math.sin(2 * tau + 0.4))
        feint = bell(t, 0.30, 0.075) + bell(t, 0.47, 0.075)
        wr = GUARD_W['R'] + V(-0.015, 0.11, 0.035) * feint + V(0, 0, -0.012 * bl)
        c['arm_R'] = arm_rot('R', wr, GUARD_P['R'], GUARD_TW['R'], GUARD_WR['R'] @ RX(-0.25 * feint))
        wl = GUARD_W['L'] + V(0.0, 0.02 * math.sin(tau), 0.015 * math.sin(2 * tau - 0.6) - 0.010 * bl)
        c['arm_L'] = arm_rot('L', wl, GUARD_P['L'], GUARD_TW['L'], GUARD_WR['L'])
        blink = bell(t, 0.83, 0.04)
        for s in 'RL': c['eye_S'][s] = (1 + 0.08 * blink, 1, 1 - 0.86 * blink)
        c['belly_S'] = (1 + 0.03 * b, 1 + 0.05 * b, 1 - 0.04 * b)
    elif clip == 'move':
        c = base(False)
        c['head_E'] = I3
        for s, off in (('R', 0.0), ('L', math.pi)):
            ph = (tau + off) % math.tau
            fwd = 0.11 * math.cos(ph); lift = 0.105 * max(0.0, -math.sin(ph))
            pitch = 0.32 * max(0.0, -math.sin(ph)) * math.cos(ph)
            land = math.exp(-((ph - 0.40) / 0.38) ** 2) if ph < math.pi else 0.0
            A, Rm = pivot_foot(s, pitch)
            c['ankle_' + s] = A + V(0, fwd, lift - 0.006 * land)
            c['foot_rot_' + s] = Rm
            c['foot_scale_' + s] = (1 + 0.14 * land, 1.0, 1 - 0.18 * land)
        lb = 0.5 + 0.5 * math.cos(2 * (tau - 0.45))
        c['hips_d'] = V(0.026 * math.sin(tau), 0.0, -0.030 - 0.028 * lb)
        c['hips_E'] = RY(0.075 * math.sin(tau)) @ RX(-0.04)
        c['hips_S'] = (1 + 0.04 * lb, 1 + 0.04 * lb, 1 - 0.06 * lb)
        c['spine_E'] = RX(-0.07) @ RY(-0.04 * math.sin(tau))
        c['chest_E'] = RZ(0.09 * math.sin(tau)) @ RY(-0.03 * math.sin(tau))
        c['head_E'] = RY(0.05 * math.sin(tau - 0.8)) @ RX(0.08 + 0.05 * (0.5 + 0.5 * math.cos(2 * (tau - 0.45) - 0.9)))
        c['ant1_E'] = RX(0.28 * math.cos(2 * (tau - 0.45) - 1.3)) @ RY(-0.16 * math.sin(tau - 1.0))
        c['ant2_E'] = RX(0.42 * math.cos(2 * (tau - 0.45) - 2.1)) @ RY(-0.26 * math.sin(tau - 1.8))
        c['tongue_E'] = RX(0.16 * math.sin(2 * tau - 0.5))
        c['belly_S'] = (1 + 0.03 * lb, 1 + 0.06 * lb, 1 - 0.05 * lb)
        for s, sx, sw in (('R', 1, -math.cos(tau)), ('L', -1, math.cos(tau))):
            w = V((0.30 + 0.05 * max(0.0, -sw)) * sx, 0.06 + 0.14 * sw, 0.625 + 0.06 * sw + 0.05 * sw * sw)
            c['arm_' + s] = arm_rot(s, w, V(0.35 * sx, -1.0, -0.3), -0.6 * sx, RX(-0.2))
    elif clip == 'attack':
        c = base()
        raise_ = keyed(T, [(0, 0), (0.10, 0), (0.55, 1), (1.08, 1), (1.20, 0), (2.0, 0)])
        teeter = keyed(T, [(0, 0), (0.55, 0), (0.75, 1), (1.02, 1), (1.14, 0), (2.0, 0)])
        swing = keyed(T, [(0, 0), (1.08, 0), (1.20, 1), (1.32, 1), (1.50, 0), (2.0, 0)])
        hold = keyed(T, [(0, 0), (1.18, 0), (1.22, 1), (1.30, 1), (1.34, 0), (2.0, 0)])
        snap = keyed(T, [(0, 0), (1.30, 0), (1.40, 1), (1.62, 0), (2.0, 0)])
        stagger = keyed(T, [(0, 0), (1.45, 0), (1.66, 1), (1.80, 1), (1.98, 0), (2.0, 0)])
        wind = keyed(T, [(0, 0), (1.48, 0), (1.56, 1), (1.84, 1), (1.96, 0), (2.0, 0)])
        wob = math.sin(math.tau * 2.4 * (T - 0.55)) * teeter
        lean = keyed(T, [(0, 0), (0.12, 0.04), (0.55, 0.26), (0.78, 0.16), (1.06, 0.22), (1.20, -0.36), (1.32, -0.36), (1.50, 0.06), (1.68, 0.30), (1.84, 0.05), (2.0, 0)])
        c['hips_E'] = RX(0.30 * lean) @ RY(0.03 * wob)
        c['spine_E'] = RX(0.35 * lean) @ RY(0.04 * wob)
        c['chest_E'] = RX(0.35 * lean)
        c['hips_d'] = V(0, keyed(T, [(0, 0), (0.12, 0), (0.45, -0.05), (0.78, 0.02), (1.06, -0.01), (1.20, 0.06), (1.32, 0.06), (1.55, 0.0), (1.70, -0.035), (2.0, 0)]),
                        keyed(T, [(0, 0), (0.12, -0.02), (0.30, 0.0), (0.55, -0.015), (0.80, 0.012), (1.08, 0.0), (1.22, -0.05), (1.32, -0.05), (1.55, -0.01), (1.72, -0.03), (2.0, 0)]))
        sq = hold + 0.4 * snap
        c['hips_S'] = (1 + 0.07 * sq - 0.03 * raise_, 1 + 0.07 * sq - 0.03 * raise_, 1 - 0.09 * sq + 0.05 * raise_)
        c['head_E'] = RY(HEAD_TILT * (1 - max(raise_, swing, stagger))) @ RX(-0.10 * raise_ + 0.14 * swing - 0.12 * stagger + 0.06 * wob)
        c['tongue_E'] = RX(-0.35 * max(raise_, teeter) - 0.2 * swing); c['tongue_S'] = (1, 1 + 0.35 * max(raise_, teeter), 1)
        heel = keyed(T, [(0, 0), (0.18, 0), (0.45, 1), (0.62, 0), (1.55, 0), (1.70, 1), (1.84, 0.6), (1.98, 0), (2.0, 0)])
        toe = keyed(T, [(0, 0), (0.62, 0), (0.78, 1), (1.04, 1), (1.16, 0), (2.0, 0)])
        for s in 'RL':
            pitch = 0.22 * heel - 0.30 * toe
            A, Rm = pivot_foot(s, pitch)
            c['ankle_' + s] = A; c['foot_rot_' + s] = Rm
        # arm key poses: guard -> overhead (fists up beside the head) -> arc down in front (fists together) -> elastic
        # recoil -> left windmill / right flail -> guard
        for s in 'RL':
            c['arm_' + s] = attack_arm(s, T, c['arm_' + s], teeter, raise_, swing, stagger, wind)
        for s in 'RL':
            # the forearm inherits the upper-arm stretch: 1.12 x 1.14 gives the notes' ~30 % longer clay arm at contact
            stretch = keyed(T, [(0, 0), (1.08, 0), (1.20, 1), (1.32, 1), (1.40, -0.45), (1.48, 0.18), (1.58, -0.06), (1.68, 0), (2.0, 0)])
            c['arm_S'][s] = {'upper': (1 - 0.04 * stretch, 1 + 0.12 * stretch, 1 - 0.04 * stretch), 'fore': (1 - 0.07 * stretch, 1 + 0.14 * stretch, 1 - 0.07 * stretch),
                             'fist': (1 + 0.24 * hold, 1 - 0.30 * hold, 1 + 0.24 * hold)}
        c['ant1_E'] = RX(0.35 * raise_ * math.sin(math.tau * 2 * T) - 0.45 * swing + 0.4 * snap * math.sin(math.tau * 4 * (T - 1.3)) + 0.25 * wob) @ RY(0.3 * stagger * math.sin(math.tau * 3 * T))
        c['ant2_E'] = RX(0.5 * raise_ * math.sin(math.tau * 2 * T - 0.8) - 0.7 * swing + 0.6 * snap * math.sin(math.tau * 4 * (T - 1.3) - 0.9) + 0.35 * wob) @ RY(0.45 * stagger * math.sin(math.tau * 3 * T - 0.8))
        sq_eye = max(hold, 0.5 * raise_ * (1 - teeter))
        for s in 'RL': c['eye_S'][s] = (1 + 0.1 * sq_eye, 1, 1 - 0.55 * sq_eye)
        c['belly_S'] = (1 + 0.06 * hold, 1 + 0.10 * hold, 1 - 0.06 * hold)
    elif clip == 'hit':
        c = base()
        r = keyed(T, [(0, 0), (0.06, 1), (0.22, 0.45), (0.45, 0.08), (0.66, 0), (0.7, 0)])
        env = keyed(T, [(0, 0), (0.05, 1), (0.40, 0.5), (0.66, 0), (0.7, 0)])
        w = math.sin(math.tau * 3.4 * T) * env
        c['hips_S'] = (1 + 0.20 * r + 0.05 * w, 1 - 0.24 * r - 0.04 * w, 1 - 0.07 * r + 0.03 * w)
        c['hips_d'] = V(0, -0.035 * r, -0.03 * r)
        c['hips_E'] = RX(0.10 * r) @ RY(0.05 * w)
        c['spine_E'] = RX(0.10 * r) @ RY(-0.04 * w); c['chest_E'] = RX(0.06 * r)
        c['belly_S'] = (1 + 0.10 * r, 1 - 0.72 * r, 1 + 0.10 * r); c['belly_d'] = V(0, -0.04 * r, 0)
        rl = keyed(T, [(0, 0), (0.10, 1), (0.30, 0.3), (0.55, 0), (0.7, 0)])
        c['head_E'] = RY(HEAD_TILT - 0.10 * w) @ RX(0.20 * rl)
        c['head_S'] = (1 + 0.10 * r, 1 + 0.10 * r, 1 - 0.12 * r)
        sq = keyed(T, [(0, 0), (0.04, 1), (0.30, 1), (0.46, 0), (0.7, 0)])
        for s in 'RL': c['eye_S'][s] = (1 + 0.12 * sq, 1, 1 - 0.80 * sq)
        c['ant1_E'] = RX(0.55 * rl + 0.30 * math.sin(math.tau * 4.2 * T) * env) @ RY(0.2 * math.sin(math.tau * 3 * T) * env)
        c['ant2_E'] = RX(0.75 * rl + 0.45 * math.sin(math.tau * 4.2 * T - 0.9) * env) @ RY(0.3 * math.sin(math.tau * 3 * T - 0.7) * env)
        c['tongue_E'] = RX(-0.4 * rl); c['tongue_S'] = (1, 1 + 0.4 * rl, 1)
        fl = rl
        for s, sx in (('R', 1), ('L', -1)):
            flung = arm_rot(s, arm_dir_target(s, V(0.8 * sx, -0.35, 0.2), 0.9), V(0.2 * sx, -1, 0.2), -0.5 * sx)
            c['arm_' + s] = blend_arm(c['arm_' + s], flung, 0.75 * fl)
    elif clip == 'defeat':
        c = base()
        jolt = keyed(T, [(0, 0), (0.06, 1), (0.16, 0.3), (0.3, 0), (2.4, 0)])
        teeter = keyed(T, [(0, 0), (0.12, 0), (0.50, 1), (0.62, 1), (0.90, 0), (2.4, 0)])
        melt = keyed(T, [(0, 0), (0.55, 0), (0.95, 1), (2.4, 1)])
        jig_env = keyed(T, [(0, 0), (0.90, 0), (0.96, 1), (1.50, 0.35), (1.95, 0), (2.4, 0)])
        jig = math.sin(math.tau * 3.0 * (T - 0.92)) * jig_env
        wig_env = keyed(T, [(0, 0), (0.90, 0), (1.0, 1), (1.55, 0.7), (1.98, 0), (2.4, 0)])
        wig = math.sin(math.tau * 3.6 * (T - 0.95)) * wig_env
        droop = keyed(T, [(0, 0), (1.1, 0), (1.95, 1), (2.4, 1)])
        pop = keyed(T, [(0, 0), (0.80, 0), (1.0, 1), (2.4, 1)])
        f = 1 - 0.80 * melt + 0.06 * jig; a = 1 + 0.45 * melt - 0.04 * jig
        c['hips_S'] = (a + 0.10 * jolt, a + 0.10 * jolt, f - 0.12 * jolt)
        c['hips_E'] = RX(0.26 * teeter * (1 - melt)) @ RY(0.04 * math.sin(math.tau * 2.5 * T) * teeter)
        c['hips_d'] = V(0, -0.05 * teeter - 0.07 * melt, -0.07 * teeter + (0.07 - 0.5 + 0.07 * teeter) * melt)
        c['spine_E'] = RX(0.20 * teeter * (1 - melt)); c['chest_E'] = RX(0.18 * teeter * (1 - melt))
        c['head_E'] = RY(HEAD_TILT * (1 - melt)) @ RX(0.25 * teeter * (1 - melt))
        c['head_d'] = V(0, -0.14 * melt, -0.10 * melt)
        c['head_S'] = (1 - 0.2 * melt, 1 - 0.2 * melt, 1 + 1.25 * melt)      # the head blob stays about half height on the puddle
        c['shoulder_k'] = 0.85 * melt
        c['belly_S'] = (1 + 0.1 * melt, 1 - 0.3 * melt, 1 + 0.1 * melt)
        for s, sx in (('R', 1), ('L', -1)):
            c['eye_S'][s] = (1 + 0.1 * jolt + 0.08 * pop, 1, 1 - 0.6 * jolt + 0.08 * pop)   # eyes never rotate under a flattened parent
        c['belt_S'] = (1.0, 1.0, 1.0 - 0.1 * melt)    # the coil keeps its vertical thickness (counter-scaled in pose())
        c['ant1_E'] = RX(-0.35 * teeter + (0.10 + 0.35 * wig) * pop - 0.30 * droop) @ RY(0.35 * wig * pop)
        c['ant2_E'] = RX(-0.45 * teeter + (0.10 + 0.5 * wig) * pop - 0.85 * droop) @ RY(0.5 * wig * pop)
        c['tongue_E'] = RX(-0.6 * melt); c['tongue_S'] = (1, 1 + 0.5 * melt, 1)
        up = teeter * (1 - melt)
        for s, sx in (('R', 1), ('L', -1)):
            fly = arm_rot(s, arm_dir_target(s, V(0.55 * sx, 0.1, 0.8), 0.95), V(sx, -0.3, 0), 0.0)
            flop = arm_rot(s, arm_dir_target(s, V(0.75 * sx, 0.50, 0.0), 0.86), V(0, 0, 1), -0.5 * sx)
            c['arm_' + s] = blend_arm(blend_arm(c['arm_' + s], fly, up), flop, melt)
            buckle = keyed(T, [(0, 0), (0.15, 0), (0.55, 1), (0.95, 0), (2.4, 0)])
            A0 = LEG[s]['A0']
            splay = V(A0.x + 0.16 * sx, A0.y + 0.36, 0.05)
            c['ankle_' + s] = A0.lerp(splay, melt) + V(0, -0.02 * buckle, 0)
            c['pole_' + s] = LEG[s]['pole'].lerp(V(0.2 * sx, 0.1, 1.0).normalized(), melt).normalized()
            c['foot_rot_' + s] = RA(V(0, 0, 1), -0.35 * sx * melt) @ RX(0.3 * melt)
            c['leg_flat_' + s] = 1 - 0.55 * melt; c['leg_widen_' + s] = 1 + 0.25 * melt
            c['socket_' + s] = V(0.05 * sx, 0.04, 0) * melt
    else:
        raise ValueError(clip)
    return c

def pose(c):
    B = {n: Matrix.Identity(4) for n in ORDER}
    h0 = head('hips')
    Ph = Matrix.Translation(h0 + c['hips_d']) @ (c['hips_E'] @ R3['hips']).to_4x4() @ Matrix.Diagonal((*wscale('hips', c['hips_S']), 1.0))
    B['hips'] = RESTI['hips'] @ Ph
    B['spine'] = local('spine', c['spine_E']); B['chest'] = local('chest', c['chest_E'])
    B['belly'] = local('belly', None, c['belly_d'], c['belly_S'])
    B['head'] = local('head', c['head_E'], c['head_d'], wscale('head', c['head_S']))
    B['antenna_1'] = local('antenna_1', c['ant1_E']); B['antenna_2'] = local('antenna_2', c['ant2_E'])
    B['tongue'] = local('tongue', c['tongue_E'], None, c['tongue_S'])
    P = fk(B)
    for s in 'RL':
        Du, Df, Dw = c['arm_' + s]; S = c['arm_S'][s]
        k = counter(P, 'shoulder_' + s); kk = c['shoulder_k']
        B['shoulder_' + s] = local('shoulder_' + s, c['shoulder_E'][s], None, [x ** kk for x in k])
        B['upper_arm_' + s] = local('upper_arm_' + s, Du, None, S['upper'])
        B['forearm_' + s] = local('forearm_' + s, Df, None, S['fore'])
    P = fk(B)
    for s in 'RL':
        k = counter(P, 'fist_' + s); sq = c['arm_S'][s]['fist']
        B['fist_' + s] = local('fist_' + s, c['arm_' + s][2], None, [k[i] * sq[i] for i in range(3)])
        k = counter(P, 'eye_' + s); e = wscale('eye_' + s, c['eye_S'][s])
        B['eye_' + s] = local('eye_' + s, c['eye_E'][s], None, [k[i] * e[i] for i in range(3)])
    B['antenna_root'] = local('antenna_root', None, None, counter(P, 'antenna_root'))
    if c['belt_S'] is not None:
        k = counter(P, 'belt'); hs = wscale('hips', c['hips_S']); e = wscale('belt', c['belt_S'])
        # keep the horizontal spread of the melting torso, restore the coil's vertical thickness
        B['belt'] = local('belt', None, None, [1.0 if i != 1 else k[1] * e[1] for i in range(3)])
    P = fk(B)
    legs(B, P, c)
    P = fk(B)
    co = skin_np(P); low = float(co[:, 2].min()); lift = 0.0
    LOWEST[0] = ORDER[IDX[int(co[:, 2].argmin()), 0]]
    if low < FLOOR:
        lift = FLOOR - low
        for n in ('hips', 'thigh_R', 'thigh_L'):
            B[n] = RESTI[n] @ Matrix.Translation((0, 0, lift)) @ RESTM[n] @ B[n]
        P = fk(B); low = float(skin_np(P)[:, 2].min())
    return B, P, lift, low

LOWEST = [None]
PREV = {}
def apply(B):
    for n in ORDER:
        if n == 'root': continue
        pb = arm.pose.bones[n]; loc, quat, scale = B[n].decompose()
        if n in PREV and PREV[n].dot(quat) < 0: quat.negate()
        PREV[n] = quat.copy()
        pb.rotation_mode = 'QUATERNION'; pb.location = loc; pb.rotation_quaternion = quat; pb.scale = scale

def shear_check(B):
    """Every basis must be exactly T @ R @ S (what a glTF node TRS can hold)."""
    worst = 0.0
    for n, M in B.items():
        loc, q, s = M.decompose(); R = Matrix.LocRotScale(loc, q, s)
        worst = max(worst, max(abs(R[i][j] - M[i][j]) for i in range(4) for j in range(4)))
    return worst

if __name__ == '__main__':
    scene = sc; scene.render.fps = FPS; scene.frame_start = 0; scene.frame_end = 72
    arm.animation_data_clear(); arm.animation_data_create()
    for action in list(bpy.data.actions): bpy.data.actions.remove(action)
    records = []; guard_log = {}; worst_shear = 0.0; samples = {}
    for name, duration, loop in CLIPS:
        action = bpy.data.actions.new(name); arm.animation_data.action = action; end = round(duration * FPS); PREV.clear()
        lifts = []; lows = []; causes = []
        for frame in range(end + 1):
            scene.frame_set(frame)
            B, P, lift, low = pose(evaluate(name, frame / end, duration)); lifts.append(lift); lows.append(low); causes.append(LOWEST[0] if lift > 0 else None)
            worst_shear = max(worst_shear, shear_check(B)); apply(B)
            for pb in arm.pose.bones:
                if pb.name == 'root': continue
                for field in ('location', 'rotation_quaternion', 'scale'): pb.keyframe_insert(data_path=field, frame=frame, group=pb.name)
        for fc in action.fcurves:
            for k in fc.keyframe_points: k.interpolation = 'LINEAR'
        track = arm.animation_data.nla_tracks.new(); track.name = name; strip = track.strips.new(name, 0, action)
        strip.action_frame_start = 0; strip.action_frame_end = end; track.mute = True
        guard_log[name] = {'frames_lifted': sum(1 for x in lifts if x > 0), 'max_lift_m': round(max(lifts), 5), 'lowest_keyed_vertex_m': round(min(lows), 5),
                           'lift_causes': sorted({x for x in causes if x}), 'worst_lift_frame': int(np.argmax(lifts)), 'worst_lift_bone': causes[int(np.argmax(lifts))]}
        records.append({'name': name, 'duration_s': duration, 'loop': loop, 'clamp_when_finished': not loop, 'frames': end + 1, 'fps': FPS,
                        'contact_time_s': CONTACT_S if name == 'attack' else None, 'contact_fraction': CONTACT_S / duration if name == 'attack' else None,
                        'held_final_pose_from_s': DEFEAT_HOLD_S if name == 'defeat' else None})
    arm.animation_data.action = None
    for pb in arm.pose.bones: pb.matrix_basis = Matrix.Identity(4)
    scene.frame_set(0); bpy.context.view_layer.update()
    arm['attack_contact_seconds'] = CONTACT_S; arm['attack_contact_fraction'] = CONTACT_S / 2.0
    # exact-pose fidelity samples: Blender's own evaluated skin at chosen clip times (every 9th vertex) for the
    # three.js comparison
    dg = bpy.context.evaluated_depsgraph_get(); pick = list(range(0, NV, 9))
    for tr in arm.animation_data.nla_tracks:
        act = tr.strips[0].action; arm.animation_data.action = act; end = int(tr.strips[0].action_frame_end)
        for frame in sorted({0, end // 3, end // 2, (2 * end) // 3, end}):
            scene.frame_set(frame); dg = bpy.context.evaluated_depsgraph_get(); ev = skin.evaluated_get(dg); me = ev.to_mesh()
            samples.setdefault(tr.name, []).append({'frame': frame, 'time_s': frame / FPS,
                'rest': [[round(x, 6) for x in (MW @ skin.data.vertices[i].co)] for i in pick],
                'posed': [[round(x, 6) for x in (ev.matrix_world @ me.vertices[i].co)] for i in pick]})
            ev.to_mesh_clear()
    arm.animation_data.action = None
    for pb in arm.pose.bones: pb.matrix_basis = Matrix.Identity(4)
    scene.frame_set(0); bpy.context.view_layer.update()
    (ROOT / 'source' / 'fidelity-samples.json').write_text(json.dumps({'note': 'Blender-evaluated armature-deformed skin (Z-up) at listed frames; every 9th vertex.', 'clips': samples}) + '\n')
    bp = ROOT / 'source/bounds.json'
    if bp.exists():
        br = json.loads(bp.read_text()); skin['model_space_bounds_y_up'] = br['safe_culling_envelope']; skin['bounds_method'] = br['method']
    for name in ('build.py', 'animate.py'):
        old = bpy.data.texts.get('WO111 putty grunt ' + name)
        if old: bpy.data.texts.remove(old)
        block = bpy.data.texts.new('WO111 putty grunt ' + name); block.write((ROOT / 'source' / name).read_text())
    bpy.ops.object.select_all(action='DESELECT'); skin.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'putty-grunt.blend'), compress=True)
    bpy.ops.export_scene.gltf(filepath=str(ROOT / 'putty-grunt.glb'), export_format='GLB', use_selection=True, export_yup=True, export_animations=True,
                              export_animation_mode='NLA_TRACKS', export_skins=True, export_def_bones=False, export_armature_object_remove=True,
                              export_all_influences=False, export_influence_nb=4, export_apply=False, export_texcoords=True, export_normals=True,
                              export_tangents=False, export_materials='EXPORT', export_vertex_color='NONE', export_image_format='AUTO',
                              export_all_vertex_colors=False, export_cameras=False, export_lights=False, export_extras=True)
    record = json.loads((ROOT / 'construction.json').read_text()); record['clips'] = records; record['floor_guard'] = guard_log
    record['basis_trs_max_error'] = worst_shear
    record['files'] = {n: {'bytes': (ROOT / n).stat().st_size, 'sha256': hashlib.sha256((ROOT / n).read_bytes()).hexdigest()} for n in ['putty-grunt.blend', 'putty-grunt.glb', 'pigment.png']}
    (ROOT / 'construction.json').write_text(json.dumps(record, indent=2) + '\n')
    print(json.dumps({'clips': [(r['name'], r['frames']) for r in records], 'guard': guard_log, 'trs_error': worst_shear, 'files': record['files']}))
