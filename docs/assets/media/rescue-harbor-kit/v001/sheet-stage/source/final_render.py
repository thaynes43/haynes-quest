"""Final pass in short stages (one MCP call each, so no single call outlives the adapter's reply timeout):
STAGE 'sheet'  -> rebuild the blockout and render the full-size sheet (48 samples)
STAGE 'crops-front' / 'crops-three-quarter' -> close-ups (32 samples)
STAGE 'finish' -> per-feature measurements, then the sheet-scene checkpoint."""
import runpy, bpy, hashlib, json
S = '/workspace/haynes-quest/family-eras/rescue-harbor-kit/v001/source/'
STAGE = globals().get('STAGE', 'sheet')
PROPS = ['lookout-tower-facade', 'pier-bollard', 'rescue-buoy-stand', 'small-boat']
if STAGE == 'sheet':
    runpy.run_path(S + 'build_blockout.py', run_name='__main__')
    runpy.run_path(S + 'sheet.py', run_name='__main__')
elif STAGE.startswith('crops-'):
    view = STAGE[len('crops-'):]
    names = [f'crop-{p}-{view}.png' for p in PROPS] + (['crop-small-boat-plan.png'] if view == 'three-quarter' else [])
    runpy.run_path(S + 'crops.py', run_name='__main__', init_globals={'CROP_SAMPLES': 32, 'CROP_ONLY': names})
elif STAGE == 'finish':
    runpy.run_path(S + 'measure_parts.py', run_name='__main__')
    p = '/workspace/haynes-quest/family-eras/rescue-harbor-kit/v001/rescue-harbor-kit-reference-sheet-checkpoint.blend'
    bpy.ops.wm.save_as_mainfile(filepath=p, copy=True, compress=True)
    print('CHECKPOINT ' + json.dumps({'checkpoint': p, 'sha256': hashlib.sha256(open(p, 'rb').read()).hexdigest()}))
