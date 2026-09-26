"""WO111 putty-grunt v001: read-only per-part world bounds of the blockout master (for reference-notes.md)."""
import bpy, json
from mathutils import Vector
from pathlib import Path
ROOT = Path('/workspace/haynes-quest/family-eras/putty-grunt/v001')
R_FIST = Vector((0.292, 0.232, 0.848)); L_FIST = Vector((-0.332, 0.14, 0.492))
GROUPS = {
    'clay body mass (torso + head)': (['Clay body mass'], None),
    'head (body mass above z 0.95)': (['Clay body mass'], lambda w: w.z >= 0.95),
    'torso (body mass z 0.40-0.95)': (['Clay body mass'], lambda w: 0.40 <= w.z < 0.95),
    'nub nose (body mass, y >= 0.16)': (['Clay body mass'], lambda w: w.y >= 0.16 and w.z > 1.0),
    'eyes': (['Blank round eye'], None), 'eye right (bigger)': (['Blank round eye right'], None), 'eye left': (['Blank round eye left'], None),
    'brows': (['Clay worm brow'], None), 'grin': (['Lopsided dopey grin'], None),
    'tongue': (['Poking-out pink tongue', 'Tongue inside the grin'], None),
    'antenna (stalk + ball)': (['Pinched antenna stalk', 'Antenna clay ball', 'Antenna ball pinch'], None),
    'antenna ball': (['Antenna clay ball'], None),
    'right arm (guard, with fist)': (['Clay arm right'], None),
    'right guard fist (within 0.11 m of its centre)': (['Clay arm right'], lambda w: (w - R_FIST).length < 0.11),
    'left arm (low, with fist)': (['Clay arm left'], None),
    'left low fist (within 0.11 m of its centre)': (['Clay arm left'], lambda w: (w - L_FIST).length < 0.11),
    'legs': (['Clay leg'], None), 'leg right': (['Clay leg right'], None),
    'feet (legs below z 0.10)': (['Clay leg'], lambda w: w.z < 0.10), 'right foot (legs below z 0.10, x > 0)': (['Clay leg right'], lambda w: w.z < 0.10),
    'belt coil': (['Clay-coil belt'], None), 'buckle': (['Round honey buckle', 'Buckle pressed centre'], None),
    'chest thumbprint emblem': (['Thumbprint dent chest emblem'], None), 'all thumbprint dents': (['Thumbprint dent'], None),
}
dg = bpy.context.evaluated_depsgraph_get(); out = {}
obs = [o for o in bpy.data.collections['Putty grunt blockout (master)'].objects if o.type in ('MESH', 'CURVE')]
for g, (prefixes, keep) in GROUPS.items():
    lo = [1e9] * 3; hi = [-1e9] * 3; n = 0; used = 0
    for ob in obs:
        if not any(ob.name.startswith(p) for p in prefixes): continue
        ev = ob.evaluated_get(dg); me = ev.to_mesh(); n += 1
        for v in me.vertices:
            w = ev.matrix_world @ v.co
            if keep and not keep(w): continue
            used += 1
            for k in range(3): lo[k] = min(lo[k], w[k]); hi[k] = max(hi[k], w[k])
        ev.to_mesh_clear()
    out[g] = {'parts': n, 'min': [round(x, 3) for x in lo], 'max': [round(x, 3) for x in hi], 'size': [round(hi[k] - lo[k], 3) for k in range(3)]}
(ROOT / 'part-measurements.json').write_text(json.dumps(out, indent=1) + '\n')
print(json.dumps(out))
