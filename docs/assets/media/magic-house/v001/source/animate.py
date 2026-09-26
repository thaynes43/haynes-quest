"""WO111 magic-house v001: five in-place clips on a fixed floor root, 60 fps sampled, linear keys.

idle   2.4 s loop  tiles bob in a ripple, lids blink out of step, the house sways on its stumps, candle flickers
move   1.0 s loop  waddle-hop on the stumps, doors flap, tongue swings, tiles bounce with lag
attack 2.0 s       shimmy -> crouch with the tiles raised high (held warning 0.60-1.05 s) -> hop and THROW the six
                   tiles, which land in a fan 1.1-1.9 m in front at contact 1.25 s (the tongue slaps forward) ->
                   the tiles hop, then fly back to their slots by 1.90 s
hit    0.7 s       shutters slam shut and spring open, the roof pops like a lid, tiles jump, jelly wobble
defeat 2.4 s       surprise -> the magic drains: tiles drop into their empty slots, the candle shrinks to an ember,
                   lids and shutters close, the doors pout half shut, the house slumps with splayed stumps, the roof
                   droops forward like a floppy hat and the tongue flops out; exactly static from 1.80 s
No root motion: the root bone and the armature/scene root never move. Rotations use parent-rest world axes at each
bone head (Blender +Z up, +Y forward, +X = the house's right).
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler, Quaternion

ROOT = Path('/workspace/haynes-quest/family-eras/magic-house/v001')
OWNER = 'claude-opus-5-5 magic-house model subagent (session_016rSS1uA4XaroamTk1brNXn) on blender-authoring-2'
sc = bpy.context.scene
assert sc.get('work_order') == 'WO111' and sc.get('scene_lease') == 'active' and sc.get('asset_id') == 'magic-house' and sc.get('scene_owner') == OWNER
RIG = json.loads((ROOT / 'source/rig-rest.json').read_text())
arm = bpy.data.objects['Magic_House_Rig']; skin = bpy.data.objects['Magic_House_Skin']
FPS = 60
CLIPS = [('idle', 2.4, True), ('move', 1.0, True), ('attack', 2.0, False), ('hit', 0.7, False), ('defeat', 2.4, False)]
CONTACT = 1.25; HOLD = (0.60, 1.05); DEFEAT_HELD = 1.80
TAU = math.tau
TILE_BONES = ['tile_1', 'tile_2', 'tile_3', 'tile_4', 'tile_5', 'ridge_tile']
M4 = lambda rows: Matrix([list(r) for r in rows])
TILE_FRAME = {b: M4(RIG['tiles'][b]['frame']) for b in TILE_BONES}
TILE_SLOT = {b: M4(RIG['tiles'][b]['slot']) for b in TILE_BONES}
LID_CLOSE = {b: RIG['lids'][b]['close_scale'] for b in ('lid_R', 'lid_L')}
LID_TILT = {b: RIG['lids'][b]['tilt'] for b in ('lid_R', 'lid_L')}
def lid_pose(lid, close=0.0, wide=0.0):
    """close 0..1: swing toward the wall and stretch down over the eye (the pupil lifts 6 cm behind it).
    wide 0..1: swing up/out like an awning and shorten."""
    return dict(rot=v3(-0.15 * close + 0.30 * wide, 0, 0), scale=v3(1, 1 + (LID_CLOSE[lid] - 1) * close - 0.38 * wide, 1))
SH_SIGN = RIG['shutter_close_sign']; DOOR_SIGN = RIG['door_close_sign']
# Where the thrown tiles land (Blender coords; flat on the floor, bottoms 2 mm above it) and their yaw.
LAND = {'tile_1': ((0.40, 1.90), 1.9), 'tile_2': ((-0.95, 1.45), -0.8), 'tile_3': ((0.95, 1.50), 0.6), 'tile_4': ((-0.42, 1.85), 2.6),
        'tile_5': ((1.30, 1.05), -0.3), 'ridge_tile': ((0.0, 1.55), 1.57)}
TILE_PHASE = {b: k * 1.1 for k, b in enumerate(TILE_BONES)}

def ss(t): t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)
def ramp(T, a, b): return ss((T - a) / (b - a)) if b > a else float(T >= a)
def bell(T, c, w): return ss(1 - abs(T - c) / w)
def keys(T, pts):
    """Piecewise smoothstep through (time, value) points; values may be tuples."""
    if T <= pts[0][0]: return pts[0][1]
    for (a, x), (b, y) in zip(pts, pts[1:]):
        if T <= b:
            u = ss((T - a) / (b - a))
            return tuple(xi + (yi - xi) * u for xi, yi in zip(x, y)) if isinstance(x, tuple) else x + (y - x) * u
    return pts[-1][1]
def v3(*a): return tuple(float(x) for x in a)

BONES = [pb.name for pb in arm.pose.bones]
REST_M = {pb.name: pb.bone.matrix_local.copy() for pb in arm.pose.bones}

def apply_all(P):
    """P[bone] = dict(rot, loc, lrot, scale, world). Returns the armature-space pose matrices."""
    M = {}
    for pb in arm.pose.bones:
        spec = P.get(pb.name, {}); rest = REST_M[pb.name]
        if pb.parent:
            Pm = M[pb.parent.name]; Pr = REST_M[pb.parent.name]; base = Pm @ Pr.inverted() @ rest; pr = (Pm @ Pr.inverted()).to_3x3()
        else: base = rest.copy(); pr = Matrix.Identity(3)
        if 'world' in spec: target = spec['world'](M)
        else:
            R = pr @ Euler(spec.get('rot', (0, 0, 0))).to_matrix() @ pr.inverted()
            target = Matrix.Translation(base.translation + pr @ Vector(spec.get('loc', (0, 0, 0)))) @ R.to_4x4() @ base.to_3x3().to_4x4()
        if 'lrot' in spec: target = target @ Euler(spec['lrot']).to_matrix().to_4x4()
        if 'scale' in spec: target = target @ Matrix.Diagonal((*spec['scale'], 1.0))
        pb.matrix_basis = base.inverted() @ target; M[pb.name] = target
    return M

def tile_world(frame):
    """Posed bone matrix that puts the tile's mesh frame at `frame` (armature space)."""
    return lambda bone: frame @ TILE_FRAME[bone].inverted() @ REST_M[bone]

