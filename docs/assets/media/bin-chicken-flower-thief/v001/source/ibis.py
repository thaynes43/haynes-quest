"""bin-chicken-flower-thief v001: original magical-garden parody minion.

A gangly white ibis with a long curved dark beak, black crest plumes and wing tips, big orange eyes, coral legs
and a teal satchel spilling raspberry flowers. Modelled geometry with flat per-part colours; rigid rig; five clips.
argv: stage=geo | stage=full [replace=draft]
"""
import bpy, sys, math, json, random
from mathutils import Vector
sys.path.insert(0, '/workspace/haynes-quest/action-worlds/minions-b/v001/source')
import common as C
from common import ellipsoid, rbox, tube, torus, leaf, TRS, keyed, bump, ramp, smooth, wave

ASSET = 'bin-chicken-flower-thief'; TITLE = 'Bin_Chicken_Flower_Thief'
ARGS = dict(a.split('=', 1) for a in sys.argv[1:] if '=' in a)
PALETTE = {
    'white': '#f6f4ef', 'white2': '#e6e2da', 'black': '#25222a', 'grey': '#55505c',
    'beak': '#3b3442', 'beak_base': '#2c2732', 'leg': '#ef8c6f', 'leg_dark': '#d8735c', 'claw': '#4a3b3b',
    'ring': '#2b2730', 'iris': '#f39a2c', 'pupil': '#15110f', 'shine': '#ffffff', 'brow': '#2b2730',
    'teal': '#2f8f8c', 'teal_dark': '#1f6b6a', 'strap': '#25706e', 'gold': '#d8a83c',
    'petal': '#d2386d', 'petal_lite': '#ea6893', 'centre': '#f3c54a', 'leaf': '#3f8a3a',
}

def flower(name, c, normal, r, bone, petals=6, col='petal'):
    n = Vector(normal).normalized(); u = n.cross(Vector((0, 0, 1)) if abs(n.z) < .9 else Vector((1, 0, 0))).normalized(); v = n.cross(u)
    for k in range(petals):
        a = math.tau * k / petals; d = u * math.cos(a) + v * math.sin(a)
        leaf('%s petal %d' % (name, k), Vector(c) + d * r * .15, d + n * .3, n.cross(d), r, r * .62, r * .22, col if k % 2 else 'petal_lite', bone, curl=-.25, n=4, seg=5, fullness=.6)
    ellipsoid(name + ' centre', Vector(c) + n * r * .12, (r * .32, r * .32, r * .32), 'centre', bone, seg=8, rings=6, gloss=True)

