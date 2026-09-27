"""WO111 lab-robot v001: rest skeleton, sheet-pose targets and chain helpers.

Imported by build.py (to place rest geometry and bones) and animate.py (to rebuild the approved sheet
pose at idle 0 s). Pure mathutils; Blender +Z up / +Y forward, character right = +X.

Bind pose (per the sheet notes): both slinky arms hang straight in the same relaxed A-shape with the
claws half open, the eyelid level and the iris centred. The raised right claw, the reaching left claw,
the 11 deg eyelid tilt and the sideways glance are design poses recreated at idle 0 s. The power cord
binds on its sheet path (trailing from the back grommet, along the floor and curling up beside the
right tread), so idle 0 s and the bind pose share it.

The blockout helpers (catmull, rmf, coil_samples) are ported exactly from source/build_blockout.py so the
sheet claw frames and arm centrelines are the blockout's own.
"""
import math
from mathutils import Vector, Matrix

def V(*a): return Vector(a)

# ---------------- blockout dimensions (build_blockout.py) ----------------
TREAD_X = 0.178; TREAD_W = 0.13; TREAD_R = 0.095; TREAD_T = 0.024; LUG_H = 0.010
TREAD_Y0 = -0.15; TREAD_Y1 = 0.15; TREAD_ZC = TREAD_R + LUG_H
BODY_Z0 = 0.29; BODY_Z1 = 0.79; BODY_W = 0.50; BODY_D = 0.38; BODY_TAPER = (0.95, 1.03)
FRONT_Y = BODY_D / 2
HEAD_R = 0.205; BAND_Z0 = 0.835; BAND_Z1 = 0.975
EYE_C = V(0.0, 0.0, 1.02); EYE_TILT = math.radians(-11)
BEACON_Z = BAND_Z1 + HEAD_R - 0.012
SHOULDER_Z = 0.705
BZ = 0.515                       # self-destruct button centre height
PF = FRONT_Y + 0.004 + 0.008     # panel front face (blockout pf)

def body_half_x(z):
    t = min(1.0, max(0.0, (z - BODY_Z0) / (BODY_Z1 - BODY_Z0)))
    return BODY_W / 2 * (BODY_TAPER[0] + (BODY_TAPER[1] - BODY_TAPER[0]) * t)

def catmull(pts, per=10):
    P = [Vector(p) for p in pts]; P = [P[0] + (P[0] - P[1])] + P + [P[-1] + (P[-1] - P[-2])]; out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for s in range(per):
            t = s / per
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-2]); return out

def rmf(path, up=(0, 0, 1)):
    m = len(path); T = (path[1] - path[0]).normalized(); U = Vector(up); N = U - U.dot(T) * T
    if N.length < 1e-3: N = T.cross(Vector((1, 0, 0)))
    N.normalize(); out = []
    for i in range(m):
        if i > 0:
            T = (path[min(i + 1, m - 1)] - path[i - 1]).normalized(); N = (N - N.dot(T) * T).normalized()
        out.append((T, N, T.cross(N)))
    return out

def coil_samples(pts, pitch=0.021, per_turn=22):
    """The blockout coil's centreline resampling (its last sample is the claw wrist) and frames."""
    path = catmull(pts, 40); lens = [0.0]
    for i in range(1, len(path)): lens.append(lens[-1] + (path[i] - path[i - 1]).length)
    total = lens[-1]; ds = pitch / per_turn; samples = []; s = 0.0; j = 0
    while s <= total:
        while j < len(path) - 2 and lens[j + 1] < s: j += 1
        f = (s - lens[j]) / max(1e-9, lens[j + 1] - lens[j]); samples.append(path[j].lerp(path[j + 1], f)); s += ds
    return samples, rmf(samples)

def arclength(pts):
    s = [0.0]
    for a, b in zip(pts, pts[1:]): s.append(s[-1] + (b - a).length)
    return s

def resample(path, fractions):
    """Points at the given arc-length fractions of a polyline."""
    acc = arclength(path); total = acc[-1]; out = []; j = 0
    for f in fractions:
        s = f * total
        while j < len(path) - 2 and acc[j + 1] < s: j += 1
        k = min(j, len(path) - 2); u = (s - acc[k]) / max(1e-12, acc[k + 1] - acc[k])
        out.append(path[k].lerp(path[k + 1], max(0.0, min(1.0, u))))
    return out

