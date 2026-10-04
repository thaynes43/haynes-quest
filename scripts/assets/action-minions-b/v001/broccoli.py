"""broccoli-bouncer v001: original nursery-vegetable parody minion.

Chunky green floret crown, pale green fluted stalk torso with a naughty cream face, leaf hands and
orange high-top sneakers. Modelled geometry with flat per-part colours; 25-bone rigid rig; five clips.
argv: stage=geo (geometry + rig only) | stage=full (clips, bounds, master, GLB, construction.json)
"""
import bpy, sys, math, json, random
from pathlib import Path
from mathutils import Vector, Matrix
sys.path.insert(0, '/workspace/haynes-quest/action-worlds/minions-b/v001/source')
import common as C
from common import ellipsoid, icoblob, rbox, lathe, tube, torus, leaf, TRS, keyed, merge, bump, ramp, smooth, wave

ASSET = 'broccoli-bouncer'; TITLE = 'Broccoli_Bouncer'
ARGS = dict(a.split('=', 1) for a in sys.argv[1:] if '=' in a)
OUT = C.REMOTE / ASSET
PALETTE = {
    'floret': '#3f8230', 'floret_mid': '#58a03b', 'floret_lite': '#7dba4c', 'floret_core': '#2c6420',
    'stalk': '#c4dd8e', 'face': '#e6eebf', 'lid': '#dfe8b0', 'branch': '#b8d68a',
    'limb': '#4f8f31', 'leaf': '#337526', 'leaf_lite': '#4f9234',
    'sclera': '#ffffff', 'iris': '#6b3d18', 'pupil': '#1b120d', 'shine': '#ffffff', 'brow': '#3d2717',
    'mouth': '#5a1b24', 'teeth': '#fffaf0', 'tongue': '#e8707a', 'blush': '#f3a49b',
    'shoe': '#f07f22', 'shoe_dark': '#cf6418', 'sole': '#faf6ee', 'lace': '#fffaf3',
}