def build():
    C.reset('Bin Chicken Flower Thief v001', PALETTE); C.materials('Bin Chicken Flower Thief')
    # ---- body: big hunched egg tilted nose-up, puffed chest, short drooping tail
    ellipsoid('body', (0, -.03, .8), (.235, .33, .235), 'white', 'hips', seg=20, rings=14, rot=(12, 0, 0))
    ellipsoid('chest', (0, .16, .86), (.2, .18, .21), 'white', 'hips', seg=18, rings=12)
    for k, (x, d) in enumerate(((-.08, (-.25, -1, -.55)), (0, (0, -1, -.45)), (.08, (.25, -1, -.55)))):
        leaf('tail %d' % k, (x, -.28, .78), d, (1, 0, 0), .22, .08, .028, 'white2' if k != 1 else 'white', 'tail', curl=-.15, droop=.3, n=7, seg=8)
    # ---- thick S-neck, big head, long curved beak
    tube('neck', [(0, .14, .95), (0, .13, 1.06), (0, .1, 1.15), (0, .14, 1.24), (0, .2, 1.28)], [.1, .078, .068, .07, .08], 'white', 'neck_1', seg=14, n=14)
    ellipsoid('head', (0, .22, 1.31), (.105, .125, .11), 'white', 'head', seg=18, rings=12)
    ellipsoid('cheek tuft', (0, .14, 1.28), (.085, .07, .07), 'white', 'head', seg=12, rings=8)
    tube('beak', [(0, .32, 1.31), (0, .45, 1.295), (0, .58, 1.23), (0, .67, 1.12), (0, .71, 1.03)], [(.045, .04), (.033, .03), (.023, .02), (.014, .012), (0, 0)],
         'beak', 'head', seg=12, n=16, up=(1, 0, 0))
    ellipsoid('beak base', (0, .325, 1.308), (.056, .04, .05), 'beak_base', 'head', seg=12, rings=8)
    for s in (-1, 1):
        side = 'LR'[s > 0]; c = Vector((.084 * s, .27, 1.345)); yaw = -40 * s
        R = TRS(rot=(0, 0, yaw)).to_3x3()
        ellipsoid('eye ring %+d' % s, c, (.05, .025, .05), 'ring', 'eye_' + side, seg=14, rings=8, rot=(0, 0, yaw))
        ellipsoid('iris %+d' % s, c + R @ Vector((0, .015, 0)), (.042, .016, .042), 'iris', 'eye_' + side, seg=14, rings=8, rot=(0, 0, yaw), gloss=True)
        ellipsoid('pupil %+d' % s, c + R @ Vector((-.006 * s, .028, -.002)), (.02, .01, .023), 'pupil', 'eye_' + side, seg=10, rings=6, rot=(0, 0, yaw), gloss=True)
        ellipsoid('shine %+d' % s, c + R @ Vector((.01 * s, .034, .014)), (.011, .006, .011), 'shine', 'eye_' + side, seg=8, rings=6, gloss=True)
        tube('brow %+d' % s, [c + R @ Vector((.05 * s, .0, .046)), c + R @ Vector((0, .02, .06)), c + R @ Vector((-.042 * s, .028, .042))],
             [(.01, .013), (.013, .017), (.01, .012)], 'brow', 'eye_' + side, seg=8, up=(0, 1, 0))
    for k, pts in enumerate(([(0, .18, 1.41), (0, .08, 1.46), (0, -.02, 1.46)], [(-.035, .16, 1.4), (-.07, .06, 1.43), (-.11, -.02, 1.41)],
                             [(.035, .16, 1.4), (.07, .06, 1.43), (.11, -.02, 1.41)], [(0, .13, 1.37), (0, .03, 1.39), (0, -.06, 1.35)])):
        tube('crest %d' % k, pts, [.024, .019, 0], 'black', 'crest', seg=8, n=8)
    # ---- wings: layered white coverts and secondaries, long black primaries, half open and hanging
    for s in (-1, 1):
        side = 'LR'[s > 0]; sh = Vector((.2 * s, .08, .93)); el = sh + Vector((.2 * s, -.3, -.22))
        leaf('wing shoulder %+d' % s, sh, (.4 * s, -.62, -.45), (0, 0, 1), .36, .13, .034, 'white', 'wing_' + side, curl=.12, droop=.3, n=9, seg=8)
        for k in range(3):
            base = sh + (el - sh) * (.15 + .3 * k) + Vector((0, 0, -.02))
            leaf('wing covert %+d.%d' % (s, k), base, (.22 * s, -.5 - .08 * k, -.82), (s, -.3, 0), .22, .09, .025, 'white', 'wing_' + side, curl=.12, n=6, seg=6)
        for k in range(4):
            base = sh + (el - sh) * (.1 + .27 * k) + Vector((0, -.02, -.1))
            leaf('wing secondary %+d.%d' % (s, k), base, (.18 * s, -.42 - .1 * k, -.88), (s, -.3, 0), .28, .078, .021, 'white2' if k % 2 else 'white', 'wing_' + side, curl=.1, n=6, seg=6)
        for k in range(5):
            d = Vector((.32 * s, -.65 + .12 * k, -.72 + .08 * k)); base = el + Vector((.015 * s * k, .025 * k, .012 * k))
            leaf('wing primary %+d.%d' % (s, k), base, d, (s * .2, .8, .2), .4 - .03 * k, .068, .019, 'black', 'wingtip_' + side, curl=.1, droop=.2, n=7, seg=6)
        leaf('wing primary root %+d' % s, el + Vector((-.05 * s, .03, .05)), (.35 * s, -.55, -.62), (0, 0, 1), .18, .11, .028, 'white', 'wingtip_' + side, n=6, seg=8)
    # ---- legs: feathered thigh, coral tibia, backward ankle, tarsus and splayed toes
    for s in (-1, 1):
        side = 'LR'[s > 0]; x = .09 * s
        ellipsoid('thigh %+d' % s, (x, -.02, .59), (.07, .085, .09), 'white', 'thigh_' + side, seg=12, rings=8)
        tube('tibia %+d' % s, [(x, -.02, .56), (x * 1.03, -.05, .42), (x * 1.06, -.075, .29)], [.034, .031, .029], 'leg', 'thigh_' + side, seg=10)
        ellipsoid('ankle %+d' % s, (x * 1.06, -.075, .29), .037, 'leg_dark', 'shin_' + side, seg=10, rings=6)
        tube('tarsus %+d' % s, [(x * 1.06, -.075, .29), (x * 1.06, -.04, .16), (x * 1.06, 0, .04)], [.03, .027, .028], 'leg', 'shin_' + side, seg=10)
        ft = Vector((x * 1.06, 0, .028))
        for k, (dx, dy, L) in enumerate(((-.55, .85, .14), (0, 1, .16), (.55, .85, .14), (0, -1, .07))):
            d = Vector((dx, dy, 0)).normalized(); tip = ft + d * L + Vector((0, 0, -.017))
            tube('toe %+d.%d' % (s, k), [ft, ft + d * L * .55 + Vector((0, 0, -.007)), tip], [.021, .016, .01], 'leg', 'foot_' + side, seg=6, n=6)
            tube('claw %+d.%d' % (s, k), [tip, tip + d * .024 + Vector((0, 0, -.004))], [.008, 0], 'claw', 'foot_' + side, seg=5)
    # ---- big teal satchel at the front-left spilling raspberry flowers; strap over the right shoulder
    bc = Vector((-.2, .17, .57)); Rb = TRS(rot=(0, 0, -14)).to_3x3()
    rbox('satchel', bc, (.11, .27, .24), 'teal', 'bag', bevel=.036, seg=3, rot=(0, 0, -14))
    rbox('satchel flap', bc + Rb @ Vector((-.02, .0, .065)), (.085, .28, .12), 'teal_dark', 'bag', bevel=.03, seg=2, rot=(0, -16, -14))
    for dy in (-.07, .07):
        ellipsoid('satchel button %+.2f' % dy, bc + Rb @ Vector((-.068, dy, .02)), .019, 'gold', 'bag', seg=10, rings=6, gloss=True)
    tube('strap', [(-.17, .25, .66), (-.08, .3, .86), (.08, .23, 1.02), (.2, .02, 1.03), (.13, -.23, .95), (-.08, -.18, .8), (-.2, .06, .66)],
         [(.024, .008)] * 7, 'strap', 'hips', seg=8, n=28, up=(0, 0, 1))
    for k, (dy, dz, nx, ny, r) in enumerate(((.085, .16, -.35, .6, .078), (-.06, .175, -.55, -.2, .072), (.15, .115, .1, .9, .064),
                                             (.0, .19, -.25, .2, .082), (-.12, .135, -.3, -.7, .064), (.04, .135, -.95, .3, .068))):
        c = bc + Rb @ Vector((-.012, dy, dz)); flower('bag flower %d' % k, c, (nx, ny, 1), r, 'bag')
        if k % 2 == 0: leaf('bag leaf %d' % k, bc + Rb @ Vector((-.012, dy * .8, .1)), (nx, ny, .7), (1, 0, 0), .1, .04, .012, 'leaf', 'bag', n=5, seg=6)
    flower('loose flower 1', bc + Vector((-.08, .14, -.17)), (-.4, .5, .6), .06, 'petal_1')
    flower('loose flower 2', bc + Vector((-.11, .04, -.34)), (-.5, -.2, .7), .055, 'petal_2', petals=5)
    bones = [('root', (0, 0, 0), None), ('hips', (0, -.02, .74), 'root'), ('tail', (0, -.27, .77), 'hips'),
             ('neck_1', (0, .14, .95), 'hips'), ('neck_2', (0, .1, 1.13), 'neck_1'), ('head', (0, .17, 1.26), 'neck_2'),
             ('crest', (0, .13, 1.39), 'head'), ('eye_L', (-.084, .27, 1.345), 'head'), ('eye_R', (.084, .27, 1.345), 'head'),
             ('wing_L', (-.2, .08, .93), 'hips'), ('wingtip_L', (-.4, -.22, .71), 'wing_L'),
             ('wing_R', (.2, .08, .93), 'hips'), ('wingtip_R', (.4, -.22, .71), 'wing_R'),
             ('bag', (-.19, .16, .72), 'hips'), ('petal_1', tuple(bc + Vector((-.08, .14, -.17))), 'bag'), ('petal_2', tuple(bc + Vector((-.11, .04, -.34))), 'bag'),
             ('thigh_L', (-.09, -.02, .57), 'root'), ('shin_L', (-.095, -.075, .29), 'thigh_L'), ('foot_L', (-.095, 0, .033), 'shin_L'),
             ('thigh_R', (.09, -.02, .57), 'root'), ('shin_R', (.095, -.075, .29), 'thigh_R'), ('foot_R', (.095, 0, .033), 'shin_R')]
    arm = C.armature(TITLE + '_Rig', bones)
    sk, parts = C.skin(ASSET, TITLE, arm)
    return arm, sk, parts

