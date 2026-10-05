"""mischief-kitten-skater v001 acting, baked at 60 fps into exactly five NLA clips (no root motion).

idle   2.0 s loop  the concept stance at 0 s; it rolls a little forward and back on its skates (wheels turning),
                   bobs, tilts its big head, flicks an ear, side-eyes, blinks, sways its tail and the bell swings
move   0.8 s loop  skating: two alternating hind-skate strokes per loop (push out and back, lift, return), the
                   front skates gliding, the body leaning in and swaying with each stroke, all sixteen wheels
                   rolling (three turns per loop), the tail streaming back, ears and hat pressed back
attack 2.0 s       tell (0-0.45 s): it crouches and wiggles its bottom, ears flatten, eyes narrow, brows drop, it
                   hisses and lashes its tail; wind-up (0.45-1.0 s): it rears up on its hind skates with the
                   front skates raised; strike: it dashes forward and stomps both front skates down in front at
                   the 1.25 s contact, mouth wide; then it rolls back to the concept stance
hit    0.6 s       recoils backwards on its skates, eyes squeezed, ears flat, the hat pops up and lands, tail bristles
defeat 2.4 s       the hat flies off, its skates slide apart, it spins round dizzily and flops onto its side with
                   all four skates sticking out; the hat lands on the floor; dizzy, cross-eyed, tongue out.
                   Held from 1.95 s
"""
import bpy, math, json, importlib.util
from pathlib import Path
from mathutils import Vector, Matrix, Euler, Quaternion
SRC = Path('/workspace/haynes-quest/action-worlds/minions-a/v001/source')
def load(name):
    spec = importlib.util.spec_from_file_location('mna_' + name, SRC / (name + '.py')); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
C = load('common'); KR = load('kitten_rig')
V = C.V; smooth = C.smooth
ASSET = 'mischief-kitten-skater'; ROOT = C.PACK / ASSET
FPS = 60; CONTACT_S = 1.25; HOLD_S = 1.95
CLIPS = [('idle', 2.0, True), ('move', .8, True), ('attack', 2.0, False), ('hit', .6, False), ('defeat', 2.4, False)]
SCALED = {'eye_R', 'eye_L', 'jaw'}

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
def ease_in(s): s = max(0, min(1, s)); return s * s * s
def ease_out(s): s = max(0, min(1, s)); return 1 - (1 - s) ** 3

arm = bpy.data.objects['Mischief_Kitten_Skater_Rig']; skin = bpy.data.objects['Mischief_Kitten_Skater_Skin']
RIG = C.Rig(arm)
BODY_PIVOT = V(0, -.03, .40)
SPINE_PIVOT = V(0, -.02, .41)
HEAD_PIVOT = V(0, .16, .56)
LEN = {n: KR.leg_lengths(n) for n in KR.LEGS}
def _pole(S, K, A):
    d = (A - S).normalized(); k = K - S; return (k - d * k.dot(d)).normalized()
POLES = {n: _pole(S, K, A) for n, (S, K, A) in KR.LEGS.items()}
REST_FUP = {n: KR.frame_y(K - S, POLES[n]) for n, (S, K, A) in KR.LEGS.items()}
REST_FLO = {n: KR.frame_y(A - K, POLES[n]) for n, (S, K, A) in KR.LEGS.items()}
REST_TAIL = [KR.TAIL_J[i] for i in range(KR.N_TAIL)]

def rest_params():
    return {'outer': Matrix.Identity(4), 'body_off': V(0, 0, 0), 'body_q': Quaternion(), 'spine_q': Quaternion(), 'neck_q': Quaternion(), 'head_q': Quaternion(),
            'jaw': 1.0, 'eye_R': V(1, 1, 1), 'eye_L': V(1, 1, 1), 'look_R': V(KR.PUPIL_LOOK.x, 0, KR.PUPIL_LOOK.z), 'look_L': V(KR.PUPIL_LOOK.x, 0, KR.PUPIL_LOOK.z),
            'brow_R': (0.0, 0.0), 'brow_L': (0.0, 0.0), 'ear_R': Quaternion(), 'ear_L': Quaternion(), 'hat_off': V(0, 0, 0), 'hat_q': Quaternion(), 'hat_world': None,
            'bell': 0.0, 'tail': [Quaternion() for _ in range(KR.N_TAIL)],
            'skate': {n: (V(0, 0, 0), Quaternion()) for n in KR.LEGS}, 'roll': {n: (0.0, 0.0) for n in KR.LEGS}}

