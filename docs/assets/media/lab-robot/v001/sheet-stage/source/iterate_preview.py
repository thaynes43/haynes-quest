"""Iteration helper: rebuild the blockout, render the half-size sheet preview and quick close-up crops."""
import runpy
S = '/workspace/haynes-quest/family-eras/lab-robot/v001/source/'
ONLY = globals().get('ITER_CROPS', ['crop-face-front.png', 'crop-face-three-quarter.png'])
runpy.run_path(S + 'build_blockout.py', run_name='__main__')
runpy.run_path(S + 'sheet.py', run_name='__main__', init_globals={'SHEET_PERCENT': 50, 'SHEET_SAMPLES': 16, 'SHEET_OUT': 'preview/sheet-preview.png'})
if ONLY:
    runpy.run_path(S + 'crops.py', run_name='__main__', init_globals={'CROP_SAMPLES': 16, 'CROP_ONLY': ONLY})