SCALED = {'hips', 'eye_L', 'eye_R', 'petal_1', 'petal_2', 'crest'}
# ---- feet on the floor: FK of each leg's toe/heel outline; ground() keeps the lower foot exactly on the floor and
# moves the body with it (natural bob); plant() only lifts (for sitting poses).
FOOT_PTS = [(.16, .001), (.183, .003), (-.07, .001), (-.093, .003), (0, .007), (.118, .001), (.137, .003)]
PIVOTS = [(0, .033), (-.075, .29), (-.02, .57)]

def leg_low(p, side):
    ang = [C.add(p.get(b + side))['r'][0] for b in ('foot_', 'shin_', 'thigh_')]
    return C.chain_low(FOOT_PTS, PIVOTS, ang, C.add(p.get('thigh_' + side))['t'][2])

def ground(p):
    dz = -min(leg_low(p, 'L'), leg_low(p, 'R'))
    return C.merge(p, {'hips': {'t': (0, 0, dz)}, 'thigh_L': {'t': (0, 0, dz)}, 'thigh_R': {'t': (0, 0, dz)}})

def plant(p):
    out = dict(p)
    for s in 'LR':
        low = leg_low(p, s)
        if low < 0: out['thigh_' + s] = C.add(p.get('thigh_' + s), {'t': (0, 0, -low + .0005)})
    return out

