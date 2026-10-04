"""mischief-kitten-skater v001: measurements, rest skeleton, surface helpers and two-bone leg IK.

Imported by kitten_build.py and kitten_anim.py. Pure mathutils. Blender +Z up / +Y forward (the face),
character right = +X. The bind pose is the concept stance: four roller skates on the floor, body level,
head up, tail arched up behind, mini stovepipe tilted toward the character's left ear.
"""
import math
from mathutils import Vector, Matrix, Quaternion

def V(*a): return Vector(a)

# ---------------- body (chibi: a big head on a small low body and big skates) ----------------
TORSO_C = V(0, -.03, .405); TORSO_R = V(.152, .25, .12)
HIPS = V(0, -.16, .41); CHEST = V(0, .10, .42)
NECK = V(0, .15, .52)
HEAD_C = V(0, .2, .80); HEAD_R = V(.285, .24, .265)
# ---------------- legs: shoulder/hip, knee, ankle (inside the skate cuff) ----------------
LEGS = {
    'FR': (V(.095, .14, .385), V(.1, .185, .31), V(.1, .15, .235)),
    'FL': (V(-.095, .14, .385), V(-.1, .185, .31), V(-.1, .15, .235)),
    'HR': (V(.102, -.2, .39), V(.11, -.145, .315), V(.11, -.2, .235)),
    'HL': (V(-.102, -.2, .39), V(-.11, -.145, .315), V(-.11, -.2, .235)),
}
WHEEL_R = .05; WHEEL_W = .036; WHEEL_DX = .053; AXLE_DY = (.088, -.078)   # front, back axle offsets from the ankle
# ---------------- face (head-front surface) ----------------
EYE = {'R': (V(.125, .38, .83), V(.1, .052, .112)), 'L': (V(-.125, .38, .83), V(.1, .052, .112))}
EYE_TILT = {'R': math.radians(-12), 'L': math.radians(12)}   # outer corners up
PUPIL_LOOK = V(-.018, 0, -.006)     # the concept's side-glance toward the character's left
MOUTH_TOP = V(0, .466, .69)
EARS = {'R': (V(.18, .13, .985), V(.38, -.08, .92)), 'L': (V(-.18, .13, .985), V(-.38, -.08, .92))}
EAR_H = .35
HAT_BASE = V(-.05, .15, 1.045); HAT_TILT = (math.radians(-8), math.radians(-15), 0)   # back a little, top toward the left ear
BELL_RING = V(0, .272, .478)
# ---------------- tail ----------------
TAIL_PTS = [V(0, -.265, .43), V(0, -.34, .47), V(0, -.44, .58), V(0, -.5, .74), V(0, -.49, .9), V(0, -.43, 1.0), V(0, -.35, 1.03)]
N_TAIL = 6

def eye_matrix(s):
    """Tilt about the eye's forward axis, applied to every eye part (sclera, iris, pupil, lash line)."""
    c = EYE[s][0]; return Matrix.Translation(c) @ Matrix.Rotation(EYE_TILT[s], 4, 'Y') @ Matrix.Translation(-c)

def head_surface(x, z, out=0.0):
    """Point on the head ellipsoid front at (x, z) pushed out along the normal; returns (point, normal)."""
    c, r = HEAD_C, HEAD_R; u = (x - c.x) / r.x; w = (z - c.z) / r.z; s = max(0.0, 1 - u * u - w * w)
    p = V(x, c.y + r.y * math.sqrt(s), z); n = V((p.x - c.x) / r.x ** 2, (p.y - c.y) / r.y ** 2, (p.z - c.z) / r.z ** 2).normalized()
    return p + n * out, n

def eye_surface(s, lx, lz, out=0.0):
    c, r = EYE[s]; u = lx / r.x; w = lz / r.z; k = math.sqrt(max(0.0, 1 - u * u - w * w))
    p = V(c.x + lx, c.y + r.y * k, c.z + lz); n = V(lx / r.x ** 2, r.y * k / r.y ** 2, lz / r.z ** 2).normalized()
    return p + n * out, n

def catmull(pts, per):
    P = [Vector(p) for p in pts]; P = [P[0] + (P[0] - P[1])] + P + [P[-1] + (P[-1] - P[-2])]; out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(per):
            t = k / per; out.append(.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-2]); return out

def arclen(p):
    s = [0.0]
    for a, b in zip(p, p[1:]): s.append(s[-1] + (b - a).length)
    return s