# ---------------- slinky arms ----------------
N_ARM = 5                                   # arm segment bones per side
R_PTS = [(0.27, 0.0, SHOULDER_Z), (0.34, 0.005, 0.745), (0.40, 0.0, 0.83), (0.42, -0.01, 0.92), (0.41, -0.015, 0.985)]
L_PTS = [(-0.27, 0.0, SHOULDER_Z - 0.005), (-0.34, 0.04, 0.64), (-0.38, 0.11, 0.56), (-0.37, 0.19, 0.50), (-0.35, 0.26, 0.47)]
SHEET_SPREAD = {'R': 0.055, 'L': 0.05}      # blockout jaw spread (the half-open rest claw)
JAW_LEN = 0.13
ARM_R_COIL = 0.038; ARM_R_WIRE = 0.0095
SHOULDER = {'R': V(*R_PTS[0]), 'L': V(*L_PTS[0])}
SOCKET = {'R': V(0.262, 0.0, SHOULDER_Z), 'L': V(-0.262, 0.0, SHOULDER_Z)}
SHEET_ARM = {}                               # side -> (joint points J0..J5, wrist W, T, S)
for s, pts, S_hint in (('R', R_PTS, V(1, 0, 0)), ('L', L_PTS, V(-0.6, 0, 1))):
    samples, frames = coil_samples(pts)
    W = samples[-1]; T = frames[-1][0].normalized(); S = (S_hint - S_hint.dot(T) * T).normalized()
    # the blockout centreline up to the wrist sample, sampled at equal arc fractions for the chain joints
    path = catmull(pts, 40)
    k = min(range(len(path)), key=lambda i: (path[i] - W).length)
    trimmed = path[:k] + [W]
    J = resample(trimmed, [i / N_ARM for i in range(N_ARM + 1)])
    SHEET_ARM[s] = (J, W.copy(), T, S, arclength(trimmed)[-1])

REST_ARM_LEN = 0.36                          # straight rest tube, shoulder to wrist (sheet: right 0.345, left 0.395)
REST_DIR = {'R': V(0.55, 0.0, -0.835).normalized(), 'L': V(-0.55, 0.0, -0.835).normalized()}
REST_S = {'R': V(0, 1, 0), 'L': V(0, 1, 0)}  # rest claws open front-back
def rest_arm(s):
    J0 = SHOULDER[s]; d = REST_DIR[s]
    J = [J0 + d * (REST_ARM_LEN * i / N_ARM) for i in range(N_ARM + 1)]
    S = (REST_S[s] - REST_S[s].dot(d) * d).normalized()
    return J, J[-1].copy(), d.copy(), S

def claw_frame(W, T, S):
    """World matrix at the wrist: local +Y along the claw (T), local +Z the jaw-opening axis (S), X = Y x Z."""
    T = Vector(T).normalized(); S = Vector(S); S = (S - S.dot(T) * T).normalized(); X = T.cross(S)
    M = Matrix((X, T, S)).transposed().to_4x4(); M.translation = Vector(W); return M

REST_ARM = {s: rest_arm(s) for s in 'RL'}
# rigid map from sheet-authored claw geometry into the rest pose (the blockout claw is authored at its sheet frame)
CLAW_MAP = {s: claw_frame(*REST_ARM[s][1:4]) @ claw_frame(*SHEET_ARM[s][1:4]).inverted() for s in 'RL'}

def jaw_points(W, T, S, k, spread):
    """The blockout claw() jaw control points (base, mid, tip) for jaw k (+1 upper / -1 lower)."""
    T = Vector(T).normalized(); S = Vector(S); S = (S - S.dot(T) * T).normalized(); W = Vector(W)
    base = W + T * 0.075 + S * k * 0.02
    mid = W + T * (0.075 + JAW_LEN * 0.5) + S * k * spread
    tip = W + T * (0.075 + JAW_LEN) + S * k * spread * 0.35
    return base, mid, tip

# ---------------- power cord (bound on its sheet path) ----------------
CORD_PTS = [(0.0, -FRONT_Y - 0.02, 0.38), (0.035, -0.255, 0.345), (0.1, -0.295, 0.255), (0.16, -0.325, 0.13), (0.22, -0.365, 0.035),
            (0.275, -0.435, 0.018), (0.3, -0.515, 0.03), (0.305, -0.58, 0.1), (0.305, -0.6, 0.185), (0.305, -0.585, 0.245)]
CORD_PATH = catmull(CORD_PTS, 5)
CORD_FR = [0.0, 0.2, 0.42, 0.62, 0.82, 1.0]  # chain joint arc fractions: grommet, drop, floor, floor/curl base, curl, plug
CORD_J = resample(CORD_PATH, CORD_FR)
CORD_R = 0.0165
PLUG_T = (CORD_PATH[-1] - CORD_PATH[-4]).normalized()

# ---------------- head, eye and neck ----------------
LENS_Y = 0.236; GLASS_DEPTH = 0.03; GLASS_R = 0.086
def glass_y(r):
    """Front surface of the lens glass ellipsoid (0.086, 0.03, 0.086) centred at y = LENS_Y, at radius r."""
    return LENS_Y + GLASS_DEPTH * math.sqrt(max(0.0, 1 - (r / GLASS_R) ** 2))
PUPIL_PIVOT = V(0.0, LENS_Y + GLASS_DEPTH - GLASS_R ** 2 / GLASS_DEPTH, EYE_C.z)   # the glass apex's centre of curvature
SHEET_GLANCE = V(0.005, 0.0, -0.009)         # sheet pupil/iris offset: a little low and toward its right
LID_R = 0.104; LID_Y = 0.2575; LID_THICK = 0.046
LID_TOP = V(0.0, LID_Y, EYE_C.z + LID_R)
IRIS_MIN_SCALE = 0.55                        # the iris shell is shaped so it never sinks into the glass down to this scale