def build():
    C.reset('Broccoli Bouncer v001', PALETTE); C.materials('Broccoli Bouncer')
    rnd = random.Random(4207)
    # ---- stalk torso: short, wide, flared skirt-like base with scalloped hem and deep ribs, flaring into the branches
    def flute(th, z):
        hem = max(0.0, (.33 - z) / .09)
        return 1 + .055 * math.cos(8 * th) * (1 if z < .74 else .4) + .07 * hem * max(0.0, math.cos(4 * th + .4))
    lathe('stalk', [(0, .235), (.2, .238), (.262, .252), (.272, .285), (.25, .34), (.215, .42), (.196, .52), (.192, .6),
                    (.205, .68), (.245, .745), (.27, .79), (.22, .83), (0, .845)], 'stalk', 'chest', seg=40, mod=flute)
    ellipsoid('face plate', (0, .148, .6), (.172, .074, .162), 'face', 'chest', seg=22, rings=12)
    # ---- face: big eyes under sly lids, angry brows, open smirk, blush
    for s in (-1, 1):
        x = .074 * s; yaw = -14 * s; c = Vector((x, .196, .645))
        R = TRS(rot=(0, 0, yaw)).to_3x3(); side = 'LR'[s > 0]
        ellipsoid('sclera %+d' % s, c, (.055, .032, .066), 'sclera', 'eye_' + side, seg=16, rings=10, rot=(0, 0, yaw), gloss=True)
        ic = c + R @ Vector((-.007 * s, .025, -.009))
        ellipsoid('iris %+d' % s, ic, (.033, .014, .04), 'iris', 'eye_' + side, seg=12, rings=8, rot=(0, 0, yaw), gloss=True)
        ellipsoid('pupil %+d' % s, ic + R @ Vector((0, .01, -.002)), (.018, .009, .023), 'pupil', 'eye_' + side, seg=10, rings=6, rot=(0, 0, yaw), gloss=True)
        ellipsoid('shine %+d' % s, ic + R @ Vector((.01 * s, .017, .014)), (.009, .006, .011), 'shine', 'eye_' + side, seg=8, rings=6, gloss=True)
        ellipsoid('lid %+d' % s, c + R @ Vector((0, .007, .042)), (.061, .035, .027), 'lid', 'eye_' + side, seg=14, rings=8, rot=(0, -16 * s, yaw))
        tube('brow %+d' % s, [(.135 * s, .19, .734), (.09 * s, .218, .73), (.034 * s, .226, .7)],
             [(.01, .013), (.014, .02), (.01, .014)], 'brow', 'brow_' + side, seg=10, up=(0, 1, 0))
        ellipsoid('blush %+d' % s, (.134 * s, .183, .565), (.034, .017, .021), 'blush', 'chest', seg=12, rings=8, rot=(0, 0, -30 * s))
    smile = lambda p: (p.x, p.y, p.z + 7.5 * p.x * p.x + .12 * p.x)
    ellipsoid('mouth', (0, .19, .528), (.078, .033, .036), 'mouth', 'mouth', seg=18, rings=10, fn=smile)
    ellipsoid('teeth', (0, .2, .549), (.062, .022, .012), 'teeth', 'mouth', seg=16, rings=6, fn=smile, gloss=True)
    ellipsoid('tongue', (.013, .201, .512), (.035, .021, .015), 'tongue', 'mouth', seg=10, rings=6, gloss=True)
    # ---- crown: thirteen big floret clusters (core + buds) wider than the body, sides dropping beside the face
    clusters = [((0, -.03, 1.25), .25)]
    for k in range(5):
        a = math.radians(90 + 72 * k + 8); clusters.append(((.3 * math.cos(a), .25 * math.sin(a), 1.19), .215))
    for k in range(7):
        a = math.radians(90 + 360 / 7 * k + 26); ca, sa = math.cos(a), math.sin(a)
        clusters.append(((.47 * ca, .36 * sa, 1.0 - .07 * abs(ca) + .02 * max(0, sa)), .205))
    top = Vector((0, -.03, .9))
    for i, (cc, R0) in enumerate(clusters):
        cc = Vector(cc) + Vector((rnd.uniform(-.015, .015), rnd.uniform(-.015, .015), rnd.uniform(-.015, .02))); R0 *= rnd.uniform(.94, 1.06)
        bone = 'crown_L' if cc.x < -.25 and cc.z < 1.1 else 'crown_R' if cc.x > .25 and cc.z < 1.1 else 'crown'
        ellipsoid('floret core %02d' % i, cc, R0 * .84, 'floret_core', bone, seg=8, rings=6)
        out = (cc - top).normalized(); j = 0; N = 17
        for k in range(N):
            zf = 1 - 2 * (k + .5) / N; rr = math.sqrt(max(0, 1 - zf * zf)); ph = k * 2.39996 + i
            d = Vector((rr * math.cos(ph), rr * math.sin(ph), zf))
            if d.dot(out) < -.05 or d.z < -.35: continue
            d = (d + Vector((rnd.uniform(-.12, .12), rnd.uniform(-.12, .12), rnd.uniform(-.12, .12)))).normalized()
            r = R0 * rnd.uniform(.4, .48)
            col = 'floret_lite' if d.z > .62 else 'floret_mid' if (j + i) % 3 == 0 else 'floret'
            icoblob('floret bud %02d.%02d' % (i, j), cc + d * R0 * .7, r, col, bone, subdiv=2); j += 1
        if i >= 6:
            tube('branch %02d' % i, [(0, 0, .76), (cc.x * .45, cc.y * .45, .84), (cc.x * .8, cc.y * .8, cc.z - .07)],
                 [.085, .065, .05], 'branch', bone, seg=9, n=7)
    # ---- arms: thick short limbs, a broad open leaf hand (right) and a leaf-wrapped fist (left)
    for s in (-1, 1):
        side = 'LR'[s > 0]
        ellipsoid('shoulder %+d' % s, (.195 * s, 0, .48), .052, 'limb', 'arm_' + side, seg=12, rings=8)
        tube('arm %+d' % s, [(.19 * s, 0, .48), (.28 * s, .025, .44), (.355 * s, .06, .395)], [.05, .045, .04], 'limb', 'arm_' + side, seg=12)
    hR = Vector((.37, .07, .385))
    ellipsoid('palm R', hR + Vector((.045, .015, .0)), (.075, .045, .085), 'leaf', 'hand_R', seg=14, rings=10, rot=(0, -20, 0))
    for d, L, W in (((.45, .14, .88), .22, .1), ((.93, .12, .35), .2, .092), ((.86, .14, -.3), .155, .075)):
        dv = Vector(d).normalized(); w = dv.cross(Vector((0, 1, 0))).normalized()
        leaf('leaf finger R %.2f' % d[2], hR + Vector((.045, .02, 0)) + dv * .035, dv, w, L, W, .03, 'leaf', 'hand_R', curl=.25, droop=.25, n=7, seg=8)
    leaf('leaf thumb R', hR + Vector((.005, .045, .015)), (-.2, .85, .35), (1, 0, .2), .11, .055, .025, 'leaf_lite', 'hand_R', curl=.2, n=7, seg=8)
    hL = Vector((-.37, .07, .385))
    ellipsoid('fist L', hL + Vector((-.055, .022, -.008)), (.1, .092, .1), 'leaf', 'hand_L', seg=16, rings=12)
    for k in range(3):
        ellipsoid('knuckle L%d' % k, hL + Vector((-.048 - .005 * k, .094, .062 - .04 * k)), (.038, .029, .024), 'leaf_lite', 'hand_L', seg=10, rings=6)
    leaf('leaf flap L', hL + Vector((-.09, -.014, .045)), (-.45, .1, .9), (0, 1, 0), .18, .075, .025, 'leaf', 'hand_L', curl=.3, droop=1.1, n=7, seg=8)
    leaf('leaf thumb L', hL + Vector((-.0, .078, .0)), (.35, .8, .3), (1, 0, -.2), .095, .045, .022, 'leaf_lite', 'hand_L', curl=.2, droop=.6, n=7, seg=8)
    # ---- short legs and chunky orange high-top sneakers
    for s in (-1, 1):
        side = 'LR'[s > 0]; x = .125 * s; k = 1.3
        tube('leg %+d' % s, [(.105 * s, 0, .29), (.115 * s, -.006, .23), (x, -.012, .17)], [.05, .048, .046], 'limb', 'leg_' + side, seg=12)
        rbox('sole %+d' % s, (x, .03 * k, .032), (.155 * k, .28 * k, .064), 'sole', 'foot_' + side, bevel=.026, seg=3,
             fn=lambda p: (p.x * (1 - .25 * max(0, p.y - .07) / .12), p.y, p.z))
        ellipsoid('upper %+d' % s, (x, .0, .1), (.076 * k, .13 * k, .078 * k), 'shoe', 'foot_' + side, seg=14, rings=9,
                  fn=lambda p: (p.x, p.y, p.z * (.55 if p.z < 0 else 1)))
        ellipsoid('toe cap %+d' % s, (x, .108 * k, .066), (.072 * k, .066 * k, .052), 'sole', 'foot_' + side, seg=12, rings=8, gloss=True)
        tube('collar %+d' % s, [(x, -.035, .1), (x, -.032, .205)], [.08, .07], 'shoe', 'foot_' + side, seg=18)
        torus('collar rim %+d' % s, (x, -.032, .205), .069, .014, 'shoe_dark', 'foot_' + side, seg=16, rseg=5)
        ellipsoid('tongue %+d' % s, (x, .02, .186), (.042, .045, .024), 'shoe_dark', 'foot_' + side, seg=12, rings=8, rot=(-30, 0, 0))
        for k2, (yy, zz) in enumerate(((.035, .172), (.068, .157), (.098, .138))):
            rbox('lace %+d.%d' % (s, k2), (x, yy, zz), (.072, .013, .012), 'lace', 'foot_' + side, bevel=.003, seg=1, rot=(-28, 0, 0))
    bones = [('root', (0, 0, 0), None), ('hips', (0, 0, .29), 'root'), ('chest', (0, 0, .45), 'hips'),
             ('crown', (0, 0, .78), 'chest'), ('crown_L', (-.3, 0, .9), 'crown'), ('crown_R', (.3, 0, .9), 'crown'),
             ('eye_L', (-.074, .2, .645), 'chest'), ('eye_R', (.074, .2, .645), 'chest'),
             ('brow_L', (-.085, .218, .725), 'chest'), ('brow_R', (.085, .218, .725), 'chest'), ('mouth', (0, .2, .53), 'chest'),
             ('arm_L', (-.195, 0, .48), 'chest'), ('hand_L', (-.355, .06, .395), 'arm_L'),
             ('arm_R', (.195, 0, .48), 'chest'), ('hand_R', (.355, .06, .395), 'arm_R'),
             ('leg_L', (-.105, 0, .29), 'root'), ('foot_L', (-.125, -.012, .17), 'leg_L'),
             ('leg_R', (.105, 0, .29), 'root'), ('foot_R', (.125, -.012, .17), 'leg_R')]
    arm = C.armature(TITLE + '_Rig', bones)
    sk, parts = C.skin(ASSET, TITLE, arm)
    return arm, sk, parts