def land_frame(bone, extra_xy=(0, 0), lift=0.0, yaw_add=0.0):
    (x, y), yaw = LAND[bone]
    return Matrix.Translation((x + extra_xy[0], y + extra_xy[1], 0.012 + lift)) @ Euler((0, 0, yaw + yaw_add)).to_matrix().to_4x4()

def lerp_frame(A, B, u, apex=0.0, tumble_axis=None, tumble=0.0, ctrl=None):
    la, ra, _ = A.decompose(); lb, rb, _ = B.decompose()
    if ctrl is not None: loc = (1 - u) ** 2 * la + 2 * u * (1 - u) * Vector(ctrl) + u * u * lb  # quadratic Bezier over the roof/eaves
    else: loc = la.lerp(lb, u) + Vector((0, 0, apex * 4 * u * (1 - u)))
    q = ra.slerp(rb, u)
    if tumble_axis is not None: q = Quaternion(Vector(tumble_axis).normalized(), tumble * u) @ q
    return Matrix.Translation(loc) @ q.to_matrix().to_4x4()

# ------------------------------------------------------------------ clip choreography
def idle(T):
    t = T / 2.4; ph = TAU * t; P = {}
    P['body'] = dict(rot=v3(0.008 * math.sin(2 * ph), 0.022 * math.sin(ph), 0.006 * math.sin(ph + 1.0)), loc=v3(0, 0, 0.010 * (1 - math.cos(2 * ph)) / 2))
    P['roof'] = dict(rot=v3(0, -0.010 * math.sin(ph - 0.5), 0), loc=v3(0, 0, 0.006 * (1 - math.cos(2 * ph - 0.8)) / 2))
    P['chimney'] = dict(rot=v3(0.012 * math.sin(2 * ph + 0.3), 0.022 * math.sin(ph + 0.8), 0))
    for b in TILE_BONES:
        k = TILE_PHASE[b]; amp = 0.060 if b == 'ridge_tile' else 0.042
        P[b] = dict(loc=v3(0, 0, amp * math.sin(2 * ph - k)), rot=v3(0.10 * math.sin(2 * ph - k + 1.0), 0.08 * math.sin(ph - k), 0.14 * math.sin(ph - k + 0.5)))
    blink = {'L': bell(t, 0.30, 0.06), 'R': bell(t, 0.66, 0.06)}
    for side in ('R', 'L'): P['lid_' + side] = lid_pose('lid_' + side, close=blink[side])
    glance = 0.030 * math.sin(ph) - 0.025 * bell(t, 0.52, 0.12)
    for side in ('R', 'L'): P['pupil_' + side] = dict(loc=v3(glance, 0, 0.008 * math.sin(2 * ph) + 0.06 * blink[side]))
    for b, sg in SH_SIGN.items(): P[b] = dict(rot=v3(0, 0, sg * 0.06 * math.sin(2 * ph + (0.8 if b.endswith('in') else 0))))
    for b, sg in DOOR_SIGN.items(): P[b] = dict(rot=v3(0, 0, sg * 0.05 * (1 + math.sin(2 * ph + 1 + (0 if sg > 0 else 1.2))) / 2))
    P['tongue_2'] = dict(rot=v3(0.05 * (1 + math.sin(2 * ph)) / 2, 0, 0)); P['tongue_3'] = dict(rot=v3(0.08 * math.sin(2 * ph - 0.8), 0, 0.05 * math.sin(ph)))
    fl = 1 + 0.07 * math.sin(6 * ph) + 0.035 * math.sin(10 * ph + 1); P['candle'] = dict(scale=v3(fl, fl, fl))
    butterflies(P, ph, flaps=8)
    return P

