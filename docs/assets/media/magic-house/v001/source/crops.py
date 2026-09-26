"""WO111 magic-house v001: close-up review crops of the reference-sheet scene (run after sheet.py).

Reframes the same orthographic sheet camera on single views, renders square PNGs into preview/,
then restores the full-sheet camera, resolution and output path exactly.
"""
import bpy, json, hashlib
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/magic-house/v001')
SAMPLES = globals().get('CROP_SAMPLES', 32)
CROPS = [('crop-front.png', 'FRONT', 1.47, 3.05), ('crop-face-front.png', 'FRONT', 1.18, 1.55),
         ('crop-three-quarter.png', 'THREE-QUARTER', 1.47, 3.05), ('crop-side.png', 'SIDE', 1.47, 3.05)]

def view_center_x(label):
    dg = bpy.context.evaluated_depsgraph_get(); xs = []
    for ob in bpy.data.collections['Reference sheet (figures)'].objects:
        if not ob.name.endswith(' | View root ' + label) or ob.type not in ('MESH', 'CURVE'): continue
        ev = ob.evaluated_get(dg); me = ev.to_mesh(); xs += [(ev.matrix_world @ v.co).x for v in me.vertices]; ev.to_mesh_clear()
    return (min(xs) + max(xs)) / 2

sc = bpy.context.scene
assert sc.get('asset_id') == 'magic-house' and sc.get('scene_lease') == 'active'
cam = sc.camera; r = sc.render
saved = dict(loc=tuple(cam.location), ortho=cam.data.ortho_scale, rx=r.resolution_x, ry=r.resolution_y, pct=r.resolution_percentage,
             path=r.filepath, samples=sc.cycles.samples)
out = []
try:
    for name, label, cz, width in CROPS:
        cam.location = (view_center_x(label), saved['loc'][1], cz); cam.data.ortho_scale = width
        r.resolution_x = 1024; r.resolution_y = 1024; r.resolution_percentage = 100; sc.cycles.samples = SAMPLES
        p = ROOT / 'preview' / name; r.filepath = str(p)
        bpy.ops.render.render(write_still=True)
        out.append({'image': str(p), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest(), 'view': label, 'ortho_width_m': width, 'center_z_m': cz})
finally:
    cam.location = saved['loc']; cam.data.ortho_scale = saved['ortho']; r.resolution_x = saved['rx']; r.resolution_y = saved['ry']
    r.resolution_percentage = saved['pct']; r.filepath = saved['path']; sc.cycles.samples = saved['samples']
print(json.dumps(out))
