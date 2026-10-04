"""demon-idol-drummer v001: original Big Stage parody minion.

A cheeky toy demon idol: magenta swept spiky hair, small plum horns, pointed ears, a smug sneer, teal short jacket
over a black shirt with a gold star, plum baggy pants, white chunky boots, brown suspender straps carrying a
raspberry snare at the waist and two drumsticks. Modelled geometry, flat per-part colours; rigid rig with a
two-bone leg IK used while authoring the clips (exported as ordinary rotations); five clips.
argv: stage=geo [posetest=<clip>:<t>] | stage=full [replace=draft]
"""
import bpy, sys, math, json
from mathutils import Vector, Matrix, Euler
sys.path.insert(0, '/workspace/haynes-quest/action-worlds/minions-b/v001/source')
import common as C
from common import ellipsoid, rbox, lathe, tube, torus, leaf, star, TRS, keyed, bump, ramp, smooth, wave

ASSET = 'demon-idol-drummer'; TITLE = 'Demon_Idol_Drummer'
ARGS = dict(a.split('=', 1) for a in sys.argv[1:] if '=' in a)
PALETTE = {
    'skin': '#f4cdb5', 'skin_shade': '#e6b098', 'blush': '#f19b9b', 'hair': '#c9297f', 'hair_dark': '#951d60', 'horn': '#5c2852',
    'brow': '#7d1c4e', 'sclera': '#ffffff', 'iris': '#8e2449', 'pupil': '#1a1014', 'shine': '#ffffff', 'lash': '#2b1a24',
    'mouth': '#6b1f2f', 'teeth': '#fffaf2', 'jacket': '#2b9a95', 'jacket_dark': '#1f7571', 'jacket_lite': '#57bdb4',
    'shirt': '#2a2530', 'star': '#e3b33d', 'pants': '#6b2851', 'pants_dark': '#531f40', 'belt': '#2a2430', 'gold': '#d9aa3c',
    'strap': '#8b5a33', 'boot': '#f4f1ea', 'sole': '#3b3442', 'lace': '#c99a5a', 'band': '#26222b',
    'drum': '#c62a5e', 'drum_dark': '#9f1f4b', 'drumhead': '#f6f1e6', 'stick': '#d9b47c', 'stick_tip': '#f0dcae', 'ring': '#f4cf63',
}
DRUM_C = Vector((0, .25, .76)); DRUM_M = TRS(DRUM_C, (-20, 0, 0))
# chibi proportions: the head group is enlarged about the neck, then the whole figure is scaled to game height
HEAD_PIVOT = Vector((0, .01, 1.12)); HEAD_SCALE = 1.2; GS = .955
HEAD_BONES = {'head', 'hair', 'eye_L', 'eye_R', 'brow_L', 'brow_R', 'mouth'}
SD = {'R': Vector((.5, .2, .84)).normalized(), 'L': Vector((-.5, .2, .84)).normalized()}   # rest stick directions
STICK_TIP = .26                                                                             # tip distance from the fist centre
BONES_RAW = [('root', (0, 0, 0), None), ('hips', (0, 0, .74), 'root'), ('spine', (0, 0, .84), 'hips'), ('chest', (0, 0, .98), 'spine'),
             ('neck', (0, 0, 1.1), 'chest'), ('head', (0, .01, 1.17), 'neck'), ('hair', (0, -.02, 1.38), 'head'),
             ('eye_L', (-.046, .108, 1.286), 'head'), ('eye_R', (.046, .108, 1.286), 'head'),
             ('brow_L', (-.046, .118, 1.335), 'head'), ('brow_R', (.046, .118, 1.335), 'head'), ('mouth', (0, .118, 1.22), 'head'),
             ('upperarm_L', (-.165, 0, 1.06), 'chest'), ('forearm_L', (-.27, .04, .88), 'upperarm_L'), ('hand_L', (-.33, .12, .76), 'forearm_L'),
             ('upperarm_R', (.165, 0, 1.06), 'chest'), ('forearm_R', (.27, .04, .88), 'upperarm_R'), ('hand_R', (.33, .12, .76), 'forearm_R'),
             ('drum', (0, .2, .8), 'hips'), ('beat', tuple(DRUM_C), 'drum'), ('beat2', tuple(DRUM_C), 'drum'),
             ('thigh_L', (-.09, 0, .72), 'root'), ('shin_L', (-.118, .03, .44), 'thigh_L'), ('foot_L', (-.14, 0, .14), 'shin_L'),
             ('thigh_R', (.09, 0, .72), 'root'), ('shin_R', (.118, .03, .44), 'thigh_R'), ('foot_R', (.14, 0, .14), 'shin_R')]
_HM = Matrix.Translation(HEAD_PIVOT) @ Matrix.Scale(HEAD_SCALE, 4) @ Matrix.Translation(-HEAD_PIVOT)
BONES = [(n, tuple((_HM @ Vector(h) if n in HEAD_BONES else Vector(h)) * GS), par) for n, h, par in BONES_RAW]
HEADS = {n: Vector(h) for n, h, par in BONES}; PARENT = {n: par for n, h, par in BONES}

def tuft(name, pts, w, th, color, bone):
    tube(name, pts, [(w, th), (w * .8, th * .8), (0, 0)], color, bone, seg=8, n=8, up=(0, 0, 1))

