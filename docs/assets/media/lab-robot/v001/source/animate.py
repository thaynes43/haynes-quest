"""WO111 lab-robot acting, baked at 30 fps into exactly five NLA clips.

idle   3.0 s loop  the approved sheet pose at 0 s (right claw raised in its "snip-snip!", left claw reaching,
                   eyelid tilted 11 deg, the lens glancing low toward its right, the cord curled like a tail);
                   it bobs on its suspension, wiggles at the waist, each claw snips twice, the iris dilates and
                   narrows, the eyelid shutter blinks, the eye glances aside and back, and the plug tail wags
move   1.0 s loop  the warning light flashes twice and spins while it rolls: road wheels turning (two turns of
                   the big wheels, three of the small ones per loop), leaning back like a startled go-kart with
                   a little rumble, both slinky arms flailing up and boinging, claws snapping, the eyelid popped
                   open, the cord bouncing and its tail flicking
attack 2.0 s       the tell: it stops, the warning light flashes three times and spins, the eyelid snaps up,
                   the iris narrows and the red target glare opens over it (0-0.45 s); it rocks back on its
                   treads and swivels, the raised right slinky squashes short and snips twice (0.45-1.0 s);
                   then it rocks forward and the right arm springs forward and down about 55% past its rest
                   length, the pincer snapping shut at a child's chest height in front of it at the 1.25 s
                   contact; the arm boings back with an overshoot wobble, the glare fades, a proud head bob
hit    0.7 s       jolts back on its treads, the dome wobbles on the bellows and bobs up, the iris shrinks to
                   a dot, the eyelid pops open, the warning light flickers, the arms fling out and settle
defeat 2.4 s       it fumbles and its left claw bonks its own self-destruct button (0.28 s); sparks burst and
                   crackle, the head sproings straight up on the stretched bellows while the light spins, then
                   the dome lid pops open at the back hinge and smoke puffs rise out of the head; it slumps
                   sideways onto its left tread with the head drooping on its spring, arms limp, the eyelid
                   half shut and the tiny iris circling dizzily; held from 1.85 s, still smoking

Arms and the cord are skinned chains posed along smooth curves (slinky stretch is child translation along
each parent's own axis); the chassis carries the rocking and the slump (its pivots sit on the tread
arcs and edges, so the treads roll rather than sink); the waist carries the suspension bob; the head
pops along the neck axis. No root motion: the root bone is never keyed. The bind pose is rest (rig.py);
idle at 0 s reproduces the sheet pose (asserted below against the blockout claw frames).
"""
import bpy, math, json, hashlib, importlib.util
from pathlib import Path
from mathutils import Vector, Matrix, Euler, Quaternion
ROOT = Path('/workspace/haynes-quest/family-eras/lab-robot/v001')
spec = importlib.util.spec_from_file_location('wo111_lr_rig', ROOT / 'source/rig.py'); RG = importlib.util.module_from_spec(spec); spec.loader.exec_module(RG)
FPS = 30
arm = bpy.data.objects['Lab_Robot_Rig']; skin = bpy.data.objects['Lab_Robot_Skin']; bones = arm.data.bones
CLIPS = [('idle', 3.0, True), ('move', 1.0, True), ('attack', 2.0, False), ('hit', .7, False), ('defeat', 2.4, False)]
CONTACT_S = 1.25; DEFEAT_HOLD_S = 1.9          # the hold starts on frame 57; every control is constant from 1.85 s
SCALED = {'pupil', 'glare', 'eyelid', 'button', 'sparks', 'smoke_a', 'smoke_b', 'beacon'}
GLARE_K = 0.04; FX_K = 0.04
def V(*a): return Vector(a)
def smooth(t): t = max(0, min(1, t)); return t * t * (3 - 2 * t)
def bell(t, c, w): return smooth(1 - abs(t - c) / w)
def keyed(t, keys):
    """Smoothstep between (time, value) keys; values are floats or 3-tuples."""
    if t <= keys[0][0]:
        a = keys[0][1]; return Vector(a) if isinstance(a, (tuple, list, Vector)) else a
    for (a, x), (b, y) in zip(keys, keys[1:]):
        if t <= b:
            s = smooth((t - a) / (b - a)) if b > a else 1
            return Vector(x).lerp(Vector(y), s) if isinstance(x, (tuple, list, Vector)) else x + (y - x) * s
    a = keys[-1][1]; return Vector(a) if isinstance(a, (tuple, list, Vector)) else a
def hashn(i, k=0):
    x = math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return 2 * (x - math.floor(x)) - 1

RESTM = {b.name: b.matrix_local.copy() for b in bones}
def rot3(m): return m.to_3x3().normalized()
def head_of(n): return RESTM[n].translation.copy()
def R3(rot):
    if rot is None: return Matrix.Identity(3)
    if isinstance(rot, Matrix): return rot.to_3x3() if len(rot) == 4 else rot
    return Euler(rot).to_matrix()
def Rx(a): return Matrix.Rotation(a, 3, 'X')
def Ry(a): return Matrix.Rotation(a, 3, 'Y')
def Rz(a): return Matrix.Rotation(a, 3, 'Z')
def mul(*ms):
    out = Matrix.Identity(3)
    for m in ms:
        if m is not None: out = out @ R3(m)
    return out
def about(pivot, R):
    p = Vector(pivot); return Matrix.Translation(p) @ R3(R).to_4x4() @ Matrix.Translation(-p)