def butterflies(P, ph, flaps, settle=0.0):
    for k, (dx, dz, off) in enumerate(((0.035, 0.045, 0.0), (0.03, 0.05, 2.1))):
        n = k + 1; s = 1 - settle
        P['butterfly_%d' % n] = dict(loc=v3(s * dx * math.sin(ph + off) + 0.08 * settle * (1 if n == 1 else -1), s * 0.02 * math.sin(2 * ph + off) + 0.14 * settle, s * dz * math.sin(2 * ph + off + 1) + 0.04 * settle),
                                    rot=v3(0, 0, s * 0.25 * math.sin(ph + off)))
        a = (0.45 + 0.55 * math.sin(flaps * ph + off)) * s + 1.25 * settle
        P['wing_%d_R' % n] = dict(lrot=v3(0, -a, 0)); P['wing_%d_L' % n] = dict(lrot=v3(0, a, 0))

def move(T):
    t = T / 1.0; ph = TAU * t; P = {}
    for side, off in (('R', 0.0), ('L', math.pi)):
        lift = 0.10 * max(0.0, math.sin(ph + off)); swing = -0.07 * math.cos(ph + off)
        P['leg_' + side] = dict(loc=v3(0, swing, lift), rot=v3(1.3 * lift, 0, 0))
    bob = 0.045 * abs(math.sin(ph)) ** 1.5
    P['body'] = dict(loc=v3(0, 0, bob), rot=v3(-0.03 + 0.015 * math.cos(2 * ph), -0.06 * math.sin(ph), 0.04 * math.sin(ph)))
    P['roof'] = dict(loc=v3(0, 0, 0.018 * abs(math.sin(ph - 0.6))), rot=v3(0, 0.03 * math.sin(ph - 0.7), 0))
    P['chimney'] = dict(rot=v3(0.02 * math.sin(2 * ph - 1.0), 0.05 * math.sin(ph - 1.0), 0))
    for b in TILE_BONES:
        k = TILE_PHASE[b] * 0.3; amp = 0.07 if b == 'ridge_tile' else 0.05
        P[b] = dict(loc=v3(0, 0, amp * abs(math.sin(ph - 0.8 - k))), rot=v3(0.14 * math.sin(2 * ph - k), 0, 0.22 * math.sin(ph - k)))
    for b, sg in DOOR_SIGN.items(): P[b] = dict(rot=v3(0, 0, sg * (0.34 * (0.5 + 0.5 * math.sin(2 * ph + (0 if sg > 0 else math.pi))) - 0.06)))
    P['tongue_2'] = dict(rot=v3(0.12 * (1 + math.sin(2 * ph)) / 2, 0, 0.05 * math.sin(ph))); P['tongue_3'] = dict(rot=v3(0.18 * math.sin(2 * ph - 1.0), 0, 0.14 * math.sin(ph - 0.6)))
    for lid in ('lid_R', 'lid_L'): P[lid] = dict(rot=v3(0.04 * abs(math.sin(ph)), 0, 0))
    for side in ('R', 'L'): P['pupil_' + side] = dict(loc=v3(-0.035, 0, -0.01))
    for b, sg in SH_SIGN.items(): P[b] = dict(rot=v3(0, 0, sg * 0.12 * math.sin(2 * ph + (1.0 if b.endswith('in') else 0))))
    fl = 1 + 0.06 * math.sin(4 * ph) + 0.03 * math.sin(6 * ph + 1); P['candle'] = dict(scale=v3(fl, fl, fl))
    butterflies(P, ph, flaps=5)
    return P