def pupil_offset(s, look):
    em = KR.eye_matrix(s); r0 = V(KR.PUPIL_LOOK.x, 0, KR.PUPIL_LOOK.z)
    p1, _ = KR.eye_surface(s, look.x, look.z); p0, _ = KR.eye_surface(s, r0.x, r0.z)
    return em.to_3x3() @ (p1 - p0)

def pose(P):
    O = P['outer']; D = {}
    Db = T(P['body_off']) @ C.rot_about(BODY_PIVOT, P['body_q'])
    D['hips'] = O @ Db
    D['chest'] = O @ Db @ C.rot_about(SPINE_PIVOT, P['spine_q'])
    D['neck'] = D['chest'] @ C.rot_about(KR.NECK, P['neck_q'])
    D['head'] = D['neck'] @ C.rot_about(HEAD_PIVOT, P['head_q'])
    D['jaw'] = D['head'] @ C.scale_about(KR.MOUTH_TOP, RIG.frame('jaw'), (1, P['jaw'], 1))
    for s in 'RL':
        c, r = KR.EYE[s]
        D['eye_' + s] = D['head'] @ C.scale_about(c, RIG.frame('eye_' + s), P['eye_' + s])
        D['pupil_' + s] = D['eye_' + s] @ T(pupil_offset(s, P['look_' + s]))
        dz, anger = P['brow_' + s]; h = RIG.head('brow_' + s)
        D['brow_' + s] = D['head'] @ T(V(0, 0, dz)) @ C.rot_about(h, E(0, -anger if s == 'R' else anger))
        D['ear_' + s] = D['head'] @ C.rot_about(KR.EARS[s][0], P['ear_' + s])
    D['hat'] = P['hat_world'] if P['hat_world'] is not None else D['head'] @ T(P['hat_off']) @ C.rot_about(KR.HAT_BASE, P['hat_q'])
    D['bell'] = D['neck'] @ C.rot_about(KR.BELL_RING, E(P['bell']))
    prev = D['hips']
    for i in range(KR.N_TAIL):
        prev = prev @ C.rot_about(REST_TAIL[i], P['tail'][i]); D['tail_%d' % i] = prev
    Rb = (O @ Db).to_quaternion()
    for n, (S, K, A) in KR.LEGS.items():
        off, q = P['skate'][n]; Dk = O @ T(off) @ C.rot_about(A, q); D['skate_' + n] = Dk
        Sw = (D['chest'] if n[0] == 'F' else D['hips']) @ S; Aw = Dk @ A
        pole = Rb @ POLES[n]; L1, L2 = LEN[n]; Kw = KR.two_bone(Sw, Aw, L1, L2, pole)
        REACH[0] = max(REACH[0], (Aw - Sw).length - (L1 + L2), abs(L1 - L2) - (Aw - Sw).length)
        Fu = KR.frame_y(Kw - Sw, pole); Fl = KR.frame_y(Aw - Kw, pole)
        D['leg_%s_up' % n] = T(Sw) @ (Fu @ REST_FUP[n].inverted()).to_4x4() @ T(-S)
        D['leg_%s_lo' % n] = T(Kw) @ (Fl @ REST_FLO[n].inverted()).to_4x4() @ T(-K)
        for tag, dy, ang in zip('fb', KR.AXLE_DY, P['roll'][n]):
            ac = V(A.x, A.y + dy, KR.WHEEL_R); D['axle_%s_%s' % (n, tag)] = Dk @ C.rot_about(ac, Quaternion((1, 0, 0), ang))
    return D

REACH = [0.0]
def roll_for(dist): return -dist / KR.WHEEL_R          # forward travel turns the wheels this many radians
def tail_curve(sway=0.0, lift=0.0, curl=0.0, phase=0.0, wave=0.0):
    """Per-joint rotations: sway (about Z, side to side), lift (about X, raise/lower), curl at the tip, a travelling wave."""
    out = []
    for i in range(KR.N_TAIL):
        k = i / (KR.N_TAIL - 1)
        out.append(E(lift * (1 - .5 * k) + curl * k * k, 0, sway * (.5 + .5 * k) + wave * math.sin(phase - 1.1 * i)))
    return out

