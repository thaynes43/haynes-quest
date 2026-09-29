"""WO111 casita-kit v001: close-up review crops of the reference-sheet scene (run after sheet.py).

Reframes the same orthographic sheet camera on each figure (front, three-quarter, and the planter from above), renders
1024x1024 PNGs into preview/, then restores the full-sheet camera, resolution and output path exactly.
Adapted from the playroom-kit v001 crops.py.
"""
import bpy, json, hashlib
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/casita-kit/v001')
SAMPLES = globals().get('CROP_SAMPLES', 32)
ONLY = globals().get('CROP_ONLY')
sc = bpy.context.scene
assert sc.get('asset_id') == 'casita-kit' and sc.get('scene_lease') == 'active'
VIEWS = {'front': 'front', 'q': 'three-quarter', 'top': 'from-above'}
SIZES = {'casita-terrace-wall': (5.2, 1.0), 'flower-planter': (1.45, 0.45), 'patterned-door': (2.7, 1.2), 'butterfly-arch': (3.9, 1.6)}
cols = {}
for ob in bpy.data.objects:
    if ob.name.startswith('View root '):
        view, prop = ob.name[len('View root '):].split(' ', 1)
        if view in VIEWS: cols[(view, prop)] = ob.location.copy()
cam = sc.camera; r = sc.render
saved = dict(loc=tuple(cam.location), ortho=cam.data.ortho_scale, rx=r.resolution_x, ry=r.resolution_y, pct=r.resolution_percentage,
             path=r.filepath, samples=sc.cycles.samples)
out = []
try:
    for (view, prop), loc in sorted(cols.items()):
        name = f'crop-{prop}-{VIEWS[view]}.png'
        if ONLY and name not in ONLY: continue
        width, cz = SIZES[prop]
        if view == 'top': cz = 0.0
        cam.location = (loc.x, saved['loc'][1], loc.z + cz); cam.data.ortho_scale = width
        r.resolution_x = 1024; r.resolution_y = 1024; r.resolution_percentage = 100; sc.cycles.samples = SAMPLES
        p = ROOT / 'preview' / name; r.filepath = str(p)
        bpy.ops.render.render(write_still=True)
        out.append({'image': str(p), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest(), 'view': view, 'prop': prop, 'ortho_width_m': width})
finally:
    cam.location = saved['loc']; cam.data.ortho_scale = saved['ortho']; r.resolution_x = saved['rx']; r.resolution_y = saved['ry']
    r.resolution_percentage = saved['pct']; r.filepath = saved['path']; sc.cycles.samples = saved['samples']
print(json.dumps(out))