def attack(T, cache):
    P = {}; t = T / 2.0
    shimmy_env = ramp(T, 0.08, 0.20) * (1 - ramp(T, 0.46, 0.58))
    crouch = keys(T, [(0.40, 0.0), (0.60, 1.0), (1.05, 1.0), (1.15, 0.0)])
    hop = keys(T, [(1.05, 0.0), (1.15, 1.0), (1.25, 0.0)])
    land = bell(T, 1.27, 0.12) if T >= 1.15 else 0.0
    lean = keys(T, [(0.40, 0.0), (0.60, 0.10), (1.05, 0.10), (1.18, -0.13), (1.25, -0.08), (1.55, 0.02), (1.85, 0.0)])
    P['body'] = dict(rot=v3(lean, 0.10 * math.sin(TAU * (T - 0.08) / 0.19) * shimmy_env, 0.03 * math.sin(TAU * (T - 0.08) / 0.19 + 1.0) * shimmy_env),
                     loc=v3(0, 0.02 * hop, -0.08 * crouch + 0.15 * hop - 0.045 * land + 0.012 * math.sin(TAU * (T - 0.08) / 0.095) * shimmy_env))
    foot = max(0.0, 0.15 * hop - 0.05)
    for side in ('R', 'L'): P['leg_' + side] = dict(loc=v3(0, 0.02 * hop, foot))
    rise = keys(T, [(0.10, 0.0), (0.60, 1.0)])
    P['roof'] = dict(loc=v3(0, 0, 0.03 * rise * (1 - ramp(T, 1.05, 1.15)) + 0.04 * land), rot=v3(0, -0.4 * P['body']['rot'][1], 0))
    P['chimney'] = dict(rot=v3(0.06 * land, -0.6 * P['body']['rot'][1], 0))
    # Tiles: rise and spin (parent-relative) -> world-space throw arc -> floor bounce -> recall arc -> rest.
    for b in TILE_BONES:
        k = TILE_PHASE[b]
        if T <= HOLD[1]:
            up = (0.46 if b != 'ridge_tile' else 0.40) * rise; spin = 2.4 * rise + 0.25 * math.sin(k)
            wig = 0.03 * math.sin(TAU * (T - 0.08) / 0.19 + k) * shimmy_env
            P[b] = dict(loc=v3(0.10 * math.sin(k) * rise, 0.05 * math.cos(k) * rise, up + wig), rot=v3(0.5 * rise * math.sin(k + 1), 0.4 * rise * math.cos(k), spin))
        elif T <= CONTACT:
            u = ((T - HOLD[1]) / (CONTACT - HOLD[1])) ** 1.1; (lx, ly), _ = LAND[b]; x0 = cache[b].translation.x
            ctrl = (0.55 * x0 + 0.45 * lx, max(1.6, 0.9 * ly), 4.3 + 0.15 * TILE_BONES.index(b))
            P[b] = dict(world=(lambda M, b=b, u=u, ctrl=ctrl: tile_world(lerp_frame(cache[b], land_frame(b), u, tumble_axis=(1, 0.3, 0), tumble=TAU, ctrl=ctrl))(b)))
        elif T <= 1.45:
            s_ = (T - CONTACT) / 0.20; hopz = 0.05 * math.sin(math.pi * min(1, s_ / 0.7)) if s_ < 0.7 else 0.0
            slide = 0.06 * ss(s_); fr = land_frame(b, (0.0, slide), hopz, 0.25 * ss(s_))
            P[b] = dict(world=(lambda M, b=b, fr=fr: tile_world(fr)(b)))
        elif T < 1.90:
            t0 = 1.45 + 0.04 * TILE_BONES.index(b); u = ss((T - t0) / (1.90 - t0)); start = land_frame(b, (0.0, 0.06), 0.0, 0.25); (lx, ly), _ = LAND[b]
            ctrl = (0.5 * (lx + REST_M[b].translation.x), 1.5, 3.9 + 0.3 * TILE_BONES.index(b))
            P[b] = dict(world=(lambda M, b=b, u=u, start=start, ctrl=ctrl: lerp_frame(start @ TILE_FRAME[b].inverted() @ REST_M[b], REST_M[b], u, tumble_axis=(0.3, 1, 0), tumble=-TAU, ctrl=ctrl)))
        else: P[b] = {}
    wide = keys(T, [(0.05, 0.0), (0.30, 1.0), (1.30, 1.0), (1.75, 0.0)])
    for lid in ('lid_R', 'lid_L'): P[lid] = lid_pose(lid, wide=wide)
    for b, sg in SH_SIGN.items(): P[b] = dict(rot=v3(0, 0, -sg * 0.34 * wide + sg * 0.18 * land))
    slam = bell(T, 1.25, 0.10)
    for b, sg in DOOR_SIGN.items(): P[b] = dict(rot=v3(0, 0, -sg * 0.30 * wide + sg * 0.55 * slam))
    look = keys(T, [(0.30, (0.0, 0.0)), (0.60, (-0.04, -0.035)), (1.30, (-0.04, -0.035)), (1.75, (0.0, 0.0))])
    for side in ('R', 'L'): P['pupil_' + side] = dict(loc=v3(look[0], 0, look[1]), scale=v3(*(1 - 0.12 * wide,) * 3))
    flick = keys(T, [(1.05, 0.0), (1.20, 1.0), (1.32, 1.0), (1.60, 0.0)])
    P['tongue_1'] = dict(rot=v3(0.10 * flick, 0, 0)); P['tongue_2'] = dict(rot=v3(0.45 * flick, 0, 0)); P['tongue_3'] = dict(rot=v3(0.70 * flick - 0.15 * crouch, 0, 0))
    fl = 1 + 0.25 * rise * (1 - ramp(T, 1.25, 1.7)) + 0.05 * math.sin(TAU * T * 3); P['candle'] = dict(scale=v3(fl, fl, fl))
    butterflies(P, TAU * t, flaps=10)
    return P