def build():
    C.reset('Demon Idol Drummer v001', PALETTE); C.materials('Demon Idol Drummer')
    # ---- head, face, ears
    jaw = lambda p: (p.x * (1 - .16 * max(0, -p.z)), p.y * (1 - .04 * max(0, -p.z)), p.z)
    ellipsoid('head', (0, .015, 1.28), (.118, .112, .13), 'skin', 'head', seg=22, rings=14, fn=jaw)
    tube('neck', [(0, 0, 1.08), (0, .01, 1.19)], [.046, .043], 'skin', 'neck', seg=12)
    for s in (-1, 1):
        side = 'LR'[s > 0]; c = Vector((.046 * s, .102, 1.286)); yaw = -13 * s; R = TRS(rot=(0, 0, yaw)).to_3x3()
        ellipsoid('sclera %+d' % s, c, (.031, .017, .034), 'sclera', 'eye_' + side, seg=14, rings=10, rot=(0, 0, yaw), gloss=True)
        ic = c + R @ Vector((-.003 * s, .012, -.004))
        ellipsoid('iris %+d' % s, ic, (.021, .009, .025), 'iris', 'eye_' + side, seg=12, rings=8, rot=(0, 0, yaw), gloss=True)
        ellipsoid('pupil %+d' % s, ic + R @ Vector((0, .006, -.001)), (.011, .005, .014), 'pupil', 'eye_' + side, seg=10, rings=6, rot=(0, 0, yaw), gloss=True)
        ellipsoid('shine %+d' % s, ic + R @ Vector((.006 * s, .01, .009)), (.006, .004, .007), 'shine', 'eye_' + side, seg=8, rings=6, gloss=True)
        ellipsoid('lid %+d' % s, c + R @ Vector((0, .004, .022)), (.035, .02, .018), 'skin', 'eye_' + side, seg=12, rings=8, rot=(0, -10 * s, yaw))
        tube('lash %+d' % s, [c + R @ Vector((.036 * s, .004, .006)), c + R @ Vector((.0, .02, .016)), c + R @ Vector((-.03 * s, .016, .01))],
             [.004, .0055, .004], 'lash', 'eye_' + side, seg=6)
        tube('brow %+d' % s, [(.08 * s, .1, 1.338), (.05 * s, .118, 1.336), (.016 * s, .124, 1.316)], [(.006, .008), (.008, .011), (.006, .007)], 'brow', 'brow_' + side, seg=8, up=(0, 1, 0))
        ellipsoid('blush %+d' % s, (.074 * s, .092, 1.238), (.019, .008, .012), 'blush', 'head', seg=10, rings=6, rot=(0, 0, -30 * s))
        leaf('ear %+d' % s, (.108 * s, .0, 1.275), (.85 * s, -.3, .5), (0, .3, 1), .1, .042, .016, 'skin', 'head', curl=.2, n=7, seg=8, fullness=.5, tip=.3)
    ellipsoid('nose', (0, .127, 1.255), (.011, .009, .009), 'skin_shade', 'head', seg=8, rings=6)
    smirk = lambda p: (p.x, p.y, p.z + 9 * p.x * p.x + .18 * p.x)
    ellipsoid('mouth', (.003, .113, 1.218), (.03, .012, .011), 'mouth', 'mouth', seg=14, rings=8, fn=smirk)
    ellipsoid('teeth', (.003, .118, 1.224), (.024, .007, .004), 'teeth', 'mouth', seg=12, rings=6, fn=smirk, gloss=True)
    tube('fang', [(.016, .119, 1.222), (.017, .121, 1.21)], [.004, 0], 'teeth', 'mouth', seg=6)
    # ---- hair: cap high on the skull, swept bangs, side and back spikes, small curved horns
    ellipsoid('hair cap', (0, -.03, 1.34), (.13, .128, .118), 'hair', 'hair', seg=20, rings=12)
    bangs = [((-.07, .06, 1.4), (-.02, .13, 1.37), (.05, .14, 1.32)), ((-.02, .07, 1.41), (.04, .13, 1.37), (.1, .12, 1.31)),
             ((.03, .07, 1.41), (.08, .12, 1.37), (.13, .08, 1.3)), ((-.1, .04, 1.38), (-.09, .11, 1.33), (-.06, .135, 1.3)),
             ((.06, .05, 1.42), (.11, .09, 1.4), (.15, .05, 1.36))]
    for k, pts in enumerate(bangs): tuft('bang %d' % k, pts, .04, .016, 'hair' if k % 2 == 0 else 'hair_dark', 'hair')
    spikes = [((-.11, -.0, 1.36), (-.16, -.02, 1.3), (-.17, -.03, 1.22)), ((.11, -.0, 1.36), (.16, -.03, 1.3), (.16, -.05, 1.22)),
              ((-.08, -.1, 1.38), (-.14, -.15, 1.34), (-.18, -.18, 1.28)), ((.08, -.1, 1.38), (.14, -.15, 1.35), (.19, -.17, 1.3)),
              ((0, -.12, 1.38), (0, -.18, 1.32), (.02, -.2, 1.24)), ((-.04, -.12, 1.34), (-.06, -.16, 1.26), (-.07, -.17, 1.19)),
              ((.04, -.12, 1.34), (.07, -.15, 1.26), (.08, -.15, 1.19)), ((-.05, -.04, 1.44), (-.08, -.1, 1.5), (-.11, -.17, 1.52)),
              ((.05, -.04, 1.44), (.09, -.09, 1.5), (.13, -.15, 1.51)), ((0, -.02, 1.45), (0, -.09, 1.52), (-.01, -.17, 1.53)),
              ((-.1, .03, 1.39), (-.16, .04, 1.4), (-.21, .02, 1.37)), ((.1, .02, 1.4), (.16, .02, 1.42), (.21, -.01, 1.4))]
    for k, pts in enumerate(spikes): tuft('spike %d' % k, pts, .045, .02, 'hair_dark' if k % 3 == 1 else 'hair', 'hair')
    for s in (-1, 1):
        tube('horn %+d' % s, [(.065 * s, .015, 1.43), (.1 * s, .0, 1.5), (.09 * s, -.04, 1.555)], [.028, .019, 0], 'horn', 'hair', seg=10, n=10, gloss=True)
    # ---- torso: black shirt with a gold star, teal open jacket with popped collar and short sleeves, belt, suspender straps
    ellipsoid('pelvis', (0, 0, .75), (.15, .105, .1), 'pants', 'hips', seg=16, rings=10)
    lathe('belt', [(0, .79), (.141, .79), (.147, .797), (.147, .823), (.141, .83), (0, .83)], 'belt', 'hips', seg=24, M=TRS(scale=(1, .74, 1)))
    rbox('buckle', (0, .108, .81), (.05, .014, .034), 'gold', 'hips', bevel=.006, seg=1, gloss=True)
    ellipsoid('shirt', (0, .0, .95), (.13, .09, .165), 'shirt', 'chest', seg=18, rings=12)
    star('star', (0, .087, .975), .046, .02, .012, 'star', 'chest', gloss=True)
    opening = lambda p: (p.x, min(p.y, .03) if abs(p.x) < .07 - .1 * p.z and p.z > -.15 else p.y, p.z)  # metres about the jacket centre
    ellipsoid('jacket', (0, -.008, .955), (.15, .1, .17), 'jacket', 'chest', seg=22, rings=14, fn=opening)
    for s in (-1, 1):
        side = 'LR'[s > 0]
        tube('lapel %+d' % s, [(.06 * s, .07, 1.07), (.075 * s, .078, .96), (.085 * s, .07, .83)], [.012, .011, .01], 'jacket_lite', 'chest', seg=8)
        leaf('collar %+d' % s, (.065 * s, .035, 1.08), (.5 * s, .25, 1), (0, 1, 0), .1, .065, .013, 'jacket', 'chest', curl=-.2, n=6, seg=8, fullness=.5, tip=.3)
        tube('strap front %+d' % s, [(.085 * s, -.02, 1.1), (.088 * s, .09, 1.02), (.1 * s, .1, .9), (.12 * s, .15, .8)], [(.016, .006)] * 4, 'strap', 'chest', seg=6, up=(1, 0, 0))
        tube('strap back %+d' % s, [(.085 * s, -.02, 1.1), (.07 * s, -.098, 1.0), (-.06 * s, -.1, .86)], [(.016, .006)] * 3, 'strap', 'chest', seg=6, up=(1, 0, 0))
        rbox('strap buckle %+d' % s, (.09 * s, .095, 1.0), (.03, .01, .024), 'gold', 'chest', bevel=.004, seg=1, gloss=True)
    leaf('collar back', (0, -.06, 1.085), (0, -.25, 1), (1, 0, 0), .07, .09, .012, 'jacket', 'chest', curl=-.15, n=6, seg=8, fullness=.5, tip=.3)
    # ---- arms: short sleeves, bare arms, studded wristbands, fists with drumsticks
    for s in (-1, 1):
        side = 'LR'[s > 0]; S = Vector((.165 * s, 0, 1.06)); E = Vector((.27 * s, .04, .88)); W = Vector((.33 * s, .12, .76))
        ellipsoid('shoulder %+d' % s, S, (.062, .062, .058), 'jacket', 'upperarm_' + side, seg=12, rings=8)
        tube('sleeve %+d' % s, [S, S.lerp(E, .55)], [.06, .066], 'jacket', 'upperarm_' + side, seg=12)
        tube('upper arm %+d' % s, [S.lerp(E, .3), E], [.042, .039], 'skin', 'upperarm_' + side, seg=10)
        ellipsoid('elbow %+d' % s, E, .039, 'skin', 'forearm_' + side, seg=10, rings=6)
        tube('forearm %+d' % s, [E, W], [.039, .034], 'skin', 'forearm_' + side, seg=10)
        fd = (W - E).normalized()
        tube('wristband %+d' % s, [W - fd * .045, W + fd * .005], [.041, .041], 'band', 'forearm_' + side, seg=12)
        for k in range(4):
            a = math.tau * k / 4 + .4; off = Vector((math.cos(a), 0, math.sin(a))); off = (off - fd * fd.dot(off)).normalized() * .043
            ellipsoid('stud %+d.%d' % (s, k), W - fd * .02 + off, .008, 'gold', 'forearm_' + side, seg=6, rings=4, gloss=True)
        hc = W + fd * .045
        ellipsoid('fist %+d' % s, hc, (.042, .046, .046), 'skin', 'hand_' + side, seg=12, rings=8)
        ellipsoid('thumb %+d' % s, hc + Vector((-.018 * s, .035, .012)), (.016, .022, .015), 'skin', 'hand_' + side, seg=8, rings=6)
        sd = SD[side]
        tube('stick %+d' % s, [hc - sd * .12, hc + sd * STICK_TIP], [.012, .009], 'stick', 'hand_' + side, seg=8)
        ellipsoid('stick tip %+d' % s, hc + sd * (STICK_TIP + .01), (.017, .017, .02), 'stick_tip', 'hand_' + side, seg=8, rings=6)
    # ---- legs: baggy plum pants with cuffs, white chunky boots
    for s in (-1, 1):
        side = 'LR'[s > 0]; H = Vector((.09 * s, 0, .72)); K = Vector((.118 * s, .03, .44)); A = Vector((.14 * s, 0, .14))
        tube('thigh %+d' % s, [H + Vector((0, 0, .04)), H.lerp(K, .5) + Vector((.01 * s, .01, 0)), K], [.086, .09, .082], 'pants', 'thigh_' + side, seg=14)
        ellipsoid('knee %+d' % s, K, (.082, .084, .08), 'pants', 'shin_' + side, seg=12, rings=8)
        tube('shin %+d' % s, [K, K.lerp(A, .45) + Vector((.012 * s, .012, 0)), A + Vector((0, 0, .14))], [.08, .09, .07], 'pants', 'shin_' + side, seg=14)
        torus('cuff %+d' % s, A + Vector((0, 0, .14)), .068, .017, 'pants_dark', 'shin_' + side, seg=16, rseg=6)
        x = A.x; first_boot = len(C.PARTS)
        lathe('boot shaft %+d' % s, [(0, .07), (.066, .07), (.07, .13), (.068, .215), (.06, .222), (0, .222)], 'boot', 'foot_' + side, seg=16, M=TRS((x, -.005, 0)))
        rbox('boot foot %+d' % s, (x, .045, .065), (.13, .25, .11), 'boot', 'foot_' + side, bevel=.04, seg=3)
        ellipsoid('boot toe %+d' % s, (x, .12, .062), (.068, .07, .058), 'boot', 'foot_' + side, seg=14, rings=8)
        rbox('boot sole %+d' % s, (x, .045, .018), (.145, .29, .036), 'sole', 'foot_' + side, bevel=.014, seg=2)
        for k, (yy, zz) in enumerate(((.06, .125), (.09, .113), (.12, .098))):
            rbox('boot lace %+d.%d' % (s, k), (x, yy, zz), (.075, .012, .011), 'lace', 'foot_' + side, bevel=.003, seg=1, rot=(-25, 0, 0))
        torus('boot strap %+d' % s, (x, -.005, .19), .07, .011, 'lace', 'foot_' + side, seg=18, rseg=5)
        BM = Matrix.Translation((x, .02, 0)) @ Matrix.Scale(1.3, 4) @ Matrix.Translation((-x, -.02, 0))   # chunky boots
        for ob in C.PARTS[first_boot:]: ob.data.transform(BM)
    # ---- raspberry snare on its sling, gold rims and lugs, white head; collapsed beat rings hidden inside the shell
    lathe('drum shell', [(0, -.06), (.14, -.06), (.14, .06), (0, .06)], 'drum', 'drum', seg=28, M=DRUM_M)
    lathe('drum head', [(0, .055), (.132, .055), (.132, .064), (0, .066)], 'drumhead', 'drum', seg=28, M=DRUM_M)
    for z in (-.058, .058):
        torus('drum rim %+.2f' % z, (0, 0, 0), .142, .012, 'gold', 'drum', seg=28, rseg=6, gloss=True)
        PARTS_last = C.PARTS[-1]; PARTS_last.data.transform(DRUM_M @ Matrix.Translation((0, 0, z)))
    for k in range(8):
        a = math.tau * k / 8 + math.pi / 8
        rbox('drum lug %d' % k, (0, 0, 0), (.022, .016, .05), 'gold', 'drum', bevel=.005, seg=1, gloss=True)
        C.PARTS[-1].data.transform(DRUM_M @ Matrix.Rotation(a, 4, 'Z') @ Matrix.Translation((.145, 0, 0)))
    lathe('drum band', [(0, -.012), (.1415, -.012), (.1415, .012), (0, .012)], 'drum_dark', 'drum', seg=28, M=DRUM_M)
    for nm, bone in (('beat ring', 'beat'), ('beat ring 2', 'beat2')):
        torus(nm, (0, 0, 0), .11, .013, 'ring', bone, seg=28, rseg=6, gloss=True)
        C.PARTS[-1].data.transform(DRUM_M)
    HM = Matrix.Translation(HEAD_PIVOT) @ Matrix.Scale(HEAD_SCALE, 4) @ Matrix.Translation(-HEAD_PIVOT)
    for ob in C.PARTS:
        if ob['part_bone'] in HEAD_BONES: ob.data.transform(HM)
        ob.data.transform(Matrix.Scale(GS, 4))
    arm = C.armature(TITLE + '_Rig', BONES)
    sk, parts = C.skin(ASSET, TITLE, arm)
    return arm, sk, parts

