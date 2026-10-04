"""gadget-hammer-hopper v001 acting, baked at 60 fps into exactly five NLA clips (no root motion).

idle   2.0 s loop  the concept pose at 0 s; bounces twice on its spring, the box sways, the lid clacks at
                   each bounce bottom, the carry handle wobbles, it twirls the mallet, pumps the left fist,
                   side-eyes back and forth, blinks once and wiggles a naughty eyebrow
move   0.7 s loop  one big hop per loop on the pogo spring: crouch, push off, the boot leaves the floor
                   (toe pointed), lands; leaning into the hop, arms swinging, eyes wide, lid flapping
attack 2.0 s       tell (0-0.45 s): brows slam into a V, eyes narrow, grin widens, the lid rattles and the
                   box shivers while the mallet lifts and twists; wind-up (0.45-1.0 s): the spring squashes,
                   it leans back and hauls the mallet over its head; strike: it springs forward and the
                   mallet swings over the top, its rubber cap hitting the floor in front at the 1.25 s
                   contact and squashing; the eyes pop and the lid bangs open; recovers to the concept pose
hit    0.6 s       jolts back on the spring, eyes squeezed shut, lid pops, brows shoot up, arms fling, settles
defeat 2.4 s       jolt, then a dizzy boing: it springs up and spins a full turn, the lid flies open and a
                   wrench pops out and clatters onto the floor; it lands, wobbles and topples onto its back:
                   boot kicking up in the air, arms and mallet flopped on the floor, cross-eyed and gaping.
                   Held from 1.95 s
"""
import bpy, math, json, hashlib, importlib.util
from pathlib import Path
from mathutils import Vector, Matrix, Euler, Quaternion
SRC = Path('/workspace/haynes-quest/action-worlds/minions-a/v001/source')
def load(name):
    spec = importlib.util.spec_from_file_location('mna_' + name, SRC / (name + '.py')); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
C = load('common'); RG = load('hopper_rig')
V = C.V; smooth = C.smooth
ASSET = 'gadget-hammer-hopper'; ROOT = C.PACK / ASSET
FPS = 60; CONTACT_S = 1.25; WIND_S = .9; HOLD_S = 1.95
CLIPS = [('idle', 2.0, True), ('move', .7, True), ('attack', 2.0, False), ('hit', .6, False), ('defeat', 2.4, False)]
SCALED = {'eye_R', 'eye_L', 'mouth', 'mallet'}

def E(x=0, y=0, z=0): return Euler((math.radians(x), math.radians(y), math.radians(z)), 'XYZ').to_quaternion()
def T(v): return Matrix.Translation(Vector(v))
def lerp(a, b, s):
    if isinstance(a, Quaternion): return a.slerp(b, s)
    if isinstance(a, (tuple, list)): a, b = Vector(a), Vector(b)
    return a + (b - a) * s
def keyed(t, keys, ease=smooth):
    """Eased interpolation between (time, value) keys (floats, vectors, quaternions); clamps at the ends."""
    if t <= keys[0][0]: v = keys[0][1]; return Vector(v) if isinstance(v, (tuple, list)) else v
    for (a, x), (b, y) in zip(keys, keys[1:]):
        if t <= b: return lerp(x, y, ease((t - a) / (b - a)) if b > a else 1)
    v = keys[-1][1]; return Vector(v) if isinstance(v, (tuple, list)) else v
def loop_cr(u, keys):
    """Periodic Catmull-Rom through (u, value) keys on [0, 1); floats or vectors."""
    n = len(keys); ts = [k[0] for k in keys]; vs = [Vector(k[1]) if isinstance(k[1], (tuple, list)) else k[1] for k in keys]
    u = u % 1.0; i = max(j for j in range(n) if ts[j] <= u + 1e-12)
    t0 = ts[i]; t1 = ts[(i + 1) % n] + (1 if i + 1 >= n else 0); s = (u - t0) / (t1 - t0)
    p0, p1, p2, p3 = vs[(i - 1) % n], vs[i], vs[(i + 1) % n], vs[(i + 2) % n]
    return .5 * ((2 * p1) + (-p0 + p2) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s * s + (-p0 + 3 * p1 - 3 * p2 + p3) * s ** 3)