# ---------------------------------------------------------------- clips
def idle(t):
    P = rest_params(); w = math.tau * t / 2.0; h = math.sin(w); b = .5 - .5 * math.cos(2 * w)
    roll_y = .03 * math.sin(w)
    for n in KR.LEGS: P['skate'][n] = (V(0, roll_y, 0), Quaternion()); P['roll'][n] = (roll_for(roll_y), roll_for(roll_y))
    P['body_off'] = V(0, roll_y * 1.1, -.012 * b); P['body_q'] = E(1.5 * h, 2.5 * math.sin(2 * w), 0)
    P['head_q'] = E(2.5 * math.sin(2 * w), 7 * math.sin(w), 6 * h)
    flick = keyed(t, [(0, 0.0), (.55, 0.0), (.62, 1.0), (.7, 0.0), (.78, .7), (.86, 0.0), (2, 0.0)])
    P['ear_R'] = E(-18 * flick, 0, 12 * flick); P['ear_L'] = E(4 * b, 0, -3 * b)
    glance = keyed(t, [(0, 0.0), (.9, 0.0), (1.05, 1.0), (1.45, 1.0), (1.6, 0.0), (2, 0.0)])
    blink = keyed(t, [(0, 1.0), (1.72, 1.0), (1.79, .08), (1.86, 1.0), (2, 1.0)])
    for s in 'RL':
        P['look_' + s] = V(KR.PUPIL_LOOK.x + .045 * glance, 0, KR.PUPIL_LOOK.z + .008 * glance)
        P['eye_' + s] = V(1, 1, blink)
    P['brow_L'] = (.012 * glance, -8 * glance); P['brow_R'] = (0.0, 3 * glance)
    P['jaw'] = 1 + .12 * b
    P['tail'] = tail_curve(sway=10 * h, lift=3 * math.sin(2 * w), wave=0)
    P['hat_q'] = E(0, -4 * math.sin(2 * w), 0)
    P['bell'] = 12 * math.sin(2 * w)
    return P

def move(t):
    P = rest_params(); u = t / .8; w = math.tau * u
    for n in KR.LEGS:
        if n[0] == 'H':
            ph = (u + (0 if n == 'HR' else .5)) % 1.0; sg = 1 if n == 'HR' else -1
            if ph < .5:   # stroke: on the floor, sliding out and back
                k = smooth(ph / .5); off = V(sg * .045 * k, .065 - .15 * k, 0); toe = sg * 20 * k; lift = 0.0
            else:         # recovery: lifted and brought forward
                k = smooth((ph - .5) / .5); off = V(sg * .045 * (1 - k), -.085 + .15 * k, 0); toe = sg * 20 * (1 - k); lift = .045 * math.sin(math.pi * k)
            off.z = lift; P['skate'][n] = (off, E(-6 * lift / .045, 0, -toe))
        else:
            sg = 1 if n == 'FR' else -1; off = V(0, .025 * math.sin(w + (0 if n == 'FR' else math.pi)), 0)
            P['skate'][n] = (off, Quaternion())
        P['roll'][n] = (-math.tau * 3 * u, -math.tau * 3 * u)
    P['body_off'] = V(.018 * math.sin(w), .01, -.018 - .008 * math.cos(2 * w)); P['body_q'] = E(-7, -5 * math.sin(w), 4 * math.sin(w))
    P['spine_q'] = E(0, 0, -3 * math.sin(w)); P['head_q'] = E(4 - 2 * math.cos(2 * w), 3 * math.sin(w), -6 * math.sin(w))
    for s in 'RL':
        P['ear_' + s] = E(-22, 0, 0); P['eye_' + s] = V(1, 1, .86); P['look_' + s] = V(-.005, 0, .0); P['brow_' + s] = (-.006, 9.0)
    P['jaw'] = 1.25; P['hat_q'] = E(-10, 0, 3 * math.sin(w)); P['bell'] = 18 * math.sin(2 * w)
    P['tail'] = tail_curve(sway=6 * math.sin(w), lift=-32, curl=-18, wave=7, phase=w)
    return P