SCALED = {'eye_L', 'eye_R', 'mouth', 'beat', 'beat2', 'hair', 'chest'}
# ---- leg IK in the sagittal (y, z) plane; legs hang from the root and follow the hips' translation
HIP, KNEE, ANK = (0.0, .72 * GS), (.03 * GS, .44 * GS), (0.0, .14 * GS)
L1 = math.dist(HIP, KNEE); L2 = math.dist(KNEE, ANK)
phi = lambda v: math.atan2(v[1], v[0])
SOLE = [(-.15 * GS, 0.0), (.245 * GS, 0.0), (.26 * GS, .04), (-.16 * GS, .04)]

def ik(hip, ank):
    dy, dz = ank[0] - hip[0], ank[1] - hip[1]; D = min(math.hypot(dy, dz), (L1 + L2) * .9995); n = math.hypot(dy, dz)
    d = (dy / n, dz / n); along = (L1 * L1 - L2 * L2 + D * D) / (2 * D); h = math.sqrt(max(0.0, L1 * L1 - along * along))
    perp = (-d[1], d[0])
    if perp[0] < 0: perp = (-perp[0], -perp[1])
    K = (hip[0] + d[0] * along + perp[0] * h, hip[1] + d[1] * along + perp[1] * h)
    A = (hip[0] + d[0] * D, hip[1] + d[1] * D)
    th = phi((K[0] - hip[0], K[1] - hip[1])) - phi((KNEE[0] - HIP[0], KNEE[1] - HIP[1]))
    sh = phi((A[0] - K[0], A[1] - K[1])) - phi((ANK[0] - KNEE[0], ANK[1] - KNEE[1])) - th
    return math.degrees(th), math.degrees(sh)