def cr_path(pts, per):
    P = [Vector(p) for p in pts]; P = [P[0] + (P[0] - P[1])] + P + [P[-1] + (P[-1] - P[-2])]; out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(per):
            u = k / per; out.append(.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3))
    out.append(P[-2]); return out
def pbell(u, c, w): return max(C.bell(u, c, w), C.bell(u - 1, c, w), C.bell(u + 1, c, w))
def ease_in(s): s = max(0, min(1, s)); return s * s * s
def ease_out(s): s = max(0, min(1, s)); return 1 - (1 - s) ** 3

arm = bpy.data.objects['Gadget_Hammer_Hopper_Rig']; skin = bpy.data.objects['Gadget_Hammer_Hopper_Skin']
RIG = C.Rig(arm)
A0 = RG.hand_frame_R().col[0].copy(); U0 = RG.GRIP_U.copy()
FR0 = RG.hand_frame_R(); FL0 = RG.hand_frame_L()
REST_SPRING_J = RG.joints_on(RG.REST_SPRING, RG.N_SPRING)
REST_HOSE_J = {'R': RG.joints_on(RG.REST_HOSE_R, RG.N_HOSE), 'L': RG.joints_on(RG.REST_HOSE_L, RG.N_HOSE)}
BODY_PIVOT = V(0, 0, RG.BOX_Z0)
CAP_REST = RG.HAND_R + U0 * RG.HEAD_OFF + A0 * .255          # the rubber cap that strikes

def rframe(A, U):
    A = Vector(A).normalized(); U = Vector(U); U = (U - A * U.dot(A)).normalized()
    return Matrix((A, U, A.cross(U))).transposed()
def lframe(down, fwd=(0, 1, 0)):
    return RG.hand_frame_L(Vector(down), Vector(fwd))

def rest_params():
    return {'spin': 0.0, 'body_off': V(0, 0, 0), 'body_q': Quaternion(), 'body_pivot': BODY_PIVOT.copy(), 'body_D': None,
            'boot_off': V(0, 0, 0), 'boot_q': Quaternion(), 'boot_D': None, 'lid': 0.0, 'handle': 0.0,
            'eye_R': V(1, 1, 1), 'eye_L': V(1, 1, 1), 'look_R': V(RG.PUPIL_LOOK.x, 0, RG.PUPIL_LOOK.z), 'look_L': V(RG.PUPIL_LOOK.x, 0, RG.PUPIL_LOOK.z),
            'brow_R': (0.0, 0.0), 'brow_L': (0.0, 0.0), 'mouth': V(1, 1, 1),
            'hand_space': 'body', 'hand_R': (RG.HAND_R.copy(), rframe(A0, U0)), 'hand_L': (RG.HAND_L.copy(), FL0.copy()),
            'mallet_s': V(1, 1, 1), 'wrench_D': None}

def pupil_offset(s, look):
    c, r = RG.EYE_R if s == 'R' else RG.EYE_L
    def y(l): return r.y * (math.sqrt(max(0.0, 1 - (l.x / r.x) ** 2 - (l.z / r.z) ** 2)) - .134)
    l0 = V(RG.PUPIL_LOOK.x, 0, RG.PUPIL_LOOK.z)
    return V(look.x - l0.x, y(look) - y(l0), look.z - l0.z)

def body_matrix(P):
    Dspin = C.rot_about(V(0, 0, 0), Quaternion((0, 0, 1), math.radians(P['spin'])))
    Db = P['body_D'] if P['body_D'] is not None else T(P['body_off']) @ C.rot_about(P['body_pivot'], P['body_q'])
    Dk = P['boot_D'] if P['boot_D'] is not None else T(P['boot_off']) @ C.rot_about(RG.ANKLE, P['boot_q'])
    return Dspin @ Db, Dspin @ Dk