def idle(t):
    P = 3.0
    breathe = .5 - .5 * math.cos(math.tau * t / 1.5)
    look = bump(t, .5, .9, 1.5) - bump(t, 1.7, 2.1, 2.7)
    blink = 1 - .9 * bump(t, 2.2, 2.27, 2.34)
    return {'hips': {'r': (1.5 * breathe, 0, 2 * wave(t, P)), 's': (1 + .012 * breathe, 1 + .006 * breathe, 1 + .012 * breathe)},
            'neck_1': {'r': (3 * wave(t, 1.5, .1), 0, 0)}, 'neck_2': {'r': (-4 * wave(t, 1.5, .2), 0, 6 * look)},
            'head': {'r': (5 * wave(t, 1.5, .3), 14 * look, 16 * look)}, 'crest': {'r': (-6 * wave(t, 1.5, .35), 0, 0)},
            'eye_L': {'s': (1, 1, blink)}, 'eye_R': {'s': (1, 1, blink)}, 'tail': {'r': (0, 0, 6 * wave(t, 1.0))},
            'wing_L': {'r': (0, -2 * breathe, 0)}, 'wing_R': {'r': (0, 2 * breathe, 0)},
            'wingtip_L': {'r': (0, 0, 3 * wave(t, 1.5))}, 'wingtip_R': {'r': (0, 0, -3 * wave(t, 1.5))},
            'bag': {'r': (0, 4 * wave(t, 1.5, .2), 0)}, 'petal_1': {'r': (8 * wave(t, 1.0), 0, 0)}, 'petal_2': {'r': (0, 10 * wave(t, 1.5), 0), 't': (0, 0, .01 * wave(t, 1.5))}}