def legs(p, targets, toe=(0.0, 0.0)):
    """targets: {'L': (y, z) ankle, 'R': ...}; the hip joints ride on the hips translation."""
    ht = C.add(p.get('hips'))['t']; out = dict(p)
    for i, s in enumerate('LR'):
        hip = (HIP[0] + ht[1], HIP[1] + ht[2]); th, sh = ik(hip, targets[s])
        out['thigh_' + s] = {'t': (0, ht[1], ht[2]), 'r': (th, 0, 0)}; out['shin_' + s] = {'r': (sh, 0, 0)}
        out['foot_' + s] = {'r': (-(th + sh) + toe[i], 0, 0)}
    return out

def lowest(p):
    lows = []
    for s in 'LR':
        ang = [C.add(p.get(b + s))['r'][0] for b in ('foot_', 'shin_', 'thigh_')]
        lows.append(C.chain_low(SOLE, [ANK, KNEE, HIP], ang, C.add(p.get('thigh_' + s))['t'][2]))
    return lows

def plant(p):
    out = dict(p)
    for s, low in zip('LR', lowest(p)):
        if low < 0: out['thigh_' + s] = C.add(p.get('thigh_' + s), {'t': (0, 0, -low + .0005)})
    return out

STAND = {'L': ANK, 'R': ANK}