def pose(P):
    Db, Dk = body_matrix(P); Rb = Db.to_quaternion(); Rk = Dk.to_quaternion(); D = {'body': Db, 'boot': Dk}
    # spring: a cubic from the boot cap to the box bottom; joints slerp from boot to body, then bend to the tangent
    curve = RG.spring_curve(Db @ RG.SPRING_TOP, Db.to_3x3() @ V(0, 0, -1), Dk @ RG.SPRING_BOT, Dk.to_3x3() @ V(0, 0, 1))
    for k, ((p, t), (q, u)) in enumerate(zip(REST_SPRING_J, RG.joints_on(curve, RG.N_SPRING))):
        base = Rk.slerp(Rb, k / (RG.N_SPRING - 1)); R = (base @ t).rotation_difference(u) @ base
        D['spring_%d' % k] = T(q) @ R.to_matrix().to_4x4() @ T(-p)
    D['lid'] = Db @ C.rot_about(RG.HINGE, E(P['lid']))
    D['handle'] = D['lid'] @ C.rot_about(V(0, 0, RG.LID_Z1), E(0, P['handle']))
    for s in 'RL':
        c, r = RG.EYE_R if s == 'R' else RG.EYE_L
        D['eye_' + s] = Db @ C.scale_about(c, RIG.frame('eye_' + s), P['eye_' + s])
        D['pupil_' + s] = D['eye_' + s] @ T(pupil_offset(s, P['look_' + s]))
        dz, anger = P['brow_' + s]; h = RIG.head('brow_' + s)
        D['brow_' + s] = Db @ T(V(0, 0, dz)) @ C.rot_about(h, E(0, -anger if s == 'R' else anger))
    D['mouth'] = Db @ C.scale_about(RG.MOUTH_TOP, RIG.frame('mouth'), P['mouth'])
    world = P['hand_space'] == 'world'
    for s, rest_pos, rest_frame, wrist_d in (('R', RG.HAND_R, FR0, RG.WRIST_R), ('L', RG.HAND_L, FL0, RG.WRIST_L)):
        pos, fr = P['hand_' + s]
        Wp = pos.copy() if world else Db @ pos; Wf = fr.copy() if world else Rb.to_matrix() @ fr
        D['hand_' + s] = C.frame_to(rest_pos, rest_frame, Wp, Wf)
        Rh = (Wf @ rest_frame.inverted()).to_quaternion()
        sh = Db @ (RG.SHOULDER_R if s == 'R' else RG.SHOULDER_L); out = Rb @ V(1 if s == 'R' else -1, 0, .05)
        curve = RG.hose_curve(sh, out, Wp - Wf.col[1] * wrist_d, Wf.col[1])
        for k, ((p, t), (q, u)) in enumerate(zip(REST_HOSE_J[s][:-1], RG.joints_on(curve, RG.N_HOSE)[:-1])):
            base = Rb.slerp(Rh, k / (RG.N_HOSE - 1)); R = (base @ t).rotation_difference(u) @ base
            D['arm_%s_%d' % (s, k)] = T(q) @ R.to_matrix().to_4x4() @ T(-p)
    D['mallet'] = D['hand_R'] @ C.scale_about(CAP_REST, RIG.frame('mallet'), P['mallet_s'])
    if P['wrench_D'] is not None: D['wrench'] = P['wrench_D']
    return D

# ---------------------------------------------------------------- clips
def idle(t):
    P = rest_params(); w = math.tau * t; b = .5 - .5 * math.cos(w); h = math.sin(math.pi * t)
    P['body_off'] = V(.012 * h, 0, -.03 * b); P['body_q'] = E(2.5 * math.sin(w) * .4, 3.0 * h, 1.5 * h)
    P['lid'] = 3.2 * b ** 4; P['handle'] = 7 * math.sin(w)
    P['hand_R'] = (RG.HAND_R + V(-.015 * b, .02 * h, -.035 * b), rframe(Quaternion(U0, math.radians(18 * h)) @ (E(0, 6 * b) @ A0), E(0, 6 * b) @ U0))
    P['hand_L'] = (RG.HAND_L + V(-.01 * b, .03 * h, .035 * b), lframe(Quaternion((1, 0, 0), math.radians(-10 * b)) @ FL0.col[1]))
    glance = keyed(t, [(0, 0.0), (.5, 0.0), (.62, 1.0), (1.05, 1.0), (1.2, 0.0), (2.0, 0.0)])
    for s in 'RL':
        P['look_' + s] = V(RG.PUPIL_LOOK.x + .075 * glance, 0, RG.PUPIL_LOOK.z + .012 * glance)
        blink = keyed(t, [(0, 1.0), (1.52, 1.0), (1.6, .1), (1.68, 1.0), (2.0, 1.0)])
        P['eye_' + s] = V(1 + .03 * b, 1, blink * (1 + .02 * b))
    P['brow_L'] = (keyed(t, [(0, 0.0), (.25, 0.0), (.4, .022), (.8, .022), (.95, 0.0), (2.0, 0.0)]), keyed(t, [(0, 0.0), (.25, 0.0), (.4, -8.0), (.8, -8.0), (.95, 0.0), (2, 0.0)]))
    P['brow_R'] = (0.0, 4 * math.sin(2 * w) * h)
    P['mouth'] = V(1 + .04 * b, 1 + .1 * b, 1)
    return P

