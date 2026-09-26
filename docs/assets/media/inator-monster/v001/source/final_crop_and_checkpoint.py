"""Final pass part 2: re-render the cockpit side close-up and save the sheet-scene checkpoint (after sheet.py)."""
import runpy, bpy, hashlib, json
S = '/workspace/haynes-quest/family-eras/inator-monster/v001/source/'
runpy.run_path(S + 'crops.py', run_name='__main__', init_globals={'CROP_SAMPLES': 32, 'CROP_ONLY': ['crop-cockpit-side.png']})
p = '/workspace/haynes-quest/family-eras/inator-monster/v001/inator-monster-reference-sheet-checkpoint.blend'
bpy.ops.wm.save_as_mainfile(filepath=p, copy=True, compress=True)
print(json.dumps({'checkpoint': p, 'sha256': hashlib.sha256(open(p, 'rb').read()).hexdigest()}))
