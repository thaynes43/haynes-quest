"""WO111 playroom-kit v001: read-only per-feature world bounds of the blockout master (for reference-notes.md)."""
import bpy, json
from pathlib import Path
ROOT = Path('/workspace/haynes-quest/family-eras/playroom-kit/v001')
GROUPS = {
    'stacking-block-tower': {
        'foam block 1 (pink)': ['Foam block 1'], 'foam block 2 (sky)': ['Foam block 2'], 'foam block 3 (mint)': ['Foam block 3'],
        'raised shapes, block 1': ['Raised star block 1', 'Raised circle block 1', 'Raised triangle block 1', 'Raised heart block 1'],
        'front star, block 1': ['Raised star block 1 front'], 'front heart, block 2': ['Raised heart block 2 front'],
    },
    'toy-bus-garage': {
        'base tray': ['Toy base tray'], 'road with dashes': ['Toy road', 'Road dash'],
        'walls (front, back, sides)': ['Front wall with door', 'Back wall', 'Left wall', 'Right wall'],
        'barrel roof with piping ribs': ['Barrel roof', 'Roof piping rib'], 'door-frame piping': ['Door frame piping'],
        'roll-up door slats': ['Roll-up door slat'], 'interior liner': ['Interior liner'], 'corner posts with balls': ['Corner post'],
        'gable badge (rim, disc, pictogram)': ['Badge rim', 'Badge disc', 'Badge bus pictogram', 'Pictogram'],
        'side portholes': ['Side porthole'], 'traffic-light tower (drum, band, dome)': ['Tower drum', 'Tower band', 'Tower dome'],
        'honk horn (bulb, neck, bell)': ['Honk horn'], 'traffic light (housing, lamps)': ['Traffic light housing', 'Traffic lamp'],
    },
    'crib-rail-fence': {
        'end posts': ['End post'], 'soft teether top rail': ['Soft teether top rail'], 'bottom rail': ['Bottom rail'],
        'spindles': ['Spindle'], 'bead slide (rods and beads)': ['Bead rod', 'Bead '], 'post hearts': ['Post heart'],
    },
    'giant-plush-ball': {
        'plush panels': ['Plush panel'], 'seam piping': ['Seam piping'], 'button caps': ['Top button cap', 'Bottom button cap'],
        'ribbon tag loop': ['Ribbon tag loop'], 'star appliqué': ['Star applique'], 'heart appliqué': ['Heart applique'],
    },
}
dg = bpy.context.evaluated_depsgraph_get(); out = {}
for prop, groups in GROUPS.items():
    obs = [o for o in bpy.data.collections['PK ' + prop].objects if o.type in ('MESH', 'CURVE')]
    out[prop] = {}
    for g, prefixes in groups.items():
        lo = [1e9] * 3; hi = [-1e9] * 3; n = 0; tris = 0
        for ob in obs:
            part = ob.get('blockout_part', '')
            if not any(part.startswith(p) for p in prefixes): continue
            ev = ob.evaluated_get(dg); me = ev.to_mesh(); n += 1; me.calc_loop_triangles(); tris += len(me.loop_triangles)
            for v in me.vertices:
                w = ev.matrix_world @ v.co
                for k in range(3): lo[k] = min(lo[k], w[k]); hi[k] = max(hi[k], w[k])
            ev.to_mesh_clear()
        assert n, (prop, g)
        out[prop][g] = {'parts': n, 'blockout_triangles': tris, 'min': [round(x, 3) for x in lo], 'max': [round(x, 3) for x in hi],
                        'size': [round(hi[k] - lo[k], 3) for k in range(3)]}
(ROOT / 'part-measurements.json').write_text(json.dumps(out, indent=1) + '\n')
print(json.dumps(out))