class Pose:
    def __init__(self): self.M = {}
    def delta(self, n): return rot3(self.M[n]) @ rot3(RESTM[n]).inverted()
    def full(self, n): return self.M[n] @ RESTM[n].inverted()
    def point(self, n, p): return self.full(n) @ Vector(p)
    def put(self, n, head, R, scale=None):
        M = Matrix.Translation(head) @ R.to_4x4()
        if scale is not None:
            s = (scale, scale, scale) if isinstance(scale, (int, float)) else tuple(scale)
            M = M @ Matrix.Diagonal((s[0], s[1], s[2], 1))
        self.M[n] = M
    def follow(self, n, rot=None, shift=None, local_rot=None, scale=None):
        b = bones[n]; rest = RESTM[n]
        if b.parent: D = self.delta(b.parent.name); head = self.point(b.parent.name, rest.translation)
        else: D = Matrix.Identity(3); head = rest.translation.copy()
        if shift is not None: head = head + Vector(shift)
        R = D @ R3(rot) @ rot3(rest)
        if local_rot is not None: R = R @ R3(local_rot)
        self.put(n, head, R, scale)
    def follow_full(self, n, scale):
        """Inherit the parent's full matrix (including its scale), then a local scale: no shear, basis = scale."""
        p = bones[n].parent.name; s = scale
        self.M[n] = self.full(p) @ RESTM[n] @ Matrix.Diagonal((s[0], s[1], s[2], 1))

# ---------------- arm and cord poses (body-local rest coordinates) ----------------
def arm_pose(J, T, S): return ([Vector(j) for j in J], Vector(T).normalized(), Vector(S).normalized())
def bez_arm(s, W, T, S, t0, h0=0.14, h1=0.12):
    J, _ = RG.arm_curve(RG.SHOULDER[s], Vector(t0).normalized(), Vector(W), Vector(T).normalized(), h0, h1); return arm_pose(J, T, S)
def vslerp(a, b, t):
    a = a.normalized(); b = b.normalized()
    return a.copy() if (a - b).length < 1e-9 else a.slerp(b, t, a)
def lerp_arm(a, b, t):
    """Blend two arm poses about the shoulder: each joint's direction slerps and its distance lerps, so a swing
    from raised to hanging sweeps round instead of collapsing the chain through the shoulder."""
    t = max(0.0, min(1.0, t)); S0 = a[0][0]; J = [S0.copy()]
    for ja, jb in zip(a[0][1:], b[0][1:]):
        va = ja - S0; vb = jb - S0; J.append(S0 + vslerp(va, vb, t) * (va.length * (1 - t) + vb.length * t))
    return (J, vslerp(a[1], b[1], t), vslerp(a[2], b[2], t))
def xform_arm(a, s, R=None, stretch=1.0):
    """Rigid swing about the shoulder plus a slinky stretch of every joint away from it."""
    S0 = RG.SHOULDER[s]; R = R3(R)
    return ([S0 + (R @ (j - S0)) * stretch for j in a[0]], R @ a[1], R @ a[2])
SHEET = {s: arm_pose(RG.SHEET_ARM[s][0], RG.SHEET_ARM[s][2], RG.SHEET_ARM[s][3]) for s in 'RL'}
REST = {s: arm_pose(RG.REST_ARM[s][0], RG.REST_ARM[s][2], RG.REST_ARM[s][3]) for s in 'RL'}
BTN_TIP = V(-0.012, 0.276, 0.522); BONK_T = V(0.93, -0.33, 0.13).normalized()
POSES = {
    'R_squash': bez_arm('R', (0.41, -0.06, 0.865), (0.10, 0.55, 0.83), (1, 0, 0), (0.7, 0, 0.7), 0.08, 0.06),     # cocked beside the shoulder, pincer aimed forward-up
    'R_lunge': bez_arm('R', (0.26, 0.52, 0.80), (-0.10, 1, 0.05), (1, 0, 0), (0.85, 0.50, 0.10), 0.16, 0.18),
    'R_hang': bez_arm('R', (0.43, 0.08, 0.37), (0.10, 0.18, -1), (0, 1, 0), (0.8, 0.05, -0.6), 0.14, 0.12),
    'R_flail': bez_arm('R', (0.50, -0.03, 0.985), (0.45, -0.05, 1), (0, 1, 0), (0.9, 0, 0.3), 0.12, 0.10),
    'R_hit': bez_arm('R', (0.47, -0.11, 0.925), (0.40, -0.30, 1), (1, 0, 0), (0.85, -0.2, 0.4), 0.12, 0.10),
    'L_bonk': bez_arm('L', BTN_TIP - BONK_T * 0.209, BONK_T, (0, 0, 1), (-0.6, 0.5, -0.2), 0.15, 0.14),
    'L_hang': bez_arm('L', (-0.43, 0.08, 0.37), (-0.10, 0.18, -1), (0, 1, 0), (-0.8, 0.05, -0.6), 0.14, 0.12),
    'L_flail': bez_arm('L', (-0.50, -0.03, 0.985), (-0.45, -0.05, 1), (0, 1, 0), (-0.9, 0, 0.3), 0.12, 0.10),
    'L_hit': bez_arm('L', (-0.47, -0.11, 0.925), (-0.40, -0.30, 1), (-1, 0, 0), (-0.85, -0.2, 0.4), 0.12, 0.10),
    'L_brace': bez_arm('L', (-0.40, 0.08, 0.55), (-0.3, 0.6, -0.4), (-0.6, 0, 1), (-0.8, 0.2, -0.3), 0.12, 0.10)}