SCALED = {'chest', 'crown', 'crown_L', 'crown_R', 'eye_L', 'eye_R', 'mouth'}

# Sole outline (y, z) in the rest pose and the leg/foot pivots: plant() lifts a leg just enough that no sole
# corner dips below the floor after its rotations (it never lowers a leg).
SOLE = [(-.155, 0.0), (.235, 0.0), (.255, .045), (-.17, .045)]
HIP = (0.0, .29); FOOT = (-.012, .17)

def _rx(p, c, deg):
    a = math.radians(deg); y, z = p[0] - c[0], p[1] - c[1]
    return (c[0] + y * math.cos(a) - z * math.sin(a), c[1] + y * math.sin(a) + z * math.cos(a))

def plant(pose):
    out = dict(pose)
    for side in 'LR':
        leg = C.add(pose.get('leg_' + side)); foot = C.add(pose.get('foot_' + side))
        low = min(_rx(_rx(q, FOOT, foot['r'][0]), HIP, leg['r'][0])[1] + leg['t'][2] for q in SOLE)
        if low < 0: out['leg_' + side] = C.add(leg, {'t': (0, 0, -low + .0005)})
    return out

def idle(t):
    P = 2.0; ph = t / P
    bob = .5 - .5 * math.cos(math.tau * 2 * ph)
    blink = 1 - .88 * bump(t, 1.40, 1.48, 1.56)
    sly = bump(t, .45, .75, 1.15)
    return {
        'hips': {'t': (0, 0, .016 * bob), 'r': (0, 2.5 * wave(t, P), 3 * wave(t, P, .1))},
        'chest': {'s': (1 + .012 * bob, 1 + .012 * bob, 1 - .022 * bob)},
        'crown': {'r': (2 * wave(t, P, .2), -2.5 * wave(t, P, .25), 0), 's': (1 - .015 * bob, 1 - .015 * bob, 1 + .03 * (1 - bob))},
        'crown_L': {'r': (0, 3 * wave(t, 1.0, .3), 0)}, 'crown_R': {'r': (0, -3 * wave(t, 1.0, .35), 0)},
        'arm_L': {'r': (0, 5 * wave(t, P), -5 * wave(t, P, .25))}, 'arm_R': {'r': (0, 5 * wave(t, P), 5 * wave(t, P, .25))},
        'hand_L': {'r': (6 * wave(t, 1.0), 0, 0)}, 'hand_R': {'r': (0, -8 * wave(t, 1.0, .2), 0)},
        'eye_L': {'s': (1, 1, blink)}, 'eye_R': {'s': (1, 1, blink)},
        'brow_R': {'t': (0, 0, .01 * sly), 'r': (0, -8 * sly, 0)}, 'brow_L': {'t': (0, 0, -.003 * sly), 'r': (0, -4 * sly, 0)},
        'mouth': {'s': (1 + .06 * sly, 1, 1 + .05 * bob)},
    }