def hit(T):
    P = {}; shock = keys(T, [(0.0, 0.0), (0.07, 1.0), (0.20, 0.6), (0.45, 0.0)])
    wob = math.sin(TAU * (T - 0.07) / 0.19) * math.exp(-max(0.0, T - 0.07) * 5.5) * ramp(T, 0.04, 0.10)
    P['body'] = dict(loc=v3(0, -0.05 * shock, -0.035 * shock), rot=v3(0.10 * shock + 0.025 * wob, 0.05 * wob, -0.02 * wob))
    shut = keys(T, [(0.0, 0.0), (0.06, 1.0), (0.18, 1.0), (0.34, -0.25), (0.52, 0.0)])
    for lid in ('lid_R', 'lid_L'):
        P[lid] = lid_pose(lid, close=max(0.0, shut), wide=0.8 * max(0.0, -shut))
    for b, sg in SH_SIGN.items(): P[b] = dict(rot=v3(0, 0, sg * 1.0 * max(0.0, shut) - sg * 0.2 * max(0.0, -shut)))
    for b, sg in DOOR_SIGN.items(): P[b] = dict(rot=v3(0, 0, sg * 1.2 * max(0.0, shut)))
    pop = bell(T, 0.13, 0.13)
    P['roof'] = dict(loc=v3(0, 0, 0.10 * pop), rot=v3(0.03 * wob, -0.04 * wob, 0))
    P['chimney'] = dict(rot=v3(0.10 * wob, 0.08 * wob, 0))
    for b in TILE_BONES:
        k = TILE_PHASE[b]; j = bell(T, 0.17 + 0.02 * (k % 3), 0.16)
        P[b] = dict(loc=v3(0, 0, 0.20 * j), rot=v3(0.6 * j * math.sin(k + 1), 0.5 * j * math.cos(k), 0.9 * j))
    for side in ('R', 'L'): P['pupil_' + side] = dict(loc=v3(0, 0, 0.06 * max(0.0, shut)), scale=v3(*(1 - 0.3 * shock,) * 3))
    P['tongue_2'] = dict(rot=v3(0.25 * shock, 0, 0)); P['tongue_3'] = dict(rot=v3(0.30 * wob + 0.2 * shock, 0, 0.15 * wob))
    fl = 1 - 0.35 * shock; P['candle'] = dict(scale=v3(fl, fl, fl))
    butterflies(P, TAU * T / 0.7, flaps=4)
    return P