def move(t):
    P = rest_params(); u = t / .7
    bz = loop_cr(u, [(0, 0.0), (.16, -.07), (.36, .1), (.58, .2), (.8, .03)])
    kz = max(0.0, loop_cr(u, [(0, 0.0), (.34, 0.0), (.56, .19), (.74, .03), (.8, 0.0), (.9, 0.0)]))
    if u < .34 or u > .8: kz = 0.0
    lean = loop_cr(u, [(0, 4.0), (.2, 8.0), (.42, 12.0), (.62, 8.0), (.82, 2.0)])
    sway = math.sin(math.tau * u)
    P['body_off'] = V(.01 * sway, .02 * math.sin(math.tau * u - 1), bz); P['body_q'] = E(-lean, 3 * sway, 0)
    ky = loop_cr(u, [(0, 0.0), (.34, 0.0), (.5, -.04), (.66, -.02), (.8, 0.0)]) if .34 < u < .8 else 0.0
    P['boot_off'] = V(0, ky, kz); P['boot_q'] = E(-16 * kz / .19)
    P['lid'] = 2 + 8 * pbell(u, .9, .12); P['handle'] = 10 * math.sin(math.tau * u)
    swing = math.sin(math.tau * (u - .1))
    P['hand_R'] = (RG.HAND_R + V(.02, -.07 * swing, .05 * math.sin(math.tau * u - 2)), rframe(E(-14 * swing) @ A0, E(-14 * swing) @ U0))
    P['hand_L'] = (RG.HAND_L + V(-.02, .09 * swing, .06 + .04 * math.sin(math.tau * u)), lframe(E(22 * swing) @ FL0.col[1]))
    for s in 'RL':
        P['eye_' + s] = V(1.06, 1, 1.1 + .04 * math.sin(math.tau * u)); P['look_' + s] = V(-.008, 0, .012)
        P['brow_' + s] = (.014, -4.0)
    P['mouth'] = V(1.08, 1.2 + .15 * math.sin(math.tau * u - 1), 1)
    return P

# attack: the hand path is authored in world space (the box is moving under it)
def attack_hand_R(t):
    rest = (RG.HAND_R.copy(), rframe(A0, U0))
    lift = (RG.HAND_R + V(-.02, -.04, .1), rframe(E(-25, 0, -30) @ A0, E(-25, 0, -30) @ U0))
    Uw = V(.06, -.62, .78).normalized(); Aw = V(1, 0, 0).cross(Uw).normalized()
    wind = (V(.62, -.30, 1.32), rframe(-Aw, Uw))
    Uc = V(0, math.cos(math.radians(-22)), math.sin(math.radians(-22))); Ac = V(1, 0, 0).cross(Uc).normalized()
    contact = (V(.36, .60, .39), rframe(-Ac, Uc))
    if t <= .45: return keyed(t, [(0, rest[0]), (.12, rest[0]), (.45, lift[0])]), keyed(t, [(0, rest[1].to_quaternion()), (.12, rest[1].to_quaternion()), (.45, lift[1].to_quaternion())]).to_matrix()
    if t <= WIND_S:
        s = smooth((t - .45) / (WIND_S - .45)); return lerp(lift[0], wind[0], s), lerp(lift[1].to_quaternion(), wind[1].to_quaternion(), s).to_matrix()
    if t <= CONTACT_S:
        u = (t - WIND_S) / (CONTACT_S - WIND_S); s = u * u
        path = C.bezier(wind[0], wind[0] + V(.12, .3, .5), contact[0] + V(.4, .12, .75), contact[0], 80)
        return C.resample(path, [s])[0], lerp(wind[1].to_quaternion(), contact[1].to_quaternion(), s).to_matrix()
    if t <= 1.42: return contact[0] + V(0, 0, .05 * C.bell(t, 1.33, .09)), contact[1]
    s = smooth((t - 1.42) / .58)
    via = (V(.98, .28, 1.12), rframe(V(-.3, 0, 1), V(.15, .5, .5)))
    path = cr_path([contact[0], V(.74, .55, .72), via[0], rest[0] + V(.12, .02, .1), rest[0]], 24)
    q = lerp(contact[1].to_quaternion(), via[1].to_quaternion(), smooth(s / .6)) if s < .6 else lerp(via[1].to_quaternion(), rest[1].to_quaternion(), smooth((s - .6) / .4))
    return C.resample(path, [s])[0], q.to_matrix()