def rest_bones():
    """name -> (head, tail, parent, roll_z_axis or None, deform) in the world rest pose."""
    R = {'root': ((0, 0, 0), (0, 0, 0.1), None, None, False),
         'chassis': ((0, 0, 0.10), (0, 0, 0.20), 'root', V(0, 1, 0), True),
         'waist': ((0, 0, 0.20), (0, 0, 0.30), 'chassis', V(0, 1, 0), True),
         'body': ((0, 0, 0.30), (0, 0, 0.79), 'waist', V(0, 1, 0), True),
         'button': ((0, PF, BZ), (0, PF + 0.05, BZ), 'body', V(0, 0, 1), True),
         'sparks': ((0, 0.10, 0.55), (0, 0.18, 0.55), 'body', V(0, 0, 1), True),
         'neck': ((0, 0, 0.79), (0, 0, 0.84), 'body', V(0, 1, 0), False),
         'head': ((0, 0, 0.84), (0, 0, 1.18), 'neck', V(0, 1, 0), True),
         'dome': ((0, -HEAD_R, BAND_Z1), (0, -HEAD_R, BAND_Z1 + 0.1), 'head', V(0, 1, 0), True),
         'beacon': ((0, 0, BEACON_Z + 0.034), (0, 0, BEACON_Z + 0.12), 'dome', V(0, 1, 0), True),
         'smoke_a': ((0, 0, 0.93), (0, 0, 1.0), 'head', V(0, 1, 0), True),
         'smoke_b': ((0, 0, 0.93), (0, 0, 1.0), 'head', V(0, 1, 0), True),
         'eyelid_tilt': ((0, LID_Y, EYE_C.z), (0, LID_Y + 0.05, EYE_C.z), 'head', V(0, 0, 1), False),
         'eyelid': (tuple(LID_TOP), tuple(LID_TOP + V(0, 0.05, 0)), 'eyelid_tilt', V(0, 0, 1), True),
         'pupil': (tuple(PUPIL_PIVOT), (0, PUPIL_PIVOT.y + 0.06, EYE_C.z), 'head', V(0, 0, 1), True),
         'glare': (tuple(PUPIL_PIVOT), (0, PUPIL_PIVOT.y + 0.05, EYE_C.z), 'pupil', V(0, 0, 1), True)}
    for s in 'RL':
        J, W, T, S = REST_ARM[s]
        parent = 'body'
        for i in range(N_ARM):
            R['arm_%s_%d' % (s, i + 1)] = (tuple(J[i]), tuple(J[i + 1]), parent, V(0, 1, 0), True); parent = 'arm_%s_%d' % (s, i + 1)
        R['claw_' + s] = (tuple(W), tuple(W + T * 0.075), parent, S, True)
        for k, tag in ((1, 'a'), (-1, 'b')):
            base, mid, tip = jaw_points(W, T, S, k, SHEET_SPREAD[s])
            R['jaw_%s_%s' % (s, tag)] = (tuple(base), tuple(tip), 'claw_' + s, S, True)
    parent = 'body'
    for i in range(5):
        R['cord_%d' % (i + 1)] = (tuple(CORD_J[i]), tuple(CORD_J[i + 1]), parent, V(0, 0, 1), True); parent = 'cord_%d' % (i + 1)
    R['plug'] = (tuple(CORD_J[5]), tuple(CORD_J[5] + PLUG_T * 0.1), 'cord_5', V(0, 0, 1), True)
    wheels = ((TREAD_Y1, 0.066, 'front'), (TREAD_Y0, 0.066, 'back'), (0.05, 0.044, 'midfront'), (-0.05, 0.044, 'midback'))
    for s, sx in (('R', 1), ('L', -1)):
        for i, (yw, rw, tag) in enumerate(wheels):
            zw = wheel_z(rw)
            R['wheel_%s_%d' % (s, i)] = ((TREAD_X * sx, yw, zw), (TREAD_X * sx + 0.08 * sx, yw, zw), 'chassis', V(0, 0, 1), True)
    return R

WHEELS = ((TREAD_Y1, 0.066, 'front'), (TREAD_Y0, 0.066, 'back'), (0.05, 0.044, 'mid front'), (-0.05, 0.044, 'mid back'))
def wheel_z(rw): return TREAD_ZC if rw > 0.05 else LUG_H + TREAD_T + rw + 0.004

# ---------------- chain posing helpers ----------------
def bezier(P0, P1, P2, P3, n=48):
    out = []
    for i in range(n + 1):
        t = i / n; a = 1 - t
        out.append(P0 * a ** 3 + P1 * 3 * a * a * t + P2 * 3 * a * t * t + P3 * t ** 3)
    return out

def arm_curve(S0, t0, W, T, h0=0.12, h1=0.10, n=48):
    """Joint points along a cubic from the shoulder (leaving along t0) to the wrist (arriving along T)."""
    path = bezier(Vector(S0), Vector(S0) + Vector(t0).normalized() * h0, Vector(W) - Vector(T).normalized() * h1, Vector(W), n)
    return resample(path, [i / N_ARM for i in range(N_ARM + 1)]), arclength(path)[-1]