def move(t):
    P = .8; ph = t / P
    b = abs(math.sin(math.tau * ph))
    land = 1 - b
    sw = math.sin(math.tau * ph)
    return {
        'hips': {'t': (0, 0, .07 * b), 'r': (-9, 4 * sw, 6 * sw)},
        'chest': {'s': (1 + .03 * land, 1 + .03 * land, 1 - .05 * land)},
        'crown': {'r': (5 * math.sin(math.tau * 2 * ph - .9), 0, 0), 's': (1 + .03 * land, 1 + .03 * land, 1 - .06 * land)},
        'crown_L': {'r': (0, 5 * math.sin(math.tau * 2 * ph - .6), 0)}, 'crown_R': {'r': (0, -5 * math.sin(math.tau * 2 * ph - .6), 0)},
        'leg_L': {'t': (0, 0, .045 * b), 'r': (-30 * sw, 0, 0)}, 'leg_R': {'t': (0, 0, .045 * b), 'r': (30 * sw, 0, 0)},
        'foot_L': {'r': (14 * sw, 0, 0)}, 'foot_R': {'r': (-14 * sw, 0, 0)},
        'arm_L': {'r': (0, 18, 32 * sw)}, 'arm_R': {'r': (0, -18, 32 * sw)},
        'hand_L': {'r': (10 * sw, 0, 0)}, 'hand_R': {'r': (-10 * sw, 0, 0)},
        'brow_L': {'r': (0, 10, 0), 't': (0, 0, -.004)}, 'brow_R': {'r': (0, -10, 0), 't': (0, 0, -.004)},
        'mouth': {'s': (1.08, 1, 1 + .15 * b)},
    }