def _rot(r): return Euler([math.radians(x) for x in r], 'XYZ').to_matrix()
def _spec_from(M3):
    e = M3.to_euler('XYZ'); return tuple(math.degrees(x) for x in e)

def fk(p):
    """Posed transforms without the shared rest basis: world(x bound to b) = P[b] @ (x - HEADS[b])."""
    P = {}
    for n, h, par in BONES:
        sp = C.add(p.get(n)); M = Matrix.Translation(sp['t']) @ _rot(sp['r']).to_4x4() @ Matrix.Diagonal(Vector(sp['s']) .to_4d())
        P[n] = (Matrix.Translation(HEADS[n]) if par is None else P[par] @ Matrix.Translation(HEADS[n] - HEADS[par])) @ M
    return P

def world(P, space, x):
    return P[space] @ (Vector(x) * GS - HEADS[space]) if space else Vector(x)

def _arm_solve(p, P, side, wrist, tip, pole):
    up, fo, ha = 'upperarm_' + side, 'forearm_' + side, 'hand_' + side
    Qc = P['chest'].to_3x3().normalized()
    S = P['chest'] @ (HEADS[up] - HEADS['chest'])
    u0 = HEADS[fo] - HEADS[up]; f0 = HEADS[ha] - HEADS[fo]; l1, l2 = u0.length, f0.length
    d = Vector(wrist) - S; D = min(max(d.length, 1e-4), (l1 + l2) * .999); dn = d.normalized()
    along = (l1 * l1 - l2 * l2 + D * D) / (2 * D); h = math.sqrt(max(0.0, l1 * l1 - along * along))
    pw = Qc @ Vector(pole); perp = (pw - dn * dn.dot(pw)).normalized()
    E = S + dn * along + perp * h; W = S + dn * D
    Rup = (Qc @ u0).rotation_difference(E - S).to_matrix() @ Qc
    Rfo = (Rup @ f0).rotation_difference(W - E).to_matrix() @ Rup
    hc = W + (W - E).normalized() * .045 * GS
    Rha = (Rfo @ SD[side]).rotation_difference(Vector(tip) - hc).to_matrix() @ Rfo
    out = dict(p)
    out[up] = {'r': _spec_from(Qc.inverted() @ Rup)}; out[fo] = {'r': _spec_from(Rup.inverted() @ Rfo)}; out[ha] = {'r': _spec_from(Rfo.inverted() @ Rha)}
    return out, hc + (Rha @ SD[side]) * (STICK_TIP + .01) * GS