def defeat(T):
    P = {}; T = min(T, DEFEAT_HELD)
    surprise = keys(T, [(0.0, 0.0), (0.12, 1.0), (0.30, 0.0)])
    slump = keys(T, [(0.25, 0.0), (1.00, 1.0), (1.20, 1.2), (1.45, 0.95), (1.65, 1.0)])
    P['body'] = dict(loc=v3(0, 0.015 * slump, 0.045 * surprise - 0.075 * slump), rot=v3(-0.06 * slump, 0.065 * slump, 0.05 * slump))
    for side, sx in (('R', 1), ('L', -1)): P['leg_' + side] = dict(loc=v3(0.075 * sx * ramp(T, 0.35, 1.0), 0.04 * ramp(T, 0.35, 1.0), 0))
    droop = keys(T, [(0.30, 0.0), (1.05, 1.0), (1.30, 0.9), (1.55, 1.0)])
    # Floppy hat: the roof tips forward 0.06 rad about a pivot just behind the front gable, so its front sinks only
    # 2.5 cm onto the gable while the back lifts; it also slides 5 cm forward over the eyes.
    P['roof'] = dict(loc=v3(0, 0.05 * droop, 0.04 * surprise + 0.015 * droop), rot=v3(-0.06 * droop, 0.01 * droop, 0))
    P['chimney'] = dict(rot=v3(-0.05 * droop, -0.12 * droop, 0))
    # Tiles pop, then fall into their empty slots (relative to the drooping roof) with one small rebound.
    for b in TILE_BONES:
        k = TILE_PHASE[b]; t0 = 0.35 + 0.05 * (k % 4)
        if T <= t0:
            p = surprise
            P[b] = dict(loc=v3(0, 0, 0.14 * p), rot=v3(0.3 * p, 0, 0.4 * p))
        else:
            u = min(1.0, ((T - t0) / 0.40) ** 2); reb = 0.035 * math.sin(math.pi * min(1.0, max(0.0, (T - t0 - 0.40) / 0.22))) if T > t0 + 0.40 else 0.0
            def target(M, b=b, u=u, reb=reb):
                roof_rel = M['roof'] @ REST_M['roof'].inverted()
                hover = REST_M[b]; slot = TILE_SLOT[b] @ TILE_FRAME[b].inverted() @ REST_M[b]
                fr = lerp_frame(hover, slot, u)
                return roof_rel @ Matrix.Translation((0, 0, reb)) @ fr
            P[b] = dict(world=target)
    close = keys(T, [(0.25, 0.0), (0.90, 1.0)]); wide = surprise
    for lid in ('lid_R', 'lid_L'): P[lid] = lid_pose(lid, close=close, wide=0.8 * wide)
    shut = keys(T, [(0.35, 0.0), (1.05, 1.0), (1.25, 0.92), (1.45, 1.0)])
    for b, sg in SH_SIGN.items(): P[b] = dict(rot=v3(0, 0, sg * 1.15 * shut - sg * 0.25 * wide))
    pout = keys(T, [(0.30, 0.0), (1.00, 1.0), (1.20, 0.9), (1.40, 1.0)])
    for b, sg in DOOR_SIGN.items(): P[b] = dict(rot=v3(0, 0, sg * 0.95 * pout - sg * 0.2 * wide))
    for side in ('R', 'L'): P['pupil_' + side] = dict(loc=v3(-0.04 * close, 0, 0.06 * close), scale=v3(*(1 - 0.3 * surprise,) * 3))
    flop = keys(T, [(0.30, 0.0), (1.05, 1.0), (1.25, 1.08), (1.50, 1.0)])
    P['tongue_2'] = dict(rot=v3(0.20 * flop, 0, 0.05 * flop)); P['tongue_3'] = dict(rot=v3(0.95 * flop, 0, 0.10 * flop))
    ember = keys(T, [(0.20, 1.12), (1.10, 0.28)]); P['candle'] = dict(scale=v3(ember, ember, ember))
    settle = keys(T, [(0.4, 0.0), (1.6, 1.0)])
    butterflies(P, TAU * T / 2.4 * (1 - settle), flaps=6, settle=settle)
    return P