def attack(t):
    P = rest_params(); P['hand_space'] = 'world'
    tell = C.bell(t, .25, .25) if t < .45 else (1.0 if t < 1.25 else 0.0)
    shiver = .011 * math.sin(math.tau * 15 * t) * (C.bell(t, .25, .22))
    dz = keyed(t, [(0, 0.0), (.45, -.01), (.86, -.075), (1.04, .035), (1.25, -.035), (1.33, .02), (1.5, -.01), (2.0, 0.0)])
    pitch = keyed(t, [(0, 0.0), (.45, 4.0), (.86, 13.0), (1.04, 0.0), (1.25, -20.0), (1.38, -14.0), (1.7, -2.0), (2.0, 0.0)])
    P['body_off'] = V(shiver, keyed(t, [(0, 0.0), (.86, -.03), (1.25, .07), (1.6, .02), (2, 0.0)]), dz); P['body_q'] = E(pitch, 0, keyed(t, [(0, 0.0), (.86, -6.0), (1.25, 4.0), (2, 0.0)]))
    P['lid'] = (5.5 * abs(math.sin(math.tau * t / .16)) if .04 < t < .45 else 0.0) + 30 * keyed(t, [(0, 0.0), (1.26, 0.0), (1.33, 1.0), (1.46, 0.0), (2, 0.0)], ease_out)
    P['handle'] = 14 * math.sin(math.tau * 9 * t) * C.bell(t, .25, .22) + 18 * math.sin(math.tau * 6 * t) * C.bell(t, 1.4, .2)
    P['hand_R'] = attack_hand_R(t)
    P['hand_L'] = (keyed(t, [(0, RG.HAND_L), (.45, RG.HAND_L + V(-.02, .06, .04)), (.86, V(-.6, .26, .66)), (1.25, V(-.68, -.12, .56)), (1.55, V(-.66, -.02, .5)), (2.0, RG.HAND_L)]),
                   lframe(keyed(t, [(0, FL0.col[1].copy()), (.86, V(.2, .6, -.6)), (1.25, V(.15, -.5, -.7)), (2.0, FL0.col[1].copy())])))
    squash = keyed(t, [(0, 0.0), (1.24, 0.0), (1.27, 1.0), (1.31, -.35), (1.37, .1), (1.43, 0.0), (2, 0.0)])
    P['mallet_s'] = V(1 - .24 * squash, 1 + .1 * squash, 1 + .1 * squash)
    pop = keyed(t, [(0, 0.0), (1.24, 0.0), (1.29, 1.0), (1.5, .3), (1.7, 0.0), (2, 0.0)])
    for s in 'RL':
        P['eye_' + s] = V(1 + .04 * tell + .12 * pop, 1, 1 - .3 * tell + .25 * pop)
        P['look_' + s] = V(lerp(RG.PUPIL_LOOK.x, -.004 if s == 'R' else .004, max(tell, pop)), 0, RG.PUPIL_LOOK.z - .01 * tell)
        P['brow_' + s] = (-.022 * tell + .02 * pop, 14 * tell - 6 * pop)
    P['mouth'] = V(1 + .14 * tell + .08 * pop, 1 + .2 * tell + .45 * pop, 1)
    return P