CORD_REST = [j.copy() for j in RG.CORD_J]
CORD_DIR = [(CORD_REST[i + 1] - CORD_REST[i]).normalized() for i in range(5)]
FLOP_AXIS = (CORD_REST[3] - CORD_REST[2]).normalized()

# ---------------- chassis pivots (on the tread arcs and the left tread's outer edge) ----------------
REAR_ARC = V(0, RG.TREAD_Y0, RG.TREAD_ZC); FRONT_ARC = V(0, RG.TREAD_Y1, RG.TREAD_ZC)
LEFT_EDGE = V(-(RG.TREAD_X + (RG.TREAD_W + 0.004) / 2), 0, 0.0)
def chassis_M(pitch=0.0, roll=0.0):
    """pitch > 0 rocks back onto the rear arc (front up); < 0 rocks forward onto the front arc. roll < 0 tips onto the left tread edge."""
    M = Matrix.Identity(4)
    if pitch > 0: M = about(REAR_ARC, Rx(pitch))
    elif pitch < 0: M = about(FRONT_ARC, Rx(pitch))
    if roll: M = about(LEFT_EDGE, Ry(roll)) @ M
    return M

PUPIL_D = (V(0, RG.LENS_Y + RG.GLASS_DEPTH, RG.EYE_C.z) - RG.PUPIL_PIVOT).length
def glance(dx, dz): return Rz(-math.asin(max(-.9, min(.9, dx / PUPIL_D)))) @ Rx(math.asin(max(-.9, min(.9, dz / PUPIL_D))))

def sheet_controls():
    c = {'chassis': Matrix.Identity(4), 'bob': 0.0, 'waist_rot': None, 'body_rot': None, 'neck_rot': None, 'head_rot': None, 'pop': 0.0,
         'dome': 0.0, 'beacon_spin': 0.0, 'beacon_scale': 1.0, 'smoke_a': 1.0, 'smoke_b': 1.0, 'sparks': 1.0, 'spark_spin': 0.0, 'button': 1.0,
         'lid_tilt': -RG.EYE_TILT, 'lid_k': 1.0, 'glance': RG.SHEET_GLANCE.copy(), 'pupil': 1.0, 'glare': 0.0,
         'arm_R': SHEET['R'], 'arm_L': SHEET['L'], 'jaw_R': 0.0, 'jaw_L': 0.0,
         'cord_wag': 0.0, 'cord_flop': 0.0, 'cord_lift': 0.0, 'cord_sway': 0.0, 'wheels': 0.0}
    return c
def rest_controls():
    c = sheet_controls(); c['lid_tilt'] = 0.0; c['glance'] = V(0, 0, 0); c['arm_R'] = REST['R']; c['arm_L'] = REST['L']; return c

WHEEL_R = {i: rw for i, (yw, rw, tag) in enumerate(RG.WHEELS)}
def build_pose(c):
    P = Pose()
    P.put('root', head_of('root'), rot3(RESTM['root']))
    P.M['chassis'] = c['chassis'] @ RESTM['chassis']
    for s, sx in (('R', 1), ('L', -1)):
        for i in range(4):
            ang = c['wheels'] / WHEEL_R[i]                          # rolled distance / radius
            P.follow('wheel_%s_%d' % (s, i), local_rot=Ry(-ang * sx))
    Dc = P.delta('chassis')
    P.follow('waist', rot=c['waist_rot'], shift=Dc @ V(0, 0, c['bob']))
    P.follow('body', rot=c['body_rot'])
    P.follow('button', scale=(1, c['button'], 1))
    P.follow('sparks', local_rot=Ry(c['spark_spin']), scale=c['sparks'])
    P.follow('neck', rot=c['neck_rot'])
    P.follow('head', rot=c['head_rot'], shift=P.delta('neck') @ V(0, 0, c['pop']))
    P.follow('dome', rot=Rx(c['dome']))
    P.follow('beacon', local_rot=Ry(c['beacon_spin']), scale=c['beacon_scale'])
    for n in ('smoke_a', 'smoke_b'):                                # puffs stay upright while the head tilts
        P.put(n, P.point('head', head_of(n)), rot3(RESTM[n]), c[n])
    P.follow('eyelid_tilt', local_rot=Ry(c['lid_tilt']))
    P.follow('eyelid', scale=(1, 1, c['lid_k']))
    g = c['glance']; P.follow('pupil', rot=glance(g.x, g.z), scale=(c['pupil'], 1, c['pupil']))
    o = 1 + (1 / GLARE_K - 1) * c['glare']; P.follow_full('glare', (o, 1, o))
    Mb = P.full('body'); Db = P.delta('body')
    for s in 'RL':
        J, Tn, Sn = c['arm_' + s]; Jw = [Mb @ j for j in J]
        R = Db @ rot3(RESTM['arm_%s_1' % s])
        for i in range(RG.N_ARM):
            d = (Jw[i + 1] - Jw[i]).normalized(); R = Vector(R.col[1]).rotation_difference(d).to_matrix() @ R     # rotation-minimising along the chain
            P.put('arm_%s_%d' % (s, i + 1), Jw[i], R)
        _, Wr, Tr, Sr = RG.REST_ARM[s]
        Rc = RG.claw_frame(Jw[-1], Db @ Tn, Db @ Sn).to_3x3() @ RG.claw_frame(Wr, Tr, Sr).to_3x3().inverted() @ rot3(RESTM['claw_' + s])
        P.put('claw_' + s, Jw[-1], Rc)
        P.follow('jaw_%s_a' % s, local_rot=Rx(c['jaw_' + s])); P.follow('jaw_%s_b' % s, local_rot=Rx(-c['jaw_' + s]))   # > 0 opens
    # cord: grommet carried by the body, the floor run world-fixed, the curl wagging about its floor base
    J = [Mb @ CORD_REST[0], (Mb @ CORD_REST[1]).lerp(CORD_REST[1], .5) + V(c['cord_sway'], 0, 0), CORD_REST[2] + V(0.4 * c['cord_sway'], 0, c['cord_lift']),
         CORD_REST[3] + V(0, 0, c['cord_lift'] * 0.8), None, None]
    # flop about the floor run's own axis (tube points near the base stay within one radius of it, so never below the floor), then wag about the vertical
    Rt = Matrix.Translation(V(0, 0, c['cord_lift'] * 0.8)) @ about(CORD_REST[3], Rz(c['cord_wag']) @ Matrix.Rotation(-c['cord_flop'], 3, FLOP_AXIS))
    J[4] = Rt @ CORD_REST[4]; J[5] = Rt @ CORD_REST[5]
    for i in range(3):                                                # the drop and the floor run aim along their new chords
        d0 = Db @ CORD_DIR[i]; d = (J[i + 1] - J[i]).normalized()
        P.put('cord_%d' % (i + 1), J[i], d0.rotation_difference(d).to_matrix() @ Db @ rot3(RESTM['cord_%d' % (i + 1)]))
    R3t = Rt.to_3x3()                                                 # the curl and plug turn rigidly about their floor base
    P.put('cord_4', J[3], R3t @ rot3(RESTM['cord_4'])); P.put('cord_5', J[4], R3t @ rot3(RESTM['cord_5'])); P.put('plug', J[5], R3t @ rot3(RESTM['plug']))
    return P