def arm_ik(p, P, side, wrist, tip, pole):
    """Two-bone arm IK plus stick aim; the wrist target is nudged until the stick-tip ball centre sits on `tip`."""
    w = Vector(wrist)
    for _ in range(6):
        out, got = _arm_solve(p, P, side, w, tip, pole)
        err = Vector(tip) - got
        if err.length < 2e-4: break
        w = w + err
    return out

STRIKE = {'R': (.045, .25, .848), 'L': (-.045, .25, .848)}       # stick-tip ball centres resting on the drumhead (rest coordinates, bound to the drum)
def strike_pt(side, lift=0.0, back=0.0):
    x, y, z = STRIKE[side]; return ('drum', (x, y - back, z + lift))
DRUM_WRIST = {'R': ('chest', (.215, .1, .93)), 'L': ('chest', (-.215, .1, .93))}
POLE = {'R': (1, -.5, -.6), 'L': (-1, -.5, -.6)}

def arms(p, targets):
    """targets: {side: (wrist_space, wrist_xyz, tip_space, tip_xyz, pole)} or (world wrist, world tip, pole) after blending."""
    P = fk(p); out = dict(p)
    for side, tg in targets.items():
        if len(tg) == 5: w = world(P, tg[0], tg[1]); tp = world(P, tg[2], tg[3]); pole = tg[4]
        else: w, tp, pole = tg
        out = arm_ik(out, P, side, w, tp, pole)
    return out

def arm_keys(keys, t, p):
    """Blend arm targets between keys in world space under the current body pose, then solve."""
    P = fk(p)
    def resolve(k):
        return {sd: (world(P, *k[sd][0:2]), world(P, *k[sd][2:4]), Vector(k[sd][4])) for sd in k}
    if t <= keys[0][0]: tg = resolve(keys[0][1])
    elif t >= keys[-1][0]: tg = resolve(keys[-1][1])
    else:
        for (ta, ka), (tb, kb) in zip(keys, keys[1:]):
            if t <= tb:
                x = smooth((t - ta) / (tb - ta)); A = resolve(ka); B = resolve(kb)
                tg = {sd: (A[sd][0].lerp(B[sd][0], x), A[sd][1].lerp(B[sd][1], x), A[sd][2].lerp(B[sd][2], x)) for sd in A}
                break
    return arms(p, tg)

def drum_arms(lift_R=0.0, lift_L=0.0):
    return {sd: (DRUM_WRIST[sd][0], (DRUM_WRIST[sd][1][0], DRUM_WRIST[sd][1][1], DRUM_WRIST[sd][1][2] + .025 * lf), *strike_pt(sd, .16 * lf, .04 * lf), POLE[sd])
            for sd, lf in (('R', lift_R), ('L', lift_L))}

def idle(t):
    P_ = 2.0
    beat = lambda ph: max(0.0, math.cos(math.tau * (t / .5 + ph))) ** 3
    blink = 1 - .9 * bump(t, 1.6, 1.67, 1.74)
    bob = .5 - .5 * math.cos(math.tau * t / .5)
    p = {'hips': {'t': (0, 0, -.012 * bob), 'r': (0, 2 * wave(t, P_), 3 * wave(t, P_))}, 'chest': {'r': (2 * bob, 0, -2 * wave(t, P_))},
         'head': {'r': (-5 * bob, 4 * wave(t, P_, .25), 6 * wave(t, P_, .1))}, 'hair': {'r': (4 * bob, 0, 0), 's': (1, 1, 1 + .02 * bob)},
         'eye_L': {'s': (1, 1, blink)}, 'eye_R': {'s': (1, 1, blink)}, 'brow_R': {'t': (0, 0, .004 * bump(t, .7, 1.0, 1.3)), 'r': (0, -8 * bump(t, .7, 1.0, 1.3), 0)},
         'mouth': {'s': (1 + .1 * bump(t, .7, 1.0, 1.3), 1, 1)}, 'drum': {'r': (2 * bob, 0, 0)}}
    p = legs(p, STAND)
    return arms(p, drum_arms(1 - beat(0), 1 - beat(.5)))

def move(t):
    P_ = .8; u = t / P_
    tg = {}
    for s, off in (('L', 0.0), ('R', .5)):
        v = (u + off) % 1.0
        if v < .5: y = .13 - .26 * (v / .5); z = ANK[1]
        else:
            w = (v - .5) / .5; y = -.13 + .26 * smooth(w); z = ANK[1] + .11 * math.sin(math.pi * w)
        tg[s] = (y, z)
    bounce = abs(math.sin(math.tau * u)); sw = math.sin(math.tau * u)
    p = {'hips': {'t': (0, 0, -.06 + .03 * bounce), 'r': (-6, 3 * sw, 8 * sw)}, 'chest': {'r': (-4, 0, -10 * sw)},
         'head': {'r': (4 - 4 * bounce, 0, 4 * sw)}, 'hair': {'r': (-8 + 10 * bounce, 0, 0)},
         'drum': {'r': (5 * bounce - 2, 0, 0)}, 'brow_L': {'r': (0, 8, 0)}, 'brow_R': {'r': (0, -8, 0)}}
    p = legs(p, tg)
    # marching: sticks twirl up and tap on alternate steps
    a_R = .5 + .5 * math.sin(math.tau * u); a_L = .5 - .5 * math.sin(math.tau * u)
    return arms(p, drum_arms(.3 + .7 * a_R, .3 + .7 * a_L))