def at_fraction(path, f):
    acc = arclen(path); s = f * acc[-1]
    for k in range(len(path) - 1):
        if acc[k + 1] >= s or k == len(path) - 2:
            u = max(0, min(1, (s - acc[k]) / max(1e-12, acc[k + 1] - acc[k]))); return path[k].lerp(path[k + 1], u), (path[k + 1] - path[k]).normalized()

TAIL_PATH = catmull(TAIL_PTS, 12)
TAIL_J = [at_fraction(TAIL_PATH, i / N_TAIL)[0] for i in range(N_TAIL + 1)]   # joint heads + tip

def frame_y(y, hint):
    """3x3 with Y along y and Z toward hint (Blender bone convention)."""
    y = Vector(y).normalized(); x = y.cross(Vector(hint))
    if x.length < 1e-6: x = y.cross(V(1, 0, 0))
    x.normalize(); z = x.cross(y).normalized(); return Matrix((x, y, z)).transposed()

def leg_pole(name):
    """Knee bend direction: front knees forward, hind knees forward too (short hocks hidden in the skates)."""
    return V(0, 1, 0)

def two_bone(S, A, L1, L2, pole):
    """Knee for hip S, ankle A, bone lengths and a pole direction; clamps an over-reach to a straight leg."""
    d = A - S; D = d.length; dn = d / D
    D = min(D, L1 + L2 - 1e-6); D = max(D, abs(L1 - L2) + 1e-6)
    a = (L1 * L1 - L2 * L2 + D * D) / (2 * D); h = math.sqrt(max(0.0, L1 * L1 - a * a))
    p = Vector(pole) - dn * Vector(pole).dot(dn)
    if p.length < 1e-6: p = dn.orthogonal()
    p.normalize(); return S + dn * a + p * h

def leg_lengths(name):
    S, K, A = LEGS[name]; return (K - S).length, (A - K).length

def rest_bones():
    R = {}
    R['root'] = (V(0, 0, 0), V(0, 0, .12), None, V(0, 1, 0), False)
    R['hips'] = (HIPS, HIPS + V(0, .12, 0), 'root', V(0, 0, 1), True)
    R['chest'] = (CHEST, CHEST + V(0, .1, 0), 'hips', V(0, 0, 1), True)
    R['neck'] = (NECK, NECK + V(0, .03, .1), 'chest', V(0, 1, 0), True)
    R['head'] = (HEAD_C - V(0, 0, .12), HEAD_C + V(0, 0, .06), 'neck', V(0, 1, 0), True)
    R['jaw'] = (MOUTH_TOP, MOUTH_TOP + V(0, 0, -.06), 'head', V(0, 1, 0), True)
    for s in 'RL':
        c, r = EYE[s]
        R['eye_' + s] = (c, c + V(0, .06, 0), 'head', V(0, 0, 1), True)
        pc = eye_matrix(s) @ (c + V(PUPIL_LOOK.x, r.y * .6, PUPIL_LOOK.z)); R['pupil_' + s] = (pc, pc + V(0, .04, 0), 'eye_' + s, V(0, 0, 1), True)
        bx = .13 if s == 'R' else -.13; bp, _ = head_surface(bx, .965, .01)
        R['brow_' + s] = (bp, bp + V(.08 if s == 'R' else -.08, 0, .01), 'head', V(0, 1, 0), True)
        base, ax = EARS[s]; R['ear_' + s] = (base, base + Vector(ax).normalized() * .2, 'head', V(0, 1, 0), True)
    R['hat'] = (HAT_BASE, HAT_BASE + V(0, 0, .12), 'head', V(0, 1, 0), True)
    R['bell'] = (BELL_RING, BELL_RING + V(0, 0, -.08), 'neck', V(0, 1, 0), True)
    prev = 'hips'
    for i in range(N_TAIL):
        R['tail_%d' % i] = (TAIL_J[i], TAIL_J[i + 1], prev, V(1, 0, 0), True); prev = 'tail_%d' % i
    for n, (S, K, A) in LEGS.items():
        parent = 'chest' if n[0] == 'F' else 'hips'
        R['leg_%s_up' % n] = (S, K, parent, leg_pole(n), True)
        R['leg_%s_lo' % n] = (K, A, 'leg_%s_up' % n, leg_pole(n), True)
        R['skate_' + n] = (A, A + V(0, .1, 0), 'root', V(0, 0, 1), True)
        for tag, dy in zip('fb', AXLE_DY):
            ac = V(A.x, A.y + dy, WHEEL_R)  # axle centre on the wheel radius
            R['axle_%s_%s' % (n, tag)] = (ac, ac + V(.05, 0, 0), 'skate_' + n, V(0, 0, 1), True)
    return R
