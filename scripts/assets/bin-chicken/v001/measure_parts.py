"""WO111 bin-chicken v001: read-only per-part world bounds of the blockout master (for reference-notes.md)."""
import bpy, json
from pathlib import Path
ROOT = Path('/workspace/haynes-quest/family-eras/bin-chicken/v001')
GROUPS = {'body': ['Grubby white egg body'], 'head': ['Bald ink head'], 'eyes': ['Googly eye white'], 'beak': ['Long curved beak', 'Beak tip'],
          'neck': ['Bare black S neck'], 'ruff': ['Scruffy ruff feather', 'Ruff cowlick', 'White lower neck'],
          'wings': ['Folded white wing'], 'wing tips': ['Black wing-tip feather'], 'plumes': ['Lacy black plume drape'],
          'cone': ['Striped paper chip cone'], 'cone chips': ['Stolen loot chip'], 'beak chip': ['Stolen hot chip in beak'],
          'peel': ['Banana peel'], 'thighs': ['Feathered thigh'], 'right leg+foot': ['Bare stilt shin right', 'Knobbly knee right', 'Bare stilt shank right', 'Foot ball right', 'Big toe right', 'Toe tip pad right', 'Back toe right'],
          'left leg+foot': ['Bare stilt shin left', 'Knobbly knee left', 'Bare stilt shank left', 'Foot ball left', 'Big toe left', 'Toe tip pad left', 'Back toe left'],
          'knees': ['Knobbly knee'], 'grime': ['Bin-grime']}
dg = bpy.context.evaluated_depsgraph_get(); out = {}
obs = [o for o in bpy.data.collections['Bin chicken blockout (master)'].objects if o.type in ('MESH', 'CURVE')]
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
