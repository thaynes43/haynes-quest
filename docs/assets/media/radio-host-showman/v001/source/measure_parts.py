"""WO111 radio-host-showman v001: read-only per-part world bounds of the blockout master (for reference-notes.md)."""
import bpy, json
from pathlib import Path
ROOT = Path('/workspace/haynes-quest/family-eras/radio-host-showman/v001')
SHOE_R = ['Spectator shoe sole right', 'Spectator shoe cream upper right', 'Spectator shoe black toe cap right', 'Spectator shoe black heel right']
MIC_HEAD = ['Silver mic capsule', 'Brass mic yoke', 'Brass yoke knob', 'Red on-air bulb']
GROUPS = {
    'whole head (skin, hair, tufts, ears)': ['Showman head', 'Slicked hair cap', 'Hair tuft', 'Ear'],
    'head (skin)': ['Showman head'], 'hair cap': ['Slicked hair cap'], 'hair tufts': ['Hair tuft'],
    'right hair tuft': ['Hair tuft right'], 'left hair tuft': ['Hair tuft left'], 'ears': ['Ear'],
    'eyes': ['Eye white'], 'brows': ['High arched brow'], 'nose': ['Button nose'], 'cheeks': ['Rosy cheek'],
    'grin': ['Huge showman grin'], 'tooth band': ['Smooth tooth band'], 'tongue': ['Grin tongue'],
    'neck + shirt collar': ['Neck', 'White shirt collar'], 'bow tie': ['Black bow tie'],
    'jacket body': ['Candy-stripe jacket body'], 'shawl lapels': ['Black shawl lapel'], 'shirt front': ['White shirt front'],
    'pocket square': ['Honey pocket square'], 'lapel pin': ['Cathedral-radio lapel pin'], 'jacket buttons': ['Brass jacket button'],
    'back half-belt': ['Black back half-belt'],
    'right sleeve': ['Candy-stripe sleeve right'], 'left sleeve': ['Candy-stripe sleeve left'],
    'right glove (cane grip)': ['White glove fist right', 'White glove thumb right', 'White glove cuff right'],
    'left glove (wave)': ['White glove waving palm', 'Waving glove', 'White glove cuff left', 'Glove back stitch'],
    'trousers': ['Black trouser leg', 'Black trouser seat', 'Trouser cuff'], 'right trouser leg': ['Black trouser leg right'],
    'shoes': ['Spectator shoe'], 'right shoe': SHOE_R,
    'mic cane (all)': ['Black mic cane shaft', 'Brass cane ferrule', 'Brass cane collar'] + MIC_HEAD,
    'mic head (capsule, yoke, bulb)': MIC_HEAD, 'mic capsule': ['Silver mic capsule'], 'on-air bulb': ['Red on-air bulb'],
    'cane shaft + ferrule': ['Black mic cane shaft', 'Brass cane ferrule'],
    'body without arms or cane (jacket, trousers, shoes, neck)': ['Candy-stripe jacket body', 'Black trouser', 'Trouser cuff', 'Spectator shoe', 'Neck', 'White shirt collar'],
}
dg = bpy.context.evaluated_depsgraph_get(); out = {}
obs = [o for o in bpy.data.collections['Radio host showman blockout (master)'].objects if o.type in ('MESH', 'CURVE')]
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