# ---------------- acting ----------------
def evaluate(clip, t):
    c = sheet_controls(); tau = math.tau * t
    if clip == 'idle':
        ts = t * 3.0
        c['bob'] = 0.010 * (0.5 - 0.5 * math.cos(2 * tau))
        c['waist_rot'] = Rz(0.07 * math.sin(tau))
        c['body_rot'] = Rx(0.018 * math.sin(2 * tau))
        c['head_rot'] = mul(Rz(0.06 * math.sin(tau)), Ry(0.035 * math.sin(2 * tau)))
        c['arm_R'] = xform_arm(SHEET['R'], 'R', Rx(0.07 * math.sin(tau)) @ Ry(0.05 * math.sin(2 * tau)), 1 + 0.045 * math.sin(2 * tau))
        c['arm_L'] = xform_arm(SHEET['L'], 'L', Rz(-0.06 * math.sin(tau)) @ Rx(0.04 * math.sin(2 * tau)), 1 - 0.035 * math.sin(2 * tau))
        c['jaw_R'] = 0.34 * (bell(ts, 0.95, 0.09) + bell(ts, 1.18, 0.09)) - 0.05 * (bell(ts, 1.06, 0.05) + bell(ts, 1.30, 0.05))
        c['jaw_L'] = 0.32 * (bell(ts, 2.10, 0.09) + bell(ts, 2.33, 0.09)) - 0.05 * (bell(ts, 2.21, 0.05) + bell(ts, 2.45, 0.05))
        c['pupil'] = 1 + 0.13 * math.sin(tau)
        c['lid_k'] = 1 + 1.55 * bell(ts, 1.62, 0.10)
        c['glance'] = RG.SHEET_GLANCE + V(-0.016 * keyed(ts, [(0, 0), (1.85, 0), (2.0, 1), (2.45, 1), (2.65, 0), (3.0, 0)]), 0, 0.004 * math.sin(tau))
        c['beacon_scale'] = 1 + 0.025 * math.sin(3 * tau)
        c['cord_wag'] = 0.22 * math.sin(tau); c['cord_sway'] = 0.008 * math.sin(tau)
    elif clip == 'move':
        bounce = 0.5 - 0.5 * math.cos(2 * tau)
        c['wheels'] = 2 * math.tau * 0.066 * t                     # two turns of the big wheels, three of the small ones
        c['beacon_spin'] = math.tau * t
        c['beacon_scale'] = 1 + 0.2 * bell(t, 0.08, 0.06) + 0.2 * bell(t, 0.22, 0.06)
        c['chassis'] = chassis_M(0.022 + 0.008 * math.sin(4 * tau))
        c['bob'] = 0.012 * bounce
        c['waist_rot'] = Rz(0.08 * math.sin(tau))
        c['body_rot'] = Rx(0.10 + 0.025 * math.sin(2 * tau))
        c['head_rot'] = mul(Rx(-0.06 + 0.04 * math.sin(2 * tau)), Ry(0.07 * math.sin(tau)))
        c['arm_R'] = xform_arm(POSES['R_flail'], 'R', Rx(0.30 * math.sin(2 * tau)), 1 + 0.12 * math.sin(2 * tau + 0.6))
        c['arm_L'] = xform_arm(POSES['L_flail'], 'L', Rx(-0.30 * math.sin(2 * tau)), 1 + 0.12 * math.sin(2 * tau + 2.2))
        c['jaw_R'] = 0.16 + 0.20 * math.sin(4 * tau); c['jaw_L'] = 0.16 - 0.20 * math.sin(4 * tau)
        c['lid_tilt'] = 0.0; c['lid_k'] = 0.62; c['pupil'] = 0.82; c['glance'] = V(0, 0, 0.004 * math.sin(2 * tau))
        c['cord_lift'] = 0.018 * bounce; c['cord_wag'] = 0.40 * math.sin(tau); c['cord_sway'] = 0.012 * math.sin(tau)
    elif clip == 'attack':
        ts = t * 2.0
        tell = keyed(ts, [(0, 0), (0.14, 1), (1.55, 1), (1.85, 0), (2.0, 0)])
        c['beacon_spin'] = math.tau * 3.0 * keyed(ts, [(0, 0), (1.9, 1), (2.0, 1)])
        c['beacon_scale'] = 1 + 0.24 * (bell(ts, 0.08, 0.06) + bell(ts, 0.22, 0.06) + bell(ts, 0.36, 0.06)) + 0.10 * bell(ts, 1.25, 0.10)
        c['lid_tilt'] = -RG.EYE_TILT * (1 - tell); c['lid_k'] = 1 - 0.42 * tell
        c['pupil'] = 1 - 0.30 * tell + 0.10 * bell(ts, 1.25, 0.08)
        c['glare'] = keyed(ts, [(0, 0), (0.06, 0), (0.30, 1), (1.45, 1), (1.75, 0), (2.0, 0)])
        c['glance'] = RG.SHEET_GLANCE * (1 - tell) + V(0, 0, -0.004 * tell)
        pitch = keyed(ts, [(0, 0), (0.45, 0), (0.90, 0.10), (1.02, 0.08), (1.22, -0.075), (1.40, -0.075), (1.62, 0.025), (1.80, -0.008), (2.0, 0)])
        c['chassis'] = chassis_M(pitch)
        twist = keyed(ts, [(0, 0), (0.45, 0), (0.92, -0.30), (1.22, 0.16), (1.45, 0.15), (1.85, 0), (2.0, 0)])
        c['waist_rot'] = Rz(twist)
        lean = keyed(ts, [(0, 0), (0.45, 0), (0.92, 0.12), (1.22, -0.20), (1.42, -0.18), (1.70, 0.03), (2.0, 0)])
        c['body_rot'] = Rx(lean)
        c['bob'] = 0.012 * bell(ts, 1.72, 0.12)
        c['head_rot'] = mul(Rx(-0.5 * lean + 0.10 * bell(ts, 1.72, 0.10)), Rz(-0.6 * twist))
        # right arm: sheet -> squashed wind-up -> lunge (contact) -> boing back with a damped overshoot
        wind = keyed(ts, [(0, 0), (0.45, 0), (0.85, 1), (1.0, 1)]); lunge = keyed(ts, [(0, 0), (1.0, 0), (1.22, 1), (1.40, 1), (1.85, 0), (2.0, 0)])
        a = lerp_arm(SHEET['R'], POSES['R_squash'], wind)
        a = lerp_arm(a, POSES['R_lunge'], lunge) if ts < 1.40 else lerp_arm(SHEET['R'], POSES['R_lunge'], lunge)
        wob = 0.14 * math.exp(-5.0 * max(0.0, ts - 1.40)) * math.sin(math.tau * 3.2 * max(0.0, ts - 1.40)) if ts > 1.40 else 0.0
        wob += 0.05 * math.sin(math.tau * 6 * ts) * bell(ts, 0.72, 0.25)
        c['arm_R'] = xform_arm(a, 'R', None, 1 + wob * (1 - smooth((ts - 1.9) / 0.1)))
        c['jaw_R'] = (0.36 * (bell(ts, 0.62, 0.07) + bell(ts, 0.84, 0.07)) - 0.05 * (bell(ts, 0.72, 0.04) + bell(ts, 0.94, 0.04))
                      + keyed(ts, [(0, 0), (1.0, 0), (1.10, 0.42), (1.16, 0.42), (1.22, -0.06), (1.45, -0.06), (1.70, 0), (2.0, 0)]))
        brace = keyed(ts, [(0, 0), (0.45, 0), (0.90, 1), (1.40, 1), (1.85, 0), (2.0, 0)])
        c['arm_L'] = lerp_arm(SHEET['L'], POSES['L_brace'], brace)
        c['jaw_L'] = 0.12 * brace
        c['cord_wag'] = 0.25 * math.sin(math.tau * 1.5 * ts) * keyed(ts, [(0, 0), (0.3, 1), (1.7, 1), (2.0, 0)])
        c['cord_lift'] = 0.012 * bell(ts, 1.25, 0.2)
    elif clip == 'hit':
        ts = t * 0.7
        recoil = keyed(ts, [(0, 0), (0.07, 1), (0.22, 0.45), (0.45, 0.12), (0.62, 0), (0.7, 0)])
        pitch = keyed(ts, [(0, 0), (0.07, 0.11), (0.22, -0.02), (0.34, 0.03), (0.50, 0), (0.7, 0)])
        c['chassis'] = chassis_M(pitch)
        c['body_rot'] = Rx(0.16 * recoil)
        wob = math.sin(math.tau * 3.2 * ts) * math.exp(-4.5 * ts) * keyed(ts, [(0, 0), (0.04, 1), (0.7, 1)])
        c['head_rot'] = mul(Ry(0.30 * wob), Rx(0.10 * recoil - 0.12 * wob))
        c['pop'] = 0.035 * keyed(ts, [(0, 0), (0.06, 1), (0.18, 0.2), (0.28, 0.5), (0.45, 0), (0.7, 0)])
        c['pupil'] = keyed(ts, [(0, 1), (0.05, 0.56), (0.40, 0.60), (0.62, 1), (0.7, 1)])
        c['lid_k'] = keyed(ts, [(0, 1), (0.05, 0.52), (0.45, 0.55), (0.65, 1), (0.7, 1)])
        c['lid_tilt'] = -RG.EYE_TILT * keyed(ts, [(0, 1), (0.05, 0), (0.45, 0), (0.65, 1), (0.7, 1)])
        c['glance'] = RG.SHEET_GLANCE * keyed(ts, [(0, 1), (0.05, 0), (0.45, 0), (0.65, 1), (0.7, 1)])
        flick = [hashn(int(ts * 30), k) for k in range(2)] if 0.03 < ts < 0.42 else [0, 0]
        c['beacon_scale'] = 1 + 0.16 * flick[0]; c['beacon_spin'] = 0.5 * flick[1]
        fling = keyed(ts, [(0, 0), (0.08, 1), (0.30, 0.6), (0.62, 0), (0.7, 0)])
        c['arm_R'] = xform_arm(lerp_arm(SHEET['R'], POSES['R_hit'], fling), 'R', None, 1 + 0.10 * wob)
        c['arm_L'] = xform_arm(lerp_arm(SHEET['L'], POSES['L_hit'], fling), 'L', None, 1 - 0.10 * wob)
        c['jaw_R'] = c['jaw_L'] = 0.35 * fling
        c['bob'] = -0.010 * bell(ts, 0.40, 0.15)
        c['cord_wag'] = 0.45 * wob; c['cord_lift'] = 0.02 * recoil
    elif clip == 'defeat':
        ts = t * 2.4; H = 1.85; tsh = min(ts, H)
        bonk = keyed(tsh, [(0, 0), (0.28, 1), (0.42, 1), (0.70, 0.3), (1.0, 0)])
        press = keyed(tsh, [(0, 1), (0.27, 1), (0.31, 0.45), (0.45, 0.45), (0.60, 1), (2.4, 1)])
        spark_open = keyed(tsh, [(0, 0), (0.29, 0), (0.40, 1), (0.95, 1), (1.25, 0), (2.4, 0)])
        crackle = 1 + 0.18 * math.sin(math.tau * 11 * tsh) * spark_open
        c['sparks'] = (1 + (1 / FX_K - 1) * spark_open) * crackle; c['spark_spin'] = 2.4 * keyed(tsh, [(0, 0), (0.3, 0), (1.25, 1), (2.4, 1)])
        c['button'] = press
        shud = keyed(tsh, [(0, 0), (0.30, 0), (0.34, 1), (0.62, 1), (0.72, 0), (2.4, 0)])
        g = [hashn(int(tsh * 15), k) * shud for k in range(4)]
        sproing = 0.10 * keyed(tsh, [(0, 0), (0.36, 0), (0.50, 1.18), (0.60, 0.88), (0.70, 1.05), (0.80, 1.0), (1.05, 1.0), (1.55, 0.64), (1.72, 0.74), (H, 0.70)])   # held high enough that the drooped head clears the body top
        c['pop'] = sproing
        c['beacon_spin'] = math.tau * 3.0 * keyed(tsh, [(0, 0), (0.36, 0), (1.35, 1), (H, 1)])
        c['beacon_scale'] = 1 + 0.12 * math.sin(math.tau * 6 * tsh) * keyed(tsh, [(0, 0), (0.36, 0), (0.45, 1), (1.2, 1), (1.4, 0), (H, 0)])
        c['dome'] = keyed(tsh, [(0, 0), (0.80, 0), (0.92, 1.38), (1.02, 1.12), (1.12, 1.26), (1.25, 1.20), (H, 1.20)])
        c['smoke_a'] = 1 + (1 / FX_K - 1) * keyed(tsh, [(0, 0), (0.86, 0), (1.10, 1), (H, 1)])
        c['smoke_b'] = 1 + (1 / FX_K - 1) * keyed(tsh, [(0, 0), (1.00, 0), (1.32, 1), (H, 1)])
        slump = keyed(tsh, [(0, 0), (1.05, 0), (1.50, 1.08), (1.62, 0.95), (1.74, 1.0), (H, 1.0)])
        c['chassis'] = chassis_M(0.015 * slump, -0.25 * slump)
        c['waist_rot'] = Rz(0.06 * g[0] - 0.10 * slump)
        c['body_rot'] = mul(Rx(0.05 * g[1] - 0.10 * slump), Ry(0.04 * g[2] - 0.06 * slump))
        c['bob'] = -0.02 * keyed(tsh, [(0, 0), (1.45, 0), (1.60, 1), (H, 1)])
        droop = keyed(tsh, [(0, 0), (1.10, 0), (1.55, 1.1), (1.70, 0.95), (H, 1.0)])
        c['neck_rot'] = mul(Ry(-0.28 * droop), Rx(-0.28 * droop))
        c['head_rot'] = mul(Rz(0.10 * g[3] + 0.18 * droop), Rx(0.05 * g[0]))
        dizzy = keyed(tsh, [(0, 0), (1.20, 0), (1.45, 1), (H, 1)]); spin = math.tau * 2.0 * min(1.0, max(0.0, (tsh - 1.2) / (H - 1.2)))
        c['lid_tilt'] = -RG.EYE_TILT * keyed(tsh, [(0, 1), (0.36, 0), (1.3, 0), (1.6, -1.4), (H, -1.4)])
        c['lid_k'] = keyed(tsh, [(0, 1), (0.36, 1), (0.44, 0.50), (1.25, 0.50), (1.65, 1.95), (H, 1.95)])
        c['pupil'] = keyed(tsh, [(0, 1), (0.36, 1), (0.44, 0.56), (H, 0.60)])
        c['glance'] = RG.SHEET_GLANCE * keyed(tsh, [(0, 1), (0.40, 0), (H, 0)]) + V(0.011 * math.cos(spin + 1.2) * dizzy, 0, -0.004 + 0.009 * math.sin(spin + 1.2) * dizzy)
        c['glare'] = 0.0
        hang = keyed(tsh, [(0, 0), (1.05, 0), (1.60, 1), (H, 1)])
        fl = 1 + 0.10 * math.sin(math.tau * 2.2 * max(0.0, tsh - 1.4)) * math.exp(-4 * max(0.0, tsh - 1.4)) * (tsh > 1.4) * (1 - smooth((tsh - 1.8) / 0.05))
        aR = lerp_arm(SHEET['R'], POSES['R_hit'], keyed(tsh, [(0, 0), (0.36, 0), (0.55, 0.8), (1.05, 0.6), (1.6, 0), (H, 0)]))
        c['arm_R'] = xform_arm(lerp_arm(aR, POSES['R_hang'], hang), 'R', None, fl)
        aL = lerp_arm(SHEET['L'], POSES['L_bonk'], bonk)
        c['arm_L'] = xform_arm(lerp_arm(aL, POSES['L_hang'], hang), 'L', None, fl)
        c['jaw_R'] = 0.30 * keyed(tsh, [(0, 0), (0.36, 0), (0.5, 1), (1.1, 1), (1.6, 0.35), (H, 0.35)])
        c['jaw_L'] = -0.05 * bonk + 0.30 * keyed(tsh, [(0, 0), (1.1, 0), (1.6, 1), (H, 1)])
        c['cord_wag'] = 0.3 * g[1] + 0.25 * keyed(tsh, [(0, 0), (1.1, 0), (1.6, 1), (H, 1)])
        c['cord_flop'] = 0.95 * keyed(tsh, [(0, 0), (1.15, 0), (1.62, 1.1), (1.74, 1.0), (H, 1.0)])
    return c