FRONT_LIFT = {'FR': (V(0, .095, .2), E(35)), 'FL': (V(0, .085, .165), E(25))}
def attack(t):
    P = rest_params()
    tell = C.bell(t, .25, .26) if t < .45 else 0.0
    rear = keyed(t, [(0, 0.0), (.45, 0.0), (.95, 1.0), (1.08, .6), (1.25, 0.0), (2, 0.0)])
    dash = keyed(t, [(0, 0.0), (.95, -.04), (1.25, .24), (1.45, .22), (2, 0.0)])
    crouch = keyed(t, [(0, 0.0), (.2, 1.0), (.45, 1.0), (.95, .3), (1.25, 1.0), (1.45, .5), (2, 0.0)])
    wiggle = .022 * math.sin(math.tau * 7 * t) * C.bell(t, .26, .22)
    P['body_off'] = V(wiggle, dash, -.034 * crouch + .06 * rear); P['body_q'] = E(24 * rear - 9 * keyed(t, [(0, 0.0), (1.05, 0.0), (1.25, 1.0), (1.6, 0.0)]), 0, 0)
    P['spine_q'] = E(6 * rear, 0, 8 * math.sin(math.tau * 3.5 * t) * tell)
    P['head_q'] = E(-14 * rear + 10 * tell + 12 * keyed(t, [(0, 0.0), (1.1, 0.0), (1.25, 1.0), (1.5, 0.0)]), 0, 0)
    for n in KR.LEGS:
        hind = n[0] == 'H'
        roll = dash - (0 if hind else 0.0)
        off = V(0, dash + (.0 if hind else .1 * keyed(t, [(0, 0.0), (1.0, 0.0), (1.25, 1.0), (1.45, 1.0), (2, 0.0)])), 0)
        q = Quaternion()
        if not hind:
            lo, lq = FRONT_LIFT[n]; r = keyed(t, [(0, 0.0), (.5, 0.0), (.92, 1.0), (1.12, .8), (1.25, 0.0), (2, 0.0)], ease_out)
            off = off + lo * r; q = Quaternion().slerp(lq, r)
        P['skate'][n] = (off, q); P['roll'][n] = (roll_for(dash + (0 if hind else .1 * keyed(t, [(0, 0.0), (1.0, 0.0), (1.25, 1.0), (1.45, 1.0), (2, 0.0)]))),) * 2
    stomp = keyed(t, [(0, 0.0), (1.22, 0.0), (1.27, 1.0), (1.5, 0.0), (2, 0.0)])
    for s in 'RL':
        P['ear_' + s] = E(-38 * max(tell, rear) + 10 * stomp, 0, (1 if s == 'R' else -1) * 20 * max(tell, rear))
        P['eye_' + s] = V(1 + .1 * stomp, 1, 1 - .32 * tell - .15 * rear + .2 * stomp); P['look_' + s] = V(-.002, 0, -.008 * tell)
        P['brow_' + s] = (-.014 * max(tell, rear) + .01 * stomp, 16 * max(tell, rear))
    P['jaw'] = 1 + .8 * tell + .4 * rear + 1.1 * stomp
    P['tail'] = tail_curve(sway=26 * math.sin(math.tau * 4 * t) * max(tell, .3 * rear), lift=-10 * tell + 20 * rear, curl=10 * rear, wave=0)
    P['hat_off'] = V(0, 0, .05 * stomp); P['hat_q'] = E(-12 * tell + 10 * rear, 0, 0); P['bell'] = 30 * math.sin(math.tau * 5 * t) * (tell + stomp) * .5
    return P

def hit(t):
    P = rest_params()
    k = keyed(t, [(0, 0.0), (.07, 1.0), (.3, .35), (.6, 0.0)])
    back = keyed(t, [(0, 0.0), (.1, -.07), (.35, -.04), (.6, 0.0)])
    for n in KR.LEGS: P['skate'][n] = (V(0, back, 0), Quaternion()); P['roll'][n] = (roll_for(back),) * 2
    P['body_off'] = V(0, back - .012 * k, -.012 * k); P['body_q'] = E(5 * k, 0, 0); P['head_q'] = E(18 * k, 0, 0)
    shut = keyed(t, [(0, 0.0), (.04, 1.0), (.3, 1.0), (.4, 0.0)])
    for s in 'RL':
        P['eye_' + s] = V(1.05, 1, 1 - .88 * shut); P['ear_' + s] = E(-45 * k, 0, (1 if s == 'R' else -1) * 25 * k); P['brow_' + s] = (.02 * k, -10 * k)
    P['jaw'] = 1 + 1.2 * k
    P['hat_off'] = V(0, 0, keyed(t, [(0, 0.0), (.12, .12), (.26, 0.0), (.32, .02), (.38, 0.0)])); P['hat_q'] = E(0, keyed(t, [(0, 0.0), (.12, -25.0), (.3, 0.0)]), 0)
    P['tail'] = tail_curve(lift=28 * k, wave=0); P['bell'] = 25 * math.sin(math.tau * 6 * t) * (1 - t / .6)
    return P

