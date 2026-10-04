"""gadget-hammer-hopper v001: measurements, rest skeleton and the hose/spring curve helpers.

Imported by hopper_build.py (geometry + bones) and hopper_anim.py (posing). Pure mathutils.
Blender +Z up / +Y forward (the face), character right = +X (the mallet arm).
The bind pose IS the concept pose (mallet raised in the right fist, left fist hanging, boot planted),
so idle at 0 s reproduces it exactly.
"""
import math
from mathutils import Vector, Matrix, Quaternion

def V(*a): return Vector(a)

# ---------------- toolbox body and lid ----------------
BOX_W = .84; BOX_D = .54; BOX_Z0 = .50; BOX_Z1 = 1.06
BOX_C = V(0, 0, (BOX_Z0 + BOX_Z1) / 2)
FRONT_Y = BOX_D / 2
LID_W = .89; LID_D = .59; LID_Z0 = 1.03; LID_Z1 = 1.21
HINGE = V(0, -LID_D / 2, LID_Z0)
HANDLE_Z = 1.34
# ---------------- face (on the +Y front) ----------------
EYE_R = (V(.176, FRONT_Y - .012, .815), V(.116, .05, .132))   # character right (+X) eye: centre, radii
EYE_L = (V(-.179, FRONT_Y - .012, .826), V(.126, .053, .142))
PUPIL_LOOK = V(-.047, 0, .004)    # concept side-eye toward the character's left
MOUTH_TOP = V(.01, FRONT_Y, .672)
# ---------------- arms ----------------
SOCKET_X = BOX_W / 2 + .035
SHOULDER_Z = .82
SHOULDER_R = V(SOCKET_X, 0, SHOULDER_Z); SHOULDER_L = V(-SOCKET_X, 0, SHOULDER_Z)
HAND_R = V(.64, .05, 1.10)                     # right fist centre gripping the mallet handle
GRIP_U = V(.29, 0, .957).normalized()           # handle axis (fist -> mallet head)
HEAD_OFF = .27                                   # fist centre -> mallet head centre along the handle
HAND_L = V(-.635, .10, .43)
N_HOSE = 4                                        # joints per hose: shoulder, 2 inner, wrist(hand)
FIST_S = 1.28                                     # chunky mitten fists (concept)
WRIST_R = .085 * FIST_S; WRIST_L = .08 * FIST_S
# ---------------- spring and boot ----------------
SPRING_TOP = V(0, 0, BOX_Z0 - .01); SPRING_BOT = V(0, -.01, .29)
N_SPRING = 5
ANKLE = V(0, -.01, .17)

def hand_frame_R(u=GRIP_U, fwd=V(0, 1, 0)):
    """Right fist frame: Y = handle axis, Z = knuckles (forward), X = side."""
    y = Vector(u).normalized(); x = y.cross(Vector(fwd)).normalized(); z = x.cross(y).normalized()
    return Matrix((x, y, z)).transposed()

def hand_frame_L(down=V(.12, .05, -1), fwd=V(0, 1, 0)):
    """Left fist frame: Y = forearm direction into the fist (down), Z = knuckles (forward-out)."""
    y = Vector(down).normalized(); x = y.cross(Vector(fwd)).normalized(); z = x.cross(y).normalized()
    return Matrix((x, y, z)).transposed()

def wrist_R(hand=HAND_R, frame=None):
    frame = frame or hand_frame_R(); return hand - frame.col[1] * WRIST_R   # hose enters the fist bottom along the handle

def wrist_L(hand=HAND_L, frame=None):
    frame = frame or hand_frame_L(); return hand - frame.col[1] * WRIST_L

def bez(p0, p1, p2, p3, n):
    out = []
    for i in range(n + 1):
        t = i / n; a = 1 - t; out.append(a ** 3 * p0 + 3 * a * a * t * p1 + 3 * a * t * t * p2 + t ** 3 * p3)
    return out

def hose_curve(shoulder, out_dir, wrist, in_dir, n=96, reach=None):
    """Hose centreline: leaves the socket along out_dir and enters the fist along in_dir (pointing into the fist)."""
    d = (wrist - shoulder).length; k = reach if reach is not None else max(.14, .5 * d)
    return bez(shoulder, shoulder + out_dir.normalized() * k, wrist - in_dir.normalized() * k, wrist, n)

