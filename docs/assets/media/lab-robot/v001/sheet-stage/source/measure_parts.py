"""WO111 lab-robot v001: read-only per-part world bounds of the blockout master (for reference-notes.md)."""
import bpy, json
from pathlib import Path
ROOT = Path('/workspace/haynes-quest/family-eras/lab-robot/v001')
GROUPS = {
    'whole head (band, dome, trims, ears, lens, eyelid, smile; no warning light)': ['Tin head band', 'Tin dome head', 'Head bottom trim', 'Head seam ring',
        'Ear disc', 'Ear bolt', 'Lens barrel', 'Lens brass bezel', 'Lens glass', 'Tilted plum eyelid', 'Speaker-grille smile'],
    'head band': ['Tin head band'], 'dome': ['Tin dome head'], 'ears (discs + bolts)': ['Ear disc', 'Ear bolt'],
    'lens eye (barrel, bezel, glass)': ['Lens barrel', 'Lens brass bezel', 'Lens glass'], 'lens bezel': ['Lens brass bezel'],
    'lens glass': ['Lens glass'], 'iris ring': ['Lens iris ring'], 'pupil': ['Lens pupil'], 'eyelid': ['Tilted plum eyelid'],
    'smile': ['Speaker-grille smile'],
    'warning light (base, glass, dome, cage)': ['Warning light brass base', 'Warning beacon amber glass', 'Warning beacon amber dome', 'Beacon cage wire'],
    'warning light amber glass': ['Warning beacon amber glass', 'Warning beacon amber dome'],
    'neck bellows': ['Neck bellows'],
    'tin body box': ['Tin body box'], 'chest control panel': ['Chest control panel'],
    'self-destruct button (button + cap)': ['Self-destruct button'], 'hazard ring': ['Hazard ring wedge'],
    'gauge dials': ['Gauge dial rim'], 'indicator lights': ['Indicator light'], 'hazard kick plate': ['Hazard kick plate'],
    'side louvers': ['Side louver'], 'back hatch': ['Back hatch'], 'cord grommet': ['Cord grommet'],
    'shoulder sockets': ['Shoulder socket'],
    'right slinky arm (raised)': ['Slinky arm right'], 'left slinky arm (reaching)': ['Slinky arm left'],
    'right claw (cuff, palm, jaws, tips)': ['Wrist cuff right', 'Claw palm right', 'Pincer jaw right', 'Pincer tip right'],
    'left claw (cuff, palm, jaws, tips)': ['Wrist cuff left', 'Claw palm left', 'Pincer jaw left', 'Pincer tip left'],
    'swivel waist': ['Swivel waist', 'Waist brass ring'], 'chassis crossbar': ['Chassis crossbar'],
    'right tank tread (belt + lugs)': ['Rubber tank tread right', 'Tread lug right'], 'left tank tread (belt + lugs)': ['Rubber tank tread left', 'Tread lug left'],
    'both treads with wheels and hubcaps': ['Rubber tank tread', 'Tread lug', 'Tread housing plate', 'Road wheel', 'Brass hubcap', 'Hub bolt'],
    'end road wheels': ['Road wheel right front', 'Road wheel right back', 'Road wheel left front', 'Road wheel left back'],
    'power cord': ['Unplugged power cord'], 'power plug (body + prongs)': ['Power plug body', 'Plug prong'],
}
dg = bpy.context.evaluated_depsgraph_get(); out = {}
obs = [o for o in bpy.data.collections['Lab robot blockout (master)'].objects if o.type in ('MESH', 'CURVE')]
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