REST = {}
NOTICE = {'hips': {'r': (6, 0, 0)}, 'brow_L': {'r': (0, 16, 0), 't': (0, 0, -.008)}, 'brow_R': {'r': (0, -16, 0), 't': (0, 0, -.008)},
          'eye_L': {'s': (1, 1, .72)}, 'eye_R': {'s': (1, 1, .72)}, 'arm_L': {'r': (0, 20, -10)}, 'arm_R': {'r': (0, -20, 10)},
          'mouth': {'s': (1.15, 1, .8)}}
WIND = {'hips': {'t': (0, -.03, -.075), 'r': (12, 0, 0)}, 'chest': {'s': (1.07, 1.07, .9)},
        'crown': {'r': (14, 0, 0), 's': (1.04, 1.04, .94)}, 'crown_L': {'r': (0, 8, 0)}, 'crown_R': {'r': (0, -8, 0)},
        'arm_L': {'r': (0, 42, -55)}, 'arm_R': {'r': (0, -42, 55)}, 'hand_L': {'r': (-25, 0, 0)}, 'hand_R': {'r': (-25, 0, 0)},
        'leg_L': {'r': (-6, 0, 0)}, 'leg_R': {'r': (-6, 0, 0)},
        'brow_L': {'r': (0, 20, 0), 't': (0, 0, -.01)}, 'brow_R': {'r': (0, -20, 0), 't': (0, 0, -.01)},
        'eye_L': {'s': (1, 1, .6)}, 'eye_R': {'s': (1, 1, .6)}, 'mouth': {'s': (1.25, 1, .7)}}
LAUNCH = {'hips': {'t': (0, .1, .1), 'r': (-12, 0, 0)}, 'chest': {'s': (.96, .96, 1.08)},
          'crown': {'r': (6, 0, 0), 's': (.97, .97, 1.06)}, 'arm_L': {'r': (0, 30, 10)}, 'arm_R': {'r': (0, -30, -10)},
          'leg_L': {'t': (0, .1, .07), 'r': (-22, 0, 0)}, 'leg_R': {'t': (0, .1, .07), 'r': (-16, 0, 0)},
          'foot_L': {'r': (20, 0, 0)}, 'foot_R': {'r': (16, 0, 0)},
          'brow_L': {'r': (0, 18, 0)}, 'brow_R': {'r': (0, -18, 0)}, 'eye_L': {'s': (1.05, 1, 1.05)}, 'eye_R': {'s': (1.05, 1, 1.05)},
          'mouth': {'s': (1.2, 1, 1.4)}}
CONTACT = {'hips': {'t': (0, .24, .015), 'r': (-18, 0, 0)}, 'chest': {'s': (1.05, 1.05, .93)},
           'crown': {'r': (-16, 0, 0), 's': (1.07, 1.07, .9)}, 'crown_L': {'r': (0, -6, 0)}, 'crown_R': {'r': (0, 6, 0)},
           'arm_L': {'r': (0, 30, -62)}, 'arm_R': {'r': (0, -30, 62)}, 'hand_L': {'r': (20, 0, 0)}, 'hand_R': {'r': (20, 0, 0)},
           'leg_L': {'t': (0, .24, 0), 'r': (4, 0, 0)}, 'leg_R': {'t': (0, .24, 0), 'r': (-4, 0, 0)},
           'brow_L': {'r': (0, 22, 0), 't': (0, 0, -.006)}, 'brow_R': {'r': (0, -22, 0), 't': (0, 0, -.006)},
           'eye_L': {'s': (1.12, 1, 1.12)}, 'eye_R': {'s': (1.12, 1, 1.12)}, 'mouth': {'s': (1.3, 1, 1.55)}}
RECOIL = C.merge(CONTACT, {'hips': {'t': (0, -.04, .02), 'r': (8, 0, 0)}, 'crown': {'r': (12, 0, 0), 's': (.96, .96, 1.07)},
                           'arm_L': {'r': (0, -8, 25)}, 'arm_R': {'r': (0, 8, -25)}})