def hit(t):
    P = rest_params()
    pitch = keyed(t, [(0, 0.0), (.07, 15.0), (.18, -6.0), (.3, 3.0), (.42, -1.0), (.6, 0.0)])
    P['body_off'] = V(0, keyed(t, [(0, 0.0), (.07, -.06), (.25, -.01), (.6, 0.0)]), keyed(t, [(0, 0.0), (.06, .03), (.2, -.025), (.35, .005), (.6, 0.0)]))
    P['body_q'] = E(pitch, keyed(t, [(0, 0.0), (.1, -5.0), (.25, 4.0), (.4, -1.5), (.6, 0.0)]))
    P['lid'] = keyed(t, [(0, 0.0), (.09, 32.0), (.2, 0.0), (.28, 7.0), (.36, 0.0), (.6, 0.0)])
    P['handle'] = 16 * math.sin(math.tau * 5 * t) * (1 - t / .6)
    shut = keyed(t, [(0, 0.0), (.05, 1.0), (.26, 1.0), (.36, -.12), (.46, 0.0), (.6, 0.0)])
    for s in 'RL':
        P['eye_' + s] = V(1 + .08 * shut, 1, 1 - .86 * shut); P['brow_' + s] = (keyed(t, [(0, 0.0), (.05, .03), (.4, .025), (.6, 0.0)]), keyed(t, [(0, 0.0), (.05, -12.0), (.4, -8.0), (.6, 0.0)]))
    P['mouth'] = V(.9, keyed(t, [(0, 1.0), (.06, 1.55), (.3, 1.4), (.6, 1.0)]), 1)
    fl = keyed(t, [(0, 0.0), (.08, 1.0), (.3, .3), (.6, 0.0)])
    P['hand_R'] = (RG.HAND_R + V(.08, -.05, .07) * fl, rframe(E(20 * fl, 0, 0) @ A0, E(20 * fl) @ U0))
    P['hand_L'] = (RG.HAND_L + V(-.1, -.05, .14) * fl, lframe(E(-25 * fl) @ FL0.col[1]))
    return P

# ---- defeat: final lying pose (world), solved once
TOPPLE_PIVOT = V(0, -RG.BOX_D / 2, RG.BOX_Z0); LIE_Z = .05
def body_topple(s):
    """s in [0,1]: tip back about the back-bottom edge while the edge drops to the floor."""
    th = 90 * s; drop = (RG.BOX_Z0 - LIE_Z) * s * s
    return T(V(0, 0, -drop)) @ C.rot_about(TOPPLE_PIVOT, E(th))
DB_LIE = body_topple(1.0); RB_LIE = DB_LIE.to_quaternion()
KICK_DEG = 52
HAND_R_LIE = (V(.82, -.36, .125), rframe(V(.97, -.25, 0), V(.25, .97, 0)))
HAND_L_LIE = (V(-.78, -.30, .1), lframe(V(-.7, .4, -.15), V(0, 0, 1)))
def to_body(hand, Db):
    pos, fr = hand; R = Db.to_quaternion().to_matrix(); return Db.inverted() @ pos, R.inverted() @ fr
HAND_R_LIE_B = to_body(HAND_R_LIE, DB_LIE); HAND_L_LIE_B = to_body(HAND_L_LIE, DB_LIE)

def wrench_path(t):
    """World transform of the wrench after it pops (0.48 s) until it lands flat on the floor (0.98 s)."""
    t0 = .48; t1 = .98
    P0 = defeat(t0, want_wrench=False); D0, _ = body_matrix(P0)
    start = D0
    end = T(V(-.62, .55, .0165)) @ E(90, 0, 35).to_matrix().to_4x4() @ T(-V(.10, -.02, .80))
    s = max(0, min(1, (t - t0) / (t1 - t0)))
    p0 = start @ V(.10, -.02, .80); p1 = end @ V(.10, -.02, .80)
    apex = max(p0.z, p1.z) + .55
    pos = p0.lerp(p1, s) + V(0, 0, 4 * (apex - (p0.z + p1.z) / 2) * s * (1 - s)) if s < 1 else p1
    q = start.to_quaternion().slerp(end.to_quaternion(), smooth(s)) @ Quaternion((1, 0, 0), math.tau * 1.0 * s) if s < 1 else end.to_quaternion()
    if s >= 1: return end
    return T(pos) @ q.to_matrix().to_4x4() @ T(-V(.10, -.02, .80))