def gait(u):
    """One leg's (thigh, shin, foot) rx over a stride phase u in [0, 1): stance then a high-stepping swing."""
    u %= 1.0
    if u < .55:
        th = 22 - 46 * (u / .55); sh = 0
        return th, sh, -th
    s = (u - .55) / .45
    th = -24 + 46 * smooth(s); sh = -62 * math.sin(math.pi * s)
    return th, sh, -th - sh - 25 * math.sin(math.pi * s)

def move(t):
    P = .9; u = t / P
    out = {}
    for side, off in (('L', 0.0), ('R', .5)):
        th, sh, ft = gait(u + off)
        out['thigh_' + side] = {'r': (th, 0, 0)}; out['shin_' + side] = {'r': (sh, 0, 0)}; out['foot_' + side] = {'r': (ft, 0, 0)}
    bob = math.sin(math.tau * 2 * u)
    out.update({'hips': {'r': (-6, 0, 5 * math.sin(math.tau * u)), 't': (0, 0, 0)},
                'neck_1': {'r': (-10 + 9 * bob, 0, 0)}, 'neck_2': {'r': (6 - 12 * bob, 0, 0)}, 'head': {'r': (4 + 6 * bob, 0, 0)},
                'crest': {'r': (8 * math.sin(math.tau * 2 * u - .8), 0, 0)}, 'tail': {'r': (6 * bob, 0, 0)},
                'wing_L': {'r': (0, -8 - 6 * abs(bob), 0)}, 'wing_R': {'r': (0, 8 + 6 * abs(bob), 0)},
                'wingtip_L': {'r': (0, 0, 8 * bob)}, 'wingtip_R': {'r': (0, 0, -8 * bob)},
                'bag': {'r': (0, 10 * math.sin(math.tau * u), 0)}, 'petal_1': {'r': (14 * bob, 0, 0)}, 'petal_2': {'r': (0, 12 * bob, 0)}})
    return out

REST = {}
NOTICE = {'neck_2': {'r': (8, 0, 0)}, 'head': {'r': (-6, 0, 0)}, 'crest': {'r': (-24, 0, 0), 's': 1.15},
          'eye_L': {'s': (1.05, 1, .7)}, 'eye_R': {'s': (1.05, 1, .7)}, 'wing_L': {'r': (0, -10, 0)}, 'wing_R': {'r': (0, 10, 0)}}
WIND = {'hips': {'r': (14, 0, 0), 't': (0, -.04, 0), 's': (1.06, 1.04, 1.06)}, 'neck_1': {'r': (26, 0, 0)}, 'neck_2': {'r': (-38, 0, 0)},
        'head': {'r': (18, 0, 0)}, 'crest': {'r': (-30, 0, 0), 's': 1.25}, 'tail': {'r': (-18, 0, 0)},
        'wing_L': {'r': (0, -42, -18)}, 'wing_R': {'r': (0, 42, 18)}, 'wingtip_L': {'r': (0, -22, 0)}, 'wingtip_R': {'r': (0, 22, 0)},
        'thigh_L': {'r': (14, 0, 0)}, 'thigh_R': {'r': (14, 0, 0)}, 'shin_L': {'r': (-28, 0, 0)}, 'shin_R': {'r': (-28, 0, 0)},
        'foot_L': {'r': (14, 0, 0)}, 'foot_R': {'r': (14, 0, 0)}, 'eye_L': {'s': (1.1, 1, .55)}, 'eye_R': {'s': (1.1, 1, .55)},
        'bag': {'r': (0, -10, 0)}}