# ---- defeat
FLOP_PIVOT_X = .37
def defeat_outer(t):
    spin = 360 * smooth((t - .35) / .6) if t < .95 else 0.0
    flop = keyed(t, [(1.0, 0.0), (1.4, 1.0)], ease_in) if t > 1.0 else 0.0
    bounce = .03 * math.sin(math.pi * min(1, max(0, (t - 1.4) / .15))) if t > 1.4 else 0.0
    Dspin = C.rot_about(V(0, -.02, 0), Quaternion((0, 0, 1), math.radians(spin)))
    Dflop = T(V(-.35 * flop, 0, bounce - .036 * flop)) @ C.rot_about(V(FLOP_PIVOT_X, 0, 0), Quaternion((0, 1, 0), math.radians(90 * flop)))
    return Dflop @ Dspin
HAT_FLY = (.06, .95)
def hat_path(t):
    t0, t1 = HAT_FLY; P0 = defeat(t0, want_hat=False); D0 = pose(P0)['hat']
    end = T(V(-.62, .42, .0045)) @ E(0, 0, 40).to_matrix().to_4x4() @ Euler(KR.HAT_TILT).to_matrix().to_4x4().inverted() @ T(-KR.HAT_BASE)
    s = max(0, min(1, (t - t0) / (t1 - t0)))
    if s >= 1: return end
    p0 = D0 @ KR.HAT_BASE; p1 = end @ KR.HAT_BASE; apex = max(p0.z, p1.z) + .45
    pos = p0.lerp(p1, s) + V(0, 0, 4 * (apex - (p0.z + p1.z) / 2) * s * (1 - s))
    q = D0.to_quaternion().slerp(end.to_quaternion(), smooth(s)) @ Quaternion((0, 1, 0), math.tau * 1.5 * s * (1 - s))
    return T(pos) @ q.to_matrix().to_4x4() @ T(-KR.HAT_BASE)

def defeat(t, want_hat=True):
    P = rest_params(); P['outer'] = defeat_outer(t)
    jolt = keyed(t, [(0, 0.0), (.06, 1.0), (.25, 0.0)])
    splay = keyed(t, [(0, 0.0), (.25, 0.0), (.7, 1.0)])
    stiff = keyed(t, [(1.0, 0.0), (1.4, 1.0)])
    for n, (S, K, A) in KR.LEGS.items():
        sx = 1 if n[1] == 'R' else -1; sy = 1 if n[0] == 'F' else -1
        off = V(sx * .045 * splay, sy * .07 * splay - .035 * jolt, 0)
        # once flopped, the legs stick out stiffly: skates swing out from under the body
        off = off + V(sx * .02, sy * .01, .03) * stiff
        P['skate'][n] = (off, E(0, sx * 25 * stiff, 0)); P['roll'][n] = (roll_for(sy * .07 * splay - .035 * jolt) - math.tau * 2.5 * smooth((t - .3) / 1.2),) * 2
    P['body_off'] = V(0, -.045 * jolt, -.07 * splay - .005 * jolt); P['body_q'] = E(5 * jolt, 0, 0)
    P['head_q'] = E(14 * jolt - 8 * splay, -10 * stiff, 0); P['neck_q'] = E(0, 0, 0)
    dizzy = keyed(t, [(0, 0.0), (.5, 0.0), (.8, 1.0)]); cross = keyed(t, [(0, 0.0), (1.6, 0.0), (1.9, 1.0)])
    for i, s in enumerate('RL'):
        ang = math.tau * 2.4 * t + i * math.pi
        circ = V(.035 * math.cos(ang), 0, .04 * math.sin(ang)) * dizzy * (1 - cross)
        inward = V(-.04 if s == 'R' else .04, 0, .01)
        P['look_' + s] = V(KR.PUPIL_LOOK.x, 0, KR.PUPIL_LOOK.z).lerp(inward, cross) + circ
        P['eye_' + s] = V(1.05, 1, 1 - .85 * keyed(t, [(0, 0.0), (.04, 1.0), (.25, 1.0), (.35, 0.0)]) - .3 * dizzy)
        P['ear_' + s] = E(-30 * jolt - 20 * dizzy, 0, (1 if s == 'R' else -1) * (25 * jolt + 30 * dizzy))
        P['brow_' + s] = (.02 * jolt - .008 * dizzy, -10 * jolt - 14 * dizzy)
    P['jaw'] = 1 + 1.1 * jolt + 1.3 * keyed(t, [(0, 0.0), (1.2, 0.0), (1.6, 1.0)])
    P['tail'] = tail_curve(sway=20 * math.sin(math.tau * 2 * t) * (1 - stiff), lift=25 * jolt - 30 * stiff, curl=-30 * stiff, wave=0)
    P['bell'] = 25 * math.sin(math.tau * 5 * t) * (1 - smooth((t - .4) / 1.2))
    if want_hat and t >= HAT_FLY[0]: P['hat_world'] = hat_path(t)
    return P