def spring_curve(top, top_down, bot, bot_up, n=64):
    d = (top - bot).length; k = .35 * d
    return bez(bot, bot + bot_up.normalized() * k, top + top_down.normalized() * k, top, n)

def arclen(p):
    s = [0.0]
    for a, b in zip(p, p[1:]): s.append(s[-1] + (b - a).length)
    return s

def at_fraction(path, f):
    acc = arclen(path); s = f * acc[-1]
    for k in range(len(path) - 1):
        if acc[k + 1] >= s or k == len(path) - 2:
            u = (s - acc[k]) / max(1e-12, acc[k + 1] - acc[k]); u = max(0, min(1, u))
            return path[k].lerp(path[k + 1], u), (path[k + 1] - path[k]).normalized()

def joints_on(path, n):
    return [at_fraction(path, i / (n - 1)) for i in range(n)]

REST_HOSE_R = hose_curve(SHOULDER_R, V(1, 0, .05), wrist_R(), GRIP_U)
REST_HOSE_L = hose_curve(SHOULDER_L, V(-1, 0, .05), wrist_L(), hand_frame_L().col[1])
REST_SPRING = spring_curve(SPRING_TOP, V(0, 0, -1), SPRING_BOT, V(0, 0, 1))

def rest_bones():
    """name -> (head, tail, parent, roll_z_vector, deform)."""
    R = {}
    R['root'] = (V(0, 0, 0), V(0, 0, .12), None, V(0, 1, 0), False)
    R['boot'] = (ANKLE, ANKLE + V(0, .14, 0), 'root', V(0, 0, 1), True)
    for i, (p, t) in enumerate(joints_on(REST_SPRING, N_SPRING)):
        R['spring_%d' % i] = (p, p + t * .05, 'root', V(0, 1, 0), True)
    R['body'] = (BOX_C, BOX_C + V(0, 0, .18), 'root', V(0, 1, 0), True)
    R['lid'] = (HINGE, HINGE + V(.15, 0, 0), 'body', V(0, 0, 1), True)
    R['handle'] = (V(0, 0, LID_Z1), V(0, 0, LID_Z1 + .1), 'lid', V(0, 1, 0), True)
    for s, (c, r) in (('R', EYE_R), ('L', EYE_L)):
        R['eye_' + s] = (c, c + V(0, .08, 0), 'body', V(0, 0, 1), True)
        pc = c + V(0, r[1] * .78, 0) + PUPIL_LOOK
        R['pupil_' + s] = (pc, pc + V(0, .05, 0), 'eye_' + s, V(0, 0, 1), True)
    R['brow_R'] = (V(.176, FRONT_Y + .012, .968), V(.30, FRONT_Y + .012, .99), 'body', V(0, 1, 0), True)
    R['brow_L'] = (V(-.18, FRONT_Y + .012, .984), V(-.30, FRONT_Y + .012, .996), 'body', V(0, 1, 0), True)
    R['mouth'] = (MOUTH_TOP, MOUTH_TOP + V(0, 0, -.12), 'body', V(0, 1, 0), True)
    for s, path, parent_hand in (('R', REST_HOSE_R, 'hand_R'), ('L', REST_HOSE_L, 'hand_L')):
        js = joints_on(path, N_HOSE); prev = 'body'
        for i, (p, t) in enumerate(js[:-1]):
            R['arm_%s_%d' % (s, i)] = (p, p + t * .05, prev, V(0, 1, 0) if s == 'R' else V(0, 1, 0), True); prev = 'arm_%s_%d' % (s, i)
    fr = hand_frame_R(); R['hand_R'] = (HAND_R, HAND_R + fr.col[1] * .08, 'arm_R_2', fr.col[2], True)
    fl = hand_frame_L(); R['hand_L'] = (HAND_L, HAND_L + fl.col[1] * .08, 'arm_L_2', fl.col[2], True)
    R['mallet'] = (HAND_R, HAND_R + GRIP_U * HEAD_OFF, 'hand_R', fr.col[2], True)
    R['wrench'] = (V(.10, -.02, .65), V(.10, -.02, .83), 'body', V(0, 1, 0), True)
    return R

def hose_joint_names(s): return ['arm_%s_%d' % (s, i) for i in range(N_HOSE - 1)] + ['hand_' + s]
def spring_names(): return ['spring_%d' % i for i in range(N_SPRING)]