PREV = {}
def apply(P):
    for b in bones:
        pb = arm.pose.bones[b.name]; rest = RESTM[b.name]
        prefix = P.M[b.parent.name] @ RESTM[b.parent.name].inverted() @ rest if b.parent else rest
        basis = prefix.inverted() @ P.M[b.name]; loc, quat, scale = basis.decompose()
        if b.name in PREV and PREV[b.name].dot(quat) < 0: quat.negate()
        PREV[b.name] = quat.copy()
        pb.rotation_mode = 'QUATERNION'; pb.location = loc; pb.rotation_quaternion = quat; pb.scale = scale

def basis_error(P):
    worst = 0.0
    for b in bones:
        rest = RESTM[b.name]; prefix = P.M[b.parent.name] @ RESTM[b.parent.name].inverted() @ rest if b.parent else rest
        basis = prefix.inverted() @ P.M[b.name]
        worst = max(worst, max(abs(basis[i][j] - (1 if i == j else 0)) for i in range(4) for j in range(4)))
    return worst

def shear_error(P):
    """Largest off-diagonal residue after removing each bone basis's rotation and scale (must be ~0: no shear)."""
    worst = 0.0
    for b in bones:
        rest = RESTM[b.name]; prefix = P.M[b.parent.name] @ RESTM[b.parent.name].inverted() @ rest if b.parent else rest
        basis = prefix.inverted() @ P.M[b.name]; loc, q, s = basis.decompose()
        rebuilt = Matrix.LocRotScale(loc, q, s)
        worst = max(worst, max(abs(basis[i][j] - rebuilt[i][j]) for i in range(4) for j in range(4)))
    return worst