CONTACT = {'hips': {'r': (-20, 0, 0), 't': (0, .16, 0), 's': (.98, 1.04, .98)}, 'neck_1': {'r': (-40, 0, 0)}, 'neck_2': {'r': (18, 0, 0)},
           'head': {'r': (-8, 0, 0)}, 'crest': {'r': (22, 0, 0), 's': 1.1}, 'tail': {'r': (16, 0, 0)},
           'wing_L': {'r': (0, -30, 34)}, 'wing_R': {'r': (0, 30, -34)}, 'wingtip_L': {'r': (0, 10, 0)}, 'wingtip_R': {'r': (0, -10, 0)},
           'thigh_L': {'r': (-12, 0, 0), 't': (0, .16, 0)}, 'thigh_R': {'r': (8, 0, 0), 't': (0, .16, 0)}, 'shin_L': {'r': (-6, 0, 0)}, 'shin_R': {'r': (-10, 0, 0)},
           'foot_L': {'r': (18, 0, 0)}, 'foot_R': {'r': (2, 0, 0)}, 'eye_L': {'s': (1.15, 1, 1.15)}, 'eye_R': {'s': (1.15, 1, 1.15)},
           'bag': {'r': (0, 18, 0)}, 'petal_1': {'t': (.05, .45, .22), 'r': (0, 0, 120)}, 'petal_2': {'t': (.02, .55, .4), 'r': (0, 0, -160)}}
FOLLOW = C.merge(CONTACT, {'hips': {'r': (6, 0, 0), 't': (0, -.03, 0)}, 'neck_1': {'r': (10, 0, 0)}, 'head': {'r': (8, 0, 0)},
                           'petal_1': {'t': (.02, .25, -.3)}, 'petal_2': {'t': (.0, .3, -.4)}})

def attack(t):
    keys = [(0, REST), (.3, NOTICE), (.95, WIND), (1.12, WIND), (1.25, CONTACT), (1.45, FOLLOW), (2.0, REST)]
    p = keyed(keys, t)
    # thrown flowers shrink away after the contact and pop back into the satchel by the end
    vis = 1 - bump(t, 1.3, 1.6, 1.95) * .97
    p = C.merge(p, {'petal_1': {'s': vis}, 'petal_2': {'s': vis}})
    sh = bump(t, .94, 1.04, 1.13)
    if sh: p = C.merge(p, {'head': {'r': (0, 0, 3 * sh * math.sin(t * 2 * math.pi * 16))}, 'crest': {'r': (4 * sh * math.sin(t * 2 * math.pi * 13), 0, 0)}})
    return ground(p)

HURT = {'hips': {'r': (12, 0, 0), 't': (0, -.07, 0), 's': (1.1, 1.06, 1.1)}, 'neck_1': {'r': (10, 0, 6)}, 'neck_2': {'r': (-4, 0, 0)},
        'head': {'r': (4, 12, 10)}, 'crest': {'r': (-30, 0, 0), 's': 1.3}, 'tail': {'r': (-20, 0, 0)},
        'wing_L': {'r': (0, -55, 0)}, 'wing_R': {'r': (0, 55, 0)}, 'wingtip_L': {'r': (0, -25, 0)}, 'wingtip_R': {'r': (0, 25, 0)},
        'eye_L': {'s': (1.1, 1, .15)}, 'eye_R': {'s': (1.1, 1, .15)}, 'thigh_L': {'r': (10, 0, 0)}, 'thigh_R': {'r': (10, 0, 0)},
        'bag': {'r': (0, 22, 0)}, 'petal_1': {'t': (-.04, 0, .12)}, 'petal_2': {'t': (-.06, .02, .16)}}