def defeat(t, want_wrench=True):
    P = rest_params()
    # 0-0.22 jolt; 0.22-0.85 boing + full spin; 0.85-1.0 land/wobble; 1.0-1.5 topple; 1.5-1.95 settle; hold
    jolt = keyed(t, [(0, 0.0), (.07, 1.0), (.2, 0.0)])
    up = keyed(t, [(0, 0.0), (.22, -.04), (.3, .05), (.5, .26), (.7, .12), (.8, 0.0), (.86, -.03), (.95, 0.0)])
    kz = keyed(t, [(0, 0.0), (.32, 0.0), (.5, .13), (.72, .02), (.78, 0.0)])
    P['spin'] = 360 * smooth((t - .25) / .58) if t < .83 else 0.0
    wob = 10 * math.sin(math.tau * 3.2 * (t - .8)) * (1 - smooth((t - .8) / .25)) if .8 < t < 1.05 else 0.0
    if t < 1.0:
        P['body_off'] = V(0, -.05 * jolt, up + .03 * jolt); P['body_q'] = E(14 * jolt, wob, 0)
        P['boot_off'] = V(0, 0, kz); P['boot_q'] = E(-12 * kz / .13)
    else:
        s = keyed(t, [(1.0, 0.0), (1.48, 1.0)], ease_in)
        bounce = .028 * math.sin(math.pi * min(1, max(0, (t - 1.5) / .16))) + .009 * math.sin(math.pi * min(1, max(0, (t - 1.66) / .1)))
        P['body_D'] = T(V(0, 0, bounce)) @ body_topple(s)
        kick = keyed(t, [(1.0, 0.0), (1.2, 0.0), (1.46, 1.0)])
        wig = 22 * math.sin(math.tau * 2.6 * (t - 1.45)) * (1 - smooth((t - 1.45) / .5)) if 1.45 < t < 1.95 else 0.0
        P['boot_D'] = P['body_D'] @ C.rot_about(RG.SPRING_TOP, E(KICK_DEG * kick + wig))
    lid = keyed(t, [(0, 0.0), (.08, 34.0), (.22, 10.0), (.42, 96.0), (.72, 96.0), (.9, 0.0), (2.4, 0.0)])
    P['lid'] = lid; P['handle'] = 20 * math.sin(math.tau * 4 * t) * (1 - smooth((t - .4) / 1.2))
    if want_wrench and t >= .48: P['wrench_D'] = wrench_path(t)
    shut = keyed(t, [(0, 0.0), (.05, 1.0), (.3, 1.0), (.4, 0.0)])
    dizzy = keyed(t, [(0, 0.0), (.8, 0.0), (1.0, 1.0)])
    cross = keyed(t, [(0, 0.0), (1.7, 0.0), (1.92, 1.0)])
    for i, s in enumerate('RL'):
        ang = math.tau * 2.2 * (t - .8) + i * math.pi
        circ = V(.04 * math.cos(ang), 0, .045 * math.sin(ang)) * dizzy * (1 - cross)
        inward = V(-.052 if s == 'R' else .052, 0, .02)
        P['look_' + s] = V(RG.PUPIL_LOOK.x, 0, RG.PUPIL_LOOK.z).lerp(inward, cross) + circ * 1.0
        P['eye_' + s] = V(1 + .08 * shut, 1, (1 - .86 * shut) * (1 - .35 * dizzy) + .0)
        P['brow_' + s] = (.025 * shut - .012 * dizzy, -12 * shut - 14 * dizzy)
    P['mouth'] = V(.95 + .1 * dizzy, keyed(t, [(0, 1.0), (.06, 1.5), (.4, 1.3), (1.0, 1.25), (1.6, 1.55)]), 1)
    # arms: fling, then flop onto the floor (body space, so they ride the spin and topple)
    fl = keyed(t, [(0, 0.0), (.08, 1.0), (.3, .4), (.6, .8), (.95, 0.0)])
    flop = keyed(t, [(1.0, 0.0), (1.55, 1.0)], ease_in) if t > 1.0 else 0.0
    hr = (RG.HAND_R + V(.08, -.05, .12) * fl, rframe(E(25 * fl) @ A0, E(25 * fl) @ U0))
    hl = (RG.HAND_L + V(-.12, -.04, .2) * fl, lframe(E(-30 * fl) @ FL0.col[1]))
    if flop > 0:
        mid_r = (RG.HAND_R + V(.25, .1, .1), rframe(E(-50) @ A0, E(-50) @ U0)); mid_l = (RG.HAND_L + V(-.18, .12, .15), FL0.copy())
        def blend(a, m, b, s):
            if s < .5: k = smooth(s / .5); return lerp(a[0], m[0], k), lerp(a[1].to_quaternion(), m[1].to_quaternion(), k).to_matrix()
            k = smooth((s - .5) / .5); return lerp(m[0], b[0], k), lerp(m[1].to_quaternion(), b[1].to_quaternion(), k).to_matrix()
        hr = blend(hr, mid_r, HAND_R_LIE_B, flop); hl = blend(hl, mid_l, HAND_L_LIE_B, flop)
    P['hand_R'] = hr; P['hand_L'] = hl
    return P