def sheet_check():
    """Idle 0 s must return both claws, the eyelid tilt and the glance to the blockout sheet pose."""
    P = build_pose(evaluate('idle', 0.0)); out = {}
    for s in 'RL':
        J, W, Tn, Sn, _ = RG.SHEET_ARM[s]
        M = P.M['claw_' + s] @ RESTM['claw_' + s].inverted() @ RG.claw_frame(*RG.REST_ARM[s][1:4])
        out['claw_%s_wrist_err_m' % s] = (M.translation - W).length
        want = RG.claw_frame(W, Tn, Sn)
        out['claw_%s_frame_err' % s] = max(abs(M[i][j] - want[i][j]) for i in range(3) for j in range(3))
        out['arm_%s_joint_err_m' % s] = max((P.M['arm_%s_%d' % (s, i + 1)].translation - J[i]).length for i in range(RG.N_ARM))
    lid = P.full('eyelid_tilt').to_3x3(); want = Ry(-RG.EYE_TILT)
    out['eyelid_tilt_err'] = max(abs(lid[i][j] - want[i][j]) for i in range(3) for j in range(3))
    iris = P.point('pupil', V(0, RG.LENS_Y + RG.GLASS_DEPTH, RG.EYE_C.z))
    out['glance_err_m'] = abs((iris.x - RG.SHEET_GLANCE.x)) + abs(iris.z - RG.EYE_C.z - RG.SHEET_GLANCE.z)
    out['cord_err_m'] = max((P.M['cord_%d' % (i + 1)].translation - CORD_REST[i]).length for i in range(5))
    return out

