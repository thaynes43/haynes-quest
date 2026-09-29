"""WO111 web-slinger-helper v001: read-only per-part world bounds of the blockout master (for reference-notes.md)."""
import bpy, json
from pathlib import Path
ROOT = Path('/workspace/haynes-quest/family-eras/web-slinger-helper/v001')
GROUPS = {
    'whole head (hood, rim, face, mask, eyes, fringe, hood web)': ['Cobalt hood', 'Hood face rim', 'Round face', 'Tangerine domino mask', 'Eye white',
        'Iris', 'Pupil', 'Button nose', 'Grin', 'Cheek blush', 'Hair fringe', 'Hood web', 'Crown web knot'],
    'hood (shell only)': ['Cobalt hood'], 'hood face rim': ['Hood face rim'], 'round face': ['Round face'],
    'domino mask': ['Tangerine domino mask'], 'eye whites': ['Eye white'], 'eye white right': ['Eye white right'], 'irises': ['Iris'], 'pupils': ['Pupil'],
    'button nose': ['Button nose'], 'grin mouth': ['Grin mouth'], 'grin top teeth': ['Grin top teeth'], 'grin tongue': ['Grin tongue'],
    'cheek blush': ['Cheek blush'], 'hair fringe': ['Hair fringe'], 'hood web (strands, rings, dew drops, knot)': ['Hood web', 'Crown web knot'],
    'neck': ['Cobalt neck'], 'torso': ['Cobalt torso'], 'belt': ['Tangerine belt'], 'belt buckle': ['Belt buckle'],
    'chest star emblem': ['Chest star emblem'], 'back star emblem': ['Back star emblem'],
    'chest web (rays, arcs, dew drops)': ['Chest web'], 'back web (rays, arcs, dew drops)': ['Back web'],
    'web-rope coil (clip, loops)': ['Web coil belt clip', 'Web rope coil loop'],
    'shoulder balls': ['Shoulder ball'],
    'right arm raised (sleeve to mitten tip)': ['Shoulder ball right', 'Cobalt sleeve right', 'Glove flare right', 'Web-shooter cuff right', 'Web nozzle right',
        'Heart button right', 'Waving mitten right', 'Mitten thumb right', 'Mitten finger groove right'],
    'waving mitten right (with thumb)': ['Waving mitten right', 'Mitten thumb right'],
    'left arm on hip (sleeve to fist)': ['Shoulder ball left', 'Cobalt sleeve left', 'Glove flare left', 'Web-shooter cuff left', 'Web nozzle left',
        'Heart button left', 'Hip fist left', 'Fist thumb left'],
    'hip fist left (with thumb)': ['Hip fist left', 'Fist thumb left'],
    'web-shooter cuffs': ['Web-shooter cuff'], 'web-shooter cuff right': ['Web-shooter cuff right'], 'heart buttons': ['Heart button'],
    'heart button right': ['Heart button right'], 'web nozzles': ['Web nozzle'], 'glove flares': ['Glove flare'],
    'legs': ['Cobalt legging'], 'leg right': ['Cobalt legging right'],
    'boot right (shaft, cuff, foot, sole)': ['Boot shaft right', 'Boot rolled cuff right', 'Boot foot right', 'Boot sole right'],
    'boot left (shaft, cuff, foot, sole)': ['Boot shaft left', 'Boot rolled cuff left', 'Boot foot left', 'Boot sole left'],
    'soles': ['Boot sole'],
}
dg = bpy.context.evaluated_depsgraph_get(); out = {}
obs = [o for o in bpy.data.collections['Web-slinger helper blockout (master)'].objects if o.type in ('MESH', 'CURVE')]
for g, prefixes in GROUPS.items():
    lo = [1e9] * 3; hi = [-1e9] * 3; n = 0
    for ob in obs:
        if not any(ob.name.startswith(p) for p in prefixes): continue
        ev = ob.evaluated_get(dg); me = ev.to_mesh(); n += 1
        for v in me.vertices:
            w = ev.matrix_world @ v.co
            for k in range(3): lo[k] = min(lo[k], w[k]); hi[k] = max(hi[k], w[k])
        ev.to_mesh_clear()
    assert n, g
    out[g] = {'parts': n, 'min': [round(x, 3) for x in lo], 'max': [round(x, 3) for x in hi], 'size': [round(hi[k] - lo[k], 3) for k in range(3)]}
(ROOT / 'part-measurements.json').write_text(json.dumps(out, indent=1) + '\n')
print(json.dumps(out))