FN = {'idle': idle, 'move': move, 'attack': attack, 'hit': hit, 'defeat': defeat}
def evaluate(name, t):
    if name == 'defeat': t = min(t, HOLD_S)
    return pose(FN[name](t))

if __name__ == '__main__':
    C.guard(ASSET)
    sc = bpy.context.scene; sc.frame_start = 0; sc.frame_end = 150
    ident = lambda D: max(max(abs(m[i][j] - (1 if i == j else 0)) for i in range(4) for j in range(4)) for m in RIG.complete(D).values())
    rest_err = ident(pose(rest_params())); idle0 = ident(evaluate('idle', 0))
    assert rest_err < 1e-5 and idle0 < 1e-5, ('bind/idle-0 pose is not the concept pose', rest_err, idle0)
    report = {'attack': {'contact_time_s': CONTACT_S, 'contact_fraction': CONTACT_S / 2.0, 'tell_s': [0.0, .45], 'windup_s': [.45, 1.0], 'strike_s': [1.0, CONTACT_S]},
              'defeat': {'held_final_pose_from_s': HOLD_S, 'hat_flight_s': list(HAT_FLY), 'spin_s': [.35, .95], 'flop_s': [1.0, 1.4]}}
    reach = {}
    for name, dur, loop in CLIPS:
        REACH[0] = -1.0
        for f in range(round(dur * FPS) + 1): evaluate(name, f / FPS)
        reach[name] = REACH[0]
    print('max IK overreach per clip (m, <= 0 means the skate stays attached):', json.dumps(reach))
    records, shear = C.bake(RIG, CLIPS, evaluate, FPS, SCALED, report)
    arm['attack_contact_seconds'] = CONTACT_S; arm['attack_contact_fraction'] = CONTACT_S / 2.0
    bp = ROOT / 'bounds.json'
    if bp.exists():
        br = json.loads(bp.read_text()); skin['model_space_bounds_y_up'] = br['safe_culling_envelope']; skin['bounds_method'] = br['method']
    for name in ('common.py', 'kitten_rig.py', 'kitten_build.py', 'kitten_anim.py'):
        old = bpy.data.texts.get('source ' + name)
        if old: bpy.data.texts.remove(old)
        bpy.data.texts.new('source ' + name).write((SRC / name).read_text())
    rec = json.loads((ROOT / 'construction.json').read_text()); rec['clips'] = records; rec['max_bone_shear'] = shear; rec['rest_reproduction_error'] = rest_err; rec['idle0_reproduction_error'] = idle0
    rec['fps'] = FPS; rec['scaled_bones'] = sorted(SCALED); rec['ik_max_overreach_m'] = reach
    bpy.ops.object.select_all(action='DESELECT'); skin.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / (ASSET + '.blend')), copy=True, compress=True)
    status = "action-minions-a mischief-kitten-skater v001 · Awaiting Tom's review · candidate for the action worlds"
    C.export_glb(ROOT / (ASSET + '.glb'), skin, arm, {'asset_id': ASSET, 'asset_version': 'v001', 'pack': 'action-minions-a', 'candidate_status': status,
                 'source_reference': 'docs/assets/media/action-minions-a/v001/concept.png (coordinator image-generated construction reference, row 2)',
                 'source_concept_sha256': C.sha(C.PACK / 'concept.png'),
                 'orientation': 'glTF +Y up, forward -Z, floor-centred stationary root, character right +X',
                 'role': 'ordinary enemy (DESIGN-029 Harbor cast)', 'authoring_model': 'claude-opus-5-5 xhigh (Claude Code, Max plan)', 'design': 'DESIGN-029'})
    rec['files'] = {n: {'bytes': (ROOT / n).stat().st_size, 'sha256': C.sha(ROOT / n)} for n in (ASSET + '.blend', ASSET + '.glb', 'pigment.png')}
    (ROOT / 'construction.json').write_text(json.dumps(rec, indent=2) + '\n')
    print(json.dumps({'clips': [(r['name'], r['frames']) for r in records], 'shear': shear, 'files': rec['files']}))
