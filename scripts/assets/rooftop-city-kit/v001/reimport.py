"""Exact-byte GLB round-trip inspection in isolated temporary Blender scenes."""
import bpy, json, hashlib
from pathlib import Path
from mathutils import Vector
ROOT = Path('/workspace/haynes-quest/family-eras/rooftop-city-kit/v001')
live = bpy.context.scene
assert live.get('scene_owner') == 'gpt-6-astra/rooftop-city-kit-props' and live.get('scene_lease') == 'active'
results = {}
for prop in ['water-tower','rooftop-ac-unit','crane-hook','billboard-frame']:
    temp = bpy.data.scenes.new('Roundtrip ' + prop)
    bpy.context.window.scene = temp
    try:
        path = ROOT / (prop+'.glb')
        bpy.ops.import_scene.gltf(filepath=str(path))
        bpy.context.view_layer.update()
        meshes=[o for o in temp.objects if o.type=='MESH']; triangles=0; verts=[]
        for ob in meshes:
            ob.data.calc_loop_triangles();triangles+=len(ob.data.loop_triangles)
            verts.extend(ob.matrix_world @ v.co for v in ob.data.vertices)
        lo=[min(v[k] for v in verts) for k in range(3)];hi=[max(v[k] for v in verts) for k in range(3)]
        results[prop]={'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'meshes':len(meshes),'triangles':triangles,
            'bbox_gltf':{'min':[lo[0],lo[2],-hi[1]],'max':[hi[0],hi[2],-lo[1]]},
            'checks':{'floor_at_zero':abs(lo[2])<1e-5,'budget':triangles<=5000,'no_animation':all(o.animation_data is None for o in temp.objects)}}
        assert all(results[prop]['checks'].values()),results[prop]
    finally:
        for ob in list(temp.objects):bpy.data.objects.remove(ob,do_unlink=True)
        bpy.context.window.scene=live;bpy.data.scenes.remove(temp)
(ROOT/'reimport.json').write_text(json.dumps({'all_checks_pass':True,'props':results},indent=2)+'\n')
print(json.dumps(results))
