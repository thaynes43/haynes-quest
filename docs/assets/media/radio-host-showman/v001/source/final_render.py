"""Final pass: full-size sheet (48 samples), all close-ups (32 samples), per-part measurements, sheet-scene checkpoint."""
import runpy, bpy, hashlib, json
S = '/workspace/haynes-quest/family-eras/radio-host-showman/v001/source/'
runpy.run_path(S + 'sheet.py', run_name='__main__')
runpy.run_path(S + 'crops.py', run_name='__main__', init_globals={'CROP_SAMPLES': 32})
runpy.run_path(S + 'measure_parts.py', run_name='__main__')
p = '/workspace/haynes-quest/family-eras/radio-host-showman/v001/radio-host-showman-reference-sheet-checkpoint.blend'
bpy.ops.wm.save_as_mainfile(filepath=p, copy=True, compress=True)
print(json.dumps({'checkpoint': p, 'sha256': hashlib.sha256(open(p, 'rb').read()).hexdigest()}))