BODY_REST = {}
NOTICE = {'head': {'r': (-6, 0, 0)}, 'brow_L': {'r': (0, 14, 0), 't': (0, 0, -.004)}, 'brow_R': {'r': (0, -14, 0), 't': (0, 0, -.004)},
          'eye_L': {'s': (1, 1, .75)}, 'eye_R': {'s': (1, 1, .75)}, 'mouth': {'s': (1.3, 1, 1.2)}, 'hips': {'t': (0, -.02, -.02)}}
WIND = {'hips': {'t': (0, -.05, -.06), 'r': (10, 0, 0)}, 'spine': {'r': (8, 0, 0)}, 'chest': {'r': (8, 0, 0)}, 'head': {'r': (8, 0, 0)},
        'hair': {'r': (10, 0, 0), 's': (1, 1, 1.06)},
        'brow_L': {'r': (0, 18, 0), 't': (0, 0, -.005)}, 'brow_R': {'r': (0, -18, 0), 't': (0, 0, -.005)},
        'eye_L': {'s': (1, 1, .65)}, 'eye_R': {'s': (1, 1, .65)}, 'mouth': {'s': (1.5, 1, 1.5)}, 'drum': {'r': (-6, 0, 0)}}
SLAM = {'hips': {'t': (0, .1, -.11), 'r': (-16, 0, 0)}, 'spine': {'r': (-6, 0, 0)}, 'chest': {'r': (-6, 0, 0), 's': (1.04, 1.04, .97)},
        'head': {'r': (-4, 0, 0)}, 'hair': {'r': (-16, 0, 0), 's': (1.05, 1.05, .95)},
        'brow_L': {'r': (0, 22, 0)}, 'brow_R': {'r': (0, -22, 0)}, 'eye_L': {'s': (1.1, 1, 1.1)}, 'eye_R': {'s': (1.1, 1, 1.1)},
        'mouth': {'s': (1.6, 1, 2.2)}, 'drum': {'r': (8, 0, 0)}}
REBOUND = C.merge(SLAM, {'hips': {'t': (0, -.04, .04)}})
A_REST = drum_arms(.6, .6)
A_UP = {sd: ('chest', (.2 * (1 if sd == 'R' else -1), -.02, 1.5), 'chest', (.36 * (1 if sd == 'R' else -1), -.12, 1.75), (1 if sd == 'R' else -1, 0, .3)) for sd in 'RL'}
A_SLAM = {sd: (DRUM_WRIST[sd][0], (DRUM_WRIST[sd][1][0] * .85, DRUM_WRIST[sd][1][1] + .04, DRUM_WRIST[sd][1][2] - .01), *strike_pt(sd), POLE[sd]) for sd in 'RL'}
A_BOUNCE = {sd: (DRUM_WRIST[sd][0], (DRUM_WRIST[sd][1][0] * .9, DRUM_WRIST[sd][1][1] + .02, DRUM_WRIST[sd][1][2] + .06), *strike_pt(sd, .2, .05), POLE[sd]) for sd in 'RL'}

def attack(t):
    p = keyed([(0, BODY_REST), (.25, NOTICE), (.9, WIND), (1.12, WIND), (1.25, SLAM), (1.45, REBOUND), (1.62, SLAM), (2.0, BODY_REST)], t)
    p = C.merge(p, {'beat': {'s': (1 + 6.5 * bump(t, 1.22, 1.42, 1.62), 1 + 6.5 * bump(t, 1.22, 1.42, 1.62), 1)},
                    'beat2': {'s': (1 + 4.5 * bump(t, 1.58, 1.75, 1.95), 1 + 4.5 * bump(t, 1.58, 1.75, 1.95), 1)}})
    p = legs(p, STAND)
    p = arm_keys([(0, A_REST), (.25, A_REST), (.9, A_UP), (1.12, A_UP), (1.25, A_SLAM), (1.45, A_BOUNCE), (1.62, A_SLAM), (2.0, A_REST)], t, p)
    sh = bump(t, .9, 1.0, 1.12)
    if sh: p = C.merge(p, {'hand_L': {'r': (12 * sh * math.sin(t * 2 * math.pi * 14), 0, 0)}, 'hand_R': {'r': (12 * sh * math.sin(t * 2 * math.pi * 14 + 1.5), 0, 0)}})
    return p

REST_ARMS = {k: v for k, v in arms(legs({}, STAND), A_REST).items() if k.startswith(('upperarm', 'forearm', 'hand'))}
REST = C.merge(REST_ARMS)
HURT = {'hips': {'t': (0, -.06, -.02), 'r': (10, 0, 4)}, 'chest': {'r': (8, 0, 0)}, 'head': {'r': (16, -8, 10)}, 'hair': {'r': (14, 0, 0), 's': (1.04, 1.04, 1.06)},
        'upperarm_L': {'r': (0, 60, 0)}, 'upperarm_R': {'r': (0, -60, 0)}, 'forearm_L': {'r': (0, 40, 0)}, 'forearm_R': {'r': (0, -40, 0)},
        'eye_L': {'s': (1.05, 1, .14)}, 'eye_R': {'s': (1.05, 1, .14)}, 'mouth': {'s': (.8, 1, 2.0)},
        'brow_L': {'r': (0, -12, 0), 't': (0, 0, .006)}, 'brow_R': {'r': (0, 12, 0), 't': (0, 0, .006)}, 'drum': {'r': (-10, 0, 0)}}