HOP = {'hips': {'t': (0, .11, .07), 'r': (4, 0, 0)}, 'leg_L': {'t': (0, .11, .06), 'r': (10, 0, 0)}, 'leg_R': {'t': (0, .11, .06), 'r': (10, 0, 0)},
       'arm_L': {'r': (0, 25, 0)}, 'arm_R': {'r': (0, -25, 0)}, 'mouth': {'s': (1.1, 1, 1.1)},
       'brow_L': {'r': (0, 8, 0)}, 'brow_R': {'r': (0, -8, 0)}}

def attack(t):
    keys = [(0, REST), (.25, NOTICE), (.85, WIND), (1.08, WIND), (1.16, LAUNCH), (1.25, CONTACT), (1.42, RECOIL), (1.72, HOP), (2.0, REST)]
    p = keyed(keys, t)
    shake = bump(t, .84, .96, 1.08)
    if shake:
        p = C.merge(p, {'hips': {'r': (0, 2.2 * shake * math.sin(t * 2 * math.pi * 18), 0)}, 'crown': {'r': (0, 0, 2.5 * shake * math.sin(t * 2 * math.pi * 15))}})
    return p

HURT = {'hips': {'t': (0, -.07, .01), 'r': (14, 0, 0)}, 'chest': {'s': (1.08, 1.08, .9)}, 'crown': {'r': (10, 0, 0), 's': (1.08, 1.08, .88)},
        'crown_L': {'r': (0, 12, 0)}, 'crown_R': {'r': (0, -12, 0)},
        'arm_L': {'r': (0, 58, 0)}, 'arm_R': {'r': (0, -58, 0)}, 'hand_L': {'r': (0, 20, 0)}, 'hand_R': {'r': (0, -20, 0)},
        'eye_L': {'s': (1.05, 1, .14)}, 'eye_R': {'s': (1.05, 1, .14)},
        'brow_L': {'r': (0, -14, 0), 't': (0, 0, .012)}, 'brow_R': {'r': (0, 14, 0), 't': (0, 0, .012)},
        'mouth': {'s': (.75, 1, 1.45)}, 'leg_L': {'r': (8, 0, 0)}, 'leg_R': {'r': (8, 0, 0)}}
WOBBLE = C.merge({k: v for k, v in HURT.items()}, {})

def hit(t):
    keys = [(0, REST), (.08, HURT), (.22, HURT), (.4, C.mix(HURT, REST, .8)), (.6, REST)]
    p = keyed(keys, t)
    w = bump(t, .2, .35, .6)
    return C.merge(p, {'crown': {'r': (0, 6 * w * math.sin(t * 40), 0)}})

DIZZY = {'eye_L': {'s': (1, 1, .12)}, 'eye_R': {'s': (1, 1, .12)}, 'mouth': {'s': (.62, 1, 1.25)},
         'brow_L': {'r': (0, -18, 0), 't': (0, 0, .012)}, 'brow_R': {'r': (0, 18, 0), 't': (0, 0, .012)}}
SAG = C.merge(DIZZY, {'hips': {'t': (0, 0, -.03), 'r': (-6, 6, 0)}, 'crown': {'r': (-18, 10, 0)}, 'chest': {'s': (1.03, 1.03, .95)},
                      'arm_L': {'r': (0, -12, 0)}, 'arm_R': {'r': (0, 12, 0)}})
FLOP = C.merge(DIZZY, {'hips': {'t': (0, -.02, .127), 'r': (74, 0, 0)}, 'crown': {'r': (6, 0, 0), 's': (1.06, 1.06, .92)},
                       'crown_L': {'r': (0, 10, 0)}, 'crown_R': {'r': (0, -10, 0)},
                       'arm_L': {'r': (0, 70, -20)}, 'arm_R': {'r': (0, -70, 20)},
                       'leg_L': {'t': (0, .035, .11), 'r': (144, 0, -10)}, 'leg_R': {'t': (0, .035, .11), 'r': (156, 0, 10)},
                       'foot_L': {'r': (-25, 0, 0)}, 'foot_R': {'r': (-15, 0, 0)}})
REBOUND = C.merge(FLOP, {'hips': {'t': (0, 0, .03), 'r': (-6, 0, 0)}, 'leg_L': {'r': (-10, 0, 0)}, 'leg_R': {'r': (-14, 0, 0)}})
DEFEAT_HOLD = 1.8

