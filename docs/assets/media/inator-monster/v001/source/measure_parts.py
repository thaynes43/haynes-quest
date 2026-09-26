"""WO111 inator-monster v001: read-only per-part world bounds of the blockout master (for reference-notes.md)."""
import bpy, json
from pathlib import Path
ROOT = Path('/workspace/haynes-quest/family-eras/inator-monster/v001')
P = lambda *ks: [f'Toy back plate {k:02d}' for k in ks]
GROUPS = {
    'torso': ['Pear kaiju torso'], 'belly patch': ['Butter belly patch', 'Belly scute line'],
    'head (cranium, snout, jaw, chin)': ['Monster cranium', 'Monster snout', 'Monster lower jaw', 'Butter chin'],
    'snout': ['Monster snout'], 'googly eyes': ['Googly eye white', 'Googly eye plastic rim', 'Googly pupil'],
    'googly eye right': ['Googly eye white +1'], 'googly eye left': ['Googly eye white -1'],
    'buck teeth': ['Buck tooth'], 'tongue': ['Pink tongue'],
    'tiny arms and mittens': ['Tiny arm', 'Mitten hand', 'Mitten claw nub', 'Suit wrist wrinkle'],
    'right leg and foot': ['Stumpy suit leg right', 'Big round foot right', 'Cream toe nub right', 'Baggy ankle wrinkle right'],
    'left leg and foot': ['Stumpy suit leg left', 'Big round foot left', 'Cream toe nub left', 'Baggy ankle wrinkle left'],
    'feet': ['Big round foot', 'Cream toe nub'], 'tail': ['Thick swept kaiju tail'],
    'back plates (torso rows)': P(*range(0, 8)), 'back plates (tail)': P(*range(8, 14)),
    'zipper': ['Costume zipper tape', 'Zipper tooth', 'Zipper slider', 'Dangling zipper pull tab'],
    'zipper pull tab': ['Dangling zipper pull tab'],
    'harness (belt, buckle, straps)': ['Cockpit harness belt', 'Brass harness buckle', 'Cockpit strap'],
    'cockpit tub (with rim, lights, rivets)': ['Violet cockpit tub', 'Brass cockpit rim', 'Cockpit light', 'Brass rivet'],
    'bubble dome and port': ['Bubble cockpit dome', 'Brass antenna port'],
    'scientist (body, head, arms)': ['Scientist', 'Lab coat', 'Mint high collar', 'Pocket pen', 'Wild hair spike', 'Goggle', 'Gleeful pupil',
                                     'Scheming brow', 'Purple glove', 'Pointing finger'],
    'scientist head (with hair, goggles)': ['Scientist round head', 'Scientist bald crown', 'Scientist ear', 'Scientist round nose', 'Goggle', 'Wild hair spike', 'Scheming brow'],
    'inator remote': ['Chunky inator remote', 'Big red inator button', 'Remote dial', 'Remote grille slot'],
    'zig-zag antenna with ball': ['Zig-zag antenna', 'Pink antenna ball'],
    'monster without cockpit or pilot': None,
}
dg = bpy.context.evaluated_depsgraph_get(); out = {}
obs = [o for o in bpy.data.collections['Inator monster blockout (master)'].objects if o.type in ('MESH', 'CURVE')]
COCKPIT = GROUPS['cockpit tub (with rim, lights, rivets)'] + GROUPS['bubble dome and port'] + ['Cockpit strap', 'Cockpit harness belt', 'Brass harness buckle']
for g, prefixes in GROUPS.items():
    lo = [1e9] * 3; hi = [-1e9] * 3; n = 0
    for ob in obs:
        if prefixes is None:
            if ob.get('in_dome') or any(ob.name.startswith(p) for p in COCKPIT): continue
        elif not any(ob.name.startswith(p) for p in prefixes): continue
        ev = ob.evaluated_get(dg); me = ev.to_mesh(); n += 1
        for v in me.vertices:
            w = ev.matrix_world @ v.co
            for k in range(3): lo[k] = min(lo[k], w[k]); hi[k] = max(hi[k], w[k])
        ev.to_mesh_clear()
    out[g] = {'parts': n, 'min': [round(x, 3) for x in lo], 'max': [round(x, 3) for x in hi], 'size': [round(hi[k] - lo[k], 3) for k in range(3)]}
(ROOT / 'part-measurements.json').write_text(json.dumps(out, indent=1) + '\n')
print(json.dumps(out))
