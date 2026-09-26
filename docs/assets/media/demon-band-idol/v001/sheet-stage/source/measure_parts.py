"""WO111 demon-band-idol v001: read-only per-part world bounds of the blockout master (for reference-notes.md)."""
import bpy, json
from pathlib import Path
ROOT = Path('/workspace/haynes-quest/family-eras/demon-band-idol/v001')
GROUPS = {'head': ['Lavender idol head'], 'hair cap': ['Midnight hair cap'],
          'hair (all)': ['Midnight hair cap', 'Fringe', 'Short fringe', 'Sideburn tuft', 'Nape point', 'Back swoop layer'],
          'fringe swoop': ['Fringe swoop'], 'horns': ['Gold candy horn', 'Horn tip'], 'horn right': ['Gold candy horn right', 'Horn tip right'],
          'ears': ['Pointed ear', 'Ear tip'], 'open eye white': ['Eye white left'], 'wink arc': ['Happy wink arc right'],
          'grin': ['Open grin'], 'star blush': ['Star blush'], 'earring': ['Earring hoop', 'Gold star earring'],
          'neck': ['Lavender neck'], 'jacket body': ['Teal stage jacket body'], 'swallowtail': ['Swallowtail flap'],
          'sash': ['Hot-pink idol sash'], 'sash bow': ['Sash bow'], 'brooch': ['Gold star brooch'],
          'epaulettes': ['Gold epaulette', 'Epaulette fringe'], 'shoulder sparkles': ['Shoulder sparkle'],
          'right arm (mic)': ['Teal sleeve right', 'Gold cuff right', 'Mic fist right', 'Mic thumb right'],
          'left arm (hip)': ['Teal sleeve left', 'Gold cuff left', 'Hip fist left', 'Hip thumb left'],
          'microphone': ['Mic handle', 'Mic gold ring', 'Mic silver grille'], 'mic grille': ['Mic silver grille'],
          'trousers': ['Stage trouser'], 'sneakers': ['Sneaker'], 'tail': ['Little demon tail'], 'spade tip': ['Spade tail tip']}
dg = bpy.context.evaluated_depsgraph_get(); out = {}
obs = [o for o in bpy.data.collections['Demon band idol blockout (master)'].objects if o.type in ('MESH', 'CURVE')]
for g, prefixes in GROUPS.items():
    lo = [1e9] * 3; hi = [-1e9] * 3; n = 0
    for ob in obs:
        if not any(ob.name.startswith(p) for p in prefixes): continue
        ev = ob.evaluated_get(dg); me = ev.to_mesh(); n += 1
        for v in me.vertices:
            w = ev.matrix_world @ v.co
            for k in range(3): lo[k] = min(lo[k], w[k]); hi[k] = max(hi[k], w[k])
        ev.to_mesh_clear()
    out[g] = {'parts': n, 'min': [round(x, 3) for x in lo], 'max': [round(x, 3) for x in hi], 'size': [round(hi[k] - lo[k], 3) for k in range(3)]}
(ROOT / 'part-measurements.json').write_text(json.dumps(out, indent=1) + '\n')
print(json.dumps(out))
