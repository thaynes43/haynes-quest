"""Iteration helper: render review crops only (the sheet scene must already be built by iterate_preview.py)."""
import runpy
S = '/workspace/haynes-quest/family-eras/rescue-harbor-kit/v001/source/'
runpy.run_path(S + 'crops.py', run_name='__main__', init_globals={'CROP_SAMPLES': globals().get('CROP_SAMPLES', 16), 'CROP_ONLY': globals().get('ITER_CROPS', []), 'CROP_FROM_FINAL': False})
