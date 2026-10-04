"""lab-robot-sentry v001: measurements, rest skeleton and leg IK helpers.

Imported by robot_build.py and robot_anim.py. Pure mathutils. Blender +Z up / +Y forward (the lens),
character right = +X. The bind pose is the concept stance: a broad toy robot with one big orange lens,
plum shoulder spheres, big teal C-pincers hanging open at its sides and stocky legs slightly bent.
"""
import math
from mathutils import Vector, Matrix, Quaternion

def V(*a): return Vector(a)

SHELL_C = V(0, 0, 1.0); SHELL_S = V(.74, .62, .56)          # rounded cream shell (head and torso in one)
SHELL_Z0 = SHELL_C.z - SHELL_S.z / 2; SHELL_Z1 = SHELL_C.z + SHELL_S.z / 2
FRONT_Y = SHELL_S.y / 2
EYE_C = V(0, FRONT_Y - .02, 1.04)                             # lens centre, on the front face
PELVIS_C = V(0, -.01, .655)
ANT_BASE = V(0, -.05, SHELL_Z1 - .01); ANT_MID = V(0, -.05, SHELL_Z1 + .07); ANT_TOP = V(0, -.05, SHELL_Z1 + .155)
SHOULDER = {'R': V(.455, 0, 1.08), 'L': V(-.455, 0, 1.08)}
ELBOW = {'R': V(.62, .03, .83), 'L': V(-.62, .03, .83)}
WRIST = {'R': V(.7, .07, .67), 'L': V(-.7, .07, .67)}
CLAW_U = {'R': V(-.5, 0, -.866), 'L': V(.5, 0, -.866)}        # the C opens down and inward
CLAW_MID = .145                                                  # mid radius of the C ring
CLAW_C = {s: WRIST[s] + CLAW_U[s] * CLAW_MID for s in 'RL'}     # centre of the C pincer ring
HIP = {'R': V(.2, -.01, .6), 'L': V(-.2, -.01, .6)}
KNEE = {'R': V(.225, .075, .385), 'L': V(-.225, .075, .385)}
ANKLE = {'R': V(.235, .0, .17), 'L': V(-.235, .0, .17)}
SHELL_PROFILE = [(0, 0), (0, .24), (.015, .3), (.045, .345), (.1, .368), (.2, .375), (.3, .37), (.38, .35), (.44, .315), (.49, .26), (.525, .19), (.548, .1), (.556, 0)]
SHELL_EY = .84

def frame_y(y, hint):
    y = Vector(y).normalized(); x = y.cross(Vector(hint))
    if x.length < 1e-6: x = y.cross(V(1, 0, 0))
    x.normalize(); z = x.cross(y).normalized(); return Matrix((x, y, z)).transposed()

def two_bone(S, A, L1, L2, pole):
    d = A - S; D = d.length; dn = d / D
    D = min(D, L1 + L2 - 1e-6); D = max(D, abs(L1 - L2) + 1e-6)
    a = (L1 * L1 - L2 * L2 + D * D) / (2 * D); h = math.sqrt(max(0.0, L1 * L1 - a * a))
    p = Vector(pole) - dn * Vector(pole).dot(dn)
    if p.length < 1e-6: p = dn.orthogonal()
    p.normalize(); return S + dn * a + p * h

def rest_pole(S, K, A):
    d = (A - S).normalized(); k = K - S; return (k - d * k.dot(d)).normalized()

def claw_hinge(s):
    """The jaws hinge at the back of the C, which plugs into the wrist; the hinge axis is forward (+Y)."""
    return WRIST[s].copy()

def rest_bones():
    R = {}
    R['root'] = (V(0, 0, 0), V(0, 0, .12), None, V(0, 1, 0), False)
    R['pelvis'] = (PELVIS_C, PELVIS_C + V(0, 0, .12), 'root', V(0, 1, 0), True)
    R['shell'] = (V(0, 0, SHELL_Z0 + .04), V(0, 0, SHELL_Z0 + .3), 'pelvis', V(0, 1, 0), True)
    R['eye'] = (EYE_C - V(0, .08, 0), EYE_C, 'shell', V(0, 0, 1), True)
    R['lens'] = (EYE_C, EYE_C + V(0, .06, 0), 'eye', V(0, 0, 1), True)
    R['ant_1'] = (ANT_BASE, ANT_MID, 'shell', V(0, 1, 0), True)
    R['ant_2'] = (ANT_MID, ANT_TOP, 'ant_1', V(0, 1, 0), True)
    for s in 'RL':
        sg = 1 if s == 'R' else -1
        R['shoulder_' + s] = (SHOULDER[s], SHOULDER[s] + V(sg * .12, 0, 0), 'shell', V(0, 1, 0), True)
        R['upper_' + s] = (SHOULDER[s], ELBOW[s], 'shoulder_' + s, V(0, 1, 0), True)
        R['fore_' + s] = (ELBOW[s], WRIST[s], 'upper_' + s, V(0, 1, 0), True)
        R['claw_' + s] = (WRIST[s], CLAW_C[s], 'fore_' + s, V(0, 1, 0), True)
        h = claw_hinge(s)
        R['jaw_%s_up' % s] = (h, h + V(-sg * .1, 0, .06), 'claw_' + s, V(0, 1, 0), True)
        R['jaw_%s_lo' % s] = (h, h + V(-sg * .1, 0, -.06), 'claw_' + s, V(0, 1, 0), True)
        R['thigh_' + s] = (HIP[s], KNEE[s], 'pelvis', rest_pole(HIP[s], KNEE[s], ANKLE[s]), True)
        R['shin_' + s] = (KNEE[s], ANKLE[s], 'thigh_' + s, rest_pole(HIP[s], KNEE[s], ANKLE[s]), True)
        R['foot_' + s] = (ANKLE[s], ANKLE[s] + V(0, .15, 0), 'root', V(0, 0, 1), True)
    return R
