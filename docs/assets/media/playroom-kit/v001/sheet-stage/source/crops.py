"""WO111 playroom-kit v001: close-up review crops of the reference-sheet scene (run after sheet.py).

Reframes the same orthographic sheet camera on each prop's front and three-quarter view, renders PNGs into preview/,
then restores the full-sheet camera, resolution and output path exactly.
"""
import bpy, json, hashlib
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/playroom-kit/v001')
SAMPLES = globals().get('CROP_SAMPLES', 32)
ONLY = globals().get('CROP_ONLY')
sc = bpy.context.scene
assert sc.get('asset_id') == 'playroom-kit' and sc.get('scene_lease') == 'active'
rec = json.loads((ROOT / 'sheet-render.json').read_text()) if globals().get('CROP_FROM_FINAL', True) and (ROOT / 'sheet-render.json').exists() else None
cols = {}
for ob in bpy.data.objects:
    if ob.name.startswith('View root '):
        label, prop = ob.name[len('View root '):].split(' ', 1)
        cols[(label, prop)] = ob.location.copy()
SIZES = {'stacking-block-tower': (2.7, 1.2), 'toy-bus-garage': (4.6, 1.1), 'crib-rail-fence': (3.5, 0.45), 'giant-plush-ball': (2.1, 0.9)}
cam = sc.camera; r = sc.render
saved = dict(loc=tuple(cam.location), ortho=cam.data.ortho_scale, rx=r.resolution_x, ry=r.resolution_y, pct=r.resolution_percentage,
             path=r.filepath, samples=sc.cycles.samples)
out = []
try:
    for (label, prop), loc in sorted(cols.items()):
        name = f'crop-{prop}-{"front" if label == "FRONT" else "three-quarter"}.png'
        if ONLY and name not in ONLY: continue
        width, cz = SIZES[prop]
        cam.location = (loc.x, saved['loc'][1], loc.z + cz); cam.data.ortho_scale = width
        r.resolution_x = 1024; r.resolution_y = 1024; r.resolution_percentage = 100; sc.cycles.samples = SAMPLES
        p = ROOT / 'preview' / name; r.filepath = str(p)
        bpy.ops.render.render(write_still=True)
        out.append({'image': str(p), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest(), 'view': label, 'prop': prop, 'ortho_width_m': width})
finally:
    cam.location = saved['loc']; cam.data.ortho_scale = saved['ortho']; r.resolution_x = saved['rx']; r.resolution_y = saved['ry']
    r.resolution_percentage = saved['pct']; r.filepath = saved['path']; sc.cycles.samples = saved['samples']
print(json.dumps(out))