# ------------------------------------------------------------------ bake
scene = sc; scene.render.fps = FPS; scene.render.fps_base = 1.0
arm.animation_data_clear(); arm.animation_data_create()
for action in list(bpy.data.actions): bpy.data.actions.remove(action)
for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'; pb.matrix_basis = Matrix.Identity(4)
cache = {}
M = apply_all(attack(HOLD[1] - 1e-9, cache)); cache.update({b: M[b] @ REST_M[b].inverted() @ TILE_FRAME[b] for b in TILE_BONES})
records = []; samples = {}
for name, duration, loop in CLIPS:
    action = bpy.data.actions.new(name); arm.animation_data.action = action; end = round(duration * FPS); prev = {}
    for frame in range(end + 1):
        T = frame / FPS
        P = {'idle': idle, 'move': move, 'hit': hit, 'defeat': defeat}[name](T) if name != 'attack' else attack(T, cache)
        apply_all(P)
        for pb in arm.pose.bones:
            if pb.name == 'root': continue
            q = pb.rotation_quaternion.copy()
            if pb.name in prev and prev[pb.name].dot(q) < 0: q.negate(); pb.rotation_quaternion = q
            prev[pb.name] = q.copy()
            for field in ('location', 'rotation_quaternion', 'scale'): pb.keyframe_insert(data_path=field, frame=frame, group=pb.name)
    for fc in action.fcurves:
        for k in fc.keyframe_points: k.interpolation = 'LINEAR'
    track = arm.animation_data.nla_tracks.new(); track.name = name; strip = track.strips.new(name, 0, action); strip.action_frame_start = 0; strip.action_frame_end = end; track.mute = True
    records.append({'name': name, 'duration_s': duration, 'loop': loop, 'clamp_when_finished': not loop, 'frames_at_60fps': end + 1,
                    'contact_time_s': CONTACT if name == 'attack' else None, 'contact_fraction': CONTACT / duration if name == 'attack' else None,
                    'held_warning_s': list(HOLD) if name == 'attack' else None, 'held_final_pose_from_s': DEFEAT_HELD if name == 'defeat' else None})
arm.animation_data.action = None
for pb in arm.pose.bones: pb.matrix_basis = Matrix.Identity(4)
bpy.context.view_layer.update()
arm['attack_contact_seconds'] = CONTACT; arm['attack_contact_fraction'] = CONTACT / 2.0
bp = ROOT / 'source/bounds.json'
if bp.exists():
    br = json.loads(bp.read_text()); skin['model_space_bounds_y_up'] = br['safe_culling_envelope']; skin['bounds_method'] = br['method']
for name in ('build.py', 'common.py', 'animate.py'):
    old = bpy.data.texts.get('WO111 magic house ' + name)
    if old: bpy.data.texts.remove(old)
    block = bpy.data.texts.new('WO111 magic house ' + name); block.write((ROOT / 'source' / name).read_text())
bpy.ops.object.select_all(action='DESELECT'); skin.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'magic-house.blend'), compress=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'magic-house.glb'), export_format='GLB', use_selection=True, export_yup=True, export_animations=True, export_animation_mode='NLA_TRACKS',
                          export_skins=True, export_def_bones=False, export_armature_object_remove=True, export_all_influences=False, export_influence_nb=4, export_apply=False,
                          export_texcoords=True, export_normals=True, export_tangents=False, export_materials='EXPORT', export_vertex_color='NONE', export_image_format='AUTO',
                          export_cameras=False, export_lights=False, export_extras=True)
record = json.loads((ROOT / 'construction.json').read_text()); record['clips'] = records
record['files'] = {name: {'bytes': (ROOT / name).stat().st_size, 'sha256': hashlib.sha256((ROOT / name).read_bytes()).hexdigest()} for name in ['magic-house.blend', 'magic-house.glb', 'pigment.png']}
(ROOT / 'construction.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps({'clips': [(r['name'], r['duration_s']) for r in records], 'files': record['files']}))