def defeat(t):
    keys = [(0, REST), (.1, HURT), (.2, C.mix(HURT, DIZZY, .5)), (.9, C.merge(DIZZY, {'hips': {'r': (0, 0, 0)}})), (1.2, SAG), (1.52, FLOP),
            (1.64, REBOUND), (DEFEAT_HOLD, FLOP), (2.4, FLOP)]
    p = keyed(keys, t)
    spin = ramp(t, .18, .92)
    wob = bump(t, .2, .6, 1.2)
    extra = {'hips': {'r': (0, 9 * wob * math.sin(t * 13), -360 * spin)},
             'arm_L': {'r': (0, 25 * wob * math.sin(t * 17), 0)}, 'arm_R': {'r': (0, -25 * wob * math.sin(t * 17 + 1), 0)}}
    return C.merge(p, extra)

CLIPS = [(n, d, l, (lambda f: (lambda t: plant(f(t))))(f)) for n, d, l, f in
         [('idle', 2.0, True, idle), ('move', .8, True, move), ('attack', 2.0, False, attack), ('hit', .6, False, hit), ('defeat', 2.4, False, defeat)]]

if __name__ == '__main__':
    C.lease_ok(); OUT.mkdir(parents=True, exist_ok=True)
    arm, sk, parts = build()
    tris = sum(len(p.vertices) - 2 for p in sk.data.polygons)
    rec = {'asset_id': ASSET, 'version': 'v001', 'triangles': tris, 'vertices': len(sk.data.vertices), 'parts': len(parts), 'bones': len(arm.data.bones)}
    if ARGS.get('stage', 'geo') == 'full':
        clips = C.bake(arm, CLIPS, SCALED)
        for c in clips:
            if c['name'] == 'attack': c.update({'contact_time_s': 1.25, 'contact_fraction': .625, 'telegraph_s': [0.25, 1.08]})
            if c['name'] == 'defeat': c['held_final_pose_from_s'] = DEFEAT_HOLD
        b = C.sample_bounds(arm, sk, step=1)
        sk['model_space_bounds_y_up'] = b['envelope']; sk['bounds_method'] = 'All evaluated skin vertices, rest and every 60 fps frame of every clip; 0.005 m padding.'
        arm['attack_contact_seconds'] = 1.25; arm['attack_contact_fraction'] = .625; arm['asset_id'] = ASSET; arm['version'] = 'v001'
        arm['forward'] = 'Blender +Y / glTF -Z'; arm['neutral_height_m'] = round(b['rest']['max'][1], 4)
        C.store_sources('broccoli-bouncer v001 ', ['common.py', 'broccoli.py'])
        for f in ('broccoli-bouncer.blend', 'broccoli-bouncer.glb'):
            if (OUT / f).exists() and ARGS.get('replace') == 'draft': (OUT / f).unlink()
        C.save_master(OUT / 'broccoli-bouncer.blend', ASSET, 'broccoli-bouncer v001 editable master; awaiting owner review')
        C.export_with_identity(arm, sk, OUT / 'broccoli-bouncer.glb', {'asset_id': ASSET, 'asset_version': 'v001', 'work_order': '20261004-opus-action-minions-b',
                               'candidate_status': 'broccoli-bouncer v001 · awaiting owner review', 'forward': 'glTF -Z (enemy adapter facing)'})
        rec.update({'clips': clips, 'bounds_gltf_y_up': b, 'height_m': b['rest']['max'][1], 'parts_detail': parts,
                    'files': {n: {'bytes': (OUT / n).stat().st_size, 'sha256': C.sha(OUT / n)} for n in ('broccoli-bouncer.blend', 'broccoli-bouncer.glb')},
                    'blender_version': bpy.app.version_string, 'created_utc': C.now()})
        (OUT / 'construction.json').write_text(json.dumps(rec, indent=2) + '\n')
        rec = {k: rec[k] for k in ('triangles', 'vertices', 'parts', 'bones', 'height_m', 'files')} | {'floor': {k: v['min'][1] for k, v in b['clips'].items()}, 'all': b['all']}
    fam={}
    for q in parts:
        k=q['name'].split(' ')[0]+' '+(q['name'].split(' ')[1] if len(q['name'].split(' '))>1 and not q['name'].split(' ')[1][0] in '+-0123456789' else '')
        fam[k]=fam.get(k,0)+q['triangles']
    rec['tri_families']=dict(sorted(fam.items(),key=lambda kv:-kv[1])[:14])
    print(json.dumps(rec))