def hit(t):
    p = keyed([(0, REST), (.08, HURT), (.22, HURT), (.42, C.mix(HURT, REST, .75)), (.7, REST)], t)
    return ground(p)

DIZZY = {'eye_L': {'s': (1, 1, .12)}, 'eye_R': {'s': (1, 1, .12)}, 'crest': {'r': (20, 0, 0)}}
SIT = C.merge(DIZZY, {'hips': {'r': (-4, 0, 6), 't': (0, .02, -.33)}, 'neck_1': {'r': (-46, 0, 18)}, 'neck_2': {'r': (-22, 0, 20)},
                      'head': {'r': (14, 24, 18)}, 'tail': {'r': (14, 0, 0)},
                      'wing_L': {'r': (0, 30, -12)}, 'wing_R': {'r': (0, -26, 12)}, 'wingtip_L': {'r': (0, 15, 0)}, 'wingtip_R': {'r': (0, -15, 0)},
                      'thigh_L': {'t': (0, .02, -.33), 'r': (-75, 0, 18)}, 'thigh_R': {'t': (0, .02, -.33), 'r': (-75, 0, -18)},
                      'shin_L': {'r': (150, 0, 0)}, 'shin_R': {'r': (150, 0, 0)}, 'foot_L': {'r': (-75, 0, 0)}, 'foot_R': {'r': (-75, 0, 0)},
                      'bag': {'r': (0, 30, 0)}, 'petal_1': {'t': (-.1, .08, -.1)}, 'petal_2': {'t': (-.06, .2, .045)}})
WOBBLE = C.merge(DIZZY, {'hips': {'t': (0, 0, -.04)}, 'neck_2': {'r': (10, 0, 0)}, 'head': {'r': (10, 0, 0)},
                         'wing_L': {'r': (0, 10, 0)}, 'wing_R': {'r': (0, -10, 0)}})
DEFEAT_HOLD = 1.8

def defeat(t):
    p = keyed([(0, REST), (.1, HURT), (.25, C.mix(HURT, WOBBLE, .6)), (.9, WOBBLE), (1.45, SIT), (1.58, C.merge(SIT, {'hips': {'t': (0, 0, .03)}, 'thigh_L': {'t': (0, 0, .03)}, 'thigh_R': {'t': (0, 0, .03)}})), (DEFEAT_HOLD, SIT), (2.4, SIT)], t)
    w = bump(t, .2, .55, 1.1)
    p = C.merge(p, {'hips': {'r': (0, 10 * w * math.sin(t * 11), 0)}, 'neck_2': {'r': (0, 0, 25 * w * math.sin(t * 9))}, 'head': {'r': (0, 0, 20 * w * math.sin(t * 9 + 1))}})
    return plant(p) if t > .95 else ground(p)

CLIPS = [('idle', 3.0, True, lambda t: ground(idle(t))), ('move', .9, True, lambda t: ground(move(t))), ('attack', 2.0, False, attack),
         ('hit', .7, False, hit), ('defeat', 2.4, False, defeat)]

if __name__ == '__main__':
    C.lease_ok()
    arm, sk, parts = build()
    rec = C.finalize(ASSET, arm, sk, parts, CLIPS, SCALED, ARGS, ['common.py', 'ibis.py'], [0.3, 1.12], DEFEAT_HOLD)
    fam = {}
    for q in parts:
        k = ' '.join(w for w in q['name'].split(' ') if not w[0] in '+-0123456789')[:18]; fam[k] = fam.get(k, 0) + q['triangles']
    rec['tri_families'] = dict(sorted(fam.items(), key=lambda kv: -kv[1])[:12])
    print(json.dumps(rec))
