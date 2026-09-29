"""WO111 casita-kit v001: read-only per-feature world bounds of the blockout master (for reference-notes.md)."""
import bpy, json
from pathlib import Path
ROOT = Path('/workspace/haynes-quest/family-eras/casita-kit/v001')
GROUPS = {
    'casita-terrace-wall': {
        'zocalo base band and moulding': ['Zocalo'], 'stucco body': ['Stucco body'],
        'end pilasters (shaft, base, cap)': ['End pilaster'], 'finials (plinth, ball)': ['Finial'], 'coping cap': ['Coping cap'],
        'barrel coping tiles': ['Barrel coping tiles'], 'talavera band (tiles, motifs, blue lines)': ['Talavera band', 'Band line'],
        'candle niches (backing, surround, sill, candles)': ['Niche'], 'candles only': ['Niche left candle', 'Niche right candle'],
        'butterfly relief': ['Wall butterfly relief'], 'bougainvillea (all)': ['Bougainvillea'],
    },
    'flower-planter': {
        'terracotta pot': ['Terracotta pot'], 'talavera band (band, rings, diamonds, dots)': ['Talavera band', 'Band ring', 'Band diamonds', 'Band dots'],
        'foliage mound and lumps': ['Foliage'], 'leaves over the rim': ['Leaves over the rim'], 'marigold pompoms': ['Marigold pompoms'],
        'pink blooms (petals, centres)': ['Pink bloom petals', 'Bloom centres'], 'tall flower stems': ['Tall flower stems'],
        'butterfly': ['Planter butterfly'],
    },
    'patterned-door': {
        'clay step': ['Clay step'], 'stucco surround': ['Stucco surround'], 'opening backing': ['Opening backing'], 'door leaves': ['Door leaf'],
        'cream panels': ['Lower panel', 'Upper panel'], 'rosettes': ['Rosette'], 'lattice diamonds and dots': ['Lattice'],
        'ring pulls': ['Pull plate', 'Ring pull'], 'gold seam astragal': ['Gold seam astragal'], 'transom sunburst rays': ['Transom sunburst'],
        'transom butterfly': ['Transom butterfly'], 'glow trim': ['Glow trim'], 'surround tiles': ['Door surround'],
    },
    'butterfly-arch': {
        'posts (base, shaft, capital, cap)': ['Post base', 'Post shaft', 'Post capital', 'Post cap'], 'post tiles': ['Arch posts'],
        'post niches with candles': ['Post niche'], 'cap candles with dishes': ['Cap candle'], 'vine arch and tendril': ['Vine arch', 'Twisting tendril'],
        'vine leaves and flowers': ['Vine leaves', 'Vine marigolds', 'Vine blooms'], 'bougainvillea on the left post': ['Bougainvillea'],
        'foot bushes': ['Foot bush'], 'crown butterfly': ['Crown butterfly'], 'small butterflies': ['Small butterfly'],
    },
}
dg = bpy.context.evaluated_depsgraph_get(); out = {}
for prop, groups in GROUPS.items():
    obs = [o for o in bpy.data.collections['CK ' + prop].objects if o.type in ('MESH', 'CURVE')]
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