HURT = C.merge(REST, HURT)

def hit(t):
    p = keyed([(0, REST), (.08, HURT), (.24, HURT), (.42, C.mix(HURT, REST, .75)), (.7, REST)], t)
    return legs(p, STAND)

DIZZY = {'eye_L': {'s': (1, 1, .12)}, 'eye_R': {'s': (1, 1, .12)}, 'mouth': {'s': (.7, 1, 1.6)},
         'brow_L': {'r': (0, -16, 0), 't': (0, 0, .006)}, 'brow_R': {'r': (0, 16, 0), 't': (0, 0, .006)}}
SIT = C.merge(DIZZY, {'hips': {'t': (0, -.16, -.565), 'r': (6, 0, 0)}, 'spine': {'r': (4, 0, 0)}, 'chest': {'r': (2, 0, 0)},
                      'head': {'r': (14, 22, 10)}, 'hair': {'r': (-8, 0, 0)},
                      'upperarm_L': {'r': (10, 20, 0)}, 'upperarm_R': {'r': (10, -20, 0)}, 'forearm_L': {'r': (20, 0, -10)}, 'forearm_R': {'r': (20, 0, 10)},
                      'hand_L': {'r': (-30, 40, 0)}, 'hand_R': {'r': (-30, -40, 0)}, 'drum': {'r': (12, 0, 0)},
                      'thigh_L': {'t': (0, -.16, -.565), 'r': (84, 0, -12)}, 'thigh_R': {'t': (0, -.16, -.565), 'r': (80, 0, 12)},
                      'shin_L': {'r': (-6, 0, 0)}, 'shin_R': {'r': (-14, 0, 0)}, 'foot_L': {'r': (-50, 0, 0)}, 'foot_R': {'r': (-40, 0, 0)}})
WOBBLE = C.merge(DIZZY, {'hips': {'t': (0, 0, -.03)}, 'head': {'r': (8, 0, 0)}, 'upperarm_L': {'r': (0, 30, 0)}, 'upperarm_R': {'r': (0, -30, 0)}})
DEFEAT_HOLD = 1.8

def defeat(t):
    spin = ramp(t, .18, .9); w = bump(t, .15, .55, 1.1)
    if t < 1.0:
        p = keyed([(0, REST), (.1, HURT), (.25, C.mix(HURT, WOBBLE, .6)), (1.0, WOBBLE)], t)
        p = C.merge(p, {'hips': {'r': (0, 8 * w * math.sin(t * 12), -360 * spin)}, 'head': {'r': (0, 0, 20 * w * math.sin(t * 10))}})
        p = legs(p, STAND)
        if spin > 0:
            for s in 'LR': p['thigh_' + s] = C.add(p['thigh_' + s], {'r': (0, 0, -360 * spin)})
        return p
    W = legs(C.merge(WOBBLE, {'hips': {'r': (0, 0, -360)}}), STAND)
    for s in 'LR': W['thigh_' + s] = C.add(W['thigh_' + s], {'r': (0, 0, -360)})
    p = keyed([(1.0, W), (1.45, SIT), (1.58, C.merge(SIT, {'hips': {'t': (0, 0, .03)}, 'thigh_L': {'t': (0, 0, .03)}, 'thigh_R': {'t': (0, 0, .03)}})), (DEFEAT_HOLD, SIT), (2.4, SIT)], t)
    return plant(p)

CLIPS = [('idle', 2.0, True, idle), ('move', .8, True, move), ('attack', 2.0, False, attack), ('hit', .7, False, hit), ('defeat', 2.4, False, defeat)]

if __name__ == '__main__':
    C.lease_ok()
    arm, sk, parts = build()
    rec = C.finalize(ASSET, arm, sk, parts, CLIPS, SCALED, ARGS, ['common.py', 'drummer.py'], [0.25, 1.12], DEFEAT_HOLD)
    if ARGS.get('posetest'):
        clip, tt = ARGS['posetest'].split(':'); fn = dict((n, f) for n, d, l, f in CLIPS)[clip]; pose = fn(float(tt))
        for pb in arm.pose.bones:
            if pb.name == 'root': continue
            tl, q, sl = C.basis_for(pose.get(pb.name, {})); pb.location = tl; pb.rotation_quaternion = q; pb.scale = sl
        bpy.context.view_layer.update(); rec['posetest'] = ARGS['posetest']; rec['lowest'] = lowest(pose)
    fam = {}
    for q in parts:
        k = ' '.join(w for w in q['name'].split(' ') if not w[0] in '+-0123456789')[:16]; fam[k] = fam.get(k, 0) + q['triangles']
    rec['tri_families'] = dict(sorted(fam.items(), key=lambda kv: -kv[1])[:12])
    print(json.dumps(rec))