if __name__ == '__main__':
    scene = bpy.context.scene; scene.render.fps = FPS; scene.frame_start = 0; scene.frame_end = 90
    assert scene.get('work_order') == 'WO111' and scene.get('scene_lease') == 'active' and scene.get('asset_id') == 'lab-robot'
    err = basis_error(build_pose(rest_controls())); assert err < 1e-4, ('rest controls do not reproduce the bind pose', err)
    sheet = sheet_check(); assert all(v < 2e-4 for v in sheet.values()), ('idle 0 s is not the sheet pose', sheet)
    arm.animation_data_clear(); arm.animation_data_create()
    for action in list(bpy.data.actions): bpy.data.actions.remove(action)
    records = []; worst_shear = 0.0
    for name, duration, loop in CLIPS:
        action = bpy.data.actions.new(name); arm.animation_data.action = action; end = round(duration * FPS); PREV.clear()
        for frame in range(end + 1):
            scene.frame_set(frame); P = build_pose(evaluate(name, frame / end)); worst_shear = max(worst_shear, shear_error(P)); apply(P)
            for pb in arm.pose.bones:
                if pb.name == 'root': continue
                fields = ('location', 'rotation_quaternion', 'scale') if pb.name in SCALED else ('location', 'rotation_quaternion')
                for field in fields: pb.keyframe_insert(data_path=field, frame=frame, group=pb.name)
        for fc in action.fcurves:
            for k in fc.keyframe_points: k.interpolation = 'LINEAR'
        track = arm.animation_data.nla_tracks.new(); track.name = name; strip = track.strips.new(name, 0, action); strip.action_frame_start = 0; strip.action_frame_end = end; track.mute = True
        records.append({'name': name, 'duration_s': duration, 'loop': loop, 'clamp_when_finished': not loop, 'frames': end + 1, 'fps': FPS,
                        'contact_time_s': CONTACT_S if name == 'attack' else None, 'contact_fraction': round(CONTACT_S / duration, 4) if name == 'attack' else None,
                        'tell_s': [0.0, 0.45] if name == 'attack' else None, 'windup_s': [0.45, 1.0] if name == 'attack' else None,
                        'glare_open_s': [0.06, 1.75] if name == 'attack' else None,
                        'button_bonk_s': 0.28 if name == 'defeat' else None, 'sparks_s': [0.29, 1.25] if name == 'defeat' else None,
                        'dome_pop_s': 0.92 if name == 'defeat' else None, 'smoke_from_s': 0.86 if name == 'defeat' else None,
                        'held_final_pose_from_s': DEFEAT_HOLD_S if name == 'defeat' else None})
    assert worst_shear < 1e-5, ('a bone basis carries shear', worst_shear)
    arm.animation_data.action = None
    for pb in arm.pose.bones: pb.matrix_basis = Matrix.Identity(4)
    scene.frame_set(0); bpy.context.view_layer.update()
    arm['attack_contact_seconds'] = CONTACT_S; arm['attack_contact_fraction'] = CONTACT_S / 2.0
    bp = ROOT / 'source/bounds.json'
    if bp.exists():
        br = json.loads(bp.read_text()); skin['model_space_bounds_y_up'] = br['safe_culling_envelope']; skin['bounds_method'] = br['method']
    for name in ('build.py', 'common.py', 'paint.py', 'rig.py', 'animate.py'):
        old = bpy.data.texts.get('WO111 lab robot ' + name)
        if old: bpy.data.texts.remove(old)
        block = bpy.data.texts.new('WO111 lab robot ' + name); block.write((ROOT / 'source' / name).read_text())
    bpy.ops.object.select_all(action='DESELECT'); skin.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'lab-robot.blend'), compress=True)
    bpy.ops.export_scene.gltf(filepath=str(ROOT / 'lab-robot.glb'), export_format='GLB', use_selection=True, export_yup=True, export_animations=True, export_animation_mode='NLA_TRACKS',
                              export_optimize_animation_size=False, export_skins=True, export_def_bones=False, export_armature_object_remove=True, export_all_influences=False,
                              export_influence_nb=4, export_apply=False, export_texcoords=True, export_normals=True, export_tangents=False, export_materials='EXPORT',
                              export_vertex_color='NONE', export_image_format='AUTO', export_all_vertex_colors=False, export_cameras=False, export_lights=False, export_extras=True)
    record = json.loads((ROOT / 'construction.json').read_text()); record['clips'] = records; record['rest_reproduction_max_error'] = err; record['sheet_pose_reproduction'] = sheet
    record['max_bone_shear'] = worst_shear
    record['sheet_targets'] = {'claw_' + s: list(map(float, RG.SHEET_ARM[s][1])) for s in 'RL'}
    record['sheet_targets_note'] = 'Blender coordinates of the blockout claw wrists (the sheet pose), reproduced by idle at 0 s.'
    record['files'] = {name: {'bytes': (ROOT / name).stat().st_size, 'sha256': hashlib.sha256((ROOT / name).read_bytes()).hexdigest()} for name in ['lab-robot.blend', 'lab-robot.glb', 'pigment.png']}
    (ROOT / 'construction.json').write_text(json.dumps(record, indent=2) + '\n')
    print(json.dumps({'clips': [(r['name'], r['frames']) for r in records], 'rest_error': err, 'sheet': sheet, 'shear': worst_shear, 'files': record['files']}))