FN = {'idle': idle, 'move': move, 'attack': attack, 'hit': hit, 'defeat': defeat}
def evaluate(name, t):
    if name == 'defeat': t = min(t, HOLD_S)
    return pose(FN[name](t))

if __name__ == '__main__':
    C.guard(ASSET)
    sc = bpy.context.scene; sc.frame_start = 0; sc.frame_end = 150
    rest_err = max(max(abs(m[i][j] - (1 if i == j else 0)) for i in range(4) for j in range(4)) for m in RIG.complete(pose(rest_params())).values())
    idle0 = max(max(abs(m[i][j] - (1 if i == j else 0)) for i in range(4) for j in range(4)) for m in RIG.complete(evaluate('idle', 0)).values())
    assert rest_err < 1e-5 and idle0 < 1e-5, ('bind/idle-0 pose is not the concept pose', rest_err, idle0)
    report = {'attack': {'contact_time_s': CONTACT_S, 'contact_fraction': CONTACT_S / 2.0, 'tell_s': [0.0, .45], 'windup_s': [.45, 1.0], 'strike_s': [1.0, CONTACT_S], 'squash_s': [1.24, 1.43]},
              'defeat': {'held_final_pose_from_s': HOLD_S, 'wrench_pop_s': [.48, .98], 'spin_s': [.25, .83], 'topple_s': [1.0, 1.48]}}
    records, shear = C.bake(RIG, CLIPS, evaluate, FPS, SCALED, report)
    arm['attack_contact_seconds'] = CONTACT_S; arm['attack_contact_fraction'] = CONTACT_S / 2.0
    bp = ROOT / 'bounds.json'
    if bp.exists():
        br = json.loads(bp.read_text()); skin['model_space_bounds_y_up'] = br['safe_culling_envelope']; skin['bounds_method'] = br['method']
    for name in ('common.py', 'hopper_rig.py', 'hopper_build.py', 'hopper_anim.py'):
        old = bpy.data.texts.get('source ' + name)
        if old: bpy.data.texts.remove(old)
        bpy.data.texts.new('source ' + name).write((SRC / name).read_text())
    rec = json.loads((ROOT / 'construction.json').read_text()); rec['clips'] = records; rec['max_bone_shear'] = shear; rec['rest_reproduction_error'] = rest_err; rec['idle0_reproduction_error'] = idle0
    rec['fps'] = FPS; rec['scaled_bones'] = sorted(SCALED)
    (ROOT / 'construction.json').write_text(json.dumps(rec, indent=2) + '\n')
    bpy.ops.object.select_all(action='DESELECT'); skin.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / (ASSET + '.blend')), copy=True, compress=True)
    status = "action-minions-a gadget-hammer-hopper v001 · Awaiting Tom's review · candidate for the action worlds"
    C.export_glb(ROOT / (ASSET + '.glb'), skin, arm, {'asset_id': ASSET, 'asset_version': 'v001', 'pack': 'action-minions-a', 'candidate_status': status,
                 'source_reference': 'docs/assets/media/action-minions-a/v001/concept.png (coordinator image-generated construction reference, row 1)',
                 'source_concept_sha256': C.sha(C.PACK / 'concept.png') if (C.PACK / 'concept.png').exists() else 'pending',
                 'orientation': 'glTF +Y up, forward -Z, floor-centred stationary root, character right +X',
                 'role': 'ordinary enemy (DESIGN-029 Clubhouse cast)', 'authoring_model': 'claude-opus-5-5 xhigh (Claude Code, Max plan)', 'design': 'DESIGN-029'})
    files = {n: {'bytes': (ROOT / n).stat().st_size, 'sha256': C.sha(ROOT / n)} for n in (ASSET + '.blend', ASSET + '.glb', 'pigment.png')}
    rec['files'] = files; (ROOT / 'construction.json').write_text(json.dumps(rec, indent=2) + '\n')
    print(json.dumps({'clips': [(r['name'], r['frames']) for r in records], 'shear': shear, 'files': files}))
