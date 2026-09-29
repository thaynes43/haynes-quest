"""WO111 rescue-harbor-kit v001: read-only per-feature world bounds of the blockout master (for reference-notes.md)."""
import bpy, json
from pathlib import Path
ROOT = Path('/workspace/haynes-quest/family-eras/rescue-harbor-kit/v001')
GROUPS = {
    'lookout-tower-facade': {
        'stone footings': ['Stone footing'], 'timber legs': ['Timber leg'], 'x-bracing and girts': ['Brace', 'Girt'],
        'rescue ladder (rails, caps, rungs)': ['Ladder'], 'deck (fascia, planks)': ['Deck'],
        'balcony railing': ['Rail post', 'Rail top', 'Rail mid'],
        'balcony life ring (segments, grab line, clips, loop)': ['Balcony life ring', 'Life ring hanging loop'],
        'telescope and tripod': ['Tripod', 'Telescope'], 'cabin walls': ['Cabin walls'], 'window band (frames, panes)': ['Window'],
        'doghouse-arch door (door, frame, porthole, knob)': ['Doghouse-arch door', 'Door'], 'bone sign with paw': ['Bone sign'],
        'hip roof (fascia, roof, ribs)': ['Roof fascia', 'Hip roof', 'Hip rib'], 'beacon (drum, glass, bars, cap, finial)': ['Beacon'],
        'loudhailer horns': ['Loudhailer'],
    },
    'pier-bollard': {
        'timber piling': ['Timber piling'], 'wet tide band': ['Wet tide band'], 'barnacles': ['Barnacle'], 'iron strap': ['Iron strap'],
        'timber cracks': ['Timber crack'], 'starfish': ['Starfish'], 'bollard base plate': ['Bollard base plate'],
        'bollard body (navy iron)': ['Bollard body'], 'bollard cap (safety yellow)': ['Bollard cap'],
        'mooring rope (loop, tail, whipping)': ['Mooring rope', 'Rope end'],
    },
    'rescue-buoy-stand': {
        'posts and wet feet': ['Post left', 'Post right', 'Post wet foot'], 'post cap balls': ['Post cap ball'], 'post grain': ['Post grain'],
        'lower rail': ['Lower rail'], 'navy backboard': ['Navy backboard'], 'header board and red trim': ['Header board', 'Header top trim'],
        'header wave strip and bone': ['Header wave', 'Header bone'], 'ring peg': ['Ring peg'], 'life ring (eight segments)': ['Life ring segment'],
        'grab line and clips': ['Life ring grab line'], 'throw line coil and hook': ['Throw line', 'Coil hook'],
    },
    'small-boat': {
        'hull': ['Hull'], 'fender collar': ['Fender collar'], 'thwarts': ['Thwart'], 'floorboard seams': ['Floorboard'],
        'oars (shafts, blades)': ['Oar shaft', 'Oar blade'], 'oarlocks': ['Oarlock'], 'flank life rings': ['Flank life ring'],
        'bow paw prints': ['Bow paw'], 'outboard motor': ['Motor', 'Propeller'], 'stem mooring eye': ['Stem mooring'],
        'foredeck line coil': ['Foredeck line'],
    },
}
dg = bpy.context.evaluated_depsgraph_get(); out = {}; unclaimed = {}
for prop, groups in GROUPS.items():
    obs = [o for o in bpy.data.collections['RH ' + prop].objects if o.type in ('MESH', 'CURVE')]
    out[prop] = {}; claimed = set()
    for g, prefixes in groups.items():
        lo = [1e9] * 3; hi = [-1e9] * 3; n = 0; tris = 0
        for ob in obs:
            part = ob.get('blockout_part', '')
            if not any(part.startswith(p) for p in prefixes): continue
            claimed.add(ob.name)
            ev = ob.evaluated_get(dg); me = ev.to_mesh(); n += 1; me.calc_loop_triangles(); tris += len(me.loop_triangles)
            for v in me.vertices:
                w = ev.matrix_world @ v.co
                for k in range(3): lo[k] = min(lo[k], w[k]); hi[k] = max(hi[k], w[k])
            ev.to_mesh_clear()
        assert n, (prop, g)
        out[prop][g] = {'parts': n, 'blockout_triangles': tris, 'min': [round(x, 3) for x in lo], 'max': [round(x, 3) for x in hi],
                        'size': [round(hi[k] - lo[k], 3) for k in range(3)]}
    unclaimed[prop] = sorted(o.get('blockout_part', o.name) for o in obs if o.name not in claimed)
assert not any(unclaimed.values()), unclaimed
(ROOT / 'part-measurements.json').write_text(json.dumps(out, indent=1) + '\n')
print(json.dumps(out))
