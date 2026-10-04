"""Report each clip's lowest evaluated skin vertex (time, part) for floor-contact tuning. argv: asset=<id>"""
import bpy, sys, json
import numpy as np
sys.path.insert(0, '/workspace/haynes-quest/action-worlds/minions-b/v001/source')
import common as C
args = dict(a.split('=', 1) for a in sys.argv[1:] if '=' in a)
sc = bpy.context.scene
arm = next(o for o in sc.objects if o.type == 'ARMATURE'); sk = next(o for o in sc.objects if o.type == 'MESH' and o.parent == arm)
rec = json.loads((C.REMOTE / args['asset'] / 'construction.json').read_text()); names = {p['index']: p['name'] for p in rec['parts_detail']}
dg = bpy.context.evaluated_depsgraph_get(); out = {}
for track in arm.animation_data.nla_tracks:
    arm.animation_data.action = track.strips[0].action; end = int(track.strips[0].action_frame_end); worst = (9, None, None)
    for f in range(end + 1):
        sc.frame_set(f); dg.update(); ev = sk.evaluated_get(dg); me = ev.to_mesh()
        co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
        pid = np.empty(len(me.vertices), dtype=np.int32); me.attributes['part_id'].data.foreach_get('value', pid)
        i = int(co[:, 2].argmin())
        if co[i, 2] < worst[0]: worst = (float(co[i, 2]), f / C.FPS, names.get(int(pid[i])))
        ev.to_mesh_clear()
    out[track.name] = worst
arm.animation_data.action = None
for pb in arm.pose.bones: pb.matrix_basis.identity()
sc.frame_set(0); print(json.dumps(out))
